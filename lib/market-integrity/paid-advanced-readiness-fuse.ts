import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { Pass2476RuntimeReceiptPdfHashRunner } from "./runtime-receipt-pdf-hash-runner";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";
import type { Pass2483PremiumEvidenceBridge } from "./premium-evidence-bridge";
import type { Pass2484RuntimePremiumEvidenceHydration } from "./runtime-premium-evidence-hydrator";
import type { Pass2488SupplyFilingProvenanceLock } from "./supply-filing-provenance-lock";
import type { CommercialCohortGate } from "../worldclass/commercial-cohort-policy";

export const PASS2485_PAID_ADVANCED_READINESS_FUSE_ID = "paid-advanced-readiness-fuse-v1" as const;

export type Pass2485FuseState = "paid_ready" | "qa_preview_only" | "watch" | "blocked";
export type Pass2485AssetFamily = "crypto" | "real_market" | "unknown";
export type Pass2485LaneState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2485ReadinessLane = {
  id:
    | "crypto_spot_depth_second_venue"
    | "crypto_derivatives_oi_funding"
    | "crypto_long_short_liquidation"
    | "crypto_holder_supply"
    | "real_market_second_quote"
    | "real_market_filings_fundamentals"
    | "surface_runtime_parity";
  label: string;
  family: Pass2485AssetFamily | "all";
  requiredForPaidAdvanced: boolean;
  state: Pass2485LaneState;
  readyEvidence: string[];
  missingEvidence: string[];
  operatorAction: string;
  customerBoundary: string;
};

export type Pass2485PaidAdvancedReadinessFuse = {
  version: typeof PASS2485_PAID_ADVANCED_READINESS_FUSE_ID;
  state: Pass2485FuseState;
  query?: string;
  symbol?: string;
  assetFamily: Pass2485AssetFamily;
  paidAdvancedAllowed: boolean;
  canShowBuyAdvancedCta: boolean;
  canShowPaidVerdictCopy: boolean;
  readinessScore: number;
  readyLaneCount: number;
  watchLaneCount: number;
  blockedLaneCount: number;
  lanes: Pass2485ReadinessLane[];
  hardBlockers: string[];
  commercialCohortGate: CommercialCohortGate | null;
  customerVerdict: string;
  operatorVerdict: string;
  advancedButtonRule: string;
  noOverclaimRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

type ResultWithLimitations = TokenRiskResult & { limitations?: string[] };

type Pass2485ReadinessLaneInput = Omit<Pass2485ReadinessLane, "readyEvidence" | "missingEvidence"> & {
  readyEvidence: Array<string | false | null | undefined>;
  missingEvidence: Array<string | false | null | undefined>;
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
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function assetFamily(result?: TokenRiskResult | null, symbol?: string): Pass2485AssetFamily {
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "PEPE"].includes(normalized)) return "crypto";
  return "unknown";
}

function hasText(items: string[], pattern: RegExp) {
  return items.some((item) => pattern.test(item));
}

function resultLimitations(result?: TokenRiskResult | null) {
  const mutable = result as ResultWithLimitations | null | undefined;
  return unique([...(result?.metaModel?.limitations ?? []), ...(mutable?.limitations ?? [])]);
}

function lane(args: Pass2485ReadinessLaneInput): Pass2485ReadinessLane {
  return {
    ...args,
    readyEvidence: unique(args.readyEvidence).slice(0, 10),
    missingEvidence: unique(args.missingEvidence).slice(0, 12),
  };
}

