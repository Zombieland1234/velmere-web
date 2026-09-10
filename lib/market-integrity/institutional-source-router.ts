import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";

type Pass2454SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2453?: Pass2453ReportEvidenceCapsule;
};

export type Pass2454RouterState = "ready" | "watch" | "blocked";
export type Pass2454ProviderStatus =
  "live" | "configured" | "planned" | "missing_key" | "not_applicable";
export type Pass2454ProviderId =
  | "defillama"
  | "coingecko"
  | "geckoterminal"
  | "dexscreener"
  | "binance"
  | "l2beat"
  | "token_terminal"
  | "artemis"
  | "coin_metrics"
  | "kaiko"
  | "messari"
  | "the_graph";

export type Pass2454InstitutionalProvider = {
  id: Pass2454ProviderId;
  label: string;
  status: Pass2454ProviderStatus;
  lane:
    | "market"
    | "defi"
    | "fundamentals"
    | "l2_risk"
    | "onchain"
    | "liquidity"
    | "osint";
  bestFor: string[];
  notFor: string[];
  requiredEnv?: string;
  currentEvidence: string[];
  missingBefore100: string[];
  copyBoundary: string;
};

export type Pass2454FieldRoutingContract = {
  field: string;
  state: Pass2454RouterState;
  primaryProvider: Pass2454ProviderId;
  secondaryProviders: Pass2454ProviderId[];
  confirmedBy: Pass2454ProviderId[];
  blockedBy: string[];
  uiRule: string;
  advancedRule: string;
};

