import { NextResponse } from "next/server";
import { buildExchangeHealthAdapterPreview } from "@/lib/market-integrity/exchange-health-adapter";

export async function GET() {
  const exchangeHealth = buildExchangeHealthAdapterPreview();
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...exchangeHealth,
      boundary:
        "Exchange Health adapter skeleton only. Not bankruptcy prediction, not proof of solvency, not investment advice and not a public accusation engine.",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
