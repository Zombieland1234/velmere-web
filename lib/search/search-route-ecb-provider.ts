import {
  loadPass69EcbOfficialFxReferenceEnvelope,
  type Pass69EcbOfficialFxReference,
} from "@/lib/market-integrity/real-markets-quote-hydration";
import {
  buildVelmereShieldBridge,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import type { LensLocale } from "@/lib/search/search-route-identity";

const ECB_QUERY_ALIASES = Object.freeze({
  "EUR/USD": "EURUSD=X",
  "EURUSD": "EURUSD=X",
  "EURUSD=X": "EURUSD=X",
  "EUR/PLN": "EURPLN=X",
  "EURPLN": "EURPLN=X",
  "EURPLN=X": "EURPLN=X",
  "EUR/GBP": "EURGBP=X",
  "EURGBP": "EURGBP=X",
  "EURGBP=X": "EURGBP=X",
  "EUR/TRY": "EURTRY=X",
  "EURTRY": "EURTRY=X",
  "EURTRY=X": "EURTRY=X",
} as const);

export type R7BrowserEcbProviderSymbol = typeof ECB_QUERY_ALIASES[keyof typeof ECB_QUERY_ALIASES];

const ECB_PROVIDER_IDENTITIES = Object.freeze({
  "EURUSD=X": { pair: "EUR/USD", quoteCurrency: "USD" },
  "EURPLN=X": { pair: "EUR/PLN", quoteCurrency: "PLN" },
  "EURGBP=X": { pair: "EUR/GBP", quoteCurrency: "GBP" },
  "EURTRY=X": { pair: "EUR/TRY", quoteCurrency: "TRY" },
} as const satisfies Record<R7BrowserEcbProviderSymbol, {
  pair: "EUR/USD" | "EUR/PLN" | "EUR/GBP" | "EUR/TRY";
  quoteCurrency: "USD" | "PLN" | "GBP" | "TRY";
}>);

function normalizedAlias(value: string) {
  return value.trim().toUpperCase().replace(/\s+/gu, "");
}

export function resolveR7BrowserEcbProviderSymbol(query: string): R7BrowserEcbProviderSymbol | null {
  const alias = normalizedAlias(query) as keyof typeof ECB_QUERY_ALIASES;
  return ECB_QUERY_ALIASES[alias] ?? null;
}

function localizedCopy(reference: Pass69EcbOfficialFxReference, locale: LensLocale) {
  const exactRate = reference.referenceRate.toLocaleString(locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-US", {
    maximumFractionDigits: 8,
    useGrouping: false,
  });
  const equation = `1 EUR = ${exactRate} ${reference.quoteCurrency}`;
  if (locale === "pl") {
    return {
      title: `Referencyjny kurs ECB ${reference.pair}`,
      summary: `${equation}. To niezmieniona oficjalna statystyka referencyjna ECB z dnia ${reference.referenceDate}; nie jest kursem wykonawczym ani notowaniem intraday.`,
      why: "Referencyjny kurs ECB daje oficjalny, datowany punkt odniesienia, ale nie opisuje ceny dostępnej do zawarcia transakcji ani bieżącej płynności rynku.",
      missing: ["wykonawcze notowanie rynkowe", "świeżość intraday", "niezależne potwierdzenie drugiego źródła"],
      next: "Użyj tej wartości wyłącznie jako datowanego punktu odniesienia. Przed decyzją rynkową sprawdź aktualne notowanie wykonawcze i płynność.",
      chips: ["oficjalna statystyka ECB", `data ${reference.referenceDate}`, "niewykonawczy kurs referencyjny"],
    };
  }
  if (locale === "de") {
    return {
      title: `EZB-Referenzkurs ${reference.pair}`,
      summary: `${equation}. Dies ist eine unveränderte offizielle EZB-Referenzstatistik vom ${reference.referenceDate}; sie ist weder ein ausführbarer Kurs noch ein Intraday-Kurs.`,
      why: "Der EZB-Referenzkurs ist ein offizieller, datierter Bezugspunkt, bildet aber weder einen handelbaren Preis noch die aktuelle Marktliquidität ab.",
      missing: ["ausführbarer Marktkurs", "Intraday-Aktualität", "unabhängige Bestätigung durch eine zweite Quelle"],
      next: "Nutze diesen Wert nur als datierten Referenzpunkt. Prüfe vor einer Marktentscheidung einen aktuellen ausführbaren Kurs und die Liquidität.",
      chips: ["offizielle EZB-Statistik", `Datum ${reference.referenceDate}`, "nicht ausführbarer Referenzkurs"],
    };
  }
  return {
    title: `ECB ${reference.pair} reference rate`,
    summary: `${equation}. This is an unchanged official ECB reference statistic dated ${reference.referenceDate}; it is neither an executable quote nor an intraday market price.`,
    why: "The ECB reference rate provides an official dated benchmark, but it does not represent a tradable price or current market liquidity.",
    missing: ["executable market quote", "intraday freshness", "independent second-source confirmation"],
    next: "Use this value only as a dated reference point. Check a current executable quote and liquidity before making a market decision.",
    chips: ["official ECB statistic", `dated ${reference.referenceDate}`, "non-executable reference rate"],
  };
}

