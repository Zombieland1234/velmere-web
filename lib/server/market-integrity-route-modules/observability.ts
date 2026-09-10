import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "provider-observability", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    return securityJson({
      mode: sourceSync.mode,
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      observability: sourceSync.pass2446,
      defillamaExpansion: sourceSync.pass2446DefiLlama,
      sourceSla: sourceSync.pass2445,
      proofCapsuleStatus: sourceSync.pass2446?.proofCapsule.currentStatus ?? "planned",
      evidenceConsensus: sourceSync.pass2447,
      contradictionRadar: sourceSync.pass2447?.contradictionRadar ?? [],
      consensusTierLocks: sourceSync.pass2447?.tierLocks ?? [],
      methodologyRegistry: sourceSync.pass2448,
      methodologyFieldContracts: sourceSync.pass2448?.fieldContracts ?? [],
      chartOverlayReconciler: sourceSync.pass2449,
      tierEvidenceParity: sourceSync.pass2450,
      dataProvenanceLedger: sourceSync.pass2451,
      riskCalibrationKernel: sourceSync.pass2452,
      reportEvidenceCapsule: sourceSync.pass2453,
      institutionalRouter: sourceSync.pass2454,
      uiProofStrip: sourceSync.pass2455,
      runtimeParityQueue: sourceSync.pass2456,
      operatorActionQueue: sourceSync.pass2457,
      providerCloseoutRuntime: sourceSync.pass2458,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      calibrationComponents: sourceSync.pass2452?.components ?? [],
      provenanceFieldLedger: sourceSync.pass2451?.fieldLedger ?? [],
      chartOverlayBadges: sourceSync.pass2449?.uiBadges ?? [],
      uiMountTargets: ["Shield source ribbon", "VLM Brain tier cards", "Browser compact result", "PDF preview/download", "Angel first response block"],
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/observability", code: "provider_observability_failed", status: 502 });
  }
}
