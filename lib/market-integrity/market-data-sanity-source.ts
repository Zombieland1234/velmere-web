import type { Pass4413AssetCategory } from "@/lib/market-integrity/market-data-contract";

export const PASS4570_MARKET_DATA_SANITY_BOUNDARY = {
  passId: "PASS4570",
  purpose:
    "Keep Shield/Real Markets/Shield Pro from showing impossible synthetic percentage moves as if they were live provider data.",
  publicTopkaLiveAllowed: false,
  rule:
    "If a percentage breaches the asset-class/window sanity envelope, render it as missing/review instead of a fake +1000% value.",
} as const;

export type AssetCategoryLike = Pass4413AssetCategory | string | null | undefined;

function categoryKey(category: AssetCategoryLike): string {
  return String(category ?? "unknown").toLowerCase();
}

export function pass4570PercentEnvelope(category: AssetCategoryLike, windowSeconds: number): number {
  const key = categoryKey(category);
  const isOneHour = windowSeconds <= 60 * 60;
  const isDay = windowSeconds <= 24 * 60 * 60;
  const isWeek = windowSeconds <= 7 * 24 * 60 * 60;

  if (key === "fx") return isOneHour ? 1.8 : isDay ? 7 : isWeek ? 14 : 28;
  if (key === "indices") return isOneHour ? 4 : isDay ? 16 : isWeek ? 32 : 55;
  if (key === "stocks" || key === "etf") return isOneHour ? 9 : isDay ? 35 : isWeek ? 70 : 120;
  if (key === "commodities") return isOneHour ? 5 : isDay ? 22 : isWeek ? 42 : 80;
  if (key === "real_estate") return isOneHour ? 6 : isDay ? 24 : isWeek ? 48 : 90;
  if (key === "exchanges") return isOneHour ? 10 : isDay ? 28 : isWeek ? 55 : 95;
  if (key === "crypto") return isOneHour ? 45 : isDay ? 180 : isWeek ? 360 : 700;
  return isOneHour ? 8 : isDay ? 35 : isWeek ? 70 : 120;
}

export function pass4570SanitizePercent(
  value: number | null | undefined,
  category: AssetCategoryLike,
  windowSeconds: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const absolute = Math.abs(value);
  const envelope = pass4570PercentEnvelope(category, windowSeconds);
  if (absolute > envelope) return null;
  if (absolute > 900) return null;
  return Number(value.toFixed(2));
}

export function pass4570SignedPercentLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function pass4570SanityCaption(
  value: number | null | undefined,
  category: AssetCategoryLike,
  windowSeconds: number,
  locale: "pl" | "de" | "en",
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const envelope = pass4570PercentEnvelope(category, windowSeconds);
  if (Math.abs(value) <= envelope) return null;
  if (locale === "pl") return "odrzucone przez sanity guard";
  if (locale === "de") return "durch Sanity-Guard verworfen";
  return "rejected by sanity guard";
}


export const PASS4572_MARKET_DATA_TRUST_BOUNDARY = {
  passId: "PASS4572",
  purpose:
    "Upgrade PASS4570 from a broad clamp into an instrument-aware trust gate: no fake +100%/+900% changes, no fallback percentages pretending to be live, no average built from rejected values.",
  publicTopkaLiveAllowed: false,
  rule:
    "Large liquid equities/ETFs/indices require source-live quote state and a stricter percentage envelope; rejected values render as missing/review.",
} as const;

const PASS4572_MAJOR_SYMBOLS = new Set([
  "AAPL", "NVDA", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "SPY", "QQQ", "VOO", "VTI",
  "DIA", "IWM", "SAP", "ASML", "TSM", "AVGO", "JPM", "V", "MA", "NFLX", "ADBE", "AMD", "INTC",
]);

function pass4572CleanSymbol(symbol?: string | null): string {
  return String(symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-_/].*$/g, "")
    .replace(/\.(DE|L|PA|AS|MI|SW|HK|TO|AX)$/i, "");
}

