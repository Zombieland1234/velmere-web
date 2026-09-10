import { createHash } from "node:crypto";
import { R7_ECB_POLICY_REVIEW_SHA256 } from "@/lib/compliance/ecb-statistics-policy-receipt";
import { mapSettledWithConcurrencyLimit } from "@/lib/runtime/bounded-concurrency";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  resolvePass458ProviderTruthQuote,
  type Pass458RangeKey,
  type Pass458TruthQuote,
} from "@/lib/market-integrity/provider-truth-router";
import { rangeConfig, rangeMeta, safeSymbol } from "@/lib/market-integrity/real-markets-catalog";
import { realMarketsProviderResilience } from "@/lib/market-integrity/provider-resilience-runtime";
import { fetchPass69EcbOfficialReferenceData } from "@/lib/network/brokered-egress";
import {
  fetchQuiet,
  finite,
  loadIntradayChangeFallback,
  loadQuoteMetadataFallback,
  type YahooChart,
  type YahooQuoteSummary,
} from "@/lib/market-integrity/real-markets-provider-transport";

export const PASS69_ECB_REFERENCE_DATA_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+PLN+GBP+TRY.EUR.SP00.A?lastNObservations=3&format=csvdata" as const;
export const PASS69_ECB_REUSE_POLICY_URL = "https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html" as const;
export const PASS69_ECB_REUSE_POLICY_REVIEWED_AT = "2026-08-24T16:25:00.000Z" as const;
export const PASS69_ECB_REUSE_POLICY_VALID_UNTIL = "2026-08-31T23:59:59.999Z" as const;
export const PASS69_ECB_REQUIRED_ATTRIBUTION = "Source: ECB statistics." as const;

const PASS69_ECB_DIRECT_SYMBOLS = {
  "EURUSD=X": { pair: "EUR/USD", currency: "USD" },
  "EURPLN=X": { pair: "EUR/PLN", currency: "PLN" },
  "EURGBP=X": { pair: "EUR/GBP", currency: "GBP" },
  "EURTRY=X": { pair: "EUR/TRY", currency: "TRY" },
} as const;

type Pass69EcbDirectProviderSymbol = keyof typeof PASS69_ECB_DIRECT_SYMBOLS;

type Pass69EcbCsvObservation = {
  currency: string;
  date: string;
  value: number;
};

type Pass69EcbCsvParseResult =
  | { ok: true; observations: Pass69EcbCsvObservation[] }
  | { ok: false; blocker: string };

export type Pass69EcbOfficialFxReference = {
  schemaVersion: "velmere.pass69.ecb-official-fx-reference.v1";
  providerSymbol: Pass69EcbDirectProviderSymbol;
  pair: string;
  baseCurrency: "EUR";
  quoteCurrency: string;
  fieldId: "market.reference_rate";
  dateFieldId: "market.reference_date";
  referenceRate: number;
  referenceDate: string;
  referenceAgeDays: number;
  state: "latest_available_reference" | "stale_reference";
  referenceOnly: true;
  executableQuote: false;
  marketPriceFieldEligible: false;
  intradayFreshnessEligible: false;
  derivedRate: false;
  attribution: typeof PASS69_ECB_REQUIRED_ATTRIBUTION;
};

export type Pass69EcbOfficialFxEnvelope = {
  schemaVersion: "velmere.pass69.ecb-official-fx-envelope.v1";
  state: "available" | "not_applicable" | "temporarily_unavailable" | "policy_review_expired";
  fetchedAt: string;
  sourceId: "ecb_statistics";
  sourceLabel: "ECB euro foreign exchange reference rates";
  sourceDataUrl: typeof PASS69_ECB_REFERENCE_DATA_URL;
  sourceUsagePolicyUrl: typeof PASS69_ECB_REUSE_POLICY_URL;
  usagePolicyReviewedAt: typeof PASS69_ECB_REUSE_POLICY_REVIEWED_AT;
  usagePolicyValidUntil: typeof PASS69_ECB_REUSE_POLICY_VALID_UNTIL;
  attribution: typeof PASS69_ECB_REQUIRED_ATTRIBUTION;
  responseSha256: string | null;
  responseBytes: number;
  statisticsModified: false;
  referenceOnly: true;
  executableQuote: false;
  marketPriceFieldEligible: false;
  directPublishedPairsOnly: true;
  requestedProviderSymbols: string[];
  references: Pass69EcbOfficialFxReference[];
  blocker: string | null;
  truthBoundary: string;
};

