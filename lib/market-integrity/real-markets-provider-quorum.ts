import type { Pass458TruthQuote } from "@/lib/market-integrity/provider-truth-router";
import { providerValueSha256 } from "@/lib/market-integrity/provider-resilience-runtime";
import { reconcileProviderQuorum } from "@/lib/market-integrity/provider-quorum-reconciliation";
import {
  evaluateProviderEvidenceTier,
  type ProviderEvidenceTier,
} from "@/lib/market-integrity/provider-evidence-tier-policy";

type QuoteWithResilience = Pass458TruthQuote & {
  observationWindow?: string;
  sourceReceivedAt?: string | null;
  sourceLatencyMs?: number | null;
  providerResilience?: {
    providerId?: string;
    evidenceEligible?: boolean;
    valueSha256?: string | null;
    status?: string;
  };
};

type StooqQuote = {
  symbol?: string | null;
  currency?: string | null;
  observationWindow?: string | null;
  state?: "live" | "unavailable";
  source: string;
  currentPrice: number | null;
  sourceTimestamp: number | null;
  sourceReceivedAt?: string | null;
  sourceLatencyMs?: number | null;
  freshnessState?: "fresh" | "aging" | "stale" | "missing";
  providerStatus?: string;
};

export function reconcileRealMarketsQuoteProviders(input: {
  sourceQuote: QuoteWithResilience;
  routeQuote: Pass458TruthQuote;
  stooq: StooqQuote | null;
  requestedTier: ProviderEvidenceTier;
  nowSeconds?: number;
}) {
  const sourceResilience = input.sourceQuote.providerResilience;
  const sourceFingerprint = `${input.sourceQuote.providerKind ?? ""} ${input.sourceQuote.source ?? ""}`.toLowerCase();
  const sourceIsStooq = sourceFingerprint.includes("stooq");
  const sourceFamily = sourceIsStooq
    ? "stooq"
    : sourceFingerprint.includes("yahoo")
      ? "yahoo"
      : sourceFingerprint.includes("alpha")
        ? "alphavantage"
        : sourceFingerprint.includes("finnhub")
          ? "finnhub"
        : String(input.sourceQuote.providerKind ?? "real_markets_provider").toLowerCase();
  const primaryObservationWindow = input.sourceQuote.observationWindow
    ?? (sourceIsStooq ? "daily_close" : "latest_quote");
  const secondaryObservationWindow = input.stooq?.observationWindow ?? "daily_close";
  const expectedCurrency = input.sourceQuote.currency ?? input.routeQuote.currency ?? input.stooq?.currency ?? "";
  const primaryValueSha256 = sourceResilience?.valueSha256 ?? providerValueSha256({
    symbol: input.sourceQuote.symbol,
    assetClass: input.sourceQuote.assetClass,
    source: input.sourceQuote.source,
    sourceTimestamp: input.sourceQuote.sourceTimestamp,
    receivedAt: input.sourceQuote.sourceReceivedAt ?? null,
    latencyMs: input.sourceQuote.sourceLatencyMs ?? null,
    currentPrice: input.sourceQuote.currentPrice,
    currency: input.sourceQuote.currency,
    exchange: input.sourceQuote.exchange,
    marketCap: input.sourceQuote.marketCap,
    volume24h: input.sourceQuote.volume24h,
    high24h: input.sourceQuote.high24h,
    low24h: input.sourceQuote.low24h,
    priceChange1h: input.sourceQuote.priceChange1h,
    priceChange24h: input.sourceQuote.priceChange24h,
    priceChange7d: input.sourceQuote.priceChange7d,
    candleCount: input.sourceQuote.candles?.length ?? 0,
  });
  const primary = typeof input.sourceQuote.currentPrice === "number" ? {
    providerId: String(sourceResilience?.providerId ?? input.sourceQuote.providerKind ?? input.sourceQuote.source ?? "primary-provider"),
    providerFamily: sourceFamily,
    resolvedSymbol: input.sourceQuote.symbol,
    quoteCurrency: input.sourceQuote.currency ?? expectedCurrency,
    observationWindow: primaryObservationWindow,
    source: String(input.sourceQuote.source ?? "primary provider"),
    price: input.sourceQuote.currentPrice,
    sourceTimestamp: input.sourceQuote.sourceTimestamp,
    evidenceEligible: input.sourceQuote.state === "live"
      && sourceResilience?.evidenceEligible !== false
      && input.sourceQuote.freshnessState !== "stale"
      && input.sourceQuote.freshnessState !== "missing"
      && Boolean(primaryValueSha256),
    status: sourceResilience?.status ?? input.sourceQuote.providerStatus ?? input.sourceQuote.state,
    valueSha256: primaryValueSha256,
  } : null;
  const secondaryValueSha256 = input.stooq ? providerValueSha256({
    symbol: input.stooq.symbol ?? input.routeQuote.symbol,
    source: input.stooq.source,
    sourceTimestamp: input.stooq.sourceTimestamp,
    receivedAt: input.stooq.sourceReceivedAt ?? null,
    latencyMs: input.stooq.sourceLatencyMs ?? null,
    currentPrice: input.stooq.currentPrice,
    freshnessState: input.stooq.freshnessState ?? null,
    providerStatus: input.stooq.providerStatus ?? null,
  }) : null;
  const secondary = input.stooq && !sourceIsStooq && typeof input.stooq.currentPrice === "number" ? {
    providerId: "stooq_daily",
    providerFamily: "stooq",
    resolvedSymbol: input.stooq.symbol ?? input.routeQuote.symbol,
    quoteCurrency: input.stooq.currency ?? expectedCurrency,
    observationWindow: secondaryObservationWindow,
    source: input.stooq.source,
    price: input.stooq.currentPrice,
    sourceTimestamp: input.stooq.sourceTimestamp,
    evidenceEligible: input.stooq.state !== "unavailable"
      && input.stooq.freshnessState !== "stale"
      && input.stooq.freshnessState !== "missing"
      && Boolean(secondaryValueSha256),
    status: input.stooq.providerStatus ?? null,
    valueSha256: secondaryValueSha256,
  } : null;
  const providerQuorum = reconcileProviderQuorum({
    assetClass: input.routeQuote.assetClass ?? "stock",
    expectedIdentity: {
      assetId: input.routeQuote.symbol,
      quoteCurrency: expectedCurrency,
      observationWindow: primaryObservationWindow,
    },
    primary,
    secondary,
    nowSeconds: input.nowSeconds,
  });
  return {
    providerQuorum,
    providerObservations: { primary, secondary },
    providerEvidencePolicy: evaluateProviderEvidenceTier({
      requestedTier: input.requestedTier,
      quorum: providerQuorum,
    }),
    sourceIsStooq,
  };
}
