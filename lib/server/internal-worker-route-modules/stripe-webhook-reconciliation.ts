import { NextResponse } from "next/server";
import { reconcileStripeWebhookEffects } from "@/lib/payments/stripe-webhook-reconciler";
import { isStripeWebhookReconciliationRouteOk } from "@/lib/payments/stripe-webhook-reconciliation-policy";
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
  const authorized = await authorizeInternalWorkerMutation(request, { keyPrefix: "stripe-webhook-reconciliation-worker" });
  if (!authorized.ok) return authorized.response;
  const fields = ["action", "staleAfterSeconds", "retryThreshold", "limit", "deadlineMs"] as const;
  const guard = assertExactWorkerBodyKeys(authorized.body, fields);
  if (guard) return guard;
  if (authorized.body.action !== undefined && authorized.body.action !== "run") return json({ ok: false, error: "unsupported_action" }, 400);
  const values = {
    staleAfterSeconds: optionalWorkerInteger(authorized.body, "staleAfterSeconds", { min: 30, max: 86_400 }),
    retryThreshold: optionalWorkerInteger(authorized.body, "retryThreshold", { min: 1, max: 100 }),
    limit: optionalWorkerInteger(authorized.body, "limit", { min: 1, max: 100 }),
    deadlineMs: optionalWorkerInteger(authorized.body, "deadlineMs", { min: 250, max: 60_000 }),
  };
  for (const value of Object.values(values)) if (!value.ok) return value.response;
  try {
    const summary = await reconcileStripeWebhookEffects({
      staleAfterSeconds: values.staleAfterSeconds.value,
      retryThreshold: values.retryThreshold.value,
      limit: values.limit.value,
      deadlineMs: values.deadlineMs.value,
      emitAlert: true,
    });
    return json({
      ok: isStripeWebhookReconciliationRouteOk(summary),
      skipped: !summary.leaseAcquired,
      summary,
      privacyBoundary: "Aggregate operational counts only; no event/customer/provider payload is returned.",
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/stripe-webhook-reconciliation",
      code: "stripe_webhook_worker_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
