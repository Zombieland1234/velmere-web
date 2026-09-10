import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { recordSingleResult } from "@/lib/market-integrity/market-memory";
import { getPersistentRiskHistory, persistRiskSnapshots } from "@/lib/market-integrity/risk-ledger";
import { analyzeRiskWithVlmKernel, generateVlmBrainAnalysis } from "@/lib/ai/vlm-brain";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { buildPublicVlmEvidencePacket } from "@/lib/ai/vlm-public-evidence-packet";
import { applyVlmBrainOutputEntitlementFirewall } from "@/lib/ai/vlm-entitlement-output-firewall";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";
import { applyApiRateLimit, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { evaluateVlmRoutePreflight } from "@/lib/ai/vlm-route-preflight";
import type { VlmBehavioralTraceSink } from "@/lib/ai/vlm-behavioral-trace";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";

export type BrainMarketResolver = (query: string) => Promise<TokenRiskResult>;
export type BrainExecutionDependencies = {
  resolveAccess?: typeof resolveVlmPaidSurfaceAccess;
  recordResult?: typeof recordSingleResult;
  persistSnapshots?: typeof persistRiskSnapshots;
  readHistory?: typeof getPersistentRiskHistory;
  buildDefiLlama?: typeof buildDefiLlamaSnapshotForResult;
  analyzeKernel?: typeof analyzeRiskWithVlmKernel;
  generateAnalysis?: typeof generateVlmBrainAnalysis;
  buildEvidencePacket?: typeof buildPublicVlmEvidencePacket;
  recordSecurityInspection?: typeof recordVlmSecurityInspection;
  trace?: VlmBehavioralTraceSink;
};

const defaultBrainMarketResolver: BrainMarketResolver = async (query) => {
  const marketRow = await searchCoinGeckoMarket(query);
  return marketRow?.result ?? await analyzeDexScreenerToken(query);
};

export async function executeBrainRequest(
  request: Request,
  resolveMarketResult: BrainMarketResolver = defaultBrainMarketResolver,
  dependencies: BrainExecutionDependencies = {},
) {
  const trace = dependencies.trace ?? (() => undefined);
  const recordSecurityInspection = dependencies.recordSecurityInspection ?? recordVlmSecurityInspection;
  trace({ stage: "handler_enter", effect: null, outcome: "ENTER" });
  const preflight = evaluateVlmRoutePreflight({
    request,
    defaultLocale: "pl",
    defaultDepth: "basic",
    queryRequired: true,
    onInspection: ({ queryInspection, promptInspection }) => {
      trace({ stage: "security_query_inspection", effect: "security_telemetry", outcome: "CALLED" });
      recordSecurityInspection({ inspection: queryInspection, vector: "input", route: "/api/market-integrity/brain", request });
      trace({ stage: "security_prompt_inspection", effect: "security_telemetry", outcome: "CALLED" });
      recordSecurityInspection({ inspection: promptInspection, vector: "input", route: "/api/market-integrity/brain", request });
    },
  });
  if (!preflight.ok) {
    trace({ stage: "preflight_rejected", effect: null, outcome: "REJECTED" });
    return preflight.response;
  }
  trace({ stage: "preflight_accepted", effect: null, outcome: "RETURNED" });
  const { query, prompt, locale, depth, adviceBoundary } = preflight.value;
  const resolveAccess = dependencies.resolveAccess ?? resolveVlmPaidSurfaceAccess;
  const recordResult = dependencies.recordResult ?? recordSingleResult;
  const persistSnapshots = dependencies.persistSnapshots ?? persistRiskSnapshots;
  const readHistory = dependencies.readHistory ?? getPersistentRiskHistory;
  const buildDefiLlama = dependencies.buildDefiLlama ?? buildDefiLlamaSnapshotForResult;
  const analyzeKernel = dependencies.analyzeKernel ?? analyzeRiskWithVlmKernel;
  const generateAnalysis = dependencies.generateAnalysis ?? generateVlmBrainAnalysis;
  const buildEvidencePacket = dependencies.buildEvidencePacket ?? buildPublicVlmEvidencePacket;

  try {
    trace({ stage: "access", effect: "access", outcome: "CALLED" });
    const accessGate = await resolveAccess({
      policyId: "brain_analysis",
      request,
      depth,
      locale,
      assetId: query,
      symbol: query,
    });
    if (!accessGate.ok) {
      trace({ stage: "access_rejected", effect: null, outcome: "REJECTED" });
      return NextResponse.json(toVlmPaidSurfacePaymentRequiredPayload(accessGate), { status: 402, headers: accessGate.headers });
    }

    trace({ stage: "market_resolver", effect: "market_provider", outcome: "CALLED" });
    const result = await resolveMarketResult(query);
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (publication.evidenceState !== "verified") {
      trace({ stage: "publication_withheld", effect: null, outcome: "REJECTED" });
      return securityJson(
        {
          mode: "withheld",
          result,
          publication,
          ai: null,
          kernel: null,
          blocker: "verified_signed_fresh_quorum_market_evidence_required",
          generatedAt,
        },
        { status: 424 },
      );
    }
    trace({ stage: "record_result", effect: "durable", outcome: "CALLED" });
    const memory = recordResult(result);
    if (memory?.lastSnapshot) trace({ stage: "persist_snapshots", effect: "durable", outcome: "CALLED" });
    const ledger = memory?.lastSnapshot ? await persistSnapshots([memory.lastSnapshot]) : undefined;
    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    trace({ stage: "read_history", effect: "durable", outcome: "CALLED" });
    const history = await readHistory(id);
    const brain = buildRiskBrain(result, history);
    trace({ stage: "defillama", effect: "tool", outcome: "CALLED" });
    const defiLlama = await buildDefiLlama(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, history });
    trace({ stage: "kernel", effect: "tool", outcome: "CALLED" });
    const kernel = analyzeKernel({ result, history, locale, depth, surface: "shield" });
    trace({ stage: "model", effect: "model", outcome: "CALLED" });
    const rawAi = await generateAnalysis({
      result,
      brain,
      locale,
      depth,
      surface: "shield",
      prompt,
    });
    const aiFirewall = applyVlmBrainOutputEntitlementFirewall({
      locale,
      surface: "shield",
      requestedDepth: depth,
      accessMode: accessGate.accessMode,
      paidAccessVerified: accessGate.ok && (accessGate.depth === "advanced" || accessGate.depth === "pro"),
      output: rawAi.output,
    });
    const ai = { ...rawAi, output: aiFirewall.output, entitlementFirewall: aiFirewall.decision, entitlementRedacted: aiFirewall.redacted };
    trace({ stage: "evidence_packet", effect: "tool", outcome: "CALLED" });
    const publicEvidencePacket = buildEvidencePacket(rawAi);

    return NextResponse.json({
      mode: publication.mode,
      publication,
      result,
      memory,
      ledger,
      history,
      brain,
      defiLlama,
      sourceSync,
      kernel,
      ai,
      publicEvidencePacket,
      adviceBoundary: { decision: adviceBoundary.decision, flags: adviceBoundary.flags },
      access: {
        depth: accessGate.depth,
        paidRequired: accessGate.paidRequired,
        accessMode: accessGate.accessMode,
        policy: accessGate.policy,
      },
      pass425: brain.pass425,
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
      generatedAt,
    });
  } catch {
    trace({ stage: "handler_exception", effect: null, outcome: "THREW" });
    return securityJson(
      { mode: "error", error: "Risk brain generation failed" },
      { status: 502 },
    );
  }
}

async function handleBrainGet(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "legacy-vlm-brain-get", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  return executeBrainRequest(request);
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "legacy_brain_get", () => handleBrainGet(request));
}
