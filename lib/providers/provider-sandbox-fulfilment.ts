import { createHash } from "node:crypto";
import type { OrderRecord } from "@/lib/orders/order-store";
import { getOrder } from "@/lib/orders/order-store";
import { previewProviderFulfilmentRetry, executeProviderFulfilmentRetry } from "@/lib/orders/provider-fulfilment-retry";
import { enqueueProviderFulfilmentRetry, flushProviderFulfilmentRetryQueueWrites } from "@/lib/orders/provider-fulfilment-retry-queue";
import { buildFulfilmentProviderContract, type FulfilmentProviderId } from "@/lib/providers/fulfilment-provider-contract";

export type ProviderSandboxFulfilmentRun = {
  schemaVersion: "velmere.provider-sandbox-fulfilment-run.v1";
  runId: string;
  provider: FulfilmentProviderId;
  orderDraftId: string;
  mode: "preview" | "enqueue" | "execute";
  status: "ready" | "blocked" | "queued" | "executed" | "failed";
  canExecute: boolean;
  reasonCodes: string[];
  providerContract: ReturnType<typeof buildFulfilmentProviderContract>;
  retryPreview?: ReturnType<typeof previewProviderFulfilmentRetry>;
  retryResult?: Awaited<ReturnType<typeof executeProviderFulfilmentRetry>>;
  queueResult?: Awaited<ReturnType<typeof enqueueProviderFulfilmentRetry>>;
  redactedOrder?: {
    id: string;
    status: OrderRecord["status"];
    lineItemCount: number;
    automaticPrintfulLineCount: number;
    stripeSessionPresent: boolean;
  };
  createdAt: string;
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
  checksum: string;
};

function hash(value: unknown, prefix = "providersandbox") {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 22)}`;
}

function redactedOrder(order: OrderRecord | null) {
  if (!order) return undefined;
  return {
    id: order.id,
    status: order.status,
    lineItemCount: order.lineItems.length,
    automaticPrintfulLineCount: order.lineItems.filter((item) => item.provider === "printful" && item.fulfilmentMode === "automatic").length,
    stripeSessionPresent: Boolean(order.stripeSessionId),
  };
}

export async function runProviderSandboxFulfilment(input: {
  orderDraftId: string;
  provider?: FulfilmentProviderId;
  mode?: "preview" | "enqueue" | "execute";
  operatorId?: string;
}): Promise<ProviderSandboxFulfilmentRun> {
  const provider = input.provider ?? "printful";
  const mode = input.mode ?? "preview";
  const order = getOrder(input.orderDraftId);
  const providerContract = buildFulfilmentProviderContract(provider);
  const retryPreview = previewProviderFulfilmentRetry(input.orderDraftId);
  const reasonCodes = Array.from(new Set([
    ...providerContract.missingEnv.map((key) => `${key.toLowerCase()}_missing`),
    ...retryPreview.reasonCodes,
    ...(provider !== "printful" ? [`${provider}_adapter_contract_only`] : []),
  ])).slice(0, 50);
  const canExecute = provider === "printful" && retryPreview.canRetry && providerContract.canCreateOrderDraft && reasonCodes.length === 0;

  let status: ProviderSandboxFulfilmentRun["status"] = canExecute ? "ready" : "blocked";
  let retryResult: ProviderSandboxFulfilmentRun["retryResult"];
  let queueResult: ProviderSandboxFulfilmentRun["queueResult"];

  if (mode === "enqueue") {
    queueResult = await enqueueProviderFulfilmentRetry(input.orderDraftId, input.operatorId ?? "operator:sandbox");
    await flushProviderFulfilmentRetryQueueWrites();
    status = queueResult.storage.ok ? "queued" : "blocked";
  }

  if (mode === "execute") {
    if (!canExecute) {
      status = "blocked";
    } else {
      try {
        retryResult = await executeProviderFulfilmentRetry(input.orderDraftId, input.operatorId ?? "operator:sandbox");
        status = retryResult.outcome === "created" ? "executed" : retryResult.outcome === "blocked" ? "blocked" : "failed";
      } catch {
        status = "failed";
      }
    }
  }

  const createdAt = new Date().toISOString();
  const base = { orderDraftId: input.orderDraftId, provider, mode, status, reasonCodes, providerChecksum: providerContract.checksum, retryChecksum: retryPreview.checksum };
  return {
    schemaVersion: "velmere.provider-sandbox-fulfilment-run.v1",
    runId: hash(base),
    provider,
    orderDraftId: input.orderDraftId,
    mode,
    status,
    canExecute,
    reasonCodes,
    providerContract,
    retryPreview,
    retryResult,
    queueResult,
    redactedOrder: redactedOrder(order),
    createdAt,
    redactionBoundary: {
      rawCustomerPiiStored: false,
      rawProviderPayloadStored: false,
      secretsStored: false,
      allowedFields: ["orderDraftId", "provider", "mode", "status", "reason codes", "checksums", "redacted order counts"],
    },
    checksum: hash(base, "providersandboxchk"),
  };
}
