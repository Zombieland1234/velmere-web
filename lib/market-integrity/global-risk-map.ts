export type GlobalRiskLaneId =
  | "crypto"
  | "exchange_health"
  | "stocks"
  | "fx"
  | "real_estate"
  | "commodities"
  | "etf";

export type GlobalRiskHeatLevel = "calm" | "watch" | "elevated" | "review";

export type GlobalRiskMapRow = {
  id: string;
  lane: GlobalRiskLaneId;
  label: string;
  heat: number;
  heatLevel: GlobalRiskHeatLevel;
  aiRead: string;
  sourcePlan: string;
  missingBeforeConfidence: string;
  humanCopy: string;
};

export type GlobalRiskSourceRow = {
  id: string;
  source: string;
  usedFor: string;
  freshnessRule: string;
  boundary: string;
};

export type GlobalRiskScenarioRow = {
  id: string;
  scenario: string;
  triggerCluster: string;
  aiNextStep: string;
  publicCopy: string;
};

export type GlobalRiskMap = {
  version: "PASS334.global_risk_map";
  headline: string;
  boundary: string;
  mapRows: GlobalRiskMapRow[];
  sourceRows: GlobalRiskSourceRow[];
  scenarioRows: GlobalRiskScenarioRow[];
  botSummary: string;
  nextBuildOrder: string[];
};

const mapRows: GlobalRiskMapRow[] = [
  {
    id: "risk-crypto",
    lane: "crypto",
    label: "Crypto market",
    heat: 46,
    heatLevel: "watch",
    aiRead:
      "Token charts, liquidity, holder concentration and stablecoin peg context are checked as one cluster, but missing source timestamps keep the readout conservative.",
    sourcePlan:
      "Binance/MEXC spot depth, klines and book ticker first; Coinbase/Kraken/OKX as second-source divergence lanes.",
    missingBeforeConfidence:
      "durable source ledger · source timestamp · cross-venue divergence · holder/orderbook adapters",
    humanCopy:
      "Rynek krypto wygląda częściowo stabilnie, ale bot nadal potrzebuje świeżych źródeł z kilku giełd, zanim podniesie pewność oceny.",
  },
  {
    id: "risk-exchange-health",
    lane: "exchange_health",
    label: "Exchange health",
    heat: 52,
    heatLevel: "elevated",
    aiRead:
      "Exchange Health compares depth, API freshness, reserve transparency, withdrawal status and social stress without calling any venue unsafe.",
    sourcePlan:
      "Venue adapters: Binance, MEXC, Coinbase, Kraken, Bybit and OKX with explicit live/fallback/expired state.",
    missingBeforeConfidence:
      "withdrawal status adapter · liabilities context · reserve timestamp · legal/source event feed",
    humanCopy:
      "Giełdy wymagają osobnej kontroli: sama płynność nie wystarczy, bo bot musi widzieć świeżość API, rezerwy, wypłaty i drugie źródło.",
  },
  {
    id: "risk-stocks",
    lane: "stocks",
    label: "Stocks / equities",
    heat: 38,
    heatLevel: "watch",
    aiRead:
      "Equity stress becomes a context lane for public companies, exchange operators, banks and sector contagion; it is not a stock recommendation.",
    sourcePlan:
      "SEC/filing lane, daily price/volume feed, market-cap context and sector peer stress table.",
    missingBeforeConfidence:
      "filing parser · price feed · sector basket · disclosure timestamp",
    humanCopy:
      "Stocki są tu tłem ryzyka rynkowego, nie sygnałem kupna lub sprzedaży. Bot szuka stresu sektorowego i zmian w raportach.",
  },
  {
    id: "risk-fx",
    lane: "fx",
    label: "FX / currencies",
    heat: 34,
    heatLevel: "calm",
    aiRead:
      "FX watches USD and EUR pressure as liquidity context, especially when stablecoin pegs or global risk sentiment move quickly.",
    sourcePlan:
      "ECB reference rates as official daily context plus market FX feed for intraday volatility later.",
    missingBeforeConfidence:
      "intraday FX adapter · volatility bands · stablecoin peg bridge",
    humanCopy:
      "Waluty są wolniejszym tłem dla płynności. Bot nie traktuje kursu referencyjnego jako ceny transakcyjnej.",
  },
  {
    id: "risk-real-estate",
    lane: "real_estate",
    label: "Real estate / REIT",
    heat: 41,
    heatLevel: "watch",
    aiRead:
      "Real estate and REIT stress are slow macro lanes used to detect liquidity tightening and credit pressure, not minute-level market panic.",
    sourcePlan:
      "FRED/FHFA housing series, mortgage-rate context, REIT basket proxy and commercial real-estate stress markers.",
    missingBeforeConfidence:
      "series adapter · REIT price proxy · credit spread context · update cadence disclosure",
    humanCopy:
      "Nieruchomości są wolnym sygnałem makro. Jeżeli stres rośnie, bot pokaże to jako tło, nie jako alarm sekundowy.",
  },
  {
    id: "risk-commodities",
    lane: "commodities",
    label: "Commodities",
    heat: 36,
    heatLevel: "calm",
    aiRead:
      "Gold, oil and broad commodity stress can explain inflation, liquidity and risk-off behavior across crypto, stocks and FX.",
    sourcePlan:
      "Commodity price series and macro proxy table after core exchange/stock/FX adapters are stable.",
    missingBeforeConfidence:
      "commodity adapter · inflation proxy · macro correlation rules",
    humanCopy:
      "Surowce będą tłem makro: pomagają rozumieć nastroje rynku, ale nie są same w sobie werdyktem Shield.",
  },
  {
    id: "risk-etf",
    lane: "etf",
    label: "ETF / funds",
    heat: 43,
    heatLevel: "watch",
    aiRead:
      "ETF flows and broad fund stress can reveal whether pressure is local to one token or part of a larger market rotation.",
    sourcePlan:
      "ETF price/volume, holdings disclosure and flow proxy after equity adapter is attached.",
    missingBeforeConfidence:
      "ETF feed · holdings parser · flow proxy · update timestamp",
    humanCopy:
      "ETF-y pokażą, czy ruch jest lokalny, czy szeroki. Bot będzie je używał jako warstwę kontekstu, nie poradę inwestycyjną.",
  },
];

