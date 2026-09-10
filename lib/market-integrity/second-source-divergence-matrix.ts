export type SecondSourceDivergenceTone = "calm" | "watch" | "elevated" | "blocked";
export type SecondSourceCadence = "fast live" | "daily reference" | "slow macro" | "historical regression";

export type SecondSourceDivergenceRow = {
  id: string;
  lane: "exchange_depth" | "exchange_api" | "reserve_context" | "stock_disclosure" | "fx_reference" | "real_estate_macro" | "ftx_regression";
  label: string;
  primarySource: string;
  secondSource: string;
  cadence: SecondSourceCadence;
  divergenceScore: number;
  tone: SecondSourceDivergenceTone;
  aiReads: string;
  safeCustomerCopy: string;
  missingBeforeConfidence: string;
  blockedCopy: string;
};

export type SecondSourceBotRule = {
  id: string;
  trigger: string;
  requiredAction: string;
  allowedCopy: string;
  blockedCopy: string;
};

export type SecondSourceDivergenceMatrix = {
  version: "PASS338.second_source_divergence_matrix";
  headline: string;
  boundary: string;
  rows: SecondSourceDivergenceRow[];
  botRules: SecondSourceBotRule[];
  a4Summary: string;
  orbitSummary: string;
};

const rows: SecondSourceDivergenceRow[] = [
  {
    id: "depth-binance-mexc",
    lane: "exchange_depth",
    label: "Exchange depth divergence",
    primarySource: "Binance depth / klines",
    secondSource: "MEXC depth / stream freshness",
    cadence: "fast live",
    divergenceScore: 44,
    tone: "watch",
    aiReads:
      "Compares visible orderbook depth, kline continuity and price context across venues before treating one exchange as a market truth.",
    safeCustomerCopy:
      "Bot porównuje płynność między giełdami. Jeżeli jedna giełda wygląda inaczej niż reszta, system oznacza to jako potrzebę drugiego źródła, nie jako dowód problemu.",
    missingBeforeConfidence:
      "live second-source depth · timestamp agreement · fallback flag · symbol mapping",
    blockedCopy: "exchange is collapsing · next FTX · withdraw now · insolvent",
  },
  {
    id: "api-freshness-divergence",
    lane: "exchange_api",
    label: "API freshness divergence",
    primarySource: "Exchange REST / websocket state",
    secondSource: "Second venue + local cache heartbeat",
    cadence: "fast live",
    divergenceScore: 39,
    tone: "watch",
    aiReads:
      "Checks whether stale or disconnected streams are clearly labelled as fallback instead of looking like live intelligence.",
    safeCustomerCopy:
      "Część danych może być chwilowo opóźniona. Bot pokazuje wtedy tryb fallback i nie podnosi pewności oceny bez świeżego odczytu.",
    missingBeforeConfidence:
      "heartbeat timestamp · reconnect state · source expiry · cache age",
    blockedCopy: "live certainty from stale stream · hidden fallback · fake premium freshness",
  },
  {
    id: "reserve-context-divergence",
    lane: "reserve_context",
    label: "Reserve context divergence",
    primarySource: "Proof / reserve snapshot",
    secondSource: "Liabilities and off-chain context",
    cadence: "daily reference",
    divergenceScore: 57,
    tone: "elevated",
    aiReads:
      "Separates reserve transparency from solvency language. A reserve snapshot is useful context, but it does not by itself prove full liabilities or risk-free status.",
    safeCustomerCopy:
      "Rezerwy mogą zwiększać przejrzystość, ale same nie są pełnym certyfikatem bezpieczeństwa. Bot będzie szukał też kontekstu zobowiązań i czasu aktualizacji.",
    missingBeforeConfidence:
      "liabilities context · snapshot timestamp · auditor scope · wallet coverage",
    blockedCopy: "proof of safety · guaranteed solvent · exchange certified safe",
  },
  {
    id: "stock-disclosure-divergence",
    lane: "stock_disclosure",
    label: "Stock disclosure divergence",
    primarySource: "Market price / volume",
    secondSource: "SEC filing and disclosure lane",
    cadence: "daily reference",
    divergenceScore: 36,
    tone: "calm",
    aiReads:
      "Uses disclosures as context for public companies and exchange operators without turning filings into trading advice.",
    safeCustomerCopy:
      "Dla stocków bot porównuje ruch rynku z raportami i komunikatami. To jest kontekst ryzyka, nie rekomendacja kupna lub sprzedaży.",
    missingBeforeConfidence:
      "filing parser · event timestamp · sector basket · issuer mapping",
    blockedCopy: "buy stock · sell stock · guaranteed disclosure signal",
  },
  {
    id: "fx-reference-divergence",
    lane: "fx_reference",
    label: "FX reference divergence",
    primarySource: "ECB reference rate",
    secondSource: "Intraday FX / stablecoin peg bridge later",
    cadence: "daily reference",
    divergenceScore: 31,
    tone: "calm",
    aiReads:
      "Keeps official reference rates separated from executable intraday prices and stablecoin peg checks.",
    safeCustomerCopy:
      "Waluty są wolniejszym tłem płynności. Kurs referencyjny nie jest ceną transakcyjną, więc bot nie używa go jako alarmu sekundowego.",
    missingBeforeConfidence:
      "intraday FX adapter · peg bridge · volatility band · update timestamp",
    blockedCopy: "ECB says trade now · official rate equals live execution price",
  },
  {
    id: "real-estate-macro-divergence",
    lane: "real_estate_macro",
    label: "Real estate macro divergence",
    primarySource: "FRED / FHFA macro series",
    secondSource: "REIT basket and credit stress proxy",
    cadence: "slow macro",
    divergenceScore: 42,
    tone: "watch",
    aiReads:
      "Treats housing and REIT stress as slow macro pressure, not minute-level exchange evidence.",
    safeCustomerCopy:
      "Nieruchomości są wolnym sygnałem makro. Jeżeli rośnie stres, bot pokaże to jako tło rynku, a nie szybki alarm giełdowy.",
    missingBeforeConfidence:
      "series timestamp · REIT proxy · credit spread context · regional filter",
    blockedCopy: "property market crash now · live real estate alert from monthly data",
  },
  {
    id: "ftx-historical-regression",
    lane: "ftx_regression",
    label: "FTX historical regression",
    primarySource: "Historical collapse pattern pack",
    secondSource: "Current multi-source evidence only",
    cadence: "historical regression",
    divergenceScore: 62,
    tone: "blocked",
    aiReads:
      "Compares native-token collateral loop, reserve/liability gap, withdrawal stress and contagion as a historical pattern, never as an accusation by itself.",
    safeCustomerCopy:
      "Bot może wykryć podobny wzór historyczny, ale to nie jest oskarżenie. Taki sygnał tylko otwiera dokładniejszą kontrolę wielu źródeł.",
    missingBeforeConfidence:
      "current reserve/liability context · withdrawal status · counterparty graph · legal/news source ledger",
    blockedCopy: "next FTX · exchange is collapsing · fraud confirmed · withdraw now",
  },
];

