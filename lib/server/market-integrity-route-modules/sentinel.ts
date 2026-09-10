import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { fetchCoinGeckoMarkets } from "@/lib/market-integrity/coingecko";
import { recordMarketRows, getMarketMemoryStatus } from "@/lib/market-integrity/market-memory";
import { buildSentinelAlerts } from "@/lib/market-integrity/risk-alerts";
import { getAlertLedgerStatus, getPersistentAlertInbox, persistSentinelAlerts } from "@/lib/market-integrity/alert-ledger";
import { buildShieldRuleHits } from "@/lib/market-integrity/rule-engine";
import { enforceLegacyRiskSweepPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pages = Math.min(Math.max(Number(searchParams.get("pages") ?? "1"), 1), 4);
  const perPage = Math.min(Math.max(Number(searchParams.get("perPage") ?? "100"), 20), 250);
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
    const alerts = publication.evidenceState === "verified" ? buildSentinelAlerts(rows) : [];
    const rules = publication.evidenceState === "verified" ? buildShieldRuleHits(rows, watchlist) : [];
    const alertLedger = await persistSentinelAlerts(alerts);
    const inbox = await getPersistentAlertInbox(20);
    const alertStatus = await getAlertLedgerStatus();
    const critical = alerts.filter((alert) => alert.type === "critical_cluster").length;
    const rising = alerts.filter((alert) => alert.type === "rising_risk").length;
    const pump = alerts.filter((alert) => alert.type === "parabolic_pump").length;

    return NextResponse.json({
      mode: publication.mode,
      publication,
      agent: "velmere-shield-sentinel-agent-v1",
      source: "CoinGecko markets + Velmère multi-agent risk engine + in-memory/persistent ledger bridge",
      rowsScanned: rows.length,
      critical,
      rising,
      pump,
      alerts,
      inbox,
      alertLedger,
      alertStatus,
      rules,
      memory: publication.evidenceState === "verified" ? getMarketMemoryStatus() : null,
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/sentinel", code: "shield_sentinel_failed", status: 502 });
  }
}
