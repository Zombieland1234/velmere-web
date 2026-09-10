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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "evidence-consensus", limit: 24, windowMs: 60_000 });
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
      evidenceConsensus: sourceSync.pass2447,
      contradictionRadar: sourceSync.pass2447?.contradictionRadar ?? [],
      tierLocks: sourceSync.pass2447?.tierLocks ?? [],
      advancedBlockers: sourceSync.pass2447?.tierLocks.find((tier) => tier.tier === "advanced")?.blockedBy ?? [],
      methodologyRegistry: sourceSync.pass2448,
      methodologyBlockedFields: sourceSync.pass2448?.fieldContracts.filter((field) => field.currentState === "blocked") ?? [],
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
      calibrationNoFillerGovernor: sourceSync.pass2452?.noFillerGovernor,
      provenanceAdvancedLocks: sourceSync.pass2451?.advancedLocks ?? [],
      chartOverlayAdvancedBlockers: sourceSync.pass2449?.tierLocks.find((tier) => tier.tier === "advanced")?.blockedBy ?? [],
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2444: sourceSync.pass2444?.state,
        pass2445: sourceSync.pass2445?.state,
        pass2446: sourceSync.pass2446?.overallState,
        pass2447: sourceSync.pass2447?.state,
        pass2448: sourceSync.pass2448?.state,
        pass2449: sourceSync.pass2449?.state,
        pass2450: sourceSync.pass2450?.state,
        pass2451: sourceSync.pass2451?.state,
        pass2452: sourceSync.pass2452?.state,
        pass2453: sourceSync.pass2453?.state,
        pass2454: sourceSync.pass2454?.state,
        pass2455: sourceSync.pass2455?.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        calibratedRiskScore: sourceSync.pass2452?.calibratedRiskScore,
        confidenceCap: sourceSync.pass2447?.confidenceCap ?? sourceSync.confidenceCap,
      },
      uiMountTargets: ["Shield modal consensus strip", "VLM Brain proof rail", "Browser compact result", "PDF parity table", "Angel first response block"],
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/consensus", code: "evidence_consensus_failed", status: 502 });
  }
}
