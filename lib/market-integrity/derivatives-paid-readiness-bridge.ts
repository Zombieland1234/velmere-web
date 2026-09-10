import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { Pass2484RuntimePremiumEvidenceHydration } from "./runtime-premium-evidence-hydrator";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";
import type { Pass2485PaidAdvancedReadinessFuse } from "./paid-advanced-readiness-fuse";

export const PASS2486_DERIVATIVES_PAID_READINESS_BRIDGE_ID = "derivatives-paid-readiness-bridge-v1" as const;

export type Pass2486BridgeState = "paid_ready_assist" | "runtime_watch" | "blocked" | "not_applicable";
export type Pass2486LaneState = "ready" | "watch" | "blocked" | "not_applicable";

export type Pass2486BridgeLane = {
  id: "spot_depth" | "oi_funding" | "long_short" | "liquidation_replay" | "paid_fuse" | "surface_copy_lock";
  label: string;
  state: Pass2486LaneState;
  readyEvidence: string[];
  missingEvidence: string[];
  customerCopyBoundary: string;
  operatorAction: string;
};

export type Pass2486DerivativesPaidReadinessBridge = {
  version: typeof PASS2486_DERIVATIVES_PAID_READINESS_BRIDGE_ID;
  state: Pass2486BridgeState;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  assetFamily: "crypto" | "real_market" | "unknown";
  derivativeRuntimeReady: boolean;
  confirmedSqueezeCopyAllowed: boolean;
  paidAdvancedAllowedAfterDerivativeBridge: boolean;
  observedDerivativeVenueCount: number;
  observedRatioVenueCount: number;
  liquidationCollectorReady: boolean;
  liquidationReplayReady: boolean;
  twoVenueReplayReady: boolean;
  durableReplayReady: boolean;
  bridgeScore: number;
  lanes: Pass2486BridgeLane[];
  hardLocks: string[];
  customerVerdict: string;
  operatorVerdict: string;
  noOverclaimRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

type ResultWithAsset = TokenRiskResult | null | undefined;

type Pass2486BridgeLaneInput = Omit<Pass2486BridgeLane, "readyEvidence" | "missingEvidence"> & {
  readyEvidence: Array<string | false | null | undefined>;
  missingEvidence: Array<string | false | null | undefined>;
};

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (Math.abs(value) >= 1_000_000_000) return `$${Math.round((value / 1_000_000_000) * 100) / 100}B`;
  if (Math.abs(value) >= 1_000_000) return `$${Math.round((value / 1_000_000) * 100) / 100}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round((value / 1_000) * 10) / 10}K`;
  return `$${Math.round(value * 100) / 100}`;
}

function pct(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return `${Math.round(value * 10000) / 10000}%`;
}

function assetFamily(result?: ResultWithAsset, symbol?: string): Pass2486DerivativesPaidReadinessBridge["assetFamily"] {
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "PEPE", "LTC", "TRX"].includes(normalized)) return "crypto";
  return "unknown";
}

function lane(args: Pass2486BridgeLaneInput): Pass2486BridgeLane {
  return {
    ...args,
    readyEvidence: unique(args.readyEvidence).slice(0, 10),
    missingEvidence: unique(args.missingEvidence).slice(0, 12),
  };
}

function liveVenueCount(pass2466?: Pass2466DerivativesSqueezeProof | null) {
  return (pass2466?.venues ?? []).filter((venue) => venue.state === "live" || venue.state === "degraded").length;
}

function liveRatioCount(pass2467?: Pass2467LiquidationLongShortProof | null) {
  return (pass2467?.longShortSnapshots ?? []).filter((snapshot) => snapshot.state === "live" || snapshot.state === "degraded").length;
}

