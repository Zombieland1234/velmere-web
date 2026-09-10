import type { Product, ProductImportDraft, ProductProvider, ProductVariant } from "./types";

export type VlmProviderAdapterSnapshot = {
  name: ProductProvider;
  sourceQuality: "strong" | "medium" | "weak";
  variantMappingStatus: "complete" | "partial" | "missing";
  imageStatus: "complete" | "partial" | "missing";
  priceStatus: "complete" | "partial" | "missing";
  stockStatus: "complete" | "partial" | "missing" | "not_applicable";
  sizeGuideStatus: "complete" | "partial" | "missing";
  warnings: string[];
};

const COLOR_WORDS = [
  "black",
  "white",
  "grey",
  "gray",
  "cream",
  "beige",
  "navy",
  "blue",
  "red",
  "green",
  "olive",
  "brown",
  "pink",
  "purple",
  "yellow",
  "orange",
  "charcoal",
  "natural",
];

const SIZE_PATTERN = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)\b/i;
const CM_FIELDS = ["chest", "length", "shoulders", "sleeve", "waist", "hip", "thigh", "rise", "inseam"] as const;

type CmField = (typeof CM_FIELDS)[number];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function cleanVariantTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectColor(value: string) {
  const text = value.toLowerCase();
  return COLOR_WORDS.find((color) => new RegExp(`\\b${color}\\b`, "i").test(text));
}

function variantHasProviderMapping(product: Product, variant: ProductVariant) {
  return Boolean(variant.providerVariantId || product.providerVariantIds?.[variant.id]);
}

function variantHasStockSignal(variant: ProductVariant) {
  return typeof variant.available === "boolean" || typeof variant.stockQuantity === "number" || Boolean(variant.providerStatus && variant.providerStatus !== "unknown");
}

function variantIsAvailable(variant: ProductVariant) {
  if (typeof variant.available === "boolean") return variant.available;
  if (typeof variant.stockQuantity === "number") return variant.stockQuantity > 0;
  return variant.providerStatus === "synced";
}

function normalizeVariant(product: Product, variant: ProductVariant): ProductVariant {
  const title = cleanVariantTitle(variant.title || variant.sku || variant.providerVariantId || variant.id);
  const size = variant.size?.toUpperCase() ?? title.match(SIZE_PATTERN)?.[1]?.toUpperCase();
  const color = variant.color ?? detectColor(title);
  const mappedProviderId = variant.providerVariantId ?? product.providerVariantIds?.[variant.id];
  const providerStatus = variant.providerStatus ?? (typeof variant.available === "boolean" ? (variant.available ? "synced" : "unsynced") : undefined);

  return {
    ...variant,
    title: title || size || color || variant.id,
    size,
    color,
    providerVariantId: mappedProviderId,
    providerStatus,
    available: variant.available ?? (typeof variant.stockQuantity === "number" ? variant.stockQuantity > 0 : product.provider === "manual" ? undefined : false),
  };
}

function hasMeasurementValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function sizeGuideStatus(product: Product, variants: ProductVariant[]): VlmProviderAdapterSnapshot["sizeGuideStatus"] {
  const measurements = product.truth?.sizeGuide.measurements ?? [];
  const confirmed = measurements.filter((measurement) => CM_FIELDS.some((field: CmField) => hasMeasurementValue(measurement[field])));
  if (confirmed.length === 0) return "missing";
  const uniqueSizes = unique(variants.map((variant) => variant.size || variant.title).filter((value): value is string => Boolean(value)));
  if (uniqueSizes.length === 0) return "partial";
  const confirmedSizes = new Set(confirmed.map((measurement) => measurement.size.toUpperCase()));
  const covered = uniqueSizes.filter((size) => confirmedSizes.has(String(size).toUpperCase())).length;
  return covered === uniqueSizes.length ? "complete" : "partial";
}

