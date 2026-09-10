import type { Metadata } from "next";
import ProductDetailClient from "@/components/shop/ProductDetailClient";
import { buildVelmereMetadata, absoluteUrl } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo/json-ld";
import { getLocalizedString, isProductCustomerPurchasable } from "@/lib/products/catalog";
import { getPublicCatalogReadthrough, getPublicProductBySlugOrId } from "@/lib/products/public-catalog-readthrough";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const product = await getPublicProductBySlugOrId(id);
  const title = product ? `${getLocalizedString(product.title, locale)} — Velmère` : "Product — Velmère";
  const description = product
    ? getLocalizedString(product.shortDescription, locale)
    : "Velmère product detail page.";
  return buildVelmereMetadata({ locale, path: `/shop/${id}`, title, description });
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const catalog = await getPublicCatalogReadthrough();
  const product = catalog.products.find((item) => item.slug === id || item.id === id) ?? null;
  const title = product ? getLocalizedString(product.title, locale) : "Velmère product";
  const description = product ? getLocalizedString(product.shortDescription, locale) : "Velmère product detail page.";
  const productUrl = absoluteUrl(`/${locale}/shop/${id}`);
  const inStock = product ? isProductCustomerPurchasable(product) : false;
  const truth = product?.truth;
  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: title,
        description,
        image: product.images.map((image) => image.url),
        sku: product.id,
        brand: { "@type": "Brand", name: "Velmère" },
        material: truth ? getLocalizedString(truth.composition, locale) : undefined,
        size: product.variants.map((variant) => variant.size ?? variant.title).join(", "),
        additionalProperty: truth
          ? [
              { "@type": "PropertyValue", name: "Fit", value: getLocalizedString(truth.fit, locale) },
              { "@type": "PropertyValue", name: "Care", value: truth.care.map((item) => getLocalizedString(item, locale)).join(" / ") },
              { "@type": "PropertyValue", name: "Launch note", value: truth.launchNote ? getLocalizedString(truth.launchNote, locale) : "Preview mode" },
            ]
          : undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: product.price.currency,
          price: (product.price.amount / 100).toFixed(2),
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          url: productUrl,
          itemCondition: "https://schema.org/NewCondition",
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingDestination: { "@type": "DefinedRegion", addressCountry: ["DE", "PL", "EU"] },
            deliveryTime: {
              "@type": "ShippingDeliveryTime",
              handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
              transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" },
            },
          },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: ["DE", "PL"],
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 14,
            returnMethod: "https://schema.org/ReturnByMail",
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {safeJsonLd(jsonLd)}
        </script>
      ) : null}
      <ProductDetailClient params={{ id }} product={product} catalogReceipt={catalog.receipt} />
    </>
  );
}

/* PASS2270 public surface trim markers: PASS316 public commerce trim */
