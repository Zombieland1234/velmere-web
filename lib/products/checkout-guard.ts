import { createHash } from "node:crypto";
import { formatMoney, getLocalizedString, hasCompleteAutomaticFulfilment, isProductCustomerPurchasable } from "./catalog";
import { getPublicCatalogReadthrough, type PublicCatalogReadthroughReceipt } from "./public-catalog-readthrough";
import type { FulfilmentMode, Product, ProductProvider, ProductVariant, SupportedCurrency } from "./types";

export type ProductCheckoutGuardMode = "add_to_cart" | "checkout";
export type ProductCheckoutGuardOutcome = "allowed" | "blocked";

export type ProductCheckoutGuardRequestItem = {
  productId: string;
  variantId?: string;
  size?: string;
  selectedSize?: string;
  quantity?: number;
};

export type ProductCheckoutGuardReceipt = {
  schemaVersion: "velmere.product.checkout-guard-receipt.v1";
  receiptId: string;
  generatedAt: string;
  mode: ProductCheckoutGuardMode;
  locale: "pl" | "en" | "de";
  ok: boolean;
  allowedCount: number;
  blockedCount: number;
  maxQuantityPerLine: number;
  catalogReadthrough: Pick<
    PublicCatalogReadthroughReceipt,
    "mode" | "durableStorageReady" | "visibleProductCount" | "purchasableProductCount" | "lastOverrideAt" | "warnings"
  >;
  lines: ProductCheckoutGuardLineReceipt[];
  customerBoundary: string;
};

export type ProductCheckoutGuardLineReceipt = {
  lineId: string;
  outcome: ProductCheckoutGuardOutcome;
  productId: string;
  slug?: string;
  variantId?: string;
  selectedSize?: string;
  quantity: number;
  title?: string;
  variantTitle?: string;
  status?: string;
  provider?: ProductProvider;
  fulfilmentMode?: FulfilmentMode;
  unitAmount?: number;
  currency?: SupportedCurrency;
  displayPrice?: string;
  providerVariantId?: string;
  stockQuantity?: number | null;
  available?: boolean | null;
  customerVisibility: "purchasable" | "preview" | "hidden" | "unknown";
  reasonCodes: string[];
  message: string;
  evidence: {
    publicCatalogReadthrough: boolean;
    publicationStateApplied: boolean;
    activeStatus: boolean;
    priceReady: boolean;
    variantReady: boolean;
    providerMappingReady: boolean;
    stockReady: boolean;
    checkoutFulfilmentReady: boolean;
  };
};

export type ProductCheckoutGuardResolvedLine = {
  receipt: ProductCheckoutGuardLineReceipt;
  product?: Product;
  variant?: ProductVariant;
};

export type ProductCheckoutGuardResult = {
  schemaVersion: "velmere.product.checkout-guard.v1";
  ok: boolean;
  receipt: ProductCheckoutGuardReceipt;
  lines: ProductCheckoutGuardResolvedLine[];
};

const MAX_CART_LINES = 25;
const MAX_QUANTITY_PER_LINE = 10;

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "en" || value === "de" || value === "pl" ? value : "pl";
}

function clampQuantity(value: unknown) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, numeric));
}

function lineIdFor(input: ProductCheckoutGuardRequestItem, index: number) {
  const seed = `${input.productId}:${input.variantId ?? ""}:${input.selectedSize ?? input.size ?? ""}:${index}`;
  return `vcg_${createHash("sha256").update(seed).digest("hex").slice(0, 14)}`;
}

function receiptIdFor(lines: ProductCheckoutGuardLineReceipt[]) {
  const seed = JSON.stringify(lines.map((line) => ({
    id: line.productId,
    v: line.variantId,
    q: line.quantity,
    outcome: line.outcome,
    reasonCodes: line.reasonCodes,
  })));
  return `vcheckout_${createHash("sha256").update(seed).digest("hex").slice(0, 18)}`;
}

function statusToVisibility(product?: Product | null): ProductCheckoutGuardLineReceipt["customerVisibility"] {
  if (!product) return "unknown";
  if (product.status === "active") return "purchasable";
  if (product.status === "coming_soon") return "preview";
  return "hidden";
}

function providerVariantIdFor(product: Product, variant: ProductVariant) {
  return variant.providerVariantId ?? product.providerVariantIds?.[variant.id];
}

