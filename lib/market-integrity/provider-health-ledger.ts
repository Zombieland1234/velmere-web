import { createHash } from "node:crypto";
import type { Pass4656ProviderFailureKind, Pass4656ProviderVerdict } from "./provider-failure-matrix";

export type Pass4656ProviderHealthStatus = "healthy" | "degraded" | "open" | "half_open";
export type Pass4656ProviderRequestMode = "allow" | "allow_degraded" | "block" | "probe_only";

export type Pass4656ProviderHealthObservation = {
  observedAt: string;
  elapsedMs: number;
  /** How the provider call was admitted. Probe failures open the circuit immediately. */
  origin?: "customer" | "probe" | "scheduled" | "runner";
  verdict: Pass4656ProviderVerdict;
};

export type Pass4656ProviderHealthPolicy = {
  windowSize: number;
  minimumSamples: number;
  maximumFailureRate: number;
  maximumRetryableFailureRate: number;
  maximumP95LatencyMs: number;
  consecutiveFailureOpenThreshold: number;
  defaultOpenMs: number;
  authenticationOpenMs: number;
  integrityOpenMs: number;
  halfOpenProbeLimit: number;
  advancedMinimumFamiliesAfterOutage: number;
};

export const PASS4656_PROVIDER_HEALTH_POLICY: Pass4656ProviderHealthPolicy = {
  windowSize: 20,
  minimumSamples: 3,
  maximumFailureRate: 0.25,
  maximumRetryableFailureRate: 0.2,
  maximumP95LatencyMs: 8_000,
  consecutiveFailureOpenThreshold: 3,
  defaultOpenMs: 60_000,
  authenticationOpenMs: 15 * 60_000,
  integrityOpenMs: 30 * 60_000,
  halfOpenProbeLimit: 1,
  advancedMinimumFamiliesAfterOutage: 3,
};

function finiteDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileValue * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

function openDurationMs(kind: Pass4656ProviderFailureKind, policy: Pass4656ProviderHealthPolicy, verdict: Pass4656ProviderVerdict) {
  const retryAfterMs = verdict.retryAfterSeconds !== null ? verdict.retryAfterSeconds * 1_000 : 0;
  const suggestedBackoffMs = verdict.suggestedBackoffMs ?? 0;
  const policyFloor = kind === "unauthorized" || kind === "forbidden"
    ? policy.authenticationOpenMs
    : kind === "identity_mismatch" || kind === "schema_drift" || kind === "future_source_timestamp"
      ? policy.integrityOpenMs
      : policy.defaultOpenMs;
  return Math.max(policyFloor, retryAfterMs, suggestedBackoffMs);
}

function requestMode(status: Pass4656ProviderHealthStatus): Pass4656ProviderRequestMode {
  if (status === "healthy") return "allow";
  if (status === "degraded") return "allow_degraded";
  if (status === "half_open") return "probe_only";
  return "block";
}

export function buildPass4656OutageResilienceMatrix(args: {
  independentHealthyFamilies: string[];
  minimumFamiliesAfterOutage: number;
}) {
  const families = Array.from(new Set(args.independentHealthyFamilies)).sort();
  const scenarios = families.map((removedFamily) => {
    const remainingFamilies = families.filter((family) => family !== removedFamily);
    return {
      removedFamily,
      remainingFamilies,
      remainingFamilyCount: remainingFamilies.length,
      readyAfterOutage: remainingFamilies.length >= args.minimumFamiliesAfterOutage,
    };
  });
  return {
    schemaVersion: "pass4656_provider_outage_resilience_v1" as const,
    minimumFamiliesAfterOutage: args.minimumFamiliesAfterOutage,
    scenarios,
    survivesAnySingleFamilyOutage: scenarios.length > 0 && scenarios.every((row) => row.readyAfterOutage),
  };
}

