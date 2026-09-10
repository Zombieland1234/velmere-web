import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2498EntitlementEvidenceExportDisputeLock } from "@/lib/market-integrity/entitlement-evidence-export-dispute-lock";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-evidence-export-dispute-lock", limit: 14, windowMs: 60_000 });
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
    const exportRequest = {
      watermarkLedgerKey: param(searchParams, "watermarkLedgerKey", 260),
      artifactHash: param(searchParams, "artifactHash", 260),
      customerPseudonymHash: param(searchParams, "customerPseudonymHash", 260),
      supportCaseId: param(searchParams, "supportCaseId", 180),
      exportRequestId: param(searchParams, "exportRequestId", 180),
      exportScope: param(searchParams, "exportScope", 120),
      requesterRole: param(searchParams, "requesterRole", 80),
      redactionPolicyFingerprint: param(searchParams, "redactionPolicyFingerprint", 260),
      auditSignerFingerprint: param(searchParams, "auditSignerFingerprint", 260),
      secondOperatorFingerprint: param(searchParams, "secondOperatorFingerprint", 260),
      exportNonceFingerprint: param(searchParams, "exportNonceFingerprint", 260),
      retentionExpiry: param(searchParams, "retentionExpiry", 80),
      disputeReason: param(searchParams, "disputeReason", 120),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementEvidenceExportDisputeLock = buildPass2498EntitlementEvidenceExportDisputeLock({
      query,
      symbol: sourceSync.symbol,
      pass2497: sourceSync.pass2497,
      exportRequest,
    });

    return securityJson({
      mode: "entitlement_evidence_export_dispute_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementEvidenceExportDisputeLock,
      pass2498: entitlementEvidenceExportDisputeLock,
      sourceSyncPass2498: sourceSync.pass2498,
      linkedPass2497: sourceSync.pass2497,
      state: entitlementEvidenceExportDisputeLock.state,
      exportMode: entitlementEvidenceExportDisputeLock.exportMode,
      finalPaidEvidenceExportAllowed: entitlementEvidenceExportDisputeLock.finalPaidEvidenceExportAllowed,
      rawPiiExportDenied: entitlementEvidenceExportDisputeLock.rawPiiExportDenied,
      publicArtifactUrlDenied: entitlementEvidenceExportDisputeLock.publicArtifactUrlDenied,
      evidenceExportLedgerKey: entitlementEvidenceExportDisputeLock.evidenceExportLedgerKey,
      blockers: entitlementEvidenceExportDisputeLock.blockers,
      surfaceEvidenceBindings: entitlementEvidenceExportDisputeLock.surfaceEvidenceBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement evidence export dispute lock failed" },
      { status: 502 },
    );
  }
}
