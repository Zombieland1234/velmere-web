export const C14_P26_RUNTIME_READINESS_SCHEMA = "velmere.c14-p26.runtime-readiness.v1" as const;

export type RuntimeComponentId =
  | "web"
  | "worker"
  | "redis"
  | "postgresql_supabase"
  | "stripe_webhooks"
  | "provider_calls"
  | "report_generation"
  | "storage";

export type RuntimeReadinessState = "ready" | "degraded" | "blocked";

export type RuntimeComponentSnapshot = {
  id: RuntimeComponentId;
  state: RuntimeReadinessState;
  reasonCodes: string[];
  metrics: Record<string, number | boolean | null>;
  retryVisible: boolean;
  deadLetterVisible: boolean;
  operatorAction: string;
};

export type RuntimeReadinessInput = {
  correlationId: string;
  generatedAt?: Date;
  web: {
    reachable: boolean;
  };
  redis: {
    ready: boolean;
    selected: boolean;
    latencyMs: number | null;
    code?: string | null;
  };
  database: {
    configured: boolean;
    reachable: boolean;
    latencyMs: number | null;
    code?: string | null;
  };
  worker: {
    executable: boolean;
    severity: "none" | "warning" | "critical" | "unknown";
    processing: number;
    retryWait: number;
    deadLetter: number;
    expiredLeases: number;
    oldestReadyAgeSeconds: number;
    oldestLeaseAgeSeconds: number;
  };
  stripe: {
    webhookSecretConfigured: boolean;
    serverSecretConfigured: boolean;
    reconciliationReady: boolean;
    alertSinkConfigured: boolean;
  };
  providers: {
    snapshotPresent: boolean;
    snapshotValid: boolean;
    snapshotFresh: boolean;
    durable: boolean;
    failedProviders: number;
    blockerCount: number;
  };
  reports: {
    workerExecutable: boolean;
    processing: number;
    retryWait: number;
    deadLetter: number;
    completedRetained: number;
  };
  storage: {
    durableConfigured: boolean;
    reachable: boolean;
  };
};

const SAFE_REASON = /^[a-z][a-z0-9_:.-]{2,95}$/;

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function reason(value: unknown, fallback = "unknown_failure") {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SAFE_REASON.test(normalized) ? normalized : fallback;
}

function component(
  id: RuntimeComponentId,
  state: RuntimeReadinessState,
  reasonCodes: unknown[],
  metrics: RuntimeComponentSnapshot["metrics"],
  retryVisible: boolean,
  deadLetterVisible: boolean,
  operatorAction: string,
): RuntimeComponentSnapshot {
  return {
    id,
    state,
    reasonCodes: Array.from(new Set(reasonCodes.map((value) => reason(value)).filter(Boolean))).slice(0, 12),
    metrics,
    retryVisible,
    deadLetterVisible,
    operatorAction,
  };
}

function severityRank(value: RuntimeReadinessState) {
  return value === "blocked" ? 2 : value === "degraded" ? 1 : 0;
}

