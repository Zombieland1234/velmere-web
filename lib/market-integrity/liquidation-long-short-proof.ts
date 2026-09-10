import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import type { TokenRiskResult } from "./risk-types";
import { buildPass2466DerivativesSqueezeProof, normalizePass2466DerivativesPair, type Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";

export type Pass2467VenueId = "binance_usdm" | "bybit_linear";
export type Pass2467State = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2467SqueezeCopyMode = "blocked_confirmed_squeeze" | "pressure_watch_only" | "not_applicable";

export type Pass2467LongShortSnapshot = {
  venue: Pass2467VenueId;
  label: string;
  symbol: string;
  state: "live" | "degraded" | "missing";
  observedAt?: string;
  longAccountPercent?: number;
  shortAccountPercent?: number;
  longShortRatio?: number;
  topTraderLongAccountPercent?: number;
  topTraderShortAccountPercent?: number;
  topTraderLongShortRatio?: number;
  endpointProof: string[];
  missingFields: string[];
  error?: string;
};

export type Pass2467LiquidationSnapshot = {
  venue: Pass2467VenueId;
  label: string;
  symbol: string;
  state: "stream_required" | "collector_attached" | "missing";
  observedAt?: string;
  liquidationStreamName: string;
  endpointProof: string[];
  confirmedFields: string[];
  missingFields: string[];
  copyBoundary: string;
  error?: string;
};

export type Pass2467ProofLane = {
  id: "global_long_short_ratio" | "top_trader_ratio" | "liquidation_stream_lock" | "cross_venue_ratio_concordance" | "confirmed_squeeze_lock" | "surface_parity_lock";
  label: string;
  state: Pass2467State;
  confirmedEvidence: string[];
  missingEvidence: string[];
  copyBoundary: string;
};

export type Pass2467LiquidationLongShortProof = {
  version: "liquidation-long-short-proof-v1";
  state: Pass2467State;
  score: number;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  copyMode: Pass2467SqueezeCopyMode;
  confirmedSqueezeAllowed: boolean;
  longShortSnapshots: Pass2467LongShortSnapshot[];
  liquidationSnapshots: Pass2467LiquidationSnapshot[];
  lanes: Pass2467ProofLane[];
  pass2466Bridge: {
    state: Pass2466DerivativesSqueezeProof["state"];
    score: number;
    direction: Pass2466DerivativesSqueezeProof["direction"];
    normalizedPair?: string;
    missingLocks: string[];
  };
  advancedUnlockRule: string;
  surfaceParityRule: string;
  copyFirewall: string[];
  missingForWorldClass: string[];
  nextImplementationActions: string[];
  generatedAt: string;
};

type BinanceLongShortResponse = Array<{
  symbol?: string;
  longAccount?: string;
  longShortRatio?: string;
  shortAccount?: string;
  timestamp?: string | number;
}>;

type BybitLongShortResponse = {
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: Array<{
      symbol?: string;
      buyRatio?: string;
      sellRatio?: string;
      timestamp?: string;
    }>;
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

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isCryptoPerpCandidate(result?: TokenRiskResult | null, symbol?: string) {
  const clean = (symbol || result?.token.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const assetClass = result?.token.assetClass ?? "crypto";
  if (!clean || result?.token.tokenAddress) return false;
  return assetClass === "crypto" || assetClass === "unknown" || assetClass === undefined;
}

async function safeJson<T>(url: string, cacheSeconds: number): Promise<T> {
  const response = await brokeredEgressFetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: cacheSeconds },
  } as RequestInit & { next: { revalidate: number } }, { profile: "derivatives", operation: "long_short_json", timeoutMs: 4_000 });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await readJsonResponseBounded<T>(response, 512 * 1024);
}

function observedAtFrom(value?: string | number) {
  const ms = finite(value);
  return new Date(ms && ms > 0 ? ms : Date.now()).toISOString();
}

