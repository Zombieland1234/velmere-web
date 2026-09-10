import { NextResponse } from "next/server";
import {
  runFulfilmentIncidentOutboxWorker,
} from "@/lib/orders/fulfilment-incident-outbox-worker";
import { publicApiError } from "@/lib/security/api-error-envelope";
import { assertExactWorkerBodyKeys, authorizeInternalWorkerMutation, optionalWorkerInteger } from "@/lib/security/internal-worker-mutation-boundary";

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

export async function POST(request: Request) {
  const authorized = await authorizeInternalWorkerMutation(request, { keyPrefix: "fulfilment-incident-outbox-worker" });
  if (!authorized.ok) return authorized.response;
  const fields = ["action", "limit", "deadlineMs", "staleAfterSeconds", "retryThreshold", "retryAfterSeconds"] as const;
  const guard = assertExactWorkerBodyKeys(authorized.body, fields);
  if (guard) return guard;
  if (authorized.body.action !== undefined && authorized.body.action !== "run") return json({ ok: false, error: "unsupported_action" }, 400);
  const values = {
    limit: optionalWorkerInteger(authorized.body, "limit", { min: 1, max: 100 }),
    deadlineMs: optionalWorkerInteger(authorized.body, "deadlineMs", { min: 250, max: 60_000 }),
    staleAfterSeconds: optionalWorkerInteger(authorized.body, "staleAfterSeconds", { min: 30, max: 86_400 }),
    retryThreshold: optionalWorkerInteger(authorized.body, "retryThreshold", { min: 1, max: 100 }),
    retryAfterSeconds: optionalWorkerInteger(authorized.body, "retryAfterSeconds", { min: 1, max: 86_400 }),
  };
  for (const value of Object.values(values)) if (!value.ok) return value.response;
  try {
    const summary = await runFulfilmentIncidentOutboxWorker({
      limit: values.limit.value,
      deadlineMs: values.deadlineMs.value,
      staleAfterSeconds: values.staleAfterSeconds.value,
      retryThreshold: values.retryThreshold.value,
      retryAfterSeconds: values.retryAfterSeconds.value,
    });
    return json({
      ok: true,
      skipped: !summary.leaseAcquired,
      summary,
      privacyBoundary:
        "Aggregate counts only; no incident, order, lease, evidence or provider identifiers are returned.",
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/fulfilment-incident-outbox",
      code: "fulfilment_outbox_worker_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