export function buildRuntimeReadinessSnapshot(input: RuntimeReadinessInput) {
  const workerRetryWait = finiteNonNegative(input.worker.retryWait);
  const workerDeadLetter = finiteNonNegative(input.worker.deadLetter);
  const reportRetryWait = finiteNonNegative(input.reports.retryWait);
  const reportDeadLetter = finiteNonNegative(input.reports.deadLetter);
  const providerFailed = finiteNonNegative(input.providers.failedProviders);

  const web = component(
    "web",
    input.web.reachable ? "ready" : "blocked",
    input.web.reachable ? [] : ["web_route_unreachable"],
    { reachable: input.web.reachable },
    false,
    false,
    "Restore the web runtime before trusting downstream readiness signals.",
  );

  const redisState: RuntimeReadinessState = input.redis.ready ? "ready" : "blocked";
  const redis = component(
    "redis",
    redisState,
    input.redis.ready ? [] : [input.redis.code ?? (input.redis.selected ? "redis_unavailable" : "redis_backend_not_selected")],
    { selected: input.redis.selected, reachable: input.redis.ready, latencyMs: input.redis.latencyMs },
    false,
    false,
    "Verify the server-owned Redis configuration and connectivity. Keep durable rate limits fail-closed; do not switch to an in-memory production fallback.",
  );

  const databaseState: RuntimeReadinessState = input.database.configured && input.database.reachable ? "ready" : "blocked";
  const database = component(
    "postgresql_supabase",
    databaseState,
    databaseState === "ready"
      ? []
      : [!input.database.configured ? "supabase_service_role_not_configured" : input.database.code ?? "supabase_unreachable"],
    {
      configured: input.database.configured,
      reachable: input.database.reachable,
      latencyMs: input.database.latencyMs,
    },
    false,
    false,
    "Restore the durable Supabase/PostgreSQL path and validate bounded RPCs before requeueing jobs or payment effects.",
  );

  let workerState: RuntimeReadinessState = "ready";
  const workerReasons: string[] = [];
  if (!input.worker.executable || !input.database.reachable) {
    workerState = "blocked";
    workerReasons.push(!input.worker.executable ? "durable_worker_not_executable" : "durable_worker_store_unreachable");
  }
  if (input.worker.severity === "critical" || workerDeadLetter > 0) {
    workerState = "blocked";
    workerReasons.push(workerDeadLetter > 0 ? "durable_worker_dead_letter_nonzero" : "durable_worker_critical");
  } else if (input.worker.severity === "warning" || workerRetryWait > 0 || input.worker.expiredLeases > 0) {
    if (workerState !== "blocked") workerState = "degraded";
    if (workerRetryWait > 0) workerReasons.push("durable_worker_retry_backlog");
    if (input.worker.expiredLeases > 0) workerReasons.push("durable_worker_expired_leases");
  }
  const worker = component(
    "worker",
    workerState,
    workerReasons,
    {
      executable: input.worker.executable,
      processing: finiteNonNegative(input.worker.processing),
      retryWait: workerRetryWait,
      deadLetter: workerDeadLetter,
      expiredLeases: finiteNonNegative(input.worker.expiredLeases),
      oldestReadyAgeSeconds: finiteNonNegative(input.worker.oldestReadyAgeSeconds),
      oldestLeaseAgeSeconds: finiteNonNegative(input.worker.oldestLeaseAgeSeconds),
    },
    true,
    true,
    "Use durable-computation operations to inspect aggregate backlog, repair the root cause, then requeue only explicit dead-letter jobs under operator authorization.",
  );

  const stripeCriticalReady =
    input.stripe.webhookSecretConfigured
    && input.stripe.serverSecretConfigured
    && input.stripe.reconciliationReady
    && input.database.reachable;
  const stripeState: RuntimeReadinessState = stripeCriticalReady
    ? (input.stripe.alertSinkConfigured ? "ready" : "degraded")
    : "blocked";
  const stripeReasons = [
    !input.stripe.webhookSecretConfigured ? "stripe_webhook_secret_missing" : null,
    !input.stripe.serverSecretConfigured ? "stripe_server_secret_missing" : null,
    !input.stripe.reconciliationReady ? "stripe_reconciliation_not_ready" : null,
    !input.database.reachable ? "stripe_durable_store_unreachable" : null,
    stripeCriticalReady && !input.stripe.alertSinkConfigured ? "stripe_alert_sink_not_configured" : null,
  ].filter((value): value is string => Boolean(value));
  const stripe = component(
    "stripe_webhooks",
    stripeState,
    stripeReasons,
    {
      webhookSecretConfigured: input.stripe.webhookSecretConfigured,
      serverSecretConfigured: input.stripe.serverSecretConfigured,
      reconciliationReady: input.stripe.reconciliationReady,
      alertSinkConfigured: input.stripe.alertSinkConfigured,
    },
    true,
    true,
    "Use reconciliation aggregates to distinguish stale/retry/dead-letter effects. Correct the root cause before authenticated dead-letter requeue; never replay or log raw webhook payloads.",
  );

  let providerState: RuntimeReadinessState = "ready";
  const providerReasons: string[] = [];
  if (!input.providers.snapshotPresent || !input.providers.snapshotValid || !input.providers.snapshotFresh) {
    providerState = "blocked";
    if (!input.providers.snapshotPresent) providerReasons.push("provider_health_snapshot_missing");
    else if (!input.providers.snapshotValid) providerReasons.push("provider_health_snapshot_invalid");
    else providerReasons.push("provider_health_snapshot_stale");
  } else if (!input.providers.durable || providerFailed > 0 || input.providers.blockerCount > 0) {
    providerState = "degraded";
    if (!input.providers.durable) providerReasons.push("provider_health_snapshot_not_durable");
    if (providerFailed > 0) providerReasons.push("provider_health_failures_present");
    if (input.providers.blockerCount > 0) providerReasons.push("provider_health_blockers_present");
  }
  const providers = component(
    "provider_calls",
    providerState,
    providerReasons,
    {
      snapshotPresent: input.providers.snapshotPresent,
      snapshotValid: input.providers.snapshotValid,
      snapshotFresh: input.providers.snapshotFresh,
      durable: input.providers.durable,
      failedProviders: providerFailed,
      blockerCount: finiteNonNegative(input.providers.blockerCount),
    },
    true,
    false,
    "Run bounded provider recovery probes. Paid evidence stays fail-closed until a fresh valid health snapshot records recovery; do not promote memory-only health as durable.",
  );

  let reportState: RuntimeReadinessState = "ready";
  const reportReasons: string[] = [];
  if (!input.reports.workerExecutable || !input.database.reachable) {
    reportState = "blocked";
    reportReasons.push(!input.reports.workerExecutable ? "report_worker_not_executable" : "report_store_unreachable");
  }
  if (reportDeadLetter > 0) {
    reportState = "blocked";
    reportReasons.push("report_dead_letter_nonzero");
  } else if (reportRetryWait > 0) {
    if (reportState !== "blocked") reportState = "degraded";
    reportReasons.push("report_retry_backlog");
  }
  const reports = component(
    "report_generation",
    reportState,
    reportReasons,
    {
      workerExecutable: input.reports.workerExecutable,
      processing: finiteNonNegative(input.reports.processing),
      retryWait: reportRetryWait,
      deadLetter: reportDeadLetter,
      completedRetained: finiteNonNegative(input.reports.completedRetained),
    },
    true,
    true,
    "Treat PDF/render retries as durable worker incidents. Restore storage/provider dependencies first, then drain retries or explicitly requeue dead letters.",
  );

  const storageReady = input.storage.durableConfigured && input.storage.reachable;
  const storage = component(
    "storage",
    storageReady ? "ready" : "blocked",
    storageReady
      ? []
      : [!input.storage.durableConfigured ? "durable_storage_not_configured" : "durable_storage_unreachable"],
    { durableConfigured: input.storage.durableConfigured, reachable: input.storage.reachable },
    false,
    false,
    "Restore durable storage before payment, job, report or provider-health recovery. Never represent memory fallback as durable recovery.",
  );

  const components = [web, worker, redis, database, stripe, providers, reports, storage];
  const state = components.reduce<RuntimeReadinessState>(
    (current, row) => severityRank(row.state) > severityRank(current) ? row.state : current,
    "ready",
  );
  const counts = {
    ready: components.filter((row) => row.state === "ready").length,
    degraded: components.filter((row) => row.state === "degraded").length,
    blocked: components.filter((row) => row.state === "blocked").length,
  };
  const alertKeys = components
    .filter((row) => row.state !== "ready")
    .flatMap((row) => row.reasonCodes.map((code) => `${row.id}:${code}`))
    .slice(0, 48);

  return {
    schemaVersion: C14_P26_RUNTIME_READINESS_SCHEMA,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    correlationId: input.correlationId,
    state,
    counts,
    components,
    alertKeys,
    retryVisibility: {
      workerRetryWait,
      workerDeadLetter,
      reportRetryWait,
      reportDeadLetter,
    },
    privacyBoundary:
      "Operational aggregate counts, safe reason codes, readiness booleans and request correlation only. No secrets, URLs, raw provider/Stripe bodies, customer identifiers, job IDs, event IDs, tokens, SQL, stack traces or raw error messages.",
  } as const;
}
