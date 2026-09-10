import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2451DataProvenanceLedger } from "@/lib/market-integrity/data-provenance-ledger";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "data-provenance", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });

  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const dataProvenance = sourceSync.pass2451 ?? buildPass2451DataProvenanceLedger({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      chartOverlay: sourceSync.pass2449,
      tierEvidence: sourceSync.pass2450,
    });

    return securityJson({
      mode: sourceSync.mode,
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      dataProvenance,
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
      fieldLedger: dataProvenance.fieldLedger,
      advancedLocks: dataProvenance.advancedLocks,
      freshnessEnvelope: dataProvenance.freshnessEnvelope,
      surfaceMounts: dataProvenance.surfaceMounts,
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2447: sourceSync.pass2447?.state,
        pass2448: sourceSync.pass2448?.state,
        pass2449: sourceSync.pass2449?.state,
        pass2450: sourceSync.pass2450?.state,
        pass2451: dataProvenance.state,
        pass2452: sourceSync.pass2452?.state,
        pass2453: sourceSync.pass2453?.state,
        pass2454: sourceSync.pass2454?.state,
        pass2455: sourceSync.pass2455?.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        score: dataProvenance.score,
        calibratedRiskScore: sourceSync.pass2452?.calibratedRiskScore,
        canonicalEvidenceFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
        institutionalRouterScore: sourceSync.pass2454?.score,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/data-provenance", code: "data_provenance_ledger_failed", status: 502 });
  }
}
