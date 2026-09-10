export type VelmereSearchMode =
  | "all"
  | "token"
  | "market"
  | "contract"
  | "velmere"
  | "osint";
export type VelmereSearchSourceMode =
  | "table"
  | "live"
  | "live_table"
  | "fallback"
  | "missing";
export type VelmereSearchRiskTone = "calm" | "review" | "elevated" | "blocked";

export type VelmereSearchSource = {
  id: string;
  label: string;
  mode: VelmereSearchSourceMode;
  freshness: string;
  /** Legacy/internal heuristic. Public customer surfaces must not present this as calibrated confidence unless confidenceCalibrated=true. */
  confidence: number;
  confidenceCalibrated?: boolean;
  /** Deterministic presence coverage for this source lane; not a probability. */
  coverage?: number;
  note: string;
};

export type VelmereShieldBridge = {
  href: string;
  queryKey: string;
  origin: "velmere_search";
  mode: "full_shield_analysis";
  note: string;
};

export type VelmereMarketSnapshot = {
  assetClass?: "crypto" | "stock" | "etf" | "index" | "fx" | "commodity" | "real_estate" | "exchange_equity";
  currency?: string;
  price?: number;
  marketCap?: number;
  fdv?: number;
  volume24h?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  high24h?: number;
  low24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  observedAt?: string;
  liquidityLabel?: string;
  slippage10k?: number;
  depthLabel?: string;
  holderConcentrationLabel?: string;
  unlockLabel?: string;
  venueHealthLabel?: string;
  venueAssetSymbol?: string;
  venuePrimary?: string;
  venueSecondary?: string;
  venuePrimaryQuoteCurrency?: "USD" | "USDT" | "USDC" | "EUR" | "UNKNOWN";
  venueSecondaryQuoteCurrency?: "USD" | "USDT" | "USDC" | "EUR" | "UNKNOWN";
  venueQuoteBasisState?:
    | "same_quote"
    | "fiat_stable_proxy"
    | "stable_stable_proxy"
    | "unsupported";
  venueQuoteBasisPenalty?: number;
  venuePairResolutionState?: "canonical" | "candidate" | "unsupported";
  venuePairResolutionNote?: string;
  venueReferencePrice?: number;
  venueSecondaryPrice?: number;
  venueComparisonState?:
    | "aligned"
    | "watch"
    | "divergent"
    | "stale"
    | "single_source"
    | "unavailable";
  venueDivergenceBps?: number;
  venueSpreadDeltaBps?: number;
  venueFreshnessDeltaSeconds?: number;
  venueHealthScore?: number;
  venueConfidenceCap?: number;
  venueEvidenceNote?: string;
  fundamentalState?: "source_bound" | "partial" | "stale" | "source_required";
  fundamentalQualityScore?: number;
  fundamentalConfidenceCap?: number;
  fundamentalFilingDate?: string;
  fundamentalFilingUrl?: string;
  fundamentalFilingForm?: string;
  fundamentalSecState?:
    | "sec_aligned"
    | "sec_partial"
    | "sec_divergent"
    | "sec_required"
    | "not_applicable";
  fundamentalSecCoverage?: number;
  fundamentalFilingAgeDays?: number;
  fundamentalReportedPeriodEnd?: string;
  fundamentalFreeCashFlowTtm?: number;
  fundamentalNetDebtToEbitda?: number;
  fundamentalCurrentRatio?: number;
  fundamentalRevenueTtm?: number;
  fundamentalProfitMargin?: number;
  fundamentalPeRatio?: number;
  fundamentalExpenseRatio?: number;
  fundamentalNetAssets?: number;
  fundamentalTopHoldings?: string[];
  providerState?:
    | "source_bound"
    | "not_configured"
    | "rate_limited"
    | "provider_error"
    | "unsupported";
  providerFunctions?: string[];
  providerExchange?: string;
  etfTop10Concentration?: number;
  etfEffectiveHoldings?: number;
  etfBenchmarkSymbol?: string;
  etfOverlapPercent?: number;
  fundamentalBoundary?: string;
  anomalyLabel?: string;
};

