import { NextResponse } from "next/server";

import {
  getVerifyContinuousMonitorRuntimePolicy,
  runVerifyContinuousMonitorWorker,
} from "@/lib/verify/verify-continuous-monitor-worker";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { publicApiError } from "@/lib/security/api-error-envelope";
import {
  assertExactWorkerBodyKeys,
  authorizeInternalWorkerMutation,
  optionalWorkerInteger,
} from "@/lib/security/internal-worker-mutation-boundary";
import { authorizeVercelCron } from "@/lib/security/market-integrity-cron-auth";

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

async function rateLimit(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "verify-continuous-monitor-worker",
    limit: 6,
    windowMs: 60_000,
  });
  return rate.ok ? null : rate.response;
}

function operational(summary: Awaited<ReturnType<typeof runVerifyContinuousMonitorWorker>>) {
  return summary.storeFailed === 0
    && summary.conflicts === 0
    && summary.unavailable === 0
    && summary.revalidationRequired === 0
    && !summary.batchDeadlineReached
    && summary.health !== null
    && summary.health.deadLettered === 0
    && summary.health.processingExpired === 0
    && summary.health.queuedDue === 0
    && summary.health.queuedClaimable === 0;
}

async function run(input: Parameters<typeof runVerifyContinuousMonitorWorker>[0]) {
  const summary = await runVerifyContinuousMonitorWorker(input);
  const ok = operational(summary);
  return json({
    ok,
    monitoringState: ok ? "operational" : "attention_required",
    summary,
  }, ok ? 200 : 503);
}

export async function GET(request: Request) {
  const auth = authorizeVercelCron(request);
  if (!auth.authorized) return json({ ok: false, error: "unauthorized_worker" }, 401);
  if (new URL(request.url).search.length > 0) {
    return json({ ok: false, error: "worker_query_not_supported" }, 400);
  }
  const denied = await rateLimit(request);
  if (denied) return denied;
  try {
    // The checked event time and durable monitor_due_at are truth. The daily
    // scheduler is only a trigger and carries no promise of precise delivery.
    return await run(getVerifyContinuousMonitorRuntimePolicy());
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/verify-continuous-monitor",
      code: "verify_continuous_monitor_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}

export async function POST(request: Request) {
  const authorized = await authorizeInternalWorkerMutation(request, {
    keyPrefix: "verify-continuous-monitor-worker-mutation",
    maxBytes: 4 * 1024,
  });
  if (!authorized.ok) return authorized.response;
  const body = authorized.body;
  const unknown = assertExactWorkerBodyKeys(body, [
    "action",
    "concurrency",
    "deadlineMs",
    "leaseSeconds",
    "limit",
  ]);
  if (unknown) return unknown;
  if (body.action !== undefined && body.action !== "run") {
    return json({ ok: false, error: "unsupported_action" }, 400);
  }
  const limit = optionalWorkerInteger(body, "limit", { min: 1, max: 5 });
  if (!limit.ok) return limit.response;
  const concurrency = optionalWorkerInteger(body, "concurrency", { min: 1, max: 2 });
  if (!concurrency.ok) return concurrency.response;
  const leaseSeconds = optionalWorkerInteger(body, "leaseSeconds", { min: 30, max: 300 });
  if (!leaseSeconds.ok) return leaseSeconds.response;
  const deadlineMs = optionalWorkerInteger(body, "deadlineMs", { min: 5_000, max: 25_000 });
  if (!deadlineMs.ok) return deadlineMs.response;
  const policy = getVerifyContinuousMonitorRuntimePolicy();
  try {
    return await run({
      limit: limit.value ?? policy.batchLimit,
      concurrency: concurrency.value ?? policy.concurrency,
      leaseSeconds: leaseSeconds.value ?? policy.leaseSeconds,
      claimLookaheadSeconds: policy.claimLookaheadSeconds,
      deadlineMs: deadlineMs.value ?? policy.deadlineMs,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/verify-continuous-monitor",
      code: "verify_continuous_monitor_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
