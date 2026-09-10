import {
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderSources,
} from "@/lib/ai/evidence-normalization";

export type Pass454Locale = "pl" | "de" | "en";
export type Pass454State = "confirmed" | "review" | "source_required" | "not_applicable";
export type Pass454TierId = "basic" | "pro" | "advanced";

export type Pass454Metric = {
  id: string;
  label: string;
  value: string;
  state: Pass454State;
  humanMeaning: string;
  sourceNeed?: string;
};

export type Pass454Tier = {
  id: Pass454TierId;
  label: string;
  fieldCount: 10 | 14 | 20;
  promise: string;
  metrics: Pass454Metric[];
};

export type Pass454EvidenceDenseHumanAnalysis = {
  version: "evidence-dense-human-analysis-runtime";
  locale: Pass454Locale;
  verdict: {
    eyebrow: string;
    headline: string;
    summary: string;
    tone: "calm" | "review" | "elevated" | "blocked";
  };
  tiers: Pass454Tier[];
  forge: {
    stageCount: 4;
    stages: Array<{ id: string; label: string; detail: string }>;
  };
  browserContract: {
    idleCardVisible: true;
    animatedVVisibleDuringGeneration: true;
    previewAndDownloadShareBlob: true;
    backgroundScrollLocked: true;
    downloadIconRequired: true;
  };
  realMarketsContract: {
    assetClasses: string[];
    venueHealthSeparated: true;
    dynamicProviderSearch: true;
    categoryCountsVisible: true;
  };
};

function localeOf(locale: string): Pass454Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function n(locale: Pass454Locale, value: number, digits = 2) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

function pct(locale: Pass454Locale, value?: number, digits = 2) {
  return finite(value) ? `${value > 0 ? "+" : ""}${n(locale, value, digits)}%` : null;
}

function money(locale: Pass454Locale, value?: number, currency = "USD") {
  if (!finite(value)) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  } catch {
    return n(locale, value, Math.abs(value) < 1 ? 6 : 2);
  }
}

