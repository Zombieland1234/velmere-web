export type Pass573Locale = "pl" | "de" | "en";

export type Pass573PdfLocalePurity = {
  version: "pdf-locale-purity";
  locale: Pass573Locale;
  state: "clean" | "repaired" | "review";
  leakCount: number;
  repairedCount: number;
  leaks: string[];
  boundary: string;
};

const phraseMap: Record<Exclude<Pass573Locale, "en">, ReadonlyArray<readonly [RegExp, string]>> = {
  pl: [
    [/\bdwadzieścia source[- ]bound testów\b/gi, "Dwadzieścia testów powiązanych ze źródłami"],
    [/\bgranicę source[- ]bound\b/gi, "granicę powiązania ze źródłami"],
    [/\bsecond independent source\b/gi, "drugie niezależne źródło"],
    [/\bsecond independent provider\b/gi, "drugi niezależny dostawca"],
    [/\bsource lineage\b/gi, "pochodzenie źródła"],
    [/\bsource ledger\b/gi, "rejestr źródeł"],
    [/\bproof capsule\b/gi, "kapsuła dowodowa"],
    [/\bcontradiction scan\b/gi, "kontrola sprzeczności"],
    [/\bwhat-would-change-my-mind check\b/gi, "kontrola warunków ponownej oceny"],
    [/\bevidence mode\b/gi, "tryb dowodowy"],
    [/\bsource-visible mode\b/gi, "tryb z widocznymi źródłami"],
    [/\bcadence mode\b/gi, "tryb częstotliwości"],
    [/\bmarket ledger only\b/gi, "wyłącznie rejestr rynku"],
    [/\bsame payload\b/gi, "ten sam pakiet danych"],
    [/\bsame locale\b/gi, "ten sam język"],
    [/\bsame sections\b/gi, "te same sekcje"],
    [/\bsource-and-timestamp\b/gi, "źródła i znacznika czasu"],
    [/\bsource quorum\b/gi, "kworum źródeł"],
    [/\bsource[- ]bound\b/gi, "powiązany ze źródłami"],
    [/\bsource[- ]required\b/gi, "wymagane źródło"],
    [/\bsource confidence\b/gi, "pewność źródeł"],
    [/\bsource ledger preview\b/gi, "podgląd rejestru źródeł"],
    [/\bmissing_source\b/gi, "brak źródła"],
    [/\bmissing_timestamp\b/gi, "brak znacznika czasu"],
    [/\bclaim_requires_source\b/gi, "teza wymaga źródła"],
    [/\bmissing data\b/gi, "brakujące dane"],
    [/\bsecond provider\b/gi, "drugie źródło"],
    [/\bmarket cap\b/gi, "kapitalizacja"],
    [/\bprovider timestamp\b/gi, "znacznik czasu dostawcy"],
    [/\bprovider lineage\b/gi, "pochodzenie dostawcy"],
    [/\bvenue status\/depth adapter\b/gi, "adapter stanu i głębokości platformy"],
    [/\bvenue liquidity adapter\b/gi, "adapter płynności platformy"],
    [/\borderbook simulation\b/gi, "symulacja arkusza zleceń"],
    [/\borderbook depth\b/gi, "głębokość arkusza zleceń"],
    [/\bbid\/ask depth\b/gi, "głębokość bid/ask"],
    [/\bholder distribution\b/gi, "rozkład posiadaczy"],
    [/\bvesting schedule\b/gi, "harmonogram odblokowań"],
    [/\bfresh timestamp\b/gi, "świeży znacznik czasu"],
    [/\bfake-live\b/gi, "pozornego LIVE"],
    [/\bfundamentals\s*\/\s*filing\b/gi, "dane fundamentalne / raport regulacyjny"],
    [/\bcrypto\b/gi, "kryptowaluta"],
    [/\bsimulation\b/gi, "symulacja"],
    [/\bslippage\b/gi, "poślizg"],
    [/\bunlocków\b/gi, "odblokowań"],
    [/\bunlock\b/gi, "odblokowanie"],
    [/\bprovider unavailable\b/gi, "dostawca niedostępny"],
    [/\bproviderów\b/gi, "dostawców"],
    [/\bprovidera\b/gi, "dostawcy"],
    [/\bproviderem\b/gi, "dostawcą"],
    [/\bproviderzy\b/gi, "dostawcy"],
    [/\btimestampem\b/gi, "znacznikiem czasu"],
    [/\btimestampu\b/gi, "znacznika czasu"],
    [/\btimestamp\b/gi, "znacznik czasu"],
    [/\bfixture\b/gi, "zestaw testowy"],
    [/\bprescreenu\b/gi, "wstępnego przeglądu"],
    [/\bprescreen\b/gi, "wstępny przegląd"],
    [/\bholderów\b/gi, "posiadaczy"],
    [/\borderbooka\b/gi, "arkusza zleceń"],
    [/\borderbook\b/gi, "arkusz zleceń"],
    [/\bvenue\b/gi, "platforma"],
    [/\bliquidity\b/gi, "płynność"],
    [/\bdepth\b/gi, "głębokość"],
    [/\bfundamentals\b/gi, "dane fundamentalne"],
    [/\blineage\b/gi, "pochodzenie"],
    [/\bclaimów\b/gi, "tez"],
    [/\bclaim\b/gi, "teza"],
    [/\bpayloadu\b/gi, "pakietu danych"],
    [/\bpayload\b/gi, "pakiet danych"],
    [/\banti-overfit\b/gi, "ochrona przed przeuczeniem"],
    [/\bseal\b/gi, "kontrola integralności"],
    [/\bpaid verdict\b/gi, "płatny werdykt"],
    [/\bre-check\b/gi, "ponowne sprawdzenie"],
    [/\bconfidence waterfall\b/gi, "kaskada pewności"],
    [/\bconfidence penalty\b/gi, "obniżenie pewności"],
    [/\bready to download\b/gi, "gotowy do pobrania"],
    [/\breview required\b/gi, "wymaga przeglądu"],
    [/\breview\b/gi, "przegląd"],
    [/\bconfidence\b/gi, "pewność"],
    [/\bfreshness\b/gi, "świeżość"],
    [/\bmissing\b/gi, "brak"],
    [/\bprovider\b/gi, "dostawca"],
    [/\bevidence\b/gi, "dowód"],
    [/\bblocked\b/gi, "zablokowany"],
    [/\bpartial\b/gi, "częściowe"],
    [/\bfallback\b/gi, "tryb zastępczy"],
    [/\bunknown\b/gi, "brak potwierdzenia"],
  ],
  de: [
    [/\bzwanzig source[- ]bound prüfungen\b/gi, "Zwanzig quellengebundene Prüfungen"],
    [/\bjede sektion bleibt source[- ]bound\b/gi, "jede Sektion bleibt an Quellen gebunden"],
    [/\bsecond independent source\b/gi, "zweite unabhängige Quelle"],
    [/\bsecond independent provider\b/gi, "zweiter unabhängiger Anbieter"],
    [/\bsource lineage\b/gi, "Quellenherkunft"],
    [/\bsource ledger\b/gi, "Quellenregister"],
    [/\bproof capsule\b/gi, "Evidenzkapsel"],
    [/\bcontradiction scan\b/gi, "Widerspruchsprüfung"],
    [/\bwhat-would-change-my-mind check\b/gi, "Prüfung der Neubewertungsbedingungen"],
    [/\bevidence mode\b/gi, "Evidenzmodus"],
    [/\bsource-visible mode\b/gi, "Modus mit sichtbaren Quellen"],
    [/\bcadence mode\b/gi, "Prüfintervallmodus"],
    [/\bmarket ledger only\b/gi, "nur Marktregister"],
    [/\bsame payload\b/gi, "gleiches Datenpaket"],
    [/\bsame locale\b/gi, "gleiche Sprache"],
    [/\bsame sections\b/gi, "gleiche Abschnitte"],
    [/\bsource-and-timestamp\b/gi, "Quelle und Zeitstempel"],
    [/\bsource quorum\b/gi, "Quellenquorum"],
    [/\bsource[- ]bound\b/gi, "quellengebunden"],
    [/\bsource[- ]required\b/gi, "Quelle erforderlich"],
    [/\bsource confidence\b/gi, "Quellenkonfidenz"],
    [/\bsource ledger preview\b/gi, "Vorschau des Quellenregisters"],
    [/\bmissing_source\b/gi, "Quelle fehlt"],
    [/\bmissing_timestamp\b/gi, "Zeitstempel fehlt"],
    [/\bclaim_requires_source\b/gi, "Aussage benötigt Quelle"],
    [/\bmissing data\b/gi, "fehlende Daten"],
    [/\bsecond provider\b/gi, "Zweitprovider"],
    [/\bmarket cap\b/gi, "Marktkapitalisierung"],
    [/\bprovider timestamp\b/gi, "Anbieter-Zeitstempel"],
    [/\bnarrative drift\b/gi, "Narrativabweichung"],
    [/\bvenue health\b/gi, "Handelsplatzstatus"],
    [/\bfake-live-risiko\b/gi, "Risiko eines vorgetäuschten LIVE-Status"],
    [/\btimestamp-drift\b/gi, "Zeitstempelabweichung"],
    [/\bfundamentals\b/gi, "Fundamentaldaten"],
    [/\bcrypto\b/gi, "Kryptoanlage"],
    [/\bprovider unavailable\b/gi, "Anbieter nicht verfügbar"],
    [/\btimestamp\b/gi, "Zeitstempel"],
    [/\bvenue\b/gi, "Handelsplatz"],
    [/\blineage\b/gi, "Herkunft"],
    [/\bresearch-vorschau\b/gi, "Analysevorschau"],
    [/\bclaim\b/gi, "Aussage"],
    [/\bpayload\b/gi, "Datenpaket"],
    [/\banti-overfit\b/gi, "Überanpassungsschutz"],
    [/\bseal\b/gi, "Integritätsprüfung"],
    [/\bpaid verdict\b/gi, "kostenpflichtiges Urteil"],
    [/\bre-check\b/gi, "erneute Prüfung"],
    [/\bconfidence waterfall\b/gi, "Konfidenzkaskade"],
    [/\bconfidence penalty\b/gi, "Konfidenzabzug"],
    [/\bready to download\b/gi, "downloadbereit"],
    [/\breview required\b/gi, "Prüfung erforderlich"],
    [/\breview\b/gi, "Prüfung"],
    [/\bconfidence\b/gi, "Konfidenz"],
    [/\bfreshness\b/gi, "Aktualität"],
    [/\bmissing\b/gi, "fehlt"],
    [/\bprovider\b/gi, "Anbieter"],
    [/\bevidence\b/gi, "Evidenz"],
    [/\bblocked\b/gi, "blockiert"],
    [/\bpartial\b/gi, "teilweise"],
    [/\bfallback\b/gi, "Ersatzmodus"],
    [/\bunknown\b/gi, "nicht bestätigt"],
  ],
};

