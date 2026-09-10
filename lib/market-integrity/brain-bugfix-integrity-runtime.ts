import type { TokenRiskResult } from "./risk-types";
import type { Pass422BrainMemoryCore, Pass422PdfNarrativeSection } from "./brain-memory-anti-overfit-core";

export type Pass427RuntimeMode = "clean" | "guarded" | "sealed";
export type Pass427Severity = "info" | "watch" | "repair" | "sealed";

export type Pass427BrainBugfixIntegrityRuntime = {
  version: "brain-bugfix-integrity-runtime";
  generatedAt: string;
  runtimeMode: Pass427RuntimeMode;
  integrityScore: number;
  payloadContract: {
    onePayload: true;
    localeBound: true;
    deterministicNarrative: true;
    noSecondCopyEngine: true;
    fieldBudgets: { basic: 10; pro: 14; advanced: 20 };
  };
  sanityChecks: Array<{
    id: string;
    severity: Pass427Severity;
    ok: boolean;
    reason: string;
  }>;
  repairQueue: Array<{
    id: string;
    action: "dedupe" | "cap" | "seal" | "surface_missing" | "operator_review" | "keep";
    target: "payload" | "sources" | "memory" | "narrative" | "risk" | "pdf";
    reason: string;
  }>;
  pdfLock: {
    sectionOrder: ["brief", "risk", "evidence", "sources", "missing", "memory", "next", "signature"];
    maxSectionChars: number;
    repeatSuppression: true;
    customerFacingOnly: true;
  };
  memorySafety: {
    retentionYears: number;
    durable: boolean;
    canAdapt: boolean;
    influenceCap: number;
    reason: string;
  };
  sourceSafety: {
    sourceCount: number;
    secondProvider: string;
    arbitrationMode: string;
    confidenceBand: string;
    hallucinationBrake: string;
  };
  publicSummary: string;
};

export type Pass427LensPreviewLock = {
  version: "pass427-lens-preview-clean-contract";
  locale: "pl" | "en" | "de";
  previewLabel: string;
  onePayload: true;
  customerFacingOnly: true;
  visibleSuggestionLimit: 3;
  sectionOrder: ["brief", "sources", "secondProvider", "missing", "next", "signature"];
  maxSectionChars: number;
  checksum: string;
  repairNotes: string[];
};

const PDF_SECTION_ORDER: Pass427BrainBugfixIntegrityRuntime["pdfLock"]["sectionOrder"] = [
  "brief",
  "risk",
  "evidence",
  "sources",
  "missing",
  "memory",
  "next",
  "signature",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function uniqueCount(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)).size;
}

function severityCost(severity: Pass427Severity) {
  if (severity === "sealed") return 36;
  if (severity === "repair") return 20;
  if (severity === "watch") return 9;
  return 0;
}

function narrativeIds(sections: Pass422PdfNarrativeSection[] | undefined) {
  return (sections ?? []).map((section) => section.id);
}

function hasFullNarrativeContract(brain: Pass422BrainMemoryCore) {
  const locales: Array<"pl" | "en" | "de"> = ["pl", "en", "de"];
  return locales.every((locale) => {
    const ids = narrativeIds(brain.narrative?.[locale]);
    return PDF_SECTION_ORDER.every((id) => ids.includes(id));
  });
}

