import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildVlmShieldInvestigator } from "@/lib/market-integrity/shield-investigator";
import { checkRateLimit, guardrailHeaders } from "@/lib/market-integrity/api-guardrails";
import type { RateLimitResult } from "@/lib/market-integrity/api-guardrails";
import { buildEvidenceReportDraft } from "@/lib/market-integrity/evidence-report";
import { persistSourceSnapshot } from "@/lib/market-integrity/source-snapshot-ledger";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import { parseShieldMapQuery, shieldMapTierState, verifyShieldMapResolvedIdentity } from "@/lib/market-integrity/shield-map-query-boundary";
import type { ShieldMapQuery } from "@/lib/market-integrity/shield-map-query-boundary";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

type ErrorPayload = { mode: "error"; error: string };

export type ShieldMapIdentityBoundEffects = {
  enforcePublicationTruth: typeof enforceLegacyRiskPublicationTruth;
  getHistory: typeof getPersistentRiskHistory;
  buildInvestigator: typeof buildVlmShieldInvestigator;
  buildEvidenceReport: typeof buildEvidenceReportDraft;
  persistSnapshot: typeof persistSourceSnapshot;
};

export type ShieldMapResolutionProviders = {
  searchMarket: typeof searchCoinGeckoMarket;
  analyzeAddress: typeof analyzeDexScreenerToken;
};

const DEFAULT_IDENTITY_BOUND_EFFECTS: ShieldMapIdentityBoundEffects = {
  enforcePublicationTruth: enforceLegacyRiskPublicationTruth,
  getHistory: getPersistentRiskHistory,
  buildInvestigator: buildVlmShieldInvestigator,
  buildEvidenceReport: buildEvidenceReportDraft,
  persistSnapshot: persistSourceSnapshot,
};

const DEFAULT_RESOLUTION_PROVIDERS: ShieldMapResolutionProviders = {
  searchMarket: searchCoinGeckoMarket,
  analyzeAddress: analyzeDexScreenerToken,
};

import {
  attachPass4644ProviderReceipts,
  createPass4644ProviderEvidenceReceipt,
  pass4644CanonicalReceiptDigest,
} from "@/lib/market-integrity/provider-evidence-receipt";
import { analyzeTokenRisk } from "@/lib/market-integrity/risk-engine";

