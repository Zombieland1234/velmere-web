import { publicApiError } from "@/lib/security/api-error-envelope";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { buildShieldChatResponse } from "@/lib/market-integrity/shield-chat";
import { generateVlmBrainAnalysis } from "@/lib/ai/vlm-brain";
import { buildPublicVlmEvidencePacket } from "@/lib/ai/vlm-public-evidence-packet";
import { buildPass2284AngelDirective, buildPass2284LiveOutputQualityLedger } from "@/lib/ai/live-output-quality-ledger";
import { buildPass2285AngelDirective, buildPass2285PremiumOutputGate } from "@/lib/ai/premium-output-gate";
import { buildPass2286AngelDirective, buildPass2286WorldclassLiveOutputPaymentQa } from "@/lib/ai/worldclass-live-output-payment-qa";
import { applyPass2287RuntimeOutputFirewall, buildPass2287AngelDirective } from "@/lib/ai/runtime-output-firewall";
import { buildVlmEntitlementPromptPolicy, applyVlmBrainOutputEntitlementFirewall } from "@/lib/ai/vlm-entitlement-output-firewall";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";
import { evaluateVlmRoutePreflight } from "@/lib/ai/vlm-route-preflight";
import type { VlmBehavioralTraceSink } from "@/lib/ai/vlm-behavioral-trace";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

const PASS2223_MARKET_ANGEL_ADVANCED_GATE = "pass2223-market-angel-advanced-server-side-gate" as const;

export type AngelPostBody = {
  query?: string;
  prompt?: string;
  locale?: "pl" | "en" | "de";
  depth?: "basic" | "pro" | "advanced";
};

export type AngelMarketResolver = (query: string) => Promise<TokenRiskResult>;
export type AngelExecutionDependencies = {
  /** Legacy injection point retained for tests; direct Angel never calls a paid-access resolver. */
  resolveAccess?: typeof import("@/lib/commerce/vlm-paid-surface-guard").resolveVlmPaidSurfaceAccess;
  readHistory?: typeof getPersistentRiskHistory;
  generateAnalysis?: typeof generateVlmBrainAnalysis;
  buildEvidencePacket?: typeof buildPublicVlmEvidencePacket;
  recordSecurityInspection?: typeof recordVlmSecurityInspection;
  trace?: VlmBehavioralTraceSink;
};

const defaultAngelMarketResolver: AngelMarketResolver = async (query) => {
  const marketRow = await searchCoinGeckoMarket(query);
  return marketRow?.result ?? await analyzeDexScreenerToken(query);
};

function angelOutputText(output: { headline?: string; summary?: string; report?: { conclusion?: string } } | string | null | undefined): string {
  if (typeof output === "string") return output;
  const text = [output?.headline, output?.summary, output?.report?.conclusion]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return text || "Velmère Angel evidence-bound response unavailable.";
}

