import { createHash } from "node:crypto";
import type { ProductCheckoutGuardResult, ProductCheckoutGuardResolvedLine } from "./checkout-guard";
import type { FulfilmentMode, ProductProvider, SupportedCurrency } from "./types";

export type ProviderStockReservationMode =
  | "local_stock_hold"
  | "local_stock_hold_strict"
  | "manual_order_hold"
  | "disabled";

export type ProviderStockReservationLineOutcome = "reserved" | "manual_hold" | "skipped" | "blocked";

export type ProviderStockReservationLineReceipt = {
  lineId: string;
  outcome: ProviderStockReservationLineOutcome;
  productId: string;
  variantId?: string;
  title?: string;
  provider?: ProductProvider;
  fulfilmentMode?: FulfilmentMode;
  providerVariantId?: string;
  quantity: number;
  unitAmount?: number;
  currency?: SupportedCurrency;
  stockQuantity?: number | null;
  alreadyHeldQuantity: number;
  available?: boolean | null;
  holdKey?: string;
  holdExpiresAt?: string;
  reasonCodes: string[];
  message: string;
  evidence: {
    checkoutGuardAllowed: boolean;
    providerMappingReady: boolean;
    providerStatusSynced: boolean;
    stockKnown: boolean;
    stockEnough: boolean;
    reservationCreated: boolean;
    manualFulfilmentAllowed: boolean;
  };
};

export type ProviderStockReservationReceipt = {
  schemaVersion: "velmere.product.provider-stock-reservation.v1";
  receiptId: string;
  reservationId: string;
  generatedAt: string;
  expiresAt: string;
  mode: ProviderStockReservationMode;
  ok: boolean;
  cartHash: string;
  checkoutGuardReceiptId: string;
  reservedCount: number;
  manualHoldCount: number;
  skippedCount: number;
  blockedCount: number;
  totalQuantity: number;
  ttlSeconds: number;
  strictStock: boolean;
  lines: ProviderStockReservationLineReceipt[];
  orderDraftBoundary: string;
  providerBoundary: string;
};

export type ProviderStockReservationResult = {
  schemaVersion: "velmere.product.provider-stock-reservation-result.v1";
  ok: boolean;
  receipt: ProviderStockReservationReceipt;
};

type ReservationMemoryStore = {
  receipts: Map<string, ProviderStockReservationReceipt>;
  lineHolds: Map<string, number>;
};

const DEFAULT_TTL_SECONDS = 20 * 60;
const MAX_TTL_SECONDS = 60 * 60;

function getMemoryStore(): ReservationMemoryStore {
  const globalStore = globalThis as typeof globalThis & { __velmereProviderReservationStore?: ReservationMemoryStore };
  if (!globalStore.__velmereProviderReservationStore) {
    globalStore.__velmereProviderReservationStore = {
      receipts: new Map(),
      lineHolds: new Map(),
    };
  }
  return globalStore.__velmereProviderReservationStore;
}

function nowMs() {
  return Date.now();
}