export type VelmereOfficialReferenceSnapshot = {
  schemaVersion: "velmere.r7.browser-official-reference-snapshot.v1";
  providerId: "ecb_statistics";
  pair: "EUR/USD" | "EUR/PLN" | "EUR/GBP" | "EUR/TRY";
  baseCurrency: "EUR";
  quoteCurrency: "USD" | "PLN" | "GBP" | "TRY";
  referenceRate: number;
  referenceDate: string;
  responseSha256: string;
  fieldIds: readonly ["market.reference_rate", "market.reference_date"];
  statisticsModified: false;
  directPublishedPair: true;
  referenceOnly: true;
  executableQuote: false;
  marketPriceFieldEligible: false;
  paidValueEligible: false;
  attribution: "Source: ECB statistics.";
};

export type VelmereSearchResult = {
  id: string;
  title: string;
  symbol?: string;
  category: "token" | "market" | "contract" | "velmere" | "osint" | "document";
  tone: VelmereSearchRiskTone;
  summary: string;
  whyItMatters: string;
  missingData: string[];
  nextOperatorStep: string;
  sourceMode: VelmereSearchSourceMode;
  /** Legacy/internal heuristic. Public projection is forced to 0 unless sourceConfidenceCalibrated=true. */
  sourceConfidence: number;
  sourceConfidenceCalibrated?: boolean;
  /** Customer-visible data/source-lane coverage. This is not confidence or probability. */
  sourceCoverage?: number;
  shieldHref: string;
  avatarLabel?: string;
  avatarImage?: string;
  bridge?: VelmereShieldBridge;
  sources: VelmereSearchSource[];
  chips: string[];
  marketSnapshot?: VelmereMarketSnapshot;
  /** Exact official-reference evidence; never projected into marketSnapshot.price. */
  officialReferenceSnapshot?: VelmereOfficialReferenceSnapshot;
  /** Short-lived server-signed proof that this exact result came from the search runtime. */
  lensSourceToken?: string;
  lensSourceTokenExpiresAt?: string;
};

export const velmereSearchModeLabels = {
  all: "All",
  token: "Tokens",
  market: "Markets",
  contract: "Contracts",
  velmere: "Velmère",
  osint: "OSINT",
} satisfies Record<VelmereSearchMode, string>;

export function buildVelmereShieldBridge(
  query: string,
  assetId?: string,
): VelmereShieldBridge {
  const queryKey = normalizeSearchQuery(assetId || query || "research");
  const params = new URLSearchParams();
  params.set(assetId ? "asset" : "query", queryKey);
  params.set("from", "velmere-search");
  params.set("view", "full");
  params.set("handoff", "pass453");
  params.set("source", "lens-pdf");
  return {
    href: `/market-integrity?${params.toString()}`,
    queryKey,
    origin: "velmere_search",
    mode: "full_shield_analysis",
    note: "PASS453 Search-to-Shield handoff: Browser, PDF and Shield open the same source-bound asset route.",
  };
}

