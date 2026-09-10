/**
 * Asset-Class Hard Execution Firewall
 *
 * Enforces strict domain separation between asset classes:
 * - Smart Contracts (EVM Bytecode / Decompiler / AST)
 * - Native Layer-1 / UTXO Crypto (Consensus / Supply / Network)
 * - Equities / Stocks (SEC filings, market microstructure, trading sessions)
 * - Commodities (Futures curve, physical delivery, COT)
 * - Foreign Exchange (Macro rates, continuous 24/5 liquidity)
 *
 * An asset class MUST NOT be permitted to execute analyzers outside its permitted domain.
 */

export type AssetClass =
  | "evm_contract"
  | "native_crypto"
  | "equity"
  | "commodity"
  | "fx"
  | "index";

export type CanonicalAssetClassV2 =
  | "EVM_CONTRACT"
  | "NATIVE_BLOCKCHAIN"
  | "TRADITIONAL_EQUITY"
  | "ETF"
  | "COMMODITY_FUTURE"
  | "FX"
  | "OTHER_TRADITIONAL"
  | "SIMULATED_FIXTURE";

export function toCanonicalAssetClassV2(raw: AssetClass | string): CanonicalAssetClassV2 {
  const norm = String(raw).toUpperCase().trim();
  if (norm === "EVM_CONTRACT" || norm === "SMART_CONTRACT") return "EVM_CONTRACT";
  if (norm === "NATIVE_CRYPTO" || norm === "NATIVE_BLOCKCHAIN" || norm === "NATIVE_CHAIN") return "NATIVE_BLOCKCHAIN";
  if (norm === "EQUITY" || norm === "TRADITIONAL_EQUITY" || norm === "STOCK") return "TRADITIONAL_EQUITY";
  if (norm === "ETF" || norm === "INDEX") return "ETF";
  if (norm === "COMMODITY" || norm === "COMMODITY_FUTURE") return "COMMODITY_FUTURE";
  if (norm === "FX" || norm === "FOREX") return "FX";
  if (norm === "SIMULATED_FIXTURE" || norm === "FIXTURE") return "SIMULATED_FIXTURE";
  return "OTHER_TRADITIONAL";
}

export function assertSupportedAssetClass(
  assetClass: CanonicalAssetClassV2 | AssetClass,
  supportedClasses: (CanonicalAssetClassV2 | AssetClass)[],
  moduleName: string,
): void {
  const canonical = typeof assetClass === "string" ? toCanonicalAssetClassV2(assetClass) : assetClass;
  const canonicalSupported = supportedClasses.map((c) => toCanonicalAssetClassV2(c));
  if (!canonicalSupported.includes(canonical)) {
    throw new Error(
      `[FAIL-CLOSED FIREWALL] Module '${moduleName}' does not support asset class '${canonical}'. Supported classes: [${canonicalSupported.join(", ")}]`,
    );
  }
}

export type AnalyzerDomain =
  | "evm_bytecode_decompiler"
  | "solidity_ast_analyzer"
  | "erc20_conformance"
  | "proxy_pattern_detector"
  | "delegatecall_analyzer"
  | "unicrypt_liquidity_lock"
  | "eip1967_slot_reader"
  | "native_utxo_consensus"
  | "native_layer1_supply"
  | "native_node_distribution"
  | "equity_sec_filings"
  | "equity_exchange_calendar"
  | "equity_corporate_actions"
  | "commodity_futures_curve"
  | "commodity_physical_delivery"
  | "fx_macro_interest_rates"
  | "fx_continuous_liquidity"
  | "market_orderbook_depth"
  | "volatility_index";

