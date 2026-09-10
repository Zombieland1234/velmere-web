import type { TokenRiskResult } from "./risk-types";
import type { Pass422BrainLocale, Pass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";
import type { Pass427BrainBugfixIntegrityRuntime } from "./brain-bugfix-integrity-runtime";

export type Pass428CoherenceMode = "clean" | "compressed" | "guarded" | "sealed";
export type Pass428NarrativeAction = "keep" | "dedupe" | "compress" | "translate_guard" | "cap_claims" | "operator_review";

export type Pass428BrainNarrativeCoherenceRuntime = {
  version: "brain-narrative-coherence-runtime";
  generatedAt: string;
  coherenceMode: Pass428CoherenceMode;
  coherenceScore: number;
  publicClaimBudget: {
    maxSentences: number;
    maxCharsPerSection: number;
    allowedTone: "factual" | "cautious" | "bounded";
    blockedClaims: string[];
  };
  confidenceCalibration: {
    sourceConfidence: number;
    displayedConfidenceCap: number;
    effectiveConfidence: number;
    band: "low" | "guarded" | "usable" | "strong";
    reason: string;
  };
  narrativeHealth: {
    duplicateBodyCount: number;
    localeLeakCount: number;
    longSectionCount: number;
    averageSectionChars: number;
    repeatSuppression: true;
  };
  fieldBudgetSeal: {
    basic: 10;
    pro: 14;
    advanced: 20;
    sourceTruthShared: true;
    reason: string;
  };
  repairPlan: Array<{
    id: string;
    action: Pass428NarrativeAction;
    target: "brain" | "pdf" | "memory" | "sources" | "locale" | "risk";
    reason: string;
  }>;
  operatorSummary: string;
};

export type Pass428LensNarrativeCoherenceLock = {
  version: "pass428-lens-narrative-coherence-lock";
  generatedAt: string;
  locale: Pass422BrainLocale;
  customerFacingLabel: string;
  visibleSuggestionLimit: 3;
  noTechnicalPayloadCopy: true;
  duplicateBodyCount: number;
  localeLeakCount: number;
  maxSectionChars: number;
  checksum: string;
  repairNotes: string[];
};

const LOCALE_LEAK_PATTERNS: Record<Pass422BrainLocale, RegExp[]> = {
  pl: [/\bthe report\b/i, /\bsource confidence\b/i, /\bmissing data\b/i, /\bkein\b/i, /\bquellen/i],
  en: [/\bpodgląd\b/i, /\bźród/i, /\bbrakujące\b/i, /\bbericht\b/i, /\bquellen/i],
  de: [/\bpodgląd\b/i, /\bźród/i, /\bthe report\b/i, /\bmissing data\b/i, /\bsource confidence\b/i],
};

const BLOCKED_CLAIMS = [
  "guaranteed price direction",
  "buy/sell instruction",
  "unstated provider confirmation",
  "hidden replacement for missing data",
  "sentience/autonomous consciousness claim",
  "unbounded long-term prediction",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function normalizeBody(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function confidenceBand(value: number): Pass428BrainNarrativeCoherenceRuntime["confidenceCalibration"]["band"] {
  if (value >= 82) return "strong";
  if (value >= 64) return "usable";
  if (value >= 42) return "guarded";
  return "low";
}

function collectNarrativeSections(brain: Pass422BrainMemoryCore) {
  return (["pl", "en", "de"] as const).flatMap((locale) =>
    (brain.narrative?.[locale] ?? []).map((section) => ({ locale, section })),
  );
}

function countDuplicates(sections: Array<{ section: { body: string } }>) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const { section } of sections) {
    const body = normalizeBody(section.body);
    if (!body) continue;
    if (seen.has(body)) duplicates += 1;
    seen.add(body);
  }
  return duplicates;
}

function countLocaleLeaks(sections: Array<{ locale: Pass422BrainLocale; section: { body: string; title?: string } }>) {
  let leaks = 0;
  for (const { locale, section } of sections) {
    const text = `${section.title ?? ""} ${section.body}`;
    if (LOCALE_LEAK_PATTERNS[locale].some((pattern) => pattern.test(text))) leaks += 1;
  }
  return leaks;
}

function sectionLengthStats(sections: Array<{ section: { body: string } }>, maxChars: number) {
  const lengths = sections.map(({ section }) => section.body.length);
  const average = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0;
  return {
    longSectionCount: lengths.filter((value) => value > maxChars).length,
    averageSectionChars: round(average),
  };
}

export function buildPass428BrainNarrativeCoherenceRuntime(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  pass427: Pass427BrainBugfixIntegrityRuntime;
}): Pass428BrainNarrativeCoherenceRuntime {
  const { result, brain, pass427 } = input;
  const maxChars = pass427.pdfLock.maxSectionChars;
  const sections = collectNarrativeSections(brain);
  const duplicateBodyCount = countDuplicates(sections);
  const localeLeakCount = countLocaleLeaks(sections);
  const { longSectionCount, averageSectionChars } = sectionLengthStats(sections, maxChars);

  const sourceConfidence = clamp(brain.sourceGenome.confidence);
  const integrityCap = pass427.runtimeMode === "sealed" ? 28 : pass427.runtimeMode === "guarded" ? 62 : 100;
  const sourceCap = brain.sourceGenome.secondProvider === "confirmed" ? sourceConfidence : Math.min(sourceConfidence, 58);
  const hallucinationCap = brain.pass425.hallucinationBrake.allowance === "facts_only" ? 38
    : brain.pass425.hallucinationBrake.allowance === "cautious_summary" ? 58
      : brain.pass425.hallucinationBrake.allowance === "bounded_analysis" ? 78
        : 92;
  const displayedConfidenceCap = clamp(Math.min(integrityCap, sourceCap, hallucinationCap));
  const effectiveConfidence = clamp(Math.min(displayedConfidenceCap, result.confidence ?? 0));

  const repairPlan: Pass428BrainNarrativeCoherenceRuntime["repairPlan"] = [];
  if (duplicateBodyCount) repairPlan.push({ id: "dedupe_repeated_pdf_bodies", action: "dedupe", target: "pdf", reason: `${duplicateBodyCount} repeated narrative body item(s) detected.` });
  if (localeLeakCount) repairPlan.push({ id: "repair_locale_leak", action: "translate_guard", target: "locale", reason: `${localeLeakCount} locale leakage item(s) detected across PL/EN/DE narrative.` });
  if (longSectionCount) repairPlan.push({ id: "compress_long_sections", action: "compress", target: "pdf", reason: `${longSectionCount} section(s) exceed the runtime character cap.` });
  if (displayedConfidenceCap < 60) repairPlan.push({ id: "cap_public_claims", action: "cap_claims", target: "brain", reason: "Effective confidence is guarded; public Angel/PDF copy must stay factual." });
  if (pass427.runtimeMode !== "clean") repairPlan.push({ id: "keep_operator_review_visible", action: "operator_review", target: "risk", reason: `PASS427 runtime is ${pass427.runtimeMode}; keep source gaps visible.` });
  if (!repairPlan.length) repairPlan.push({ id: "keep_coherent_payload", action: "keep", target: "brain", reason: "Narrative, locale and confidence rails are coherent." });

  const issueCost = duplicateBodyCount * 7 + localeLeakCount * 12 + longSectionCount * 5 + (100 - displayedConfidenceCap) * 0.18 + (pass427.runtimeMode === "sealed" ? 28 : pass427.runtimeMode === "guarded" ? 12 : 0);
  const coherenceScore = clamp(100 - issueCost + Math.min(8, brain.evidenceRail.length));
  const coherenceMode: Pass428CoherenceMode = pass427.runtimeMode === "sealed" || effectiveConfidence < 32
    ? "sealed"
    : coherenceScore < 66 || localeLeakCount > 0
      ? "guarded"
      : duplicateBodyCount || longSectionCount
        ? "compressed"
        : "clean";
  const allowedTone: Pass428BrainNarrativeCoherenceRuntime["publicClaimBudget"]["allowedTone"] = coherenceMode === "sealed" || coherenceMode === "guarded"
    ? "factual"
    : coherenceMode === "compressed"
      ? "cautious"
      : "bounded";
  const maxSentences = coherenceMode === "sealed" ? 3 : coherenceMode === "guarded" ? 5 : coherenceMode === "compressed" ? 7 : 9;

  return {
    version: "brain-narrative-coherence-runtime",
    generatedAt: new Date().toISOString(),
    coherenceMode,
    coherenceScore: round(coherenceScore),
    publicClaimBudget: {
      maxSentences,
      maxCharsPerSection: coherenceMode === "sealed" ? 260 : coherenceMode === "guarded" ? 360 : maxChars,
      allowedTone,
      blockedClaims: BLOCKED_CLAIMS,
    },
    confidenceCalibration: {
      sourceConfidence: round(sourceConfidence),
      displayedConfidenceCap: round(displayedConfidenceCap),
      effectiveConfidence: round(effectiveConfidence),
      band: confidenceBand(effectiveConfidence),
      reason: "Displayed confidence is capped by source quorum, PASS427 integrity mode and hallucination brake allowance.",
    },
    narrativeHealth: {
      duplicateBodyCount,
      localeLeakCount,
      longSectionCount,
      averageSectionChars,
      repeatSuppression: true,
    },
    fieldBudgetSeal: {
      basic: 10,
      pro: 14,
      advanced: 20,
      sourceTruthShared: true,
      reason: "Basic, Pro and Advanced expose different depth only; all tiers use the same source truth and memory rails.",
    },
    repairPlan,
    operatorSummary: `PASS428 ${coherenceMode}; coherence ${round(coherenceScore)}; confidence cap ${round(displayedConfidenceCap)}; duplicate bodies ${duplicateBodyCount}; locale leaks ${localeLeakCount}.`,
  };
}

