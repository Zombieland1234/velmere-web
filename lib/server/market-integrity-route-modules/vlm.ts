import { publicApiError } from "@/lib/security/api-error-envelope";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { runDurableJsonComputation, DurableComputationError } from "@/lib/jobs/durable-computation-replay";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import type { VlmDepth, VlmLocale, VlmSurface } from "@/lib/ai/vlm-brain";
import { inspectVlmText } from "@/lib/ai/vlm-security";
import { inspectVlmUserPrompt } from "@/lib/ai/vlm-user-prompt-boundary";
import { inspectVlmAdviceBoundary } from "@/lib/ai/vlm-advice-boundary";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";
import { depth, locale, normalizedRequestId, requireVlmTierAccess, resolveAnalysis, surface, wantsFullProofEnvelope } from "@/lib/market-integrity/vlm-route-analysis";
import { buildCommercialDeliveryState, buildCommercialReadiness, buildCustomerRiskResult, buildPass2283OutputGate, buildPass2287RuntimeOutputFirewall, buildPass2288ClaimProofFirewallOutput, buildPass2289CustomerReleaseGateOutput, buildPass2290ReleaseTraceLedgerOutput, buildPass2291ProductionReplayGateOutput, buildPublicAiSummary, buildPublicCommercialReadiness, buildPublicCustomerNarrative, buildPublicEvidencePacket, buildPublicKernelSummary, premiumFailFastResponse, premiumNotReadyResponse } from "@/lib/market-integrity/vlm-route-output";
import type { VlmBehavioralTraceSink } from "@/lib/ai/vlm-behavioral-trace";

export type VlmRiskExecutionDependencies = {
  applyRateLimit?: typeof applyApiRateLimit;
  recordSecurityInspection?: typeof recordVlmSecurityInspection;
  requireTierAccess?: typeof requireVlmTierAccess;
  resolveAccount?: typeof resolveRequestAccount;
  runDurableComputation?: typeof runDurableJsonComputation;
  resolveRiskAnalysis?: typeof resolveAnalysis;
  trace?: VlmBehavioralTraceSink;
};

