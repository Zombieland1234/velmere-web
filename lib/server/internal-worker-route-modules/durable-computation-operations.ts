import { NextResponse } from "next/server";
import {
  authorizeMarketIntegrityCron,
  authorizeMarketIntegrityWorkerMutation,
  marketIntegrityWorkerMutationErrorStatus,
  verifyMarketIntegrityWorkerMutationEnvelope,
} from "@/lib/security/market-integrity-cron-auth";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import {
  getDurableComputationOperationalSnapshot,
  requeueDurableComputationDeadLetters,
  runDurableComputationMaintenance,
} from "@/lib/jobs/durable-computation-operations";
import { buildDurableComputationWorkerReadiness, runDurableComputationWorkerDrain } from "@/lib/jobs/durable-computation-worker";
import { buildDurableComputationDeploymentContract, getDurableComputationRuntimePolicy } from "@/lib/jobs/durable-computation-deployment";
import { runDurableComputationOperationsCycle } from "@/lib/jobs/durable-computation-cycle";
import { probeDurableComputationStaging } from "@/lib/jobs/durable-computation-staging";
import { buildDurableComputationAlertDeliveryReadiness } from "@/lib/jobs/durable-computation-alert-delivery";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

async function applyWorkerRateLimit(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "durable-computation-operations",
    limit: 12,
    windowMs: 60_000,
  });
  return rate.ok ? null : rate.response;
}

async function authorizeReadOnly(request: Request) {
  const auth = authorizeMarketIntegrityCron(request);
  if (!auth.authorized) return json({ ok: false, error: "unauthorized_worker" }, 401);
  return applyWorkerRateLimit(request);
}

async function authorizeMutation(request: Request, rawBody: string) {
  const verified = verifyMarketIntegrityWorkerMutationEnvelope({ request, rawBody });
  if (!verified.authorized) {
    return json(
      { ok: false, error: "unauthorized_worker_mutation", reason: verified.error },
      marketIntegrityWorkerMutationErrorStatus(verified.error),
    );
  }
  const rateDenied = await applyWorkerRateLimit(request);
  if (rateDenied) return rateDenied;
  const consumed = await authorizeMarketIntegrityWorkerMutation({ request, rawBody });
  return consumed.authorized
    ? null
    : json(
        { ok: false, error: "unauthorized_worker_mutation", reason: consumed.error },
        marketIntegrityWorkerMutationErrorStatus(consumed.error),
      );
}

export async function GET(request: Request) {
  const denied = await authorizeReadOnly(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "run") return json({ ok: false, error: "mutation_requires_post" }, 405);
    if (url.searchParams.get("action") === "probe") {
      const probe = await probeDurableComputationStaging();
      return json({ ok: probe.stagingProven, probe }, probe.stagingProven ? 200 : 503);
    }
    const snapshot = await getDurableComputationOperationalSnapshot();
    const ok = snapshot.severity !== "critical";
    return json({
      ok,
      snapshot,
      worker: buildDurableComputationWorkerReadiness(),
      deployment: buildDurableComputationDeploymentContract(),
      alertDelivery: buildDurableComputationAlertDeliveryReadiness(),
      policy: getDurableComputationRuntimePolicy(),
    }, ok ? 200 : 503);
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/durable-computation-operations",
      code: "durable_computation_operations_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}

export async function POST(request: Request) {
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, 32 * 1024, { maxDepth: 16 });
  if (!parsed.ok) return parsed.response;
  const denied = await authorizeMutation(request, parsed.raw);
  if (denied) return denied;
  const body = parsed.value;
  try {
    if (body.action === "cycle") {
      const cycle = await runDurableComputationOperationsCycle({
        workerId: typeof body.workerId === "string" ? body.workerId : undefined,
      });
      return json({ ok: cycle.ok, cycle }, cycle.ok ? 200 : 503);
    }
    if (body.action === "drain") {
      const policy = getDurableComputationRuntimePolicy();
      const result = await runDurableComputationWorkerDrain({
        limit: Number(body.limit ?? policy.limit),
        concurrency: Number(body.concurrency ?? policy.concurrency),
        leaseSeconds: Number(body.leaseSeconds ?? policy.leaseSeconds),
        heartbeatIntervalMs: Number(body.heartbeatIntervalMs ?? policy.heartbeatIntervalMs),
        perSubjectLimit: Number(body.perSubjectLimit ?? policy.perSubjectLimit),
        globalCostLimit: Number(body.globalCostLimit ?? policy.globalCostLimit),
        perSubjectCostLimit: Number(body.perSubjectCostLimit ?? policy.perSubjectCostLimit),
        maxClaimedPayloadBytes: Number(body.maxClaimedPayloadBytes ?? policy.maxClaimedPayloadBytes),
        workerId: typeof body.workerId === "string" ? body.workerId : undefined,
      });
      const ok = result.storeFailed === 0 && result.releaseFailures === 0;
      return json({ ok, result }, ok ? 200 : 503);
    }
    if (body.action === "requeue_dead_letters") {
      const result = await requeueDurableComputationDeadLetters({
        jobIds: Array.isArray(body.jobIds) ? body.jobIds.map(String) : [],
        operatorId: String(body.operatorId ?? ""),
        reason: String(body.reason ?? ""),
        concurrency: Number(body.concurrency ?? 4),
      });
      return json({ ok: result.storeFailed === 0, result }, result.storeFailed > 0 ? 503 : 200);
    }
    if (body.action !== undefined && body.action !== "maintenance") return json({ ok: false, error: "unsupported_action" }, 400);
    const summary = await runDurableComputationMaintenance({
      completedRetentionDays: Number(body.completedRetentionDays ?? 30),
      deadLetterRetentionDays: Number(body.deadLetterRetentionDays ?? 90),
      cleanupLimit: Number(body.cleanupLimit ?? 500),
      leaseSeconds: Number(body.leaseSeconds ?? 60),
    });
    const ok = summary.leaseAcquired && summary.severity !== "critical";
    return json(
      { ok, skipped: !summary.leaseAcquired, summary },
      !summary.leaseAcquired ? 409 : ok ? 200 : 503,
    );
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/durable-computation-operations",
      code: "durable_computation_operations_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
