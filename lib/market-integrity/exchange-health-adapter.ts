export type ExchangeVenueId =
  | "binance"
  | "mexc"
  | "coinbase"
  | "kraken"
  | "bybit"
  | "okx";

export type ExchangeHealthMetricId =
  | "orderbook_depth"
  | "kline_continuity"
  | "book_ticker_freshness"
  | "second_source_divergence"
  | "reserve_disclosure"
  | "withdrawal_incident_lane"
  | "api_stability";

export type ExchangeHealthTone = "live_plan" | "second_source" | "proof_gap" | "operator_review";

export type ExchangeHealthAdapterContract = {
  venueId: ExchangeVenueId;
  venue: string;
  role: "primary" | "second_source" | "coverage_candidate";
  marketDataPlan: string;
  sourceFreshnessTtl: string;
  plannedEndpoints: string[];
  secondSourceRule: string;
  collapseRadarBoundary: string;
  blocker: string;
  tone: ExchangeHealthTone;
};

export type ExchangeHealthMetricRow = {
  id: ExchangeHealthMetricId;
  label: string;
  aiReads: string;
  greenState: string;
  reviewState: string;
  publicCopy: string;
  scoreWeight: number;
};

export type ExchangeHealthVenueScore = {
  venueId: ExchangeVenueId;
  venue: string;
  stabilityScore: number;
  orderbookDepth: number;
  withdrawalHealth: number;
  volumeIntegrity: number;
  reserveTransparency: number;
  apiStability: number;
  socialStress: number;
  sourceState: "adapter_skeleton" | "second_source_skeleton" | "proof_gap";
  humanStatus: string;
};

export type ExchangeHealthBotRule = {
  id: string;
  trigger: string;
  botAction: string;
  allowedCustomerCopy: string;
  forbiddenCopy: string;
};

export type ExchangeHealthAdapterPreview = {
  version: "PASS332.exchange_health_adapter_skeleton";
  headline: string;
  boundary: string;
  adapterContracts: ExchangeHealthAdapterContract[];
  metricRows: ExchangeHealthMetricRow[];
  venueScores: ExchangeHealthVenueScore[];
  botRules: ExchangeHealthBotRule[];
  nextAdapterOrder: string[];
};

const adapterContracts: ExchangeHealthAdapterContract[] = [
  {
    venueId: "binance",
    venue: "Binance",
    role: "primary",
    marketDataPlan:
      "Depth snapshot, kline continuity, 24h ticker and book-ticker freshness become the first live venue lane.",
    sourceFreshnessTtl: "depth ≤ 20s · klines ≤ interval + 90s · ticker ≤ 60s",
    plannedEndpoints: [
      "GET /api/v3/depth",
      "GET /api/v3/klines",
      "GET /api/v3/ticker/24hr",
      "GET /api/v3/ticker/bookTicker",
    ],
    secondSourceRule:
      "A Binance anomaly must be compared against MEXC plus Coinbase/Kraken before public wording changes.",
    collapseRadarBoundary:
      "Binance lane is an anomaly/freshness lane, not a bankruptcy or solvency verdict.",
    blocker:
      "Reserve/liability context and withdrawal-status source still need durable source ledgers.",
    tone: "live_plan",
  },
  {
    venueId: "mexc",
    venue: "MEXC",
    role: "primary",
    marketDataPlan:
      "REST market data plus WebSocket freshness/reconnect discipline feeds the second primary venue lane.",
    sourceFreshnessTtl: "REST ≤ 60s · websocket heartbeat/reconnect policy · fallback visible",
    plannedEndpoints: [
      "GET /api/v3/depth",
      "GET /api/v3/klines",
      "GET /api/v3/ticker/24hr",
      "wss market streams with reconnect",
    ],
    secondSourceRule:
      "A MEXC-only freeze becomes venue-specific review until Binance/Coinbase/Kraken agree.",
    collapseRadarBoundary:
      "MEXC lane may say source expired or depth requires review; it cannot say the exchange is failing.",
    blocker:
      "Production needs cache, timeout policy, subscription watchdog and incident ledger.",
    tone: "live_plan",
  },
  {
    venueId: "coinbase",
    venue: "Coinbase",
    role: "second_source",
    marketDataPlan:
      "Neutral second-source candles/depth for major assets to avoid one-venue panic.",
    sourceFreshnessTtl: "≤ 90s for comparison lane",
    plannedEndpoints: ["candles", "book", "ticker", "status/incidents"],
    secondSourceRule:
      "Used to label divergence: venue-specific stress vs broader market stress.",
    collapseRadarBoundary:
      "Second source reduces false positives; it is not proof that another venue is safe.",
    blocker: "Provider selection and API contract not wired yet.",
    tone: "second_source",
  },
  {
    venueId: "kraken",
    venue: "Kraken",
    role: "second_source",
    marketDataPlan:
      "Second-source orderbook/candle comparison for BTC, ETH, SOL and major stablecoin pairs.",
    sourceFreshnessTtl: "≤ 90s for comparison lane",
    plannedEndpoints: ["order book", "OHLC", "ticker", "status/incidents"],
    secondSourceRule:
      "If Kraken stays normal while a primary lane fails, public copy remains narrow and calm.",
    collapseRadarBoundary:
      "Comparison lane is evidence context, not a trading signal.",
    blocker: "Provider adapter and symbol normalization not wired yet.",
    tone: "second_source",
  },
  {
    venueId: "bybit",
    venue: "Bybit",
    role: "coverage_candidate",
    marketDataPlan:
      "Candidate futures/spot stress lane after primary and second-source tables are stable.",
    sourceFreshnessTtl: "blocked until adapter contract exists",
    plannedEndpoints: ["depth", "klines", "ticker", "status"],
    secondSourceRule:
      "Never use candidate-only stress to raise global alarms.",
    collapseRadarBoundary:
      "Coverage candidate; hidden from strong customer copy until QA passes.",
    blocker: "Future adapter; not production-connected.",
    tone: "operator_review",
  },
  {
    venueId: "okx",
    venue: "OKX",
    role: "coverage_candidate",
    marketDataPlan:
      "Candidate venue for later depth/volume divergence and reserve-disclosure context.",
    sourceFreshnessTtl: "blocked until adapter contract exists",
    plannedEndpoints: ["depth", "candles", "ticker", "reserve/status"],
    secondSourceRule:
      "Used only after source ledger and symbol normalization are ready.",
    collapseRadarBoundary:
      "No public warning language from this lane yet.",
    blocker: "Future adapter; not production-connected.",
    tone: "operator_review",
  },
];

