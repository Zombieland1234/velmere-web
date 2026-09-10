import type { VlmSource } from "./vlm-contract";
import { inspectVlmText, sanitizeIdentifier, sanitizeVlmText, stableHash } from "./vlm-security";

export type VlmSourceIntegrityStatus = "trusted" | "degraded" | "quarantined";
export type VlmSourceIntegrityProviderFamily = {
  family: string;
  providerLabels: string[];
  sourceIds: string[];
  sourceCount: number;
  averageQuality: number;
  freshSources: number;
  agingSources: number;
  staleSources: number;
  unknownSources: number;
};

export type VlmSourceIntegrityAssessment = {
  schemaVersion: "velmere.vlm.source-integrity.v1";
  status: VlmSourceIntegrityStatus;
  score: number;
  confidencePenalty: number;
  sourceCount: number;
  providerFamilyCount: number;
  duplicateProviderSourceCount: number;
  duplicateSourceIdCount: number;
  lowQualitySourceCount: number;
  staleOrUnknownSourceCount: number;
  futureTimestampSourceCount: number;
  invalidTimestampSourceCount: number;
  nonHttpsUrlCount: number;
  poisonedMetadataCount: number;
  quarantinedSourceIds: string[];
  degradedSourceIds: string[];
  providerFamilies: VlmSourceIntegrityProviderFamily[];
  fingerprint: string;
  reasons: string[];
};

type SourceState = "fresh" | "aging" | "stale" | "unknown" | "future" | "invalid";

type SourceFinding = {
  source: VlmSource;
  family: string;
  state: SourceState;
  degraded: boolean;
  quarantined: boolean;
  reasons: string[];
};

