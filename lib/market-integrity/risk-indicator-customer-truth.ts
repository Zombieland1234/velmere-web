import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import {
  buildVlmCustomerTruthReasons,
  resolveVlmConfidenceClass,
  resolveVlmTruthState,
  uniqueVlmTruthStrings,
  type VlmCustomerLocale,
  type VlmEvidenceOrigin,
  type VlmReportContextDepth,
  type VlmStandaloneCustomerTruthEnvelope,
  type VlmTruthReasonCode,
} from "../product/vlm-standalone-customer-truth";
import {
  buildVlmStandaloneInsightContract,
  type VlmStandaloneInsightContract,
} from "../product/vlm-standalone-insight-contract";
import type {
  RiskLevel,
  RiskSignalId,
  TokenRiskInput,
  TokenRiskResult,
  TokenRiskSignal,
} from "./risk-types";

const TECHNICAL_SIGNAL_IDS = new Set<RiskSignalId>([
  "contract_privileges",
  "honeypot_risk",
  "high_sell_tax",
  "mint_risk",
  "blacklist_risk",
]);

const DATA_SIGNAL_IDS = new Set<RiskSignalId>([
  "provider_health_degradation",
  "source_divergence",
  "stale_market_data",
  "insufficient_data",
]);

export type RiskIndicatorCustomerTruth = VlmStandaloneCustomerTruthEnvelope & {
  productId: "risk-indicator";
  indicatorMode: "DESCRIPTIVE_REVIEW_PRIORITY";
  scoreInterpretation: "BOUNDED_REVIEW_PRIORITY_NOT_EVENT_PROBABILITY";
  probabilityClaimAllowed: false;
  priceDirectionForecastAllowed: false;
  positionSizingAllowed: false;
  riskIndicatorChangesByPaidReportContext: false;
  reportContextFingerprintInvariant: true;
  calibrationStatus: "MISSING_PROSPECTIVE_OUTCOME_WINDOW";
  descriptiveIndicatorAvailable: boolean;
  refusalRequired: boolean;
  technicalRiskLevel: RiskLevel | "insufficient_data";
  marketRiskLevel: RiskLevel | "insufficient_data";
  dataQualityRiskLevel: RiskLevel | "insufficient_data";
  riskIncreasingFactors: string[];
  riskReducingEvidence: string[];
  indicatorFingerprint: string;
  contract: VlmStandaloneInsightContract;
};

const SEVERITY_RANK: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function strongestLevel(signals: TokenRiskSignal[]): RiskLevel | "insufficient_data" {
  if (signals.length === 0) return "insufficient_data";
  return signals.reduce<RiskLevel>((current, signal) =>
    SEVERITY_RANK[signal.severity] > SEVERITY_RANK[current] ? signal.severity : current,
  "low");
}

function localizedSummary(args: {
  locale: VlmCustomerLocale;
  level: RiskLevel;
  score: number;
  refusalRequired: boolean;
}) {
  if (args.locale === "pl") {
    if (args.refusalRequired) return "Risk Indicator wstrzymuje mocny wniosek: dane są zbyt niepełne. Wynik nie jest prawdopodobieństwem ani prognozą ceny.";
    return `Opisowy Risk Indicator: ${args.level} (${args.score}/100 jako priorytet przeglądu). To nie jest szansa spadku, prognoza ceny ani rekomendacja pozycji.`;
  }
  if (args.locale === "de") {
    if (args.refusalRequired) return "Der Risk Indicator hält eine starke Aussage zurück: Die Daten sind zu unvollständig. Das Ergebnis ist weder Wahrscheinlichkeit noch Preisprognose.";
    return `Beschreibender Risk Indicator: ${args.level} (${args.score}/100 als Review-Priorität). Keine Verlustwahrscheinlichkeit, Preisprognose oder Positionsgröße.`;
  }
  if (args.refusalRequired) return "Risk Indicator withholds a strong conclusion because the evidence is incomplete. It is not a probability or price forecast.";
  return `Descriptive Risk Indicator: ${args.level} (${args.score}/100 review priority). It is not a loss probability, price forecast or position-sizing recommendation.`;
}

function riskReducingEvidence(input: TokenRiskInput): string[] {
  return uniqueVlmTruthStrings([
    Number(input.providerHealthScore) >= 85 ? `provider_health_score=${input.providerHealthScore}` : null,
    input.consensusState === "aligned" ? "source_consensus=aligned" : null,
    input.freshnessState === "fresh" ? "freshness_state=fresh" : null,
    (input.dataSources?.length ?? 0) >= 2 ? `independent_display_sources=${input.dataSources?.length}` : null,
    Number(input.liquidityUsd) > 0 && Number(input.marketCap) > 0 && Number(input.liquidityUsd) / Number(input.marketCap) >= 0.05
      ? "observed_liquidity_to_market_cap_at_or_above_5_percent"
      : null,
  ], 8);
}

