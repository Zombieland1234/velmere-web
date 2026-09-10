import { createHash, timingSafeEqual } from "node:crypto";
import type { TokenRiskResult } from "./risk-types";
import type { MarketImpactResult } from "./market-impact-types";
import type { WhaleWatchResult } from "./whale-watch-types";
import type { Pass2578AuditReportAssemblerReport } from "../security/audit-report-assembler";
import { canonicalJson } from "../security/canonical-json";

export type CanonicalEvidenceTier = "basic" | "pro" | "advanced";
export type CanonicalEvidenceSurface = "shield" | "shield_pro" | "real_markets" | "shield_map" | "lens" | "angel" | "audit";
export type CanonicalEvidenceState = "verified" | "limited" | "locked" | "unavailable";
export type CanonicalRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type CanonicalRiskDomain = {
  id: "market" | "execution" | "concentration" | "contract";
  score: number | null;
  level: CanonicalRiskLevel;
  confidence: number;
  state: CanonicalEvidenceState;
  evidenceStatus: string;
  summary: string;
  evidenceCount: number;
  missingEvidence: string[];
  blockers: string[];
};

export type CanonicalEvidencePacket = {
  schemaVersion: "velmere.canonical-evidence-packet.v1";
  packetId: string;
  generatedAt: string;
  asset: {
    key: string;
    symbol: string | null;
    name: string | null;
    assetClass: string | null;
  };
  request: {
    tier: CanonicalEvidenceTier;
    surface: CanonicalEvidenceSurface;
    locale: "pl" | "en" | "de";
  };
  domains: CanonicalRiskDomain[];
  decision: {
    primaryDomain: CanonicalRiskDomain["id"] | null;
    score: number | null;
    level: CanonicalRiskLevel;
    confidenceCap: number;
    reviewRequired: boolean;
    crossDomainAggregation: "forbidden";
    limitations: string[];
  };
  sourceSummary: {
    providerFamilies: string[];
    providerFamilyCount: number;
    verifiedDomains: number;
    limitedDomains: number;
    unavailableDomains: number;
    missingEvidence: string[];
    blockers: string[];
  };
  tierBoundary: {
    basic: string;
    pro: string;
    advanced: string;
  };
  integrity: {
    algorithm: "sha256";
    digest: string;
  };
};

export type CanonicalEvidencePacketInput = {
  assetKey: string;
  tier: CanonicalEvidenceTier;
  surface: CanonicalEvidenceSurface;
  locale: "pl" | "en" | "de";
  generatedAt?: string;
  marketRisk?: TokenRiskResult | null;
  marketImpact?: MarketImpactResult | null;
  whaleWatch?: WhaleWatchResult | null;
  auditReport?: Pass2578AuditReportAssemblerReport | null;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function level(score: number | null): CanonicalRiskLevel {
  if (score === null) return "unknown";
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())));
}

function marketDomain(result: TokenRiskResult): CanonicalRiskDomain {
  const limitations = unique([...(result.limitations ?? []), ...(result.metaModel?.limitations ?? [])]);
  return {
    id: "market",
    score: result.score,
    level: result.level,
    confidence: rounded(clamp((result.confidence ?? 0) * 100)),
    state: result.dataQuality === "live" && (result.confidence ?? 0) >= 0.55 ? "verified" : "limited",
    evidenceStatus: result.dataQuality,
    summary: result.metaModel?.summary ?? result.aiSummary ?? `${result.token.symbol}: market risk ${result.score}/100`,
    evidenceCount: result.signals.length + result.dataSources.length,
    missingEvidence: limitations,
    blockers: result.metaModel?.requiredReview ? [result.metaModel.escalation] : [],
  };
}

