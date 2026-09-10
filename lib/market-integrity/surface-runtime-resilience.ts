import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";

export type Pass471CatalogAssetClass =
  | "crypto"
  | "exchange_token"
  | "stock"
  | "fx"
  | "real_estate"
  | "etf"
  | "commodity";

export type Pass471CatalogRow = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  assetClass: Pass471CatalogAssetClass;
  priceLane: string;
  proofOrDisclosureLane: string;
  riskPressure: number;
  adapterState:
    | "live_first"
    | "provider_required"
    | "slow_macro"
    | "historical_context"
    | "operator_review";
};

export type Pass471ProviderSearchRow = {
  symbol: string;
  name: string;
  exchange: string | null;
  quoteType: string;
};

export type Pass471Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type Pass471SafeQuote = Record<string, unknown> & {
  id: string;
  symbol: string;
  state: "live" | "unavailable";
  source: string;
  sourceTimestamp: number | null;
  exchange: string | null;
  currency: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  candles: Pass471Candle[];
  providerPlan?: string[];
  providerFunctions?: string[];
  docs?: string[];
  consensusNotes?: string[];
  providerEvidence?: Array<{ label: string; value: string; source: string }>;
};

const CATALOG_ASSET_CLASSES = new Set<Pass471CatalogAssetClass>([
  "crypto",
  "exchange_token",
  "stock",
  "fx",
  "real_estate",
  "etf",
  "commodity",
]);

const ADAPTER_STATES = new Set<Pass471CatalogRow["adapterState"]>([
  "live_first",
  "provider_required",
  "slow_macro",
  "historical_context",
  "operator_review",
]);

function text(value: unknown, fallback = "", max = 180) {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(ASCII_CONTROL_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return normalized || fallback;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = finite(value);
  return parsed == null ? fallback : Math.max(min, Math.min(max, parsed));
}

function stringArray(value: unknown, limit = 16) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => text(item, "", 220))
    .filter(Boolean)
    .slice(0, limit);
}

export function safePass471Symbol(value: unknown, fallback = "UNKNOWN") {
  const normalized = text(value, fallback, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_./:=+-]/g, "");
  return normalized || fallback;
}

