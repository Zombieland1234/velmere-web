import { NextResponse } from "next/server";
import { runCommerceFulfilmentOutboxWorker } from "@/lib/orders/commerce-fulfilment-outbox-worker";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { publicApiError } from "@/lib/security/api-error-envelope";
import {
  authorizeMarketIntegrityWorkerMutation,
  marketIntegrityWorkerMutationErrorStatus,
  verifyMarketIntegrityWorkerMutationEnvelope,
} from "@/lib/security/market-integrity-cron-auth";
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

export function GET() {
  return json({ ok: false, error: "mutation_requires_signed_post" }, 405);
}

export async function POST(request: Request) {
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, 16 * 1024, {
    maxDepth: 8,
  });
  if (!parsed.ok) return parsed.response;

  const verified = verifyMarketIntegrityWorkerMutationEnvelope({
    request,
    rawBody: parsed.raw,
  });
  if (!verified.authorized) {
    return json(
      { ok: false, error: "unauthorized_worker_mutation", reason: verified.error },
      marketIntegrityWorkerMutationErrorStatus(verified.error),
    );
  }

  const rate = await applyApiRateLimit(request, {
    keyPrefix: "commerce-fulfilment-outbox-worker",
    limit: 12,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const consumed = await authorizeMarketIntegrityWorkerMutation({
    request,
    rawBody: parsed.raw,
  });
  if (!consumed.authorized) {
    return json(
      { ok: false, error: "unauthorized_worker_mutation", reason: consumed.error },
      marketIntegrityWorkerMutationErrorStatus(consumed.error),
    );
  }

  const body = parsed.value;
  if (body.action !== undefined && body.action !== "drain") {
    return json({ ok: false, error: "unsupported_action" }, 400);
  }
  try {
    const summary = await runCommerceFulfilmentOutboxWorker({
      limit: Number(body.limit ?? 5),
      deadlineMs: Number(body.deadlineMs ?? 20_000),
      leaseSeconds: Number(body.leaseSeconds ?? 120),
      retryThreshold: Number(body.retryThreshold ?? 8),
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