export function buildPass428LensNarrativeCoherenceLock(input: {
  locale: Pass422BrainLocale;
  checksum: string;
  sections: Array<{ id: string; title: string; body: string }>;
}): Pass428LensNarrativeCoherenceLock {
  const normalized = input.sections.map((section) => normalizeBody(section.body));
  const duplicateBodyCount = normalized.length - new Set(normalized.filter(Boolean)).size;
  const localeLeakCount = countLocaleLeaks(input.sections.map((section) => ({ locale: input.locale, section })));
  const longSectionCount = input.sections.filter((section) => section.body.length > 520).length;
  const repairNotes = [
    duplicateBodyCount ? `${duplicateBodyCount} duplicate preview/download body item(s) should be collapsed.` : null,
    localeLeakCount ? `${localeLeakCount} locale leak item(s) detected.` : null,
    longSectionCount ? `${longSectionCount} long section(s) should be compressed for mobile PDF preview.` : null,
  ].filter(Boolean) as string[];

  return {
    version: "pass428-lens-narrative-coherence-lock",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    customerFacingLabel: input.locale === "pl" ? "Podgląd PDF" : input.locale === "de" ? "PDF-Vorschau" : "PDF preview",
    visibleSuggestionLimit: 3,
    noTechnicalPayloadCopy: true,
    duplicateBodyCount: Math.max(0, duplicateBodyCount),
    localeLeakCount,
    maxSectionChars: 520,
    checksum: input.checksum,
    repairNotes: repairNotes.length ? repairNotes : ["clean source-bound preview/download narrative"],
  };
}
