import { createHash } from "node:crypto";
import { fetchBinanceOrderBook, type OrderBookDepthResult } from "./binance-orderbook";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import { attachPass4644ProviderReceipts, createPass4644ProviderEvidenceReceipt } from "./provider-evidence-receipt";

export const PASS2484_RUNTIME_PREMIUM_EVIDENCE_HYDRATOR_ID = "runtime-premium-evidence-hydrator-v1" as const;

export type Pass2484HydrationState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2484HydrationFamily = "crypto" | "real_market" | "unknown";

export type Pass2484RuntimeProviderReceipt = {
  id: "binance_spot_orderbook" | "yahoo_quote_chart" | "stooq_quote" | "filing_fundamental_provider";
  provider: string;
  family: Pass2484HydrationFamily;
  state: Pass2484HydrationState;
  observedAt?: string;
  confirmedFields: string[];
  missingFields: string[];
  sourceContract: string;
};

export type Pass2484RuntimePremiumEvidenceHydration = {
  version: typeof PASS2484_RUNTIME_PREMIUM_EVIDENCE_HYDRATOR_ID;
  query?: string;
  symbol?: string;
  family: Pass2484HydrationFamily;
  state: Pass2484HydrationState;
  hydrated: boolean;
  hydratedFields: string[];
  providerReceipts: Pass2484RuntimeProviderReceipt[];
  orderbook?: {
    symbol: string;
    spreadPercent?: number;
    visibleBidDepthUsd: number;
    visibleAskDepthUsd: number;
    simulatedSellSlippage10k?: number;
    simulatedBuySlippage10k?: number;
    bidAskImbalancePercent: number;
    source: OrderBookDepthResult["source"];
  };
  paidAdvancedImpact: "raises_premium_lane_to_watch" | "keeps_blocked" | "real_market_timestamp_only" | "not_applicable";
  missingForPaidAdvanced: string[];
  customerCopyRule: string;
  fingerprint: string;
  generatedAt: string;
};

type HydratableResult = TokenRiskResult & {
  limitations?: string[];
  pass2484RuntimePremiumEvidenceHydration?: Pass2484RuntimePremiumEvidenceHydration;
};

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function resultFamily(result?: TokenRiskResult | null): Pass2484HydrationFamily {
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  const symbol = normalizeSymbol(result?.token.symbol);
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK"].includes(symbol)) return "crypto";
  return "unknown";
}

function canTryCexOrderbook(result?: TokenRiskResult | null) {
  if (!result) return false;
  const symbol = normalizeSymbol(result.token.symbol).replace(/-USD$/, "").replace(/USDT$/, "");
  if (!symbol || result.token.tokenAddress || result.token.pairAddress || result.token.dexId) return false;
  return ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "LTC", "TRX", "MATIC", "POL", "PEPE"].includes(symbol);
}

function maxFinite(values: Array<number | undefined>) {
  const filtered = values.filter((value): value is number => Number.isFinite(value));
  return filtered.length ? Math.max(...filtered) : undefined;
}

function appendLimitations(result: TokenRiskResult, items: string[]) {
  const mutable = result as HydratableResult;
  const current = Array.isArray(mutable.limitations) ? mutable.limitations : result.metaModel?.limitations ?? [];
  const next = unique([...current, ...items]).slice(0, 32);
  mutable.limitations = next;
  result.metaModel = result.metaModel ? { ...result.metaModel, limitations: next } : result.metaModel;
}

