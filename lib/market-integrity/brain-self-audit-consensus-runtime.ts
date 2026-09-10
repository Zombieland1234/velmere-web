import type { TokenRiskResult } from "./risk-types";
import type { Pass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";
import type { Pass427BrainBugfixIntegrityRuntime } from "./brain-bugfix-integrity-runtime";
import type { Pass428BrainNarrativeCoherenceRuntime } from "./brain-narrative-coherence-runtime";

export type Pass429AnswerMode = "answer_ready" | "cautious_answer" | "sealed_facts_only" | "operator_review";
export type Pass429ConsensusState = "quorum" | "single_source" | "conflict" | "insufficient";
export type Pass429RepairAction = "keep" | "cap_confidence" | "surface_missing" | "dedupe" | "seal_claims" | "request_second_provider" | "operator_review";

export type Pass429BrainSelfAuditConsensusRuntime = {
  version: "brain-self-audit-consensus-runtime";
  generatedAt: string;
  answerMode: Pass429AnswerMode;
  consensusState: Pass429ConsensusState;
  selfAuditScore: number;
  truthContract: {
    onePayload: true;
    oneLocaleBranch: true;
    evidenceBeforeNarrative: true;
    noSecondCopyEngine: true;
    noSentienceClaim: true;
    noBuySellInstruction: true;
  };
  selfAuditChecks: Array<{
    id: string;
    ok: boolean;
    severity: "info" | "watch" | "repair" | "sealed";
    reason: string;
  }>;
  confidenceEnvelope: {
    rawResultConfidence: number;
    sourceConfidence: number;
    coherenceCap: number;
    selfAuditCap: number;
    publicAnswerConfidence: number;
    band: "low" | "guarded" | "usable" | "strong";
    reason: string;
  };
  evidenceCoverage: {
    evidenceRailCount: number;
    missingDataCount: number;
    sourceCount: number;
    confirmedSecondProvider: boolean;
    traceability: "full" | "partial" | "thin";
  };
  answerPolicy: {
    maxSentences: number;
    maxTokensApprox: number;
    allowedStyle: "factual" | "bounded" | "concise";
    mustMentionMissingData: boolean;
    mustMentionSecondProvider: boolean;
    blockedPhrases: string[];
  };
  memoryLearningGate: {
    retentionYears: number;
    learningAllowed: boolean;
    writeMode: "observation_only" | "shadow_write" | "bounded_write" | "adaptive_write_capped";
    adaptiveInfluenceCap: number;
    reason: string;
  };
  repairPlan: Array<{
    id: string;
    action: Pass429RepairAction;
    target: "answer" | "pdf" | "memory" | "sources" | "risk" | "locale";
    reason: string;
  }>;
  operatorSummary: string;
};

export type Pass429LensSelfAuditContract = {
  version: "pass429-lens-self-audit-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  previewLabel: string;
  visibleSuggestionLimit: 3;
  exactPayload: true;
  customerFacingOnly: true;
  answerMode: "preview_only" | "cautious_summary" | "sealed_summary";
  sourceCount: number;
  missingDataCount: number;
  checksum: string;
  blockedTechnicalCopy: string[];
  repairNotes: string[];
};

const BLOCKED_ANSWER_PHRASES = [
  "buy now",
  "sell now",
  "guaranteed profit",
  "guaranteed price",
  "risk free",
  "i am conscious",
  "i feel",
  "second provider confirmed when missing",
  "hidden data replacement",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function severityCost(severity: "info" | "watch" | "repair" | "sealed") {
  if (severity === "sealed") return 38;
  if (severity === "repair") return 18;
  if (severity === "watch") return 8;
  return 0;
}

function confidenceBand(value: number): Pass429BrainSelfAuditConsensusRuntime["confidenceEnvelope"]["band"] {
  if (value >= 82) return "strong";
  if (value >= 64) return "usable";
  if (value >= 42) return "guarded";
  return "low";
}

function consensusState(brain: Pass422BrainMemoryCore, pass428: Pass428BrainNarrativeCoherenceRuntime): Pass429ConsensusState {
  if (brain.sourceGenome.sourceCount <= 0) return "insufficient";
  if (pass428.confidenceCalibration.effectiveConfidence < 34 || brain.pass424.contradictionScore >= 70) return "conflict";
  if (brain.sourceGenome.secondProvider !== "confirmed") return "single_source";
  return "quorum";
}

function answerMode(input: {
  consensus: Pass429ConsensusState;
  pass427: Pass427BrainBugfixIntegrityRuntime;
  pass428: Pass428BrainNarrativeCoherenceRuntime;
  selfAuditScore: number;
}): Pass429AnswerMode {
  if (input.consensus === "insufficient" || input.pass427.runtimeMode === "sealed") return "sealed_facts_only";
  if (input.consensus === "conflict" || input.pass428.coherenceMode === "sealed") return "operator_review";
  if (input.consensus === "single_source" || input.selfAuditScore < 74 || input.pass428.coherenceMode === "guarded") return "cautious_answer";
  return "answer_ready";
}

export function buildPass429BrainSelfAuditConsensusRuntime(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  pass427: Pass427BrainBugfixIntegrityRuntime;
  pass428: Pass428BrainNarrativeCoherenceRuntime;
}): Pass429BrainSelfAuditConsensusRuntime {
  const { result, brain, pass427, pass428 } = input;
  const sourceCount = brain.sourceGenome.sourceCount;
  const confirmedSecondProvider = brain.sourceGenome.secondProvider === "confirmed";
  const missingDataCount = brain.missingData.length;
  const evidenceRailCount = brain.evidenceRail.length;
  const consensus = consensusState(brain, pass428);
  const traceability: Pass429BrainSelfAuditConsensusRuntime["evidenceCoverage"]["traceability"] = evidenceRailCount >= 6 && sourceCount >= 2
    ? "full"
    : evidenceRailCount >= 3 || sourceCount >= 1
      ? "partial"
      : "thin";

  const checks: Pass429BrainSelfAuditConsensusRuntime["selfAuditChecks"] = [
    {
      id: "finite_payload_guard",
      ok: Number.isFinite(result.score) && Number.isFinite(result.confidence) && Number.isFinite(brain.score),
      severity: Number.isFinite(result.score) && Number.isFinite(result.confidence) && Number.isFinite(brain.score) ? "info" : "sealed",
      reason: "Score, confidence and brain score must be finite before the answer layer can speak.",
    },
    {
      id: "evidence_before_narrative_guard",
      ok: evidenceRailCount >= 3,
      severity: evidenceRailCount >= 3 ? "info" : evidenceRailCount > 0 ? "watch" : "sealed",
      reason: `${evidenceRailCount} evidence rail item(s) are attached to the answer payload.`,
    },
    {
      id: "second_provider_guard",
      ok: confirmedSecondProvider,
      severity: confirmedSecondProvider ? "info" : sourceCount ? "watch" : "sealed",
      reason: confirmedSecondProvider ? "Second provider lane is confirmed." : "Second provider lane is missing or partial, so answer confidence is capped.",
    },
    {
      id: "coherence_runtime_guard",
      ok: pass428.coherenceMode === "clean" || pass428.coherenceMode === "compressed",
      severity: pass428.coherenceMode === "sealed" ? "sealed" : pass428.coherenceMode === "guarded" ? "repair" : "info",
      reason: `Narrative coherence runtime is ${pass428.coherenceMode}.`,
    },
    {
      id: "memory_overfit_guard",
      ok: pass427.memorySafety.influenceCap <= 0.42 && brain.memory.learningWeight <= 0.28,
      severity: pass427.memorySafety.influenceCap <= 0.42 && brain.memory.learningWeight <= 0.28 ? "info" : "repair",
      reason: `Memory influence cap ${pass427.memorySafety.influenceCap}; learning weight ${brain.memory.learningWeight}.`,
    },
    {
      id: "claim_budget_guard",
      ok: pass428.publicClaimBudget.allowedTone !== "bounded" || pass428.confidenceCalibration.effectiveConfidence >= 60,
      severity: pass428.confidenceCalibration.effectiveConfidence < 42 ? "sealed" : pass428.confidenceCalibration.effectiveConfidence < 60 ? "watch" : "info",
      reason: `Effective confidence is ${pass428.confidenceCalibration.effectiveConfidence}; public tone is ${pass428.publicClaimBudget.allowedTone}.`,
    },
    {
      id: "field_budget_guard",
      ok: pass428.fieldBudgetSeal.basic === 10 && pass428.fieldBudgetSeal.pro === 14 && pass428.fieldBudgetSeal.advanced === 20,
      severity: "info",
      reason: "Basic/Pro/Advanced stay 10/14/20 fields and share one truth source.",
    },
  ];

  const totalCost = checks.reduce((sum, check) => sum + (check.ok ? 0 : severityCost(check.severity)), 0);
  const selfAuditScore = clamp(100 - totalCost + Math.min(10, evidenceRailCount) - Math.min(10, missingDataCount * 1.2));
  const rawResultConfidence = clamp(result.confidence ?? 0);
  const sourceConfidence = clamp(brain.sourceGenome.confidence);
  const selfAuditCap = checks.some((check) => !check.ok && check.severity === "sealed")
    ? 28
    : checks.some((check) => !check.ok && check.severity === "repair")
      ? 58
      : checks.some((check) => !check.ok && check.severity === "watch")
        ? 74
        : 92;
  const publicAnswerConfidence = clamp(Math.min(rawResultConfidence, sourceConfidence, pass428.confidenceCalibration.effectiveConfidence, selfAuditCap));
  const mode = answerMode({ consensus, pass427, pass428, selfAuditScore });

  const repairPlan: Pass429BrainSelfAuditConsensusRuntime["repairPlan"] = [];
  if (!confirmedSecondProvider) repairPlan.push({ id: "request_second_provider", action: "request_second_provider", target: "sources", reason: "Attach a second provider before allowing strong public confidence." });
  if (missingDataCount) repairPlan.push({ id: "surface_missing_data", action: "surface_missing", target: "pdf", reason: `${missingDataCount} missing-data item(s) must remain visible in PDF/chat.` });
  if (pass428.narrativeHealth.duplicateBodyCount) repairPlan.push({ id: "dedupe_narrative", action: "dedupe", target: "answer", reason: "Repeated PDF/chat sections should be collapsed before display." });
  if (mode === "sealed_facts_only" || mode === "operator_review") repairPlan.push({ id: "seal_claims", action: "seal_claims", target: "answer", reason: `Answer mode ${mode} allows facts only or operator review.` });
  if (pass427.runtimeMode !== "clean") repairPlan.push({ id: "operator_review_runtime", action: "operator_review", target: "risk", reason: `PASS427 runtime is ${pass427.runtimeMode}.` });
  if (!repairPlan.length) repairPlan.push({ id: "keep_self_audited_answer", action: "keep", target: "answer", reason: "Payload, confidence, memory and narrative checks are aligned." });

  const mustMentionMissingData = missingDataCount > 0 || pass427.runtimeMode !== "clean";
  const mustMentionSecondProvider = !confirmedSecondProvider;
  const maxSentences = mode === "answer_ready" ? 8 : mode === "cautious_answer" ? 5 : 3;
  const learningAllowed = pass427.memorySafety.canAdapt && mode === "answer_ready";
  const writeMode: Pass429BrainSelfAuditConsensusRuntime["memoryLearningGate"]["writeMode"] = learningAllowed
    ? "adaptive_write_capped"
    : brain.memory.overfitGuard === "limited"
      ? "bounded_write"
      : brain.memory.overfitGuard === "shadow"
        ? "shadow_write"
        : "observation_only";

  return {
    version: "brain-self-audit-consensus-runtime",
    generatedAt: new Date().toISOString(),
    answerMode: mode,
    consensusState: consensus,
    selfAuditScore: round(selfAuditScore),
    truthContract: {
      onePayload: true,
      oneLocaleBranch: true,
      evidenceBeforeNarrative: true,
      noSecondCopyEngine: true,
      noSentienceClaim: true,
      noBuySellInstruction: true,
    },
    selfAuditChecks: checks,
    confidenceEnvelope: {
      rawResultConfidence: round(rawResultConfidence),
      sourceConfidence: round(sourceConfidence),
      coherenceCap: round(pass428.confidenceCalibration.displayedConfidenceCap),
      selfAuditCap: round(selfAuditCap),
      publicAnswerConfidence: round(publicAnswerConfidence),
      band: confidenceBand(publicAnswerConfidence),
      reason: "Public answer confidence is capped by raw result confidence, source confidence, narrative coherence and PASS429 self-audit checks.",
    },
    evidenceCoverage: {
      evidenceRailCount,
      missingDataCount,
      sourceCount,
      confirmedSecondProvider,
      traceability,
    },
    answerPolicy: {
      maxSentences,
      maxTokensApprox: maxSentences * 36,
      allowedStyle: mode === "answer_ready" ? "bounded" : mode === "cautious_answer" ? "concise" : "factual",
      mustMentionMissingData,
      mustMentionSecondProvider,
      blockedPhrases: BLOCKED_ANSWER_PHRASES,
    },
    memoryLearningGate: {
      retentionYears: brain.longTermMemory.retentionYears,
      learningAllowed,
      writeMode,
      adaptiveInfluenceCap: round(learningAllowed ? pass427.memorySafety.influenceCap : Math.min(0.12, pass427.memorySafety.influenceCap), 3),
      reason: learningAllowed
        ? "Memory may influence future context in capped mode because self-audit, source quorum and narrative coherence are clean."
        : "Memory remains durable context, but current evidence and source quorum dominate the answer.",
    },
    repairPlan,
    operatorSummary: `PASS429 ${mode}; consensus ${consensus}; audit ${round(selfAuditScore)}; public confidence ${round(publicAnswerConfidence)}; traceability ${traceability}.`,
  };
}

export function buildPass429LensSelfAuditContract(input: {
  locale: "pl" | "en" | "de";
  checksum: string;
  sourceCount: number;
  missingDataCount: number;
  duplicateBodyCount?: number;
  localeLeakCount?: number;
}): Pass429LensSelfAuditContract {
  const hasSourceQuorum = input.sourceCount >= 2;
  const cleanNarrative = !input.duplicateBodyCount && !input.localeLeakCount;
  const answerMode: Pass429LensSelfAuditContract["answerMode"] = hasSourceQuorum && cleanNarrative
    ? "cautious_summary"
    : input.sourceCount > 0
      ? "sealed_summary"
      : "preview_only";
  const repairNotes = [
    hasSourceQuorum ? null : "second provider stays visible as missing/partial before stronger PDF copy",
    input.missingDataCount ? `${input.missingDataCount} missing-data item(s) must remain visible` : null,
    input.duplicateBodyCount ? `${input.duplicateBodyCount} duplicate body item(s) should be suppressed` : null,
    input.localeLeakCount ? `${input.localeLeakCount} locale leak item(s) should be repaired` : null,
  ].filter(Boolean) as string[];

  return {
    version: "pass429-lens-self-audit-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    previewLabel: input.locale === "pl" ? "Podgląd PDF" : input.locale === "de" ? "PDF-Vorschau" : "PDF preview",
    visibleSuggestionLimit: 3,
    exactPayload: true,
    customerFacingOnly: true,
    answerMode,
    sourceCount: input.sourceCount,
    missingDataCount: input.missingDataCount,
    checksum: input.checksum,
    blockedTechnicalCopy: ["same resolved payload", "no second generator", "locale branch", "checksum internals"],
    repairNotes: repairNotes.length ? repairNotes : ["clean Lens preview/download self-audit contract"],
  };
}