function cryptoSpotDepthLane(family: Pass2485AssetFamily, pass2484?: Pass2484RuntimePremiumEvidenceHydration | null): Pass2485ReadinessLane {
  const applies = family === "crypto";
  const receipts = pass2484?.providerReceipts ?? [];
  const orderbookReceipts = receipts.filter((receipt) => /orderbook|depth|spot/i.test(`${receipt.id} ${receipt.provider}`));
  const readyVenueCount = orderbookReceipts.filter((receipt) => receipt.state === "ready").length;
  const hasRuntimeDepth = Boolean(pass2484?.orderbook || readyVenueCount >= 1 || pass2484?.hydratedFields.some((field) => /slippage|imbalance/i.test(field)));
  const state: Pass2485LaneState = !applies ? "not_applicable" : readyVenueCount >= 2 ? "ready" : hasRuntimeDepth ? "watch" : "blocked";
  return lane({
    id: "crypto_spot_depth_second_venue",
    label: "Spot orderbook, 10k slippage and second venue",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      hasRuntimeDepth && "PASS2484 attached runtime orderbook/slippage/imbalance lane",
      pass2484?.orderbook?.symbol && `primary depth ${pass2484.orderbook.symbol}`,
      pass2484?.orderbook?.simulatedSellSlippage10k !== undefined && `sell 10k slippage ${pass2484.orderbook.simulatedSellSlippage10k.toFixed(4)}%`,
      pass2484?.orderbook?.simulatedBuySlippage10k !== undefined && `buy 10k slippage ${pass2484.orderbook.simulatedBuySlippage10k.toFixed(4)}%`,
      readyVenueCount >= 2 && `${readyVenueCount} depth venues ready`,
    ],
    missingEvidence: [
      applies && !hasRuntimeDepth && "primary venue depth/orderbook runtime receipt",
      applies && readyVenueCount < 2 && "second independent venue orderbook/slippage replay",
      applies && "signed depth snapshot persistence for PDF/Angel replay",
    ],
    operatorAction: "Keep Binance depth as first live lane; add Coinbase/Kraken/OKX/MEXC depth adapter before paid Advanced says liquidity quality is confirmed.",
    customerBoundary: "One exchange orderbook can explain pressure, but it is not enough to sell a final liquidity verdict.",
  });
}

function cryptoDerivativesLane(family: Pass2485AssetFamily, pass2466?: Pass2466DerivativesSqueezeProof | null): Pass2485ReadinessLane {
  const applies = family === "crypto";
  const venues = pass2466?.venues ?? [];
  const liveVenues = venues.filter((venue) => venue.state === "live" || venue.state === "degraded");
  const hasOi = liveVenues.some((venue) => venue.openInterestUsd !== undefined || venue.openInterestBase !== undefined);
  const hasFunding = liveVenues.some((venue) => venue.fundingRatePercent !== undefined);
  const hasTwoVenues = liveVenues.length >= 2;
  const state: Pass2485LaneState = !applies ? "not_applicable" : hasTwoVenues && hasOi && hasFunding ? "ready" : liveVenues.length || hasOi || hasFunding ? "watch" : "blocked";
  return lane({
    id: "crypto_derivatives_oi_funding",
    label: "Derivatives OI, funding and venue concordance",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      pass2466?.state && `PASS2466 ${pass2466.state}:${pass2466.score}/100`,
      hasOi && "open interest lane observed",
      hasFunding && "funding lane observed",
      hasTwoVenues && `${liveVenues.length} derivatives venues observed`,
      pass2466?.direction && pass2466.direction !== "unknown" && `pressure direction ${pass2466.direction}`,
    ],
    missingEvidence: [
      applies && !hasOi && "open interest USD/base",
      applies && !hasFunding && "funding rate",
      applies && !hasTwoVenues && "second derivatives venue concordance",
      applies && "basis/mark-index consistency if available",
    ],
    operatorAction: "Feed PASS2466 into Advanced only as pressure context; require two-venue OI/funding before the output sounds premium.",
    customerBoundary: "Funding and OI show leverage pressure, not a trade instruction or confirmed squeeze alone.",
  });
}

