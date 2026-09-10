import {
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderSources,
} from "@/lib/ai/evidence-normalization";

export type Pass453Locale = "pl" | "de" | "en";
export type Pass453Tone = "calm" | "review" | "elevated" | "blocked";
export type Pass453MetricState = "confirmed" | "review" | "source_required" | "not_applicable";

export type Pass453DecisionMetric = {
  id: string;
  label: string;
  value: string;
  state: Pass453MetricState;
  explanation: string;
};

export type Pass453UnifiedIntelligenceHandoff = {
  version: "unified-intelligence-handoff-runtime";
  locale: Pass453Locale;
  decision: {
    tone: Pass453Tone;
    eyebrow: string;
    headline: string;
    summary: string;
    evidenceLabel: string;
    evidenceCeiling: number;
    /** @deprecated Compatibility alias for evidenceLabel; not calibrated confidence. */
    confidenceLabel: string;
    /** @deprecated Compatibility alias for evidenceCeiling; not calibrated confidence. */
    confidenceCeiling: number;
    sourceQuorum: string;
    evidenceCoverage: number;
    dataAgeLabel: string;
  };
  whatWeKnow: string[];
  whatLimitsEvidence: string[];
  /** @deprecated Compatibility alias for whatLimitsEvidence. */
  whatLimitsConfidence: string[];
  nextBestChecks: string[];
  signatureMetrics: Pass453DecisionMetric[];
  labels: {
    verdict: string;
    known: string;
    limits: string;
    nextChecks: string;
    readiness: string;
    sourceRequired: string;
    secondSource: string;
    dataFreshness: string;
    evidenceCoverage: string;
    evidenceCeiling: string;
    /** @deprecated Compatibility alias for evidenceCeiling. */
    confidenceCeiling: string;
    sourceQuorum: string;
    diagnostics: string;
    sourceBound: string;
    previewDownloadParity: string;
    humanReader: string;
    pdfReader: string;
  };
  handoff: {
    payloadId: string;
    shieldHref: string;
    browserToShieldConnected: true;
    onePayloadAcrossBrowserShieldPdf: true;
    noGeneratedSubstituteValues: true;
  };
};

function localeOf(locale: string): Pass453Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clean(value: string | undefined | null, max = 180) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function number(locale: Pass453Locale, value: number, digits = 2) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

function percent(locale: Pass453Locale, value?: number, digits = 2) {
  if (!finite(value)) return null;
  return `${value > 0 ? "+" : ""}${number(locale, value, digits)}%`;
}

function compact(locale: Pass453Locale, value?: number) {
  if (!finite(value)) return null;
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function money(locale: Pass453Locale, value?: number, currency = "USD") {
  if (!finite(value)) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  } catch {
    return compact(locale, value);
  }
}

