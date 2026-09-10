import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";
import type { Pass2476RuntimeReceiptPdfHashRunner } from "./runtime-receipt-pdf-hash-runner";

export const PASS2483_PREMIUM_EVIDENCE_BRIDGE_ID = "premium-evidence-bridge-v1" as const;

export type Pass2483PremiumBridgeState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2483AssetFamily = "native_crypto" | "token_contract" | "real_market_stock" | "real_market_etf" | "real_market_other" | "unknown";
export type Pass2483PremiumLaneId =
  | "crypto_orderbook_slippage_receipt"
  | "crypto_derivatives_receipt"
  | "crypto_long_short_liquidation_receipt"
  | "crypto_holder_supply_receipt"
  | "real_market_second_provider_timestamp"
  | "real_market_fundamental_filing_receipt"
  | "runtime_surface_receipt";

export type Pass2483PremiumEvidenceLane = {
  id: Pass2483PremiumLaneId;
  label: string;
  appliesTo: Pass2483AssetFamily[];
  state: Pass2483PremiumBridgeState;
  paidAdvancedBlocker: boolean;
  confirmedEvidence: string[];
  missingEvidence: string[];
  sourceContracts: string[];
  customerCopyRule: string;
};

export type Pass2483SurfaceAction = {
  surface: "shield" | "real_markets" | "pdf" | "browser" | "angel";
  state: Pass2483PremiumBridgeState;
  headline: string;
  mustShow: string[];
  mustNotSay: string[];
};

export type Pass2483PremiumEvidenceBridge = {
  version: typeof PASS2483_PREMIUM_EVIDENCE_BRIDGE_ID;
  state: Pass2483PremiumBridgeState;
  query?: string;
  symbol?: string;
  assetFamily: Pass2483AssetFamily;
  premiumEvidenceScore: number;
  paidAdvancedCandidate: boolean;
  paidAdvancedConclusionAllowed: boolean;
  lanes: Pass2483PremiumEvidenceLane[];
  paidBlockers: string[];
  readyEvidence: string[];
  missingEvidence: string[];
  surfaceActions: Pass2483SurfaceAction[];
  advancedUpgradeRule: string;
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._/-]/g, "").slice(0, 32);
}

function familyFor(result?: TokenRiskResult | null, symbol?: string): Pass2483AssetFamily {
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "exchange_equity") return "real_market_stock";
  if (assetClass === "etf" || ["SPY", "QQQ", "VOO", "GLD", "VNQ"].includes(normalized)) return "real_market_etf";
  if (assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "index") return "real_market_other";
  if (result?.token.tokenAddress || result?.token.chainId || result?.token.pairAddress || result?.token.dexId) return "token_contract";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK"].includes(normalized)) return "native_crypto";
  if (assetClass === "crypto") return "native_crypto";
  return "unknown";
}

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (Math.abs(value) >= 1_000_000_000) return `$${Math.round((value / 1_000_000_000) * 100) / 100}B`;
  if (Math.abs(value) >= 1_000_000) return `$${Math.round((value / 1_000_000) * 100) / 100}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round((value / 1_000) * 10) / 10}K`;
  return `$${Math.round(value * 100) / 100}`;
}

function percent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return `${Math.round(value * 1000) / 1000}%`;
}

function laneState(readyEvidence: string[], watchEvidence: string[], missingEvidence: string[], required: boolean): Pass2483PremiumBridgeState {
  if (!required) return "not_applicable";
  if (readyEvidence.length >= 2 && missingEvidence.length <= 1) return "ready";
  if (readyEvidence.length || watchEvidence.length) return "watch";
  return "blocked";
}

function isCrypto(family: Pass2483AssetFamily) {
  return family === "native_crypto" || family === "token_contract";
}

function isRealMarket(family: Pass2483AssetFamily) {
  return family === "real_market_stock" || family === "real_market_etf" || family === "real_market_other";
}