const tokenSeed: VelmereSearchResult[] = [
  {
    id: "solana",
    title: "Solana",
    symbol: "SOL",
    category: "token",
    tone: "review",
    summary:
      "High-activity asset with strong market visibility. The short readout stays partial until source freshness, contract context and holder concentration are attached.",
    whyItMatters:
      "Fast attention spikes can make a token look cleaner than the available evidence actually supports.",
    missingData: [
      "fresh holder cluster snapshot",
      "contract permission review",
      "orderbook depth by venue",
    ],
    nextOperatorStep:
      "Open Velmère Shield full analysis and compare market, source and liquidity lanes before treating the score as stable.",
    sourceMode: "live_table",
    sourceConfidence: 66,
    shieldHref: buildVelmereShieldBridge("SOL", "solana").href,
    avatarLabel: "SOL",
    avatarImage:
      "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    bridge: buildVelmereShieldBridge("SOL", "solana"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 64,
        note: "local indexed token context",
      },
      {
        id: "source-ledger",
        label: "Source ledger preview",
        mode: "fallback",
        freshness: "preview",
        confidence: 52,
        note: "needs live adapter",
      },
    ],
    chips: ["market context", "liquidity review", "full Shield shortcut"],
  },
  {
    id: "bitcoin",
    title: "Bitcoin",
    symbol: "BTC",
    category: "token",
    tone: "calm",
    summary:
      "Large-cap baseline asset. The short readout focuses on volatility, volume quality and source freshness rather than a directional call.",
    whyItMatters:
      "Even high-liquidity assets can have noisy candles, venue-specific spread and stale source windows.",
    missingData: [
      "venue-specific orderbook depth",
      "fresh candle source timestamp",
    ],
    nextOperatorStep:
      "Open Shield and verify candle/source lanes before comparing against smaller tokens.",
    sourceMode: "live_table",
    sourceConfidence: 74,
    shieldHref: buildVelmereShieldBridge("BTC", "bitcoin").href,
    avatarLabel: "BTC",
    avatarImage:
      "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    bridge: buildVelmereShieldBridge("BTC", "bitcoin"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 71,
        note: "baseline asset context",
      },
      {
        id: "source-ledger",
        label: "Source ledger preview",
        mode: "fallback",
        freshness: "preview",
        confidence: 57,
        note: "adapter not attached",
      },
    ],
    chips: ["baseline", "volume quality", "source freshness"],
  },

  {
    id: "basic-attention-token",
    title: "Basic Attention Token",
    symbol: "BAT",
    category: "token",
    tone: "review",
    summary:
      "Attention-market token. The short readout separates price movement, liquidity, browser/attention narrative and source freshness before confidence rises.",
    whyItMatters:
      "Narrative tokens can look clean when only price is visible; Shield keeps liquidity, venue depth and second-source agreement visible.",
    missingData: [
      "fresh BAT venue depth",
      "second-source price comparison",
      "attention/narrative source freshness",
    ],
    nextOperatorStep:
      "Open Shield and verify BAT market data with venue depth and second-source divergence before stronger copy.",
    sourceMode: "live_table",
    sourceConfidence: 58,
    shieldHref: buildVelmereShieldBridge("BAT", "basic-attention-token").href,
    avatarLabel: "BAT",
    avatarImage:
      "https://assets.coingecko.com/coins/images/677/large/basic-attention-token.png",
    bridge: buildVelmereShieldBridge("BAT", "basic-attention-token"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 54,
        note: "attention token context",
      },
      {
        id: "coingecko-ready",
        label: "CoinGecko logo/market lane",
        mode: "fallback",
        freshness: "preview",
        confidence: 58,
        note: "enriched by live search when available",
      },
    ],
    chips: ["attention asset", "source freshness", "second source"],
  },
  {
    id: "binancecoin",
    title: "BNB",
    symbol: "BNB",
    category: "token",
    tone: "review",
    summary:
      "Exchange-linked large-cap asset. The short readout separates token context from venue-health context, then asks for depth, reserve and second-source checks.",
    whyItMatters:
      "Exchange-linked assets can mix market movement, venue confidence and broad crypto sentiment, so Shield keeps those lanes separate.",
    missingData: [
      "fresh BNB venue depth",
      "second-source orderbook comparison",
      "exchange-health adapter state",
    ],
    nextOperatorStep:
      "Open Cross-Asset Shield and compare Binance/MEXC venue lanes before raising confidence.",
    sourceMode: "live_table",
    sourceConfidence: 63,
    shieldHref: buildVelmereShieldBridge("BNB", "binancecoin").href,
    avatarLabel: "BNB",
    avatarImage:
      "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    bridge: buildVelmereShieldBridge("BNB", "binancecoin"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 60,
        note: "exchange-linked token context",
      },
      {
        id: "cross-asset",
        label: "Cross-Asset Shield",
        mode: "fallback",
        freshness: "preview",
        confidence: 55,
        note: "venue-health adapter planned",
      },
    ],
    chips: ["exchange asset", "venue context", "second source"],
  },
  {
    id: "bittensor",
    title: "Bittensor",
    symbol: "TAO",
    category: "token",
    tone: "review",
    summary:
      "AI-sector asset. The short readout keeps volatility, social attention and source freshness separate before any public confidence copy.",
    whyItMatters:
      "Sector narratives can heat up quickly; Shield treats attention as context, not proof.",
    missingData: [
      "fresh venue depth",
      "second-source price comparison",
      "social/source freshness",
    ],
    nextOperatorStep:
      "Run Shield review and compare market depth with the second-source matrix.",
    sourceMode: "table",
    sourceConfidence: 52,
    shieldHref: buildVelmereShieldBridge("TAO", "bittensor").href,
    avatarLabel: "TAO",
    bridge: buildVelmereShieldBridge("TAO", "bittensor"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 52,
        note: "sector context",
      },
    ],
    chips: ["AI sector", "source rhythm", "volatility"],
  },
  {
    id: "bonk",
    title: "Bonk",
    symbol: "BONK",
    category: "token",
    tone: "elevated",
    summary:
      "High-attention meme asset. The short readout focuses on hype filter, liquidity quality and source freshness instead of trend chasing.",
    whyItMatters:
      "Meme assets can move faster than available evidence; missing depth or holder data should reduce confidence.",
    missingData: [
      "fresh holder snapshot",
      "orderbook depth by venue",
      "social source ledger",
    ],
    nextOperatorStep:
      "Use Shield to review liquidity, holder distribution and second-source agreement before any stronger wording.",
    sourceMode: "table",
    sourceConfidence: 41,
    shieldHref: buildVelmereShieldBridge("BONK", "bonk").href,
    avatarLabel: "BONK",
    bridge: buildVelmereShieldBridge("BONK", "bonk"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 41,
        note: "meme asset context",
      },
    ],
    chips: ["meme asset", "hype filter", "liquidity review"],
  },
  {
    id: "ethereum",
    title: "Ethereum",
    symbol: "ETH",
    category: "token",
    tone: "review",
    summary:
      "Large-cap smart-contract asset. The quick summary highlights source freshness, contract ecosystem complexity and liquidity context.",
    whyItMatters:
      "Network-level trust does not remove token-specific, venue-specific or source-specific blind spots.",
    missingData: [
      "fresh venue depth",
      "ecosystem contract context",
      "holder cluster snapshot",
    ],
    nextOperatorStep:
      "Use full Shield analysis for the token-specific evidence lanes.",
    sourceMode: "live_table",
    sourceConfidence: 69,
    shieldHref: buildVelmereShieldBridge("ETH", "ethereum").href,
    avatarLabel: "ETH",
    avatarImage:
      "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    bridge: buildVelmereShieldBridge("ETH", "ethereum"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 68,
        note: "local indexed context",
      },
      {
        id: "source-ledger",
        label: "Source ledger preview",
        mode: "fallback",
        freshness: "preview",
        confidence: 54,
        note: "needs live adapter",
      },
    ],
    chips: ["smart contract context", "liquidity", "source review"],
  },
  {
    id: "usdc",
    title: "USD Coin",
    symbol: "USDC",
    category: "token",
    tone: "review",
    summary:
      "Stablecoin-style asset. The short readout prioritizes peg context, issuer/source data and liquidity instead of market-hype scoring.",
    whyItMatters:
      "Stable assets require different evidence: reserves/source transparency, peg deviations and venue liquidity.",
    missingData: [
      "fresh peg deviation feed",
      "issuer/source ledger",
      "venue liquidity split",
    ],
    nextOperatorStep:
      "Open Shield and review source quality, peg context and exchange depth.",
    sourceMode: "table",
    sourceConfidence: 61,
    shieldHref: buildVelmereShieldBridge("USDC", "usd-coin").href,
    avatarLabel: "USDC",
    avatarImage:
      "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png",
    bridge: buildVelmereShieldBridge("USDC", "usd-coin"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 61,
        note: "stablecoin context",
      },
    ],
    chips: ["stablecoin", "peg context", "source quality"],
  },
];



