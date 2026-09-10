import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "advanced-cta-entitlement-contract", limit: 18, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const realMarketResult = shouldForceNonCryptoRealMarket(query) ? await resolveRealMarketVlmRiskResult(query) : null;
    const marketRow = realMarketResult ? null : await searchCoinGeckoMarket(query);
    const resolvedResult = realMarketResult ?? marketRow?.result ?? await analyzeDexScreenerToken(query);
    const { result, hydration: pass2484Hydration } = await hydratePass2484RuntimePremiumEvidence({ query, result: resolvedResult });
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort, pass2484Hydration });
    const advancedCtaEntitlementContract = sourceSync.pass2490;

    return securityJson({
      mode: "advanced_cta_entitlement_contract",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      advancedCtaEntitlementContract,
      pass2490: advancedCtaEntitlementContract,
      state: advancedCtaEntitlementContract?.state ?? "blocked",
      ctaMode: advancedCtaEntitlementContract?.ctaMode ?? "disabled",
      checkoutProductMode: advancedCtaEntitlementContract?.checkoutProductMode ?? "blocked",
      paidCheckoutAllowed: advancedCtaEntitlementContract?.paidCheckoutAllowed ?? false,
      finalPaidVerdictAllowed: advancedCtaEntitlementContract?.finalPaidVerdictAllowed ?? false,
      missingProofMapPaidAllowed: advancedCtaEntitlementContract?.missingProofMapPaidAllowed ?? false,
      serverReceiptRequired: advancedCtaEntitlementContract?.serverReceiptRequired ?? true,
      walletOnlyUnlockAllowed: advancedCtaEntitlementContract?.walletOnlyUnlockAllowed ?? false,
      ctaLabel: advancedCtaEntitlementContract?.ctaLabel ?? "Advanced locked",
      customerMessage: advancedCtaEntitlementContract?.customerMessage ?? "Advanced CTA locked until source-sync returns PASS2490.",
      hardLocks: advancedCtaEntitlementContract?.hardLocks ?? [],
      surfaceBindings: advancedCtaEntitlementContract?.surfaceBindings ?? [],
      linked: {
        pass2489: sourceSync.pass2489?.state,
        advancedCopyMode: sourceSync.pass2489?.advancedCopyMode,
        paidAdvancedAllowed: sourceSync.pass2489?.paidAdvancedAllowed,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/advanced-cta-entitlement-contract",
      code: "advanced_cta_entitlement_contract_failed",
      status: 502,
    });
  }
}