export async function fetchPass2467BinanceLongShortSnapshot(pair: string): Promise<Pass2467LongShortSnapshot> {
  try {
    const [globalRows, topRows] = await Promise.all([
      safeJson<BinanceLongShortResponse>(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(pair)}&period=5m&limit=1`, 60),
      safeJson<BinanceLongShortResponse>(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${encodeURIComponent(pair)}&period=5m&limit=1`, 60),
    ]);
    const row = globalRows[0];
    const topRow = topRows[0];
    const longAccount = finite(row?.longAccount);
    const shortAccount = finite(row?.shortAccount);
    const topLongAccount = finite(topRow?.longAccount);
    const topShortAccount = finite(topRow?.shortAccount);
    const longShortRatio = finite(row?.longShortRatio) ?? (longAccount !== undefined && shortAccount ? longAccount / shortAccount : undefined);
    const topTraderLongShortRatio = finite(topRow?.longShortRatio) ?? (topLongAccount !== undefined && topShortAccount ? topLongAccount / topShortAccount : undefined);
    const missingFields = unique([
      longAccount === undefined && "global long account ratio",
      shortAccount === undefined && "global short account ratio",
      longShortRatio === undefined && "global long/short ratio",
      topTraderLongShortRatio === undefined && "top trader long/short ratio",
    ]);
    return {
      venue: "binance_usdm",
      label: "Binance USDⓈ-M Futures long/short ratio",
      symbol: pair,
      state: missingFields.length <= 1 ? "live" : "degraded",
      observedAt: observedAtFrom(row?.timestamp ?? topRow?.timestamp),
      longAccountPercent: longAccount !== undefined ? longAccount * 100 : undefined,
      shortAccountPercent: shortAccount !== undefined ? shortAccount * 100 : undefined,
      longShortRatio,
      topTraderLongAccountPercent: topLongAccount !== undefined ? topLongAccount * 100 : undefined,
      topTraderShortAccountPercent: topShortAccount !== undefined ? topShortAccount * 100 : undefined,
      topTraderLongShortRatio,
      endpointProof: [
        "GET /futures/data/globalLongShortAccountRatio?period=5m&limit=1",
        "GET /futures/data/topLongShortAccountRatio?period=5m&limit=1",
      ],
      missingFields,
    };
  } catch (error) {
    return {
      venue: "binance_usdm",
      label: "Binance USDⓈ-M Futures long/short ratio",
      symbol: pair,
      state: "missing",
      endpointProof: [
        "GET /futures/data/globalLongShortAccountRatio",
        "GET /futures/data/topLongShortAccountRatio",
      ],
      missingFields: ["global long/short ratio", "top trader long/short ratio"],
      error: error instanceof Error ? error.message : "Binance long/short request failed",
    };
  }
}

export async function fetchPass2467BybitLongShortSnapshot(pair: string): Promise<Pass2467LongShortSnapshot> {
  try {
    const payload = await safeJson<BybitLongShortResponse>(`https://api.bybit.com/v5/market/long-short-ratio?category=linear&symbol=${encodeURIComponent(pair)}&period=5min&limit=1`, 60);
    const row = payload.result?.list?.[0];
    const longAccount = finite(row?.buyRatio);
    const shortAccount = finite(row?.sellRatio);
    const longShortRatio = longAccount !== undefined && shortAccount ? longAccount / shortAccount : undefined;
    const missingFields = unique([
      longAccount === undefined && "long account ratio",
      shortAccount === undefined && "short account ratio",
      longShortRatio === undefined && "long/short ratio",
      "top trader split",
    ]);
    return {
      venue: "bybit_linear",
      label: "Bybit V5 Linear long/short ratio",
      symbol: pair,
      state: payload.retCode && payload.retCode !== 0 ? "degraded" : missingFields.length <= 1 ? "live" : "degraded",
      observedAt: observedAtFrom(row?.timestamp),
      longAccountPercent: longAccount !== undefined ? longAccount * 100 : undefined,
      shortAccountPercent: shortAccount !== undefined ? shortAccount * 100 : undefined,
      longShortRatio,
      endpointProof: ["GET /v5/market/long-short-ratio?category=linear&period=5min&limit=1"],
      missingFields,
      error: payload.retCode && payload.retCode !== 0 ? payload.retMsg : undefined,
    };
  } catch (error) {
    return {
      venue: "bybit_linear",
      label: "Bybit V5 Linear long/short ratio",
      symbol: pair,
      state: "missing",
      endpointProof: ["GET /v5/market/long-short-ratio?category=linear"],
      missingFields: ["long account ratio", "short account ratio", "long/short ratio"],
      error: error instanceof Error ? error.message : "Bybit long/short request failed",
    };
  }
}

