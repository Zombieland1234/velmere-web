import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runBoundedServiceRoleRpc } from "@/lib/db/bounded-supabase-rpc";

export type FulfilmentProviderSyncQueueResult = {
  schemaVersion: "velmere.fulfilment-provider-sync-queue.v1";
  state: "queued" | "already_queued" | "reopened";
  durableWrite: true;
  privacyBoundary: "no_customer_or_provider_payload";
};

export type FulfilmentProviderSyncQueueDependencies = {
  hasDurableStorage: () => boolean;
  enqueue: (input: {
    orderDraftId: string;
    externalId: string;
    expectedProviderOrderId?: string;
    previousStatus: string;
    pendingSince: string;
    staleAfterHours: number;
    refundExpected: boolean;
  }) => Promise<string>;
  nowIso: () => string;
};

const SAFE_ORDER_ID = /^order_[A-Za-z0-9_-]{8,120}$/;
const SAFE_PROVIDER_ID = /^[0-9]{1,20}$/;

async function defaultEnqueue(input: {
  orderDraftId: string;
  externalId: string;
  expectedProviderOrderId?: string;
  previousStatus: string;
  pendingSince: string;
  staleAfterHours: number;
  refundExpected: boolean;
}) {
  const { data } = await runBoundedServiceRoleRpc({
    operation: "fulfilment_sync_enqueue",
    rpcName: "velmere_enqueue_fulfilment_provider_sync",
    args: {
      p_order_draft_id: input.orderDraftId,
      p_external_id: input.externalId,
      p_expected_provider_order_id: input.expectedProviderOrderId ?? null,
      p_previous_status: input.previousStatus,
      p_pending_since: input.pendingSince,
      p_stale_after_hours: input.staleAfterHours,
      p_refund_expected: input.refundExpected,
    },
  });
  return String(data);
}

export const fulfilmentProviderSyncQueueDependencies: FulfilmentProviderSyncQueueDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
  enqueue: defaultEnqueue,
  nowIso: () => new Date().toISOString(),
};

export async function enqueueFulfilmentProviderSync(
  input: {
    orderDraftId: string;
    externalId?: string;
    expectedProviderOrderId?: string | number;
    previousStatus?: string;
    pendingSince?: string;
    staleAfterHours?: number;
    refundExpected?: boolean;
  },
  dependencies: FulfilmentProviderSyncQueueDependencies = fulfilmentProviderSyncQueueDependencies,
): Promise<FulfilmentProviderSyncQueueResult> {
  const orderDraftId = input.orderDraftId.trim();
  const externalId = (input.externalId ?? orderDraftId).trim();
  const providerOrderId = input.expectedProviderOrderId === undefined
    ? undefined
    : String(input.expectedProviderOrderId).trim();
  if (!SAFE_ORDER_ID.test(orderDraftId)) throw new Error("fulfilment_provider_sync_queue_invalid_order_id");
  if (!SAFE_ORDER_ID.test(externalId)) throw new Error("fulfilment_provider_sync_queue_invalid_external_id");
  if (providerOrderId && !SAFE_PROVIDER_ID.test(providerOrderId)) {
    throw new Error("fulfilment_provider_sync_queue_invalid_provider_order_id");
  }
  const staleAfterHours = Math.min(336, Math.max(1, Math.trunc(Number(input.staleAfterHours ?? 48))));
  if (!dependencies.hasDurableStorage()) {
    throw new Error("fulfilment_provider_sync_queue_storage_unavailable");
  }
  const state = await dependencies.enqueue({
    orderDraftId,
    externalId,
    expectedProviderOrderId: providerOrderId,
    previousStatus: String(input.previousStatus ?? "draft").slice(0, 40),
    pendingSince: input.pendingSince ?? dependencies.nowIso(),
    staleAfterHours,
    refundExpected: input.refundExpected === true,
  });
  if (state !== "queued" && state !== "already_queued" && state !== "reopened") {
    throw new Error("fulfilment_provider_sync_queue_invalid_result");
  }
  return {
    schemaVersion: "velmere.fulfilment-provider-sync-queue.v1",
    state,
    durableWrite: true,
    privacyBoundary: "no_customer_or_provider_payload",
  };
}
