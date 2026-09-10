// PASS4413 no-visual CrossAsset / Real Markets runtime normalizer extraction.
// Boundary: fetch/JSON/catalog/search helpers only. No JSX, CSS, copy or visual behavior changes.

import { fetchSameOriginWithDeadline, readJsonResponseBounded, readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import type { Pass459Fundamentals } from "@/lib/market-integrity/alpha-vantage-provider";
import {
  normalizePass471CatalogRows,
  normalizePass471ProviderSearchRows,
  normalizePass471Quotes,
  type Pass471ProviderSearchRow,
} from "@/lib/market-integrity/surface-runtime-resilience";
import { pass4574QuoteDisplayState } from "@/lib/market-integrity/market-data-sanity";

export const PASS4413_CROSS_ASSET_RUNTIME_NORMALIZERS_BOUNDARY = {
  passId: "PASS4413",
  mode: "no_visual_cross_asset_runtime_normalizer_extraction",
  visualChanges: false,
  purpose:
    "Move Real Markets fetch, JSON, catalog and provider-search normalizers out of CrossAssetCollapseRadarPanel to reduce client build pressure without changing UI.",
  publicTopkaLiveAllowed: false,
} as const;

const PASS4413_REAL_MARKETS_CLIENT_TIMEOUT_MS = 4_800;

export type Pass4413AssetCategory =
  | "crypto"
  | "stocks"
  | "indices"
  | "fx"
  | "etf"
  | "commodities"
  | "real_estate"
  | "exchanges";

export type Pass4413RealMarketsAsset = {
  id: string;
  symbol: string;
  providerSymbol: string;
  name: string;
  category: Pass4413AssetCategory;
  domain?: string;
  glyph?: string;
  context: string;
  risk: number;
  exchange?: string | null;
};

export type Pass4413CrossAssetCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type Pass4413CrossAssetQuote = {
  id: string;
  symbol: string;
  state: "live" | "unavailable";
  source: string;
  sourceTimestamp: number | null;
  exchange: string | null;
  currency: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  candles: Pass4413CrossAssetCandle[];
  assetClass?:
    | "crypto"
    | "stock"
    | "index"
    | "fx"
    | "etf"
    | "commodity"
    | "real_estate"
    | "exchange_equity"
    | "venue_health";
  truthState?:
    | "source_bound"
    | "compatibility_adapter"
    | "source_required"
    | "provider_error";
  providerKind?: string;
  sourceContract?: string;
  sourcePolicy?: string;
  providerPlan?: string[];
  missingReason?: string | null;
  providerStatus?:
    | "source_bound"
    | "not_configured"
    | "rate_limited"
    | "provider_error"
    | "unsupported";
  primaryProviderConfigured?: boolean;
  providerFunctions?: string[];
  providerEvidence?: Array<{ label: string; value: string; source: string }>;
  pass2808ChartReceipt?: {
    schemaVersion: "pass2808_chart_receipt_v1";
    status: "source_bound" | "skeleton_required";
    range: string;
    candleCount: number;
    source: string;
    sourceTimestamp: number | null;
    confidence: number;
    rule: string;
  };
  fundamentals?: Pass459Fundamentals;
  venueComparison?: {
    version: "cross-venue-consensus";
    state:
      | "aligned"
      | "watch"
      | "divergent"
      | "stale"
      | "single_source"
      | "unavailable";
    primaryVenueId: "binance" | "mexc" | "coinbase";
    primaryVenue: string;
    assetSymbol: string;
    secondaryVenueId: "binance" | "mexc" | "coinbase" | null;
    secondaryVenue: string | null;
    primaryPair: string;
    secondaryPair: string | null;
    quoteBasisState:
      | "same_quote"
      | "fiat_stable_proxy"
      | "stable_stable_proxy"
      | "unsupported";
    quoteBasisPenalty: number;
    directPriceComparable: boolean;
    priceDivergenceBps: number | null;
    spreadDeltaBps: number | null;
    freshnessDeltaSeconds: number | null;
    change24hDeltaPct: number | null;
    healthScoreGap: number | null;
    depthRatio: number | null;
    confidenceCap: number;
    notes: string[];
    evidence: Array<{ label: string; value: string; source: string }>;
    boundary: string;
  } | null;
  secondSourceRequired?: boolean;
  marketCap?: number | null;
  fdv?: number | null;
  volume24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  priceChange1h?: number | null;
  priceChange24h?: number | null;
  priceChange7d?: number | null;
  circulatingSupply?: number | null;
  totalSupply?: number | null;
  maxSupply?: number | null;
  docs?: string[];
  consensusState?:
    | "aligned"
    | "watch"
    | "divergent"
    | "stale"
    | "single_source"
    | "unavailable";
  freshnessState?: "fresh" | "aging" | "stale" | "missing";
  freshnessSeconds?: number | null;
  divergenceBps?: number | null;
  divergenceThresholdBps?: number;
  confidenceCap?: number;
  primaryPrice?: number | null;
  secondaryPrice?: number | null;
  secondarySource?: string | null;
  consensusNotes?: string[];
  venueHealth?: {
    version: "venue-health-runtime";
    venueId: "binance" | "mexc" | "coinbase";
    venue: string;
    assetSymbol: string;
    pair: string;
    baseCurrency: string;
    quoteCurrency: "USD" | "USDT" | "USDC" | "EUR" | "UNKNOWN";
    pairResolutionState: "canonical" | "candidate" | "unsupported";
    pairResolutionNote: string;
    state:
      | "source_bound"
      | "review"
      | "stale"
      | "provider_error"
      | "unsupported";
    source: string;
    observedAt: string;
    sourceTimestamp: number | null;
    freshnessSeconds: number | null;
    latencyMs: number | null;
    serverClockDriftMs: number | null;
    spreadBps: number | null;
    bidDepthUsd: number | null;
    askDepthUsd: number | null;
    depthImbalancePercent: number | null;
    klineContinuityPercent: number | null;
    referencePrice: number | null;
    priceChange24h: number | null;
    volume24h: number | null;
    confidenceCap: number;
    healthScore: number;
    cacheState: "hit" | "miss" | "stale_fallback";
    storageMode: "upstash_rest" | "upstash_fallback_memory" | "memory";
    quotaMode: string;
    quotaRemaining: number | null;
    providerErrors: string[];
    metrics: Array<{
      id: string;
      label: string;
      value: string;
      state: "ok" | "watch" | "missing";
      source: string;
    }>;
    websocketPolicy: {
      endpoint: string;
      heartbeat: string;
      reconnect: string;
      expiry: string;
    };
    boundary: string;
  } | null;
};

export type Pass4413CrossAssetQuoteResponse = {
  ok: boolean;
  generatedAt: string;
  quotes: Pass4413CrossAssetQuote[];
};

export type Pass4413CrossAssetSearchResponse = {
  ok: boolean;
  results?: Pass471ProviderSearchRow[];
};

export type Pass4413CrossAssetCatalogRow = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  assetClass:
    | "crypto"
    | "exchange_token"
    | "stock"
    | "fx"
    | "real_estate"
    | "etf"
    | "commodity"
    | "index"
    | "exchange";
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

export type Pass4413CrossAssetCatalogResponse = {
  ok: boolean;
  counts?: {
    total: number;
    uniqueSymbols: number;
    inheritedRowsCollapsed: number;
    stocks: number;
    fx: number;
    etf: number;
    commodities: number;
    realEstate: number;
    crypto: number;
    exchangeTokens: number;
    indices: number;
    exchanges: number;
  };
  responseGeneratedAt?: string;
  catalogSnapshotAt?: string | null;
  catalogDataMode?: "STATIC_REFERENCE_UNIVERSE";
  liveDataIncluded?: false;
  commercialRightsVerified?: false;
  rows?: Pass4413CrossAssetCatalogRow[];
};

type Pass4413CrossAssetRecord = Record<string, unknown>;

export function isPass4413CrossAssetRecord(value: unknown): value is Pass4413CrossAssetRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


export async function readPass4462RealMarketsJson<TFallback>(
  response: Response,
  fallback: TFallback,
): Promise<unknown | TFallback> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || !contentType.includes("application/json")) return fallback;
  const raw = await readTextResponseBounded(response, 2 * 1024 * 1024);
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export function fallbackQuoteResponse(): Pass4413CrossAssetQuoteResponse {
  return { ok: false, generatedAt: new Date().toISOString(), quotes: [] };
}