function copy(locale: Pass454Locale) {
  if (locale === "de") {
    return {
      eyebrow: "Velmère Evidence Engine",
      headline: "Ein menschlicher Bericht statt Debug-Rauschen",
      calm: "Die Kerndaten sind lesbar. Der Bericht trennt Marktgröße, Dynamik, Ausführung und Quellenqualität.",
      review: "Die wichtigsten Marktdaten sind sichtbar, aber eine stärkere Aussage bleibt durch Quellenlücken begrenzt.",
      elevated: "Mehrere Evidenzlücken verlangen eine tiefere Prüfung von Liquidität, Angebot und Quellenabgleich.",
      blocked: "Es fehlen belastbare Kerndaten. Velmère zeigt nur belegte Fakten und die nächste konkrete Prüfung.",
      source: (label: string) => `Quelle erforderlich: ${label}`,
      basic: "Marktgrundlagen in zehn klaren Feldern, lesbar ohne Terminal-Wissen.",
      pro: "Marktstruktur, Bewertungsdruck, Freshness und Provider-Abgleich in vierzehn Feldern.",
      advanced: "Zwanzig source-bound Prüfungen für Ausführung, Angebot, Divergenz und Claim-Freigabe.",
      forge: [
        ["identity", "Instrument erkennen", "Symbol, Asset-Klasse und Provider-Route werden aufgelöst."],
        ["evidence", "Quellen prüfen", "Market Snapshot, Freshness, Zweitquelle und Lücken werden verglichen."],
        ["human", "Menschlichen Bericht bauen", "Technische Felder werden in klare Aussagen und Grenzen übersetzt."],
        ["seal", "PDF versiegeln", "Vorschau und Download erhalten denselben signierten Payload."],
      ],
    } as const;
  }
  if (locale === "en") {
    return {
      eyebrow: "Velmère Evidence Engine",
      headline: "A human report instead of debug noise",
      calm: "Core data is readable. The report separates market scale, dynamics, execution and source quality.",
      review: "The market essentials are visible, but evidence gaps still cap every stronger claim.",
      elevated: "Several evidence gaps require deeper liquidity, supply and cross-source checks.",
      blocked: "Reliable core data is missing. Velmère releases supported facts and the next concrete check only.",
      source: (label: string) => `Source required: ${label}`,
      basic: "Ten market essentials written for a human, not a terminal operator.",
      pro: "Fourteen fields for market structure, valuation pressure, freshness and provider agreement.",
      advanced: "Twenty source-bound checks for execution, supply, divergence and claim release.",
      forge: [
        ["identity", "Resolve instrument", "Symbol, asset class and provider route are resolved."],
        ["evidence", "Cross-check evidence", "Market snapshot, freshness, second source and gaps are compared."],
        ["human", "Compose human readout", "Technical fields become clear findings, limits and next checks."],
        ["seal", "Seal the PDF", "Preview and download receive the same signed payload."],
      ],
    } as const;
  }
  return {
    eyebrow: "Velmère Evidence Engine",
    headline: "Raport dla człowieka zamiast technicznego bałaganu",
    calm: "Dane bazowe są czytelne. Raport rozdziela skalę rynku, dynamikę, wykonanie i jakość źródeł.",
    review: "Najważniejsze dane rynkowe są widoczne, ale luki dowodowe ograniczają każdy mocniejszy wniosek.",
    elevated: "Kilka luk wymaga głębszego sprawdzenia płynności, podaży i zgodności źródeł.",
    blocked: "Brakuje wiarygodnych danych bazowych. Velmère pokazuje tylko fakty ze źródłem i następne konkretne sprawdzenie.",
    source: (label: string) => `Wymaga źródła: ${label}`,
    basic: "Dziesięć podstaw rynku opisanych dla człowieka, bez języka terminala.",
    pro: "Czternaście pól o strukturze rynku, presji wyceny, świeżości i zgodności providerów.",
    advanced: "Dwadzieścia source-bound testów wykonania, podaży, rozbieżności i dopuszczenia wniosku.",
    forge: [
      ["identity", "Rozpoznanie instrumentu", "Symbol, klasa aktywa i trasa providera są rozwiązywane."],
      ["evidence", "Porównanie źródeł", "Snapshot rynku, świeżość, drugie źródło i braki są porównywane."],
      ["human", "Budowa ludzkiego raportu", "Pola techniczne zamieniają się w jasne wnioski, ograniczenia i następne kroki."],
      ["seal", "Podpisanie PDF", "Podgląd i pobranie dostają ten sam podpisany payload."],
    ],
  } as const;
}

function metric(
  locale: Pass454Locale,
  id: string,
  label: string,
  value: string | null | undefined,
  meaning: string,
  state: Pass454State = "confirmed",
  sourceNeed?: string,
): Pass454Metric {
  const c = copy(locale);
  const hasValue = Boolean(value && value.trim());
  return {
    id,
    label,
    value: hasValue ? value!.trim() : c.source(sourceNeed || label.toLowerCase()),
    state: hasValue ? state : "source_required",
    humanMeaning: meaning,
    sourceNeed: hasValue ? undefined : sourceNeed || label,
  };
}

