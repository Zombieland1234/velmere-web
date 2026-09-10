import type { TokenRiskResult } from "./risk-types";
import type { Pass435LiveQueryTestBench, Pass435ProbeExpectation } from "./live-query-test-bench";
import type { Pass436WorldBrainSloGraphRuntime } from "./world-brain-slo-graph-runtime";

export type Pass437PlannerMode = "auto_probe_ready" | "guided_probe" | "facts_only_plan" | "operator_review";
export type Pass437ProviderLane = "crypto_market" | "dex_liquidity" | "token_security" | "real_market" | "exchange_health" | "candles" | "operator_source";
export type Pass437Priority = "p0_now" | "p1_next" | "p2_background" | "p3_archive";

export type Pass437EvidencePlanItem = {
  id: string;
  provider: string;
  lane: Pass437ProviderLane;
  priority: Pass437Priority;
  reason: string;
  command: string;
  expectedFields: Pass435ProbeExpectation[];
  releaseImpact: "unlock_live_readout" | "raise_confidence" | "reduce_missing_data" | "operator_context";
  customerVisible: boolean;
};

export type Pass437AdaptiveEvidencePlannerRuntime = {
  version: "adaptive-evidence-planner-runtime";
  generatedAt: string;
  plannerMode: Pass437PlannerMode;
  evidencePlanScore: number;
  nextBestProbe: Pass437EvidencePlanItem;
  providerPriorityQueue: Pass437EvidencePlanItem[];
  missingDataPlan: Array<{
    field: string;
    attemptedProviders: string[];
    nextProvider: string;
    priority: Pass437Priority;
    customerVisible: boolean;
    reason: string;
  }>;
  automationPolicy: {
    canAutoProbe: boolean;
    maxParallelProviders: number;
    timeoutMs: number;
    retryPolicy: "none" | "single_retry" | "operator_only";
    noFakeLive: true;
  };
  learningPolicy: {
    memoryCanStoreYears: true;
    adaptOnlyAfterProviderQuorum: boolean;
    oldMemoryCannotOverrideLiveSources: true;
    singleEventCannotTeachRule: true;
  };
  pdfChatPatch: {
    onePayload: true;
    showWhatWasTried: boolean;
    showWhatIsMissing: boolean;
    showNextProvider: boolean;
    hideTechnicalPlannerInternals: true;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass437LensAdaptiveEvidenceContract = {
  version: "pass437-lens-adaptive-evidence-contract";
  locale: "pl" | "de" | "en";
  plannerMode: Pass437PlannerMode;
  nextProviderVisible: boolean;
  onePayload: true;
  noFakeLive: true;
  maxSuggestions: 3;
  customerLabel: "pdf_preview";
  customerLine: string;
  technicalPlannerHidden: true;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "provider";
}

function laneForField(field: string): Pass437ProviderLane {
  const clean = field.toLowerCase();
  if (clean.includes("security") || clean.includes("holder") || clean.includes("contract")) return "token_security";
  if (clean.includes("liquidity") || clean.includes("slippage")) return "dex_liquidity";
  if (clean.includes("candle") || clean.includes("sparkline") || clean.includes("chart")) return "candles";
  if (clean.includes("exchange") || clean.includes("withdrawal") || clean.includes("reserve")) return "exchange_health";
  if (clean.includes("price") || clean.includes("market") || clean.includes("volume")) return "crypto_market";
  return "operator_source";
}

function expectedForLane(lane: Pass437ProviderLane): Pass435ProbeExpectation[] {
  if (lane === "token_security") return ["security", "freshness"];
  if (lane === "dex_liquidity") return ["liquidity", "volume24h", "freshness"];
  if (lane === "candles") return ["candles", "freshness", "price"];
  if (lane === "real_market") return ["price", "change24h", "volume24h", "candles"];
  if (lane === "exchange_health") return ["freshness", "secondProvider"];
  return ["price", "change24h", "volume24h", "marketCap"];
}

function providerForLane(lane: Pass437ProviderLane, field: string) {
  if (lane === "token_security") return "GoPlus token security or verified chain scanner";
  if (lane === "dex_liquidity") return "DEX Screener pair liquidity";
  if (lane === "candles") return "Binance/MEXC klines or CoinGecko sparkline";
  if (lane === "real_market") return "Yahoo chart plus paid/official market data mirror";
  if (lane === "exchange_health") return "exchange status/reserves/withdrawal health adapter";
  if (field.toLowerCase().includes("secondprovider") || field.toLowerCase().includes("second provider")) return "second independent provider lane";
  return "CoinGecko markets plus secondary market provider";
}

function commandFor(lane: Pass437ProviderLane, symbol: string) {
  const q = symbol || "asset";
  if (lane === "dex_liquidity") return `probe:dex-liquidity ${q}`;
  if (lane === "token_security") return `probe:token-security ${q}`;
  if (lane === "candles") return `probe:candles ${q} 1h 48`;
  if (lane === "real_market") return `probe:real-market ${q}`;
  if (lane === "exchange_health") return `probe:exchange-health ${q}`;
  if (lane === "operator_source") return `operator:attach-source ${q}`;
  return `probe:market ${q}`;
}

function priorityFor(field: string, visible: boolean, liveScore: number): Pass437Priority {
  const clean = field.toLowerCase();
  if (clean.includes("price") || clean.includes("second") || clean.includes("fresh")) return "p0_now";
  if (visible || clean.includes("liquidity") || clean.includes("security") || liveScore < 55) return "p1_next";
  if (clean.includes("history") || clean.includes("archive")) return "p3_archive";
  return "p2_background";
}

function releaseImpactFor(field: string): Pass437EvidencePlanItem["releaseImpact"] {
  const clean = field.toLowerCase();
  if (clean.includes("price") || clean.includes("fresh") || clean.includes("second")) return "unlock_live_readout";
  if (clean.includes("liquidity") || clean.includes("security") || clean.includes("candle")) return "raise_confidence";
  if (clean.includes("missing") || clean.includes("provider")) return "reduce_missing_data";
  return "operator_context";
}

function fallbackPlan(symbol: string): Pass437EvidencePlanItem {
  return {
    id: "pass437_monitor_provider_health",
    provider: "provider health monitor",
    lane: "operator_source",
    priority: "p2_background",
    reason: "No critical missing data was detected; keep provider health and memory replay under observation.",
    command: `monitor:provider-health ${symbol || "asset"}`,
    expectedFields: ["freshness", "secondProvider"],
    releaseImpact: "operator_context",
    customerVisible: false,
  };
}

export function buildPass437AdaptiveEvidencePlannerRuntime(input: {
  result: TokenRiskResult;
  pass435: Pass435LiveQueryTestBench;
  pass436: Pass436WorldBrainSloGraphRuntime;
}): Pass437AdaptiveEvidencePlannerRuntime {
  const symbol = (input.result.token.symbol || input.result.token.marketId || "asset").toString();
  const pass435 = input.pass435;
  const pass436 = input.pass436;
  const missingRows = pass435.missingDataReplay.length
    ? pass435.missingDataReplay
    : pass435.providerRealityRows.flatMap((row) => row.missingFields.map((field) => ({
        field,
        attemptedProviders: [row.provider],
        nextProvider: row.repairHint,
        mustSurfaceInPdf: row.verdict === "red" || row.verdict === "sealed",
        mustSurfaceInChat: true,
      })));
  const plans = missingRows.map((item, index): Pass437EvidencePlanItem => {
    const lane = laneForField(item.field);
    const priority = priorityFor(item.field, item.mustSurfaceInPdf || item.mustSurfaceInChat, pass435.liveReadinessScore);
    const provider = item.nextProvider && !item.nextProvider.includes("Run ") ? item.nextProvider : providerForLane(lane, item.field);
    return {
      id: `pass437_${slug(item.field)}_${index + 1}`,
      provider,
      lane,
      priority,
      reason: `${item.field} is not strong enough for high-confidence output; attempted ${item.attemptedProviders.join(" / ") || "no provider yet"}.`,
      command: commandFor(lane, symbol),
      expectedFields: expectedForLane(lane),
      releaseImpact: releaseImpactFor(item.field),
      customerVisible: item.mustSurfaceInPdf || item.mustSurfaceInChat || priority === "p0_now",
    };
  }).sort((a, b) => {
    const rank: Record<Pass437Priority, number> = { p0_now: 0, p1_next: 1, p2_background: 2, p3_archive: 3 };
    return rank[a.priority] - rank[b.priority] || a.provider.localeCompare(b.provider);
  });
  const queue = plans.length ? plans : [fallbackPlan(symbol)];
  const critical = queue.filter((item) => item.priority === "p0_now").length;
  const visibleMissing = queue.filter((item) => item.customerVisible).length;
  const worldScore = pass436.worldBrainScore;
  const evidencePlanScore = clamp(
    worldScore * 0.44 +
      pass436.structuredOutputReadiness * 0.22 +
      pass435.liveReadinessScore * 0.22 -
      critical * 8 -
      visibleMissing * 3 +
      (pass436.releaseDecision === "ship_verified_readout" ? 10 : 0),
  );
  const plannerMode: Pass437PlannerMode = pass436.interruptPolicy.humanInLoopRequired || critical >= 3
    ? "operator_review"
    : pass435.releaseMode === "block_pdf_until_probe" || evidencePlanScore < 38
      ? "facts_only_plan"
      : critical > 0 || visibleMissing > 0
        ? "guided_probe"
        : "auto_probe_ready";
  const canAutoProbe = plannerMode === "auto_probe_ready" || plannerMode === "guided_probe";
  const retryPolicy = plannerMode === "operator_review" ? "operator_only" : critical > 0 ? "single_retry" : "none";
  const missingDataPlan = queue.map((item) => ({
    field: item.id.replace(/^pass437_/, "").replace(/_\d+$/, "").replace(/_/g, " "),
    attemptedProviders: pass435.providerRealityRows.map((row) => row.provider),
    nextProvider: item.provider,
    priority: item.priority,
    customerVisible: item.customerVisible,
    reason: item.reason,
  }));
  return {
    version: "adaptive-evidence-planner-runtime",
    generatedAt: new Date().toISOString(),
    plannerMode,
    evidencePlanScore,
    nextBestProbe: queue[0],
    providerPriorityQueue: queue.slice(0, 8),
    missingDataPlan,
    automationPolicy: {
      canAutoProbe,
      maxParallelProviders: plannerMode === "operator_review" ? 0 : 3,
      timeoutMs: plannerMode === "auto_probe_ready" ? 4200 : 6500,
      retryPolicy,
      noFakeLive: true,
    },
    learningPolicy: {
      memoryCanStoreYears: true,
      adaptOnlyAfterProviderQuorum: true,
      oldMemoryCannotOverrideLiveSources: true,
      singleEventCannotTeachRule: true,
    },
    pdfChatPatch: {
      onePayload: true,
      showWhatWasTried: visibleMissing > 0 || plannerMode !== "auto_probe_ready",
      showWhatIsMissing: visibleMissing > 0,
      showNextProvider: critical > 0 || plannerMode !== "auto_probe_ready",
      hideTechnicalPlannerInternals: true,
    },
    customerReadout: plannerMode === "auto_probe_ready"
      ? "Velmère has enough provider coverage to continue with a bounded risk readout."
      : plannerMode === "guided_probe"
        ? "Velmère can answer, but the next provider check remains visible in the report."
        : plannerMode === "facts_only_plan"
          ? "Velmère will keep the answer factual until the missing provider lane is checked."
          : "Velmère requires operator review before stronger live-style wording.",
    operatorReadout: `PASS437 ${plannerMode}; plan score ${evidencePlanScore}/100; next ${queue[0].provider}; priority ${queue[0].priority}; queue ${queue.length}.`,
  };
}

export function buildPass437LensAdaptiveEvidenceContract(input: {
  locale: "pl" | "de" | "en";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
}): Pass437LensAdaptiveEvidenceContract {
  const plannerMode: Pass437PlannerMode = input.sourceCount >= 2 && input.sourceConfidence >= 72
    ? "auto_probe_ready"
    : input.sourceCount >= 1 && input.sourceConfidence >= 45
      ? "guided_probe"
      : input.missingDataCount > 0
        ? "facts_only_plan"
        : "operator_review";
  const customerLine = input.locale === "pl"
    ? "Podgląd PDF pokazuje krótki raport i następny brakujący provider, jeśli dane są niepełne."
    : input.locale === "de"
      ? "Die PDF-Vorschau zeigt den Kurzbericht und den nächsten fehlenden Provider, wenn Daten unvollständig sind."
      : "PDF preview shows the short report and the next missing provider when data is incomplete.";
  return {
    version: "pass437-lens-adaptive-evidence-contract",
    locale: input.locale,
    plannerMode,
    nextProviderVisible: plannerMode !== "auto_probe_ready",
    onePayload: true,
    noFakeLive: true,
    maxSuggestions: 3,
    customerLabel: "pdf_preview",
    customerLine,
    technicalPlannerHidden: true,
  };
}
