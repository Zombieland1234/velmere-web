import { readJsonResponseBounded, readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { buildPass2814ProviderFetchFirewall } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";
import { safeSymbol } from "@/lib/market-integrity/real-markets-catalog";

export type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        exchangeName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export type YahooQuoteSummary = {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      marketCap?: number;
      regularMarketVolume?: number;
      regularMarketDayHigh?: number;
      regularMarketDayLow?: number;
      regularMarketChangePercent?: number;
      regularMarketPrice?: number;
      currency?: string;
      exchange?: string;
      fullExchangeName?: string;
      regularMarketTime?: number;
    }>;
  };
};

export type YahooQuoteSummaryModules = {
  quoteSummary?: {
    result?: Array<{
      price?: {
        marketCap?: { raw?: number };
        regularMarketVolume?: { raw?: number };
        regularMarketDayHigh?: { raw?: number };
        regularMarketDayLow?: { raw?: number };
        regularMarketChangePercent?: { raw?: number };
        regularMarketPrice?: { raw?: number };
        currency?: string;
        exchangeName?: string;
        regularMarketTime?: number;
      };
    }>;
  };
};

export function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type StooqDailyRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export const STOOQ_SYMBOL_OVERRIDES: Record<string, string> = {
  AAPL: "aapl.us",
  NVDA: "nvda.us",
  MSFT: "msft.us",
  GOOGL: "googl.us",
  GOOG: "goog.us",
  AMZN: "amzn.us",
  META: "meta.us",
  ASML: "asml.us",
  SPY: "spy.us",
  QQQ: "qqq.us",
  TSLA: "tsla.us",
  JPM: "jpm.us",
  AMD: "amd.us",
  TSM: "tsm.us",
  AVGO: "avgo.us",
  V: "v.us",
  MA: "ma.us",
  SAP: "sap.de",
  "SAP.DE": "sap.de",
  AIR: "air.fr",
  "AIR.PA": "air.fr",
  BMW: "bmw.de",
  "BMW.DE": "bmw.de",
  MC: "mc.fr",
  "MC.PA": "mc.fr",
  DAX: "^dax",
  "^GDAXI": "^dax",
  WIG20: "wig20",
};

export function stooqSymbolFromYahoo(symbol: string) {
  const clean = symbol.trim().toUpperCase();
  if (!clean || clean.includes("=") || clean.includes("-USD")) return null;
  if (STOOQ_SYMBOL_OVERRIDES[clean]) return STOOQ_SYMBOL_OVERRIDES[clean];
  if (/^[A-Z]{1,5}$/.test(clean)) return `${clean.toLowerCase()}.us`;
  if (clean.endsWith(".DE")) return clean.toLowerCase();
  if (clean.endsWith(".PA")) return clean.replace(".PA", ".fr").toLowerCase();
  if (clean.endsWith(".AS")) return clean.toLowerCase();
  return null;
}

export function parseStooqCsv(text: string): StooqDailyRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).flatMap((line) => {
    const [date, openRaw, highRaw, lowRaw, closeRaw, volumeRaw] = line.split(",");
    if (!date || !openRaw || openRaw.toLowerCase() === "null") return [];
    const open = Number(openRaw);
    const high = Number(highRaw);
    const low = Number(lowRaw);
    const close = Number(closeRaw);
    if (![open, high, low, close].every(Number.isFinite)) return [];
    const volume = Number(volumeRaw);
    return [{
      date,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : null,
    }];
  });
}