export function normalizeQuoteResponse(value: unknown): Pass4413CrossAssetQuoteResponse {
  if (!isPass4413CrossAssetRecord(value)) return fallbackQuoteResponse();
  const quotes = (normalizePass471Quotes(value.quotes) as Pass4413CrossAssetQuote[]).map((quote) => {
    const displayState = pass4574QuoteDisplayState(quote);
    if (displayState === "live") return quote;
    return {
      ...quote,
      state: "unavailable" as const,
      missingReason: quote.missingReason ?? `pass4574_display_trust_${displayState}`,
      confidenceCap: Math.min(quote.confidenceCap ?? 55, 35),
    };
  });
  return {
    ok: value.ok === true,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
    quotes,
  };
}

function normalizeCatalogCounts(value: unknown): Pass4413CrossAssetCatalogResponse["counts"] | undefined {
  if (!isPass4413CrossAssetRecord(value)) return undefined;
  const numberValue = (key: string) => {
    const candidate = value[key];
    return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
  };
  return {
    total: numberValue("total"),
    uniqueSymbols: numberValue("uniqueSymbols"),
    inheritedRowsCollapsed: numberValue("inheritedRowsCollapsed"),
    stocks: numberValue("stocks"),
    fx: numberValue("fx"),
    etf: numberValue("etf"),
    commodities: numberValue("commodities"),
    realEstate: numberValue("realEstate"),
    crypto: numberValue("crypto"),
    exchangeTokens: numberValue("exchangeTokens"),
    indices: numberValue("indices"),
    exchanges: numberValue("exchanges"),
  };
}

