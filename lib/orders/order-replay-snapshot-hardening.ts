import { createHash } from "node:crypto";
import type { OrderReplaySnapshot } from "@/lib/orders/order-store";

export type OrderReplaySnapshotIntegrityStatus = "verified" | "warning" | "failed" | "missing";

export type OrderReplaySnapshotIntegrity = {
  schemaVersion: "velmere.order-replay-snapshot-integrity.v1";
  snapshotId: string | null;
  generatedAt: string;
  status: OrderReplaySnapshotIntegrityStatus;
  canRestore: boolean;
  checksum: string | null;
  reasonCodes: string[];
  warnings: string[];
  coverage: {
    hasOrderId: boolean;
    hasStatus: boolean;
    hasLocale: boolean;
    hasCartHash: boolean;
    hasStripeSessionId: boolean;
    hasLineItems: boolean;
    hasGuardSummary: boolean;
    hasRedactionBoundary: boolean;
    lineItemCount: number;
    automaticProviderLineCount: number;
    missingProviderVariantCount: number;
  };
  redactionBoundary: {
    rawCustomerPiiStored: false;
    rawProviderPayloadStored: false;
    secretsStored: false;
    allowedFields: string[];
  };
};

export type OrderReplaySnapshotRestoreGate = {
  schemaVersion: "velmere.order-replay-snapshot-restore-gate.v1";
  canRestore: boolean;
  blocked: boolean;
  status: OrderReplaySnapshotIntegrityStatus;
  checksum: string | null;
  reasonCodes: string[];
  nextAction: "restore_and_replay" | "use_live_order" | "queue_requires_manual_review";
  productionBoundary: string;
};

const ALLOWED_STATUSES = new Set([
  "draft",
  "checkout_started",
  "paid",
  "fulfilment_pending",
  "manual_fulfilment_required",
  "fulfilment_created",
  "fulfilled",
  "cancelled",
  "failed",
  "refunded",
]);

