import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { PRODUCTS } from "./catalog.generated";
import { isProductCustomerPurchasable } from "./catalog";
import { listProductPublishStateMemoryRecords, type ProductPublicationStateRecord } from "./product-publish-state-storage";
import { readProductsFromProductionDb } from "./product-db-readthrough";
import { LocalProductStoreError, readLocalPublishedProducts } from "./local-product-store";
import type { Product, ProductStatus } from "./types";

export type PublicCatalogReadthroughMode = "static" | "local_json" | "memory" | "upstash" | "upstash_fallback_static" | "supabase" | "supabase_empty_fallback_static" | "supabase_error_fallback_static" | "disabled";

export type PublicCatalogReadthroughReceipt = {
  schemaVersion: "velmere.product.public-catalog-readthrough.v1";
  generatedAt: string;
  mode: PublicCatalogReadthroughMode;
  durableStorageReady: boolean;
  stateKey: string | null;
  staticProductCount: number;
  visibleProductCount: number;
  overrideCount: number;
  appliedOverrideCount: number;
  purchasableProductCount: number;
  hiddenByStateCount: number;
  lastOverrideAt: string | null;
  warnings: string[];
  customerBoundary: string;
};

export type PublicCatalogReadthroughResult = {
  products: Product[];
  receipt: PublicCatalogReadthroughReceipt;
};

type UpstashResult<T> = { result?: T; error?: string };

const READ_TIMEOUT_MS = 1_200;
const HIDDEN_STATUSES: ProductStatus[] = ["draft", "archived", "vlm_locked"];

function normalizeKey(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

function getStateKey() {
  return normalizeKey(process.env.VELMERE_PRODUCT_STATUS_UPSTASH_KEY, "velmere:products:publication-state");
}

function statusFromState(record: ProductPublicationStateRecord): ProductStatus {
  return record.finalStatus;
}

function shouldUseDurableRead() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.VELMERE_PRODUCT_STATUS_PUBLIC_READ_DISABLED !== "1");
}

function readVisibility(status: ProductStatus, record?: ProductPublicationStateRecord | null) {
  if (record?.customerVisibility === "hidden") return "hidden";
  if (status === "active") return "purchasable";
  if (status === "coming_soon") return "preview";
  return "hidden";
}

function parseUpstashHash(payload: unknown): ProductPublicationStateRecord[] {
  if (!payload) return [];
  const raw = (payload as UpstashResult<unknown>).result ?? payload;
  const values: unknown[] = [];

  if (Array.isArray(raw)) {
    for (let index = 1; index < raw.length; index += 2) values.push(raw[index]);
  } else if (raw && typeof raw === "object") {
    values.push(...Object.values(raw as Record<string, unknown>));
  }

  return values
    .map((value) => {
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed as ProductPublicationStateRecord).schemaVersion === "velmere.product.publication-state.v1" &&
          typeof (parsed as ProductPublicationStateRecord).productId === "string"
        ) {
          return parsed as ProductPublicationStateRecord;
        }
      } catch {
        return null;
      }
      return null;
    })
    .filter((record): record is ProductPublicationStateRecord => Boolean(record));
}

async function readDurablePublicationState(): Promise<{ records: ProductPublicationStateRecord[]; warning?: string }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { records: [] };

  try {
    const response = await brokeredConfiguredOriginFetch(
      `${url.replace(/\/$/, "")}/hgetall/${encodeURIComponent(getStateKey())}`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      },
      {
        configuredProfile: "upstash_rest",
        environment: { UPSTASH_REDIS_REST_URL: url },
        operation: "public_catalog_readthrough",
        timeoutMs: READ_TIMEOUT_MS,
        maxRequestBytes: 0,
        maxResponseBytes: 4_194_304,
      },
    );
    if (!response.ok) return { records: [], warning: `upstash_public_catalog_read_http_${response.status}` };
    return {
      records: parseUpstashHash(
        await readJsonResponseBounded<unknown>(response, 4_194_304).catch(() => null),
      ),
    };
  } catch (error) {
    return { records: [], warning: error instanceof Error ? error.message.slice(0, 160) : "upstash_public_catalog_unknown_error" };
  }
}

