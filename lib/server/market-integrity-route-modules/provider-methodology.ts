import { createPublicApiErrorHandler } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2448ProviderCards, buildPass2448ProviderMethodologyRegistry } from "@/lib/market-integrity/provider-methodology-registry";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

const providerMethodologyError = createPublicApiErrorHandler({
  route: "/api/market-integrity/provider-methodology",
  code: "provider_methodology_failed",
  status: 502,
});

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "provider-methodology", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });

  if (!query) {
    return securityJson({
      mode: "registry",
      providerCards: buildPass2448ProviderCards(),
      boundary: "Provider cards describe what each source may and may not support. Planned providers are not live evidence.",
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const registry = sourceSync.pass2448 ?? buildPass2448ProviderMethodologyRegistry({ sourceSync });
    return securityJson({
      mode: sourceSync.mode,
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      providerMethodology: registry,
      fieldContracts: registry.fieldContracts,
      blockedFields: registry.fieldContracts.filter((field) => field.currentState === "blocked"),
      nextIntegrations: registry.nextIntegrations,
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
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2447: sourceSync.pass2447?.state,
        pass2448: registry.state,
        pass2449: sourceSync.pass2449?.state,
        pass2450: sourceSync.pass2450?.state,
        pass2451: sourceSync.pass2451?.state,
        pass2452: sourceSync.pass2452?.state,
        pass2453: sourceSync.pass2453?.state,
        pass2454: sourceSync.pass2454?.state,
        pass2455: sourceSync.pass2455?.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        score: registry.score,
        activeProviderCount: registry.activeProviderCount,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return providerMethodologyError(error);
  }
}