export function pass4572PercentEnvelope(
  category: AssetCategoryLike,
  windowSeconds: number,
  symbol?: string | null,
): number {
  const key = categoryKey(category);
  const cleanSymbol = pass4572CleanSymbol(symbol);
  const isMajor = PASS4572_MAJOR_SYMBOLS.has(cleanSymbol);
  const isOneHour = windowSeconds <= 60 * 60;
  const isDay = windowSeconds <= 24 * 60 * 60;
  const isWeek = windowSeconds <= 7 * 24 * 60 * 60;

  if (isMajor) return isOneHour ? 3.5 : isDay ? 14 : isWeek ? 34 : 68;
  if (key === "fx") return isOneHour ? 0.9 : isDay ? 4.5 : isWeek ? 10 : 22;
  if (key === "indices") return isOneHour ? 2.5 : isDay ? 10 : isWeek ? 24 : 48;
  if (key === "stocks" || key === "etf") return isOneHour ? 5.5 : isDay ? 22 : isWeek ? 54 : 95;
  if (key === "commodities") return isOneHour ? 3.5 : isDay ? 16 : isWeek ? 34 : 68;
  if (key === "real_estate") return isOneHour ? 3.5 : isDay ? 16 : isWeek ? 36 : 72;
  if (key === "exchanges") return isOneHour ? 5.5 : isDay ? 20 : isWeek ? 46 : 84;
  if (key === "crypto") return isOneHour ? 32 : isDay ? 120 : isWeek ? 300 : 650;
  return isOneHour ? 5 : isDay ? 22 : isWeek ? 54 : 95;
}

export function pass4572SanitizeAssetPercent(
  value: number | null | undefined,
  category: AssetCategoryLike,
  windowSeconds: number,
  symbol?: string | null,
  quoteState?: string | null,
): number | null {
  if (quoteState && quoteState !== "live") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (Math.abs(value) > 900) return null;
  const envelope = pass4572PercentEnvelope(category, windowSeconds, symbol);
  if (Math.abs(value) > envelope) return null;
  return Number(value.toFixed(2));
}

export function pass4572TrustedAveragePercent(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (clean.length < 3) return null;
  const sorted = [...clean].sort((left, right) => left - right);
  const trimmed = sorted.length >= 7 ? sorted.slice(1, -1) : sorted;
  const average = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  if (!Number.isFinite(average) || Math.abs(average) > 120) return null;
  return Number(average.toFixed(2));
}

export function pass4572SignedPercentLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export const PASS4573_MARKET_DATA_DISPLAY_CONTRACT = {
  passId: "PASS4573",
  purpose:
    "Final visible-table trust gate for Shield/Real Markets: no catalog/fallback quote can print 1h/24h/avg values, major assets use stricter intraday/day envelopes, rejected values stay visibly missing instead of being clamped.",
  publicTopkaLiveAllowed: false,
  rule:
    "Render trusted percentages only when quote state is live and the move survives the instrument-aware envelope; otherwise render an em dash and keep charts in source-pending mode.",
} as const;

const PASS4573_TRUSTED_STATES = new Set([
  "live",
  "source-live",
  "provider-live",
  "fresh",
  "verified",
  "ok",
]);

const PASS4573_UNTRUSTED_STATES = new Set([
  "catalog",
  "fallback",
  "fallback_quote",
  "mock",
  "demo",
  "local",
  "synthetic",
  "stale",
  "missing",
  "error",
  "limited",
  "review",
  "pending",
]);

export function pass4573NormalizeQuoteState(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

export function pass4573IsTrustedQuoteState(value?: string | null): boolean {
  const state = pass4573NormalizeQuoteState(value);
  if (!state) return false;
  if (PASS4573_UNTRUSTED_STATES.has(state)) return false;
  if (state.includes("fallback") || state.includes("mock") || state.includes("demo") || state.includes("stale")) return false;
  return PASS4573_TRUSTED_STATES.has(state) || state.includes("live");
}

export function pass4573SanitizeAssetPercent(
  value: number | null | undefined,
  category: AssetCategoryLike,
  windowSeconds: number,
  symbol?: string | null,
  quoteState?: string | null,
): number | null {
  if (!pass4573IsTrustedQuoteState(quoteState)) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (Math.abs(value) > 900) return null;
  const cleanSymbol = pass4572CleanSymbol(symbol);
  const key = categoryKey(category);
  const isMajor = PASS4572_MAJOR_SYMBOLS.has(cleanSymbol);
  const isOneHour = windowSeconds <= 60 * 60;
  const isDay = windowSeconds <= 24 * 60 * 60;
  const strictEnvelope = isMajor
    ? isOneHour
      ? 2.75
      : isDay
        ? 12
        : pass4572PercentEnvelope(category, windowSeconds, symbol)
    : key === "fx"
      ? isOneHour
        ? 0.75
        : isDay
          ? 3.8
          : pass4572PercentEnvelope(category, windowSeconds, symbol)
      : pass4572PercentEnvelope(category, windowSeconds, symbol);
  if (Math.abs(value) > strictEnvelope) return null;
  return Number(value.toFixed(2));
}

export function pass4573TrustedAveragePercent(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (clean.length < 3) return null;
  const sorted = [...clean].sort((left, right) => left - right);
  const trimmed = sorted.length >= 7 ? sorted.slice(1, -1) : sorted;
  const average = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  if (!Number.isFinite(average) || Math.abs(average) > 60) return null;
  return Number(average.toFixed(2));
}

export function pass4573SignedPercentLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}