function marketImpactDomain(result: MarketImpactResult): CanonicalRiskDomain {
  const targetExecutions = result.executions.filter((row) => row.requestedNotionalUsd === 10_000 || row.requestedNotionalUsd === 50_000);
  const worstImpact = Math.max(0, ...targetExecutions.map((row) => Math.abs(row.impactBps ?? 0)));
  const worstUnfilled = Math.max(0, ...targetExecutions.map((row) => 1 - row.fillRatio));
  const divergence = Math.abs(result.crossVenueMidDivergenceBps ?? 0);
  const score = result.referenceMidPrice === null
    ? null
    : rounded(clamp(worstImpact / 6 + worstUnfilled * 60 + divergence / 12 + result.blockers.length * 8));
  const confidence = result.evidenceStatus === "verified_live" ? 88 : result.evidenceStatus === "verified_staging" ? 66 : result.evidenceStatus === "fixture_only" ? 35 : 0;
  return {
    id: "execution",
    score,
    level: level(score),
    confidence,
    state: result.evidenceStatus === "verified_live" && result.advancedReady ? "verified" : result.referenceMidPrice === null ? "unavailable" : "limited",
    evidenceStatus: result.evidenceStatus,
    summary: score === null
      ? "Execution risk unavailable because no verified reference mid-price was produced."
      : `Execution/exit pressure ${score}/100 from verified fill ratio, VWAP impact, venue divergence and stress scenarios.`,
    evidenceCount: result.venues.length + result.executions.length + result.scenarios.length,
    missingEvidence: result.missingEvidence,
    blockers: result.blockers,
  };
}

function whaleDomain(result: WhaleWatchResult): CanonicalRiskDomain {
  const severeAlerts = result.alerts.filter((alert) => alert.severity === "critical" || alert.severity === "high");
  const net24h = result.flowWindows.find((row) => row.window === "24h")?.netExchangeFlowUsd ?? 0;
  const score = rounded(clamp(
    result.adjustedConcentration.top10Percent * 0.55 +
    Math.min(25, result.adjustedConcentration.hhi * 100 * 0.25) +
    severeAlerts.length * 7 +
    (net24h > 0 ? Math.min(15, Math.log10(net24h + 1) * 2.2) : 0),
  ));
  const confidence = rounded(clamp((result.holderCoveragePercent + result.verifiedLabelCoveragePercent + result.clusterCoveragePercent) / 3));
  return {
    id: "concentration",
    score,
    level: level(score),
    confidence,
    state: result.evidenceStatus === "verified_live" && result.advancedReady ? "verified" : result.evidenceStatus === "unavailable" ? "unavailable" : "limited",
    evidenceStatus: result.evidenceStatus,
    summary: `Concentration/flow pressure ${score}/100 from adjusted top-holder concentration, labels, clusters, exchange flows and alerts.`,
    evidenceCount: result.holderCount + result.transferCount + result.alerts.length,
    missingEvidence: result.missingEvidence,
    blockers: result.blockers,
  };
}

function auditDomain(result: Pass2578AuditReportAssemblerReport): CanonicalRiskDomain {
  const score = result.finalVerdict.riskScore;
  return {
    id: "contract",
    score,
    level: score === null ? "unknown" : level(score),
    confidence: result.finalVerdict.sourceConfidence,
    state: score === null ? "limited" : result.finalVerdict.readinessScore >= 75 ? "verified" : "limited",
    evidenceStatus: score === null ? "evidence_gap_only" : "observed_contract_evidence",
    summary: score === null
      ? "No contract-risk score is published because the available lanes contain evidence gaps but no verified adverse finding."
      : `${result.finalVerdict.riskLabel} contract-risk evidence ${score}/100.`,
    evidenceCount: result.summary.totalEvidence,
    missingEvidence: result.sections.filter((row) => row.missingCount > 0).map((row) => row.title),
    blockers: result.advancedQueue,
  };
}

function packetDigest(packet: Omit<CanonicalEvidencePacket, "integrity">) {
  return createHash("sha256").update(canonicalJson(packet)).digest("hex");
}