export function buildPass427BrainBugfixIntegrityRuntime(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  history?: Array<{ score?: number; timestamp?: string }>;
}): Pass427BrainBugfixIntegrityRuntime {
  const { result, brain } = input;
  const history = input.history ?? [];
  const nonFiniteHistory = history.filter((item) => typeof item.score === "number" && !Number.isFinite(item.score)).length;
  const missingUnique = uniqueCount(brain.missingData);
  const missingDuplicates = Math.max(0, brain.missingData.length - missingUnique);
  const sourceCount = brain.sourceGenome.sourceCount;
  const hasSecondProvider = brain.sourceGenome.secondProvider === "confirmed";
  const narrativeOk = hasFullNarrativeContract(brain);
  const fieldBudgetOk = brain.pass424.fieldBudget.basic === 10 && brain.pass424.fieldBudget.pro === 14 && brain.pass424.fieldBudget.advanced === 20;
  const hallucinationAllowance = brain.pass425.hallucinationBrake.allowance;

  const checks: Pass427BrainBugfixIntegrityRuntime["sanityChecks"] = [
    {
      id: "finite_score_guard",
      severity: Number.isFinite(result.score) && Number.isFinite(brain.score) ? "info" : "sealed",
      ok: Number.isFinite(result.score) && Number.isFinite(brain.score),
      reason: "Risk score and brain score must be finite before public narrative is allowed.",
    },
    {
      id: "source_quorum_guard",
      severity: sourceCount >= 2 && hasSecondProvider ? "info" : sourceCount === 1 ? "watch" : "sealed",
      ok: sourceCount >= 2 && hasSecondProvider,
      reason: hasSecondProvider ? "Second provider is confirmed." : "Second provider is not confirmed; public wording stays capped.",
    },
    {
      id: "missing_data_dedupe_guard",
      severity: missingDuplicates ? "repair" : "info",
      ok: missingDuplicates === 0,
      reason: missingDuplicates ? `${missingDuplicates} duplicate missing-data item(s) should be collapsed before PDF output.` : "Missing-data rail is already deduplicated.",
    },
    {
      id: "history_integrity_guard",
      severity: nonFiniteHistory ? "repair" : history.length < 4 ? "watch" : "info",
      ok: nonFiniteHistory === 0 && history.length >= 4,
      reason: nonFiniteHistory ? "History contains non-finite score values." : history.length < 4 ? "Memory is valid but still shallow; keep shadow learning." : "History is usable for memory context.",
    },
    {
      id: "narrative_contract_guard",
      severity: narrativeOk ? "info" : "repair",
      ok: narrativeOk,
      reason: narrativeOk ? "PL/EN/DE narrative has the full section order." : "Narrative sections must be repaired before PDF/preview parity is trusted.",
    },
    {
      id: "field_budget_guard",
      severity: fieldBudgetOk ? "info" : "repair",
      ok: fieldBudgetOk,
      reason: "Basic/Pro/Advanced must stay 10/14/20 fields and differ by depth only, not by truth source.",
    },
    {
      id: "hallucination_brake_guard",
      severity: hallucinationAllowance === "facts_only" || brain.pass425.hallucinationBrake.score >= 74 ? "watch" : "info",
      ok: hallucinationAllowance !== "facts_only" && brain.pass425.hallucinationBrake.score < 74,
      reason: `Narrative allowance is ${hallucinationAllowance}; brake ${brain.pass425.hallucinationBrake.score}.`,
    },
  ];

  const repairQueue: Pass427BrainBugfixIntegrityRuntime["repairQueue"] = [];
  if (!Number.isFinite(result.score) || !Number.isFinite(brain.score)) repairQueue.push({ id: "seal_non_finite_score", action: "seal", target: "risk", reason: "Non-finite scores cannot be rendered publicly." });
  if (!hasSecondProvider) repairQueue.push({ id: "surface_second_provider_gap", action: "surface_missing", target: "sources", reason: "Report must show that second provider is not confirmed." });
  if (missingDuplicates) repairQueue.push({ id: "dedupe_missing_data", action: "dedupe", target: "payload", reason: "Duplicate missing-data labels create noisy PDFs and repeated AI copy." });
  if (!narrativeOk) repairQueue.push({ id: "repair_locale_sections", action: "operator_review", target: "narrative", reason: "Every locale needs the same deterministic section order." });
  if (brain.pass425.hallucinationBrake.score >= 74) repairQueue.push({ id: "cap_public_narrative", action: "cap", target: "narrative", reason: "High hallucination brake means only brief factual copy is allowed." });
  if (!repairQueue.length) repairQueue.push({ id: "keep_source_bound_runtime", action: "keep", target: "payload", reason: "No blocking defect detected; keep source-bound runtime active." });

  const totalCost = checks.reduce((sum, check) => sum + (check.ok ? 0 : severityCost(check.severity)), 0);
  const integrityScore = clamp(100 - totalCost + Math.min(8, brain.evidenceRail.length * 1.5));
  const runtimeMode: Pass427RuntimeMode = checks.some((check) => !check.ok && check.severity === "sealed")
    ? "sealed"
    : integrityScore < 70 || repairQueue.some((item) => item.action === "operator_review" || item.action === "cap")
      ? "guarded"
      : "clean";

  const canAdapt = brain.pass425.memoryWritePolicy.mode === "adaptive_write_capped" && runtimeMode === "clean";
  const influenceCap = canAdapt ? Math.min(0.42, brain.pass425.memoryWritePolicy.maxAdaptiveWeight) : Math.min(0.12, brain.pass425.memoryWritePolicy.maxAdaptiveWeight);

  return {
    version: "brain-bugfix-integrity-runtime",
    generatedAt: new Date().toISOString(),
    runtimeMode,
    integrityScore: round(integrityScore),
    payloadContract: {
      onePayload: true,
      localeBound: true,
      deterministicNarrative: true,
      noSecondCopyEngine: true,
      fieldBudgets: { basic: 10, pro: 14, advanced: 20 },
    },
    sanityChecks: checks,
    repairQueue,
    pdfLock: {
      sectionOrder: PDF_SECTION_ORDER,
      maxSectionChars: runtimeMode === "sealed" ? 280 : runtimeMode === "guarded" ? 420 : 560,
      repeatSuppression: true,
      customerFacingOnly: true,
    },
    memorySafety: {
      retentionYears: brain.longTermMemory.retentionYears,
      durable: brain.longTermMemory.storageReality === "durable_years_ready",
      canAdapt,
      influenceCap: round(influenceCap, 3),
      reason: canAdapt
        ? "Long-term memory may add bounded context because quorum, sample depth and runtime integrity are clean."
        : "Memory may be stored and described, but cannot dominate current-source evidence in this runtime mode.",
    },
    sourceSafety: {
      sourceCount,
      secondProvider: brain.sourceGenome.secondProvider,
      arbitrationMode: brain.pass425.arbitrationMode,
      confidenceBand: brain.pass425.confidenceBand,
      hallucinationBrake: hallucinationAllowance,
    },
    publicSummary: `PASS427 ${runtimeMode}; integrity ${round(integrityScore)}; sources ${sourceCount}; second ${brain.sourceGenome.secondProvider}; repairs ${repairQueue.length}.`,
  };
}

