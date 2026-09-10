import { createHash } from "node:crypto";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import { buildOrderEventStorageReadiness, flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { executeProviderFulfilmentRetry, previewProviderFulfilmentRetry } from "@/lib/orders/provider-fulfilment-retry";
import { summarizeOrderTimeline } from "@/lib/orders/order-event-ledger";

export const runtime = "nodejs";

type RetryBody = {
  orderDraftId?: string;
  mode?: "preview" | "execute";
};

function operatorFingerprint(req: Request) {
  const token = req.headers.get("authorization") ?? req.headers.get("x-admin-import-token") ?? "admin";
  return `admin_${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
}

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-orders-fulfilment-retry",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const parsedBody = await readBoundedJsonBody<RetryBody>(req, 64 * 1024, { maxDepth: 10 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const orderDraftId = body.orderDraftId?.trim() ?? "";
  const mode = body.mode === "execute" ? "execute" : "preview";
  if (!orderDraftId) return NextResponse.json({ error: "orderDraftId is required." }, { status: 400 });

  const receipt = mode === "execute"
    ? await executeProviderFulfilmentRetry(orderDraftId, operatorFingerprint(req))
    : previewProviderFulfilmentRetry(orderDraftId);

  await flushOrderEventStorageWrites();

  return NextResponse.json({
    schemaVersion: "velmere.provider-fulfilment-retry-response.v1",
    generatedAt: new Date().toISOString(),
    mode,
    receipt,
    orderTimeline: summarizeOrderTimeline(orderDraftId),
    storageReadiness: buildOrderEventStorageReadiness(),
    productionBoundary:
      "Provider fulfilment retry never stores customer PII, raw Stripe customer details, provider payloads, API tokens or webhook secrets. Shipping data is used only transiently when an execute retry calls the provider.",
  }, { status: receipt.outcome === "blocked" ? 409 : 200 });
}

export async function GET(req: Request) {
  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const orderDraftId = url.searchParams.get("orderDraftId")?.trim() ?? "";
  if (!orderDraftId) {
    return NextResponse.json({
      schemaVersion: "velmere.provider-fulfilment-retry-readiness.v1",
      generatedAt: new Date().toISOString(),
      storageReadiness: buildOrderEventStorageReadiness(),
      productionBoundary: "Pass orderDraftId to preview provider retry readiness for a specific order.",
    });
  }
  return NextResponse.json({
    schemaVersion: "velmere.provider-fulfilment-retry-response.v1",
    generatedAt: new Date().toISOString(),
    mode: "preview",
    receipt: previewProviderFulfilmentRetry(orderDraftId),
    orderTimeline: summarizeOrderTimeline(orderDraftId),
    storageReadiness: buildOrderEventStorageReadiness(),
  });
}
