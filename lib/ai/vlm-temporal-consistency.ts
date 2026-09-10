import type { VlmFact, VlmSource } from "./vlm-contract";
import { sanitizeIdentifier, stableHash } from "./vlm-security";

export type VlmTemporalConsistencyStatus = "current" | "aging" | "stale" | "invalid";

export type VlmTemporalFactAssessment = {
  factId: string;
  status: VlmTemporalConsistencyStatus;
  halfLifeMs: number;
  ageMs: number | null;
  evidenceWeight: number;
  sourceIds: string[];
  reasons: string[];
};

export type VlmTemporalConsistencyAssessment = {
  schemaVersion: "velmere.vlm.temporal-consistency.v1";
  status: VlmTemporalConsistencyStatus;
  score: number;
  confidencePenalty: number;
  oldestEvidenceAgeMs: number | null;
  medianEvidenceAgeMs: number | null;
  maxSourceAgeSpreadMs: number | null;
  freshFactCount: number;
  agingFactCount: number;
  staleFactCount: number;
  invalidFactCount: number;
  staleFactIds: string[];
  invalidFactIds: string[];
  factAssessments: VlmTemporalFactAssessment[];
  fingerprint: string;
  reasons: string[];
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const FACT_HALF_LIFE_MS: Record<string, number> = {
  price: 5 * MINUTE_MS,
  "price-change-1h": 10 * MINUTE_MS,
  "price-change-24h": 30 * MINUTE_MS,
  "price-change-7d": 3 * HOUR_MS,
  "price-change-30d": 12 * HOUR_MS,
  "volume-24h": 30 * MINUTE_MS,
  "liquidity-usd": 30 * MINUTE_MS,
  "slippage-10k": 20 * MINUTE_MS,
  "market-cap": 30 * MINUTE_MS,
  fdv: 6 * HOUR_MS,
  "holder-count": 12 * HOUR_MS,
  "top10-holder-percent": 12 * HOUR_MS,
  "sell-tax": 7 * DAY_MS,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function parseIsoMs(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function factHalfLifeMs(factId: string) {
  return FACT_HALF_LIFE_MS[factId] ?? 6 * HOUR_MS;
}

function evidenceWeight(ageMs: number, halfLifeMs: number) {
  if (ageMs < 0 || !Number.isFinite(ageMs)) return 0;
  return Number((100 * Math.pow(0.5, ageMs / Math.max(1, halfLifeMs))).toFixed(2));
}

function statusFromWeight(weight: number): VlmTemporalConsistencyStatus {
  if (weight >= 70) return "current";
  if (weight >= 35) return "aging";
  return "stale";
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function evaluateVlmTemporalConsistency(input: {
  sources: VlmSource[];
  facts: VlmFact[];
  now?: Date;
  quarantinedSourceIds?: string[];
}): VlmTemporalConsistencyAssessment {
  const nowMs = (input.now ?? new Date()).getTime();
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const quarantined = new Set(input.quarantinedSourceIds ?? []);
  const checkableFacts = input.facts.filter((fact) => fact.value !== null && fact.id !== "risk-score");

  const assessments: VlmTemporalFactAssessment[] = checkableFacts.map((fact) => {
    const halfLifeMs = factHalfLifeMs(fact.id);
    const usableSourceIds = fact.sourceIds
      .filter((sourceId: string) => sourceById.has(sourceId) && !quarantined.has(sourceId))
      .map((sourceId: string) => sanitizeIdentifier(sourceId, "unknown-source", 180))
      .slice(0, 8);
    const sourceTimes = usableSourceIds
      .map((sourceId: string) => parseIsoMs(sourceById.get(sourceId)?.observedAt))
      .filter((time: number | null): time is number => time !== null);
    const factTime = parseIsoMs(fact.observedAt);
    const allTimes = [...sourceTimes, ...(factTime === null ? [] : [factTime])];
    const reasons: string[] = [];

    if (!usableSourceIds.length) reasons.push("no_usable_source_timestamp");
    if (!allTimes.length) {
      reasons.push("missing_fact_and_source_timestamp");
      return { factId: fact.id, status: "invalid", halfLifeMs, ageMs: null, evidenceWeight: 0, sourceIds: usableSourceIds, reasons };
    }

    const newestTime = Math.max(...allTimes);
    const ageMs = nowMs - newestTime;
    if (!Number.isFinite(ageMs) || ageMs < -60_000) {
      reasons.push("future_or_invalid_timestamp");
      return { factId: fact.id, status: "invalid", halfLifeMs, ageMs: Number.isFinite(ageMs) ? ageMs : null, evidenceWeight: 0, sourceIds: usableSourceIds, reasons };
    }

    const spreadMs = sourceTimes.length > 1 ? Math.max(...sourceTimes) - Math.min(...sourceTimes) : 0;
    if (spreadMs > halfLifeMs * 2) reasons.push("supporting_sources_have_large_time_spread");
    if (fact.freshness === "stale" || fact.freshness === "unknown") reasons.push(`fact_declared_${fact.freshness}`);
    const weight = evidenceWeight(Math.max(0, ageMs), halfLifeMs);
    let status = statusFromWeight(weight);
    if (fact.freshness === "stale" && status === "current") status = "aging";
    if (fact.freshness === "unknown" && status !== "stale") status = "aging";
    if (spreadMs > halfLifeMs * 4 && status === "current") status = "aging";
    if (status === "aging") reasons.push("evidence_weight_aging");
    if (status === "stale") reasons.push("evidence_weight_below_stale_threshold");

    return {
      factId: fact.id,
      status,
      halfLifeMs,
      ageMs: Math.max(0, Math.round(ageMs)),
      evidenceWeight: weight,
      sourceIds: usableSourceIds,
      reasons: reasons.slice(0, 8),
    };
  });

  const count = (status: VlmTemporalConsistencyStatus) => assessments.filter((assessment) => assessment.status === status).length;
  const freshFactCount = count("current");
  const agingFactCount = count("aging");
  const staleFactCount = count("stale");
  const invalidFactCount = count("invalid");
  const usableAges = assessments.map((assessment) => assessment.ageMs).filter((age): age is number => age !== null && age >= 0);
  const oldestEvidenceAgeMs = usableAges.length ? Math.max(...usableAges) : null;
  const medianEvidenceAgeMs = median(usableAges);
  const sourceAges = input.sources
    .filter((source) => !quarantined.has(source.id))
    .map((source) => parseIsoMs(source.observedAt))
    .filter((time: number | null): time is number => time !== null)
    .map((time) => nowMs - time)
    .filter((age) => Number.isFinite(age) && age >= 0);
  const maxSourceAgeSpreadMs = sourceAges.length > 1 ? Math.max(...sourceAges) - Math.min(...sourceAges) : null;
  const staleFactIds = assessments.filter((assessment) => assessment.status === "stale").map((assessment) => assessment.factId).slice(0, 16);
  const invalidFactIds = assessments.filter((assessment) => assessment.status === "invalid").map((assessment) => assessment.factId).slice(0, 16);

  const averageWeight = assessments.length
    ? assessments.reduce((sum, assessment) => sum + assessment.evidenceWeight, 0) / assessments.length
    : 0;
  let score = averageWeight;
  score -= staleFactCount * 6;
  score -= invalidFactCount * 16;
  score -= Math.min(16, agingFactCount * 3);
  if (maxSourceAgeSpreadMs !== null && maxSourceAgeSpreadMs > 6 * HOUR_MS) score -= 8;
  if (!assessments.length) score = 0;
  score = Math.round(clamp(score));

  const status: VlmTemporalConsistencyStatus = invalidFactCount > 0 || !assessments.length
    ? "invalid"
    : staleFactCount > 0 || score < 55
      ? "stale"
      : agingFactCount > 0 || score < 78
        ? "aging"
        : "current";

  const reasons: string[] = [];
  if (!assessments.length) reasons.push("no_temporally_checkable_facts");
  if (agingFactCount > 0) reasons.push("some_facts_are_temporally_aging");
  if (staleFactCount > 0) reasons.push("some_facts_are_temporally_stale");
  if (invalidFactCount > 0) reasons.push("some_facts_have_invalid_or_future_timestamps");
  if (maxSourceAgeSpreadMs !== null && maxSourceAgeSpreadMs > 6 * HOUR_MS) reasons.push("source_timestamp_spread_is_high");
  if (quarantined.size > 0) reasons.push("quarantined_sources_excluded_from_temporal_weighting");

  const confidencePenalty = status === "invalid"
    ? Math.max(24, 100 - score)
    : status === "stale"
      ? Math.max(16, Math.ceil((100 - score) / 2))
      : status === "aging"
        ? Math.max(6, Math.ceil((100 - score) / 4))
        : Math.max(0, Math.ceil((100 - score) / 8));

  return {
    schemaVersion: "velmere.vlm.temporal-consistency.v1",
    status,
    score,
    confidencePenalty: Math.round(clamp(confidencePenalty, 0, 70)),
    oldestEvidenceAgeMs,
    medianEvidenceAgeMs,
    maxSourceAgeSpreadMs,
    freshFactCount,
    agingFactCount,
    staleFactCount,
    invalidFactCount,
    staleFactIds,
    invalidFactIds,
    factAssessments: assessments.slice(0, 24),
    fingerprint: stableHash({ status, score, staleFactIds, invalidFactIds, reasons }).slice(0, 24),
    reasons: reasons.slice(0, 12),
  };
}
