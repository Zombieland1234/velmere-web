export type MarketSourceCadenceLaneId =
  | "crypto_spot"
  | "exchange_health"
  | "stocks"
  | "fx"
  | "real_estate"
  | "commodities"
  | "etf"
  | "ftx_regression";

export type MarketSourceCadenceTone = "fast_live" | "daily_reference" | "slow_macro" | "historical_regression" | "operator_blocked";

export type MarketSourceCadenceRow = {
  id: MarketSourceCadenceLaneId;
  label: string;
  tableName: string;
  sourcePlan: string;
  cadence: string;
  freshnessTtl: string;
  aiReads: string[];
  anomalyTriggers: string[];
  safeCustomerCopy: string;
  blockedUntil: string;
  tone: MarketSourceCadenceTone;
  confidenceFloor: number;
};

export type MarketSourceIncidentRule = {
  id: string;
  triggerCluster: string;
  botAction: string;
  requiredSecondSource: string;
  forbiddenCopy: string;
  allowedCopy: string;
};

export type MarketSourceCadenceMatrix = {
  version: "PASS336.market_source_cadence_matrix";
  headline: string;
  boundary: string;
  rows: MarketSourceCadenceRow[];
  incidentRules: MarketSourceIncidentRule[];
  aiSummary: string;
  nextAdapterOrder: string[];
};