export type Pass2454InstitutionalSourceRouter = {
  version: "institutional-source-router-v1";
  state: Pass2454RouterState;
  score: number;
  query?: string;
  symbol?: string;
  liveProviderCount: number;
  configuredProviderCount: number;
  plannedProviderCount: number;
  providers: Pass2454InstitutionalProvider[];
  fieldRoutes: Pass2454FieldRoutingContract[];
  institutional100Locks: string[];
  chartDataExpansionPlan: {
    state: Pass2454RouterState;
    requiredRanges: string[];
    requiredOverlays: string[];
    precisionRules: string[];
    blockedBy: string[];
  };
  defillamaRoleUpgrade: {
    state: Pass2454RouterState;
    lanes: string[];
    forbiddenShortcuts: string[];
    requiredBeforeAdvanced: string[];
  };
  nextProviderBacklog: string[];
  angelReadoutOrder: string[];
  noFillerInstitutionalRule: string;
  generatedAt: string;
};

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function hasEnv(key?: string) {
  return Boolean(key && typeof process !== "undefined" && process.env?.[key]);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sourceHasProvider(
  sourceSync: VelmereSourceSyncPacket | undefined,
  id: string,
) {
  return Boolean(
    sourceSync?.lanes.some(
      (lane) => lane.id === id && ["confirmed", "partial"].includes(lane.state),
    ),
  );
}

function provider(
  args: Omit<
    Pass2454InstitutionalProvider,
    "currentEvidence" | "missingBefore100"
  > & {
    sourceSync?: Pass2454SourceSyncPacket;
    reportEvidence?: Pass2453ReportEvidenceCapsule;
    currentEvidence?: Array<string | false | null | undefined>;
    missingBefore100?: Array<string | false | null | undefined>;
  },
): Pass2454InstitutionalProvider {
  const status: Pass2454ProviderStatus =
    args.status === "planned" && args.requiredEnv && hasEnv(args.requiredEnv)
      ? "configured"
      : args.status;
  return {
    id: args.id,
    label: args.label,
    status,
    lane: args.lane,
    bestFor: unique(args.bestFor).slice(0, 10),
    notFor: unique(args.notFor).slice(0, 10),
    requiredEnv: args.requiredEnv,
    currentEvidence: unique(args.currentEvidence ?? []).slice(0, 10),
    missingBefore100: unique(args.missingBefore100 ?? []).slice(0, 10),
    copyBoundary: args.copyBoundary,
  };
}

function route(args: {
  field: string;
  primaryProvider: Pass2454ProviderId;
  secondaryProviders: Pass2454ProviderId[];
  confirmedBy: Pass2454ProviderId[];
  blockedBy: Array<string | false | null | undefined>;
  uiRule: string;
  advancedRule: string;
}): Pass2454FieldRoutingContract {
  const blockedBy = unique(args.blockedBy).slice(0, 10);
  return {
    field: args.field,
    state:
      blockedBy.length >= 3 ? "blocked" : blockedBy.length ? "watch" : "ready",
    primaryProvider: args.primaryProvider,
    secondaryProviders: args.secondaryProviders,
    confirmedBy: Array.from(new Set(args.confirmedBy)),
    blockedBy,
    uiRule: args.uiRule,
    advancedRule: args.advancedRule,
  };
}

export function buildPass2454InstitutionalSourceRouter(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2454SourceSyncPacket;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  chartRange?: string;
  pointCount?: number;
  payloadFingerprint?: string;
}): Pass2454InstitutionalSourceRouter {
  const sourceSync = args.sourceSync;
  const reportEvidence = args.reportEvidence ?? sourceSync?.pass2453;
  const hasDefiLlama = sourceHasProvider(sourceSync, "defillama");
  const hasMarket =
    sourceHasProvider(sourceSync, "coingecko") ||
    sourceHasProvider(sourceSync, "dexscreener");
  const hasBinance = sourceHasProvider(sourceSync, "binance");
  const hasSecurity = sourceHasProvider(sourceSync, "goplus");
  const reportReady = reportEvidence?.state === "ready";
  const pointCount =
    args.pointCount ?? sourceSync?.pass2449?.windowContract.actualPoints ?? 0;

  const providers: Pass2454InstitutionalProvider[] = [
    provider({
      id: "defillama",
      label: "DefiLlama",
      status: hasDefiLlama ? "live" : "planned",
      lane: "defi",
      bestFor: [
        "protocol TVL",
        "chain TVL",
        "fees/revenue context",
        "stablecoin supply",
        "yields",
        "DEX volume",
      ],
      notFor: [
        "future price",
        "contract safety certificate",
        "holder graph",
        "CEX order-book depth",
      ],
      currentEvidence: [
        hasDefiLlama && "TVL/protocol lane attached",
        sourceSync?.pass2446DefiLlama && "PASS2446 DefiLlama expansion present",
      ],
      missingBefore100: [
        !hasDefiLlama && "live DefiLlama protocol/chain match",
        "fees/revenue endpoint adapter",
        "stablecoin/peg lane",
        "yield and DEX-volume lane",
      ],
      copyBoundary:
        "DefiLlama supports protocol/chain context. It must not be used as a safety certificate or liquidity guarantee.",
    }),
    provider({
      id: "coingecko",
      label: "CoinGecko / GeckoTerminal stack",
      status: hasMarket ? "live" : "planned",
      lane: "market",
      bestFor: [
        "listed price",
        "market cap",
        "volume",
        "market chart",
        "OHLC",
        "DEX metadata via GeckoTerminal",
      ],
      notFor: [
        "holder graph",
        "contract admin risk",
        "L2 sequencer risk",
        "audited fundamentals",
      ],
      currentEvidence: [
        hasMarket && "listed market or DEX snapshot attached",
        pointCount > 0 && `${pointCount} chart points in current packet`,
      ],
      missingBefore100: [
        pointCount < 365 && "1Y/2Y/5Y/MAX continuity target",
        "second provider market overlay",
        "source observedAt per field",
      ],
      copyBoundary:
        "Market chart and OHLC are market context, not investment advice or price prediction.",
    }),
    provider({
      id: "geckoterminal",
      label: "GeckoTerminal",
      status: sourceSync?.pass2449?.providerOverlays.some((lane) =>
        lane.provider.includes("geckoterminal"),
      )
        ? "live"
        : "planned",
      lane: "liquidity",
      bestFor: [
        "pool OHLCV",
        "DEX pool price",
        "pool liquidity overlay",
        "network/pool-specific validation",
      ],
      notFor: ["CEX depth", "protocol revenue", "holder graph"],
      currentEvidence: [
        sourceSync?.pass2449?.providerOverlays.some((lane) =>
          lane.provider.includes("geckoterminal"),
        ) && "pool overlay lane present",
      ],
      missingBefore100: [
        "network + poolAddress resolver",
        "pool OHLCV fetch replay",
        "pair-vs-listed chart diff",
      ],
      copyBoundary:
        "Pool OHLCV can disagree with listed-market candles and must be labeled as pool-specific.",
    }),
    provider({
      id: "dexscreener",
      label: "DEX Screener",
      status: sourceHasProvider(sourceSync, "dexscreener") ? "live" : "planned",
      lane: "liquidity",
      bestFor: [
        "pair snapshot",
        "visible liquidity",
        "FDV",
        "DEX volume",
        "tx pressure",
      ],
      notFor: [
        "full historical OHLCV",
        "protocol TVL",
        "contract safety verdict",
      ],
      currentEvidence: [
        sourceHasProvider(sourceSync, "dexscreener") &&
          "DEX pair snapshot lane attached",
      ],
      missingBefore100: [
        "pair age",
        "pool-level depth replay",
        "multi-pair aggregation",
      ],
      copyBoundary:
        "DEX pair snapshots are current observations and must not be overgeneralized to all venues.",
    }),
    provider({
      id: "binance",
      label: "Binance",
      status: hasBinance ? "live" : "planned",
      lane: "market",
      bestFor: [
        "CEX klines",
        "order-book depth",
        "venue-specific liquidity",
        "VWAP/candle confirmation",
      ],
      notFor: ["DEX pair proof", "holder graph", "protocol TVL"],
      currentEvidence: [hasBinance && "CEX lane attached"],
      missingBefore100: [
        "Coinbase/Kraken/MEXC/Kaiko second venue",
        "L2 order-book depth replay",
        "venue-diff warning",
      ],
      copyBoundary:
        "A Binance lane is venue-specific and must be paired with a second venue before Advanced macro/depth language.",
    }),
    provider({
      id: "l2beat",
      label: "L2BEAT",
      status: "planned",
      lane: "l2_risk",
      bestFor: [
        "L2 risk taxonomy",
        "TVS context",
        "upgrade risk",
        "sequencer/data availability context",
      ],
      notFor: ["token price", "DEX liquidity", "holder graph"],
      currentEvidence: [],
      missingBefore100: [
        "L2 project resolver",
        "risk item mapper",
        "TVS-vs-TVL wording split",
      ],
      copyBoundary:
        "L2BEAT-style risk and TVS context must not be confused with DeFi TVL or token liquidity.",
    }),
    provider({
      id: "token_terminal",
      label: "Token Terminal",
      status: "planned",
      lane: "fundamentals",
      requiredEnv: "TOKEN_TERMINAL_API_KEY",
      bestFor: [
        "standardized protocol fees",
        "revenue",
        "active users",
        "financial ratios",
        "business-fundamentals context",
      ],
      notFor: [
        "spot execution depth",
        "contract safety verdict",
        "short-term price signal",
      ],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "project slug resolver",
        "metric-period mapping",
        "revenue/fees methodology label",
      ],
      copyBoundary:
        "Fundamentals can improve context, not guarantee price, safety or returns.",
    }),
    provider({
      id: "artemis",
      label: "Artemis",
      status: "planned",
      lane: "fundamentals",
      requiredEnv: "ARTEMIS_API_KEY",
      bestFor: [
        "chain fundamentals",
        "stablecoin supply",
        "developer activity",
        "transactions",
        "active addresses",
        "fees/revenue",
      ],
      notFor: [
        "single-pair liquidity",
        "contract exploit proof",
        "investment signal",
      ],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "chain/protocol resolver",
        "developer activity display",
        "stablecoin/fundamentals parity",
      ],
      copyBoundary:
        "Artemis-style fundamentals are adoption/context lanes and must stay separate from price/liquidity scoring.",
    }),
    provider({
      id: "coin_metrics",
      label: "Coin Metrics",
      status: "planned",
      lane: "onchain",
      requiredEnv: "COIN_METRICS_API_KEY",
      bestFor: [
        "network data",
        "on-chain asset metrics",
        "realized cap",
        "supply metrics",
        "reference rates",
      ],
      notFor: [
        "DEX pool-specific slippage",
        "project revenue without mapping",
        "holder labels",
      ],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "asset metric resolver",
        "reference-rate agreement lane",
        "network metric display",
      ],
      copyBoundary:
        "Network metrics are macro/on-chain context, not a buy/sell forecast.",
    }),
    provider({
      id: "kaiko",
      label: "Kaiko",
      status: "planned",
      lane: "liquidity",
      requiredEnv: "KAIKO_API_KEY",
      bestFor: [
        "institutional market data",
        "L1/L2 order book",
        "trades",
        "slippage/depth",
        "cross-exchange comparison",
      ],
      notFor: ["protocol TVL", "holder graph", "contract admin risk"],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "venue/pair mapper",
        "order-book depth buckets",
        "slippage stress replay",
      ],
      copyBoundary:
        "Order-book/depth data supports execution-risk context only when venue/pair/timecode are visible.",
    }),
    provider({
      id: "messari",
      label: "Messari",
      status: "planned",
      lane: "osint",
      requiredEnv: "MESSARI_API_KEY",
      bestFor: [
        "asset profile",
        "market data",
        "on-chain metrics",
        "structured ecosystem intel",
        "event monitoring",
      ],
      notFor: [
        "contract safety verdict",
        "single-source price truth",
        "guaranteed future outcomes",
      ],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "asset slug mapper",
        "event severity taxonomy",
        "source citation rail",
      ],
      copyBoundary:
        "Intel/events support context and timeline, not accusation or investment advice.",
    }),
    provider({
      id: "the_graph",
      label: "The Graph / subgraphs",
      status: "planned",
      lane: "onchain",
      requiredEnv: "THE_GRAPH_API_KEY",
      bestFor: [
        "custom subgraph indexing",
        "protocol events",
        "transfer history",
        "contract-specific state",
      ],
      notFor: [
        "unindexed global market cap",
        "CEX depth",
        "off-chain fundamentals",
      ],
      currentEvidence: [],
      missingBefore100: [
        "API key",
        "subgraph allowlist",
        "schema version",
        "reorg/staleness guard",
      ],
      copyBoundary:
        "Subgraphs are powerful but schema-specific; a missing subgraph is not proof that an event did not happen.",
    }),
  ];

  const liveProviderCount = providers.filter(
    (item) => item.status === "live",
  ).length;
  const configuredProviderCount = providers.filter(
    (item) => item.status === "configured",
  ).length;
  const plannedProviderCount = providers.filter(
    (item) => item.status === "planned" || item.status === "missing_key",
  ).length;

  const fieldRoutes: Pass2454FieldRoutingContract[] = [
    route({
      field: "price / market cap / volume",
      primaryProvider: "coingecko",
      secondaryProviders: ["messari", "coin_metrics", "kaiko"],
      confirmedBy: unique([hasMarket && "coingecko"]) as Pass2454ProviderId[],
      blockedBy: [
        !hasMarket && "live market provider",
        "second institutional price/market source",
        "field observedAt",
      ],
      uiRule: "Show provider badge next to every market number.",
      advancedRule:
        "Advanced market wording requires a second provider or visible uncertainty cap.",
    }),
    route({
      field: "2Y / 5Y / MAX chart precision",
      primaryProvider: "coingecko",
      secondaryProviders: ["kaiko", "messari", "geckoterminal", "binance"],
      confirmedBy: unique([
        pointCount > 0 && "coingecko",
        hasBinance && "binance",
      ]) as Pass2454ProviderId[],
      blockedBy: [
        pointCount < 365 && "long-history point density",
        "second overlay provider",
        "gap annotation rail",
      ],
      uiRule:
        "Display range, point count, gaps, source and hash before any regime label.",
      advancedRule:
        "Macro chart conclusions require long-history continuity plus a second overlay lane.",
    }),
    route({
      field: "TVL / DeFi fundamentals",
      primaryProvider: "defillama",
      secondaryProviders: ["token_terminal", "artemis", "messari"],
      confirmedBy: unique([
        hasDefiLlama && "defillama",
      ]) as Pass2454ProviderId[],
      blockedBy: [
        !hasDefiLlama && "DefiLlama protocol/chain match",
        "fees/revenue cross-provider lane",
        "stablecoin/yield context",
      ],
      uiRule:
        "Label TVL as protocol/chain context and keep it separate from liquidity.",
      advancedRule:
        "Advanced fundamentals need TVL plus fees/revenue or activity confirmation.",
    }),
    route({
      field: "L2 / chain security context",
      primaryProvider: "l2beat",
      secondaryProviders: ["defillama", "artemis", "coin_metrics"],
      confirmedBy: [] as Pass2454ProviderId[],
      blockedBy: [
        "L2BEAT project resolver",
        "TVS-vs-TVL boundary",
        "upgrade/sequencer/data-availability taxonomy",
      ],
      uiRule:
        "Show L2 risk as chain/project infrastructure context, not token risk by itself.",
      advancedRule:
        "Advanced L2 language needs separate risk taxonomy and chain value context.",
    }),
    route({
      field: "liquidity / exit-depth / slippage",
      primaryProvider: "dexscreener",
      secondaryProviders: ["geckoterminal", "kaiko", "binance"],
      confirmedBy: unique([
        sourceHasProvider(sourceSync, "dexscreener") && "dexscreener",
        hasBinance && "binance",
      ]) as Pass2454ProviderId[],
      blockedBy: [
        "stress slippage buckets",
        "multi-pair aggregation",
        "CEX-vs-DEX depth split",
      ],
      uiRule:
        "Do not collapse visible pool liquidity and executable depth into one number.",
      advancedRule:
        "Advanced exit-risk needs slippage buckets or an explicit missing-depth lock.",
    }),
    route({
      field: "holder / transfer graph",
      primaryProvider: "the_graph",
      secondaryProviders: ["coin_metrics", "messari"],
      confirmedBy: [] as Pass2454ProviderId[],
      blockedBy: [
        !hasSecurity && "contract/security provider",
        "holder labels",
        "transfer graph",
        "CEX/custody exclusions",
      ],
      uiRule:
        "Missing holder graph is uncertainty, not safety or danger proof.",
      advancedRule:
        "Advanced holder conclusions need graph, labels and source timecode.",
    }),
    route({
      field: "report / PDF parity",
      primaryProvider: "coingecko",
      secondaryProviders: [
        "defillama",
        "dexscreener",
        "binance",
        "geckoterminal",
      ],
      confirmedBy: unique([
        reportEvidence && "coingecko",
        hasDefiLlama && "defillama",
        sourceHasProvider(sourceSync, "dexscreener") && "dexscreener",
        hasBinance && "binance",
      ]) as Pass2454ProviderId[],
      blockedBy: [
        !reportReady && "ready reportEvidenceCapsule",
        !args.payloadFingerprint &&
          "payload fingerprint carried through surfaces",
        "visible PDF preview/download hash",
      ],
      uiRule: "All surfaces must render one canonical evidence fingerprint.",
      advancedRule:
        "PDF Advanced is blocked if preview and download can diverge.",
    }),
  ];

  const institutional100Locks = unique([
    ...providers.flatMap((item) =>
      item.missingBefore100.map((missing) => `${item.label}: ${missing}`),
    ),
    ...fieldRoutes.flatMap((item) =>
      item.blockedBy.map((blocker) => `${item.field}: ${blocker}`),
    ),
  ]).slice(0, 28);
  const readyFields = fieldRoutes.filter(
    (item) => item.state === "ready",
  ).length;
  const watchFields = fieldRoutes.filter(
    (item) => item.state === "watch",
  ).length;
  const score = clamp(
    34 +
      liveProviderCount * 7 +
      configuredProviderCount * 4 +
      readyFields * 5 +
      watchFields * 2 -
      institutional100Locks.length * 0.55,
  );
  const state: Pass2454RouterState =
    score >= 78 && institutional100Locks.length <= 8
      ? "ready"
      : score >= 50
        ? "watch"
        : "blocked";

  const chartBlockedBy = unique([
    pointCount < 365 && "long-history point density below macro target",
    !fieldRoutes.find((item) => item.field.includes("chart"))?.confirmedBy
      .length && "chart provider missing",
    "Kaiko/Messari/CEX second overlay not live",
    !args.payloadFingerprint && "chart/report payload fingerprint not attached",
  ]);

  return {
    version: "institutional-source-router-v1",
    state,
    score,
    query: args.query ?? sourceSync?.query,
    symbol: args.symbol ?? sourceSync?.symbol,
    liveProviderCount,
    configuredProviderCount,
    plannedProviderCount,
    providers,
    fieldRoutes,
    institutional100Locks,
    chartDataExpansionPlan: {
      state:
        chartBlockedBy.length >= 3
          ? "blocked"
          : chartBlockedBy.length
            ? "watch"
            : "ready",
      requiredRanges: ["30d", "90d", "1y", "2y", "5y", "max"],
      requiredOverlays: [
        "CoinGecko market_chart/OHLC",
        "Binance/CEX klines",
        "GeckoTerminal pool OHLCV",
        "Kaiko/Messari institutional market overlay",
      ],
      precisionRules: [
        "Show point count and gap annotations before regime language.",
        "Never use a 7d sparkline as a 2Y/5Y macro proof.",
        "CEX and DEX pool charts must be labeled separately.",
        "PDF preview/download must reuse the same canonical payload fingerprint.",
      ],
      blockedBy: chartBlockedBy,
    },
    defillamaRoleUpgrade: {
      state: hasDefiLlama ? "watch" : "blocked",
      lanes: [
        "protocol TVL",
        "chain TVL",
        "fees/revenue",
        "stablecoins",
        "yields",
        "DEX volume",
        "bridge/chain context",
      ],
      forbiddenShortcuts: [
        "TVL proves safety",
        "TVL proves liquidity",
        "TVL predicts price",
        "missing TVL means fraud",
      ],
      requiredBeforeAdvanced: [
        "matched protocol/chain",
        "TVL timecode",
        "fees/revenue context",
        "methodology label",
        "second fundamentals provider when available",
      ],
    },
    nextProviderBacklog: [
      "Add L2BEAT adapter for L2 risk/TVS, upgrade and sequencer context.",
      "Add Token Terminal / Artemis fundamentals lane for fees, revenue, DAU/dev activity and stablecoin context.",
      "Add Kaiko or Coin Metrics institutional market/depth overlay for second-source charts.",
      "Add Messari intel/event rail for structured OSINT without social hype.",
      "Add The Graph/subgraph allowlist for protocol-specific transfer and event indexing.",
    ],
    angelReadoutOrder: [
      "institutional router state/score",
      "correct provider for requested field",
      "live vs planned evidence",
      "blocked fields",
      "chart expansion status",
      "DefiLlama role boundary",
      "tier-safe conclusion",
    ],
    noFillerInstitutionalRule:
      "Planned institutional providers are roadmap, not evidence. If a field is missing, show the lock and confidence cap instead of filling with AI prose.",
    generatedAt: new Date().toISOString(),
  };
}

export function buildPass2454ChartInstitutionalRouter(args: {
  id?: string;
  symbol?: string;
  range?: string;
  pointCount?: number;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  payloadFingerprint?: string;
}): Pass2454InstitutionalSourceRouter {
  return buildPass2454InstitutionalSourceRouter({
    query: args.id,
    symbol: args.symbol,
    chartRange: args.range,
    pointCount: args.pointCount,
    reportEvidence: args.reportEvidence,
    payloadFingerprint: args.payloadFingerprint,
  });
}