function pass69ParseCsv(text: string): { rows: string[][]; malformed: boolean } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\n") { row.push(field.replace(/\r$/u, "")); rows.push(row); row = []; field = ""; continue; }
    field += char;
  }
  if (quoted) return { rows: [], malformed: true };
  if (field || row.length) { row.push(field.replace(/\r$/u, "")); rows.push(row); }
  return { rows: rows.filter((items) => items.some((item) => item !== "")), malformed: false };
}

function pass69ParseEcbDirectObservations(text: string): Pass69EcbCsvParseResult {
  const parsed = pass69ParseCsv(text);
  if (parsed.malformed) return { ok: false, blocker: "ecb_csv_malformed_quotes" };
  const rows = parsed.rows;
  if (rows.length < 2) return { ok: false, blocker: "ecb_csv_rows_missing" };
  const header = rows[0].map((value) => value.trim().toUpperCase());
  const requiredHeaders = [
    "KEY",
    "FREQ",
    "CURRENCY",
    "CURRENCY_DENOM",
    "EXR_TYPE",
    "EXR_SUFFIX",
    "TIME_PERIOD",
    "OBS_VALUE",
  ] as const;
  if (requiredHeaders.some((name) => header.filter((value) => value === name).length !== 1)) {
    return { ok: false, blocker: "ecb_csv_required_header_contract_mismatch" };
  }
  const keyIndex = header.indexOf("KEY");
  const frequencyIndex = header.indexOf("FREQ");
  const currencyIndex = header.indexOf("CURRENCY");
  const denominatorIndex = header.indexOf("CURRENCY_DENOM");
  const exchangeRateTypeIndex = header.indexOf("EXR_TYPE");
  const exchangeRateSuffixIndex = header.indexOf("EXR_SUFFIX");
  const dateIndex = header.indexOf("TIME_PERIOD");
  const valueIndex = header.indexOf("OBS_VALUE");
  const allowedCurrencies = new Set<string>(Object.values(PASS69_ECB_DIRECT_SYMBOLS).map((entry) => entry.currency));
  const observations: Pass69EcbCsvObservation[] = [];
  const observationKeys = new Set<string>();
  for (const items of rows.slice(1)) {
    if (items.length !== header.length) return { ok: false, blocker: "ecb_csv_row_width_mismatch" };
    const key = String(items[keyIndex] ?? "").trim();
    const frequency = String(items[frequencyIndex] ?? "").trim().toUpperCase();
    const currency = String(items[currencyIndex] ?? "").trim().toUpperCase();
    const denominator = String(items[denominatorIndex] ?? "").trim().toUpperCase();
    const exchangeRateType = String(items[exchangeRateTypeIndex] ?? "").trim().toUpperCase();
    const exchangeRateSuffix = String(items[exchangeRateSuffixIndex] ?? "").trim().toUpperCase();
    const date = String(items[dateIndex] ?? "").trim();
    const rawValue = String(items[valueIndex] ?? "").trim();
    const value = Number(rawValue);
    const expectedKey = `EXR.D.${currency}.EUR.SP00.A`;
    if (
      !allowedCurrencies.has(currency)
      || key !== expectedKey
      || frequency !== "D"
      || denominator !== "EUR"
      || exchangeRateType !== "SP00"
      || exchangeRateSuffix !== "A"
    ) {
      return { ok: false, blocker: "ecb_csv_foreign_or_mismatched_series" };
    }
    const parsedDate = Date.parse(`${date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(date)
      || !Number.isFinite(parsedDate)
      || new Date(parsedDate).toISOString().slice(0, 10) !== date
      || rawValue === ""
      || !Number.isFinite(value)
      || value <= 0
    ) {
      return { ok: false, blocker: "ecb_csv_observation_value_or_date_invalid" };
    }
    const observationKey = `${key}:${date}`;
    if (observationKeys.has(observationKey)) {
      return { ok: false, blocker: "ecb_csv_duplicate_observation" };
    }
    observationKeys.add(observationKey);
    observations.push({ currency, date, value });
  }
  return observations.length > 0
    ? { ok: true, observations }
    : { ok: false, blocker: "ecb_csv_rows_missing" };
}

function pass69ReferenceAgeDays(referenceDate: string, now: Date) {
  const referenceDay = Date.parse(`${referenceDate}T00:00:00.000Z`);
  const nowDay = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(referenceDay) || !Number.isFinite(nowDay)) return 9999;
  return Math.max(0, Math.floor((nowDay - referenceDay) / 86_400_000));
}

export async function loadPass69EcbOfficialFxReferenceEnvelope(
  symbols: string[],
  options: { now?: Date } = {},
): Promise<Pass69EcbOfficialFxEnvelope> {
  const now = options.now ?? new Date();
  const fetchedAt = now.toISOString();
  const requestedProviderSymbols = Array.from(new Set(symbols.map((value) => String(value).trim().toUpperCase())))
    .filter((value): value is Pass69EcbDirectProviderSymbol => value in PASS69_ECB_DIRECT_SYMBOLS);
  const base = {
    schemaVersion: "velmere.pass69.ecb-official-fx-envelope.v1" as const,
    fetchedAt,
    sourceId: "ecb_statistics" as const,
    sourceLabel: "ECB euro foreign exchange reference rates" as const,
    sourceDataUrl: PASS69_ECB_REFERENCE_DATA_URL,
    sourceUsagePolicyUrl: PASS69_ECB_REUSE_POLICY_URL,
    usagePolicyReviewedAt: PASS69_ECB_REUSE_POLICY_REVIEWED_AT,
    usagePolicyValidUntil: PASS69_ECB_REUSE_POLICY_VALID_UNTIL,
    attribution: PASS69_ECB_REQUIRED_ATTRIBUTION,
    responseSha256: null,
    responseBytes: 0,
    statisticsModified: false as const,
    referenceOnly: true as const,
    executableQuote: false as const,
    marketPriceFieldEligible: false as const,
    directPublishedPairsOnly: true as const,
    requestedProviderSymbols,
    references: [] as Pass69EcbOfficialFxReference[],
    blocker: null as string | null,
    truthBoundary: "ECB values in this lane are direct published EUR reference statistics only. They never satisfy market.price, executable quote, intraday freshness, trading, risk-verdict, paid-value or sale gates.",
  };
  if (!requestedProviderSymbols.length) return { ...base, state: "not_applicable" };
  if (now.getTime() > Date.parse(PASS69_ECB_REUSE_POLICY_VALID_UNTIL)) {
    return { ...base, state: "policy_review_expired", blocker: "ecb_reuse_policy_review_expired_fail_closed" };
  }
  try {
    const fetchOfficialReference = () => fetchPass69EcbOfficialReferenceData({
      sourceDataUrl: PASS69_ECB_REFERENCE_DATA_URL,
      usagePolicyUrl: PASS69_ECB_REUSE_POLICY_URL,
      usagePolicyReviewedAt: PASS69_ECB_REUSE_POLICY_REVIEWED_AT,
      usagePolicyValidUntil: PASS69_ECB_REUSE_POLICY_VALID_UNTIL,
      rightsReceiptSha256: R7_ECB_POLICY_REVIEW_SHA256,
      attribution: PASS69_ECB_REQUIRED_ATTRIBUTION,
      allowedFieldIds: ["market.reference_rate", "market.reference_date"],
    }, now.getTime());
    let response = await fetchOfficialReference();
    if (response.status === 429 || response.status >= 500) {
      response = await fetchOfficialReference();
    }
    if (!response.ok) return { ...base, state: "temporarily_unavailable", blocker: `ecb_http_${response.status}` };
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (contentType !== "text/csv" && contentType !== "application/vnd.sdmx.data+csv") {
      return { ...base, state: "temporarily_unavailable", blocker: "ecb_response_content_type_invalid" };
    }
    const raw = await response.text();
    const responseBytes = new TextEncoder().encode(raw).byteLength;
    if (responseBytes > 1_000_000) return { ...base, state: "temporarily_unavailable", blocker: "ecb_response_too_large" };
    const responseSha256 = `sha256:${createHash("sha256").update(raw, "utf8").digest("hex")}`;
    const parsed = pass69ParseEcbDirectObservations(raw);
    if (!parsed.ok) {
      return { ...base, state: "temporarily_unavailable", responseSha256, responseBytes, blocker: parsed.blocker };
    }
    const observations = parsed.observations;
    const nowDate = now.toISOString().slice(0, 10);
    if (observations.some((observation) => observation.date > nowDate)) {
      return { ...base, state: "temporarily_unavailable", responseSha256, responseBytes, blocker: "ecb_future_observation_rejected" };
    }
    const latestByCurrency = new Map<string, Pass69EcbCsvObservation>();
    for (const observation of observations) {
      const previous = latestByCurrency.get(observation.currency);
      if (!previous || observation.date > previous.date) latestByCurrency.set(observation.currency, observation);
    }
    const references = requestedProviderSymbols.flatMap((providerSymbol) => {
      const descriptor = PASS69_ECB_DIRECT_SYMBOLS[providerSymbol];
      const observation = latestByCurrency.get(descriptor.currency);
      if (!observation) return [];
      const referenceAgeDays = pass69ReferenceAgeDays(observation.date, now);
      return [{
        schemaVersion: "velmere.pass69.ecb-official-fx-reference.v1" as const,
        providerSymbol,
        pair: descriptor.pair,
        baseCurrency: "EUR" as const,
        quoteCurrency: descriptor.currency,
        fieldId: "market.reference_rate" as const,
        dateFieldId: "market.reference_date" as const,
        referenceRate: observation.value,
        referenceDate: observation.date,
        referenceAgeDays,
        state: referenceAgeDays <= 4 ? "latest_available_reference" as const : "stale_reference" as const,
        referenceOnly: true as const,
        executableQuote: false as const,
        marketPriceFieldEligible: false as const,
        intradayFreshnessEligible: false as const,
        derivedRate: false as const,
        attribution: PASS69_ECB_REQUIRED_ATTRIBUTION,
      }];
    });
    if (references.length !== requestedProviderSymbols.length) {
      return { ...base, state: "temporarily_unavailable", responseSha256, responseBytes, blocker: "ecb_direct_reference_rows_missing" };
    }
    return { ...base, state: "available", responseSha256, responseBytes, references };
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 160) : "ecb_reference_fetch_failed";
    return { ...base, state: "temporarily_unavailable", blocker: code };
  }
}

export async function loadQuoteMetadata(
  symbols: string[],
  options: { hydrateIntraday?: boolean; fallbackLimit?: number } = {},
) {
  const uniqueSymbols = Array.from(new Set(symbols.filter((symbol) => safeSymbol.test(symbol)))).slice(0, 60);
  const hydrateIntraday = options.hydrateIntraday ?? true;
  const fallbackLimit = options.fallbackLimit ?? uniqueSymbols.length;
  const metadata: Record<string, {
    marketCap?: number | null;
    volume24h?: number | null;
    high24h?: number | null;
    low24h?: number | null;
    priceChange24h?: number | null;
    priceChange1h?: number | null;
    currentPrice?: number | null;
    currency?: string | null;
    exchange?: string | null;
    sourceTimestamp?: number | null;
  }> = {};
  if (!uniqueSymbols.length) return metadata;
  try {
    const response = await fetchQuiet(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "Velmere-Market-Integrity/1.0",
        },
        next: { revalidate: 120 },
      },
      2500,
    );
    if (!response?.ok) throw new Error(`quote_metadata_${response?.status ?? "network"}`);
    const payload = await readJsonResponseBounded<YahooQuoteSummary>(response, 2 * 1024 * 1024);
    for (const item of payload.quoteResponse?.result ?? []) {
      const symbol = String(item.symbol ?? "").toUpperCase();
      if (!symbol) continue;
      metadata[symbol] = {
        marketCap: finite(item.marketCap),
        volume24h: finite(item.regularMarketVolume),
        high24h: finite(item.regularMarketDayHigh),
        low24h: finite(item.regularMarketDayLow),
        priceChange24h: finite(item.regularMarketChangePercent),
        currentPrice: finite(item.regularMarketPrice),
        currency: typeof item.currency === "string" ? item.currency : null,
        exchange: typeof item.fullExchangeName === "string" ? item.fullExchangeName : typeof item.exchange === "string" ? item.exchange : null,
        sourceTimestamp: finite(item.regularMarketTime),
      };
    }
  } catch {
    // Real Markets must not crash if Yahoo quote metadata is rate-limited.
  }

  const missingSymbols = uniqueSymbols.filter((symbol) => {
    const entry = metadata[symbol];
    return !entry || [entry.marketCap, entry.priceChange24h, entry.currentPrice].every((value) => value == null);
  });

  if (missingSymbols.length && fallbackLimit > 0) {
    const fallbackRowsSettled = await mapSettledWithConcurrencyLimit(
      missingSymbols.slice(0, fallbackLimit),
      4,
      async (symbol) => [symbol, await loadQuoteMetadataFallback(symbol)] as const,
    );
    const fallbackRows = fallbackRowsSettled.flatMap((entry) => entry.status === "fulfilled" ? [entry.value] : []);
    for (const [symbol, fallback] of fallbackRows) {
      if (!fallback) continue;
      metadata[symbol] = {
        ...metadata[symbol],
        marketCap: fallback.marketCap ?? metadata[symbol]?.marketCap ?? null,
        volume24h: fallback.volume24h ?? metadata[symbol]?.volume24h ?? null,
        high24h: fallback.high24h ?? metadata[symbol]?.high24h ?? null,
        low24h: fallback.low24h ?? metadata[symbol]?.low24h ?? null,
        priceChange24h: fallback.priceChange24h ?? metadata[symbol]?.priceChange24h ?? null,
        currentPrice: fallback.currentPrice ?? metadata[symbol]?.currentPrice ?? null,
        currency: fallback.currency ?? metadata[symbol]?.currency ?? null,
        exchange: fallback.exchange ?? metadata[symbol]?.exchange ?? null,
        sourceTimestamp: fallback.sourceTimestamp ?? metadata[symbol]?.sourceTimestamp ?? null,
      };
    }
  }

  if (hydrateIntraday) {
    const intradayRowsSettled = await mapSettledWithConcurrencyLimit(
      uniqueSymbols.slice(0, fallbackLimit),
      4,
      async (symbol) => [symbol, await loadIntradayChangeFallback(symbol)] as const,
    );
    const intradayRows = intradayRowsSettled.flatMap((entry) => entry.status === "fulfilled" ? [entry.value] : []);
    for (const [symbol, intraday] of intradayRows) {
      if (!intraday) continue;
      metadata[symbol] = {
        ...metadata[symbol],
        priceChange1h: intraday.priceChange1h ?? metadata[symbol]?.priceChange1h ?? null,
        currentPrice: metadata[symbol]?.currentPrice ?? intraday.currentPrice ?? null,
        currency: metadata[symbol]?.currency ?? intraday.currency ?? null,
        exchange: metadata[symbol]?.exchange ?? intraday.exchange ?? null,
        sourceTimestamp: metadata[symbol]?.sourceTimestamp ?? intraday.sourceTimestamp ?? null,
      };
    }
  }

  return metadata;
}

async function loadQuoteDirect(
  id: string,
  symbol: string,
  rangeKey: keyof typeof rangeConfig,
) {
  const startedAt = performance.now();
  const config = rangeConfig[rangeKey];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`;
  try {
    const response = await fetchQuiet(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Velmere-Market-Integrity/1.0",
      },
      next: {
        revalidate:
          rangeKey === "15m" || rangeKey === "1h" || rangeKey === "4h" || rangeKey === "1d"
            ? 60
            : 300,
      },
    }, 2600);
    if (!response?.ok) throw new Error(`provider_${response?.status ?? "network"}`);
    const payload = await readJsonResponseBounded<YahooChart>(response, 2 * 1024 * 1024);
    const sourceReceivedAt = new Date().toISOString();
    const sourceLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp || [];
    if (!result || !quote || !timestamps.length)
      throw new Error("provider_empty");

    const byTimestamp = new Map<number, { timestamp: number; open: number; high: number; low: number; close: number; volume: number | null }>();
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index];
      const open = quote.open?.[index];
      const high = quote.high?.[index];
      const low = quote.low?.[index];
      const close = quote.close?.[index];
      if (
        typeof timestamp !== "number" ||
        !Number.isFinite(timestamp) ||
        timestamp <= 0 ||
        typeof open !== "number" ||
        !Number.isFinite(open) ||
        open <= 0 ||
        typeof high !== "number" ||
        !Number.isFinite(high) ||
        high <= 0 ||
        typeof low !== "number" ||
        !Number.isFinite(low) ||
        low <= 0 ||
        typeof close !== "number" ||
        !Number.isFinite(close) ||
        close <= 0 ||
        high < Math.max(open, close) ||
        low > Math.min(open, close)
      ) {
        continue;
      }
      if (!byTimestamp.has(timestamp)) {
        const volumeRaw = quote.volume?.[index];
        const volume = typeof volumeRaw === "number" && Number.isFinite(volumeRaw) && volumeRaw >= 0 ? volumeRaw : null;
        byTimestamp.set(timestamp, { timestamp, open, high, low, close, volume });
      }
    }
    const allCandles = Array.from(byTimestamp.values()).sort((left, right) => left.timestamp - right.timestamp);
    const candles =
      "maxCandles" in config
        ? allCandles.slice(-config.maxCandles)
        : allCandles;
    const currentPrice =
      result.meta?.regularMarketPrice ?? candles.at(-1)?.close ?? null;
    const previousClose =
      candles[0]?.open ?? result.meta?.chartPreviousClose ?? null;
    const changePercent =
      currentPrice !== null && previousClose
        ? ((currentPrice - previousClose) / previousClose) * 100
        : null;

    const metaWithVolume = result.meta as (typeof result.meta & { regularMarketVolume?: number; regularMarketChangePercent?: number }) | undefined;
    const volume24h = metaWithVolume?.regularMarketVolume ?? candles.at(-1)?.volume ?? null;
    const priceChange24h = typeof metaWithVolume?.regularMarketChangePercent === "number"
      ? metaWithVolume.regularMarketChangePercent
      : (currentPrice !== null && result.meta?.chartPreviousClose)
        ? ((currentPrice - result.meta.chartPreviousClose) / result.meta.chartPreviousClose) * 100
        : null;

    // Approximate 1h and 7d from recent candles if available
    let priceChange1h: number | null = null;
    if (candles.length >= 2 && currentPrice !== null) {
      const prev1 = candles[candles.length - 2]?.close;
      if (typeof prev1 === "number" && prev1 > 0) {
        priceChange1h = ((currentPrice - prev1) / prev1) * 100;
      }
    }
    let priceChange7d: number | null = null;
    if (candles.length >= 5 && currentPrice !== null) {
      const prev7 = candles[Math.max(0, candles.length - 7)]?.close || candles[0]?.open;
      if (typeof prev7 === "number" && prev7 > 0) {
        priceChange7d = ((currentPrice - prev7) / prev7) * 100;
      }
    }
    const sourceTimestamp =
      result.meta?.regularMarketTime ?? candles.at(-1)?.timestamp ?? null;

    return {
      id,
      symbol,
      state: "live" as const,
      source: "Yahoo Finance chart adapter",
      sourceTimestamp,
      sourceReceivedAt,
      sourceLatencyMs,
      sourceCapabilities: [
        "identity",
        "price",
        "quote",
        ...(candles.length >= 2 ? ["history"] : []),
        ...(candles.some((candle) => typeof candle.volume === "number") ? ["volume"] : []),
        ...(result.meta?.currency ? ["currency"] : []),
        ...(result.meta?.exchangeName ? ["exchange"] : []),
        ...(sourceTimestamp ? ["source_timestamp"] : []),
      ],
      exchange: result.meta?.exchangeName || null,
      currency: result.meta?.currency || null,
      currentPrice,
      changePercent,
      volume24h,
      priceChange24h,
      priceChange1h,
      priceChange7d,
      rangeLabel: rangeMeta[rangeKey].label,
      rangeUiLabel: rangeMeta[rangeKey].uiLabel,
      changeBasis: rangeMeta[rangeKey].changeBasis,
      candles,
    };
  } catch {
    return {
      id,
      symbol,
      state: "unavailable" as const,
      source: "Yahoo Finance chart adapter",
      sourceTimestamp: null,
      sourceReceivedAt: null,
      sourceLatencyMs: null,
      sourceCapabilities: [],
      exchange: null,
      currency: null,
      currentPrice: null,
      changePercent: null,
      rangeLabel: rangeMeta[rangeKey].label,
      rangeUiLabel: rangeMeta[rangeKey].uiLabel,
      changeBasis: rangeMeta[rangeKey].changeBasis,
      candles: [],
    };
  }
}

