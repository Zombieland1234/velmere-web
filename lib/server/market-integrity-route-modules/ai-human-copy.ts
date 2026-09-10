import { NextResponse } from "next/server";
import {
  buildAiHumanCopyEngine,
  humanizeShieldCopy,
} from "@/lib/market-integrity/ai-human-copy-engine";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("raw") ?? "";
  const copyEngine = buildAiHumanCopyEngine();

  return NextResponse.json(
    {
      ...copyEngine,
      ok: true,
      generatedAt: new Date().toISOString(),
      boundary:
        "AI Human Copy Engine is a public-copy translator. Not investment advice. Not a certificate. Not a bankruptcy claim. Not a public accusation. Not a buy/sell signal.",
      translated: raw ? humanizeShieldCopy(raw) : null,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
