import { NextResponse } from "next/server";
import { buildMarketSourceCadenceMatrix } from "@/lib/market-integrity/market-source-cadence-matrix";

export async function GET() {
  const cadenceMatrix = buildMarketSourceCadenceMatrix();
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      boundary:
        "Market Source Cadence Matrix only. Not investment advice, not a bankruptcy prediction, not exchange certification and not solvency proof.",
      cadenceMatrix,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
