import { readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { createDraft, detectProvider, normalizeCurrency, parseMoneyAmount } from "./common";
import { normalizeExternalProductUrl, parseAllowedExternalHosts } from "@/lib/security/browser-external-navigation";
import type { ProductImportDraft } from "@/lib/products/types";

const PRODUCT_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

function productImportAllowedHosts() {
  return parseAllowedExternalHosts(process.env.VELMERE_PRODUCT_IMPORT_ALLOWED_HOSTS ?? "");
}

function readMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta\\s+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ?? match?.[2] ?? "";
}

function readJsonLdProduct(html: string) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const json = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(json);
      const items = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      const product = items.find((item: { "@type"?: string | string[] }) => {
        const type = item?.["@type"];
        return Array.isArray(type) ? type.includes("Product") : type === "Product";
      });
      if (product) return product as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

export async function importProductFromUrl(url: string): Promise<ProductImportDraft> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return createDraft({
      title: "Invalid URL draft",
      sourceType: "url",
      sourceUrl: String(url ?? "").slice(0, 2048),
      warnings: ["invalid url", "external customer link disabled"],
    });
  }

  const warnings: string[] = [];
  const allowedHosts = productImportAllowedHosts();
  const safeExternalUrl = normalizeExternalProductUrl(parsed.toString(), allowedHosts);
  const provider = parsed.protocol === "https:" ? detectProvider(parsed.toString()) : "external";

  if (!safeExternalUrl) {
    return createDraft({
      title: parsed.hostname || "Blocked URL draft",
      provider,
      sourceUrl: parsed.toString().slice(0, 2048),
      sourceType: "url",
      warnings: [
        "public metadata fetch blocked: source URL is not an allowlisted HTTPS customer destination",
        "external customer link disabled",
      ],
    });
  }

  parsed = new URL(safeExternalUrl);

  try {
    const response = await safeEgressFetch(parsed.toString(), {
      headers: {
        "User-Agent": "VelmereProductImporter/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    }, {
      allowedHosts,
      allowSubdomains: false,
      allowedMethods: ["GET"],
      maxRedirects: 0,
      timeoutMs: 8_000,
      maxResponseBytes: PRODUCT_IMPORT_MAX_BYTES,
      operation: "admin_product_url_import",
    });

    if (response.status === 401 || response.status === 403) warnings.push("private page/login required");
    if (!response.ok) warnings.push(`public page returned ${response.status}`);

    const html = await readTextResponseBounded(response, PRODUCT_IMPORT_MAX_BYTES);
    const product = readJsonLdProduct(html);
    const offers = product?.offers && typeof product.offers === "object" ? (Array.isArray(product.offers) ? product.offers[0] : product.offers) : null;
    const title =
      String(product?.name ?? "") ||
      readMeta(html, "og:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      parsed.hostname;
    const description = String(product?.description ?? "") || readMeta(html, "og:description");
    const imageValue = product?.image;
    const image = Array.isArray(imageValue) ? String(imageValue[0] ?? "") : String(imageValue ?? readMeta(html, "og:image") ?? "");
    const price =
      parseMoneyAmount((offers as { price?: string | number } | null)?.price) ||
      parseMoneyAmount(readMeta(html, "product:price:amount"));
    const currency = normalizeCurrency(
      (offers as { priceCurrency?: string } | null)?.priceCurrency || readMeta(html, "product:price:currency"),
    );

    if (!product) warnings.push("json-ld product metadata missing");
    warnings.push("manual image mode: public page images are ignored; upload final Velmère product images manually");

    return createDraft({
      title,
      description,
      image,
      imageImportPolicy: "manual_only",
      priceAmount: price,
      currency,
      provider,
      externalUrl: safeExternalUrl,
      sourceUrl: safeExternalUrl,
      sourceType: "url",
      warnings,
    });
  } catch {
    return createDraft({
      title: parsed.hostname,
      provider,
      externalUrl: safeExternalUrl,
      sourceUrl: safeExternalUrl,
      sourceType: "url",
      warnings: [...warnings, "public metadata fetch failed"],
    });
  }
}
