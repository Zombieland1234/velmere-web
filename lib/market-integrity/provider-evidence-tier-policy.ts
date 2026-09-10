import type { ProviderQuorumReconciliation } from "@/lib/market-integrity/provider-quorum-reconciliation";

export type ProviderEvidenceTier = "Basic" | "Pro" | "Advanced";
export type ProviderClaimStrength = "unavailable" | "contextual" | "review" | "confirmed";

const RANK: Record<ProviderEvidenceTier, number> = { Basic: 0, Pro: 1, Advanced: 2 };

export type ProviderEvidenceTierDecision = {
  schemaVersion: "velmere.provider-evidence-tier-policy.v1";
  requestedTier: ProviderEvidenceTier;
  maxEvidenceTier: ProviderEvidenceTier;
  claimStrength: ProviderClaimStrength;
  downgradeRequired: boolean;
  freshPaidEvidenceAllowed: boolean;
  customerDeliveryAllowed: boolean;
  reasons: string[];
};

export function evaluateProviderEvidenceTier(input: {
  requestedTier: ProviderEvidenceTier;
  quorum: ProviderQuorumReconciliation;
}): ProviderEvidenceTierDecision {
  const { quorum } = input;
  let maxEvidenceTier: ProviderEvidenceTier = "Basic";
  let claimStrength: ProviderClaimStrength = "contextual";
  const reasons: string[] = [];

  if (quorum.state === "unavailable") {
    claimStrength = "unavailable";
    reasons.push("No usable provider observation is available; only missing-evidence output is allowed.");
  } else if (quorum.strongClaimEligible) {
    maxEvidenceTier = "Advanced";
    claimStrength = "confirmed";
    reasons.push("Two fresh providers align in the exact timestamp window.");
  } else if (
    quorum.independentSourceCount >= 2
    && quorum.identityAligned
    && (quorum.state === "aligned" || quorum.state === "watch")
    && quorum.comparability !== "not_comparable"
  ) {
    maxEvidenceTier = "Pro";
    claimStrength = "review";
    reasons.push("Two independent, identity-aligned provider roots exist, but timing, freshness or divergence blocks a confirmed Advanced claim.");
  } else {
    reasons.push("Single-source, stale, divergent or non-comparable evidence is contextual only.");
  }

  const downgradeRequired = RANK[input.requestedTier] > RANK[maxEvidenceTier];
  if (downgradeRequired) reasons.push(`${input.requestedTier} delivery must disclose that evidence strength is capped at ${maxEvidenceTier}.`);
  return {
    schemaVersion: "velmere.provider-evidence-tier-policy.v1",
    requestedTier: input.requestedTier,
    maxEvidenceTier,
    claimStrength,
    downgradeRequired,
    freshPaidEvidenceAllowed: quorum.freshPaidEvidenceEligible,
    customerDeliveryAllowed: true,
    reasons: reasons.slice(0, 6),
  };
}

export function applyHistoricalEvidencePolicy(input: {
  current: ProviderEvidenceTierDecision;
  history: {
    maxHistoricalEvidenceTier: ProviderEvidenceTier;
    historicalEvidenceEligible: boolean;
    state: string;
    receiptDigest: string;
  };
}): ProviderEvidenceTierDecision & { historyReceiptDigest: string; historicalState: string } {
  const maxEvidenceTier = RANK[input.current.maxEvidenceTier] <= RANK[input.history.maxHistoricalEvidenceTier]
    ? input.current.maxEvidenceTier
    : input.history.maxHistoricalEvidenceTier;
  const downgradeRequired = RANK[input.current.requestedTier] > RANK[maxEvidenceTier];
  const reasons = [...input.current.reasons];
  if (!input.history.historicalEvidenceEligible) {
    reasons.push(`Historical provider evidence is ${input.history.state}; Advanced confirmation requires durable stable history.`);
  }
  return {
    ...input.current,
    maxEvidenceTier,
    claimStrength: maxEvidenceTier === "Advanced" ? input.current.claimStrength : maxEvidenceTier === "Pro" ? "review" : input.current.claimStrength === "unavailable" ? "unavailable" : "contextual",
    downgradeRequired,
    freshPaidEvidenceAllowed: input.current.freshPaidEvidenceAllowed && input.history.historicalEvidenceEligible,
    reasons: reasons.slice(0, 8),
    historyReceiptDigest: input.history.receiptDigest,
    historicalState: input.history.state,
  };
}