export function normalizeCatalogResponse(value: unknown): Pass4413CrossAssetCatalogResponse {
  if (!isPass4413CrossAssetRecord(value)) return { ok: false };
  const counts = normalizeCatalogCounts(value.counts);
  const rows = normalizePass471CatalogRows(value.rows) as Pass4413CrossAssetCatalogRow[];
  const ids = new Set(rows.map((row) => row.id));
  const symbols = new Set(rows.map((row) => row.symbol.trim().toUpperCase()));
  const countSum = counts
    ? counts.stocks + counts.fx + counts.etf + counts.commodities + counts.realEstate + counts.crypto + counts.exchangeTokens + counts.indices + counts.exchanges
    : -1;
  const coherent = Boolean(
    value.ok === true
    && counts
    && counts.total === rows.length
    && counts.uniqueSymbols === rows.length
    && countSum === rows.length
    && ids.size === rows.length
    && symbols.size === rows.length
    && value.catalogDataMode === "STATIC_REFERENCE_UNIVERSE"
    && value.liveDataIncluded === false
    && value.commercialRightsVerified === false
  );
  if (!coherent) return { ok: false, counts, rows: [] };
  return {
    ok: true,
    counts,
    rows,
    responseGeneratedAt: typeof value.responseGeneratedAt === "string" ? value.responseGeneratedAt : undefined,
    catalogSnapshotAt: typeof value.catalogSnapshotAt === "string" ? value.catalogSnapshotAt : null,
    catalogDataMode: "STATIC_REFERENCE_UNIVERSE",
    liveDataIncluded: false,
    commercialRightsVerified: false,
  };
}

