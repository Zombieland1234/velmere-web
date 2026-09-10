import { readDurableFileBounded, writeDurableFileAtomic } from "@/lib/security/durable-file-boundary";
import path from "node:path";
import type { Product } from "@/lib/products/types";
import { normalizeExternalProductUrl, parseAllowedExternalHosts } from "@/lib/security/browser-external-navigation";

export type LocalProductStoreReceipt = {
  schemaVersion: "velmere.local-product-store.v1";
  filePath: string;
  productCount: number;
  writtenCount?: number;
  readAt?: string;
  writtenAt?: string;
  warnings: string[];
};

type LocalProductStoreFile = {
  schemaVersion: "velmere.local-products.v1";
  updatedAt: string;
  products: Product[];
};

const LOCAL_PRODUCTS_DIR = path.join(process.cwd(), "data");
const DEFAULT_FILE_NAME = "velmere-local-products.json";
const SAFE_LOCAL_PRODUCTS_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/;
const MAX_LOCAL_PRODUCTS_BYTES = 8 * 1024 * 1024;
const MAX_LOCAL_PRODUCT_COUNT = 5_000;

export class LocalProductStoreError extends Error {
  constructor(
    public readonly code: "corrupt" | "oversized" | "invalid_schema" | "capacity" | "io",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LocalProductStoreError";
  }
}

let localProductWriteTail: Promise<void> = Promise.resolve();

function withLocalProductWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = localProductWriteTail.then(operation, operation);
  localProductWriteTail = run.then(() => undefined, () => undefined);
  return run;
}

export function resolveLocalProductsPath(fileName = process.env.VELMERE_LOCAL_PRODUCTS_FILE) {
  const candidate = fileName?.trim() || DEFAULT_FILE_NAME;
  if (!SAFE_LOCAL_PRODUCTS_FILE.test(candidate) || path.basename(candidate) !== candidate) {
    throw new Error("VELMERE_LOCAL_PRODUCTS_FILE must be a safe JSON file name inside data/.");
  }
  return path.join(LOCAL_PRODUCTS_DIR, candidate);
}

function getLocalProductsPath() {
  return resolveLocalProductsPath();
}

function safeText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function detectGenderTags(product: Product) {
  const text = [
    product.title.pl,
    product.title.en,
    product.title.de,
    product.description.pl,
    product.description.en,
    product.description.de,
    product.slug,
    product.collection,
    ...product.tags,
  ].map(safeText).join(" ");

  const hasWomen = /\b(women|woman|female|damen|damsk|kobiet)\b/.test(text);
  const hasMen = /\b(men|man|male|herren|mesk|męsk|mezczy|mężczy)\b/.test(text);
  const hasUnisex = /\b(unisex|uni-sex|neutral)\b/.test(text) || (!hasWomen && !hasMen);

  if (hasUnisex) return ["unisex", "men", "women", "gender:unisex"];
  if (hasWomen) return ["women", "gender:women"];
  if (hasMen) return ["men", "gender:men"];
  return ["unisex", "men", "women", "gender:unisex"];
}

function detectGarmentTags(product: Product) {
  const text = [
    product.title.pl,
    product.title.en,
    product.title.de,
    product.slug,
    ...product.tags,
  ].map(safeText).join(" ");

  const tags: string[] = [];
  if (/\b(hoodie|bluza|sweatshirt|kapuzen)\b/.test(text)) tags.push("hoodie", "tops", "outerwear");
  if (/\b(t-?shirt|tee|koszul|shirt)\b/.test(text)) tags.push("tshirt", "tee", "tops");
  if (/\b(polo)\b/.test(text)) tags.push("polo", "tops");
  if (/\b(cap|czapk|hat|kappe)\b/.test(text)) tags.push("cap", "accessory");
  if (/\b(pants|trouser|spodnie|hose|bottom)\b/.test(text)) tags.push("pants", "bottoms");
  if (/\b(jacket|kurtk|jacke|coat)\b/.test(text)) tags.push("jacket", "outerwear");
  return tags;
}

function localProductIdentityKey(product: Product) {
  if (product.providerProductId) return `${product.provider}:${product.providerProductId}`;
  if (product.slug) return `slug:${product.slug}`;
  return `id:${product.id}`;
}

function canonicalLocalProductId(product: Product) {
  if (product.providerProductId) return `local_${product.provider}_${product.providerProductId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (product.slug) return `local_${product.slug}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return product.id;
}

export function normalizeLocalProductForStore(product: Product): Product {
  const externalAllowedHosts = parseAllowedExternalHosts(process.env.VELMERE_PRODUCT_IMPORT_ALLOWED_HOSTS ?? "");
  const safeExternalUrl = product.fulfilmentMode === "external_link"
    ? normalizeExternalProductUrl(product.externalUrl, externalAllowedHosts)
    : null;
  const tags = Array.from(new Set([
    ...product.tags,
    "local-admin",
    "manual-media",
    ...detectGenderTags(product),
    ...detectGarmentTags(product),
  ].filter(Boolean)));

  return {
    ...product,
    id: canonicalLocalProductId(product),
    status: product.status === "active" ? "active" : "coming_soon",
    fulfilmentMode: safeExternalUrl
      ? "external_link"
      : product.fulfilmentMode === "automatic"
        ? "automatic"
        : "manual",
    externalUrl: safeExternalUrl ?? undefined,
    tags,
    collection: product.collection || (tags.includes("unisex") ? "unisex" : tags.includes("women") ? "women" : tags.includes("men") ? "men" : "shop"),
    importSource: {
      ...(product.importSource ?? { type: "csv" as const, importedAt: new Date().toISOString() }),
      warnings: Array.from(new Set([
        ...(product.importSource?.warnings ?? []),
        "local-admin-preview: product persisted from admin draft for storefront preview",
      ])),
    },
  };
}

