import type { TokenRiskResult } from "./risk-types";
import type { Pass435LiveQueryTestBench, Pass435LensLiveQueryContract } from "./live-query-test-bench";

export type Pass436BrainGraphNode =
  | "observe"
  | "normalize"
  | "arbitrate"
  | "verify"
  | "narrate"
  | "escalate";

export type Pass436NodeState = "ready" | "degraded" | "sealed" | "interrupt";
export type Pass436ReleaseDecision = "ship_verified_readout" | "ship_missing_data_readout" | "facts_only_interrupt" | "operator_interrupt";
export type Pass436InnovationMode = "evidence_lattice" | "confidence_escrow" | "shadow_twin_replay" | "operator_interrupt";

export type Pass436WorldBrainSloGraphRuntime = {
  version: "world-brain-slo-graph-runtime";
  generatedAt: string;
  releaseDecision: Pass436ReleaseDecision;
  worldBrainScore: number;
  structuredOutputReadiness: number;
  graphNodes: Array<{
    id: Pass436BrainGraphNode;
    label: string;
    state: Pass436NodeState;
    score: number;
    evidence: string;
    repair: string;
  }>;
  sloEnvelope: {
    providerSlo: number;
    evidenceSlo: number;
    narrativeSlo: number;
    fakeLiveErrorBudgetRemaining: number;
    customerSafetySlo: number;
    alertPolicy: "silent_ok" | "customer_missing_data" | "operator_review" | "block_release";
  };
  structuredAnswerSchema: {
    schemaMode: "json_schema_locked";
    requiredKeys: ["asset", "risk", "sources", "missingData", "confidence", "nextStep", "signature"];
    maxSentences: number;
    forbiddenClaims: ["guaranteed_price", "buy_sell_instruction", "hidden_provider", "sentient_ai"];
    onePayload: true;
  };
  innovationStack: Array<{
    id: Pass436InnovationMode;
    label: string;
    purpose: string;
    enabled: boolean;
  }>;
  interruptPolicy: {
    humanInLoopRequired: boolean;
    reasons: string[];
    resumeHint: string;
  };
  customerReadout: string;
  operatorReadout: string;
};

