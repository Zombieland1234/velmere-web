import type {
  ShieldProFeedMode,
  ShieldProPublicDelivery,
  ShieldProPublicDeliveryField,
} from "@/lib/market-integrity/shield-pro-customer-truth";
import type { VlmCustomerDataState } from "@/lib/product/vlm-tiered-table-customer-contract";

export type ShieldProTableCustomerState = VlmCustomerDataState;

type FieldContract = {
  semanticClass: "reference" | "derived" | "historical";
  unit: "text" | "rank" | "url" | "price" | "percent" | "currency" | "price_series";
  currency: "USD" | null;
  maxAgeSeconds: number;
};

export const SHIELD_PRO_TABLE_FIELD_CONTRACTS = Object.freeze({
  "identity.market_id": { semanticClass: "reference", unit: "text", currency: null, maxAgeSeconds: 86_400 },
  "identity.symbol": { semanticClass: "reference", unit: "text", currency: null, maxAgeSeconds: 86_400 },
  "identity.name": { semanticClass: "reference", unit: "text", currency: null, maxAgeSeconds: 86_400 },
  "market.rank": { semanticClass: "derived", unit: "rank", currency: null, maxAgeSeconds: 300 },
  "market.image": { semanticClass: "reference", unit: "url", currency: null, maxAgeSeconds: 86_400 },
  "market.price": { semanticClass: "reference", unit: "price", currency: "USD", maxAgeSeconds: 180 },
  "market.change_1h": { semanticClass: "derived", unit: "percent", currency: null, maxAgeSeconds: 180 },
  "market.change_24h": { semanticClass: "derived", unit: "percent", currency: null, maxAgeSeconds: 180 },
  "market.change_7d": { semanticClass: "derived", unit: "percent", currency: null, maxAgeSeconds: 300 },
  "market.change_30d": { semanticClass: "derived", unit: "percent", currency: null, maxAgeSeconds: 300 },
  "market.market_cap": { semanticClass: "derived", unit: "currency", currency: "USD", maxAgeSeconds: 300 },
  "market.volume_24h": { semanticClass: "derived", unit: "currency", currency: "USD", maxAgeSeconds: 300 },
  "market.sparkline_7d": { semanticClass: "historical", unit: "price_series", currency: "USD", maxAgeSeconds: 300 },
} satisfies Record<string, FieldContract>);

export type ShieldProTableFieldId = keyof typeof SHIELD_PRO_TABLE_FIELD_CONTRACTS;

export type ShieldProTableProjectedField<T> = FieldContract & {
  fieldId: ShieldProTableFieldId;
  state: ShieldProTableCustomerState;
  value: T | null;
  sourceAsOf: string | null;
  receiptId: string | null;
};

export type ShieldProTableSourceRow = {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  image?: unknown;
  rank?: unknown;
  price?: unknown;
  priceChange1h?: unknown;
  priceChange24h?: unknown;
  priceChange7d?: unknown;
  priceChange30d?: unknown;
  marketCap?: unknown;
  volume24h?: unknown;
  sparkline7d?: unknown;
  result?: { dataQuality?: unknown } | null;
  delivery?: ShieldProPublicDelivery | null;
};

export type ShieldProTableCustomerProjection = {
  marketId: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  price: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  priceChange7d: number | null;
  priceChange30d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  sparkline7d: number[] | null;
  fields: {
    marketId: ShieldProTableProjectedField<string>;
    symbol: ShieldProTableProjectedField<string>;
    name: ShieldProTableProjectedField<string>;
    image: ShieldProTableProjectedField<string>;
    rank: ShieldProTableProjectedField<number>;
    price: ShieldProTableProjectedField<number>;
    priceChange1h: ShieldProTableProjectedField<number>;
    priceChange24h: ShieldProTableProjectedField<number>;
    priceChange7d: ShieldProTableProjectedField<number>;
    priceChange30d: ShieldProTableProjectedField<number>;
    marketCap: ShieldProTableProjectedField<number>;
    volume24h: ShieldProTableProjectedField<number>;
    sparkline7d: ShieldProTableProjectedField<number[]>;
  };
};

const SHA256_HEX = /^(?:sha256:)?[a-f0-9]{64}$/u;
const P4644_RECEIPT_ID = /^p4644_[a-f0-9]{24}$/u;
const SAFE_MARKET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SAFE_SYMBOL = /^[\p{L}\p{N}][\p{L}\p{N}._:+/-]{0,31}$/u;
const VENUE_SCOPE = "aggregated_multi_venue_reference";
const CURRENTNESS_CLASS = "provider_timestamped_reference";

function hasForbiddenTextCodePoint(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || (codePoint >= 0x202a && codePoint <= 0x202e)
      || (codePoint >= 0x2066 && codePoint <= 0x2069);
  });
}

function exactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function fieldReceiptValid(
  delivery: ShieldProPublicDelivery | null | undefined,
  field: ShieldProPublicDeliveryField | null | undefined,
  contract: FieldContract,
): field is ShieldProPublicDeliveryField & { sourceAsOf: string; receiptId: string } {
  return Boolean(
    delivery
    && typeof delivery.receiptDigest === "string"
    && SHA256_HEX.test(delivery.receiptDigest)
    && field
    && field.state === "verified"
    && typeof field.required === "boolean"
    && field.valueAvailable === true
    && exactIsoTimestamp(field.sourceAsOf)
    && typeof field.receiptId === "string"
    && P4644_RECEIPT_ID.test(field.receiptId)
    && Number.isSafeInteger(field.upstreamCount)
    && Number(field.upstreamCount) >= 1
    && Number.isSafeInteger(field.requiredUpstreamCount)
    && Number(field.requiredUpstreamCount) >= 1
    && Number(field.upstreamCount) >= Number(field.requiredUpstreamCount)
    && field.semanticClass === contract.semanticClass
    && field.unit === contract.unit
    && field.currency === contract.currency
    && field.venueScope === VENUE_SCOPE
    && field.executionEligible === false
    && field.currentnessClass === CURRENTNESS_CLASS
    && field.maxAgeSeconds === contract.maxAgeSeconds
    && field.liveClaimed === false
    && field.executableQuoteClaimed === false,
  );
}

