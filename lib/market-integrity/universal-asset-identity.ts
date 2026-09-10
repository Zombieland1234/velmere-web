import type { VelmereMarketAssetClass } from "./risk-types";

export type Pass4646Surface = "shield" | "real_markets" | "lens" | "contract_audit";

export type Pass4646ProviderCandidate = {
  provider: string;
  providerId?: string | null;
  symbol?: string | null;
  name?: string | null;
  assetClass?: VelmereMarketAssetClass | null;
  instrumentType?: string | null;
  exchange?: string | null;
  mic?: string | null;
  currency?: string | null;
  chainId?: string | null;
  contractAddress?: string | null;
};

export type Pass4646IdentityRequest = {
  query: string;
  surface: Pass4646Surface;
  selectedProviderId?: string | null;
  selectedExchange?: string | null;
  selectedChainId?: string | null;
  selectedContractAddress?: string | null;
};

export type Pass4646IdentityResolution = {
  schemaVersion: "pass4646_universal_asset_identity_v1";
  status: "resolved" | "ambiguous" | "missing" | "surface_mismatch";
  exact: boolean;
  normalizedQuery: string;
  selected: Pass4646ProviderCandidate | null;
  inferredAssetClass: VelmereMarketAssetClass;
  candidateCount: number;
  blockers: string[];
  matchReason: string | null;
};

const ISO_CURRENCIES = new Set([
  "AED", "ARS", "AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "COP", "CZK",
  "DKK", "EGP", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "ISK",
  "JPY", "KRW", "KWD", "MXN", "MYR", "NGN", "NOK", "NZD", "PEN", "PHP",
  "PKR", "PLN", "QAR", "RON", "RUB", "SAR", "SEK", "SGD", "THB", "TRY",
  "TWD", "UAH", "USD", "VND", "ZAR",
]);

const COMMODITY_TOKENS = new Set([
  "XAU", "XAG", "XPT", "XPD", "WTI", "BRENT", "OIL", "NATGAS", "COPPER",
  "GOLD", "SILVER", "PLATINUM", "PALLADIUM", "CORN", "WHEAT", "SOYBEAN",
  "COCOA", "COFFEE", "SUGAR", "COTTON",
]);

