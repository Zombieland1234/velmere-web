export type Pass622AssetClass =
  | "crypto"
  | "stock"
  | "equity"
  | "exchange_equity"
  | "etf"
  | "fx"
  | "commodity"
  | "real_estate"
  | "reit"
  | "venue_health"
  | "filing"
  | "onchain"
  | "contract"
  | "market"
  | "document";

export type Pass622ProviderKind =
  | "market_data"
  | "reference_rate"
  | "filing"
  | "venue"
  | "onchain"
  | "internal_ledger";

export type Pass622RetryPolicy = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn: Array<"timeout" | "rate_limit" | "server_error">;
};

export type Pass622RateLimitPolicy = {
  requests: number;
  windowSeconds: number;
  burst: number;
};

export type Pass622ProviderDefinition = {
  id: string;
  label: string;
  kind: Pass622ProviderKind;
  assetClasses: Pass622AssetClass[];
  internalRoutes: string[];
  requiredEnvKeys: string[];
  ttlSeconds: number;
  timeoutMs: number;
  retry: Pass622RetryPolicy;
  rateLimit: Pass622RateLimitPolicy;
  cache: {
    mode: "no_store" | "memory" | "durable";
    staleWhileRevalidateSeconds: number;
  };
  backupProviderId: string | null;
  timestampAuthority: "provider" | "filing_period" | "reference_day" | "route_only";
  publicNote: string;
};

export type Pass622DiscoveredSource = {
  id: string;
  label: string;
  assetClasses?: string[];
  internalRoute?: string;
  hasApiKey?: boolean;
  ttlSeconds?: number;
  backupProviderId?: string | null;
  publicNote?: string;
};

export type Pass622PublicProvider = Omit<
  Pass622ProviderDefinition,
  "requiredEnvKeys" | "retry" | "rateLimit"
> & {
  requiresConfiguration: boolean;
  retrySummary: string;
  rateLimitSummary: string;
};

export type Pass622SourceRegistry = {
  version: "source-registry";
  generatedAt: string;
  providers: Pass622ProviderDefinition[];
  publicProviders: Pass622PublicProvider[];
  providerCount: number;
  configuredProviderCount: number;
  backupCoveragePercent: number;
  duplicateIds: string[];
  brokenBackupLinks: string[];
  backupCycles: string[][];
  state: "ready" | "review" | "blocked";
  boundary: string;
};

const DEFAULT_RETRY: Pass622RetryPolicy = {
  attempts: 2,
  baseDelayMs: 350,
  maxDelayMs: 2_000,
  retryOn: ["timeout", "rate_limit", "server_error"],
};

const DEFAULT_RATE_LIMIT: Pass622RateLimitPolicy = {
  requests: 30,
  windowSeconds: 60,
  burst: 5,
};