export const PASS4574_QUOTE_DISPLAY_TRUST_CONTRACT = {
  passId: "PASS4574",
  purpose:
    "Provider-normalizer and UI display trust lock: a row may print percent moves only when its quote is genuinely source-live, priced, and not catalog/fallback/stale/mock/synthetic.",
  publicTopkaLiveAllowed: false,
  rule:
    "Downgrade bad quote states before they reach Real Markets cards/table/modal. Missing data is safer than invented green/red movement.",
} as const;

export type Pass4574QuoteDisplayLike = {
  state?: string | null;
  source?: string | null;
  providerStatus?: string | null;
  truthState?: string | null;
  freshnessState?: string | null;
  consensusState?: string | null;
  missingReason?: string | null;
  sourceTimestamp?: number | null;
  currentPrice?: number | null;
  candles?: unknown[] | null;
};

function pass4574Text(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

const PASS4574_BAD_SOURCE_PATTERNS = [
  "fallback",
  "mock",
  "demo",
  "synthetic",
  "catalog",
  "sample",
  "fixture",
  "local",
  "placeholder",
  "unbound",
  "source required",
];

export function pass4574QuoteDisplayState(quote?: Pass4574QuoteDisplayLike | null):
  | "live"
  | "missing"
  | "unavailable"
  | "unpriced"
  | "fallback"
  | "stale"
  | "provider-error"
  | "source-required"
  | "review" {
  if (!quote) return "missing";
  const state = pass4574Text(quote.state);
  const source = pass4574Text(quote.source);
  const providerStatus = pass4574Text(quote.providerStatus);
  const truthState = pass4574Text(quote.truthState);
  const freshnessState = pass4574Text(quote.freshnessState);
  const consensusState = pass4574Text(quote.consensusState);
  const missingReason = pass4574Text(quote.missingReason);
  const combined = [state, source, providerStatus, truthState, freshnessState, consensusState, missingReason].join(" · ");

  if (!state || state === "unavailable" || state === "error" || state === "missing") return "unavailable";
  if (providerStatus.includes("error") || truthState.includes("error") || combined.includes("provider-error")) return "provider-error";
  if (truthState.includes("source-required") || providerStatus.includes("not-configured") || missingReason.includes("source")) return "source-required";
  if (freshnessState === "stale" || consensusState === "stale" || combined.includes("stale")) return "stale";
  if (PASS4574_BAD_SOURCE_PATTERNS.some((pattern) => combined.includes(pattern))) return "fallback";
  if (typeof quote.currentPrice !== "number" || !Number.isFinite(quote.currentPrice) || quote.currentPrice <= 0) return "unpriced";
  if (providerStatus && !["source-bound", "live", "ok", "verified", "fresh"].some((token) => providerStatus.includes(token))) return "review";
  if (truthState && !["source-bound", "source-boundary", "verified", "live"].some((token) => truthState.includes(token))) return "review";
  return "live";
}

export function pass4574IsTrustedQuoteForPercent(quote?: Pass4574QuoteDisplayLike | null): boolean {
  return pass4574QuoteDisplayState(quote) === "live";
}

export function pass4574QuoteDisplayCaption(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  locale: "pl" | "de" | "en",
): string {
  const state = pass4574QuoteDisplayState(quote);
  if (state === "live") return locale === "pl" ? "źródło live" : locale === "de" ? "Live-Quelle" : "source live";
  if (state === "unpriced") return locale === "pl" ? "cena niedostępna" : locale === "de" ? "Preis fehlt" : "price pending";
  if (state === "source-required") return locale === "pl" ? "brak źródła" : locale === "de" ? "Quelle fehlt" : "source required";
  if (state === "fallback") return locale === "pl" ? "fallback odrzucony" : locale === "de" ? "Fallback verworfen" : "fallback rejected";
  if (state === "stale") return locale === "pl" ? "stare dane" : locale === "de" ? "stale Daten" : "stale data";
  if (state === "provider-error") return locale === "pl" ? "błąd providera" : locale === "de" ? "Provider-Fehler" : "provider error";
  return locale === "pl" ? "wymaga weryfikacji" : locale === "de" ? "Prüfung nötig" : "review required";
}

export const PASS4575_SOURCE_FRESHNESS_DISPLAY_CONTRACT = {
  passId: "PASS4575",
  purpose:
    "Close the remaining credibility gap on Shield/Real Markets/Shield Pro: a quote can be visually trusted only when it is live, priced, fresh for its asset class, and its chart has source-bound candles rather than local/fallback geometry.",
  publicTopkaLiveAllowed: false,
  rule:
    "Display em dash / source pending instead of any percent or chart when the quote is stale, fallback, synthetic, unpriced, or missing source candles.",
} as const;

export function pass4575FreshnessBudgetSeconds(category: AssetCategoryLike): number {
  const key = categoryKey(category);
  if (key === "fx") return 86_400;
  if (key === "real_estate") return 604_800;
  if (key === "indices" || key === "commodities") return 3_600;
  if (key === "crypto") return 900;
  if (key === "stocks" || key === "etf" || key === "exchanges") return 1_800;
  return 1_800;
}

function pass4575NowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function pass4575QuoteAgeSeconds(quote?: Pass4574QuoteDisplayLike | null): number | null {
  const timestamp = quote?.sourceTimestamp;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const normalized = timestamp > 10_000_000_000 ? Math.floor(timestamp / 1000) : timestamp;
  const age = pass4575NowSeconds() - normalized;
  if (!Number.isFinite(age) || age < 0) return 0;
  return age;
}

export function pass4575IsFreshForCategory(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  category: AssetCategoryLike,
): boolean {
  if (pass4574QuoteDisplayState(quote) !== "live") return false;
  const budget = pass4575FreshnessBudgetSeconds(category);
  const age = pass4575QuoteAgeSeconds(quote);
  if (age === null) return false;
  return age <= budget;
}

export function pass4575HasSourceCandles(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  minimum = 2,
): boolean {
  const candles = Array.isArray(quote?.candles) ? quote?.candles : [];
  const finiteCloses = candles.filter((candle) => {
    if (!candle || typeof candle !== "object") return false;
    const close = (candle as { close?: unknown }).close;
    return typeof close === "number" && Number.isFinite(close);
  }).length;
  return finiteCloses >= minimum;
}

export function pass4575CanShowPercent(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  category: AssetCategoryLike,
): boolean {
  return pass4575IsFreshForCategory(quote, category);
}

export function pass4575CanShowChart(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  category: AssetCategoryLike,
  minimumCandles = 2,
): boolean {
  return pass4575IsFreshForCategory(quote, category) && pass4575HasSourceCandles(quote, minimumCandles);
}

export function pass4575DisplayTrustCaption(
  quote: Pass4574QuoteDisplayLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
): string {
  const state = pass4574QuoteDisplayState(quote);
  if (state !== "live") return pass4574QuoteDisplayCaption(quote, locale);
  const age = pass4575QuoteAgeSeconds(quote);
  const budget = pass4575FreshnessBudgetSeconds(category);
  if (age === null) return locale === "pl" ? "brak czasu źródła" : locale === "de" ? "Quellzeit fehlt" : "source time missing";
  if (age > budget) return locale === "pl" ? "źródło przestarzałe" : locale === "de" ? "Quelle veraltet" : "source stale";
  return locale === "pl" ? "źródło świeże" : locale === "de" ? "Quelle frisch" : "source fresh";
}


export const PASS4576_SOURCE_CLOCK_CONTRACT = {
  passId: "PASS4576",
  purpose:
    "Resolve provider timestamps from multiple real-world quote fields before the UI decides whether Real Markets / Shield charts and percent values are fresh enough to print.",
  publicTopkaLiveAllowed: false,
  rule:
    "A row is display-trusted only when source state is live, price is finite, and a sane provider clock can be resolved from sourceTimestamp, observedAt, updatedAt, fetchedAt or marketTime without being stale or far in the future.",
} as const;

export type Pass4576ClockLike = Pass4574QuoteDisplayLike & {
  sourceTimestampMs?: number | string | null;
  observedAt?: number | string | null;
  updatedAt?: number | string | null;
  fetchedAt?: number | string | null;
  receivedAt?: number | string | null;
  lastUpdated?: number | string | null;
  marketTime?: number | string | null;
  regularMarketTime?: number | string | null;
  quoteTime?: number | string | null;
  timestamp?: number | string | null;
};

function pass4576ParseTimestampSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return null;
    const asNumber = Number(clean);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber > 10_000_000_000 ? Math.floor(asNumber / 1000) : Math.floor(asNumber);
    }
    const parsed = Date.parse(clean);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