const PERMITTED_ANALYZERS: Record<AssetClass, Set<AnalyzerDomain>> = {
  evm_contract: new Set([
    "evm_bytecode_decompiler",
    "solidity_ast_analyzer",
    "erc20_conformance",
    "proxy_pattern_detector",
    "delegatecall_analyzer",
    "unicrypt_liquidity_lock",
    "eip1967_slot_reader",
    "market_orderbook_depth",
    "volatility_index",
  ]),
  native_crypto: new Set([
    "native_utxo_consensus",
    "native_layer1_supply",
    "native_node_distribution",
    "market_orderbook_depth",
    "volatility_index",
  ]),
  equity: new Set([
    "equity_sec_filings",
    "equity_exchange_calendar",
    "equity_corporate_actions",
    "market_orderbook_depth",
    "volatility_index",
  ]),
  commodity: new Set([
    "commodity_futures_curve",
    "commodity_physical_delivery",
    "market_orderbook_depth",
    "volatility_index",
  ]),
  fx: new Set([
    "fx_macro_interest_rates",
    "fx_continuous_liquidity",
    "market_orderbook_depth",
    "volatility_index",
  ]),
  index: new Set([
    "equity_exchange_calendar",
    "market_orderbook_depth",
    "volatility_index",
  ]),
};

export class AssetFirewallViolationError extends Error {
  public readonly assetClass: AssetClass;
  public readonly attemptedAnalyzer: AnalyzerDomain;

  constructor(assetClass: AssetClass, attemptedAnalyzer: AnalyzerDomain) {
    super(
      `[ASSET_FIREWALL_VIOLATION] Asset class '${assetClass}' is strictly forbidden from executing analyzer '${attemptedAnalyzer}'.`,
    );
    this.name = "AssetFirewallViolationError";
    this.assetClass = assetClass;
    this.attemptedAnalyzer = attemptedAnalyzer;
  }
}

const KNOWN_ASSET_CLASSES = new Set(["evm_contract", "native_crypto", "equity", "commodity", "fx", "index"]);

/**
 * Validates that an asset is allowed to invoke the requested analyzer.
 * Accepts either an AssetClass or a raw asset target / identifier.
 * Throws AssetFirewallViolationError if unauthorized.
 */
export function assertAssetCanAccessAnalyzer(
  assetClassOrTarget: AssetClass | string | { symbol?: string; address?: string; network?: string; declaredCategory?: string },
  analyzer: AnalyzerDomain,
): void {
  const assetClass: AssetClass =
    typeof assetClassOrTarget === "string" && KNOWN_ASSET_CLASSES.has(assetClassOrTarget)
      ? (assetClassOrTarget as AssetClass)
      : resolveAssetClass(assetClassOrTarget);

  const allowed = PERMITTED_ANALYZERS[assetClass];
  if (!allowed || !allowed.has(analyzer)) {
    throw new AssetFirewallViolationError(assetClass, analyzer);
  }
}

/**
 * Returns whether an asset is authorized for an analyzer.
 */
export function isAnalyzerPermitted(
  assetClassOrTarget: AssetClass | string | { symbol?: string; address?: string; network?: string; declaredCategory?: string },
  analyzer: AnalyzerDomain,
): boolean {
  const assetClass: AssetClass =
    typeof assetClassOrTarget === "string" && KNOWN_ASSET_CLASSES.has(assetClassOrTarget)
      ? (assetClassOrTarget as AssetClass)
      : resolveAssetClass(assetClassOrTarget);

  const allowed = PERMITTED_ANALYZERS[assetClass];
  return Boolean(allowed && allowed.has(analyzer));
}

/**
 * Resolves the canonical AssetClass from raw input or string identifier.
 */
