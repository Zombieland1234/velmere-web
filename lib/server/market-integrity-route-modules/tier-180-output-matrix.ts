import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildPass2470Tier180OutputMatrix } from "@/lib/market-integrity/tier-180-output-matrix";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";

type ErrorPayload = { mode: "error"; error: string };

async function resolveMarket(query: string) {
  const marketRow = await searchCoinGeckoMarket(query);
  return marketRow?.result ?? await analyzeDexScreenerToken(query);
}

async function handleTier180OutputMatrixGet(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "tier-180-output-matrix", limit: 18, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "btc" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const result = await resolveMarket(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort });
    const tier180OutputMatrix = sourceSync.pass2470 ?? buildPass2470Tier180OutputMatrix({
      query,
      symbol: sourceSync.symbol,
      result,
      pass2465: sourceSync.pass2465,
      pass2466: sourceSync.pass2466,
      pass2467: sourceSync.pass2467,
      pass2468: sourceSync.pass2468,
      pass2469: sourceSync.pass2469,
    });

    return securityJson({
      mode: "tier_180_output_matrix",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      tier180OutputMatrix,
      totalCells: tier180OutputMatrix.totalCells,
      generatedCells: tier180OutputMatrix.generatedCells,
      deterministicHarnessCoveragePercent: tier180OutputMatrix.deterministicHarnessCoveragePercent,
      runtimeLiveCoveragePercent: tier180OutputMatrix.runtimeLiveCoveragePercent,
      advancedValueGate: tier180OutputMatrix.advancedValueGate,
      pdfShieldRealMarketsParity: tier180OutputMatrix.pdfShieldRealMarketsParity,
      tierDepthScenarioParity: sourceSync.pass2465,
      derivativesSqueezeProof: sourceSync.pass2466,
      liquidationLongShortProof: sourceSync.pass2467,
      liquidationSnapshotLedger: sourceSync.pass2468,
      liquidationReplayStore: sourceSync.pass2469,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/tier-180-output-matrix", code: "tier_180_output_matrix_request_failed", status: 502 });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "tier_180_output_matrix_get", () =>
    handleTier180OutputMatrixGet(request),
  );
}
