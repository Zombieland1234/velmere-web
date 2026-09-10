import { NextResponse } from "next/server";
import { buildPass2914PublicTrustEvidenceDecayGate } from "@/lib/market-integrity/public-trust-evidence-decay-renewal-escrow";

export async function GET() {
  const gate = buildPass2914PublicTrustEvidenceDecayGate();
  return NextResponse.json({
    ok: true,
    gate: "public-trust-evidence-decay-renewal-escrow",
    pass: gate.pass,
    productionDecision: gate.defaultProductionDecision,
    publicClaimStatus: gate.publicClaimStatus,
    postRestoreContinuityStatus: gate.postRestoreContinuityStatus,
    publicTrustEvidenceDecayStatus: gate.publicTrustEvidenceDecayStatus,
    renewalEscrowStatus: gate.renewalEscrowStatus,
    postRestoreContinuityEndpoint: gate.postRestoreContinuityEndpoint,
    evidenceDecayRenewalEscrowEndpoint: gate.evidenceDecayRenewalEscrowEndpoint,
    canClaimCleanTypecheck: gate.canClaimCleanTypecheck,
    canClaimCleanBuild: gate.canClaimCleanBuild,
    canClaimWorldClassLive: gate.canClaimWorldClassLive,
    canShowGreenProductionBadge: gate.canShowGreenProductionBadge,
    canSustainPublicTrust: gate.canSustainPublicTrust,
    canAutoRenewPublicTrust: gate.canAutoRenewPublicTrust,
    canUseStableStatusAloneAsFreshProof: gate.canUseStableStatusAloneAsFreshProof,
    canSilentlyExtendTrustWindow: gate.canSilentlyExtendTrustWindow,
    canHideEvidenceDecayFromCustomers: gate.canHideEvidenceDecayFromCustomers,
    canRewriteEvidenceAgeHistory: gate.canRewriteEvidenceAgeHistory,
    freshRenewalReceiptRollupRequired: gate.freshRenewalReceiptRollupRequired,
    receiptAgeMatrixRequired: gate.receiptAgeMatrixRequired,
    renewalEscrowDigestRequired: gate.renewalEscrowDigestRequired,
    customerVisibleDegradedStatusRequired: gate.customerVisibleDegradedStatusRequired,
    operatorRenewalAttestationRequired: gate.operatorRenewalAttestationRequired,
    appendOnlyEvidenceDecayHistoryRequired: gate.appendOnlyEvidenceDecayHistoryRequired,
    evidenceMaxAgeMinutes: gate.evidenceMaxAgeMinutes,
    renewalEscrowWindowHours: gate.renewalEscrowWindowHours,
    requirements: gate.requirements,
    findings: gate.findings,
    evidenceDecayRenewalAcceptanceGates: gate.evidenceDecayRenewalAcceptanceGates,
    nextPassRecommendation: gate.nextPassRecommendation,
  });
}

// PASS2914 literal status marker: NO_GO_PUBLIC_TRUST_EVIDENCE_DECAY_RENEWAL_REQUIRED
