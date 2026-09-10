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
import { buildPass2493EntitlementAccountVaultRetrievalContract } from "@/lib/market-integrity/entitlement-account-vault-retrieval-contract";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-account-vault-retrieval-contract", limit: 18, windowMs: 60_000 });
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
      serverReceiptFingerprint: param(searchParams, "serverReceiptFingerprint", 180),
      pass2490Fingerprint: param(searchParams, "pass2490Fingerprint", 180),
      productScope: param(searchParams, "productScope", 80),
      ctaMode: param(searchParams, "ctaMode", 80),
      surface: param(searchParams, "surface", 60),
      locale: param(searchParams, "locale", 8),
      contextHash: param(searchParams, "contextHash", 180),
      assetId: param(searchParams, "assetId", 120),
      symbol: param(searchParams, "symbol", 40),
      pdfHash: param(searchParams, "pdfHash", 180),
      angelReplayFingerprint: param(searchParams, "angelReplayFingerprint", 180),
      checkoutSessionId: param(searchParams, "checkoutSessionId", 180),
    };
    const pass2491 = buildPass2491EntitlementReceiptReplayParity({ query, symbol: sourceSync.symbol, pass2490: sourceSync.pass2490, receipt });
    const artifact = {
      previewHash: param(searchParams, "previewHash", 180),
      downloadHash: param(searchParams, "downloadHash", 180),
      pdfHash: param(searchParams, "pdfHash", 180),
      accountDeliveryId: param(searchParams, "accountDeliveryId", 140),
      accountDeliveryFingerprint: param(searchParams, "accountDeliveryFingerprint", 180),
      angelReplayFingerprint: param(searchParams, "angelReplayFingerprint", 180),
      brainReplayFingerprint: param(searchParams, "brainReplayFingerprint", 180),
      modalReplayFingerprint: param(searchParams, "modalReplayFingerprint", 180),
      checkoutSuccessFingerprint: param(searchParams, "checkoutSuccessFingerprint", 180),
      locale: param(searchParams, "locale", 8),
      operatorId: param(searchParams, "operatorId", 80),
    };
    const pass2492 = buildPass2492EntitlementArtifactDeliveryLedger({ query, symbol: sourceSync.symbol, pass2491, pass2476: sourceSync.pass2476, artifact });
    const accountVault = {
      accountId: param(searchParams, "accountId", 140),
      accountEmailHash: param(searchParams, "accountEmailHash", 180),
      accountSessionFingerprint: param(searchParams, "accountSessionFingerprint", 180),
      accountDeliveryId: param(searchParams, "accountDeliveryId", 140),
      accountDeliveryFingerprint: param(searchParams, "accountDeliveryFingerprint", 180),
      deliveryManifestKey: param(searchParams, "deliveryManifestKey", 220),
      artifactHash: param(searchParams, "artifactHash", 180),
      vaultReadTokenFingerprint: param(searchParams, "vaultReadTokenFingerprint", 180),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementAccountVaultRetrievalContract = buildPass2493EntitlementAccountVaultRetrievalContract({
      query,
      symbol: sourceSync.symbol,
      pass2492,
      accountVault,
    });

    return securityJson({
      mode: "entitlement_account_vault_retrieval_contract",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementAccountVaultRetrievalContract,
      pass2493: entitlementAccountVaultRetrievalContract,
      sourceSyncPass2493: sourceSync.pass2493,
      state: entitlementAccountVaultRetrievalContract.state,
      retrievalMode: entitlementAccountVaultRetrievalContract.retrievalMode,
      accountVaultRetrievalAllowed: entitlementAccountVaultRetrievalContract.accountVaultRetrievalAllowed,
      finalPaidVerdictVaultAccessAllowed: entitlementAccountVaultRetrievalContract.finalPaidVerdictVaultAccessAllowed,
      missingProofMapVaultAccessAllowed: entitlementAccountVaultRetrievalContract.missingProofMapVaultAccessAllowed,
      vaultRetrievalKey: entitlementAccountVaultRetrievalContract.vaultRetrievalKey,
      deliveryManifestMatchesPass2492: entitlementAccountVaultRetrievalContract.deliveryManifestMatchesPass2492,
      artifactHashMatchesDeliveryLedger: entitlementAccountVaultRetrievalContract.artifactHashMatchesDeliveryLedger,
      accountBindingReady: entitlementAccountVaultRetrievalContract.accountBindingReady,
      vaultReadTokenReady: entitlementAccountVaultRetrievalContract.vaultReadTokenReady,
      blockers: entitlementAccountVaultRetrievalContract.blockers,
      surfaceVaultBindings: entitlementAccountVaultRetrievalContract.surfaceVaultBindings,
      linked: {
        pass2491: pass2491.state,
        pass2491ReplayKey: pass2491.receiptReplayKey,
        pass2492: pass2492.state,
        pass2492DeliveryManifestKey: pass2492.deliveryManifestKey,
        pass2492ArtifactHash: pass2492.artifactHash,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement account vault retrieval contract failed" },
      { status: 502 },
    );
  }
}