function adapterWarnings(product: Product, variants: ProductVariant[], stockStatus: VlmProviderAdapterSnapshot["stockStatus"], guideStatus: VlmProviderAdapterSnapshot["sizeGuideStatus"]) {
  const warnings = [
    !product.providerProductId && !product.externalUrl ? "provider source missing" : "",
    variants.length === 0 ? "provider variants missing" : "",
    variants.length > 0 && variants.every((variant) => !variant.size) ? "no size data detected in provider variants" : "",
    variants.length > 0 && variants.some((variant) => !variant.sku && !variant.providerVariantId) ? "some variants miss SKU/provider id" : "",
    product.images.length === 0 ? "manual product images required" : "",
    product.price.amount <= 0 && variants.every((variant) => !variant.price?.amount) ? "provider price missing" : "",
    product.provider === "tapstitch" && !product.externalUrl ? "Tapstitch adapter needs product URL or export row" : "",
    product.fulfilmentMode === "automatic" && stockStatus === "missing" ? "automatic fulfilment missing provider stock/availability signal" : "",
    stockStatus === "partial" ? "some variants miss stock/availability signal" : "",
    guideStatus !== "complete" ? "size chart cm not fully confirmed" : "",
  ].filter(Boolean);

  return unique(warnings);
}

export function normalizeProductDraftThroughProviderAdapter(draft: ProductImportDraft): ProductImportDraft & { adapter: VlmProviderAdapterSnapshot } {
  const product = draft.product;
  const variants = product.variants.map((variant) => normalizeVariant(product, variant));
  const mappedCount = variants.filter((variant) => variantHasProviderMapping(product, variant)).length;
  const stockSignalCount = variants.filter(variantHasStockSignal).length;
  const availableCount = variants.filter(variantIsAvailable).length;

  const variantMappingStatus: VlmProviderAdapterSnapshot["variantMappingStatus"] =
    variants.length === 0 || mappedCount === 0 ? "missing" : mappedCount === variants.length ? "complete" : "partial";
  const imageStatus: VlmProviderAdapterSnapshot["imageStatus"] =
    product.images.length >= 3 ? "complete" : product.images.length > 0 ? "partial" : "missing";
  const pricedVariants = variants.filter((variant) => Boolean(variant.price?.amount));
  const priceStatus: VlmProviderAdapterSnapshot["priceStatus"] =
    product.price.amount > 0 || (pricedVariants.length === variants.length && variants.length > 0)
      ? "complete"
      : pricedVariants.length > 0
        ? "partial"
        : "missing";
  const stockStatus: VlmProviderAdapterSnapshot["stockStatus"] =
    product.fulfilmentMode === "external_link" || product.fulfilmentMode === "manual"
      ? "not_applicable"
      : variants.length === 0 || stockSignalCount === 0 || availableCount === 0
        ? "missing"
        : stockSignalCount === variants.length
          ? "complete"
          : "partial";
  const guideStatus = sizeGuideStatus(product, variants);
  const sourceQuality: VlmProviderAdapterSnapshot["sourceQuality"] =
    (product.providerProductId || product.externalUrl) && variants.length > 0
      ? "strong"
      : product.providerProductId || product.externalUrl || variants.length > 0 || product.images.length > 0
        ? "medium"
        : "weak";
  const warnings = adapterWarnings(product, variants, stockStatus, guideStatus);

  const adapter: VlmProviderAdapterSnapshot = {
    name: product.provider,
    sourceQuality,
    variantMappingStatus,
    imageStatus,
    priceStatus,
    stockStatus,
    sizeGuideStatus: guideStatus,
    warnings,
  };

  return {
    ...draft,
    product: {
      ...product,
      variants,
      providerVariantIds: product.providerVariantIds ?? Object.fromEntries(variants.filter((variant) => variant.providerVariantId).map((variant) => [variant.id, variant.providerVariantId as string])),
      importSource: product.importSource
        ? {
            ...product.importSource,
            warnings: unique([...(product.importSource.warnings ?? []), ...warnings]),
          }
        : product.importSource,
    },
    warnings: unique([...draft.warnings, ...warnings.map((warning) => `Provider adapter: ${warning}`)]),
    adapter,
  };
}
