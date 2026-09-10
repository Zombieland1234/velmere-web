import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { authorizeMarketIntegrityCron } from "@/lib/security/market-integrity-cron-auth";
import { fetchCoinGeckoMarkets } from "@/lib/market-integrity/coingecko";
import { buildSweepInsights, getMarketMemoryStatus, recordMarketRows } from "@/lib/market-integrity/market-memory";
import { getRiskLedgerStatus, persistMarketRows } from "@/lib/market-integrity/risk-ledger";
import { buildSentinelAlerts } from "@/lib/market-integrity/risk-alerts";
import { persistSentinelAlerts } from "@/lib/market-integrity/alert-ledger";
import { buildShieldRuleHits } from "@/lib/market-integrity/rule-engine";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { runPass4656ProviderHealthProbeSuite } from "@/lib/market-integrity/provider-health-probe-suite";
import {
  buildPass4653ContinuitySnapshot,
  persistPass4653ContinuitySnapshot,
  readPass4653ContinuitySnapshot,
} from "@/lib/market-integrity/continuous-evidence-availability";
import { enforceLegacyRiskSweepPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

type ErrorPayload = { mode: "error"; error: string };

function configuredRealMarketWatchlist() {
  return Array.from(new Set((process.env.VELMERE_CONTINUITY_REAL_MARKET_WATCHLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)))
    .slice(0, 60);
}

async function persistContinuityBatch<T>(items: T[], worker: (item: T) => Promise<boolean>, concurrency = 8) {
  let persisted = 0;
  let failed = 0;
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const settled = await Promise.allSettled(chunk.map(worker));
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) persisted += 1;
      else failed += 1;
    }
  }
  return { attempted: items.length, persisted, failed };
}

export async function GET(request: Request) {
  const cronAuth = authorizeMarketIntegrityCron(request);
  if (!cronAuth.authorized) {
    return NextResponse.json<ErrorPayload>(
      { mode: "error", error: `Unauthorized cron sweep: ${cronAuth.reason}` },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const pages = Math.min(Math.max(Number(searchParams.get("pages") ?? "2"), 1), 6);
  const perPage = Math.min(Math.max(Number(searchParams.get("perPage") ?? "100"), 25), 250);
  const startedAt = new Date().toISOString();

  try {
    const chunks = [];
    for (let page = 1; page <= pages; page += 1) {
      chunks.push(await fetchCoinGeckoMarkets({ page, perPage, vsCurrency: "usd" }));
    }
    const generatedAt = new Date().toISOString();
    const fetchedRows = chunks.flat();
    const publication = enforceLegacyRiskSweepPublicationTruth(fetchedRows.map((row) => row.result), generatedAt);
    const rows = publication.evidenceState === "verified" ? recordMarketRows(fetchedRows) : fetchedRows;
    const cryptoContinuity = await persistContinuityBatch(rows, async (row) => {
      const previousSnapshot = await readPass4653ContinuitySnapshot({ requestedIdentity: row.id, surface: "crypto" });
      const snapshot = buildPass4653ContinuitySnapshot({
        requestedIdentity: row.id,
        surface: "crypto",
        result: row.result,
        previousSnapshot,
      });
      if (!snapshot) return false;
      const persistence = await persistPass4653ContinuitySnapshot(snapshot);
      return persistence.readBackVerified;
    });

    const realMarketWatchlist = configuredRealMarketWatchlist();
    const realMarketContinuity = await persistContinuityBatch(realMarketWatchlist, async (symbol) => {
      const result = await resolveRealMarketVlmRiskResult(symbol);
      if (!result) return false;
      const previousSnapshot = await readPass4653ContinuitySnapshot({ requestedIdentity: symbol, surface: "real_markets" });
      const snapshot = buildPass4653ContinuitySnapshot({
        requestedIdentity: symbol,
        surface: "real_markets",
        result,
        previousSnapshot,
      });
      if (!snapshot) return false;
      const persistence = await persistPass4653ContinuitySnapshot(snapshot);
      return persistence.readBackVerified;
    }, 4);

    const providerHealthProbes = await runPass4656ProviderHealthProbeSuite({ includeRealMarkets: true }).catch((error) => ({
      schemaVersion: "pass4656_provider_health_probe_suite_v1" as const,
      enabled: true,
      generatedAt: new Date().toISOString(),
      observations: [],
      accepted: 0,
      failed: 0,
      persistence: null,
      blockers: [`provider_health_probe_suite_error:${error instanceof Error ? error.name : "unknown"}`],
    }));
    const ledger = publication.evidenceState === "verified"
      ? await persistMarketRows(rows)
      : { mode: "memory" as const, attempted: 0, stored: 0, skipped: rows.length };
    const insights = publication.evidenceState === "verified" ? buildSweepInsights(rows) : null;
    const sentinelAlerts = publication.evidenceState === "verified" ? buildSentinelAlerts(rows) : [];
    const alertLedger = await persistSentinelAlerts(sentinelAlerts);
    const rules = publication.evidenceState === "verified" ? buildShieldRuleHits(rows, searchParams.get("watchlist")) : [];
    const critical = publication.evidenceState === "verified" ? rows.filter((row) => row.result.score >= 85).length : 0;
    const high = publication.evidenceState === "verified" ? rows.filter((row) => row.result.score >= 65 && row.result.score < 85).length : 0;
    const rising = publication.evidenceState === "verified" ? rows.filter((row) => row.memory?.trend === "rising_risk").length : 0;

    return NextResponse.json({
      mode: publication.mode,
      publication,
      agent: "velmere-shield-cron-market-sweep-v2",
      startedAt,
      generatedAt,
      pages,
      perPage,
      rowsScanned: rows.length,
      providerHealthProbes: {
        enabled: providerHealthProbes.enabled,
        accepted: providerHealthProbes.accepted,
        failed: providerHealthProbes.failed,
        blockers: providerHealthProbes.blockers,
        persistence: providerHealthProbes.persistence,
      },
      continuity: {
        crypto: cryptoContinuity,
        realMarkets: realMarketContinuity,
        realMarketWatchlistSize: realMarketWatchlist.length,
        policy: "Hot crypto catalog is refreshed by cron; any supported asset is also snapshotted on demand by the VLM route. Real Markets hot assets are configured with VELMERE_CONTINUITY_REAL_MARKET_WATCHLIST.",
      },
      critical,
      high,
      rising,
      ledger,
      alertLedger,
      sentinelAlerts,
      rules,
      memory: publication.evidenceState === "verified" ? getMarketMemoryStatus() : null,
      ledgerStatus: publication.evidenceState === "verified" ? await getRiskLedgerStatus() : null,
      insights,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/cron", code: "cron_market_sweep_failed", status: 502 });
  }
}