function hasSource(result: TokenRiskResult | null | undefined, pattern: RegExp) {
  return (result?.dataSources ?? []).some((source) => pattern.test(source));
}

function limitations(result?: TokenRiskResult | null) {
  return unique([...(result?.metaModel?.limitations ?? []), ...((result as TokenRiskResult & { limitations?: string[] } | null | undefined)?.limitations ?? [])]);
}

function buildLanes(args: {
  family: Pass2483AssetFamily;
  result?: TokenRiskResult | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
}): Pass2483PremiumEvidenceLane[] {
  const crypto = isCrypto(args.family);
  const real = isRealMarket(args.family);
  const stockOrEtf = args.family === "real_market_stock" || args.family === "real_market_etf";
  const metricEvidence = unique([
    args.result?.metrics.liquidityUsd !== undefined && `liquidity ${money(args.result.metrics.liquidityUsd)}`,
    args.result?.metrics.volume24h !== undefined && `24h volume ${money(args.result.metrics.volume24h)}`,
    args.result?.metrics.volumeToMarketCapRatio !== undefined && `volume/market-cap ${percent(args.result.metrics.volumeToMarketCapRatio)}`,
    args.result?.metrics.bidAskImbalancePercent !== undefined && `bid/ask imbalance ${percent(args.result.metrics.bidAskImbalancePercent)}`,
    args.result?.metrics.simulatedSlippage10k !== undefined && `10k slippage ${percent(args.result.metrics.simulatedSlippage10k)}`,
  ]);
  const orderbookReady = unique([
    args.result?.metrics.simulatedSlippage10k !== undefined && "10k slippage metric attached",
    args.result?.metrics.bidAskImbalancePercent !== undefined && "bid/ask imbalance metric attached",
    hasSource(args.result, /orderbook|binance|bybit|venue/i) && "venue/orderbook source label present",
  ]);
  const orderbookWatch = unique([
    args.result?.metrics.liquidityUsd !== undefined && "liquidity proxy attached",
    args.result?.metrics.volume24h !== undefined && "volume proxy attached",
    metricEvidence.length > 0 && "market microstructure proxy available",
  ]);
  const orderbookMissing = unique([
    !orderbookReady.includes("10k slippage metric attached") && "buy/sell 10k slippage simulation",
    !orderbookReady.includes("bid/ask imbalance metric attached") && "real bid/ask depth + imbalance",
    !hasSource(args.result, /orderbook|binance|bybit|venue/i) && "venue depth adapter proof",
  ]);

  const derivativeVenueEvidence = args.pass2466?.venues
    .filter((venue) => venue.state === "live" || venue.state === "degraded")
    .map((venue) => `${venue.label}: ${venue.observedAt ?? "observedAt missing"} · OI ${money(venue.openInterestUsd)} · funding ${percent(venue.fundingRatePercent)}`) ?? [];
  const derivativeLaneEvidence = args.pass2466?.lanes
    .filter((lane) => lane.state === "ready" || lane.state === "watch")
    .map((lane) => `${lane.label}: ${lane.state}`) ?? [];
  const derivativeMissing = unique([
    ...(args.pass2466?.missingForWorldClass ?? []),
    derivativeVenueEvidence.length < 2 && "second derivatives venue live packet",
    args.pass2466?.state !== "ready" && "PASS2466 ready state for paid Advanced",
  ]).slice(0, 10);

  const ratioEvidence = args.pass2467?.longShortSnapshots
    .filter((snapshot) => snapshot.state === "live" || snapshot.state === "degraded")
    .map((snapshot) => `${snapshot.label}: ratio ${snapshot.longShortRatio ?? "missing"} · ${snapshot.observedAt ?? "observedAt missing"}`) ?? [];
  const liquidationEvidence = unique([
    ...(args.pass2467?.liquidationSnapshots ?? []).filter((snapshot) => snapshot.state === "collector_attached").map((snapshot) => `${snapshot.label}: collector attached`),
    ...(args.pass2468?.snapshots ?? []).filter((snapshot) => snapshot.state === "signed_snapshot").map((snapshot) => `${snapshot.label}: ${snapshot.eventCount} events · age ${snapshot.ageSeconds}s`),
    args.pass2469?.freshReplayCount ? `fresh replay records ${args.pass2469.freshReplayCount}` : null,
    args.pass2469?.twoVenueReplayReady && "two-venue liquidation replay ready",
  ]);
  const longShortMissing = unique([
    ...(args.pass2467?.missingForWorldClass ?? []),
    ...(args.pass2468?.missingForWorldClass ?? []),
    ...(args.pass2469?.missingForWorldClass ?? []),
    !args.pass2467?.confirmedSqueezeAllowed && "confirmed squeeze lock remains blocked",
    !args.pass2469?.twoVenueReplayReady && "two-venue durable liquidation replay",
  ]).slice(0, 12);

  const holderReady = unique([
    args.result?.metrics.holderCount !== undefined && `holder count ${args.result.metrics.holderCount}`,
    args.result?.metrics.top10HolderPercent !== undefined && `top 10 holder concentration ${percent(args.result.metrics.top10HolderPercent)}`,
    args.result?.metrics.circulatingSupply !== undefined && "circulating supply attached",
    args.result?.metrics.totalSupply !== undefined && "total supply attached",
    args.result?.metrics.maxSupply !== undefined && "max supply attached",
  ]);
  const holderMissing = unique([
    args.result?.metrics.holderCount === undefined && "holder count snapshot",
    args.result?.metrics.top10HolderPercent === undefined && "top-holder concentration snapshot",
    args.result?.metrics.circulatingSupply === undefined && "circulating supply",
    args.result?.metrics.totalSupply === undefined && "total supply / emission context",
    "unlock/emission schedule where applicable",
  ]);

  const yahoo = hasSource(args.result, /yahoo/i);
  const stooq = hasSource(args.result, /stooq/i);
  const generatedAt = args.result?.generatedAt;
  const realSecondReady = unique([
    yahoo && "Yahoo quote/chart provider family present",
    stooq && "Stooq independent second quote present",
    generatedAt && `result timestamp ${generatedAt}`,
  ]);
  const realSecondMissing = unique([
    !yahoo && "primary Yahoo quote/chart provider",
    !stooq && "independent Stooq second quote provider",
    !generatedAt && "observedAt/generatedAt timestamp",
    "quote/chart parity receipt",
    "source cadence receipt",
  ]);

  const realFilingReady = unique([
    hasSource(args.result, /sec|xbrl/i) && "SEC/XBRL source label present",
    hasSource(args.result, /alpha vantage|fundamental/i) && "fundamentals provider source label present",
    limitations(args.result).some((item) => /filing|fundamental|xbrl/i.test(item)) && "filing/fundamental limitation surfaced instead of hidden",
  ]);
  const realFilingMissing = unique([
    !hasSource(args.result, /sec|xbrl/i) && "SEC/XBRL companyfacts or filing link",
    !hasSource(args.result, /alpha vantage|fundamental/i) && "fundamentals provider snapshot",
    "filing freshness / latest report date",
    "earnings/calendar/news event lane",
    args.family === "real_market_etf" && "ETF holdings/exposure freshness",
  ]);

  const pdfHashReady = (args.pass2476?.pdfHashCoveragePercent ?? 0) >= 70;
  const runtimeReady = (args.pass2476?.runtimeCapturedCoveragePercentAfterRun ?? 0) >= 70;
  const runtimeEvidence = unique([
    args.pass2476 !== undefined && args.pass2476 !== null && `PDF hash coverage ${args.pass2476.pdfHashCoveragePercent}%`,
    args.pass2476 !== undefined && args.pass2476 !== null && `runtime capture coverage ${args.pass2476.runtimeCapturedCoveragePercentAfterRun}%`,
    args.pass2476?.state && `PASS2476 ${args.pass2476.state}`,
  ]);

  return [
    {
      id: "crypto_orderbook_slippage_receipt",
      label: "Orderbook + 10k slippage receipt",
      appliesTo: ["native_crypto", "token_contract"],
      state: laneState(orderbookReady, orderbookWatch, orderbookMissing, crypto),
      paidAdvancedBlocker: crypto && !(orderbookReady.length >= 2 && orderbookMissing.length <= 1),
      confirmedEvidence: unique([...orderbookReady, ...orderbookWatch, ...metricEvidence]).slice(0, 8),
      missingEvidence: orderbookMissing.slice(0, 8),
      sourceContracts: ["TokenRiskResult.metrics.simulatedSlippage10k", "TokenRiskResult.metrics.bidAskImbalancePercent", "venue orderbook adapter"],
      customerCopyRule: "Liquidity quality must remain watch/missing until real depth, spread and 10k slippage receipts are attached.",
    },
    {
      id: "crypto_derivatives_receipt",
      label: "Funding + OI derivatives receipt",
      appliesTo: ["native_crypto", "token_contract"],
      state: laneState(derivativeVenueEvidence, derivativeLaneEvidence, derivativeMissing, crypto),
      paidAdvancedBlocker: crypto && args.pass2466?.state !== "ready",
      confirmedEvidence: unique([...derivativeVenueEvidence, ...derivativeLaneEvidence, args.pass2466 && `PASS2466 ${args.pass2466.state}:${args.pass2466.score}/100`]).slice(0, 10),
      missingEvidence: derivativeMissing,
      sourceContracts: ["PASS2466 Binance/Bybit OI", "PASS2466 funding/basis", "PASS2466 second derivatives venue"],
      customerCopyRule: "Derivatives data can explain pressure context only; no squeeze conclusion without ratio and liquidation receipts.",
    },
    {
      id: "crypto_long_short_liquidation_receipt",
      label: "Long/short + liquidation replay receipt",
      appliesTo: ["native_crypto", "token_contract"],
      state: laneState(ratioEvidence, liquidationEvidence, longShortMissing, crypto),
      paidAdvancedBlocker: crypto && !(args.pass2467?.confirmedSqueezeAllowed && args.pass2469?.twoVenueReplayReady),
      confirmedEvidence: unique([...ratioEvidence, ...liquidationEvidence, args.pass2467 && `PASS2467 ${args.pass2467.state}:${args.pass2467.score}/100`, args.pass2468 && `PASS2468 ${args.pass2468.state}:${args.pass2468.score}/100`, args.pass2469 && `PASS2469 ${args.pass2469.state}:${args.pass2469.replayStoreFingerprint}`]).slice(0, 10),
      missingEvidence: longShortMissing,
      sourceContracts: ["PASS2467 long/short ratio", "PASS2468 signed liquidation snapshot", "PASS2469 durable replay store"],
      customerCopyRule: "Advanced may show pressure/watch; confirmed squeeze wording is blocked until ratio + signed liquidation replay are fresh and durable.",
    },
    {
      id: "crypto_holder_supply_receipt",
      label: "Holder + supply/unlock receipt",
      appliesTo: ["native_crypto", "token_contract"],
      state: laneState(holderReady, [], holderMissing, crypto),
      paidAdvancedBlocker: crypto && holderMissing.length > 1,
      confirmedEvidence: holderReady.slice(0, 8),
      missingEvidence: holderMissing.slice(0, 8),
      sourceContracts: ["TokenRiskResult.metrics.holderCount", "top-holder concentration", "supply/unlock provider"],
      customerCopyRule: "Supply pressure must stay missing/watch unless holder concentration and supply/unlock snapshots are attached.",
    },
    {
      id: "real_market_second_provider_timestamp",
      label: "Real Markets second provider + timestamp",
      appliesTo: ["real_market_stock", "real_market_etf", "real_market_other"],
      state: laneState(realSecondReady.filter((item) => /Stooq|timestamp/.test(item)), realSecondReady, realSecondMissing, real),
      paidAdvancedBlocker: real && !(stooq && generatedAt),
      confirmedEvidence: realSecondReady.slice(0, 8),
      missingEvidence: realSecondMissing.slice(0, 8),
      sourceContracts: ["Yahoo quote adapter", "Stooq quote adapter", "observedAt/source cadence receipt"],
      customerCopyRule: "Stocks/ETFs need an independent quote provider and visible timestamp before Advanced can be sold as market depth.",
    },
    {
      id: "real_market_fundamental_filing_receipt",
      label: "Fundamentals + filings freshness receipt",
      appliesTo: ["real_market_stock", "real_market_etf"],
      state: laneState(realFilingReady.filter((item) => !/limitation/.test(item)), realFilingReady, realFilingMissing, stockOrEtf),
      paidAdvancedBlocker: stockOrEtf && realFilingMissing.length > 1,
      confirmedEvidence: realFilingReady.slice(0, 8),
      missingEvidence: realFilingMissing.slice(0, 8),
      sourceContracts: ["SEC/XBRL Companyfacts", "Alpha Vantage fundamentals", "issuer/ETF holdings freshness"],
      customerCopyRule: "Real Markets Advanced must use filing/fundamental language; never show token tax/DEX/holder scam lanes for stocks or ETFs.",
    },
    {
      id: "runtime_surface_receipt",
      label: "Runtime surface parity receipt",
      appliesTo: ["native_crypto", "token_contract", "real_market_stock", "real_market_etf", "real_market_other", "unknown"],
      state: runtimeReady && pdfHashReady ? "ready" : args.pass2476 ? "watch" : "blocked",
      paidAdvancedBlocker: !(runtimeReady && pdfHashReady),
      confirmedEvidence: runtimeEvidence,
      missingEvidence: unique([!runtimeReady && "API + browser screenshot + Angel replay runtime receipts", !pdfHashReady && "PDF preview/download hash parity", "durable production entitlement evidence store"]).slice(0, 8),
      sourceContracts: ["PASS2476 PDF hash runner", "PASS2475 browser screenshot runner", "PASS2474 API payload runner", "Angel replay receipt"],
      customerCopyRule: "Paid Advanced needs the same proof payload across Shield, Real Markets, PDF, Browser and Angel; one pretty surface is not enough.",
    },
  ];
}