function realMarketAssetClass(symbol: string): VelmereMarketSnapshot["assetClass"] {
  if (symbol.startsWith("^") || symbol === "^GSPC" || symbol === "^NDX" || symbol === "^GDAXI") return "index";
  if (["SPY", "QQQ", "VOO", "GLD", "VNQ"].includes(symbol)) return "etf";
  if (symbol.endsWith("=F")) return "commodity";
  if (symbol.endsWith("=X")) return "fx";
  return "stock";
}

const realMarketSeed: VelmereSearchResult[] = [
  { symbol: "^GSPC", title: "S&P 500", id: "sp-500", currency: "USD", avatarLabel: "S&P", assetClass: "index", chips: ["index", "S&P 500", "Real Markets"] },
  { symbol: "SPY", title: "SPDR S&P 500 ETF Trust", id: "spy", currency: "USD", avatarLabel: "SPY", assetClass: "etf", chips: ["ETF", "S&P 500", "Real Markets"] },
  { symbol: "QQQ", title: "Invesco QQQ Trust", id: "qqq", currency: "USD", avatarLabel: "QQQ", assetClass: "etf", chips: ["ETF", "Nasdaq 100", "Real Markets"] },
  { symbol: "AAPL", title: "Apple", id: "apple", currency: "USD", avatarLabel: "AAPL", assetClass: "stock", chips: ["stock", "Yahoo Finance", "Real Markets"] },
  { symbol: "NVDA", title: "NVIDIA", id: "nvidia", currency: "USD", avatarLabel: "NVDA", assetClass: "stock", chips: ["stock", "AI infrastructure", "Real Markets"] },
  { symbol: "GOOGL", title: "Alphabet", id: "alphabet", currency: "USD", avatarLabel: "GOOGL", chips: ["stock", "search", "Real Markets"] },
  { symbol: "MSFT", title: "Microsoft", id: "microsoft", currency: "USD", avatarLabel: "MSFT", chips: ["stock", "cloud", "Real Markets"] },
  { symbol: "AMZN", title: "Amazon", id: "amazon", currency: "USD", avatarLabel: "AMZN", chips: ["stock", "commerce", "Real Markets"] },
  { symbol: "META", title: "Meta Platforms", id: "meta-platforms", currency: "USD", avatarLabel: "META", chips: ["stock", "social", "Real Markets"] },
  { symbol: "TSLA", title: "Tesla", id: "tesla", currency: "USD", avatarLabel: "TSLA", chips: ["stock", "auto", "Real Markets"] },
  { symbol: "ADS.DE", title: "Adidas", id: "adidas", currency: "EUR", avatarLabel: "ADS", chips: ["stock", "Germany", "Real Markets"] },
  { symbol: "BMW.DE", title: "BMW", id: "bmw", currency: "EUR", avatarLabel: "BMW", chips: ["stock", "Germany", "Real Markets"] },
  { symbol: "MC.PA", title: "LVMH", id: "lvmh", currency: "EUR", avatarLabel: "LVMH", chips: ["stock", "luxury", "Real Markets"] },
].map((item): VelmereSearchResult => {
  const hrefParams = new URLSearchParams();
  hrefParams.set("asset", item.symbol);
  hrefParams.set("from", "velmere-search");
  hrefParams.set("source", "lens-real-markets");
  return {
    id: item.id,
    title: item.title,
    symbol: item.symbol,
    category: "market",
    tone: "review",
    summary: `${item.title} is indexed in Velmère Real Markets. Lens should treat it as a market instrument, not as OSINT/missing source.`,
    whyItMatters: "Real Markets already owns the table, logo, price and chart context for this instrument; Browser/PDF must not downgrade it to a missing-source token query.",
    missingData: ["independent second provider confirmation", "fundamental/filing freshness", "market-cap metadata if provider omits it", "source cadence if live quote is stale", "PASS2278: Stooq second quote adapter only counts when returned by runtime"],
    nextOperatorStep: "Open Real Markets and keep price, risk, market cap, chart source and missing metadata aligned before generating PDF copy.",
    sourceMode: "live_table",
    sourceConfidence: 70,
    shieldHref: `/real-markets?${hrefParams.toString()}`,
    avatarLabel: item.avatarLabel,
    bridge: buildVelmereShieldBridge(item.symbol, item.id),
    marketSnapshot: { assetClass: realMarketAssetClass(item.symbol), currency: item.currency, providerState: "source_bound", providerFunctions: ["quote", "chart", "metadata", "source-cadence-matrix"] },
    sources: [
      { id: "real-markets-table", label: "Velmère Real Markets", mode: "table", freshness: "local", confidence: 72, note: "indexed instrument row" },
      { id: "yahoo-quote-adapter", label: "Yahoo Finance quote adapter", mode: "live_table", freshness: "on demand", confidence: 68, note: "quote endpoint used by Real Markets/VLM flow" },
      { id: "yahoo-chart-adapter", label: "Yahoo Finance chart adapter", mode: "live_table", freshness: "on demand", confidence: 66, note: "chart endpoint used for 7d movement and PDF/Shield parity" },
      { id: "stooq-second-provider-lane", label: "Stooq second provider lane", mode: "fallback", freshness: "runtime only", confidence: 0, note: "not counted as confirmed until resolveRealMarketVlmRiskResult receives a Stooq quote" },
      { id: "source-cadence-matrix", label: "Velmère source cadence matrix", mode: "table", freshness: "local", confidence: 64, note: "records which fields still need independent confirmation" },
    ],
    chips: item.chips,
  };
});