function stateFor(mode: ShieldProFeedMode, deliveryState: unknown): ShieldProTableCustomerState {
  if (mode === "stale") return "STALE";
  if (mode === "partial") return "PARTIAL";
  return deliveryState === "verified" ? "READY" : "PARTIAL";
}

function withheldField<T>(fieldId: ShieldProTableFieldId): ShieldProTableProjectedField<T> {
  const contract = SHIELD_PRO_TABLE_FIELD_CONTRACTS[fieldId];
  return {
    fieldId,
    ...contract,
    state: "WITHHELD",
    value: null,
    sourceAsOf: null,
    receiptId: null,
  };
}

function projectField<T>(args: {
  row: ShieldProTableSourceRow;
  fieldId: ShieldProTableFieldId;
  value: unknown;
  mode: ShieldProFeedMode;
  normalize: (value: unknown) => T | null;
}): ShieldProTableProjectedField<T> {
  const contract = SHIELD_PRO_TABLE_FIELD_CONTRACTS[args.fieldId];
  const receipt = args.row.delivery?.fields?.[args.fieldId];
  const value = args.normalize(args.value);
  if (value === null) {
    return withheldField<T>(args.fieldId);
  }
  if (args.mode === "reference") {
    const rowObserved = (args.row as { observedAt?: unknown }).observedAt;
    const sourceAsOf = typeof rowObserved === "string" ? rowObserved : "2026-07-30T00:00:00.000Z";
    return {
      fieldId: args.fieldId,
      ...contract,
      state: "READY",
      value,
      sourceAsOf,
      receiptId: "p4644_reference_illustrative",
    };
  }
  if (!fieldReceiptValid(args.row.delivery, receipt, contract)) {
    return withheldField<T>(args.fieldId);
  }
  return {
    fieldId: args.fieldId,
    ...contract,
    state: stateFor(args.mode, args.row.delivery?.state),
    value,
    sourceAsOf: receipt.sourceAsOf,
    receiptId: receipt.receiptId,
  };
}

function marketIdValue(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || !SAFE_MARKET_ID.test(value)) return null;
  return value;
}

function symbolValue(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || value !== value.normalize("NFKC") || !SAFE_SYMBOL.test(value)) return null;
  return value;
}

function nameValue(value: unknown): string | null {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value !== value.normalize("NFKC")
    || value.length < 1
    || value.length > 160
    || hasForbiddenTextCodePoint(value)
  ) return null;
  return value;
}

function imageValue(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || value.length < 1 || value.length > 2_048 || hasForbiddenTextCodePoint(value)) return null;
  if (value.startsWith("/market-logos/") && !value.includes("..") && !value.includes("%")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function positiveNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function rankValue(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000 ? Number(value) : null;
}

function sparklineValue(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 512) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item) && item > 0)) return null;
  return [...value];
}

export function projectShieldProTableRow(
  row: ShieldProTableSourceRow,
  mode: ShieldProFeedMode,
): ShieldProTableCustomerProjection | null {
  if (mode === "loading" || mode === "error") return null;

  const fields = {
    marketId: projectField({ row, fieldId: "identity.market_id", value: row.id, mode, normalize: marketIdValue }),
    symbol: projectField({ row, fieldId: "identity.symbol", value: row.symbol, mode, normalize: symbolValue }),
    name: projectField({ row, fieldId: "identity.name", value: row.name, mode, normalize: nameValue }),
    image: projectField({ row, fieldId: "market.image", value: row.image, mode, normalize: imageValue }),
    rank: projectField({ row, fieldId: "market.rank", value: row.rank, mode, normalize: rankValue }),
    price: projectField({ row, fieldId: "market.price", value: row.price, mode, normalize: positiveNumber }),
    priceChange1h: projectField({ row, fieldId: "market.change_1h", value: row.priceChange1h, mode, normalize: finiteNumber }),
    priceChange24h: projectField({ row, fieldId: "market.change_24h", value: row.priceChange24h, mode, normalize: finiteNumber }),
    priceChange7d: projectField({ row, fieldId: "market.change_7d", value: row.priceChange7d, mode, normalize: finiteNumber }),
    priceChange30d: projectField({ row, fieldId: "market.change_30d", value: row.priceChange30d, mode, normalize: finiteNumber }),
    marketCap: projectField({ row, fieldId: "market.market_cap", value: row.marketCap, mode, normalize: nonNegativeNumber }),
    volume24h: projectField({ row, fieldId: "market.volume_24h", value: row.volume24h, mode, normalize: nonNegativeNumber }),
    sparkline7d: projectField({ row, fieldId: "market.sparkline_7d", value: row.sparkline7d, mode, normalize: sparklineValue }),
  };

  if (fields.marketId.value === null || fields.symbol.value === null || fields.name.value === null) return null;
  return {
    marketId: fields.marketId.value,
    symbol: fields.symbol.value,
    name: fields.name.value,
    image: fields.image.value,
    rank: fields.rank.value,
    price: fields.price.value,
    priceChange1h: fields.priceChange1h.value,
    priceChange24h: fields.priceChange24h.value,
    priceChange7d: fields.priceChange7d.value,
    priceChange30d: fields.priceChange30d.value,
    marketCap: fields.marketCap.value,
    volume24h: fields.volume24h.value,
    sparkline7d: fields.sparkline7d.value,
    fields,
  };
}
