import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import type { TokenRiskResult } from "./risk-types";

export type Pass2466DerivativesVenueId = "binance_usdm" | "bybit_linear";
export type Pass2466DerivativesState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2466SqueezeDirection = "long_pressure" | "short_pressure" | "two_sided_leverage" | "unknown";

export type Pass2466DerivativesVenueSnapshot = {
  venue: Pass2466DerivativesVenueId;
  label: string;
  symbol: string;
  state: "live" | "degraded" | "missing";
  observedAt?: string;
  openInterestUsd?: number;
  openInterestBase?: number;
  fundingRate?: number;
  fundingRatePercent?: number;
  markPrice?: number;
  indexPrice?: number;
  basisPercent?: number;
  volume24hUsd?: number;
  priceChange24hPercent?: number;
  endpointProof: string[];
  missingFields: string[];
  error?: string;
};

export type Pass2466DerivativesSqueezeLane = {
  id: "open_interest" | "funding_basis" | "venue_concordance" | "liquidation_gap" | "long_short_ratio_gap" | "surface_lock";
  label: string;
  state: Pass2466DerivativesState;
  confirmedEvidence: string[];
  missingEvidence: string[];
  copyBoundary: string;
};

export type Pass2466DerivativesSqueezeProof = {
  version: "derivatives-squeeze-proof-v1";
  state: Pass2466DerivativesState;
  score: number;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  direction: Pass2466SqueezeDirection;
  venues: Pass2466DerivativesVenueSnapshot[];
  lanes: Pass2466DerivativesSqueezeLane[];
  advancedUnlockRule: string;
  surfaceParityRule: string;
  copyFirewall: string[];
  missingForWorldClass: string[];
  nextImplementationActions: string[];
  generatedAt: string;
};

type BinanceOpenInterestResponse = {
  symbol?: string;
  openInterest?: string;
  time?: number;
};

type BinanceFundingResponse = Array<{
  symbol?: string;
  fundingRate?: string;
  fundingTime?: number;
  markPrice?: string;
}>;

type BinanceTickerResponse = {
  symbol?: string;
  lastPrice?: string;
  markPrice?: string;
  indexPrice?: string;
  priceChangePercent?: string;
  quoteVolume?: string;
};

type BybitTickerResponse = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: Array<{
      symbol?: string;
      lastPrice?: string;
      markPrice?: string;
      indexPrice?: string;
      openInterest?: string;
      openInterestValue?: string;
      fundingRate?: string;
      price24hPcnt?: string;
      turnover24h?: string;
    }>;
  };
};

type BybitOpenInterestResponse = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: Array<{ openInterest?: string; timestamp?: string }>;
  };
};

type BybitFundingResponse = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: Array<{ fundingRate?: string; fundingRateTimestamp?: string }>;
  };
};

function finite(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(value?: number) {
  if (value === undefined) return undefined;
  return `${round(value, Math.abs(value) >= 10 ? 2 : 4)}%`;
}

function usd(value?: number) {
  if (value === undefined) return undefined;
  if (Math.abs(value) >= 1_000_000_000) return `$${round(value / 1_000_000_000, 2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${round(value / 1_000_000, 2)}M`;
  if (Math.abs(value) >= 1_000) return `$${round(value / 1_000, 1)}K`;
  return `$${round(value, 2)}`;
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizePass2466DerivativesPair(symbol?: string) {
  const clean = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return undefined;
  if (clean.endsWith("USDT")) return clean;
  if (clean.endsWith("USD")) return `${clean.slice(0, -3)}USDT`;
  return `${clean}USDT`;
}

function isCryptoDerivativesCandidate(result?: TokenRiskResult | null, symbol?: string) {
  const assetClass = result?.token.assetClass ?? "crypto";
  const tokenAddress = result?.token.tokenAddress;
  const clean = (symbol || result?.token.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean || tokenAddress) return false;
  return assetClass === "crypto" || assetClass === "unknown" || assetClass === undefined;
}

async function safeJson<T>(url: string, cacheSeconds: number): Promise<T> {
  const response = await brokeredEgressFetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: cacheSeconds },
  } as RequestInit & { next: { revalidate: number } }, { profile: "derivatives", operation: "derivatives_json", timeoutMs: 4_000 });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await readJsonResponseBounded<T>(response, 512 * 1024);
}

