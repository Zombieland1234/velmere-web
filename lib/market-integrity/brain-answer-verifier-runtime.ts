import { sha256Token } from "../security/cryptographic-digest";
import type { TokenRiskResult } from "./risk-types";
import type { Pass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";
import type { Pass427BrainBugfixIntegrityRuntime } from "./brain-bugfix-integrity-runtime";
import type { Pass428BrainNarrativeCoherenceRuntime } from "./brain-narrative-coherence-runtime";
import type { Pass429BrainSelfAuditConsensusRuntime } from "./brain-self-audit-consensus-runtime";

export type Pass430ProofState = "verified" | "bounded" | "sealed" | "operator_review";
export type Pass430ResponseMode = "proof_answer" | "guarded_answer" | "facts_only" | "review_required";
export type Pass430RepairAction = "keep" | "compress" | "cite_evidence" | "surface_gap" | "cap_confidence" | "operator_review" | "seal_answer";

export type Pass430BrainAnswerVerifierRuntime = {
  version: "brain-answer-verifier-runtime";
  generatedAt: string;
  proofState: Pass430ProofState;
  responseMode: Pass430ResponseMode;
  answerReadinessScore: number;
  proofOfAnswerContract: {
    onePayload: true;
    deterministicSeed: string;
    evidenceRequiredBeforeAnswer: true;
    sourceGapMustBeVisible: true;
    memoryCannotOverrideLiveSources: true;
    noSentienceClaim: true;
    noBuySellInstruction: true;
  };
  proofChecklist: Array<{
    id: string;
    ok: boolean;
    severity: "info" | "watch" | "repair" | "sealed";
    reason: string;
  }>;
  answerEnvelope: {
    maxSentences: number;
    maxChars: number;
    allowedVoice: "factual" | "calm" | "guardian";
    mustMention: Array<"missing_data" | "second_provider" | "low_confidence" | "operator_review" | "memory_decay">;
    blockedClaims: string[];
  };
  proofLedger: Array<{
    id: string;
    layer: "source" | "risk" | "memory" | "narrative" | "pdf" | "safety";
    status: "confirmed" | "partial" | "missing" | "blocked";
    detail: string;
  }>;
  memoryLearningFence: {
    retentionYears: number;
    hotWindowDays: number;
    archiveAllowed: boolean;
    adaptiveLearningAllowed: boolean;
    maxAdaptiveWeight: number;
    reason: string;
  };
  repairPlan: Array<{
    id: string;
    action: Pass430RepairAction;
    target: "answer" | "pdf" | "memory" | "sources" | "risk" | "locale";
    reason: string;
  }>;
  publicSummary: string;
};

export type Pass430LensAnswerProofContract = {
  version: "pass430-lens-answer-proof-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  previewLabel: string;
  visibleSuggestionLimit: 3;
  exactPayload: true;
  noTechnicalCustomerCopy: true;
  proofState: "clean" | "bounded" | "sealed";
  checksum: string;
  sectionCount: number;
  maxSectionChars: number;
  customerSummary: string;
  repairNotes: string[];
};

const BLOCKED_CLAIMS = [
  "guaranteed profit",
  "guaranteed price",
  "risk free",
  "buy now",
  "sell now",
  "financial advice",
  "i am alive",
  "i am conscious",
  "hidden provider confirmed",
  "missing data replaced",
  "certain prediction",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function severityCost(severity: "info" | "watch" | "repair" | "sealed") {
  if (severity === "sealed") return 42;
  if (severity === "repair") return 22;
  if (severity === "watch") return 9;
  return 0;
}

function responseMode(proofState: Pass430ProofState): Pass430ResponseMode {
  if (proofState === "verified") return "proof_answer";
  if (proofState === "bounded") return "guarded_answer";
  if (proofState === "sealed") return "facts_only";
  return "review_required";
}

function deterministicSeed(input: { result: TokenRiskResult; brain: Pass422BrainMemoryCore; pass429: Pass429BrainSelfAuditConsensusRuntime }) {
  const raw = [
    input.result.token.symbol,
    input.result.token.marketId ?? input.result.token.tokenAddress ?? "asset",
    input.result.score,
    input.result.confidence ?? 0,
    input.brain.sourceGenome.sourceCount,
    input.brain.missingData.join("/"),
    input.pass429.answerMode,
    input.pass429.consensusState,
  ].join("|");
  return `answer-${sha256Token(raw, 16)}`;
}

export function buildPass430BrainAnswerVerifierRuntime(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  pass427: Pass427BrainBugfixIntegrityRuntime;
  pass428: Pass428BrainNarrativeCoherenceRuntime;
  pass429: Pass429BrainSelfAuditConsensusRuntime;
}): Pass430BrainAnswerVerifierRuntime {
  const { result, brain, pass427, pass428, pass429 } = input;
  const sourceCount = brain.sourceGenome.sourceCount;
  const hasSecondProvider = brain.sourceGenome.secondProvider === "confirmed";
  const missingDataCount = brain.missingData.length;
  const evidenceCount = brain.evidenceRail.length;
  const publicConfidence = pass429.confidenceEnvelope.publicAnswerConfidence;
  const memoryLearningWeight = brain.memory.learningWeight;
  const seed = deterministicSeed({ result, brain, pass429 });

  const proofChecklist: Pass430BrainAnswerVerifierRuntime["proofChecklist"] = [
    {
      id: "finite_answer_payload",
      ok: Number.isFinite(result.score) && Number.isFinite(result.confidence) && Number.isFinite(publicConfidence),
      severity: Number.isFinite(result.score) && Number.isFinite(result.confidence) && Number.isFinite(publicConfidence) ? "info" : "sealed",
      reason: "Risk score, raw confidence and public confidence must be finite before the answer layer is allowed.",
    },
    {
      id: "evidence_minimum",
      ok: evidenceCount >= 3,
      severity: evidenceCount >= 3 ? "info" : evidenceCount > 0 ? "watch" : "sealed",
      reason: `${evidenceCount} evidence item(s) are available for answer grounding.`,
    },
    {
      id: "source_quorum",
      ok: sourceCount >= 2 && hasSecondProvider,
      severity: sourceCount >= 2 && hasSecondProvider ? "info" : sourceCount ? "watch" : "sealed",
      reason: hasSecondProvider ? "Second provider is visible in the source genome." : "Second provider is missing or partial, so public answer must mention the gap.",
    },
    {
      id: "self_audit_ready",
      ok: pass429.answerMode === "answer_ready" || pass429.answerMode === "cautious_answer",
      severity: pass429.answerMode === "operator_review" ? "repair" : pass429.answerMode === "sealed_facts_only" ? "sealed" : "info",
      reason: `PASS429 answer mode is ${pass429.answerMode}.`,
    },
    {
      id: "coherence_ready",
      ok: pass428.coherenceMode === "clean" || pass428.coherenceMode === "compressed",
      severity: pass428.coherenceMode === "sealed" ? "sealed" : pass428.coherenceMode === "guarded" ? "repair" : "info",
      reason: `Narrative coherence mode is ${pass428.coherenceMode}.`,
    },
    {
      id: "memory_decay_fence",
      ok: memoryLearningWeight <= 0.28 && pass427.memorySafety.influenceCap <= 0.42,
      severity: memoryLearningWeight <= 0.28 && pass427.memorySafety.influenceCap <= 0.42 ? "info" : "repair",
      reason: `Memory learning weight ${memoryLearningWeight}; influence cap ${pass427.memorySafety.influenceCap}.`,
    },
    {
      id: "pdf_truth_contract",
      ok: pass427.payloadContract.onePayload && pass427.payloadContract.deterministicNarrative && pass429.truthContract.noSecondCopyEngine,
      severity: "info",
      reason: "PDF/chat answer must be generated from one source-bound payload and one deterministic section order.",
    },
  ];

  const cost = proofChecklist.reduce((sum, check) => sum + (check.ok ? 0 : severityCost(check.severity)), 0);
  const answerReadinessScore = clamp(100 - cost + Math.min(10, evidenceCount) - Math.min(14, missingDataCount * 1.4));
  const hasSealed = proofChecklist.some((check) => !check.ok && check.severity === "sealed");
  const hasRepair = proofChecklist.some((check) => !check.ok && check.severity === "repair");
  const proofState: Pass430ProofState = hasSealed
    ? "sealed"
    : pass429.answerMode === "operator_review" || hasRepair
      ? "operator_review"
      : answerReadinessScore >= 78 && publicConfidence >= 64 && hasSecondProvider
        ? "verified"
        : "bounded";

  const mustMention: Pass430BrainAnswerVerifierRuntime["answerEnvelope"]["mustMention"] = [];
  if (missingDataCount) mustMention.push("missing_data");
  if (!hasSecondProvider) mustMention.push("second_provider");
  if (publicConfidence < 50) mustMention.push("low_confidence");
  if (proofState === "operator_review" || proofState === "sealed") mustMention.push("operator_review");
  if (brain.longTermMemory.retentionYears >= 2) mustMention.push("memory_decay");

  const proofLedger: Pass430BrainAnswerVerifierRuntime["proofLedger"] = [
    {
      id: "source_quorum",
      layer: "source",
      status: hasSecondProvider ? "confirmed" : sourceCount ? "partial" : "missing",
      detail: `${sourceCount} source lane(s); second provider ${brain.sourceGenome.secondProvider}.`,
    },
    {
      id: "risk_score",
      layer: "risk",
      status: Number.isFinite(result.score) ? "confirmed" : "blocked",
      detail: `Risk score ${Number.isFinite(result.score) ? result.score : "invalid"}; public confidence ${round(publicConfidence)}.`,
    },
    {
      id: "memory_decay",
      layer: "memory",
      status: memoryLearningWeight <= 0.28 ? "confirmed" : "partial",
      detail: `Retention ${brain.longTermMemory.retentionYears}y; learning weight ${memoryLearningWeight}; archive remains context only.`,
    },
    {
      id: "narrative_coherence",
      layer: "narrative",
      status: pass428.coherenceMode === "clean" || pass428.coherenceMode === "compressed" ? "confirmed" : pass428.coherenceMode === "guarded" ? "partial" : "blocked",
      detail: `Coherence ${pass428.coherenceMode}; duplicate bodies ${pass428.narrativeHealth.duplicateBodyCount}; locale leaks ${pass428.narrativeHealth.localeLeakCount}.`,
    },
    {
      id: "pdf_contract",
      layer: "pdf",
      status: "confirmed",
      detail: `One payload contract seed ${seed}; Basic/Pro/Advanced keep 10/14/20 fields from the same truth source.`,
    },
    {
      id: "safety_boundary",
      layer: "safety",
      status: "confirmed",
      detail: "No sentience claim, no buy/sell instruction, no hidden-provider claim and no replacement for missing data.",
    },
  ];

  const repairPlan: Pass430BrainAnswerVerifierRuntime["repairPlan"] = [];
  if (!hasSecondProvider) repairPlan.push({ id: "surface_second_provider_gap", action: "surface_gap", target: "sources", reason: "Answer and PDF must mention that a second provider is missing or partial." });
  if (missingDataCount) repairPlan.push({ id: "surface_missing_data", action: "surface_gap", target: "pdf", reason: `${missingDataCount} missing-data item(s) remain visible in the final answer.` });
  if (publicConfidence < 58) repairPlan.push({ id: "cap_low_confidence", action: "cap_confidence", target: "answer", reason: "Public confidence is below usable band, so the answer stays short and factual." });
  if (pass428.narrativeHealth.duplicateBodyCount || pass428.narrativeHealth.longSectionCount) repairPlan.push({ id: "compress_noisy_narrative", action: "compress", target: "pdf", reason: "Duplicate or long narrative sections should be compressed before customer output." });
  if (proofState === "operator_review") repairPlan.push({ id: "operator_review_needed", action: "operator_review", target: "risk", reason: "Self-audit or coherence runtime requested operator review before strong wording." });
  if (proofState === "sealed") repairPlan.push({ id: "seal_answer", action: "seal_answer", target: "answer", reason: "Missing critical proof data means the answer must remain facts-only." });
  if (!repairPlan.length) repairPlan.push({ id: "keep_verified_answer", action: "keep", target: "answer", reason: "Answer proof, memory fence, source quorum and PDF contract are aligned." });

  return {
    version: "brain-answer-verifier-runtime",
    generatedAt: new Date().toISOString(),
    proofState,
    responseMode: responseMode(proofState),
    answerReadinessScore: round(answerReadinessScore),
    proofOfAnswerContract: {
      onePayload: true,
      deterministicSeed: seed,
      evidenceRequiredBeforeAnswer: true,
      sourceGapMustBeVisible: true,
      memoryCannotOverrideLiveSources: true,
      noSentienceClaim: true,
      noBuySellInstruction: true,
    },
    proofChecklist,
    answerEnvelope: {
      maxSentences: proofState === "verified" ? 7 : proofState === "bounded" ? 5 : 3,
      maxChars: proofState === "verified" ? 980 : proofState === "bounded" ? 680 : 420,
      allowedVoice: proofState === "verified" ? "guardian" : proofState === "bounded" ? "calm" : "factual",
      mustMention,
      blockedClaims: BLOCKED_CLAIMS,
    },
    proofLedger,
    memoryLearningFence: {
      retentionYears: brain.longTermMemory.retentionYears,
      hotWindowDays: brain.longTermMemory.policy.hotWindowDays,
      archiveAllowed: true,
      adaptiveLearningAllowed: proofState === "verified" && pass429.memoryLearningGate.learningAllowed,
      maxAdaptiveWeight: round(proofState === "verified" ? Math.min(0.28, memoryLearningWeight) : Math.min(0.08, memoryLearningWeight), 3),
      reason: proofState === "verified"
        ? "Long-term memory can support context in capped mode, but live sources and evidence still dominate."
        : "Long-term memory is retained as context only; current source proof is not strong enough for adaptive influence.",
    },
    repairPlan,
    publicSummary: `PASS430 ${responseMode(proofState)}; proof ${proofState}; readiness ${round(answerReadinessScore)}; source quorum ${hasSecondProvider ? "confirmed" : "partial"}; public confidence ${round(publicConfidence)}.`,
  };
}

export function buildPass430LensAnswerProofContract(input: {
  locale: "pl" | "en" | "de";
  checksum: string;
  sectionCount: number;
  sourceCount: number;
  missingDataCount: number;
  duplicateBodyCount?: number;
  localeLeakCount?: number;
}): Pass430LensAnswerProofContract {
  const clean = input.sourceCount >= 1 && !input.duplicateBodyCount && !input.localeLeakCount;
  const hasQuorum = input.sourceCount >= 2;
  const proofState: Pass430LensAnswerProofContract["proofState"] = clean && hasQuorum
    ? "clean"
    : clean
      ? "bounded"
      : "sealed";
  const repairNotes = [
    input.sourceCount >= 2 ? null : "keep second provider gap visible before stronger PDF language",
    input.missingDataCount ? `${input.missingDataCount} missing-data item(s) must remain visible` : null,
    input.duplicateBodyCount ? `${input.duplicateBodyCount} duplicate section(s) should be compressed` : null,
    input.localeLeakCount ? `${input.localeLeakCount} locale leak item(s) should be repaired` : null,
  ].filter(Boolean) as string[];
  return {
    version: "pass430-lens-answer-proof-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    previewLabel: input.locale === "pl" ? "Podgląd PDF" : input.locale === "de" ? "PDF-Vorschau" : "PDF preview",
    visibleSuggestionLimit: 3,
    exactPayload: true,
    noTechnicalCustomerCopy: true,
    proofState,
    checksum: input.checksum,
    sectionCount: input.sectionCount,
    maxSectionChars: 520,
    customerSummary: input.locale === "pl"
      ? "Velmère Security pokazuje krótki, źródłowy podgląd raportu."
      : input.locale === "de"
        ? "Velmère Security zeigt eine kurze, quellengebundene Berichtsvorschau."
        : "Velmère Security shows a short source-bound report preview.",
    repairNotes: repairNotes.length ? repairNotes : ["clean Lens answer proof contract"],
  };
}
