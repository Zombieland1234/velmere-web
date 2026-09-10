import { NextResponse } from "next/server";
import { buildGlobalRiskMap } from "@/lib/market-integrity/global-risk-map";

export async function GET() {
  const map = buildGlobalRiskMap();
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...map,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
