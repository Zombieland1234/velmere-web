import { NextResponse } from "next/server";
import { buildPass2904ClaimExpiryRenewalGate } from "@/lib/market-integrity/claim-expiry-renewal";

export async function GET() {
  const gate = buildPass2904ClaimExpiryRenewalGate();
  return NextResponse.json({
    ok: true,
    gate: "claim-expiry-renewal",
    pass: gate.pass,
    productionDecision: gate.defaultProductionDecision,
    renewalDecision: gate.defaultRenewalDecision,
    claimExpiryMinutes: gate.claimExpiryMinutes,
    canClaimCleanTypecheck: gate.canClaimCleanTypecheck,
    canClaimCleanBuild: gate.canClaimCleanBuild,
    canClaimWorldClassLive: gate.canClaimWorldClassLive,
    canRenewProductionClaimNow: gate.canRenewProductionClaimNow,
    manualOverrideAllowed: gate.manualOverrideAllowed,
    staleArtifactQuarantineActive: gate.staleArtifactQuarantineActive,
    requirements: gate.requirements,
    findings: gate.findings,
    acceptanceGates: gate.acceptanceGates,
    nextPassRecommendation: gate.nextPassRecommendation,
  });
}
