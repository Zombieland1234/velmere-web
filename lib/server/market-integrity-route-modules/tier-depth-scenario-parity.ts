import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildPass2465TierDepthScenarioParity } from "@/lib/market-integrity/tier-depth-scenario-parity";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "tier-depth-scenario-parity", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort });
    const tierDepthScenarioParity = sourceSync.pass2465 ?? buildPass2465TierDepthScenarioParity({
      query,
      symbol: sourceSync.symbol,
      result,
      sourceSync,
    });

    return securityJson({
      mode: "tier_depth_scenario_parity",
      query,
      range,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      tierDepthScenarioParity,
      currentZipAudit: tierDepthScenarioParity.currentZipAudit,
      tierContracts: tierDepthScenarioParity.tierContracts,
      surfaceDepthContracts: tierDepthScenarioParity.surfaceDepthContracts,
      scenarioLanes: tierDepthScenarioParity.scenarioLanes,
      pdfTierDifferentiationLock: tierDepthScenarioParity.pdfTierDifferentiationLock,
      shieldRealMarketsParityLock: tierDepthScenarioParity.shieldRealMarketsParityLock,
      noFillerTierRule: tierDepthScenarioParity.noFillerTierRule,
      pass2450TierEvidenceParity: sourceSync.pass2450,
      pass2453ReportEvidenceCapsule: sourceSync.pass2453,
      pass2464CrossProviderWindowReconciliation: sourceSync.pass2464,
      derivativesSqueezeProof: sourceSync.pass2466,
      liquidationLongShortProof: sourceSync.pass2467,
      pass2466DerivativesSqueezeProof: sourceSync.pass2466,
      tier180OutputMatrix: sourceSync.pass2470,
      sourceSyncProof: {
        pass2450: sourceSync.pass2450?.state,
        pass2453: sourceSync.pass2453?.state,
        pass2464: sourceSync.pass2464?.state,
        pass2465: tierDepthScenarioParity.state,
        pass2466: sourceSync.pass2466?.state,
        pass2467: sourceSync.pass2467?.state,
        pass2470: sourceSync.pass2470?.state,
        pass2466Score: sourceSync.pass2466?.score,
        pass2466Direction: sourceSync.pass2466?.direction,
        pass2470GeneratedCells: sourceSync.pass2470?.generatedCells,
        pass2470RuntimeLiveCoveragePercent: sourceSync.pass2470?.runtimeLiveCoveragePercent,
        score: tierDepthScenarioParity.score,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/tier-depth-scenario-parity", code: "tier_depth_scenario_parity_request_failed", status: 502 });
  }
}
