import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2491EntitlementReceiptReplayParity } from "@/lib/market-integrity/entitlement-receipt-replay-parity";
import { buildPass2492EntitlementArtifactDeliveryLedger } from "@/lib/market-integrity/entitlement-artifact-delivery-ledger";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

function param(searchParams: URLSearchParams, key: string, maxLength = 160) {
  return sanitizeBoundedParam(searchParams.get(key), { maxLength, fallback: "" }) || undefined;
}

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-artifact-delivery-ledger", limit: 18, windowMs: 60_000 });
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
    const receipt = {
      receiptId: param(searchParams, "receiptId", 140),
      serverReceiptFingerprint: param(searchParams, "serverReceiptFingerprint", 160),
      pass2490Fingerprint: param(searchParams, "pass2490Fingerprint", 160),
      productScope: param(searchParams, "productScope", 60),
      ctaMode: param(searchParams, "ctaMode", 80),
      surface: param(searchParams, "surface", 60),
      locale: param(searchParams, "locale", 8),
      contextHash: param(searchParams, "contextHash", 160),
      assetId: param(searchParams, "assetId", 120),
      symbol: param(searchParams, "symbol", 40),
      pdfHash: param(searchParams, "pdfHash", 160),
      angelReplayFingerprint: param(searchParams, "angelReplayFingerprint", 160),
      checkoutSessionId: param(searchParams, "checkoutSessionId", 160),
    };
    const pass2491 = buildPass2491EntitlementReceiptReplayParity({
      query,
      symbol: sourceSync.symbol,
      pass2490: sourceSync.pass2490,
      receipt,
    });
    const artifact = {
      previewHash: param(searchParams, "previewHash", 160),
      downloadHash: param(searchParams, "downloadHash", 160),
      pdfHash: param(searchParams, "pdfHash", 160),
      accountDeliveryId: param(searchParams, "accountDeliveryId", 140),
      accountDeliveryFingerprint: param(searchParams, "accountDeliveryFingerprint", 160),
      angelReplayFingerprint: param(searchParams, "angelReplayFingerprint", 160),
      brainReplayFingerprint: param(searchParams, "brainReplayFingerprint", 160),
      modalReplayFingerprint: param(searchParams, "modalReplayFingerprint", 160),
      checkoutSuccessFingerprint: param(searchParams, "checkoutSuccessFingerprint", 160),
      locale: param(searchParams, "locale", 8),
      operatorId: param(searchParams, "operatorId", 80),
    };
    const entitlementArtifactDeliveryLedger = buildPass2492EntitlementArtifactDeliveryLedger({
      query,
      symbol: sourceSync.symbol,
      pass2491,
      pass2476: sourceSync.pass2476,
      artifact,
    });

    return securityJson({
      mode: "entitlement_artifact_delivery_ledger",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementArtifactDeliveryLedger,
      pass2492: entitlementArtifactDeliveryLedger,
      sourceSyncPass2492: sourceSync.pass2492,
      state: entitlementArtifactDeliveryLedger.state,
      deliveryMode: entitlementArtifactDeliveryLedger.deliveryMode,
      artifactDeliveryAllowed: entitlementArtifactDeliveryLedger.artifactDeliveryAllowed,
      finalPaidVerdictArtifactAllowed: entitlementArtifactDeliveryLedger.finalPaidVerdictArtifactAllowed,
      missingProofMapArtifactAllowed: entitlementArtifactDeliveryLedger.missingProofMapArtifactAllowed,
      previewDownloadHashMatch: entitlementArtifactDeliveryLedger.previewDownloadHashMatch,
      accountConsoleDeliveryReady: entitlementArtifactDeliveryLedger.accountConsoleDeliveryReady,
      crossSurfaceReplayParityReady: entitlementArtifactDeliveryLedger.crossSurfaceReplayParityReady,
      deliveryManifestKey: entitlementArtifactDeliveryLedger.deliveryManifestKey,
      blockers: entitlementArtifactDeliveryLedger.blockers,
      surfaceArtifactBindings: entitlementArtifactDeliveryLedger.surfaceArtifactBindings,
      linked: {
        pass2490: sourceSync.pass2490?.state,
        pass2491: pass2491.state,
        pass2491ReplayKey: pass2491.receiptReplayKey,
        pass2476: sourceSync.pass2476?.state,
        pass2476RunnerFingerprint: sourceSync.pass2476?.runnerFingerprint,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/entitlement-artifact-delivery-ledger",
      code: "entitlement_artifact_delivery_ledger_failed",
      status: 502,
    });
  }
}
