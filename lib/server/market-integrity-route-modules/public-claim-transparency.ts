import { NextResponse } from "next/server";
import { buildPass2905PublicClaimTransparencyGate } from "@/lib/market-integrity/public-claim-transparency";

export async function GET() {
  const gate = buildPass2905PublicClaimTransparencyGate();
  return NextResponse.json({
    ok: true,
    gate: "public-claim-transparency",
    pass: gate.pass,
    productionDecision: gate.defaultProductionDecision,
    publicClaimStatus: gate.publicClaimStatus,
    publicStatusEndpoint: gate.publicStatusEndpoint,
    publicStatusRefreshMinutes: gate.publicStatusRefreshMinutes,
    claimExpiryMinutes: gate.claimExpiryMinutes,
    canClaimCleanTypecheck: gate.canClaimCleanTypecheck,
    canClaimCleanBuild: gate.canClaimCleanBuild,
    canClaimWorldClassLive: gate.canClaimWorldClassLive,
    canShowGreenProductionBadge: gate.canShowGreenProductionBadge,
    canShowWorldClassLiveBadge: gate.canShowWorldClassLiveBadge,
    canHideMissingReceiptsFromCustomer: gate.canHideMissingReceiptsFromCustomer,
    canUseMarketingCopyAsProof: gate.canUseMarketingCopyAsProof,
    secretRedactionRequired: gate.secretRedactionRequired,
    requirements: gate.requirements,
    findings: gate.findings,
    publicAcceptanceGates: gate.publicAcceptanceGates,
    nextPassRecommendation: gate.nextPassRecommendation,
  });
}