const CANONICAL_PROVIDERS: Pass622ProviderDefinition[] = [
  {
    id: "coingecko-market",
    label: "CoinGecko market data",
    kind: "market_data",
    assetClasses: ["crypto", "market"],
    internalRoutes: ["/api/market-integrity/markets", "/api/search/token-metadata"],
    requiredEnvKeys: [],
    ttlSeconds: 60,
    timeoutMs: 8_000,
    retry: DEFAULT_RETRY,
    rateLimit: { requests: 20, windowSeconds: 60, burst: 3 },
    cache: { mode: "memory", staleWhileRevalidateSeconds: 120 },
    backupProviderId: "velmere-source-ledger",
    timestampAuthority: "provider",
    publicNote: "Public market snapshot lane. Provider timestamps remain separate from route time.",
  },
  {
    id: "alpha-vantage-market",
    label: "Alpha Vantage market data",
    kind: "market_data",
    assetClasses: ["stock", "equity", "exchange_equity", "etf", "fx", "commodity", "market"],
    internalRoutes: ["/api/market-integrity/real-markets", "/api/market-integrity/real-markets/provider-contract"],
    requiredEnvKeys: ["ALPHA_VANTAGE_API_KEY"],
    ttlSeconds: 300,
    timeoutMs: 10_000,
    retry: DEFAULT_RETRY,
    rateLimit: { requests: 5, windowSeconds: 60, burst: 1 },
    cache: { mode: "durable", staleWhileRevalidateSeconds: 900 },
    backupProviderId: "velmere-source-ledger",
    timestampAuthority: "provider",
    publicNote: "Primary public-markets adapter. Missing configuration is exposed as a source state, never as synthetic data.",
  },
  {
    id: "sec-companyfacts",
    label: "SEC filing data",
    kind: "filing",
    assetClasses: ["stock", "equity", "exchange_equity", "etf", "filing"],
    internalRoutes: ["/api/market-integrity/real-markets/provider-contract"],
    requiredEnvKeys: ["SEC_USER_AGENT"],
    ttlSeconds: 21_600,
    timeoutMs: 12_000,
    retry: { ...DEFAULT_RETRY, attempts: 3 },
    rateLimit: { requests: 8, windowSeconds: 1, burst: 2 },
    cache: { mode: "durable", staleWhileRevalidateSeconds: 86_400 },
    backupProviderId: "velmere-source-ledger",
    timestampAuthority: "filing_period",
    publicNote: "Filing periods and publication dates are preserved independently from fetch time.",
  },
  {
    id: "exchange-market-data",
    label: "Exchange market-data adapters",
    kind: "venue",
    assetClasses: ["crypto", "venue_health", "market"],
    internalRoutes: ["/api/market-integrity/venue-health", "/api/market-integrity/orderbook"],
    requiredEnvKeys: [],
    ttlSeconds: 15,
    timeoutMs: 6_000,
    retry: { ...DEFAULT_RETRY, baseDelayMs: 200, maxDelayMs: 1_000 },
    rateLimit: { requests: 120, windowSeconds: 60, burst: 10 },
    cache: { mode: "memory", staleWhileRevalidateSeconds: 30 },
    backupProviderId: "coingecko-market",
    timestampAuthority: "provider",
    publicNote: "Venue health and execution evidence stay separate from token narrative.",
  },
  {
    id: "reference-rate-ledger",
    label: "Reference-rate ledger",
    kind: "reference_rate",
    assetClasses: ["fx", "market"],
    internalRoutes: ["/api/market-integrity/real-markets"],
    requiredEnvKeys: [],
    ttlSeconds: 43_200,
    timeoutMs: 8_000,
    retry: DEFAULT_RETRY,
    rateLimit: { requests: 60, windowSeconds: 60, burst: 5 },
    cache: { mode: "durable", staleWhileRevalidateSeconds: 86_400 },
    backupProviderId: "velmere-source-ledger",
    timestampAuthority: "reference_day",
    publicNote: "Daily reference observations are labelled as reference data, not live execution quotes.",
  },
  {
    id: "velmere-source-ledger",
    label: "Velmère source ledger",
    kind: "internal_ledger",
    assetClasses: [
      "crypto",
      "stock",
      "equity",
      "exchange_equity",
      "etf",
      "fx",
      "commodity",
      "real_estate",
      "reit",
      "venue_health",
      "filing",
      "onchain",
      "contract",
      "market",
      "document",
    ],
    internalRoutes: ["/api/market-integrity/source-snapshots", "/api/search/lens-report"],
    requiredEnvKeys: [],
    ttlSeconds: 300,
    timeoutMs: 2_000,
    retry: { attempts: 1, baseDelayMs: 0, maxDelayMs: 0, retryOn: [] },
    rateLimit: DEFAULT_RATE_LIMIT,
    cache: { mode: "durable", staleWhileRevalidateSeconds: 3_600 },
    backupProviderId: null,
    timestampAuthority: "route_only",
    publicNote: "Stores receipts and lineage. It cannot upgrade cached evidence to provider-live.",
  },
];

