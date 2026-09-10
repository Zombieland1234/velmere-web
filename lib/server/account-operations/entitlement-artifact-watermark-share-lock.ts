import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2497EntitlementArtifactWatermarkShareLock } from "@/lib/market-integrity/entitlement-artifact-watermark-share-lock";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-artifact-watermark-share-lock", limit: 18, windowMs: 60_000 });
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
    const watermark = {
      sessionLedgerKey: param(searchParams, "sessionLedgerKey", 260),
      artifactHash: param(searchParams, "artifactHash", 260),
      deliveryManifestKey: param(searchParams, "deliveryManifestKey", 260),
      customerPseudonymHash: param(searchParams, "customerPseudonymHash", 260),
      watermarkFingerprint: param(searchParams, "watermarkFingerprint", 260),
      signedDownloadUrlFingerprint: param(searchParams, "signedDownloadUrlFingerprint", 260),
      downloadNonceFingerprint: param(searchParams, "downloadNonceFingerprint", 260),
      shareLeakSignal: param(searchParams, "shareLeakSignal", 80),
      signedAt: param(searchParams, "signedAt", 80),
      expiresAt: param(searchParams, "expiresAt", 80),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementArtifactWatermarkShareLock = buildPass2497EntitlementArtifactWatermarkShareLock({
      query,
      symbol: sourceSync.symbol,
      pass2496: sourceSync.pass2496,
      watermark,
    });

    return securityJson({
      mode: "entitlement_artifact_watermark_share_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementArtifactWatermarkShareLock,
      pass2497: entitlementArtifactWatermarkShareLock,
      sourceSyncPass2497: sourceSync.pass2497,
      linkedPass2496: sourceSync.pass2496,
      state: entitlementArtifactWatermarkShareLock.state,
      accessMode: entitlementArtifactWatermarkShareLock.accessMode,
      finalPaidWatermarkedArtifactAllowed: entitlementArtifactWatermarkShareLock.finalPaidWatermarkedArtifactAllowed,
      shareLeakReviewRequired: entitlementArtifactWatermarkShareLock.shareLeakReviewRequired,
      publicCacheDenied: entitlementArtifactWatermarkShareLock.publicCacheDenied,
      screenshotShareCannotProveEntitlement: entitlementArtifactWatermarkShareLock.screenshotShareCannotProveEntitlement,
      watermarkLedgerKey: entitlementArtifactWatermarkShareLock.watermarkLedgerKey,
      blockers: entitlementArtifactWatermarkShareLock.blockers,
      surfaceWatermarkBindings: entitlementArtifactWatermarkShareLock.surfaceWatermarkBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement artifact watermark share lock failed" },
      { status: 502 },
    );
  }
}