function compact(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function normalizePass4646IdentityText(value: string | null | undefined) {
  return compact(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");
}

function compactSymbol(value: string | null | undefined) {
  return normalizePass4646IdentityText(value).replace(/\s+/g, "");
}

function normalizedAddress(value: string | null | undefined) {
  const address = compact(value).toLowerCase();
  return /^(0x[a-f0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,64})$/.test(address) ? address : "";
}

function providerTypeClass(instrumentType: string | null | undefined): VelmereMarketAssetClass | null {
  const type = compact(instrumentType).toLowerCase();
  if (!type) return null;
  if (/crypto|digital asset|token|coin/.test(type)) return "crypto";
  if (/exchange traded fund|\betf\b|fund/.test(type)) return "etf";
  if (/reit|real estate/.test(type)) return "real_estate";
  if (/index|indices/.test(type)) return "index";
  if (/forex|foreign exchange|currency|fx/.test(type)) return "fx";
  if (/commodity|future|metal|energy|agricultur/.test(type)) return "commodity";
  if (/exchange equity|exchange operator/.test(type)) return "exchange_equity";
  if (/stock|equity|common share|depositary receipt|adr/.test(type)) return "stock";
  return null;
}

function isFxSymbol(symbol: string) {
  const clean = symbol.replace(/=X$/, "").replace(/[/_-]/g, "");
  if (!/^[A-Z]{6}$/.test(clean)) return false;
  return ISO_CURRENCIES.has(clean.slice(0, 3)) && ISO_CURRENCIES.has(clean.slice(3, 6));
}

function isCommoditySymbol(symbol: string, name: string) {
  const clean = symbol.replace(/=F$/, "").replace(/[/_-]/g, "");
  const words = `${symbol} ${name}`.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return symbol.endsWith("=F") || words.some((word) => COMMODITY_TOKENS.has(word)) || COMMODITY_TOKENS.has(clean);
}

export function inferPass4646AssetClass(candidate: Pass4646ProviderCandidate): VelmereMarketAssetClass {
  if (candidate.assetClass && candidate.assetClass !== "unknown") return candidate.assetClass;
  const byType = providerTypeClass(candidate.instrumentType);
  if (byType) return byType;

  const symbol = compactSymbol(candidate.symbol);
  const name = normalizePass4646IdentityText(candidate.name);
  const address = normalizedAddress(candidate.contractAddress);
  if (address || compact(candidate.chainId)) return "crypto";
  if (/^[A-Z0-9]{1,20}-(USD|USDT|USDC|BTC|ETH)$/.test(symbol)) return "crypto";
  if (symbol.startsWith("^") || /\bINDEX\b/.test(name)) return "index";
  if (isFxSymbol(symbol)) return "fx";
  if (isCommoditySymbol(symbol, name)) return "commodity";
  if (/\bREIT\b|REAL ESTATE/.test(name)) return "real_estate";
  if (/\bETF\b|EXCHANGE TRADED FUND|\bFUND\b/.test(name)) return "etf";
  if (/EXCHANGE OPERATOR|STOCK EXCHANGE/.test(name)) return "exchange_equity";
  if (/^[A-Z0-9.-]{1,24}$/.test(symbol)) return "stock";
  return "unknown";
}

function surfaceAccepts(surface: Pass4646Surface, assetClass: VelmereMarketAssetClass) {
  if (surface === "shield") return assetClass === "crypto";
  if (surface === "contract_audit") return assetClass === "crypto";
  if (surface === "real_markets") return assetClass !== "crypto" && assetClass !== "unknown";
  return assetClass !== "unknown";
}

function exactSymbolMatch(query: string, candidate: Pass4646ProviderCandidate) {
  const q = compactSymbol(query);
  const symbol = compactSymbol(candidate.symbol);
  if (!q || !symbol) return false;
  if (q === symbol) return true;
  const qNoSeparators = q.replace(/[/_-]/g, "").replace(/=(X|F)$/, "");
  const symbolNoSeparators = symbol.replace(/[/_-]/g, "").replace(/=(X|F)$/, "");
  return qNoSeparators === symbolNoSeparators;
}

function exactNameMatch(query: string, candidate: Pass4646ProviderCandidate) {
  return normalizePass4646IdentityText(query) === normalizePass4646IdentityText(candidate.name);
}

function uniqueCandidateKey(candidate: Pass4646ProviderCandidate) {
  return [
    normalizePass4646IdentityText(candidate.provider),
    normalizePass4646IdentityText(candidate.providerId),
    compactSymbol(candidate.symbol),
    normalizePass4646IdentityText(candidate.exchange ?? candidate.mic),
    normalizePass4646IdentityText(candidate.chainId),
    normalizedAddress(candidate.contractAddress),
  ].join("|");
}

export function resolvePass4646UniversalAssetIdentity(
  request: Pass4646IdentityRequest,
  candidates: Pass4646ProviderCandidate[],
): Pass4646IdentityResolution {
  const normalizedQuery = normalizePass4646IdentityText(request.query);
  const deduped = Array.from(new Map(candidates.map((candidate) => [uniqueCandidateKey(candidate), candidate])).values());
  const selectedAddress = normalizedAddress(request.selectedContractAddress);
  const selectedProviderId = normalizePass4646IdentityText(request.selectedProviderId);
  const selectedExchange = normalizePass4646IdentityText(request.selectedExchange);
  const selectedChainId = normalizePass4646IdentityText(request.selectedChainId);

  let exact = deduped.filter((candidate) => {
    if (selectedAddress && normalizedAddress(candidate.contractAddress) === selectedAddress) return true;
    if (selectedProviderId && normalizePass4646IdentityText(candidate.providerId) === selectedProviderId) return true;
    return exactSymbolMatch(request.query, candidate) || exactNameMatch(request.query, candidate);
  });

  if (selectedExchange) {
    exact = exact.filter((candidate) => normalizePass4646IdentityText(candidate.exchange ?? candidate.mic) === selectedExchange);
  }
  if (selectedChainId) {
    exact = exact.filter((candidate) => normalizePass4646IdentityText(candidate.chainId) === selectedChainId);
  }

  const onSurface = exact.filter((candidate) => surfaceAccepts(request.surface, inferPass4646AssetClass(candidate)));
  if (!exact.length) {
    return {
      schemaVersion: "pass4646_universal_asset_identity_v1",
      status: "missing",
      exact: false,
      normalizedQuery,
      selected: null,
      inferredAssetClass: "unknown",
      candidateCount: deduped.length,
      blockers: ["exact_identity_not_found"],
      matchReason: null,
    };
  }
  if (!onSurface.length) {
    return {
      schemaVersion: "pass4646_universal_asset_identity_v1",
      status: "surface_mismatch",
      exact: true,
      normalizedQuery,
      selected: null,
      inferredAssetClass: inferPass4646AssetClass(exact[0]),
      candidateCount: exact.length,
      blockers: ["asset_class_not_allowed_on_selected_surface"],
      matchReason: null,
    };
  }

  const strong = onSurface.filter((candidate) => {
    if (selectedAddress) return normalizedAddress(candidate.contractAddress) === selectedAddress;
    if (selectedProviderId) return normalizePass4646IdentityText(candidate.providerId) === selectedProviderId;
    if (request.surface === "shield" || request.surface === "contract_audit") {
      return Boolean(normalizedAddress(candidate.contractAddress) && compact(candidate.chainId));
    }
    return Boolean(compact(candidate.exchange ?? candidate.mic) || candidate.providerId);
  });
  const pool = strong.length ? strong : onSurface;

  if (pool.length !== 1) {
    return {
      schemaVersion: "pass4646_universal_asset_identity_v1",
      status: "ambiguous",
      exact: true,
      normalizedQuery,
      selected: null,
      inferredAssetClass: "unknown",
      candidateCount: pool.length,
      blockers: ["ticker_or_name_collision_requires_provider_exchange_or_chain_selection"],
      matchReason: null,
    };
  }

  const selected = pool[0];
  return {
    schemaVersion: "pass4646_universal_asset_identity_v1",
    status: "resolved",
    exact: true,
    normalizedQuery,
    selected,
    inferredAssetClass: inferPass4646AssetClass(selected),
    candidateCount: pool.length,
    blockers: [],
    matchReason: selectedAddress
      ? "exact_contract_address"
      : selectedProviderId
        ? "exact_provider_id"
        : exactSymbolMatch(request.query, selected)
          ? "exact_symbol"
          : "exact_name",
  };
}

export type Pass4646EvidenceProfile = {
  assetClass: VelmereMarketAssetClass;
  basic: string[];
  pro: string[];
  advanced: string[];
};

const COMMON_BASIC = ["identity", "quote", "freshness"];
const COMMON_PRO = ["history", "independent_quote", "risk_findings"];
const COMMON_ADVANCED = ["cross_provider_corroboration", "stress_scenarios", "monitoring_plan"];

export function buildPass4646EvidenceProfile(assetClass: VelmereMarketAssetClass): Pass4646EvidenceProfile {
  const profiles: Record<VelmereMarketAssetClass, { basic: string[]; pro: string[]; advanced: string[] }> = {
    crypto: {
      basic: ["market_cap", "volume", "liquidity_snapshot", "contract_identity"],
      pro: ["holders", "admin_permissions", "dex_cex_depth", "supply_unlocks", "treasury_flows"],
      advanced: ["whale_clusters", "bridge_flows", "liquidity_stress", "dependency_graph", "upgrade_monitoring"],
    },
    stock: {
      basic: ["market_cap", "latest_filing", "revenue", "earnings"],
      pro: ["cash_flow", "debt", "valuation_peers", "insider_activity", "institutional_ownership"],
      advanced: ["factor_model", "margin_stress", "earnings_scenarios", "supply_chain", "regulatory_risk"],
    },
    exchange_equity: {
      basic: ["market_cap", "latest_filing", "revenue", "earnings"],
      pro: ["cash_flow", "debt", "trading_volume_exposure", "regulatory_filings", "counterparty_risk"],
      advanced: ["market_structure_stress", "regulatory_scenarios", "venue_dependency", "liquidity_cycle", "incident_monitoring"],
    },
    etf: {
      basic: ["aum", "expense_ratio", "top_holdings", "liquidity_snapshot"],
      pro: ["full_holdings", "sector_concentration", "tracking_error", "underlying_liquidity", "overlap"],
      advanced: ["redemption_stress", "factor_exposure", "correlation_regimes", "issuer_risk", "flow_monitoring"],
    },
    real_estate: {
      basic: ["aum_or_market_cap", "yield", "occupancy_or_holdings", "liquidity_snapshot"],
      pro: ["debt_maturity", "interest_rate_exposure", "property_concentration", "cash_flow", "valuation"],
      advanced: ["rate_stress", "refinancing_scenarios", "regional_dependency", "tenant_concentration", "distribution_monitoring"],
    },
    fx: {
      basic: ["spot_rate", "volatility", "central_bank_context", "macro_calendar"],
      pro: ["rate_differential", "inflation", "labor_market", "yield_curve", "positioning"],
      advanced: ["macro_scenarios", "correlation_regimes", "intervention_risk", "liquidity_stress", "event_monitoring"],
    },
    commodity: {
      basic: ["spot_or_front_future", "volatility", "inventory_snapshot", "supply_demand"],
      pro: ["curve_shape", "production", "consumption", "positioning", "currency_sensitivity"],
      advanced: ["inventory_stress", "geopolitical_scenarios", "weather_or_supply_shock", "cross_asset_model", "flow_monitoring"],
    },
    index: {
      basic: ["level", "volatility", "constituent_context", "market_breadth"],
      pro: ["sector_contribution", "valuation", "earnings_breadth", "liquidity", "concentration"],
      advanced: ["factor_stress", "correlation_regimes", "macro_scenarios", "rebalance_risk", "breadth_monitoring"],
    },
    unknown: { basic: [], pro: [], advanced: [] },
  };
  const profile = profiles[assetClass];
  return {
    assetClass,
    basic: [...COMMON_BASIC, ...profile.basic],
    pro: [...COMMON_BASIC, ...profile.basic, ...COMMON_PRO, ...profile.pro],
    advanced: [...COMMON_BASIC, ...profile.basic, ...COMMON_PRO, ...profile.pro, ...COMMON_ADVANCED, ...profile.advanced],
  };
}