function localizedBlockedMessage(locale: "pl" | "en" | "de", reasonCodes: string[], title?: string) {
  const name = title || (locale === "de" ? "Dieses Produkt" : locale === "en" ? "This product" : "Ten produkt");
  const primary = reasonCodes[0] ?? "checkout_guard_blocked";
  if (locale === "de") {
    const map: Record<string, string> = {
      product_not_found: "Dieses Produkt ist nicht mehr im öffentlichen Katalog verfügbar.",
      product_not_active: `${name} ist noch nicht für den Checkout aktiv.`,
      product_not_purchasable: `${name} ist noch nicht vollständig für den Checkout freigegeben.`,
      variant_missing: `${name} benötigt eine gültige Variante.`,
      price_missing: `${name} hat noch keinen bestätigten Preis.`,
      provider_mapping_missing: `${name} wartet noch auf Provider-Mapping.`,
      provider_mapping_unsynced: `${name} wartet noch auf Provider-Synchronisierung.`,
      stock_unavailable: `${name} ist in dieser Variante nicht verfügbar.`,
      fulfilment_disabled: `${name} ist für den internen Checkout noch nicht freigegeben.`,
      fulfilment_external_link_only: `${name} kann aktuell nur über einen externen Link gekauft werden.`,
      quantity_too_high: `${name} überschreitet die maximale Menge pro Warenkorbzeile.`,
    };
    return map[primary] ?? `${name} ist noch nicht für den Checkout freigegeben.`;
  }
  if (locale === "en") {
    const map: Record<string, string> = {
      product_not_found: "This product is no longer available in the public catalog.",
      product_not_active: `${name} is not active for checkout yet.`,
      product_not_purchasable: `${name} is not fully cleared for checkout yet.`,
      variant_missing: `${name} requires a valid variant.`,
      price_missing: `${name} does not have a confirmed price yet.`,
      provider_mapping_missing: `${name} is still waiting for provider mapping.`,
      provider_mapping_unsynced: `${name} is still waiting for provider sync.`,
      stock_unavailable: `${name} is not available in this variant.`,
      fulfilment_disabled: `${name} is not enabled for internal checkout yet.`,
      fulfilment_external_link_only: `${name} can currently be purchased only through an external link.`,
      quantity_too_high: `${name} exceeds the maximum quantity per cart line.`,
    };
    return map[primary] ?? `${name} is not cleared for checkout yet.`;
  }
  const map: Record<string, string> = {
    product_not_found: "Ten produkt nie jest już dostępny w publicznym katalogu.",
    product_not_active: `${name} nie jest jeszcze aktywny do checkoutu.`,
    product_not_purchasable: `${name} nie ma jeszcze kompletnej zgody na checkout.`,
    variant_missing: `${name} wymaga poprawnego wariantu.`,
    price_missing: `${name} nie ma jeszcze potwierdzonej ceny.`,
    provider_mapping_missing: `${name} czeka jeszcze na mapowanie providera.`,
    provider_mapping_unsynced: `${name} czeka jeszcze na synchronizację providera.`,
    stock_unavailable: `${name} nie jest dostępny w tym wariancie.`,
    fulfilment_disabled: `${name} nie ma jeszcze włączonego wewnętrznego checkoutu.`,
    fulfilment_external_link_only: `${name} można teraz kupić tylko przez zewnętrzny link.`,
    quantity_too_high: `${name} przekracza maksymalną ilość w jednej linii koszyka.`,
  };
  return map[primary] ?? `${name} nie ma jeszcze zgody na checkout.`;
}

