import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderFamilies,
} from "@/lib/ai/evidence-normalization";
import { resolveVolumeSemantics } from "@/lib/market-integrity/volume-semantics";

export type Pass450Locale = "pl" | "de" | "en";
export type Pass450TierId = "basic" | "pro" | "advanced";
export type Pass450FieldState = "confirmed" | "review" | "missing" | "not_applicable";

export type Pass450Field = {
  id: string;
  label: string;
  value: string;
  state: Pass450FieldState;
  note: string;
};

export type Pass450Tier = {
  id: Pass450TierId;
  label: string;
  fieldCount: 10 | 14 | 20;
  promise: string;
  fields: Pass450Field[];
};

export type Pass450TieredHumanAnalysis = {
  version: "tiered-human-analysis-runtime";
  locale: Pass450Locale;
  customerHeadline: string;
  customerSummary: string;
  unknownPolicy: string;
  reportArchitecture: string[];
  tiers: Pass450Tier[];
};

function resolveLocale(locale: string): Pass450Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function number(locale: Pass450Locale, value: number, max = 2) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: max }).format(value);
}

function money(locale: Pass450Locale, value: number | undefined, currency = "USD") {
  if (!finite(value)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  } catch {
    return number(locale, value, Math.abs(value) < 1 ? 6 : 2);
  }
}

