export type AnalysisTier = "basic" | "pro" | "advanced";
export type AnalysisLocale = "pl" | "en" | "de";

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export type AnalysisEvidence = {
  id: string;
  source: string;
  timestamp: string | null;
  note: string;
};

export type AnalysisSignalTone = "positive" | "neutral" | "warning" | "negative";
export type AnalysisProvenanceState = "DERIVED" | "UNAVAILABLE";

export type AnalysisSignalVisual =
  | "line"
  | "histogram"
  | "gauge"
  | "levels"
  | "balance"
  | "ring"
  | "scan"
  | "scenario";

export type AnalysisSignal = {
  id: string;
  group: "price" | "conditions" | "flows" | "intelligence";
  name: string;
  value: string;
  interpretation: string;
  description: string;
  reason: string;
  impact: string;
  status: string;
  tone: AnalysisSignalTone;
  visual: AnalysisSignalVisual;
  score: number | null;
  series: number[];
  evidence: AnalysisEvidence[];
  provenanceState: AnalysisProvenanceState;
  inputFields: string[];
  derivation: string;
};

export type AnalysisResult = {
  tier: AnalysisTier;
  verdict: string;
  riskScore: number | null;
  confidence: number | null;
  sourceCount: number;
  dataQuality: string;
  summary: string;
  completedAt: string;
  signals: AnalysisSignal[];
};

export type VlmAnalysisAsset = {
  id?: string;
  symbol: string;
  name: string;
  priceLabel: string;
  changeLabel?: string | null;
  changeTone?: "up" | "down" | "neutral";
  riskLabel?: string | null;
  confidenceLabel?: string | null;
  /** Customer-visible confidence is publishable only when this flag is backed by an explicit calibration artifact. */
  confidenceCalibrated?: boolean;
  sourceLabel?: string | null;
  /** Provider/source identity is counted only when the enclosing runtime has verified it. */
  sourceVerified?: boolean;
  sourceTimeLabel?: string | null;
  marketStatusLabel?: string | null;
  candles?: Array<{ timestamp: number; close: number; volume?: number | null }>;
  evidenceNotes?: string[];
};

export const ANALYSIS_TIER_BUDGET: Record<AnalysisTier, 10 | 14 | 20> = {
  basic: 10,
  pro: 14,
  advanced: 20,
};

const SIGNAL_BLUEPRINTS: Array<{
  id: string;
  group: AnalysisSignal["group"];
  name: string;
  visual: AnalysisSignalVisual;
}> = [
  { id: "trend", group: "price", name: "Trend", visual: "line" },
  { id: "momentum", group: "price", name: "Momentum", visual: "histogram" },
  { id: "market-regime", group: "conditions", name: "Market Regime", visual: "gauge" },
  { id: "volatility", group: "conditions", name: "Volatility", visual: "line" },
  { id: "volume", group: "conditions", name: "Volume", visual: "histogram" },
  { id: "liquidity", group: "conditions", name: "Liquidity", visual: "gauge" },
  { id: "buy-sell-pressure", group: "flows", name: "Buy / Sell Pressure", visual: "balance" },
  { id: "price-structure", group: "price", name: "Price Structure", visual: "levels" },
  { id: "relative-strength", group: "price", name: "Relative Strength", visual: "gauge" },
  { id: "data-quality", group: "intelligence", name: "Data Quality", visual: "ring" },
  { id: "support", group: "price", name: "Support", visual: "levels" },
  { id: "resistance", group: "price", name: "Resistance", visual: "levels" },
  { id: "exchange-net-flow", group: "flows", name: "Exchange Net Flow", visual: "histogram" },
  { id: "funding-open-interest", group: "flows", name: "Funding & Open Interest", visual: "balance" },
  { id: "order-book-imbalance", group: "flows", name: "Order Book Imbalance", visual: "balance" },
  { id: "slippage-risk", group: "conditions", name: "Slippage Risk", visual: "gauge" },
  { id: "whale-activity", group: "intelligence", name: "Whale Activity", visual: "histogram" },
  { id: "holder-concentration", group: "intelligence", name: "Holder Concentration", visual: "ring" },
  { id: "anomaly-scan", group: "intelligence", name: "Anomaly Scan", visual: "scan" },
  { id: "scenario-map", group: "intelligence", name: "Scenario Map", visual: "scenario" },
];

