import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "premium-evidence-bridge", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  const paidAccessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "vlm_analysis",
    request,
    depth: "pro",
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
    const bridge = sourceSync.pass2483;

    return securityJson({
      mode: "premium_evidence_bridge",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      premiumEvidenceBridge: bridge,
      pass2483: bridge,
      pass2484: sourceSync.pass2484,
      pass2485: sourceSync.pass2485,
      pass2486: sourceSync.pass2486,
      pass2487: sourceSync.pass2487,
      pass2488: sourceSync.pass2488,
      runtimePremiumEvidenceHydration: sourceSync.pass2484,
      paidAdvancedReadinessFuse: sourceSync.pass2485,
      derivativesPaidReadinessBridge: sourceSync.pass2486,
      liquidationReplayPaidCopyLock: sourceSync.pass2487,
      supplyFilingProvenanceLock: sourceSync.pass2488,
      state: bridge?.state ?? "blocked",
      premiumEvidenceScore: bridge?.premiumEvidenceScore ?? 0,
      paidAdvancedCandidate: bridge?.paidAdvancedCandidate ?? false,
      paidAdvancedConclusionAllowed: bridge?.paidAdvancedConclusionAllowed ?? false,
      paidBlockers: bridge?.paidBlockers ?? [],
      lanes: bridge?.lanes ?? [],
      surfaceActions: bridge?.surfaceActions ?? [],
      linkedAdvancedValueAudit: sourceSync.pass2482,
      sourceSyncProof: {
        pass2466: sourceSync.pass2466?.state,
        pass2467: sourceSync.pass2467?.state,
        pass2468: sourceSync.pass2468?.state,
        pass2469: sourceSync.pass2469?.state,
        pass2476: sourceSync.pass2476?.state,
        pass2482: sourceSync.pass2482?.state,
        pass2483: bridge?.state,
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
      route: "/api/market-integrity/premium-evidence-bridge",
      code: "premium_evidence_bridge_request_failed",
      status: 502,
    });
  }
}
