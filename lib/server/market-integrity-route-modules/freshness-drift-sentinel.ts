import { createPublicApiErrorHandler } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2459SourceFreshnessDriftSentinel } from "@/lib/market-integrity/source-freshness-drift-sentinel";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

const freshnessDriftSentinelError = createPublicApiErrorHandler({
  route: "/api/market-integrity/freshness-drift-sentinel",
  code: "freshness_drift_sentinel_request_failed",
  status: 502,
});

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "freshness-drift-sentinel", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const freshnessDriftSentinel = sourceSync.pass2459 ?? buildPass2459SourceFreshnessDriftSentinel({
      query,
      symbol: sourceSync.symbol,
      range,
      sourceSync,
      providerCloseoutRuntime: sourceSync.pass2458,
    });

    return securityJson({
      mode: "source_freshness_drift_sentinel",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      freshnessDriftSentinel,
      freshnessLanes: freshnessDriftSentinel.lanes,
      surfaceContracts: freshnessDriftSentinel.surfaceContracts,
      hardLocks: freshnessDriftSentinel.hardLocks,
      driftTraps: freshnessDriftSentinel.driftTraps,
      providerCloseoutRuntime: sourceSync.pass2458,
      operatorActionQueue: sourceSync.pass2457,
      reportEvidenceCapsule: sourceSync.pass2453,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return freshnessDriftSentinelError(error);
  }
}
