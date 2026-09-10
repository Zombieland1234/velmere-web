import type { MarketRiskSnapshot } from "./market-memory";

export type Pass423MemoryTier = "hot" | "warm" | "cold" | "archive";
export type Pass423LearningMode = "locked" | "shadow" | "limited" | "adaptive" | "archive_only";

export type Pass423RetentionPolicy = {
  version: "long-term-memory-spine";
  retentionDays: number;
  retentionYears: number;
  hotWindowDays: number;
  warmWindowDays: number;
  coldWindowDays: number;
  maxSnapshotsPerAsset: number;
  analysisWindowSnapshots: number;
  learningHalfLifeDays: number;
  archiveHalfLifeDays: number;
  requiresDurableStoreForYears: boolean;
  personalDataRule: "no_personal_memory_without_consent";
};

export type Pass423TieredMemorySummary = {
  version: "long-term-memory-spine";
  policy: Pass423RetentionPolicy;
  storedSampleCount: number;
  retainedSampleCount: number;
  hotSamples: number;
  warmSamples: number;
  coldSamples: number;
  archiveSamples: number;
  oldestSampleAt?: string;
  newestSampleAt?: string;
  retentionBoundaryAt: string;
  retentionYears: number;
  longTermDelta: number;
  longTermDirection: "rising" | "falling" | "flat" | "insufficient_history";
  seasonalityHint: "none" | "weekly" | "monthly" | "multi_year";
  learningMode: Pass423LearningMode;
  learningWeight: number;
  archiveWeight: number;
  antiOverfitReason: string;
  storageReality: "durable_years_ready" | "runtime_mirror_only";
  persistencePlan: string[];
};

type HistoryLike = Pick<MarketRiskSnapshot, "score" | "timestamp"> | { score?: number; timestamp?: string };

const DEFAULT_RETENTION_DAYS = 1825; // 5 years
const MAX_RETENTION_DAYS = 3650; // 10 years hard product cap before legal review
const DEFAULT_MAX_SNAPSHOTS_PER_ASSET = 5000;
const DEFAULT_ANALYSIS_WINDOW_SNAPSHOTS = 720;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPass423RetentionPolicy(): Pass423RetentionPolicy {
  const retentionDays = clamp(
    Math.round(readNumberEnv("VELMERE_RISK_MEMORY_RETENTION_DAYS", DEFAULT_RETENTION_DAYS)),
    30,
    MAX_RETENTION_DAYS,
  );
  const maxSnapshotsPerAsset = clamp(
    Math.round(readNumberEnv("VELMERE_RISK_MEMORY_MAX_SNAPSHOTS_PER_ASSET", DEFAULT_MAX_SNAPSHOTS_PER_ASSET)),
    288,
    50000,
  );
  const analysisWindowSnapshots = clamp(
    Math.round(readNumberEnv("VELMERE_RISK_MEMORY_ANALYSIS_WINDOW", DEFAULT_ANALYSIS_WINDOW_SNAPSHOTS)),
    144,
    Math.min(maxSnapshotsPerAsset, 5000),
  );
  return {
    version: "long-term-memory-spine",
    retentionDays,
    retentionYears: round(retentionDays / 365, 2),
    hotWindowDays: 30,
    warmWindowDays: 180,
    coldWindowDays: 730,
    maxSnapshotsPerAsset,
    analysisWindowSnapshots,
    learningHalfLifeDays: 90,
    archiveHalfLifeDays: 365,
    requiresDurableStoreForYears: true,
    personalDataRule: "no_personal_memory_without_consent",
  };
}

function dateMs(timestamp?: string) {
  const parsed = Date.parse(timestamp ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function ageDays(nowMs: number, timestamp?: string) {
  const ms = dateMs(timestamp);
  if (!ms) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - ms) / 864e5);
}

export function pass423PruneRiskHistory<T extends HistoryLike>(history: T[], policy = getPass423RetentionPolicy(), now = new Date()): T[] {
  const nowMs = now.getTime();
  return history
    .filter((item) => typeof item.score === "number" && Number.isFinite(item.score) && ageDays(nowMs, item.timestamp) <= policy.retentionDays)
    .sort((a, b) => dateMs(a.timestamp) - dateMs(b.timestamp))
    .slice(-policy.maxSnapshotsPerAsset);
}

export function pass423SelectAnalysisWindow<T extends HistoryLike>(history: T[], policy = getPass423RetentionPolicy(), now = new Date()): T[] {
  return pass423PruneRiskHistory(history, policy, now).slice(-policy.analysisWindowSnapshots);
}

function tierForAge(days: number, policy: Pass423RetentionPolicy): Pass423MemoryTier {
  if (days <= policy.hotWindowDays) return "hot";
  if (days <= policy.warmWindowDays) return "warm";
  if (days <= policy.coldWindowDays) return "cold";
  return "archive";
}