function copy(locale: Pass453Locale) {
  if (locale === "de") {
    return {
      labels: {
        verdict: "Menschliches Fazit",
        known: "Was wir belegen können",
        limits: "Was die Evidenz begrenzt",
        nextChecks: "Nächste Prüfungen",
        readiness: "Datenbereitschaft",
        sourceRequired: "Quelle erforderlich",
        secondSource: "Zweitquelle",
        dataFreshness: "Datenfrische",
        evidenceCoverage: "Evidenzabdeckung",
        evidenceCeiling: "Evidenzgrenze",
        confidenceCeiling: "Evidenzgrenze",
        sourceQuorum: "Quellenquorum",
        diagnostics: "Advanced-Diagnostik",
        sourceBound: "quellengebunden",
        previewDownloadParity: "Vorschau = Download",
        humanReader: "Lesemodus",
        pdfReader: "PDF 1:1",
      },
      calm: "Die Kerndaten sind lesbar und die Quellenlage ist ausreichend für einen vorsichtigen Kurzbericht.",
      review: "Die Marktgrundlagen sind sichtbar, aber fehlende Quellen begrenzen jede stärkere Aussage.",
      elevated: "Mehrere Datenlücken oder eine schwache Quellenlage verlangen eine vertiefte Prüfung vor einem Fazit.",
      blocked: "Die Evidenz reicht nicht für eine belastbare Aussage. Lens zeigt nur verifizierbare Fakten und die nächste Prüfung.",
      sourceRequired: (label: string) => `Quelle erforderlich: ${label}`,
      ageMissing: "Zeitstempel erforderlich",
      ageNow: "aktuell",
      ageMinutes: (minutes: number) => `${minutes} Min. alt`,
      knowPrice: (value: string) => `Preis: ${value}`,
      knowMarketCap: (value: string) => `Market Cap: ${value}`,
      knowMove: (value: string) => `24h-Bewegung: ${value}`,
      knowVolume: (value: string) => `24h-Volumen: ${value}`,
      missingSecond: "Eine zweite unabhängige Quelle fehlt.",
      missingTimestamp: "Die Datenfrische ist nicht eindeutig bestätigt.",
      missingCore: "Mindestens ein Kernfeld des Markt-Snapshots fehlt.",
      nextSecond: "Preis, Volumen und Zeitstempel mit einer zweiten unabhängigen Quelle abgleichen.",
      nextLiquidity: "Orderbuch, Liquidität und Slippage für die relevante Venue prüfen.",
      nextSupply: "Float, Holder-Konzentration und Unlock-Zeitplan verifizieren.",
      nextShield: "Den vollständigen Shield-Handoff öffnen und offene Felder anhand der Source-Lineage prüfen.",
      metric: {
        turnover: "Volumen / Market Cap",
        fdv: "FDV-Aufschlag",
        range: "24h-Amplitude",
        circulation: "Umlaufquote",
        liquidity: "Ausführungsliquidität",
        slippage: "Slippage 10k",
        holders: "Holder-Konzentration",
        unlocks: "Unlock-Druck",
      },
      explanations: {
        turnover: "Ordnet das Handelsvolumen relativ zur Größe des Assets ein.",
        fdv: "Zeigt potenziellen Angebotsüberhang zwischen aktueller und voll verwässerter Bewertung.",
        range: "Misst die Tagesamplitude ohne eine Preisrichtung vorherzusagen.",
        circulation: "Zeigt, welcher Anteil des Gesamtangebots bereits umläuft.",
        liquidity: "Bewertet die Ausführbarkeit, nicht nur die sichtbare Preisbewegung.",
        slippage: "Schätzt die Auswirkung einer standardisierten Ordergröße.",
        holders: "Markiert Konzentrationsrisiko nur, wenn eine Quelle vorhanden ist.",
        unlocks: "Trennt bekannten Vesting-Druck von unbelegten Annahmen.",
      },
    } as const;
  }
  if (locale === "en") {
    return {
      labels: {
        verdict: "Human verdict",
        known: "What we can support",
        limits: "What limits evidence",
        nextChecks: "Next checks",
        readiness: "Data readiness",
        sourceRequired: "Source required",
        secondSource: "Second source",
        dataFreshness: "Data freshness",
        evidenceCoverage: "Evidence coverage",
        evidenceCeiling: "Evidence ceiling",
        confidenceCeiling: "Evidence ceiling",
        sourceQuorum: "Source quorum",
        diagnostics: "Advanced diagnostics",
        sourceBound: "source-bound",
        previewDownloadParity: "Preview = download",
        humanReader: "Human reader",
        pdfReader: "PDF 1:1",
      },
      calm: "Core market fields are readable and the source state supports a cautious short report.",
      review: "Market essentials are visible, but missing evidence caps every stronger claim.",
      elevated: "Multiple data gaps or weak source coverage require deeper verification before a verdict.",
      blocked: "Evidence is insufficient for a reliable claim. Lens releases verified facts and the next check only.",
      sourceRequired: (label: string) => `Source required: ${label}`,
      ageMissing: "Timestamp required",
      ageNow: "current",
      ageMinutes: (minutes: number) => `${minutes} min old`,
      knowPrice: (value: string) => `Price: ${value}`,
      knowMarketCap: (value: string) => `Market cap: ${value}`,
      knowMove: (value: string) => `24h move: ${value}`,
      knowVolume: (value: string) => `24h volume: ${value}`,
      missingSecond: "A second independent source is not confirmed.",
      missingTimestamp: "Data freshness is not clearly confirmed.",
      missingCore: "At least one core market snapshot field is missing.",
      nextSecond: "Cross-check price, volume and timestamp with a second independent source.",
      nextLiquidity: "Verify orderbook depth, liquidity and slippage on the relevant venue.",
      nextSupply: "Verify float, holder concentration and the unlock schedule.",
      nextShield: "Open the full Shield handoff and resolve open fields through source lineage.",
      metric: {
        turnover: "Volume / market cap",
        fdv: "FDV premium",
        range: "24h amplitude",
        circulation: "Circulating ratio",
        liquidity: "Execution liquidity",
        slippage: "10k slippage",
        holders: "Holder concentration",
        unlocks: "Unlock pressure",
      },
      explanations: {
        turnover: "Places trading activity in context of the asset scale.",
        fdv: "Surfaces potential supply overhang between current and fully diluted valuation.",
        range: "Measures daily amplitude without predicting price direction.",
        circulation: "Shows how much of total supply already circulates.",
        liquidity: "Evaluates execution quality, not only visible price movement.",
        slippage: "Estimates the impact of a standardized order size.",
        holders: "Flags concentration only when a supporting source exists.",
        unlocks: "Separates known vesting pressure from unsupported assumptions.",
      },
    } as const;
  }
  return {
    labels: {
      verdict: "Werdykt dla człowieka",
      known: "Co możemy potwierdzić",
      limits: "Co ogranicza dowody",
      nextChecks: "Następne sprawdzenia",
      readiness: "Gotowość danych",
      sourceRequired: "Wymaga źródła",
      secondSource: "Drugie źródło",
      dataFreshness: "Świeżość danych",
      evidenceCoverage: "Pokrycie dowodowe",
      evidenceCeiling: "Limit dowodów",
      confidenceCeiling: "Limit dowodów",
      sourceQuorum: "Quorum źródeł",
      diagnostics: "Diagnostyka Advanced",
      sourceBound: "związane ze źródłami",
      previewDownloadParity: "Podgląd = pobranie",
      humanReader: "Widok czytelny",
      pdfReader: "PDF 1:1",
    },
    calm: "Kluczowe dane rynku są czytelne, a stan źródeł pozwala na ostrożny krótki raport.",
    review: "Podstawowe dane są widoczne, ale braki dowodowe ograniczają każdy mocniejszy wniosek.",
    elevated: "Kilka luk danych lub słabe pokrycie źródłowe wymaga głębszej weryfikacji przed werdyktem.",
    blocked: "Materiał nie wystarcza do wiarygodnego wniosku. Lens wypuszcza tylko potwierdzone fakty i następny krok.",
    sourceRequired: (label: string) => `Wymaga źródła: ${label}`,
    ageMissing: "Wymaga timestampu",
    ageNow: "aktualne",
    ageMinutes: (minutes: number) => `${minutes} min temu`,
    knowPrice: (value: string) => `Cena: ${value}`,
    knowMarketCap: (value: string) => `Kapitalizacja: ${value}`,
    knowMove: (value: string) => `Zmiana 24h: ${value}`,
    knowVolume: (value: string) => `Wolumen 24h: ${value}`,
    missingSecond: "Nie potwierdzono drugiego niezależnego źródła.",
    missingTimestamp: "Świeżość danych nie została jednoznacznie potwierdzona.",
    missingCore: "Brakuje co najmniej jednego kluczowego pola snapshotu rynku.",
    nextSecond: "Porównaj cenę, wolumen i timestamp z drugim niezależnym źródłem.",
    nextLiquidity: "Sprawdź orderbook, płynność i slippage na właściwej giełdzie.",
    nextSupply: "Zweryfikuj float, koncentrację holderów i harmonogram unlocków.",
    nextShield: "Otwórz pełny handoff Shield i domknij pola przez source lineage.",
    metric: {
      turnover: "Wolumen / kapitalizacja",
      fdv: "Premia FDV",
      range: "Amplituda 24h",
      circulation: "Udział podaży w obiegu",
      liquidity: "Płynność wykonawcza",
      slippage: "Poślizg 10k",
      holders: "Koncentracja holderów",
      unlocks: "Presja unlocków",
    },
    explanations: {
      turnover: "Pokazuje skalę obrotu względem wielkości aktywa.",
      fdv: "Ujawnia potencjalny nawis podaży między obecną a rozwodnioną wyceną.",
      range: "Mierzy amplitudę dnia bez zgadywania kierunku ceny.",
      circulation: "Pokazuje, jaka część podaży całkowitej już krąży na rynku.",
      liquidity: "Ocenia jakość wykonania, a nie tylko widoczny ruch ceny.",
      slippage: "Szacuje wpływ standaryzowanej wielkości zlecenia.",
      holders: "Oznacza koncentrację tylko wtedy, gdy istnieje źródło.",
      unlocks: "Oddziela znaną presję vestingu od niepotwierdzonych założeń.",
    },
  } as const;
}