const SIGNAL_NAMES: Record<string, Record<AnalysisLocale, string>> = {
  trend: { pl: "Trend", en: "Trend", de: "Trend" },
  momentum: { pl: "Momentum", en: "Momentum", de: "Momentum" },
  "market-regime": { pl: "Reżim rynku", en: "Market Regime", de: "Marktregime" },
  volatility: { pl: "Zmienność", en: "Volatility", de: "Volatilität" },
  volume: { pl: "Wolumen", en: "Volume", de: "Volumen" },
  liquidity: { pl: "Płynność", en: "Liquidity", de: "Liquidität" },
  "buy-sell-pressure": { pl: "Presja kupna / sprzedaży", en: "Buy / Sell Pressure", de: "Kauf- / Verkaufsdruck" },
  "price-structure": { pl: "Struktura ceny", en: "Price Structure", de: "Preisstruktur" },
  "relative-strength": { pl: "Siła względna", en: "Relative Strength", de: "Relative Stärke" },
  "data-quality": { pl: "Jakość danych", en: "Data Quality", de: "Datenqualität" },
  support: { pl: "Wsparcie", en: "Support", de: "Unterstützung" },
  resistance: { pl: "Opór", en: "Resistance", de: "Widerstand" },
  "exchange-net-flow": { pl: "Przepływ netto giełd", en: "Exchange Net Flow", de: "Netto-Börsenfluss" },
  "funding-open-interest": { pl: "Funding i otwarte pozycje", en: "Funding & Open Interest", de: "Funding & Open Interest" },
  "order-book-imbalance": { pl: "Nierównowaga arkusza", en: "Order Book Imbalance", de: "Orderbuch-Ungleichgewicht" },
  "slippage-risk": { pl: "Ryzyko poślizgu", en: "Slippage Risk", de: "Slippage-Risiko" },
  "whale-activity": { pl: "Aktywność wielorybów", en: "Whale Activity", de: "Whale-Aktivität" },
  "holder-concentration": { pl: "Koncentracja posiadaczy", en: "Holder Concentration", de: "Inhaberkonzentration" },
  "anomaly-scan": { pl: "Skan anomalii", en: "Anomaly Scan", de: "Anomalie-Scan" },
  "scenario-map": { pl: "Mapa scenariuszy", en: "Scenario Map", de: "Szenariokarte" },
};

type NormalizedCandle = { timestamp: number; close: number; volume: number | null };

function localize(locale: AnalysisLocale, copy: Record<AnalysisLocale, string>) {
  return copy[locale];
}