const INTERNAL_SOURCE_IDS = new Set(["internal:risk-engine"]);
const SIX_HOURS_MS = 6 * 60 * 60_000;
const FIFTEEN_MINUTES_MS = 15 * 60_000;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeVlmProviderFamily(provider: string) {
  const normalized = sanitizeVlmText(provider, 120)
    .toLowerCase()
    .replace(/\b(?:api|pro|demo|rest|v\d+|official|public|market|markets|data|feed)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "unknown-provider";
  if (/coin\s*gecko|coingecko/.test(normalized)) return "coingecko";
  if (/dex\s*screener|dexscreener/.test(normalized)) return "dexscreener";
  if (/coin\s*market\s*cap|coinmarketcap/.test(normalized)) return "coinmarketcap";
  if (/ether\s*scan|etherscan/.test(normalized)) return "etherscan";
  if (/binance/.test(normalized)) return "binance";
  if (/mexc/.test(normalized)) return "mexc";
  if (/internal|deterministic|risk\s*engine/.test(normalized)) return "internal";
  return normalized.split(/\s+/).slice(0, 3).join("-");
}

function timestampState(observedAt: string | null | undefined, nowMs: number): SourceState {
  if (!observedAt) return "unknown";
  const time = new Date(observedAt).getTime();
  if (!Number.isFinite(time)) return "invalid";
  const age = nowMs - time;
  if (age < -60_000) return "future";
  if (age <= FIFTEEN_MINUTES_MS) return "fresh";
  if (age <= SIX_HOURS_MS) return "aging";
  return "stale";
}

function sourceMetadataInspection(source: VlmSource) {
  return inspectVlmText(`${source.id}\n${source.provider}\n${source.label}\n${source.url ?? ""}`, 1200);
}

function sourceUrlIsNonHttps(source: VlmSource) {
  if (!source.url) return false;
  try {
    const parsed = new URL(source.url);
    return parsed.protocol !== "https:";
  } catch {
    return true;
  }
}

function roundedAverage(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function assessVlmSourceIntegrity(input: {
  sources: VlmSource[];
  now?: Date;
  requiredProviderFamilies?: number;
}): VlmSourceIntegrityAssessment {
  const nowMs = (input.now ?? new Date()).getTime();
  const requiredProviderFamilies = Math.max(2, input.requiredProviderFamilies ?? 2);
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const findings: SourceFinding[] = input.sources.map((source) => {
    const id = sanitizeIdentifier(source.id, "unknown-source", 180);
    if (seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);
    const family = INTERNAL_SOURCE_IDS.has(source.id) ? "internal" : normalizeVlmProviderFamily(source.provider);
    const state = timestampState(source.observedAt, nowMs);
    const metadataInspection = sourceMetadataInspection(source);
    const reasons: string[] = [];
    if (source.quality < 45) reasons.push("low_quality_score");
    if (state === "stale" || state === "unknown") reasons.push(`timestamp_${state}`);
    if (state === "future" || state === "invalid") reasons.push(`timestamp_${state}`);
    if (sourceUrlIsNonHttps(source)) reasons.push("non_https_or_invalid_url");
    if (!metadataInspection.safe) reasons.push(`metadata_security_policy:${metadataInspection.flags.join(",")}`);
    if (family === "unknown-provider") reasons.push("unknown_provider_family");
    const quarantined = state === "future" || state === "invalid" || !metadataInspection.safe;
    const degraded = quarantined || source.quality < 45 || state === "stale" || state === "unknown" || sourceUrlIsNonHttps(source) || family === "unknown-provider";
    return { source, family, state, degraded, quarantined, reasons };
  });

  const externalFindings = findings.filter((finding) => finding.family !== "internal");
  const providerFamilies = Array.from(
    externalFindings.reduce((map, finding) => {
      const current = map.get(finding.family) ?? [];
      current.push(finding);
      map.set(finding.family, current);
      return map;
    }, new Map<string, SourceFinding[]>()),
  ).map(([family, familyFindings]): VlmSourceIntegrityProviderFamily => ({
    family,
    providerLabels: Array.from(new Set(familyFindings.map((finding) => sanitizeVlmText(finding.source.provider, 80)).filter(Boolean))).slice(0, 6),
    sourceIds: familyFindings.map((finding) => sanitizeIdentifier(finding.source.id, "unknown-source", 180)).slice(0, 12),
    sourceCount: familyFindings.length,
    averageQuality: roundedAverage(familyFindings.map((finding) => clamp(finding.source.quality))),
    freshSources: familyFindings.filter((finding) => finding.state === "fresh").length,
    agingSources: familyFindings.filter((finding) => finding.state === "aging").length,
    staleSources: familyFindings.filter((finding) => finding.state === "stale").length,
    unknownSources: familyFindings.filter((finding) => finding.state === "unknown").length,
  }));

  const providerFamilyCount = providerFamilies.length;
  const duplicateProviderSourceCount = externalFindings.length - providerFamilyCount;
  const lowQualitySourceCount = findings.filter((finding) => finding.source.quality < 45).length;
  const staleOrUnknownSourceCount = findings.filter((finding) => finding.state === "stale" || finding.state === "unknown").length;
  const futureTimestampSourceCount = findings.filter((finding) => finding.state === "future").length;
  const invalidTimestampSourceCount = findings.filter((finding) => finding.state === "invalid").length;
  const nonHttpsUrlCount = findings.filter((finding) => sourceUrlIsNonHttps(finding.source)).length;
  const poisonedMetadataCount = findings.filter((finding) => finding.reasons.some((reason) => reason.startsWith("metadata_security_policy"))).length;
  const duplicateSourceIdCount = duplicateIds.size;
  const quarantinedSourceIds = findings
    .filter((finding) => finding.quarantined)
    .map((finding) => sanitizeIdentifier(finding.source.id, "unknown-source", 180))
    .slice(0, 16);
  const degradedSourceIds = findings
    .filter((finding) => finding.degraded)
    .map((finding) => sanitizeIdentifier(finding.source.id, "unknown-source", 180))
    .slice(0, 16);

  const reasons: string[] = [];
  if (!input.sources.length) reasons.push("no_sources_available");
  if (providerFamilyCount < requiredProviderFamilies) reasons.push("independent_provider_family_gap");
  if (duplicateProviderSourceCount > 0) reasons.push("duplicate_provider_family_records_do_not_create_independence");
  if (duplicateSourceIdCount > 0) reasons.push("duplicate_source_ids_detected");
  if (lowQualitySourceCount > 0) reasons.push("low_quality_sources_present");
  if (staleOrUnknownSourceCount > 0) reasons.push("stale_or_unknown_source_timestamps_present");
  if (futureTimestampSourceCount > 0) reasons.push("future_dated_source_timestamp_detected");
  if (invalidTimestampSourceCount > 0) reasons.push("invalid_source_timestamp_detected");
  if (nonHttpsUrlCount > 0) reasons.push("non_https_or_invalid_source_url_detected");
  if (poisonedMetadataCount > 0) reasons.push("source_metadata_security_policy_triggered");

  let score = 100;
  if (providerFamilyCount < requiredProviderFamilies) score -= 16;
  score -= Math.min(20, duplicateProviderSourceCount * 4);
  score -= duplicateSourceIdCount * 15;
  score -= lowQualitySourceCount * 7;
  score -= staleOrUnknownSourceCount * 5;
  score -= futureTimestampSourceCount * 18;
  score -= invalidTimestampSourceCount * 18;
  score -= nonHttpsUrlCount * 8;
  score -= poisonedMetadataCount * 32;
  if (!input.sources.length) score = 0;
  score = Math.round(clamp(score));

  const status: VlmSourceIntegrityStatus = quarantinedSourceIds.length > 0 || score < 45
    ? "quarantined"
    : score < 76 || providerFamilyCount < requiredProviderFamilies || degradedSourceIds.length > 0
      ? "degraded"
      : "trusted";
  const confidencePenalty = status === "quarantined"
    ? Math.max(24, 100 - score)
    : status === "degraded"
      ? Math.max(8, Math.ceil((100 - score) / 2))
      : Math.max(0, Math.ceil((100 - score) / 4));

  return {
    schemaVersion: "velmere.vlm.source-integrity.v1",
    status,
    score,
    confidencePenalty: Math.round(clamp(confidencePenalty, 0, 60)),
    sourceCount: input.sources.length,
    providerFamilyCount,
    duplicateProviderSourceCount,
    duplicateSourceIdCount,
    lowQualitySourceCount,
    staleOrUnknownSourceCount,
    futureTimestampSourceCount,
    invalidTimestampSourceCount,
    nonHttpsUrlCount,
    poisonedMetadataCount,
    quarantinedSourceIds,
    degradedSourceIds,
    providerFamilies: providerFamilies.slice(0, 12),
    fingerprint: stableHash({
      status,
      providerFamilies: providerFamilies.map((family) => ({ family: family.family, sourceCount: family.sourceCount })),
      degradedSourceIds,
      quarantinedSourceIds,
      reasons,
    }).slice(0, 24),
    reasons: reasons.slice(0, 12),
  };
}