export function buildCanonicalEvidencePacket(input: CanonicalEvidencePacketInput): CanonicalEvidencePacket {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const domains = [
    input.marketRisk ? marketDomain(input.marketRisk) : null,
    input.marketImpact ? marketImpactDomain(input.marketImpact) : null,
    input.whaleWatch ? whaleDomain(input.whaleWatch) : null,
    input.auditReport ? auditDomain(input.auditReport) : null,
  ].filter((row): row is CanonicalRiskDomain => row !== null);
  const preferredId: CanonicalRiskDomain["id"] = input.surface === "audit" ? "contract" : "market";
  const primary = domains.find((row) => row.id === preferredId) ?? domains.find((row) => row.score !== null) ?? null;
  const limitations = unique(domains.flatMap((row) => row.missingEvidence));
  const blockers = unique(domains.flatMap((row) => row.blockers));
  const providerFamilies = unique([
    ...(input.marketRisk?.dataSources ?? []),
    ...(input.marketImpact?.providerFamilies ?? []),
    ...(input.whaleWatch?.providerFamilies ?? []),
    ...(input.auditReport?.sections.flatMap((row) => row.sourceFamilies) ?? []),
  ]);
  const base: Omit<CanonicalEvidencePacket, "integrity"> = {
    schemaVersion: "velmere.canonical-evidence-packet.v1",
    packetId: `vep-${createHash("sha256").update(`${input.assetKey}|${input.surface}|${input.tier}|${generatedAt}`).digest("hex").slice(0, 24)}`,
    generatedAt,
    asset: {
      key: input.assetKey,
      symbol: input.marketRisk?.token.symbol ?? input.auditReport?.target.projectName ?? null,
      name: input.marketRisk?.token.name ?? input.auditReport?.target.projectName ?? input.auditReport?.target.contractAddress ?? null,
      assetClass: input.marketRisk?.token.assetClass ?? (input.auditReport ? "smart_contract" : null),
    },
    request: { tier: input.tier, surface: input.surface, locale: input.locale },
    domains,
    decision: {
      primaryDomain: primary?.id ?? null,
      score: primary?.score ?? null,
      level: primary?.level ?? "unknown",
      confidenceCap: primary?.confidence ?? 0,
      reviewRequired: blockers.length > 0 || limitations.length > 0 || primary?.score === null,
      crossDomainAggregation: "forbidden",
      limitations,
    },
    sourceSummary: {
      providerFamilies,
      providerFamilyCount: providerFamilies.length,
      verifiedDomains: domains.filter((row) => row.state === "verified").length,
      limitedDomains: domains.filter((row) => row.state === "limited").length,
      unavailableDomains: domains.filter((row) => row.state === "unavailable").length,
      missingEvidence: limitations,
      blockers,
    },
    tierBoundary: {
      basic: "Market risk and representative execution evidence only; concentration details and manual audit evidence remain locked.",
      pro: "Full market/execution evidence and redacted concentration intelligence; no private holder identities or operator sign-off.",
      advanced: "Full redacted evidence domains plus exit-stress and manual audit workflow; private identifiers remain server-side.",
    },
  };
  return { ...base, integrity: { algorithm: "sha256", digest: packetDigest(base) } };
}

export function verifyCanonicalEvidencePacketIntegrity(packet: CanonicalEvidencePacket) {
  if (packet.integrity.algorithm !== "sha256" || !/^[a-f0-9]{64}$/.test(packet.integrity.digest)) return false;
  const base = { ...packet } as Omit<CanonicalEvidencePacket, "integrity"> & { integrity?: CanonicalEvidencePacket["integrity"] };
  delete base.integrity;
  const expected = Buffer.from(packetDigest(base));
  const actual = Buffer.from(packet.integrity.digest);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function projectCanonicalEvidencePacketForTier(packet: CanonicalEvidencePacket, tier: CanonicalEvidenceTier) {
  const domains = packet.domains.map((domain) => {
    if (domain.id === "concentration" && tier === "basic") {
      return { id: domain.id, state: "locked" as const, requiredTier: "pro" as const, available: domain.state !== "unavailable" };
    }
    return domain;
  });
  const projection = {
    schemaVersion: "velmere.canonical-evidence-projection.v1" as const,
    packetId: packet.packetId,
    generatedAt: packet.generatedAt,
    asset: packet.asset,
    request: { ...packet.request, tier },
    domains,
    decision: packet.decision,
    sourceSummary: packet.sourceSummary,
    tierBoundary: packet.tierBoundary,
    sourceIntegrity: packet.integrity,
  };
  return {
    ...projection,
    integrity: { algorithm: "sha256" as const, digest: createHash("sha256").update(canonicalJson(projection)).digest("hex") },
  };
}