export function normalizeSearchResponse(value: unknown): Pass4413CrossAssetSearchResponse {
  if (!isPass4413CrossAssetRecord(value)) return { ok: false, results: [] };
  return {
    ok: value.ok === true,
    results: normalizePass471ProviderSearchRows(value.results),
  };
}

export function categoryFromCatalog(assetClass: Pass4413CrossAssetCatalogRow["assetClass"]): Pass4413AssetCategory {
  if (assetClass === "stock") return "stocks";
  if (assetClass === "fx") return "fx";
  if (assetClass === "etf") return "etf";
  if (assetClass === "commodity") return "commodities";
  if (assetClass === "real_estate") return "real_estate";
  if (assetClass === "index") return "indices";
  if (assetClass === "exchange" || assetClass === "exchange_token") return "exchanges";
  if (assetClass === "crypto") return "crypto";
  throw new Error(`real_markets_catalog_asset_class_unsupported:${assetClass}`);
}

export function cleanAssetSymbol(value: unknown, fallback = "ASSET") {
  const clean = String(value ?? fallback)
    .trim()
    .toUpperCase();
  return clean || fallback;
}

export function realMarketsRowTone(risk: number) {
  if (risk >= 70) return "critical";
  if (risk >= 50) return "warning";
  if (risk >= 35) return "watch";
  return "calm";
}

export function providerSymbolFromCatalog(row: Pass4413CrossAssetCatalogRow) {
  const symbol = cleanAssetSymbol(row.symbol);
  if (row.assetClass === "crypto" || row.assetClass === "exchange_token") {
    return symbol.includes("-") ? symbol : `${symbol}-USD`;
  }
  if (row.assetClass === "fx") {
    if (symbol === "DXY") return "DX-Y.NYB";
    return `${symbol.replace(/[^A-Z]/g, "")}=X`;
  }
  if (row.assetClass === "commodity") {
    const futures: Record<string, string> = {
      "XAU/USD": "GC=F",
      "XAG/USD": "SI=F",
      "XPD/USD": "PA=F",
      WTI: "CL=F",
      BRENT: "BZ=F",
      NATGAS: "NG=F",
      COPPER: "HG=F",
      PLATINUM: "PL=F",
      COCOA: "CC=F",
      COFFEE: "KC=F",
      WHEAT: "ZW=F",
    };
    return futures[symbol] || symbol;
  }
  return symbol;
}

export function assetFromCatalog(row: Pass4413CrossAssetCatalogRow): Pass4413RealMarketsAsset {
  return {
    id: `catalog-${row.id}`,
    symbol: row.symbol,
    providerSymbol: providerSymbolFromCatalog(row),
    name: row.name,
    category: categoryFromCatalog(row.assetClass),
    glyph: row.symbol
      .replace(/[^A-Z0-9]/gi, "")
      .slice(0, 3)
      .toUpperCase(),
    context: `${row.priceLane} · ${row.proofOrDisclosureLane}`,
    risk: row.riskPressure,
  };
}

export function pass2808FetchWithTimeout(
  input: string,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    headers?: HeadersInit;
  } = {},
) {
  return fetchSameOriginWithDeadline(input, {
    signal: options.signal,
    headers: options.headers,
  }, {
    timeoutMs: options.timeoutMs ?? PASS4413_REAL_MARKETS_CLIENT_TIMEOUT_MS,
    operation: "real_markets_same_origin_fetch",
  });
}

export async function fetchQuoteBatchPass2808(chunk: string[], range = "1w", signal?: AbortSignal) {
  try {
    const response = await pass2808FetchWithTimeout(
      `/api/market-integrity/real-markets?symbols=${encodeURIComponent(chunk.join(","))}&range=${encodeURIComponent(range)}`,
      { signal },
    );
    if (!response.ok) return fallbackQuoteResponse();
    return normalizeQuoteResponse(await readJsonResponseBounded<unknown>(response, 2 * 1024 * 1024));
  } catch {
    return fallbackQuoteResponse();
  }
}
