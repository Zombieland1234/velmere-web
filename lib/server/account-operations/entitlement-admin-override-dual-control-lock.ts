import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2495EntitlementAdminOverrideDualControlLock } from "@/lib/market-integrity/entitlement-admin-override-dual-control-lock";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorPayload = { mode: "error"; error: string };

function param(searchParams: URLSearchParams, key: string, maxLength = 180) {
  return sanitizeBoundedParam(searchParams.get(key), { maxLength, fallback: "" }) || undefined;
}

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-admin-override-dual-control-lock", limit: 18, windowMs: 60_000 });
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
    const adminOverride = {
      overrideRequestId: param(searchParams, "overrideRequestId", 160),
      supportCaseId: param(searchParams, "supportCaseId", 160),
      revocationLedgerKey: param(searchParams, "revocationLedgerKey", 240),
      requestedAccessMode: param(searchParams, "requestedAccessMode", 80),
      reasonCode: param(searchParams, "reasonCode", 80),
      primaryOperatorFingerprint: param(searchParams, "primaryOperatorFingerprint", 180),
      secondaryOperatorFingerprint: param(searchParams, "secondaryOperatorFingerprint", 180),
      approvalPolicyFingerprint: param(searchParams, "approvalPolicyFingerprint", 180),
      customerNoticeFingerprint: param(searchParams, "customerNoticeFingerprint", 180),
      expiresAt: param(searchParams, "expiresAt", 80),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementAdminOverrideDualControlLock = buildPass2495EntitlementAdminOverrideDualControlLock({
      query,
      symbol: sourceSync.symbol,
      pass2494: sourceSync.pass2494,
      adminOverride,
    });

    return securityJson({
      mode: "entitlement_admin_override_dual_control_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementAdminOverrideDualControlLock,
      pass2495: entitlementAdminOverrideDualControlLock,
      sourceSyncPass2495: sourceSync.pass2495,
      linkedPass2494: sourceSync.pass2494,
      state: entitlementAdminOverrideDualControlLock.state,
      overrideMode: entitlementAdminOverrideDualControlLock.overrideMode,
      dualControlActive: entitlementAdminOverrideDualControlLock.dualControlActive,
      finalPaidAdminOverrideAllowed: entitlementAdminOverrideDualControlLock.finalPaidAdminOverrideAllowed,
      missingProofAdminReviewAllowed: entitlementAdminOverrideDualControlLock.missingProofAdminReviewAllowed,
      manualRegrantAllowed: entitlementAdminOverrideDualControlLock.manualRegrantAllowed,
      localAdminToggleDenied: entitlementAdminOverrideDualControlLock.localAdminToggleDenied,
      clientSideRoleToggleDenied: entitlementAdminOverrideDualControlLock.clientSideRoleToggleDenied,
      walletOnlyOverrideDenied: entitlementAdminOverrideDualControlLock.walletOnlyOverrideDenied,
      publicCacheOverrideDenied: entitlementAdminOverrideDualControlLock.publicCacheOverrideDenied,
      adminOverrideLedgerKey: entitlementAdminOverrideDualControlLock.adminOverrideLedgerKey,
      blockers: entitlementAdminOverrideDualControlLock.blockers,
      surfaceAdminBindings: entitlementAdminOverrideDualControlLock.surfaceAdminBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement admin override dual-control lock failed" },
      { status: 502 },
    );
  }
}
