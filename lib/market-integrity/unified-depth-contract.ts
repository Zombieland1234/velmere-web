import {
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderFamilies,
} from "@/lib/ai/evidence-normalization";

export type Pass477Locale = "pl" | "de" | "en";
export type Pass477Depth = "basic" | "pro" | "advanced";
export type Pass477EvidenceState = "source_bound" | "partial" | "source_required";

export type Pass477UnifiedDepthContract = {
  version: "unified-depth-contract";
  locale: Pass477Locale;
  selectedDepth: Pass477Depth;
  label: string;
  fieldBudget: 10 | 14 | 20;
  purpose: string;
  includes: string[];
  excludes: string[];
  metricIds: string[];
  sourceCount: number;
  /** Deterministic evidence-coverage ceiling, not calibrated confidence. */
  evidenceCoverageCeiling: number;
  /** @deprecated Compatibility alias for evidenceCoverageCeiling; not calibrated confidence. */
  confidenceCeiling: number;
  evidenceState: Pass477EvidenceState;
  evidenceStateLabel: string;
  generationStages: Array<{
    id: "identity" | "sources" | "analysis" | "seal";
    label: string;
  }>;
  parityContract: {
    readerMatchesPdfPayload: true;
    downloadMatchesPreviewBlob: true;
    shieldHandoffKeepsDepth: true;
    missingDataMayNotBecomeFact: true;
  };
};

export function resolvePass477Depth(value: string | null | undefined): Pass477Depth {
  return value === "basic" || value === "pro" || value === "advanced"
    ? value
    : "advanced";
}

function resolveLocale(locale: string): Pass477Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const metricIds: Record<Pass477Depth, string[]> = {
  basic: [
    "identity",
    "price",
    "marketCap",
    "change24h",
    "volume24h",
    "range24h",
    "source",
    "freshness",
    "confidence",
    "next",
  ],
  pro: [
    "identity",
    "price",
    "marketCap",
    "change24h",
    "volume24h",
    "range24h",
    "change1h",
    "change7d",
    "fdv",
    "turnover",
    "secondSource",
    "quorum",
    "evidenceDebt",
    "marketMeaning",
  ],
  advanced: [
    "liquidity",
    "slippage",
    "depth",
    "holders",
    "unlocks",
    "venue",
    "anomaly",
    "liquidityScale",
    "timestampSkew",
    "sourceEntropy",
    "fakeLive",
    "narrativeDrift",
    "releaseMode",
    "lineage",
    "execution",
    "supplyOverhang",
    "orderbookFragility",
    "providerResilience",
    "nextProbe",
    "boundary",
  ],
};

function localized(locale: Pass477Locale, depth: Pass477Depth) {
  const content = {
    pl: {
      labels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
      purpose: {
        basic: "Szybko ustala sytuację, jakość danych i jeden następny krok.",
        pro: "Dodaje dynamikę rynku, drugie źródło i kontekst jakości danych.",
        advanced: "Otwiera pełną warstwę wykonania, koncentracji, podaży, anomalii i lineage.",
      },
      includes: {
        basic: ["kluczowe liczby", "świeżość", "pokrycie danych", "jedno działanie"],
        pro: ["Basic", "1h i 7d", "FDV i turnover", "drugie źródło", "luki dowodowe"],
        advanced: ["Pro", "płynność i poślizg", "depth", "holderzy i unlocki", "venue health", "lineage"],
      },
      excludes: {
        basic: ["orderbook", "holderzy", "unlocki", "wnioski bez drugiego źródła"],
        pro: ["pełna mikrostruktura", "twardy werdykt bez źródeł on-chain lub filingów"],
        advanced: ["prognoza ceny", "porada inwestycyjna", "zmyślone wartości dla brakujących pól"],
      },
      evidence: {
        source_bound: "oparte na źródłach",
        partial: "częściowe pokrycie źródeł",
        source_required: "wymaga źródła",
      },
      stages: ["Tożsamość", "Źródła i luki", "Analiza", "Podpis Velmère"],
    },
    de: {
      labels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
      purpose: {
        basic: "Klärt schnell Marktlage, Datenqualität und einen nächsten Schritt.",
        pro: "Ergänzt Marktdynamik, Zweitquelle und Datenqualitätskontext.",
        advanced: "Öffnet Ausführung, Konzentration, Angebot, Anomalien und Lineage.",
      },
      includes: {
        basic: ["Kernzahlen", "Freshness", "Datenabdeckung", "eine Aktion"],
        pro: ["Basic", "1h und 7d", "FDV und Turnover", "Zweitquelle", "Evidenzlücken"],
        advanced: ["Pro", "Liquidität und Slippage", "Depth", "Holder und Unlocks", "Venue Health", "Lineage"],
      },
      excludes: {
        basic: ["Orderbook", "Holder", "Unlocks", "Aussagen ohne Zweitquelle"],
        pro: ["volle Mikrostruktur", "hartes Urteil ohne On-Chain- oder Filing-Quelle"],
        advanced: ["Preisprognose", "Anlageberatung", "erfundene Werte für fehlende Felder"],
      },
      evidence: {
        source_bound: "quellengebunden",
        partial: "teilweise Quellenabdeckung",
        source_required: "Quelle erforderlich",
      },
      stages: ["Identität", "Quellen und Lücken", "Analyse", "Velmère Signatur"],
    },
    en: {
      labels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
      purpose: {
        basic: "Quickly establishes the market state, data quality and one next action.",
        pro: "Adds market dynamics, a second source and data-quality context.",
        advanced: "Opens execution, concentration, supply, anomaly and lineage layers.",
      },
      includes: {
        basic: ["key figures", "freshness", "data coverage", "one action"],
        pro: ["Basic", "1h and 7d", "FDV and turnover", "second source", "evidence gaps"],
        advanced: ["Pro", "liquidity and slippage", "depth", "holders and unlocks", "venue health", "lineage"],
      },
      excludes: {
        basic: ["order book", "holders", "unlocks", "claims without a second source"],
        pro: ["full microstructure", "hard verdicts without on-chain or filing evidence"],
        advanced: ["price forecasts", "investment advice", "invented values for missing fields"],
      },
      evidence: {
        source_bound: "source-bound",
        partial: "partial source coverage",
        source_required: "source required",
      },
      stages: ["Identity", "Sources and gaps", "Analysis", "Velmère seal"],
    },
  } as const;
  const branch = content[locale];
  return {
    label: branch.labels[depth],
    purpose: branch.purpose[depth],
    includes: [...branch.includes[depth]],
    excludes: [...branch.excludes[depth]],
    evidence: branch.evidence,
    stages: branch.stages,
  };
}