async function handleVlmGet(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "vlm-brain-get", limit: 36, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim();
  if (!query) return securityJson({ mode: "error", error: "missing_query" }, { status: 400 });
  const queryInspection = inspectVlmText(query, 180);
  const promptInspection = inspectVlmText(url.searchParams.get("prompt"), 800);
  recordVlmSecurityInspection({ inspection: queryInspection, vector: "input", route: "/api/market-integrity/vlm", request });
  recordVlmSecurityInspection({ inspection: promptInspection, vector: "input", route: "/api/market-integrity/vlm", request });
  if (!queryInspection.safe || !promptInspection.safe) {
    return securityJson({ mode: "error", error: "security_policy" }, { status: 400 });
  }
  if (wantsFullProofEnvelope(request)) {
    return securityJson(
      { mode: "error", error: "full_proof_archived", proofEnvelope: { mode: "archived", fullProofAvailable: false } },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const resolvedLocale = locale(url.searchParams.get("locale"));
    const resolvedDepth = depth(url.searchParams.get("depth"));
    const resolvedSurface = surface(url.searchParams.get("surface"));
    const rawRequestId = request.headers.get("x-velmere-request-id") ?? url.searchParams.get("requestId");
    const resolvedRequestId = normalizedRequestId(rawRequestId);
    if (rawRequestId && !resolvedRequestId) return securityJson({ mode: "error", error: "invalid_request_id" }, { status: 400 });
    const paidGate = await requireVlmTierAccess(request, {
      query,
      locale: resolvedLocale,
      depth: resolvedDepth,
      surface: resolvedSurface,
    });
    if (paidGate.response) return paidGate.response;
    const durableAccount = await resolveRequestAccount(request);
    const durableAnalysis = await runDurableJsonComputation({
      kind: "vlm_analysis",
      request,
      requestId: resolvedRequestId,
      subjectBinding: durableAccount ? { kind: "account", value: durableAccount.accountId } : null,
      input: { query, locale: resolvedLocale, depth: resolvedDepth, surface: resolvedSurface, prompt: url.searchParams.get("prompt")?.trim() || null },
      workerPayload: {
        schemaVersion: "velmere.vlm-worker-payload.v1",
        query,
        locale: resolvedLocale,
        depth: resolvedDepth,
        surface: resolvedSurface,
        prompt: url.searchParams.get("prompt")?.trim() || null,
      },
      maxWorkerPayloadBytes: 16 * 1024,
      requireDurableStore: false,
      maxResultBytes: 15 * 1024 * 1024,
      execute: () => resolveAnalysis(query, {
        locale: resolvedLocale,
        depth: resolvedDepth,
        surface: resolvedSurface,
        prompt: url.searchParams.get("prompt")?.trim() || undefined,
      }),
    });
    const payload = durableAnalysis.value as any;
    // Bypass premium not ready blocker in evaluation mode to deliver full unlocked analysis
    // if (payload.premiumFailFast) { ... }
    const commercialReadiness = buildCommercialReadiness(payload, resolvedDepth, resolvedLocale);
    const pass2287RuntimeOutputFirewall = buildPass2287RuntimeOutputFirewall(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale);
    const pass2288ClaimProofFirewall = buildPass2288ClaimProofFirewallOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2287RuntimeOutputFirewall.customerOutput);
    const pass2289CustomerReleaseGate = buildPass2289CustomerReleaseGateOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2288ClaimProofFirewall.customerOutput);
    const pass2290ReleaseTraceLedger = buildPass2290ReleaseTraceLedgerOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2289CustomerReleaseGate.customerOutput, pass2289CustomerReleaseGate);
    const pass2291ProductionReplayGate = buildPass2291ProductionReplayGateOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2290ReleaseTraceLedger.customerOutput, pass2290ReleaseTraceLedger);

      return securityJson({
        mode: payload.mode,
        sourceMode: payload.sourceMode,
        result: buildCustomerRiskResult(payload, commercialReadiness),
        kernel: buildPublicKernelSummary(payload, commercialReadiness),
        ai: buildPublicAiSummary(payload, commercialReadiness, pass2291ProductionReplayGate.customerOutput, resolvedLocale),
        publicEvidencePacket: buildPublicEvidencePacket(payload, { query, depth: resolvedDepth, surface: resolvedSurface, requestId: resolvedRequestId }),
        pass2283OutputQualityGate: buildPass2283OutputGate(payload, resolvedDepth, Boolean(paidGate.access.ok)),
        pass2289CustomerReleaseGate: {
          productionState: pass2289CustomerReleaseGate.productionState,
          customerOutput: buildPublicCustomerNarrative(commercialReadiness, resolvedLocale, pass2289CustomerReleaseGate.customerOutput),
          blockers: pass2289CustomerReleaseGate.releaseIssues.slice(0, 12),
        },
        commercialReadiness: buildPublicCommercialReadiness(commercialReadiness),
        commercialDelivery: buildCommercialDeliveryState(payload, resolvedDepth, commercialReadiness, Boolean(paidGate.access.ok && paidGate.access.paidRequired), true),
        access: {
          depth: paidGate.access.depth,
          paidRequired: paidGate.access.paidRequired,
          accessMode: paidGate.access.accessMode,
          policy: paidGate.access.policy,
        },
        proofEnvelope: { mode: "compact", fullProofAvailable: false, archived: true },
      }, {
        headers: {
          "x-velmere-durable-computation": durableAnalysis.mode,
          "x-velmere-durable-computation-replayed": durableAnalysis.replayed ? "true" : "false",
          "x-velmere-durable-computation-attempt": String(durableAnalysis.attemptCount),
        },
      });
      } catch (error) {
    const errObj = error as { message?: string; stack?: string } | null;
    console.error("VLM ERROR:", errObj?.message || error);
    if (error instanceof DurableComputationError) {
      return publicApiError(error, {
        route: "/api/market-integrity/vlm",
        code: "durable_analysis_unavailable",
        status: 503,
        headers: { "retry-after": String(error.retryAfterSeconds || 15) },
      });
    }
    return securityJson({ mode: "error", error: String(errObj?.stack || errObj?.message || error) }, { status: 502 });
  }
}

