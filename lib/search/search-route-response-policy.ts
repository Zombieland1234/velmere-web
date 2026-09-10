import {
  sourceEvidenceCoverageScore,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import type { LensLocale } from "@/lib/search/search-route-identity";

export function mergeResults(
  live: VelmereSearchResult[],
  local: VelmereSearchResult[],
) {
  const seen = new Set<string>();
  const merged: VelmereSearchResult[] = [];
  for (const item of [...live, ...local]) {
    const key = `${item.symbol ?? item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 12);
}

export function localizeMissingData(value: string, locale: LensLocale) {
  if (locale === "en") return value;
  const clean = value.toLowerCase();
  if (locale === "pl") {
    if (clean.includes("orderbook") || clean.includes("depth"))
      return "głębokość orderbooku dla wskazanej giełdy";
    if (clean.includes("holder"))
      return "świeży snapshot koncentracji holderów";
    if (clean.includes("contract"))
      return "weryfikacja uprawnień i kontekstu kontraktu";
    if (
      clean.includes("second") ||
      clean.includes("agreement") ||
      clean.includes("comparison")
    )
      return "potwierdzenie w drugim niezależnym źródle";
    if (clean.includes("timestamp") || clean.includes("fresh"))
      return "aktualny timestamp źródła";
    if (clean.includes("reserve") || clean.includes("issuer"))
      return "aktualny kontekst emitenta lub rezerw";
    if (clean.includes("wallet")) return "wdrożenie i test bramki portfela";
    if (clean.includes("policy")) return "zatwierdzona polityka dostępu";
    if (clean.includes("adapter")) return "aktywny adapter danych";
    return "dodatkowa weryfikacja źródłowa";
  }
  if (clean.includes("orderbook") || clean.includes("depth"))
    return "Orderbuch-Tiefe für den angegebenen Handelsplatz";
  if (clean.includes("holder"))
    return "aktueller Snapshot der Holder-Konzentration";
  if (clean.includes("contract"))
    return "Prüfung von Contract-Rechten und Kontext";
  if (
    clean.includes("second") ||
    clean.includes("agreement") ||
    clean.includes("comparison")
  )
    return "Bestätigung durch eine zweite unabhängige Quelle";
  if (clean.includes("timestamp") || clean.includes("fresh"))
    return "aktueller Quellenzeitstempel";
  if (clean.includes("reserve") || clean.includes("issuer"))
    return "aktueller Emittenten- oder Reservekontext";
  if (clean.includes("wallet"))
    return "Implementierung und Test des Wallet-Gates";
  if (clean.includes("policy")) return "freigegebene Zugriffsrichtlinie";
  if (clean.includes("adapter")) return "aktiver Datenadapter";
  return "zusätzliche Quellenprüfung";
}

export function localizeResult(
  item: VelmereSearchResult,
  locale: LensLocale,
): VelmereSearchResult {
  if (locale === "en") return item;
  const isLiveResult =
    item.id.startsWith("coingecko-") || item.id.startsWith("market-");
  const symbol = item.symbol ? ` (${item.symbol})` : "";
  const sourceCount = item.sources.filter(
    (source) => source.mode !== "missing",
  ).length;
  const localized =
    locale === "pl"
      ? {
          summary: `${item.title}${symbol}. Lens połączył ${sourceCount} dostępne warstwy źródłowe. Pokrycie jawnych warstw danych wynosi ${sourceEvidenceCoverageScore(item)}%; to nie jest skalibrowana pewność. Niewczytane pola pozostają jawne w raporcie.`,
          why:
            item.category === "token" || item.category === "contract"
              ? "Cena i rozpoznanie aktywa nie wystarczają do pełnego audytu. Płynność, uprawnienia kontraktu, koncentracja holderów i zgodność drugiego źródła pozostają osobnymi warstwami."
              : "Wynik rozdziela potwierdzoną informację, stan źródła i brakujące dane, aby opis nie był mocniejszy niż dostępny materiał.",
          next:
            item.category === "token" || item.category === "contract"
              ? "Otwórz Shield i porównaj wykres, płynność, źródła oraz brakujące pola przed rozszerzeniem wniosku."
              : "Przejdź do wskazanej powierzchni Velmère i sprawdź źródła oraz zakres danych.",
        }
      : {
          summary: `${item.title}${symbol}. Lens hat ${sourceCount} verfügbare Quellenebenen verbunden. Die Abdeckung der ausgewiesenen Datenebenen beträgt ${sourceEvidenceCoverageScore(item)}%; das ist keine kalibrierte Konfidenz. Nicht geladene Felder bleiben im Bericht sichtbar.`,
          why:
            item.category === "token" || item.category === "contract"
              ? "Preis und Asset-Erkennung reichen für ein vollständiges Audit nicht aus. Liquidität, Contract-Rechte, Holder-Konzentration und Zweitquellen-Abgleich bleiben getrennte Ebenen."
              : "Das Ergebnis trennt bestätigte Information, Quellenstatus und fehlende Daten, damit die Aussage nicht stärker als die Evidenz wird.",
          next:
            item.category === "token" || item.category === "contract"
              ? "Öffne Shield und vergleiche Chart, Liquidität, Quellen und Datenlücken vor einer stärkeren Schlussfolgerung."
              : "Öffne die angegebene Velmère-Oberfläche und prüfe Quellen sowie Datenumfang.",
        };

  return {
    ...item,
    summary: isLiveResult ? item.summary : localized.summary,
    whyItMatters: isLiveResult ? item.whyItMatters : localized.why,
    nextOperatorStep: isLiveResult ? item.nextOperatorStep : localized.next,
    missingData: item.missingData.map((value) =>
      localizeMissingData(value, locale),
    ),
    sources: item.sources.map((source) => ({
      ...source,
      freshness:
        locale === "pl"
          ? source.freshness === "missing"
            ? "brak"
            : source.freshness === "cached"
              ? "cache"
              : source.freshness === "request-time"
                ? "czas zapytania"
                : source.freshness
          : locale === "de"
            ? source.freshness === "missing"
              ? "fehlt"
              : source.freshness === "cached"
                ? "Cache"
                : source.freshness === "request-time"
                  ? "Abfragezeit"
                  : source.freshness
            : source.freshness,
      note: localizeSourceNote(source, locale),
    })),
  };
}

export function localizeSourceNote(
  source: VelmereSearchResult["sources"][number],
  locale: LensLocale,
) {
  const note = source.note.trim();
  if (source.mode === "missing") {
    return locale === "pl"
      ? "Źródło nie zostało dołączone do tego żądania. Potrzebna jest świeża odpowiedź providera i jawny timestamp."
      : locale === "de"
        ? "Die Quelle wurde dieser Anfrage nicht beigefügt. Eine frische Provider-Antwort mit offenem Zeitstempel ist erforderlich."
        : "The source was not attached to this request. A fresh provider response with an explicit timestamp is required.";
  }
  if (source.id === "coingecko-markets") {
    return locale === "pl"
      ? "Cena, kapitalizacja, wolumen, FDV, zakres 24h i identyfikacja aktywa z odpowiedzi rynku."
      : locale === "de"
        ? "Preis, Marktkapitalisierung, Volumen, FDV, 24h-Spanne und Asset-Identität aus der Marktantwort."
        : "Price, market cap, volume, FDV, 24h range and asset identity from the market response.";
  }
  if (source.id === "local-table") {
    return locale === "pl"
      ? "Lokalny katalog służy do identyfikacji i kontekstu; nie jest świeżym notowaniem ani dowodem płynności."
      : locale === "de"
        ? "Der lokale Katalog dient Identität und Kontext; er ist kein frischer Kurs und kein Liquiditätsnachweis."
        : "The local catalog provides identity and context; it is not a fresh quote or liquidity proof.";
  }
  if (source.id === "alpha-vantage-detail") {
    return locale === "pl"
      ? `Notowanie i fundamentals providera. ${note}`
      : locale === "de"
        ? `Kurs- und Fundamentaldaten des Providers. ${note}`
        : `Provider quote and fundamentals. ${note}`;
  }
  if (source.id === "sec-filing") {
    return locale === "pl"
      ? `Bezpośredni dokument SEC / filing: ${note}`
      : locale === "de"
        ? `Direktes SEC-Dokument / Filing: ${note}`
        : `Direct SEC document / filing: ${note}`;
  }
  if (/venue-health$/.test(source.id)) {
    return locale === "pl"
      ? `Stan venue, para, spread, depth i ciągłość źródła. ${note}`
      : locale === "de"
        ? `Venue-Status, Paar, Spread, Depth und Quellenkontinuität. ${note}`
        : `Venue state, pair, spread, depth and source continuity. ${note}`;
  }
  return note;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