export function buildPass477UnifiedDepthContract(
  result: VelmereSearchResult,
  locale: string,
  requestedDepth: Pass477Depth,
  options: { nowMs?: number } = {},
): Pass477UnifiedDepthContract {
  const safeLocale = resolveLocale(locale);
  const selectedDepth = resolvePass477Depth(requestedDepth);
  const copy = localized(safeLocale, selectedDepth);
  const providers = independentLiveProviderFamilies(result.sources);
  const sourceCount = providers.length;
  const timestamp = assessEvidenceTimestamp(result.marketSnapshot?.observedAt, { nowMs: options.nowMs });
  const sourceCap = sourceCount >= 2 ? 88 : sourceCount === 1 ? 64 : 32;
  const freshnessCap = timestamp.state === "fresh"
    ? 92
    : timestamp.state === "aging"
      ? 80
      : timestamp.state === "stale"
        ? 64
        : 56;
  const missingPenalty = Math.min(24, result.missingData.length * 4);
  const sourceCoverage = result.sourceCoverage ?? sourceEvidenceCoverageScore(result);
  // This is a deterministic evidence-coverage ceiling. It intentionally does
  // not consume the legacy sourceConfidence heuristic.
  const evidenceCoverageCeiling = clamp(
    Math.min(sourceCoverage, sourceCap, freshnessCap) - missingPenalty,
  );
  const evidenceState: Pass477EvidenceState =
    sourceCount >= 2 && evidenceCoverageCeiling >= 60
      ? "source_bound"
      : sourceCount >= 1
        ? "partial"
        : "source_required";
  const [identity, sources, analysis, seal] = copy.stages;

  return {
    version: "unified-depth-contract",
    locale: safeLocale,
    selectedDepth,
    label: copy.label,
    fieldBudget: selectedDepth === "basic" ? 10 : selectedDepth === "pro" ? 14 : 20,
    purpose: copy.purpose,
    includes: copy.includes,
    excludes: copy.excludes,
    metricIds: metricIds[selectedDepth],
    sourceCount,
    evidenceCoverageCeiling,
    confidenceCeiling: evidenceCoverageCeiling,
    evidenceState,
    evidenceStateLabel: copy.evidence[evidenceState],
    generationStages: [
      { id: "identity", label: identity },
      { id: "sources", label: sources },
      { id: "analysis", label: analysis },
      { id: "seal", label: seal },
    ],
    parityContract: {
      readerMatchesPdfPayload: true,
      downloadMatchesPreviewBlob: true,
      shieldHandoffKeepsDepth: true,
      missingDataMayNotBecomeFact: true,
    },
  };
}
