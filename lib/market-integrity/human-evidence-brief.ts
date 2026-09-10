import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import type { Pass455HumanDecisionPdfForge, Pass455Metric } from "@/lib/market-integrity/human-decision-pdf-forge-runtime";
import type { Pass477UnifiedDepthContract } from "@/lib/market-integrity/unified-depth-contract";

export type Pass478Locale = "pl" | "de" | "en";
export type Pass478ClaimState = "confirmed" | "review" | "source_required" | "not_applicable";
export type Pass478VerdictTone = "grounded" | "cautious" | "limited";

export type Pass478HumanEvidenceBrief = {
  version: "human-evidence-brief";
  locale: Pass478Locale;
  depth: Pass477UnifiedDepthContract["selectedDepth"];
  assetClass: string;
  verdict: {
    tone: Pass478VerdictTone;
    label: string;
    headline: string;
    summary: string;
    evidenceCoverageCeiling: number;
    /** @deprecated Compatibility alias for evidenceCoverageCeiling; not calibrated confidence. */
    confidenceCeiling: number;
  };
  claims: Array<{
    id: string;
    label: string;
    value: string;
    meaning: string;
    state: Pass478ClaimState;
    stateLabel: string;
  }>;
  confirmedFacts: string[];
  evidenceLimits: string[];
  /** @deprecated Compatibility alias for evidenceLimits. */
  confidenceLimits: string[];
  nextChecks: string[];
  whatWouldChangeTheRead: string[];
  disclosure: string;
};

function localeOf(locale: string): Pass478Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function assetClassOf(result: VelmereSearchResult) {
  return result.marketSnapshot?.assetClass || result.category || "market";
}

function safeText(value: string, max = 260) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function labels(locale: Pass478Locale) {
  if (locale === "de") {
    return {
      tone: { grounded: "belegt", cautious: "vorsichtig", limited: "begrenzt" },
      headline: {
        grounded: "Die Kernaussage ist durch mehrere Quellen begrenzt belastbar",
        cautious: "Das Marktbild ist nutzbar, aber noch nicht vollständig bestätigt",
        limited: "Die Daten reichen nur für eine vorsichtige Vorprüfung",
      },
      state: {
        confirmed: "bestätigt",
        review: "prüfen",
        source_required: "Quelle erforderlich",
        not_applicable: "nicht anwendbar",
      },
      noFact: "Noch kein Kernfakt ist ausreichend belegt.",
      noLimit: "Keine zusätzliche prioritäre Evidenzlücke wurde gemeldet.",
      next: "Nächste Prüfung",
      questions: [
        "Bestätigt eine unabhängige Quelle denselben Preis- und Zeitstempel?",
        "Ändern Liquidität, Depth oder Slippage die praktische Ausführbarkeit?",
        "Gibt es neue Holder-, Unlock-, Filing- oder Venue-Daten, die die Grenze verschieben?",
      ],
      disclosure: "Der Bericht beschreibt Evidenz und Unsicherheit. Er prognostiziert keinen Preis und ersetzt keine eigene Prüfung.",
      summary: (symbol: string, depth: string, assetClass: string, confidence: number) =>
        `${symbol} wird im Modus ${depth} als ${assetClass} mit einer Evidenzabdeckungsgrenze von ${confidence}% gelesen. Das ist keine kalibrierte Konfidenz. Bestätigte Fakten bleiben getrennt von Prüfwerten und fehlenden Quellen.`,
    };
  }
  if (locale === "en") {
    return {
      tone: { grounded: "grounded", cautious: "cautious", limited: "limited" },
      headline: {
        grounded: "The core read is bounded by multiple supporting sources",
        cautious: "The market read is usable but not fully confirmed",
        limited: "The data supports only a cautious pre-screen",
      },
      state: {
        confirmed: "confirmed",
        review: "review",
        source_required: "source required",
        not_applicable: "not applicable",
      },
      noFact: "No core fact is sufficiently supported yet.",
      noLimit: "No additional priority evidence gap was returned.",
      next: "Next check",
      questions: [
        "Does an independent source confirm the same price and timestamp?",
        "Do liquidity, depth or slippage change practical executability?",
        "Is there new holder, unlock, filing or venue evidence that changes the boundary?",
      ],
      disclosure: "This report describes evidence and uncertainty. It does not forecast price or replace independent verification.",
      summary: (symbol: string, depth: string, assetClass: string, confidence: number) =>
        `${symbol} is read in ${depth} mode as ${assetClass}, with a ${confidence}% evidence-coverage ceiling. This is not calibrated confidence. Confirmed facts remain separate from review values and missing sources.`,
    };
  }
  return {
    tone: { grounded: "ugruntowane", cautious: "ostrożne", limited: "ograniczone" },
    headline: {
      grounded: "Rdzeń analizy ma wsparcie w kilku źródłach, ale pozostaje ograniczony dowodami",
      cautious: "Obraz rynku jest użyteczny, lecz nie wszystko zostało potwierdzone",
      limited: "Dane wystarczają tylko do ostrożnego prescreenu",
    },
    state: {
      confirmed: "potwierdzone",
      review: "do sprawdzenia",
      source_required: "wymaga źródła",
      not_applicable: "nie dotyczy",
    },
    noFact: "Żaden kluczowy fakt nie ma jeszcze wystarczającego pokrycia.",
    noLimit: "Nie zgłoszono dodatkowej priorytetowej luki dowodowej.",
    next: "Następne sprawdzenie",
    questions: [
      "Czy niezależne źródło potwierdza tę samą cenę i znacznik czasu?",
      "Czy płynność, depth albo poślizg zmieniają realną wykonalność?",
      "Czy pojawiły się nowe dane holderów, unlocków, filingów lub venue, które zmieniają granicę?",
    ],
    disclosure: "Raport opisuje dowody i niepewność. Nie prognozuje ceny i nie zastępuje samodzielnej weryfikacji.",
    summary: (symbol: string, depth: string, assetClass: string, confidence: number) =>
      `${symbol} jest czytany w trybie ${depth} jako ${assetClass}, z limitem pokrycia dowodów ${confidence}%. To nie jest skalibrowana pewność. Fakty potwierdzone pozostają oddzielone od wartości do sprawdzenia i brakujących źródeł.`,
  };
}

