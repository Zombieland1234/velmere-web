export type TokenMetadataProviderStatus = "active_preview" | "planned" | "blocked";
export type TokenMetadataCacheMode = "curated" | "provider_ready" | "missing";

export type TokenMetadataRecord = {
  id: string;
  symbol: string;
  name: string;
  rank?: number;
  logoUrl?: string;
  logoMode: "curated_url" | "fallback_avatar" | "provider_pending";
  chainHints: string[];
  tags: string[];
  sourceId: string;
  sourceConfidence: number;
  updatedAt: string;
};

export type TokenMetadataProvider = {
  id: string;
  status: TokenMetadataProviderStatus;
  priority: "P0" | "P1" | "P2";
  label: string;
  purpose: string;
  cachePolicy: string;
  missing: string[];
  nextStep: string;
  productionBoundary: string;
};

export type TokenMetadataCacheSnapshot = {
  schemaVersion: "velmere-token-metadata-cache-v1";
  mode: TokenMetadataCacheMode;
  generatedAt: string;
  query: string;
  records: TokenMetadataRecord[];
  providers: TokenMetadataProvider[];
  externalFetchPerformed: false;
  storageWritePerformed: false;
  productionBoundary: string;
};

const generatedAt = "2026-06-03T00:00:00.000Z";

export const tokenMetadataProviders: TokenMetadataProvider[] = [
  {
    id: "velmere-curated-token-index",
    status: "active_preview",
    priority: "P0",
    label: "Velmère curated token index",
    purpose: "Serve known token metadata, fallback avatars and Shield bridge ids without external fetch during render.",
    cachePolicy: "Local curated table now; future server cache with TTL and source envelope.",
    missing: ["durable cache storage", "provider sync job", "logo proxy"],
    nextStep: "Move external logo references behind a server-controlled metadata route and cache snapshot.",
    productionBoundary: "Curated metadata improves UX only; it is not a live source or risk verdict.",
  },
  {
    id: "token-logo-proxy",
    status: "planned",
    priority: "P0",
    label: "Token logo proxy",
    purpose: "Avoid uncontrolled third-party image loads by proxying and validating token logos server-side.",
    cachePolicy: "Long TTL with checksum/size/type validation before public UI use.",
    missing: ["image proxy route", "content-type validation", "fallback sprite"],
    nextStep: "Implement a small logo proxy or local sprite for high-traffic assets.",
    productionBoundary: "Unknown logo URLs must fall back to symbol avatars.",
  },
  {
    id: "provider-rank-sync",
    status: "planned",
    priority: "P1",
    label: "Provider rank sync",
    purpose: "Refresh symbol/name/rank metadata from a market data provider without hitting provider APIs on every keystroke.",
    cachePolicy: "Server-side stale-while-revalidate style cache after provider selection.",
    missing: ["provider selection", "rate-limit policy", "adapter id in source ledger"],
    nextStep: "Attach a provider contract after cache/rate limits are defined.",
    productionBoundary: "Rank metadata is context only and cannot be phrased as trust or safety.",
  },
  {
    id: "contract-metadata-resolver",
    status: "blocked",
    priority: "P1",
    label: "Contract metadata resolver",
    purpose: "Resolve chain/address to token metadata, contract flags and Shield query key.",
    cachePolicy: "Short TTL per chain/address with explicit analyzer version.",
    missing: ["chain adapter", "address validator", "contract analyzer envelope"],
    nextStep: "Add address parser and chain-aware contract metadata adapter.",
    productionBoundary: "Contract metadata can flag review needs, not final accusations.",
  },
];

export const curatedTokenMetadata: TokenMetadataRecord[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    rank: 1,
    logoUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    logoMode: "curated_url",
    chainHints: ["btc"],
    tags: ["baseline", "large-cap", "volume-quality"],
    sourceId: "velmere-curated-token-index",
    sourceConfidence: 82,
    updatedAt: generatedAt,
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    rank: 2,
    logoUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    logoMode: "curated_url",
    chainHints: ["ethereum", "erc20"],
    tags: ["smart-contract", "large-cap", "liquidity"],
    sourceId: "velmere-curated-token-index",
    sourceConfidence: 80,
    updatedAt: generatedAt,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    rank: 5,
    logoUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    logoMode: "curated_url",
    chainHints: ["solana"],
    tags: ["high-activity", "liquidity-review", "source-freshness"],
    sourceId: "velmere-curated-token-index",
    sourceConfidence: 78,
    updatedAt: generatedAt,
  },
  {
    id: "usd-coin",
    symbol: "USDC",
    name: "USD Coin",
    rank: 7,
    logoUrl: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    logoMode: "curated_url",
    chainHints: ["ethereum", "solana", "stablecoin"],
    tags: ["stablecoin", "peg-context", "issuer-source"],
    sourceId: "velmere-curated-token-index",
    sourceConfidence: 75,
    updatedAt: generatedAt,
  },
  {
    id: "velmere-shield",
    symbol: "VLM",
    name: "Velmère Shield",
    logoMode: "fallback_avatar",
    chainHints: ["velmere"],
    tags: ["shield", "vlm", "access"],
    sourceId: "velmere-local-route-map",
    sourceConfidence: 86,
    updatedAt: generatedAt,
  },
];

export function normalizeTokenMetadataQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 96);
}

export function findTokenMetadata(query: string) {
  const clean = normalizeTokenMetadataQuery(query).toLowerCase();
  if (!clean) return curatedTokenMetadata;
  return curatedTokenMetadata.filter((record) => {
    const haystack = `${record.id} ${record.symbol} ${record.name} ${record.tags.join(" ")} ${record.chainHints.join(" ")}`.toLowerCase();
    return haystack.includes(clean) || record.symbol.toLowerCase().startsWith(clean);
  });
}

export function createTokenMetadataCacheSnapshot(query = ""): TokenMetadataCacheSnapshot {
  const records = findTokenMetadata(query);
  return {
    schemaVersion: "velmere-token-metadata-cache-v1",
    mode: records.length ? "curated" : "missing",
    generatedAt: new Date().toISOString(),
    query: normalizeTokenMetadataQuery(query),
    records,
    providers: tokenMetadataProviders,
    externalFetchPerformed: false,
    storageWritePerformed: false,
    productionBoundary:
      "Token metadata cache is UI context only. Logos, ranks and symbols do not imply safety, trust or investment quality.",
  };
}

export function getTokenMetadataProviderSummary() {
  const active = tokenMetadataProviders.filter((provider) => provider.status === "active_preview").length;
  const planned = tokenMetadataProviders.filter((provider) => provider.status === "planned").length;
  const blocked = tokenMetadataProviders.filter((provider) => provider.status === "blocked").length;
  return {
    schemaVersion: "velmere-token-metadata-provider-summary-v1",
    active,
    planned,
    blocked,
    indexedRecords: curatedTokenMetadata.length,
    nextCriticalStep:
      tokenMetadataProviders.find((provider) => provider.priority === "P0" && provider.status !== "active_preview")?.nextStep ??
      "Keep metadata cache and logo policy under review.",
  };
}
