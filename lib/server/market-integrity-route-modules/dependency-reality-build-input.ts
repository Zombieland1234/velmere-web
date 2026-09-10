import { NextResponse } from "next/server";
import { buildPass2884DependencyRealityBuildInputGate } from "@/lib/market-integrity/dependency-reality-build-input-gate";

export async function GET() {
  const gate = buildPass2884DependencyRealityBuildInputGate({
    externalDependencyTreeInstalled: false,
    packageLockPresent: true,
    internalAliasCompatibilityReady: true,
  });

  return NextResponse.json({
    ok: true,
    endpoint: "dependency-reality-build-input",
    pass: 2884,
    gate,
    productionClaimBoundary: "internal aliases repaired; npm ci/typecheck/build receipts still required before production-world-class claim",
  });
}
