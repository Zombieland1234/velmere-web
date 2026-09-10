import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2816RuntimeState } from "@/lib/market-integrity/top1-runtime-observability-ledger";
export type Pass2817MicrostructureAssetFamily =
  | "native_crypto"
  | "erc20"
  | "stablecoin"
  | "defi_protocol"
  | "exchange_health"
  | "equity"
  | "etf"
  | "fx"
  | "commodity"
  | "real_estate"
  | "unknown";

export type Pass2817MicrostructureStatus =
  | "source_bound"
  | "degraded_missing_orderbook"
  | "not_applicable_for_family"
  | "locked_paid_evidence";

export type Pass2817MarketMicrostructureGate = {
  schemaVersion: "pass2817_market_microstructure_gate_v1";
  tier: VelmereTier;
  assetFamily: Pass2817MicrostructureAssetFamily;
  generatedAt: string;
  status: Pass2817MicrostructureStatus;
  requiredEvidence: string[];
  availableEvidence: string[];
  missingEvidence: string[];
  scoreLanes: {
    orderBookStress: number;
    liquidityDepthStress: number;
    bidAskSpreadStress: number;
    slippageStress: number;
    longSqueezeRisk: number;
    shortSqueezeRisk: number;
    crashPressure: number;
    rugExitRisk: number;
  };
  normalizedInputs: {
    spreadBps: number | null;
    slippageBps: number | null;
    depthUsd: number | null;
    orderBookLevels: number;
    openInterestUsd: number | null;
    fundingRateBps: number | null;
    longShortRatio: number | null;
  };
  confidenceImpact: {
    confidenceCap: number;
    reason: string;
  };
  rendererRules: {
    uiRule: string;
    pdfRule: string;
    shieldProRule: string;
    paidTierRule: string;
  };
  releaseGate: {
    status: "pass" | "warn" | "block";
    reasons: string[];
  };
};

export const PASS2817_MARKET_MICROSTRUCTURE_ACCEPTANCE_GATES = [
  "Order book, spread, depth, slippage, funding, OI and long/short fields must be separated from generic price candles.",
  "A chart with OHLCV is not enough to claim order-book stress; missing order book becomes missing evidence and confidence cap.",
  "Equities/ETF/FX/commodities must not use ERC-20 holder/tax lanes, while ERC-20 rug/exit risk must not be averaged away by market candles.",
  "Basic can show a shallow microstructure summary, Pro requires receipt-bound depth/slippage lanes, Advanced requires conflict review or human notes for paid reports.",
  "Shield Pro monochrome boards may display prepared microstructure values only when labelled fixture/prepared; live-looking values require source receipts.",
  "PDF renderer must reuse the same microstructure gate as UI and must mark any missing order book/derivatives lane as missing evidence, not zero risk.",
] as const;

const cryptoFamilies: Pass2817MicrostructureAssetFamily[] = ["native_crypto", "erc20", "stablecoin", "defi_protocol", "exchange_health"];
const realMarketFamilies: Pass2817MicrostructureAssetFamily[] = ["equity", "etf", "fx", "commodity", "real_estate"];

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function laneFrom(value: number | null | undefined, missingPenalty: number, scale = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return missingPenalty;
  return clampPercent(Math.abs(value) * scale);
}

function familyRequiresOrderBook(family: Pass2817MicrostructureAssetFamily) {
  return cryptoFamilies.includes(family) || family === "exchange_health";
}

function familyUsesRugLane(family: Pass2817MicrostructureAssetFamily) {
  return family === "erc20" || family === "defi_protocol" || family === "stablecoin";
}

