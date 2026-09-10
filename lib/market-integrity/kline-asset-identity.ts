import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS6_KLINE_ASSET_IDENTITY_ID = "pass6-kline-asset-identity-v1" as const;
export const PASS6_EXACT_USD_VENUE_IDENTITY_REGISTRY = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
} as const;

export type KlineAssetIdentity = {
  assetClass: "crypto";
  marketId: string;
  symbol: string;
  quote: "USD";
  chainId: string | null;
  address: string | null;
};

export type ResolvedKlineAssetIdentity = KlineAssetIdentity & {
  schemaVersion: typeof PASS6_KLINE_ASSET_IDENTITY_ID;
  exactMatch: true;
  resolver: "coingecko_coin_id_and_server_venue_registry";
  providerObservedAt: string | null;
  receivedAt: string;
  identityDigest: string;
};

export type KlineRequestContract = {
  identity: KlineAssetIdentity;
  range: "1m" | "15m" | "1h" | "4h" | "1d" | "7d" | "1mo";
};

export type KlineIdentityFailureCode =
  | "invalid_request"
  | "identity_not_found"
  | "identity_ambiguous"
  | "identity_provider_unavailable";

export type KlineIdentityResolution =
  | { ok: true; identity: ResolvedKlineAssetIdentity }
  | { ok: false; code: KlineIdentityFailureCode; status: 400 | 404 | 409 | 502; error: string };

const ALLOWED_PARAMS = new Set(["assetClass", "marketId", "symbol", "quote", "chainId", "address", "range", "dev", "live"]);
const RANGES = new Set<KlineRequestContract["range"]>(["1m", "15m", "1h", "4h", "1d", "7d", "1mo"]);
const MARKET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SYMBOL = /^[A-Z0-9]{1,16}$/u;
const CHAIN_ID = /^[a-z0-9][a-z0-9._-]{0,47}$/u;
const ADDRESS = /^[A-Za-z0-9:._-]{2,128}$/u;
const MAX_QUERY_CHARS = 512;

function one(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0].trim() : null;
}

function normalizedIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function identityPayload(identity: KlineAssetIdentity) {
  return {
    assetClass: identity.assetClass,
    marketId: identity.marketId,
    symbol: identity.symbol,
    quote: identity.quote,
    chainId: identity.chainId,
    address: identity.address,
  };
}

export function canonicalKlineIdentityDigest(identity: KlineAssetIdentity) {
  return sha256Digest(canonicalJson(identityPayload(identity)));
}

export function isCanonicalKlineAssetIdentity(value: unknown): value is KlineAssetIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<KlineAssetIdentity>;
  return (
    candidate.assetClass === "crypto" &&
    typeof candidate.marketId === "string" && candidate.marketId.length <= 96 && MARKET_ID.test(candidate.marketId) &&
    typeof candidate.symbol === "string" && SYMBOL.test(candidate.symbol) &&
    candidate.quote === "USD" &&
    (candidate.chainId === null || (typeof candidate.chainId === "string" && CHAIN_ID.test(candidate.chainId))) &&
    (candidate.address === null || (
      typeof candidate.address === "string" &&
      candidate.chainId !== null &&
      ADDRESS.test(candidate.address)
    ))
  );
}

export function canonicalKlineSnapshotKey(identity: KlineAssetIdentity, range: string) {
  const digest = canonicalKlineIdentityDigest(identity).replace(/^sha256:/u, "");
  return `k2_${digest}:${range.trim().toLowerCase()}`;
}

export function sameKlineIdentity(left: KlineAssetIdentity, right: KlineAssetIdentity) {
  return canonicalKlineIdentityDigest(left) === canonicalKlineIdentityDigest(right);
}

