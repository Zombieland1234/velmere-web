import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  buildPass454EvidenceDenseHumanAnalysis,
  type Pass454Metric,
  type Pass454State,
  type Pass454TierId,
} from "@/lib/market-integrity/evidence-dense-human-analysis-runtime";

export type Pass455Locale = "pl" | "de" | "en";

export type Pass455Metric = Pass454Metric & {
  stateLabel: string;
};

export type Pass455Tier = {
  id: Pass454TierId;
  label: string;
  fieldCount: 10 | 14 | 20;
  promise: string;
  metrics: Pass455Metric[];
};

export type Pass455HumanDecisionPdfForge = {
  version: "human-decision-pdf-forge-runtime";
  locale: Pass455Locale;
  executive: {
    eyebrow: string;
    headline: string;
    oneSentence: string;
    whatWeKnow: string[];
    whatItMeans: string;
    whatIsMissing: string[];
    nextCheck: string;
    confidenceLabel: string;
  };
  tiers: Pass455Tier[];
  forge: {
    stageCount: 4;
    stages: Array<{
      id: "identity" | "market" | "evidence" | "seal";
      label: string;
      detail: string;
    }>;
  };
  browserContract: {
    defaultPreview: "reader";
    exactPdfStillAvailable: true;
    animatedVVisible: true;
    stageProgressVisible: true;
    backgroundScrollLocked: true;
    downloadIconRequired: true;
  };
  realMarketsContract: {
    mixedUniverseVisible: true;
    venueHealthVisible: true;
    venueHealthSeparatedFromEquities: true;
    catalogRowsDeduplicated: true;
    categories: readonly [
      "crypto",
      "stocks",
      "indices",
      "fx",
      "etf",
      "commodities",
      "real_estate",
      "exchanges",
    ];
  };
};

function localeOf(locale: string): Pass455Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function copy(locale: Pass455Locale) {
  if (locale === "de") {
    return {
      eyebrow: "Velmère Human Decision Layer",
      headline: "Erst verstehen, dann tiefer prüfen",
      whatWeKnow: "Was bereits belegt ist",
      whatItMeans: "Was das für den Menschen bedeutet",
      whatIsMissing: "Was die Evidenzabdeckung noch begrenzt",
      nextCheck: "Nächste konkrete Prüfung",
      confidence: (value: number) => `Evidenzabdeckungsgrenze ${value}%`,
      noKnown: "Noch kein belastbarer Marktfakt wurde bestätigt.",
      noMissing: "Keine prioritäre Evidenzlücke wurde gemeldet.",
      state: {
        confirmed: "bestätigt",
        review: "prüfen",
        source_required: "Quelle erforderlich",
        not_applicable: "nicht anwendbar",
      } satisfies Record<Pass454State, string>,
      forge: [
        ["identity", "Instrument auflösen", "Symbol, Asset-Klasse und Provider-Route werden eindeutig zugeordnet."],
        ["market", "Marktdaten laden", "Preis, Market Cap, Volumen, Zeitstempel und Kerzen werden strukturiert übernommen."],
        ["evidence", "Evidenz abgleichen", "Zweitquelle, Freshness, Liquidität, Angebot und sichtbare Lücken werden bewertet."],
        ["seal", "Bericht versiegeln", "Lesbare Vorschau und Download verwenden exakt denselben signierten Payload."],
      ] as const,
    };
  }
  if (locale === "en") {
    return {
      eyebrow: "Velmère Human Decision Layer",
      headline: "Understand first, then go deeper",
      whatWeKnow: "What is already supported",
      whatItMeans: "What it means for a person",
      whatIsMissing: "What still limits evidence coverage",
      nextCheck: "Next concrete check",
      confidence: (value: number) => `Evidence-coverage ceiling ${value}%`,
      noKnown: "No reliable market fact has been confirmed yet.",
      noMissing: "No priority evidence gap was returned.",
      state: {
        confirmed: "confirmed",
        review: "review",
        source_required: "source required",
        not_applicable: "not applicable",
      } satisfies Record<Pass454State, string>,
      forge: [
        ["identity", "Resolve instrument", "Symbol, asset class and provider route are resolved before analysis."],
        ["market", "Load market facts", "Price, market cap, volume, timestamp and candles enter a structured snapshot."],
        ["evidence", "Cross-check evidence", "Second source, freshness, liquidity, supply and visible gaps are scored."],
        ["seal", "Seal the report", "Readable preview and download use the exact same signed payload."],
      ] as const,
    };
  }
  return {
    eyebrow: "Velmère Human Decision Layer",
    headline: "Najpierw zrozum, potem wchodź głębiej",
    whatWeKnow: "Co już jest potwierdzone",
    whatItMeans: "Co to znaczy dla człowieka",
    whatIsMissing: "Co nadal ogranicza pokrycie dowodów",
    nextCheck: "Następne konkretne sprawdzenie",
    confidence: (value: number) => `Limit pokrycia dowodów ${value}%`,
    noKnown: "Nie potwierdzono jeszcze wiarygodnego faktu rynkowego.",
    noMissing: "System nie zgłosił priorytetowej luki dowodowej.",
    state: {
      confirmed: "potwierdzone",
      review: "do sprawdzenia",
      source_required: "wymaga źródła",
      not_applicable: "nie dotyczy",
    } satisfies Record<Pass454State, string>,
    forge: [
      ["identity", "Rozpoznanie instrumentu", "Symbol, klasa aktywa i trasa providera są ustalane przed analizą."],
      ["market", "Pobranie faktów rynkowych", "Cena, kapitalizacja, wolumen, timestamp i świece trafiają do strukturalnego snapshotu."],
      ["evidence", "Porównanie dowodów", "Drugie źródło, świeżość, płynność, podaż i widoczne luki dostają ocenę."],
      ["seal", "Podpisanie raportu", "Czytelny podgląd i pobrany PDF używają dokładnie tego samego payloadu."],
    ] as const,
  };
}

