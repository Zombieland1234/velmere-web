import { createHash, createHmac, randomUUID } from "node:crypto";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";

export const DURABLE_COMPUTATION_ALERT_DELIVERY_ID = "velmere-durable-computation-alert-delivery-v1" as const;

export type DurableComputationAlertPayload = {
  schemaVersion: "velmere.durable-computation-alert.v1";
  alertId: string;
  code: "dead_letter_nonzero" | "retry_backlog" | "expired_lease" | "old_ready_job" | "old_processing_lease" | "provider_history_anomaly" | "provider_observation_retention_drift" | "provider_observation_ledger_stale" | "provider_quality_auto_rollback_required";
  severity: "warning" | "critical";
  observedValue: number;
  thresholdValue: number;
  attempt: number;
  emittedAt: string;
};

type ClaimedAlert = {
  alertId: string;
  code: DurableComputationAlertPayload["code"];
  severity: DurableComputationAlertPayload["severity"];
  observedValue: number;
  thresholdValue: number;
  attemptCount: number;
};

type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;

type AlertDeliveryDependencies = {
  rpc: RpcRunner;
  token: () => string;
  now: () => Date;
  deliver: (input: {
    url: string;
    allowedHosts: string[];
    payload: DurableComputationAlertPayload;
    signingSecret: string;
    timeoutMs: number;
  }) => Promise<{ status: number }>;
};

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function cleanHosts(value: string | undefined) {
  return String(value ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean).slice(0, 16);
}

function usableSecret(value: string | undefined) {
  const secret = String(value ?? "").trim();
  return secret.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me)/i.test(secret) ? secret : "";
}

function safeCode(value: unknown) {
  return String(value instanceof Error ? value.message : value ?? "alert_delivery_failed")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 80) || "alert_delivery_failed";
}

function claimedRows(data: unknown): ClaimedAlert[] {
  if (!Array.isArray(data)) throw new Error("durable_alert_claim_telemetry_invalid:not_array");
  const expectedKeys = ["alert_id", "attempt_count", "code", "observed_value", "severity", "threshold_value"];
  return data.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`durable_alert_claim_telemetry_invalid:row_${index}`);
    }
    const row = item as Record<string, unknown>;
    if (Object.keys(row).sort().join("|") !== expectedKeys.join("|")) {
      throw new Error(`durable_alert_claim_telemetry_invalid:keys_${index}`);
    }
    const alertId = String(row.alert_id ?? "");
    const code = String(row.code ?? "") as ClaimedAlert["code"];
    const severity = String(row.severity ?? "") as ClaimedAlert["severity"];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alertId)) {
      throw new Error(`durable_alert_claim_telemetry_invalid:alert_id_${index}`);
    }
    if (!["dead_letter_nonzero", "retry_backlog", "expired_lease", "old_ready_job", "old_processing_lease", "provider_history_anomaly", "provider_observation_retention_drift", "provider_observation_ledger_stale", "provider_quality_auto_rollback_required"].includes(code)) {
      throw new Error(`durable_alert_claim_telemetry_invalid:code_${index}`);
    }
    if (severity !== "warning" && severity !== "critical") {
      throw new Error(`durable_alert_claim_telemetry_invalid:severity_${index}`);
    }
    for (const key of ["observed_value", "threshold_value", "attempt_count"] as const) {
      if (!Number.isSafeInteger(row[key]) || Number(row[key]) < 0) {
        throw new Error(`durable_alert_claim_telemetry_invalid:${key}_${index}`);
      }
    }
    return {
      alertId,
      code,
      severity,
      observedValue: Number(row.observed_value),
      thresholdValue: Number(row.threshold_value),
      attemptCount: Number(row.attempt_count),
    };
  });
}

function destinationHash(url: string) {
  const parsed = new URL(url);
  return createHash("sha256").update(`${parsed.protocol}//${parsed.host}${parsed.pathname}`).digest("hex");
}

export function buildDurableComputationAlertDeliveryReadiness(env: Record<string, string | undefined> = process.env) {
  const url = String(env.VELMERE_ALERT_WEBHOOK_URL ?? "").trim();
  const allowedHosts = cleanHosts(env.VELMERE_ALERT_WEBHOOK_ALLOWED_HOSTS);
  const signingSecret = usableSecret(env.VELMERE_ALERT_WEBHOOK_SIGNING_SECRET);
  let urlValid: boolean;
  let hostAllowed = false;
  try {
    const parsed = new URL(url);
    urlValid = parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port;
    hostAllowed = allowedHosts.includes(parsed.hostname.toLowerCase());
  } catch {
    urlValid = false;
  }
  const configured = Boolean(urlValid && hostAllowed && signingSecret);
  return {
    schemaVersion: "velmere.durable-computation-alert-delivery-readiness.v1" as const,
    configured,
    urlConfigured: Boolean(url),
    urlValid,
    allowedHostCount: allowedHosts.length,
    destinationAllowlisted: hostAllowed,
    signingSecretConfigured: Boolean(signingSecret),
    deliveryProven: false,
    blockers: [
      ...(!url ? ["alert_webhook_url_missing"] : []),
      ...(url && !urlValid ? ["alert_webhook_url_invalid"] : []),
      ...(!allowedHosts.length ? ["alert_webhook_allowlist_missing"] : []),
      ...(urlValid && !hostAllowed ? ["alert_webhook_host_not_allowlisted"] : []),
      ...(!signingSecret ? ["alert_webhook_signing_secret_missing_or_weak"] : []),
    ],
    privacyBoundary: "Configuration readiness only. URL, host values and signing secret are never returned.",
  };
}

