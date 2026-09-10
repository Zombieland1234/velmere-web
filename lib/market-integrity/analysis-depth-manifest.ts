import type { UnifiedAuditLocale, UnifiedAuditMode } from "@/lib/market-integrity/unified-audit";

export type Pass484DepthManifest = {
  mode: UnifiedAuditMode;
  fieldBudget: 10 | 14 | 20;
  purpose: string;
  includes: string[];
  excludes: string[];
  confidenceRule: string;
};

const manifests: Record<UnifiedAuditLocale, Record<UnifiedAuditMode, Pass484DepthManifest>> = {
  pl: {
    basic: {
      mode: "basic",
      fieldBudget: 10,
      purpose: "Szybki, czytelny obraz sytuacji bez przeciążenia użytkownika.",
      includes: ["cena i zmiana", "kapitalizacja lub właściwy proxy", "wolumen i płynność", "ryzyko", "źródła i świeżość"],
      excludes: ["prognozy ceny", "porada inwestycyjna", "wartości bez źródła"],
      confidenceRule: "Pewność nie może przekroczyć jakości i świeżości najsłabszego kluczowego źródła.",
    },
    pro: {
      mode: "pro",
      fieldBudget: 14,
      purpose: "Ocena jakości rynku, dynamiki i konfliktów między źródłami.",
      includes: ["świece i dynamika 1h/7d", "FDV i turnover", "drugi provider", "luki danych", "zmienność i koncentracja"],
      excludes: ["prognozy ceny", "ukrywanie braków", "automatyczny werdykt bez dowodów"],
      confidenceRule: "Konflikt źródeł lub starzenie danych automatycznie obniża limit pewności.",
    },
    advanced: {
      mode: "advanced",
      fieldBudget: 20,
      purpose: "Pełny audyt struktury rynku, odporności, anomalii i ryzyka drugiego rzędu.",
      includes: ["slippage i asymetria depth", "venue health", "source lineage", "koncentracja i podaż", "scenariusze stresowe", "czego model nie wie"],
      excludes: ["gwarancje wyniku", "zmyślone metryki", "pewność wyższą niż pozwalają dowody"],
      confidenceRule: "Wniosek pozostaje warunkowy i musi wskazać dane, które mogłyby zmienić ocenę.",
    },
  },
  de: {
    basic: {
      mode: "basic", fieldBudget: 10,
      purpose: "Schneller, verständlicher Überblick ohne Informationsüberlastung.",
      includes: ["Preis und Änderung", "Market-Cap oder passender Proxy", "Volumen und Liquidität", "Risiko", "Quellen und Freshness"],
      excludes: ["Preisprognosen", "Anlageberatung", "Werte ohne Quelle"],
      confidenceRule: "Die Konfidenz darf die Qualität und Freshness der schwächsten Kernquelle nicht übersteigen.",
    },
    pro: {
      mode: "pro", fieldBudget: 14,
      purpose: "Bewertung von Marktqualität, Dynamik und Quellenkonflikten.",
      includes: ["Kerzen und 1h/7d-Dynamik", "FDV und Turnover", "Zweitprovider", "Datenlücken", "Volatilität und Konzentration"],
      excludes: ["Preisprognosen", "verdeckte Lücken", "Urteil ohne Evidenz"],
      confidenceRule: "Quellenkonflikte oder alternde Daten senken das Konfidenzlimit automatisch.",
    },
    advanced: {
      mode: "advanced", fieldBudget: 20,
      purpose: "Vollständiger Audit von Marktstruktur, Resilienz, Anomalien und Sekundärrisiken.",
      includes: ["Slippage und Depth-Asymmetrie", "Venue Health", "Source Lineage", "Konzentration und Supply", "Stressszenarien", "Unbekannte des Modells"],
      excludes: ["Ergebnisgarantien", "erfundene Metriken", "Konfidenz über der Evidenz"],
      confidenceRule: "Der Schluss bleibt bedingt und nennt Daten, die die Bewertung verändern könnten.",
    },
  },
  en: {
    basic: {
      mode: "basic", fieldBudget: 10,
      purpose: "A fast, readable situation overview without information overload.",
      includes: ["price and move", "market cap or correct proxy", "volume and liquidity", "risk", "sources and freshness"],
      excludes: ["price forecasts", "investment advice", "unsourced values"],
      confidenceRule: "Confidence cannot exceed the quality and freshness of the weakest key source.",
    },
    pro: {
      mode: "pro", fieldBudget: 14,
      purpose: "Assessment of market quality, dynamics and source disagreement.",
      includes: ["candles and 1h/7d dynamics", "FDV and turnover", "second provider", "data gaps", "volatility and concentration"],
      excludes: ["price forecasts", "hidden gaps", "automatic verdicts without evidence"],
      confidenceRule: "Source conflict or aging data automatically lowers the confidence cap.",
    },
    advanced: {
      mode: "advanced", fieldBudget: 20,
      purpose: "A full audit of market structure, resilience, anomalies and second-order risk.",
      includes: ["slippage and depth asymmetry", "venue health", "source lineage", "concentration and supply", "stress scenarios", "what the model does not know"],
      excludes: ["outcome guarantees", "invented metrics", "confidence above the evidence"],
      confidenceRule: "The conclusion remains conditional and identifies data that could change the assessment.",
    },
  },
};

export function getPass484AnalysisDepthManifest(locale: UnifiedAuditLocale, mode: UnifiedAuditMode) {
  return manifests[locale][mode];
}
