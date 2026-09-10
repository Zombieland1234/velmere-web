import { NextResponse } from "next/server";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { appendAdminAuditLog } from "@/lib/admin/audit-log";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { syncFulfilmentProviderOrderState } from "@/lib/orders/fulfilment-provider-status-sync";
import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const size = rejectLargeContentLength(request, 8 * 1024);
  if (size) return size;
  const origin = assertSameOriginRequest(request, { allowMissingOrigin: false });
  if (origin) return origin;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "fulfilment-provider-status-sync",
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(request, "fulfilment:retry");
  if (!admin.ok) return admin.response;
  const body = await readBoundedJsonBody<{
    orderDraftId?: string;
    externalId?: string;
    expectedProviderOrderId?: string;
    previousStatus?: string;
    pendingSince?: string;
    staleAfterHours?: number;
    refundExpected?: boolean;
  }>(request, 8 * 1024, { maxDepth: 2 });
  if (!body.ok) return body.response;
  try {
    const result = await syncFulfilmentProviderOrderState({
      orderDraftId: body.value.orderDraftId ?? "",
      externalId: body.value.externalId,
      expectedProviderOrderId: body.value.expectedProviderOrderId,
      previousStatus: body.value.previousStatus,
      pendingSince: body.value.pendingSince,
      staleAfterHours: body.value.staleAfterHours,
      refundExpected: body.value.refundExpected,
    });
    const audit = await appendAdminAuditLog({
      actorId: admin.session.actorId,
      actorRole: admin.session.role,
      action: "fulfilment_provider_status_sync",
      targetType: "order",
      targetId: "redacted_order",
      payload: {
        state: result.state,
        providerStatus: result.providerStatus,
        action: result.action,
        durable: result.durable,
      },
    });
    const status = result.state === "not_found" ? 404 : result.state === "conflict" ? 409 : 200;
    return NextResponse.json({ result, audit }, {
      status,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (error) {
    const invalid = hasApiErrorCodePrefix(error, ["fulfilment_provider_sync_invalid_"]);
    return publicApiError(error, {
      route: "/api/admin/orders/fulfilment-provider-sync",
      code: invalid ? "fulfilment_provider_sync_invalid_request" : "fulfilment_provider_sync_unavailable",
      status: invalid ? 400 : 503,
      headers: invalid ? undefined : { "retry-after": "15" },
    });
  }
}