export async function resolveAngelRequest(
  request: Request,
  body?: AngelPostBody | null,
  resolveMarketResult: AngelMarketResolver = defaultAngelMarketResolver,
  dependencies: AngelExecutionDependencies = {},
) {
  const trace = dependencies.trace ?? (() => undefined);
  const recordSecurityInspection = dependencies.recordSecurityInspection ?? recordVlmSecurityInspection;
  trace({ stage: "handler_enter", effect: null, outcome: "ENTER" });
  const preflight = evaluateVlmRoutePreflight({
    request,
    body: body as Record<string, unknown> | null | undefined,
    defaultLocale: "pl",
    defaultDepth: "basic",
    defaultPrompt: "Explain the current risk.",
    queryRequired: true,
    onInspection: ({ queryInspection, promptInspection }) => {
      trace({ stage: "security_query_inspection", effect: "security_telemetry", outcome: "CALLED" });
      recordSecurityInspection({ inspection: queryInspection, vector: "input", route: "/api/market-integrity/angel", request });
      trace({ stage: "security_prompt_inspection", effect: "security_telemetry", outcome: "CALLED" });
      recordSecurityInspection({ inspection: promptInspection, vector: "input", route: "/api/market-integrity/angel", request });
    },
  });
  if (!preflight.ok) {
    trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
    return preflight.response;
  }
  trace({ stage: "preflight_accepted", effect: null, outcome: "RETURNED" });
  const { query, prompt: normalizedPrompt, locale, depth: clientRequestedDepth, adviceBoundary } = preflight.value;
  const prompt = normalizedPrompt ?? "Explain the current risk.";
  const rightsPreflight = buildShieldBasicDeliveryPreflight("angel");
  if (!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) {
    trace({ stage: "rights_preflight_rejected", effect: null, outcome: "REJECTED" });
    const projected = projectShieldBasicCustomerDelivery({
      decision: rightsPreflight,
      payload: null,
      status: 503,
    });
    return securityJson(projected.payload, { status: projected.status });
  }
  // R44P44: Angel is standalone. Client-supplied Basic/Pro/Advanced is an ignored compatibility hint.
  const requestedDepth = "basic" as const;
  const allowedDepth = "basic" as const;
  const accessMode = "free_basic" as const;
  const readHistory = dependencies.readHistory ?? getPersistentRiskHistory;
  const generateAnalysis = dependencies.generateAnalysis ?? generateVlmBrainAnalysis;
  const buildEvidencePacket = dependencies.buildEvidencePacket ?? buildPublicVlmEvidencePacket;

  trace({ stage: "access_standalone_free", effect: null, outcome: "RETURNED" });
  const entitlementPolicy = buildVlmEntitlementPromptPolicy({
    locale,
    surface: "angel",
    requestedDepth,
    accessMode,
    paidAccessVerified: false,
  });

  trace({ stage: "market_resolver", effect: "market_provider", outcome: "CALLED" });
  const result = await resolveMarketResult(query);
  const generatedAt = new Date().toISOString();
  const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
  if (publication.evidenceState !== "verified") {
    trace({ stage: "publication_withheld", effect: null, outcome: "REJECTED" });
    return securityJson(
      {
        mode: "withheld",
        persona: "Velmère Angel",
        angel: null,
        vlm: null,
        result,
        publication,
        entitlement: {
          requestedDepth: clientRequestedDepth,
          allowedDepth,
          advancedUnlocked: false,
          redacted: false,
          accessMode,
        },
        blocker: "verified_signed_fresh_quorum_market_evidence_required",
        generatedAt,
      },
      { status: 424 },
    );
  }
  const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
  trace({ stage: "read_history", effect: "durable", outcome: "CALLED" });
  const history = await readHistory(id);
  const brain = buildRiskBrain(result, history);
  const evidenceRules = [
    "EVIDENCE_RULES: do not claim orderbook depth, spread, slippage, holder concentration, supply, contract/admin or cross-venue confirmation unless the provided facts explicitly include that lane.",
    "If a lane is missing, say it is missing and cap confidence instead of producing a stronger narrative.",
    "Basic/Pro/Advanced differ by proof depth: Basic identity/price/risk/source gaps, Pro feed/trend/second-source checks, Advanced locked lanes only when proof exists.",
    "No ROI, price promises or investment recommendations.",
    buildPass2284AngelDirective(locale),
    buildPass2285AngelDirective(locale),
    buildPass2286AngelDirective(locale),
    buildPass2287AngelDirective(locale),
  ].join("\n");
  const safePrompt = `${entitlementPolicy}\n${evidenceRules}\n\nUSER_PROMPT=${prompt}`;
  const deterministic = buildShieldChatResponse(result, history, prompt, locale);
  trace({ stage: "model", effect: "model", outcome: "CALLED" });
  const rawVlm = await generateAnalysis({ result, brain, prompt: safePrompt, locale, depth: allowedDepth, surface: "angel" });
  const firewall = applyVlmBrainOutputEntitlementFirewall({
    locale,
    surface: "angel",
    requestedDepth,
    accessMode,
    paidAccessVerified: false,
    output: rawVlm.output,
  });
  const vlm = { ...rawVlm, output: firewall.output, entitlementFirewall: firewall.decision, entitlementRedacted: firewall.redacted };
  const vlmCustomerOutputText = angelOutputText(vlm.output);
  trace({ stage: "evidence_packet", effect: "tool", outcome: "CALLED" });
  const publicEvidencePacket = buildEvidencePacket(rawVlm);
  const pass2284LiveOutputQualityLedger = buildPass2284LiveOutputQualityLedger({
    surface: "angel",
    depth: allowedDepth,
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${query}`,
    confirmedSources: publicEvidencePacket.providers,
    missingLanes: publicEvidencePacket.missingData,
    rawScore: result.score,
    confidenceCap: publicEvidencePacket.confidenceCap,
    paidAccessVerified: false,
    customerOutputText: vlmCustomerOutputText,
  });
  const pass2285PremiumOutputGate = buildPass2285PremiumOutputGate({
    surface: "angel",
    depth: allowedDepth,
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${query}`,
    confirmedSources: publicEvidencePacket.providers,
    missingLanes: publicEvidencePacket.missingData,
    rawScore: result.score,
    confidenceCap: publicEvidencePacket.confidenceCap,
    paidAccessVerified: false,
    customerOutputText: vlmCustomerOutputText,
  });
  const pass2286WorldclassLiveOutputPaymentQa = buildPass2286WorldclassLiveOutputPaymentQa({
    surface: "angel",
    depth: allowedDepth,
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${query}`,
    confirmedSources: publicEvidencePacket.providers,
    missingLanes: publicEvidencePacket.missingData,
    rawScore: result.score,
    confidenceCap: publicEvidencePacket.confidenceCap,
    paidAccessVerified: false,
    customerOutputText: vlmCustomerOutputText,
  });
  const pass2287RuntimeOutputFirewall = applyPass2287RuntimeOutputFirewall({
    locale,
    surface: "angel",
    depth: allowedDepth,
    assetText: `${result.token.symbol} ${result.token.name} ${result.token.assetClass ?? ""} ${query}`,
    confirmedSources: publicEvidencePacket.providers,
    missingLanes: publicEvidencePacket.missingData,
    rawScore: result.score,
    confidenceCap: publicEvidencePacket.confidenceCap,
    paidAccessVerified: false,
    customerOutputText: vlmCustomerOutputText,
  });
  const customerSafeVlm = {
    ...vlm,
    output: { ...vlm.output, summary: pass2287RuntimeOutputFirewall.customerOutput },
    customerOutputText: pass2287RuntimeOutputFirewall.customerOutput,
    pass2287RuntimeOutputFirewall,
  };

  const evidenceContext = {
    confidenceCap: publicEvidencePacket.confidenceCap,
    providers: publicEvidencePacket.providers,
    sourceHealth: publicEvidencePacket.sourceHealth,
    missingData: publicEvidencePacket.missingData.slice(0, 6),
    claimPolicy: publicEvidencePacket.claimPolicy,
  };

  return securityJson({
    mode: publication.mode,
    publication,
    persona: "Velmère Angel",
    angel: customerSafeVlm.customerOutputText,
    deterministicFallback: deterministic,
    vlm: customerSafeVlm,
    publicEvidencePacket,
    evidenceContext,
    adviceBoundary: { decision: adviceBoundary.decision, flags: adviceBoundary.flags },
    pass2284LiveOutputQualityLedger,
    pass2285PremiumOutputGate,
    pass2286WorldclassLiveOutputPaymentQa,
    pass2287RuntimeOutputFirewall,
    entitlement: { requestedDepth: clientRequestedDepth, allowedDepth: firewall.decision.allowedDepth, advancedUnlocked: false, redacted: firewall.redacted, accessMode, clientDepthIgnored: true },
    productTruth: {
      productId: "angel",
      productClass: "STANDALONE_PRODUCT",
      reportContextDepth: allowedDepth,
      clientRequestedDepthIgnored: clientRequestedDepth,
      directChatPaymentRequired: false,
      truthInvariantAcrossReportDepth: true,
    },
    pass2223: PASS2223_MARKET_ANGEL_ADVANCED_GATE,
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
    result,
    generatedAt,
  });
}

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "default", { keyPrefix: "market-angel", queryParam: "query", allowEmptyQuery: false });
  if (!shield.ok) return shield.response;
  try {
    const response = await resolveAngelRequest(request);
    const payload = await readJsonResponseBounded<Record<string, unknown>>(response, 256 * 1024);
    return securityJson({ ...payload, ...abuseShieldResponseMeta(shield) }, { status: response.status });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/angel", code: "angel_request_failed", status: 502 });
  }
}

export async function POST(request: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(request, 256 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: "pass2177-market-integrity-angel",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const shield = await applyApiAbuseShield(request, "default", { keyPrefix: "market-angel-write", allowEmptyQuery: true, allowedMethods: ["POST"] });
  if (!shield.ok) return shield.response;
  try {
    const parsedBody = await readBoundedJsonBody<AngelPostBody>(request, 64 * 1024, { maxDepth: 10 });
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.value;
    const response = await resolveAngelRequest(request, body);
    const payload = await readJsonResponseBounded<Record<string, unknown>>(response, 256 * 1024);
    return securityJson({ ...payload, ...abuseShieldResponseMeta(shield) }, { status: response.status });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/angel", code: "angel_request_failed", status: 502 });
  }
}

// PASS2284 markers: Angel response includes live output quality ledger, static-35 source-gap brake and 149€ server-side receipt boundary.
// PASS2285 markers: Angel response includes pass2285PremiumOutputGate, premium-minimal source/confidence/missing-first answer, Advanced Audit 149€ receipt boundary and wallet connect is not payment proof.
// PASS2286 markers: Angel response includes pass2286WorldclassLiveOutputPaymentQa, ultra-premium short output, static 35 source-gap review priority and server-side receipt boundary.
// PASS2287 markers: Angel response includes pass2287RuntimeOutputFirewall and customer-visible output is rewritten when source/confidence/missing/payment sections fail.
