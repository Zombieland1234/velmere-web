import { NextResponse } from "next/server";
import { runCommerceFulfilmentOutboxWorker } from "@/lib/orders/commerce-fulfilment-outbox-worker";
import { publicApiError } from "@/lib/security/api-error-envelope";
import {
  assertExactWorkerBodyKeys,
  authorizeInternalWorkerMutation,
  optionalWorkerInteger,
} from "@/lib/security/internal-worker-mutation-boundary";

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

export function GET() {
  return json({ ok: false, error: "mutation_requires_signed_post" }, 405);
}

export async function POST(request: Request) {
  const authorized = await authorizeInternalWorkerMutation(request, {
    keyPrefix: "commerce-fulfilment-outbox-worker",
    maxBytes: 16 * 1024,
  });
  if (!authorized.ok) return authorized.response;

  const body = authorized.body;
  const guard = assertExactWorkerBodyKeys(body, [
    "action",
    "limit",
    "deadlineMs",
    "leaseSeconds",
    "retryThreshold",
  ]);
  if (guard) return guard;
  if (body.action !== undefined && body.action !== "drain") {
    return json({ ok: false, error: "unsupported_action" }, 400);
  }

  const values = {
    limit: optionalWorkerInteger(body, "limit", { min: 1, max: 10 }),
    deadlineMs: optionalWorkerInteger(body, "deadlineMs", { min: 2_000, max: 25_000 }),
    leaseSeconds: optionalWorkerInteger(body, "leaseSeconds", { min: 90, max: 300 }),
    retryThreshold: optionalWorkerInteger(body, "retryThreshold", { min: 1, max: 20 }),
  };
  for (const value of Object.values(values)) {
    if (!value.ok) return value.response;
  }

  try {
    const summary = await runCommerceFulfilmentOutboxWorker({
      limit: values.limit.value ?? 5,
      deadlineMs: values.deadlineMs.value ?? 20_000,
      leaseSeconds: values.leaseSeconds.value ?? 120,
      retryThreshold: values.retryThreshold.value ?? 8,
    });
    return json(
      {
        ok: summary.ok,
        summary,
        privacyBoundary:
          "Aggregate counters only; no customer, payment, lease, order or provider identifiers are returned.",
      },
      summary.ok ? 200 : 503,
    );
  } catch (error) {
    return publicApiError(error, {
      route: "/api/internal/workers/commerce-fulfilment-outbox",
      code: "commerce_fulfilment_outbox_worker_failed",
      status: 503,
      headers: { "x-robots-tag": "noindex, nofollow, noarchive" },
    });
  }
}
