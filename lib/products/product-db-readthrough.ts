import { getSupabasePublicClient, hasSupabaseConfig } from "@/lib/db/supabase";
import type { Product, ProductImage, ProductStatus, ProductVariant, SupportedCurrency } from "./types";
import { normalizeCustomerProductImageUrl } from "./product-image-boundary";

export type ProductDbReadthroughMode = "disabled" | "not_configured" | "supabase" | "supabase_empty" | "supabase_error";

export type ProductDbReadthroughReceipt = {
  schemaVersion: "velmere.product.db-readthrough.v1";
  generatedAt: string;
  mode: ProductDbReadthroughMode;
  enabled: boolean;
  durableStorageReady: boolean;
  productCount: number;
  variantCount: number;
  sourceTable: string;
  warnings: string[];
  customerBoundary: string;
};

type DbProductRow = {
  id: string;
  slug: string;
  provider?: string | null;
  provider_product_id?: string | null;
  status?: string | null;
  fulfilment_mode?: string | null;
  title?: unknown;
  description?: unknown;
  short_description?: unknown;
  truth?: unknown;
  price_amount?: number | null;
  price_currency?: string | null;
  images?: unknown;
  tags?: string[] | null;
  collection?: string | null;
  is_vlm_locked?: boolean | null;
  imported_at?: string | null;
};

type DbVariantRow = {
  id: string;
  product_id: string;
  title?: string | null;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  provider_variant_id?: string | null;
  provider_status?: string | null;
  stock_quantity?: number | null;
  price_amount?: number | null;
  price_currency?: string | null;
  available?: boolean | null;
};

function localized(value: unknown, fallback: string) {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    pl: typeof object.pl === "string" ? object.pl : fallback,
    en: typeof object.en === "string" ? object.en : fallback,
    de: typeof object.de === "string" ? object.de : fallback,
  };
}

function normalizeStatus(value: unknown): ProductStatus {
  return value === "draft" || value === "coming_soon" || value === "active" || value === "sold_out" || value === "archived" || value === "vlm_locked"
    ? value
    : "draft";
}

function normalizeCurrency(value: unknown): SupportedCurrency {
  return value === "EUR" ? "EUR" : "EUR";
}

function normalizeImages(value: unknown, fallbackTitle: string): ProductImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => entry && typeof entry === "object" ? entry as Record<string, unknown> : null)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry.url === "string"))
    .reduce<ProductImage[]>((images, entry) => {
      const url = normalizeCustomerProductImageUrl(entry.url);
      if (!url) return images;
      const width = typeof entry.width === "number" && Number.isSafeInteger(entry.width) && entry.width > 0 && entry.width <= 8192 ? entry.width : undefined;
      const height = typeof entry.height === "number" && Number.isSafeInteger(entry.height) && entry.height > 0 && entry.height <= 8192 ? entry.height : undefined;
      images.push({
        url,
        alt: localized(entry.alt, fallbackTitle),
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
      });
      return images;
    }, []);
}

function mapVariant(row: DbVariantRow, product: DbProductRow): ProductVariant {
  const amount = row.price_amount ?? product.price_amount ?? 0;
  return {
    id: row.id,
    title: row.title ?? row.size ?? row.sku ?? row.id,
    size: row.size ?? undefined,
    color: row.color ?? undefined,
    sku: row.sku ?? undefined,
    providerVariantId: row.provider_variant_id ?? undefined,
    providerStatus: row.provider_status === "synced" || row.provider_status === "unsynced" || row.provider_status === "unknown" ? row.provider_status : "unknown",
    stockQuantity: typeof row.stock_quantity === "number" ? row.stock_quantity : undefined,
    price: { amount, currency: normalizeCurrency(row.price_currency ?? product.price_currency) },
    available: typeof row.available === "boolean" ? row.available : undefined,
  };
}

