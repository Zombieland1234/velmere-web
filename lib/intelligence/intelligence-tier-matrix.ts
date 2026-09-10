import type { IntelligenceLocale } from "./intelligence-content";

export type IntelligenceTierMatrixState =
  | "included"
  | "limited"
  | "conditional"
  | "requires-evidence"
  | "not-included"
  | "value";

export type IntelligenceTierMatrixCell = {
  label: string;
  state: IntelligenceTierMatrixState;
};

export type IntelligenceTierMatrixRow = {
  id: string;
  label: string;
  cells: [IntelligenceTierMatrixCell, IntelligenceTierMatrixCell, IntelligenceTierMatrixCell];
};

export const INTELLIGENCE_TIER_MATRIX_ROW_IDS = [
  "signals",
  "source-depth",
  "freshness",
  "corroboration",
  "risk",
  "confidence",
  "uncertainty",
  "missing-evidence",
  "liquidity",
  "exit-depth",
  "market-structure",
  "holder-concentration",
  "contract-permissions",
  "market-impact",
  "whale-watch",
  "scenario-lab",
  "pdf-preview",
  "full-pdf",
  "evidence-packet",
  "versioning",
  "review-required",
  "downgrade-behavior",
] as const;

type RowId = (typeof INTELLIGENCE_TIER_MATRIX_ROW_IDS)[number];

const labels: Record<IntelligenceLocale, Record<RowId, string>> = {
  en: {
    signals: "Signals",
    "source-depth": "Data-source depth",
    freshness: "Source freshness",
    corroboration: "Provider corroboration",
    risk: "Risk",
    confidence: "Confidence",
    uncertainty: "Uncertainty",
    "missing-evidence": "Missing evidence",
    liquidity: "Liquidity",
    "exit-depth": "Exit depth",
    "market-structure": "Market structure",
    "holder-concentration": "Holder concentration",
    "contract-permissions": "Contract permissions",
    "market-impact": "Market Impact",
    "whale-watch": "Whale Watch",
    "scenario-lab": "Scenario Lab",
    "pdf-preview": "PDF preview",
    "full-pdf": "Full PDF",
    "evidence-packet": "Evidence packet",
    versioning: "Report versioning",
    "review-required": "Review-required state",
    "downgrade-behavior": "Downgrade behavior",
  },
  pl: {
    signals: "Sygnały",
    "source-depth": "Głębokość źródeł danych",
    freshness: "Świeżość źródeł",
    corroboration: "Potwierdzenie przez dostawców",
    risk: "Ryzyko",
    confidence: "Pewność",
    uncertainty: "Niepewność",
    "missing-evidence": "Brakujące dowody",
    liquidity: "Płynność",
    "exit-depth": "Głębokość wyjścia",
    "market-structure": "Struktura rynku",
    "holder-concentration": "Koncentracja posiadaczy",
    "contract-permissions": "Uprawnienia kontraktu",
    "market-impact": "Market Impact",
    "whale-watch": "Whale Watch",
    "scenario-lab": "Scenario Lab",
    "pdf-preview": "Podgląd PDF",
    "full-pdf": "Pełny PDF",
    "evidence-packet": "Pakiet dowodowy",
    versioning: "Wersjonowanie raportu",
    "review-required": "Stan wymagający review",
    "downgrade-behavior": "Zachowanie przy obniżeniu",
  },
  de: {
    signals: "Signale",
    "source-depth": "Datenquellentiefe",
    freshness: "Quellenaktualität",
    corroboration: "Provider-Abgleich",
    risk: "Risiko",
    confidence: "Konfidenz",
    uncertainty: "Unsicherheit",
    "missing-evidence": "Fehlende Evidenz",
    liquidity: "Liquidität",
    "exit-depth": "Exit-Tiefe",
    "market-structure": "Marktstruktur",
    "holder-concentration": "Holder-Konzentration",
    "contract-permissions": "Contract-Berechtigungen",
    "market-impact": "Market Impact",
    "whale-watch": "Whale Watch",
    "scenario-lab": "Scenario Lab",
    "pdf-preview": "PDF-Vorschau",
    "full-pdf": "Vollständiges PDF",
    "evidence-packet": "Evidenzpaket",
    versioning: "Berichtsversionierung",
    "review-required": "Review-required-Status",
    "downgrade-behavior": "Downgrade-Verhalten",
  },
};

const stateLabels: Record<IntelligenceLocale, Record<Exclude<IntelligenceTierMatrixState, "value">, string>> = {
  en: {
    included: "Included",
    limited: "Limited",
    conditional: "Conditional",
    "requires-evidence": "Requires evidence",
    "not-included": "Not included",
  },
  pl: {
    included: "Wliczone",
    limited: "Ograniczone",
    conditional: "Warunkowe",
    "requires-evidence": "Wymaga dowodów",
    "not-included": "Niewliczone",
  },
  de: {
    included: "Enthalten",
    limited: "Begrenzt",
    conditional: "Bedingt",
    "requires-evidence": "Evidenz erforderlich",
    "not-included": "Nicht enthalten",
  },
};

type Blueprint = {
  id: RowId;
  states: [IntelligenceTierMatrixState, IntelligenceTierMatrixState, IntelligenceTierMatrixState];
};

const blueprint: Blueprint[] = [
  { id: "signals", states: ["value", "value", "value"] },
  { id: "source-depth", states: ["limited", "included", "included"] },
  { id: "freshness", states: ["limited", "included", "included"] },
  { id: "corroboration", states: ["limited", "included", "requires-evidence"] },
  { id: "risk", states: ["included", "included", "included"] },
  { id: "confidence", states: ["included", "included", "included"] },
  { id: "uncertainty", states: ["included", "included", "included"] },
  { id: "missing-evidence", states: ["included", "included", "included"] },
  { id: "liquidity", states: ["limited", "included", "included"] },
  { id: "exit-depth", states: ["limited", "included", "included"] },
  { id: "market-structure", states: ["limited", "included", "included"] },
  { id: "holder-concentration", states: ["limited", "included", "included"] },
  { id: "contract-permissions", states: ["not-included", "conditional", "requires-evidence"] },
  { id: "market-impact", states: ["not-included", "limited", "included"] },
  { id: "whale-watch", states: ["not-included", "conditional", "included"] },
  { id: "scenario-lab", states: ["limited", "included", "included"] },
  { id: "pdf-preview", states: ["limited", "included", "included"] },
  { id: "full-pdf", states: ["not-included", "included", "included"] },
  { id: "evidence-packet", states: ["limited", "included", "included"] },
  { id: "versioning", states: ["not-included", "included", "included"] },
  { id: "review-required", states: ["not-included", "conditional", "included"] },
  { id: "downgrade-behavior", states: ["included", "included", "included"] },
];

export function getIntelligenceTierMatrix(
  locale: IntelligenceLocale,
  signals: [number, number, number],
): IntelligenceTierMatrixRow[] {
  return blueprint.map((row) => ({
    id: row.id,
    label: labels[locale][row.id],
    cells: row.states.map((state, index) => ({
      state,
      label: state === "value" ? String(signals[index]) : stateLabels[locale][state],
    })) as IntelligenceTierMatrixRow["cells"],
  }));
}
