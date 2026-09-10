import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildShieldChatResponse } from "@/lib/market-integrity/shield-chat";
import { buildVlmShieldInvestigator } from "@/lib/market-integrity/shield-investigator";
import { buildEvidenceReportDraft } from "@/lib/market-integrity/evidence-report";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { buildPass426AngelResponse } from "@/lib/market-integrity/angel-provider-gateway";
import {
  abuseShieldResponseHeaders,
  applyApiAbuseShield,
} from "@/lib/security/api-abuse-shield";
import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
} from "@/lib/security/durable-rate-limit";
import { getClientKey } from "@/lib/security/api-guard";
import { buildPass632Boundary } from "@/lib/security/production-rate-limit-adapter";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

type ErrorPayload = { mode: "error"; error: string };

async function handleMarketIntegrityChatGet(request: Request) {
  const { searchParams } = new URL(request.url);
  const abuseShield = await applyApiAbuseShield(request, "analyze", {
    keyPrefix: "market-integrity-chat",
    providerId: "market-integrity-analysis",
    queryParam: "query",
  });
  if (!abuseShield.ok) return abuseShield.response;

  const query = abuseShield.query?.trim();
  const prompt = searchParams.get("prompt")?.trim().slice(0, 600) || "Explain the current risk.";
  const localeCandidate = searchParams.get("locale")?.trim() || "pl";
  const locale = localeCandidate === "de" || localeCandidate === "en" ? localeCandidate : "pl";
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  const account = await resolveRequestAccount(request);
  const costBoundary = buildPass632Boundary({
    route: new URL(request.url).pathname,
    provider: "coingecko-dexscreener-angel",
    user: account?.accountId ?? "anonymous",
    client: getClientKey(request, "market-chat-client"),
  });
  const providerBudget = await applyDurableRateLimit({
    namespace: "velmere-market-chat-provider-cost",
    key: costBoundary.key,
    limit: 60,
    windowMs: 60_000,
    cost: 4,
  });
  if (!providerBudget.ok) {
    const unavailable = providerBudget.mode === "unavailable" || providerBudget.reason === "rate_limit_store_unavailable";
    return NextResponse.json({
      mode: "error",
      error: unavailable ? "provider_cost_budget_unavailable" : "provider_cost_budget_exhausted",
      retryAfterSeconds: providerBudget.retryAfterSeconds,
    }, {
      status: unavailable ? 503 : 429,
      headers: buildDurableRateLimitHeaders(providerBudget),
    });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (publication.evidenceState !== "verified") {
      const withheld = NextResponse.json({
        mode: "withheld",
        answer: null,
        angel: null,
        result,
        publication,
        blocker: "verified_signed_fresh_quorum_market_evidence_required",
        generatedAt,
      }, { status: 424 });
      for (const headers of [
        abuseShieldResponseHeaders(abuseShield),
        buildDurableRateLimitHeaders(providerBudget),
      ]) {
        for (const [name, value] of new Headers(headers)) withheld.headers.set(name, value);
      }
      withheld.headers.set("cache-control", "private, no-store");
      return withheld;
    }
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id, 144);
    const answer = buildShieldChatResponse(result, history, prompt, locale);
    const brain = buildRiskBrain(result, history);
    const angel = await buildPass426AngelResponse({ result, brain: brain.pass422, deterministic: answer, prompt, locale });
    const investigator = buildVlmShieldInvestigator(result);
    const evidenceReport = buildEvidenceReportDraft(result, investigator);

    const response = NextResponse.json({
      mode: publication.mode,
      publication,
      answer,
      angel,
      pass426: angel,
      pass427: brain.pass427,
        pass428: brain.pass428,
        pass429: brain.pass429,
        pass430: brain.pass430,
        pass431: brain.pass431,
        pass432: brain.pass432,
        pass433: brain.pass433,
        pass434: brain.pass434,
        pass435: brain.pass435,
        pass436: brain.pass436,
        pass437: brain.pass437,
        pass438: brain.pass438,
        pass439: brain.pass439,
        pass440: brain.pass440,
        pass441: brain.pass441,
        pass442: brain.pass442,
      brain,
      investigator,
      evidenceReport,
      result,
      generatedAt,
    });
    for (const headers of [
      abuseShieldResponseHeaders(abuseShield),
      buildDurableRateLimitHeaders(providerBudget),
    ]) {
      for (const [name, value] of new Headers(headers)) response.headers.set(name, value);
    }
    response.headers.set("cache-control", "private, no-store");
    return response;
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/chat", code: "shield_chat_request_failed", status: 502 });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "market_chat_get", () => handleMarketIntegrityChatGet(request));
}
