import type { LocalizedString, Product, ProductImportDraft, ProductProvider, SupportedCurrency } from "@/lib/products/types";

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function localized(value: string): LocalizedString {
  return {
    pl: value,
    en: value,
    de: value,
  };
}

export function parseMoneyAmount(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9.,]/g, "").replace(",", ".");
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function normalizeCurrency(value?: string | null): SupportedCurrency {
  const upper = String(value ?? "").toUpperCase();
  if (upper && upper !== "EUR") {
    return "EUR";
  }
  return "EUR";
}

export function detectProvider(url: string): ProductProvider {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("printful.com")) return "printful";
  if (host.includes("tapstitch.com")) return "tapstitch";
  return "external";
}

export function createDraft(input: {
  title: string;
  description?: string;
  image?: string;
  imageImportPolicy?: "allow_imported" | "manual_only";
  priceAmount?: number;
  currency?: SupportedCurrency;
  provider?: ProductProvider;
  providerProductId?: string;
  providerVariantIds?: Record<string, string>;
  externalUrl?: string;
  sourceUrl?: string;
  idSeed?: string;
  sourceType: "url" | "printful" | "csv";
  warnings?: string[];
  variants?: Product["variants"];
  tags?: string[];
}) {
  const warnings = [...(input.warnings ?? [])];
  const title = input.title.trim() || "Imported product draft";
  const slug = slugify(title) || `imported-${Date.now()}`;
  const idSeed = slugify(input.idSeed || input.providerProductId || input.externalUrl || title) || slug;
  const priceAmount = input.priceAmount ?? 0;
  const variants = input.variants ?? [];
  const manualImagesOnly = input.imageImportPolicy === "manual_only";
  const image = manualImagesOnly ? undefined : input.image?.trim();

  if (!priceAmount) warnings.push("missing price");
  if (manualImagesOnly) warnings.push("manual image mode: provider/AI images are ignored; operator must add final Velmère product images manually");
  if (!image) warnings.push(manualImagesOnly ? "manual product images required" : "missing images");
  if (variants.length === 0) warnings.push("missing variants");
  if (!input.providerProductId) warnings.push("provider product id missing");
  warnings.push("checkout disabled until reviewed");

  const product: Product = {
    id: `draft_${idSeed}`,
    slug,
    provider: input.provider ?? "external",
    providerProductId: input.providerProductId,
    providerVariantIds: input.providerVariantIds,
    externalUrl: input.externalUrl,
    status: "draft",
    fulfilmentMode:
      input.providerVariantIds && variants.length > 0 && variants.every((variant) => input.providerVariantIds?.[variant.id])
        ? "automatic"
        : input.externalUrl
          ? "external_link"
          : "disabled",
    title: localized(title),
    description: localized(input.description?.trim() || (manualImagesOnly ? "Imported product draft. Provider data is used for price, variants and SKU mapping only. Add final Velmère images, copy, size chart, shipping and fulfilment proof manually before publishing." : "Imported product draft. Review copy, images, variants, pricing, shipping, and fulfilment before publishing.")),
    shortDescription: localized(input.description?.trim().slice(0, 140) || (manualImagesOnly ? "Imported draft awaiting manual images and operator review." : "Imported product draft awaiting review.")),
    price: {
      amount: priceAmount,
      currency: input.currency ?? "EUR",
    },
    images: image
      ? [
          {
            url: image,
            alt: localized(title),
          },
        ]
      : [],
    variants,
    tags: input.tags ?? ["imported", input.sourceType],
    importSource: {
      type: input.sourceType,
      sourceUrl: input.sourceUrl ?? input.externalUrl,
      importedAt: new Date().toISOString(),
      warnings,
    },
  };

  const validationErrors = [
    !priceAmount ? "Price is required before active publishing." : "",
    !image ? (manualImagesOnly ? "Manual Velmère product images are required before active publishing." : "At least one product image is required before active publishing.") : "",
    variants.length === 0 ? "At least one variant is required before active publishing." : "",
    "Shipping profile is required before active publishing.",
    input.provider === "printful" && !input.providerVariantIds
      ? "Provider variant mapping is required before automatic fulfilment."
      : "",
  ].filter(Boolean);

  return {
    draftId: product.id,
    product,
    warnings,
    validationErrors,
  } satisfies ProductImportDraft;
}
