import type { RiskAgentAssessment, RiskSignalId, TokenRiskResult } from "./risk-types";
import type { VlmReportContextDepth } from "../product/vlm-standalone-insight-contract";

export type RiskIndicatorDriver = {
  id: string;
  direction: "increases_risk" | "reduces_risk" | "uncertain";
  domain: "technical" | "market" | "data_quality";
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  evidence: string[];
};

export type RiskIndicatorProjection = {
  schemaVersion: "velmere.risk-indicator.customer.v1";
  productId: "risk-indicator";
  productClass: "STANDALONE_PRODUCT";
  reportContextDepth: VlmReportContextDepth;
  truthInvariantAcrossReportDepth: true;
  indicator: {
    value: number | null;
    level: TokenRiskResult["level"] | "unknown";
    state: "descriptive" | "withheld";
    isProbability: false;
    probabilityPercent: null;
  };
  technicalRisk: { level: TokenRiskResult["level"] | "unknown"; drivers: RiskIndicatorDriver[] };
  marketRisk: { level: TokenRiskResult["level"] | "unknown"; drivers: RiskIndicatorDriver[] };
  dataQualityRisk: { level: TokenRiskResult["level"] | "unknown"; drivers: RiskIndicatorDriver[] };
  factorsIncreasingRisk: RiskIndicatorDriver[];
  factorsReducingRisk: RiskIndicatorDriver[];
  missingData: string[];
  limitations: string[];
  nextSafeActions: string[];
  refusal: {
    required: boolean;
    reasons: string[];
  };
  prohibitedGuidance: {
    leverage: null;
    positionSizing: null;
    buyOrSell: null;
  };
};

const TECHNICAL_SIGNALS = new Set<RiskSignalId>([
  "contract_privileges", "honeypot_risk", "high_sell_tax", "mint_risk", "blacklist_risk",
]);
const DATA_SIGNALS = new Set<RiskSignalId>([
  "provider_health_degradation", "source_divergence", "stale_market_data", "insufficient_data",
]);

function domainForSignal(id: RiskSignalId): RiskIndicatorDriver["domain"] {
  if (TECHNICAL_SIGNALS.has(id)) return "technical";
  if (DATA_SIGNALS.has(id)) return "data_quality";
  return "market";
}

function driverFromSignal(signal: TokenRiskResult["signals"][number]): RiskIndicatorDriver {
  return {
    id: signal.id,
    direction: "increases_risk",
    domain: domainForSignal(signal.id),
    severity: signal.severity,
    evidence: Object.entries(signal.metrics ?? {}).slice(0, 8).map(([key, value]) => `${key}=${String(value)}`),
  };
}

function driverFromAgent(agent: RiskAgentAssessment): RiskIndicatorDriver | null {
  if (agent.verdict !== "clear") return null;
  return {
    id: `agent:${agent.id}:clear`,
    direction: "reduces_risk",
    domain: agent.id === "contract" ? "technical" : agent.id === "data" ? "data_quality" : "market",
    severity: agent.status,
    evidence: agent.evidenceSignalIds.map((id) => `signal:${id}`),
  };
}

