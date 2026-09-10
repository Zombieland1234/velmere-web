import { findPrintfulOrderByExternalId } from "@/lib/printful/orders";
import {
  markDurableManualFulfilmentRequired,
  markDurableOrderFulfilled,
  markDurableProviderRefunded,
  markDurableProviderStatusSynced,
} from "@/lib/orders/durable-order-state";

export type FulfilmentProviderStatus =
  | "draft"
  | "pending"
  | "onhold"
  | "inprocess"
  | "partial"
  | "fulfilled"
  | "failed"
  | "canceled"
  | "unknown";

export type FulfilmentProviderSyncResult = {
  schemaVersion: "velmere.fulfilment-provider-status-sync.v1";
  state: "synced" | "unchanged" | "escalated" | "not_found" | "conflict";
  providerStatus: FulfilmentProviderStatus;
  action:
    | "provider_status_recorded"
    | "order_fulfilled"
    | "manual_review_required"
    | "refund_recorded"
    | "none";
  durable: boolean;
  privacyBoundary: "no_customer_or_provider_payload";
};

type LookupResult = { id: number; status?: string; external_id?: string } | null;
type DurableResult = { durableWrite: boolean };

export type FulfilmentProviderSyncDependencies = {
  lookup: (externalId: string) => Promise<LookupResult>;
  recordStatus: (orderDraftId: string, providerOrderId: string, status: string) => Promise<DurableResult>;
  markFulfilled: (orderDraftId: string, providerOrderId: string) => Promise<DurableResult>;
  markManualReview: (orderDraftId: string) => Promise<DurableResult>;
  markRefunded: (orderDraftId: string, providerOrderId: string) => Promise<DurableResult>;
  now: () => number;
};

export const fulfilmentProviderSyncDependencies: FulfilmentProviderSyncDependencies = {
  lookup: findPrintfulOrderByExternalId,
  recordStatus: markDurableProviderStatusSynced,
  markFulfilled: markDurableOrderFulfilled,
  markManualReview: markDurableManualFulfilmentRequired,
  markRefunded: markDurableProviderRefunded,
  now: Date.now,
};

const SAFE_ORDER_ID = /^order_[a-zA-Z0-9_-]{8,120}$/;
const SAFE_PROVIDER_ID = /^[0-9]{1,20}$/;

export function normalizeFulfilmentProviderStatus(value: unknown): FulfilmentProviderStatus {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
  if (normalized === "draft") return "draft";
  if (normalized === "pending") return "pending";
  if (normalized === "onhold") return "onhold";
  if (normalized === "inprocess" || normalized === "inprogress") return "inprocess";
  if (normalized === "partial" || normalized === "partiallyfulfilled") return "partial";
  if (normalized === "fulfilled" || normalized === "shipped") return "fulfilled";
  if (normalized === "failed") return "failed";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  return "unknown";
}

function parseTimestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function syncFulfilmentProviderOrderState(
  input: {
    orderDraftId: string;
    externalId?: string;
    expectedProviderOrderId?: string;
    previousStatus?: string;
    pendingSince?: string;
    staleAfterHours?: number;
    refundExpected?: boolean;
  },
  dependencies: FulfilmentProviderSyncDependencies = fulfilmentProviderSyncDependencies,
): Promise<FulfilmentProviderSyncResult> {
  const orderDraftId = input.orderDraftId.trim();
  if (!SAFE_ORDER_ID.test(orderDraftId)) throw new Error("fulfilment_provider_sync_invalid_order_id");
  const externalId = (input.externalId ?? orderDraftId).trim();
  if (!SAFE_ORDER_ID.test(externalId)) throw new Error("fulfilment_provider_sync_invalid_external_id");
  const expectedProviderOrderId = input.expectedProviderOrderId?.trim();
  if (expectedProviderOrderId && !SAFE_PROVIDER_ID.test(expectedProviderOrderId)) {
    throw new Error("fulfilment_provider_sync_invalid_provider_order_id");
  }
  const staleAfterHours = Math.min(336, Math.max(1, Math.trunc(Number(input.staleAfterHours ?? 48))));
  const found = await dependencies.lookup(externalId);
  if (!found) {
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "not_found",
      providerStatus: "unknown",
      action: "none",
      durable: false,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }
  const providerOrderId = String(found.id);
  if (expectedProviderOrderId && providerOrderId !== expectedProviderOrderId) {
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "conflict",
      providerStatus: normalizeFulfilmentProviderStatus(found.status),
      action: "none",
      durable: false,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }

  const status = normalizeFulfilmentProviderStatus(found.status);
  if (status === "fulfilled") {
    const write = input.refundExpected
      ? await dependencies.markRefunded(orderDraftId, providerOrderId)
      : await dependencies.markFulfilled(orderDraftId, providerOrderId);
    if (!write.durableWrite) throw new Error("fulfilment_provider_sync_write_not_durable");
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "synced",
      providerStatus: status,
      action: input.refundExpected ? "refund_recorded" : "order_fulfilled",
      durable: true,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }

  if (status === "failed" || status === "canceled" || status === "unknown") {
    const write = await dependencies.markManualReview(orderDraftId);
    if (!write.durableWrite) throw new Error("fulfilment_provider_sync_write_not_durable");
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "escalated",
      providerStatus: status,
      action: "manual_review_required",
      durable: true,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }

  const pendingSince = parseTimestamp(input.pendingSince);
  if (pendingSince !== null && dependencies.now() - pendingSince >= staleAfterHours * 3_600_000) {
    const write = await dependencies.markManualReview(orderDraftId);
    if (!write.durableWrite) throw new Error("fulfilment_provider_sync_write_not_durable");
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "escalated",
      providerStatus: status,
      action: "manual_review_required",
      durable: true,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }

  if (normalizeFulfilmentProviderStatus(input.previousStatus) === status) {
    return {
      schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
      state: "unchanged",
      providerStatus: status,
      action: "none",
      durable: true,
      privacyBoundary: "no_customer_or_provider_payload",
    };
  }
  const write = await dependencies.recordStatus(orderDraftId, providerOrderId, status);
  if (!write.durableWrite) throw new Error("fulfilment_provider_sync_write_not_durable");
  return {
    schemaVersion: "velmere.fulfilment-provider-status-sync.v1",
    state: "synced",
    providerStatus: status,
    action: "provider_status_recorded",
    durable: true,
    privacyBoundary: "no_customer_or_provider_payload",
  };
}