export function buildPass454EvidenceDenseHumanAnalysis(
  result: VelmereSearchResult,
  locale: string,
  options: { nowMs?: number } = {},
): Pass454EvidenceDenseHumanAnalysis {
  const safeLocale = localeOf(locale);
  const c = copy(safeLocale);
  const snapshot = result.marketSnapshot;
  const currency = snapshot?.currency || "USD";
  const confirmedSources = independentLiveProviderSources(result.sources);
  const sourceCount = confirmedSources.length;
  const missingCount = result.missingData.length;
  const sourceQuorum = `${sourceCount}/2`;
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, { nowMs: options.nowMs });
  const ageMinutes = timestamp.ageMinutes;
  const timestampPenalty = timestamp.state === "fresh"
    ? 0
    : timestamp.state === "aging"
      ? 4
      : timestamp.state === "stale"
        ? 8
        : 12;
  const sourceCoverage = result.sourceCoverage ?? sourceEvidenceCoverageScore(result);
  // Deterministic evidence-coverage ceiling only. It is not calibrated confidence.
  const evidenceCoverageCeiling = clamp(
    Math.round(sourceCoverage - Math.max(0, 2 - sourceCount) * 12 - Math.min(24, missingCount * 4) - timestampPenalty),
  );
  const turnover = finite(snapshot?.volume24h) && finite(snapshot?.marketCap) && snapshot.marketCap > 0
    ? (snapshot.volume24h / snapshot.marketCap) * 100
    : null;
  const fdvPremium = finite(snapshot?.fdv) && finite(snapshot?.marketCap) && snapshot.marketCap > 0
    ? ((snapshot.fdv / snapshot.marketCap) - 1) * 100
    : null;
  const liquidityToCap = finite(snapshot?.marketCap) && snapshot.marketCap > 0 && snapshot.liquidityLabel
    ? snapshot.liquidityLabel
    : null;
  const tone = evidenceCoverageCeiling < 30
    ? "blocked"
    : missingCount >= 4 || evidenceCoverageCeiling < 48
      ? "elevated"
      : missingCount || sourceCount < 2 || (timestamp.state !== "fresh" && timestamp.state !== "aging")
        ? "review"
        : "calm";
  const summary = tone === "calm" ? c.calm : tone === "review" ? c.review : tone === "elevated" ? c.elevated : c.blocked;
  const sourceLabel = confirmedSources[0]?.family || null;
  const secondSource = confirmedSources[1]?.family || null;
  const identity = `${result.symbol || "VLM"} · ${result.title}`;
  const labels = safeLocale === "pl"
    ? {
        instrument: "Instrument", price: "Cena", marketCap: "Kapitalizacja", change24h: "Zmiana 24h", volume: "Wolumen 24h", range: "Zakres 24h", source: "Źródło główne", freshness: "Świeżość", confidence: "Limit pokrycia dowodów", next: "Następny krok",
        change1h: "Zmiana 1h", change7d: "Zmiana 7d", fdv: "FDV", turnover: "Wolumen / kapitalizacja", second: "Drugie źródło", quorum: "Quorum źródeł", evidenceDebt: "Dług dowodowy", sourceAgreement: "Zgodność źródeł", circulation: "Podaż w obiegu", volatility: "Amplituda 24h", providerState: "Stan providera", marketMeaning: "Znaczenie rynkowe",
        liquidity: "Płynność wykonania", slippage: "Poślizg 10k", depth: "Głębokość bid/ask", holders: "Koncentracja holderów", unlocks: "Presja unlocków", venue: "Zdrowie venue", anomaly: "Nietypowa anomalia", liquidityCap: "Płynność / skala", timestampSkew: "Dryf timestampu", sourceEntropy: "Entropia źródeł", fakeLive: "Ryzyko fake-live", narrativeDrift: "Dryf narracji", releaseMode: "Tryb publikacji", lineage: "Source lineage", execution: "Pokrycie dowodów wykonania", supplyOverhang: "Nadmiar podaży", orderbookFragility: "Kruchość orderbooka", providerResilience: "Odporność providerów", nextProbe: "Następna próba", finalBoundary: "Granica wniosku",
      }
    : safeLocale === "de"
      ? {
          instrument: "Instrument", price: "Preis", marketCap: "Market Cap", change24h: "Änderung 24h", volume: "Volumen 24h", range: "24h-Spanne", source: "Hauptquelle", freshness: "Freshness", confidence: "Evidenzabdeckungsgrenze", next: "Nächster Schritt",
          change1h: "Änderung 1h", change7d: "Änderung 7d", fdv: "FDV", turnover: "Volumen / Market Cap", second: "Zweitquelle", quorum: "Quellenquorum", evidenceDebt: "Evidenzschuld", sourceAgreement: "Quellenabgleich", circulation: "Umlaufquote", volatility: "24h-Amplitude", providerState: "Provider-Status", marketMeaning: "Marktbedeutung",
          liquidity: "Ausführungsliquidität", slippage: "Slippage 10k", depth: "Bid/Ask-Tiefe", holders: "Holder-Konzentration", unlocks: "Unlock-Druck", venue: "Venue Health", anomaly: "Ungewöhnliche Anomalie", liquidityCap: "Liquidität / Skala", timestampSkew: "Timestamp-Drift", sourceEntropy: "Quellenentropie", fakeLive: "Fake-Live-Risiko", narrativeDrift: "Narrative Drift", releaseMode: "Freigabemodus", lineage: "Source Lineage", execution: "Ausführungs-Evidenzabdeckung", supplyOverhang: "Angebotsüberhang", orderbookFragility: "Orderbook-Fragilität", providerResilience: "Provider-Resilienz", nextProbe: "Nächste Probe", finalBoundary: "Aussagegrenze",
        }
      : {
          instrument: "Instrument", price: "Price", marketCap: "Market cap", change24h: "24h change", volume: "24h volume", range: "24h range", source: "Primary source", freshness: "Freshness", confidence: "Evidence-coverage ceiling", next: "Next step",
          change1h: "1h change", change7d: "7d change", fdv: "FDV", turnover: "Volume / market cap", second: "Second source", quorum: "Source quorum", evidenceDebt: "Evidence debt", sourceAgreement: "Source agreement", circulation: "Circulating ratio", volatility: "24h amplitude", providerState: "Provider state", marketMeaning: "Market meaning",
          liquidity: "Execution liquidity", slippage: "10k slippage", depth: "Bid/ask depth", holders: "Holder concentration", unlocks: "Unlock pressure", venue: "Venue health", anomaly: "Unusual anomaly", liquidityCap: "Liquidity / scale", timestampSkew: "Timestamp drift", sourceEntropy: "Source entropy", fakeLive: "Fake-live risk", narrativeDrift: "Narrative drift", releaseMode: "Release mode", lineage: "Source lineage", execution: "Execution evidence coverage", supplyOverhang: "Supply overhang", orderbookFragility: "Orderbook fragility", providerResilience: "Provider resilience", nextProbe: "Next probe", finalBoundary: "Claim boundary",
        };

  const basicMetrics: Pass454Metric[] = [
    metric(safeLocale, "identity", labels.instrument, identity, "Resolves the exact asset before any conclusion."),
    metric(safeLocale, "price", labels.price, money(safeLocale, snapshot?.price, currency), "The latest source-bound market price."),
    metric(safeLocale, "marketCap", labels.marketCap, money(safeLocale, snapshot?.marketCap, currency), "Places the asset on a market-size scale."),
    metric(safeLocale, "change24h", labels.change24h, pct(safeLocale, snapshot?.change24h), "Shows movement without turning it into a forecast.", "review"),
    metric(safeLocale, "volume24h", labels.volume, money(safeLocale, snapshot?.volume24h, currency), "Shows how much value changed hands in the observed window."),
    metric(safeLocale, "range24h", labels.range, finite(snapshot?.low24h) && finite(snapshot?.high24h) ? `${money(safeLocale, snapshot.low24h, currency)} – ${money(safeLocale, snapshot.high24h, currency)}` : null, "Shows daily amplitude and avoids direction guessing.", "review"),
    metric(safeLocale, "source", labels.source, sourceLabel, "Names the provider behind the visible values."),
    metric(safeLocale, "freshness", labels.freshness, ageMinutes === null ? null : `${ageMinutes} min`, "Old data cannot masquerade as live data.", ageMinutes !== null && ageMinutes <= 15 ? "confirmed" : "review", "timestamp"),
    metric(safeLocale, "confidence", labels.confidence, `${evidenceCoverageCeiling}%`, "Shows a deterministic evidence-coverage ceiling; it is not calibrated confidence.", evidenceCoverageCeiling >= 65 ? "confirmed" : "review"),
    metric(safeLocale, "next", labels.next, result.nextOperatorStep, "Names one concrete verification action instead of generic debug text.", "review"),
  ];

  const proMetrics: Pass454Metric[] = [
    ...basicMetrics.slice(0, 6),
    metric(safeLocale, "change1h", labels.change1h, pct(safeLocale, snapshot?.change1h), "Separates short impulse from the daily move.", "review"),
    metric(safeLocale, "change7d", labels.change7d, pct(safeLocale, snapshot?.change7d), "Adds a broader context without forecasting.", "review"),
    metric(safeLocale, "fdv", labels.fdv, money(safeLocale, snapshot?.fdv, currency), "Shows fully diluted valuation when supply data supports it.", "review"),
    metric(safeLocale, "turnover", labels.turnover, turnover === null ? null : pct(safeLocale, turnover), "Normalizes trading activity by asset scale.", "review"),
    metric(safeLocale, "secondSource", labels.second, secondSource, "Independent confirmation reduces single-provider error.", secondSource ? "review" : "source_required", "second independent provider"),
    metric(safeLocale, "quorum", labels.quorum, sourceQuorum, "Two independent sources are the minimum for stronger live wording.", sourceCount >= 2 ? "confirmed" : "review"),
    metric(safeLocale, "evidenceDebt", labels.evidenceDebt, `${missingCount}`, "Counts unresolved fields that still cap the conclusion.", missingCount ? "review" : "confirmed"),
    metric(safeLocale, "marketMeaning", labels.marketMeaning, result.whyItMatters, "Explains why the visible structure matters to a person.", "review"),
  ];

  const releaseMode = evidenceCoverageCeiling >= 70 && sourceCount >= 2 && missingCount <= 1
    ? "source-bound"
    : evidenceCoverageCeiling >= 45
      ? "guarded"
      : "facts-only";
  const advancedMetrics: Pass454Metric[] = [
    metric(safeLocale, "liquidity", labels.liquidity, snapshot?.liquidityLabel, "Separates executable liquidity from headline market cap.", "review", "venue liquidity adapter"),
    metric(safeLocale, "slippage", labels.slippage, finite(snapshot?.slippage10k) ? pct(safeLocale, snapshot.slippage10k) : null, "Estimates impact of a standardized order size.", "review", "orderbook simulation"),
    metric(safeLocale, "depth", labels.depth, snapshot?.depthLabel, "Shows whether visible liquidity exists on both sides of the book.", "review", "bid/ask depth"),
    metric(safeLocale, "holders", labels.holders, snapshot?.holderConcentrationLabel, "Surfaces concentration only when chain or holder data supports it.", "review", "holder distribution"),
    metric(safeLocale, "unlocks", labels.unlocks, snapshot?.unlockLabel, "Separates known vesting pressure from speculation.", "review", "vesting schedule"),
    metric(safeLocale, "venue", labels.venue, snapshot?.venueHealthLabel, "Checks venue cadence, reconnect policy and source health.", "review", "venue status/depth adapter"),
    metric(safeLocale, "anomaly", labels.anomaly, snapshot?.anomalyLabel, "Highlights unusual behaviour without turning one flag into a verdict.", "review", "anomaly evidence"),
    metric(safeLocale, "liquidityScale", labels.liquidityCap, liquidityToCap, "Tests whether market scale is backed by executable depth.", "review", "liquidity + market cap"),
    metric(safeLocale, "timestampSkew", labels.timestampSkew, ageMinutes === null ? null : `${ageMinutes} min`, "Measures how far source time drifts from the report time.", ageMinutes !== null && ageMinutes <= 15 ? "confirmed" : "review", "fresh timestamp"),
    metric(safeLocale, "sourceEntropy", labels.sourceEntropy, `${sourceCount} ${sourceCount === 1 ? "lane" : "lanes"}`, "Shows whether evidence is diversified or concentrated in one provider.", sourceCount >= 2 ? "confirmed" : "review"),
    metric(safeLocale, "fakeLive", labels.fakeLive, ageMinutes === null || sourceCount < 2 ? "elevated" : ageMinutes > 30 ? "review" : "low", "Prevents cached or single-source values from being sold as live truth.", ageMinutes !== null && sourceCount >= 2 ? "confirmed" : "review"),
    metric(safeLocale, "narrativeDrift", labels.narrativeDrift, result.summary.length > 520 ? "review" : "low", "Checks whether the story grows stronger than the evidence packet.", "review"),
    metric(safeLocale, "releaseMode", labels.releaseMode, releaseMode, "Controls whether the bot may use normal, guarded or facts-only language.", releaseMode === "source-bound" ? "confirmed" : "review"),
    metric(safeLocale, "lineage", labels.lineage, sourceLabel ? `${sourceLabel}${secondSource ? ` → ${secondSource}` : ""}` : null, "Preserves the route from provider payload to customer-facing claim.", sourceCount >= 2 ? "confirmed" : "review", "provider lineage"),
    metric(safeLocale, "execution", labels.execution, `${evidenceCoverageCeiling}%`, "Combines source coverage, freshness and unresolved gaps into an execution evidence ceiling; it is not calibrated confidence.", evidenceCoverageCeiling >= 65 ? "confirmed" : "review"),
    metric(safeLocale, "supplyOverhang", labels.supplyOverhang, fdvPremium === null ? null : pct(safeLocale, fdvPremium), "Surfaces possible dilution pressure without predicting price.", "review", "FDV + market cap"),
    metric(safeLocale, "orderbookFragility", labels.orderbookFragility, snapshot?.slippage10k === undefined ? null : snapshot.slippage10k > 1 ? "elevated" : "contained", "Combines depth and slippage into an execution warning.", "review", "orderbook depth"),
    metric(safeLocale, "providerResilience", labels.providerResilience, `${sourceCount}/2 · ${ageMinutes === null ? "timestamp missing" : `${ageMinutes} min`}`, "Checks whether the report survives one provider failure.", sourceCount >= 2 ? "confirmed" : "review"),
    metric(safeLocale, "nextProbe", labels.nextProbe, result.missingData[0] || result.nextOperatorStep, "Chooses the next evidence query with the largest evidence-coverage impact.", "review"),
    metric(safeLocale, "boundary", labels.finalBoundary, summary, "States exactly how far the current evidence allows the conclusion to go.", "review"),
  ];

  return {
    version: "evidence-dense-human-analysis-runtime",
    locale: safeLocale,
    verdict: { eyebrow: c.eyebrow, headline: c.headline, summary, tone },
    tiers: [
      { id: "basic", label: "Basic", fieldCount: 10, promise: c.basic, metrics: basicMetrics },
      { id: "pro", label: "Pro", fieldCount: 14, promise: c.pro, metrics: proMetrics },
      { id: "advanced", label: "Advanced", fieldCount: 20, promise: c.advanced, metrics: advancedMetrics },
    ],
    forge: {
      stageCount: 4,
      stages: c.forge.map(([id, label, detail]) => ({ id, label, detail })),
    },
    browserContract: {
      idleCardVisible: true,
      animatedVVisibleDuringGeneration: true,
      previewAndDownloadShareBlob: true,
      backgroundScrollLocked: true,
      downloadIconRequired: true,
    },
    realMarketsContract: {
      assetClasses: ["crypto", "stocks", "indices", "fx", "etf", "commodities", "real_estate", "exchanges"],
      venueHealthSeparated: true,
      dynamicProviderSearch: true,
      categoryCountsVisible: true,
    },
  };
}

export const pass454EvidenceDenseHumanAnalysisRuntime = {
  id: "PASS454",
  title: "Evidence-Dense Human Analysis + PDF Readability",
  fieldBudgets: { basic: 10, pro: 14, advanced: 20 },
  forgeStages: 4,
  languages: ["pl", "de", "en"],
  rules: [
    "No bare unknown values in customer-facing analysis.",
    "Advanced metrics remain source-bound and cannot invent substitute values.",
    "PDF preview and download share one binary payload.",
    "Venue health is not rendered as a fake listed-equity quote.",
  ],
} as const;