function attachOrderbook(result: TokenRiskResult, orderbook: OrderBookDepthResult) {
  const slippage10k = maxFinite([orderbook.simulatedSellSlippage10k, orderbook.simulatedBuySlippage10k]);
  const dataSources = unique([
    ...result.dataSources,
    "Binance spot depth orderbook runtime receipt",
  ]);
  const hydrated: HydratableResult = {
    ...result,
    dataSources,
    metrics: {
      ...result.metrics,
      simulatedSlippage10k: slippage10k ?? result.metrics.simulatedSlippage10k,
      bidAskImbalancePercent: finite(orderbook.bidAskImbalancePercent) ?? result.metrics.bidAskImbalancePercent,
    },
  };
  hydrated.metaModel = result.metaModel ? { ...result.metaModel, limitations: [...(result.metaModel.limitations ?? [])] } : result.metaModel;
  appendLimitations(hydrated, [
    "PASS2484: Binance spot orderbook depth hydrated simulated 10k slippage and bid/ask imbalance for Advanced proof lane.",
    "PASS2484: orderbook depth is venue-specific and still requires second venue plus derivatives/holder lanes before paid-ready Advanced.",
  ]);
  return hydrated;
}

function buildCryptoReceipt(orderbook?: OrderBookDepthResult | null, tried = false): Pass2484RuntimeProviderReceipt {
  const confirmedFields = unique([
    orderbook?.bestBid !== undefined && "best bid",
    orderbook?.bestAsk !== undefined && "best ask",
    orderbook?.spreadPercent !== undefined && "spread percent",
    orderbook?.simulatedSellSlippage10k !== undefined && "sell 10k slippage",
    orderbook?.simulatedBuySlippage10k !== undefined && "buy 10k slippage",
    orderbook?.bidAskImbalancePercent !== undefined && "bid/ask imbalance",
  ]);
  const missingFields = unique([
    !tried && "orderbook fetch attempt",
    !orderbook && "Binance spot depth response",
    orderbook?.simulatedSellSlippage10k === undefined && "sell 10k slippage",
    orderbook?.simulatedBuySlippage10k === undefined && "buy 10k slippage",
    "second venue orderbook replay",
    "signed depth snapshot persistence",
  ]);
  return {
    id: "binance_spot_orderbook",
    provider: "Binance spot depth",
    family: "crypto",
    state: orderbook && confirmedFields.length >= 4 ? "ready" : tried ? "watch" : "blocked",
    observedAt: orderbook ? new Date().toISOString() : undefined,
    confirmedFields: confirmedFields.slice(0, 10),
    missingFields: missingFields.slice(0, 10),
    sourceContract: "GET /api/v3/depth?symbol=PAIR&limit=100 -> TokenRiskResult.metrics.simulatedSlippage10k + bidAskImbalancePercent",
  };
}

function buildRealMarketReceipts(result?: TokenRiskResult | null): Pass2484RuntimeProviderReceipt[] {
  const sources = result?.dataSources ?? [];
  const limitations = unique([...(result?.metaModel?.limitations ?? []), ...((result as HydratableResult | null | undefined)?.limitations ?? [])]);
  const yahoo = sources.some((source) => /yahoo/i.test(source));
  const stooq = sources.some((source) => /stooq/i.test(source));
  const filing = sources.some((source) => /sec|xbrl|alpha vantage|fundamental/i.test(source));
  const limitationSurfaced = limitations.some((item) => /sec|xbrl|filing|fundamental|alpha vantage/i.test(item));
  return [
    {
      id: "yahoo_quote_chart",
      provider: "Yahoo Finance market adapter",
      family: "real_market",
      state: yahoo ? "ready" : "blocked",
      observedAt: yahoo ? result?.generatedAt : undefined,
      confirmedFields: unique([yahoo && "quote/chart provider family", yahoo && result?.generatedAt && "runtime timestamp"]).slice(0, 8),
      missingFields: unique([!yahoo && "Yahoo quote/chart response", !result?.generatedAt && "runtime timestamp"]).slice(0, 8),
      sourceContract: "Yahoo quote/chart is one provider family; it never counts as independent second-provider proof by itself.",
    },
    {
      id: "stooq_quote",
      provider: "Stooq quote adapter",
      family: "real_market",
      state: stooq ? "ready" : "blocked",
      observedAt: stooq ? result?.generatedAt : undefined,
      confirmedFields: unique([stooq && "independent quote provider", stooq && result?.generatedAt && "runtime timestamp"]).slice(0, 8),
      missingFields: unique([!stooq && "independent Stooq quote response", !result?.generatedAt && "runtime timestamp"]).slice(0, 8),
      sourceContract: "Stooq counts as a second provider only when the runtime quote is returned and timestamped.",
    },
    {
      id: "filing_fundamental_provider",
      provider: "SEC/XBRL or fundamentals provider",
      family: "real_market",
      state: filing ? "ready" : limitationSurfaced ? "watch" : "blocked",
      observedAt: result?.generatedAt,
      confirmedFields: unique([filing && "filing/fundamental source", limitationSurfaced && "filing/fundamental gap surfaced"]).slice(0, 8),
      missingFields: unique([!filing && "SEC/XBRL companyfacts or Alpha Vantage fundamentals", "filing freshness/latest report date", result?.token.assetClass === "etf" && "ETF holdings/exposure freshness"]).slice(0, 8),
      sourceContract: "Stocks/ETFs require filings/fundamentals/holdings freshness before Advanced uses premium real-market language.",
    },
  ];
}