const botRules: SecondSourceBotRule[] = [
  {
    id: "two-source-before-escalation",
    trigger: "One source shows stress while the second source is missing or stale.",
    requiredAction:
      "Keep the lane in review, show source rhythm and ask for second-source confirmation before any stronger copy.",
    allowedCopy:
      "Jedno źródło wymaga sprawdzenia. Bot czeka na drugie potwierdzenie, zanim podniesie poziom pewności.",
    blockedCopy: "Confirmed collapse · next FTX · withdraw immediately",
  },
  {
    id: "reserve-is-not-solvency",
    trigger: "Reserve or proof snapshot is present without liabilities/off-chain context.",
    requiredAction:
      "Show reserve as transparency context only and keep solvency or safety language blocked.",
    allowedCopy:
      "Rezerwy zwiększają przejrzystość, ale nie są pełnym certyfikatem bezpieczeństwa bez szerszego kontekstu.",
    blockedCopy: "Guaranteed solvent · exchange certified safe · proof of safety",
  },
  {
    id: "slow-macro-not-live-alert",
    trigger: "FX, real estate or macro series update slower than exchange data.",
    requiredAction:
      "Label the cadence and use macro data as background, not as a fast trading or exchange alarm.",
    allowedCopy:
      "To jest wolniejsze tło rynku. Bot pokaże kontekst, ale nie zrobi z tego alarmu sekundowego.",
    blockedCopy: "Live crash alert from monthly data · trade now",
  },
];

function averageDivergence(input: SecondSourceDivergenceRow[]) {
  return Math.round(
    input.reduce((sum, row) => sum + row.divergenceScore, 0) /
      Math.max(input.length, 1),
  );
}

export function buildSecondSourceDivergenceMatrix(): SecondSourceDivergenceMatrix {
  const avg = averageDivergence(rows);
  return {
    version: "PASS338.second_source_divergence_matrix",
    headline:
      "Second Source Divergence Matrix checks whether one source disagrees with another before the AI bot raises confidence.",
    boundary:
      "Second-source divergence is a context and anomaly layer only. It is not bankruptcy prediction, not exchange certification, not solvency proof, not investment advice and not a buy/sell signal.",
    rows,
    botRules,
    a4Summary: `Average divergence pressure is ${avg}/100. Velmère requires a second source, source rhythm and missing-evidence disclosure before stronger public copy.`,
    orbitSummary:
      "Orbit nodes can show divergence only as source friction: calm, watch, elevated or blocked. Panic phrases and exchange accusations stay forbidden.",
  };
}