const rows: MarketSourceCadenceRow[] = [
  {
    id: "crypto_spot",
    label: "Crypto spot data",
    tableName: "crypto_market_ticks",
    sourcePlan:
      "Binance/MEXC depth, klines and ticker lanes with local cache, expiry labels and visible fallback state.",
    cadence: "10s–60s depending on venue and endpoint",
    freshnessTtl: "depth ≤ 20s · ticker ≤ 60s · klines ≤ interval + 90s",
    aiReads: ["spread expansion", "depth thinning", "frozen candles", "venue divergence"],
    anomalyTriggers: ["stale book ticker", "missing candle interval", "depth collapse vs second source"],
    safeCustomerCopy:
      "Rynek wymaga świeżego potwierdzenia źródeł; część danych jest chwilowo porównywana z fallbackiem.",
    blockedUntil: "production cache + timeout + second-source divergence adapter",
    tone: "fast_live",
    confidenceFloor: 62,
  },
  {
    id: "exchange_health",
    label: "Exchange health",
    tableName: "exchange_health_snapshots",
    sourcePlan:
      "Venue-by-venue health table: API stability, orderbook freshness, reserve disclosure boundary and withdrawal incident lane.",
    cadence: "30s–5m live checks + incident refresh",
    freshnessTtl: "API ≤ 60s · withdrawal/status ≤ 5m · reserve snapshot timestamp explicit",
    aiReads: ["API timeout cluster", "withdrawal incident source", "reserve-liability gap", "social stress only as review"],
    anomalyTriggers: ["primary venue fails while second sources are normal", "reserve snapshot stale", "withdrawal status changes without verified source"],
    safeCustomerCopy:
      "Bot widzi ograniczenie źródła lub anomalię venue-specific; to nie jest werdykt o wypłacalności giełdy.",
    blockedUntil: "verified incident source list + reserve/liability boundary + durable source ledger",
    tone: "fast_live",
    confidenceFloor: 58,
  },
  {
    id: "stocks",
    label: "Stocks / public companies",
    tableName: "stock_disclosure_context",
    sourcePlan:
      "Price vendor later, SEC EDGAR style filing/disclosure lane now, with earnings/date freshness separated from market price.",
    cadence: "price later live · filings/event disclosure slower",
    freshnessTtl: "filing timestamp explicit · price lane blocked until provider exists",
    aiReads: ["filing event", "earnings timing", "sector contagion", "market-wide stress"],
    anomalyTriggers: ["filing/event mismatch", "sector-wide shock", "ticker source not attached"],
    safeCustomerCopy:
      "Stock lane pokazuje kontekst spółki i ujawnienia; nie jest sygnałem kupna ani sprzedaży.",
    blockedUntil: "licensed/public price adapter + filing parser + corporate-action normalization",
    tone: "daily_reference",
    confidenceFloor: 52,
  },
  {
    id: "fx",
    label: "FX / currencies",
    tableName: "fx_reference_rates",
    sourcePlan:
      "ECB reference rates for daily context plus future live FX provider for intraday stress; transaction-rate boundary remains visible.",
    cadence: "daily reference + future intraday adapter",
    freshnessTtl: "ECB daily working-day reference · live FX blocked until provider",
    aiReads: ["EUR reference movement", "cross-currency stress", "macro liquidity context"],
    anomalyTriggers: ["reference-rate shock", "FX lane stale", "macro stress disagrees with crypto move"],
    safeCustomerCopy:
      "Walutowy kontekst jest wolniejszy i referencyjny; nie należy go traktować jak cenę transakcyjną.",
    blockedUntil: "intraday FX adapter + holiday calendar + transaction-rate disclaimer",
    tone: "daily_reference",
    confidenceFloor: 56,
  },
  {
    id: "real_estate",
    label: "Real estate / REIT / housing",
    tableName: "real_estate_macro_context",
    sourcePlan:
      "FRED/FHFA-style macro and housing series, REIT price adapter later; slow cadence by design.",
    cadence: "monthly/quarterly macro + future REIT market lane",
    freshnessTtl: "macro series date explicit · do not use as fast alarm",
    aiReads: ["housing price trend", "mortgage/rate stress", "REIT sector context"],
    anomalyTriggers: ["macro release shock", "REIT lane diverges from rates", "outdated macro snapshot"],
    safeCustomerCopy:
      "Real estate lane to wolny kontekst makro; pokazuje presję otoczenia, nie natychmiastowy alarm.",
    blockedUntil: "macro series mapping + REIT adapter + release calendar",
    tone: "slow_macro",
    confidenceFloor: 48,
  },
  {
    id: "commodities",
    label: "Commodities",
    tableName: "commodity_context_lanes",
    sourcePlan:
      "Gold/silver/oil proxy lane later; for now table separates commodity shock context from token-specific risk.",
    cadence: "future live/near-live provider",
    freshnessTtl: "blocked until provider; no simulated commodity price shown as live",
    aiReads: ["safe-haven stress", "energy shock", "inflation proxy"],
    anomalyTriggers: ["commodity shock cluster", "FX + commodity co-move", "provider missing"],
    safeCustomerCopy:
      "Towary są kontekstem makro; bez podpiętego źródła live bot nie pokazuje mocnego wniosku.",
    blockedUntil: "commodity provider + symbol normalization + release cadence",
    tone: "operator_blocked",
    confidenceFloor: 36,
  },
  {
    id: "etf",
    label: "ETF / baskets",
    tableName: "etf_basket_context",
    sourcePlan:
      "ETF proxy lane later for broad risk-on/risk-off context; holdings and price need explicit source boundaries.",
    cadence: "future live/near-live + holdings cadence",
    freshnessTtl: "blocked until price/holdings source exists",
    aiReads: ["risk-on basket", "sector ETF divergence", "crypto ETF context"],
    anomalyTriggers: ["ETF divergence", "basket shock", "holdings stale"],
    safeCustomerCopy:
      "ETF lane ma pokazywać szeroki klimat rynku, ale bez źródła nie tworzy ostrzeżenia.",
    blockedUntil: "ETF price/holdings adapter + stale holdings label",
    tone: "operator_blocked",
    confidenceFloor: 34,
  },
  {
    id: "ftx_regression",
    label: "FTX historical regression",
    tableName: "historical_failure_patterns",
    sourcePlan:
      "Old FTX-style pattern table: native-token collateral loop, withdrawal run, reserve/liability opacity and contagion graph.",
    cadence: "static regression pack + manual updates",
    freshnessTtl: "historical reference only; never live alarm by itself",
    aiReads: ["native-token dependency", "withdrawal stress pattern", "reserve-liability opacity", "contagion graph"],
    anomalyTriggers: ["multiple FTX-like patterns align", "native-token loop + reserve gap", "withdrawal source + depth stress"],
    safeCustomerCopy:
      "Historyczny wzorzec pomaga porównać sygnały, ale nie oznacza, że dana giełda powtarza FTX.",
    blockedUntil: "curated case dataset + legal-safe wording review",
    tone: "historical_regression",
    confidenceFloor: 44,
  },
];