export function normalizePass471CatalogRows(value: unknown): Pass471CatalogRow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry, index): Pass471CatalogRow | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const symbol = safePass471Symbol(row.symbol, "");
      if (!symbol) return null;
      const assetClass = CATALOG_ASSET_CLASSES.has(row.assetClass as Pass471CatalogAssetClass)
        ? (row.assetClass as Pass471CatalogAssetClass)
        : "stock";
      const key = `${assetClass}:${symbol}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const adapterState = ADAPTER_STATES.has(row.adapterState as Pass471CatalogRow["adapterState"])
        ? (row.adapterState as Pass471CatalogRow["adapterState"])
        : "operator_review";
      return {
        id: text(row.id, `pass471-${assetClass}-${symbol.toLowerCase()}-${index + 1}`, 100),
        rank: Math.max(1, Math.floor(bounded(row.rank, index + 1, 1, 1_000_000))),
        symbol,
        name: text(row.name, symbol, 120),
        assetClass,
        priceLane: text(row.priceLane, "Source required", 180),
        proofOrDisclosureLane: text(row.proofOrDisclosureLane, "Evidence source required", 180),
        riskPressure: Math.round(bounded(row.riskPressure, 50, 0, 100)),
        adapterState,
      };
    })
    .filter((row): row is Pass471CatalogRow => Boolean(row))
    .slice(0, 2500);
}

export function normalizePass471ProviderSearchRows(value: unknown): Pass471ProviderSearchRow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry): Pass471ProviderSearchRow | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const symbol = safePass471Symbol(row.symbol, "");
      if (!symbol || seen.has(symbol)) return null;
      seen.add(symbol);
      return {
        symbol,
        name: text(row.name, symbol, 120),
        exchange: text(row.exchange, "", 80) || null,
        quoteType: text(row.quoteType, "UNKNOWN", 48).toUpperCase(),
      };
    })
    .filter((row): row is Pass471ProviderSearchRow => Boolean(row))
    .slice(0, 24);
}

function normalizeCandle(value: unknown): Pass471Candle | null {
  if (!value || typeof value !== "object") return null;
  const candle = value as Record<string, unknown>;
  const timestamp = finite(candle.timestamp);
  const open = finite(candle.open);
  const high = finite(candle.high);
  const low = finite(candle.low);
  const close = finite(candle.close);
  if (timestamp == null || open == null || high == null || low == null || close == null) return null;
  if (timestamp <= 0 || open < 0 || high < 0 || low < 0 || close < 0) return null;
  return {
    timestamp,
    open,
    high: Math.max(high, open, close, low),
    low: Math.min(low, open, close, high),
    close,
    volume: finite(candle.volume),
  };
}

function normalizeEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      return {
        label: text(item.label, "Evidence", 100),
        value: text(item.value, "Source required", 180),
        source: text(item.source, "Unbound source", 120),
      };
    })
    .filter((item): item is { label: string; value: string; source: string } => Boolean(item))
    .slice(0, 24);
}

export function normalizePass471Quotes(value: unknown): Pass471SafeQuote[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry, index): Pass471SafeQuote | null => {
      if (!entry || typeof entry !== "object") return null;
      const quote = entry as Record<string, unknown>;
      const symbol = safePass471Symbol(quote.symbol, "");
      if (!symbol || seen.has(symbol)) return null;
      seen.add(symbol);
      const id = text(quote.id, `pass471-quote-${symbol.toLowerCase()}-${index + 1}`, 120);
      const state = quote.state === "live" ? "live" : "unavailable";
      return {
        ...quote,
        id,
        symbol,
        state,
        source: text(quote.source, "Source required", 120),
        sourceTimestamp: finite(quote.sourceTimestamp),
        exchange: text(quote.exchange, "", 80) || null,
        currency: text(quote.currency, "", 24) || null,
        currentPrice: finite(quote.currentPrice),
        changePercent: finite(quote.changePercent),
        candles: Array.isArray(quote.candles)
          ? quote.candles.map(normalizeCandle).filter((item): item is Pass471Candle => Boolean(item)).slice(-1000)
          : [],
        providerPlan: stringArray(quote.providerPlan),
        providerFunctions: stringArray(quote.providerFunctions),
        docs: stringArray(quote.docs),
        consensusNotes: stringArray(quote.consensusNotes),
        providerEvidence: normalizeEvidence(quote.providerEvidence),
      };
    })
    .filter((quote): quote is Pass471SafeQuote => Boolean(quote))
    .slice(0, 2500);
}

export type Pass471FuzzAudit = {
  version: "pass471-surface-fuzz-v1";
  ok: boolean;
  catalogRows: number;
  providerRows: number;
  quotes: number;
  failures: string[];
};

export function auditPass471MalformedPayloads(input: {
  catalog?: unknown;
  providerResults?: unknown;
  quotes?: unknown;
}): Pass471FuzzAudit {
  const failures: string[] = [];
  let catalogRows: Pass471CatalogRow[] = [];
  let providerRows: Pass471ProviderSearchRow[] = [];
  let quotes: Pass471SafeQuote[] = [];
  try {
    catalogRows = normalizePass471CatalogRows(input.catalog);
  } catch (error) {
    failures.push(`catalog:${error instanceof Error ? error.message : "normalization_failed"}`);
  }
  try {
    providerRows = normalizePass471ProviderSearchRows(input.providerResults);
  } catch (error) {
    failures.push(`provider:${error instanceof Error ? error.message : "normalization_failed"}`);
  }
  try {
    quotes = normalizePass471Quotes(input.quotes);
  } catch (error) {
    failures.push(`quotes:${error instanceof Error ? error.message : "normalization_failed"}`);
  }
  return {
    version: "pass471-surface-fuzz-v1",
    ok: failures.length === 0,
    catalogRows: catalogRows.length,
    providerRows: providerRows.length,
    quotes: quotes.length,
    failures,
  };
}

export const PASS471_SURFACE_RUNTIME_RESILIENCE_CONTRACT = true;