const velmereSeed: VelmereSearchResult[] = [
  {
    id: "tether",
    title: "Tether",
    symbol: "USDT",
    category: "token",
    tone: "review",
    summary:
      "Stablecoin-style asset. The short readout keeps peg behavior, reserve/disclosure freshness and venue liquidity separate from ordinary token momentum.",
    whyItMatters:
      "Stable assets can look quiet while source, reserve or peg evidence still needs a current timestamp.",
    missingData: [
      "fresh peg deviation feed",
      "reserve/disclosure timestamp",
      "venue liquidity split",
    ],
    nextOperatorStep:
      "Open Shield and review peg context, issuer/source quality and exchange depth before stronger copy.",
    sourceMode: "live_table",
    sourceConfidence: 59,
    shieldHref: buildVelmereShieldBridge("USDT", "tether").href,
    avatarLabel: "USDT",
    avatarImage:
      "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    bridge: buildVelmereShieldBridge("USDT", "tether"),
    sources: [
      {
        id: "local-table",
        label: "Velmère table",
        mode: "table",
        freshness: "cached",
        confidence: 59,
        note: "stablecoin context",
      },
    ],
    chips: ["stablecoin", "peg context", "reserve timestamp"],
  },
  {
    id: "velmere-shield",
    title: "Velmère Shield",
    category: "velmere",
    tone: "review",
    summary:
      "Risk-radar surface for token context, source lanes, VLM brain readouts and full Shield analysis.",
    whyItMatters:
      "This is the shortcut from quick search into deeper token evidence review.",
    missingData: ["live third-party adapters", "durable source snapshots"],
    nextOperatorStep:
      "Use the Shield shortcut when a token result needs full chart, source and VLM readout.",
    sourceMode: "table",
    sourceConfidence: 82,
    shieldHref: buildVelmereShieldBridge("Velmère Shield", "shield").href,
    avatarLabel: "VLM",
    bridge: buildVelmereShieldBridge("Velmère Shield", "shield"),
    sources: [
      {
        id: "velmere-doc",
        label: "Velmère internal page map",
        mode: "table",
        freshness: "local",
        confidence: 82,
        note: "site route",
      },
    ],
    chips: ["full analysis", "VLM brain", "source lanes"],
  },
  {
    id: "vlm-access",
    title: "VLM Access",
    category: "velmere",
    tone: "review",
    summary:
      "Access and utility layer for Velmère experiences. Search keeps it as product access context, not a return promise.",
    whyItMatters:
      "VLM should be described as access/utility only and not as a performance claim.",
    missingData: ["final access policy", "wallet gate implementation"],
    nextOperatorStep:
      "Open the VLM page when the question is about access, not risk verdicts.",
    sourceMode: "table",
    sourceConfidence: 76,
    shieldHref: "/vlm-token",
    avatarLabel: "VLM",
    bridge: buildVelmereShieldBridge("VLM Access", "vlm-access"),
    sources: [
      {
        id: "velmere-page",
        label: "Velmère VLM page",
        mode: "table",
        freshness: "local",
        confidence: 76,
        note: "site route",
      },
    ],
    chips: ["access", "utility", "no ROI promise"],
  },
];

