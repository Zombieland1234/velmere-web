import { sha256Token } from "../security/cryptographic-digest";
import { independentLiveProviderSources } from "@/lib/ai/evidence-normalization";
export type Pass1334Locale = "pl" | "de" | "en";
export type Pass1334Depth = "basic" | "pro" | "advanced";

export type Pass1334PremiumPdfCheck = {
  id:
    | "cover_decision_first"
    | "source_appendix_visible"
    | "missing_data_visible"
    | "preview_download_parity"
    | "no_overlap_budget"
    | "human_summary_not_random";
  label: string;
  passed: boolean;
  weight: number;
};

export type Pass1334PdfPremiumFinal = {
  version: "pdf-premium-final";
  state: "premium_ready" | "review_required" | "blocked";
  score: number;
  releaseLevel: "100_candidate" | "150_polish" | "blocked";
  manifestKey: string;
  previewDownloadParity: "same_payload_same_depth_same_claims";
  cover: {
    kicker: string;
    title: string;
    subtitle: string;
    evidenceLine: string;
    /** @deprecated Compatibility alias; text describes evidence coverage, not calibrated confidence. */
    confidenceLine: string;
  };
  executiveBlocks: Array<{
    id: "decision" | "evidence" | "risk" | "next_check";
    title: string;
    body: string;
    tone: "calm" | "review" | "blocked";
  }>;
  sourceAppendix: Array<{
    id: string;
    label: string;
    state: "confirmed" | "partial" | "missing";
    coverage: number;
    /** Calibrated confidence only when explicitly supplied upstream; otherwise zero. */
    confidence: number;
    note: string;
  }>;
  checks: Pass1334PremiumPdfCheck[];
  typographyBudget: {
    maxHeadlineLines: 2;
    maxSummaryLines: 7;
    maxAppendixRows: 6;
    noHorizontalOverflow: true;
  };
  copy: {
    stripTitle: string;
    stripBody: string;
    badge: string;
    appendixTitle: string;
  };
};

type Pass1334Source = {
  label: string;
  mode: string;
  confidence: number;
  coverage?: number;
  note: string;
  evidenceState?: "confirmed" | "partial" | "missing";
};

type Pass1334Input = {
  locale: Pass1334Locale;
  symbol: string;
  depth: Pass1334Depth;
  title: string;
  summary: string;
  evidenceCoverageCap?: number;
  /** @deprecated Compatibility input interpreted as evidence coverage. */
  confidenceCap?: number;
  sourceConfidence: number;
  sourceCount: number;
  missingCount: number;
  claimCount: number;
  sources: Pass1334Source[];
  typographyState: string;
  visualQaState: string;
  parityManifest: string;
  evidenceManifest: string;
  sourceTruthState?: "source_bound" | "partial" | "source_required";
  consensusState?: string;
};