function cleanId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function safeAssetClass(value: string): Pass622AssetClass {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  const allowed: Pass622AssetClass[] = [
    "crypto",
    "stock",
    "equity",
    "exchange_equity",
    "etf",
    "fx",
    "commodity",
    "real_estate",
    "reit",
    "venue_health",
    "filing",
    "onchain",
    "contract",
    "market",
    "document",
  ];
  return allowed.includes(normalized as Pass622AssetClass)
    ? (normalized as Pass622AssetClass)
    : "market";
}

function normalizeProvider(provider: Pass622ProviderDefinition): Pass622ProviderDefinition {
  return {
    ...provider,
    id: cleanId(provider.id),
    label: provider.label.replace(/\s+/g, " ").trim().slice(0, 120),
    assetClasses: Array.from(new Set(provider.assetClasses.map(safeAssetClass))),
    internalRoutes: Array.from(
      new Set(
        provider.internalRoutes
          .filter((route) => route.startsWith("/api/"))
          .map((route) => route.split("?")[0]),
      ),
    ),
    requiredEnvKeys: Array.from(
      new Set(
        provider.requiredEnvKeys
          .map((key) => key.trim().toUpperCase())
          .filter((key) => /^[A-Z][A-Z0-9_]*$/.test(key)),
      ),
    ),
    ttlSeconds: Math.max(5, Math.round(provider.ttlSeconds)),
    timeoutMs: Math.max(500, Math.min(30_000, Math.round(provider.timeoutMs))),
    retry: {
      attempts: Math.max(0, Math.min(5, Math.round(provider.retry.attempts))),
      baseDelayMs: Math.max(0, Math.round(provider.retry.baseDelayMs)),
      maxDelayMs: Math.max(0, Math.round(provider.retry.maxDelayMs)),
      retryOn: Array.from(new Set(provider.retry.retryOn)),
    },
    rateLimit: {
      requests: Math.max(1, Math.round(provider.rateLimit.requests)),
      windowSeconds: Math.max(1, Math.round(provider.rateLimit.windowSeconds)),
      burst: Math.max(1, Math.round(provider.rateLimit.burst)),
    },
    cache: {
      mode: provider.cache.mode,
      staleWhileRevalidateSeconds: Math.max(
        0,
        Math.round(provider.cache.staleWhileRevalidateSeconds),
      ),
    },
    backupProviderId: provider.backupProviderId
      ? cleanId(provider.backupProviderId)
      : null,
    publicNote: provider.publicNote.replace(/\s+/g, " ").trim().slice(0, 240),
  };
}

function discoveredProvider(source: Pass622DiscoveredSource): Pass622ProviderDefinition {
  const id = cleanId(source.id || source.label) || "discovered-source";
  return normalizeProvider({
    id,
    label: source.label || id,
    kind: "market_data",
    assetClasses: (source.assetClasses || ["market"]).map(safeAssetClass),
    internalRoutes: [source.internalRoute || "/api/search/lens-report"],
    requiredEnvKeys: source.hasApiKey ? [`${id.replace(/-/g, "_").toUpperCase()}_API_KEY`] : [],
    ttlSeconds: source.ttlSeconds ?? 300,
    timeoutMs: 8_000,
    retry: DEFAULT_RETRY,
    rateLimit: DEFAULT_RATE_LIMIT,
    cache: { mode: "memory", staleWhileRevalidateSeconds: 600 },
    backupProviderId: source.backupProviderId || "velmere-source-ledger",
    timestampAuthority: "provider",
    publicNote:
      source.publicNote ||
      "Discovered report source. Public surfaces expose state and lineage, never secret values.",
  });
}

