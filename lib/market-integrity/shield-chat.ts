import type { TokenRiskResult } from "./risk-types";
import { buildAiRiskBotBrief } from "./ai-risk-bot";
import { buildHolderIntelligence } from "./holder-intelligence";
import {
  buildStressScenarios,
  getWorstStressScenario,
} from "./stress-simulator";
import { independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { buildRiskReplay } from "./risk-replay";
import {
  humanMissingValue,
  resolvePass446Locale,
} from "./human-readout-lane-runtime";

type HistoryLike = Array<{
  score?: number;
  timestamp?: string;
  price?: number;
  volume24h?: number;
}>;
export type ShieldChatLocale = "pl" | "de" | "en";

export type ShieldChatCard = {
  label: string;
  value: string;
  tone: "low" | "watch" | "warning" | "critical" | "neutral";
  body: string;
};

export type ShieldChatSourceContext = {
  sourceContract: string;
  providerPlan: string[];
  providerFacts: Array<{ label: string; value: string }>;
  consensusState: "aligned" | "watch" | "divergent" | "single_source" | "stale" | "unavailable";
  confidenceCap: number;
  consensusNotes: string[];
};

export type ShieldChatResponse = {
  prompt: string;
  mode: "risk" | "holders" | "liquidity" | "candles" | "evidence" | "general";
  headline: string;
  answer: string;
  cards: ShieldChatCard[];
  nextActions: string[];
  guardrails: string[];
  confidence: number;
  sourceState: "source_bound" | "partial" | "source_required";
  sourceContract: string;
  providerPlan: string[];
  providerFacts: Array<{ label: string; value: string }>;
  consensusState: "aligned" | "watch" | "divergent" | "single_source" | "stale" | "unavailable";
  confidenceCap: number;
  consensusNotes: string[];
};

const copy = {
  pl: {
    riskScore: "Presja ryzyka",
    dominantSignal: "Dominujący sygnał",
    noDominantSignal: "Silnik nie zwrócił dominującego sygnału.",
    replayDelta: "Zmiana w replay",
    replayPhase: "Faza replay",
    acceleration: "przyspieszenie",
    confidence: "Pewność danych",
    dataQuality: "Jakość danych",
    missingVisible: "Braki pozostają widoczne i obniżają pewność.",
    botVerdict: "Werdykt bota",
    holderBrain: "Warstwa holderów",
    completeness: "Kompletność danych",
    missing: "Brakujące źródła",
    noProxyMissing: "brak wykrytych luk w modelu proxy",
    liquidity: "Płynność",
    liquidityCoverageMissing:
      "Brak potwierdzonej relacji płynności do kapitalizacji. Ocena wyjścia pozostaje częściowa.",
    liquidityCoverage:
      "Widoczna płynność odpowiada około {value}% kapitalizacji.",
    worstStress: "Najgorszy scenariusz",
    stressMissing: "Symulator nie zwrócił potwierdzonego scenariusza.",
    volume24h: "Wolumen 24h",
    volumeContext: "Wolumen / kapitalizacja",
    micro: "Traktuj 1h jako mikrostrukturę, nie pełny werdykt.",
    day: "Porównaj ruch 24h z płynnością, wolumenem i jakością źródeł.",
    week: "7d pokazuje, czy ruch jest pojedynczy, czy częścią szerszej zmiany wyceny.",
    caseLanguage: "Język raportu",
    anomalyReview: "przegląd anomalii",
    caseBody:
      "Raport opisuje dowody, niepewność i następne sprawdzenie bez oskarżeń i obietnic wyniku.",
    bestQuestion: "Najlepsze następne pytanie",
    bestQuestionBody:
      "Zawęź analizę do holderów, płynności, świec, źródeł albo replay.",
    riskHeadline: "Wyjaśnienie ryzyka dla {symbol}",
    holdersHeadline: "Przegląd holderów i podaży dla {symbol}",
    liquidityHeadline: "Ocena głębokości wyjścia dla {symbol}",
    candlesHeadline: "Struktura świec dla {symbol}",
    evidenceHeadline: "Plan raportu dowodowego dla {symbol}",
    generalHeadline: "Shield AI dla {symbol}",
    holdersAnswer:
      "Warstwa holderów ma status {verdict} i {completeness}% kompletności. Nieklasyfikowane klastry pozostają niepewnością do czasu podłączenia danych on-chain.",
    liquidityAnswer:
      "Ocena wyjścia zależy od głębokości, spreadu, slippage i scenariuszy stresowych. Widoczna płynność: {liquidity}.",
    candlesAnswer:
      "Świece: 1h {h1}, 24h {h24}, 7d {d7}. Struktura musi zostać sprawdzona razem z płynnością i źródłami.",
    evidenceAnswer:
      "Raport powinien prowadzić od faktów przez luki danych do następnego sprawdzenia. Nie jest poradą inwestycyjną ani dowodem prawnym.",
    riskActions: [
      "Otwórz oś replay",
      "Porównaj główny sygnał z płynnością i holderami",
      "Wygeneruj manifest dowodów",
    ],
    liquidityActions: [
      "Sprawdź symulator stresu",
      "Porównaj bid depth z presją sprzedaży",
      "Potwierdź, czy płynność pochodzi z DEX, CEX czy modelu proxy",
    ],
    candlesActions: [
      "Porównaj 1h / 4h / 1d",
      "Sprawdź wzrost wolumenu przy słabej głębokości",
      "Nie traktuj wykresu fallback jako pełnych danych giełdowych",
    ],
    evidenceActions: [
      "Eksportuj raport JSON",
      "Dołącz listę brakujących źródeł",
      "Zachowaj spokojny język przeglądu ryzyka",
    ],
    guardrails: [
      "Bez porady inwestycyjnej.",
      "Bez oskarżeń bez zewnętrznej weryfikacji.",
      "Brak danych zwiększa niepewność, nie pewność.",
    ],
  },
  de: {
    riskScore: "Risikodruck",
    dominantSignal: "Dominantes Signal",
    noDominantSignal: "Die Engine lieferte kein dominantes Signal.",
    replayDelta: "Replay-Änderung",
    replayPhase: "Replay-Phase",
    acceleration: "Beschleunigung",
    confidence: "Datenkonfidenz",
    dataQuality: "Datenqualität",
    missingVisible: "Datenlücken bleiben sichtbar und senken die Konfidenz.",
    botVerdict: "Bot-Befund",
    holderBrain: "Holder-Ebene",
    completeness: "Datenvollständigkeit",
    missing: "Fehlende Quellen",
    noProxyMissing: "keine Lücke im Proxy-Modell erkannt",
    liquidity: "Liquidität",
    liquidityCoverageMissing:
      "Kein bestätigtes Verhältnis von Liquidität zu Market Cap. Die Exit-Bewertung bleibt teilweise.",
    liquidityCoverage:
      "Sichtbare Liquidität entspricht ungefähr {value}% der Market Cap.",
    worstStress: "Stärkster Stressfall",
    stressMissing: "Der Simulator lieferte keinen bestätigten Stressfall.",
    volume24h: "24h-Volumen",
    volumeContext: "Volumen / Market Cap",
    micro: "1h ist Mikrostruktur, nicht der vollständige Befund.",
    day: "24h-Bewegung mit Liquidität, Volumen und Quellenqualität vergleichen.",
    week: "7d zeigt, ob die Bewegung isoliert oder Teil einer breiteren Neubewertung ist.",
    caseLanguage: "Berichtssprache",
    anomalyReview: "Anomalie-Review",
    caseBody:
      "Der Bericht beschreibt Evidenz, Unsicherheit und nächste Prüfung ohne Anschuldigungen oder Ergebnisversprechen.",
    bestQuestion: "Beste nächste Frage",
    bestQuestionBody:
      "Analyse auf Holder, Liquidität, Kerzen, Quellen oder Replay eingrenzen.",
    riskHeadline: "Risikoerklärung für {symbol}",
    holdersHeadline: "Holder- und Supply-Review für {symbol}",
    liquidityHeadline: "Exit-Depth-Review für {symbol}",
    candlesHeadline: "Kerzenstruktur für {symbol}",
    evidenceHeadline: "Evidenzbericht für {symbol}",
    generalHeadline: "Shield AI für {symbol}",
    holdersAnswer:
      "Die Holder-Ebene hat den Status {verdict} bei {completeness}% Vollständigkeit. Nicht klassifizierte Cluster bleiben Unsicherheit, bis On-Chain-Daten verbunden sind.",
    liquidityAnswer:
      "Die Exit-Bewertung hängt von Depth, Spread, Slippage und Stressfällen ab. Sichtbare Liquidität: {liquidity}.",
    candlesAnswer:
      "Kerzen: 1h {h1}, 24h {h24}, 7d {d7}. Die Struktur muss mit Liquidität und Quellen geprüft werden.",
    evidenceAnswer:
      "Der Bericht führt von Fakten über Datenlücken zur nächsten Prüfung. Er ist weder Anlageberatung noch Rechtsbeweis.",
    riskActions: [
      "Replay-Zeitleiste öffnen",
      "Hauptsignal mit Liquidität und Holdern vergleichen",
      "Evidenzmanifest erzeugen",
    ],
    liquidityActions: [
      "Stress-Simulator prüfen",
      "Bid Depth mit Verkaufsdruck vergleichen",
      "DEX-, CEX- oder Proxy-Liquidität bestätigen",
    ],
    candlesActions: [
      "1h / 4h / 1d vergleichen",
      "Volumenanstieg bei schwacher Depth prüfen",
      "Fallback-Charts nicht als vollständige Börsendaten behandeln",
    ],
    evidenceActions: [
      "JSON-Bericht exportieren",
      "Fehlende Quellen anhängen",
      "Ruhige Review-Sprache beibehalten",
    ],
    guardrails: [
      "Keine Anlageberatung.",
      "Keine Anschuldigung ohne externe Prüfung.",
      "Fehlende Daten erhöhen Unsicherheit, nicht Sicherheit.",
    ],
  },
  en: {
    riskScore: "Risk pressure",
    dominantSignal: "Dominant signal",
    noDominantSignal: "The engine returned no dominant signal.",
    replayDelta: "Replay delta",
    replayPhase: "Replay phase",
    acceleration: "acceleration",
    confidence: "Data confidence",
    dataQuality: "Data quality",
    missingVisible: "Missing inputs stay visible and reduce confidence.",
    botVerdict: "Bot verdict",
    holderBrain: "Holder layer",
    completeness: "Data completeness",
    missing: "Missing sources",
    noProxyMissing: "no gap detected by the proxy model",
    liquidity: "Liquidity",
    liquidityCoverageMissing:
      "No confirmed liquidity-to-market-cap ratio. Exit depth remains partial.",
    liquidityCoverage:
      "Visible liquidity is approximately {value}% of market cap.",
    worstStress: "Worst stress case",
    stressMissing: "The simulator returned no confirmed stress scenario.",
    volume24h: "24h volume",
    volumeContext: "Volume / market cap",
    micro: "Treat 1h as microstructure, not the full verdict.",
    day: "Compare the 24h move with liquidity, volume and source quality.",
    week: "7d shows whether the move is isolated or part of a broader repricing.",
    caseLanguage: "Report language",
    anomalyReview: "anomaly review",
    caseBody:
      "The report describes evidence, uncertainty and the next check without accusations or outcome promises.",
    bestQuestion: "Best next question",
    bestQuestionBody:
      "Narrow the analysis to holders, liquidity, candles, sources or replay.",
    riskHeadline: "Risk explanation for {symbol}",
    holdersHeadline: "Holder and supply review for {symbol}",
    liquidityHeadline: "Exit-depth review for {symbol}",
    candlesHeadline: "Candlestick structure for {symbol}",
    evidenceHeadline: "Evidence report plan for {symbol}",
    generalHeadline: "Shield AI for {symbol}",
    holdersAnswer:
      "The holder layer is {verdict} with {completeness}% completeness. Unclassified clusters remain uncertainty until on-chain data is connected.",
    liquidityAnswer:
      "Exit depth depends on book depth, spread, slippage and stress scenarios. Visible liquidity: {liquidity}.",
    candlesAnswer:
      "Candles: 1h {h1}, 24h {h24}, 7d {d7}. Structure must be checked with liquidity and source quality.",
    evidenceAnswer:
      "The report should move from facts through data gaps to the next verification. It is not investment advice or legal proof.",
    riskActions: [
      "Open replay timeline",
      "Compare the main signal with liquidity and holders",
      "Generate an evidence manifest",
    ],
    liquidityActions: [
      "Check the stress simulator",
      "Compare bid depth with sell pressure",
      "Confirm whether liquidity is DEX, CEX or proxy-only",
    ],
    candlesActions: [
      "Compare 1h / 4h / 1d",
      "Check volume expansion against weak depth",
      "Do not treat fallback charts as full exchange data",
    ],
    evidenceActions: [
      "Export report JSON",
      "Attach missing-source notes",
      "Keep calm risk-review wording",
    ],
    guardrails: [
      "No investment advice.",
      "No accusation without external verification.",
      "Missing data increases uncertainty, not confidence.",
    ],
  },
} as const;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function n(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function replaceTokens(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function pct(
  value: number | undefined,
  locale: ShieldChatLocale,
  field: string,
) {
  if (value === undefined || value === null || !Number.isFinite(value))
    return humanMissingValue(locale, field);
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(value) >= 10 ? 1 : 2 }).format(value)}%`;
}

function money(
  value: number | undefined,
  locale: ShieldChatLocale,
  field: string,
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value) ||
    value <= 0
  )
    return humanMissingValue(locale, field);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000 ? 2 : 4,
  }).format(value);
}

function tone(score: number): ShieldChatCard["tone"] {
  if (score >= 82) return "critical";
  if (score >= 62) return "warning";
  if (score >= 35) return "watch";
  return "low";
}

function inferMode(prompt: string): ShieldChatResponse["mode"] {
  const q = prompt.toLowerCase();
  if (
    /(holder|wallet|whale|cluster|cex|owner|supply|posiadacz|portfel|wieloryb|podaż|halter|inhaber|versorgung)/.test(
      q,
    )
  )
    return "holders";
  if (
    /(liquid|depth|order|book|sell|slippage|exit|płynn|głęb|sprzeda|wyjści|liquidität|tiefe|verkauf|ausstieg)/.test(
      q,
    )
  )
    return "liquidity";
  if (
    /(candle|chart|price|volume|pump|dump|timeframe|1h|4h|7d|świec|wykres|cena|wolumen|kerze|kurs|volumen)/.test(
      q,
    )
  )
    return "candles";
  if (
    /(report|evidence|json|case|proof|dowod|raport|źród|bericht|evidenz|quelle)/.test(
      q,
    )
  )
    return "evidence";
  if (/(risk|score|why|explain|dlaczego|ryzyko|risiko|warum|erklär)/.test(q))
    return "risk";
  return "general";
}

export function buildDefaultShieldSourceContext(
  result: TokenRiskResult,
  locale: ShieldChatLocale,
): ShieldChatSourceContext {
  const sources = independentProviderFamilies(
    result.dataSources.filter((item) => typeof item === "string" && item.trim()),
  ).slice(0, 4);
  const missing: string[] = [];
  if (result.metrics.marketCap === undefined)
    missing.push(
      locale === "pl"
        ? "kapitalizacja z endpointu rynkowego"
        : locale === "de"
          ? "Market-Cap aus einem Marktendpunkt"
          : "market cap from a market endpoint",
    );
  if (result.metrics.liquidityUsd === undefined)
    missing.push(
      locale === "pl"
        ? "głębokość i płynność z DEX/CEX"
        : locale === "de"
          ? "Depth und Liquidität von DEX/CEX"
          : "DEX/CEX depth and liquidity",
    );
  if (result.metrics.top10HolderPercent === undefined)
    missing.push(
      locale === "pl"
        ? "snapshot holderów on-chain"
        : locale === "de"
          ? "On-Chain-Holder-Snapshot"
          : "on-chain holder snapshot",
    );
  if (result.metrics.simulatedSlippage10k === undefined)
    missing.push(
      locale === "pl"
        ? "slippage z orderbooka"
        : locale === "de"
          ? "Orderbook-Slippage"
          : "order-book slippage",
    );
  const sourceContract =
    locale === "pl"
      ? `Kontrakt źródłowy: ${sources.length ? sources.join(" · ") : "wymagane źródło pierwotne"}. Wniosek nie może być mocniejszy niż pokrycie tych danych.`
      : locale === "de"
        ? `Quellenvertrag: ${sources.length ? sources.join(" · ") : "Primärquelle erforderlich"}. Der Befund darf nicht stärker sein als die Datenabdeckung.`
        : `Source contract: ${sources.length ? sources.join(" · ") : "primary source required"}. The conclusion cannot be stronger than the attached evidence.`;
  const providerPlan = missing.length
    ? missing
        .slice(0, 4)
        .map((item) =>
          locale === "pl"
            ? `Podłącz: ${item}.`
            : locale === "de"
              ? `Anbinden: ${item}.`
              : `Attach: ${item}.`,
        )
    : [
        locale === "pl"
          ? "Dodaj drugi niezależny provider przed mocniejszym publicznym wnioskiem."
          : locale === "de"
            ? "Vor einem stärkeren öffentlichen Befund einen zweiten unabhängigen Provider anbinden."
            : "Attach a second independent provider before stronger public wording.",
      ];
  const consensusState: ShieldChatSourceContext["consensusState"] =
    sources.length >= 2 && result.dataQuality === "live"
      ? "aligned"
      : sources.length
        ? "single_source"
        : "unavailable";
  const confidenceCap =
    consensusState === "aligned"
      ? 90
      : consensusState === "single_source"
        ? 64
        : 20;
  const consensusNotes =
    consensusState === "aligned"
      ? [
          locale === "pl"
            ? "Co najmniej dwa źródła wspierają bieżący zakres faktów."
            : locale === "de"
              ? "Mindestens zwei Quellen stützen den aktuellen Faktenbereich."
              : "At least two sources support the current factual scope.",
        ]
      : consensusState === "single_source"
        ? [
            locale === "pl"
              ? "Jedno źródło ogranicza siłę wniosku i blokuje pełną pewność."
              : locale === "de"
                ? "Eine Quelle begrenzt die Aussage und blockiert volle Konfidenz."
                : "A single source limits the conclusion and blocks full confidence.",
          ]
        : [
            locale === "pl"
              ? "Brak źródła uniemożliwia konsensus providerów."
              : locale === "de"
                ? "Ohne Quelle ist kein Provider-Konsens möglich."
                : "No source means provider consensus is unavailable.",
          ];
  return {
    sourceContract,
    providerPlan,
    providerFacts: [
      {
        label:
          locale === "pl"
            ? "Jakość danych"
            : locale === "de"
              ? "Datenqualität"
              : "Data quality",
        value: result.dataQuality,
      },
      {
        label:
          locale === "pl" ? "Źródła" : locale === "de" ? "Quellen" : "Sources",
        value: sources.length
          ? sources.join(" · ")
          : humanMissingValue(locale, "data source"),
      },
      {
        label:
          locale === "pl"
            ? "Wygenerowano"
            : locale === "de"
              ? "Erzeugt"
              : "Generated",
        value: result.generatedAt,
      },
      {
        label:
          locale === "pl"
            ? "Dług dowodowy"
            : locale === "de"
              ? "Evidenzschuld"
              : "Evidence debt",
        value: missing.length ? String(missing.length) : "0",
      },
      {
        label:
          locale === "pl"
            ? "Konsensus"
            : locale === "de"
              ? "Konsens"
              : "Consensus",
        value: consensusState,
      },
    ],
    consensusState,
    confidenceCap,
    consensusNotes,
  };
}

export function buildShieldChatResponse(
  result: TokenRiskResult,
  history: HistoryLike = [],
  prompt = "Explain the current risk.",
  requestedLocale: string = "pl",
  sourceContext?: ShieldChatSourceContext,
): ShieldChatResponse {
  const locale = resolvePass446Locale(requestedLocale) as ShieldChatLocale;
  const c = copy[locale];
  const providerTruth =
    sourceContext ?? buildDefaultShieldSourceContext(result, locale);
  const mode = inferMode(prompt);
  const bot = buildAiRiskBotBrief(result, history);
  const holders = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const replay = buildRiskReplay(result, history);
  const dominantSignal = [...result.signals].sort(
    (a, b) => b.points - a.points,
  )[0];
  const worstStress = getWorstStressScenario(stress);
  const historyDelta =
    history.length >= 2
      ? Math.round(
          n(history.at(-1)?.score, result.score) -
            n(history[0]?.score, result.score),
        )
      : 0;
  const liquidityRaw = result.metrics.liquidityUsd;
  const marketCapRaw = result.metrics.marketCap;
  const liquidity = n(liquidityRaw);
  const marketCap = n(marketCapRaw);
  const liqCoverage =
    marketCap > 0 && liquidity > 0 ? (liquidity / marketCap) * 100 : undefined;
  const confidence = Math.min(
    providerTruth.confidenceCap,
    clamp(
      Math.round(n(result.confidence, 0.42) * 100) -
        (result.dataQuality === "demo"
          ? 18
          : result.dataQuality === "partial"
            ? 8
            : 0),
    ),
  );
  const sourceState: ShieldChatResponse["sourceState"] =
    result.dataQuality === "live" && confidence >= 65
      ? "source_bound"
      : result.dataQuality === "demo" || confidence < 35
        ? "source_required"
        : "partial";

  const baseCards: ShieldChatCard[] = [
    {
      label: c.riskScore,
      value: `${result.score}/100`,
      tone: tone(result.score),
      body: dominantSignal
        ? `${c.dominantSignal}: ${dominantSignal.id.replaceAll("_", " ")}.`
        : c.noDominantSignal,
    },
    {
      label: c.replayDelta,
      value: `${historyDelta > 0 ? "+" : ""}${historyDelta}`,
      tone: tone(Math.abs(historyDelta) * 6),
      body: `${c.replayPhase}: ${replay.dominantPhase}. ${c.acceleration}: ${replay.accelerationScore}/100.`,
    },
    {
      label: c.confidence,
      value: `${confidence}%`,
      tone: confidence < 45 ? "warning" : confidence < 65 ? "watch" : "low",
      body: `${c.dataQuality}: ${result.dataQuality}. ${c.missingVisible}`,
    },
  ];

  const modeCards: Record<ShieldChatResponse["mode"], ShieldChatCard[]> = {
    risk: [
      ...baseCards,
      {
        label: c.botVerdict,
        value: bot.verdict,
        tone: tone(result.score),
        body: bot.narrative,
      },
    ],
    holders: [
      {
        label: c.holderBrain,
        value: `${holders.holderRiskScore}/100`,
        tone: tone(holders.holderRiskScore),
        body: `${c.completeness}: ${holders.dataCompleteness}%. ${c.missing}: ${holders.missingData.length ? holders.missingData.join(", ") : c.noProxyMissing}.`,
      },
      ...holders.lanes.slice(0, 3).map((lane) => ({
        label: lane.label,
        value: lane.value || humanMissingValue(locale, lane.label),
        tone: tone(lane.score),
        body: lane.nextStep,
      })),
    ],
    liquidity: [
      {
        label: c.liquidity,
        value: money(liquidityRaw, locale, "liquidity"),
        tone:
          liqCoverage === undefined
            ? "watch"
            : tone(100 - Math.min(100, liqCoverage * 14)),
        body:
          liqCoverage === undefined
            ? c.liquidityCoverageMissing
            : replaceTokens(c.liquidityCoverage, {
                value: new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 2,
                }).format(liqCoverage),
              }),
      },
      {
        label: c.worstStress,
        value: worstStress
          ? `${worstStress.score}/100`
          : humanMissingValue(locale, "stress scenario"),
        tone: worstStress ? tone(worstStress.score) : "neutral",
        body: worstStress
          ? `${worstStress.label}: ${worstStress.nextStep}`
          : c.stressMissing,
      },
      {
        label: c.volume24h,
        value: money(result.metrics.volume24h, locale, "volume"),
        tone: tone(n(result.metrics.volumeToMarketCapRatio) * 180),
        body: `${c.volumeContext}: ${pct(result.metrics.volumeToMarketCapRatio !== undefined ? result.metrics.volumeToMarketCapRatio * 100 : undefined, locale, "volume / market cap")}.`,
      },
    ],
    candles: [
      {
        label: "1h",
        value: pct(result.metrics.priceChange1h, locale, "price change 1h"),
        tone: tone(Math.abs(n(result.metrics.priceChange1h)) * 5),
        body: c.micro,
      },
      {
        label: "24h",
        value: pct(result.metrics.priceChange24h, locale, "price change 24h"),
        tone: tone(Math.abs(n(result.metrics.priceChange24h)) * 4),
        body: c.day,
      },
      {
        label: "7d",
        value: pct(result.metrics.priceChange7d, locale, "price change 7d"),
        tone: tone(Math.abs(n(result.metrics.priceChange7d)) * 2.5),
        body: c.week,
      },
    ],
    evidence: [
      ...baseCards,
      {
        label: c.caseLanguage,
        value: c.anomalyReview,
        tone: "neutral",
        body: c.caseBody,
      },
    ],
    general: [
      ...baseCards,
      {
        label: c.bestQuestion,
        value: bot.nextQuestion,
        tone: "neutral",
        body: c.bestQuestionBody,
      },
    ],
  };

  const nextActionsByMode: Record<ShieldChatResponse["mode"], string[]> = {
    risk: [...c.riskActions],
    holders: holders.nextActions.slice(0, 3),
    liquidity: [...c.liquidityActions],
    candles: [...c.candlesActions],
    evidence: [...c.evidenceActions],
    general: bot.commands.slice(0, 3).map((command) => command.label),
  };

  const symbol = result.token.symbol;
  const headlineByMode: Record<ShieldChatResponse["mode"], string> = {
    risk: replaceTokens(c.riskHeadline, { symbol }),
    holders: replaceTokens(c.holdersHeadline, { symbol }),
    liquidity: replaceTokens(c.liquidityHeadline, { symbol }),
    candles: replaceTokens(c.candlesHeadline, { symbol }),
    evidence: replaceTokens(c.evidenceHeadline, { symbol }),
    general: replaceTokens(c.generalHeadline, { symbol }),
  };

  return {
    prompt,
    mode,
    headline: headlineByMode[mode],
    answer:
      mode === "holders"
        ? replaceTokens(c.holdersAnswer, {
            verdict: holders.verdict,
            completeness: holders.dataCompleteness,
          })
        : mode === "liquidity"
          ? replaceTokens(c.liquidityAnswer, {
              liquidity: money(liquidityRaw, locale, "liquidity"),
            })
          : mode === "candles"
            ? replaceTokens(c.candlesAnswer, {
                h1: pct(
                  result.metrics.priceChange1h,
                  locale,
                  "price change 1h",
                ),
                h24: pct(
                  result.metrics.priceChange24h,
                  locale,
                  "price change 24h",
                ),
                d7: pct(
                  result.metrics.priceChange7d,
                  locale,
                  "price change 7d",
                ),
              })
            : mode === "evidence"
              ? c.evidenceAnswer
              : bot.narrative,
    cards: modeCards[mode],
    nextActions: nextActionsByMode[mode],
    guardrails: [...c.guardrails],
    confidence,
    sourceState,
    sourceContract: providerTruth.sourceContract,
    providerPlan: providerTruth.providerPlan,
    providerFacts: providerTruth.providerFacts,
    consensusState: providerTruth.consensusState,
    confidenceCap: providerTruth.confidenceCap,
    consensusNotes: providerTruth.consensusNotes,
  };
}
