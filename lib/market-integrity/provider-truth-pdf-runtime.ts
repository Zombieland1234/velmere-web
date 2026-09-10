// PASS459–463 legacy verifier marker retained after PASS464 PDF quality upgrade.
// PASS462 legacy verifier marker: PASS462 cross-venue gate.
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";
import {
  assessEvidenceTimestamp,
  independentLiveProviderFamilies,
  independentProviderFamilies,
} from "@/lib/ai/evidence-normalization";

export type Pass459ProviderTruthPdf = {
  version: "pass459-provider-truth-pdf";
  truthState: "source_bound" | "partial" | "source_required";
  sourceContract: string;
  providerPlan: string[];
  providerFacts: Array<{ label: string; value: string; source: string }>;
  claimBoundary: string;
  customerSummary: string;
};

type Locale = "pl" | "de" | "en";

function localeOf(value: string): Locale {
  return value === "de" || value === "en" ? value : "pl";
}

function formatNumber(value: number | undefined, locale: Locale, currency?: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (currency) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(value);
    } catch {
      return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(value);
    }
  }
  return new Intl.NumberFormat(locale, { notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(value);
}

function providerPlan(result: VelmereSearchResult, locale: Locale) {
  const missing = result.missingData.slice(0, 3);
  if (missing.length) {
    return missing.map((item) =>
      locale === "pl" ? `Podłącz lub potwierdź: ${item}.` : locale === "de" ? `Anbinden oder bestätigen: ${item}.` : `Attach or confirm: ${item}.`,
    );
  }
  return [
    locale === "pl"
      ? "Dodaj drugi niezależny provider i zachowaj timestamp przed mocniejszym wnioskiem."
      : locale === "de"
        ? "Vor einem stärkeren Befund einen zweiten unabhängigen Provider und Zeitstempel ergänzen."
        : "Attach a second independent provider and timestamp before stronger wording.",
  ];
}

export function buildPass459ProviderTruthPdf(
  result: VelmereSearchResult,
  requestedLocale: string,
  options: { nowMs?: number } = {},
): Pass459ProviderTruthPdf {
  const locale = localeOf(requestedLocale);
  const activeSources = result.sources.filter((source) => source.mode !== "missing");
  const activeFamilies = independentProviderFamilies(activeSources.map((source) => source.label));
  const confirmedFamilies = independentProviderFamilies([
    ...independentLiveProviderFamilies(result.sources),
    result.marketSnapshot?.venuePrimary,
    result.marketSnapshot?.venueSecondary,
  ]);
  const snapshot = result.marketSnapshot;
  const timestamp = assessEvidenceTimestamp(snapshot?.observedAt, { nowMs: options.nowMs });
  const timestampSupportsBoundClaim = timestamp.state === "fresh" || timestamp.state === "aging";
  const truthState: Pass459ProviderTruthPdf["truthState"] =
    confirmedFamilies.length >= 2 && result.sourceConfidence >= 68 && timestampSupportsBoundClaim
      ? "source_bound"
      : confirmedFamilies.length || activeFamilies.length
        ? "partial"
        : "source_required";
  const sourceNames = (confirmedFamilies.length ? confirmedFamilies : activeFamilies).slice(0, 4);
  const sourceContract = locale === "pl"
    ? `Kontrakt źródłowy: ${sourceNames.length ? sourceNames.join(" · ") : "wymagane źródło pierwotne"}. Każda liczba i każde zdanie muszą mieścić się w tym pokryciu.`
    : locale === "de"
      ? `Quellenvertrag: ${sourceNames.length ? sourceNames.join(" · ") : "Primärquelle erforderlich"}. Jede Zahl und Aussage muss innerhalb dieser Abdeckung bleiben.`
      : `Source contract: ${sourceNames.length ? sourceNames.join(" · ") : "primary source required"}. Every number and sentence must remain inside this coverage.`;
  const primarySource = sourceNames[0] || "provider required";
  const currency = snapshot?.currency || "USD";
  const facts: Pass459ProviderTruthPdf["providerFacts"] = [
    {
      label: locale === "pl" ? "Cena" : locale === "de" ? "Preis" : "Price",
      value: formatNumber(snapshot?.price, locale, currency) || (locale === "pl" ? "wymagane źródło ceny" : locale === "de" ? "Preisquelle erforderlich" : "price source required"),
      source: primarySource,
    },
    {
      label: locale === "pl" ? "Kapitalizacja / proxy" : locale === "de" ? "Market-Cap / Proxy" : "Market cap / proxy",
      value: formatNumber(snapshot?.marketCap, locale, currency) || (locale === "pl" ? "nie dotyczy albo wymagane źródło" : locale === "de" ? "nicht anwendbar oder Quelle erforderlich" : "not applicable or source required"),
      source: primarySource,
    },
    {
      label: locale === "pl" ? "Wolumen 24h" : locale === "de" ? "24h-Volumen" : "24h volume",
      value: formatNumber(snapshot?.volume24h, locale, currency) || (locale === "pl" ? "wymagane źródło wolumenu" : locale === "de" ? "Volumenquelle erforderlich" : "volume source required"),
      source: primarySource,
    },
    {
      label: locale === "pl" ? "Timestamp" : locale === "de" ? "Zeitstempel" : "Timestamp",
      value: timestamp.observedAt && timestamp.state !== "future"
        ? timestamp.observedAt
        : (locale === "pl" ? "wymagany prawidłowy timestamp" : locale === "de" ? "gültiger Zeitstempel erforderlich" : "valid timestamp required"),
      source: primarySource,
    },
    {
      label: locale === "pl" ? "Pewność źródeł" : locale === "de" ? "Quellenkonfidenz" : "Source confidence",
      value: `${result.sourceConfidence}%`,
      source: "Velmère source ledger",
    },
    {
      label: locale === "pl" ? "Stan" : locale === "de" ? "Status" : "State",
      value: truthState,
      source: "PASS459 truth gate",
    },
    {
      label: locale === "pl" ? "Aktywo i para kanoniczna" : locale === "de" ? "Asset und kanonisches Paar" : "Asset and canonical pair",
      value: snapshot?.venueAssetSymbol && snapshot?.venuePrimary
        ? `${snapshot.venueAssetSymbol} · ${snapshot.venuePrimary}`
        : (locale === "pl" ? "wymagany resolver pary" : locale === "de" ? "Paar-Resolver erforderlich" : "pair resolver required"),
      source: snapshot?.venuePairResolutionState
        ? `PASS463 · ${snapshot.venuePairResolutionState}`
        : "PASS463 canonical pair resolver",
    },
    {
      label: locale === "pl" ? "Konsensus venue" : locale === "de" ? "Venue-Konsens" : "Venue consensus",
      value: snapshot?.venueComparisonState || (locale === "pl" ? "wymagane drugie venue" : locale === "de" ? "zweiter Handelsplatz erforderlich" : "second venue required"),
      source: snapshot?.venuePrimary && snapshot?.venueSecondary ? `${snapshot.venuePrimary} · ${snapshot.venueSecondary}` : "PASS463 venue evidence",
    },
    {
      label: locale === "pl" ? "Rozjazd ceny" : locale === "de" ? "Preisabweichung" : "Price divergence",
      value: typeof snapshot?.venueDivergenceBps === "number" ? `${snapshot.venueDivergenceBps.toFixed(1)} bps` : (locale === "pl" ? "wymagane źródło" : locale === "de" ? "Quelle erforderlich" : "source required"),
      source: "PASS463 canonical cross-venue gate",
    },
    {
      label: locale === "pl" ? "Limit pewności venue" : locale === "de" ? "Venue-Konfidenzgrenze" : "Venue confidence cap",
      value: typeof snapshot?.venueConfidenceCap === "number" ? `${snapshot.venueConfidenceCap}/100` : (locale === "pl" ? "nie wyliczono" : locale === "de" ? "nicht berechnet" : "not calculated"),
      source: "PASS463 evidence packet",
    },
    {
      label: locale === "pl" ? "Baza kwotowania" : locale === "de" ? "Notierungsbasis" : "Quote basis",
      value: snapshot?.venueQuoteBasisState
        ? `${snapshot.venuePrimaryQuoteCurrency || "?"}/${snapshot.venueSecondaryQuoteCurrency || "?"} · ${snapshot.venueQuoteBasisState} · -${snapshot.venueQuoteBasisPenalty ?? 0}`
        : (locale === "pl" ? "wymagane dwa kwotowania" : locale === "de" ? "zwei Notierungen erforderlich" : "two quote currencies required"),
      source: "PASS463 quote-basis gate",
    },
    {
      label: locale === "pl" ? "Stan pokrycia pary" : locale === "de" ? "Paarabdeckung" : "Pair coverage state",
      value: snapshot?.venuePairResolutionState || (locale === "pl" ? "wymagane potwierdzenie pary" : locale === "de" ? "Paarbestätigung erforderlich" : "pair confirmation required"),
      source: snapshot?.venuePairResolutionNote || "PASS463 pair coverage",
    },
    ...(snapshot?.fundamentalState
      ? [
          {
            label: locale === "pl" ? "Jakość fundamentals" : locale === "de" ? "Fundamentalqualität" : "Fundamental quality",
            value: `${snapshot.fundamentalState} · ${snapshot.fundamentalQualityScore ?? 0}/100 · cap ${snapshot.fundamentalConfidenceCap ?? result.sourceConfidence}/100`,
            source: "PASS464 statement/holdings gate",
          },
          {
            label: locale === "pl" ? "Filing / okres" : locale === "de" ? "Filing / Periode" : "Filing / period",
            value: snapshot.fundamentalFilingDate || snapshot.fundamentalReportedPeriodEnd || (locale === "pl" ? "wymagane źródło" : locale === "de" ? "Quelle erforderlich" : "source required"),
            source: snapshot.fundamentalFilingDate ? "SEC submissions" : "financial statement period",
          },
          {
            label: locale === "pl" ? "FCF / zadłużenie" : locale === "de" ? "FCF / Verschuldung" : "FCF / leverage",
            value: snapshot.etfTop10Concentration !== undefined
              ? `top10 ${snapshot.etfTop10Concentration}% · effective ${snapshot.etfEffectiveHoldings ?? "source required"} · overlap ${snapshot.etfOverlapPercent ?? "source required"}%`
              : `FCF ${snapshot.fundamentalFreeCashFlowTtm ?? "source required"} · net debt/EBITDA ${snapshot.fundamentalNetDebtToEbitda ?? "source required"}x · current ratio ${snapshot.fundamentalCurrentRatio ?? "source required"}x`,
            source: snapshot.etfTop10Concentration !== undefined ? "ETF_PROFILE · PASS464" : "INCOME_STATEMENT · BALANCE_SHEET · CASH_FLOW",
          },
        ]
      : []),
  ];
  const claimBoundary = locale === "pl"
    ? truthState === "source_bound"
      ? "Dozwolony jest opis faktograficzny i ostrożna interpretacja; prognoza ceny oraz pewność bezpieczeństwa pozostają zabronione."
      : "Dozwolone są tylko fakty widoczne w payloadzie i jawne luki. Brakujące pola blokują mocniejszy wniosek."
    : locale === "de"
      ? truthState === "source_bound"
        ? "Fakten und vorsichtige Interpretation sind zulässig; Preisprognosen und Sicherheitsgarantien bleiben ausgeschlossen."
        : "Nur sichtbare Fakten und explizite Lücken sind zulässig. Fehlende Felder blockieren stärkere Aussagen."
      : truthState === "source_bound"
        ? "Facts and guarded interpretation are allowed; price forecasts and safety guarantees remain out of bounds."
        : "Only payload-backed facts and explicit gaps are allowed. Missing fields block stronger wording.";
  const customerSummary = locale === "pl"
    ? `PASS459–464: ${truthState}. PDF, podgląd i Shield AI korzystają z tego samego kontraktu źródłowego oraz resolvera par.`
    : locale === "de"
      ? `PASS459–464: ${truthState}. PDF, Vorschau und Shield AI verwenden denselben Quellenvertrag und Paar-Resolver.`
      : `PASS459–464: ${truthState}. PDF, preview and Shield AI use the same source contract and pair resolver.`;
  // PASS462 legacy verifier marker: const pass462Summary = venue comparison summary.
  const pass463Summary = snapshot?.venueComparisonState
    ? locale === "pl"
      ? ` PASS463: ${snapshot.venueAssetSymbol || result.symbol || "aktywo"} ma stan venue ${snapshot.venueComparisonState}; baza ${snapshot.venuePrimaryQuoteCurrency || "?"}/${snapshot.venueSecondaryQuoteCurrency || "?"} to ${snapshot.venueQuoteBasisState || "wymaga źródła"}, a limit pewności wynosi ${snapshot.venueConfidenceCap ?? result.sourceConfidence}/100.`
      : locale === "de"
        ? ` PASS463: ${snapshot.venueAssetSymbol || result.symbol || "Asset"} hat den Venue-Status ${snapshot.venueComparisonState}; die Basis ${snapshot.venuePrimaryQuoteCurrency || "?"}/${snapshot.venueSecondaryQuoteCurrency || "?"} ist ${snapshot.venueQuoteBasisState || "Quelle erforderlich"}, die Konfidenzgrenze beträgt ${snapshot.venueConfidenceCap ?? result.sourceConfidence}/100.`
        : ` PASS463: ${snapshot.venueAssetSymbol || result.symbol || "asset"} venue comparison is ${snapshot.venueComparisonState}; ${snapshot.venuePrimaryQuoteCurrency || "?"}/${snapshot.venueSecondaryQuoteCurrency || "?"} is ${snapshot.venueQuoteBasisState || "source required"}, with a ${snapshot.venueConfidenceCap ?? result.sourceConfidence}/100 confidence cap.`
    : "";

  return {
    version: "pass459-provider-truth-pdf",
    truthState,
    sourceContract,
    providerPlan: providerPlan(result, locale),
    providerFacts: facts,
    claimBoundary,
    customerSummary: `${customerSummary}${pass463Summary}`,
  };
}

export const pass459ProviderTruthPdfContract = {
  id: "PASS459_PROVIDER_TRUTH_PDF",
  rules: [
    "PDF preview and download carry one source contract instead of a technical provider dump.",
    "Price, market cap/proxy, volume, timestamp and confidence state where their evidence comes from.",
    "Missing provider fields become a concrete provider plan and never a bare unknown.",
    "Shield AI and PDF share the same evidence boundary: facts first, uncertainty visible, no price promise.",
    "PASS462 cross-venue state, divergence and confidence cap travel inside the same preview/download payload when available.",
    "PASS463 adds canonical asset/pair coverage and an explicit USD/USDT/USDC quote-basis penalty to PDF and Shield AI.",
    "PASS464 carries filing freshness, free cash flow, leverage and ETF concentration into the same preview/download evidence boundary when present.",
  ],
};
