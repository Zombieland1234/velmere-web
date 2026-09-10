import type { Metadata } from "next";
import ShopPageClient from "@/components/shop/ShopPageClient";
import { getPublicCatalogReadthrough } from "@/lib/products/public-catalog-readthrough";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "pl" ? "Sklep — Velmère" : locale === "de" ? "Shop — Velmère" : "Shop — Velmère";
  const description = locale === "pl"
    ? "Limitowane produkty Velmère, cięższe sylwetki i spokojna estetyka premium."
    : locale === "de"
      ? "Limitierte Velmère Produkte, schwere Silhouetten und ruhige Premium-Ästhetik."
      : "Limited Velmère pieces, heavier silhouettes, and a restrained premium aesthetic.";
  return buildVelmereMetadata({ locale, path: "/shop", title, description });
}

export default async function ShopPage() {
  const catalog = await getPublicCatalogReadthrough();
  return (
    <>
      <ShopPageClient products={catalog.products} catalogReceipt={catalog.receipt} />
    </>
  );
}

