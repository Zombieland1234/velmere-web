export type Pass446Locale = "pl" | "de" | "en";
export type Pass446Depth = "basic" | "pro" | "advanced";

export type Pass446HumanReadoutContract = {
  version: "pass446-human-readout-lane";
  locale: Pass446Locale;
  depthBudget: Record<Pass446Depth, number>;
  activeDepth: Pass446Depth;
  headline: string;
  customerPromise: string;
  requiredFields: string[];
  nonNegotiableMissingFields: string[];
  pdfSections: string[];
  uiMarkers: string[];
  unknownPolicy: "explain_missing_in_human_language";
};

const copy = {
  pl: {
    headline: "Human readout bez unknown-spamu",
    promise: "Basic pokazuje rynek wprost, Pro dopina jakość źródeł, Advanced otwiera pełną matrycę dowodów bez udawania live.",
    required: ["cena", "kapitalizacja/proxy", "zmiana 24h", "wolumen", "źródło", "timestamp", "drugi provider", "luki danych"],
    missing: ["drugi provider", "orderbook/depth", "holder/issuer context", "status adaptera venue"],
    sections: ["Brief", "Dane rynku", "Luki", "Drugi provider", "Następny krok", "Podpis Velmère"],
  },
  de: {
    headline: "Human Readout ohne Unknown-Spam",
    promise: "Basic zeigt den Markt klar, Pro prüft Quellenqualität, Advanced öffnet die vollständige Evidenzmatrix ohne Fake-Live.",
    required: ["Preis", "Market-Cap/Proxy", "24h-Änderung", "Volumen", "Quelle", "Zeitstempel", "Zweitprovider", "Datenlücken"],
    missing: ["Zweitprovider", "Orderbuch/Depth", "Holder-/Issuer-Kontext", "Venue-Statusadapter"],
    sections: ["Brief", "Marktdaten", "Lücken", "Zweitprovider", "Nächster Schritt", "Velmère Signatur"],
  },
  en: {
    headline: "Human readout without unknown spam",
    promise: "Basic explains the market plainly, Pro checks source quality, Advanced opens the full evidence matrix without fake-live wording.",
    required: ["price", "market cap/proxy", "24h move", "volume", "source", "timestamp", "second provider", "data gaps"],
    missing: ["second provider", "orderbook/depth", "holder/issuer context", "venue status adapter"],
    sections: ["Brief", "Market data", "Gaps", "Second provider", "Next step", "Velmère signature"],
  },
} as const;

export function resolvePass446Locale(locale: string): Pass446Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

export function buildPass446HumanReadoutContract(input: {
  locale: string;
  activeDepth?: Pass446Depth;
  hasPrice?: boolean;
  hasMarketCapOrProxy?: boolean;
  hasVolume?: boolean;
  hasSecondProvider?: boolean;
  hasTimestamp?: boolean;
}): Pass446HumanReadoutContract {
  const locale = resolvePass446Locale(input.locale);
  const c = copy[locale];
  const missing: string[] = [];
  if (!input.hasPrice) missing.push(c.required[0]);
  if (!input.hasMarketCapOrProxy) missing.push(c.required[1]);
  if (!input.hasVolume) missing.push(c.required[3]);
  if (!input.hasTimestamp) missing.push(c.required[5]);
  if (!input.hasSecondProvider) missing.push(c.required[6]);

  return {
    version: "pass446-human-readout-lane",
    locale,
    depthBudget: { basic: 10, pro: 14, advanced: 20 },
    activeDepth: input.activeDepth || "advanced",
    headline: c.headline,
    customerPromise: c.promise,
    requiredFields: [...c.required],
    nonNegotiableMissingFields: missing.length ? missing : [...c.missing],
    pdfSections: [...c.sections],
    uiMarkers: ["data-pass446-browser-human-readout", "data-pass446-pdf-depth-matrix", "data-pass446-realmarkets-venue-catalog"],
    unknownPolicy: "explain_missing_in_human_language",
  };
}

export function humanMissingValue(locale: string, field?: string) {
  const safeLocale = resolvePass446Locale(locale);
  const clean = (field || "field").toLowerCase();
  if (safeLocale === "pl") {
    if (clean.includes("second")) return "Do uzupełnienia: brak drugiego niezależnego źródła";
    if (clean.includes("timestamp")) return "Do uzupełnienia: brak świeżego timestampu źródła";
    if (clean.includes("price") || clean.includes("cena")) return "Do uzupełnienia: brak potwierdzonej ceny";
    if (clean.includes("volume") || clean.includes("wolumen")) return "Do uzupełnienia: brak potwierdzonego wolumenu";
    return "Do uzupełnienia: pole nie jest jeszcze potwierdzone źródłem";
  }
  if (safeLocale === "de") {
    if (clean.includes("second")) return "Ausstehend: keine zweite unabhängige Quelle";
    if (clean.includes("timestamp")) return "Ausstehend: kein frischer Quellenzeitstempel";
    if (clean.includes("price")) return "Ausstehend: kein bestätigter Preis";
    if (clean.includes("volume")) return "Ausstehend: kein bestätigtes Volumen";
    return "Ausstehend: Feld ist noch nicht durch eine Quelle bestätigt";
  }
  if (clean.includes("second")) return "Pending: no second independent source";
  if (clean.includes("timestamp")) return "Pending: no fresh source timestamp";
  if (clean.includes("price")) return "Pending: no confirmed price";
  if (clean.includes("volume")) return "Pending: no confirmed volume";
  return "Pending: field is not yet source-confirmed";
}
