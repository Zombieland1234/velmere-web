import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe, Pass433RealInternetDataArbitration } from "./real-internet-data-arbitration";
import type { Pass435LiveQueryTestBench, Pass435ProbeExpectation } from "./live-query-test-bench";
import type { Pass436WorldBrainSloGraphRuntime } from "./world-brain-slo-graph-runtime";
import type { Pass437AdaptiveEvidencePlannerRuntime, Pass437Priority, Pass437ProviderLane } from "./adaptive-evidence-planner-runtime";

export type Pass438ExecutionMode = "execute_ready" | "execute_with_retry" | "dry_run_facts_only" | "operator_pause";
export type Pass438ToolCallState = "ready" | "scheduled" | "retried" | "failed" | "blocked" | "observed";
export type Pass438ExecutionRisk = "low" | "medium" | "high" | "sealed";

export type Pass438ProviderExecutionItem = {
  id: string;
  provider: string;
  lane: Pass437ProviderLane | "unknown";
  priority: Pass437Priority;
  state: Pass438ToolCallState;
  executionRisk: Pass438ExecutionRisk;
  timeoutMs: number;
  retryAllowed: boolean;
  expectedFields: Pass435ProbeExpectation[];
  observedFields: Pass435ProbeExpectation[];
  missingFields: Pass435ProbeExpectation[];
  sourceFreshness: "fresh" | "stale" | "missing";
  confidenceDelta: number;
  customerVisible: boolean;
  nextAction: string;
  traceLine: string;
};

