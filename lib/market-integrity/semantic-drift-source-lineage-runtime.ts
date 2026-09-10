import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe } from "./real-internet-data-arbitration";
import type { Pass438ProviderExecutionLoopRuntime } from "./provider-execution-loop-runtime";
import type { Pass439TruthReplayHarnessRuntime } from "./truth-replay-harness-runtime";

export type Pass440DriftState = "semantic_aligned" | "semantic_guarded" | "semantic_drift_warning" | "semantic_sealed";
export type Pass440ResponseMode = "normal_source_bound" | "guarded_rewrite" | "facts_only_rewrite" | "operator_lineage_review";
export type Pass440LineageLane = "price" | "change" | "volume" | "risk" | "source" | "missing" | "memory" | "pdf" | "chat";

export type Pass440SourceLineageNode = {
  id: string;
  lane: Pass440LineageLane;
  field: string;
  source: string;
  supported: boolean;
  customerSafe: boolean;
  evidence: string[];
  missingReason?: string;
  driftRisk: number;
  lineageLine: string;
};

export type Pass440SemanticDriftSourceLineageRuntime = {
  version: "semantic-drift-source-lineage-runtime";
  generatedAt: string;
  driftState: Pass440DriftState;
  responseMode: Pass440ResponseMode;
  semanticDriftScore: number;
  sourceLineageScore: number;
  sourceLineage: Pass440SourceLineageNode[];
  driftSignals: Array<{
    id: string;
    severity: "low" | "medium" | "high";
    lane: Pass440LineageLane;
    signal: string;
    repair: string;
    customerVisible: boolean;
  }>;
  narrativeRepair: {
    onePayload: true;
    oneLocale: true;
    oneSectionOrder: true;
    removeRepeatedClaims: true;
    blockUnsupportedLiveTone: true;
    maxCustomerLines: number;
    rewriteMode: Pass440ResponseMode;
  };
  lineagePolicy: {
    bindEveryCustomerSentenceToSource: true;
    keepProviderInternalsHidden: true;
    exposeMissingDataWhenNeeded: true;
    memoryCannotInventSource: true;
    neverUpgradeConfidenceFromTone: true;
  };
  pdfChatGate: {
    pdfAllowed: boolean;
    chatAllowed: boolean;
    factsOnly: boolean;
    operatorReview: boolean;
    noFakeLive: true;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass440LensSemanticDriftContract = {
  version: "pass440-lens-semantic-drift-contract";
  locale: "pl" | "de" | "en";
  customerLabel: "pdf_preview";
  onePayload: true;
  oneLocale: true;
  semanticDriftGuard: true;
  technicalLineageHidden: true;
  missingDataVisible: boolean;
  customerLine: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 58) || "lineage";
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function providerNames(probes: Pass433ProviderProbe[]) {
  return unique(probes.filter((probe) => probe.status === "ok" || probe.status === "partial").map((probe) => probe.provider));
}

function fieldObserved(input: {
  field: Pass440LineageLane;
  result: TokenRiskResult;
  probes: Pass433ProviderProbe[];
}) {
  if (input.field === "price") return isNumber(input.result.metrics.currentPrice) || input.probes.some((probe) => probe.hasPrice);
  if (input.field === "change") return isNumber(input.result.metrics.priceChange24h) || input.probes.some((probe) => probe.has24hChange);
  if (input.field === "volume") return isNumber(input.result.metrics.volume24h) || input.probes.some((probe) => probe.hasVolume24h);
  if (input.field === "risk") return isNumber(input.result.score);
  if (input.field === "source") return input.probes.some((probe) => probe.status === "ok" || probe.status === "partial") || input.result.dataSources.length > 0;
  if (input.field === "missing") return true;
  if (input.field === "memory") return true;
  if (input.field === "pdf") return true;
  if (input.field === "chat") return true;
  return false;
}

function lineageNode(input: {
  lane: Pass440LineageLane;
  field: string;
  result: TokenRiskResult;
  probes: Pass433ProviderProbe[];
  pass438: Pass438ProviderExecutionLoopRuntime;
  pass439: Pass439TruthReplayHarnessRuntime;
  source?: string;
  evidence?: string[];
  missingReason?: string;
}): Pass440SourceLineageNode {
  const supported = fieldObserved({ field: input.lane, result: input.result, probes: input.probes });
  const replayPenalty = input.pass439.replayState === "replay_conflict" ? 30 : input.pass439.replayState === "replay_sealed" ? 24 : input.pass439.replayState === "replay_partial" ? 10 : 0;
  const executionPenalty = input.pass438.executionMode === "operator_pause" ? 28 : input.pass438.executionMode === "dry_run_facts_only" ? 18 : input.pass438.executionMode === "execute_with_retry" ? 8 : 0;
  const driftRisk = clamp((supported ? 8 : 42) + replayPenalty + executionPenalty + (input.missingReason ? 12 : 0));
  const source = input.source ?? (providerNames(input.probes).join(" + ") || input.result.dataSources[0] || "resolved payload");
  return {
    id: `pass440_${input.lane}_${slug(input.field)}`,
    lane: input.lane,
    field: input.field,
    source,
    supported,
    customerSafe: supported && driftRisk < 55,
    evidence: unique(input.evidence ?? [source, ...input.result.dataSources]),
    missingReason: input.missingReason,
    driftRisk,
    lineageLine: `${input.lane}: ${supported ? "supported" : "missing"}; drift ${driftRisk}/100; source ${source}.`,
  };
}

function buildDriftSignals(input: {
  lineage: Pass440SourceLineageNode[];
  pass438: Pass438ProviderExecutionLoopRuntime;
  pass439: Pass439TruthReplayHarnessRuntime;
  providers: string[];
}) {
  const signals: Pass440SemanticDriftSourceLineageRuntime["driftSignals"] = [];
  for (const node of input.lineage) {
    if (!node.supported) {
      signals.push({
        id: `missing_${node.id}`,
        severity: node.lane === "price" || node.lane === "source" ? "high" : "medium",
        lane: node.lane,
        signal: `${node.field} is not supported by the resolved payload or provider attempts.`,
        repair: `Rewrite ${node.lane} wording as missing-data/facts-only and schedule next provider probe.`,
        customerVisible: ["price", "source", "missing"].includes(node.lane),
      });
    } else if (node.driftRisk >= 55) {
      signals.push({
        id: `drift_${node.id}`,
        severity: node.driftRisk >= 75 ? "high" : "medium",
        lane: node.lane,
        signal: `${node.field} is supported but narrative tone may be stronger than evidence allows.`,
        repair: `Keep ${node.lane} wording bounded to confidence, provider count and missing data.`,
        customerVisible: false,
      });
    }
  }
  if (input.providers.length < 2) {
    signals.push({
      id: "pass440_second_provider_lineage_missing",
      severity: "high",
      lane: "source",
      signal: "Second provider lineage is not confirmed.",
      repair: "Keep confidence capped and show missing second provider when live wording is requested.",
      customerVisible: true,
    });
  }
  if (input.pass439.releaseGate.factsOnly || input.pass438.pdfChatGate.factsOnly) {
    signals.push({
      id: "pass440_facts_only_inherited",
      severity: "medium",
      lane: "pdf",
      signal: "Upstream replay/execution requires facts-only narrative.",
      repair: "Remove persuasive tone and keep only source-bound fields.",
      customerVisible: false,
    });
  }
  return signals;
}

export function buildPass440SemanticDriftSourceLineageRuntime(input: {
  result: TokenRiskResult;
  pass438: Pass438ProviderExecutionLoopRuntime;
  pass439: Pass439TruthReplayHarnessRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass440SemanticDriftSourceLineageRuntime {
  const probes = input.providerAttempts?.length ? input.providerAttempts : [];
  const providers = providerNames(probes);
  const executionMissing = unique(input.pass438.providerExecutionLedger.flatMap((item) => item.missingFields.map(String)));
  const replayMissing = unique(input.pass439.truthReplayNodes.flatMap((item) => item.missingFields));
  const missing = unique([...executionMissing, ...replayMissing]);

  const lineage: Pass440SourceLineageNode[] = [
    lineageNode({ lane: "price", field: "current price", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, evidence: ["metrics.currentPrice", ...providers], missingReason: isNumber(input.result.metrics.currentPrice) ? undefined : "price missing" }),
    lineageNode({ lane: "change", field: "24h change", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, evidence: ["metrics.priceChange24h", ...providers], missingReason: isNumber(input.result.metrics.priceChange24h) ? undefined : "24h change missing" }),
    lineageNode({ lane: "volume", field: "24h volume", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, evidence: ["metrics.volume24h", ...providers], missingReason: isNumber(input.result.metrics.volume24h) ? undefined : "volume missing" }),
    lineageNode({ lane: "risk", field: `risk score ${input.result.score}/100`, result: input.result, probes, pass438: input.pass438, pass439: input.pass439, evidence: ["risk-engine", "pass438", "pass439"] }),
    lineageNode({ lane: "source", field: "provider lineage", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, source: providers.join(" + ") || "provider lineage missing", evidence: providers, missingReason: providers.length ? undefined : "provider missing" }),
    lineageNode({ lane: "missing", field: "missing data list", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, evidence: missing.length ? missing : ["none"], source: "missing-data rail" }),
    lineageNode({ lane: "memory", field: "long-term memory context", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, source: "market memory with decay", evidence: ["pass423", "pass427", "pass440"] }),
    lineageNode({ lane: "pdf", field: "PDF preview/download narrative", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, source: "resolved lens payload", evidence: ["one payload", "one locale", "section order"] }),
    lineageNode({ lane: "chat", field: "Angel/chat narrative", result: input.result, probes, pass438: input.pass438, pass439: input.pass439, source: "source-bound answer payload", evidence: ["pass426", "pass430", "pass439"] }),
  ];

  const driftSignals = buildDriftSignals({ lineage, pass438: input.pass438, pass439: input.pass439, providers });
  const unsupported = lineage.filter((item) => !item.supported).length;
  const highSignals = driftSignals.filter((item) => item.severity === "high").length;
  const driftRisk = clamp(lineage.reduce((sum, item) => sum + item.driftRisk, 0) / Math.max(1, lineage.length) + highSignals * 7 + unsupported * 5);
  const lineageScore = clamp(100 - driftRisk + providers.length * 4 - Math.min(16, missing.length * 1.5));
  const driftState: Pass440DriftState = input.pass439.replayState === "replay_conflict" || input.pass438.executionMode === "operator_pause" || highSignals >= 3
    ? "semantic_sealed"
    : driftRisk >= 68 || unsupported >= 3
      ? "semantic_drift_warning"
      : driftRisk >= 38 || driftSignals.length > 0
        ? "semantic_guarded"
        : "semantic_aligned";
  const responseMode: Pass440ResponseMode = driftState === "semantic_aligned"
    ? "normal_source_bound"
    : driftState === "semantic_guarded"
      ? "guarded_rewrite"
      : driftState === "semantic_drift_warning"
        ? "facts_only_rewrite"
        : "operator_lineage_review";
  const factsOnly = responseMode === "facts_only_rewrite" || responseMode === "operator_lineage_review" || input.pass439.releaseGate.factsOnly || input.pass438.pdfChatGate.factsOnly;
  const operatorReview = responseMode === "operator_lineage_review";

  return {
    version: "semantic-drift-source-lineage-runtime",
    generatedAt: new Date().toISOString(),
    driftState,
    responseMode,
    semanticDriftScore: driftRisk,
    sourceLineageScore: lineageScore,
    sourceLineage: lineage,
    driftSignals,
    narrativeRepair: {
      onePayload: true,
      oneLocale: true,
      oneSectionOrder: true,
      removeRepeatedClaims: true,
      blockUnsupportedLiveTone: true,
      maxCustomerLines: factsOnly ? 6 : 10,
      rewriteMode: responseMode,
    },
    lineagePolicy: {
      bindEveryCustomerSentenceToSource: true,
      keepProviderInternalsHidden: true,
      exposeMissingDataWhenNeeded: true,
      memoryCannotInventSource: true,
      neverUpgradeConfidenceFromTone: true,
    },
    pdfChatGate: {
      pdfAllowed: !operatorReview && input.pass439.releaseGate.pdfAllowed && driftState !== "semantic_sealed",
      chatAllowed: !operatorReview && input.pass439.releaseGate.chatAllowed,
      factsOnly,
      operatorReview,
      noFakeLive: true,
    },
    customerReadout: driftState === "semantic_aligned"
      ? "Velmère source lineage confirms that the customer-facing report can stay source-bound."
      : driftState === "semantic_guarded"
        ? "Velmère keeps the report guarded because some fields need visible missing-data context."
        : driftState === "semantic_drift_warning"
          ? "Velmère rewrites the output to facts-only because wording could drift beyond evidence."
          : "Velmère pauses live-style wording until source lineage is reviewed.",
    operatorReadout: `PASS440 ${driftState}; response ${responseMode}; drift ${driftRisk}/100; lineage ${lineageScore}/100; signals ${driftSignals.length}; providers ${providers.join(", ") || "none"}.`,
  };
}

export function buildPass440LensSemanticDriftContract(input: {
  locale: "pl" | "de" | "en";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  pass439PdfAllowed?: boolean;
}): Pass440LensSemanticDriftContract {
  const guarded = input.sourceConfidence < 64 || input.sourceCount < 2 || input.missingDataCount > 0 || input.pass439PdfAllowed === false;
  const lines: Record<"pl" | "de" | "en", string> = {
    pl: guarded ? "Podgląd PDF zostaje source-bound: pokazuje potwierdzone pola i widoczne braki danych." : "Podgląd PDF jest spójny ze źródłami i gotowy do pobrania z tego samego payloadu.",
    en: guarded ? "PDF preview stays source-bound: confirmed fields and visible missing data only." : "PDF preview is aligned with sources and downloads from the same payload.",
    de: guarded ? "Die PDF-Vorschau bleibt quellengebunden: nur bestätigte Felder und sichtbare Datenlücken." : "Die PDF-Vorschau ist quellenkonsistent und nutzt dieselbe Nutzlast für den Download.",
  };
  return {
    version: "pass440-lens-semantic-drift-contract",
    locale: input.locale,
    customerLabel: "pdf_preview",
    onePayload: true,
    oneLocale: true,
    semanticDriftGuard: true,
    technicalLineageHidden: true,
    missingDataVisible: guarded,
    customerLine: lines[input.locale],
  };
}