const metricRows: ExchangeHealthMetricRow[] = [
  {
    id: "orderbook_depth",
    label: "Orderbook depth",
    aiReads: "Bid/ask depth, spread expansion, top-of-book gaps and sudden liquidity thinning.",
    greenState: "Depth updates normally and spread stays inside expected venue range.",
    reviewState: "Bid depth dries up, spread expands or book snapshots arrive stale.",
    publicCopy: "Liquidity needs a fresh second-source check before stronger wording.",
    scoreWeight: 18,
  },
  {
    id: "kline_continuity",
    label: "Kline continuity",
    aiReads: "Candles, missing intervals, source timestamp drift and frozen chart segments.",
    greenState: "Candles update continuously for selected intervals.",
    reviewState: "Candles freeze, skip intervals or disagree with ticker direction.",
    publicCopy: "Chart source freshness requires verification.",
    scoreWeight: 14,
  },
  {
    id: "book_ticker_freshness",
    label: "Book ticker freshness",
    aiReads: "Best bid/ask heartbeat and last-source update age.",
    greenState: "Ticker heartbeat remains fresh for the pair.",
    reviewState: "Ticker heartbeat expires or conflicts with depth snapshots.",
    publicCopy: "Live quote lane is temporarily limited; fallback snapshot is active.",
    scoreWeight: 12,
  },
  {
    id: "second_source_divergence",
    label: "Second-source divergence",
    aiReads: "Price/depth/candle differences between primary and neutral venues.",
    greenState: "Primary and second-source venues agree within a calm band.",
    reviewState: "One venue diverges while others remain normal, or all venues widen together.",
    publicCopy: "The anomaly looks venue-specific until independent sources confirm it.",
    scoreWeight: 18,
  },
  {
    id: "reserve_disclosure",
    label: "Reserve transparency",
    aiReads: "Reserve proof, liabilities gap, timestamp, method, legal/off-chain boundary.",
    greenState: "Reserve snapshot and limitations are timestamped and clearly separated.",
    reviewState: "Reserve proof exists but liabilities/off-chain obligations are unclear.",
    publicCopy: "Reserve data improves transparency but is not a safety certificate.",
    scoreWeight: 15,
  },
  {
    id: "withdrawal_incident_lane",
    label: "Withdrawal health",
    aiReads: "Deposit/withdraw status, public incident sources and verified status changes.",
    greenState: "No verified incident and no source-confirmed withdrawal stress.",
    reviewState: "Status changes or public incident claims require source confirmation.",
    publicCopy: "Withdrawal lane needs source verification; rumor is not evidence.",
    scoreWeight: 14,
  },
  {
    id: "api_stability",
    label: "API stability",
    aiReads: "Rate limits, timeouts, websocket reconnects, stale cache and fallback transitions.",
    greenState: "API responds inside timeout and fallback remains disclosed.",
    reviewState: "Timeouts, stale cache or websocket disconnects cluster with market stress.",
    publicCopy: "Live source is limited; local preview is active.",
    scoreWeight: 9,
  },
];