function validCurrentReference(reference: Pass69EcbOfficialFxReference, now: Date) {
  const observationMs = Date.parse(`${reference.referenceDate}T00:00:00.000Z`);
  const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(observationMs)
    && observationMs <= todayMs
    && reference.referenceAgeDays >= 0
    && reference.referenceAgeDays <= 4
    && reference.state === "latest_available_reference"
    && Number.isFinite(reference.referenceRate)
    && reference.referenceRate > 0
    && reference.derivedRate === false
    && reference.referenceOnly === true
    && reference.executableQuote === false
    && reference.marketPriceFieldEligible === false;
}

export async function loadR7BrowserEcbReferenceResult(args: {
  query: string;
  locale: LensLocale;
  now?: Date;
}): Promise<
  | { ok: true; result: VelmereSearchResult; generatedAt: string; responseSha256: string }
  | { ok: false; availability: "UNAVAILABLE" | "STALE"; internalBlocker: string }
> {
  const providerSymbol = resolveR7BrowserEcbProviderSymbol(args.query);
  if (!providerSymbol) return { ok: false, availability: "UNAVAILABLE", internalBlocker: "ecb_pair_not_supported" };
  const now = args.now ?? new Date();
  const envelope = await loadPass69EcbOfficialFxReferenceEnvelope([providerSymbol], { now });
  if (envelope.state !== "available" || !envelope.responseSha256) {
    return {
      ok: false,
      availability: envelope.state === "policy_review_expired" ? "STALE" : "UNAVAILABLE",
      internalBlocker: envelope.blocker ?? `ecb_${envelope.state}`,
    };
  }
  const reference = envelope.references.find((item) => item.providerSymbol === providerSymbol);
  const identity = ECB_PROVIDER_IDENTITIES[providerSymbol];
  if (!reference || !validCurrentReference(reference, now)
    || reference.pair !== identity.pair
    || reference.quoteCurrency !== identity.quoteCurrency) {
    return { ok: false, availability: "STALE", internalBlocker: "ecb_reference_missing_stale_or_invalid" };
  }
  const copy = localizedCopy(reference, args.locale);
  const bridge = buildVelmereShieldBridge(reference.pair, `ecb-${providerSymbol.toLowerCase()}`);
  const result: VelmereSearchResult = {
    id: `ecb-reference-${providerSymbol.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
    title: copy.title,
    symbol: reference.pair,
    category: "market",
    tone: "review",
    summary: copy.summary,
    whyItMatters: copy.why,
    missingData: copy.missing,
    nextOperatorStep: copy.next,
    sourceMode: "table",
    sourceConfidence: 0,
    sourceConfidenceCalibrated: false,
    sourceCoverage: 100,
    shieldHref: bridge.href,
    avatarLabel: "ECB",
    bridge,
    marketSnapshot: {
      assetClass: "fx",
      currency: reference.quoteCurrency,
      observedAt: `${reference.referenceDate}T00:00:00.000Z`,
      providerState: "source_bound",
      providerFunctions: ["official_reference_rate", "reference_date"],
      fundamentalBoundary: envelope.truthBoundary,
    },
    officialReferenceSnapshot: {
      schemaVersion: "velmere.r7.browser-official-reference-snapshot.v1",
      providerId: "ecb_statistics",
      pair: identity.pair,
      baseCurrency: "EUR",
      quoteCurrency: identity.quoteCurrency,
      referenceRate: reference.referenceRate,
      referenceDate: reference.referenceDate,
      responseSha256: envelope.responseSha256,
      fieldIds: ["market.reference_rate", "market.reference_date"],
      statisticsModified: false,
      directPublishedPair: true,
      referenceOnly: true,
      executableQuote: false,
      marketPriceFieldEligible: false,
      paidValueEligible: false,
      attribution: "Source: ECB statistics.",
    },
    sources: [{
      id: "ecb-statistics",
      label: envelope.sourceLabel,
      mode: "table",
      freshness: reference.referenceDate,
      confidence: 0,
      confidenceCalibrated: false,
      coverage: 100,
      note: `${reference.attribution} ${reference.pair}: ${reference.referenceRate} on ${reference.referenceDate}. Unchanged reference statistic; response integrity ${envelope.responseSha256}.`,
    }],
    chips: copy.chips,
  };
  return { ok: true, result, generatedAt: envelope.fetchedAt, responseSha256: envelope.responseSha256 };
}
