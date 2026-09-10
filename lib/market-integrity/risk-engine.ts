import type { TokenRiskInput, TokenRiskResult, TokenRiskSignal } from "./risk-types";
import { buildRiskIndicatorCustomerTruth } from "./risk-indicator-customer-truth";
import type { VlmCustomerLocale, VlmReportContextDepth } from "../product/vlm-standalone-customer-truth";
import { validateTokenRiskInput } from "./data-backbone";
import {
  badgeFromLevel as profileBadgeFromLevel,
  buildLimitations,
  computeDataConfidence,
  levelFromScore as profileLevelFromScore,
  rounded,
} from "./risk-engine-profile";
import {
  buildAgentAssessments,
  buildMetaModel,
  buildScoreBreakdown,
  computeFusedRiskScore,
} from "./risk-engine-model";
import { buildRiskEngineContext } from "./risk-engine-context";
import { collectDataAndVelocitySignals } from "./risk-engine-velocity";
import { collectLiquidityVolumeSupplySignals } from "./risk-engine-liquidity-supply";
import { collectMicrostructureHolderContractSignals } from "./risk-engine-microstructure-contract";
import { buildRiskUncertaintyEnvelope } from "./risk-uncertainty-envelope";
import { buildRiskModelBinding, RISK_SCORE_FORMULA } from "./risk-model-binding";

export function levelFromScore(score: number) {
  return profileLevelFromScore(score);
}

export function badgeFromLevel(level: ReturnType<typeof profileLevelFromScore>) {
  return profileBadgeFromLevel(level);
}

/*
 * Dev calibration invariants:
 * - BTC-like depth and coverage remain low unless anomaly fields are present.
 * - SOL-like volatility alone does not become critical.
 * - Low float + FDV gap + parabolic repricing escalates to manual review.
 * - Honeypot, or tax controls combined with blacklist controls, gets a hard floor.
 * - Stablecoin depeg is reviewed even when normal volatility weights are reduced.
 * - RWA low volume remains an exit/redemption concern, not a low-risk signal.
 * - Meme-profile repricing needs social/source-ledger review before interpretation.
 * - Unknown asset profile cannot produce a strong clean verdict from missing evidence.
 * - Dead markets combine drawdown with thin depth instead of relying on price alone.
 */