function maxLevel(drivers: RiskIndicatorDriver[]): TokenRiskResult["level"] | "unknown" {
  const order = { unknown: -1, low: 0, medium: 1, high: 2, critical: 3 } as const;
  let current: TokenRiskResult["level"] | "unknown" = "unknown";
  for (const driver of drivers) {
    if (order[driver.severity] > order[current]) current = driver.severity;
  }
  return current;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildRiskIndicatorProjection(
  result: TokenRiskResult | null,
  reportContextDepth: VlmReportContextDepth,
): RiskIndicatorProjection {
  if (!result) {
    return {
      schemaVersion: "velmere.risk-indicator.customer.v1",
      productId: "risk-indicator",
      productClass: "STANDALONE_PRODUCT",
      reportContextDepth,
      truthInvariantAcrossReportDepth: true,
      indicator: { value: null, level: "unknown", state: "withheld", isProbability: false, probabilityPercent: null },
      technicalRisk: { level: "unknown", drivers: [] },
      marketRisk: { level: "unknown", drivers: [] },
      dataQualityRisk: { level: "unknown", drivers: [] },
      factorsIncreasingRisk: [],
      factorsReducingRisk: [],
      missingData: ["verified_market_evidence_required"],
      limitations: ["No descriptive indicator is published without sufficient evidence."],
      nextSafeActions: ["Attach verified, fresh and identity-bound evidence."],
      refusal: { required: true, reasons: ["insufficient_evidence"] },
      prohibitedGuidance: { leverage: null, positionSizing: null, buyOrSell: null },
    };
  }
  const increasing = result.signals.map(driverFromSignal);
  const reducing = (result.agentAssessments ?? []).map(driverFromAgent).filter((row): row is RiskIndicatorDriver => Boolean(row));
  const allDrivers = [...increasing, ...reducing];
  const technicalDrivers = allDrivers.filter((row) => row.domain === "technical");
  const marketDrivers = allDrivers.filter((row) => row.domain === "market");
  const dataDrivers = allDrivers.filter((row) => row.domain === "data_quality");
  const missingData = unique([
    ...(result.signals.some((signal) => signal.id === "insufficient_data") ? ["insufficient_data"] : []),
    ...(result.metaModel?.limitations ?? []),
    ...(result.limitations ?? []),
  ]);
  const withheld = result.providerRiskDelivery?.scorePublished === false
    || result.dataQuality === "demo"
    || result.uncertainty?.precision === "insufficient";
  const detailLimit = reportContextDepth === "basic" ? 5 : reportContextDepth === "pro" ? 12 : 40;
  return {
    schemaVersion: "velmere.risk-indicator.customer.v1",
    productId: "risk-indicator",
    productClass: "STANDALONE_PRODUCT",
    reportContextDepth,
    truthInvariantAcrossReportDepth: true,
    indicator: {
      value: withheld ? null : result.score,
      level: withheld ? "unknown" : result.level,
      state: withheld ? "withheld" : "descriptive",
      isProbability: false,
      probabilityPercent: null,
    },
    technicalRisk: { level: maxLevel(technicalDrivers), drivers: technicalDrivers.slice(0, detailLimit) },
    marketRisk: { level: maxLevel(marketDrivers), drivers: marketDrivers.slice(0, detailLimit) },
    dataQualityRisk: { level: maxLevel(dataDrivers), drivers: dataDrivers.slice(0, detailLimit) },
    factorsIncreasingRisk: increasing.slice(0, detailLimit),
    factorsReducingRisk: reducing.slice(0, detailLimit),
    missingData: missingData.slice(0, detailLimit),
    limitations: unique([
      "The indicator is descriptive and is not a probability of price loss or contract failure.",
      "Technical, market and data-quality risk are separate domains and must not be collapsed into a trade instruction.",
      ...(result.uncertainty ? [result.uncertainty.interpretation] : []),
    ]).slice(0, detailLimit),
    nextSafeActions: unique([
      ...(missingData.length ? ["Resolve missing or stale evidence before relying on the indicator."] : []),
      ...(technicalDrivers.length ? ["Review contract and administrative controls separately from market volatility."] : []),
      ...(marketDrivers.length ? ["Review liquidity, concentration and microstructure evidence before any decision."] : []),
    ]).slice(0, detailLimit),
    refusal: {
      required: withheld,
      reasons: withheld ? unique(["publication_authority_or_data_quality_not_sufficient", ...missingData]).slice(0, detailLimit) : [],
    },
    prohibitedGuidance: { leverage: null, positionSizing: null, buyOrSell: null },
  };
}

export function verifyRiskIndicatorDepthInvariant(
  basic: RiskIndicatorProjection,
  pro: RiskIndicatorProjection,
  advanced: RiskIndicatorProjection,
): boolean {
  return basic.indicator.value === pro.indicator.value
    && basic.indicator.value === advanced.indicator.value
    && basic.indicator.level === pro.indicator.level
    && basic.indicator.level === advanced.indicator.level
    && [basic, pro, advanced].every((row) => row.indicator.isProbability === false && row.indicator.probabilityPercent === null)
    && [basic, pro, advanced].every((row) => Object.values(row.prohibitedGuidance).every((value) => value === null));
}
