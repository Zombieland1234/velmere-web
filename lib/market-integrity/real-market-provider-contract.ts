export type RealMarketProviderLane = {
  id: string;
  label: string;
  covers: string;
  primaryProvider: string;
  secondSource: string;
  cadence: string;
  freshnessTtlSeconds: number;
  uiState: "live-ready" | "key-required" | "daily-reference" | "slow-macro" | "operator-review";
  publicBoundary: string;
  nextStep: string;
};

export type RealMarketSymbolContract = {
  symbol: string;
  name: string;
  assetClass: "stock" | "fx" | "etf" | "commodity" | "real_estate" | "crypto_reference" | "exchange";
  logoKind: "brand" | "currency" | "commodity" | "shield" | "venue";
  preferredLane: string;
  priceContract: string;
  disclosureContract: string;
  confidenceGate: string;
};

export type RealMarketProviderContract = {
  version: "PASS345.real_market_provider_contract";
  generatedBy: "Velmere Shield";
  headline: string;
  boundary: string;
  lanes: RealMarketProviderLane[];
  symbols: RealMarketSymbolContract[];
  uiRules: string[];
};

const lanes: RealMarketProviderLane[] = [
  {
    id: "crypto_depth_fast",
    label: "Crypto depth fast lane",
    covers: "BTC/ETH/BNB/USDT spot pairs, klines, ticker and orderbook depth",
    primaryProvider: "Binance market-data REST/WebSocket",
    secondSource: "MEXC WebSocket + Coinbase/Kraken comparison",
    cadence: "10s-60s with explicit stale/fallback badges",
    freshnessTtlSeconds: 90,
    uiState: "live-ready",
    publicBoundary: "Fast crypto data is market context, not a safety verdict and not financial advice.",
    nextStep: "Wire adapter heartbeat, endpoint weight guard and second-source divergence row.",
  },
  {
    id: "equity_disclosure",
    label: "Equity + disclosure lane",
    covers: "AAPL, NVDA, MSFT, COIN, JPM, MC.PA and future stocks",
    primaryProvider: "market price provider after key",
    secondSource: "SEC EDGAR/company disclosure timestamp or issuer calendar",
    cadence: "15m/daily prices + slower filing events",
    freshnessTtlSeconds: 900,
    uiState: "key-required",
    publicBoundary: "Stock rows must show provider-required state until a real price adapter and disclosure timestamp exist.",
    nextStep: "Add server provider wrapper with cache, timestamp and no-live fallback copy.",
  },
  {
    id: "fx_reference",
    label: "FX reference lane",
    covers: "EUR/USD, EUR/PLN, USD/JPY, USD/PLN, CHF/PLN",
    primaryProvider: "official daily reference + later intraday FX feed",
    secondSource: "intraday provider cross-check before stronger confidence",
    cadence: "daily reference first, intraday only after adapter key",
    freshnessTtlSeconds: 86400,
    uiState: "daily-reference",
    publicBoundary: "Reference rates are context and may not equal executable transaction prices.",
    nextStep: "Add reference timestamp and holiday calendar so stale days are visible.",
  },
  {
    id: "macro_real_estate",
    label: "Real estate / macro lane",
    covers: "VNQ/IYR proxy, REIT stress, mortgage and housing macro releases",
    primaryProvider: "ETF price provider + FRED/FHFA style macro release calendar",
    secondSource: "macro release timestamp compared with REIT/ETF move",
    cadence: "daily ETF proxy + monthly/quarterly macro",
    freshnessTtlSeconds: 604800,
    uiState: "slow-macro",
    publicBoundary: "Slow macro context cannot be treated like a live exchange alarm.",
    nextStep: "Build slow-macro badge and stop mixing REIT data with crypto-fast lanes.",
  },
  {
    id: "commodity_context",
    label: "Commodity context lane",
    covers: "XAU/USD, XAG/USD, WTI, Brent and energy/metal context",
    primaryProvider: "commodity/FX provider after key",
    secondSource: "FX/rates context and contract/source method disclosure",
    cadence: "near-live only after provider, otherwise provider-required preview",
    freshnessTtlSeconds: 900,
    uiState: "key-required",
    publicBoundary: "Commodity rows must disclose whether spot, futures or proxy data is being shown.",
    nextStep: "Normalize XAU/XAG/OIL symbols and display source method before confidence.",
  },
  {
    id: "proof_passport",
    label: "Proof passport lane",
    covers: "Velmere Security, Lens PDF, product provenance and customer-readable receipts",
    primaryProvider: "source ledger + redacted evidence receipt",
    secondSource: "operator review before public wording",
    cadence: "event-based with immutable timestamp once storage exists",
    freshnessTtlSeconds: 31536000,
    uiState: "operator-review",
    publicBoundary: "Premium trust language must prove lifecycle/context, never claim certainty or solvency.",
    nextStep: "Move LVMH-style transparency into a Velmere proof-passport UI, not into noisy trading copy.",
  },
];

