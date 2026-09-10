export type CrossAssetLaneId =
  | "crypto_venues"
  | "stocks"
  | "fx"
  | "real_estate"
  | "ftx_historical";

export type CrossAssetTableRow = {
  id: string;
  lane: CrossAssetLaneId;
  label: string;
  examples: string;
  sourceAdapter: string;
  whatShieldChecks: string;
  blocker: string;
  status: "live_ready" | "adapter_required" | "historical_reference" | "operator_review";
};

export type ExchangeCollapseRow = {
  id: string;
  venue: string;
  coverage: string;
  proofLane: string;
  ftxSimilaritySignals: string;
  nextAdapterStep: string;
  status: "primary" | "secondary" | "historical" | "blocked";
};

export type FtxPatternRow = {
  id: string;
  signal: string;
  ftxReference: string;
  botCheck: string;
  customerCopyBoundary: string;
};

export type CrossAssetAdapterRow = {
  id: string;
  table: "exchange_health" | "equity_stocks" | "fx_macro" | "real_estate" | "historical_failures";
  dataset: string;
  liveSourcePlan: string;
  refreshCadence: string;
  anomalySignals: string;
  evidenceBoundary: string;
  status: "wireframe" | "adapter_next" | "needs_key" | "manual_archive";
};

export type CollapseSignalRow = {
  id: string;
  lane: "liquidity" | "proof" | "token_loop" | "withdrawals" | "contagion" | "macro";
  signal: string;
  greenState: string;
  warningState: string;
  aiBotAction: string;
  publicCopyRule: string;
};

export type BotDecisionRule = {
  id: string;
  rule: string;
  trigger: string;
  action: string;
  neverSay: string;
};

export type CrossAssetCollapseRadar = {
  version: "PASS331.cross_asset_collapse_radar";
  headline: string;
  boundary: string;
  universeRows: CrossAssetTableRow[];
  exchangeRows: ExchangeCollapseRow[];
  ftxPatternRows: FtxPatternRow[];
  adapterRows: CrossAssetAdapterRow[];
  collapseSignalRows: CollapseSignalRow[];
  botDecisionRules: BotDecisionRule[];
  nextBuildOrder: string[];
};

const universeRows: CrossAssetTableRow[] = [
  {
    id: "venues-binance-mexc",
    lane: "crypto_venues",
    label: "Crypto exchanges / venues",
    examples: "Binance · MEXC · Coinbase · Kraken · FTX historical",
    sourceAdapter:
      "REST + WebSocket market data, orderbook depth, kline continuity, proof/reserve disclosure and withdrawal incident lane.",
    whatShieldChecks:
      "Depth drop, spread expansion, stale candles, reserve/liability gaps, token-collateral loops, abnormal withdrawal stress and public incident signals.",
    blocker:
      "Do not say an exchange is failing. The bot may only show evidence gaps, anomaly pressure and review priority.",
    status: "adapter_required",
  },
  {
    id: "stocks-equities",
    lane: "stocks",
    label: "Stocks / equities",
    examples: "AAPL · NVDA · LVMH proxy watch · bank stocks · exchange-listed operators",
    sourceAdapter:
      "Price candles, volume, market cap, SEC/filing lane, sector peer lane and news/filing timestamp.",
    whatShieldChecks:
      "Gap-downs, volume spikes, filing shocks, sector contagion and equity stress around exchange operators or major public counterparties.",
    blocker:
      "No stock tips. Stocks table is a macro/context lane that explains stress, not a buy/sell signal.",
    status: "adapter_required",
  },
  {
    id: "fx-currencies",
    lane: "fx",
    label: "FX / currencies",
    examples: "EUR/USD · USD index proxy · stablecoin peg context",
    sourceAdapter:
      "ECB reference rates, market FX feed, volatility bands and stablecoin peg comparison.",
    whatShieldChecks:
      "FX shock, dollar liquidity pressure, peg deviations and cross-market stress that can hit crypto liquidity.",
    blocker:
      "ECB reference data is informational and not a transactional price source.",
    status: "adapter_required",
  },
  {
    id: "real-estate-reit",
    lane: "real_estate",
    label: "Real estate / REIT / housing",
    examples: "REIT basket · mortgage rates · house price index · commercial real estate stress",
    sourceAdapter:
      "FRED/FHFA housing series, REIT price proxy and credit stress lane.",
    whatShieldChecks:
      "Macro risk background: housing slowdown, CRE credit stress, REIT drawdowns and liquidity tightening.",
    blocker:
      "Real estate data is slower. It must not be mixed with minute-by-minute exchange alarms.",
    status: "adapter_required",
  },
  {
    id: "ftx-archive",
    lane: "ftx_historical",
    label: "FTX old-data regression pack",
    examples: "FTT loop · Alameda exposure · withdrawal run · contagion graph",
    sourceAdapter:
      "Historical timeline, archived market data, public reports and court/regulatory evidence lane.",
    whatShieldChecks:
      "Whether today’s venue shows FTX-like pattern clusters: native-token collateral, opacity, liquidity mismatch and withdrawal stress.",
    blocker:
      "Historical similarity is not proof. It only raises review priority and asks for more source evidence.",
    status: "historical_reference",
  },
];

