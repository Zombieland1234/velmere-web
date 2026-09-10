import { createHash } from "node:crypto";

export type Pass4656ProviderFailureKind =
  | "none"
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "upstream_error"
  | "invalid_json"
  | "empty_payload"
  | "schema_drift"
  | "identity_mismatch"
  | "stale_source"
  | "future_source_timestamp";

export type Pass4656ProviderObservation = {
  providerId: string;
  providerFamily: string;
  requestedIdentity: string;
  resolvedIdentity?: string | null;
  httpStatus?: number | null;
  elapsedMs: number;
  timedOut?: boolean;
  networkError?: boolean;
  jsonParsed?: boolean;
  payload?: unknown;
  requiredFields?: string[];
  sourceTimestamp?: string | null;
  observedAt: string;
  maxAgeMs: number;
  retryAfterSeconds?: number | null;
  capabilities: string[];
};

export type Pass4656ProviderVerdict = {
  schemaVersion: "pass4656_provider_failure_verdict_v1";
  providerId: string;
  providerFamily: string;
  acceptedAsEvidence: boolean;
  failureKind: Pass4656ProviderFailureKind;
  retryable: boolean;
  retryAfterSeconds: number | null;
  suggestedBackoffMs: number | null;
  identityMatched: boolean;
  sourceFresh: boolean;
  payloadHash: string | null;
  blockers: string[];
  warnings: string[];
};

function normalizedIdentity(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._\-/]+/g, "")
    .replace(/-usd$/, "");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
    .join(",")}}`;
}

function isNonEmptyPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload.length > 0;
  if (payload && typeof payload === "object") return Object.keys(payload as Record<string, unknown>).length > 0;
  return typeof payload === "string" ? payload.trim().length > 0 : payload !== null && payload !== undefined;
}

function hasRequiredFields(payload: unknown, requiredFields: string[]) {
  if (!requiredFields.length) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  return requiredFields.every((field) => {
    const value = record[field];
    return value !== undefined && value !== null && !(typeof value === "string" && !value.trim());
  });
}

function finiteDate(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyFailure(args: {
  observation: Pass4656ProviderObservation;
  identityMatched: boolean;
  sourceFresh: boolean;
  sourceInFuture: boolean;
  payloadPresent: boolean;
  schemaValid: boolean;
}): Pass4656ProviderFailureKind {
  const { observation } = args;
  if (observation.timedOut) return "timeout";
  if (observation.networkError) return "network";
  if (observation.httpStatus === 401) return "unauthorized";
  if (observation.httpStatus === 403) return "forbidden";
  if (observation.httpStatus === 429) return "rate_limited";
  if ((observation.httpStatus ?? 0) >= 500) return "upstream_error";
  if (observation.jsonParsed === false) return "invalid_json";
  if (!args.payloadPresent) return "empty_payload";
  if (!args.schemaValid) return "schema_drift";
  if (!args.identityMatched) return "identity_mismatch";
  if (args.sourceInFuture) return "future_source_timestamp";
  if (!args.sourceFresh) return "stale_source";
  return "none";
}

export function evaluatePass4656ProviderObservation(
  observation: Pass4656ProviderObservation,
  options: { nowMs?: number; maximumLatencyMs?: number; maximumClockSkewMs?: number } = {},
): Pass4656ProviderVerdict {
  const nowMs = options.nowMs ?? Date.now();
  const maximumLatencyMs = options.maximumLatencyMs ?? 15_000;
  const maximumClockSkewMs = options.maximumClockSkewMs ?? 30_000;
  const requested = normalizedIdentity(observation.requestedIdentity);
  const resolved = normalizedIdentity(observation.resolvedIdentity);
  const identityMatched = Boolean(requested && resolved && requested === resolved);
  const sourceMs = finiteDate(observation.sourceTimestamp);
  const sourceInFuture = sourceMs !== null && sourceMs > nowMs + maximumClockSkewMs;
  const sourceFresh = sourceMs !== null && !sourceInFuture && nowMs - sourceMs <= Math.max(1, observation.maxAgeMs);
  const payloadPresent = isNonEmptyPayload(observation.payload);
  const schemaValid = hasRequiredFields(observation.payload, observation.requiredFields ?? []);
  const statusOk = (observation.httpStatus ?? 0) >= 200 && (observation.httpStatus ?? 0) < 300;
  const failureKind = classifyFailure({ observation, identityMatched, sourceFresh, sourceInFuture, payloadPresent, schemaValid });
  const blockers = [
    !statusOk ? `http_status:${observation.httpStatus ?? "missing"}` : null,
    failureKind !== "none" ? `failure:${failureKind}` : null,
    observation.capabilities.length === 0 ? "capabilities_missing" : null,
  ].filter((value): value is string => Boolean(value));
  const retryable = ["timeout", "network", "rate_limited", "upstream_error"].includes(failureKind);
  const retryAfterSeconds = retryable && Number.isFinite(observation.retryAfterSeconds)
    ? Math.max(0, Number(observation.retryAfterSeconds))
    : null;
  const exponentialBase = Math.min(60_000, Math.max(1_000, Math.round(observation.elapsedMs || 1_000) * 2));
  const suggestedBackoffMs = retryable
    ? Math.max(exponentialBase, retryAfterSeconds !== null ? retryAfterSeconds * 1_000 : 0)
    : null;
  const warnings = [
    observation.elapsedMs > maximumLatencyMs ? `latency_high:${observation.elapsedMs}/${maximumLatencyMs}` : null,
    retryAfterSeconds !== null ? `retry_after_honored:${retryAfterSeconds}` : null,
  ].filter((value): value is string => Boolean(value));
  const payloadHash = payloadPresent ? createHash("sha256").update(stableSerialize(observation.payload)).digest("hex") : null;

  return {
    schemaVersion: "pass4656_provider_failure_verdict_v1",
    providerId: observation.providerId,
    providerFamily: observation.providerFamily,
    acceptedAsEvidence: blockers.length === 0,
    failureKind,
    retryable,
    retryAfterSeconds,
    suggestedBackoffMs,
    identityMatched,
    sourceFresh,
    payloadHash,
    blockers,
    warnings,
  };
}

export type Pass4656ProviderFailureMatrixRow = {
  id: string;
  observation: Pass4656ProviderObservation;
  expectedFailure: Pass4656ProviderFailureKind;
  expectedAccepted: boolean;
  expectedRetryable: boolean;
};

export function runPass4656ProviderFailureMatrix(
  rows: Pass4656ProviderFailureMatrixRow[],
  options: { nowMs?: number; maximumLatencyMs?: number; maximumClockSkewMs?: number } = {},
) {
  const results = rows.map((row) => {
    const verdict = evaluatePass4656ProviderObservation(row.observation, options);
    const passed = verdict.failureKind === row.expectedFailure && verdict.acceptedAsEvidence === row.expectedAccepted && verdict.retryable === row.expectedRetryable;
    return { id: row.id, passed, expectedFailure: row.expectedFailure, expectedAccepted: row.expectedAccepted, expectedRetryable: row.expectedRetryable, verdict };
  });
  return {
    schemaVersion: "pass4656_provider_failure_matrix_v1" as const,
    passed: results.filter((row) => row.passed).length,
    failed: results.filter((row) => !row.passed).length,
    complete: results.every((row) => row.passed),
    results,
  };
}
