import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2455UiProofStrip } from "@/lib/market-integrity/ui-proof-strip";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "ui-proof-strip", limit: 30, windowMs: 60_000 });
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
    const uiProofStrip = sourceSync.pass2455 ?? buildPass2455UiProofStrip({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      institutionalRouter: sourceSync.pass2454,
      reportEvidence: sourceSync.pass2453,
      chartRange: range,
      payloadFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
    });

    return securityJson({
      mode: "ui_proof_strip",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      uiProofStrip,
      runtimeParityQueue: sourceSync.pass2456,
      operatorActionQueue: sourceSync.pass2457,
      providerCloseoutRuntime: sourceSync.pass2458,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      providerChips: uiProofStrip.providerChips,
      fieldHeatmap: uiProofStrip.fieldHeatmap,
      chartRangeBadges: uiProofStrip.chartRangeBadges,
      surfaceContracts: uiProofStrip.surfaceContracts,
      pdfHardLocks: uiProofStrip.pdfHardLocks,
      institutionalRouter: sourceSync.pass2454,
      reportEvidenceCapsule: sourceSync.pass2453,
      riskCalibrationKernel: sourceSync.pass2452,
      sourceSyncVersion: sourceSync.version,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/ui-proof-strip", code: "ui_proof_strip_request_failed", status: 502 });
  }
}