export async function loadQuote(
  id: string,
  symbol: string,
  rangeKey: keyof typeof rangeConfig,
) {
  const result = await realMarketsProviderResilience.execute({
    providerId: "yahoo_chart",
    cacheKey: `yahoo_chart:${symbol.toUpperCase()}:${rangeKey}`,
    freshTtlMs: rangeKey === "15m" || rangeKey === "1h" || rangeKey === "4h" || rangeKey === "1d" ? 60_000 : 300_000,
    staleTtlMs: 6 * 60 * 60_000,
    timeoutMs: 3_200,
    failureThreshold: 3,
    cooldownMs: 30_000,
    maxConcurrent: 6,
    execute: () => loadQuoteDirect(id, symbol, rangeKey),
    validate: (quote) => quote.state === "live" && typeof quote.currentPrice === "number" && Number.isFinite(quote.currentPrice) && quote.candles.length > 0,
  });
  if (!result.ok || !result.value) {
    return {
      ...localUnavailableQuote(id, symbol, rangeKey),
      providerResilience: result,
    };
  }
  return {
    ...result.value,
    state: result.status === "stale_cache" ? "live" as const : result.value.state,
    providerResilience: result,
    freshnessState: result.status === "stale_cache" ? "aging" as const : "fresh" as const,
    sourcePolicy: result.status === "stale_cache"
      ? "Stale provider cache is disclosed and is not eligible as fresh paid evidence."
      : undefined,
  };
}

