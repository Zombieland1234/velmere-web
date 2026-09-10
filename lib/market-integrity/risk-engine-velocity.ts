import type { TokenRiskSignal } from "./risk-types";
import type { RiskEngineContext } from "./risk-engine-context";
import { addSignal, adjustedPoints, missingCoreFieldNames, rounded } from "./risk-engine-profile";

export type VelocitySignalMetrics = { drawdownPercent?: number };

export function collectDataAndVelocitySignals(
  context: RiskEngineContext,
  signals: TokenRiskSignal[],
): VelocitySignalMetrics {
  const {
    validation, validationWarnings, safeInput, profile, consistency,
    currentPrice, athPrice, priceChange1h, priceChange6h, priceChange24h,
    priceChange7d, priceChange30d,
  } = context;
  if (!validation.ok) {
    addSignal(signals, {
      id: "insufficient_data",
      severity: "high",
      points: 12,
      metrics: { validation: "failed" },
    });
  } else if (validationWarnings.length > 0) {
    addSignal(signals, {
      id: "insufficient_data",
      severity: "medium",
      points: Math.min(10, 3 + validationWarnings.length * 2),
      metrics: { warnings: validationWarnings.length },
    });
  }
  if (consistency.hasImpossibleValue || consistency.hasSupplyConflict) {
    addSignal(signals, {
      id: "insufficient_data",
      severity: "high",
      points: 14,
      metrics: {
        impossibleNumericInput: consistency.hasImpossibleValue,
        supplyConflict: consistency.hasSupplyConflict,
        sourceReview: "required",
      },
    });
  }

  const providerHealthScore = typeof safeInput.providerHealthScore === "number" && Number.isFinite(safeInput.providerHealthScore)
    ? Math.max(0, Math.min(100, safeInput.providerHealthScore))
    : undefined;
  if (providerHealthScore !== undefined && providerHealthScore < 72) {
    addSignal(signals, {
      id: "provider_health_degradation",
      severity: providerHealthScore < 35 ? "critical" : providerHealthScore < 55 ? "high" : "medium",
      points: providerHealthScore < 35 ? 30 : providerHealthScore < 55 ? 20 : 10,
      metrics: { providerHealthScore: rounded(providerHealthScore), observedRisk: "venue_runtime" },
    });
  }

  const sourceDivergenceBps = typeof safeInput.sourceDivergenceBps === "number" && Number.isFinite(safeInput.sourceDivergenceBps)
    ? Math.abs(safeInput.sourceDivergenceBps)
    : undefined;
  if (sourceDivergenceBps !== undefined && sourceDivergenceBps >= 35) {
    addSignal(signals, {
      id: "source_divergence",
      severity: sourceDivergenceBps >= 250 ? "critical" : sourceDivergenceBps >= 100 ? "high" : "medium",
      points: sourceDivergenceBps >= 250 ? 26 : sourceDivergenceBps >= 100 ? 17 : 9,
      metrics: { sourceDivergenceBps: rounded(sourceDivergenceBps), consensusState: safeInput.consensusState ?? "unknown" },
    });
  }

  const freshnessSeconds = typeof safeInput.freshnessSeconds === "number" && Number.isFinite(safeInput.freshnessSeconds)
    ? Math.max(0, safeInput.freshnessSeconds)
    : undefined;
  const staleByState = safeInput.freshnessState === "stale" || safeInput.consensusState === "stale";
  if (staleByState || (freshnessSeconds !== undefined && freshnessSeconds >= 900)) {
    addSignal(signals, {
      id: "stale_market_data",
      severity: freshnessSeconds !== undefined && freshnessSeconds >= 3_600 ? "high" : "medium",
      points: freshnessSeconds !== undefined && freshnessSeconds >= 3_600 ? 14 : 7,
      metrics: { freshnessSeconds: freshnessSeconds ?? null, freshnessState: safeInput.freshnessState ?? "unknown" },
    });
  }

  const missingCoreFields = missingCoreFieldNames(safeInput);
  const missingCoreCount = missingCoreFields.length;

  if (missingCoreCount > 0) {
    addSignal(signals, {
      id: "insufficient_data",
      severity: missingCoreCount >= 5 ? "high" : "medium",
      points: Math.min(20, 3 + missingCoreCount * 2),
      metrics: {
        missingCoreCount,
        missingFields: missingCoreFields.slice(0, 4).join(", "),
        uncertaintyReview: "required",
      },
    });
  }

  let drawdownPercent: number | undefined;
  if (
    athPrice !== undefined &&
    currentPrice !== undefined &&
    athPrice > 0 &&
    currentPrice > 0
  ) {
    drawdownPercent = ((athPrice - currentPrice) / athPrice) * 100;
    if (drawdownPercent >= 90) {
      addSignal(signals, {
        id: "extreme_drawdown",
        severity: "critical",
        points: adjustedPoints(30, profile.volatilityWeight),
        metrics: { drawdownPercent: rounded(drawdownPercent) },
      });
    } else if (drawdownPercent >= 70) {
      addSignal(signals, {
        id: "major_drawdown",
        severity: "high",
        points: adjustedPoints(20, profile.volatilityWeight),
        metrics: { drawdownPercent: rounded(drawdownPercent) },
      });
    }
  }

  if (priceChange1h !== undefined && Math.abs(priceChange1h) >= 18) {
    addSignal(signals, {
      id: "rapid_intraday_move",
      severity: Math.abs(priceChange1h) >= 35 ? "high" : "medium",
      points: adjustedPoints(
        Math.abs(priceChange1h) >= 35 ? 18 : 10,
        profile.volatilityWeight,
      ),
      metrics: { priceChange1h: rounded(priceChange1h) },
    });
  }
  if (priceChange6h !== undefined && Math.abs(priceChange6h) >= 30) {
    addSignal(signals, {
      id: "rapid_intraday_move",
      severity: Math.abs(priceChange6h) >= 60 ? "high" : "medium",
      points: adjustedPoints(
        Math.abs(priceChange6h) >= 60 ? 18 : 11,
        profile.volatilityWeight,
      ),
      metrics: { priceChange6h: rounded(priceChange6h) },
    });
  }
  if (priceChange24h !== undefined) {
    if (priceChange24h <= -80) {
      addSignal(signals, {
        id: "severe_24h_drop",
        severity: "critical",
        points: adjustedPoints(27, profile.volatilityWeight),
        metrics: { priceChange24h: rounded(priceChange24h) },
      });
    } else if (priceChange24h <= -45) {
      addSignal(signals, {
        id: "high_24h_drop",
        severity: "high",
        points: adjustedPoints(17, profile.volatilityWeight),
        metrics: { priceChange24h: rounded(priceChange24h) },
      });
    } else if (priceChange24h >= 120) {
      addSignal(signals, {
        id: "parabolic_24h_gain",
        severity: "critical",
        points: adjustedPoints(38, profile.volatilityWeight),
        metrics: { priceChange24h: rounded(priceChange24h) },
      });
    } else if (priceChange24h >= 45) {
      addSignal(signals, {
        id: "parabolic_24h_gain",
        severity: "high",
        points: adjustedPoints(
          priceChange24h >= 80 ? 31 : 23,
          profile.volatilityWeight,
        ),
        metrics: { priceChange24h: rounded(priceChange24h) },
      });
    }
  }
  if (priceChange7d !== undefined) {
    if (priceChange7d <= -80) {
      addSignal(signals, {
        id: "extreme_drawdown",
        severity: "critical",
        points: adjustedPoints(20, profile.volatilityWeight),
        metrics: { priceChange7d: rounded(priceChange7d) },
      });
    } else if (priceChange7d <= -50) {
      addSignal(signals, {
        id: "major_drawdown",
        severity: "high",
        points: adjustedPoints(13, profile.volatilityWeight),
        metrics: { priceChange7d: rounded(priceChange7d) },
      });
    } else if (priceChange7d >= 300) {
      addSignal(signals, {
        id: "parabolic_7d_gain",
        severity: "critical",
        points: adjustedPoints(42, profile.volatilityWeight),
        metrics: { priceChange7d: rounded(priceChange7d) },
      });
    } else if (priceChange7d >= 100) {
      addSignal(signals, {
        id: "parabolic_7d_gain",
        severity: "high",
        points: adjustedPoints(
          priceChange7d >= 200 ? 36 : 27,
          profile.volatilityWeight,
        ),
        metrics: { priceChange7d: rounded(priceChange7d) },
      });
    } else if (priceChange7d >= 55) {
      addSignal(signals, {
        id: "parabolic_7d_gain",
        severity: "medium",
        points: adjustedPoints(15, profile.volatilityWeight),
        metrics: { priceChange7d: rounded(priceChange7d) },
      });
    }
  }
  if (priceChange30d !== undefined) {
    if (priceChange30d >= 1000) {
      addSignal(signals, {
        id: "parabolic_30d_gain",
        severity: "critical",
        points: adjustedPoints(44, profile.volatilityWeight),
        metrics: { priceChange30d: rounded(priceChange30d) },
      });
    } else if (priceChange30d >= 300) {
      addSignal(signals, {
        id: "parabolic_30d_gain",
        severity: "critical",
        points: adjustedPoints(34, profile.volatilityWeight),
        metrics: { priceChange30d: rounded(priceChange30d) },
      });
    } else if (priceChange30d >= 150) {
      addSignal(signals, {
        id: "parabolic_30d_gain",
        severity: "high",
        points: adjustedPoints(24, profile.volatilityWeight),
        metrics: { priceChange30d: rounded(priceChange30d) },
      });
    } else if (priceChange30d <= -80) {
      addSignal(signals, {
        id: "extreme_drawdown",
        severity: "critical",
        points: adjustedPoints(22, profile.volatilityWeight),
        metrics: { priceChange30d: rounded(priceChange30d) },
      });
    }
  }
  if (
    priceChange24h !== undefined &&
    priceChange7d !== undefined &&
    priceChange24h >= 45 &&
    priceChange7d >= 150
  ) {
    addSignal(signals, {
      id: "multi_timeframe_pump",
      severity: "critical",
      points: adjustedPoints(36, profile.volatilityWeight),
      metrics: {
        priceChange24h: rounded(priceChange24h),
        priceChange7d: rounded(priceChange7d),
      },
    });
  }
  if (
    priceChange7d !== undefined &&
    priceChange30d !== undefined &&
    priceChange7d >= 180 &&
    priceChange30d >= 250
  ) {
    addSignal(signals, {
      id: "multi_timeframe_pump",
      severity: "critical",
      points: adjustedPoints(42, profile.volatilityWeight),
      metrics: {
        priceChange7d: rounded(priceChange7d),
        priceChange30d: rounded(priceChange30d),
      },
    });
  }
  if (
    priceChange7d !== undefined &&
    priceChange7d >= 180 &&
    (drawdownPercent === undefined || drawdownPercent < 15)
  ) {
    addSignal(signals, {
      id: "new_ath_repricing",
      severity: "high",
      points: adjustedPoints(18, profile.volatilityWeight),
      metrics: {
        priceChange7d: rounded(priceChange7d),
        drawdownPercent:
          drawdownPercent !== undefined ? rounded(drawdownPercent) : null,
      },
    });
  }

  if (
    profile.expectedPegUsd !== undefined &&
    currentPrice !== undefined &&
    currentPrice > 0
  ) {
    const pegDeviationPercent =
      (Math.abs(currentPrice - profile.expectedPegUsd) / profile.expectedPegUsd) *
      100;
    if (pegDeviationPercent >= 3) {
      addSignal(signals, {
        id: "rapid_intraday_move",
        severity: pegDeviationPercent >= 10 ? "high" : "medium",
        points: pegDeviationPercent >= 10 ? 26 : 14,
        metrics: {
          pegDeviationPercent: rounded(pegDeviationPercent),
          stablecoinDepegReview: "required",
        },
      });
    }
  }
  if (profile.isPeggedAsset && profile.expectedPegUsd === undefined) {
    const stablecoinMove24h =
      priceChange24h !== undefined ? Math.abs(priceChange24h) : undefined;
    const stablecoinMove7d =
      priceChange7d !== undefined ? Math.abs(priceChange7d) : undefined;
    const stablecoinMove30d =
      priceChange30d !== undefined ? Math.abs(priceChange30d) : undefined;
    const peggedAssetMove = Math.max(
      stablecoinMove24h ?? 0,
      stablecoinMove7d ?? 0,
      stablecoinMove30d ?? 0,
    );

    if (
      (stablecoinMove24h !== undefined && stablecoinMove24h >= 5) ||
      (stablecoinMove7d !== undefined && stablecoinMove7d >= 10) ||
      (stablecoinMove30d !== undefined && stablecoinMove30d >= 15)
    ) {
      addSignal(signals, {
        id: "rapid_intraday_move",
        severity:
          peggedAssetMove >= 20
            ? "high"
            : peggedAssetMove >= 10
              ? "high"
              : "medium",
        points: peggedAssetMove >= 20 ? 26 : peggedAssetMove >= 10 ? 20 : 12,
        metrics: {
          peggedAssetMovePercent: rounded(peggedAssetMove),
          stablecoinPegPathReview: "required",
        },
      });
    }
  }
  return { drawdownPercent };
}