function receiptState(receipts: Pass2484RuntimeProviderReceipt[], family: Pass2484HydrationFamily): Pass2484HydrationState {
  if (family === "unknown") return "blocked";
  if (!receipts.length) return "not_applicable";
  const ready = receipts.filter((receipt) => receipt.state === "ready").length;
  const watch = receipts.filter((receipt) => receipt.state === "watch").length;
  if (family === "crypto") return ready >= 1 ? "watch" : watch ? "watch" : "blocked";
  return ready >= 2 && watch >= 1 ? "watch" : ready >= 2 ? "watch" : ready >= 1 || watch >= 1 ? "watch" : "blocked";
}

export async function hydratePass2484RuntimePremiumEvidence(args: {
  query?: string;
  result: TokenRiskResult;
  now?: Date;
  allowNetwork?: boolean;
}): Promise<{ result: TokenRiskResult; hydration: Pass2484RuntimePremiumEvidenceHydration }> {
  const now = args.now ?? new Date();
  const family = resultFamily(args.result);
  let result: TokenRiskResult = args.result;
  let orderbook: OrderBookDepthResult | null = null;
  const receipts: Pass2484RuntimeProviderReceipt[] = [];

  if (family === "crypto" && canTryCexOrderbook(args.result) && args.allowNetwork !== false) {
    try {
      const symbol = normalizeSymbol(args.result.token.symbol).replace(/-USD$/, "").replace(/USDT$/, "");
      orderbook = await fetchBinanceOrderBook(symbol);
      const orderbookReceivedAt = new Date();
      result = attachOrderbook(args.result, orderbook);
      attachPass4644ProviderReceipts(result, [createPass4644ProviderEvidenceReceipt({
        providerId: "binance",
        providerFamily: "cex_microstructure",
        surface: "crypto",
        verification: "normalized_response",
        requestedIdentity: args.query ?? symbol,
        resolvedSymbol: orderbook.symbol,
        identityMatched: orderbook.symbol.replace(/USDT$/, "") === symbol,
        capabilities: ["orderbook", "spread", "depth", "slippage", "imbalance"],
        timestampProvenance: "transport_received",
        observedAt: orderbookReceivedAt,
        receivedAt: orderbookReceivedAt,
        ttlMs: 45_000,
        httpStatus: 200,
        latencyMs: 0,
        normalizedPayload: {
          symbol: orderbook.symbol,
          bestBid: orderbook.bestBid,
          bestAsk: orderbook.bestAsk,
          spreadPercent: orderbook.spreadPercent,
          bidDepthUsd: orderbook.bidDepthUsd,
          askDepthUsd: orderbook.askDepthUsd,
          simulatedSellSlippage10k: orderbook.simulatedSellSlippage10k,
          simulatedBuySlippage10k: orderbook.simulatedBuySlippage10k,
          bidAskImbalancePercent: orderbook.bidAskImbalancePercent,
        },
      })]);
    } catch {
      orderbook = null;
      appendLimitations(result, ["PASS2484: Binance spot orderbook hydration attempted but unavailable; Advanced keeps orderbook/slippage lane visible as missing."]);
    }
    receipts.push(buildCryptoReceipt(orderbook, true));
  } else if (family === "crypto") {
    receipts.push(buildCryptoReceipt(null, false));
    if (args.allowNetwork === false) {
      appendLimitations(result, ["PASS4640: premium orderbook hydration is skipped for Basic to keep the free result fast and source-honest."]);
    }
  } else if (family === "real_market") {
    receipts.push(...buildRealMarketReceipts(args.result));
    appendLimitations(result, [
      "PASS2484: Real Markets Advanced checks provider-family truth: Yahoo quote/chart is one source; Stooq and filings/fundamentals are separate paid-depth lanes.",
    ]);
  }

  const hydratedFields = unique([
    orderbook?.simulatedSellSlippage10k !== undefined && "simulatedSellSlippage10k",
    orderbook?.simulatedBuySlippage10k !== undefined && "simulatedBuySlippage10k",
    orderbook?.bidAskImbalancePercent !== undefined && "bidAskImbalancePercent",
    family === "real_market" && "realMarketProviderFamilyReceipts",
  ]).slice(0, 12);
  const missingForPaidAdvanced = unique(receipts.flatMap((receipt) => receipt.state === "ready" ? [] : receipt.missingFields.map((field) => `${receipt.provider}: ${field}`)));
  const state = receiptState(receipts, family);
  const paidAdvancedImpact: Pass2484RuntimePremiumEvidenceHydration["paidAdvancedImpact"] = family === "crypto"
    ? orderbook ? "raises_premium_lane_to_watch" : "keeps_blocked"
    : family === "real_market"
      ? "real_market_timestamp_only"
      : "not_applicable";
  const fingerprint = `PASS2484-${hash({ query: args.query, symbol: result.token.symbol, family, state, hydratedFields, receipts: receipts.map((receipt) => [receipt.id, receipt.state, receipt.confirmedFields.length]) })}`;
  const hydration: Pass2484RuntimePremiumEvidenceHydration = {
    version: PASS2484_RUNTIME_PREMIUM_EVIDENCE_HYDRATOR_ID,
    query: args.query,
    symbol: result.token.symbol,
    family,
    state,
    hydrated: hydratedFields.length > 0,
    hydratedFields,
    providerReceipts: receipts,
    orderbook: orderbook ? {
      symbol: orderbook.symbol,
      spreadPercent: orderbook.spreadPercent,
      visibleBidDepthUsd: orderbook.bidDepthUsd,
      visibleAskDepthUsd: orderbook.askDepthUsd,
      simulatedSellSlippage10k: orderbook.simulatedSellSlippage10k,
      simulatedBuySlippage10k: orderbook.simulatedBuySlippage10k,
      bidAskImbalancePercent: orderbook.bidAskImbalancePercent,
      source: orderbook.source,
    } : undefined,
    paidAdvancedImpact,
    missingForPaidAdvanced: missingForPaidAdvanced.slice(0, 16),
    customerCopyRule: family === "crypto"
      ? "PASS2484 can hydrate orderbook/slippage into Advanced, but paid-ready still requires second venue, derivatives, liquidation replay and holder/supply proof."
      : family === "real_market"
        ? "PASS2484 makes provider-family/timestamp gaps visible; paid-ready Real Markets Advanced still needs independent quote plus filings/fundamentals/holdings freshness."
        : "PASS2484 cannot hydrate unknown assets; keep Advanced in QA preview until the asset family resolves.",
    fingerprint,
    generatedAt: now.toISOString(),
  };
  (result as HydratableResult).pass2484RuntimePremiumEvidenceHydration = hydration;
  return { result, hydration };
}