export async function fetchPass2466BinanceUsdmVenue(pair: string): Promise<Pass2466DerivativesVenueSnapshot> {
  try {
    const [openInterest, funding, ticker] = await Promise.all([
      safeJson<BinanceOpenInterestResponse>(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${encodeURIComponent(pair)}`, 20),
      safeJson<BinanceFundingResponse>(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${encodeURIComponent(pair)}&limit=1`, 120),
      safeJson<BinanceTickerResponse>(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(pair)}`, 20),
    ]);
    const oiBase = finite(openInterest.openInterest);
    const lastPrice = finite(ticker.lastPrice) ?? finite(ticker.markPrice);
    const openInterestUsd = oiBase !== undefined && lastPrice !== undefined ? oiBase * lastPrice : undefined;
    const fundingRate = finite(funding[0]?.fundingRate);
    const fundingRatePercent = fundingRate !== undefined ? fundingRate * 100 : undefined;
    const volume24hUsd = finite(ticker.quoteVolume);
    const priceChange24hPercent = finite(ticker.priceChangePercent);
    const observedAt = new Date(finite(openInterest.time) ?? finite(funding[0]?.fundingTime) ?? Date.now()).toISOString();
    const missingFields = unique([
      openInterestUsd === undefined && "open interest USD",
      fundingRatePercent === undefined && "funding rate",
      volume24hUsd === undefined && "24h futures volume",
      "liquidation feed",
      "account long/short ratio",
    ]);
    return {
      venue: "binance_usdm",
      label: "Binance USDⓈ-M Futures",
      symbol: pair,
      state: missingFields.length <= 2 ? "live" : "degraded",
      observedAt,
      openInterestUsd,
      openInterestBase: oiBase,
      fundingRate,
      fundingRatePercent,
      markPrice: finite(ticker.markPrice) ?? lastPrice,
      volume24hUsd,
      priceChange24hPercent,
      endpointProof: [
        "GET /fapi/v1/openInterest",
        "GET /fapi/v1/fundingRate?limit=1",
        "GET /fapi/v1/ticker/24hr",
      ],
      missingFields,
    };
  } catch (error) {
    return {
      venue: "binance_usdm",
      label: "Binance USDⓈ-M Futures",
      symbol: pair,
      state: "missing",
      endpointProof: ["GET /fapi/v1/openInterest", "GET /fapi/v1/fundingRate", "GET /fapi/v1/ticker/24hr"],
      missingFields: ["open interest", "funding rate", "futures volume", "liquidation feed", "long/short ratio"],
      error: error instanceof Error ? error.message : "Binance derivatives request failed",
    };
  }
}

export async function fetchPass2466BybitLinearVenue(pair: string): Promise<Pass2466DerivativesVenueSnapshot> {
  try {
    const [ticker, openInterest, funding] = await Promise.all([
      safeJson<BybitTickerResponse>(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(pair)}`, 20),
      safeJson<BybitOpenInterestResponse>(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${encodeURIComponent(pair)}&intervalTime=1h&limit=1`, 120),
      safeJson<BybitFundingResponse>(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(pair)}&limit=1`, 120),
    ]);
    const row = ticker.result?.list?.[0];
    const oiRow = openInterest.result?.list?.[0];
    const fundingRow = funding.result?.list?.[0];
    const markPrice = finite(row?.markPrice) ?? finite(row?.lastPrice);
    const indexPrice = finite(row?.indexPrice);
    const basisPercent = markPrice !== undefined && indexPrice !== undefined && indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : undefined;
    const openInterestUsd = finite(row?.openInterestValue);
    const openInterestBase = finite(row?.openInterest) ?? finite(oiRow?.openInterest);
    const fundingRate = finite(row?.fundingRate) ?? finite(fundingRow?.fundingRate);
    const fundingRatePercent = fundingRate !== undefined ? fundingRate * 100 : undefined;
    const price24hPcnt = finite(row?.price24hPcnt);
    const observedAtRaw = finite(oiRow?.timestamp) ?? finite(fundingRow?.fundingRateTimestamp);
    const missingFields = unique([
      openInterestUsd === undefined && openInterestBase === undefined && "open interest",
      fundingRatePercent === undefined && "funding rate",
      basisPercent === undefined && "mark/index basis",
      finite(row?.turnover24h) === undefined && "24h futures turnover",
      "liquidation feed",
      "account long/short ratio",
    ]);
    return {
      venue: "bybit_linear",
      label: "Bybit V5 Linear Perpetuals",
      symbol: pair,
      state: missingFields.length <= 2 ? "live" : "degraded",
      observedAt: new Date(observedAtRaw ?? Date.now()).toISOString(),
      openInterestUsd,
      openInterestBase,
      fundingRate,
      fundingRatePercent,
      markPrice,
      indexPrice,
      basisPercent,
      volume24hUsd: finite(row?.turnover24h),
      priceChange24hPercent: price24hPcnt !== undefined ? price24hPcnt * 100 : undefined,
      endpointProof: [
        "GET /v5/market/tickers?category=linear",
        "GET /v5/market/open-interest?category=linear",
        "GET /v5/market/funding/history?category=linear",
      ],
      missingFields,
      error: ticker.retCode && ticker.retCode !== 0 ? ticker.retMsg : undefined,
    };
  } catch (error) {
    return {
      venue: "bybit_linear",
      label: "Bybit V5 Linear Perpetuals",
      symbol: pair,
      state: "missing",
      endpointProof: ["GET /v5/market/tickers", "GET /v5/market/open-interest", "GET /v5/market/funding/history"],
      missingFields: ["open interest", "funding rate", "basis", "liquidation feed", "long/short ratio"],
      error: error instanceof Error ? error.message : "Bybit derivatives request failed",
    };
  }
}