export function buildPass2486DerivativesPaidReadinessBridge(args: {
  query?: string;
  symbol?: string;
  result?: ResultWithAsset;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2484?: Pass2484RuntimePremiumEvidenceHydration | null;
  pass2485?: Pass2485PaidAdvancedReadinessFuse | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
  now?: Date;
} = {}): Pass2486DerivativesPaidReadinessBridge {
  const now = args.now ?? new Date();
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query);
  const family = assetFamily(args.result, symbol);
  const crypto = family === "crypto";
  const depthReady = Boolean(args.pass2484?.orderbook || args.pass2484?.hydratedFields.some((field) => /slippage|imbalance|orderbook/i.test(field)));
  const derivativesVenues = liveVenueCount(args.pass2466);
  const ratioVenues = liveRatioCount(args.pass2467);
  const hasOi = (args.pass2466?.venues ?? []).some((venue) => venue.state !== "missing" && (venue.openInterestUsd !== undefined || venue.openInterestBase !== undefined));
  const hasFunding = (args.pass2466?.venues ?? []).some((venue) => venue.state !== "missing" && venue.fundingRatePercent !== undefined);
  const ratioReady = (args.pass2467?.longShortSnapshots ?? []).some((snapshot) => snapshot.state !== "missing" && (snapshot.longShortRatio !== undefined || snapshot.topTraderLongShortRatio !== undefined));
  const liquidationCollectorReady = (args.pass2467?.liquidationSnapshots ?? []).some((snapshot) => snapshot.state === "collector_attached");
  const signedLiquidationSnapshotCount = (args.pass2468?.snapshots ?? []).filter((snapshot) => snapshot.state === "signed_snapshot").length;
  const freshReplayCount = args.pass2469?.freshReplayCount ?? (args.pass2469?.records ?? []).filter((record) => record.state === "fresh").length;
  const twoVenueReplayReady = Boolean(args.pass2469?.twoVenueReplayReady);
  const durableReplayReady = args.pass2469?.storageMode === "supabase_ready";
  const liquidationReplayReady = signedLiquidationSnapshotCount > 0 && freshReplayCount > 0 && Boolean(args.pass2469?.latestReplayFingerprint);
  const paidFuseAllowed = Boolean(args.pass2485?.paidAdvancedAllowed);

  const lanes: Pass2486BridgeLane[] = [
    lane({
      id: "spot_depth",
      label: "Spot depth + 10k slippage handoff",
      state: !crypto ? "not_applicable" : depthReady ? "watch" : "blocked",
      readyEvidence: [
        depthReady && "PASS2484 depth/slippage handoff observed",
        args.pass2484?.orderbook?.symbol && `depth pair ${args.pass2484.orderbook.symbol}`,
        args.pass2484?.orderbook?.simulatedSellSlippage10k !== undefined && `sell 10k slippage ${pct(args.pass2484.orderbook.simulatedSellSlippage10k)}`,
        args.pass2484?.orderbook?.simulatedBuySlippage10k !== undefined && `buy 10k slippage ${pct(args.pass2484.orderbook.simulatedBuySlippage10k)}`,
      ],
      missingEvidence: [
        crypto && !depthReady && "runtime depth/slippage receipt",
        crypto && "second independent spot venue depth replay",
        crypto && "signed depth snapshot cache for PDF/Angel replay",
      ],
      customerCopyBoundary: "Depth can support a liquidity lane, but one venue is still not a completed paid liquidity verdict.",
      operatorAction: "Keep PASS2484 as primary depth lane and add second spot venue before upgrading copy strength.",
    }),
    lane({
      id: "oi_funding",
      label: "OI + funding derivatives runtime",
      state: !crypto ? "not_applicable" : derivativesVenues >= 2 && hasOi && hasFunding ? "ready" : derivativesVenues || hasOi || hasFunding ? "watch" : "blocked",
      readyEvidence: [
        args.pass2466?.state && `PASS2466 ${args.pass2466.state}:${args.pass2466.score}/100`,
        derivativesVenues > 0 && `${derivativesVenues} derivatives venue packets`,
        hasOi && "open interest observed",
        hasFunding && "funding rate observed",
        ...(args.pass2466?.venues ?? []).filter((venue) => venue.state !== "missing").map((venue) => `${venue.label}: OI ${money(venue.openInterestUsd) ?? money(venue.openInterestBase)} · funding ${pct(venue.fundingRatePercent) ?? "missing"}`),
      ],
      missingEvidence: [
        crypto && !hasOi && "open interest USD/base",
        crypto && !hasFunding && "funding rate",
        crypto && derivativesVenues < 2 && "second derivatives venue packet",
        crypto && "basis / mark-index consistency badge",
      ],
      customerCopyBoundary: "OI/funding is leverage pressure context only; it must not become entry/exit or leverage advice.",
      operatorAction: "Use PASS2466 live venue packets as a visible Advanced lane, but keep paid fuse locked if venue count or fields are missing.",
    }),
    lane({
      id: "long_short",
      label: "Global/top trader long-short ratio",
      state: !crypto ? "not_applicable" : ratioVenues >= 2 && ratioReady ? "ready" : ratioVenues || ratioReady ? "watch" : "blocked",
      readyEvidence: [
        args.pass2467?.state && `PASS2467 ${args.pass2467.state}:${args.pass2467.score}/100`,
        ratioVenues > 0 && `${ratioVenues} ratio venue packets`,
        ratioReady && "long/short ratio observed",
        ...(args.pass2467?.longShortSnapshots ?? []).filter((snapshot) => snapshot.state !== "missing").map((snapshot) => `${snapshot.label}: ratio ${snapshot.longShortRatio ?? snapshot.topTraderLongShortRatio ?? "missing"}`),
      ],
      missingEvidence: [
        crypto && !ratioReady && "global/top-trader long-short ratio",
        crypto && ratioVenues < 2 && "second venue long-short ratio",
        crypto && "venue disagreement display if ratios conflict",
      ],
      customerCopyBoundary: "Long/short ratio describes crowd positioning only; it must not be framed as a trade signal.",
      operatorAction: "Render ratio evidence next to OI/funding so Advanced explains pressure without claiming a confirmed squeeze.",
    }),
    lane({
      id: "liquidation_replay",
      label: "Liquidation collector + replay lock",
      state: !crypto ? "not_applicable" : liquidationReplayReady && twoVenueReplayReady && durableReplayReady ? "ready" : liquidationReplayReady || liquidationCollectorReady || (args.pass2467?.liquidationSnapshots?.length ?? 0) ? "watch" : "blocked",
      readyEvidence: [
        liquidationCollectorReady && "liquidation collector attached",
        signedLiquidationSnapshotCount > 0 && `${signedLiquidationSnapshotCount} PASS2468 signed liquidation snapshot(s)`,
        freshReplayCount > 0 && `${freshReplayCount} PASS2469 fresh replay(s)`,
        args.pass2469?.latestReplayFingerprint && `latest replay ${args.pass2469.latestReplayFingerprint}`,
        twoVenueReplayReady && "two-venue liquidation replay ready",
        durableReplayReady && "durable liquidation replay persistence ready",
        ...(args.pass2467?.liquidationSnapshots ?? []).map((snapshot) => `${snapshot.label}: ${snapshot.state}`),
      ],
      missingEvidence: [
        crypto && !liquidationCollectorReady && signedLiquidationSnapshotCount < 1 && "live liquidation collector / signed liquidation snapshot",
        crypto && freshReplayCount < 1 && "fresh signed liquidation replay / max-age proof",
        crypto && !twoVenueReplayReady && "second venue liquidation replay",
        crypto && !durableReplayReady && "durable liquidation replay persistence",
        crypto && "max-age badge shared across Shield, PDF, Brain and Angel",
      ],
      customerCopyBoundary: "Confirmed squeeze wording is blocked until liquidation events are signed, fresh, two-venue and durably replayable.",
      operatorAction: "Do not unlock confirmed squeeze copy; build PASS2468/PASS2469 durable liquidation replay first.",
    }),
    lane({
      id: "paid_fuse",
      label: "PASS2485 paid Advanced fuse handoff",
      state: !crypto ? "not_applicable" : paidFuseAllowed ? "ready" : args.pass2485 ? "watch" : "blocked",
      readyEvidence: [
        args.pass2485?.state && `PASS2485 ${args.pass2485.state}:${args.pass2485.readinessScore}/100`,
        paidFuseAllowed && "paidAdvancedAllowed=true",
      ],
      missingEvidence: [
        crypto && !paidFuseAllowed && "PASS2485 paidAdvancedAllowed=true",
        ...(args.pass2485?.hardBlockers ?? []).slice(0, 5),
      ],
      customerCopyBoundary: "The paid Advanced CTA follows PASS2485, not visual polish or output length.",
      operatorAction: "Keep Advanced as QA preview/missing-proof map until PASS2485 flips true with replayable proof.",
    }),
    lane({
      id: "surface_copy_lock",
      label: "Surface copy lock",
      state: !crypto ? "not_applicable" : args.pass2485 ? "watch" : "blocked",
      readyEvidence: [args.pass2485 && "same fuse object can be exposed to Shield/PDF/Brain/Angel"],
      missingEvidence: [
        crypto && "show PASS2486 fingerprint in Shield, Browser/PDF, Brain and Angel",
        crypto && "hide confirmed squeeze language unless confirmedSqueezeCopyAllowed=true",
      ],
      customerCopyBoundary: "Customer copy must say pressure/watch or missing-proof map when the proof chain is incomplete.",
      operatorAction: "Use this bridge to keep all surfaces from drifting into hype around derivatives pressure.",
    }),
  ];

  const required = lanes.filter((item) => item.state !== "not_applicable");
  const ready = required.filter((item) => item.state === "ready").length;
  const watch = required.filter((item) => item.state === "watch").length;
  const blocked = required.filter((item) => item.state === "blocked").length;
  const derivativeRuntimeReady = crypto && derivativesVenues >= 2 && hasOi && hasFunding && ratioVenues >= 2 && ratioReady;
  const confirmedSqueezeCopyAllowed = crypto && derivativeRuntimeReady && liquidationCollectorReady && liquidationReplayReady && twoVenueReplayReady && durableReplayReady && Boolean(args.pass2467?.confirmedSqueezeAllowed);
  const paidAdvancedAllowedAfterDerivativeBridge = crypto && paidFuseAllowed && derivativeRuntimeReady && liquidationReplayReady && twoVenueReplayReady && durableReplayReady;
  const bridgeScore = clamp((ready / Math.max(1, required.length)) * 70 + (watch / Math.max(1, required.length)) * 24 - blocked * 9 + (args.pass2466?.score ?? 0) * 0.04 + (args.pass2467?.score ?? 0) * 0.04);
  const state: Pass2486BridgeState = !crypto
    ? family === "real_market" ? "not_applicable" : "blocked"
    : paidAdvancedAllowedAfterDerivativeBridge
      ? "paid_ready_assist"
      : derivativeRuntimeReady || ready > 0 || watch >= 2
        ? "runtime_watch"
        : "blocked";
  const hardLocks = unique(required.filter((item) => item.state !== "ready").flatMap((item) => item.missingEvidence.map((missing) => `${item.label}: ${missing}`))).slice(0, 18);
  const fingerprint = `PASS2486-${hash({ query: args.query, symbol, family, state, bridgeScore, lanes: lanes.map((item) => [item.id, item.state]) })}`;
  const customerVerdict = !crypto
    ? "PASS2486 is a crypto derivatives bridge; Real Markets uses quote/filing/fundamental readiness instead."
    : confirmedSqueezeCopyAllowed
      ? "Derivatives pressure can be described with timestamped proof, but still without trading instructions or certainty."
      : "Advanced can show derivatives pressure as watch/context only. Confirmed squeeze and paid final verdict copy stay blocked until liquidation replay and PASS2485 are ready.";
  const operatorVerdict = paidAdvancedAllowedAfterDerivativeBridge
    ? "PASS2486 derivatives bridge no longer blocks the paid fuse; still preserve source timestamps and customer-safe copy."
    : `Do not sell confirmed derivatives conclusion yet. Close locks: ${hardLocks.slice(0, 5).join(" · ") || "derivatives proof missing"}.`;

  return {
    version: PASS2486_DERIVATIVES_PAID_READINESS_BRIDGE_ID,
    state,
    query: args.query,
    symbol,
    normalizedPair: args.pass2466?.normalizedPair || args.pass2467?.normalizedPair,
    assetFamily: family,
    derivativeRuntimeReady,
    confirmedSqueezeCopyAllowed,
    paidAdvancedAllowedAfterDerivativeBridge,
    observedDerivativeVenueCount: derivativesVenues,
    observedRatioVenueCount: ratioVenues,
    liquidationCollectorReady,
    liquidationReplayReady,
    twoVenueReplayReady,
    durableReplayReady,
    bridgeScore,
    lanes,
    hardLocks,
    customerVerdict,
    operatorVerdict,
    noOverclaimRules: [
      "Do not call a squeeze confirmed unless confirmedSqueezeCopyAllowed=true.",
      "Do not turn OI/funding or long-short ratio into leverage, entry or exit instructions.",
      "Do not sell Advanced as a final paid derivatives verdict until PASS2485 and PASS2486 both allow it.",
      "Always show missing liquidation collector/replay status when it is not ready.",
      "Real Markets must not inherit crypto derivatives proof unless a real listed derivative mapping exists.",
    ],
    nextImplementationActions: unique([
      crypto && derivativesVenues < 2 && "Stabilize second derivatives venue packet and expose observedAt/maxAge.",
      crypto && ratioVenues < 2 && "Stabilize two-venue long-short ratio and disagreement display.",
      crypto && !liquidationReplayReady && "Build signed liquidation collector/replay before confirmed squeeze wording.",
      crypto && !twoVenueReplayReady && "Add a second liquidation replay venue before confirmed squeeze wording.",
      crypto && !durableReplayReady && "Move liquidation replay from memory fallback to durable persistence before paid copy.",
      crypto && !paidFuseAllowed && "Keep PASS2485 paidAdvancedAllowed=false until all paid lanes are replayable.",
      crypto && "Render PASS2486 fingerprint in Shield modal, PDF header, Browser and Angel context.",
    ]).slice(0, 10),
    fingerprint,
    generatedAt: now.toISOString(),
  };
}