function decayedWeight(days: number, halfLifeDays: number) {
  return Math.pow(0.5, days / Math.max(1, halfLifeDays));
}

function directionFromDelta(delta: number, count: number): Pass423TieredMemorySummary["longTermDirection"] {
  if (count < 6) return "insufficient_history";
  if (delta >= 8) return "rising";
  if (delta <= -8) return "falling";
  return "flat";
}

function seasonalityHint(count: number, daysCovered: number): Pass423TieredMemorySummary["seasonalityHint"] {
  if (count < 8) return "none";
  if (daysCovered >= 730) return "multi_year";
  if (daysCovered >= 120) return "monthly";
  if (daysCovered >= 14) return "weekly";
  return "none";
}

export function buildPass423TieredMemorySummary(
  history: HistoryLike[],
  currentScore: number,
  storageMode: "durable_readback_verified" | "memory" | "configured_unverified" | "degraded" | "unknown" = "unknown",
  now = new Date(),
): Pass423TieredMemorySummary {
  const policy = getPass423RetentionPolicy();
  const retained = pass423PruneRiskHistory(history, policy, now);
  const nowMs = now.getTime();
  const tiers = retained.reduce<Record<Pass423MemoryTier, number>>((acc, item) => {
    acc[tierForAge(ageDays(nowMs, item.timestamp), policy)] += 1;
    return acc;
  }, { hot: 0, warm: 0, cold: 0, archive: 0 });
  const first = retained[0];
  const last = retained.at(-1);
  const oldestMs = dateMs(first?.timestamp);
  const newestMs = dateMs(last?.timestamp);
  const daysCovered = oldestMs && newestMs ? Math.max(0, (newestMs - oldestMs) / 864e5) : 0;
  const longTermDelta = retained.length >= 2 ? round((last?.score ?? currentScore) - (first?.score ?? currentScore), 2) : 0;
  const learningWeight = retained.reduce((sum, item) => sum + decayedWeight(ageDays(nowMs, item.timestamp), policy.learningHalfLifeDays), 0);
  const archiveWeight = retained.reduce((sum, item) => sum + decayedWeight(ageDays(nowMs, item.timestamp), policy.archiveHalfLifeDays), 0);
  const volatility = retained.slice(-96).reduce((sum, item, index, rows) => {
    if (index === 0) return sum;
    return sum + Math.abs((item.score ?? 0) - (rows[index - 1]?.score ?? 0));
  }, 0) / Math.max(1, Math.min(retained.length - 1, 95));
  const storageReality: Pass423TieredMemorySummary["storageReality"] = storageMode === "durable_readback_verified" ? "durable_years_ready" : "runtime_mirror_only";
  const learningMode: Pass423LearningMode = retained.length < 8
    ? "locked"
    : storageReality !== "durable_years_ready" && retained.length < 40
      ? "shadow"
      : volatility >= 14
        ? "limited"
        : tiers.archive > 0 && retained.length >= 120
          ? "adaptive"
          : "limited";
  const antiOverfitReason = learningMode === "locked"
    ? "History is too thin; long-term memory can store observations but cannot steer scoring yet."
    : learningMode === "shadow"
      ? "Durable multi-year storage is not configured; runtime memory can guide UI but not become a long-lived rule."
      : learningMode === "limited"
        ? "Memory is retained for years, but learning is capped because recent volatility or sample depth can still overfit."
        : "Multi-window history is deep enough for small adaptive context; old archive data remains low-weight evidence only.";
  const retentionBoundaryAt = new Date(nowMs - policy.retentionDays * 864e5).toISOString();

  return {
    version: "long-term-memory-spine",
    policy,
    storedSampleCount: history.length,
    retainedSampleCount: retained.length,
    hotSamples: tiers.hot,
    warmSamples: tiers.warm,
    coldSamples: tiers.cold,
    archiveSamples: tiers.archive,
    oldestSampleAt: first?.timestamp,
    newestSampleAt: last?.timestamp,
    retentionBoundaryAt,
    retentionYears: policy.retentionYears,
    longTermDelta,
    longTermDirection: directionFromDelta(longTermDelta, retained.length),
    seasonalityHint: seasonalityHint(retained.length, daysCovered),
    learningMode,
    learningWeight: round(clamp(learningWeight / 60, 0, learningMode === "adaptive" ? 0.42 : 0.22), 3),
    archiveWeight: round(clamp(archiveWeight / 240, 0, 0.2), 3),
    antiOverfitReason,
    storageReality,
    persistencePlan: [
      "Store first observations, material risk changes and bounded continuity heartbeats for the configured retention window.",
      "Use hot/warm/cold/archive tiers; archive data explains history but does not dominate current scoring.",
      "Keep personal user memory out of the long-term brain unless the user explicitly opts in.",
      "Apply decay and sample-depth guards before any adaptive weight is allowed.",
    ],
  };
}