const meanings: Record<Pass455Locale, Record<string, string>> = {
  pl: {
    identity: "Potwierdza, że dalsza analiza dotyczy właściwego instrumentu.",
    price: "Pokazuje ostatnią cenę pochodzącą z jawnego źródła.",
    marketCap: "Ustawia aktywo na skali wielkości rynku.",
    change24h: "Opisuje ruch dobowy bez zamieniania go w prognozę.",
    volume24h: "Pokazuje, ile wartości przeszło przez rynek w obserwowanym oknie.",
    range24h: "Pokazuje dzienną amplitudę i ogranicza zgadywanie kierunku.",
    source: "Wskazuje providera stojącego za widocznymi liczbami.",
    freshness: "Nie pozwala, aby stare dane udawały dane live.",
    confidence: "Pokazuje pokrycie dowodów przy brakach źródeł lub świeżości; nie jest skalibrowaną pewnością.",
    next: "Zamienia techniczny brak w jedno konkretne działanie.",
    change1h: "Oddziela krótki impuls od ruchu dobowego.",
    change7d: "Dodaje szerszy kontekst bez przewidywania ceny.",
    fdv: "Pokazuje pełną wycenę po uwzględnieniu podaży, gdy dane są dostępne.",
    turnover: "Normalizuje aktywność handlu względem wielkości aktywa.",
    secondSource: "Niezależne potwierdzenie zmniejsza ryzyko błędu pojedynczego providera.",
    quorum: "Pokazuje, czy mocniejszy wniosek ma minimalne pokrycie w dwóch źródłach.",
    evidenceDebt: "Liczy nierozwiązane pola ograniczające wynik.",
    marketMeaning: "Tłumaczy, dlaczego widoczna struktura ma znaczenie dla użytkownika.",
    liquidity: "Oddziela realną możliwość wykonania transakcji od samej kapitalizacji.",
    slippage: "Szacuje wpływ standardowego zlecenia na cenę.",
    depth: "Sprawdza, czy po obu stronach orderbooka istnieje realna głębokość.",
    holders: "Pokazuje koncentrację tylko wtedy, gdy wspiera ją analiza on-chain.",
    unlocks: "Oddziela znany harmonogram podaży od spekulacji.",
    venue: "Sprawdza kondycję rynku, rytm danych i politykę reconnect.",
    anomaly: "Wskazuje nietypowe zachowanie bez robienia wyroku z jednej flagi.",
    liquidityScale: "Porównuje skalę rynku z płynnością możliwą do wykonania.",
    timestampSkew: "Mierzy odchylenie czasu źródła od czasu raportu.",
    sourceEntropy: "Pokazuje, czy dowody pochodzą z wielu niezależnych kanałów.",
    fakeLive: "Blokuje przedstawianie cache lub jednego źródła jako pełnego live.",
    narrativeDrift: "Pilnuje, aby opis nie był mocniejszy niż dane.",
    releaseMode: "Określa, czy bot może użyć zwykłego, ostrożnego albo wyłącznie faktograficznego języka.",
    lineage: "Zachowuje ścieżkę od payloadu providera do zdania w raporcie.",
    execution: "Łączy pokrycie źródeł, świeżość i braki w jeden sufit wykonania.",
    supplyOverhang: "Pokazuje potencjalną presję rozwodnienia bez prognozy ceny.",
    orderbookFragility: "Łączy depth i slippage w ostrzeżenie o kruchości wykonania.",
    providerResilience: "Sprawdza, czy raport przetrwa awarię jednego providera.",
    nextProbe: "Wybiera brak, którego uzupełnienie najbardziej podniesie pokrycie dowodów.",
    boundary: "Mówi dokładnie, jak daleko pozwalają iść obecne dowody.",
  },
  de: {
    identity: "Bestätigt, dass die weitere Analyse das richtige Instrument betrifft.",
    price: "Zeigt den letzten Preis aus einer sichtbaren Quelle.",
    marketCap: "Ordnet das Asset auf einer Marktgrößen-Skala ein.",
    change24h: "Beschreibt die Tagesbewegung, ohne daraus eine Prognose zu machen.",
    volume24h: "Zeigt den gehandelten Wert im beobachteten Fenster.",
    range24h: "Zeigt die Tagesamplitude und reduziert Richtungsraten.",
    source: "Nennt den Provider hinter den sichtbaren Zahlen.",
    freshness: "Verhindert, dass alte Daten als live erscheinen.",
    confidence: "Zeigt Evidenzabdeckung bei schwachen Quellen oder Freshness; keine kalibrierte Konfidenz.",
    next: "Übersetzt eine technische Lücke in eine konkrete Aktion.",
    change1h: "Trennt den kurzen Impuls von der Tagesbewegung.",
    change7d: "Ergänzt breiteren Kontext ohne Preisprognose.",
    fdv: "Zeigt die vollständig verwässerte Bewertung, wenn Angebotsdaten vorliegen.",
    turnover: "Normalisiert Handelsaktivität nach Asset-Größe.",
    secondSource: "Unabhängige Bestätigung reduziert Single-Provider-Risiko.",
    quorum: "Zeigt, ob stärkere Aussagen mindestens zwei Quellen haben.",
    evidenceDebt: "Zählt offene Felder, die das Ergebnis begrenzen.",
    marketMeaning: "Erklärt die Bedeutung der sichtbaren Struktur für Menschen.",
    liquidity: "Trennt ausführbare Liquidität von reiner Marktkapitalisierung.",
    slippage: "Schätzt den Preiseffekt einer standardisierten Order.",
    depth: "Prüft echte Tiefe auf beiden Seiten des Orderbuchs.",
    holders: "Zeigt Konzentration nur bei belastbarer On-Chain-Unterstützung.",
    unlocks: "Trennt bekannte Angebotsfreigaben von Spekulation.",
    venue: "Prüft Venue-Status, Datenrhythmus und Reconnect-Politik.",
    anomaly: "Markiert ungewöhnliches Verhalten ohne Einzelflaggen-Urteil.",
    liquidityScale: "Vergleicht Marktgröße mit ausführbarer Tiefe.",
    timestampSkew: "Misst den Zeitversatz der Quelle zum Bericht.",
    sourceEntropy: "Zeigt, ob Evidenz über unabhängige Kanäle verteilt ist.",
    fakeLive: "Verhindert, dass Cache oder eine Einzelquelle als vollständiges live verkauft wird.",
    narrativeDrift: "Hält die Erzählung innerhalb der Evidenzgrenze.",
    releaseMode: "Steuert normale, vorsichtige oder reine Fakten-Sprache.",
    lineage: "Erhält den Pfad vom Provider-Payload zur Kundenaussage.",
    execution: "Verdichtet Quellenabdeckung, Freshness und Lücken zu einer Ausführungsgrenze.",
    supplyOverhang: "Zeigt möglichen Verwässerungsdruck ohne Preisprognose.",
    orderbookFragility: "Verbindet Tiefe und Slippage zu einem Ausführungswarnsignal.",
    providerResilience: "Prüft, ob der Bericht einen Provider-Ausfall übersteht.",
    nextProbe: "Wählt die Evidenzlücke mit dem größten Gewinn an Evidenzabdeckung.",
    boundary: "Definiert exakt, wie weit die aktuelle Evidenz reicht.",
  },
  en: {
    identity: "Confirms the exact instrument before any conclusion.",
    price: "Shows the latest price carried by a visible source.",
    marketCap: "Places the asset on a market-size scale.",
    change24h: "Describes the daily move without turning it into a forecast.",
    volume24h: "Shows how much value traded in the observed window.",
    range24h: "Shows daily amplitude and reduces direction guessing.",
    source: "Names the provider behind the visible numbers.",
    freshness: "Stops old data from masquerading as live data.",
    confidence: "Shows evidence coverage under weak source or freshness conditions; not calibrated confidence.",
    next: "Turns a technical gap into one concrete action.",
    change1h: "Separates short impulse from the daily move.",
    change7d: "Adds broader context without forecasting.",
    fdv: "Shows fully diluted valuation when supply data supports it.",
    turnover: "Normalizes trading activity by asset size.",
    secondSource: "Independent confirmation reduces single-provider error.",
    quorum: "Shows whether stronger wording has at least two sources.",
    evidenceDebt: "Counts unresolved fields that still cap the result.",
    marketMeaning: "Explains why the visible structure matters to a person.",
    liquidity: "Separates executable liquidity from headline market cap.",
    slippage: "Estimates the price impact of a standardized order.",
    depth: "Checks for real depth on both sides of the order book.",
    holders: "Shows concentration only when on-chain data supports it.",
    unlocks: "Separates known supply releases from speculation.",
    venue: "Checks venue status, data cadence and reconnect policy.",
    anomaly: "Highlights unusual behaviour without making one flag a verdict.",
    liquidityScale: "Compares market scale with executable depth.",
    timestampSkew: "Measures source-time drift against report time.",
    sourceEntropy: "Shows whether evidence is diversified across independent lanes.",
    fakeLive: "Stops cache or a single source from being sold as full live truth.",
    narrativeDrift: "Keeps the story inside the evidence boundary.",
    releaseMode: "Controls normal, guarded or facts-only language.",
    lineage: "Preserves the route from provider payload to customer claim.",
    execution: "Combines coverage, freshness and gaps into an execution evidence ceiling.",
    supplyOverhang: "Surfaces possible dilution pressure without forecasting price.",
    orderbookFragility: "Combines depth and slippage into an execution warning.",
    providerResilience: "Checks whether the report survives one provider failure.",
    nextProbe: "Chooses the gap with the largest evidence-coverage impact.",
    boundary: "States exactly how far the current evidence allows the conclusion to go.",
  },
};