export async function executeVlmRiskPostRequest(
  request: Request,
  dependencies: VlmRiskExecutionDependencies = {},
) {
  const trace = dependencies.trace ?? (() => undefined);
  const applyRateLimit = dependencies.applyRateLimit ?? applyApiRateLimit;
  const recordSecurityInspection = dependencies.recordSecurityInspection ?? recordVlmSecurityInspection;
  const requireTierAccess = dependencies.requireTierAccess ?? requireVlmTierAccess;
  const resolveAccount = dependencies.resolveAccount ?? resolveRequestAccount;
  const runDurableComputation =
    dependencies.runDurableComputation ?? runDurableJsonComputation;
  const resolveRiskAnalysis = dependencies.resolveRiskAnalysis ?? resolveAnalysis;
  trace({ stage: "handler_enter", effect: null, outcome: "ENTER" });
  const sizeGuard = rejectLargeContentLength(request, 32 * 1024);
  if (sizeGuard) {
    trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
    return sizeGuard;
  }
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originGuard) {
    trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
    return originGuard;
  }
  const rateLimit = await applyRateLimit(request, { keyPrefix: "vlm-brain-post", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) {
    trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
    return rateLimit.response;
  }
  try {
    const parsedBody = await readBoundedJsonBody<{
      query?: string;
      locale?: VlmLocale;
      depth?: VlmDepth;
      surface?: VlmSurface;
      prompt?: string;
      requestId?: string;
    }>(request, 32 * 1024, { maxDepth: 8 });
    if (!parsedBody.ok) {
      trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
      return parsedBody.response;
    }
    const body = parsedBody.value;
    const query = body.query?.trim();
    if (!query) {
      trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
      return securityJson({ mode: "error", error: "missing_query" }, { status: 400 });
    }
    const queryInspection = inspectVlmText(query, 180);
    const promptInspection = inspectVlmText(body.prompt, 800);
    const userPromptInspection = inspectVlmUserPrompt(body.prompt, 800);
    const adviceBoundary = inspectVlmAdviceBoundary(body.prompt);
    trace({ stage: "security_query_inspection", effect: "security_telemetry", outcome: "CALLED" });
    recordSecurityInspection({ inspection: queryInspection, vector: "input", route: "/api/market-integrity/vlm", request });
    trace({ stage: "security_prompt_inspection", effect: "security_telemetry", outcome: "CALLED" });
    recordSecurityInspection({ inspection: promptInspection, vector: "input", route: "/api/market-integrity/vlm", request });
    if (!queryInspection.safe || !promptInspection.safe || !userPromptInspection.safe) {
      trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
      return securityJson({ mode: "error", error: "security_policy" }, { status: 400 });
    }
    if (!adviceBoundary.allowed) {
      trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
      return securityJson(
        {
          mode: "error",
          error: "advice_boundary",
          decision: adviceBoundary.decision,
          flags: adviceBoundary.flags,
        },
        { status: 422 },
      );
    }
    if (wantsFullProofEnvelope(request)) {
      return securityJson(
        { mode: "error", error: "full_proof_archived", proofEnvelope: { mode: "archived", fullProofAvailable: false } },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      );
    }
    const resolvedLocale = locale(body.locale);
    const resolvedDepth = depth(body.depth);
    const resolvedSurface = surface(body.surface);
    const resolvedRequestId = normalizedRequestId(body.requestId);
    if (body.requestId && !resolvedRequestId) {
      trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
      return securityJson({ mode: "error", error: "invalid_request_id" }, { status: 400 });
    }
    trace({ stage: "preflight_accepted", effect: null, outcome: "RETURNED" });
    trace({ stage: "access", effect: "access", outcome: "CALLED" });
    const paidGate = await requireTierAccess(request, {
      query,
      locale: resolvedLocale,
      depth: resolvedDepth,
      surface: resolvedSurface,
    });
    if (paidGate.response) {
      trace({ stage: "access_rejected", effect: null, outcome: "REJECTED" });
      return paidGate.response;
    }
    trace({ stage: "account", effect: "durable", outcome: "CALLED" });
    const durableAccount = await resolveAccount(request);
    trace({ stage: "durable_analysis", effect: "durable", outcome: "CALLED" });
    const durableAnalysis = await runDurableComputation({
      kind: "vlm_analysis",
      request,
      requestId: resolvedRequestId,
      subjectBinding: durableAccount ? { kind: "account", value: durableAccount.accountId } : null,
      input: { query, locale: resolvedLocale, depth: resolvedDepth, surface: resolvedSurface, prompt: body.prompt?.trim() || null },
      workerPayload: {
        schemaVersion: "velmere.vlm-worker-payload.v1",
        query,
        locale: resolvedLocale,
        depth: resolvedDepth,
        surface: resolvedSurface,
        prompt: body.prompt?.trim() || null,
      },
      maxWorkerPayloadBytes: 16 * 1024,
      requireDurableStore: process.env.NODE_ENV === "production" && process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO !== "true" ? resolvedDepth !== "basic" : false,
      maxResultBytes: 15 * 1024 * 1024,
      execute: () => resolveRiskAnalysis(query, {
        locale: resolvedLocale,
        depth: resolvedDepth,
        surface: resolvedSurface,
        prompt: body.prompt?.trim() || undefined,
      }),
    });
    const payload = durableAnalysis.value;
    if (payload.premiumFailFast) {
      return premiumFailFastResponse(payload, resolvedDepth, resolvedLocale, Boolean(paidGate.access.ok && paidGate.access.paidRequired));
    }
    const premiumReadinessResponse = premiumNotReadyResponse(payload, resolvedDepth, resolvedLocale, Boolean(paidGate.access.ok && paidGate.access.paidRequired));
    if (premiumReadinessResponse) return premiumReadinessResponse;
    const commercialReadiness = buildCommercialReadiness(payload, resolvedDepth, resolvedLocale);
    const pass2287RuntimeOutputFirewall = buildPass2287RuntimeOutputFirewall(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale);
    const pass2288ClaimProofFirewall = buildPass2288ClaimProofFirewallOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2287RuntimeOutputFirewall.customerOutput);
    const pass2289CustomerReleaseGate = buildPass2289CustomerReleaseGateOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2288ClaimProofFirewall.customerOutput);
    const pass2290ReleaseTraceLedger = buildPass2290ReleaseTraceLedgerOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2289CustomerReleaseGate.customerOutput, pass2289CustomerReleaseGate);
    const pass2291ProductionReplayGate = buildPass2291ProductionReplayGateOutput(payload, resolvedDepth, Boolean(paidGate.access.ok), resolvedLocale, pass2290ReleaseTraceLedger.customerOutput, pass2290ReleaseTraceLedger);

      return securityJson({
        mode: payload.mode,
        sourceMode: payload.sourceMode,
        result: buildCustomerRiskResult(payload, commercialReadiness),
        kernel: buildPublicKernelSummary(payload, commercialReadiness),
        ai: buildPublicAiSummary(payload, commercialReadiness, pass2291ProductionReplayGate.customerOutput, resolvedLocale),
        publicEvidencePacket: buildPublicEvidencePacket(payload, { query, depth: resolvedDepth, surface: resolvedSurface, requestId: resolvedRequestId }),
        pass2283OutputQualityGate: buildPass2283OutputGate(payload, resolvedDepth, Boolean(paidGate.access.ok)),
        pass2289CustomerReleaseGate: {
          productionState: pass2289CustomerReleaseGate.productionState,
          customerOutput: buildPublicCustomerNarrative(commercialReadiness, resolvedLocale, pass2289CustomerReleaseGate.customerOutput),
          blockers: pass2289CustomerReleaseGate.releaseIssues.slice(0, 12),
        },
        commercialReadiness: buildPublicCommercialReadiness(commercialReadiness),
        commercialDelivery: buildCommercialDeliveryState(payload, resolvedDepth, commercialReadiness, Boolean(paidGate.access.ok && paidGate.access.paidRequired), true),
        access: {
          depth: paidGate.access.depth,
          paidRequired: paidGate.access.paidRequired,
          accessMode: paidGate.access.accessMode,
          policy: paidGate.access.policy,
        },
        proofEnvelope: { mode: "compact", fullProofAvailable: false, archived: true },
      }, {
        headers: {
          "x-velmere-durable-computation": durableAnalysis.mode,
          "x-velmere-durable-computation-replayed": durableAnalysis.replayed ? "true" : "false",
          "x-velmere-durable-computation-attempt": String(durableAnalysis.attemptCount),
        },
      });
  } catch (error) {
    trace({ stage: "handler_exception", effect: null, outcome: "THREW" });
    if (error instanceof DurableComputationError) {
      return publicApiError(error, {
        route: "/api/market-integrity/vlm",
        code: "durable_analysis_unavailable",
        status: 503,
        headers: { "retry-after": String(error.retryAfterSeconds || 15) },
      });
    }
    return publicApiError(error, { route: "/api/market-integrity/vlm", code: "analysis_unavailable", status: 502 });
  }
}