export function buildPass4656ProviderHealthLedger(
  observations: Pass4656ProviderHealthObservation[],
  options: { policy?: Partial<Pass4656ProviderHealthPolicy>; now?: Date } = {},
) {
  const policy = { ...PASS4656_PROVIDER_HEALTH_POLICY, ...(options.policy ?? {}) };
  const nowMs = (options.now ?? new Date()).getTime();
  const valid = observations
    .filter((row) => finiteDate(row.observedAt) !== null && Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0)
    .sort((a, b) => (finiteDate(a.observedAt) ?? 0) - (finiteDate(b.observedAt) ?? 0));
  const groups = new Map<string, Pass4656ProviderHealthObservation[]>();
  for (const row of valid) {
    const key = `${row.verdict.providerFamily}::${row.verdict.providerId}`;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }

  const providers = Array.from(groups.entries()).map(([key, rows]) => {
    const window = rows.slice(-Math.max(1, policy.windowSize));
    const failures = window.filter((row) => !row.verdict.acceptedAsEvidence);
    const retryableFailures = failures.filter((row) => row.verdict.retryable);
    let consecutiveFailures = 0;
    for (let index = window.length - 1; index >= 0; index -= 1) {
      if (window[index]!.verdict.acceptedAsEvidence) break;
      consecutiveFailures += 1;
    }
    const last = window.at(-1)!;
    const lastObservedMs = finiteDate(last.observedAt) ?? nowMs;
    const nonRetryableTerminal = ["unauthorized", "forbidden", "identity_mismatch", "schema_drift", "future_source_timestamp"].includes(last.verdict.failureKind);
    // A probe is already the bounded recovery attempt. Retrying the same failed
    // probe on every Basic request would create an accidental hot loop, so one
    // failed probe opens the circuit immediately and respects Retry-After.
    const failedProbe = last.origin === "probe" && last.verdict.acceptedAsEvidence === false;
    const shouldOpen = nonRetryableTerminal || failedProbe || consecutiveFailures >= policy.consecutiveFailureOpenThreshold;
    const openForMs = openDurationMs(last.verdict.failureKind, policy, last.verdict);
    const openUntilMs = shouldOpen ? lastObservedMs + openForMs : null;
    const openUntil = openUntilMs !== null ? new Date(openUntilMs).toISOString() : null;
    const stillOpen = openUntilMs !== null && openUntilMs > nowMs;
    const awaitingProbe = shouldOpen && !stillOpen && last.verdict.acceptedAsEvidence === false;
    const failureRate = ratio(failures.length, window.length);
    const retryableFailureRate = ratio(retryableFailures.length, window.length);
    const p95LatencyMs = percentile(window.map((row) => row.elapsedMs), 0.95);
    const insufficientSamples = window.length < policy.minimumSamples;
    const degraded = insufficientSamples || failureRate > policy.maximumFailureRate || retryableFailureRate > policy.maximumRetryableFailureRate || p95LatencyMs > policy.maximumP95LatencyMs;
    const status: Pass4656ProviderHealthStatus = stillOpen ? "open" : awaitingProbe ? "half_open" : degraded ? "degraded" : "healthy";
    const [providerFamily, providerId] = key.split("::");
    return {
      providerId,
      providerFamily,
      status,
      requestMode: requestMode(status),
      maximumConcurrentRequests: status === "half_open" ? policy.halfOpenProbeLimit : status === "open" ? 0 : null,
      sampleCount: window.length,
      acceptedCount: window.length - failures.length,
      failureCount: failures.length,
      failureRate,
      retryableFailureRate,
      consecutiveFailures,
      p95LatencyMs,
      lastFailureKind: last.verdict.failureKind,
      lastAcceptedAsEvidence: last.verdict.acceptedAsEvidence,
      openUntil,
      nextAttemptAt: stillOpen ? openUntil : awaitingProbe ? new Date(nowMs).toISOString() : null,
      evidenceEligibleNow: (status === "healthy" || status === "degraded") && last.verdict.acceptedAsEvidence,
      blockers: [
        insufficientSamples ? `samples:${window.length}/${policy.minimumSamples}` : null,
        failureRate > policy.maximumFailureRate ? `failure_rate:${failureRate.toFixed(3)}/${policy.maximumFailureRate}` : null,
        retryableFailureRate > policy.maximumRetryableFailureRate ? `retryable_failure_rate:${retryableFailureRate.toFixed(3)}/${policy.maximumRetryableFailureRate}` : null,
        p95LatencyMs > policy.maximumP95LatencyMs ? `p95_latency:${p95LatencyMs}/${policy.maximumP95LatencyMs}` : null,
        stillOpen ? `circuit_open_until:${openUntil}` : null,
        failedProbe ? "failed_probe_opened_circuit" : null,
        awaitingProbe ? "half_open_probe_required" : null,
      ].filter((value): value is string => Boolean(value)),
    };
  }).sort((a, b) => `${a.providerFamily}:${a.providerId}`.localeCompare(`${b.providerFamily}:${b.providerId}`));

  const healthyFamilies = Array.from(new Set(providers.filter((row) => row.status === "healthy" && row.evidenceEligibleNow).map((row) => row.providerFamily))).sort();
  const degradedFamilies = Array.from(new Set(providers.filter((row) => row.status === "degraded" && row.evidenceEligibleNow).map((row) => row.providerFamily))).sort();
  const usableFamilies = Array.from(new Set(providers.filter((row) => row.evidenceEligibleNow).map((row) => row.providerFamily))).sort();
  const payloadFamilies = new Map<string, Set<string>>();
  for (const row of valid) {
    if (!row.verdict.acceptedAsEvidence || !row.verdict.payloadHash) continue;
    const families = payloadFamilies.get(row.verdict.payloadHash) ?? new Set<string>();
    families.add(row.verdict.providerFamily);
    payloadFamilies.set(row.verdict.payloadHash, families);
  }
  const mirroredPayloadHashes = Array.from(payloadFamilies.entries())
    .filter(([, families]) => families.size > 1)
    .map(([hash]) => hash)
    .sort();
  const mirroredFamilies = new Set<string>();
  for (const [hash, families] of payloadFamilies) {
    if (!mirroredPayloadHashes.includes(hash)) continue;
    for (const family of families) mirroredFamilies.add(family);
  }
  const independentHealthyFamilies = healthyFamilies.filter((family) => !mirroredFamilies.has(family));
  const independentUsableFamilies = usableFamilies.filter((family) => !mirroredFamilies.has(family));
  const outageResilience = buildPass4656OutageResilienceMatrix({
    independentHealthyFamilies,
    minimumFamiliesAfterOutage: policy.advancedMinimumFamiliesAfterOutage,
  });
  const incidents = providers
    .filter((row) => row.status !== "healthy")
    .map((row) => ({
      severity: row.status === "open" ? "p0" as const : "p1" as const,
      providerId: row.providerId,
      providerFamily: row.providerFamily,
      status: row.status,
      requestMode: row.requestMode,
      openUntil: row.openUntil,
      nextAttemptAt: row.nextAttemptAt,
      blockers: row.blockers,
    }));

  const canonical = providers.map((row) => ({
    providerId: row.providerId,
    providerFamily: row.providerFamily,
    status: row.status,
    requestMode: row.requestMode,
    sampleCount: row.sampleCount,
    failureRate: row.failureRate,
    retryableFailureRate: row.retryableFailureRate,
    p95LatencyMs: row.p95LatencyMs,
    openUntil: row.openUntil,
  }));

  return {
    schemaVersion: "pass4656_provider_health_ledger_v2" as const,
    providerCount: providers.length,
    providers,
    healthyFamilies,
    degradedFamilies,
    usableFamilies,
    independentHealthyFamilies,
    independentUsableFamilies,
    mirroredPayloadHashes,
    incidents,
    outageResilience,
    tierAvailability: {
      basic: { ready: independentUsableFamilies.length >= 1, minimumIndependentFamilies: 1, allowsDegraded: true },
      pro: { ready: independentHealthyFamilies.length >= 2, minimumIndependentFamilies: 2, allowsDegraded: false },
      advanced: {
        ready: independentHealthyFamilies.length >= 4 && outageResilience.survivesAnySingleFamilyOutage,
        minimumIndependentFamilies: 4,
        minimumFamiliesAfterOutage: policy.advancedMinimumFamiliesAfterOutage,
        survivesAnySingleFamilyOutage: outageResilience.survivesAnySingleFamilyOutage,
      },
    },
    fingerprint: createHash("sha256").update(stableSerialize(canonical)).digest("hex"),
    policy,
  };
}