function localizeValue(locale: Pass455Locale, value: string) {
  const replacements: Record<Pass455Locale, Array<[RegExp, string]>> = {
    pl: [
      [/\bsource-bound\b/gi, "oparte na źródłach"],
      [/\bguarded\b/gi, "ostrożny"],
      [/\bfacts-only\b/gi, "tylko fakty"],
      [/\belevated\b/gi, "podwyższone"],
      [/\breview\b/gi, "do sprawdzenia"],
      [/\blow\b/gi, "niskie"],
      [/\bcontained\b/gi, "ograniczona"],
      [/timestamp missing/gi, "brak timestampu"],
      [/\blanes?\b/gi, "źródła"],
    ],
    de: [
      [/\bsource-bound\b/gi, "quellengebunden"],
      [/\bguarded\b/gi, "vorsichtig"],
      [/\bfacts-only\b/gi, "nur Fakten"],
      [/\belevated\b/gi, "erhöht"],
      [/\breview\b/gi, "prüfen"],
      [/\blow\b/gi, "niedrig"],
      [/\bcontained\b/gi, "begrenzt"],
      [/timestamp missing/gi, "Zeitstempel fehlt"],
      [/\blanes?\b/gi, "Quellen"],
    ],
    en: [],
  };
  return replacements[locale].reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function evidenceCoverageFromTier(tiers: Pass455Tier[]) {
  const evidenceCoverage = tiers
    .find((tier) => tier.id === "basic")
    ?.metrics.find((metric) => metric.id === "confidence")?.value;
  const parsed = Number.parseInt(evidenceCoverage || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPass455HumanDecisionPdfForge(
  result: VelmereSearchResult,
  locale: string,
): Pass455HumanDecisionPdfForge {
  const safeLocale = localeOf(locale);
  const c = copy(safeLocale);
  const pass454 = buildPass454EvidenceDenseHumanAnalysis(result, safeLocale);
  const tiers: Pass455Tier[] = pass454.tiers.map((tier) => ({
    ...tier,
    metrics: tier.metrics.map((item) => ({
      ...item,
      value: localizeValue(safeLocale, item.value),
      humanMeaning: meanings[safeLocale][item.id] || item.humanMeaning,
      stateLabel: c.state[item.state],
    })),
  }));

  const basic = tiers.find((tier) => tier.id === "basic");
  const supported = (basic?.metrics || [])
    .filter((item) => item.state === "confirmed" && !item.value.toLowerCase().includes("wymaga źródła") && !item.value.toLowerCase().includes("quelle erforderlich") && !item.value.toLowerCase().includes("source required"))
    .slice(0, 5)
    .map((item) => `${item.label}: ${item.value}`);
  const missing = result.missingData.slice(0, 4);
  const evidenceCoverage = evidenceCoverageFromTier(tiers);

  return {
    version: "human-decision-pdf-forge-runtime",
    locale: safeLocale,
    executive: {
      eyebrow: c.eyebrow,
      headline: c.headline,
      oneSentence: pass454.verdict.summary,
      whatWeKnow: supported.length ? supported : [c.noKnown],
      whatItMeans: result.whyItMatters,
      whatIsMissing: missing.length ? missing : [c.noMissing],
      nextCheck: result.nextOperatorStep,
      confidenceLabel: c.confidence(evidenceCoverage),
    },
    tiers,
    forge: {
      stageCount: 4,
      stages: c.forge.map(([id, label, detail]) => ({ id, label, detail })),
    },
    browserContract: {
      defaultPreview: "reader",
      exactPdfStillAvailable: true,
      animatedVVisible: true,
      stageProgressVisible: true,
      backgroundScrollLocked: true,
      downloadIconRequired: true,
    },
    realMarketsContract: {
      mixedUniverseVisible: true,
      venueHealthVisible: true,
      venueHealthSeparatedFromEquities: true,
      catalogRowsDeduplicated: true,
      categories: [
        "crypto",
        "stocks",
        "indices",
        "fx",
        "etf",
        "commodities",
        "real_estate",
        "exchanges",
      ],
    },
  };
}

export const pass455HumanDecisionPdfForgeRuntime = {
  id: "PASS455",
  title: "Human Decision Layer + PDF Forge + Real Markets Readability",
  fieldBudgets: { basic: 10, pro: 14, advanced: 20 },
  languages: ["pl", "de", "en"],
  rules: [
    "Customer-facing metric explanations are localized, not English-only.",
    "Reader view opens first while the exact PDF remains available.",
    "Preview and download remain one signed payload.",
    "Missing data is explained as a source requirement, never hidden behind bare unknown.",
    "Exchange venue health stays separate from listed-equity prices.",
  ],
} as const;