function claimState(metric: Pass455Metric): Pass478ClaimState {
  return metric.state === "confirmed"
    ? "confirmed"
    : metric.state === "not_applicable"
      ? "not_applicable"
      : metric.state === "source_required"
        ? "source_required"
        : "review";
}

function unique(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => safeText(value)).filter(Boolean))).slice(0, limit);
}

export function buildPass478HumanEvidenceBrief(
  result: VelmereSearchResult,
  locale: string,
  depthContract: Pass477UnifiedDepthContract,
  forge: Pass455HumanDecisionPdfForge,
): Pass478HumanEvidenceBrief {
  const safeLocale = localeOf(locale);
  const copy = labels(safeLocale);
  const selectedTier = forge.tiers.find((tier) => tier.id === depthContract.selectedDepth) || forge.tiers[0];
  const selectedMetrics = selectedTier.metrics
    .filter((metric) => depthContract.metricIds.includes(metric.id))
    .slice(0, depthContract.fieldBudget);
  const claims = selectedMetrics.map((metric) => {
    const state = claimState(metric);
    return {
      id: metric.id,
      label: safeText(metric.label, 80),
      value: safeText(metric.value, 160),
      meaning: safeText(metric.humanMeaning, 240),
      state,
      stateLabel: copy.state[state],
    };
  });
  const confirmedFacts = unique(
    claims
      .filter((claim) => claim.state === "confirmed")
      .map((claim) => `${claim.label}: ${claim.value}`),
    depthContract.selectedDepth === "basic" ? 4 : depthContract.selectedDepth === "pro" ? 6 : 8,
  );
  const metricLimits = claims
    .filter((claim) => claim.state === "review" || claim.state === "source_required")
    .map((claim) => `${claim.label}: ${claim.value}`);
  const evidenceLimits = unique(
    [...result.missingData, ...metricLimits],
    depthContract.selectedDepth === "advanced" ? 8 : 5,
  );
  const nextChecks = unique(
    [result.nextOperatorStep, ...evidenceLimits.map((item) => `${copy.next}: ${item}`)],
    depthContract.selectedDepth === "advanced" ? 5 : 3,
  );
  const evidenceCoverageCeiling = depthContract.evidenceCoverageCeiling;
  const tone: Pass478VerdictTone =
    depthContract.evidenceState === "source_bound" && evidenceCoverageCeiling >= 65
      ? "grounded"
      : depthContract.sourceCount >= 1 && evidenceCoverageCeiling >= 38
        ? "cautious"
        : "limited";
  const symbol = (result.symbol || result.avatarLabel || result.title || "VLM").toUpperCase();
  const assetClass = assetClassOf(result);

  return {
    version: "human-evidence-brief",
    locale: safeLocale,
    depth: depthContract.selectedDepth,
    assetClass,
    verdict: {
      tone,
      label: copy.tone[tone],
      headline: copy.headline[tone],
      summary: copy.summary(symbol, depthContract.label, assetClass, evidenceCoverageCeiling),
      evidenceCoverageCeiling,
      confidenceCeiling: evidenceCoverageCeiling,
    },
    claims,
    confirmedFacts: confirmedFacts.length ? confirmedFacts : [copy.noFact],
    evidenceLimits: evidenceLimits.length ? evidenceLimits : [copy.noLimit],
    confidenceLimits: evidenceLimits.length ? evidenceLimits : [copy.noLimit],
    nextChecks,
    whatWouldChangeTheRead: copy.questions.slice(
      0,
      depthContract.selectedDepth === "basic" ? 1 : depthContract.selectedDepth === "pro" ? 2 : 3,
    ),
    disclosure: copy.disclosure,
  };
}
