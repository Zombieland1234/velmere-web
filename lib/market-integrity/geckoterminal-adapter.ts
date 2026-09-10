import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
export type GeckoTerminalTimeframe = "minute" | "hour" | "day";

export type GeckoTerminalOhlcvPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type GeckoTerminalPoolOhlcvResult = {
  version: "pass2449-geckoterminal-pool-ohlcv-v1";
  mode: "partial" | "blocked" | "degraded";
  provider: "GeckoTerminal";
  network?: string;
  poolAddress?: string;
  timeframe: GeckoTerminalTimeframe;
  aggregate: number;
  limit: number;
  points: GeckoTerminalOhlcvPoint[];
  confidenceCap: number;
  missingData: string[];
  boundary: string;
  generatedAt: string;
};

function sanitizeSlug(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

function sanitizeAddress(value?: string | null) {
  return (value ?? "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function parsePoint(item: unknown): GeckoTerminalOhlcvPoint | null {
  if (!Array.isArray(item) || item.length < 6) return null;
  const timestamp = finiteNumber(item[0]);
  const open = finiteNumber(item[1]);
  const high = finiteNumber(item[2]);
  const low = finiteNumber(item[3]);
  const close = finiteNumber(item[4]);
  const volume = finiteNumber(item[5]);
  if ([timestamp, open, high, low, close, volume].some((value) => value === undefined)) return null;
  return { timestamp: timestamp!, open: open!, high: high!, low: low!, close: close!, volume: volume! };
}

function normalizeTimeframe(value?: string | null): GeckoTerminalTimeframe {
  const lower = (value ?? "").toLowerCase();
  if (lower === "minute" || lower === "hour" || lower === "day") return lower;
  return "day";
}

export async function fetchGeckoTerminalPoolOhlcv(args: {
  network?: string | null;
  poolAddress?: string | null;
  timeframe?: string | null;
  aggregate?: number;
  limit?: number;
  currency?: "usd" | "token";
  token?: "base" | "quote";
}): Promise<GeckoTerminalPoolOhlcvResult> {
  const network = sanitizeSlug(args.network);
  const poolAddress = sanitizeAddress(args.poolAddress);
  const timeframe = normalizeTimeframe(args.timeframe);
  const aggregate = Math.max(1, Math.min(30, Math.round(args.aggregate ?? 1)));
  const limit = Math.max(1, Math.min(1000, Math.round(args.limit ?? 365)));
  const generatedAt = new Date().toISOString();
  const boundary = "GeckoTerminal OHLCV is pool-specific DEX history. It can diverge from listed-market aggregators and cannot prove global liquidity or contract safety.";

  if (!network || !poolAddress) {
    return {
      version: "pass2449-geckoterminal-pool-ohlcv-v1",
      mode: "blocked",
      provider: "GeckoTerminal",
      network: network || undefined,
      poolAddress: poolAddress || undefined,
      timeframe,
      aggregate,
      limit,
      points: [],
      confidenceCap: 0,
      missingData: ["network", "pool address", "pool OHLCV payload"],
      boundary,
      generatedAt,
    };
  }

  const params = new URLSearchParams({ aggregate: String(aggregate), limit: String(limit), currency: args.currency ?? "usd", token: args.token ?? "base" });
  const url = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network)}/pools/${encodeURIComponent(poolAddress)}/ohlcv/${timeframe}?${params.toString()}`;

  try {
    const response = await brokeredEgressFetch(url, {
      headers: { accept: "application/json", "user-agent": "VelmereRiskEngine/2449" },
      cache: "no-store",
    }, { profile: "gecko_terminal", operation: "geckoterminal_ohlcv", timeoutMs: 8_000 });
    if (!response.ok) {
      return {
        version: "pass2449-geckoterminal-pool-ohlcv-v1",
        mode: "degraded",
        provider: "GeckoTerminal",
        network,
        poolAddress,
        timeframe,
        aggregate,
        limit,
        points: [],
        confidenceCap: 12,
        missingData: [`GeckoTerminal HTTP ${response.status}`, "fallback to primary market chart"],
        boundary,
        generatedAt,
      };
    }
    const json = await readJsonResponseBounded<{ data?: { attributes?: { ohlcv_list?: unknown[] } } }>(response, 2_000_000);
    const points = (json.data?.attributes?.ohlcv_list ?? []).map(parsePoint).filter((item): item is GeckoTerminalOhlcvPoint => Boolean(item));
    return {
      version: "pass2449-geckoterminal-pool-ohlcv-v1",
      mode: points.length ? "partial" : "degraded",
      provider: "GeckoTerminal",
      network,
      poolAddress,
      timeframe,
      aggregate,
      limit,
      points,
      confidenceCap: points.length >= 180 ? 68 : points.length >= 40 ? 52 : 28,
      missingData: points.length ? ["second provider agreement", "pool liquidity stress replay"] : ["pool OHLCV points"],
      boundary,
      generatedAt,
    };
  } catch (error) {
    return {
      version: "pass2449-geckoterminal-pool-ohlcv-v1",
      mode: "degraded",
      provider: "GeckoTerminal",
      network,
      poolAddress,
      timeframe,
      aggregate,
      limit,
      points: [],
      confidenceCap: 10,
      missingData: [error instanceof Error ? error.message : "GeckoTerminal request failed", "fallback to primary market chart"],
      boundary,
      generatedAt,
    };
  }
}