function buildSurfaceActions(args: { family: Pass2483AssetFamily; state: Pass2483PremiumBridgeState; blockers: string[] }): Pass2483SurfaceAction[] {
  const crypto = isCrypto(args.family);
  const real = isRealMarket(args.family);
  const missing = args.blockers.slice(0, 5);
  const headline = args.state === "ready"
    ? "Premium evidence lanes are ready to support paid Advanced as proof depth, not certainty."
    : "Advanced must display missing premium proof before it looks buy-worthy.";
  return ["shield", "real_markets", "pdf", "browser", "angel"].map((surface) => ({
    surface: surface as Pass2483SurfaceAction["surface"],
    state: args.state,
    headline,
    mustShow: unique([
      crypto && "orderbook/slippage + derivatives + long/short/liquidation + holder/supply lane states",
      real && "second provider/timestamp + filing/fundamental lane states",
      "runtime receipt state and paid boundary",
      ...missing,
    ]).slice(0, 8),
    mustNotSay: unique([
      "not financial advice; no entry/exit/leverage instruction",
      "no paid-ready claim when any required lane is blocked",
      crypto && "no confirmed squeeze without signed liquidation replay",
      real && "no token holder/tax/DEX scam language for stocks or ETFs",
    ]).slice(0, 8),
  }));
}