export function analyzeTokenRisk(
  input: TokenRiskInput,
  dataQuality: TokenRiskResult["dataQuality"] = "partial",
  options?: { locale?: VlmCustomerLocale; reportContextDepth?: VlmReportContextDepth | null },
): TokenRiskResult {
  const validation = validateTokenRiskInput(input);
  if (!validation.ok) {
    throw new Error("risk_engine_input_validation_failed");
  }
  const context = buildRiskEngineContext(input, validation);
  const { safeInput, profile, assetClass } = context;
  const signals: TokenRiskSignal[] = [];

  const velocityMetrics = collectDataAndVelocitySignals(context, signals);
  const liquidityMetrics = collectLiquidityVolumeSupplySignals(context, signals);
  const microstructureMetrics = collectMicrostructureHolderContractSignals(
    context,
    signals,
  );

  const confidence = computeDataConfidence(safeInput, dataQuality, profile);
  const scoreBreakdown = buildScoreBreakdown(signals, confidence);
  const score = computeFusedRiskScore(
    signals,
    scoreBreakdown,
    confidence,
    profile,
    safeInput,
  );
  const level = levelFromScore(score);
  const agentAssessments = buildAgentAssessments(
    signals,
    safeInput,
    dataQuality,
    confidence,
    profile,
  );
  const limitations = buildLimitations(
    safeInput,
    profile,
    validation.ok,
    confidence,
    dataQuality,
  );
  const metaModel = buildMetaModel(
    safeInput.symbol,
    score,
    level,
    confidence,
    agentAssessments,
    signals,
    limitations,
    profile,
  );
  const uncertainty = buildRiskUncertaintyEnvelope({
    riskInput: safeInput,
    score,
    confidence,
    dataQuality,
    signals,
    limitations,
  });

  const baseResult = {
    token: {
      marketId: safeInput.marketId,
      symbol: safeInput.symbol,
      name: safeInput.name,
      image: safeInput.image,
      rank: safeInput.rank,
      chainId: safeInput.chainId,
      tokenAddress: safeInput.tokenAddress,
      pairAddress: safeInput.pairAddress,
      dexId: safeInput.dexId,
      url: safeInput.url,
      assetClass,
    },
    score,
    modelBinding: buildRiskModelBinding(safeInput, assetClass),
    uncertainty,
    scoreFormula: RISK_SCORE_FORMULA,
    confidence,
    scoreBreakdown,
    agentAssessments,
    metaModel,
    level,
    badge: badgeFromLevel(level),
    signals,
    metrics: {
      currentPrice: context.currentPrice,
      athPrice: context.athPrice,
      drawdownPercent:
        velocityMetrics.drawdownPercent !== undefined
          ? rounded(velocityMetrics.drawdownPercent)
          : undefined,
      marketCap: context.marketCap,
      fdv: context.fdv,
      fdvToMarketCapRatio:
        liquidityMetrics.fdvToMarketCapRatio !== undefined
          ? rounded(liquidityMetrics.fdvToMarketCapRatio)
          : undefined,
      liquidityUsd: context.liquidityUsd,
      liquidityToMarketCapPercent:
        liquidityMetrics.liquidityToMarketCapPercent !== undefined
          ? rounded(liquidityMetrics.liquidityToMarketCapPercent, 4)
          : undefined,
      volume24h: context.volume24h,
      volumeToLiquidityRatio:
        liquidityMetrics.volumeToLiquidityRatio !== undefined
          ? rounded(liquidityMetrics.volumeToLiquidityRatio)
          : undefined,
      volumeToMarketCapRatio:
        liquidityMetrics.volumeToMarketCapRatio !== undefined
          ? rounded(liquidityMetrics.volumeToMarketCapRatio)
          : undefined,
      priceChange1h: context.priceChange1h,
      priceChange6h: context.priceChange6h,
      priceChange24h: context.priceChange24h,
      priceChange7d: context.priceChange7d,
      priceChange14d: context.priceChange14d,
      priceChange30d: context.priceChange30d,
      buySellImbalancePercent:
        microstructureMetrics.buySellImbalancePercent !== undefined
          ? rounded(microstructureMetrics.buySellImbalancePercent)
          : undefined,
      top10HolderPercent: microstructureMetrics.top10HolderPercent,
      holderCount: microstructureMetrics.holderCount,
      buyTaxPercentage: microstructureMetrics.buyTaxPercentage,
      sellTaxPercentage: microstructureMetrics.sellTaxPercentage,
      simulatedSlippage10k: microstructureMetrics.simulatedSlippage10k,
      bidAskImbalancePercent: microstructureMetrics.bidAskImbalancePercent,
      circulatingSupply: context.circulatingSupply,
      totalSupply: context.totalSupply,
      maxSupply: context.maxSupply,
      providerHealthScore: safeInput.providerHealthScore,
      sourceDivergenceBps: safeInput.sourceDivergenceBps,
      freshnessSeconds: safeInput.freshnessSeconds,
    },
    dataQuality,
    chart: { sevenDay: safeInput.sparkline7d },
    aiSummary: metaModel.summary,
    dataSources: safeInput.dataSources ?? [],
    generatedAt: new Date().toISOString(),
  } satisfies Omit<TokenRiskResult, "customerTruth">;

  const customerTruth = buildRiskIndicatorCustomerTruth({
    input: safeInput,
    result: baseResult,
    locale: options?.locale,
    reportContextDepth: options?.reportContextDepth ?? null,
  });
  return { ...baseResult, customerTruth };
}

// PASS2279 markers: sourceFamilyKey · Yahoo quote/chart one provider family · missing source lowers confidence not fake live risk
