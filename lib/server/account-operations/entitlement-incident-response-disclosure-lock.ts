import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildPass2500EntitlementIncidentResponseDisclosureLock } from "@/lib/market-integrity/entitlement-incident-response-disclosure-lock";
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
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "entitlement-incident-response-disclosure-lock", limit: 14, windowMs: 60_000 });
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
    const incidentRequest = {
      retentionLedgerKey: param(searchParams, "retentionLedgerKey", 280),
      incidentCaseId: param(searchParams, "incidentCaseId", 180),
      incidentSeverity: param(searchParams, "incidentSeverity", 80),
      activeIncidentSignal: param(searchParams, "activeIncidentSignal", 80),
      incidentTriageFingerprint: param(searchParams, "incidentTriageFingerprint", 260),
      containmentFingerprint: param(searchParams, "containmentFingerprint", 260),
      customerNoticeId: param(searchParams, "customerNoticeId", 180),
      operatorAckFingerprint: param(searchParams, "operatorAckFingerprint", 260),
      postIncidentReviewExpiry: param(searchParams, "postIncidentReviewExpiry", 80),
      affectedArtifactHash: param(searchParams, "affectedArtifactHash", 260),
      forensicExportMode: param(searchParams, "forensicExportMode", 80),
      requestSurface: param(searchParams, "requestSurface", 80),
      locale: param(searchParams, "locale", 8),
    };
    const entitlementIncidentResponseDisclosureLock = buildPass2500EntitlementIncidentResponseDisclosureLock({
      query,
      symbol: sourceSync.symbol,
      pass2499: sourceSync.pass2499,
      incidentRequest,
    });

    return securityJson({
      mode: "entitlement_incident_response_disclosure_lock",
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      entitlementIncidentResponseDisclosureLock,
      pass2500: entitlementIncidentResponseDisclosureLock,
      sourceSyncPass2500: sourceSync.pass2500,
      linkedPass2499: sourceSync.pass2499,
      state: entitlementIncidentResponseDisclosureLock.state,
      incidentMode: entitlementIncidentResponseDisclosureLock.incidentMode,
      finalPaidIncidentResponseAllowed: entitlementIncidentResponseDisclosureLock.finalPaidIncidentResponseAllowed,
      incidentLedgerKey: entitlementIncidentResponseDisclosureLock.incidentLedgerKey,
      disclosureLedgerKey: entitlementIncidentResponseDisclosureLock.disclosureLedgerKey,
      silentIncidentRecoveryDenied: entitlementIncidentResponseDisclosureLock.silentIncidentRecoveryDenied,
      rawForensicExportDenied: entitlementIncidentResponseDisclosureLock.rawForensicExportDenied,
      publicIncidentArchiveDenied: entitlementIncidentResponseDisclosureLock.publicIncidentArchiveDenied,
      blockers: entitlementIncidentResponseDisclosureLock.blockers,
      surfaceIncidentBindings: entitlementIncidentResponseDisclosureLock.surfaceIncidentBindings,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return securityJson(
      { mode: "error", error: error instanceof Error ? error.message : "Entitlement incident response disclosure lock failed" },
      { status: 502 },
    );
  }
}