function buildLanes(venues: Pass2466DerivativesVenueSnapshot[]): Pass2466DerivativesSqueezeLane[] {
  const liveVenues = venues.filter((venue) => venue.state === "live" || venue.state === "degraded");
  const openInterestEvidence = unique(liveVenues.map((venue) => venue.openInterestUsd !== undefined ? `${venue.label}: OI ${usd(venue.openInterestUsd)}` : venue.openInterestBase !== undefined ? `${venue.label}: OI base ${round(venue.openInterestBase, 2)}` : undefined));
  const fundingEvidence = unique(liveVenues.map((venue) => venue.fundingRatePercent !== undefined ? `${venue.label}: funding ${pct(venue.fundingRatePercent)}` : undefined));
  const basisEvidence = unique(liveVenues.map((venue) => venue.basisPercent !== undefined ? `${venue.label}: basis ${pct(venue.basisPercent)}` : undefined));
  const venuePairCount = liveVenues.length;
  return [
    {
      id: "open_interest",
      label: "Open interest proof",
      state: openInterestEvidence.length >= 2 ? "ready" : openInterestEvidence.length === 1 ? "watch" : "blocked",
      confirmedEvidence: openInterestEvidence,
      missingEvidence: unique([openInterestEvidence.length < 1 && "Binance/Bybit OI", openInterestEvidence.length < 2 && "second venue OI"]),
      copyBoundary: "Open interest is leverage context, not a buy/sell signal. Missing second venue caps Advanced squeeze wording.",
    },
    {
      id: "funding_basis",
      label: "Funding / basis pressure proof",
      state: fundingEvidence.length >= 2 || (fundingEvidence.length >= 1 && basisEvidence.length >= 1) ? "ready" : fundingEvidence.length ? "watch" : "blocked",
      confirmedEvidence: unique([...fundingEvidence, ...basisEvidence]),
      missingEvidence: unique([fundingEvidence.length < 2 && "second venue funding", basisEvidence.length < 1 && "mark/index basis"]),
      copyBoundary: "Funding/basis can describe crowding pressure only; it cannot predict liquidation or squeeze direction alone.",
    },
    {
      id: "venue_concordance",
      label: "Cross-venue derivatives concordance",
      state: venuePairCount >= 2 ? "ready" : venuePairCount === 1 ? "watch" : "blocked",
      confirmedEvidence: liveVenues.map((venue) => `${venue.label}: ${venue.state}`),
      missingEvidence: venuePairCount >= 2 ? [] : ["second derivatives venue"],
      copyBoundary: "Advanced must show if venues disagree instead of smoothing the result into one confident number.",
    },
    {
      id: "liquidation_gap",
      label: "Liquidation evidence gap",
      state: "blocked",
      confirmedEvidence: [],
      missingEvidence: ["liquidation feed", "forced order stream/snapshot", "liquidation cluster by side"],
      copyBoundary: "Without liquidation data, say squeeze-risk watch/pressure only, never 'squeeze confirmed'.",
    },
    {
      id: "long_short_ratio_gap",
      label: "Long/short ratio evidence gap",
      state: "blocked",
      confirmedEvidence: [],
      missingEvidence: ["top trader long/short account ratio", "global account ratio", "position ratio by venue"],
      copyBoundary: "Without long/short ratio, direction must remain unknown or weakly inferred from funding/basis.",
    },
    {
      id: "surface_lock",
      label: "Shield / PDF / Brain squeeze copy lock",
      state: liveVenues.length >= 2 ? "watch" : "blocked",
      confirmedEvidence: liveVenues.length >= 2 ? ["two venue derivatives packet available"] : [],
      missingEvidence: unique([liveVenues.length < 2 && "two live venue derivatives packet", "PDF/Shield/Brain shared fingerprint", "observedAt/maxAge badge"]),
      copyBoundary: "All surfaces must use the same derivatives packet and show missing liquidation/ratio proof before Advanced conclusions.",
    },
  ];
}