const sourceRows: GlobalRiskSourceRow[] = [
  {
    id: "source-binance",
    source: "Binance market data",
    usedFor: "depth · klines · ticker · exchange-health baseline",
    freshnessRule:
      "Every live readout must show timestamp and fallback state. Depth and kline data cannot become a solvency claim.",
    boundary: "Market data only; not proof of exchange safety.",
  },
  {
    id: "source-mexc",
    source: "MEXC market streams",
    usedFor: "websocket freshness · reconnect discipline · depth continuity",
    freshnessRule:
      "WebSocket state must expose active/fallback/expired so stale streams do not look premium.",
    boundary: "Fresh market stream is liquidity context, not bankruptcy prediction.",
  },
  {
    id: "source-sec-edgar",
    source: "SEC/filing lane",
    usedFor: "public-company disclosures · stock context · exchange-operator stress",
    freshnessRule:
      "Filing timestamp and document category must be shown before public company stress copy is upgraded.",
    boundary: "Disclosure context only; not a stock recommendation.",
  },
  {
    id: "source-ecb",
    source: "ECB FX reference rates",
    usedFor: "EUR reference context · FX background · stablecoin comparison later",
    freshnessRule:
      "Daily reference rate must be labelled as official reference context, not tradable execution price.",
    boundary: "FX context only; not an intraday quote.",
  },
  {
    id: "source-fred",
    source: "FRED/FHFA macro series",
    usedFor: "real estate · rates · macro liquidity background",
    freshnessRule:
      "Slow series must show cadence and cannot trigger minute-level exchange alerts.",
    boundary: "Macro context only; not live property valuation.",
  },
];

const scenarioRows: GlobalRiskScenarioRow[] = [
  {
    id: "scenario-venue-divergence",
    scenario: "Venue divergence",
    triggerCluster:
      "One exchange shows stale depth, wide spread or price gap while second-source venues stay normal.",
    aiNextStep:
      "Mark venue-specific review, request source timestamp and compare withdrawal/API status before stronger wording.",
    publicCopy:
      "Jedna giełda wygląda inaczej niż reszta rynku. Bot oznacza to jako potrzebę dodatkowej weryfikacji, nie jako dowód problemu.",
  },
  {
    id: "scenario-stablecoin-peg",
    scenario: "Stablecoin / peg stress",
    triggerCluster:
      "Peg deviation, exchange-specific spread and source gaps appear together with higher social stress.",
    aiNextStep:
      "Check issuer/reserve source, cross-venue price, depth and incident feed before raising the public warning level.",
    publicCopy:
      "Cena stabilnego aktywa wymaga kontroli źródeł i płynności. Brak danych zwiększa ostrożność, nie daje pewności.",
  },
  {
    id: "scenario-macro-liquidity",
    scenario: "Macro liquidity tightening",
    triggerCluster:
      "FX dollar pressure, REIT drawdown, equity volatility and crypto depth drop appear in the same window.",
    aiNextStep:
      "Separate macro stress from token-specific risk and produce a global context note.",
    publicCopy:
      "Rynek może reagować szerzej, nie tylko na jeden token. Bot pokaże to jako globalne tło ryzyka.",
  },
  {
    id: "scenario-ftx-regression",
    scenario: "FTX historical regression",
    triggerCluster:
      "Native-token loop, reserve/liability gap, withdrawal stress and counterparty contagion appear as a pattern cluster.",
    aiNextStep:
      "Open historical-pattern review, require multiple sources and block public accusation language.",
    publicCopy:
      "Pojawił się historyczny wzór do sprawdzenia. To nie jest oskarżenie — to powód, żeby zebrać więcej dowodów.",
  },
];

function heatAverage(rows: GlobalRiskMapRow[]) {
  const total = rows.reduce((sum, row) => sum + row.heat, 0);
  return Math.round(total / Math.max(rows.length, 1));
}

export function buildGlobalRiskMap(): GlobalRiskMap {
  const averageHeat = heatAverage(mapRows);
  const highest = [...mapRows].sort((a, b) => b.heat - a.heat).slice(0, 3);
  return {
    version: "PASS334.global_risk_map",
    headline:
      "Global Risk Map turns crypto, exchange health, stocks, FX, real estate, commodities and ETF context into one calm AI market map.",
    boundary:
      "Global Risk Map is an anomaly/context layer only. It is not investment advice, not a bankruptcy prediction, not exchange certification and not a guarantee.",
    mapRows,
    sourceRows,
    scenarioRows,
    botSummary: `Average context heat ${averageHeat}/100. Highest review lanes: ${highest.map((row) => row.label).join(" · ")}.`,
    nextBuildOrder: [
      "wire live exchange-health snapshots",
      "add second-source divergence score",
      "add stock/FX/real-estate cadence labels",
      "render global heat map in Orbit 360",
      "connect AI human-copy summaries to PDF Lens",
    ],
  };
}
