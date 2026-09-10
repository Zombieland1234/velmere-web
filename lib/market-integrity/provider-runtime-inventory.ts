export type Pass4643ProviderSurface = "crypto" | "real_markets" | "contract_audit" | "cross_surface";
export type Pass4643ProviderStatus = "public_runtime" | "configured" | "missing_configuration" | "disabled";

export type Pass4643ProviderDefinition = {
  id: string;
  family: string;
  surfaces: Pass4643ProviderSurface[];
  capabilities: string[];
  publicRuntime?: boolean;
  envAny?: string[];
  enabledWhen?: string;
};

const PROVIDERS: Pass4643ProviderDefinition[] = [
  { id: "coingecko", family: "market_data", surfaces: ["crypto", "contract_audit"], capabilities: ["identity", "price", "market_cap", "volume", "history"], publicRuntime: true },
  { id: "dexscreener", family: "dex_market", surfaces: ["crypto", "contract_audit"], capabilities: ["pair_identity", "dex_liquidity", "volume", "transactions"], publicRuntime: true },
  { id: "geckoterminal", family: "dex_market", surfaces: ["crypto"], capabilities: ["pool_ohlcv", "pool_liquidity", "network_identity"], publicRuntime: true },
  { id: "defillama", family: "protocol_fundamentals", surfaces: ["crypto"], capabilities: ["tvl", "protocol_identity", "chain_tvl", "fees_revenue"], publicRuntime: true },
  { id: "binance", family: "cex_microstructure", surfaces: ["crypto"], capabilities: ["orderbook", "klines", "trades", "funding", "open_interest"], publicRuntime: true },
  { id: "coinbase", family: "cex_microstructure", surfaces: ["crypto"], capabilities: ["orderbook", "trades", "product_identity"], publicRuntime: true },
  { id: "goplus", family: "contract_risk", surfaces: ["contract_audit"], capabilities: ["token_security", "owner", "mint", "blacklist", "tax", "honeypot_flags"], publicRuntime: true },
  { id: "honeypot_is", family: "contract_simulation", surfaces: ["contract_audit"], capabilities: ["honeypot_simulation", "buy_tax", "sell_tax", "pair_risk"], publicRuntime: true },
  { id: "etherscan_family", family: "block_explorer", surfaces: ["crypto", "contract_audit"], capabilities: ["verified_source", "abi", "contract_creation", "transactions"], envAny: ["ETHERSCAN_API_KEY", "BASESCAN_API_KEY", "ARBISCAN_API_KEY", "POLYGONSCAN_API_KEY", "BSCSCAN_API_KEY"] },
  { id: "alchemy", family: "rpc_onchain", surfaces: ["crypto", "contract_audit"], capabilities: ["rpc", "token_balances", "logs", "transfers", "holder_inputs"], envAny: ["ALCHEMY_API_KEY", "ALCHEMY_ETH_RPC_URL", "NEXT_PUBLIC_ALCHEMY_API_KEY"] },
  { id: "quicknode", family: "rpc_onchain", surfaces: ["crypto", "contract_audit"], capabilities: ["rpc", "logs", "traces", "token_transfers"], envAny: ["QUICKNODE_RPC_URL", "QUICKNODE_API_KEY"] },
  { id: "sec_edgar", family: "official_filings", surfaces: ["real_markets"], capabilities: ["company_facts", "10k", "10q", "8k", "issuer_identity"], publicRuntime: true },
  { id: "stooq", family: "market_data", surfaces: ["real_markets"], capabilities: ["quote", "history", "fx", "indices", "commodities"], publicRuntime: true },
  { id: "yahoo_finance", family: "market_data", surfaces: ["real_markets"], capabilities: ["quote", "history", "corporate_actions", "fundamentals"], publicRuntime: true },
  { id: "alpha_vantage", family: "market_fundamentals", surfaces: ["real_markets"], capabilities: ["quote", "history", "fundamentals", "fx", "commodities"], envAny: ["ALPHA_VANTAGE_API_KEY"] },
  { id: "finnhub", family: "market_fundamentals", surfaces: ["real_markets"], capabilities: ["quote", "fundamentals", "earnings", "insider", "news"], envAny: ["FINNHUB_API_KEY"] },
  { id: "twelve_data", family: "market_data", surfaces: ["real_markets"], capabilities: ["quote", "history", "fx", "etf", "commodities"], envAny: ["TWELVE_DATA_API_KEY"] },
  { id: "fred", family: "official_macro", surfaces: ["real_markets"], capabilities: ["rates", "inflation", "employment", "yields", "macro_series"], envAny: ["FRED_API_KEY"] },
  { id: "ecb", family: "official_macro", surfaces: ["real_markets"], capabilities: ["fx_reference", "policy_rates", "monetary_statistics"], publicRuntime: true },
  { id: "eia", family: "official_commodity", surfaces: ["real_markets"], capabilities: ["oil", "gas", "inventories", "production"], envAny: ["EIA_API_KEY"] },
  { id: "cftc", family: "official_positioning", surfaces: ["real_markets"], capabilities: ["commitments_of_traders", "futures_positioning"], publicRuntime: true },
  { id: "github_source", family: "source_repository", surfaces: ["contract_audit"], capabilities: ["repository", "commit_history", "source_tree"], envAny: ["GITHUB_TOKEN", "GITHUB_ACCESS_TOKEN"] },
];