function inferDirection(venues: Pass2466DerivativesVenueSnapshot[]): Pass2466SqueezeDirection {
  const fundingValues = venues.map((venue) => venue.fundingRatePercent).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const basisValues = venues.map((venue) => venue.basisPercent).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const avgFunding = fundingValues.length ? fundingValues.reduce((sum, value) => sum + value, 0) / fundingValues.length : 0;
  const avgBasis = basisValues.length ? basisValues.reduce((sum, value) => sum + value, 0) / basisValues.length : 0;
  if (avgFunding > 0.05 || avgBasis > 0.25) return "long_pressure";
  if (avgFunding < -0.03 || avgBasis < -0.25) return "short_pressure";
  if (fundingValues.some((value) => Math.abs(value) > 0.03) || basisValues.some((value) => Math.abs(value) > 0.15)) return "two_sided_leverage";
  return "unknown";
}

export function buildPass2466DerivativesSqueezeProof(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  venues?: Pass2466DerivativesVenueSnapshot[];
  now?: Date;
}): Pass2466DerivativesSqueezeProof {
  const now = args.now ?? new Date();
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.result?.token.symbol ?? args.query);
  if (!isCryptoDerivativesCandidate(args.result, args.symbol ?? args.query) || !pair) {
    return {
      version: "derivatives-squeeze-proof-v1",
      state: "not_applicable",
      score: 0,
      query: args.query,
      symbol: args.symbol ?? args.result?.token.symbol,
      normalizedPair: pair,
      direction: "unknown",
      venues: [],
      lanes: [],
      advancedUnlockRule: "Derivatives squeeze proof is not applicable for non-crypto or DEX-only token scopes unless a perpetual venue mapping exists.",
      surfaceParityRule: "Real Markets stocks/FX/commodities must not show crypto derivatives squeeze proof as if it were applicable.",
      copyFirewall: ["No squeeze conclusion for non-applicable assets", "No trading instructions"],
      missingForWorldClass: ["perpetual venue mapping if this asset actually trades on derivatives venues"],
      nextImplementationActions: ["Add explicit per-asset futures venue mapping before showing this lane for DEX tokens or non-crypto assets."],
      generatedAt: now.toISOString(),
    };
  }
  const venues = args.venues ?? [];
  const lanes = buildLanes(venues);
  const readyLanes = lanes.filter((lane) => lane.state === "ready").length;
  const watchLanes = lanes.filter((lane) => lane.state === "watch").length;
  const blockedLanes = lanes.filter((lane) => lane.state === "blocked").length;
  const liveVenues = venues.filter((venue) => venue.state === "live" || venue.state === "degraded");
  const score = clamp(24 + liveVenues.length * 16 + readyLanes * 9 + watchLanes * 4 - blockedLanes * 7);
  const state: Pass2466DerivativesState = score >= 82 && blockedLanes <= 1 ? "ready" : score >= 48 ? "watch" : "blocked";
  const missingForWorldClass = unique([
    ...lanes.flatMap((lane) => lane.missingEvidence.map((item) => `${lane.label}: ${item}`)),
    liveVenues.length < 2 && "second derivatives venue live packet",
    "liquidation feed / forced-order replay",
    "top-trader and global long/short ratio",
    "orderbook depth paired with derivatives OI/funding timestamp",
    "surface fingerprint in Shield, PDF, Browser, VLM Brain and Angel",
  ]).slice(0, 14);
  return {
    version: "derivatives-squeeze-proof-v1",
    state,
    score,
    query: args.query,
    symbol: args.symbol ?? args.result?.token.symbol,
    normalizedPair: pair,
    direction: inferDirection(venues),
    venues,
    lanes,
    advancedUnlockRule: "Advanced can show long/short squeeze as a proof lane only when OI, funding/basis, second venue and missing liquidation/ratio locks are visible. Without them, copy must say pressure/watch, not confirmed squeeze.",
    surfaceParityRule: "Shield, Real Markets where applicable, Browser/PDF, VLM Brain and Angel must reuse this same derivatives packet/fingerprint before squeeze wording.",
    copyFirewall: [
      "Do not provide entry/exit/leverage instructions.",
      "Do not say squeeze confirmed without liquidation plus long/short ratio proof.",
      "Do not use spot volume alone as derivatives proof.",
      "Do not hide missing OI/funding/liquidation fields in Advanced.",
    ],
    missingForWorldClass,
    nextImplementationActions: [
      "Render PASS2466 derivatives proof strip in AssetDetailModal Advanced lane.",
      "Attach PASS2466 packet to Lens PDF Advanced appendix and Angel evidence context.",
      "Add liquidation and long/short ratio providers before allowing confirmed squeeze wording.",
      "Store observedAt/maxAge and normalizedPair in source-sync fingerprint.",
    ],
    generatedAt: now.toISOString(),
  };
}