async function defaultDeliver(input: {
  url: string;
  allowedHosts: string[];
  payload: DurableComputationAlertPayload;
  signingSecret: string;
  timeoutMs: number;
}) {
  const body = JSON.stringify(input.payload);
  if (Buffer.byteLength(body, "utf8") > 4096) throw new Error("alert_payload_too_large");
  const timestamp = String(Math.trunc(Date.now() / 1000));
  const signature = createHmac("sha256", input.signingSecret).update(`${timestamp}.${body}`).digest("hex");
  const response = await safeEgressFetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body, "utf8")),
      "user-agent": "velmere-durable-computation-alert-worker/1",
      "x-velmere-alert-timestamp": timestamp,
      "x-velmere-alert-signature": `v1=${signature}`,
    },
    body,
  }, {
    allowedHosts: input.allowedHosts,
    allowSubdomains: false,
    maxRedirects: 0,
    timeoutMs: input.timeoutMs,
    operation: "durable_computation_alert_delivery",
    allowedMethods: ["POST"],
    maxRequestBytes: 4096,
    maxResponseBytes: 16 * 1024,
  });
  await readResponseBytesBounded(response, 16 * 1024).catch(() => new Uint8Array());
  return { status: response.status };
}

const defaultDependencies: AlertDeliveryDependencies = {
  rpc: runRegisteredServiceRoleRpc,
  token: randomUUID,
  now: () => new Date(),
  deliver: defaultDeliver,
};

function outcomeForStatus(status: number): { outcome: "delivered" | "retry" | "dead_letter"; errorCode: string | null } {
  if (status >= 200 && status < 300) return { outcome: "delivered", errorCode: null };
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500) return { outcome: "retry", errorCode: `alert_sink_http_${status}` };
  return { outcome: "dead_letter", errorCode: `alert_sink_http_${status}` };
}

export async function runDurableComputationAlertDelivery(input: {
  env?: Record<string, string | undefined>;
  limit?: number;
  leaseSeconds?: number;
  timeoutMs?: number;
  workerId?: string;
  dependencies?: AlertDeliveryDependencies;
} = {}) {
  const env = input.env ?? process.env;
  const dependencies = input.dependencies ?? defaultDependencies;
  const readiness = buildDurableComputationAlertDeliveryReadiness(env);
  const summary = {
    schemaVersion: "velmere.durable-computation-alert-delivery-summary.v1" as const,
    configured: readiness.configured,
    claimed: 0,
    delivered: 0,
    retryWait: 0,
    deadLetter: 0,
    conflicts: 0,
    storeFailed: 0,
    destinationHash: null as string | null,
    privacyBoundary: "Aggregate delivery counts and a destination hash only. No URLs, alert IDs, account data, payload secrets, signing secrets or response bodies are returned.",
  };
  if (!readiness.configured) return summary;

  const url = String(env.VELMERE_ALERT_WEBHOOK_URL).trim();
  const allowedHosts = cleanHosts(env.VELMERE_ALERT_WEBHOOK_ALLOWED_HOSTS);
  const signingSecret = usableSecret(env.VELMERE_ALERT_WEBHOOK_SIGNING_SECRET);
  const workerId = String(input.workerId ?? `dc-alert-${dependencies.token()}`).slice(0, 160);
  const leaseToken = dependencies.token();
  const limit = clamp(input.limit, 10, 1, 25);
  const leaseSeconds = clamp(input.leaseSeconds, 60, 15, 300);
  const timeoutMs = clamp(input.timeoutMs, 5000, 500, 15000);
  const destHash = destinationHash(url);
  summary.destinationHash = destHash;

  const claimed = await dependencies.rpc({
    operation: "durable_computation_alert_claim_batch",
    args: { p_worker_id: workerId, p_lease_token: leaseToken, p_limit: limit, p_lease_seconds: leaseSeconds },
  });
  const alerts = claimedRows(claimed.data);
  summary.claimed = alerts.length;

  for (const alert of alerts) {
    const payload: DurableComputationAlertPayload = {
      schemaVersion: "velmere.durable-computation-alert.v1",
      alertId: alert.alertId,
      code: alert.code,
      severity: alert.severity,
      observedValue: alert.observedValue,
      thresholdValue: alert.thresholdValue,
      attempt: alert.attemptCount,
      emittedAt: dependencies.now().toISOString(),
    };
    let outcome: "delivered" | "retry" | "dead_letter";
    let status = 0;
    let errorCode: string | null;
    try {
      const delivery = await dependencies.deliver({ url, allowedHosts, payload, signingSecret, timeoutMs });
      status = delivery.status;
      ({ outcome, errorCode } = outcomeForStatus(status));
    } catch (error) {
      outcome = "retry";
      errorCode = safeCode(error);
    }
    try {
      const settled = await dependencies.rpc({
        operation: "durable_computation_alert_settle",
        args: {
          p_alert_id: alert.alertId,
          p_lease_token: leaseToken,
          p_outcome: outcome,
          p_http_status: status || null,
          p_destination_hash: destHash,
          p_error_code: errorCode,
        },
      });
      const state = String(Array.isArray(settled.data) ? (settled.data[0] as Record<string, unknown> | undefined)?.state ?? "" : (settled.data as Record<string, unknown> | null)?.state ?? settled.data ?? "");
      if (state === "delivered") summary.delivered += 1;
      else if (state === "retry_wait") summary.retryWait += 1;
      else if (state === "dead_letter") summary.deadLetter += 1;
      else summary.conflicts += 1;
    } catch {
      summary.storeFailed += 1;
    }
  }
  return summary;
}