function newestRecord(records: ProductPublicationStateRecord[]) {
  return [...records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

function buildRecordIndex(records: ProductPublicationStateRecord[]) {
  const index = new Map<string, ProductPublicationStateRecord>();
  for (const record of records) {
    const keys = [record.productId, record.slug, record.draftId].filter(Boolean);
    for (const key of keys) {
      const existing = index.get(key);
      if (!existing || Date.parse(record.updatedAt) >= Date.parse(existing.updatedAt)) index.set(key, record);
    }
  }
  return index;
}

function applyPublicationState(product: Product, record?: ProductPublicationStateRecord | null): Product {
  if (!record) return { ...product };
  const finalStatus = statusFromState(record);
  return {
    ...product,
    status: finalStatus,
    importSource: {
      ...(product.importSource ?? { type: "csv" as const, importedAt: record.updatedAt }),
      warnings: [
        ...(product.importSource?.warnings ?? []),
        `publication-state:${record.customerVisibility}:${record.batchTraceId}`,
      ],
    },
  };
}

function mergeLocalProducts(staticProducts: Product[], localProducts: Product[]) {
  const byId = new Map<string, Product>();
  for (const product of staticProducts) byId.set(product.id, product);
  for (const product of localProducts) byId.set(product.id, product);
  return Array.from(byId.values());
}

function hideUnsafeCustomerProducts(product: Product, record?: ProductPublicationStateRecord | null) {
  const visibility = readVisibility(product.status, record);
  if (visibility === "hidden") return false;
  if (HIDDEN_STATUSES.includes(product.status)) return false;
  if (product.isVlmLocked) return false;
  return true;
}

export async function getPublicCatalogReadthrough(): Promise<PublicCatalogReadthroughResult> {
  const warnings: string[] = [];
  let mode: PublicCatalogReadthroughMode = "static";
  let stateRecords: ProductPublicationStateRecord[] = [];
  let baseProducts = PRODUCTS;

  try {
    const localRead = await readLocalPublishedProducts();
    if (localRead.products.length > 0) {
      baseProducts = mergeLocalProducts(baseProducts, localRead.products);
      mode = "local_json";
      warnings.push(`local-products:${localRead.products.length}`);
    }
  } catch (error) {
    const code = error instanceof LocalProductStoreError ? error.code : "unknown";
    warnings.push(`local-products-unavailable:${code}`);
  }

  if (process.env.VELMERE_PRODUCTS_DB_READ_ENABLED === "1") {
    const dbRead = await readProductsFromProductionDb();
    warnings.push(...dbRead.receipt.warnings.map((warning) => `db:${warning}`));
    if (dbRead.products.length > 0 && dbRead.receipt.mode === "supabase") {
      baseProducts = dbRead.products;
      mode = "supabase";
    } else if (dbRead.receipt.mode === "supabase_empty") {
      mode = "supabase_empty_fallback_static";
    } else if (dbRead.receipt.mode === "supabase_error") {
      mode = "supabase_error_fallback_static";
    }
  }

  if (process.env.VELMERE_PRODUCT_STATUS_PUBLIC_READ_DISABLED === "1") {
    mode = "disabled";
    warnings.push("public_catalog_read_disabled_by_env");
  } else if (mode === "supabase") {
    // Product rows already came from durable Postgres/Supabase; still apply status overrides below if present.
  } else if (shouldUseDurableRead()) {
    const durable = await readDurablePublicationState();
    stateRecords = durable.records;
    mode = "upstash";
    if (durable.warning) {
      warnings.push(durable.warning);
      mode = "upstash_fallback_static";
    }
  } else {
    const memoryRecords = listProductPublishStateMemoryRecords(200);
    if (memoryRecords.length > 0) {
      stateRecords = memoryRecords;
      mode = "memory";
    }
  }

  const index = buildRecordIndex(stateRecords);
  const merged = baseProducts.map((product) => applyPublicationState(product, index.get(product.id) ?? index.get(product.slug)));
  const publicProducts = merged.filter((product) => hideUnsafeCustomerProducts(product, index.get(product.id) ?? index.get(product.slug)));
  const visibleProducts = getVisibleProductsFromList(publicProducts);
  const appliedOverrideCount = baseProducts.filter((product) => Boolean(index.get(product.id) ?? index.get(product.slug))).length;
  const latest = newestRecord(stateRecords);

  return {
    products: visibleProducts,
    receipt: {
      schemaVersion: "velmere.product.public-catalog-readthrough.v1",
      generatedAt: new Date().toISOString(),
      mode,
      durableStorageReady: (mode === "upstash" || mode === "supabase") && warnings.length === 0,
      stateKey: shouldUseDurableRead() ? getStateKey() : null,
      staticProductCount: baseProducts.length,
      visibleProductCount: visibleProducts.length,
      overrideCount: stateRecords.length,
      appliedOverrideCount,
      purchasableProductCount: visibleProducts.filter(isProductCustomerPurchasable).length,
      hiddenByStateCount: merged.length - publicProducts.length,
      lastOverrideAt: latest?.updatedAt ?? null,
      warnings,
      customerBoundary:
        "Public catalog read-through applies only redacted publication status overrides. It never exposes operator notes, raw provider payloads, customer PII or storage secrets to the browser.",
    },
  };
}

export function getVisibleProductsFromList(products: Product[]) {
  return products.filter((product) => product.status !== "draft" && product.status !== "archived" && product.status !== "vlm_locked");
}

export async function getPublicVisibleProducts() {
  return (await getPublicCatalogReadthrough()).products;
}

export async function getPublicProductBySlugOrId(slugOrId: string) {
  const catalog = await getPublicCatalogReadthrough();
  return catalog.products.find((product) => product.slug === slugOrId || product.id === slugOrId) ?? null;
}
