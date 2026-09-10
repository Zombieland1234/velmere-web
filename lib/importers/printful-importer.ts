import { createDraft, normalizeCurrency, parseMoneyAmount, slugify } from "./common";
import { getPrintfulStoreProduct, getPrintfulStoreProducts } from "@/lib/printful/products";
import type { ProductImportDraft, ProductVariant } from "@/lib/products/types";

export async function syncPrintfulProducts(): Promise<ProductImportDraft[]> {
  if (!process.env.PRINTFUL_API_TOKEN) {
    return [
      createDraft({
        title: "Printful sync unavailable",
        sourceType: "printful",
        provider: "printful",
        warnings: ["missing PRINTFUL_API_TOKEN"],
      }),
    ];
  }

  const products = await getPrintfulStoreProducts();
  const drafts: ProductImportDraft[] = [];

  for (const product of products) {
    const detail = await getPrintfulStoreProduct(product.id);
    const variants: ProductVariant[] = (detail.sync_variants ?? []).map((variant) => {
      const title = variant.name || `Variant ${variant.id}`;
      return {
        id: `printful-${variant.id}`,
        title,
        size: title.match(/\b(XS|S|M|L|XL|XXL)\b/i)?.[1]?.toUpperCase(),
        sku: variant.sku,
        providerVariantId: String(variant.id),
        providerStatus: variant.synced ? "synced" : "unsynced",
        price: {
          amount: parseMoneyAmount(variant.retail_price),
          currency: normalizeCurrency(variant.currency),
        },
        available: Boolean(variant.synced),
      };
    });
    const providerVariantIds = Object.fromEntries(variants.map((variant) => [variant.id, variant.providerVariantId ?? ""]));

    drafts.push(
      createDraft({
        title: detail.sync_product.name || product.name,
        description: "Printful product draft imported for Velmère review. Provider images are intentionally ignored; final Velmère visuals must be added manually by the operator.",
        imageImportPolicy: "manual_only",
        priceAmount: variants.find((variant) => variant.price?.amount)?.price?.amount,
        currency: variants.find((variant) => variant.price?.currency)?.price?.currency,
        provider: "printful",
        providerProductId: String(product.id),
        idSeed: `printful-${product.id}`,
        providerVariantIds,
        variants,
        sourceType: "printful",
        warnings: [
          !process.env.PRINTFUL_STORE_ID ? "missing PRINTFUL_STORE_ID" : "",
          variants.length === 0 ? "missing variants" : "",
          "manual image mode: Printful mockups are not imported; upload final Velmère images manually",
          variants.some((variant) => !variant.price?.amount) ? "no retail price on at least one variant" : "",
        ].filter(Boolean),
        tags: ["imported", "printful", slugify(product.name)],
      }),
    );
  }

  return drafts;
}