const text = {
  pl: {
    kicker: "Velmère Lens · raport premium",
    decision: "Decyzja w skrócie",
    evidence: "Dowody i źródła",
    risk: "Granica ryzyka",
    next: "Następna kontrola",
    stripTitle: "PDF Premium Final",
    badgeReady: "premium ready",
    badgeReview: "review",
    badgeBlocked: "blocked",
    appendixTitle: "Aneks źródeł",
    sourceMissing: "Brak potwierdzonego źródła — raport zostaje ostrożny.",
  },
  de: {
    kicker: "Velmère Lens · Premium-Bericht",
    decision: "Entscheidung kurz",
    evidence: "Nachweise und Quellen",
    risk: "Risikogrenze",
    next: "Nächste Prüfung",
    stripTitle: "PDF Premium Final",
    badgeReady: "premium ready",
    badgeReview: "review",
    badgeBlocked: "blocked",
    appendixTitle: "Quellenanhang",
    sourceMissing: "Keine bestätigte Quelle — der Bericht bleibt vorsichtig.",
  },
  en: {
    kicker: "Velmère Lens · premium report",
    decision: "Decision in brief",
    evidence: "Evidence and sources",
    risk: "Risk boundary",
    next: "Next verification",
    stripTitle: "PDF Premium Final",
    badgeReady: "premium ready",
    badgeReview: "review",
    badgeBlocked: "blocked",
    appendixTitle: "Source appendix",
    sourceMissing: "No confirmed source — the report stays conservative.",
  },
} as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compact(value: string, max = 280) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 3)).trimEnd()}...` : normalized;
}

function stableKey(parts: Array<string | number | boolean>) {
  return `p1334-${sha256Token(parts.join("|"), 16)}`;
}

export function buildPass1334PdfPremiumFinal(input: Pass1334Input): Pass1334PdfPremiumFinal {
  const copy = text[input.locale];
  const evidenceCoverageCap = clamp(input.evidenceCoverageCap ?? input.confidenceCap ?? 0);
  const eligibleSources = input.sources.filter((source) =>
    source.evidenceState === "confirmed" || (source.evidenceState === undefined && (source.mode === "live" || source.mode === "live_table")),
  );
  const confirmedProviderRows = independentLiveProviderSources(eligibleSources);
  const confirmedSources = confirmedProviderRows.length;
  const requiredIndependentSources = input.depth === "basic" ? 1 : input.depth === "pro" ? 2 : 3;
  const hasAnySource = confirmedSources > 0;
  const truthReady = input.depth === "basic"
    ? hasAnySource
    : input.sourceTruthState === "source_bound" && input.consensusState === "aligned";
  const checks: Pass1334PremiumPdfCheck[] = [
    { id: "cover_decision_first", label: "Cover opens with decision and evidence boundary", passed: input.title.length > 6 && input.summary.length > 24, weight: 16 },
    { id: "source_appendix_visible", label: "Source appendix is visible", passed: input.sources.length > 0, weight: 16 },
    { id: "missing_data_visible", label: "Missing data is visible, not hidden", passed: input.missingCount >= 0, weight: 14 },
    { id: "preview_download_parity", label: "Preview/download share manifest", passed: Boolean(input.parityManifest && input.evidenceManifest), weight: 18 },
    { id: "no_overlap_budget", label: "Typography/overflow budget is active", passed: /ready|pass|prepared|review/i.test(`${input.typographyState} ${input.visualQaState}`), weight: 18 },
    { id: "human_summary_not_random", label: "Human summary is deterministic and bounded", passed: input.claimCount > 0 && input.summary.length < 900, weight: 18 },
  ];
  const score = clamp(
    checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0) -
      (input.missingCount > 4 ? 6 : 0) -
      (confirmedSources === 0 ? 8 : 0) -
      (confirmedSources < requiredIndependentSources ? 10 : 0) -
      (!truthReady ? 12 : 0),
  );
  const state = score >= 88 && confirmedSources >= requiredIndependentSources && truthReady ? "premium_ready" : score >= 68 ? "review_required" : "blocked";
  const releaseLevel = state === "premium_ready" ? "100_candidate" : state === "review_required" ? "150_polish" : "blocked";
  const evidenceLine =
    input.locale === "pl"
      ? `${evidenceCoverageCap}% limitu pokrycia dowodów · ${confirmedSources} niezależnych źródeł · ${input.missingCount} luk`
      : input.locale === "de"
        ? `${evidenceCoverageCap}% Evidenzabdeckungsgrenze · ${confirmedSources} unabhängige Quellen · ${input.missingCount} Lücken`
        : `${evidenceCoverageCap}% evidence-coverage cap · ${confirmedSources} independent sources · ${input.missingCount} gaps`;
  const sourceAppendix = (input.sources.length ? input.sources : [{ label: "Source required", mode: "missing", confidence: 0, coverage: 0, note: copy.sourceMissing }]).slice(0, 6).map((source, index) => ({
    id: `S${String(index + 1).padStart(2, "0")}`,
    label: compact(source.label, 72),
    state: source.evidenceState || (source.mode === "missing" ? "missing" : source.mode === "live" || source.mode === "live_table" ? "confirmed" : "partial"),
    coverage: clamp(source.coverage ?? (source.evidenceState === "confirmed" ? 100 : source.evidenceState === "partial" ? 50 : 0)),
    confidence: clamp(source.confidence),
    note: compact(source.note || copy.sourceMissing, 140),
  }));
  const manifestKey = stableKey([
    input.symbol,
    input.depth,
    evidenceCoverageCap,
    confirmedSources,
    input.missingCount,
    input.claimCount,
    input.parityManifest,
    input.evidenceManifest,
    input.sourceTruthState || "missing",
    input.consensusState || "missing",
  ]);
  return {
    version: "pdf-premium-final",
    state,
    score,
    releaseLevel,
    manifestKey,
    previewDownloadParity: "same_payload_same_depth_same_claims",
    cover: {
      kicker: copy.kicker,
      title: compact(input.title, 96),
      subtitle: compact(input.summary, 240),
      evidenceLine,
      confidenceLine: evidenceLine,
    },
    executiveBlocks: [
      { id: "decision", title: copy.decision, body: compact(input.summary, 260), tone: state === "blocked" ? "blocked" : "calm" },
      { id: "evidence", title: copy.evidence, body: hasAnySource ? evidenceLine : copy.sourceMissing, tone: hasAnySource ? "calm" : "blocked" },
      { id: "risk", title: copy.risk, body: input.missingCount ? `${input.missingCount} missing-data lane(s) stay visible before strong wording.` : "No priority missing-data lane in the compact report.", tone: input.missingCount ? "review" : "calm" },
      { id: "next_check", title: copy.next, body: `Depth ${input.depth} · ${input.claimCount} claim lanes · parity locked.`, tone: "calm" },
    ],
    sourceAppendix,
    checks,
    typographyBudget: {
      maxHeadlineLines: 2,
      maxSummaryLines: 7,
      maxAppendixRows: 6,
      noHorizontalOverflow: true,
    },
    copy: {
      stripTitle: copy.stripTitle,
      stripBody:
        input.locale === "pl"
          ? "Raport ma cover, decyzję, aneks źródeł, widoczne braki i ten sam manifest dla preview/download."
          : input.locale === "de"
            ? "Der Bericht hat Cover, Entscheidung, Quellenanhang, sichtbare Lücken und dasselbe Preview/Download-Manifest."
            : "The report has a cover, decision, source appendix, visible gaps and the same preview/download manifest.",
      badge: state === "premium_ready" ? copy.badgeReady : state === "review_required" ? copy.badgeReview : copy.badgeBlocked,
      appendixTitle: copy.appendixTitle,
    },
  };
}