const exchangeRows: ExchangeCollapseRow[] = [
  {
    id: "binance",
    venue: "Binance",
    coverage:
      "Primary exchange health lane: spot klines, orderbook depth, book ticker, reserve/proof disclosure and public incident monitor.",
    proofLane:
      "PoR/reserve lane visible, but liabilities, off-chain obligations and legal context stay separate before confidence rises.",
    ftxSimilaritySignals:
      "Native-token dependency, sudden outflow stress, source gaps, spread/depth shock and counterparty contagion check.",
    nextAdapterStep:
      "Create Binance adapter: depth snapshot + kline continuity + reserve page timestamp + incident-source ledger.",
    status: "primary",
  },
  {
    id: "mexc",
    venue: "MEXC",
    coverage:
      "Primary liquidity/depth lane: REST market data, WebSocket freshness, order book continuity and reconnect/expiry discipline.",
    proofLane:
      "Adapter freshness must show live/fallback/expired. Do not hide stale MEXC data behind a premium badge.",
    ftxSimilaritySignals:
      "Depth dries up, candles freeze, subscription fails, abnormal spread and source expiry clustered with social panic.",
    nextAdapterStep:
      "Create MEXC adapter contract: klines + depth + websocket health + 24h reconnect policy.",
    status: "primary",
  },
  {
    id: "coinbase-kraken",
    venue: "Coinbase / Kraken",
    coverage:
      "Second-source venue comparison for major assets. Used to detect whether stress is venue-specific or market-wide.",
    proofLane:
      "If Binance/MEXC look stressed but second sources stay normal, Shield marks venue divergence instead of market collapse.",
    ftxSimilaritySignals:
      "Cross-venue price divergence, missing liquidity, abnormal bid/ask gaps and inconsistent candle source.",
    nextAdapterStep:
      "Wire a neutral comparison table before any public warning language is allowed.",
    status: "secondary",
  },
  {
    id: "ftx-history",
    venue: "FTX historical",
    coverage:
      "Regression pattern library, not a live venue: old collapse patterns become test cases for the AI bot.",
    proofLane:
      "Historical evidence is used to train review logic, not to accuse any current exchange.",
    ftxSimilaritySignals:
      "Native token collateral, exchange/market-maker entanglement, withdrawal freeze, reserve gap and contagion sequence.",
    nextAdapterStep:
      "Build archived FTX timeline JSON + pattern match score with strong public-copy boundary.",
    status: "historical",
  },
];

const ftxPatternRows: FtxPatternRow[] = [
  {
    id: "native-token-loop",
    signal: "Native-token collateral loop",
    ftxReference:
      "FTT-style exposure pattern: venue-linked token becomes balance-sheet confidence signal instead of independent reserve proof.",
    botCheck:
      "Check if exchange health depends on its own token, related-party token, thin collateral or circular market support.",
    customerCopyBoundary:
      "Say: 'native-token dependency needs review'. Never say: 'this exchange will collapse'.",
  },
  {
    id: "withdrawal-stress",
    signal: "Withdrawal stress / queue panic",
    ftxReference:
      "Rapid customer withdrawals can expose maturity mismatch, missing reserves and broken liquidity assumptions.",
    botCheck:
      "Monitor public incident sources, deposit/withdraw status, social panic and cross-venue price divergence.",
    customerCopyBoundary:
      "Use calm wording: 'withdrawal lane requires source verification'. No panic language.",
  },
  {
    id: "reserve-liability-gap",
    signal: "Reserve vs liability gap",
    ftxReference:
      "Asset snapshots are incomplete if liabilities, loans, related parties and off-chain obligations are missing.",
    botCheck:
      "Separate reserve proof, liabilities, legal disclosures, debt, related-party exposure and off-chain claims.",
    customerCopyBoundary:
      "Never call PoR a safety certificate. Show missing liabilities as a visible blocker.",
  },
  {
    id: "contagion-graph",
    signal: "Contagion / counterparty graph",
    ftxReference:
      "One venue stress can travel through lenders, market makers, tokens, funds and public-company exposure.",
    botCheck:
      "Map exchange operators, tokens, public companies, REIT/credit stress, FX dollar pressure and liquidity shock.",
    customerCopyBoundary:
      "Show 'counterparty review' instead of naming blame without evidence.",
  },
];

