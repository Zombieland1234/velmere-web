import {
  evaluatePass4656ProviderObservation,
  type Pass4656ProviderObservation,
} from "./provider-failure-matrix";
import type { Pass4656ProviderHealthObservation } from "./provider-health-ledger";

function httpStatusFromError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/(?:status|http|response)\D{0,8}(\d{3})/i);
  const status = match ? Number(match[1]) : null;
  return Number.isInteger(status) && status! >= 100 && status! <= 599 ? status : null;
}

function retryAfterFromError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/retry[- ]?after\D{0,8}(\d{1,6})/i);
  const seconds = match ? Number(match[1]) : null;
  return Number.isFinite(seconds) ? Math.max(0, Number(seconds)) : null;
}

export function providerFailureObservationFromRuntimeError(args: {
  providerId: string;
  providerFamily: string;
  requestedIdentity: string;
  error: unknown;
  elapsedMs: number;
  capabilities: string[];
  observedAt?: Date;
  maxAgeMs?: number;
  origin?: Pass4656ProviderHealthObservation["origin"];
}): Pass4656ProviderHealthObservation {
  const error = args.error;
  const name = error instanceof Error ? error.name : "unknown";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const timedOut = name === "AbortError" || name === "TimeoutError" || /timed?\s*out|timeout/i.test(message);
  const networkError = !timedOut && (name === "TypeError" || /fetch failed|network|econn|enotfound|socket/i.test(message));
  const httpStatus = httpStatusFromError(error);
  const observedAt = args.observedAt ?? new Date();
  const observation: Pass4656ProviderObservation = {
    providerId: args.providerId,
    providerFamily: args.providerFamily,
    requestedIdentity: args.requestedIdentity,
    // For transport failures no provider identity was returned. Keep the
    // requested identity in both fields so the transport failure, not an
    // artificial identity mismatch, remains the primary incident class.
    resolvedIdentity: args.requestedIdentity,
    httpStatus,
    elapsedMs: Math.max(0, Math.round(args.elapsedMs)),
    timedOut,
    networkError,
    jsonParsed: name === "SyntaxError" ? false : undefined,
    payload: null,
    requiredFields: [],
    sourceTimestamp: null,
    observedAt: observedAt.toISOString(),
    maxAgeMs: Math.max(1, args.maxAgeMs ?? 5 * 60_000),
    retryAfterSeconds: retryAfterFromError(error),
    capabilities: args.capabilities,
  };
  return {
    observedAt: observation.observedAt,
    elapsedMs: observation.elapsedMs,
    origin: args.origin ?? "customer",
    verdict: evaluatePass4656ProviderObservation(observation, { nowMs: observedAt.getTime() }),
  };
}

export function providerMissingEvidenceObservation(args: {
  providerId: string;
  providerFamily: string;
  requestedIdentity: string;
  elapsedMs: number;
  capabilities: string[];
  observedAt?: Date;
  maxAgeMs?: number;
  origin?: Pass4656ProviderHealthObservation["origin"];
}): Pass4656ProviderHealthObservation {
  return providerFailureObservationFromRuntimeError({
    ...args,
    error: new Error("provider returned empty payload"),
  });
}