export function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 96);
}

export function sourceEvidenceCoverageForMode(mode: VelmereSearchSourceMode): number {
  // Presence-only coverage. Live/table lanes are present; fallback/missing lanes are not
  // counted as confirmed coverage. This is intentionally not a confidence score.
  return mode === "live" || mode === "live_table" || mode === "table" ? 100 : 0;
}

export function sourceEvidenceCoverageScore(
  input: Pick<VelmereSearchResult, "sources"> | { sources?: readonly Pick<VelmereSearchSource, "mode">[] },
): number {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (!sources.length) return 0;
  const total = sources.reduce((sum, source) => sum + sourceEvidenceCoverageForMode(source.mode), 0);
  return Math.round((total / sources.length) * 100) / 100;
}

export function publicCalibratedSourceConfidence(
  input: Pick<VelmereSearchResult, "sourceConfidence" | "sourceConfidenceCalibrated">,
): number | null {
  if (input.sourceConfidenceCalibrated !== true) return null;
  const value = Number(input.sourceConfidence);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

export function projectPublicSearchSourceMetrics(item: VelmereSearchResult): VelmereSearchResult {
  const sourceCoverage = sourceEvidenceCoverageScore(item);
  const calibratedConfidence = publicCalibratedSourceConfidence(item);
  return {
    ...item,
    sourceCoverage,
    sourceConfidence: calibratedConfidence ?? 0,
    sourceConfidenceCalibrated: calibratedConfidence !== null,
    sources: item.sources.map((source) => {
      const sourceConfidence = source.confidenceCalibrated === true && Number.isFinite(source.confidence)
        ? Math.max(0, Math.min(100, source.confidence))
        : 0;
      return {
        ...source,
        coverage: sourceEvidenceCoverageForMode(source.mode),
        confidence: sourceConfidence,
        confidenceCalibrated: source.confidenceCalibrated === true && Number.isFinite(source.confidence),
      };
    }),
  };
}

function scoreVelmereSearchResult(item: VelmereSearchResult, query: string) {
  const clean = query.trim().toLowerCase();
  if (!clean) return 10;
  const symbol = (item.symbol ?? "").toLowerCase();
  const title = item.title.toLowerCase();
  const id = item.id.toLowerCase();
  const chips = item.chips.join(" ").toLowerCase();
  const summary = item.summary.toLowerCase();
  const titleWords = title.split(/[^a-z0-9]+/).filter(Boolean);

  if (symbol === clean) return 0;
  if (id === clean) return 1;
  if (title === clean) return 2;
  if (symbol.startsWith(clean)) return 3;
  if (titleWords.some((word) => word.startsWith(clean))) return 4;
  if (id.startsWith(clean)) return 5;
  if (clean.length >= 4 && title.includes(clean)) return 7;
  if (clean.length >= 4 && chips.includes(clean)) return 8;
  if (clean.length >= 4 && summary.includes(clean)) return 9;
  return Number.POSITIVE_INFINITY;
}

export function buildFallbackResult(query: string): VelmereSearchResult {
  const clean = normalizeSearchQuery(query) || "unknown asset";
  return {
    id: `fallback-${
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 36) || "query"
    }`,
    title: clean,
    symbol: clean.length <= 8 ? clean.toUpperCase() : undefined,
    category: "osint",
    tone: "blocked",
    summary:
      "Velmère has no strong indexed result yet. This should be treated as a research request, not a confirmed token verdict.",
    whyItMatters:
      "Unknown or low-data assets can look neutral only because evidence is missing.",
    missingData: [
      "market source",
      "contract address",
      "holder snapshot",
      "orderbook depth",
      "OSINT source ledger",
    ],
    nextOperatorStep:
      "Run full Shield analysis only after attaching source, chain and contract context.",
    sourceMode: "missing",
    sourceConfidence: 24,
    shieldHref: buildVelmereShieldBridge(clean).href,
    avatarLabel: clean.slice(0, 3).toUpperCase(),
    bridge: buildVelmereShieldBridge(clean),
    sources: [
      {
        id: "missing-source",
        label: "No indexed source",
        mode: "missing",
        freshness: "missing",
        confidence: 24,
        note: "manual review required",
      },
    ],
    chips: ["missing data", "manual review", "Shield shortcut"],
  };
}

function applyLocalTokenSourceBoundary(
  item: VelmereSearchResult,
): VelmereSearchResult {
  if (item.category !== "token" && item.category !== "contract") return item;
  if (item.sources.some((source) => source.mode === "live")) return item;

  const localSources = item.sources.filter(
    (source) =>
      source.id !== "source-ledger" && source.id !== "coingecko-ready",
  );
  const sourceRequired: VelmereSearchSource = {
    id: "live-market-source-required",
    label: "Live market source required",
    mode: "missing",
    freshness: "missing",
    confidence: 0,
    note: "The local catalog identifies the asset only. Price, volume, depth and venue agreement require a fresh provider request.",
  };
  const missingData = Array.from(
    new Set([
      ...item.missingData,
      "fresh live market provider response",
      "second-source venue agreement",
    ]),
  ).slice(0, 8);

  return {
    ...item,
    sourceMode: "fallback",
    sourceConfidence: Math.min(item.sourceConfidence, 48),
    missingData,
    sources: [...localSources, sourceRequired].slice(0, 4),
  };
}

export function searchVelmereIntelligence(
  query: string,
  mode: VelmereSearchMode = "all",
) {
  const clean = normalizeSearchQuery(query);
  const all = [...tokenSeed, ...realMarketSeed, ...velmereSeed].map(applyLocalTokenSourceBoundary);

  if (!clean) {
    return {
      query: clean,
      mode,
      results: all.slice(0, 5),
      generatedAt: new Date().toISOString(),
      productionBoundary:
        "Local preview search only. Live web/OSINT adapters are not attached yet.",
    };
  }

  const scored = all
    .filter((item) => {
      if (
        mode !== "all" &&
        item.category !== mode &&
        !(mode === "contract" && item.category === "token")
      )
        return false;
      return Number.isFinite(scoreVelmereSearchResult(item, clean));
    })
    .map((item) => ({ item, score: scoreVelmereSearchResult(item, clean) }))
    .sort(
      (a, b) =>
        a.score - b.score || b.item.sourceConfidence - a.item.sourceConfidence,
    );

  // PASS359: exact symbol/id/name queries are single-result by design.
  // This stops ETH from returning Tether/other substring matches in the Lens result list.
  const bestScore = scored[0]?.score ?? Number.POSITIVE_INFINITY;
  const results = scored.length
    ? bestScore <= 2
      ? [scored[0].item]
      : scored.map(({ item }) => item)
    : [buildFallbackResult(clean)];

  return {
    query: clean,
    mode,
    results,
    generatedAt: new Date().toISOString(),
    productionBoundary:
      "Local preview search only. Live web/OSINT adapters are not attached yet.",
  };
}
