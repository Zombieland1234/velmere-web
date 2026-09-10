import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderFamilies,
} from "@/lib/ai/evidence-normalization";

export type Pass452Locale = "pl" | "de" | "en";
export type Pass452InsightState = "confirmed" | "review" | "source_required";

export type Pass452SignatureInsight = {
  id: string;
  label: string;
  value: string;
  explanation: string;
  state: Pass452InsightState;
};

export type Pass452SourceBoundDepthLab = {
  version: "source-bound-depth-lab-runtime";
  locale: Pass452Locale;
  headline: string;
  humanSummary: string;
  sourcePolicy: string;
  tierPromises: {
    basic: string;
    pro: string;
    advanced: string;
  };
  signatureInsights: Pass452SignatureInsight[];
  browserQaContract: {
    suggestionLimit: 3;
    forgeStages: 4;
    previewDownloadSameBlob: true;
    backgroundScrollLocked: true;
    downloadIconRequired: true;
    localeBranches: readonly ["pl", "de", "en"];
  };
  realMarketsCoverage: {
    assetClasses: readonly ["crypto", "stocks", "indices", "fx", "etf", "commodities", "real_estate", "exchanges"];
    venueLanes: readonly ["Binance", "MEXC", "OKX", "Kraken", "Bybit"];
    dynamicSymbolSearch: true;
    noFakeVenuePrice: true;
  };
};