const incidentRules: MarketSourceIncidentRule[] = [
  {
    id: "no_single_source_alarm",
    triggerCluster: "one venue stale, noisy or rate-limited",
    botAction: "downgrade to fallback, request second-source comparison and keep public copy narrow",
    requiredSecondSource: "at least two independent venues or one official status/incident source",
    forbiddenCopy: "exchange is collapsing / next FTX / insolvent / guaranteed unsafe",
    allowedCopy: "Źródło live jest ograniczone; bot porównuje dane z innymi źródłami przed mocniejszym opisem.",
  },
  {
    id: "reserve_boundary",
    triggerCluster: "reserve snapshot exists without liabilities/off-chain obligations",
    botAction: "show transparency lane, keep solvency language blocked and require liability context",
    requiredSecondSource: "reserve method + timestamp + liabilities/off-chain boundary",
    forbiddenCopy: "proof of solvency / safe exchange / reserves guarantee safety",
    allowedCopy: "Reserve data improves transparency, but it is not a full safety certificate.",
  },
  {
    id: "macro_slow_lane",
    triggerCluster: "FX/FRED/housing data changes",
    botAction: "label cadence as daily/monthly/quarterly and prevent fast-alert copy",
    requiredSecondSource: "release date, cadence and source timestamp",
    forbiddenCopy: "instant crash signal / trade now / guaranteed market direction",
    allowedCopy: "Ten pas rynku jest wolniejszy i pomaga w kontekście, nie w natychmiastowym alarmie.",
  },
  {
    id: "ftx_regression_guard",
    triggerCluster: "native-token loop, withdrawal stress and reserve opacity overlap",
    botAction: "open historical-regression review and require operator evidence before public wording",
    requiredSecondSource: "verified status source + depth source + reserve/liability context + legal-safe review",
    forbiddenCopy: "this is FTX again / exchange is dead / withdraw now",
    allowedCopy: "Kilka historycznych wzorców wymaga review; bot nie wyciąga publicznego werdyktu bez źródeł.",
  },
];

export function buildMarketSourceCadenceMatrix(): MarketSourceCadenceMatrix {
  const liveRows = rows.filter((row) => row.tone === "fast_live").length;
  const blockedRows = rows.filter((row) => row.tone === "operator_blocked").length;
  return {
    version: "PASS336.market_source_cadence_matrix",
    headline:
      "Market Source Cadence Matrix separates fast exchange data, daily references, slow macro series and historical FTX regression before the AI bot speaks to users.",
    boundary:
      "Cadence Matrix is a source-readiness layer only. It is not investment advice, not a bankruptcy prediction, not exchange certification and not a solvency proof.",
    rows,
    incidentRules,
    aiSummary: `${liveRows} fast-live lanes can be wired first; ${blockedRows} public lanes stay blocked until providers and timestamps exist. The bot must show cadence before confidence.`,
    nextAdapterOrder: [
      "wire Binance/MEXC depth + kline TTL cache",
      "add Coinbase/Kraken second-source divergence",
      "attach ECB daily FX reference timestamp",
      "attach FRED/FHFA macro release cadence",
      "curate FTX historical case dataset with safe wording",
    ],
  };
}