function metric(
  id: string,
  label: string,
  value: string | null,
  explanation: string,
  sourceRequired: (label: string) => string,
  state: Pass453MetricState = "review",
): Pass453DecisionMetric {
  return {
    id,
    label,
    value: value || sourceRequired(label.toLowerCase()),
    state: value ? state : "source_required",
    explanation,
  };
}

export function buildPass453UnifiedIntelligenceHandoff(
  result: VelmereSearchResult,
  locale: string,
  generatedAt = new Date().toISOString(),
): Pass453UnifiedIntelligenceHandoff {
  const safeLocale = localeOf(locale);
  const c = copy(safeLocale);
  const snapshot = result.marketSnapshot;
  const currency = snapshot?.currency || "USD";
  const confirmedSources = independentLiveProviderSources(result.sources);
  const sourceCount = confirmedSources.length;
  const coreValues = [snapshot?.price, snapshot?.marketCap, snapshot?.volume24h, snapshot?.change24h];
  const coreCoverage = coreValues.filter(finite).length;
  const missingCount = result.missingData.length;
  const generatedMs = Date.parse(generatedAt);
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, {
    nowMs: Number.isFinite(generatedMs) ? generatedMs : undefined,
  });
  const freshnessMinutes = timestamp.ageMinutes;
  const evidenceCoverage = Math.max(
    0,
    Math.min(100, Math.round(coreCoverage * 17 + Math.min(2, sourceCount) * 12 + (freshnessMinutes !== null ? 8 : 0))),
  );
  const sourceCoverage = result.sourceCoverage ?? sourceEvidenceCoverageScore(result);
  const evidenceCeiling = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        sourceCoverage -
          (sourceCount < 2 ? 12 : 0) -
          Math.min(24, missingCount * 4) -
          (timestamp.state === "future" || timestamp.state === "invalid" || timestamp.state === "missing"
            ? 12
            : timestamp.state === "stale"
              ? 8
              : timestamp.state === "aging"
                ? 4
                : 0),
      ),
    ),
  );
  const tone: Pass453Tone =
    result.tone === "blocked" || evidenceCeiling < 30
      ? "blocked"
      : result.tone === "elevated" || missingCount >= 4 || evidenceCeiling < 48
        ? "elevated"
        : sourceCount >= 2 && coreCoverage >= 3 && evidenceCeiling >= 66 && (timestamp.state === "fresh" || timestamp.state === "aging")
          ? "calm"
          : "review";
  const summary = tone === "calm" ? c.calm : tone === "review" ? c.review : tone === "elevated" ? c.elevated : c.blocked;

  const whatWeKnow = [
    money(safeLocale, snapshot?.price, currency) ? c.knowPrice(money(safeLocale, snapshot?.price, currency)!) : "",
    money(safeLocale, snapshot?.marketCap, currency) ? c.knowMarketCap(money(safeLocale, snapshot?.marketCap, currency)!) : "",
    percent(safeLocale, snapshot?.change24h) ? c.knowMove(percent(safeLocale, snapshot?.change24h)!) : "",
    money(safeLocale, snapshot?.volume24h, currency) ? c.knowVolume(money(safeLocale, snapshot?.volume24h, currency)!) : "",
  ].filter(Boolean).slice(0, 4);

  const whatLimitsEvidence = [
    sourceCount < 2 ? c.missingSecond : "",
    timestamp.state === "fresh" || timestamp.state === "aging" ? "" : c.missingTimestamp,
    coreCoverage < 4 ? c.missingCore : "",
    ...result.missingData.slice(0, 3).map((entry) => c.sourceRequired(clean(entry, 100))),
  ].filter(Boolean).slice(0, 4);

  const lowerMissing = result.missingData.join(" ").toLowerCase();
  const nextBestChecks = [
    sourceCount < 2 ? c.nextSecond : "",
    /liquid|depth|orderbook|slippage/.test(lowerMissing) ? c.nextLiquidity : "",
    /holder|supply|float|unlock|vesting/.test(lowerMissing) ? c.nextSupply : "",
    clean(result.nextOperatorStep, 220) || c.nextShield,
  ].filter(Boolean).slice(0, 4);

  const turnover = finite(snapshot?.volume24h) && finite(snapshot?.marketCap) && snapshot!.marketCap! > 0
    ? `${number(safeLocale, (snapshot!.volume24h! / snapshot!.marketCap!) * 100)}%`
    : null;
  const fdvPremium = finite(snapshot?.fdv) && finite(snapshot?.marketCap) && snapshot!.marketCap! > 0
    ? `${number(safeLocale, ((snapshot!.fdv! / snapshot!.marketCap!) - 1) * 100)}%`
    : null;
  const range = finite(snapshot?.high24h) && finite(snapshot?.low24h) && finite(snapshot?.price) && snapshot!.price! > 0
    ? `${number(safeLocale, ((snapshot!.high24h! - snapshot!.low24h!) / snapshot!.price!) * 100)}%`
    : null;
  const circulation = finite(snapshot?.circulatingSupply) && finite(snapshot?.totalSupply) && snapshot!.totalSupply! > 0
    ? `${number(safeLocale, (snapshot!.circulatingSupply! / snapshot!.totalSupply!) * 100)}%`
    : null;
  const slippage = finite(snapshot?.slippage10k) ? `${number(safeLocale, snapshot!.slippage10k!)}%` : null;

  const signatureMetrics = [
    metric("turnover", c.metric.turnover, turnover, c.explanations.turnover, c.sourceRequired),
    metric("fdv", c.metric.fdv, fdvPremium, c.explanations.fdv, c.sourceRequired),
    metric("range", c.metric.range, range, c.explanations.range, c.sourceRequired),
    metric("circulation", c.metric.circulation, circulation, c.explanations.circulation, c.sourceRequired),
    metric("liquidity", c.metric.liquidity, clean(snapshot?.liquidityLabel, 90) || null, c.explanations.liquidity, c.sourceRequired),
    metric("slippage", c.metric.slippage, slippage, c.explanations.slippage, c.sourceRequired),
    metric("holders", c.metric.holders, clean(snapshot?.holderConcentrationLabel, 90) || null, c.explanations.holders, c.sourceRequired),
    metric("unlocks", c.metric.unlocks, clean(snapshot?.unlockLabel, 90) || null, c.explanations.unlocks, c.sourceRequired),
  ];

  return {
    version: "unified-intelligence-handoff-runtime",
    locale: safeLocale,
    decision: {
      tone,
      eyebrow: c.labels.verdict,
      headline: `${result.symbol || result.title} · ${evidenceCeiling}% ${safeLocale === "pl" ? "dowodów" : safeLocale === "de" ? "Evidenz" : "evidence"}`,
      summary,
      evidenceLabel: c.labels.evidenceCeiling,
      evidenceCeiling,
      confidenceLabel: c.labels.evidenceCeiling,
      confidenceCeiling: evidenceCeiling,
      sourceQuorum: `${Math.min(sourceCount, 2)}/2`,
      evidenceCoverage,
      dataAgeLabel: freshnessMinutes === null ? c.ageMissing : freshnessMinutes <= 1 ? c.ageNow : c.ageMinutes(freshnessMinutes),
    },
    whatWeKnow,
    whatLimitsEvidence,
    whatLimitsConfidence: whatLimitsEvidence,
    nextBestChecks,
    signatureMetrics,
    labels: c.labels,
    handoff: {
      payloadId: `${result.id}:${result.symbol || result.title}:${generatedAt}`,
      shieldHref: result.shieldHref,
      browserToShieldConnected: true,
      onePayloadAcrossBrowserShieldPdf: true,
      noGeneratedSubstituteValues: true,
    },
  };
}

export const pass453UnifiedIntelligenceHandoffRuntime = {
  id: "PASS453",
  title: "Unified Intelligence Handoff Runtime",
  rules: [
    "Browser, PDF and Shield receive the same source-bound decision payload.",
    "Customer copy starts with a human verdict, supported facts, evidence limits and next checks.",
    "Missing values name the required source instead of rendering a bare unknown.",
    "Advanced diagnostics expose unusual ratios without inventing replacement values.",
  ],
} as const;
