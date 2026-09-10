import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { klineRangeProfile } from "./verified-kline-quality";
import type { BinanceKlineInterval, MarketCandle } from "./kline-types";

export type { BinanceKlineInterval, MarketCandle } from "./kline-types";

const BINANCE_KLINE_BASES = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
] as const;

type RawKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type FetchLike = typeof fetch;

type BinanceFetchOptions = {
  fetchImpl?: FetchLike;
  nowMs?: number;
  requestTimeoutMs?: number;
  bases?: readonly string[];
};

function n(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function validCandle(item: MarketCandle) {
  return (
    item.timestamp > 0 && item.open > 0 && item.high >= Math.max(item.open, item.close) &&
    item.low > 0 && item.low <= Math.min(item.open, item.close) && item.close > 0 && item.volume >= 0
  );
}

function parseRows(payload: unknown): MarketCandle[] {
  if (!Array.isArray(payload)) throw new Error("invalid-payload");
  return (payload as RawKline[])
    .map((row) => ({
      timestamp: n(row[0]),
      open: n(row[1]),
      high: n(row[2]),
      low: n(row[3]),
      close: n(row[4]),
      volume: n(row[5]),
      quoteVolume: n(row[7]),
      trades: n(row[8]),
    }))
    .filter(validCandle);
}

function dedupe(candles: MarketCandle[], maximumBars: number) {
  const rows = new Map<number, MarketCandle>();
  for (const candle of candles) {
    if (!rows.has(candle.timestamp)) rows.set(candle.timestamp, candle);
  }
  return Array.from(rows.values()).sort((left, right) => left.timestamp - right.timestamp).slice(-maximumBars);
}

async function fetchPages(args: {
  base: string;
  pair: string;
  range: BinanceKlineInterval;
  fetchImpl: FetchLike;
  nowMs: number;
  requestTimeoutMs: number;
}) {
  const profile = klineRangeProfile(args.range);
  const targetBars = Math.min(profile.maximumBars, profile.targetBars);
  const perPage = 1_000;
  const maxPages = Math.max(1, Math.min(4, Math.ceil(targetBars / perPage) + 1));
  const collected: MarketCandle[] = [];
  let endTime = args.nowMs;
  let pages = 0;

  while (pages < maxPages && collected.length < targetBars) {
    const remaining = targetBars - collected.length;
    const params = new URLSearchParams({
      symbol: args.pair,
      interval: profile.providerSourceInterval.binance,
      limit: String(Math.min(perPage, Math.max(profile.minimumBars, remaining))),
      endTime: String(Math.floor(endTime)),
    });
    const response = await args.fetchImpl(`${args.base}/api/v3/klines?${params.toString()}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(args.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const payload = await readJsonResponseBounded<unknown>(response, 4_194_304);
    const page = parseRows(payload);
    pages += 1;
    if (!page.length) break;
    collected.unshift(...page);
    const earliest = page[0]?.timestamp;
    if (!earliest || earliest >= endTime) break;
    endTime = earliest - 1;
    if (page.length < Math.min(perPage, Math.max(profile.minimumBars, remaining))) break;
  }

  return { candles: dedupe(collected, targetBars), pages };
}

export async function fetchBinanceKlines(
  symbol: string,
  range: BinanceKlineInterval = "7d",
  options: BinanceFetchOptions = {},
): Promise<{ pair: string; source: string; candles: MarketCandle[]; providerErrors: string[]; pages: number }> {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) throw new Error("Missing symbol");
  const pair = clean.endsWith("USDT") ? clean : `${clean}USDT`;
  const profile = klineRangeProfile(range);
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = typeof options.nowMs === "number" && Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const requestTimeoutMs = Math.max(1_000, Math.min(12_000, options.requestTimeoutMs ?? 6_500));
  const bases = options.bases?.length ? options.bases : BINANCE_KLINE_BASES;
  const providerErrors: string[] = [];

  for (const base of bases) {
    const host = new URL(base).host;
    try {
      const result = await fetchPages({ base, pair, range, fetchImpl, nowMs, requestTimeoutMs });
      if (result.candles.length < profile.minimumBars) {
        providerErrors.push(`${host}:sparse-${result.candles.length}/${profile.minimumBars}`);
        continue;
      }
      return {
        pair,
        source: `Binance Spot · ${host} · ${profile.providerSourceInterval.binance} · ${result.candles.length} closed-candidate bars · ${result.pages} page(s)`,
        candles: result.candles,
        providerErrors,
        pages: result.pages,
      };
    } catch (error) {
      providerErrors.push(`${host}:${error instanceof Error ? error.message : "network"}`);
    }
  }

  throw new Error(`Binance kline providers unavailable (${providerErrors.join(", ")})`);
}