function findCycles(providers: Pass622ProviderDefinition[]) {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const cycles: string[][] = [];
  for (const provider of providers) {
    const path: string[] = [];
    const seenAt = new Map<string, number>();
    let current: Pass622ProviderDefinition | undefined = provider;
    while (current) {
      if (seenAt.has(current.id)) {
        const cycle = path.slice(seenAt.get(current.id));
        const normalized = [...cycle].sort().join("|");
        if (!cycles.some((candidate) => [...candidate].sort().join("|") === normalized)) {
          cycles.push(cycle);
        }
        break;
      }
      seenAt.set(current.id, path.length);
      path.push(current.id);
      current = current.backupProviderId
        ? byId.get(current.backupProviderId)
        : undefined;
    }
  }
  return cycles;
}

export function buildPass622SourceRegistry(input: {
  generatedAt?: string | number;
  providers?: Pass622ProviderDefinition[];
  discoveredSources?: Pass622DiscoveredSource[];
  configuredEnvKeys?: readonly string[];
} = {}): Pass622SourceRegistry {
  const configured = new Set(
    (input.configuredEnvKeys || []).map((key) => key.trim().toUpperCase()),
  );
  const raw = [
    ...(input.providers || CANONICAL_PROVIDERS),
    ...(input.discoveredSources || []).map(discoveredProvider),
  ].map(normalizeProvider);
  const counts = new Map<string, number>();
  for (const provider of raw) counts.set(provider.id, (counts.get(provider.id) || 0) + 1);
  const duplicateIds = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const providers = Array.from(
    new Map(raw.map((provider) => [provider.id, provider])).values(),
  );
  const ids = new Set(providers.map((provider) => provider.id));
  const brokenBackupLinks = providers
    .filter(
      (provider) =>
        provider.backupProviderId && !ids.has(provider.backupProviderId),
    )
    .map((provider) => `${provider.id}->${provider.backupProviderId}`);
  const backupCycles = findCycles(providers);
  const configuredProviderCount = providers.filter((provider) =>
    provider.requiredEnvKeys.every((key) => configured.has(key)),
  ).length;
  const backupCoveragePercent = providers.length
    ? Math.round(
        (providers.filter(
          (provider) =>
            provider.backupProviderId && ids.has(provider.backupProviderId),
        ).length /
          providers.length) *
          100,
      )
    : 0;
  const publicProviders = providers.map<Pass622PublicProvider>((provider) => {
    const { requiredEnvKeys, retry, rateLimit, ...publicProvider } = provider;
    return {
      ...publicProvider,
      requiresConfiguration:
        requiredEnvKeys.length > 0 &&
        !requiredEnvKeys.every((key) => configured.has(key)),
      retrySummary: `${retry.attempts} attempts · ${retry.baseDelayMs}-${retry.maxDelayMs}ms`,
      rateLimitSummary: `${rateLimit.requests}/${rateLimit.windowSeconds}s · burst ${rateLimit.burst}`,
    };
  });
  const state = duplicateIds.length || brokenBackupLinks.length || backupCycles.length
    ? "blocked"
    : configuredProviderCount < providers.length
      ? "review"
      : "ready";

  const generated = input.generatedAt ? new Date(input.generatedAt) : new Date();
  return {
    version: "source-registry",
    generatedAt: Number.isNaN(generated.getTime())
      ? new Date(0).toISOString()
      : generated.toISOString(),
    providers,
    publicProviders,
    providerCount: providers.length,
    configuredProviderCount,
    backupCoveragePercent,
    duplicateIds,
    brokenBackupLinks,
    backupCycles,
    state,
    boundary:
      "The registry exposes provider state, routes, TTL and failover policy. It never exposes API-key values, private prompts or hidden scoring instructions to public UI.",
  };
}

export function findPass622Provider(
  registry: Pass622SourceRegistry,
  providerIdOrLabel: string,
) {
  const normalized = cleanId(providerIdOrLabel);
  return registry.providers.find(
    (provider) =>
      provider.id === normalized ||
      cleanId(provider.label) === normalized ||
      provider.label.toLowerCase().includes(providerIdOrLabel.toLowerCase()),
  ) || null;
}