export function parseKlineRequestContract(url: URL):
  | { ok: true; value: KlineRequestContract }
  | { ok: false; error: string } {
  if (url.search.length > MAX_QUERY_CHARS) return { ok: false, error: "Kline query is too large" };
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_PARAMS.has(key)) return { ok: false, error: `Unsupported query parameter: ${key}` };
    if (url.searchParams.getAll(key).length !== 1) return { ok: false, error: `Duplicate query parameter: ${key}` };
  }

  const assetClass = one(url.searchParams, "assetClass");
  const marketId = one(url.searchParams, "marketId")?.toLowerCase() ?? null;
  const symbol = one(url.searchParams, "symbol")?.toUpperCase() ?? null;
  const quote = one(url.searchParams, "quote")?.toUpperCase() ?? null;
  const range = one(url.searchParams, "range") ?? "7d";
  const chainIdValue = one(url.searchParams, "chainId");
  const addressValue = one(url.searchParams, "address");
  const chainId = chainIdValue?.toLowerCase() ?? null;
  const address = addressValue ?? null;

  if (assetClass !== "crypto") return { ok: false, error: "Unsupported or missing assetClass" };
  if (!marketId || marketId.length > 96 || !MARKET_ID.test(marketId)) return { ok: false, error: "Invalid or missing marketId" };
  if (!symbol || !SYMBOL.test(symbol)) return { ok: false, error: "Invalid or missing symbol hint" };
  if (quote !== "USD") return { ok: false, error: "Only the exact USD quote is supported" };
  if (!RANGES.has(range as KlineRequestContract["range"])) return { ok: false, error: "Unsupported kline range" };
  if (url.searchParams.has("chainId") && !chainIdValue) return { ok: false, error: "Invalid chainId" };
  if (url.searchParams.has("address") && !addressValue) return { ok: false, error: "Invalid address" };
  if (chainId && !CHAIN_ID.test(chainId)) return { ok: false, error: "Invalid chainId" };
  if (address && (!chainId || !ADDRESS.test(address))) return { ok: false, error: "Address requires a valid chainId" };

  return {
    ok: true,
    value: {
      identity: {
        assetClass: "crypto",
        marketId,
        symbol,
        quote: "USD",
        chainId,
        address,
      },
      range: range as KlineRequestContract["range"],
    },
  };
}

type CoinGeckoIdentityRow = {
  id?: unknown;
  symbol?: unknown;
  last_updated?: unknown;
};

type CoinGeckoPlatformRow = {
  id?: unknown;
  symbol?: unknown;
  platforms?: unknown;
};

type FetchLike = typeof fetch;

async function identityFetch(url: string, fetchImpl?: FetchLike) {
  if (fetchImpl) {
    return fetchImpl(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_500),
    });
  }
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "Velmere-Integrity/1.0",
  };
  if (process.env.COINGECKO_DEMO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_DEMO_API_KEY;
  if (process.env.COINGECKO_PRO_API_KEY) headers["x-cg-pro-api-key"] = process.env.COINGECKO_PRO_API_KEY;
  return brokeredEgressFetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(4_500),
  }, {
    profile: "coingecko",
    operation: "kline_asset_identity",
    timeoutMs: 4_500,
    maxResponseBytes: 1_048_576,
  });
}

function exactPlatformAddress(platforms: unknown, chainId: string, address: string) {
  if (!platforms || typeof platforms !== "object" || Array.isArray(platforms)) return false;
  const match = Object.entries(platforms as Record<string, unknown>)
    .find(([key]) => key.trim().toLowerCase() === chainId);
  return Boolean(match && typeof match[1] === "string" && match[1].trim() === address.trim());
}