function cryptoLongShortLiquidationLane(family: Pass2485AssetFamily, pass2467?: Pass2467LiquidationLongShortProof | null, pass2468?: Pass2468LiquidationSnapshotLedger | null, pass2469?: Pass2469LiquidationReplayStore | null): Pass2485ReadinessLane {
  const applies = family === "crypto";
  const ratios = pass2467?.longShortSnapshots ?? [];
  const liveRatios = ratios.filter((snapshot) => snapshot.state === "live" || snapshot.state === "degraded");
  const hasLongShort = liveRatios.some((snapshot) => snapshot.longShortRatio !== undefined || snapshot.topTraderLongShortRatio !== undefined);
  const collectorAttached = (pass2467?.liquidationSnapshots ?? []).some((snapshot) => snapshot.state === "collector_attached");
  const streamKnown = (pass2467?.liquidationSnapshots ?? []).some((snapshot) => snapshot.state === "stream_required" || snapshot.state === "collector_attached");
  const signedSnapshotCount = (pass2468?.snapshots ?? []).filter((snapshot) => snapshot.state === "signed_snapshot").length;
  const freshReplayCount = pass2469?.freshReplayCount ?? (pass2469?.records ?? []).filter((record) => record.state === "fresh").length;
  const twoVenueReplayReady = Boolean(pass2469?.twoVenueReplayReady);
  const durableReplayReady = pass2469?.storageMode === "supabase_ready";
  const replayReadyForPaid = signedSnapshotCount > 0 && freshReplayCount > 0 && twoVenueReplayReady && durableReplayReady;
  const state: Pass2485LaneState = !applies ? "not_applicable" : hasLongShort && replayReadyForPaid ? "ready" : hasLongShort || streamKnown || signedSnapshotCount > 0 || freshReplayCount > 0 ? "watch" : "blocked";
  return lane({
    id: "crypto_long_short_liquidation",
    label: "Long/short ratio and liquidation replay",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      pass2467?.state && `PASS2467 ${pass2467.state}:${pass2467.score}/100`,
      hasLongShort && "long/short ratio observed",
      streamKnown && "official liquidation stream path known",
      collectorAttached && "liquidation collector attached",
      signedSnapshotCount > 0 && `${signedSnapshotCount} signed liquidation snapshot(s)`,
      freshReplayCount > 0 && `${freshReplayCount} fresh liquidation replay(s)`,
      twoVenueReplayReady && "two-venue replay ready",
      durableReplayReady && "durable replay persistence ready",
      replayReadyForPaid && "PASS2468/PASS2469 replay ready for paid lane",
      pass2467?.confirmedSqueezeAllowed && "confirmed squeeze copy allowed",
    ],
    missingEvidence: [
      applies && !hasLongShort && "global/top-trader long-short ratio",
      applies && !collectorAttached && signedSnapshotCount < 1 && "signed liquidation snapshot collector",
      applies && freshReplayCount < 1 && "fresh liquidation replay fingerprint",
      applies && !twoVenueReplayReady && "two-venue liquidation replay",
      applies && !durableReplayReady && "durable replay persistence for paid Advanced",
      applies && "liquidation replay fingerprint shared across PDF/Shield/Angel",
    ],
    operatorAction: "Add signed liquidation collector/replay, two-venue replay and durable persistence before any Advanced text says squeeze/liquidation pressure is confirmed.",
    customerBoundary: "Long/short ratios are context. Liquidation clusters need signed durable replay before stronger paid wording.",
  });
}

function cryptoHolderSupplyLane(family: Pass2485AssetFamily, result?: TokenRiskResult | null, pass2488?: Pass2488SupplyFilingProvenanceLock | null): Pass2485ReadinessLane {
  const applies = family === "crypto";
  const hasSupply = result?.metrics.circulatingSupply !== undefined || result?.metrics.totalSupply !== undefined || result?.metrics.maxSupply !== undefined;
  const hasHolder = result?.metrics.holderCount !== undefined || result?.metrics.top10HolderPercent !== undefined;
  const native = !result?.token.tokenAddress && !result?.token.pairAddress;
  const pass2488Ready = Boolean(pass2488?.paidProvenanceAllowed && pass2488.assetFamily === "crypto");
  const pass2488Watch = Boolean(pass2488 && pass2488.assetFamily === "crypto" && pass2488.state !== "blocked");
  const state: Pass2485LaneState = !applies ? "not_applicable" : pass2488Ready ? "ready" : hasSupply && (hasHolder || native) ? "watch" : hasSupply || hasHolder || pass2488Watch ? "watch" : "blocked";
  return lane({
    id: "crypto_holder_supply",
    label: "Holder, supply and unlock pressure",
    family: "crypto",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      hasSupply && "supply metric present",
      hasHolder && "holder/concentration metric present",
      native && "native coin: ERC20 holder/admin lane not forced, but supply/unlock context still required",
      pass2488Ready && `PASS2488 ${pass2488?.state}:${pass2488?.provenanceScore}/100`,
    ],
    missingEvidence: [
      applies && !hasHolder && !native && "holder concentration snapshot",
      applies && !hasSupply && "circulating/total/max supply snapshot",
      applies && !pass2488Ready && "PASS2488 supply/holder/unlock provenance lock",
      applies && "unlock/emission schedule or explicit not-applicable reason",
    ],
    operatorAction: "Add holder concentration + unlock/emission provider lanes; native coins need explicit not-applicable notes for ERC20-only checks.",
    customerBoundary: "Supply pressure must stay as missing/watch unless the holder/unlock snapshot is attached or explicitly not applicable.",
  });
}