const venueScores: ExchangeHealthVenueScore[] = [
  {
    venueId: "binance",
    venue: "Binance",
    stabilityScore: 72,
    orderbookDepth: 78,
    withdrawalHealth: 64,
    volumeIntegrity: 74,
    reserveTransparency: 63,
    apiStability: 80,
    socialStress: 28,
    sourceState: "adapter_skeleton",
    humanStatus:
      "Stability jest dobra jak na preview, ale pełny opis czeka na trwałe źródła: rezerwy, zobowiązania, wypłaty i drugi venue.",
  },
  {
    venueId: "mexc",
    venue: "MEXC",
    stabilityScore: 68,
    orderbookDepth: 71,
    withdrawalHealth: 58,
    volumeIntegrity: 69,
    reserveTransparency: 52,
    apiStability: 72,
    socialStress: 33,
    sourceState: "adapter_skeleton",
    humanStatus:
      "MEXC ma być mocnym pasem market-data, ale UI musi jasno pokazywać heartbeat, reconnect i fallback, żeby stare dane nie wyglądały jak live.",
  },
  {
    venueId: "coinbase",
    venue: "Coinbase",
    stabilityScore: 66,
    orderbookDepth: 62,
    withdrawalHealth: 66,
    volumeIntegrity: 62,
    reserveTransparency: 56,
    apiStability: 70,
    socialStress: 22,
    sourceState: "second_source_skeleton",
    humanStatus:
      "Second-source lane obniża fałszywe alarmy: porównuje venue, ale sam nie jest certyfikatem bezpieczeństwa.",
  },
  {
    venueId: "kraken",
    venue: "Kraken",
    stabilityScore: 65,
    orderbookDepth: 60,
    withdrawalHealth: 66,
    volumeIntegrity: 61,
    reserveTransparency: 55,
    apiStability: 69,
    socialStress: 24,
    sourceState: "second_source_skeleton",
    humanStatus:
      "Kraken działa jako spokojne drugie źródło dla dużych par i odróżnia problem jednej giełdy od szerokiego stresu rynku.",
  },
  {
    venueId: "bybit",
    venue: "Bybit",
    stabilityScore: 50,
    orderbookDepth: 50,
    withdrawalHealth: 50,
    volumeIntegrity: 50,
    reserveTransparency: 45,
    apiStability: 50,
    socialStress: 35,
    sourceState: "proof_gap",
    humanStatus:
      "Kandydat do pokrycia. Nie podnosi publicznego wniosku, dopóki nie przejdzie QA adaptera i source ledger.",
  },
  {
    venueId: "okx",
    venue: "OKX",
    stabilityScore: 50,
    orderbookDepth: 50,
    withdrawalHealth: 50,
    volumeIntegrity: 50,
    reserveTransparency: 45,
    apiStability: 50,
    socialStress: 35,
    sourceState: "proof_gap",
    humanStatus:
      "Kandydat do dywergencji. Przydatny później, ale bez prawa do mocnych alertów publicznych przed QA i drugim źródłem.",
  },
];

const botRules: ExchangeHealthBotRule[] = [
  {
    id: "rule-skeleton-boundary",
    trigger: "Exchange data is still adapter_skeleton or second_source_skeleton.",
    botAction:
      "Explain that the lane is planned/fallback and list the next source to connect.",
    allowedCustomerCopy:
      "The venue health lane is in preview; source freshness and second-source checks are required.",
    forbiddenCopy: "This exchange is safe / unsafe / insolvent / the next FTX.",
  },
  {
    id: "rule-divergence-before-warning",
    trigger: "One primary venue shows depth/candle/API stress.",
    botAction:
      "Check the same symbol on second-source venues before changing the public status.",
    allowedCustomerCopy:
      "The anomaly appears venue-specific until independent sources confirm it.",
    forbiddenCopy: "The whole market is collapsing from one venue signal.",
  },
  {
    id: "rule-reserve-boundary",
    trigger: "Proof-of-reserves, wallet or audit language is present.",
    botAction:
      "Separate reserve snapshot, liabilities, timestamp, method and off-chain obligations.",
    allowedCustomerCopy:
      "Reserve data is a transparency lane, not a safety certificate.",
    forbiddenCopy: "PoR proves the exchange is solvent and safe.",
  },
];

export function buildExchangeHealthAdapterPreview(): ExchangeHealthAdapterPreview {
  return {
    version: "PASS332.exchange_health_adapter_skeleton",
    headline:
      "Exchange Health turns Binance, MEXC and second-source venues into separate AI lanes: depth, candles, book ticker, reserve boundary, withdrawals, API stability and divergence.",
    boundary:
      "Preview adapter skeleton only. No bankruptcy prediction, no solvency certificate, no trading recommendation and no public accusation without durable evidence.",
    adapterContracts,
    metricRows,
    venueScores,
    botRules,
    nextAdapterOrder: [
      "1. Wire Binance REST depth + klines + ticker/bookTicker with cache and timestamp.",
      "2. Wire MEXC REST + WebSocket heartbeat/reconnect + visible fallback state.",
      "3. Normalize symbols across Coinbase/Kraken before second-source divergence scoring.",
      "4. Add withdrawal incident ledger with verified source timestamp and rumor quarantine.",
      "5. Split reserve proof into reserve snapshot, liabilities gap, methodology and off-chain boundary.",
    ],
  };
}
