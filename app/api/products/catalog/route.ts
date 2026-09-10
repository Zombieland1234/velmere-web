import { NextResponse } from "next/server";
import { getPublicCatalogReadthrough } from "@/lib/products/public-catalog-readthrough";
import { getLocalizedString, isProductCustomerPurchasable } from "@/lib/products/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const catalog = await getPublicCatalogReadthrough();

  return NextResponse.json({
    schemaVersion: "velmere.public-products-catalog.v1",
    generatedAt: catalog.receipt.generatedAt,
    receipt: catalog.receipt,
    products: catalog.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      status: product.status,
      customerVisibility: isProductCustomerPurchasable(product) ? "purchasable" : "preview",
      title: getLocalizedString(product.title, locale),
      price: product.price,
      image: product.images[0]?.url ?? null,
      variantCount: product.variants.length,
      purchasable: isProductCustomerPurchasable(product),
    })),
    customerBoundary:
      "This public endpoint exposes customer-safe catalog fields only. It does not expose operator notes, receipt checksums, raw provider payloads, auth data or secrets.",
  });
}