export function buildPass2467LiquidationStreamLocks(pair: string): Pass2467LiquidationSnapshot[] {
  const lowerPair = pair.toLowerCase();
  return [
    {
      venue: "binance_usdm",
      label: "Binance USDⓈ-M liquidation stream lock",
      symbol: pair,
      state: "stream_required",
      liquidationStreamName: `${lowerPair}@forceOrder`,
      endpointProof: ["wss://fstream.binance.com/ws/<symbol>@forceOrder", "wss://fstream.binance.com/ws/!forceOrder@arr"],
      confirmedFields: ["official liquidation stream path known"],
      missingFields: ["runtime WebSocket collector", "side/quantity/notional aggregation", "max-age storage", "PDF/Shield fingerprint replay"],
      copyBoundary: "Liquidation proof requires a running collector or cached signed snapshot. REST ratio data alone cannot confirm liquidations.",
    },
    {
      venue: "bybit_linear",
      label: "Bybit liquidation proof lock",
      symbol: pair,
      state: "stream_required",
      liquidationStreamName: "public liquidation stream or vendor collector required",
      endpointProof: ["Bybit public market WebSocket collector required", "No fabricated liquidation snapshot"],
      confirmedFields: [],
      missingFields: ["Bybit liquidation event collector", "side/quantity/notional aggregation", "max-age storage", "cross-venue liquidation agreement"],
      copyBoundary: "Bybit long/short and OI can support pressure context, but liquidation clusters need a separate event collector.",
    },
  ];
}

function buildLanes(args: {
  longShortSnapshots: Pass2467LongShortSnapshot[];
  liquidationSnapshots: Pass2467LiquidationSnapshot[];
  pass2466: Pass2466DerivativesSqueezeProof;
}): Pass2467ProofLane[] {
  const liveRatios = args.longShortSnapshots.filter((snapshot) => snapshot.state === "live" || snapshot.state === "degraded");
  const ratioEvidence = unique(liveRatios.map((snapshot) => snapshot.longShortRatio !== undefined ? `${snapshot.label}: ratio ${round(snapshot.longShortRatio, 3)} (${pct(snapshot.longAccountPercent)} long / ${pct(snapshot.shortAccountPercent)} short)` : undefined));
  const topRatioEvidence = unique(liveRatios.map((snapshot) => snapshot.topTraderLongShortRatio !== undefined ? `${snapshot.label}: top trader ratio ${round(snapshot.topTraderLongShortRatio, 3)}` : undefined));
  const streamEvidence = unique(args.liquidationSnapshots.flatMap((snapshot) => snapshot.confirmedFields.map((field) => `${snapshot.label}: ${field}`)));
  const liquidationCollectorReady = args.liquidationSnapshots.some((snapshot) => snapshot.state === "collector_attached");
  const pass2466Ready = args.pass2466.state === "ready" || args.pass2466.state === "watch";
  return [
    {
      id: "global_long_short_ratio",
      label: "Global long/short account ratio",
      state: ratioEvidence.length >= 2 ? "ready" : ratioEvidence.length === 1 ? "watch" : "blocked",
      confirmedEvidence: ratioEvidence,
      missingEvidence: unique([ratioEvidence.length < 1 && "Binance/Bybit global long-short ratio", ratioEvidence.length < 2 && "second venue long-short ratio"]),
      copyBoundary: "Long/short account ratio can describe crowd positioning only. It is not a signal to open a leveraged trade.",
    },
    {
      id: "top_trader_ratio",
      label: "Top trader positioning ratio",
      state: topRatioEvidence.length ? "watch" : "blocked",
      confirmedEvidence: topRatioEvidence,
      missingEvidence: unique([!topRatioEvidence.length && "top trader long/short ratio", "second venue top-trader split if available"]),
      copyBoundary: "Top trader ratio is context only and must be separated from retail/global ratio.",
    },
    {
      id: "liquidation_stream_lock",
      label: "Liquidation stream proof lock",
      state: liquidationCollectorReady ? "ready" : streamEvidence.length ? "watch" : "blocked",
      confirmedEvidence: streamEvidence,
      missingEvidence: unique(args.liquidationSnapshots.flatMap((snapshot) => snapshot.missingFields)).slice(0, 10),
      copyBoundary: "Confirmed squeeze wording is blocked until liquidation events are collected, aggregated and timestamped.",
    },
    {
      id: "cross_venue_ratio_concordance",
      label: "Cross-venue long/short concordance",
      state: ratioEvidence.length >= 2 ? "ready" : ratioEvidence.length === 1 ? "watch" : "blocked",
      confirmedEvidence: ratioEvidence,
      missingEvidence: ratioEvidence.length >= 2 ? [] : ["second venue ratio agreement"],
      copyBoundary: "If venues disagree, Advanced must show the disagreement instead of smoothing it into one confident direction.",
    },
    {
      id: "confirmed_squeeze_lock",
      label: "Confirmed squeeze copy lock",
      state: pass2466Ready && ratioEvidence.length >= 2 && liquidationCollectorReady ? "ready" : pass2466Ready && ratioEvidence.length ? "watch" : "blocked",
      confirmedEvidence: unique([pass2466Ready && `PASS2466 OI/funding bridge ${args.pass2466.state}:${args.pass2466.score}`, ...ratioEvidence.slice(0, 2), liquidationCollectorReady && "liquidation collector attached"]),
      missingEvidence: unique([!pass2466Ready && "PASS2466 OI/funding bridge", ratioEvidence.length < 2 && "two venue long/short ratio", !liquidationCollectorReady && "liquidation collector/snapshot"]),
      copyBoundary: "If this lane is not ready, surfaces must say pressure/watch only and must not say confirmed squeeze.",
    },
    {
      id: "surface_parity_lock",
      label: "Shield / PDF / Brain / Angel parity lock",
      state: pass2466Ready && ratioEvidence.length ? "watch" : "blocked",
      confirmedEvidence: unique([pass2466Ready && "PASS2466 bridge available", ratioEvidence.length > 0 && "PASS2467 ratio packet available"]),
      missingEvidence: ["shared fingerprint in Shield modal", "PDF Advanced appendix", "Angel context lane", "observedAt/max-age badge"],
      copyBoundary: "All surfaces must show the same ratio/liquidation lock, otherwise Advanced cannot claim paid evidence parity.",
    },
  ];
}

