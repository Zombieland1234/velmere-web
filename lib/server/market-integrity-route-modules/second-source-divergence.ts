import { NextResponse } from "next/server";
import { buildSecondSourceDivergenceMatrix } from "@/lib/market-integrity/second-source-divergence-matrix";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...buildSecondSourceDivergenceMatrix(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
