import { createHash } from "node:crypto";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import { buildOrderEventStorageReadiness, flushOrderEventStorageWrites } from "@/lib/orders/order-event-storage";
import { summarizeOrderTimeline } from "@/lib/orders/order-event-ledger";
import {
  buildProviderFulfilmentRetryQueueReadiness,
  discardProviderFulfilmentRetryQueue,
  enqueueProviderFulfilmentRetry,
  flushProviderFulfilmentRetryQueueWrites,
  getLatestProviderFulfilmentRetryQueueItem,
  listProviderFulfilmentRetryQueueItems,
  listProviderFulfilmentRetryQueueItemsForOrder,
  replayProviderFulfilmentRetryQueue,
} from "@/lib/orders/provider-fulfilment-retry-queue";

export const runtime = "nodejs";

type QueueAction = "enqueue" | "replay" | "discard";

type QueueBody = {
  action?: QueueAction;
  orderDraftId?: string;
  queueId?: string;
  reason?: string;
};

function operatorFingerprint(req: Request) {
  const token = req.headers.get("authorization") ?? req.headers.get("x-admin-import-token") ?? "admin";
  return `admin_${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
}

function limitFrom(url: URL) {
  const limit = Number(url.searchParams.get("limit") ?? 80);
  return Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 80;
}

export async function GET(req: Request) {
  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);

  const url = new URL(req.url);
  const orderDraftId = url.searchParams.get("orderDraftId")?.trim() ?? "";
  const limit = limitFrom(url);
  const orderQueue = orderDraftId ? await listProviderFulfilmentRetryQueueItemsForOrder(orderDraftId, limit) : [];

  return NextResponse.json({
    schemaVersion: "velmere.provider-fulfilment-retry-queue-admin-snapshot.v1",
    generatedAt: new Date().toISOString(),
    readiness: buildProviderFulfilmentRetryQueueReadiness(),
    orderEventStorageReadiness: buildOrderEventStorageReadiness(),
    orderDraftId: orderDraftId || null,
    latestForOrder: orderDraftId ? await getLatestProviderFulfilmentRetryQueueItem(orderDraftId) : null,
    queueForOrder: orderQueue,
    recentQueue: await listProviderFulfilmentRetryQueueItems(limit),
    orderTimeline: orderDraftId ? summarizeOrderTimeline(orderDraftId) : null,
    productionBoundary:
      "Provider fulfilment retry queue is replay-safe and redacted. It does not expose raw customer address, email, phone, provider payloads, API tokens, webhook signatures or secrets.",
  });
}

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-orders-fulfilment-retry-queue",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const parsedBody = await readBoundedJsonBody<QueueBody>(req, 96 * 1024, { maxDepth: 12 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;
  const action = body.action ?? "enqueue";
  const orderDraftId = body.orderDraftId?.trim() ?? "";
  const queueId = body.queueId?.trim() ?? "";
  const operatorId = operatorFingerprint(req);

  if (!orderDraftId && !queueId) {
    return NextResponse.json({ error: "orderDraftId or queueId is required." }, { status: 400 });
  }

  if (action === "enqueue") {
    if (!orderDraftId) return NextResponse.json({ error: "orderDraftId is required for enqueue." }, { status: 400 });
    const result = await enqueueProviderFulfilmentRetry(orderDraftId, operatorId);
    await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
    return NextResponse.json({
      schemaVersion: "velmere.provider-fulfilment-retry-queue-action-response.v1",
      generatedAt: new Date().toISOString(),
      action,
      result,
      readiness: buildProviderFulfilmentRetryQueueReadiness(),
      orderTimeline: summarizeOrderTimeline(orderDraftId),
      productionBoundary:
        "Queued retry stores only redacted replay metadata and receipts, never customer PII, provider payloads or secrets.",
    });
  }

  if (action === "replay") {
    const result = await replayProviderFulfilmentRetryQueue({ orderDraftId: orderDraftId || undefined, queueId: queueId || undefined, operatorId });
    await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
    return NextResponse.json({
      schemaVersion: "velmere.provider-fulfilment-retry-queue-action-response.v1",
      generatedAt: new Date().toISOString(),
      action,
      result,
      readiness: buildProviderFulfilmentRetryQueueReadiness(),
      orderTimeline: result.item?.orderDraftId ? summarizeOrderTimeline(result.item.orderDraftId) : null,
      productionBoundary:
        "Replay uses the same guarded provider retry path. It never bypasses payment, provider mapping, Printful token or already-fulfilled checks.",
    }, { status: result.error ? 409 : 200 });
  }

  if (action === "discard") {
    const result = await discardProviderFulfilmentRetryQueue({ orderDraftId: orderDraftId || undefined, queueId: queueId || undefined, operatorId, reason: body?.reason });
    await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
    return NextResponse.json({
      schemaVersion: "velmere.provider-fulfilment-retry-queue-action-response.v1",
      generatedAt: new Date().toISOString(),
      action,
      result,
      readiness: buildProviderFulfilmentRetryQueueReadiness(),
      orderTimeline: result.item?.orderDraftId ? summarizeOrderTimeline(result.item.orderDraftId) : null,
      productionBoundary:
        "Discard only changes the redacted retry queue state. It does not delete order timeline receipts.",
    }, { status: result.error ? 409 : 200 });
  }

  return NextResponse.json({ error: "Unsupported retry queue action." }, { status: 400 });
}