export function localUnavailableQuote(id: string, symbol: string, rangeKey: keyof typeof rangeConfig): Pass458TruthQuote {
  const now = Date.now();
  return {
    id,
    symbol,
    state: "unavailable",
    source: "Velmère local timeout fallback",
    sourceTimestamp: null,
    sourceReceivedAt: null,
    sourceLatencyMs: null,
    sourceCapabilities: [],
    exchange: null,
    currency: null,
    currentPrice: null,
    changePercent: null,
    rangeLabel: rangeMeta[rangeKey].label,
    rangeUiLabel: rangeMeta[rangeKey].uiLabel,
    changeBasis: rangeMeta[rangeKey].changeBasis,
    candles: [],
    assetClass: "stock",
    truthState: "provider_error",
    providerKind: "provider_pending",
    sourceContract: "Provider timeout fallback: no live-looking chart is rendered until source candles return.",
    sourcePolicy: "Do not convert provider timeouts into fake market data. UI should show a neutral grey skeleton line and missing evidence.",
    providerPlan: ["Retry source adapter", "Keep cached/fixture-free UI state", "Expose missing evidence before verdict"],
    missingReason: `Provider timeout or batch circuit-breaker at ${new Date(now).toISOString()}.`,
    secondSourceRequired: true,
    marketCap: null,
    fdv: null,
    volume24h: null,
    high24h: null,
    low24h: null,
    priceChange1h: null,
    priceChange24h: null,
    priceChange7d: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    docs: [],
    providerStatus: "provider_error",
    primaryProviderConfigured: false,
    providerFunctions: [],
    providerEvidence: [{ label: "Timeout fallback", value: "No source candles attached", source: "Velmère API guard" }],
    consensusState: "unavailable",
    freshnessState: "missing",
    freshnessSeconds: null,
    divergenceBps: null,
    divergenceThresholdBps: 50,
    confidenceCap: 25,
    primaryPrice: null,
    secondaryPrice: null,
    secondarySource: null,
    pass2808ChartReceipt: {
      schemaVersion: "pass2808_chart_receipt_v1",
      status: "skeleton_required",
      range: rangeKey,
      candleCount: 0,
      source: "Velmère API guard",
      sourceTimestamp: null,
      confidence: 25,
      rule: "No live-looking chart without source candles; table must render neutral grey skeleton.",
    },
    consensusNotes: ["PASS2807: provider timeout contained; route remains 200 with missing evidence instead of 500.", "PASS2808: chart receipt marks provider timeout as skeleton_required."],
  } as Pass458TruthQuote;
}