export async function resolveKlineAssetIdentity(
  requested: KlineAssetIdentity,
  options: { fetchImpl?: FetchLike; now?: Date } = {},
): Promise<KlineIdentityResolution> {
  const registeredSymbol = PASS6_EXACT_USD_VENUE_IDENTITY_REGISTRY[
    requested.marketId as keyof typeof PASS6_EXACT_USD_VENUE_IDENTITY_REGISTRY
  ];
  if (!registeredSymbol || registeredSymbol !== requested.symbol) {
    return {
      ok: false,
      code: "identity_ambiguous",
      status: 409,
      error: "Asset has no exact server-owned Kraken/Coinbase USD identity mapping",
    };
  }
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: requested.marketId,
    order: "market_cap_desc",
    per_page: "1",
    page: "1",
    sparkline: "false",
    locale: "en",
  });

  try {
    const response = await identityFetch(`https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`, options.fetchImpl);
    if (!response.ok) {
      if (registeredSymbol === requested.symbol && !requested.address) {
        const base: KlineAssetIdentity = {
          assetClass: "crypto",
          marketId: requested.marketId,
          symbol: requested.symbol,
          quote: "USD",
          chainId: null,
          address: null,
        };
        return {
          ok: true,
          identity: {
            ...base,
            schemaVersion: PASS6_KLINE_ASSET_IDENTITY_ID,
            exactMatch: true,
            resolver: "coingecko_coin_id_and_server_venue_registry",
            providerObservedAt: null,
            receivedAt: (options.now ?? new Date()).toISOString(),
            identityDigest: canonicalKlineIdentityDigest(base),
          },
        };
      }
      return { ok: false, code: "identity_provider_unavailable", status: 502, error: `Identity provider unavailable (${response.status})` };
    }
    const rows = await readJsonResponseBounded<CoinGeckoIdentityRow[]>(response, 1_048_576);
    if (!Array.isArray(rows) || rows.length !== 1) {
      return rows.length === 0
        ? { ok: false, code: "identity_not_found", status: 404, error: "Canonical market identity was not found" }
        : { ok: false, code: "identity_ambiguous", status: 409, error: "Canonical market identity was ambiguous" };
    }
    const row = rows[0];
    const resolvedMarketId = typeof row.id === "string" ? row.id.trim().toLowerCase() : "";
    const resolvedSymbol = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    if (resolvedMarketId !== requested.marketId || resolvedSymbol !== requested.symbol) {
      return { ok: false, code: "identity_ambiguous", status: 409, error: "marketId and symbol do not resolve to one exact asset" };
    }

    if (requested.address) {
      const detailParams = new URLSearchParams({
        localization: "false",
        tickers: "false",
        market_data: "false",
        community_data: "false",
        developer_data: "false",
        sparkline: "false",
      });
      const detailResponse = await identityFetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(requested.marketId)}?${detailParams.toString()}`,
        options.fetchImpl,
      );
      if (!detailResponse.ok) {
        return { ok: false, code: "identity_provider_unavailable", status: 502, error: `Identity platform provider unavailable (${detailResponse.status})` };
      }
      const detail = await readJsonResponseBounded<CoinGeckoPlatformRow>(detailResponse, 1_048_576);
      if (
        detail.id !== requested.marketId ||
        typeof detail.symbol !== "string" ||
        detail.symbol.trim().toUpperCase() !== requested.symbol ||
        !requested.chainId ||
        !exactPlatformAddress(detail.platforms, requested.chainId, requested.address)
      ) {
        return { ok: false, code: "identity_ambiguous", status: 409, error: "chain/address does not match the canonical market identity" };
      }
    }

    const base: KlineAssetIdentity = {
      assetClass: "crypto",
      marketId: resolvedMarketId,
      symbol: resolvedSymbol,
      quote: "USD",
      chainId: requested.chainId,
      address: requested.address,
    };
    return {
      ok: true,
      identity: {
        ...base,
        schemaVersion: PASS6_KLINE_ASSET_IDENTITY_ID,
        exactMatch: true,
        resolver: "coingecko_coin_id_and_server_venue_registry",
        providerObservedAt: normalizedIso(row.last_updated),
        receivedAt: (options.now ?? new Date()).toISOString(),
        identityDigest: canonicalKlineIdentityDigest(base),
      },
    };
  } catch {
    return { ok: false, code: "identity_provider_unavailable", status: 502, error: "Canonical identity provider unavailable" };
  }
}