export function resolveAssetClass(input: string | {
  symbol?: string;
  name?: string;
  address?: string;
  network?: string;
  declaredCategory?: string;
}): AssetClass {
  let sym = "";
  let addr = "";
  let net = "";
  let cat = "";

  if (typeof input === "string") {
    const raw = input.toLowerCase().trim();
    addr = raw;
    if (raw.startsWith("nasdaq:") || raw.startsWith("nyse:")) {
      sym = raw.split(":")[1].toUpperCase();
      cat = "equity";
      net = raw.split(":")[0];
    } else if (raw.startsWith("comex:") || raw.startsWith("nymex:")) {
      sym = raw.split(":")[1].toUpperCase();
      cat = "commodity";
      net = raw.split(":")[0];
    } else if (raw.startsWith("forex:") || raw.includes("eurusd") || raw.includes("gbpusd")) {
      cat = "fx";
    } else if (
      raw.startsWith("native-") ||
      raw.includes("solana") ||
      raw.includes("bitcoin") ||
      raw.includes("cardano") ||
      raw.includes("doge") ||
      raw.includes("xrp") ||
      raw.includes("polkadot") ||
      raw.includes("avalanche") ||
      raw.includes("polygon-pos") ||
      raw.includes("litecoin") ||
      raw.includes("tron")
    ) {
      cat = "native_crypto";
    } else if (!raw.startsWith("0x")) {
      sym = raw.toUpperCase();
    }
  } else if (input && typeof input === "object") {
    sym = (input.symbol ?? "").toUpperCase().trim();
    addr = (input.address ?? "").toLowerCase().trim();
    net = (input.network ?? "").toLowerCase();
    cat = (input.declaredCategory ?? "").toLowerCase();

    // Check if address itself contains prefix
    if (addr.startsWith("nasdaq:") || addr.startsWith("nyse:") || addr.startsWith("cboe:")) {
      cat = "equity";
      if (!sym) sym = addr.split(":")[1].toUpperCase();
    } else if (addr.startsWith("comex:") || addr.startsWith("nymex:") || addr.startsWith("cme:")) {
      cat = "commodity";
      if (!sym) sym = addr.split(":")[1].toUpperCase();
    } else if (addr.startsWith("native-")) {
      cat = "native_crypto";
    }
  }

  // Explicit declared categories
  if (cat === "equity" || cat === "stock" || cat === "real_markets" || cat === "real-markets" || cat === "market_asset") return "equity";
  if (cat === "commodity") return "commodity";
  if (cat === "fx" || cat === "forex") return "fx";
  if (cat === "index") return "index";
  if (cat === "crypto_coin" || cat === "native_crypto") return "native_crypto";
  if (cat === "smart_contract" || cat === "evm_contract") return "evm_contract";

  // If target has a valid EVM hex address, prioritize evm_contract over TradFi symbol collisions
  if (addr.startsWith("0x") && /^0x[a-f0-9]{40}$/i.test(addr)) {
    return "evm_contract";
  }

  // Known symbols
  const EQUITIES = new Set([
    "AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "META",
    "BRK.B", "BRK-B", "JPM", "V", "WMT", "TLT"
  ]);
  if (EQUITIES.has(sym)) return "equity";

  const COMMODITIES = new Set(["GC=F", "CL=F", "SI=F", "NG=F", "GOLD", "OIL", "SILVER", "XAU", "XAG", "CL", "NG"]);
  if (COMMODITIES.has(sym)) return "commodity";

  const FX = new Set(["EURUSD=X", "GBPUSD=X", "USDJPY=X", "EUR/USD", "GBP/USD", "EURUSD", "USDJPY", "GBPUSD", "^TNX", "TNX"]);
  if (FX.has(sym)) return "fx";

  const INDICES = new Set(["SPY", "QQQ", "DIA", "^GSPC", "^DJI", "VIX", "^VIX"]);
  if (INDICES.has(sym)) return "equity"; // SPY/QQQ/VIX are regulated TradFi instruments

  const NATIVE_COINS = new Set([
    "BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "DOT",
    "LINK", "NEAR", "ATOM", "LTC", "XMR", "SUI", "APT", "TON", "KAS",
    "POL", "ALGO", "TRX", "BCH"
  ]);
  // If native crypto symbol and not explicitly an EVM token address
  if (NATIVE_COINS.has(sym) && (!addr.startsWith("0x") || addr === "btc" || addr === "eth")) {
    return "native_crypto";
  }

  // Network checks
  if (net.includes("nasdaq") || net.includes("nyse") || net.includes("cboe") || net.includes("board options")) return "equity";
  if (net.includes("comex") || net.includes("nymex") || net.includes("cme") || net.includes("chicago mercantile")) return "commodity";
  if (net.includes("forex") || net.includes("interbank")) return "fx";
  if (net.includes("bitcoin") || net.includes("dogecoin") || net.includes("solana") || net.includes("cardano") || net.includes("xrp")) {
    return "native_crypto";
  }

  // Address pattern: valid 40-hex char EVM address with 0x prefix
  if (/^0x[a-f0-9]{40}$/i.test(addr)) {
    // Check if it's a synthetic placeholder (e.g. 0x1111..., 0xbbbb...)
    const isSyntheticPattern = /^0x(.)\1{39}$/i.test(addr) || /^0x(12|23|34){20}$/i.test(addr);
    if (isSyntheticPattern && (EQUITIES.has(sym) || COMMODITIES.has(sym) || FX.has(sym) || NATIVE_COINS.has(sym))) {
      if (EQUITIES.has(sym)) return "equity";
      if (COMMODITIES.has(sym)) return "commodity";
      if (FX.has(sym)) return "fx";
      return "native_crypto";
    }
    return "evm_contract";
  }

  return "evm_contract";
}