export function buildPass2817MarketMicrostructureGate(args: {
  tier?: VelmereTier;
  assetFamily: Pass2817MicrostructureAssetFamily;
  generatedAt?: string;
  chartSourceBound?: boolean;
  paidEvidenceAllowed?: boolean;
  runtimeState?: Pass2816RuntimeState;
  sourceFamilyCount?: number;
  orderBookLevels?: number;
  spreadBps?: number | null;
  slippageBps?: number | null;
  depthUsd?: number | null;
  openInterestUsd?: number | null;
  fundingRateBps?: number | null;
  longShortRatio?: number | null;
}): Pass2817MarketMicrostructureGate {
  const tier = args.tier ?? "Basic";
  const family = args.assetFamily;
  const orderBookLevels = Math.max(0, args.orderBookLevels ?? 0);
  const sourceFamilyCount = Math.max(0, args.sourceFamilyCount ?? 0);
  const orderBookRequired = familyRequiresOrderBook(family);
  const paidDepthRequired = tier !== "Basic";
  const missingEvidence: string[] = [];
  const availableEvidence: string[] = [];

  if (args.chartSourceBound) availableEvidence.push("source-bound OHLCV/chart receipt");
  else missingEvidence.push("source-bound OHLCV/chart receipt");

  if (orderBookRequired) {
    if (orderBookLevels >= 2) availableEvidence.push("order book depth levels");
    else missingEvidence.push("order book depth levels");
    if (typeof args.spreadBps === "number") availableEvidence.push("bid/ask spread");
    else missingEvidence.push("bid/ask spread");
    if (typeof args.slippageBps === "number") availableEvidence.push("slippage estimate");
    else missingEvidence.push("slippage estimate");
  }

  if (cryptoFamilies.includes(family)) {
    if (typeof args.openInterestUsd === "number") availableEvidence.push("open interest");
    else missingEvidence.push("open interest");
    if (typeof args.fundingRateBps === "number") availableEvidence.push("funding rate");
    else missingEvidence.push("funding rate");
    if (typeof args.longShortRatio === "number") availableEvidence.push("long/short ratio");
    else missingEvidence.push("long/short ratio");
  }

  if (realMarketFamilies.includes(family)) {
    availableEvidence.push("real-market quote/volume lane");
    if (family === "equity" || family === "etf") missingEvidence.push("options/earnings/event pressure lane");
    if (family === "fx" || family === "commodity") missingEvidence.push("macro/liquidity venue depth lane");
  }

  if (paidDepthRequired && !args.paidEvidenceAllowed) missingEvidence.push("paid Pro/Advanced microstructure receipt entitlement");
  if (args.runtimeState === "degraded" || args.runtimeState === "circuit_open") missingEvidence.push(`runtime state ${args.runtimeState}`);

  const notApplicable = !orderBookRequired && family !== "unknown" && !cryptoFamilies.includes(family);
  const lockedPaid = paidDepthRequired && !args.paidEvidenceAllowed;
  const sourceBound = missingEvidence.length === 0 && sourceFamilyCount >= (tier === "Basic" ? 1 : tier === "Pro" ? 2 : 3);
  const status: Pass2817MicrostructureStatus = notApplicable
    ? "not_applicable_for_family"
    : lockedPaid
      ? "locked_paid_evidence"
      : sourceBound
        ? "source_bound"
        : "degraded_missing_orderbook";

  const orderBookStress = orderBookRequired ? laneFrom(args.spreadBps, orderBookLevels ? 32 : 58, 2.5) : 0;
  const liquidityDepthStress = orderBookRequired
    ? clampPercent(typeof args.depthUsd === "number" && args.depthUsd > 0 ? 100 - Math.min(100, Math.log10(args.depthUsd + 1) * 12) : 62)
    : realMarketFamilies.includes(family)
      ? 18
      : 44;
  const slippageStress = orderBookRequired ? laneFrom(args.slippageBps, 54, 1.2) : 0;
  const spreadStress = orderBookRequired ? laneFrom(args.spreadBps, 38, 3.2) : 8;
  const fundingStress = laneFrom(args.fundingRateBps, cryptoFamilies.includes(family) ? 36 : 0, 4);
  const ratioStress = typeof args.longShortRatio === "number" ? clampPercent(Math.abs(args.longShortRatio - 1) * 55) : cryptoFamilies.includes(family) ? 40 : 0;
  const longSqueezeRisk = cryptoFamilies.includes(family) ? clampPercent((fundingStress * 0.42) + (ratioStress * 0.42) + (liquidityDepthStress * 0.16)) : 0;
  const shortSqueezeRisk = cryptoFamilies.includes(family) ? clampPercent((spreadStress * 0.3) + (ratioStress * 0.45) + (orderBookStress * 0.25)) : 0;
  const crashPressure = clampPercent((liquidityDepthStress * 0.36) + (slippageStress * 0.28) + (orderBookStress * 0.2) + (missingEvidence.length * 2.2));
  const rugExitRisk = familyUsesRugLane(family) ? clampPercent((liquidityDepthStress * 0.42) + (slippageStress * 0.32) + (missingEvidence.length * 3.4)) : 0;

  const confidenceCap = clampPercent(Math.max(24, 88 - missingEvidence.length * 7 - (args.runtimeState === "circuit_open" ? 30 : args.runtimeState === "degraded" ? 12 : 0)));
  const releaseStatus: "pass" | "warn" | "block" = status === "source_bound" || status === "not_applicable_for_family" ? "pass" : status === "locked_paid_evidence" ? "block" : "warn";

  return {
    schemaVersion: "pass2817_market_microstructure_gate_v1",
    tier,
    assetFamily: family,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    status,
    requiredEvidence: [
      "source-bound chart receipt",
      orderBookRequired ? "order book depth levels" : "asset-family microstructure substitute",
      orderBookRequired ? "spread/slippage receipts" : "quote/volume/fundamental liquidity lane",
      cryptoFamilies.includes(family) ? "derivatives funding/open interest/long-short receipts" : "event/options/macro pressure receipt where available",
      tier !== "Basic" ? "paid source receipt entitlement" : "Basic missing-evidence label",
    ],
    availableEvidence,
    missingEvidence,
    scoreLanes: {
      orderBookStress,
      liquidityDepthStress,
      bidAskSpreadStress: spreadStress,
      slippageStress,
      longSqueezeRisk,
      shortSqueezeRisk,
      crashPressure,
      rugExitRisk,
    },
    normalizedInputs: {
      spreadBps: typeof args.spreadBps === "number" ? args.spreadBps : null,
      slippageBps: typeof args.slippageBps === "number" ? args.slippageBps : null,
      depthUsd: typeof args.depthUsd === "number" ? args.depthUsd : null,
      orderBookLevels,
      openInterestUsd: typeof args.openInterestUsd === "number" ? args.openInterestUsd : null,
      fundingRateBps: typeof args.fundingRateBps === "number" ? args.fundingRateBps : null,
      longShortRatio: typeof args.longShortRatio === "number" ? args.longShortRatio : null,
    },
    confidenceImpact: {
      confidenceCap,
      reason: missingEvidence.length
        ? `Microstructure confidence capped at ${confidenceCap.toFixed(2)}% because ${missingEvidence.slice(0, 4).join(" / ")}.`
        : "Microstructure evidence is source-bound for this tier and asset family.",
    },
    rendererRules: {
      uiRule: "UI must label unavailable microstructure lanes as missing evidence rather than drawing fake order book/depth charts.",
      pdfRule: "PDF must reuse this exact microstructure gate and print missing order book/derivative lanes in the Missing Evidence page.",
      shieldProRule: "Shield Pro B/W boards can show prepared grayscale microstructure values only with fixture/prepared labels until receipts exist.",
      paidTierRule: "Pro/Advanced microstructure lanes require server receipt + report token + payload hash parity; wallet connect does not unlock them.",
    },
    releaseGate: {
      status: releaseStatus,
      reasons: missingEvidence.length ? missingEvidence : ["microstructure gate accepted for current asset family/tier"],
    },
  };
}