export function buildRiskIndicatorCustomerTruth(args: {
  input: TokenRiskInput;
  result: Pick<TokenRiskResult, "score" | "level" | "signals" | "metrics" | "dataQuality" | "limitations" | "metaModel" | "dataSources">;
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth | null;
}): RiskIndicatorCustomerTruth {
  const locale = args.locale ?? "en";
  const signals = Array.isArray(args.result?.signals) ? args.result.signals : [];
  const metrics = args.result?.metrics ?? {};
  const dataSources = Array.isArray(args.result?.dataSources) ? args.result.dataSources : [];
  const technicalSignals = signals.filter((signal) => TECHNICAL_SIGNAL_IDS.has(signal.id));
  const dataSignals = signals.filter((signal) => DATA_SIGNAL_IDS.has(signal.id));
  const marketSignals = signals.filter((signal) => !TECHNICAL_SIGNAL_IDS.has(signal.id) && !DATA_SIGNAL_IDS.has(signal.id));
  const refusalRequired = args.result?.metaModel?.verdict === "insufficient_data"
    || dataSignals.some((signal) => signal.id === "insufficient_data")
    || args.result?.dataQuality === "demo";

  const reasonCodes: VlmTruthReasonCode[] = ["CALIBRATION_MISSING", "PROBABILITY_NOT_ALLOWED", "REAL_CUSTOMER_PROOF_MISSING"];
  if (args.result?.dataQuality !== "live") reasonCodes.push("MISSING_DATA");
  if (args.input?.freshnessState === "stale" || args.input?.freshnessState === "missing") reasonCodes.push("STALE_DATA");
  if (args.input?.consensusState === "divergent") reasonCodes.push("SOURCE_CONFLICT");
  if ((args.input?.dataSources?.length ?? 0) <= 1) reasonCodes.push("SINGLE_SOURCE_ONLY");
  if ((technicalSignals.length > 0 || args.input?.suspiciousContractPrivileges) && (!args.input?.chainId || !args.input?.tokenAddress)) reasonCodes.push("CONTRACT_SCOPE_MISSING");

  const reasonCards = buildVlmCustomerTruthReasons(reasonCodes, locale, 8);
  const evidenceOrigins: VlmEvidenceOrigin[] = uniqueVlmTruthStrings([
    args.input?.chainId && args.input?.tokenAddress ? "BLOCKCHAIN_DIRECT" : null,
    (args.input?.dataSources?.length ?? 0) > 0 ? "PROVIDER" : null,
    "VELMERE_DERIVED",
    args.result?.dataQuality === "demo" ? "FIXTURE" : null,
  ], 8) as VlmEvidenceOrigin[];

  const riskIncreasingFactors = uniqueVlmTruthStrings(signals.map((signal) =>
    `${signal.id}:${signal.severity}${Number.isFinite(signal.points) ? `:${signal.points}` : ""}`,
  ), 16);
  const reducingEvidence = riskReducingEvidence(args.input ?? { symbol: "" });
  const missingProof = uniqueVlmTruthStrings([
    ...(args.result?.limitations ?? []),
    "prospective calibration outcome window",
    "independent severity adjudication",
    "real-customer comprehension and decision-outcome evidence",
    (args.input?.dataSources?.length ?? 0) < 2 ? "second independent source family" : null,
  ], 12);

  const fingerprintPayload = {
    schemaVersion: "velmere.risk-indicator-fingerprint.v1",
    token: {
      marketId: args.input?.marketId ?? null,
      symbol: (args.input?.symbol ?? "").trim().toUpperCase(),
      chainId: args.input?.chainId ?? null,
      tokenAddress: args.input?.tokenAddress?.trim().toLowerCase() ?? null,
    },
    score: args.result?.score ?? 0,
    level: args.result?.level ?? "low",
    signals: signals.map((signal) => ({ id: signal.id, severity: signal.severity, points: signal.points })),
    metrics,
    dataQuality: args.result?.dataQuality ?? "partial",
    dataSources: [...dataSources].sort(),
  };

  const indicatorFingerprint = sha256Hex(canonicalJson(fingerprintPayload));
  const evidenceRef = `sha256:${indicatorFingerprint}`;
  const contract = buildVlmStandaloneInsightContract({
    productId: "risk-indicator",
    reportContextDepth: args.reportContextDepth ?? "basic",
    state: refusalRequired ? "withheld" : reasonCodes.includes("SOURCE_CONFLICT") || reasonCodes.includes("STALE_DATA") ? "limited" : "available",
    facts: [
      { id: "descriptive-level", label: "Descriptive risk level", value: args.result.level, sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "review-priority-score", label: "Review priority score, not probability", value: args.result.score, sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "data-quality", label: "Data quality", value: args.result.dataQuality, sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "signal-count", label: "Bound signal count", value: args.result.signals.length, sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
    ],
    calculations: [
      { id: "technical-risk", label: "Technical-risk dimension", value: strongestLevel(technicalSignals), sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "market-risk", label: "Market-risk dimension", value: strongestLevel(marketSignals), sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
      { id: "data-risk", label: "Data-quality-risk dimension", value: strongestLevel(dataSignals), sourceClass: "VELMERE_DERIVED", evidenceRefs: [evidenceRef], observedAt: null },
    ],
    assumptions: [
      { id: "identity-bound", text: "The supplied identity and measurements refer to the intended asset.", evidenceRefs: [] },
      { id: "absence-not-safety", text: "Absence of a signal is not proof of safety.", evidenceRefs: [] },
      { id: "score-not-probability", text: "The score ranks review priority and is not an event probability.", evidenceRefs: [evidenceRef] },
    ],
    simulations: args.result.metrics.simulatedSlippage10k !== undefined
      ? [{ id: "slippage-scenario", text: "A 10k-notional slippage scenario is a bounded simulation, not a fill prediction.", evidenceRefs: [evidenceRef] }]
      : [],
    conflicts: reasonCodes.includes("SOURCE_CONFLICT")
      ? [{ id: "source-conflict", text: "Provider source divergence is unresolved.", evidenceRefs: [evidenceRef] }]
      : [],
    missingProof,
    limitations: [
      "No price-direction forecast.",
      "No probability of loss, exploit or price movement.",
      "No leverage or position-sizing recommendation.",
      "Technical contract risk and market risk are separate dimensions.",
    ],
    nextSafeActions: reasonCards.map((reason) => reason.nextSafeAction),
  });

  return {
    schemaVersion: "velmere.standalone-customer-truth.v1",
    contractId: "pass36-a102r44p35-standalone-customer-truth",
    productId: "risk-indicator",
    reportContextDepth: args.reportContextDepth ?? null,
    reportContextChangesExplanationOnly: true,
    truthState: resolveVlmTruthState({
      unavailable: refusalRequired && args.result.signals.length === 0,
      stale: reasonCodes.includes("STALE_DATA"),
      conflicted: reasonCodes.includes("SOURCE_CONFLICT"),
      blockingReasons: reasonCards.filter((reason) => reason.severity === "BLOCK").length,
      evidenceCount: args.result.dataSources.length,
    }),
    confidenceClass: resolveVlmConfidenceClass({
      calibrated: false,
      verified: args.result.dataQuality !== "demo" && args.result.signals.length > 0,
      evidenceCount: args.result.dataSources.length,
    }),
    evidenceOrigins,
    facts: uniqueVlmTruthStrings([
      `descriptive_level=${args.result.level}`,
      `review_priority_score=${args.result.score}`,
      `data_quality=${args.result.dataQuality}`,
      `signal_count=${args.result.signals.length}`,
      `source_count=${args.result.dataSources.length}`,
    ], 10),
    calculations: [
      "Weighted multi-agent review-priority score",
      "Deterministic evidence-sensitivity envelope",
      "Separate technical, market and data-quality signal groups",
    ],
    assumptions: [
      "The supplied identity and measurements refer to the intended asset.",
      "Observed market data can change after generation.",
      "Absence of a signal is not proof of safety.",
      "The score ranks review priority and is not an event probability.",
    ],
    simulations: args.result.metrics.simulatedSlippage10k !== undefined ? ["10k notional slippage scenario"] : [],
    conflicts: reasonCodes.includes("SOURCE_CONFLICT") ? ["provider source divergence exceeds the accepted state"] : [],
    missingProof,
    limitations: [
      "No price-direction forecast.",
      "No probability of loss, exploit or price movement.",
      "No leverage or position-sizing recommendation.",
      "Technical contract risk and market risk are separate dimensions.",
    ],
    nextSafeCheck: reasonCards.find((reason) => reason.severity === "BLOCK")?.nextSafeAction
      ?? reasonCards.find((reason) => reason.severity === "WATCH")?.nextSafeAction
      ?? "Refresh the evidence and manually review the highest-severity factor.",
    probabilityClaimAllowed: false,
    investmentRecommendationAllowed: false,
    leverageRecommendationAllowed: false,
    guaranteedOutcomeClaimAllowed: false,
    customerSummary: localizedSummary({ locale, level: args.result.level, score: args.result.score, refusalRequired }),
    reasonCards,
    indicatorMode: "DESCRIPTIVE_REVIEW_PRIORITY",
    scoreInterpretation: "BOUNDED_REVIEW_PRIORITY_NOT_EVENT_PROBABILITY",
    priceDirectionForecastAllowed: false,
    positionSizingAllowed: false,
    riskIndicatorChangesByPaidReportContext: false,
    reportContextFingerprintInvariant: true,
    calibrationStatus: "MISSING_PROSPECTIVE_OUTCOME_WINDOW",
    descriptiveIndicatorAvailable: args.result.signals.length > 0 || args.result.dataQuality !== "demo",
    refusalRequired,
    technicalRiskLevel: strongestLevel(technicalSignals),
    marketRiskLevel: strongestLevel(marketSignals),
    dataQualityRiskLevel: strongestLevel(dataSignals),
    riskIncreasingFactors,
    riskReducingEvidence: reducingEvidence,
    indicatorFingerprint,
    contract,
  };
}