function realSecondQuoteLane(family: Pass2485AssetFamily, result?: TokenRiskResult | null, pass2484?: Pass2484RuntimePremiumEvidenceHydration | null): Pass2485ReadinessLane {
  const applies = family === "real_market";
  const sources = result?.dataSources ?? [];
  const receipts = pass2484?.providerReceipts ?? [];
  const hasYahoo = hasText(sources, /yahoo/i) || receipts.some((receipt) => /yahoo/i.test(receipt.provider) && receipt.state === "ready");
  const hasStooq = hasText(sources, /stooq/i) || receipts.some((receipt) => /stooq/i.test(receipt.provider) && receipt.state === "ready");
  const hasTimestamp = Boolean(result?.generatedAt || receipts.some((receipt) => receipt.observedAt));
  const state: Pass2485LaneState = !applies ? "not_applicable" : hasYahoo && hasStooq && hasTimestamp ? "ready" : hasYahoo || hasStooq || hasTimestamp ? "watch" : "blocked";
  return lane({
    id: "real_market_second_quote",
    label: "Independent quote provider and timestamp parity",
    family: "real_market",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      hasYahoo && "Yahoo quote/chart provider family observed",
      hasStooq && "Stooq independent provider observed",
      hasTimestamp && "runtime timestamp present",
    ],
    missingEvidence: [
      applies && !hasYahoo && "Yahoo quote/chart provider response",
      applies && !hasStooq && "Stooq independent quote response",
      applies && !hasTimestamp && "observedAt timestamp per provider",
      applies && "quote/chart/provider parity across Real Markets, Browser and PDF",
    ],
    operatorAction: "Treat Yahoo quote+chart as one family; add live Stooq timestamp before Real Markets Advanced can be sold as second-provider depth.",
    customerBoundary: "A stock/ETF Advanced report is not a paid verdict when provider timestamps or second quote are missing.",
  });
}

function realFilingFundamentalLane(family: Pass2485AssetFamily, result?: TokenRiskResult | null, pass2488?: Pass2488SupplyFilingProvenanceLock | null): Pass2485ReadinessLane {
  const applies = family === "real_market";
  const sources = result?.dataSources ?? [];
  const limitations = resultLimitations(result);
  const hasFiling = hasText(sources, /sec|xbrl|filing/i);
  const hasFundamentals = hasText(sources, /alpha vantage|fundamental|companyfacts|earnings|issuer|holdings/i);
  const gapSurfaced = hasText(limitations, /sec|xbrl|filing|fundamental|alpha vantage|holdings|earnings/i);
  const pass2488Ready = Boolean(pass2488?.paidProvenanceAllowed && pass2488.assetFamily === "real_market");
  const pass2488Watch = Boolean(pass2488 && pass2488.assetFamily === "real_market" && pass2488.state !== "blocked");
  const state: Pass2485LaneState = !applies ? "not_applicable" : pass2488Ready ? "ready" : hasFiling && hasFundamentals ? "ready" : hasFiling || hasFundamentals || gapSurfaced || pass2488Watch ? "watch" : "blocked";
  return lane({
    id: "real_market_filings_fundamentals",
    label: "Filings, fundamentals and holdings freshness",
    family: "real_market",
    requiredForPaidAdvanced: applies,
    state,
    readyEvidence: [
      hasFiling && "SEC/XBRL or filing source observed",
      hasFundamentals && "fundamental/earnings/holdings source observed",
      gapSurfaced && "filing/fundamental gap visibly surfaced",
      pass2488Ready && `PASS2488 ${pass2488?.state}:${pass2488?.provenanceScore}/100`,
    ],
    missingEvidence: [
      applies && !hasFiling && "SEC/XBRL/companyfacts or issuer filing link",
      applies && !hasFundamentals && "fundamentals/earnings/ETF holdings freshness",
      applies && !pass2488Ready && "PASS2488 SEC/XBRL/fundamental provenance lock",
      applies && "latest filing date and stale-data cap",
    ],
    operatorAction: "Add SEC_USER_AGENT/Companyfacts + Alpha Vantage/issuer holdings before Real Markets Advanced uses premium fundamentals language.",
    customerBoundary: "Real Markets Advanced can summarize market state, but fundamentals need filings/freshness before stronger paid analysis.",
  });
}