export function buildPass427LensPreviewLock(input: {
  locale: "pl" | "en" | "de";
  checksum: string;
  sections: Array<{ id: string; body: string }>;
}): Pass427LensPreviewLock {
  const sectionOrder: Pass427LensPreviewLock["sectionOrder"] = ["brief", "sources", "secondProvider", "missing", "next", "signature"];
  const seen = new Set<string>();
  const repairNotes: string[] = [];
  for (const section of input.sections) {
    const normalized = section.body.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(normalized) && normalized) repairNotes.push(`duplicate section body: ${section.id}`);
    seen.add(normalized);
    if (section.body.length > 620) repairNotes.push(`section too long: ${section.id}`);
  }
  for (const id of sectionOrder) {
    if (!input.sections.some((section) => section.id === id)) repairNotes.push(`missing section: ${id}`);
  }
  return {
    version: "pass427-lens-preview-clean-contract",
    locale: input.locale,
    previewLabel: input.locale === "pl" ? "Podgląd PDF" : input.locale === "de" ? "PDF-Vorschau" : "PDF preview",
    onePayload: true,
    customerFacingOnly: true,
    visibleSuggestionLimit: 3,
    sectionOrder,
    maxSectionChars: 620,
    checksum: input.checksum,
    repairNotes: repairNotes.length ? repairNotes.slice(0, 8) : ["clean preview/download contract"],
  };
}