export function buildPass2467LiquidationLongShortProof(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  longShortSnapshots?: Pass2467LongShortSnapshot[];
  liquidationSnapshots?: Pass2467LiquidationSnapshot[];
  now?: Date;
}): Pass2467LiquidationLongShortProof {
  const now = args.now ?? new Date();
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.result?.token.symbol ?? args.query);
  const pass2466 = args.pass2466 ?? buildPass2466DerivativesSqueezeProof({ query: args.query, symbol: args.symbol ?? args.result?.token.symbol, result: args.result, now });
  if (!pair || !isCryptoPerpCandidate(args.result, args.symbol ?? args.query)) {
    return {
      version: "liquidation-long-short-proof-v1",
      state: "not_applicable",
      score: 0,
      query: args.query,
      symbol: args.symbol ?? args.result?.token.symbol,
      normalizedPair: pair,
      copyMode: "not_applicable",
      confirmedSqueezeAllowed: false,
      longShortSnapshots: [],
      liquidationSnapshots: [],
      lanes: [],
      pass2466Bridge: {
        state: pass2466.state,
        score: pass2466.score,
        direction: pass2466.direction,
        normalizedPair: pass2466.normalizedPair,
        missingLocks: pass2466.missingForWorldClass.slice(0, 8),
      },
      advancedUnlockRule: "PASS2467 applies only to crypto assets with a mapped perpetual derivatives pair.",
      surfaceParityRule: "Real Markets non-crypto assets must hide crypto squeeze proof unless a real derivatives venue mapping exists.",
      copyFirewall: ["No squeeze conclusion for non-applicable assets", "No trading/leverage instructions"],
      missingForWorldClass: ["explicit perpetual venue mapping"],
      nextImplementationActions: ["Add a per-asset futures venue map before enabling derivatives squeeze lanes for this asset."],
      generatedAt: now.toISOString(),
    };
  }
  const longShortSnapshots = args.longShortSnapshots ?? [];
  const liquidationSnapshots = args.liquidationSnapshots ?? buildPass2467LiquidationStreamLocks(pair);
  const lanes = buildLanes({ longShortSnapshots, liquidationSnapshots, pass2466 });
  const readyLanes = lanes.filter((lane) => lane.state === "ready").length;
  const watchLanes = lanes.filter((lane) => lane.state === "watch").length;
  const blockedLanes = lanes.filter((lane) => lane.state === "blocked").length;
  const liveRatioVenues = longShortSnapshots.filter((snapshot) => snapshot.state === "live" || snapshot.state === "degraded").length;
  const liquidationReady = liquidationSnapshots.some((snapshot) => snapshot.state === "collector_attached");
  const score = clamp(18 + liveRatioVenues * 18 + readyLanes * 9 + watchLanes * 5 + (liquidationReady ? 18 : 0) - blockedLanes * 8);
  const confirmedSqueezeAllowed = pass2466.state === "ready" && liveRatioVenues >= 2 && liquidationReady && lanes.some((lane) => lane.id === "confirmed_squeeze_lock" && lane.state === "ready");
  const state: Pass2467State = confirmedSqueezeAllowed ? "ready" : score >= 46 ? "watch" : "blocked";
  const missingForWorldClass = unique([
    ...lanes.flatMap((lane) => lane.missingEvidence.map((item) => `${lane.label}: ${item}`)),
    pass2466.state !== "ready" && "PASS2466 OI/funding bridge ready state",
    liveRatioVenues < 2 && "two-venue long/short account ratio",
    !liquidationReady && "live liquidation collector / signed liquidation snapshot",
    "max-age / observedAt badge visible in Shield, PDF, Brain and Angel",
    "direction confidence separated from risk score",
    "no leverage or entry/exit wording",
  ]).slice(0, 16);
  return {
    version: "liquidation-long-short-proof-v1",
    state,
    score,
    query: args.query,
    symbol: args.symbol ?? args.result?.token.symbol,
    normalizedPair: pair,
    copyMode: confirmedSqueezeAllowed ? "pressure_watch_only" : "blocked_confirmed_squeeze",
    confirmedSqueezeAllowed,
    longShortSnapshots,
    liquidationSnapshots,
    lanes,
    pass2466Bridge: {
      state: pass2466.state,
      score: pass2466.score,
      direction: pass2466.direction,
      normalizedPair: pass2466.normalizedPair,
      missingLocks: pass2466.missingForWorldClass.slice(0, 8),
    },
    advancedUnlockRule: "Advanced can show a long/short squeeze lane only as pressure/watch until PASS2466 OI/funding, two-venue long/short ratio and a timestamped liquidation collector are all present.",
    surfaceParityRule: "Shield, Browser/PDF, VLM Brain and Angel must reuse this exact PASS2467 ratio/liquidation lock before any squeeze wording.",
    copyFirewall: [
      "Do not say squeeze confirmed unless confirmedSqueezeAllowed is true.",
      "Do not turn long/short ratio into entry, exit, leverage or liquidation advice.",
      "Do not hide missing liquidation collector status in Advanced.",
      "Do not use spot volume as a replacement for derivatives ratio/liquidation proof.",
    ],
    missingForWorldClass,
    nextImplementationActions: [
      "Add a server-side liquidation WebSocket collector that writes signed snapshots to the source cache.",
      "Render PASS2467 ratio/liquidation locks in Shield Advanced and PDF Advanced appendix.",
      "Attach PASS2467 to Angel evidence context before market/squeeze answers.",
      "Store ratio/liquidation observedAt and maxAge in the shared source-sync fingerprint.",
    ],
    generatedAt: now.toISOString(),
  };
}