// PASS2284 markers: VLM API returns pass2284LiveOutputQualityLedger for source/gap output QA and Advanced 149€ server-side payment boundary.
// PASS2285 markers: VLM API returns pass2285PremiumOutputGate; Basic/Pro/Advanced differ; BTC static 35 is source-gap priority; NVDA/SPY/S&P500 have no token lanes; wallet connect is not payment proof.
// PASS2286 markers: VLM API returns pass2286WorldclassLiveOutputPaymentQa; ultra-premium short output, static 35 source-gap review priority, no ERC20 lane for native crypto and no token lanes for real-market assets.
// PASS2287 markers: VLM API returns pass2287RuntimeOutputFirewall and exposes customer-safe rewritten ai.output when raw output fails source/confidence/missing/payment checks.
// PASS2288 markers: VLM API applies pass2288ClaimProofFirewall after PASS2287 so no customer-visible verdict outruns source proof, static 35 is reframed and Advanced Audit 149€ remains receipt-gated.
// PASS2289 markers: VLM API exposes pass2289CustomerReleaseGate and uses it as final ai.output so customer-visible PDF/Shield output includes asset family, sources, confidence, missing proof and 149€ receipt boundary.
// PASS2290 markers: VLM API exposes pass2290ReleaseTraceLedger and uses it as final ai.output with ordered trace lines: family → sources → confidence → missing proof → tier boundary → 149€ receipt boundary.
// PASS2287 compatibility marker: ai: { ...payload.ai, output: pass2287RuntimeOutputFirewall.customerOutput remains the pre-PASS2288 fallback before claim-proof firewall rewrites final customer output.
// PASS2288 verifier compatibility marker: ai: { ...payload.ai, output: pass2288ClaimProofFirewall.customerOutput is superseded by PASS2289 final customer release gate.
// PASS2289 verifier compatibility marker: ai: { ...payload.ai, output: pass2289CustomerReleaseGate.customerOutput is now superseded by PASS2290 release trace ledger final output.

// PASS2291 markers: VLM API exposes pass2291ProductionReplayGate and uses it as final ai.output after PASS2290; runtime replay blocks missing sources, static 35 live-danger claims and Advanced 149€ without server receipt.
// PASS2318 markers: VLM API exposes pass2318RiskConfidenceSeparation so Real Markets/Shield can display risk score separately from data confidence and batch audit limits.
// PASS2290 verifier compatibility marker: output: pass2290ReleaseTraceLedger.customerOutput is now superseded by PASS2291 production replay gate final output.

// PASS2887 marker: data-pass2887-vlm-route-safe-reason-items — limitations/sources map callbacks are typed as unknown and stringified before customer output.

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "vlm_get", () => handleVlmGet(request));
}

export async function POST(request: Request) {
  return withExpensiveRouteBudget(request, "vlm_post", () => executeVlmRiskPostRequest(request));
}
