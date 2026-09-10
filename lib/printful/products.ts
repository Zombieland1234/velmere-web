import { printfulRequest } from "./client";

export type PrintfulStoreProduct = {
  id: number;
  external_id?: string;
  name: string;
  variants?: number;
  synced?: number;
  thumbnail_url?: string;
};

export type PrintfulStoreProductDetail = {
  sync_product: PrintfulStoreProduct;
  sync_variants?: Array<{
    id: number;
    external_id?: string;
    name: string;
    synced?: boolean;
    retail_price?: string;
    currency?: string;
    sku?: string;
    files?: Array<{ preview_url?: string; thumbnail_url?: string }>;
  }>;
};

export async function getPrintfulStoreProducts() {
  const data = await printfulRequest<{ result: PrintfulStoreProduct[] }>("/store/products");
  return data.result ?? [];
}

export async function getPrintfulStoreProduct(productId: number | string) {
  const data = await printfulRequest<{ result: PrintfulStoreProductDetail }>(`/store/products/${productId}`);
  return data.result;
}