const leakPatterns: Record<Exclude<Pass573Locale, "en">, ReadonlyArray<RegExp>> = {
  pl: [
    /\b(?:source|evidence|confidence|freshness|provider|claim|payload|seal|review|missing|blocked|partial|fallback|unknown|lineage|re-check)\b/i,
    /\b(?:proof capsule|contradiction scan|ready to download)\b/i,
  ],
  de: [
    /\b(?:source|evidence|confidence|freshness|provider|claim|payload|seal|review|missing|blocked|partial|fallback|unknown|lineage|re-check)\b/i,
    /\b(?:proof capsule|contradiction scan|ready to download)\b/i,
    /\b(?:podgląd|źródło|źródeł|pewność|brakujące)\b/i,
  ],
};

export function sanitizePass573PublicPdfText(locale: Pass573Locale, value: string) {
  if (locale === "en") return value.replace(/\s+/g, " ").trim();
  let output = value;
  for (const [pattern, replacement] of phraseMap[locale]) output = output.replace(pattern, replacement);
  return output
    .replace(/\bPASS\d{3,}\b[^.]*\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPass573PdfLocalePurity(locale: Pass573Locale, values: readonly string[]): Pass573PdfLocalePurity {
  if (locale === "en") {
    return { version: "pdf-locale-purity", locale, state: "clean", leakCount: 0, repairedCount: 0, leaks: [], boundary: "English is the selected report locale; no cross-locale repair is required." };
  }
  const normalized = values.map((value) => value.replace(/\s+/g, " ").trim());
  const sanitized = normalized.map((value) => sanitizePass573PublicPdfText(locale, value));
  const repairedCount = sanitized.reduce(
    (count, value, index) => count + (value === normalized[index] ? 0 : 1),
    0,
  );
  const leaks = sanitized.flatMap((value) =>
    leakPatterns[locale]
      .filter((pattern) => pattern.test(value))
      .map((pattern) => pattern.source),
  );
  return {
    version: "pdf-locale-purity",
    locale,
    state: leaks.length ? "review" : repairedCount ? "repaired" : "clean",
    leakCount: leaks.length,
    repairedCount,
    leaks: Array.from(new Set(leaks)).slice(0, 12),
    boundary: locale === "pl" ? "Publiczny Reader i pobrany PDF używają jednego języka; nazwy własne providerów pozostają bez zmian." : "Öffentlicher Reader und Download-PDF verwenden eine Sprache; Eigennamen der Provider bleiben unverändert.",
  };
}
