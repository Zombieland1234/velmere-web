import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2499EntitlementRetentionErasureLock } from "@/lib/market-integrity/entitlement-retention-erasure-lock";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-retention-erasure-lock", limit: 14, windowMs: 60_000 });
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
    const retentionRequest = {
      evidenceExportLedgerKey: param(searchParams, "evidenceExportLedgerKey", 280),
      supportCaseId: param(searchParams, "supportCaseId", 180),
      requesterRole: param(searchParams, "requesterRole", 80),
      retentionPolicyFingerprint: param(searchParams, "retentionPolicyFingerprint", 260),
      dataMinimizationPolicyFingerprint: param(searchParams, "dataMinimizationPolicyFingerprint", 260),
      retentionScheduleId: param(searchParams, "retentionScheduleId", 180),
      archiveHash: param(searchParams, "archiveHash", 260),
      customerNoticeId: param(searchParams, "customerNoticeId", 180),
      retentionExpiry: param(searchParams, "retentionExpiry", 80),
      erasureJobId: param(searchParams, "erasureJobId", 180),
      erasureProofFingerprint: param(searchParams, "erasureProofFingerprint", 260),
      legalHoldStatus: param(searchParams, "legalHoldStatus", 80),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementRetentionErasureLock = buildPass2499EntitlementRetentionErasureLock({
      query,
      symbol: sourceSync.symbol,
      pass2498: sourceSync.pass2498,
      retentionRequest,
    });

    return securityJson({
      mode: "entitlement_retention_erasure_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementRetentionErasureLock,
      pass2499: entitlementRetentionErasureLock,
      sourceSyncPass2499: sourceSync.pass2499,
      linkedPass2498: sourceSync.pass2498,
      state: entitlementRetentionErasureLock.state,
      retentionMode: entitlementRetentionErasureLock.retentionMode,
      finalPaidEvidenceRetentionAllowed: entitlementRetentionErasureLock.finalPaidEvidenceRetentionAllowed,
      finalPaidEvidenceErasureRecorded: entitlementRetentionErasureLock.finalPaidEvidenceErasureRecorded,
      rawPiiRetentionDenied: entitlementRetentionErasureLock.rawPiiRetentionDenied,
      publicEvidenceArchiveDenied: entitlementRetentionErasureLock.publicEvidenceArchiveDenied,
      retentionLedgerKey: entitlementRetentionErasureLock.retentionLedgerKey,
      erasureLedgerKey: entitlementRetentionErasureLock.erasureLedgerKey,
      blockers: entitlementRetentionErasureLock.blockers,
      surfaceRetentionBindings: entitlementRetentionErasureLock.surfaceRetentionBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement retention erasure lock failed" },
      { status: 502 },
    );
  }
}
