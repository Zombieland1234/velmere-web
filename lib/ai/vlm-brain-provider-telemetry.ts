import { VLM_BRAIN_CALIBRATION_MANIFEST } from "./vlm-brain-calibration";
import {
  normalizeVlmProviderFamily,
  type VlmBrainKernelFreshnessProfile,
  type VlmBrainKernelTimestampStatus,
} from "./vlm-brain-kernel";

export type VlmProviderTelemetryOutcome = "success" | "failure";
export type VlmProviderTelemetryQuarantineReason =
  | "explicit_provider_quarantine"
  | "clock_skew_streak"
  | "invalid_timestamp_streak"
  | "sla_breach_streak"
  | "provider_failure_streak";

export type VlmProviderTelemetrySample = {
  observedAt: string;
  outcome: VlmProviderTelemetryOutcome;
  latencyMs: number | null;
  slaMs: number;
  clockSkew: boolean;
  invalidTimestamp: boolean;
  slaBreached: boolean;
};

export type VlmProviderTelemetryLatency = {
  latestMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
};

export type VlmProviderTelemetryRecord = {
  schemaVersion: "velmere.vlm.provider-telemetry.record.v1";
  providerFamily: string;
  freshnessProfile: VlmBrainKernelFreshnessProfile;
  firstObservedAt: string;
  lastObservedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalObservations: number;
  successCount: number;
  failureCount: number;
  consecutiveSuccesses: number;
  failureStreak: number;
  clockSkewStreak: number;
  invalidTimestampStreak: number;
  slaBreachStreak: number;
  quarantined: boolean;
  quarantineReason: VlmProviderTelemetryQuarantineReason | null;
  quarantinedAt: string | null;
  latency: VlmProviderTelemetryLatency;
  retainedSampleCount: number;
  samples: VlmProviderTelemetrySample[];
};

export type VlmProviderTelemetryObservation = {
  providerFamily: string;
  source?: string;
  freshnessProfile: VlmBrainKernelFreshnessProfile;
  observedAt?: string;
  outcome: VlmProviderTelemetryOutcome;
  latencyMs?: number | null;
  slaMs?: number | null;
  timestampStatus?: VlmBrainKernelTimestampStatus | null;
  explicitQuarantine?: boolean;
};

export type VlmProviderTelemetryKernelPatch = {
  providerLatencyMs: number | null;
  providerLatencyP50Ms: number | null;
  providerLatencyP95Ms: number | null;
  providerLatencyP99Ms: number | null;
  providerTelemetrySampleCount: number;
  providerTelemetryUpdatedAt: string;
  providerFailureStreak: number;
  providerClockSkewStreak: number;
  providerInvalidTimestampStreak: number;
  providerSlaBreachStreak: number;
  providerQuarantined: boolean;
};

