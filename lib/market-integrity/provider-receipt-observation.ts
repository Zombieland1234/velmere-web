import { isPass4644CommerciallyFreshReceipt, type Pass4644ProviderEvidenceReceipt } from "./provider-evidence-receipt";
import type { Pass4656ProviderHealthObservation } from "./provider-health-ledger";
import type { Pass4656ProviderFailureKind, Pass4656ProviderVerdict } from "./provider-failure-matrix";

function failureKindFromReceipt(receipt: Pass4644ProviderEvidenceReceipt): Pass4656ProviderFailureKind {
  if (receipt.identity.matched === false) return "identity_mismatch";
  if (receipt.timestampProvenance !== "provider" || receipt.fresh === false) return "stale_source";
  if (receipt.httpStatus === 401) return "unauthorized";
  if (receipt.httpStatus === 403) return "forbidden";
  if (receipt.httpStatus === 429) return "rate_limited";
  if (receipt.httpStatus >= 500) return "upstream_error";
  if (receipt.payloadBytes <= 2) return "empty_payload";
  if (receipt.state === "rejected") return "schema_drift";
  return "none";
}

export function providerObservationFromPass4644Receipt(
  receipt: Pass4644ProviderEvidenceReceipt,
  options: { origin?: Pass4656ProviderHealthObservation["origin"] } = {},
): Pass4656ProviderHealthObservation {
  const failureKind = failureKindFromReceipt(receipt);
  const retryable = ["rate_limited", "upstream_error", "timeout", "network"].includes(failureKind);
  const verdict: Pass4656ProviderVerdict = {
    schemaVersion: "pass4656_provider_failure_verdict_v1",
    providerId: receipt.providerId,
    providerFamily: receipt.providerFamily,
    acceptedAsEvidence: isPass4644CommerciallyFreshReceipt(receipt),
    failureKind,
    retryable,
    retryAfterSeconds: null,
    suggestedBackoffMs: retryable ? Math.max(1_000, Math.min(60_000, receipt.latencyMs * 2 || 1_000)) : null,
    identityMatched: receipt.identity.matched,
    sourceFresh: receipt.fresh,
    payloadHash: receipt.payloadHash || null,
    blockers: receipt.rejectionReasons,
    warnings: [],
  };
  return {
    observedAt: receipt.receivedAt,
    elapsedMs: receipt.latencyMs,
    origin: options.origin ?? "customer",
    verdict,
  };
}