export function pass4576ResolveSourceTimestampSeconds(
  quote?: Pass4576ClockLike | null,
): number | null {
  if (!quote) return null;
  const candidates: unknown[] = [
    quote.sourceTimestamp,
    quote.sourceTimestampMs,
    quote.observedAt,
    quote.updatedAt,
    quote.fetchedAt,
    quote.receivedAt,
    quote.lastUpdated,
    quote.marketTime,
    quote.regularMarketTime,
    quote.quoteTime,
    quote.timestamp,
  ];
  const parsed = candidates
    .map(pass4576ParseTimestampSeconds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left);
  return parsed[0] ?? null;
}

export function pass4576QuoteClockState(
  quote: Pass4576ClockLike | null | undefined,
  category: AssetCategoryLike,
): "fresh" | "missing" | "future" | "stale" | "untrusted" {
  if (pass4574QuoteDisplayState(quote) !== "live") return "untrusted";
  const resolved = pass4576ResolveSourceTimestampSeconds(quote);
  if (resolved === null) return "missing";
  const now = pass4575NowSeconds();
  if (resolved - now > 300) return "future";
  const age = Math.max(0, now - resolved);
  return age <= pass4575FreshnessBudgetSeconds(category) ? "fresh" : "stale";
}

export function pass4576QuoteAgeSeconds(quote?: Pass4576ClockLike | null): number | null {
  const resolved = pass4576ResolveSourceTimestampSeconds(quote);
  if (resolved === null) return null;
  const age = pass4575NowSeconds() - resolved;
  if (!Number.isFinite(age)) return null;
  return Math.max(0, age);
}