export async function resolveRealMarketQuoteSafely({
  id,
  symbol,
  rangeKey,
  providerRangeKey,
  detail,
  requestedLength,
}: {
  id: string;
  symbol: string;
  rangeKey: keyof typeof rangeConfig;
  providerRangeKey: Pass458RangeKey;
  detail: boolean;
  requestedLength: number;
}) {
  try {
    return await resolvePass458ProviderTruthQuote({
      id,
      symbol,
      rangeKey: providerRangeKey,
      compatibilityLoader: loadQuote,
      allowKeyedProvider: detail && requestedLength === 1,
    });
  } catch {
    try {
      const compatibility = await loadQuote(id, symbol, rangeKey);
      return {
        ...localUnavailableQuote(id, symbol, rangeKey),
        ...compatibility,
        truthState: compatibility.state === "live" ? "compatibility_adapter" : "provider_error",
        providerKind: compatibility.state === "live" ? "compatibility_yahoo" : "provider_pending",
        providerStatus: compatibility.state === "live" ? "source_bound" : "provider_error",
        providerEvidence: [{ label: "Compatibility fallback", value: compatibility.state, source: compatibility.source }],
      } as Pass458TruthQuote;
    } catch {
      return localUnavailableQuote(id, symbol, rangeKey);
    }
  }
}