export async function fetchPass2467LiquidationLongShortProof(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  now?: Date;
  allowedVenues?: Pass2467VenueId[];
}): Promise<Pass2467LiquidationLongShortProof> {
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.result?.token.symbol ?? args.query);
  const pass2466 = args.pass2466 ?? buildPass2466DerivativesSqueezeProof({ query: args.query, symbol: args.symbol ?? args.result?.token.symbol, result: args.result, now: args.now });
  if (!pair || !isCryptoPerpCandidate(args.result, args.symbol ?? args.query)) {
    return buildPass2467LiquidationLongShortProof({ ...args, pass2466 });
  }
  const allowedVenues = new Set<Pass2467VenueId>(args.allowedVenues ?? ["binance_usdm", "bybit_linear"]);
  const blockedSnapshot = (venue: Pass2467VenueId): Pass2467LongShortSnapshot => ({
    venue,
    label: venue === "binance_usdm" ? "Binance USDⓈ-M Futures long/short ratio" : "Bybit V5 Linear long/short ratio",
    symbol: pair,
    state: "missing",
    endpointProof: venue === "binance_usdm"
      ? ["GET /futures/data/globalLongShortAccountRatio", "GET /futures/data/topLongShortAccountRatio"]
      : ["GET /v5/market/long-short-ratio?category=linear"],
    missingFields: ["global long/short ratio", "top trader long/short ratio"],
    error: "blocked_by_provider_health_runtime_plan",
  });
  const [binance, bybit] = await Promise.all([
    allowedVenues.has("binance_usdm") ? fetchPass2467BinanceLongShortSnapshot(pair) : Promise.resolve(blockedSnapshot("binance_usdm")),
    allowedVenues.has("bybit_linear") ? fetchPass2467BybitLongShortSnapshot(pair) : Promise.resolve(blockedSnapshot("bybit_linear")),
  ]);
  return buildPass2467LiquidationLongShortProof({
    ...args,
    pass2466,
    longShortSnapshots: [binance, bybit],
    liquidationSnapshots: buildPass2467LiquidationStreamLocks(pair).map((snapshot) => allowedVenues.has(snapshot.venue)
      ? snapshot
      : { ...snapshot, state: "missing" as const, confirmedFields: [], error: "blocked_by_provider_health_runtime_plan" }),
  });
}