export function pass4576CanShowPercent(
  quote: Pass4576ClockLike | null | undefined,
  category: AssetCategoryLike,
): boolean {
  return pass4576QuoteClockState(quote, category) === "fresh";
}

export function pass4576CanShowChart(
  quote: Pass4576ClockLike | null | undefined,
  category: AssetCategoryLike,
  minimumCandles = 2,
): boolean {
  return pass4576CanShowPercent(quote, category) && pass4575HasSourceCandles(quote, minimumCandles);
}

export function pass4576DisplayTrustCaption(
  quote: Pass4576ClockLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
): string {
  const state = pass4574QuoteDisplayState(quote);
  if (state !== "live") return pass4574QuoteDisplayCaption(quote, locale);
  const clockState = pass4576QuoteClockState(quote, category);
  if (clockState === "fresh") return locale === "pl" ? "źródło świeże" : locale === "de" ? "Quelle frisch" : "source fresh";
  if (clockState === "missing") return locale === "pl" ? "brak czasu źródła" : locale === "de" ? "Quellzeit fehlt" : "source time missing";
  if (clockState === "future") return locale === "pl" ? "czas źródła do weryfikacji" : locale === "de" ? "Quellzeit prüfen" : "source time review";
  if (clockState === "stale") return locale === "pl" ? "źródło przestarzałe" : locale === "de" ? "Quelle veraltet" : "source stale";
  return pass4574QuoteDisplayCaption(quote, locale);
}