function configured(definition: Pass4643ProviderDefinition, env: NodeJS.ProcessEnv) {
  if (definition.publicRuntime) return true;
  if (definition.enabledWhen && env[definition.enabledWhen] !== "true") return false;
  return Boolean(definition.envAny?.some((name) => String(env[name] ?? "").trim()));
}

export function buildPass4643ProviderRuntimeInventory(
  surface: Pass4643ProviderSurface,
  env: NodeJS.ProcessEnv = process.env,
) {
  const rows = PROVIDERS.filter((provider) => provider.surfaces.includes(surface) || provider.surfaces.includes("cross_surface")).map((provider) => {
    const isConfigured = configured(provider, env);
    const status: Pass4643ProviderStatus = provider.publicRuntime
      ? "public_runtime"
      : isConfigured
        ? "configured"
        : provider.enabledWhen && env[provider.enabledWhen] !== "true"
          ? "disabled"
          : "missing_configuration";
    return {
      id: provider.id,
      family: provider.family,
      capabilities: provider.capabilities,
      status,
      usable: status === "public_runtime" || status === "configured",
      configurationReady: status === "public_runtime" || status === "configured",
      runtimeHealthVerified: false,
      commercialEvidenceReady: false,
      // Never expose secret names or values in the runtime/customer envelope.
      configurationRequired: !provider.publicRuntime,
    };
  });
  const usable = rows.filter((row) => row.usable);
  const families = Array.from(new Set(usable.map((row) => row.family)));
  const capabilities = Array.from(new Set(usable.flatMap((row) => row.capabilities)));
  return {
    schemaVersion: "pass4643_provider_runtime_inventory_v1",
    surface,
    totalProviders: rows.length,
    usableProviders: usable.length,
    missingProviders: rows.length - usable.length,
    usableFamilyCount: families.length,
    usableFamilies: families,
    capabilityCount: capabilities.length,
    capabilities,
    rows,
    runtimeHealthVerified: false,
    commercialEvidenceReady: false,
    readinessBoundary: "Configuration/public access is not a live receipt. Each provider must still return a fresh, identity-bound response before it counts as commercial evidence.",
    secretValuesExposed: false,
  } as const;
}

export function buildPass4643ProviderRuntimeSummary(surface: Pass4643ProviderSurface, env: NodeJS.ProcessEnv = process.env) {
  const inventory = buildPass4643ProviderRuntimeInventory(surface, env);
  return {
    schemaVersion: inventory.schemaVersion,
    surface: inventory.surface,
    totalProviders: inventory.totalProviders,
    usableProviders: inventory.usableProviders,
    missingProviders: inventory.missingProviders,
    usableFamilyCount: inventory.usableFamilyCount,
    capabilityCount: inventory.capabilityCount,
    runtimeHealthVerified: inventory.runtimeHealthVerified,
    commercialEvidenceReady: inventory.commercialEvidenceReady,
    secretValuesExposed: false,
  } as const;
}