function buildLineReceipt(input: {
  item: ProductCheckoutGuardRequestItem;
  index: number;
  product?: Product | null;
  variant?: ProductVariant | null;
  locale: "pl" | "en" | "de";
  mode: ProductCheckoutGuardMode;
}): ProductCheckoutGuardResolvedLine {
  const requestedQuantity = Math.floor(Number(input.item.quantity ?? 1));
  const quantity = clampQuantity(input.item.quantity ?? 1);
  const product = input.product ?? null;
  const variant = input.variant ?? null;
  const selectedSize = input.item.selectedSize ?? input.item.size ?? variant?.size ?? variant?.title;
  const title = product ? getLocalizedString(product.title, input.locale) : undefined;
  const variantPrice = variant?.price ?? product?.price;
  const providerVariantId = product && variant ? providerVariantIdFor(product, variant) : undefined;

  const reasonCodes: string[] = [];
  if (!product) reasonCodes.push("product_not_found");
  if (product && product.status !== "active") reasonCodes.push("product_not_active");
  if (product && !isProductCustomerPurchasable(product)) reasonCodes.push("product_not_purchasable");
  if (product && !variant) reasonCodes.push("variant_missing");
  if (product && variant && (!variantPrice || variantPrice.amount <= 0)) reasonCodes.push("price_missing");
  if (product && product.fulfilmentMode === "disabled") reasonCodes.push("fulfilment_disabled");
  if (product && product.fulfilmentMode === "external_link") reasonCodes.push("fulfilment_external_link_only");
  if (product && variant && product.fulfilmentMode === "automatic" && !providerVariantId) reasonCodes.push("provider_mapping_missing");
  if (variant?.providerStatus === "unsynced") reasonCodes.push("provider_mapping_unsynced");
  if (variant?.available === false) reasonCodes.push("stock_unavailable");
  if (typeof variant?.stockQuantity === "number" && Number.isFinite(variant.stockQuantity) && variant.stockQuantity < quantity) reasonCodes.push("stock_unavailable");
  if (Number.isFinite(requestedQuantity) && requestedQuantity > MAX_QUANTITY_PER_LINE) reasonCodes.push("quantity_too_high");

  const activeStatus = product?.status === "active";
  const priceReady = Boolean(variantPrice && variantPrice.amount > 0);
  const variantReady = Boolean(variant);
  const providerMappingReady = Boolean(!product || product.fulfilmentMode !== "automatic" || providerVariantId);
  const stockReady = Boolean(!variant || (variant.available !== false && !(typeof variant.stockQuantity === "number" && variant.stockQuantity < quantity)));
  const checkoutFulfilmentReady = Boolean(product && product.fulfilmentMode !== "disabled" && product.fulfilmentMode !== "external_link" && hasCompleteAutomaticFulfilment(product));
  const outcome: ProductCheckoutGuardOutcome = reasonCodes.length === 0 ? "allowed" : "blocked";

  const receipt: ProductCheckoutGuardLineReceipt = {
    lineId: lineIdFor(input.item, input.index),
    outcome,
    productId: product?.id ?? input.item.productId,
    slug: product?.slug,
    variantId: variant?.id ?? input.item.variantId,
    selectedSize,
    quantity,
    title,
    variantTitle: variant?.title,
    status: product?.status,
    provider: product?.provider,
    fulfilmentMode: product?.fulfilmentMode,
    unitAmount: variantPrice?.amount,
    currency: variantPrice?.currency,
    displayPrice: variantPrice ? formatMoney(variantPrice, input.locale) : undefined,
    providerVariantId,
    stockQuantity: typeof variant?.stockQuantity === "number" ? variant.stockQuantity : null,
    available: typeof variant?.available === "boolean" ? variant.available : null,
    customerVisibility: statusToVisibility(product),
    reasonCodes,
    message: outcome === "allowed" ? "checkout_guard_allowed" : localizedBlockedMessage(input.locale, reasonCodes, title),
    evidence: {
      publicCatalogReadthrough: true,
      publicationStateApplied: Boolean(product?.importSource?.warnings?.some((warning) => warning.startsWith("publication-state:"))),
      activeStatus,
      priceReady,
      variantReady,
      providerMappingReady,
      stockReady,
      checkoutFulfilmentReady,
    },
  };

  return { receipt, product: product ?? undefined, variant: variant ?? undefined };
}

export async function buildProductCheckoutGuard(input: {
  items: ProductCheckoutGuardRequestItem[];
  locale?: unknown;
  mode?: ProductCheckoutGuardMode;
}): Promise<ProductCheckoutGuardResult> {
  const locale = normalizeLocale(input.locale);
  const mode = input.mode ?? "checkout";
  const items = Array.isArray(input.items) ? input.items.slice(0, MAX_CART_LINES) : [];
  const catalog = await getPublicCatalogReadthrough();
  const products = catalog.products;
  const lines = items.map((item, index) => {
    const product = products.find((entry) => entry.id === item.productId || entry.slug === item.productId) ?? null;
    const selectedSize = item.selectedSize ?? item.size;
    const variant = product
      ? product.variants.find((entry) => entry.id === item.variantId) ?? product.variants.find((entry) => entry.size === selectedSize || entry.title === selectedSize) ?? null
      : null;
    return buildLineReceipt({ item, index, product, variant, locale, mode });
  });

  const blockedCount = lines.filter((line) => line.receipt.outcome === "blocked").length;
  const allowedCount = lines.length - blockedCount;
  const lineReceipts = lines.map((line) => line.receipt);
  const receipt: ProductCheckoutGuardReceipt = {
    schemaVersion: "velmere.product.checkout-guard-receipt.v1",
    receiptId: receiptIdFor(lineReceipts),
    generatedAt: new Date().toISOString(),
    mode,
    locale,
    ok: blockedCount === 0 && lines.length > 0,
    allowedCount,
    blockedCount,
    maxQuantityPerLine: MAX_QUANTITY_PER_LINE,
    catalogReadthrough: {
      mode: catalog.receipt.mode,
      durableStorageReady: catalog.receipt.durableStorageReady,
      visibleProductCount: catalog.receipt.visibleProductCount,
      purchasableProductCount: catalog.receipt.purchasableProductCount,
      lastOverrideAt: catalog.receipt.lastOverrideAt,
      warnings: catalog.receipt.warnings,
    },
    lines: lineReceipts,
    customerBoundary:
      "Checkout guard reads the public catalog read-through and validates only product status, variant, price, stock and provider mapping. It never exposes raw provider payloads, operator notes, storage secrets or customer PII.",
  };

  return {
    schemaVersion: "velmere.product.checkout-guard.v1",
    ok: receipt.ok,
    receipt,
    lines,
  };
}

export function redactProductCheckoutGuardResult(result: ProductCheckoutGuardResult) {
  return {
    schemaVersion: result.schemaVersion,
    ok: result.ok,
    receipt: result.receipt,
  };
}
