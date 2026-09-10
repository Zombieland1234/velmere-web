import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2464CrossProviderWindowReconciliation } from "@/lib/market-integrity/cross-provider-window-reconciliation";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "window-reconciliation", limit: 24, windowMs: 60_000 });
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
    const crossProviderWindowReconciliation = sourceSync.pass2464 ?? buildPass2464CrossProviderWindowReconciliation({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      historicalRangeWindow: sourceSync.pass2463,
      payloadFingerprint: sourceSync.pass2463?.rangeWindowFingerprint ?? sourceSync.pass2462?.backfillFingerprint,
    });

    return securityJson({
      mode: "cross_provider_window_reconciliation",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      crossProviderWindowReconciliation,
      providerComparisons: crossProviderWindowReconciliation.providerComparisons,
      pairingRules: crossProviderWindowReconciliation.pairingRules,
      pdfWindowParity: crossProviderWindowReconciliation.pdfWindowParity,
      surfaceHardLocks: crossProviderWindowReconciliation.surfaceHardLocks,
      replayOrder: crossProviderWindowReconciliation.replayOrder,
      historicalRangeWindowLedger: sourceSync.pass2463,
      historicalBackfillOrchestrator: sourceSync.pass2462,
      macroGapReceipt: sourceSync.pass2461,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/window-reconciliation", code: "cross_provider_window_reconciliation_request_failed", status: 502 });
  }
}