function parseNumber(value?: string | null) {
  const match = String(value ?? "").replace(/\s/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = mean(values);
  if (average === null) return null;
  const variance = values.reduce((total, value) => total + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizedCandles(asset: VlmAnalysisAsset): NormalizedCandle[] {
  return (asset.candles ?? [])
    .filter((item) => Number.isFinite(item.timestamp) && Number.isFinite(item.close) && item.close > 0)
    .map((item) => ({
      timestamp: item.timestamp,
      close: item.close,
      volume: Number.isFinite(item.volume) && Number(item.volume) >= 0 ? Number(item.volume) : null,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function percentReturns(candles: NormalizedCandle[]) {
  const values: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1]?.close;
    const current = candles[index]?.close;
    if (!previous || !current) continue;
    values.push(((current / previous) - 1) * 100);
  }
  return values;
}

function overallReturnPercent(candles: NormalizedCandle[]) {
  if (candles.length < 2) return null;
  const first = candles[0]?.close;
  const last = candles.at(-1)?.close;
  if (!first || !last) return null;
  return ((last / first) - 1) * 100;
}

function normalizedSeries(values: number[], limit = 9) {
  const clean = values.filter(Number.isFinite).slice(-limit);
  if (!clean.length) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max === min) return clean.map(() => 50);
  return clean.map((value) => clamp(18 + ((value - min) / (max - min)) * 64));
}

function signalName(blueprint: (typeof SIGNAL_BLUEPRINTS)[number], locale: AnalysisLocale) {
  return SIGNAL_NAMES[blueprint.id]?.[locale] ?? blueprint.name;
}

function usableSourceText(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return null;
  if (/(?:source|provider|quelle|źródł|dostawc).*(?:unavailable|missing|pending|ausstehend|fehlt|nicht verfügbar|niedostępn|brak|oczek)/iu.test(text)) return null;
  if (/^(?:unavailable|missing|pending|not available|n\/?a|brak|niedostępne|oczekuje|ausstehend|nicht verfügbar)$/iu.test(text)) return null;
  return text;
}

function verifiedSourceLabel(asset: VlmAnalysisAsset) {
  return asset.sourceVerified === true ? usableSourceText(asset.sourceLabel) : null;
}

function verifiedSourceTime(asset: VlmAnalysisAsset) {
  return asset.sourceVerified === true ? usableSourceText(asset.sourceTimeLabel) : null;
}

function sourceEvidence(
  asset: VlmAnalysisAsset,
  signalId: string,
  name: string,
  locale: AnalysisLocale,
  inputFields: string[],
): AnalysisEvidence[] {
  const sourceLabel = verifiedSourceLabel(asset);
  const primary: AnalysisEvidence = {
    id: `${asset.symbol}-${signalId}-primary`,
    source: sourceLabel || localize(locale, {
      pl: "Lokalny snapshot — brak etykiety dostawcy",
      en: "Local snapshot — provider label unavailable",
      de: "Lokaler Snapshot — Anbieterbezeichnung fehlt",
    }),
    timestamp: verifiedSourceTime(asset),
    note: localize(locale, {
      pl: `${name} wyprowadzono wyłącznie z dołączonych pól: ${inputFields.join(", ")}. Brak etykiety dostawcy nie jest zastępowany sztucznym źródłem.`,
      en: `${name} was derived only from attached fields: ${inputFields.join(", ")}. A missing provider label is not replaced with an invented source.`,
      de: `${name} wurde ausschließlich aus beigefügten Feldern abgeleitet: ${inputFields.join(", ")}. Eine fehlende Anbieterbezeichnung wird nicht durch eine erfundene Quelle ersetzt.`,
    }),
  };
  // `evidenceNotes` on market modals currently contains limitations / customer guidance,
  // not independently verified evidence. Do not promote those strings into Sources used.
  return [primary];
}

function derivedSignal(
  blueprint: (typeof SIGNAL_BLUEPRINTS)[number],
  asset: VlmAnalysisAsset,
  locale: AnalysisLocale,
  args: {
    value: string;
    status: string;
    tone: AnalysisSignalTone;
    score: number;
    series?: number[];
    inputFields: string[];
    derivation: string;
    description: string;
    impact: string;
  },
): AnalysisSignal {
  const name = signalName(blueprint, locale);
  return {
    id: blueprint.id,
    group: blueprint.group,
    name,
    value: args.value,
    interpretation: args.status,
    description: args.description,
    reason: args.derivation,
    impact: args.impact,
    status: args.status,
    tone: args.tone,
    visual: blueprint.visual,
    score: Math.round(clamp(args.score)),
    series: args.series ?? [],
    evidence: sourceEvidence(asset, blueprint.id, name, locale, args.inputFields),
    provenanceState: "DERIVED",
    inputFields: args.inputFields,
    derivation: args.derivation,
  };
}

function unavailableSignal(
  blueprint: (typeof SIGNAL_BLUEPRINTS)[number],
  asset: VlmAnalysisAsset,
  locale: AnalysisLocale,
  requiredInputs: string[],
  reasonCopy?: Record<AnalysisLocale, string>,
): AnalysisSignal {
  const name = signalName(blueprint, locale);
  const unavailable = localize(locale, { pl: "NIEDOSTĘPNE", en: "UNAVAILABLE", de: "NICHT VERFÜGBAR" });
  const derivation = reasonCopy?.[locale] ?? localize(locale, {
    pl: `Brak wymaganych danych wejściowych: ${requiredInputs.join(", ")}. Velmère nie tworzy zastępczego wyniku.`,
    en: `Required inputs are absent: ${requiredInputs.join(", ")}. Velmère does not synthesize a substitute reading.`,
    de: `Erforderliche Eingaben fehlen: ${requiredInputs.join(", ")}. Velmère erzeugt keinen Ersatzwert.`,
  });
  return {
    id: blueprint.id,
    group: blueprint.group,
    name,
    value: "—",
    interpretation: unavailable,
    description: localize(locale, {
      pl: `${name} pozostaje jawnie niedostępny dla tego snapshotu.`,
      en: `${name} remains explicitly unavailable for this snapshot.`,
      de: `${name} bleibt für diesen Snapshot ausdrücklich nicht verfügbar.`,
    }),
    reason: derivation,
    impact: localize(locale, {
      pl: "Brak tego wejścia obniża pokrycie informacyjne; nie jest liczony jako sygnał faktyczny.",
      en: "The missing input reduces information coverage; it is not counted as a factual signal.",
      de: "Die fehlende Eingabe verringert die Informationsabdeckung; sie wird nicht als faktisches Signal gezählt.",
    }),
    status: unavailable,
    tone: "neutral",
    visual: blueprint.visual,
    score: null,
    series: [],
    evidence: [],
    provenanceState: "UNAVAILABLE",
    inputFields: requiredInputs,
    derivation,
  };
}

function statusFromSigned(value: number, locale: AnalysisLocale) {
  if (value > 0.1) return localize(locale, { pl: "Rosnący", en: "Rising", de: "Steigend" });
  if (value < -0.1) return localize(locale, { pl: "Spadający", en: "Falling", de: "Fallend" });
  return localize(locale, { pl: "Płaski", en: "Flat", de: "Flach" });
}

function dataQualityScore(asset: VlmAnalysisAsset, candles: NormalizedCandle[]) {
  const volumeCoverage = candles.length ? candles.filter((item) => item.volume !== null).length / candles.length : 0;
  let score = 0;
  if (verifiedSourceLabel(asset)) score += 25;
  if (verifiedSourceTime(asset)) score += 20;
  if (candles.length >= 5) score += 30;
  else if (candles.length >= 2) score += 15;
  if (volumeCoverage >= 0.8) score += 15;
  else if (volumeCoverage > 0) score += 5;
  if (parseNumber(asset.riskLabel) !== null) score += 5;
  return Math.round(clamp(score));
}

function buildSignal(
  blueprint: (typeof SIGNAL_BLUEPRINTS)[number],
  asset: VlmAnalysisAsset,
  locale: AnalysisLocale,
  candles: NormalizedCandle[],
): AnalysisSignal {
  const returns = percentReturns(candles);
  const overallReturn = overallReturnPercent(candles);
  const closes = candles.map((item) => item.close);

  if (blueprint.id === "trend") {
    const attachedChange = parseNumber(asset.changeLabel);
    const value = overallReturn ?? attachedChange;
    if (value === null) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=2) or changeLabel"]);
    const fromCandles = overallReturn !== null;
    const status = statusFromSigned(value, locale);
    return derivedSignal(blueprint, asset, locale, {
      value: `${value > 0 ? "+" : ""}${value.toFixed(2)}%`,
      status,
      tone: value > 0.1 ? "positive" : value < -0.1 ? "warning" : "neutral",
      score: 50 + value * 5,
      series: fromCandles ? normalizedSeries(closes) : [],
      inputFields: [fromCandles ? "candles.close" : "changeLabel"],
      derivation: localize(locale, {
        pl: fromCandles ? "Trend = procentowa zmiana od pierwszego do ostatniego poprawnego zamknięcia w dołączonych świecach." : "Trend = jawna zmiana ceny z pola changeLabel; brak wystarczających świec do niezależnego przeliczenia.",
        en: fromCandles ? "Trend = percentage change from the first to the last valid close in the attached candles." : "Trend = the explicit price change in changeLabel; there are not enough candles for an independent recalculation.",
        de: fromCandles ? "Trend = prozentuale Änderung vom ersten bis zum letzten gültigen Schlusskurs der beigefügten Kerzen." : "Trend = die explizite Preisänderung aus changeLabel; für eine unabhängige Neuberechnung fehlen genügend Kerzen.",
      }),
      description: localize(locale, { pl: "Kierunek ceny wynikający z faktycznie dołączonych danych.", en: "Price direction derived from the data actually attached.", de: "Preisrichtung aus den tatsächlich beigefügten Daten." }),
      impact: localize(locale, { pl: `Wpływ: ${status}; jest to obserwacja kierunku, nie prognoza.`, en: `Impact: ${status}; this is a direction observation, not a forecast.`, de: `Einfluss: ${status}; dies ist eine Richtungsbeobachtung, keine Prognose.` }),
    });
  }

  if (blueprint.id === "momentum") {
    if (returns.length < 3) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const recentCount = Math.min(3, returns.length);
    const recent = mean(returns.slice(-recentCount));
    const previousSlice = returns.slice(0, -recentCount).slice(-recentCount);
    const previous = mean(previousSlice.length ? previousSlice : returns.slice(0, Math.max(1, returns.length - 1)));
    if (recent === null || previous === null) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const delta = recent - previous;
    const status = delta > 0.1
      ? localize(locale, { pl: "Przyspiesza", en: "Strengthening", de: "Beschleunigt" })
      : delta < -0.1
        ? localize(locale, { pl: "Słabnie", en: "Fading", de: "Lässt nach" })
        : localize(locale, { pl: "Stabilne", en: "Stable", de: "Stabil" });
    return derivedSignal(blueprint, asset, locale, {
      value: `${recent > 0 ? "+" : ""}${recent.toFixed(2)}% avg`,
      status,
      tone: delta > 0.1 ? "positive" : delta < -0.1 ? "warning" : "neutral",
      score: 50 + delta * 10,
      series: normalizedSeries(returns),
      inputFields: ["candles.close"],
      derivation: localize(locale, {
        pl: "Momentum = średnia z maksymalnie 3 najnowszych zwrotów świec porównana ze średnią wcześniejszych zwrotów.",
        en: "Momentum = the mean of up to the 3 most recent candle returns compared with the mean of preceding returns.",
        de: "Momentum = Mittelwert von bis zu 3 jüngsten Kerzenrenditen im Vergleich zum Mittelwert vorheriger Renditen.",
      }),
      description: localize(locale, { pl: "Tempo ostatnich zmian ceny względem poprzedniego odcinka.", en: "The pace of recent price changes versus the preceding segment.", de: "Tempo der jüngsten Preisänderungen gegenüber dem vorherigen Abschnitt." }),
      impact: localize(locale, { pl: `Wpływ: ${status}; wynik reaguje na zmianę sekwencji świec.`, en: `Impact: ${status}; the reading changes with the candle sequence.`, de: `Einfluss: ${status}; der Wert reagiert auf die Kerzenfolge.` }),
    });
  }

  if (blueprint.id === "volatility") {
    const volatility = standardDeviation(returns);
    if (volatility === null || returns.length < 3) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const status = volatility >= 3
      ? localize(locale, { pl: "Podwyższona", en: "Elevated", de: "Erhöht" })
      : volatility >= 1
        ? localize(locale, { pl: "Umiarkowana", en: "Moderate", de: "Moderat" })
        : localize(locale, { pl: "Niska", en: "Low", de: "Niedrig" });
    return derivedSignal(blueprint, asset, locale, {
      value: `${volatility.toFixed(2)}%`,
      status,
      tone: volatility >= 3 ? "warning" : "neutral",
      score: volatility * 20,
      series: normalizedSeries(returns.map(Math.abs)),
      inputFields: ["candles.close"],
      derivation: localize(locale, {
        pl: "Zmienność = odchylenie standardowe procentowych zwrotów kolejnych dołączonych świec. Progi opisu: <1% niska, 1–3% umiarkowana, >=3% podwyższona.",
        en: "Volatility = standard deviation of percentage returns between consecutive attached candles. Description thresholds: <1% low, 1–3% moderate, >=3% elevated.",
        de: "Volatilität = Standardabweichung der prozentualen Renditen aufeinanderfolgender beigefügter Kerzen. Schwellen: <1% niedrig, 1–3% moderat, >=3% erhöht.",
      }),
      description: localize(locale, { pl: "Rozrzut faktycznych zwrotów w dołączonej serii.", en: "Dispersion of actual returns in the attached series.", de: "Streuung der tatsächlichen Renditen in der beigefügten Reihe." }),
      impact: localize(locale, { pl: "Wyższa zmienność zwiększa niepewność odczytu; sama w sobie nie oznacza kierunku.", en: "Higher volatility increases uncertainty; by itself it does not imply direction.", de: "Höhere Volatilität erhöht die Unsicherheit; sie impliziert für sich allein keine Richtung." }),
    });
  }

  if (blueprint.id === "volume") {
    const volumes = candles.map((item) => item.volume).filter((value): value is number => value !== null);
    if (volumes.length < 4) return unavailableSignal(blueprint, asset, locale, ["candles.volume (>=4 valid samples)"]);
    const recentCount = Math.min(3, volumes.length - 1);
    const recent = mean(volumes.slice(-recentCount));
    const baseline = mean(volumes.slice(0, -recentCount));
    if (recent === null || baseline === null || baseline <= 0) {
      return unavailableSignal(blueprint, asset, locale, ["candles.volume with a positive prior baseline"]);
    }
    const ratio = recent / baseline;
    const status = ratio > 1.15
      ? localize(locale, { pl: "Powyżej bazowej", en: "Above baseline", de: "Über Basiswert" })
      : ratio < 0.85
        ? localize(locale, { pl: "Poniżej bazowej", en: "Below baseline", de: "Unter Basiswert" })
        : localize(locale, { pl: "Blisko bazowej", en: "Near baseline", de: "Nahe Basiswert" });
    return derivedSignal(blueprint, asset, locale, {
      value: `${ratio.toFixed(2)}× baseline`,
      status,
      tone: "neutral",
      score: ratio * 50,
      series: normalizedSeries(volumes),
      inputFields: ["candles.volume"],
      derivation: localize(locale, {
        pl: "Wolumen = średnia z maksymalnie 3 najnowszych próbek podzielona przez średnią wcześniejszych poprawnych próbek wolumenu.",
        en: "Volume = the mean of up to the 3 most recent samples divided by the mean of preceding valid volume samples.",
        de: "Volumen = Mittelwert von bis zu 3 jüngsten Proben geteilt durch den Mittelwert vorheriger gültiger Volumenproben.",
      }),
      description: localize(locale, { pl: "Relacja bieżącego wolumenu do bazowej części tej samej dołączonej serii.", en: "Current volume relative to the baseline portion of the same attached series.", de: "Aktuelles Volumen relativ zum Basisabschnitt derselben beigefügten Reihe." }),
      impact: localize(locale, { pl: `Wpływ: ${status}; wolumen nie jest interpretowany jako samodzielny sygnał kupna/sprzedaży.`, en: `Impact: ${status}; volume is not treated as a standalone buy/sell signal.`, de: `Einfluss: ${status}; Volumen wird nicht als eigenständiges Kauf-/Verkaufssignal behandelt.` }),
    });
  }

  if (blueprint.id === "liquidity") {
    return unavailableSignal(blueprint, asset, locale, ["orderBook.spread", "orderBook.depthUsd"], {
      pl: "Snapshot nie zawiera spreadu ani głębokości arkusza. Cena i wolumen nie są używane jako fałszywy substytut płynności.",
      en: "The snapshot contains neither spread nor order-book depth. Price and volume are not used as a false substitute for liquidity.",
      de: "Der Snapshot enthält weder Spread noch Orderbuchtiefe. Preis und Volumen werden nicht als falscher Ersatz für Liquidität verwendet.",
    });
  }

  if (blueprint.id === "buy-sell-pressure") {
    return unavailableSignal(blueprint, asset, locale, ["trades.buyVolume", "trades.sellVolume"], {
      pl: "Snapshot nie zawiera wolumenu rozdzielonego na stronę kupna i sprzedaży; proporcja nie jest zgadywana.",
      en: "The snapshot has no side-resolved buy and sell volume; the split is not guessed.",
      de: "Der Snapshot enthält kein nach Kauf- und Verkaufsseite getrenntes Volumen; das Verhältnis wird nicht geraten.",
    });
  }

  if (blueprint.id === "price-structure") {
    if (candles.length < 4 || overallReturn === null) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const midpoint = Math.floor(closes.length / 2);
    const firstHalf = mean(closes.slice(0, midpoint));
    const secondHalf = mean(closes.slice(midpoint));
    if (firstHalf === null || secondHalf === null || firstHalf <= 0) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const shift = ((secondHalf / firstHalf) - 1) * 100;
    const status = shift > 0.5
      ? localize(locale, { pl: "Wyższy zakres", en: "Higher range", de: "Höherer Bereich" })
      : shift < -0.5
        ? localize(locale, { pl: "Niższy zakres", en: "Lower range", de: "Niedrigerer Bereich" })
        : localize(locale, { pl: "Zakres boczny", en: "Range-bound", de: "Seitwärtsbereich" });
    return derivedSignal(blueprint, asset, locale, {
      value: status,
      status,
      tone: shift > 0.5 ? "positive" : shift < -0.5 ? "warning" : "neutral",
      score: 50 + shift * 5,
      series: normalizedSeries(closes),
      inputFields: ["candles.close"],
      derivation: localize(locale, {
        pl: "Struktura ceny = porównanie średniego zamknięcia pierwszej i drugiej połowy dołączonej serii; próg kierunku wynosi ±0,5%.",
        en: "Price structure = comparison of mean closes in the first and second halves of the attached series; the directional threshold is ±0.5%.",
        de: "Preisstruktur = Vergleich der durchschnittlichen Schlusskurse der ersten und zweiten Hälfte der beigefügten Reihe; Richtungsschwelle ±0,5%.",
      }).replace("", ""),
      description: localize(locale, { pl: "Położenie nowszej części serii względem wcześniejszej.", en: "Position of the newer segment of the series relative to the earlier segment.", de: "Position des neueren Reihenabschnitts relativ zum früheren Abschnitt." }),
      impact: localize(locale, { pl: `Wpływ: ${status}; metryka opisuje układ serii, nie przyszły kierunek.`, en: `Impact: ${status}; the metric describes series structure, not future direction.`, de: `Einfluss: ${status}; die Metrik beschreibt die Reihenstruktur, nicht die zukünftige Richtung.` }),
    });
  }

  if (blueprint.id === "relative-strength") {
    return unavailableSignal(blueprint, asset, locale, ["benchmark.candles.close"], {
      pl: "Brak serii benchmarku. Siła względna nie może być wyliczona z samego aktywa.",
      en: "No benchmark series is attached. Relative strength cannot be calculated from the asset alone.",
      de: "Es ist keine Benchmark-Reihe beigefügt. Relative Stärke kann nicht allein aus dem Asset berechnet werden.",
    });
  }

  if (blueprint.id === "market-regime") {
    const volatility = standardDeviation(returns);
    if (overallReturn === null || volatility === null || returns.length < 3) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=4)"]);
    const status = volatility >= 3
      ? localize(locale, { pl: "Wysoka zmienność", en: "High-volatility", de: "Hohe Volatilität" })
      : Math.abs(overallReturn) >= 2
        ? localize(locale, { pl: "Kierunkowy", en: "Directional", de: "Gerichtet" })
        : localize(locale, { pl: "Zrównoważony", en: "Balanced", de: "Ausgeglichen" });
    return derivedSignal(blueprint, asset, locale, {
      value: status,
      status,
      tone: volatility >= 3 ? "warning" : "neutral",
      score: clamp(50 + Math.min(25, Math.abs(overallReturn) * 3) - Math.min(25, volatility * 5)),
      series: normalizedSeries(closes),
      inputFields: ["candles.close"],
      derivation: localize(locale, {
        pl: "Reżim = jawna klasyfikacja z całkowitej zmiany ceny i odchylenia standardowego zwrotów: >=3% zmienności → wysoka zmienność; w przeciwnym razie |trend|>=2% → kierunkowy; inaczej zrównoważony.",
        en: "Regime = explicit classification from total price change and return standard deviation: >=3% volatility → high-volatility; otherwise |trend|>=2% → directional; else balanced.",
        de: "Regime = explizite Klassifikation aus Gesamtpreisänderung und Standardabweichung der Renditen: >=3% Volatilität → hohe Volatilität; sonst |Trend|>=2% → gerichtet; andernfalls ausgeglichen.",
      }),
      description: localize(locale, { pl: "Opis warunków wynikający z kierunku i rozrzutu dołączonych świec.", en: "Condition label derived from direction and dispersion of the attached candles.", de: "Bedingungsbezeichnung aus Richtung und Streuung der beigefügten Kerzen." }),
      impact: localize(locale, { pl: "Klasyfikacja porządkuje kontekst; nie jest prognozą ani rekomendacją.", en: "The classification organizes context; it is neither a forecast nor a recommendation.", de: "Die Klassifikation ordnet den Kontext; sie ist weder Prognose noch Empfehlung." }),
    });
  }

  if (blueprint.id === "data-quality") {
    const score = dataQualityScore(asset, candles);
    const status = score >= 75
      ? localize(locale, { pl: "Mocna", en: "Strong", de: "Stark" })
      : score >= 45
        ? localize(locale, { pl: "Częściowa", en: "Partial", de: "Teilweise" })
        : localize(locale, { pl: "Ograniczona", en: "Limited", de: "Begrenzt" });
    return derivedSignal(blueprint, asset, locale, {
      value: `${score}/100`,
      status,
      tone: score >= 75 ? "positive" : score >= 45 ? "neutral" : "warning",
      score,
      series: [],
      inputFields: ["sourceLabel", "sourceTimeLabel", "candles", "candles.volume", "riskLabel"],
      derivation: localize(locale, {
        pl: "Jakość danych = 25 pkt za zweryfikowaną etykietę źródła, 20 za zweryfikowany czas źródła, do 30 za pokrycie świec, do 15 za pokrycie wolumenu i 5 za jawne riskLabel. Pole confidence nie zwiększa pokrycia i pozostaje oddzielne od kalibracji.",
        en: "Data quality = 25 points for a verified source label, 20 for verified source time, up to 30 for candle coverage, up to 15 for volume coverage, and 5 for explicit riskLabel. A confidence field does not increase coverage and remains separate from calibration.",
        de: "Datenqualität = 25 Punkte für eine verifizierte Quellenbezeichnung, 20 für verifizierte Quellenzeit, bis zu 30 für Kerzenabdeckung, bis zu 15 für Volumenabdeckung und 5 für explizites riskLabel. Ein Konfidenzfeld erhöht die Abdeckung nicht und bleibt von der Kalibrierung getrennt.",
      }),
      description: localize(locale, { pl: "Jawny wskaźnik pokrycia wejściowego, a nie ocena prawdziwości rynku.", en: "An explicit input-coverage indicator, not a judgment of market truth.", de: "Ein expliziter Indikator der Eingabeabdeckung, kein Urteil über Marktwahrheit." }),
      impact: localize(locale, { pl: "Niższy wynik oznacza słabsze pokrycie wejścia i więcej pól NIEDOSTĘPNE; nie tworzy ani nie kalibruje pewności.", en: "A lower score means weaker input coverage and more UNAVAILABLE fields; it does not create or calibrate confidence.", de: "Ein niedrigerer Wert bedeutet schwächere Eingabeabdeckung und mehr NICHT VERFÜGBARE Felder; er erzeugt oder kalibriert keine Konfidenz." }),
    });
  }

  if (blueprint.id === "support" || blueprint.id === "resistance") {
    if (closes.length < 3) return unavailableSignal(blueprint, asset, locale, ["candles.close (>=3)"]);
    const window = closes.slice(-Math.min(20, closes.length));
    const level = blueprint.id === "support" ? Math.min(...window) : Math.max(...window);
    const status = localize(locale, { pl: "Obserwowany poziom", en: "Observed level", de: "Beobachtetes Niveau" });
    return derivedSignal(blueprint, asset, locale, {
      value: level.toLocaleString("en-US", { maximumFractionDigits: 8 }),
      status,
      tone: "neutral",
      score: blueprint.id === "support" ? 35 : 65,
      series: normalizedSeries(window),
      inputFields: ["candles.close"],
      derivation: localize(locale, {
        pl: `${blueprint.id === "support" ? "Wsparcie" : "Opór"} = ${blueprint.id === "support" ? "minimum" : "maksimum"} z maksymalnie 20 ostatnich poprawnych zamknięć.`,
        en: `${blueprint.id === "support" ? "Support" : "Resistance"} = the ${blueprint.id === "support" ? "minimum" : "maximum"} of up to the 20 most recent valid closes.`,
        de: `${blueprint.id === "support" ? "Unterstützung" : "Widerstand"} = ${blueprint.id === "support" ? "Minimum" : "Maximum"} der bis zu 20 jüngsten gültigen Schlusskurse.`,
      }),
      description: localize(locale, { pl: "Poziom opisuje wyłącznie widoczne ekstremum snapshotu.", en: "The level describes only an observed snapshot extreme.", de: "Das Niveau beschreibt nur ein beobachtetes Extrem des Snapshots." }),
      impact: localize(locale, { pl: "Nie jest to gwarantowany poziom reakcji rynku.", en: "This is not a guaranteed market-reaction level.", de: "Dies ist kein garantiertes Marktreaktionsniveau." }),
    });
  }

  const paidRequirements: Record<string, string[]> = {
    "exchange-net-flow": ["exchangeFlows.inflow", "exchangeFlows.outflow"],
    "funding-open-interest": ["derivatives.fundingRate", "derivatives.openInterest"],
    "order-book-imbalance": ["orderBook.bidDepth", "orderBook.askDepth"],
    "slippage-risk": ["orderBook.spread", "orderBook.depthUsd", "tradeSize"],
    "whale-activity": ["labeledTransfers"],
    "holder-concentration": ["holderDistribution"],
    "anomaly-scan": ["validated anomaly model inputs"],
    "scenario-map": ["validated scenario-model inputs"],
  };
  return unavailableSignal(blueprint, asset, locale, paidRequirements[blueprint.id] ?? ["required structured input"]);
}

export function buildDeterministicVlmAnalysis(
  asset: VlmAnalysisAsset,
  tier: AnalysisTier,
  locale: AnalysisLocale = "en",
): AnalysisResult {
  const candles = normalizedCandles(asset);
  const risk = parseNumber(asset.riskLabel);
  const sourceCount = verifiedSourceLabel(asset) ? 1 : 0;
  const explicitConfidence = parseNumber(asset.confidenceLabel);
  const qualityScore = dataQualityScore(asset, candles);
  const confidence = asset.confidenceCalibrated === true && explicitConfidence !== null
    ? Math.round(clamp(explicitConfidence))
    : null;
  const budget = ANALYSIS_TIER_BUDGET[tier];
  const signals = SIGNAL_BLUEPRINTS.slice(0, budget).map((blueprint) => buildSignal(blueprint, asset, locale, candles));
  const availableSignals = signals.filter((signal) => signal.provenanceState === "DERIVED").length;
  const unavailableSignals = signals.length - availableSignals;
  const resolvedRisk = risk === null ? null : Math.round(clamp(risk));
  const verdict = resolvedRisk === null
    ? localize(locale, { pl: "Ocena ograniczona", en: "Evidence limited", de: "Evidenz begrenzt" })
    : resolvedRisk <= 33
      ? localize(locale, { pl: "Niskie ryzyko — obserwuj", en: "Low risk — monitor", de: "Niedriges Risiko — beobachten" })
      : resolvedRisk <= 66
        ? localize(locale, { pl: "Rynek wymaga uwagi", en: "Market requires attention", de: "Markt erfordert Aufmerksamkeit" })
        : localize(locale, { pl: "Podwyższone ryzyko", en: "Elevated risk", de: "Erhöhtes Risiko" });
  const dataQuality = verifiedSourceLabel(asset) && verifiedSourceTime(asset)
    ? localize(locale, { pl: `Pokrycie wejścia ${qualityScore}/100 · źródło i czas dołączone`, en: `Input coverage ${qualityScore}/100 · source and timestamp attached`, de: `Eingabeabdeckung ${qualityScore}/100 · Quelle und Zeitstempel beigefügt` })
    : localize(locale, { pl: `Pokrycie wejścia ${qualityScore}/100 · luki jawne`, en: `Input coverage ${qualityScore}/100 · gaps explicit`, de: `Eingabeabdeckung ${qualityScore}/100 · Lücken explizit` });
  return {
    tier,
    verdict,
    riskScore: resolvedRisk,
    confidence,
    sourceCount,
    dataQuality,
    summary: localize(locale, {
      pl: `${asset.name}: z dołączonego snapshotu mamy ${budget} miejsc sygnałowych; ${availableSignals} wyprowadzono z faktycznych wejść, ${unavailableSignals} oznaczono NIEDOSTĘPNE. Brakujących danych nie zastępuje seed, fixture ani zgadywany wynik.`,
      en: `${asset.name}: the attached snapshot has ${budget} signal slots; ${availableSignals} are derived from actual inputs and ${unavailableSignals} are marked UNAVAILABLE. Missing inputs are not replaced with a seed, fixture, or guessed reading.`,
      de: `${asset.name}: aus dem beigefügten Snapshot stehen ${budget} Signalplätze bereit; ${availableSignals} werden aus tatsächlichen Eingaben abgeleitet und ${unavailableSignals} als NICHT VERFÜGBAR markiert. Fehlende Eingaben werden nicht durch Seed, Fixture oder geratenen Wert ersetzt.`,
    }),
    completedAt: verifiedSourceTime(asset) || new Date(0).toISOString(),
    signals,
  };
}

export async function runVlmAnalysis(
  asset: VlmAnalysisAsset,
  tier: AnalysisTier,
  options: { locale?: AnalysisLocale; signal?: AbortSignal; entitlementVerified?: boolean } = {},
) {
  const allowPaid = Boolean(
    options.entitlementVerified ||
    process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO === "true" ||
    process.env.NEXT_PUBLIC_VELMERE_QA_UNLOCK_ADVANCED_PDF === "1"
  );
  if (tier !== "basic" && !allowPaid) {
    throw new Error("paid_tier_requires_server_entitlement");
  }
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 60);
    options.signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
  return buildDeterministicVlmAnalysis(asset, tier, options.locale ?? "en");
}

export type DataAvailabilityInspection = {
  tier: AnalysisTier;
  availableCount: number;
  totalBudget: number;
  percentage: number;
  quality: "high" | "moderate" | "limited";
  hasCandles: boolean;
  hasSource: boolean;
  missingInputs: string[];
};

export function inspectDataAvailability(asset: VlmAnalysisAsset, tier: AnalysisTier): DataAvailabilityInspection {
  const budget = ANALYSIS_TIER_BUDGET[tier];
  const analysis = buildDeterministicVlmAnalysis(asset, tier, "en");
  const derived = analysis.signals.filter((s) => s.provenanceState === "DERIVED");
  const unavailable = analysis.signals.filter((s) => s.provenanceState === "UNAVAILABLE");
  const availableCount = derived.length;
  const percentage = Math.round((availableCount / budget) * 100);
  const quality = percentage >= 70 ? "high" : percentage >= 40 ? "moderate" : "limited";
  const hasCandles = Boolean(asset.candles && asset.candles.length >= 8);
  const hasSource = Boolean(asset.sourceVerified && asset.sourceLabel);
  const missingInputs = Array.from(new Set(unavailable.flatMap((s) => s.inputFields ?? [])));

  return {
    tier,
    availableCount,
    totalBudget: budget,
    percentage,
    quality,
    hasCandles,
    hasSource,
    missingInputs,
  };
}