function localeOf(locale: string): Pass452Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pct(locale: Pass452Locale, value?: number, digits = 2) {
  if (!finite(value)) return null;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)}%`;
}

function copy(locale: Pass452Locale) {
  if (locale === "de") {
    return {
      headline: "Quellengebundene Analyse mit echter Tiefenstaffelung",
      summary: "Basic beantwortet die Marktgrundlagen. Pro prüft Dynamik und Quellenqualität. Advanced öffnet Ausführung, Angebotsdruck, Quorum und ungewöhnliche Abweichungen.",
      sourcePolicy: "Kein nacktes unknown: jedes leere Feld nennt die fehlende Quelle und begrenzt die Aussagekraft.",
      sourceRequired: "Quelle erforderlich",
      basic: "Preis, Market Cap, 24h, Volumen, Zeitstempel und Quellenkonfidenz.",
      pro: "FDV-Lücke, Turnover, 1h/7d, Zweitprovider, Freshness und Evidenzlücken.",
      advanced: "Liquidität, Slippage, Float, Holder-Konzentration, Unlock-Druck, Quorum, Lineage und nächste Probe.",
      labels: {
        turnover: "Volumen / Market Cap",
        fdvGap: "FDV-Aufschlag",
        range: "24h-Amplitude",
        quorum: "Quellenquorum",
        circulation: "Umlaufquote",
        confidence: "Konfidenzobergrenze",
        freshness: "Freshness-Drift",
        nextProbe: "Nächste Beweisprobe",
      },
    } as const;
  }
  if (locale === "en") {
    return {
      headline: "Source-bound analysis with real depth tiers",
      summary: "Basic answers market essentials. Pro audits dynamics and source quality. Advanced opens execution, supply pressure, quorum and unusual divergence lanes.",
      sourcePolicy: "No bare unknown: every empty field names the missing source and caps the claim strength.",
      sourceRequired: "Source required",
      basic: "Price, market cap, 24h move, volume, timestamp and source confidence.",
      pro: "FDV gap, turnover, 1h/7d, second provider, freshness and evidence gaps.",
      advanced: "Liquidity, slippage, float, holder concentration, unlock pressure, quorum, lineage and next-best probe.",
      labels: {
        turnover: "Volume / market cap",
        fdvGap: "FDV premium",
        range: "24h amplitude",
        quorum: "Source quorum",
        circulation: "Circulating ratio",
        confidence: "Confidence ceiling",
        freshness: "Freshness drift",
        nextProbe: "Next evidence probe",
      },
    } as const;
  }
  return {
    headline: "Analiza związana ze źródłami i prawdziwą głębokością",
    summary: "Basic odpowiada na podstawowe pytania rynku. Pro bada dynamikę i jakość źródeł. Advanced otwiera wykonanie, presję podaży, quorum i nietypowe rozbieżności.",
    sourcePolicy: "Koniec z gołym unknown: każde puste pole mówi, jakiego źródła brakuje i jak mocno ogranicza to wniosek.",
    sourceRequired: "Wymaga źródła",
    basic: "Cena, kapitalizacja, 24h, wolumen, timestamp i pewność źródeł.",
    pro: "Luka FDV, turnover, 1h/7d, drugi provider, świeżość i luki dowodowe.",
    advanced: "Płynność, slippage, float, koncentracja holderów, unlock pressure, quorum, lineage i następna próba dowodowa.",
    labels: {
      turnover: "Wolumen / kapitalizacja",
      fdvGap: "Premia FDV",
      range: "Amplituda 24h",
      quorum: "Quorum źródeł",
      circulation: "Udział podaży w obiegu",
      confidence: "Sufit pewności",
      freshness: "Dryf świeżości",
      nextProbe: "Następna próba dowodowa",
    },
  } as const;
}

function insight(
  id: string,
  label: string,
  value: string | null,
  explanation: string,
  sourceRequired: string,
  state: Pass452InsightState = "review",
): Pass452SignatureInsight {
  return {
    id,
    label,
    value: value || sourceRequired,
    explanation,
    state: value ? state : "source_required",
  };
}

export function buildPass452SourceBoundDepthLab(
  result: VelmereSearchResult,
  locale: string,
  options: { nowMs?: number } = {},
): Pass452SourceBoundDepthLab {
  const safeLocale = localeOf(locale);
  const c = copy(safeLocale);
  const snapshot = result.marketSnapshot;
  const sourceCount = independentLiveProviderFamilies(result.sources).length;
  const turnover = finite(snapshot?.volume24h) && finite(snapshot?.marketCap) && snapshot!.marketCap! > 0
    ? pct(safeLocale, (snapshot!.volume24h! / snapshot!.marketCap!) * 100)
    : null;
  const fdvGap = finite(snapshot?.fdv) && finite(snapshot?.marketCap) && snapshot!.marketCap! > 0
    ? pct(safeLocale, ((snapshot!.fdv! / snapshot!.marketCap!) - 1) * 100)
    : null;
  const range = finite(snapshot?.high24h) && finite(snapshot?.low24h) && finite(snapshot?.price) && snapshot!.price! > 0
    ? pct(safeLocale, ((snapshot!.high24h! - snapshot!.low24h!) / snapshot!.price!) * 100)
    : null;
  const circulation = finite(snapshot?.circulatingSupply) && finite(snapshot?.totalSupply) && snapshot!.totalSupply! > 0
    ? pct(safeLocale, (snapshot!.circulatingSupply! / snapshot!.totalSupply!) * 100)
    : null;
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, { nowMs: options.nowMs });
  const freshnessMinutes = timestamp.ageMinutes;
  const freshnessPenalty = timestamp.state === "fresh"
    ? 0
    : timestamp.state === "aging"
      ? 4
      : timestamp.state === "stale"
        ? 8
        : 12;
  const confidenceCeiling = Math.max(
    0,
    Math.min(
      100,
      Math.round(result.sourceConfidence - Math.max(0, 2 - sourceCount) * 12 - Math.min(24, result.missingData.length * 4) - freshnessPenalty),
    ),
  );
  const nextProbe = result.missingData[0] || result.nextOperatorStep;

  const insights: Pass452SignatureInsight[] = [
    insight("turnover", c.labels.turnover, turnover, safeLocale === "pl" ? "Pokazuje, jak duży obrót przechodzi przez aktywo względem jego skali." : safeLocale === "de" ? "Zeigt den Handelsumsatz relativ zur Marktgröße." : "Shows trading activity relative to the asset scale.", c.sourceRequired),
    insight("fdvGap", c.labels.fdvGap, fdvGap, safeLocale === "pl" ? "Wysoka różnica FDV do kapitalizacji może sygnalizować przyszłą presję podaży." : safeLocale === "de" ? "Eine hohe FDV-Lücke kann zukünftigen Angebotsdruck markieren." : "A high FDV gap can flag future supply pressure.", c.sourceRequired),
    insight("range", c.labels.range, range, safeLocale === "pl" ? "Amplituda oddziela spokojny handel od gwałtownego zakresu bez zgadywania kierunku." : safeLocale === "de" ? "Die Amplitude trennt ruhigen Handel von breiten Bewegungen ohne Richtungsraten." : "Amplitude separates calm trading from wide movement without guessing direction.", c.sourceRequired),
    insight("quorum", c.labels.quorum, `${sourceCount}/2`, safeLocale === "pl" ? "Dwa niezależne źródła są minimalnym progiem mocniejszego języka live." : safeLocale === "de" ? "Zwei unabhängige Quellen sind die Mindestschwelle für stärkere Live-Aussagen." : "Two independent sources are the minimum threshold for stronger live wording.", c.sourceRequired, sourceCount >= 2 ? "confirmed" : "review"),
    insight("circulation", c.labels.circulation, circulation, safeLocale === "pl" ? "Pokazuje, jaka część podaży jest już na rynku i może realnie uczestniczyć w obrocie." : safeLocale === "de" ? "Zeigt, welcher Angebotsanteil bereits im Markt zirkuliert." : "Shows how much supply already circulates in the market.", c.sourceRequired),
    insight("confidence", c.labels.confidence, `${confidenceCeiling}%`, safeLocale === "pl" ? "Sufit obniża pewność za brak drugiego źródła i luki dowodowe." : safeLocale === "de" ? "Die Obergrenze reduziert Konfidenz bei fehlender Zweitquelle und Evidenzlücken." : "The ceiling reduces confidence for missing second-source and evidence gaps.", c.sourceRequired, confidenceCeiling >= 65 ? "confirmed" : "review"),
    insight("freshness", c.labels.freshness, freshnessMinutes === null ? null : `${freshnessMinutes} min`, safeLocale === "pl" ? "Stary timestamp nie może udawać danych live." : safeLocale === "de" ? "Ein alter Zeitstempel darf keine Live-Daten vortäuschen." : "An old timestamp cannot masquerade as live data.", c.sourceRequired, freshnessMinutes !== null && freshnessMinutes <= 15 ? "confirmed" : "review"),
    insight("nextProbe", c.labels.nextProbe, nextProbe, safeLocale === "pl" ? "Mózg wskazuje konkretną następną czynność zamiast zasypywać użytkownika debugiem." : safeLocale === "de" ? "Das Brain nennt die nächste konkrete Prüfung statt Debug-Rauschen." : "The brain names the next concrete check instead of dumping debug noise.", c.sourceRequired),
  ];

  return {
    version: "source-bound-depth-lab-runtime",
    locale: safeLocale,
    headline: c.headline,
    humanSummary: c.summary,
    sourcePolicy: c.sourcePolicy,
    tierPromises: { basic: c.basic, pro: c.pro, advanced: c.advanced },
    signatureInsights: insights,
    browserQaContract: {
      suggestionLimit: 3,
      forgeStages: 4,
      previewDownloadSameBlob: true,
      backgroundScrollLocked: true,
      downloadIconRequired: true,
      localeBranches: ["pl", "de", "en"],
    },
    realMarketsCoverage: {
      assetClasses: ["crypto", "stocks", "indices", "fx", "etf", "commodities", "real_estate", "exchanges"],
      venueLanes: ["Binance", "MEXC", "OKX", "Kraken", "Bybit"],
      dynamicSymbolSearch: true,
      noFakeVenuePrice: true,
    },
  };
}

export const pass452SourceBoundDepthLabRuntime = {
  id: "PASS452",
  title: "Source-Bound Depth Lab + Browser QA",
  fieldBudgets: { basic: 10, pro: 14, advanced: 20 },
  browser: { suggestions: 3, forgeStages: 4, sameBlobPreviewDownload: true, hardScrollLock: true },
  coverage: { dynamicSearch: true, venueHealthSeparatedFromEquityPrice: true },
  rules: [
    "Advanced diagnostics must remain source-bound.",
    "A missing value names the missing source instead of rendering bare unknown.",
    "Preview and download use the same generated PDF blob.",
    "Real Markets keeps venue-health lanes separate from listed-equity quotes.",
  ],
} as const;
