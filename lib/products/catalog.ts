import { PRODUCTS } from "./catalog.generated";
import type { LocalizedString, Product, SupportedCurrency } from "./types";

export function getProducts() {
  return PRODUCTS;
}

export function getVisibleProducts() {
  return getVisibleProductsFromCatalog(PRODUCTS);
}

export function getVisibleProductsFromCatalog(products: Product[]) {
  return products.filter((product) => product.status !== "draft" && product.status !== "archived" && product.status !== "vlm_locked");
}

export function getProductBySlugOrId(slugOrId: string) {
  return getProductBySlugOrIdFromCatalog(PRODUCTS, slugOrId);
}

export function getProductBySlugOrIdFromCatalog(products: Product[], slugOrId: string) {
  return products.find((product) => product.slug === slugOrId || product.id === slugOrId) ?? null;
}

export function getLocalizedString(value: LocalizedString, locale: string) {
  if (locale === "en" || locale === "de" || locale === "pl") return value[locale];
  return value.pl;
}

export function formatMoney(
  price: { amount: number; currency: SupportedCurrency },
  locale: string,
) {
  return new Intl.NumberFormat(locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price.amount / 100);
}

export function hasCompleteAutomaticFulfilment(product: Product) {
  if (product.fulfilmentMode !== "automatic") return true;
  if (!product.providerVariantIds) return false;
  return product.variants.every((variant) => Boolean(variant.providerVariantId || product.providerVariantIds?.[variant.id]));
}

export function isProductCustomerPurchasable(product: Product) {
  return (
    product.status === "active" &&
    product.price.amount > 0 &&
    product.images.length > 0 &&
    product.variants.length > 0 &&
    hasCompleteAutomaticFulfilment(product)
  );
}
