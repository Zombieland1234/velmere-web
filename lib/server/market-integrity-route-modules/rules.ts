import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { fetchCoinGeckoMarkets } from "@/lib/market-integrity/coingecko";
import { getMarketMemoryStatus, recordMarketRows } from "@/lib/market-integrity/market-memory";
import { buildShieldRuleHits } from "@/lib/market-integrity/rule-engine";
import { enforceLegacyRiskSweepPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pages = Math.min(Math.max(Number(searchParams.get("pages") ?? "1"), 1), 4);
  const perPage = Math.min(Math.max(Number(searchParams.get("perPage") ?? "120"), 20), 250);
  const watchlist = searchParams.get("watchlist");

  try {
    const chunks = await Promise.all(
      Array.from({ length: pages }, (_, index) =>
        fetchCoinGeckoMarkets({ page: index + 1, perPage, vsCurrency: "usd" }),
      ),
    );
    const generatedAt = new Date().toISOString();
    const fetchedRows = chunks.flat();
    const publication = enforceLegacyRiskSweepPublicationTruth(fetchedRows.map((row) => row.result), generatedAt);
    const rows = publication.evidenceState === "verified" ? recordMarketRows(fetchedRows) : fetchedRows;
    const rules = publication.evidenceState === "verified" ? buildShieldRuleHits(rows, watchlist) : [];

    return NextResponse.json({
      mode: publication.mode,
      publication,
      agent: "velmere-shield-rules-engine-v1",
      source: "CoinGecko markets + Velmère risk memory + deterministic alert rules",
      rowsScanned: rows.length,
      rules,
      memory: publication.evidenceState === "verified" ? getMarketMemoryStatus() : null,
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/rules", code: "shield_rules_engine_failed", status: 502 });
  }
}