export function buildPass2483PremiumEvidenceBridge(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
  now?: Date;
} = {}): Pass2483PremiumEvidenceBridge {
  const now = args.now ?? new Date();
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query);
  const family = familyFor(args.result, symbol);
  const lanes = buildLanes({
    family,
    result: args.result,
    pass2466: args.pass2466,
    pass2467: args.pass2467,
    pass2468: args.pass2468,
    pass2469: args.pass2469,
    pass2476: args.pass2476,
  });
  const required = lanes.filter((lane) => lane.state !== "not_applicable");
  const readyCount = required.filter((lane) => lane.state === "ready").length;
  const watchCount = required.filter((lane) => lane.state === "watch").length;
  const blockedCount = required.filter((lane) => lane.state === "blocked").length;
  const paidBlockers = required.filter((lane) => lane.paidAdvancedBlocker).flatMap((lane) => lane.missingEvidence.length ? lane.missingEvidence.map((item) => `${lane.label}: ${item}`) : [`${lane.label}: locked`]);
  const premiumEvidenceScore = clamp((readyCount / Math.max(1, required.length)) * 68 + (watchCount / Math.max(1, required.length)) * 26 - blockedCount * 9);
  const paidAdvancedCandidate = premiumEvidenceScore >= 82 && paidBlockers.length === 0;
  const state: Pass2483PremiumBridgeState = family === "unknown"
    ? "blocked"
    : paidAdvancedCandidate
      ? "ready"
      : premiumEvidenceScore >= 48 || watchCount >= 2
        ? "watch"
        : "blocked";
  const fingerprint = `PASS2483-${hash({ query: args.query, symbol, family, state, premiumEvidenceScore, lanes: lanes.map((lane) => [lane.id, lane.state, lane.paidAdvancedBlocker]) })}`;
  const readyEvidence = lanes.flatMap((lane) => lane.confirmedEvidence.map((item) => `${lane.label}: ${item}`)).slice(0, 16);
  const missingEvidence = unique(paidBlockers.length ? paidBlockers : lanes.flatMap((lane) => lane.missingEvidence.map((item) => `${lane.label}: ${item}`))).slice(0, 18);
  return {
    version: PASS2483_PREMIUM_EVIDENCE_BRIDGE_ID,
    state,
    query: args.query,
    symbol,
    assetFamily: family,
    premiumEvidenceScore,
    paidAdvancedCandidate,
    paidAdvancedConclusionAllowed: paidAdvancedCandidate,
    lanes,
    paidBlockers: unique(paidBlockers).slice(0, 18),
    readyEvidence: unique(readyEvidence).slice(0, 16),
    missingEvidence,
    surfaceActions: buildSurfaceActions({ family, state, blockers: missingEvidence }),
    advancedUpgradeRule: "PASS2483 turns PASS2482 from a warning into an upgrade map: Advanced is buy-worthy only when premium provider receipts and runtime parity are attached, not when the answer is longer.",
    nextImplementationActions: unique([
      isCrypto(family) && "Attach real orderbook spread/depth and 10k slippage to TokenRiskResult metrics.",
      isCrypto(family) && "Run PASS2466/PASS2467 fetchers and feed signed PASS2468/PASS2469 liquidation replay into source-sync.",
      isCrypto(family) && "Attach holder concentration and supply/unlock provider lanes before paid supply claims.",
      isRealMarket(family) && "Guarantee Yahoo + Stooq observedAt parity in Real Markets and Lens before paid Advanced.",
      (family === "real_market_stock" || family === "real_market_etf") && "Hydrate SEC/XBRL/fundamental/ETF holdings freshness before paid Real Markets Advanced.",
      "Persist API/browser/PDF/Angel receipt fingerprints server-side before marketing Advanced as paid-ready.",
    ]),
    fingerprint,
    generatedAt: now.toISOString(),
  };
}
