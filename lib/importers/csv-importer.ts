import { createDraft, normalizeCurrency, parseMoneyAmount, slugify } from "./common";
import type { ProductImportDraft, ProductVariant } from "@/lib/products/types";

function readOptionalNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readAvailability(entry: Record<string, string>) {
  const raw = (entry.available || entry.availability || entry["variant available"] || entry["stock status"] || entry.status || "").toLowerCase();
  if (["true", "yes", "y", "1", "available", "in stock", "synced", "active"].includes(raw)) return true;
  if (["false", "no", "n", "0", "unavailable", "out of stock", "unsynced", "inactive"].includes(raw)) return false;
  return undefined;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function importProductsFromProductCsv(csv: string): ProductImportDraft[] {
  const [headers = [], ...rows] = parseCsvRows(csv);
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  type CsvEntry = Record<string, string>;
  const entries: CsvEntry[] = rows.map((row) =>
    Object.fromEntries(normalizedHeaders.map((header, index) => [header, row[index]?.trim() ?? ""])),
  );
  const grouped = new Map<string, CsvEntry[]>();

  for (const entry of entries) {
    const handle = entry.handle || slugify(entry.title || "imported-product");
    grouped.set(handle, [...(grouped.get(handle) ?? []), entry]);
  }

  return Array.from(grouped.entries()).map(([handle, group]) => {
    const first = group[0] ?? {};
    const variants: ProductVariant[] = group
      .filter((entry) => entry["variant sku"] || entry["option1 value"] || entry["variant price"])
      .map((entry, index) => {
        const size = entry["option1 value"] || entry["option2 value"] || `Variant ${index + 1}`;
        const available = readAvailability(entry);
        const stockQuantity = readOptionalNumber(entry.stock || entry.inventory || entry["variant inventory qty"] || entry["variant inventory"]);
        const providerVariantId = entry["provider variant id"] || entry["variant id"] || entry["sync variant id"] || undefined;
        return {
          id: `${handle}-${slugify(size) || index + 1}`,
          title: size,
          size,
          sku: entry["variant sku"] || entry.sku || undefined,
          providerVariantId,
          providerStatus: available === undefined ? undefined : available ? "synced" : "unsynced",
          stockQuantity,
          price: {
            amount: parseMoneyAmount(entry["variant price"] || first["variant price"]),
            currency: normalizeCurrency(first.currency || entry.currency),
          },
          available: available ?? (typeof stockQuantity === "number" ? stockQuantity > 0 : false),
        };
      });

    return createDraft({
      title: first.title || handle,
      description: first["body (html)"] || first.body || "",
      image: first["image src"] || first.image || "",
      imageImportPolicy: "manual_only",
      priceAmount: parseMoneyAmount(first["variant price"]),
      currency: normalizeCurrency(first.currency),
      provider: "external",
      providerProductId: handle,
      variants,
      sourceType: "csv",
      warnings: ["imported from CSV; review every field before publishing", "manual image mode: CSV image URLs are ignored; upload final Velmère product images manually"],
      tags: ["imported", "csv"],
    });
  });
}
