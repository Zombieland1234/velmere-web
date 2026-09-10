import { NextResponse } from "next/server";
import { buildRealMarketProviderContract } from "@/lib/market-integrity/real-market-provider-contract";
import { buildR44P18ProviderRightsPublicSummary } from "@/lib/market-integrity/provider-rights-public-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const contract = buildRealMarketProviderContract();
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...contract,
      providerRights: buildR44P18ProviderRightsPublicSummary(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