function normalizeIso(value?: string): string {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function percentile(sortedValues: number[], quantile: number): number | null {
  if (!sortedValues.length) return null;
  const clamped = Math.max(0, Math.min(1, quantile));
  const index = (sortedValues.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Math.round(sortedValues[lower]);
  const weight = index - lower;
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

function latencyStats(samples: VlmProviderTelemetrySample[]): VlmProviderTelemetryLatency {
  const values = samples
    .map((sample) => sample.latencyMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const latest = [...samples].reverse().find((sample) => sample.latencyMs !== null)?.latencyMs ?? null;
  return {
    latestMs: latest,
    minMs: values.length ? Math.round(values[0]) : null,
    maxMs: values.length ? Math.round(values[values.length - 1]) : null,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
  };
}

function defaultSla(profile: VlmBrainKernelFreshnessProfile): number {
  return VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.defaultSlaMsByFreshnessProfile[profile];
}

function quarantineReason(record: Pick<
  VlmProviderTelemetryRecord,
  "failureStreak" | "clockSkewStreak" | "invalidTimestampStreak" | "slaBreachStreak"
>, explicitQuarantine: boolean): VlmProviderTelemetryQuarantineReason | null {
  const thresholds = VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.quarantineThresholds;
  if (explicitQuarantine) return "explicit_provider_quarantine";
  if (record.clockSkewStreak >= thresholds.clockSkewStreak) return "clock_skew_streak";
  if (record.invalidTimestampStreak >= thresholds.invalidTimestampStreak) return "invalid_timestamp_streak";
  if (record.slaBreachStreak >= thresholds.slaBreachStreak) return "sla_breach_streak";
  if (record.failureStreak >= thresholds.failureStreak) return "provider_failure_streak";
  return null;
}

export function createEmptyVlmProviderTelemetryRecord(
  providerFamily: string,
  freshnessProfile: VlmBrainKernelFreshnessProfile,
  observedAt?: string,
): VlmProviderTelemetryRecord {
  const timestamp = normalizeIso(observedAt);
  return {
    schemaVersion: "velmere.vlm.provider-telemetry.record.v1",
    providerFamily: normalizeVlmProviderFamily(providerFamily, providerFamily),
    freshnessProfile,
    firstObservedAt: timestamp,
    lastObservedAt: timestamp,
    lastSuccessAt: null,
    lastFailureAt: null,
    totalObservations: 0,
    successCount: 0,
    failureCount: 0,
    consecutiveSuccesses: 0,
    failureStreak: 0,
    clockSkewStreak: 0,
    invalidTimestampStreak: 0,
    slaBreachStreak: 0,
    quarantined: false,
    quarantineReason: null,
    quarantinedAt: null,
    latency: { latestMs: null, minMs: null, maxMs: null, p50Ms: null, p95Ms: null, p99Ms: null },
    retainedSampleCount: 0,
    samples: [],
  };
}

export function applyVlmProviderTelemetryObservation(
  previous: VlmProviderTelemetryRecord | null | undefined,
  observation: VlmProviderTelemetryObservation,
): VlmProviderTelemetryRecord {
  const policy = VLM_BRAIN_CALIBRATION_MANIFEST.providerTelemetryPolicy;
  const observedAt = normalizeIso(observation.observedAt);
  const providerFamily = normalizeVlmProviderFamily(observation.providerFamily, observation.source ?? observation.providerFamily);
  const base = previous && previous.providerFamily === providerFamily
    ? previous
    : createEmptyVlmProviderTelemetryRecord(providerFamily, observation.freshnessProfile, observedAt);
  const latencyMs = normalizeNonNegative(observation.latencyMs);
  const slaMs = normalizeNonNegative(observation.slaMs) ?? defaultSla(observation.freshnessProfile);
  const timestampStatus = observation.timestampStatus ?? null;
  const clockSkew = timestampStatus === "future_skew";
  const invalidTimestamp = timestampStatus === "invalid";
  const slaBreached = latencyMs !== null
    && latencyMs > slaMs * VLM_BRAIN_CALIBRATION_MANIFEST.providerHealthPolicy.breachedRatio;
  const isSuccess = observation.outcome === "success";
  const sample: VlmProviderTelemetrySample = {
    observedAt,
    outcome: observation.outcome,
    latencyMs,
    slaMs,
    clockSkew,
    invalidTimestamp,
    slaBreached,
  };
  const cutoff = Date.parse(observedAt) - policy.retentionMs;
  const samples = [...base.samples, sample]
    .filter((item) => Date.parse(item.observedAt) >= cutoff)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .slice(-policy.maxSamplesPerProvider);
  const provisional: VlmProviderTelemetryRecord = {
    ...base,
    freshnessProfile: observation.freshnessProfile,
    lastObservedAt: observedAt,
    lastSuccessAt: isSuccess ? observedAt : base.lastSuccessAt,
    lastFailureAt: isSuccess ? base.lastFailureAt : observedAt,
    totalObservations: base.totalObservations + 1,
    successCount: base.successCount + (isSuccess ? 1 : 0),
    failureCount: base.failureCount + (isSuccess ? 0 : 1),
    consecutiveSuccesses: isSuccess ? base.consecutiveSuccesses + 1 : 0,
    failureStreak: isSuccess ? 0 : base.failureStreak + 1,
    clockSkewStreak: clockSkew ? base.clockSkewStreak + 1 : 0,
    invalidTimestampStreak: invalidTimestamp ? base.invalidTimestampStreak + 1 : 0,
    slaBreachStreak: slaBreached ? base.slaBreachStreak + 1 : 0,
    latency: latencyStats(samples),
    retainedSampleCount: samples.length,
    samples,
  };
  const newlyTriggered = quarantineReason(provisional, Boolean(observation.explicitQuarantine));
  const stickyReason = base.quarantined ? base.quarantineReason : newlyTriggered;
  return {
    ...provisional,
    quarantined: base.quarantined || Boolean(newlyTriggered),
    quarantineReason: stickyReason,
    quarantinedAt: base.quarantinedAt ?? (newlyTriggered ? observedAt : null),
  };
}

export function vlmProviderTelemetryToKernelPatch(
  record: VlmProviderTelemetryRecord,
): VlmProviderTelemetryKernelPatch {
  return {
    providerLatencyMs: record.latency.latestMs,
    providerLatencyP50Ms: record.latency.p50Ms,
    providerLatencyP95Ms: record.latency.p95Ms,
    providerLatencyP99Ms: record.latency.p99Ms,
    providerTelemetrySampleCount: record.retainedSampleCount,
    providerTelemetryUpdatedAt: record.lastObservedAt,
    providerFailureStreak: record.failureStreak,
    providerClockSkewStreak: record.clockSkewStreak,
    providerInvalidTimestampStreak: record.invalidTimestampStreak,
    providerSlaBreachStreak: record.slaBreachStreak,
    providerQuarantined: record.quarantined,
  };
}