export type Pass438ProviderExecutionLoopRuntime = {
  version: "provider-execution-loop-runtime";
  generatedAt: string;
  executionMode: Pass438ExecutionMode;
  executionScore: number;
  providerExecutionLedger: Pass438ProviderExecutionItem[];
  nextExecutableProvider: Pass438ProviderExecutionItem;
  toolBudget: {
    maxSequentialCalls: number;
    maxParallelCalls: number;
    timeoutBudgetMs: number;
    retryBudget: number;
    stopOnConflict: boolean;
    noFakeLive: true;
  };
  structuredErrorPolicy: {
    classifyProviderErrors: true;
    exposeMissingData: boolean;
    retryOnlyIdempotentReads: true;
    sealOnRepeatedFailure: boolean;
    humanReviewOnConflict: boolean;
  };
  tracePolicy: {
    recordProviderAttempt: true;
    recordObservedFields: true;
    recordMissingFields: true;
    recordConfidenceDelta: true;
    hideRawProviderInternalsFromCustomer: true;
  };
  pdfChatGate: {
    onePayload: true;
    releaseAllowed: boolean;
    factsOnly: boolean;
    mustShowMissingData: boolean;
    mustShowProviderAttempt: boolean;
    maxCustomerMissingRows: number;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass438LensProviderExecutionContract = {
  version: "pass438-lens-provider-execution-contract";
  locale: "pl" | "de" | "en";
  executionMode: Pass438ExecutionMode;
  onePayload: true;
  noFakeLive: true;
  maxSuggestions: 3;
  customerLabel: "pdf_preview";
  customerLine: string;
  providerExecutionHidden: true;
  missingDataVisible: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 54) || "provider";
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function observedFields(probe?: Pass433ProviderProbe): Pass435ProbeExpectation[] {
  if (!probe) return [];
  return [
    probe.hasPrice ? "price" : undefined,
    probe.has24hChange ? "change24h" : undefined,
    probe.hasVolume24h ? "volume24h" : undefined,
    probe.hasMarketCap ? "marketCap" : undefined,
    probe.hasLiquidity ? "liquidity" : undefined,
    probe.hasCandles ? "candles" : undefined,
    probe.hasSecurity ? "security" : undefined,
    probe.sourceFreshness === "fresh" ? "freshness" : undefined,
  ].filter(Boolean) as Pass435ProbeExpectation[];
}

function missingFields(expected: Pass435ProbeExpectation[], observed: Pass435ProbeExpectation[]): Pass435ProbeExpectation[] {
  return expected.filter((field) => !observed.includes(field));
}

function stateFor(input: {
  probe?: Pass433ProviderProbe;
  priority: Pass437Priority;
  plannerMode: Pass437AdaptiveEvidencePlannerRuntime["plannerMode"];
  provider: string;
}): Pass438ToolCallState {
  if (input.plannerMode === "operator_review") return "blocked";
  if (input.probe?.status === "error") return input.priority === "p0_now" ? "failed" : "observed";
  if (input.probe?.status === "ok" || input.probe?.status === "partial") return "observed";
  if (input.priority === "p0_now") return "scheduled";
  if (input.priority === "p1_next") return "ready";
  return "ready";
}

function executionRisk(input: {
  state: Pass438ToolCallState;
  missing: Pass435ProbeExpectation[];
  priority: Pass437Priority;
  probe?: Pass433ProviderProbe;
  worldDecision: Pass436WorldBrainSloGraphRuntime["releaseDecision"];
}): Pass438ExecutionRisk {
  if (input.state === "blocked" || input.worldDecision === "operator_interrupt") return "sealed";
  if (input.state === "failed" || input.missing.includes("price") || input.missing.includes("secondProvider")) return "high";
  if (input.priority === "p0_now" || input.missing.length >= 3 || input.probe?.sourceFreshness === "stale") return "medium";
  return "low";
}

function expectedWithSecondProvider(expected: Pass435ProbeExpectation[], providerCount: number, priority: Pass437Priority) {
  const fields = [...expected];
  if (providerCount < 2 || priority === "p0_now") fields.push("secondProvider");
  return unique(fields);
}

function providerProbeFor(provider: string, probes: Pass433ProviderProbe[]) {
  const clean = provider.toLowerCase();
  return probes.find((probe) => clean.includes(probe.provider.toLowerCase()) || probe.provider.toLowerCase().includes(clean))
    ?? probes.find((probe) => probe.provider.toLowerCase().split(/\s+/).some((part) => part.length > 4 && clean.includes(part)));
}

function fallbackExecutionItem(symbol: string): Pass438ProviderExecutionItem {
  return {
    id: "pass438_provider_health_monitor",
    provider: "provider health monitor",
    lane: "unknown",
    priority: "p2_background",
    state: "ready",
    executionRisk: "low",
    timeoutMs: 4200,
    retryAllowed: false,
    expectedFields: ["freshness", "secondProvider"],
    observedFields: [],
    missingFields: ["freshness", "secondProvider"],
    sourceFreshness: "missing",
    confidenceDelta: 0,
    customerVisible: false,
    nextAction: `monitor provider health for ${symbol || "asset"}`,
    traceLine: "PASS438 background provider-health monitor; no critical p0 execution item was produced.",
  };
}

export function buildPass438ProviderExecutionLoopRuntime(input: {
  result: TokenRiskResult;
  pass433: Pass433RealInternetDataArbitration;
  pass435: Pass435LiveQueryTestBench;
  pass436: Pass436WorldBrainSloGraphRuntime;
  pass437: Pass437AdaptiveEvidencePlannerRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass438ProviderExecutionLoopRuntime {
  const symbol = (input.result.token.symbol || input.result.token.marketId || "asset").toString();
  const probes = input.providerAttempts?.length ? input.providerAttempts : input.pass433.providerProbes;
  const providerCount = probes.filter((probe) => probe.status === "ok" || probe.status === "partial").length;
  const ledger = input.pass437.providerPriorityQueue.map((plan, index): Pass438ProviderExecutionItem => {
    const probe = providerProbeFor(plan.provider, probes);
    const observed = observedFields(probe);
    const expected = expectedWithSecondProvider(plan.expectedFields, providerCount, plan.priority);
    const missing = missingFields(expected, observed);
    const state = stateFor({ probe, priority: plan.priority, plannerMode: input.pass437.plannerMode, provider: plan.provider });
    const risk = executionRisk({ state, missing, priority: plan.priority, probe, worldDecision: input.pass436.releaseDecision });
    const retryAllowed = (state === "failed" || missing.length > 0) && plan.priority !== "p3_archive" && input.pass437.automationPolicy.retryPolicy !== "operator_only";
    const confidenceDelta = clamp(
      observed.length * 7 +
      (probe?.status === "ok" ? 16 : probe?.status === "partial" ? 8 : 0) -
      missing.length * 5 -
      (probe?.sourceFreshness === "stale" ? 8 : probe?.sourceFreshness === "missing" ? 12 : 0),
      -35,
      35,
    );
    return {
      id: `pass438_${slug(plan.provider)}_${index + 1}`,
      provider: plan.provider,
      lane: plan.lane,
      priority: plan.priority,
      state,
      executionRisk: risk,
      timeoutMs: input.pass437.automationPolicy.timeoutMs,
      retryAllowed,
      expectedFields: expected,
      observedFields: observed,
      missingFields: missing,
      sourceFreshness: probe?.sourceFreshness ?? "missing",
      confidenceDelta,
      customerVisible: plan.customerVisible || risk === "high" || risk === "sealed",
      nextAction: state === "observed"
        ? `Use observed ${plan.provider} fields and continue confidence arbitration.`
        : state === "failed"
          ? `Retry ${plan.provider} once only if the read is idempotent; otherwise expose the missing data.`
          : state === "blocked"
            ? `Pause ${plan.provider} until operator review clears conflict or weak source coverage.`
            : `Execute ${plan.command} before stronger live wording.`,
      traceLine: `PASS438 ${plan.priority} ${plan.provider}: state ${state}; observed ${observed.join("/") || "none"}; missing ${missing.join("/") || "none"}; Δconfidence ${confidenceDelta}.`,
    };
  });
  const executionLedger = ledger.length ? ledger : [fallbackExecutionItem(symbol)];
  const highRisk = executionLedger.filter((item) => item.executionRisk === "high" || item.executionRisk === "sealed").length;
  const failed = executionLedger.filter((item) => item.state === "failed").length;
  const blocked = executionLedger.filter((item) => item.state === "blocked").length;
  const missingCritical = executionLedger.some((item) => item.missingFields.includes("price") || item.missingFields.includes("secondProvider"));
  const observedCount = executionLedger.filter((item) => item.state === "observed").length;
  const executionScore = clamp(
    input.pass437.evidencePlanScore * 0.35 +
      input.pass436.worldBrainScore * 0.23 +
      input.pass435.liveReadinessScore * 0.22 +
      observedCount * 6 -
      highRisk * 10 -
      failed * 8 -
      blocked * 14 -
      (missingCritical ? 10 : 0),
  );
  const executionMode: Pass438ExecutionMode = blocked > 0 || input.pass436.interruptPolicy.humanInLoopRequired
    ? "operator_pause"
    : input.pass437.plannerMode === "facts_only_plan" || missingCritical || executionScore < 45
      ? "dry_run_facts_only"
      : failed > 0 || highRisk > 0
        ? "execute_with_retry"
        : "execute_ready";
  const sorted = [...executionLedger].sort((a, b) => {
    const rank: Record<Pass437Priority, number> = { p0_now: 0, p1_next: 1, p2_background: 2, p3_archive: 3 };
    const stateRank: Record<Pass438ToolCallState, number> = { scheduled: 0, ready: 1, retried: 2, failed: 3, blocked: 4, observed: 5 };
    return rank[a.priority] - rank[b.priority] || stateRank[a.state] - stateRank[b.state] || b.confidenceDelta - a.confidenceDelta;
  });
  const releaseAllowed = executionMode === "execute_ready" || executionMode === "execute_with_retry";
  const factsOnly = executionMode === "dry_run_facts_only" || executionMode === "operator_pause";
  const mustShowMissingData = missingCritical || executionLedger.some((item) => item.customerVisible && item.missingFields.length > 0);
  return {
    version: "provider-execution-loop-runtime",
    generatedAt: new Date().toISOString(),
    executionMode,
    executionScore,
    providerExecutionLedger: executionLedger.slice(0, 10),
    nextExecutableProvider: sorted[0],
    toolBudget: {
      maxSequentialCalls: executionMode === "operator_pause" ? 0 : 4,
      maxParallelCalls: input.pass437.automationPolicy.maxParallelProviders,
      timeoutBudgetMs: Math.max(4200, input.pass437.automationPolicy.timeoutMs * Math.min(4, Math.max(1, executionLedger.length))),
      retryBudget: executionMode === "execute_with_retry" ? 1 : 0,
      stopOnConflict: true,
      noFakeLive: true,
    },
    structuredErrorPolicy: {
      classifyProviderErrors: true,
      exposeMissingData: mustShowMissingData,
      retryOnlyIdempotentReads: true,
      sealOnRepeatedFailure: failed >= 2 || blocked > 0,
      humanReviewOnConflict: input.pass433.arbitrationMode === "cross_source_conflict" || input.pass436.interruptPolicy.humanInLoopRequired,
    },
    tracePolicy: {
      recordProviderAttempt: true,
      recordObservedFields: true,
      recordMissingFields: true,
      recordConfidenceDelta: true,
      hideRawProviderInternalsFromCustomer: true,
    },
    pdfChatGate: {
      onePayload: true,
      releaseAllowed,
      factsOnly,
      mustShowMissingData,
      mustShowProviderAttempt: mustShowMissingData || executionMode !== "execute_ready",
      maxCustomerMissingRows: 5,
    },
    customerReadout: executionMode === "execute_ready"
      ? "Velmère has enough provider execution evidence to continue with a bounded risk readout."
      : executionMode === "execute_with_retry"
        ? "Velmère can continue, but at least one provider lane should be retried or shown as missing."
        : executionMode === "dry_run_facts_only"
          ? "Velmère will answer only with confirmed facts until the next provider lane is executed."
          : "Velmère paused stronger wording because the provider execution loop needs operator review.",
    operatorReadout: `PASS438 ${executionMode}; score ${executionScore}/100; next ${sorted[0].provider}; risk ${sorted[0].executionRisk}; missing ${sorted[0].missingFields.join("/") || "none"}.`,
  };
}

export function buildPass438LensProviderExecutionContract(input: {
  locale: "pl" | "de" | "en";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  plannerMode?: Pass437AdaptiveEvidencePlannerRuntime["plannerMode"];
}): Pass438LensProviderExecutionContract {
  const weak = input.sourceConfidence < 55 || input.sourceCount < 1 || input.missingDataCount > 2;
  const executionMode: Pass438ExecutionMode = input.plannerMode === "operator_review"
    ? "operator_pause"
    : weak
      ? "dry_run_facts_only"
      : input.missingDataCount > 0 || input.sourceCount < 2
        ? "execute_with_retry"
        : "execute_ready";
  const customerLine = input.locale === "pl"
    ? "Podgląd PDF pokazuje krótki raport Velmère Security i tylko potwierdzone braki danych."
    : input.locale === "de"
      ? "Die PDF-Vorschau zeigt einen kurzen Velmère-Security-Bericht und nur bestätigte Datenlücken."
      : "PDF preview shows a short Velmère Security report and only confirmed missing-data gaps.";
  return {
    version: "pass438-lens-provider-execution-contract",
    locale: input.locale,
    executionMode,
    onePayload: true,
    noFakeLive: true,
    maxSuggestions: 3,
    customerLabel: "pdf_preview",
    customerLine,
    providerExecutionHidden: true,
    missingDataVisible: input.missingDataCount > 0 || executionMode !== "execute_ready",
  };
}