const adapterRows: CrossAssetAdapterRow[] = [
  {
    id: "adapter-exchange-health",
    table: "exchange_health",
    dataset: "Binance/MEXC klines · orderbook depth · book ticker · source freshness",
    liveSourcePlan:
      "Use official exchange market-data endpoints first, then cache a signed snapshot and compare against second-source venues.",
    refreshCadence: "15s–60s UI heartbeat, 24h websocket reconnect policy, fallback visible immediately",
    anomalySignals:
      "stale candles · missing book · sudden spread expansion · depth collapse · cross-venue divergence",
    evidenceBoundary:
      "Exchange risk score is an anomaly score, not bankruptcy prediction or safety certification.",
    status: "adapter_next",
  },
  {
    id: "adapter-equity-stocks",
    table: "equity_stocks",
    dataset: "Stock candles · company filings · sector/peer stress · public operator exposure",
    liveSourcePlan:
      "Use market-data provider for prices and SEC EDGAR/company filings for disclosure timing and fundamental shock context.",
    refreshCadence: "daily/15m depending provider; filings checked by timestamp and form type",
    anomalySignals:
      "gap down · abnormal volume · filing shock · related public company drawdown · sector contagion",
    evidenceBoundary:
      "No stock recommendation. Equity lane only explains macro/counterparty context.",
    status: "needs_key",
  },
  {
    id: "adapter-fx-macro",
    table: "fx_macro",
    dataset: "ECB reference rates · FX feed · stablecoin peg lane",
    liveSourcePlan:
      "Use ECB reference rates for official daily context and a market FX adapter for intraday monitoring.",
    refreshCadence: "ECB daily reference + intraday provider heartbeat",
    anomalySignals:
      "FX volatility · dollar squeeze · EUR/USD shock · stablecoin peg deviation · quote timestamp mismatch",
    evidenceBoundary:
      "ECB references are informational; transaction pricing must use a market feed.",
    status: "adapter_next",
  },
  {
    id: "adapter-real-estate",
    table: "real_estate",
    dataset: "FHFA HPI · FRED housing/CRE series · REIT proxy basket",
    liveSourcePlan:
      "Use slower macro series for background risk and separate REIT market data for faster liquidity signals.",
    refreshCadence: "monthly/quarterly macro + daily REIT proxy",
    anomalySignals:
      "CRE delinquency rise · mortgage rate stress · HPI slowdown · REIT drawdown · credit spread proxy",
    evidenceBoundary:
      "Real estate is a slow stress lane. It cannot trigger instant exchange-collapse language by itself.",
    status: "wireframe",
  },
  {
    id: "adapter-ftx-regression",
    table: "historical_failures",
    dataset: "FTX historical timeline · FTT exposure · withdrawals · contagion events",
    liveSourcePlan:
      "Keep archived cases as regression tests for the AI bot: compare patterns, never accuse current venues from similarity alone.",
    refreshCadence: "static archive + manual source review",
    anomalySignals:
      "native token dependency · reserve/liability opacity · withdrawal stress · counterparty contagion",
    evidenceBoundary:
      "Historical similarity only increases review priority.",
    status: "manual_archive",
  },
];