function mapProduct(row: DbProductRow, variants: DbVariantRow[]): Product {
  const title = localized(row.title, row.slug);
  const mappedVariants = variants.map((variant) => mapVariant(variant, row));
  const providerVariantIds = Object.fromEntries(mappedVariants.map((variant) => [variant.id, variant.providerVariantId]).filter(([, value]) => Boolean(value))) as Record<string, string>;
  return {
    id: row.id,
    slug: row.slug,
    provider: row.provider === "printful" || row.provider === "tapstitch" || row.provider === "external" ? row.provider : "manual",
    providerProductId: row.provider_product_id ?? undefined,
    providerVariantIds,
    status: normalizeStatus(row.status),
    fulfilmentMode: row.fulfilment_mode === "external_link" || row.fulfilment_mode === "manual" || row.fulfilment_mode === "automatic" ? row.fulfilment_mode : "disabled",
    title,
    description: localized(row.description, title.en),
    shortDescription: localized(row.short_description, title.en),
    truth: row.truth && typeof row.truth === "object" ? row.truth as Product["truth"] : undefined,
    price: { amount: row.price_amount ?? 0, currency: normalizeCurrency(row.price_currency) },
    images: normalizeImages(row.images, title.en),
    variants: mappedVariants,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    collection: row.collection ?? undefined,
    isVlmLocked: Boolean(row.is_vlm_locked),
    importSource: {
      type: row.provider === "printful" ? "printful" : "csv",
      importedAt: row.imported_at ?? new Date(0).toISOString(),
      warnings: ["db-readthrough:customer-safe"],
    },
  };
}

export async function readProductsFromProductionDb(): Promise<{ products: Product[]; receipt: ProductDbReadthroughReceipt }> {
  const generatedAt = new Date().toISOString();
  const enabled = process.env.VELMERE_PRODUCTS_DB_READ_ENABLED === "1";
  const base = {
    schemaVersion: "velmere.product.db-readthrough.v1" as const,
    generatedAt,
    enabled,
    sourceTable: "velmere_products + velmere_product_variants",
    customerBoundary: "DB read-through exposes only customer-safe catalog fields. It never returns raw provider payloads, operator notes, customer PII or secrets.",
  };

  if (!enabled) {
    return { products: [], receipt: { ...base, mode: "disabled", durableStorageReady: false, productCount: 0, variantCount: 0, warnings: ["db_readthrough_disabled_by_env"] } };
  }
  if (!hasSupabaseConfig()) {
    return { products: [], receipt: { ...base, mode: "not_configured", durableStorageReady: false, productCount: 0, variantCount: 0, warnings: ["missing_supabase_config"] } };
  }

  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return { products: [], receipt: { ...base, mode: "not_configured", durableStorageReady: false, productCount: 0, variantCount: 0, warnings: ["supabase_client_unavailable"] } };
  }

  try {
    const productsRes = await supabase
      .from("velmere_products")
      .select("id,slug,provider,provider_product_id,status,fulfilment_mode,title,description,short_description,truth,price_amount,price_currency,images,tags,collection,is_vlm_locked,imported_at")
      .in("status", ["active", "coming_soon", "sold_out"])
      .order("updated_at", { ascending: false });
    if (productsRes.error) throw productsRes.error;
    const productRows = (productsRes.data ?? []) as DbProductRow[];
    if (productRows.length === 0) {
      return { products: [], receipt: { ...base, mode: "supabase_empty", durableStorageReady: true, productCount: 0, variantCount: 0, warnings: ["db_catalog_empty_fallback_static"] } };
    }

    const ids = productRows.map((product) => product.id);
    const variantsRes = await supabase
      .from("velmere_product_variants")
      .select("id,product_id,title,size,color,sku,provider_variant_id,provider_status,stock_quantity,price_amount,price_currency,available")
      .in("product_id", ids);
    if (variantsRes.error) throw variantsRes.error;
    const variantRows = (variantsRes.data ?? []) as DbVariantRow[];
    const byProduct = new Map<string, DbVariantRow[]>();
    for (const variant of variantRows) byProduct.set(variant.product_id, [...(byProduct.get(variant.product_id) ?? []), variant]);

    return {
      products: productRows.map((product) => mapProduct(product, byProduct.get(product.id) ?? [])),
      receipt: { ...base, mode: "supabase", durableStorageReady: true, productCount: productRows.length, variantCount: variantRows.length, warnings: [] },
    };
  } catch (error) {
    return {
      products: [],
      receipt: {
        ...base,
        mode: "supabase_error",
        durableStorageReady: false,
        productCount: 0,
        variantCount: 0,
        warnings: [error instanceof Error ? error.message.slice(0, 180) : "unknown_db_readthrough_error"],
      },
    };
  }
}