function ttlSeconds() {
  const raw = Number(process.env.VELMERE_PROVIDER_RESERVATION_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_TTL_SECONDS;
  return Math.max(60, Math.min(MAX_TTL_SECONDS, Math.floor(raw)));
}

function strictStockEnabled() {
  return process.env.VELMERE_PROVIDER_STOCK_STRICT === "true" || process.env.VELMERE_PROVIDER_STOCK_STRICT === "1";
}

function reservationDisabled() {
  return process.env.VELMERE_PROVIDER_RESERVATION_DISABLED === "true" || process.env.VELMERE_PROVIDER_RESERVATION_DISABLED === "1";
}

function hashJson(value: unknown, prefix: string, length = 18) {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length)}`;
}

function getReservationId(input: { guardReceiptId: string; cartHash: string; lines: ProductCheckoutGuardResolvedLine[] }) {
  return hashJson(
    {
      guard: input.guardReceiptId,
      cartHash: input.cartHash,
      lines: input.lines.map((line) => ({
        p: line.receipt.productId,
        v: line.receipt.variantId,
        q: line.receipt.quantity,
        pv: line.receipt.providerVariantId,
      })),
    },
    "vreserve",
    20,
  );
}

function receiptIdFor(reservationId: string, lines: ProviderStockReservationLineReceipt[]) {
  return hashJson(
    {
      reservationId,
      lines: lines.map((line) => ({
        p: line.productId,
        v: line.variantId,
        q: line.quantity,
        outcome: line.outcome,
        reasons: line.reasonCodes,
      })),
    },
    "vstock",
    18,
  );
}

function parseIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function purgeExpiredReservations(store: ReservationMemoryStore) {
  const now = nowMs();
  for (const [reservationId, receipt] of store.receipts.entries()) {
    if (parseIso(receipt.expiresAt) > now) continue;
    for (const line of receipt.lines) {
      if (!line.holdKey) continue;
      const current = store.lineHolds.get(line.holdKey) ?? 0;
      const next = Math.max(0, current - line.quantity);
      if (next === 0) store.lineHolds.delete(line.holdKey);
      else store.lineHolds.set(line.holdKey, next);
    }
    store.receipts.delete(reservationId);
  }
}

function holdKeyFor(line: ProductCheckoutGuardResolvedLine) {
  const provider = line.product?.provider ?? line.receipt.provider ?? "manual";
  const providerVariantId = line.receipt.providerVariantId;
  if (providerVariantId) return `${provider}:${providerVariantId}`;
  if (line.receipt.variantId) return `product:${line.receipt.productId}:${line.receipt.variantId}`;
  return undefined;
}

function lineMessage(outcome: ProviderStockReservationLineOutcome, reasonCodes: string[]) {
  if (outcome === "reserved") return "provider_stock_soft_reserved";
  if (outcome === "manual_hold") return "manual_fulfilment_order_hold_created";
  if (outcome === "skipped") return "stock_reservation_skipped";
  return reasonCodes[0] ?? "provider_stock_reservation_blocked";
}

function buildLine(input: {
  line: ProductCheckoutGuardResolvedLine;
  store: ReservationMemoryStore;
  strictStock: boolean;
  expiresAt: string;
}): ProviderStockReservationLineReceipt {
  const { line, store, strictStock, expiresAt } = input;
  const product = line.product;
  const variant = line.variant;
  const receipt = line.receipt;
  const quantity = receipt.quantity;
  const holdKey = holdKeyFor(line);
  const alreadyHeldQuantity = holdKey ? store.lineHolds.get(holdKey) ?? 0 : 0;
  const stockKnown = typeof receipt.stockQuantity === "number" && Number.isFinite(receipt.stockQuantity);
  const stockEnough = !stockKnown || (receipt.stockQuantity ?? 0) - alreadyHeldQuantity >= quantity;
  const providerMappingReady = Boolean(product?.fulfilmentMode !== "automatic" || receipt.providerVariantId);
  const providerStatusSynced = variant?.providerStatus !== "unsynced";
  const manualFulfilmentAllowed = product?.fulfilmentMode === "manual";

  const reasonCodes: string[] = [];
  if (receipt.outcome !== "allowed") reasonCodes.push("checkout_guard_not_allowed");
  if (!product || !variant) reasonCodes.push("resolved_product_or_variant_missing");
  if (product?.fulfilmentMode === "disabled") reasonCodes.push("fulfilment_disabled");
  if (product?.fulfilmentMode === "external_link") reasonCodes.push("external_link_not_reservable");
  if (product?.fulfilmentMode === "automatic" && !receipt.providerVariantId) reasonCodes.push("provider_variant_missing");
  if (variant?.providerStatus === "unsynced") reasonCodes.push("provider_variant_unsynced");
  if (receipt.available === false) reasonCodes.push("provider_variant_unavailable");
  if (stockKnown && !stockEnough) reasonCodes.push("reserved_stock_exhausted");
  if (!stockKnown && strictStock && product?.fulfilmentMode === "automatic") reasonCodes.push("provider_stock_unknown_strict");

  let outcome: ProviderStockReservationLineOutcome = "blocked";
  if (reasonCodes.length === 0) {
    if (product?.fulfilmentMode === "automatic") outcome = "reserved";
    else if (product?.fulfilmentMode === "manual") outcome = "manual_hold";
    else outcome = "skipped";
  }

  return {
    lineId: receipt.lineId,
    outcome,
    productId: receipt.productId,
    variantId: receipt.variantId,
    title: receipt.title,
    provider: receipt.provider,
    fulfilmentMode: receipt.fulfilmentMode,
    providerVariantId: receipt.providerVariantId,
    quantity,
    unitAmount: receipt.unitAmount,
    currency: receipt.currency,
    stockQuantity: typeof receipt.stockQuantity === "number" ? receipt.stockQuantity : null,
    alreadyHeldQuantity,
    available: typeof receipt.available === "boolean" ? receipt.available : null,
    holdKey: outcome === "reserved" || outcome === "manual_hold" ? holdKey : undefined,
    holdExpiresAt: outcome === "reserved" || outcome === "manual_hold" ? expiresAt : undefined,
    reasonCodes,
    message: lineMessage(outcome, reasonCodes),
    evidence: {
      checkoutGuardAllowed: receipt.outcome === "allowed",
      providerMappingReady,
      providerStatusSynced,
      stockKnown,
      stockEnough,
      reservationCreated: outcome === "reserved" || outcome === "manual_hold",
      manualFulfilmentAllowed,
    },
  };
}

export async function buildProviderStockReservationDraft(input: {
  checkoutGuard: ProductCheckoutGuardResult;
  cartHash: string;
}): Promise<ProviderStockReservationResult> {
  const store = getMemoryStore();
  purgeExpiredReservations(store);

  const strictStock = strictStockEnabled();
  const ttl = ttlSeconds();
  const generatedAtMs = nowMs();
  const generatedAt = new Date(generatedAtMs).toISOString();
  const expiresAt = new Date(generatedAtMs + ttl * 1000).toISOString();
  const reservationId = getReservationId({
    guardReceiptId: input.checkoutGuard.receipt.receiptId,
    cartHash: input.cartHash,
    lines: input.checkoutGuard.lines,
  });

  const existing = store.receipts.get(reservationId);
  if (existing && parseIso(existing.expiresAt) > generatedAtMs) {
    return {
      schemaVersion: "velmere.product.provider-stock-reservation-result.v1",
      ok: existing.ok,
      receipt: existing,
    };
  }

  if (reservationDisabled()) {
    const lines = input.checkoutGuard.lines.map((line) => ({
      lineId: line.receipt.lineId,
      outcome: "blocked" as const,
      productId: line.receipt.productId,
      variantId: line.receipt.variantId,
      title: line.receipt.title,
      provider: line.receipt.provider,
      fulfilmentMode: line.receipt.fulfilmentMode,
      providerVariantId: line.receipt.providerVariantId,
      quantity: line.receipt.quantity,
      unitAmount: line.receipt.unitAmount,
      currency: line.receipt.currency,
      stockQuantity: typeof line.receipt.stockQuantity === "number" ? line.receipt.stockQuantity : null,
      alreadyHeldQuantity: 0,
      available: typeof line.receipt.available === "boolean" ? line.receipt.available : null,
      reasonCodes: ["provider_reservation_disabled"],
      message: "provider_stock_reservation_disabled_by_env",
      evidence: {
        checkoutGuardAllowed: line.receipt.outcome === "allowed",
        providerMappingReady: Boolean(line.product?.fulfilmentMode !== "automatic" || line.receipt.providerVariantId),
        providerStatusSynced: line.variant?.providerStatus !== "unsynced",
        stockKnown: typeof line.receipt.stockQuantity === "number",
        stockEnough: true,
        reservationCreated: false,
        manualFulfilmentAllowed: line.product?.fulfilmentMode === "manual",
      },
    }));
    const receipt = buildReceipt({
      reservationId,
      generatedAt,
      expiresAt,
      mode: "disabled",
      cartHash: input.cartHash,
      checkoutGuardReceiptId: input.checkoutGuard.receipt.receiptId,
      strictStock,
      ttl,
      lines,
    });
    return { schemaVersion: "velmere.product.provider-stock-reservation-result.v1", ok: false, receipt };
  }

  const lines = input.checkoutGuard.lines.map((line) => buildLine({ line, store, strictStock, expiresAt }));
  const hasAutomatic = lines.some((line) => line.fulfilmentMode === "automatic");
  const hasManual = lines.some((line) => line.fulfilmentMode === "manual");
  const receipt = buildReceipt({
    reservationId,
    generatedAt,
    expiresAt,
    mode: strictStock ? "local_stock_hold_strict" : hasAutomatic ? "local_stock_hold" : hasManual ? "manual_order_hold" : "local_stock_hold",
    cartHash: input.cartHash,
    checkoutGuardReceiptId: input.checkoutGuard.receipt.receiptId,
    strictStock,
    ttl,
    lines,
  });
  if (receipt.ok) {
    commitLineHolds(store, receipt);
    store.receipts.set(reservationId, receipt);
  }

  return {
    schemaVersion: "velmere.product.provider-stock-reservation-result.v1",
    ok: receipt.ok,
    receipt,
  };
}


function commitLineHolds(store: ReservationMemoryStore, receipt: ProviderStockReservationReceipt) {
  for (const line of receipt.lines) {
    if (!line.holdKey) continue;
    if (line.outcome !== "reserved" && line.outcome !== "manual_hold") continue;
    const current = store.lineHolds.get(line.holdKey) ?? 0;
    store.lineHolds.set(line.holdKey, current + line.quantity);
  }
}

function buildReceipt(input: {
  reservationId: string;
  generatedAt: string;
  expiresAt: string;
  mode: ProviderStockReservationMode;
  cartHash: string;
  checkoutGuardReceiptId: string;
  strictStock: boolean;
  ttl: number;
  lines: ProviderStockReservationLineReceipt[];
}): ProviderStockReservationReceipt {
  const reservedCount = input.lines.filter((line) => line.outcome === "reserved").length;
  const manualHoldCount = input.lines.filter((line) => line.outcome === "manual_hold").length;
  const skippedCount = input.lines.filter((line) => line.outcome === "skipped").length;
  const blockedCount = input.lines.filter((line) => line.outcome === "blocked").length;

  return {
    schemaVersion: "velmere.product.provider-stock-reservation.v1",
    receiptId: receiptIdFor(input.reservationId, input.lines),
    reservationId: input.reservationId,
    generatedAt: input.generatedAt,
    expiresAt: input.expiresAt,
    mode: input.mode,
    ok: blockedCount === 0 && input.lines.length > 0,
    cartHash: input.cartHash,
    checkoutGuardReceiptId: input.checkoutGuardReceiptId,
    reservedCount,
    manualHoldCount,
    skippedCount,
    blockedCount,
    totalQuantity: input.lines.reduce((sum, line) => sum + line.quantity, 0),
    ttlSeconds: input.ttl,
    strictStock: input.strictStock,
    lines: input.lines,
    orderDraftBoundary:
      "The order draft can be created only after checkout guard and provider reservation guard both pass. This receipt is stored in Stripe metadata and the in-memory order draft for replay.",
    providerBoundary:
      "This pass creates a local stock/manual hold contract. It does not call a live Printful/Tapstitch reservation API unless a future provider connector is added; unknown provider stock can be made blocking with VELMERE_PROVIDER_STOCK_STRICT=true.",
  };
}

export function summarizeProviderStockReservation(receipt: ProviderStockReservationReceipt) {
  return {
    receiptId: receipt.receiptId,
    reservationId: receipt.reservationId,
    ok: receipt.ok,
    mode: receipt.mode,
    expiresAt: receipt.expiresAt,
    reservedCount: receipt.reservedCount,
    manualHoldCount: receipt.manualHoldCount,
    blockedCount: receipt.blockedCount,
  };
}
