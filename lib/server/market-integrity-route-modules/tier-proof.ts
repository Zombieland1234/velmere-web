import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildPass2450TierEvidenceParity } from "@/lib/market-integrity/tier-evidence-parity";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "tier-proof", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });

  if (!query) {
    return securityJson({ mode: "error", error: "Missing query" }, { status: 400 });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort });
    const tierEvidenceParity = sourceSync.pass2450 ?? buildPass2450TierEvidenceParity({ query, symbol: result?.token.symbol, range, sourceSync, chartOverlay: sourceSync.pass2449 });

    return securityJson({
      mode: sourceSync.mode,
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      tierEvidenceParity,
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
      tierDepthScenarioParity: sourceSync.pass2465,
      derivativesSqueezeProof: sourceSync.pass2466,
      liquidationLongShortProof: sourceSync.pass2467,
      scenarioLanes: sourceSync.pass2465?.scenarioLanes ?? [],
      pdfTierDifferentiationLock: sourceSync.pass2465?.pdfTierDifferentiationLock,
      tierValueReceipt: sourceSync.pass2452?.tierValueReceipt ?? [],
      tierContracts: tierEvidenceParity.tierContracts,
      surfaceContracts: tierEvidenceParity.surfaceContracts,
      advancedMissingProof: tierEvidenceParity.tierContracts.find((tier) => tier.tier === "advanced")?.missingProof ?? [],
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2447: sourceSync.pass2447?.state,
        pass2448: sourceSync.pass2448?.state,
        pass2449: sourceSync.pass2449?.state,
        pass2450: tierEvidenceParity.state,
        pass2451: sourceSync.pass2451?.state,
        pass2452: sourceSync.pass2452?.state,
        pass2453: sourceSync.pass2453?.state,
        pass2454: sourceSync.pass2454?.state,
        pass2455: sourceSync.pass2455?.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        pass2465: sourceSync.pass2465?.state,
        pass2466: sourceSync.pass2466?.state,
        pass2467: sourceSync.pass2467?.state,
        calibratedRiskScore: sourceSync.pass2452?.calibratedRiskScore,
        score: tierEvidenceParity.score,
        sourceFingerprint: tierEvidenceParity.sourceFingerprint,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/tier-proof", code: "tier_proof_parity_failed", status: 502 });
  }
}
