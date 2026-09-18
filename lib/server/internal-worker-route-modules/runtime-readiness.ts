import { NextResponse } from "next/server";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { authorizeMarketIntegrityCron } from "@/lib/security/market-integrity-cron-auth";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { buildDurableComputationWorkerReadiness } from "@/lib/jobs/durable-computation-worker";
import { getDurableComputationOperationalSnapshot } from "@/lib/jobs/durable-computation-operations";
import { buildStripeWebhookReconciliationReadiness } from "@/lib/payments/stripe-webhook-reconciler";
import { readPass4656ProviderHealthSnapshot } from "@/lib/market-integrity/provider-health-store";
import { probeNativeRedisReadiness } from "@/lib/security/native-redis-rate-limit";
import { buildRuntimeReadinessSnapshot } from "@/lib/observability/runtime-readiness";
import {
  resolveRequestCorrelationId,
  withRequestCorrelation,
} from "@/lib/observability/request-correlation";
import { writeOperationalEvent } from "@/lib/security/operational-log-boundary";

function json(body: unknown, status: number, correlationId: string) {
  return withRequestCorrelation(NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  }), correlationId);
}

function safeFailureCode(error: unknown, fallback: string) {
  const candidate = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return /^[a-z][a-z0-9_]{2,79}$/.test(candidate) ? candidate : fallback;
}

async function rateLimit(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "runtime-readiness",
    limit: 12,
    windowMs: 60_000,
  });
  return rate.ok ? null : rate.response;
}

export async function GET(request: Request) {
  const correlationId = resolveRequestCorrelationId(request);
  const auth = authorizeMarketIntegrityCron(request);
  if (!auth.authorized) {
    return json({ ok: false, error: "unauthorized_worker", correlationId }, 401, correlationId);
  }
  const denied = await rateLimit(request);
  if (denied) return withRequestCorrelation(denied, correlationId);

  try {
    const dbConfigured = hasSupabaseServiceRoleConfig();
    const workerReadiness = buildDurableComputationWorkerReadiness();
    const stripeReadiness = buildStripeWebhookReconciliationReadiness();

    const [redis, providerRead, durableResult] = await Promise.all([
      probeNativeRedisReadiness({ correlationId }),
      readPass4656ProviderHealthSnapshot().catch((error) => ({
        snapshot: null,
        verification: null,
        durable: false,
        mode: "error" as const,
        blockers: [safeFailureCode(error, "provider_health_read_failed")],
      })),
      (async () => {
        const started = performance.now();
        try {
          const snapshot = await getDurableComputationOperationalSnapshot();
          return {
            ok: true as const,
            snapshot,
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            code: null,
          };
        } catch (error) {
          return {
            ok: false as const,
            snapshot: null,
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            code: safeFailureCode(error, "supabase_operational_snapshot_failed"),
          };
        }
      })(),
    ]);

    const durableMetrics = durableResult.snapshot?.metrics;
    const auditPdf = durableMetrics?.byKind.audit_pdf_render;
    const lensPdf = durableMetrics?.byKind.lens_pdf_render;
    const providerSnapshot = providerRead.snapshot;
    const providerVerification = providerRead.verification;
    const providerRows = providerSnapshot?.ledger.providers ?? [];
    const providerFailed = providerRows.filter((row) => row.status !== "healthy").length;
    const providerBlockers = providerRows.reduce((sum, row) => sum + row.blockers.length, 0)
      + (providerRead.blockers?.length ?? 0);

    const snapshot = buildRuntimeReadinessSnapshot({
      correlationId,
      web: { reachable: true },
      redis: {
        ready: redis.ready,
        selected: redis.selected,
        latencyMs: redis.latencyMs,
        code: redis.code,
      },
      database: {
        configured: dbConfigured,
        reachable: durableResult.ok,
        latencyMs: durableResult.latencyMs,
        code: durableResult.code,
      },
      worker: {
        executable: workerReadiness.executable,
        severity: durableResult.snapshot?.severity ?? "unknown",
        processing: durableMetrics?.processing ?? 0,
        retryWait: durableMetrics?.retryWait ?? 0,
        deadLetter: durableMetrics?.deadLetter ?? 0,
        expiredLeases: durableMetrics?.expiredLeases ?? 0,
        oldestReadyAgeSeconds: durableMetrics?.oldestReadyAgeSeconds ?? 0,
        oldestLeaseAgeSeconds: durableMetrics?.oldestLeaseAgeSeconds ?? 0,
      },
      stripe: {
        webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
        serverSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        reconciliationReady: stripeReadiness.durableReady && stripeReadiness.cronSecretConfigured,
        alertSinkConfigured: stripeReadiness.alertSinkConfigured,
      },
      providers: {
        snapshotPresent: Boolean(providerSnapshot),
        snapshotValid: Boolean(providerVerification?.valid),
        snapshotFresh: Boolean(providerVerification?.fresh),
        durable: providerRead.durable,
        failedProviders: providerFailed,
        blockerCount: providerBlockers,
      },
      reports: {
        workerExecutable: workerReadiness.executable,
        processing: (auditPdf?.processing ?? 0) + (lensPdf?.processing ?? 0),
        retryWait: (auditPdf?.retryWait ?? 0) + (lensPdf?.retryWait ?? 0),
        deadLetter: (auditPdf?.deadLetter ?? 0) + (lensPdf?.deadLetter ?? 0),
        completedRetained: (auditPdf?.completedRetained ?? 0) + (lensPdf?.completedRetained ?? 0),
      },
      storage: {
        durableConfigured: dbConfigured,
        reachable: durableResult.ok,
      },
    });

    writeOperationalEvent({
      level: snapshot.state === "ready" ? "info" : snapshot.state === "degraded" ? "warn" : "error",
      system: "runtime",
      event: "readiness_snapshot",
      code: `runtime_${snapshot.state}`,
      correlationId,
      metrics: {
        ready: snapshot.counts.ready,
        degraded: snapshot.counts.degraded,
        blocked: snapshot.counts.blocked,
        workerRetryWait: snapshot.retryVisibility.workerRetryWait,
        workerDeadLetter: snapshot.retryVisibility.workerDeadLetter,
        reportRetryWait: snapshot.retryVisibility.reportRetryWait,
        reportDeadLetter: snapshot.retryVisibility.reportDeadLetter,
      },
    });

    return json({
      ok: snapshot.state === "ready",
      snapshot,
      privacyBoundary: snapshot.privacyBoundary,
    }, snapshot.state === "ready" ? 200 : 503, correlationId);
  } catch (error) {
    writeOperationalEvent({
      level: "error",
      system: "runtime",
      event: "readiness_failed",
      code: "runtime_readiness_failed",
      correlationId,
      error,
    });
    return withRequestCorrelation(publicApiError(error, {
      route: "/api/internal/workers/runtime-readiness",
      code: "runtime_readiness_failed",
      status: 503,
      correlationId,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    }), correlationId);
  }
}