/**
 * Normalizes asset symbols handling share class variations and cross-exchange naming conventions.
 * E.g., BRK.A / BRK-A / BRK/A / BRKA -> BRK.A
 * XBT / BTC / BTC-USD / BTC/USD -> BTC
 */
export function normalizeAssetSymbol(rawSymbol: string): {
  normalizedSymbol: string;
  originalSymbol: string;
  canonicalTicker: string;
} {
  const trimmed = rawSymbol.trim().toUpperCase();
  // Berkshire Hathaway class normalization
  if (/^BRK[.\-/]?A$/i.test(trimmed)) {
    return { normalizedSymbol: "BRK.A", originalSymbol: rawSymbol, canonicalTicker: "BRK.A" };
  }
  if (/^BRK[.\-/]?B$/i.test(trimmed)) {
    return { normalizedSymbol: "BRK.B", originalSymbol: rawSymbol, canonicalTicker: "BRK.B" };
  }
  // Bitcoin ticker variations across Kraken/BitMEX/Coinbase
  if (
    trimmed === "XBT" ||
    trimmed === "BTC" ||
    trimmed === "BTC/USD" ||
    trimmed === "BTC-USD" ||
    trimmed === "BTCUSDT" ||
    trimmed === "BTC-USDT" ||
    trimmed === "XBT/USD" ||
    trimmed === "XBT-USD" ||
    trimmed === "XBTUSDT"
  ) {
    return { normalizedSymbol: "BTC", originalSymbol: rawSymbol, canonicalTicker: "BTC" };
  }
  // Gold commodity ticker variations
  if (trimmed === "XAU" || trimmed === "GOLD" || trimmed === "GC=F" || trimmed === "GC") {
    return { normalizedSymbol: "GOLD", originalSymbol: rawSymbol, canonicalTicker: "GC" };
  }
  return { normalizedSymbol: trimmed, originalSymbol: rawSymbol, canonicalTicker: trimmed };
}

export interface VenueMarketIdentity {
  assetClass: AssetClass;
  symbol: string;
  venue: string;
  canonicalMarketId: string;
}

/**
 * Resolves venue market identities ensuring that BTC/USD @ Coinbase, BTC/USD @ Kraken,
 * and BTC futures @ CME remain strictly independent telemetry identities.
 */
export function resolveVenueMarketIdentity(symbol: string, venue: string): VenueMarketIdentity {
  const normSym = normalizeAssetSymbol(symbol).canonicalTicker;
  const normVenue = venue.trim().toLowerCase();
  let assetClass: AssetClass = "native_crypto";
  if (normVenue === "cme" || normVenue === "cboe") {
    assetClass = "commodity";
  } else if (normVenue === "nyse" || normVenue === "nasdaq") {
    assetClass = "equity";
  } else if (normVenue === "forex" || normVenue === "interbank") {
    assetClass = "fx";
  }
  return {
    assetClass,
    symbol: normSym,
    venue: normVenue,
    canonicalMarketId: `${normVenue}::${normSym}`,
  };
}
