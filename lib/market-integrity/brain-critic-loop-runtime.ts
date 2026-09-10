import type { TokenRiskResult } from "./risk-types";
import type { Pass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";
import type { Pass428BrainNarrativeCoherenceRuntime } from "./brain-narrative-coherence-runtime";
import type { Pass429BrainSelfAuditConsensusRuntime } from "./brain-self-audit-consensus-runtime";
import type { Pass430BrainAnswerVerifierRuntime, Pass430LensAnswerProofContract } from "./brain-answer-verifier-runtime";

export type Pass431CriticMode = "clean" | "compressed" | "guarded" | "sealed";
export type Pass431FinalAnswerMode = "publish_ready" | "publish_bounded" | "facts_only" | "operator_review";
export type Pass431CriticRepairAction =
  | "keep"
  | "dedupe"
  | "shorten"
  | "lower_confidence"
  | "surface_source_gap"
  | "surface_missing_data"
  | "seal_claim"
  | "operator_review";

export type Pass431BrainCriticLoopRuntime = {
  version: "brain-critic-loop-runtime";
  generatedAt: string;
  criticMode: Pass431CriticMode;
  finalAnswerMode: Pass431FinalAnswerMode;
  criticScore: number;
  finalPublicConfidence: number;
  criticContract: {
    criticBeforePublicAnswer: true;
    onePayloadOnly: true;
    noSecondNarrativeGenerator: true;
    fieldBudgetLocked: { basic: 10; pro: 14; advanced: 20 };
    memoryMayContextButNotOverride: true;
    noSentienceClaim: true;
    noBuySellInstruction: true;
  };
  repetitionAudit: {
    repeatedLedgerIds: string[];
    repeatedMissingData: string[];
    duplicateRisk: "none" | "low" | "medium" | "high";
  };
  claimAudit: {
    blockedClaimHits: string[];
    tooStrongForConfidence: boolean;
    publicClaimCeiling: "normal" | "bounded" | "facts_only";
    reason: string;
  };
  sourceAudit: {
    sourceState: "quorum" | "single_source" | "conflict" | "missing";
    secondProvider: "confirmed" | "partial" | "missing";
    missingDataCount: number;
    evidenceCount: number;
    liveSourcePriority: true;
  };
  fieldBudgetGuard: {
    basic: 10;
    pro: 14;
    advanced: 20;
    currentFieldCount: number;
    overflow: boolean;
    reason: string;
  };
  memoryReplayGate: {
    retentionYears: number;
    learningWeight: number;
    allowedRole: "context_only" | "bounded_context" | "adaptive_capped";
    reason: string;
  };
  pdfChatInvariant: {
    samePayload: true;
    sameLocaleBranch: true;
    sameSectionOrder: true;
    customerFacingOnly: true;
    deterministicSeed: string;
  };
  criticChecklist: Array<{
    id: string;
    ok: boolean;
    severity: "info" | "watch" | "repair" | "sealed";
    reason: string;
  }>;
  repairPlan: Array<{
    id: string;
    action: Pass431CriticRepairAction;
    target: "answer" | "pdf" | "memory" | "source" | "field_budget" | "safety";
    reason: string;
  }>;
  publicSummary: string;
};

export type Pass431LensCriticContract = {
  version: "pass431-lens-critic-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  criticMode: "clean" | "bounded" | "sealed";
  visibleSuggestionLimit: 3;
  customerFacingOnly: true;
  noTechnicalCustomerCopy: true;
  sectionBudget: {
    expected: 6;
    actual: number;
    overflow: boolean;
  };
  repetitionAudit: {
    duplicateTitles: string[];
    duplicateBodies: number;
    maxBodyChars: number;
  };
  finalPreviewLabel: string;
  customerSummary: string;
  repairNotes: string[];
};

const BLOCKED_PUBLIC_CLAIMS = [
  "guarantee",
  "guaranteed",
  "risk free",
  "buy now",
  "sell now",
  "financial advice",
  "certain prediction",
  "alive",
  "conscious",
  "hidden provider",
  "replaced missing data",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function criticSeed(input: { result: TokenRiskResult; brain: Pass422BrainMemoryCore; pass430: Pass430BrainAnswerVerifierRuntime }) {
  const raw = [
    input.result.token.symbol,
    input.result.token.marketId ?? input.result.token.tokenAddress ?? "asset",
    input.result.score,
    input.brain.sourceGenome.confidence,
    input.brain.sourceGenome.secondProvider,
    input.pass430.proofOfAnswerContract.deterministicSeed,
    input.pass430.proofState,
  ].join("|");
  let hash = 5381;
  for (let index = 0; index < raw.length; index += 1) hash = ((hash << 5) + hash) ^ raw.charCodeAt(index);
  return `critic-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function severityPenalty(severity: "info" | "watch" | "repair" | "sealed") {
  if (severity === "sealed") return 48;
  if (severity === "repair") return 24;
  if (severity === "watch") return 10;
  return 0;
}

function sourceState(brain: Pass422BrainMemoryCore, pass429: Pass429BrainSelfAuditConsensusRuntime): Pass431BrainCriticLoopRuntime["sourceAudit"]["sourceState"] {
  if (brain.sourceGenome.sourceCount <= 0) return "missing";
  if (pass429.consensusState === "conflict") return "conflict";
  if (brain.sourceGenome.sourceCount >= 2 && brain.sourceGenome.secondProvider === "confirmed") return "quorum";
  return "single_source";
}

function finalAnswerMode(criticMode: Pass431CriticMode): Pass431FinalAnswerMode {
  if (criticMode === "clean") return "publish_ready";
  if (criticMode === "compressed") return "publish_bounded";
  if (criticMode === "guarded") return "facts_only";
  return "operator_review";
}

export function buildPass431BrainCriticLoopRuntime(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  pass428: Pass428BrainNarrativeCoherenceRuntime;
  pass429: Pass429BrainSelfAuditConsensusRuntime;
  pass430: Pass430BrainAnswerVerifierRuntime;
}): Pass431BrainCriticLoopRuntime {
  const { result, brain, pass428, pass429, pass430 } = input;
  const sourceMode = sourceState(brain, pass429);
  const seed = criticSeed({ result, brain, pass430 });
  const repeatedLedgerIds = uniq(pass430.proofLedger.map((entry) => entry.id)).length === pass430.proofLedger.length
    ? []
    : pass430.proofLedger.map((entry) => entry.id).filter((id, index, list) => list.indexOf(id) !== index);
  const repeatedMissingData = brain.missingData.filter((item, index, list) => list.indexOf(item) !== index);
  const duplicateRisk: Pass431BrainCriticLoopRuntime["repetitionAudit"]["duplicateRisk"] = repeatedLedgerIds.length + repeatedMissingData.length >= 4
    ? "high"
    : repeatedLedgerIds.length + repeatedMissingData.length >= 2
      ? "medium"
      : repeatedLedgerIds.length + repeatedMissingData.length === 1
        ? "low"
        : "none";

  const blockedClaimHits = pass430.answerEnvelope.blockedClaims.filter((claim) =>
    BLOCKED_PUBLIC_CLAIMS.some((blocked) => claim.toLowerCase().includes(blocked)),
  );
  const publicConfidence = pass429.confidenceEnvelope.publicAnswerConfidence;
  const tooStrongForConfidence = pass430.responseMode === "proof_answer" && (publicConfidence < 62 || sourceMode !== "quorum");
  const publicClaimCeiling: Pass431BrainCriticLoopRuntime["claimAudit"]["publicClaimCeiling"] = pass430.proofState === "sealed" || sourceMode === "missing"
    ? "facts_only"
    : tooStrongForConfidence || sourceMode !== "quorum" || pass428.coherenceMode === "guarded"
      ? "bounded"
      : "normal";

  const currentFieldCount = Math.max(0, Math.min(32, brain.evidenceRail.length + Math.min(8, brain.missingData.length) + 4));
  const fieldOverflow = currentFieldCount > 20;
  const memoryLearningWeight = brain.memory.learningWeight;
  const allowedRole: Pass431BrainCriticLoopRuntime["memoryReplayGate"]["allowedRole"] =
    pass430.memoryLearningFence.adaptiveLearningAllowed && memoryLearningWeight <= 0.28 && sourceMode === "quorum"
      ? "adaptive_capped"
      : memoryLearningWeight <= 0.18
        ? "bounded_context"
        : "context_only";

  const criticChecklist: Pass431BrainCriticLoopRuntime["criticChecklist"] = [
    {
      id: "source_quorum_before_claim",
      ok: sourceMode === "quorum" || pass430.responseMode !== "proof_answer",
      severity: sourceMode === "missing" ? "sealed" : sourceMode === "conflict" ? "repair" : "watch",
      reason: `Source state ${sourceMode}; second provider ${brain.sourceGenome.secondProvider}.`,
    },
    {
      id: "confidence_matches_voice",
      ok: !tooStrongForConfidence,
      severity: tooStrongForConfidence ? "repair" : "info",
      reason: `Public confidence ${round(publicConfidence)} and response mode ${pass430.responseMode}.`,
    },
    {
      id: "no_repetition_leak",
      ok: duplicateRisk === "none" || duplicateRisk === "low",
      severity: duplicateRisk === "high" ? "repair" : duplicateRisk === "medium" ? "watch" : "info",
      reason: `Duplicate risk ${duplicateRisk}; repeated ledger ${repeatedLedgerIds.length}; repeated missing ${repeatedMissingData.length}.`,
    },
    {
      id: "field_budget_locked",
      ok: !fieldOverflow,
      severity: fieldOverflow ? "repair" : "info",
      reason: `Current field pressure ${currentFieldCount}; public field budgets stay Basic 10 / Pro 14 / Advanced 20.`,
    },
    {
      id: "memory_replay_fenced",
      ok: allowedRole !== "context_only" || memoryLearningWeight <= 0.36,
      severity: memoryLearningWeight > 0.36 ? "repair" : "info",
      reason: `Long memory role ${allowedRole}; learning weight ${round(memoryLearningWeight, 3)}; live sources stay priority.`,
    },
    {
      id: "coherence_not_sealed",
      ok: pass428.coherenceMode !== "sealed",
      severity: pass428.coherenceMode === "sealed" ? "sealed" : pass428.coherenceMode === "guarded" ? "watch" : "info",
      reason: `Narrative coherence ${pass428.coherenceMode}; duplicate body count ${pass428.narrativeHealth.duplicateBodyCount}.`,
    },
  ];

  const totalPenalty = criticChecklist.reduce((sum, item) => sum + (item.ok ? 0 : severityPenalty(item.severity)), 0);
  const criticScore = clamp(100 - totalPenalty - Math.min(14, brain.missingData.length * 1.2) + Math.min(8, brain.evidenceRail.length));
  const hasSealed = criticChecklist.some((item) => !item.ok && item.severity === "sealed");
  const hasRepair = criticChecklist.some((item) => !item.ok && item.severity === "repair");
  const criticMode: Pass431CriticMode = hasSealed
    ? "sealed"
    : hasRepair || publicClaimCeiling === "facts_only"
      ? "guarded"
      : criticScore >= 84 && publicClaimCeiling === "normal"
        ? "clean"
        : "compressed";

  const finalPublicConfidence = clamp(Math.min(
    publicConfidence,
    pass428.confidenceCalibration.displayedConfidenceCap,
    criticMode === "clean" ? 100 : criticMode === "compressed" ? 72 : criticMode === "guarded" ? 52 : 32,
  ));

  const repairPlan: Pass431BrainCriticLoopRuntime["repairPlan"] = [];
  if (sourceMode !== "quorum") repairPlan.push({ id: "surface_source_gap", action: "surface_source_gap", target: "source", reason: `Source state is ${sourceMode}; keep second-provider gap visible.` });
  if (brain.missingData.length) repairPlan.push({ id: "surface_missing_data", action: "surface_missing_data", target: "pdf", reason: `${brain.missingData.length} missing data item(s) remain visible.` });
  if (duplicateRisk === "medium" || duplicateRisk === "high") repairPlan.push({ id: "dedupe_repeated_rails", action: "dedupe", target: "answer", reason: "Repeated ledger or missing-data text should be deduped before public output." });
  if (tooStrongForConfidence) repairPlan.push({ id: "lower_claim_confidence", action: "lower_confidence", target: "answer", reason: "Response voice is stronger than source confidence allows." });
  if (fieldOverflow) repairPlan.push({ id: "cap_field_budget", action: "shorten", target: "field_budget", reason: "Output pressure exceeds Advanced 20-field budget." });
  if (criticMode === "guarded") repairPlan.push({ id: "seal_strong_claims", action: "seal_claim", target: "safety", reason: "Critic loop guarded the public answer; use facts-only or bounded wording." });
  if (criticMode === "sealed") repairPlan.push({ id: "operator_review_required", action: "operator_review", target: "safety", reason: "Critical proof gap requires operator review before public expansion." });
  if (!repairPlan.length) repairPlan.push({ id: "keep_critic_clean", action: "keep", target: "answer", reason: "Critic loop passed; publish clean bounded answer from the same payload." });

  return {
    version: "brain-critic-loop-runtime",
    generatedAt: new Date().toISOString(),
    criticMode,
    finalAnswerMode: finalAnswerMode(criticMode),
    criticScore: round(criticScore),
    finalPublicConfidence: round(finalPublicConfidence),
    criticContract: {
      criticBeforePublicAnswer: true,
      onePayloadOnly: true,
      noSecondNarrativeGenerator: true,
      fieldBudgetLocked: { basic: 10, pro: 14, advanced: 20 },
      memoryMayContextButNotOverride: true,
      noSentienceClaim: true,
      noBuySellInstruction: true,
    },
    repetitionAudit: {
      repeatedLedgerIds: uniq(repeatedLedgerIds),
      repeatedMissingData: uniq(repeatedMissingData),
      duplicateRisk,
    },
    claimAudit: {
      blockedClaimHits,
      tooStrongForConfidence,
      publicClaimCeiling,
      reason: publicClaimCeiling === "normal"
        ? "Claims can use normal guarded Velmère voice."
        : publicClaimCeiling === "bounded"
          ? "Claims are bounded because source quorum, confidence or coherence is not strong enough."
          : "Only facts are allowed until source proof improves.",
    },
    sourceAudit: {
      sourceState: sourceMode,
      secondProvider: brain.sourceGenome.secondProvider,
      missingDataCount: brain.missingData.length,
      evidenceCount: brain.evidenceRail.length,
      liveSourcePriority: true,
    },
    fieldBudgetGuard: {
      basic: 10,
      pro: 14,
      advanced: 20,
      currentFieldCount,
      overflow: fieldOverflow,
      reason: fieldOverflow ? "Compress Advanced output before showing public fields." : "Field budget is inside the public 10/14/20 contract.",
    },
    memoryReplayGate: {
      retentionYears: brain.longTermMemory.retentionYears,
      learningWeight: round(memoryLearningWeight, 3),
      allowedRole,
      reason: allowedRole === "adaptive_capped"
        ? "Long memory may adapt in capped mode because quorum and proof are present."
        : allowedRole === "bounded_context"
          ? "Long memory can support context but cannot steer live risk by itself."
          : "Long memory is retained for replay/context only until stronger source proof exists.",
    },
    pdfChatInvariant: {
      samePayload: true,
      sameLocaleBranch: true,
      sameSectionOrder: true,
      customerFacingOnly: true,
      deterministicSeed: seed,
    },
    criticChecklist,
    repairPlan,
    publicSummary: `PASS431 critic ${criticMode}; final ${finalAnswerMode(criticMode)}; score ${round(criticScore)}; confidence ${round(finalPublicConfidence)}; source ${sourceMode}; memory ${allowedRole}.`,
  };
}

export function buildPass431LensCriticContract(input: {
  locale: "pl" | "en" | "de";
  pass430: Pass430LensAnswerProofContract;
  sections: Array<{ title: string; body: string }>;
}): Pass431LensCriticContract {
  const titleCounts = new Map<string, number>();
  for (const section of input.sections) titleCounts.set(section.title.toLowerCase(), (titleCounts.get(section.title.toLowerCase()) ?? 0) + 1);
  const duplicateTitles = Array.from(titleCounts.entries()).filter(([, count]) => count > 1).map(([title]) => title);
  const bodies = input.sections.map((section) => section.body.trim().toLowerCase()).filter(Boolean);
  const duplicateBodies = bodies.filter((body, index, list) => list.indexOf(body) !== index).length;
  const maxBodyChars = Math.max(0, ...input.sections.map((section) => section.body.length));
  const overflow = input.sections.length > 6 || maxBodyChars > input.pass430.maxSectionChars;
  const criticMode: Pass431LensCriticContract["criticMode"] = input.pass430.proofState === "sealed" || duplicateBodies >= 2
    ? "sealed"
    : input.pass430.proofState === "bounded" || duplicateTitles.length || overflow
      ? "bounded"
      : "clean";
  const repairNotes = [
    duplicateTitles.length ? `dedupe duplicate titles: ${duplicateTitles.join(", ")}` : null,
    duplicateBodies ? `compress ${duplicateBodies} duplicate body item(s)` : null,
    overflow ? "compress section body or keep six-section PDF order" : null,
    input.pass430.proofState !== "clean" ? "keep source/missing-data gap visible" : null,
  ].filter(Boolean) as string[];
  return {
    version: "pass431-lens-critic-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    criticMode,
    visibleSuggestionLimit: 3,
    customerFacingOnly: true,
    noTechnicalCustomerCopy: true,
    sectionBudget: {
      expected: 6,
      actual: input.sections.length,
      overflow,
    },
    repetitionAudit: {
      duplicateTitles,
      duplicateBodies,
      maxBodyChars,
    },
    finalPreviewLabel: input.pass430.previewLabel,
    customerSummary: input.locale === "pl"
      ? "Podgląd PDF jest sprawdzany przez krytyka narracji przed pokazaniem klientowi."
      : input.locale === "de"
        ? "Die PDF-Vorschau wird vor der Anzeige durch einen Narrativ-Kritiker geprüft."
        : "The PDF preview is checked by a narrative critic before customer display.",
    repairNotes: repairNotes.length ? repairNotes : ["clean critic contract"],
  };
}
