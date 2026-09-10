import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { verifyAdminSessionRequest } from "@/lib/admin/session-roles";
import { appendAdminAuditLog } from "@/lib/admin/audit-log";
import { applyWriteApiRateLimit } from "@/lib/security/write-api-rate-limit";
import { runProviderSandboxFulfilment } from "@/lib/providers/provider-sandbox-fulfilment";
import type { FulfilmentProviderId } from "@/lib/providers/fulfilment-provider-contract";

export const runtime = "nodejs";

type Body = {
  orderDraftId?: string;
  provider?: FulfilmentProviderId;
  mode?: "preview" | "enqueue" | "execute";
  operatorId?: string;
};

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-orders-provider-sandbox",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const rate = await applyWriteApiRateLimit(req, "provider_sandbox");
  if (!rate.ok) return rate.response;
  const admin = verifyAdminSessionRequest(req, "fulfilment:retry");
  if (!admin.ok) return admin.response;

  const parsedBody = await readBoundedJsonBody<Body>(req, 256 * 1024, { maxDepth: 12 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  if (!body.orderDraftId || typeof body.orderDraftId !== "string") {
    return NextResponse.json({ error: "orderDraftId is required." }, { status: 400 });
  }

  const result = await runProviderSandboxFulfilment({
    orderDraftId: body.orderDraftId,
    provider: body.provider ?? "printful",
    mode: body.mode ?? "preview",
    operatorId: body.operatorId ?? "operator:admin-provider-sandbox",
  });

  const audit = await appendAdminAuditLog({
    actorId: admin.session.actorId,
    actorRole: admin.session.role,
    action: "provider_sandbox",
    targetType: "order_draft",
    targetId: body.orderDraftId,
    payload: { provider: result.provider, mode: result.mode, status: result.status, runId: result.runId },
  });

  return NextResponse.json({ ...result, audit }, { status: result.status === "failed" ? 502 : 200 });
}
