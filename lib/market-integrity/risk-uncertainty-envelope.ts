import type {
  RiskUncertaintyEnvelope,
  TokenRiskInput,
  TokenRiskResult,
  TokenRiskSignal,
} from "./risk-types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function uniqueSourceCount(input: TokenRiskInput) {
  return new Set((input.dataSources ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)).size;
}

function hasMeaningfulMarketEvidence(input: TokenRiskInput) {
  return [input.currentPrice, input.marketCap, input.liquidityUsd, input.volume24h, input.priceChange24h, input.priceChange7d]
    .filter((value) => Number.isFinite(value)).length >= 3;
}

function confidencePercent(confidence: number) {
  return clamp(confidence <= 1 ? confidence * 100 : confidence);
}

function evidenceState(
  input: TokenRiskInput,
  dataQuality: TokenRiskResult["dataQuality"],
  confidence: number,
): RiskUncertaintyEnvelope["evidenceState"] {
  if (confidencePercent(confidence) < 25 || !hasMeaningfulMarketEvidence(input)) return "insufficient";
  if (dataQuality === "demo") return "demo";
  if (dataQuality === "partial") return "partial";
  return uniqueSourceCount(input) >= 2 ? "live_multi_source" : "live_single_source";
}

export function buildRiskUncertaintyEnvelope(input: {
  riskInput: TokenRiskInput;
  score: number;
  confidence: number;
  dataQuality: TokenRiskResult["dataQuality"];
  signals: TokenRiskSignal[];
  limitations: string[];
}): RiskUncertaintyEnvelope {
  const { riskInput, score, confidence, dataQuality, signals, limitations } = input;
  const sources = uniqueSourceCount(riskInput);
  const state = evidenceState(riskInput, dataQuality, confidence);
  const unknownIdentity = /unknown|unverified|unlisted|test token|n\/a/i.test(`${riskInput.symbol} ${riskInput.name}`);
  const outOfDistribution = riskInput.assetClass === "unknown"
    || unknownIdentity
    || limitations.some((value) => /classification|unknown asset|out[- ]of[- ]distribution/i.test(value));

  const normalizedConfidence = confidencePercent(confidence);
  let halfWidth = 4 + (100 - normalizedConfidence) * 0.24;
  const drivers: string[] = [];
  if (dataQuality === "partial") { halfWidth += 4; drivers.push("partial_data_quality"); }
  else if (dataQuality === "demo") { halfWidth += 12; drivers.push("demo_data_not_live_evidence"); }
  if (sources === 0) { halfWidth += 9; drivers.push("no_attached_provider_source"); }
  else if (sources === 1) { halfWidth += 4; drivers.push("single_source_dependency"); }
  if (riskInput.consensusState === "divergent") { halfWidth += 7; drivers.push("provider_divergence"); }
  else if (riskInput.consensusState === "single_source") { halfWidth += 4; drivers.push("consensus_unavailable_single_source"); }
  else if (riskInput.consensusState === "stale" || riskInput.freshnessState === "stale") { halfWidth += 6; drivers.push("stale_market_evidence"); }
  if (signals.some((signal) => signal.id === "insufficient_data")) { halfWidth += 8; drivers.push("explicit_insufficient_data_signal"); }
  if (outOfDistribution) { halfWidth += 8; drivers.push("out_of_distribution_asset_profile"); }
  if ((riskInput.sourceDivergenceBps ?? 0) > 100) {
    halfWidth += Math.min(6, (riskInput.sourceDivergenceBps ?? 0) / 100);
    drivers.push("material_source_price_divergence");
  }
  if ((riskInput.providerHealthScore ?? 100) < 60) { halfWidth += 4; drivers.push("provider_health_degradation"); }

  halfWidth = clamp(halfWidth, 3, state === "insufficient" ? 45 : 38);
  const lowerBound = clamp(score - halfWidth);
  const upperBound = clamp(score + halfWidth);
  const span = upperBound - lowerBound;
  const precision: RiskUncertaintyEnvelope["precision"] = state === "insufficient"
    ? "insufficient"
    : span <= 14 && normalizedConfidence >= 80 ? "high"
      : span <= 30 && normalizedConfidence >= 55 ? "moderate" : "low";
  if (drivers.length === 0) drivers.push("broad_multi_source_evidence_coverage");
  return {
    schemaVersion: "velmere.risk-uncertainty.v1",
    method: "deterministic_evidence_sensitivity",
    interpretation: "sensitivity_band_not_empirical_confidence_interval",
    empiricalCalibrationStatus: "not_available",
    probabilityClaimAllowed: false,
    pointEstimate: rounded(score),
    lowerBound: rounded(lowerBound),
    upperBound: rounded(upperBound),
    halfWidth: rounded(Math.max(score - lowerBound, upperBound - score)),
    precision,
    evidenceState: state,
    outOfDistribution,
    drivers: Array.from(new Set(drivers)).slice(0, 10),
  };
}
