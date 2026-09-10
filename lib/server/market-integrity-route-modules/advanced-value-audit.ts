import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildPass2482AdvancedValueAudit } from "@/lib/market-integrity/advanced-value-audit";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "advanced-value-audit", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  const paidAccessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "vlm_analysis",
    request,
    depth: "advanced",
    locale: "en",
    assetId: query,
    symbol: query,
  });
  if (!paidAccessGate.ok) {
    return securityJson(toVlmPaidSurfacePaymentRequiredPayload(paidAccessGate), {
      status: 402,
      headers: paidAccessGate.headers,
    });
  }

  try {
    const realMarketResult = shouldForceNonCryptoRealMarket(query) ? await resolveRealMarketVlmRiskResult(query) : null;
    const marketRow = realMarketResult ? null : await searchCoinGeckoMarket(query);
    const resolvedResult = realMarketResult ?? marketRow?.result ?? await analyzeDexScreenerToken(query);
    const { result, hydration: pass2484Hydration } = await hydratePass2484RuntimePremiumEvidence({ query, result: resolvedResult });
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort, pass2484Hydration });
    const advancedValueAudit = sourceSync.pass2482 ?? buildPass2482AdvancedValueAudit({
      query,
      symbol: sourceSync.symbol,
      result,
      pass2465: sourceSync.pass2465,
      pass2470: sourceSync.pass2470,
      pass2476: sourceSync.pass2476,
      pass2483: sourceSync.pass2483,
      pass2485: sourceSync.pass2485,
      pass2487: sourceSync.pass2487,
      pass2488: sourceSync.pass2488,
    });

    return securityJson({
      mode: "advanced_value_audit",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      advancedValueAudit,
      state: advancedValueAudit.state,
      advancedWorthinessScore: advancedValueAudit.advancedWorthinessScore,
      paidAdvancedReady: advancedValueAudit.paidAdvancedReady,
      canChargeForAdvancedConclusion: advancedValueAudit.canChargeForAdvancedConclusion,
      requiredLanes: advancedValueAudit.requiredLanes,
      surfaceVerdicts: advancedValueAudit.surfaceVerdicts,
      nextImplementationActions: advancedValueAudit.nextImplementationActions,
      premiumEvidenceBridge: sourceSync.pass2483,
      pass2483: sourceSync.pass2483,
      pass2484: sourceSync.pass2484,
      runtimePremiumEvidenceHydration: sourceSync.pass2484,
      paidAdvancedReadinessFuse: sourceSync.pass2485,
      derivativesPaidReadinessBridge: sourceSync.pass2486,
      pass2485: sourceSync.pass2485,
      pass2487: sourceSync.pass2487,
      pass2488: sourceSync.pass2488,
      liquidationReplayPaidCopyLock: sourceSync.pass2487,
      supplyFilingProvenanceLock: sourceSync.pass2488,
      sourceSyncProof: {
        pass2465: sourceSync.pass2465?.state,
        pass2470: sourceSync.pass2470?.state,
        pass2476: sourceSync.pass2476?.state,
        pass2482: advancedValueAudit.state,
        pass2482Score: advancedValueAudit.advancedWorthinessScore,
        pass2484: sourceSync.pass2484?.state,
        pass2485: sourceSync.pass2485?.state,
        pass2485PaidAdvancedAllowed: sourceSync.pass2485?.paidAdvancedAllowed ?? false,
        pass2486: sourceSync.pass2486?.state,
        pass2486ConfirmedSqueezeCopyAllowed: sourceSync.pass2486?.confirmedSqueezeCopyAllowed ?? false,
        pass2487: sourceSync.pass2487?.state,
        pass2487PaidCopyAllowed: sourceSync.pass2487?.paidCopyAllowed ?? false,
        pass2488: sourceSync.pass2488?.state,
        pass2488PaidProvenanceAllowed: sourceSync.pass2488?.paidProvenanceAllowed ?? false,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/advanced-value-audit",
      code: "advanced_value_audit_request_failed",
      status: 502,
    });
  }
}