function runtimeParityLane(pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null, pass2483?: Pass2483PremiumEvidenceBridge | null, pass2484?: Pass2484RuntimePremiumEvidenceHydration | null): Pass2485ReadinessLane {
  const pdfHash = pass2476?.pdfHashCoveragePercent ?? 0;
  const runtime = pass2476?.runtimeCapturedCoveragePercentAfterRun ?? 0;
  const pass2476Ready = pdfHash >= 70 && runtime >= 70;
  const bridgeReady = Boolean(pass2483?.paidAdvancedConclusionAllowed);
  const hydrationPresent = Boolean(pass2484?.state === "ready" || pass2484?.state === "watch");
  const state: Pass2485LaneState = pass2476Ready && bridgeReady ? "ready" : pass2476 || pass2483 || hydrationPresent ? "watch" : "blocked";
  return lane({
    id: "surface_runtime_parity",
    label: "Runtime parity: Shield, Real Markets, PDF, Browser and Angel",
    family: "all",
    requiredForPaidAdvanced: true,
    state,
    readyEvidence: [
      pass2476 && `PDF hash coverage ${pdfHash}%`,
      pass2476 && `runtime captured ${runtime}%`,
      pass2483 && `PASS2483 ${pass2483.state}:${pass2483.premiumEvidenceScore}/100`,
      hydrationPresent && `PASS2484 hydration ${pass2484?.state}`,
    ],
    missingEvidence: [
      !pass2476Ready && "operator PDF preview/download hash + API payload + browser screenshot receipt",
      !bridgeReady && "PASS2483 paid Advanced conclusion lock",
      !hydrationPresent && "PASS2484 runtime hydration receipt",
      "durable server-side receipt storage for paid entitlement replay",
    ],
    operatorAction: "Before charging, capture the same fingerprint in API payload, Browser/Shield modal, PDF preview/download and Angel replay.",
    customerBoundary: "Advanced cannot be sold as completed if the same proof is not visible across surfaces.",
  });
}

