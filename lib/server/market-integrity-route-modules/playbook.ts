import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildAttackSurface } from "@/lib/market-integrity/attack-playbook";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import { recordSingleResult } from "@/lib/market-integrity/market-memory";
import { persistRiskSnapshots } from "@/lib/market-integrity/risk-ledger";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    const memory = recordSingleResult(result);
    const ledger = memory?.lastSnapshot ? await persistRiskSnapshots([memory.lastSnapshot]) : undefined;
    const attackSurface = buildAttackSurface(result);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      reportType: "velmere-shield-attack-surface-playbook",
      result,
      memory,
      ledger,
      attackSurface,
      legalNote: "Automated risk-testing playbook. Not legal proof, not an accusation, not financial advice.",
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/playbook", code: "playbook_generation_failed", status: 502 });
  }
}
