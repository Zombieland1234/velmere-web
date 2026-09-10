import { NextResponse } from "next/server";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import {
  buildOrderEventLedgerReadiness,
  listRecentOrderEvents,
  summarizeOrderTimeline,
} from "@/lib/orders/order-event-ledger";
import {
  buildOrderEventStorageReadiness,
  flushOrderEventStorageWrites,
  getDurableOrderTimeline,
  listDurableOrderEvents,
} from "@/lib/orders/order-event-storage";
import {
  buildProviderFulfilmentRetryQueueReadiness,
  flushProviderFulfilmentRetryQueueWrites,
  getLatestProviderFulfilmentRetryQueueItem,
  listProviderFulfilmentRetryQueueItems,
  listProviderFulfilmentRetryQueueItemsForOrder,
} from "@/lib/orders/provider-fulfilment-retry-queue";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const orderDraftId = url.searchParams.get("orderDraftId") ?? url.searchParams.get("orderId") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 80);

  await Promise.allSettled([flushOrderEventStorageWrites(), flushProviderFulfilmentRetryQueueWrites()]);
  const safeLimit = Number.isFinite(limit) ? limit : 80;

  return NextResponse.json({
    schemaVersion: "velmere.order-event-ledger-admin-snapshot.v2",
    generatedAt: new Date().toISOString(),
    readiness: buildOrderEventLedgerReadiness(),
    storageReadiness: buildOrderEventStorageReadiness(),
    orderTimeline: orderDraftId ? summarizeOrderTimeline(orderDraftId) : null,
    durableOrderTimeline: orderDraftId ? await getDurableOrderTimeline(orderDraftId, safeLimit) : null,
    retryQueueReadiness: buildProviderFulfilmentRetryQueueReadiness(),
    latestRetryQueueItem: orderDraftId ? await getLatestProviderFulfilmentRetryQueueItem(orderDraftId) : null,
    retryQueueForOrder: orderDraftId ? await listProviderFulfilmentRetryQueueItemsForOrder(orderDraftId, safeLimit) : [],
    recentRetryQueue: await listProviderFulfilmentRetryQueueItems(Math.min(safeLimit, 80)),
    recentEvents: listRecentOrderEvents(safeLimit),
    durableRecentEvents: await listDurableOrderEvents(safeLimit),
    productionBoundary:
      "Admin order event ledger returns redacted operational timeline events only. It does not expose raw customer address, email, phone, provider payloads, API tokens or webhook secrets.",
  });
}