export function buildPass2485PaidAdvancedReadinessFuse(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
  pass2483?: Pass2483PremiumEvidenceBridge | null;
  pass2484?: Pass2484RuntimePremiumEvidenceHydration | null;
  pass2488?: Pass2488SupplyFilingProvenanceLock | null;
  commercialCohortGate?: CommercialCohortGate | null;
  now?: Date;
} = {}): Pass2485PaidAdvancedReadinessFuse {
  const now = args.now ?? new Date();
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query);
  const family = assetFamily(args.result, symbol);
  const lanes = [
    cryptoSpotDepthLane(family, args.pass2484),
    cryptoDerivativesLane(family, args.pass2466),
    cryptoLongShortLiquidationLane(family, args.pass2467, args.pass2468, args.pass2469),
    cryptoHolderSupplyLane(family, args.result, args.pass2488),
    realSecondQuoteLane(family, args.result, args.pass2484),
    realFilingFundamentalLane(family, args.result, args.pass2488),
    runtimeParityLane(args.pass2476, args.pass2483, args.pass2484),
  ];
  const required = lanes.filter((item) => item.requiredForPaidAdvanced && item.state !== "not_applicable");
  const readyLaneCount = required.filter((item) => item.state === "ready").length;
  const watchLaneCount = required.filter((item) => item.state === "watch").length;
  const blockedLaneCount = required.filter((item) => item.state === "blocked").length;
  const commercialCohortGate = args.commercialCohortGate ?? null;
  const hardBlockers = unique([
    ...required.filter((item) => item.state !== "ready").flatMap((item) => item.missingEvidence.map((missing) => `${item.label}: ${missing}`)),
    commercialCohortGate?.ready === true
      ? null
      : `commercial cohort not ready: ${commercialCohortGate?.blockers.join(" | ") || "signed 50-asset cohort missing"}`,
  ]).slice(0, 18);
  const readinessScore = clamp((readyLaneCount / Math.max(1, required.length)) * 72 + (watchLaneCount / Math.max(1, required.length)) * 24 - blockedLaneCount * 10 + (args.pass2483?.premiumEvidenceScore ?? 0) * 0.04);
  const provenanceGateReady = Boolean(args.pass2488?.paidProvenanceAllowed);
  const paidAdvancedAllowed = family !== "unknown" && readinessScore >= 86 && hardBlockers.length === 0 && Boolean(args.pass2483?.paidAdvancedConclusionAllowed) && provenanceGateReady && commercialCohortGate?.ready === true;
  const state: Pass2485FuseState = paidAdvancedAllowed
    ? "paid_ready"
    : family === "unknown" || blockedLaneCount >= Math.ceil(required.length * 0.6)
      ? "blocked"
      : readyLaneCount > 0 || watchLaneCount >= 2
        ? "qa_preview_only"
        : "watch";
  const fingerprint = `PASS2485-${hash({ query: args.query, symbol, family, state, readinessScore, lanes: lanes.map((item) => [item.id, item.state]) })}`;
  const customerVerdict = paidAdvancedAllowed
    ? "Advanced can be presented as paid source-bound depth, still without investment advice or certainty."
    : "Advanced should stay QA preview / missing-proof map. It is valuable because it shows gaps, but it is not yet a paid final verdict.";
  const operatorVerdict = paidAdvancedAllowed
    ? "Keep payment proof server-side and preserve the PASS2485 fingerprint across Shield, Real Markets, PDF, Browser and Angel."
    : `Do not market Advanced as paid-ready yet. Close PASS2485 blockers first: ${hardBlockers.slice(0, 5).join(" · ") || "premium lane receipt missing"}.`;
  return {
    version: PASS2485_PAID_ADVANCED_READINESS_FUSE_ID,
    state,
    query: args.query,
    symbol,
    assetFamily: family,
    paidAdvancedAllowed,
    canShowBuyAdvancedCta: paidAdvancedAllowed,
    canShowPaidVerdictCopy: paidAdvancedAllowed,
    readinessScore,
    readyLaneCount,
    watchLaneCount,
    blockedLaneCount,
    lanes,
    hardBlockers,
    commercialCohortGate,
    customerVerdict,
    operatorVerdict,
    advancedButtonRule: paidAdvancedAllowed
      ? "The Advanced CTA may say paid depth is available for this asset, but it still must avoid investment advice and show missing data."
      : "The Advanced CTA must say QA preview / missing proof map until PASS2485 paidAdvancedAllowed=true; do not imply a complete paid conclusion.",
    noOverclaimRules: [
      "Never sell Advanced because it is longer; sell it only when premium evidence lanes are timestamped and replayable.",
      "One Binance orderbook can upgrade the liquidity lane to watch, not paid-ready.",
      "OI/funding and long-short are pressure context; confirmed squeeze requires signed, fresh, two-venue and durable liquidation replay.",
      "Stocks/ETFs require independent quote timestamps, PASS2488 SEC/XBRL identity, and filings/fundamentals freshness before paid verdict copy.",
      "PDF, Browser, Shield/Real Markets and Angel must show the same PASS2485 fingerprint before paid copy is allowed.",
      "A single asset request can never unlock paid Advanced; a signed, unexpired 50-asset commercial cohort gate is mandatory.",
    ],
    nextImplementationActions: unique([
      family === "crypto" && "Add second spot venue orderbook adapter and signed depth snapshot cache.",
      family === "crypto" && "Attach PASS2466/PASS2467 live OI/funding/long-short data to the same Advanced proof strip as PASS2484.",
      family === "crypto" && "Build liquidation collector/replay, two-venue replay and durable storage or keep squeeze language blocked.",
      family === "crypto" && "Add PASS2488 holder/supply/unlock snapshot with explicit native-coin not-applicable rules.",
      family === "real_market" && "Make Stooq second-provider runtime response mandatory before Real Markets Advanced is paid-ready.",
      family === "real_market" && "Hydrate PASS2488 SEC/XBRL/companyfacts/issuer holdings and latest filing date.",
      "Persist paid Advanced receipt bundle server-side and render fingerprint in PDF, modal, Browser and Angel.",
    ]).slice(0, 10),
    fingerprint,
    generatedAt: now.toISOString(),
  };
}