export const PASS4577_SESSION_AWARE_DISPLAY_CONTRACT = {
  passId: "PASS4577",
  purpose:
    "Make display trust stricter for fake data while keeping legitimate exchange/stock quotes usable after market close: live crypto still needs a tight clock, but equities/ETFs/indices may show last-close values when the provider clock is source-bound and recent.",
  publicTopkaLiveAllowed: false,
  rule:
    "A visible 1H/24H/chart value must be source-bound, priced, clock-resolved, inside sanity envelopes and either live-fresh or a clearly labelled last-close / delayed market state. No mock/fallback/stale value may be colored as live movement.",
} as const;

export type Pass4577SessionClockLike = Pass4576ClockLike & {
  marketState?: string | null;
  regularMarketState?: string | null;
  sessionState?: string | null;
  delayMinutes?: number | string | null;
  isDelayed?: boolean | null;
};

export type Pass4577QuoteReliability =
  | "live"
  | "last-close"
  | "delayed"
  | "missing-clock"
  | "future-clock"
  | "stale"
  | "unpriced"
  | "fallback"
  | "review";

function pass4577IsCloseBasedCategory(category: AssetCategoryLike): boolean {
  const key = categoryKey(category);
  return key === "stocks" || key === "stock" || key === "etf" || key === "indices" || key === "index" || key === "exchanges" || key === "exchange_equity";
}

function pass4577Text(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
}

export function pass4577SessionAwareBudgetSeconds(category: AssetCategoryLike, quote?: Pass4577SessionClockLike | null): number {
  const key = categoryKey(category);
  const stateText = [quote?.marketState, quote?.regularMarketState, quote?.sessionState].map(pass4577Text).join(" · ");
  const delayed = quote?.isDelayed === true || Number(quote?.delayMinutes ?? 0) > 0 || stateText.includes("delayed");
  if (key === "crypto") return 900;
  if (key === "fx") return delayed ? 172_800 : 86_400;
  if (pass4577IsCloseBasedCategory(category)) return 259_200;
  if (key === "commodities" || key === "commodity") return delayed ? 86_400 : 21_600;
  if (key === "real_estate") return 604_800;
  return pass4575FreshnessBudgetSeconds(category);
}

export function pass4577QuoteReliabilityState(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
): Pass4577QuoteReliability {
  const displayState = pass4574QuoteDisplayState(quote);
  if (displayState === "fallback" || displayState === "source-required" || displayState === "provider-error") return "fallback";
  if (displayState !== "live") return "review";
  if (typeof quote?.currentPrice !== "number" || !Number.isFinite(quote.currentPrice) || quote.currentPrice <= 0) return "unpriced";
  const resolved = pass4576ResolveSourceTimestampSeconds(quote);
  if (resolved === null) return "missing-clock";
  const now = pass4575NowSeconds();
  if (resolved - now > 300) return "future-clock";
  const age = Math.max(0, now - resolved);
  if (age <= pass4575FreshnessBudgetSeconds(category)) return "live";
  if (age <= pass4577SessionAwareBudgetSeconds(category, quote)) {
    const stateText = [quote?.marketState, quote?.regularMarketState, quote?.sessionState].map(pass4577Text).join(" · ");
    if (quote?.isDelayed === true || Number(quote?.delayMinutes ?? 0) > 0 || stateText.includes("delayed")) return "delayed";
    if (pass4577IsCloseBasedCategory(category) || stateText.includes("closed") || stateText.includes("post") || stateText.includes("pre")) return "last-close";
  }
  return "stale";
}

export function pass4577CanShowPercent(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
): boolean {
  const state = pass4577QuoteReliabilityState(quote, category);
  return state === "live" || state === "last-close" || state === "delayed";
}

export function pass4577CanShowChart(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
  minimumCandles = 2,
): boolean {
  return pass4577CanShowPercent(quote, category) && pass4575HasSourceCandles(quote, minimumCandles);
}