export type Pass436LensWorldBrainContract = {
  version: "pass436-lens-world-brain-contract";
  locale: "pl" | "de" | "en";
  graphRuntime: "browser_lens_pdf";
  structuredOutput: "json_schema_locked";
  releaseDecision: Pass436ReleaseDecision;
  onePayload: true;
  noFakeLive: true;
  maxSuggestions: 3;
  customerLabel: "pdf_preview";
  customerLine: string;
  technicalTextHidden: true;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function nodeState(score: number, critical = false): Pass436NodeState {
  if (critical) return "interrupt";
  if (score >= 72) return "ready";
  if (score >= 42) return "degraded";
  return "sealed";
}

function node(input: {
  id: Pass436BrainGraphNode;
  label: string;
  score: number;
  critical?: boolean;
  evidence: string;
  repair: string;
}) {
  return {
    id: input.id,
    label: input.label,
    state: nodeState(input.score, input.critical),
    score: clamp(input.score),
    evidence: input.evidence,
    repair: input.repair,
  };
}

export function buildPass436WorldBrainSloGraphRuntime(input: {
  result: TokenRiskResult;
  pass435: Pass435LiveQueryTestBench;
}): Pass436WorldBrainSloGraphRuntime {
  const pass435 = input.pass435;
  const providerScore = clamp(pass435.providerRealityRows.reduce((sum, row) => sum + row.coverage, 0) / Math.max(1, pass435.providerRealityRows.length));
  const greenRows = pass435.providerRealityRows.filter((row) => row.verdict === "green").length;
  const redOrSealedRows = pass435.providerRealityRows.filter((row) => row.verdict === "red" || row.verdict === "sealed").length;
  const passedAssertions = pass435.queryAssertions.filter((item) => item.passed).length;
  const assertionScore = clamp((passedAssertions / Math.max(1, pass435.queryAssertions.length)) * 100);
  const missingCritical = pass435.missingDataReplay.filter((item) => item.mustSurfaceInPdf || item.field.toLowerCase().includes("price") || item.field.toLowerCase().includes("provider")).length;
  const liveReadiness = pass435.liveReadinessScore;
  const fakeLiveBudget = clamp(100 - pass435.fakeLiveRisk);
  const evidenceSlo = clamp(providerScore * 0.46 + assertionScore * 0.34 + greenRows * 8 - redOrSealedRows * 7 - missingCritical * 4);
  const narrativeSlo = clamp(100 - missingCritical * 6 - (pass435.fakeLiveRisk > 60 ? 18 : 0) - (pass435.releaseMode === "block_pdf_until_probe" ? 22 : 0));
  const customerSafetySlo = clamp(78 + (pass435.releaseMode === "release_live_readout" ? 12 : 0) - (pass435.fakeLiveRisk > 50 ? 18 : 0) - missingCritical * 3);
  const structuredOutputReadiness = clamp(evidenceSlo * 0.42 + narrativeSlo * 0.28 + customerSafetySlo * 0.18 + fakeLiveBudget * 0.12);
  const conflict = pass435.queryAssertions.some((item) => item.id.includes("conflict") && !item.passed);
  const operatorInterrupt = conflict || pass435.releaseMode === "block_pdf_until_probe" || structuredOutputReadiness < 34;
  const graphNodes = [
    node({ id: "observe", label: "Observe live payload", score: liveReadiness, evidence: `PASS435 readiness ${liveReadiness}/100.`, repair: "Re-run provider probe when score is low." }),
    node({ id: "normalize", label: "Normalize provider rows", score: providerScore, evidence: `${pass435.providerRealityRows.length} provider rows normalized.`, repair: "Map provider payloads into one schema before PDF/chat." }),
    node({ id: "arbitrate", label: "Arbitrate source consensus", score: evidenceSlo, critical: conflict, evidence: `${greenRows} green rows, ${redOrSealedRows} red/sealed rows.`, repair: "Use second provider or downgrade to facts-only." }),
    node({ id: "verify", label: "Verify answer contract", score: structuredOutputReadiness, evidence: `${passedAssertions}/${pass435.queryAssertions.length} assertions passed.`, repair: "Lock output to required schema and cut unsupported claims." }),
    node({ id: "narrate", label: "Narrate with evidence lattice", score: narrativeSlo, evidence: `${missingCritical} high-priority missing items must remain visible.`, repair: "Keep brief, sources, missing data and next step separated." }),
    node({ id: "escalate", label: "Human/operator interrupt", score: operatorInterrupt ? 28 : 86, critical: operatorInterrupt, evidence: operatorInterrupt ? "Interrupt required before strong public wording." : "No operator interrupt required for bounded readout.", repair: "Pause strong claims; show missing data and operator action." }),
  ];
  const worldBrainScore = clamp(structuredOutputReadiness * 0.52 + liveReadiness * 0.28 + fakeLiveBudget * 0.2);
  const releaseDecision: Pass436ReleaseDecision = operatorInterrupt
    ? pass435.releaseMode === "block_pdf_until_probe" ? "operator_interrupt" : "facts_only_interrupt"
    : worldBrainScore >= 78 && pass435.releaseMode === "release_live_readout"
      ? "ship_verified_readout"
      : "ship_missing_data_readout";
  const alertPolicy = releaseDecision === "ship_verified_readout"
    ? "silent_ok"
    : releaseDecision === "ship_missing_data_readout"
      ? "customer_missing_data"
      : releaseDecision === "facts_only_interrupt"
        ? "operator_review"
        : "block_release";
  const reasons = [
    conflict ? "source_conflict" : undefined,
    pass435.releaseMode === "block_pdf_until_probe" ? "probe_required" : undefined,
    structuredOutputReadiness < 50 ? "structured_output_low" : undefined,
    pass435.fakeLiveRisk > 55 ? "fake_live_budget_low" : undefined,
    missingCritical ? `missing_visible_${missingCritical}` : undefined,
  ].filter(Boolean) as string[];
  return {
    version: "world-brain-slo-graph-runtime",
    generatedAt: new Date().toISOString(),
    releaseDecision,
    worldBrainScore,
    structuredOutputReadiness,
    graphNodes,
    sloEnvelope: {
      providerSlo: providerScore,
      evidenceSlo,
      narrativeSlo,
      fakeLiveErrorBudgetRemaining: fakeLiveBudget,
      customerSafetySlo,
      alertPolicy,
    },
    structuredAnswerSchema: {
      schemaMode: "json_schema_locked",
      requiredKeys: ["asset", "risk", "sources", "missingData", "confidence", "nextStep", "signature"],
      maxSentences: releaseDecision === "ship_verified_readout" ? 8 : 5,
      forbiddenClaims: ["guaranteed_price", "buy_sell_instruction", "hidden_provider", "sentient_ai"],
      onePayload: true,
    },
    innovationStack: [
      { id: "evidence_lattice", label: "Evidence-bonded narrative lattice", purpose: "Every sentence must map to source, risk, missing data or next step.", enabled: true },
      { id: "confidence_escrow", label: "Confidence escrow", purpose: "High confidence is held back until provider quorum and assertions pass.", enabled: pass435.releaseMode !== "release_live_readout" },
      { id: "shadow_twin_replay", label: "Shadow twin replay", purpose: "Replay memory against live provider rows before adaptive learning affects output.", enabled: true },
      { id: "operator_interrupt", label: "Operator interrupt", purpose: "Pause strong public claims when conflict, fake-live risk or probe gaps appear.", enabled: operatorInterrupt },
    ],
    interruptPolicy: {
      humanInLoopRequired: operatorInterrupt,
      reasons: reasons.length ? reasons : ["none"],
      resumeHint: operatorInterrupt ? "Resolve provider conflict or rerun probe before live-style PDF/chat." : "Proceed with bounded customer-facing readout.",
    },
    customerReadout: releaseDecision === "ship_verified_readout"
      ? "Velmère checked multiple provider lanes and can show a verified risk readout."
      : releaseDecision === "ship_missing_data_readout"
        ? "Velmère can show the readout, but missing data remains visible."
        : releaseDecision === "facts_only_interrupt"
          ? "Velmère will answer with facts only because the evidence graph is limited."
          : "Velmère must rerun or review provider probes before a live-style report.",
    operatorReadout: `PASS436 ${releaseDecision}; world score ${worldBrainScore}/100; structured ${structuredOutputReadiness}/100; alert ${alertPolicy}; interrupt ${operatorInterrupt ? "yes" : "no"}.`,
  };
}

export function buildPass436LensWorldBrainContract(input: {
  locale: "pl" | "de" | "en";
  pass435: Pass435LensLiveQueryContract;
}): Pass436LensWorldBrainContract {
  const releaseDecision: Pass436ReleaseDecision = input.pass435.releaseMode === "release_live_readout"
    ? "ship_verified_readout"
    : input.pass435.releaseMode === "release_partial_with_missing"
      ? "ship_missing_data_readout"
      : input.pass435.releaseMode === "facts_only_no_live_claim"
        ? "facts_only_interrupt"
        : "operator_interrupt";
  const customerLine = input.locale === "pl"
    ? "Podgląd PDF pokazuje tylko brief, źródła, braki danych, następny krok i podpis Velmère."
    : input.locale === "de"
      ? "Die PDF-Vorschau zeigt nur Kurzbericht, Quellen, fehlende Daten, nächsten Schritt und Velmère-Signatur."
      : "The PDF preview shows only brief, sources, missing data, next step and Velmère signature.";
  return {
    version: "pass436-lens-world-brain-contract",
    locale: input.locale,
    graphRuntime: "browser_lens_pdf",
    structuredOutput: "json_schema_locked",
    releaseDecision,
    onePayload: true,
    noFakeLive: true,
    maxSuggestions: 3,
    customerLabel: "pdf_preview",
    customerLine,
    technicalTextHidden: true,
  };
}