export async function fetchPass2466DerivativesSqueezeProof(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  now?: Date;
  allowedVenues?: Pass2466DerivativesVenueId[];
}): Promise<Pass2466DerivativesSqueezeProof> {
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.result?.token.symbol ?? args.query);
  if (!pair || !isCryptoDerivativesCandidate(args.result, args.symbol ?? args.query)) {
    return buildPass2466DerivativesSqueezeProof({ ...args, venues: [], normalizedPair: undefined } as Parameters<typeof buildPass2466DerivativesSqueezeProof>[0]);
  }
  const allowedVenues = new Set<Pass2466DerivativesVenueId>(args.allowedVenues ?? ["binance_usdm", "bybit_linear"]);
  const venueDefinitions = [
    { id: "binance_usdm" as const, label: "Binance USDⓈ-M Futures", run: () => fetchPass2466BinanceUsdmVenue(pair), endpointProof: ["GET /fapi/v1/openInterest", "GET /fapi/v1/fundingRate", "GET /fapi/v1/ticker/24hr"] },
    { id: "bybit_linear" as const, label: "Bybit V5 Linear Perpetuals", run: () => fetchPass2466BybitLinearVenue(pair), endpointProof: ["GET /v5/market/tickers", "GET /v5/market/open-interest", "GET /v5/market/funding/history"] },
  ];
  const venues = await Promise.all(venueDefinitions.map(async (definition): Promise<Pass2466DerivativesVenueSnapshot> => {
    if (!allowedVenues.has(definition.id)) {
      return {
        venue: definition.id,
        label: definition.label,
        symbol: pair,
        state: "missing",
        endpointProof: definition.endpointProof,
        missingFields: ["open interest", "funding rate", "basis", "liquidation feed", "long/short ratio"],
        error: "blocked_by_provider_health_runtime_plan",
      };
    }
    try {
      return await definition.run();
    } catch (error) {
      return {
        venue: definition.id,
        label: definition.label,
        symbol: pair,
        state: "missing",
        endpointProof: definition.endpointProof,
        missingFields: ["open interest", "funding rate", "basis", "liquidation feed", "long/short ratio"],
        error: error instanceof Error ? error.message : "derivatives venue request failed",
      };
    }
  }));
  return buildPass2466DerivativesSqueezeProof({ ...args, venues });
}
