import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  buildPass455HumanDecisionPdfForge,
  type Pass455Locale,
} from "@/lib/market-integrity/human-decision-pdf-forge-runtime";
import {
  buildPass477UnifiedDepthContract,
  type Pass477Depth,
} from "@/lib/market-integrity/unified-depth-contract";

export type Pass486ForgeStage = {
  id: "identity" | "sources" | "reasoning" | "seal";
  label: string;
  detail: string;
  evidenceLabel: string;
  weight: number;
};

export type Pass486PdfForgeIntelligence = {
  version: "pdf-forge-intelligence";
  locale: Pass455Locale;
  depth: Pass477Depth;
  fieldBudget: 10 | 14 | 20;
  sourceCount: number;
  confidenceCeiling: number;
  evidenceState: string;
  headline: string;
  subline: string;
  stages: Pass486ForgeStage[];
  qualityGates: Array<{
    id: "parity" | "missing" | "sources" | "signature";
    label: string;
    state: "pass" | "review";
  }>;
  signature: string;
};

function localeOf(locale: string): Pass455Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

const copy = {
  pl: {
    headline: "Kuźnia raportu oparta na dowodach",
    subline: (fields: number, sources: number, confidence: number) =>
      `${fields} pól · ${sources} źródeł · sufit pewności ${confidence}%`,
    stages: {
      identity: ["Tożsamość instrumentu", "Ustalamy dokładny symbol, klasę aktywa i trasę providera."],
      sources: ["Źródła i świeżość", "Liczymy niezależne źródła, timestampy i jawne luki danych."],
      reasoning: ["Silnik dowodowy", "Rozdzielamy fakty, napięcia, braki oraz następny test dla wybranego poziomu."],
      seal: ["Podpis i parytet", "Reader i pobrany PDF są tworzone z tego samego payloadu i poziomu analizy."],
    },
    evidence: ["routing", "source quorum", "plain-language reasoning", "one payload"],
    gates: ["Podgląd = pobranie", "Braki pozostają jawne", "Źródła", "Podpis Velmère"],
    signature: "Velmère Security · automated evidence-bound analysis",
  },
  de: {
    headline: "Evidenzgebundene Report-Manufaktur",
    subline: (fields: number, sources: number, confidence: number) =>
      `${fields} Felder · ${sources} Quellen · Konfidenzlimit ${confidence}%`,
    stages: {
      identity: ["Instrument-Identität", "Exaktes Symbol, Asset-Klasse und Provider-Route werden festgelegt."],
      sources: ["Quellen und Freshness", "Unabhängige Quellen, Zeitstempel und sichtbare Datenlücken werden gezählt."],
      reasoning: ["Evidenz-Engine", "Fakten, Spannungen, Lücken und nächster Test werden für die gewählte Tiefe getrennt."],
      seal: ["Signatur und Parität", "Reader und PDF entstehen aus demselben Payload und derselben Analysetiefe."],
    },
    evidence: ["Routing", "Source Quorum", "Verständliche Einordnung", "One Payload"],
    gates: ["Vorschau = Download", "Lücken bleiben sichtbar", "Quellen", "Velmère Signatur"],
    signature: "Velmère Security · automated evidence-bound analysis",
  },
  en: {
    headline: "Evidence-bound report forge",
    subline: (fields: number, sources: number, confidence: number) =>
      `${fields} fields · ${sources} sources · confidence ceiling ${confidence}%`,
    stages: {
      identity: ["Instrument identity", "Resolve the exact symbol, asset class and provider route."],
      sources: ["Sources and freshness", "Count independent sources, timestamps and explicit data gaps."],
      reasoning: ["Evidence engine", "Separate facts, tensions, unknowns and the next probe for the selected depth."],
      seal: ["Seal and parity", "Reader and downloaded PDF are built from the same payload and analysis depth."],
    },
    evidence: ["routing", "source quorum", "plain-language reasoning", "one payload"],
    gates: ["Preview = download", "Gaps stay visible", "Sources", "Velmère signature"],
    signature: "Velmère Security · automated evidence-bound analysis",
  },
} as const;

export function buildPass486PdfForgeIntelligence(
  result: VelmereSearchResult,
  locale: string,
  depth: Pass477Depth,
): Pass486PdfForgeIntelligence {
  const safeLocale = localeOf(locale);
  const c = copy[safeLocale];
  const decision = buildPass455HumanDecisionPdfForge(result, safeLocale);
  const contract = buildPass477UnifiedDepthContract(result, safeLocale, depth);
  const sourceGate = contract.sourceCount > 0 ? "pass" : "review";
  const missingGate = result.missingData.length === 0 ? "pass" : "review";

  const rawStages = [
    ["identity", ...c.stages.identity, c.evidence[0], 18],
    ["sources", ...c.stages.sources, c.evidence[1], 27],
    ["reasoning", ...c.stages.reasoning, c.evidence[2], 35],
    ["seal", ...c.stages.seal, c.evidence[3], 20],
  ] as const;

  return {
    version: "pdf-forge-intelligence",
    locale: safeLocale,
    depth: contract.selectedDepth,
    fieldBudget: contract.fieldBudget,
    sourceCount: contract.sourceCount,
    confidenceCeiling: contract.confidenceCeiling,
    evidenceState: contract.evidenceStateLabel,
    headline: c.headline,
    subline: c.subline(contract.fieldBudget, contract.sourceCount, contract.confidenceCeiling),
    stages: rawStages.map(([id, label, detail, evidenceLabel, weight]) => ({
      id,
      label,
      detail,
      evidenceLabel,
      weight,
    })),
    qualityGates: [
      { id: "parity", label: c.gates[0], state: "pass" },
      { id: "missing", label: c.gates[1], state: missingGate },
      { id: "sources", label: c.gates[2], state: sourceGate },
      { id: "signature", label: c.gates[3], state: decision.browserContract.exactPdfStillAvailable ? "pass" : "review" },
    ],
    signature: c.signature,
  };
}