const collapseSignalRows: CollapseSignalRow[] = [
  {
    id: "depth-cascade",
    lane: "liquidity",
    signal: "Orderbook depth cascade",
    greenState: "Depth, spread and candles update normally across primary and second-source venues.",
    warningState: "Bid depth thins, spread expands, klines lag or the same symbol diverges across venues.",
    aiBotAction:
      "Mark exchange liquidity lane as review, freeze public certainty and ask for second-source comparison.",
    publicCopyRule:
      "Write 'liquidity lane needs verification', not 'exchange is collapsing'.",
  },
  {
    id: "por-liability",
    lane: "proof",
    signal: "Reserve proof without liability context",
    greenState: "Reserve snapshot, liabilities, methodology and timestamp are visible or clearly bounded.",
    warningState: "PoR exists but liabilities, off-chain obligations, related-party exposure or timestamp are unclear.",
    aiBotAction:
      "Split PoR into reserve snapshot, liabilities gap and legal/off-chain context before confidence rises.",
    publicCopyRule:
      "Never call PoR a guarantee or safety certificate.",
  },
  {
    id: "native-token",
    lane: "token_loop",
    signal: "Venue-linked token dependency",
    greenState: "Venue health does not depend on its own token or related collateral loop.",
    warningState: "Native token, affiliated token or thin collateral appears central to exchange confidence.",
    aiBotAction:
      "Raise FTX-regression similarity and demand balance-sheet/source evidence before public language.",
    publicCopyRule:
      "Use 'native-token dependency review', not accusation.",
  },
  {
    id: "withdrawal-lane",
    lane: "withdrawals",
    signal: "Withdrawal / deposit incident lane",
    greenState: "No verified incident, normal status, no cross-source panic cluster.",
    warningState: "Status changes, public complaints, unusual delay reports or venue communication gaps cluster.",
    aiBotAction:
      "Open incident ledger, require timestamps and separate rumor from confirmed source.",
    publicCopyRule:
      "Do not amplify panic; show source status and missing evidence.",
  },
  {
    id: "macro-contagion",
    lane: "macro",
    signal: "Macro liquidity squeeze",
    greenState: "FX, equity, rates and real-estate stress remain normal background context.",
    warningState: "Dollar stress, equity gap-downs, REIT/credit stress and crypto liquidity drop align.",
    aiBotAction:
      "Move from single-token analysis to cross-asset review and reduce certainty.",
    publicCopyRule:
      "Explain context, not prediction.",
  },
];

const botDecisionRules: BotDecisionRule[] = [
  {
    id: "rule-no-collapse-claim",
    rule: "No collapse claim without durable evidence",
    trigger: "Any exchange anomaly score is high but sources are partial, stale or single-source.",
    action: "Show review priority, missing lanes and next adapter step.",
    neverSay: "This exchange will collapse / is insolvent / is the next FTX.",
  },
  {
    id: "rule-second-source",
    rule: "Second-source before warning",
    trigger: "Binance or MEXC depth/candle/feed looks abnormal.",
    action: "Compare with Coinbase/Kraken/other venue before changing public risk language.",
    neverSay: "Market-wide panic from one venue-only signal.",
  },
  {
    id: "rule-proof-separation",
    rule: "Proof must be split into lanes",
    trigger: "Reserve, PoR, audit, wallet or transparency claim is present.",
    action: "Separate reserve snapshot, liabilities, timestamp, methodology and off-chain obligations.",
    neverSay: "Proof of reserves proves safety.",
  },
  {
    id: "rule-macro-slow-lane",
    rule: "Slow macro data cannot trigger instant alarms",
    trigger: "Real estate/FRED/FHFA/quarterly data changes.",
    action: "Use as macro context and show slower cadence.",
    neverSay: "Housing data predicts exchange collapse today.",
  },
];

export function buildCrossAssetCollapseRadar(): CrossAssetCollapseRadar {
  return {
    version: "PASS331.cross_asset_collapse_radar",
    headline:
      "VLM Shield gets a cross-asset brain: exchanges, stocks, FX, real estate and FTX-style historical failure patterns stay in separate tables, then the AI bot joins them only as evidence lanes.",
    boundary:
      "This is an early-warning research surface. It is not bankruptcy prediction, not investment advice, not a proof of solvency and not a public accusation engine.",
    universeRows,
    exchangeRows,
    ftxPatternRows,
    adapterRows,
    collapseSignalRows,
    botDecisionRules,
    nextBuildOrder: [
      "1. exchange_health table: Binance/MEXC depth, klines, freshness and second-source divergence",
      "2. ftx_regression table: archived FTX pattern score with strict copy boundary",
      "3. fx_macro table: ECB reference + intraday FX provider + stablecoin peg context",
      "4. equity_stocks table: stocks, filings and public-company/counterparty exposure",
      "5. real_estate table: FHFA/FRED macro stress + REIT proxy",
      "6. AI bot answer layer: explain anomaly lanes in human language without panic or guarantees",
    ],
  };
}