function emptyStore(): LocalProductStoreFile {
  return { schemaVersion: "velmere.local-products.v1", updatedAt: new Date().toISOString(), products: [] };
}

function isNodeError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

function parseStoreFile(raw: string, filePath: string): LocalProductStoreFile {
  let parsed: Partial<LocalProductStoreFile>;
  try {
    parsed = JSON.parse(raw) as Partial<LocalProductStoreFile>;
  } catch (error) {
    throw new LocalProductStoreError("corrupt", `Local product store is not valid JSON: ${filePath}`, { cause: error });
  }
  if (parsed.schemaVersion !== "velmere.local-products.v1" || !Array.isArray(parsed.products)) {
    throw new LocalProductStoreError("invalid_schema", `Local product store has an invalid schema: ${filePath}`);
  }
  if (parsed.products.length > MAX_LOCAL_PRODUCT_COUNT) {
    throw new LocalProductStoreError("capacity", `Local product store exceeds ${MAX_LOCAL_PRODUCT_COUNT} products.`);
  }
  const products = parsed.products.filter(
    (item): item is Product => Boolean(item && typeof item === "object" && typeof (item as Product).id === "string"),
  );
  if (products.length !== parsed.products.length) {
    throw new LocalProductStoreError("invalid_schema", `Local product store contains malformed product rows: ${filePath}`);
  }
  return {
    schemaVersion: "velmere.local-products.v1",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    products,
  };
}

async function readStoreFile(): Promise<LocalProductStoreFile> {
  const filePath = getLocalProductsPath();
  try {
    const raw = await readDurableFileBounded({
      rootDirectory: LOCAL_PRODUCTS_DIR,
      fileName: path.basename(filePath),
      maximumBytes: MAX_LOCAL_PRODUCTS_BYTES,
      label: "local-product-store",
    });
    return parseStoreFile(raw.toString("utf8"), filePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return emptyStore();
    if (error instanceof LocalProductStoreError) throw error;
    throw new LocalProductStoreError("io", `Unable to read local product store: ${filePath}`, { cause: error });
  }
}

async function writeStoreFileAtomic(filePath: string, store: LocalProductStoreFile) {
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  if (Buffer.byteLength(payload, "utf8") > MAX_LOCAL_PRODUCTS_BYTES) {
    throw new LocalProductStoreError("oversized", `Serialized local product store exceeds ${MAX_LOCAL_PRODUCTS_BYTES} bytes.`);
  }
  try {
    await writeDurableFileAtomic({
      rootDirectory: LOCAL_PRODUCTS_DIR,
      fileName: path.basename(filePath),
      maximumBytes: MAX_LOCAL_PRODUCTS_BYTES,
      label: "local-product-store",
    }, payload);
  } catch (error) {
    if (error instanceof LocalProductStoreError) throw error;
    throw new LocalProductStoreError("io", `Unable to atomically write local product store: ${filePath}`, { cause: error });
  }
}

export async function readLocalPublishedProducts(): Promise<{ products: Product[]; receipt: LocalProductStoreReceipt }> {
  const filePath = getLocalProductsPath();
  const store = await readStoreFile();
  const products = store.products.map(normalizeLocalProductForStore);
  return {
    products,
    receipt: {
      schemaVersion: "velmere.local-product-store.v1",
      filePath,
      productCount: products.length,
      readAt: new Date().toISOString(),
      warnings: [],
    },
  };
}

export async function upsertLocalPublishedProducts(products: Product[]): Promise<{ products: Product[]; receipt: LocalProductStoreReceipt }> {
  if (products.length > MAX_LOCAL_PRODUCT_COUNT) {
    throw new LocalProductStoreError("capacity", `A single upsert cannot exceed ${MAX_LOCAL_PRODUCT_COUNT} products.`);
  }
  return withLocalProductWriteLock(async () => {
    const filePath = getLocalProductsPath();
    const current = await readStoreFile();
    const normalized = products.map(normalizeLocalProductForStore);
    const byIdentity = new Map<string, Product>();
    for (const product of current.products) {
      const normalizedCurrent = normalizeLocalProductForStore(product);
      byIdentity.set(localProductIdentityKey(normalizedCurrent), normalizedCurrent);
    }
    for (const product of normalized) {
      byIdentity.set(localProductIdentityKey(product), product);
    }
    const nextProducts = Array.from(byIdentity.values());
    if (nextProducts.length > MAX_LOCAL_PRODUCT_COUNT) {
      throw new LocalProductStoreError("capacity", `Local product store would exceed ${MAX_LOCAL_PRODUCT_COUNT} products.`);
    }
    const writtenAt = new Date().toISOString();
    await writeStoreFileAtomic(filePath, {
      schemaVersion: "velmere.local-products.v1",
      updatedAt: writtenAt,
      products: nextProducts,
    });
    return {
      products: nextProducts,
      receipt: {
        schemaVersion: "velmere.local-product-store.v1",
        filePath,
        productCount: nextProducts.length,
        writtenCount: normalized.length,
        writtenAt,
        warnings: [],
      },
    };
  });
}