export async function fetchQuiet(input: string | URL, init: (RequestInit & { next?: { revalidate: number } }) = {}, timeoutMs = 2500) {
  const pass2814FetchFirewall = buildPass2814ProviderFetchFirewall({
    surface: "Provider Fetch",
    sourceFamily: "yahoo_stooq",
    targetUrl: input.toString(),
    timeoutMs,
    maxResponseBytes: 1_500_000,
  });
  if (pass2814FetchFirewall.releaseGate.status === "block") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await brokeredEgressFetch(input, { ...init, signal: controller.signal }, {
      profile: "real_markets",
      operation: "real_markets_provider_transport",
      timeoutMs,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function stooqTimestamp(date: string) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

export async function loadStooqDailyFallback(symbol: string) {
  const stooqSymbol = stooqSymbolFromYahoo(symbol);
  if (!stooqSymbol) return null;
  const startedAt = performance.now();
  try {
    const response = await fetchQuiet(
      `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`,
      {
        headers: {
          accept: "text/csv,*/*",
          "user-agent": "Velmere-Market-Integrity/1.0",
        },
        next: { revalidate: 300 },
      },
      2200,
    );
    if (!response?.ok) return null;
    const rows = parseStooqCsv(await readTextResponseBounded(response, 512 * 1024)).slice(-260);
    const sourceReceivedAt = new Date().toISOString();
    const sourceLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    if (rows.length < 2) return null;
    const latest = rows.at(-1)!;
    const previous = rows.at(-2)!;
    const sevenBack = rows.at(-8) ?? rows[0];
    const sourceTimestamp = stooqTimestamp(latest.date);
    const priceChange24h =
      previous.close ? ((latest.close - previous.close) / previous.close) * 100 : null;
    const priceChange7d =
      sevenBack?.close ? ((latest.close - sevenBack.close) / sevenBack.close) * 100 : null;
    return {
      id: symbol.toLowerCase(),
      symbol,
      state: "live" as const,
      source: "Stooq daily fallback adapter",
      sourceTimestamp,
      sourceReceivedAt,
      sourceLatencyMs,
      sourceCapabilities: [
        "identity",
        "price",
        "quote",
        "history",
        ...(latest.volume !== null ? ["volume"] : []),
        "currency",
        "exchange",
        ...(sourceTimestamp ? ["source_timestamp"] : []),
      ],
      exchange: "Stooq",
      currency: "USD",
      currentPrice: latest.close,
      changePercent: priceChange24h,
      priceChange24h,
      priceChange7d,
      volume24h: latest.volume,
      candles: rows.map((row) => ({
        timestamp: stooqTimestamp(row.date) ?? sourceTimestamp ?? 0,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      })).filter((candle) => candle.timestamp > 0),
      truthState: "source_bound" as const,
      providerKind: "stooq_daily",
      providerStatus: "source_bound" as const,
      providerEvidence: [
        { label: "Fallback provider", value: "Stooq daily CSV", source: "stooq.com" },
      ],
      docs: ["https://stooq.com/q/d/l/"],
      freshnessState: sourceTimestamp ? "aging" as const : "missing" as const,
    };
  } catch {
    return null;
  }
}

export async function loadQuoteMetadataFallback(symbol: string) {
  try {
    const response = await fetchQuiet(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "Velmere-Market-Integrity/1.0",
        },
        next: { revalidate: 180 },
      },
      2200,
    );
    if (!response?.ok) return null;
    const payload = await readJsonResponseBounded<YahooQuoteSummaryModules>(response, 512 * 1024);
    const price = payload.quoteSummary?.result?.[0]?.price;
    if (!price) return null;
    return {
      marketCap: finite(price.marketCap?.raw),
      volume24h: finite(price.regularMarketVolume?.raw),
      high24h: finite(price.regularMarketDayHigh?.raw),
      low24h: finite(price.regularMarketDayLow?.raw),
      priceChange24h: finite(price.regularMarketChangePercent?.raw),
      currentPrice: finite(price.regularMarketPrice?.raw),
      currency: typeof price.currency === "string" ? price.currency : null,
      exchange: typeof price.exchangeName === "string" ? price.exchangeName : null,
      sourceTimestamp: finite(price.regularMarketTime),
    };
  } catch {
    return null;
  }
}

export async function loadIntradayChangeFallback(symbol: string) {
  if (!safeSymbol.test(symbol)) return null;
  try {
    const response = await fetchQuiet(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=false`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "Velmere-Market-Integrity/1.0",
        },
        next: { revalidate: 60 },
      },
      2200,
    );
    if (!response?.ok) return null;
    const payload = await readJsonResponseBounded<YahooChart>(response, 2 * 1024 * 1024);
    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = quote?.close ?? [];
    const points = timestamps
      .map((timestamp, index) => ({ timestamp, close: finite(closes[index]) }))
      .filter((point): point is { timestamp: number; close: number } =>
        typeof point.timestamp === "number" && Number.isFinite(point.timestamp) && point.close !== null,
      );
    if (points.length < 2) return null;
    const latest = points.at(-1)!;
    const oneHourTarget = latest.timestamp - 60 * 60;
    const oneHourReference = [...points].reverse().find((point) => point.timestamp <= oneHourTarget) ?? points[0];
    const priceChange1h = oneHourReference.close
      ? ((latest.close - oneHourReference.close) / oneHourReference.close) * 100
      : null;
    return {
      currentPrice: finite(result?.meta?.regularMarketPrice) ?? latest.close,
      currency: typeof result?.meta?.currency === "string" ? result.meta.currency : null,
      exchange: typeof result?.meta?.exchangeName === "string" ? result.meta.exchangeName : null,
      sourceTimestamp: finite(result?.meta?.regularMarketTime) ?? latest.timestamp,
      priceChange1h,
    };
  } catch {
    return null;
  }
}
