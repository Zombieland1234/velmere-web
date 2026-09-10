import type { TokenRiskSignal } from "./risk-types";
import type { RiskEngineContext } from "./risk-engine-context";
import { addSignal, adjustedPoints, rounded } from "./risk-engine-profile";

export type LiquiditySupplySignalMetrics = {
  liquidityToMarketCapPercent?: number;
  volumeToLiquidityRatio?: number;
  volumeToMarketCapRatio?: number;
  fdvToMarketCapRatio?: number;
};

export function collectLiquidityVolumeSupplySignals(
  context: RiskEngineContext,
  signals: TokenRiskSignal[],
): LiquiditySupplySignalMetrics {
  const {
    profile, marketCap, fdv, liquidityUsd, volume24h, averageVolume7d,
    priceChange24h, circulatingSupply, supplyReference,
  } = context;
  let liquidityToMarketCapPercent: number | undefined;
  if (
    marketCap !== undefined &&
    marketCap > 0 &&
    liquidityUsd !== undefined &&
    liquidityUsd >= 0
  ) {
    liquidityToMarketCapPercent = (liquidityUsd / marketCap) * 100;
    const materialDepthThreshold =
      profile.mode === "stablecoin"
        ? 10_000_000
        : profile.mode === "rwa"
          ? 5_000_000
          : marketCap >= 100_000_000_000
            ? 100_000_000
            : marketCap >= 10_000_000_000
              ? 25_000_000
              : marketCap >= 1_000_000_000
                ? 10_000_000
                : 0;
    const hasMaterialAbsoluteDepth =
      materialDepthThreshold > 0 && liquidityUsd >= materialDepthThreshold;
    const veryThinRatioThreshold =
      (profile.mode === "stablecoin" ? 0.05 : profile.mode === "rwa" ? 0.1 : 0.25) *
      profile.liquiditySensitivity;
    const thinRatioThreshold =
      (profile.mode === "stablecoin" ? 0.2 : profile.mode === "rwa" ? 0.5 : 1) *
      profile.liquiditySensitivity;
    const reviewRatioThreshold =
      (profile.mode === "stablecoin" ? 0.6 : profile.mode === "rwa" ? 1 : 3) *
      profile.liquiditySensitivity;

    if (
      !hasMaterialAbsoluteDepth &&
      liquidityToMarketCapPercent < veryThinRatioThreshold
    ) {
      addSignal(signals, {
        id: "very_thin_liquidity",
        severity: profile.mode === "standard" ? "critical" : "high",
        points: profile.mode === "standard" ? 25 : 18,
        metrics: {
          liquidityToMarketCapPercent: rounded(liquidityToMarketCapPercent, 4),
          liquidityUsd: Math.round(liquidityUsd),
          exitDepthReview: "required",
        },
      });
    } else if (
      !hasMaterialAbsoluteDepth &&
      liquidityToMarketCapPercent < thinRatioThreshold
    ) {
      addSignal(signals, {
        id: "thin_liquidity",
        severity: "high",
        points: profile.mode === "standard" ? 18 : 13,
        metrics: {
          liquidityToMarketCapPercent: rounded(liquidityToMarketCapPercent, 4),
          liquidityUsd: Math.round(liquidityUsd),
          exitDepthReview: "required",
        },
      });
    } else if (
      !hasMaterialAbsoluteDepth &&
      liquidityToMarketCapPercent < reviewRatioThreshold
    ) {
      addSignal(signals, {
        id: "thin_liquidity",
        severity: "medium",
        points: profile.mode === "standard" ? 10 : 8,
        metrics: {
          liquidityToMarketCapPercent: rounded(liquidityToMarketCapPercent, 4),
          liquidityUsd: Math.round(liquidityUsd),
          exitDepthReview: "required",
        },
      });
    }
    if (liquidityUsd < 25_000) {
      addSignal(signals, {
        id: "low_dex_liquidity",
        severity: "high",
        points: 14,
        metrics: { liquidityUsd: Math.round(liquidityUsd) },
      });
    } else if (liquidityUsd < 100_000) {
      addSignal(signals, {
        id: "low_dex_liquidity",
        severity: "medium",
        points: 10,
        metrics: { liquidityUsd: Math.round(liquidityUsd) },
      });
    }
  } else if (liquidityUsd !== undefined && liquidityUsd < 100_000) {
    addSignal(signals, {
      id: "low_dex_liquidity",
      severity: liquidityUsd < 25_000 ? "high" : "medium",
      points: liquidityUsd < 25_000 ? 14 : 10,
      metrics: { liquidityUsd: Math.round(liquidityUsd) },
    });
  }

  let volumeToLiquidityRatio: number | undefined;
  if (
    volume24h !== undefined &&
    liquidityUsd !== undefined &&
    liquidityUsd > 0
  ) {
    volumeToLiquidityRatio = volume24h / liquidityUsd;
    const threshold = profile.mode === "stablecoin" ? 45 : 20;
    if (volumeToLiquidityRatio >= threshold) {
      addSignal(signals, {
        id: "volume_spike",
        severity: "high",
        points: adjustedPoints(16, profile.volumeAnomalyWeight),
        metrics: {
          volumeToLiquidityRatio: rounded(volumeToLiquidityRatio),
          turnoverReview: "required",
        },
      });
    }
  }

  let volumeToMarketCapRatio: number | undefined;
  if (
    marketCap !== undefined &&
    marketCap > 0 &&
    volume24h !== undefined &&
    volume24h >= 0
  ) {
    volumeToMarketCapRatio = volume24h / marketCap;
    const highTurnoverThreshold =
      profile.mode === "stablecoin" ? 6 : profile.mode === "rwa" ? 3 : 2;
    const elevatedTurnoverThreshold =
      profile.mode === "stablecoin" ? 2.5 : profile.mode === "rwa" ? 1 : 0.75;

    if (volumeToMarketCapRatio >= highTurnoverThreshold) {
      addSignal(signals, {
        id: "wash_trading_risk",
        severity: "high",
        points: adjustedPoints(20, profile.volumeAnomalyWeight),
        metrics: {
          volumeToMarketCapRatio: rounded(volumeToMarketCapRatio),
          volumeQualityReview: "required",
        },
      });
    } else if (volumeToMarketCapRatio >= elevatedTurnoverThreshold) {
      addSignal(signals, {
        id: "market_volume_stress",
        severity: "medium",
        points: adjustedPoints(12, profile.volumeAnomalyWeight),
        metrics: {
          volumeToMarketCapRatio: rounded(volumeToMarketCapRatio),
          volumeQualityReview: "required",
        },
      });
    } else if (marketCap >= 50_000_000 && volumeToMarketCapRatio < 0.001) {
      addSignal(signals, {
        id: "market_volume_stress",
        severity: "high",
        points: 14,
        metrics: {
          volumeToMarketCapRatio: rounded(volumeToMarketCapRatio, 6),
          thinExitDepthReview: "required",
        },
      });
    } else if (marketCap >= 50_000_000 && volumeToMarketCapRatio < 0.005) {
      addSignal(signals, {
        id: "market_volume_stress",
        severity: "medium",
        points: 8,
        metrics: {
          volumeToMarketCapRatio: rounded(volumeToMarketCapRatio, 6),
          thinExitDepthReview: "required",
        },
      });
    }
    if (
      profile.mode === "rwa" &&
      marketCap >= 1_000_000 &&
      volumeToMarketCapRatio < 0.001
    ) {
      addSignal(signals, {
        id: "market_volume_stress",
        severity: "high",
        points: 14,
        metrics: {
          volumeToMarketCapRatio: rounded(volumeToMarketCapRatio, 6),
          redemptionDepthReview: "required",
        },
      });
    }
  }

  if (
    volume24h !== undefined &&
    averageVolume7d !== undefined &&
    averageVolume7d > 0
  ) {
    const volumeToAverageRatio = volume24h / averageVolume7d;
    const threshold = profile.mode === "stablecoin" ? 18 : 10;
    if (volumeToAverageRatio >= threshold) {
      addSignal(signals, {
        id: "volume_spike",
        severity: "high",
        points: adjustedPoints(15, profile.volumeAnomalyWeight),
        metrics: { volumeToAverageRatio: rounded(volumeToAverageRatio) },
      });
    }
  }
  if (
    profile.mode !== "stablecoin" &&
    priceChange24h !== undefined &&
    priceChange24h >= 45 &&
    volumeToMarketCapRatio !== undefined &&
    volumeToMarketCapRatio >= 0.5
  ) {
    addSignal(signals, {
      id: "volume_spike",
      severity: "high",
      points: adjustedPoints(18, profile.volumeAnomalyWeight),
      metrics: {
        repricingWithTurnover: true,
        volumeToMarketCapRatio: rounded(volumeToMarketCapRatio),
      },
    });
  }

  let fdvToMarketCapRatio: number | undefined;
  if (
    fdv !== undefined &&
    marketCap !== undefined &&
    marketCap > 0 &&
    fdv > marketCap
  ) {
    fdvToMarketCapRatio = fdv / marketCap;
    if (fdvToMarketCapRatio >= 10) {
      addSignal(signals, {
        id: "fdv_marketcap_gap",
        severity: "high",
        points: 18,
        metrics: {
          fdvToMarketCapRatio: rounded(fdvToMarketCapRatio),
          unlockOverhangReview: "required",
        },
      });
    } else if (fdvToMarketCapRatio >= 5) {
      addSignal(signals, {
        id: "fdv_marketcap_gap",
        severity: "high",
        points: 13,
        metrics: {
          fdvToMarketCapRatio: rounded(fdvToMarketCapRatio),
          unlockOverhangReview: "required",
        },
      });
    } else if (fdvToMarketCapRatio >= 2.5) {
      addSignal(signals, {
        id: "fdv_marketcap_gap",
        severity: "medium",
        points: 8,
        metrics: {
          fdvToMarketCapRatio: rounded(fdvToMarketCapRatio),
          unlockOverhangReview: "required",
        },
      });
    }
  }
  if (
    fdvToMarketCapRatio !== undefined &&
    fdvToMarketCapRatio >= 2.5 &&
    supplyReference === undefined
  ) {
    addSignal(signals, {
      id: "insufficient_data",
      severity: fdvToMarketCapRatio >= 5 ? "high" : "medium",
      points: fdvToMarketCapRatio >= 5 ? 12 : 8,
      metrics: {
        fdvToMarketCapRatio: rounded(fdvToMarketCapRatio),
        unlockScheduleMissing: true,
        sourceReview: "required",
      },
    });
  }

  if (
    circulatingSupply !== undefined &&
    circulatingSupply >= 0 &&
    supplyReference !== undefined
  ) {
    const circulatingPercent = (circulatingSupply / supplyReference) * 100;
    if (circulatingPercent < 5) {
      addSignal(signals, {
        id: "supply_overhang",
        severity: "critical",
        points: 28,
        metrics: {
          circulatingPercent: rounded(circulatingPercent),
          floatOpacityReview: "required",
        },
      });
    } else if (circulatingPercent < 10) {
      addSignal(signals, {
        id: "supply_overhang",
        severity: "high",
        points: 20,
        metrics: {
          circulatingPercent: rounded(circulatingPercent),
          floatOpacityReview: "required",
        },
      });
    } else if (circulatingPercent < 20) {
      addSignal(signals, {
        id: "supply_overhang",
        severity: "high",
        points: 14,
        metrics: {
          circulatingPercent: rounded(circulatingPercent),
          floatOpacityReview: "required",
        },
      });
    } else if (circulatingPercent < 35) {
      addSignal(signals, {
        id: "supply_overhang",
        severity: "medium",
        points: 8,
        metrics: {
          circulatingPercent: rounded(circulatingPercent),
          floatOpacityReview: "required",
        },
      });
    }
    if (
      circulatingPercent < 20 &&
      fdvToMarketCapRatio !== undefined &&
      fdvToMarketCapRatio >= 5
    ) {
      addSignal(signals, {
        id: "supply_overhang",
        severity:
          circulatingPercent < 10 && fdvToMarketCapRatio >= 10
            ? "critical"
            : "high",
        points:
          circulatingPercent < 10 && fdvToMarketCapRatio >= 10 ? 34 : 23,
        metrics: {
          circulatingPercent: rounded(circulatingPercent),
          fdvToMarketCapRatio: rounded(fdvToMarketCapRatio),
          unlockOverhangReview: "required",
        },
      });
    }
  }
  return {
    liquidityToMarketCapPercent,
    volumeToLiquidityRatio,
    volumeToMarketCapRatio,
    fdvToMarketCapRatio,
  };
}