const FORBIDDEN_KEYS = [
  "email",
  "phone",
  "address",
  "customer",
  "billing",
  "shipping",
  "authorization",
  "cookie",
  "token",
  "secret",
  "signature",
  "rawProviderPayload",
  "providerPayload",
  "webhook",
];

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry !== "undefined")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
    .join(",")}}`;
}

function sha(value: unknown, prefix: string, length = 28) {
  return `${prefix}_${createHash("sha256").update(stable(value)).digest("hex").slice(0, length)}`;
}

function containsForbiddenKey(value: unknown): string[] {
  const hits = new Set<string>();
  const visit = (entry: unknown, path: string) => {
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      entry.slice(0, 50).forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      const forbidden = FORBIDDEN_KEYS.find((candidate) => lowered.includes(candidate.toLowerCase()));
      if (forbidden) hits.add(`${path}.${key}`.replace(/^\./, ""));
      visit(child, `${path}.${key}`.replace(/^\./, ""));
    }
  };
  visit(value, "");
  return Array.from(hits).slice(0, 24);
}

function baseBoundary(): OrderReplaySnapshotIntegrity["redactionBoundary"] {
  return {
    rawCustomerPiiStored: false,
    rawProviderPayloadStored: false,
    secretsStored: false,
    allowedFields: [
      "orderDraftId",
      "order status",
      "locale",
      "cart hash",
      "stripe session id",
      "line item product/variant/provider ids",
      "line item quantities and prices",
      "guard and reservation receipt ids",
      "snapshot checksum",
      "restore gate reason codes",
    ],
  };
}

export function buildOrderReplaySnapshotIntegrity(
  snapshot: OrderReplaySnapshot | null | undefined,
  expectedOrderDraftId?: string,
): OrderReplaySnapshotIntegrity {
  const generatedAt = new Date().toISOString();
  if (!snapshot) {
    return {
      schemaVersion: "velmere.order-replay-snapshot-integrity.v1",
      snapshotId: null,
      generatedAt,
      status: "missing",
      canRestore: false,
      checksum: null,
      reasonCodes: ["snapshot_missing"],
      warnings: [],
      coverage: {
        hasOrderId: false,
        hasStatus: false,
        hasLocale: false,
        hasCartHash: false,
        hasStripeSessionId: false,
        hasLineItems: false,
        hasGuardSummary: false,
        hasRedactionBoundary: false,
        lineItemCount: 0,
        automaticProviderLineCount: 0,
        missingProviderVariantCount: 0,
      },
      redactionBoundary: baseBoundary(),
    };
  }

  const reasonCodes: string[] = [];
  const warnings: string[] = [];
  const forbidden = containsForbiddenKey(snapshot);
  const hasLineItems = Array.isArray(snapshot.lineItems) && snapshot.lineItems.length > 0;
  const automaticProviderLineCount = (snapshot.lineItems ?? []).filter((line) => line.fulfilmentMode === "automatic").length;
  const missingProviderVariantCount = (snapshot.lineItems ?? []).filter((line) => line.fulfilmentMode === "automatic" && !line.providerVariantId).length;

  if (snapshot.schemaVersion !== "velmere.order-replay-snapshot.v1") reasonCodes.push("snapshot_schema_mismatch");
  if (!snapshot.id) reasonCodes.push("snapshot_order_id_missing");
  if (expectedOrderDraftId && snapshot.id !== expectedOrderDraftId) reasonCodes.push("snapshot_order_id_mismatch");
  if (!ALLOWED_STATUSES.has(snapshot.status)) reasonCodes.push("snapshot_status_unknown");
  if (!snapshot.locale) warnings.push("snapshot_locale_missing");
  if (!snapshot.cartHash) warnings.push("snapshot_cart_hash_missing");
  if (!snapshot.stripeSessionId) reasonCodes.push("snapshot_stripe_session_missing");
  if (!hasLineItems) reasonCodes.push("snapshot_line_items_missing");
  if (missingProviderVariantCount > 0) reasonCodes.push("snapshot_provider_variant_missing");
  if (!snapshot.redactionBoundary) reasonCodes.push("snapshot_redaction_boundary_missing");
  if (snapshot.redactionBoundary?.rawCustomerPiiStored !== false) reasonCodes.push("snapshot_customer_pii_boundary_failed");
  if (snapshot.redactionBoundary?.rawProviderPayloadStored !== false) reasonCodes.push("snapshot_provider_payload_boundary_failed");
  if (snapshot.redactionBoundary?.secretsStored !== false) reasonCodes.push("snapshot_secret_boundary_failed");
  if (forbidden.length > 0) reasonCodes.push("snapshot_forbidden_key_detected");

  for (const line of snapshot.lineItems ?? []) {
    if (!line.productId) reasonCodes.push("snapshot_line_product_id_missing");
    if (!line.variantId) reasonCodes.push("snapshot_line_variant_id_missing");
    if (!Number.isFinite(line.quantity) || line.quantity < 1) reasonCodes.push("snapshot_line_quantity_invalid");
    if (!Number.isFinite(line.amount) || line.amount < 0) reasonCodes.push("snapshot_line_amount_invalid");
    if (!line.currency) reasonCodes.push("snapshot_line_currency_missing");
  }

  if (forbidden.length > 0) warnings.push(`forbidden snapshot keys: ${forbidden.join(", ")}`);

  const uniqueReasonCodes = Array.from(new Set(reasonCodes)).slice(0, 40);
  const uniqueWarnings = Array.from(new Set(warnings)).slice(0, 30);
  const canRestore = uniqueReasonCodes.length === 0;
  const status: OrderReplaySnapshotIntegrityStatus = canRestore ? (uniqueWarnings.length ? "warning" : "verified") : "failed";

  return {
    schemaVersion: "velmere.order-replay-snapshot-integrity.v1",
    snapshotId: snapshot.id || null,
    generatedAt,
    status,
    canRestore,
    checksum: sha({
      schemaVersion: snapshot.schemaVersion,
      id: snapshot.id,
      status: snapshot.status,
      locale: snapshot.locale,
      cartHash: snapshot.cartHash,
      stripeSessionId: snapshot.stripeSessionId,
      lineItems: snapshot.lineItems,
      guardSummary: snapshot.guardSummary,
      redactionBoundary: snapshot.redactionBoundary,
    }, "orsnapchk"),
    reasonCodes: uniqueReasonCodes,
    warnings: uniqueWarnings,
    coverage: {
      hasOrderId: Boolean(snapshot.id),
      hasStatus: Boolean(snapshot.status),
      hasLocale: Boolean(snapshot.locale),
      hasCartHash: Boolean(snapshot.cartHash),
      hasStripeSessionId: Boolean(snapshot.stripeSessionId),
      hasLineItems,
      hasGuardSummary: Boolean(snapshot.guardSummary),
      hasRedactionBoundary: Boolean(snapshot.redactionBoundary),
      lineItemCount: snapshot.lineItems?.length ?? 0,
      automaticProviderLineCount,
      missingProviderVariantCount,
    },
    redactionBoundary: baseBoundary(),
  };
}

export function buildOrderReplaySnapshotRestoreGate(input: {
  snapshot: OrderReplaySnapshot | null | undefined;
  expectedOrderDraftId?: string;
  liveOrderAvailable?: boolean;
}): OrderReplaySnapshotRestoreGate {
  const integrity = buildOrderReplaySnapshotIntegrity(input.snapshot, input.expectedOrderDraftId);
  if (input.liveOrderAvailable) {
    return {
      schemaVersion: "velmere.order-replay-snapshot-restore-gate.v1",
      canRestore: true,
      blocked: false,
      status: integrity.status,
      checksum: integrity.checksum,
      reasonCodes: ["live_order_available", ...integrity.reasonCodes].slice(0, 40),
      nextAction: "use_live_order",
      productionBoundary:
        "Live runtime order exists, so durable replay snapshot is not required for this retry attempt. Snapshot integrity is still reported for audit visibility.",
    };
  }

  return {
    schemaVersion: "velmere.order-replay-snapshot-restore-gate.v1",
    canRestore: integrity.canRestore,
    blocked: !integrity.canRestore,
    status: integrity.status,
    checksum: integrity.checksum,
    reasonCodes: integrity.canRestore ? ["snapshot_restore_ready"] : integrity.reasonCodes,
    nextAction: integrity.canRestore ? "restore_and_replay" : "queue_requires_manual_review",
    productionBoundary:
      "When the runtime order is missing after a serverless restart, provider retry replay can only continue from a verified redacted order snapshot. Invalid snapshots are blocked and sent to manual review.",
  };
}
