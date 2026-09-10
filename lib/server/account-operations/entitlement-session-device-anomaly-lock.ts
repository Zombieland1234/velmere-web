import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2496EntitlementSessionDeviceAnomalyLock } from "@/lib/market-integrity/entitlement-session-device-anomaly-lock";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-session-device-anomaly-lock", limit: 18, windowMs: 60_000 });
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
    const session = {
      accountSessionFingerprint: param(searchParams, "accountSessionFingerprint", 180),
      vaultReadTokenFingerprint: param(searchParams, "vaultReadTokenFingerprint", 180),
      adminOverrideLedgerKey: param(searchParams, "adminOverrideLedgerKey", 240),
      deviceBindingFingerprint: param(searchParams, "deviceBindingFingerprint", 180),
      csrfNonceFingerprint: param(searchParams, "csrfNonceFingerprint", 180),
      ipRiskFingerprint: param(searchParams, "ipRiskFingerprint", 180),
      userAgentHash: param(searchParams, "userAgentHash", 180),
      mfaChallengeFingerprint: param(searchParams, "mfaChallengeFingerprint", 180),
      signedAt: param(searchParams, "signedAt", 80),
      expiresAt: param(searchParams, "expiresAt", 80),
      sessionRiskLevel: param(searchParams, "sessionRiskLevel", 40),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementSessionDeviceAnomalyLock = buildPass2496EntitlementSessionDeviceAnomalyLock({
      query,
      symbol: sourceSync.symbol,
      pass2495: sourceSync.pass2495,
      session,
    });

    return securityJson({
      mode: "entitlement_session_device_anomaly_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementSessionDeviceAnomalyLock,
      pass2496: entitlementSessionDeviceAnomalyLock,
      sourceSyncPass2496: sourceSync.pass2496,
      linkedPass2495: sourceSync.pass2495,
      state: entitlementSessionDeviceAnomalyLock.state,
      accessMode: entitlementSessionDeviceAnomalyLock.accessMode,
      finalPaidSessionAccessAllowed: entitlementSessionDeviceAnomalyLock.finalPaidSessionAccessAllowed,
      missingProofSessionReviewAllowed: entitlementSessionDeviceAnomalyLock.missingProofSessionReviewAllowed,
      stepUpRequired: entitlementSessionDeviceAnomalyLock.stepUpRequired,
      copiedSessionDenied: entitlementSessionDeviceAnomalyLock.copiedSessionDenied,
      stolenVaultTokenDenied: entitlementSessionDeviceAnomalyLock.stolenVaultTokenDenied,
      publicCacheSessionDenied: entitlementSessionDeviceAnomalyLock.publicCacheSessionDenied,
      walletOnlySessionDenied: entitlementSessionDeviceAnomalyLock.walletOnlySessionDenied,
      sessionLedgerKey: entitlementSessionDeviceAnomalyLock.sessionLedgerKey,
      blockers: entitlementSessionDeviceAnomalyLock.blockers,
      surfaceSessionBindings: entitlementSessionDeviceAnomalyLock.surfaceSessionBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement session/device anomaly lock failed" },
      { status: 502 },
    );
  }
}
