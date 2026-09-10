import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2453ReportEvidenceCapsule } from "@/lib/market-integrity/report-evidence-capsule";
import { buildPass2454InstitutionalSourceRouter } from "@/lib/market-integrity/institutional-source-router";
import { buildPass2455UiProofStrip } from "@/lib/market-integrity/ui-proof-strip";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "report-evidence", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const localeCandidate = sanitizeBoundedParam(searchParams.get("locale"), { maxLength: 6, fallback: "pl" });
  const locale = localeCandidate === "en" || localeCandidate === "de" ? localeCandidate : "pl";

  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const reportEvidenceCapsule = sourceSync.pass2453 ?? buildPass2453ReportEvidenceCapsule({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      tierEvidence: sourceSync.pass2450,
      dataProvenance: sourceSync.pass2451,
      riskCalibration: sourceSync.pass2452,
    });
    const institutionalRouter = sourceSync.pass2454 ?? buildPass2454InstitutionalSourceRouter({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      reportEvidence: reportEvidenceCapsule,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });

    const uiProofStrip = sourceSync.pass2455 ?? buildPass2455UiProofStrip({
      query,
      symbol: sourceSync.symbol,
      sourceSync,
      institutionalRouter,
      reportEvidence: reportEvidenceCapsule,
      payloadFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
    });

    return securityJson({
      mode: sourceSync.mode,
      query,
      locale,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      canonicalEvidenceFingerprint: reportEvidenceCapsule.canonicalEvidenceFingerprint,
      reportEvidenceCapsule,
      institutionalRouter,
      uiProofStrip,
      runtimeParityQueue: sourceSync.pass2456,
      operatorActionQueue: sourceSync.pass2457,
      providerCloseoutRuntime: sourceSync.pass2458,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      reportSections: reportEvidenceCapsule.reportSections,
      surfaceContracts: reportEvidenceCapsule.surfaceContracts,
      pdfParityLock: reportEvidenceCapsule.pdfParityLock,
      noFillerReportGovernor: reportEvidenceCapsule.noFillerReportGovernor,
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2451: sourceSync.pass2451?.state,
        pass2452: sourceSync.pass2452?.state,
        pass2453: reportEvidenceCapsule.state,
        pass2454: institutionalRouter.state,
        pass2455: uiProofStrip.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        operatorQueueScore: sourceSync.pass2457?.score,
        reportScore: reportEvidenceCapsule.score,
        institutionalRouterScore: institutionalRouter.score,
        uiProofStripScore: uiProofStrip.score,
        calibratedRiskScore: sourceSync.pass2452?.calibratedRiskScore,
        confidenceCap: sourceSync.pass2452?.confidenceCap,
      },
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/report-evidence", code: "report_evidence_capsule_failed", status: 502 });
  }
}