export function pass4577DisplayTrustCaption(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
): string {
  const state = pass4577QuoteReliabilityState(quote, category);
  if (state === "live") return locale === "pl" ? "źródło live" : locale === "de" ? "Live-Quelle" : "source live";
  if (state === "last-close") return locale === "pl" ? "ostatnie zamknięcie" : locale === "de" ? "letzter Schlusskurs" : "last close";
  if (state === "delayed") return locale === "pl" ? "źródło opóźnione" : locale === "de" ? "verzögerte Quelle" : "delayed source";
  if (state === "missing-clock") return locale === "pl" ? "brak czasu źródła" : locale === "de" ? "Quellzeit fehlt" : "source time missing";
  if (state === "future-clock") return locale === "pl" ? "czas źródła do kontroli" : locale === "de" ? "Quellzeit prüfen" : "source time review";
  if (state === "stale") return locale === "pl" ? "źródło przestarzałe" : locale === "de" ? "Quelle veraltet" : "source stale";
  if (state === "unpriced") return locale === "pl" ? "cena niedostępna" : locale === "de" ? "Preis fehlt" : "price pending";
  if (state === "fallback") return locale === "pl" ? "fallback odrzucony" : locale === "de" ? "Fallback verworfen" : "fallback rejected";
  return locale === "pl" ? "weryfikacja" : locale === "de" ? "Prüfung" : "review";
}


export const PASS4578_VISIBLE_TRUST_RIBBON_CONTRACT = {
  passId: "PASS4578",
  purpose:
    "Turn PASS4577 reliability states into a small customer-facing trust ribbon and modal receipt so Real Markets explains why a value is live, delayed, last-close or withheld without showing a debug wall.",
  publicTopkaLiveAllowed: false,
  rule:
    "Every visible Real Markets quote row should expose the same eligibility decision used by percentages and charts: state, tone, timestamp, age, percent visibility and chart visibility.",
} as const;

export type Pass4578VisibleTrustTone = "live" | "close" | "delayed" | "hold" | "review";

export type Pass4578VisibleTrustReceipt = {
  state: Pass4577QuoteReliability;
  tone: Pass4578VisibleTrustTone;
  caption: string;
  reason: string;
  sourceTimestamp: number | null;
  ageSeconds: number | null;
  canShowPercent: boolean;
  canShowChart: boolean;
};

export function pass4578TrustTone(state: Pass4577QuoteReliability): Pass4578VisibleTrustTone {
  if (state === "live") return "live";
  if (state === "last-close") return "close";
  if (state === "delayed") return "delayed";
  if (state === "fallback" || state === "missing-clock" || state === "future-clock" || state === "stale" || state === "unpriced") return "hold";
  return "review";
}

export function pass4578TrustReason(
  state: Pass4577QuoteReliability,
  locale: "pl" | "de" | "en",
): string {
  const copy = {
    pl: {
      live: "ruch i chart mogą być pokazane",
      "last-close": "ostatni kurs z sesji, nie tick live",
      delayed: "opóźniony provider, oznaczone jawnie",
      "missing-clock": "brakuje czasu źródła",
      "future-clock": "czas źródła wygląda podejrzanie",
      stale: "źródło po limicie świeżości",
      unpriced: "brak poprawnej ceny",
      fallback: "fallback/mock nie może udawać rynku",
      review: "wymaga kontroli providera",
    },
    de: {
      live: "Bewegung und Chart dürfen angezeigt werden",
      "last-close": "letzter Sitzungskurs, kein Live-Tick",
      delayed: "verzögerter Provider, klar markiert",
      "missing-clock": "Quellzeit fehlt",
      "future-clock": "Quellzeit wirkt verdächtig",
      stale: "Quelle über Freshness-Limit",
      unpriced: "gültiger Preis fehlt",
      fallback: "Fallback/Mock darf keinen Markt vortäuschen",
      review: "Providerprüfung erforderlich",
    },
    en: {
      live: "move and chart may be shown",
      "last-close": "last session price, not a live tick",
      delayed: "delayed provider, clearly labelled",
      "missing-clock": "source time missing",
      "future-clock": "source time looks suspicious",
      stale: "source exceeds freshness limit",
      unpriced: "valid price missing",
      fallback: "fallback/mock cannot pretend to be market data",
      review: "provider review required",
    },
  } as const;
  return copy[locale][state];
}

