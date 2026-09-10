import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2458ProviderCloseoutRuntime } from "@/lib/market-integrity/provider-closeout-runtime";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "provider-closeout-runtime", limit: 24, windowMs: 60_000 });
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
    const providerCloseoutRuntime = sourceSync.pass2458 ?? buildPass2458ProviderCloseoutRuntime({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      operatorActionQueue: sourceSync.pass2457,
    });

    return securityJson({
      mode: "provider_closeout_runtime",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      providerCloseoutRuntime,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      runtimeLanes: providerCloseoutRuntime.runtimeLanes,
      actionReplay: providerCloseoutRuntime.actionReplay,
      hardLocks: providerCloseoutRuntime.hardLocks,
      providerCloseoutPlan: sourceSync.pass2457?.providerCloseoutPlan ?? [],
      operatorActionQueue: sourceSync.pass2457,
      runtimeParityQueue: sourceSync.pass2456,
      reportEvidenceCapsule: sourceSync.pass2453,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/provider-closeout-runtime", code: "provider_closeout_runtime_request_failed", status: 502 });
  }
}