function percent(locale: Pass450Locale, value: number | undefined) {
  if (!finite(value)) return "";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${number(locale, value, 2)}%`;
}

function missing(locale: Pass450Locale, label: string) {
  if (locale === "pl") return `Wymaga źródła: ${label}`;
  if (locale === "de") return `Quelle erforderlich: ${label}`;
  return `Source required: ${label}`;
}

function labels(locale: Pass450Locale) {
  if (locale === "pl") {
    return {
      headline: "Jedna analiza, trzy poziomy głębokości",
      summary: "Basic odpowiada na najważniejsze pytania rynkowe. Pro pokazuje dynamikę i jakość źródeł. Advanced otwiera warstwę płynności, koncentracji, wykonania i nietypowych anomalii.",
      unknown: "Brak danych nie jest prezentowany jako „unknown”. Każde puste pole mówi, czego brakuje, dlaczego to ma znaczenie i jakie źródło powinno je uzupełnić.",
      basic: "Szybki obraz dla człowieka: cena, kapitalizacja, zmiana, wolumen, źródło i pewność.",
      pro: "Mocniejszy research: dynamika 1h/7d, FDV, zakres, drugie źródło i luki dowodowe.",
      advanced: "Pełny audyt: płynność, slippage, koncentracja, podaż, venue health, lineage i niestandardowe red flags.",
      confirmed: "Pole pochodzi z aktualnie przypisanego payloadu.",
      review: "Pole ma wartość orientacyjną i wymaga kontekstu albo drugiego źródła.",
      missing: "Pole pozostaje jawnie niepotwierdzone; system nie tworzy wartości zastępczej.",
    };
  }
  if (locale === "de") {
    return {
      headline: "Eine Analyse, drei Tiefenstufen",
      summary: "Basic beantwortet die wichtigsten Marktfragen. Pro zeigt Dynamik und Quellenqualität. Advanced öffnet Liquidität, Konzentration, Ausführung und ungewöhnliche Anomalien.",
      unknown: "Fehlende Daten erscheinen nicht als nacktes „unknown“. Jedes leere Feld erklärt, was fehlt, warum es relevant ist und welche Quelle es ergänzen sollte.",
      basic: "Schneller Überblick: Preis, Market Cap, Bewegung, Volumen, Quelle und Konfidenz.",
      pro: "Tieferes Research: 1h/7d-Dynamik, FDV, Spanne, Zweitquelle und Evidenzlücken.",
      advanced: "Voll-Audit: Liquidität, Slippage, Konzentration, Angebot, Venue Health, Lineage und ungewöhnliche Red Flags.",
      confirmed: "Das Feld stammt aus dem aktuell zugeordneten Payload.",
      review: "Der Wert ist orientierend und benötigt Kontext oder eine Zweitquelle.",
      missing: "Das Feld bleibt sichtbar unbestätigt; das System erzeugt keinen Ersatzwert.",
    };
  }
  return {
    headline: "One analysis, three levels of depth",
    summary: "Basic answers the key market questions. Pro adds dynamics and source quality. Advanced opens liquidity, concentration, execution and unusual-anomaly lanes.",
    unknown: "Missing data is never shown as a bare “unknown”. Every empty field explains what is missing, why it matters and which source should resolve it.",
    basic: "Fast human overview: price, market cap, move, volume, source and confidence.",
    pro: "Deeper research: 1h/7d dynamics, FDV, range, second source and evidence gaps.",
    advanced: "Full audit: liquidity, slippage, concentration, supply, venue health, lineage and unusual red flags.",
    confirmed: "The field comes from the currently assigned payload.",
    review: "The value is directional and still needs context or a second source.",
    missing: "The field remains visibly unconfirmed; the system does not generate a substitute value.",
  };
}

function field(
  locale: Pass450Locale,
  id: string,
  label: string,
  value: string | null | undefined,
  state: Pass450FieldState = "confirmed",
  note?: string,
): Pass450Field {
  const copy = labels(locale);
  const hasValue = Boolean(value && value.trim());
  const resolvedState = hasValue ? state : "missing";
  return {
    id,
    label,
    value: hasValue ? value!.trim() : missing(locale, label.toLowerCase()),
    state: resolvedState,
    note: note || (resolvedState === "confirmed" ? copy.confirmed : resolvedState === "review" ? copy.review : copy.missing),
  };
}

export function buildPass450TieredHumanAnalysis(
  result: VelmereSearchResult,
  locale: string,
  options: { nowMs?: number } = {},
): Pass450TieredHumanAnalysis {
  const safeLocale = resolveLocale(locale);
  const copy = labels(safeLocale);
  const snapshot = result.marketSnapshot;
  const currency = snapshot?.currency || "USD";
  const providerFamilies = independentLiveProviderFamilies(result.sources);
  const sourceTotal = providerFamilies.length;
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, { nowMs: options.nowMs });
  const sourceTimestamp = timestamp.observedAt && timestamp.state !== "future" && timestamp.state !== "invalid"
    ? new Date(timestamp.observedAt).toLocaleString(safeLocale)
    : undefined;
  const volumeSemantics = resolveVolumeSemantics({
    source: providerFamilies[0],
    locale: safeLocale,
    observedAt: snapshot?.observedAt,
  });

  const basicFields: Pass450Field[] = [
    field(safeLocale, "identity", safeLocale === "pl" ? "Instrument" : safeLocale === "de" ? "Instrument" : "Instrument", `${result.symbol || "VLM"} · ${result.title}`),
    field(safeLocale, "price", safeLocale === "pl" ? "Cena" : safeLocale === "de" ? "Preis" : "Price", money(safeLocale, snapshot?.price, currency)),
    field(safeLocale, "marketCap", safeLocale === "pl" ? "Kapitalizacja" : safeLocale === "de" ? "Marktkapitalisierung" : "Market cap", money(safeLocale, snapshot?.marketCap, currency)),
    field(safeLocale, "change24h", safeLocale === "pl" ? "Zmiana 24h" : safeLocale === "de" ? "Änderung 24h" : "24h change", percent(safeLocale, snapshot?.change24h), "review"),
    field(safeLocale, "volume24h", `${safeLocale === "pl" ? "Wolumen 24h" : safeLocale === "de" ? "Volumen 24h" : "24h volume"} (${volumeSemantics.shortScopeLabel})`, money(safeLocale, snapshot?.volume24h, currency), "confirmed", `${volumeSemantics.scopeLabel}: ${volumeSemantics.disclosure}`),
    field(safeLocale, "range24h", safeLocale === "pl" ? "Zakres 24h" : safeLocale === "de" ? "24h-Spanne" : "24h range", finite(snapshot?.low24h) && finite(snapshot?.high24h) ? `${money(safeLocale, snapshot?.low24h, currency)} – ${money(safeLocale, snapshot?.high24h, currency)}` : "", "review"),
    field(safeLocale, "source", safeLocale === "pl" ? "Źródło główne" : safeLocale === "de" ? "Hauptquelle" : "Primary source", providerFamilies[0]),
    field(safeLocale, "timestamp", safeLocale === "pl" ? "Czas obserwacji" : safeLocale === "de" ? "Beobachtungszeit" : "Observation time", sourceTimestamp),
    field(safeLocale, "confidence", safeLocale === "pl" ? "Pewność źródeł" : safeLocale === "de" ? "Quellenkonfidenz" : "Source confidence", `${Math.round(result.sourceConfidence)}%`, "review"),
    field(safeLocale, "next", safeLocale === "pl" ? "Następny krok" : safeLocale === "de" ? "Nächster Schritt" : "Next step", result.nextOperatorStep, "review"),
  ];

  const proFields = [
    ...basicFields.slice(0, 6),
    field(safeLocale, "change1h", safeLocale === "pl" ? "Zmiana 1h" : safeLocale === "de" ? "Änderung 1h" : "1h change", percent(safeLocale, snapshot?.change1h), "review"),
    field(safeLocale, "change7d", safeLocale === "pl" ? "Zmiana 7d" : safeLocale === "de" ? "Änderung 7d" : "7d change", percent(safeLocale, snapshot?.change7d), "review"),
    field(safeLocale, "fdv", "FDV", money(safeLocale, snapshot?.fdv, currency), "review"),
    field(safeLocale, "turnover", safeLocale === "pl" ? "Wolumen / kapitalizacja" : safeLocale === "de" ? "Volumen / Market Cap" : "Volume / market cap", finite(snapshot?.volume24h) && finite(snapshot?.marketCap) && snapshot!.marketCap! > 0 ? `${number(safeLocale, (snapshot!.volume24h! / snapshot!.marketCap!) * 100, 2)}%` : "", "review"),
    field(safeLocale, "secondSource", safeLocale === "pl" ? "Drugie źródło" : safeLocale === "de" ? "Zweitquelle" : "Second source", sourceTotal >= 2 ? providerFamilies[1] : "", sourceTotal >= 2 ? "review" : "missing"),
    field(safeLocale, "sourceState", safeLocale === "pl" ? "Stan źródeł" : safeLocale === "de" ? "Quellenstatus" : "Source state", `${result.sourceMode} · ${sourceTotal} ${safeLocale === "pl" ? "niezależne rodziny" : safeLocale === "de" ? "unabhängige Familien" : "independent families"}`, "review"),
    field(safeLocale, "gaps", safeLocale === "pl" ? "Luki dowodowe" : safeLocale === "de" ? "Evidenzlücken" : "Evidence gaps", result.missingData.slice(0, 3).join(" · "), result.missingData.length ? "review" : "confirmed"),
    field(safeLocale, "why", safeLocale === "pl" ? "Znaczenie" : safeLocale === "de" ? "Bedeutung" : "Why it matters", result.whyItMatters, "review"),
  ] satisfies Pass450Field[];

  const advancedFields = [
    ...proFields.slice(0, 10),
    field(safeLocale, "liquidity", safeLocale === "pl" ? "Płynność wykonawcza" : safeLocale === "de" ? "Ausführungsliquidität" : "Execution liquidity", snapshot?.liquidityLabel, "review"),
    field(safeLocale, "slippage", safeLocale === "pl" ? "Poślizg 10k" : safeLocale === "de" ? "Slippage 10k" : "10k slippage", snapshot?.slippage10k === undefined ? "" : percent(safeLocale, snapshot.slippage10k), "review"),
    field(safeLocale, "depth", safeLocale === "pl" ? "Głębokość bid / ask" : safeLocale === "de" ? "Bid-/Ask-Tiefe" : "Bid / ask depth", snapshot?.depthLabel, "review"),
    field(safeLocale, "supply", safeLocale === "pl" ? "Podaż w obiegu" : safeLocale === "de" ? "Umlaufangebot" : "Circulating supply", finite(snapshot?.circulatingSupply) ? number(safeLocale, snapshot!.circulatingSupply!, 0) : "", "review"),
    field(safeLocale, "float", safeLocale === "pl" ? "Float / podaż całkowita" : safeLocale === "de" ? "Float / Gesamtangebot" : "Float / total supply", finite(snapshot?.circulatingSupply) && finite(snapshot?.totalSupply) && snapshot!.totalSupply! > 0 ? `${number(safeLocale, (snapshot!.circulatingSupply! / snapshot!.totalSupply!) * 100, 2)}%` : "", "review"),
    field(safeLocale, "holders", safeLocale === "pl" ? "Koncentracja holderów" : safeLocale === "de" ? "Holder-Konzentration" : "Holder concentration", snapshot?.holderConcentrationLabel, "review"),
    field(safeLocale, "unlocks", safeLocale === "pl" ? "Unlock / vesting" : safeLocale === "de" ? "Unlock / Vesting" : "Unlock / vesting", snapshot?.unlockLabel, "review"),
    field(safeLocale, "venue", safeLocale === "pl" ? "Venue health" : safeLocale === "de" ? "Venue Health" : "Venue health", snapshot?.venueHealthLabel, "review"),
    field(safeLocale, "lineage", safeLocale === "pl" ? "Lineage źródeł" : safeLocale === "de" ? "Quellen-Lineage" : "Source lineage", providerFamilies.join(" → "), "review"),
    field(safeLocale, "anomaly", safeLocale === "pl" ? "Nietypowa anomalia" : safeLocale === "de" ? "Ungewöhnliche Anomalie" : "Unusual anomaly", snapshot?.anomalyLabel || result.missingData[0], "review"),
  ] satisfies Pass450Field[];

  return {
    version: "tiered-human-analysis-runtime",
    locale: safeLocale,
    customerHeadline: copy.headline,
    customerSummary: copy.summary,
    unknownPolicy: copy.unknown,
    reportArchitecture: [
      safeLocale === "pl" ? "Wniosek w jednym zdaniu" : safeLocale === "de" ? "Fazit in einem Satz" : "One-sentence verdict",
      safeLocale === "pl" ? "Dane rynkowe i ich pochodzenie" : safeLocale === "de" ? "Marktdaten und Herkunft" : "Market data and provenance",
      safeLocale === "pl" ? "Luki oraz ich wpływ na pewność" : safeLocale === "de" ? "Lücken und Einfluss auf Konfidenz" : "Gaps and confidence impact",
      safeLocale === "pl" ? "Następne kroki operatora" : safeLocale === "de" ? "Nächste Operator-Schritte" : "Next operator actions",
    ],
    tiers: [
      { id: "basic", label: "Basic", fieldCount: 10, promise: copy.basic, fields: basicFields.slice(0, 10) },
      { id: "pro", label: "Pro", fieldCount: 14, promise: copy.pro, fields: proFields.slice(0, 14) },
      { id: "advanced", label: "Advanced", fieldCount: 20, promise: copy.advanced, fields: advancedFields.slice(0, 20) },
    ],
  };
}

export const pass450TieredHumanAnalysisRuntime = {
  id: "PASS450",
  title: "Tiered Human Analysis Runtime",
  fieldBudgets: { basic: 10, pro: 14, advanced: 20 },
  rules: [
    "Basic carries market essentials and source confidence.",
    "Pro adds dynamics, FDV, second-source state and evidence gaps.",
    "Advanced adds execution, supply, concentration, venue and lineage lanes.",
    "Missing values explain the missing source instead of rendering bare unknown.",
  ],
} as const;