export function pass4578QuoteDisplayEligibility(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
  minimumCandles = 2,
): Pass4578VisibleTrustReceipt {
  const state = pass4577QuoteReliabilityState(quote, category);
  const sourceTimestamp = pass4576ResolveSourceTimestampSeconds(quote);
  const ageSeconds = sourceTimestamp === null ? null : Math.max(0, pass4575NowSeconds() - sourceTimestamp);
  return {
    state,
    tone: pass4578TrustTone(state),
    caption: pass4577DisplayTrustCaption(quote, category, locale),
    reason: pass4578TrustReason(state, locale),
    sourceTimestamp,
    ageSeconds,
    canShowPercent: pass4577CanShowPercent(quote, category),
    canShowChart: pass4577CanShowChart(quote, category, minimumCandles),
  };
}

export const PASS4579_VISIBLE_DATA_DECISION_CONTRACT = {
  passId: "PASS4579",
  purpose:
    "Close the last customer-trust gap on Real Markets rows and modals: the same rule that decides percent/chart visibility must also decide copy, age labels, status wording and hidden receipts.",
  publicTopkaLiveAllowed: false,
  rule:
    "No row may show a movement, chart, green/red tone or AI audit metric without a compact source decision explaining live / last close / delayed / withheld. Source age must be human readable and missing clocks must stay neutral.",
} as const;

export type Pass4579DataDecisionLevel = "show" | "limited" | "withheld";

export type Pass4579VisibleDataDecision = Pass4578VisibleTrustReceipt & {
  decision: Pass4579DataDecisionLevel;
  freshnessLabel: string;
  actionLabel: string;
  compactLabel: string;
  auditStatus: "verified" | "review" | "missing";
};

export function pass4579SourceAgeLabel(ageSeconds: number | null, locale: "pl" | "de" | "en"): string {
  if (typeof ageSeconds !== "number" || !Number.isFinite(ageSeconds)) {
    return locale === "pl" ? "czas źródła: brak" : locale === "de" ? "Quellzeit: fehlt" : "source time: missing";
  }
  const minutes = Math.floor(ageSeconds / 60);
  const hours = Math.floor(ageSeconds / 3600);
  const days = Math.floor(ageSeconds / 86_400);
  if (ageSeconds < 90) return locale === "pl" ? "teraz" : locale === "de" ? "jetzt" : "now";
  if (minutes < 60) return locale === "pl" ? `${minutes} min temu` : locale === "de" ? `vor ${minutes} Min.` : `${minutes}m ago`;
  if (hours < 48) return locale === "pl" ? `${hours} h temu` : locale === "de" ? `vor ${hours} Std.` : `${hours}h ago`;
  return locale === "pl" ? `${days} d temu` : locale === "de" ? `vor ${days} Tg.` : `${days}d ago`;
}

export function pass4579ActionLabel(
  receipt: Pass4578VisibleTrustReceipt,
  locale: "pl" | "de" | "en",
): string {
  if (receipt.canShowChart && receipt.canShowPercent) {
    return locale === "pl" ? "wartość + wykres dozwolone" : locale === "de" ? "Wert + Chart erlaubt" : "value + chart allowed";
  }
  if (receipt.canShowPercent) {
    return locale === "pl" ? "wartość dozwolona, chart oczekuje" : locale === "de" ? "Wert erlaubt, Chart wartet" : "value allowed, chart pending";
  }
  if (receipt.state === "last-close" || receipt.state === "delayed") {
    return locale === "pl" ? "oznaczone, bez udawania live" : locale === "de" ? "markiert, kein Live-Schein" : "labelled, not pretending live";
  }
  return locale === "pl" ? "ukryte do czasu źródła" : locale === "de" ? "bis zur Quelle verborgen" : "withheld until source proof";
}

export function pass4579VisibleDataDecision(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
  minimumCandles = 2,
): Pass4579VisibleDataDecision {
  const receipt = pass4578QuoteDisplayEligibility(quote, category, locale, minimumCandles);
  const decision: Pass4579DataDecisionLevel = receipt.canShowChart && receipt.canShowPercent
    ? "show"
    : receipt.canShowPercent
      ? "limited"
      : "withheld";
  const freshnessLabel = pass4579SourceAgeLabel(receipt.ageSeconds, locale);
  const actionLabel = pass4579ActionLabel(receipt, locale);
  return {
    ...receipt,
    decision,
    freshnessLabel,
    actionLabel,
    compactLabel: `${receipt.caption} · ${freshnessLabel}`,
    auditStatus: decision === "show" ? "verified" : decision === "limited" ? "review" : "missing",
  };
}

