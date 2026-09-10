import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildAiRiskBotBrief } from "@/lib/market-integrity/ai-risk-bot";
import { buildVlmShieldInvestigator } from "@/lib/market-integrity/shield-investigator";
import { buildEvidenceReportDraft } from "@/lib/market-integrity/evidence-report";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import { inspectVlmText } from "@/lib/ai/vlm-security";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";
import { applyApiRateLimit, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";

type ErrorPayload = { mode: "error"; error: string };

async function handleAssistantGet(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "market-integrity-assistant-get",
    limit: 24,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const queryInspection = inspectVlmText(searchParams.get("query"), 180);
  recordVlmSecurityInspection({
    inspection: queryInspection,
    vector: "input",
    route: "/api/market-integrity/assistant",
    request,
  });
  if (!queryInspection.safe) {
    return securityJson({ mode: "error", error: "security_policy" }, { status: 400 });
  }
  const query = queryInspection.normalized.slice(0, 180);
  if (!query) {
    return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (publication.evidenceState !== "verified") {
      return securityJson({
        mode: "withheld",
        publication,
        assistant: null,
        investigator: null,
        evidenceReport: null,
        result: null,
        blocker: "verified_signed_fresh_quorum_market_evidence_required",
        generatedAt,
      }, { status: 424 });
    }
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 144);
    const assistant = buildAiRiskBotBrief(result, history);
    const investigator = buildVlmShieldInvestigator(result);
    const evidenceReport = buildEvidenceReportDraft(result, investigator);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      assistant,
      investigator,
      evidenceReport,
      result,
      generatedAt,
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/assistant", code: "ai_risk_bot_request_failed", status: 502 });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "legacy_assistant_get", () => handleAssistantGet(request));
}