const symbols: RealMarketSymbolContract[] = [
  { symbol: "EUR/USD", name: "Euro / Dollar", assetClass: "fx", logoKind: "currency", preferredLane: "fx_reference", priceContract: "reference + future intraday", disclosureContract: "reference timestamp", confidenceGate: "daily-reference visible" },
  { symbol: "EUR/PLN", name: "Euro / Polish Zloty", assetClass: "fx", logoKind: "currency", preferredLane: "fx_reference", priceContract: "reference + future intraday", disclosureContract: "reference timestamp", confidenceGate: "daily-reference visible" },
  { symbol: "USD/JPY", name: "Dollar / Yen", assetClass: "fx", logoKind: "currency", preferredLane: "fx_reference", priceContract: "provider required", disclosureContract: "methodology timestamp", confidenceGate: "no live claim without provider" },
  { symbol: "AAPL", name: "Apple", assetClass: "stock", logoKind: "brand", preferredLane: "equity_disclosure", priceContract: "stock candles after provider key", disclosureContract: "SEC/company event timestamp", confidenceGate: "filing/event lane required" },
  { symbol: "NVDA", name: "Nvidia", assetClass: "stock", logoKind: "brand", preferredLane: "equity_disclosure", priceContract: "stock candles after provider key", disclosureContract: "earnings/filing timestamp", confidenceGate: "sector basket before strong copy" },
  { symbol: "MC.PA", name: "LVMH proxy", assetClass: "stock", logoKind: "brand", preferredLane: "equity_disclosure", priceContract: "EU equity provider required", disclosureContract: "issuer calendar/company disclosure", confidenceGate: "luxury sector context only" },
  { symbol: "SPY", name: "S&P 500 ETF", assetClass: "etf", logoKind: "brand", preferredLane: "equity_disclosure", priceContract: "ETF candles after provider key", disclosureContract: "holdings cadence", confidenceGate: "broad market context" },
  { symbol: "VNQ", name: "REIT basket", assetClass: "real_estate", logoKind: "brand", preferredLane: "macro_real_estate", priceContract: "REIT/ETF proxy after provider", disclosureContract: "macro release date", confidenceGate: "slow macro badge" },
  { symbol: "XAU/USD", name: "Gold", assetClass: "commodity", logoKind: "commodity", preferredLane: "commodity_context", priceContract: "spot/futures method required", disclosureContract: "provider method timestamp", confidenceGate: "method visible before confidence" },
  { symbol: "XAG/USD", name: "Silver", assetClass: "commodity", logoKind: "commodity", preferredLane: "commodity_context", priceContract: "spot/futures method required", disclosureContract: "provider method timestamp", confidenceGate: "method visible before confidence" },
  { symbol: "BTC", name: "Bitcoin", assetClass: "crypto_reference", logoKind: "shield", preferredLane: "crypto_depth_fast", priceContract: "fast spot lane", disclosureContract: "orderbook/depth timestamp", confidenceGate: "second venue comparison" },
  { symbol: "MEXC", name: "MEXC adapter", assetClass: "exchange", logoKind: "venue", preferredLane: "crypto_depth_fast", priceContract: "websocket freshness", disclosureContract: "connection expiry/reconnect state", confidenceGate: "fallback visible" },
];

export function buildRealMarketProviderContract(): RealMarketProviderContract {
  return {
    version: "PASS345.real_market_provider_contract",
    generatedBy: "Velmere Shield",
    headline: "Real Markets now has a provider contract: every row shows what can be live, what needs a key, what is daily reference and what must stay slow macro.",
    boundary: "This contract is a UI/source readiness layer. It does not turn preview data into investment advice, solvency proof or a guaranteed signal.",
    lanes,
    symbols,
    uiRules: [
      "Top Real Markets table must open with FX/stocks/ETF/commodities/real estate, not crypto clutter.",
      "Every provider-pending row shows a calm provider-required chip instead of fake live price.",
      "Fast venues use heartbeat/fallback/expired badges; slow macro uses release cadence badges.",
      "Proof-passport language follows traceability and transparency, not hype or pressure.",
    ],
  };
}