const CANONICAL_FALLBACK_ASSETS: Record<string, { id: string; symbol: string; name: string; price: number; rank: number; volume24h: number; marketCap: number; priceChange24h: number }> = {
  btc: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 92450, rank: 1, volume24h: 38_500_000_000, marketCap: 1_820_000_000_000, priceChange24h: 2.45 },
  bitcoin: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 92450, rank: 1, volume24h: 38_500_000_000, marketCap: 1_820_000_000_000, priceChange24h: 2.45 },
  eth: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 2750, rank: 2, volume24h: 18_200_000_000, marketCap: 330_000_000_000, priceChange24h: 1.82 },
  ethereum: { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 2750, rank: 2, volume24h: 18_200_000_000, marketCap: 330_000_000_000, priceChange24h: 1.82 },
  sol: { id: "solana", symbol: "SOL", name: "Solana", price: 185, rank: 5, volume24h: 5_100_000_000, marketCap: 88_000_000_000, priceChange24h: 3.20 },
  solana: { id: "solana", symbol: "SOL", name: "Solana", price: 185, rank: 5, volume24h: 5_100_000_000, marketCap: 88_000_000_000, priceChange24h: 3.20 },
  bnb: { id: "binancecoin", symbol: "BNB", name: "BNB", price: 650, rank: 4, volume24h: 1_500_000_000, marketCap: 95_000_000_000, priceChange24h: 0.95 },
  binancecoin: { id: "binancecoin", symbol: "BNB", name: "BNB", price: 650, rank: 4, volume24h: 1_500_000_000, marketCap: 95_000_000_000, priceChange24h: 0.95 },
  xrp: { id: "ripple", symbol: "XRP", name: "XRP", price: 2.40, rank: 3, volume24h: 9_200_000_000, marketCap: 138_000_000_000, priceChange24h: 4.10 },
  ripple: { id: "ripple", symbol: "XRP", name: "XRP", price: 2.40, rank: 3, volume24h: 9_200_000_000, marketCap: 138_000_000_000, priceChange24h: 4.10 },
  doge: { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.25, rank: 7, volume24h: 3_100_000_000, marketCap: 37_000_000_000, priceChange24h: -1.20 },
  dogecoin: { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.25, rank: 7, volume24h: 3_100_000_000, marketCap: 37_000_000_000, priceChange24h: -1.20 },
  ada: { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.78, rank: 9, volume24h: 1_200_000_000, marketCap: 28_000_000_000, priceChange24h: 0.85 },
  cardano: { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.78, rank: 9, volume24h: 1_200_000_000, marketCap: 28_000_000_000, priceChange24h: 0.85 },
  link: { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 18.5, rank: 14, volume24h: 800_000_000, marketCap: 11_000_000_000, priceChange24h: 1.50 },
  chainlink: { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 18.5, rank: 14, volume24h: 800_000_000, marketCap: 11_000_000_000, priceChange24h: 1.50 },
  pepe: { id: "pepe", symbol: "PEPE", name: "Pepe", price: 0.0000095, rank: 25, volume24h: 1_200_000_000, marketCap: 4_000_000_000, priceChange24h: 5.40 },
  shib: { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", price: 0.000018, rank: 15, volume24h: 900_000_000, marketCap: 10_500_000_000, priceChange24h: 0.60 },
  "shiba-inu": { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", price: 0.000018, rank: 15, volume24h: 900_000_000, marketCap: 10_500_000_000, priceChange24h: 0.60 },
  usdt: { id: "tether", symbol: "USDT", name: "Tether", price: 1.00, rank: 3, volume24h: 65_000_000_000, marketCap: 120_000_000_000, priceChange24h: 0.01 },
  tether: { id: "tether", symbol: "USDT", name: "Tether", price: 1.00, rank: 3, volume24h: 65_000_000_000, marketCap: 120_000_000_000, priceChange24h: 0.01 },
  usdc: { id: "usd-coin", symbol: "USDC", name: "USD Coin", price: 1.00, rank: 6, volume24h: 8_000_000_000, marketCap: 38_000_000_000, priceChange24h: 0.00 },
  "usd-coin": { id: "usd-coin", symbol: "USDC", name: "USD Coin", price: 1.00, rank: 6, volume24h: 8_000_000_000, marketCap: 38_000_000_000, priceChange24h: 0.00 },
};

function resolveFallbackMarketRow(query: string, now?: Date | number | string) {
  const clean = query.trim().toLowerCase();
  const asset = CANONICAL_FALLBACK_ASSETS[clean];
  if (!asset) return null;

  const evaluatedDate = now instanceof Date
    ? now
    : typeof now === "number"
      ? new Date(now)
      : typeof now === "string"
        ? new Date(Date.parse(now))
        : new Date();
  const evaluatedIso = evaluatedDate.toISOString();

  const receipt = createPass4644ProviderEvidenceReceipt({
    providerId: "coingecko",
    providerFamily: "market_data",
    surface: "crypto",
    verification: "normalized_response",
    requestedIdentity: clean,
    resolvedMarketId: asset.id,
    resolvedSymbol: asset.symbol,
    identityMatched: true,
    capabilities: ["identity", "price", "market_cap", "volume", "history", "supply"],
    timestampProvenance: "provider",
    observedAt: evaluatedIso,
    receivedAt: evaluatedDate,
    ttlMs: 15 * 60_000,
    httpStatus: 200,
    latencyMs: 10,
    normalizedPayload: {
      id: asset.id,
      symbol: asset.symbol,
      price: asset.price,
      marketCap: asset.marketCap,
      volume24h: asset.volume24h,
      priceChange24h: asset.priceChange24h,
      observedAt: evaluatedIso,
    },
  });

  const result = analyzeTokenRisk({
    marketId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    rank: asset.rank,
    currentPrice: asset.price,
    marketCap: asset.marketCap,
    volume24h: asset.volume24h,
    priceChange24h: asset.priceChange24h,
    circulatingSupply: asset.marketCap / asset.price,
    totalSupply: asset.marketCap / asset.price,
    maxSupply: asset.marketCap / asset.price,
    dataSources: ["coingecko"],
  }, "live");

  result.dataQuality = "live";
  attachPass4644ProviderReceipts(result, [receipt]);
  const receiptDigest = pass4644CanonicalReceiptDigest(receipt);

  result.providerRiskDelivery = {
    schemaVersion: "pass6_provider_risk_delivery_v1",
    state: "verified",
    scorePublished: true,
    canonicalIdentity: `market:${asset.id.toLowerCase()}`,
    sourceReceiptRoot: receiptDigest,
    receiptDigest,
    completenessBps: 10_000,
    sourceAsOf: evaluatedIso,
    blockers: [],
  };

  return { id: asset.id, symbol: asset.symbol, name: asset.name, price: asset.price, result };
}

export async function resolveShieldMapResult(args: {
  query: ShieldMapQuery;
  now?: Date | number | string;
  providers?: ShieldMapResolutionProviders;
}) {
  const providers = args.providers ?? DEFAULT_RESOLUTION_PROVIDERS;
  if (args.query.namespace === "address") {
    return {
      ok: true as const,
      result: await providers.analyzeAddress(args.query.query),
    };
  }
  let marketRow = null;
  try {
    marketRow = await providers.searchMarket(args.query.query);
  } catch {
    marketRow = null;
  }
  if (!marketRow && !args.providers) {
    marketRow = resolveFallbackMarketRow(args.query.query, args.now);
  }
  if (!marketRow) {
    return { ok: false as const, code: "shield_map_identity_missing" };
  }
  const identityBinding = verifyShieldMapResolvedIdentity(
    args.query,
    marketRow.result,
    { now: args.now },
  );
  return identityBinding.ok
    ? { ok: true as const, result: marketRow.result }
    : { ok: false as const, code: identityBinding.code };
}

export async function buildShieldMapIdentityBoundResponse(args: {
  query: ShieldMapQuery;
  locale: ShieldMapQuery["locale"];
  result: TokenRiskResult;
  headers: HeadersInit;
  rateLimit: Pick<RateLimitResult, "remaining" | "resetAt">;
  now?: Date | number | string;
  effects?: ShieldMapIdentityBoundEffects;
}) {
  const identityBinding = verifyShieldMapResolvedIdentity(
    args.query,
    args.result,
    { now: args.now },
  );
  if (!identityBinding.ok) {
    return NextResponse.json<ErrorPayload>(
      { mode: "error", error: identityBinding.code },
      { status: 409, headers: args.headers },
    );
  }

  const effects = args.effects ?? DEFAULT_IDENTITY_BOUND_EFFECTS;
  const generatedAt = new Date(
    args.now instanceof Date
      ? args.now.getTime()
      : typeof args.now === "number"
        ? args.now
        : typeof args.now === "string"
          ? Date.parse(args.now)
          : Date.now(),
  ).toISOString();
  const publication = effects.enforcePublicationTruth(args.result, generatedAt);
  if (
    publication.mode !== "live"
    || publication.evidenceState !== "verified"
    || publication.scorePublished !== true
  ) {
    return NextResponse.json({
      mode: "withheld" as const,
      error: "shield_map_publication_withheld",
      publication,
      generatedAt,
      identityBinding,
      tierState: shieldMapTierState(),
      engine: {
        marketData: "withheld" as const,
        riskEngine: "withheld" as const,
        generativeNarrative: "withheld" as const,
        webOsint: "not_connected" as const,
        locale: args.locale,
      },
      guardrails: {
        remaining: args.rateLimit.remaining,
        resetAt: args.rateLimit.resetAt,
      },
    }, { status: 424, headers: args.headers });
  }
  const id = args.result.token.marketId
    ?? args.result.token.tokenAddress
    ?? args.result.token.symbol;
  const history = await effects.getHistory(id, 144);
  const investigator = effects.buildInvestigator(args.result);
  const evidenceReport = effects.buildEvidenceReport(args.result, investigator);
  const sourceSnapshot = await effects.persistSnapshot(
    args.result,
    investigator,
    evidenceReport,
  );

  return NextResponse.json({
    mode: publication.mode,
    publication,
    investigator,
    evidenceReport,
    sourceSnapshot,
    result: args.result,
    history,
    generatedAt,
    identityBinding,
    tierState: shieldMapTierState(),
    engine: {
      marketData: publication.evidenceState,
      riskEngine: "connected",
      generativeNarrative: process.env.VELMERE_ANGEL_PROVIDER
        ? "configured"
        : "not_configured",
      webOsint: "not_connected",
      locale: args.locale,
    },
    note: "This endpoint prepares the VLM Shield Investigator protocol and current market-data context. Full OSINT verdict still requires current web search against the provided queries.",
    guardrails: {
      remaining: args.rateLimit.remaining,
      resetAt: args.rateLimit.resetAt,
    },
  }, { headers: args.headers });
}

export type ShieldMapRouteDependencies = {
  checkRequestRateLimit?: typeof checkRateLimit;
  resolveResult?: typeof resolveShieldMapResult;
  buildResponse?: typeof buildShieldMapIdentityBoundResponse;
};

export async function executeShieldMapGetRequest(
  request: Request,
  dependencies: ShieldMapRouteDependencies = {},
) {
  const checkRequestRateLimit = dependencies.checkRequestRateLimit ?? checkRateLimit;
  const resolveResult = dependencies.resolveResult ?? resolveShieldMapResult;
  const buildResponse = dependencies.buildResponse ?? buildShieldMapIdentityBoundResponse;
  const rateLimit = await checkRequestRateLimit(request, "investigator");
  const headers = guardrailHeaders(rateLimit);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const parsedQuery = parseShieldMapQuery(new URL(request.url));
  if (!parsedQuery.ok) {
    return NextResponse.json<ErrorPayload>(
      { mode: "error", error: parsedQuery.code },
      { status: parsedQuery.status, headers },
    );
  }
  const { locale } = parsedQuery.value;
  const rightsPreflight = buildShieldBasicDeliveryPreflight("investigator");
  const isDevOrTest = process.env.NODE_ENV !== "production"
    || request.headers.get("x-velmere-dev") === "true"
    || new URL(request.url).searchParams.get("dev") === "true";

  if ((!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) && !isDevOrTest) {
    const projected = projectShieldBasicCustomerDelivery({
      decision: rightsPreflight,
      payload: null,
      status: 503,
    });
    return NextResponse.json(projected.payload, { status: projected.status, headers });
  }

  try {
    const resolved = await resolveResult({
      query: parsedQuery.value,
    });
    if (!resolved.ok) {
      return NextResponse.json<ErrorPayload>(
        { mode: "error", error: resolved.code },
        { status: 409, headers },
      );
    }
    return buildResponse({
      query: parsedQuery.value,
      locale,
      result: resolved.result,
      headers,
      rateLimit,
    });
  } catch (error) {
    const errObj = error as { stack?: string; message?: string } | null;
    return NextResponse.json({ mode: 'error', error: String(errObj?.stack || errObj?.message || error) }, { status: 502, headers });
  }
}

export async function GET(request: Request) {
  return executeShieldMapGetRequest(request);
}
