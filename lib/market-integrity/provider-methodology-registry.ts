import type { VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2448MethodologyState = "ready" | "watch" | "blocked";
export type Pass2448ProviderIntegrationState = "live" | "partial" | "planned" | "key_required" | "manual_review";

export type Pass2448ProviderMethodologyCard = {
  id:
    | "coingecko"
    | "dexscreener"
    | "binance"
    | "defillama"
    | "goplus"
    | "bitquery"
    | "geckoterminal"
    | "token-terminal"
    | "artemis"
    | "coinmarketcap"
    | "l2beat"
    | "manual-review";
  label: string;
  integrationState: Pass2448ProviderIntegrationState;
  bestFor: string[];
  secondaryUse: string[];
  neverUseFor: string[];
  proofRequired: string[];
  cadenceTarget: string;
  keyPolicy: "none" | "optional" | "required" | "enterprise";
  uiDisclosure: string;
  advancedUnlockRule: string;
};

export type Pass2448FieldProviderContract = {
  field:
    | "identity"
    | "price"
    | "market_cap"
    | "volume"
    | "ohlcv_long_chart"
    | "dex_liquidity"
    | "cex_depth"
    | "tvl"
    | "fees_revenue"
    | "stablecoin_supply"
    | "yield_context"
    | "holders_transfers"
    | "contract_security"
    | "l2_risk";
  label: string;
  basicProviders: string[];
  proProviders: string[];
  advancedProviders: string[];
  currentState: Pass2448MethodologyState;
  missingFor100: string[];
  forbiddenShortcut: string;
  scoreImpact: number;
  uiRule: string;
};

export type Pass2448ProviderMethodologyRegistry = {
  version: "provider-methodology-registry-v1";
  state: Pass2448MethodologyState;
  score: number;
  activeProviderCount: number;
  providerCards: Pass2448ProviderMethodologyCard[];
  fieldContracts: Pass2448FieldProviderContract[];
  strongestStack: string[];
  providerSyncPolicy: string[];
  riskEngineRules: string[];
  pdfRules: string[];
  angelRules: string[];
  nextIntegrations: string[];
  generatedAt: string;
};

export type Pass2448ChartMethodologyContract = {
  version: "pass2448-chart-methodology-contract-v1";
  state: Pass2448MethodologyState;
  score: number;
  range: string;
  pointCount: number;
  acceptedPrimary: string[];
  requiredOverlay: string[];
  missingForAdvanced: string[];
  uiRule: string;
  proofRule: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function providerState(sourceSync: VelmereSourceSyncPacket, laneId: string): Pass2448ProviderIntegrationState {
  const lane = sourceSync.lanes.find((item) => item.id === laneId);
  if (!lane) return "planned";
  if (lane.state === "confirmed") return "live";
  if (lane.state === "partial") return "partial";
  if (lane.state === "not_applicable") return "manual_review";
  return "planned";
}

export function buildPass2448ProviderCards(sourceSync?: VelmereSourceSyncPacket): Pass2448ProviderMethodologyCard[] {
  const getState = (id: string, fallback: Pass2448ProviderIntegrationState) => sourceSync ? providerState(sourceSync, id) : fallback;
  return [
    {
      id: "coingecko",
      label: "CoinGecko market + historical chart",
      integrationState: getState("coingecko", "partial"),
      bestFor: ["listed crypto price", "market cap", "volume", "market_chart", "OHLC"],
      secondaryUse: ["coin identity", "logo/image", "categories"],
      neverUseFor: ["contract safety", "holder labels", "DEX pool slippage", "TVL methodology"],
      proofRequired: ["coin id", "range", "timestamp/observedAt", "points count", "cache age"],
      cadenceTarget: "15m cache on OHLC; short market snapshots 60-120s target depending on plan",
      keyPolicy: "optional",
      uiDisclosure: "Market data provider; not a security verdict and not a price forecast.",
      advancedUnlockRule: "Long chart conclusions require gap score, second overlay and PDF checksum parity.",
    },
    {
      id: "dexscreener",
      label: "DEX Screener pair + liquidity",
      integrationState: getState("dexscreener", "partial"),
      bestFor: ["DEX pair discovery", "visible liquidity", "FDV", "24h DEX volume", "pair metadata"],
      secondaryUse: ["token profile links", "pair URL", "boost/order context as disclosure only"],
      neverUseFor: ["CEX order-book depth", "holder classification", "protocol revenue", "safety certification"],
      proofRequired: ["chain id", "pair address", "liquidityUsd", "volume windows", "pair age if available"],
      cadenceTarget: "60s pair snapshot target; do not spam public endpoints",
      keyPolicy: "none",
      uiDisclosure: "DEX liquidity is visible pair context, not guaranteed exit liquidity under stress.",
      advancedUnlockRule: "Advanced exit-depth needs pool event history or second DEX source overlay.",
    },
    {
      id: "binance",
      label: "Binance CEX klines + depth",
      integrationState: getState("binance", "partial"),
      bestFor: ["spot OHLCV", "klines", "order-book depth", "spread", "venue liquidity"],
      secondaryUse: ["large-cap CEX sanity check", "volume continuity"],
      neverUseFor: ["DEX-only tokens", "TVL", "holder labels", "contract roles"],
      proofRequired: ["symbol mapping", "quote asset", "interval", "depth snapshot", "server time"],
      cadenceTarget: "15s-300s depending on interval; daily cache for macro windows",
      keyPolicy: "none",
      uiDisclosure: "Venue-specific market data; must be labeled as Binance lane, not global truth.",
      advancedUnlockRule: "Advanced depth language requires at least one second venue or DEX-pair comparison.",
    },
    {
      id: "defillama",
      label: "DefiLlama DeFi fundamentals",
      integrationState: getState("defillama", "partial"),
      bestFor: ["TVL", "protocol", "chain context", "stablecoins", "yields", "fees/revenue", "DEX volume"],
      secondaryUse: ["protocol category", "chain list", "TVL 1d/7d changes"],
      neverUseFor: ["token safety", "future price", "holder graph", "CEX order-book depth"],
      proofRequired: ["protocol slug", "methodology note", "TVL timestamp", "matched chain", "missing pool-level depth"],
      cadenceTarget: "120-240s protocol/chain context; cache by protocol slug",
      keyPolicy: "optional",
      uiDisclosure: "TVL/fundamentals context only; never a safety certificate.",
      advancedUnlockRule: "Advanced must show methodology and explicitly separate TVL from liquidity and security.",
    },
    {
      id: "goplus",
      label: "Token security scan lane",
      integrationState: getState("goplus", "partial"),
      bestFor: ["buy/sell tax", "honeypot flags", "privileged role flags", "holder/security hints"],
      secondaryUse: ["contract quick pre-screen", "manual audit triage"],
      neverUseFor: ["formal audit guarantee", "exploit instructions", "price/liquidity conclusions"],
      proofRequired: ["chain id", "contract address", "provider payload", "scan timestamp", "source verification status"],
      cadenceTarget: "per contract scan; refresh on contract/pair change",
      keyPolicy: "optional",
      uiDisclosure: "Security scan is a pre-screen, not a certified audit.",
      advancedUnlockRule: "Advanced contract section requires source snapshot and safe remediation wording.",
    },
    {
      id: "bitquery",
      label: "Bitquery holder / transfers / DEX trade graph",
      integrationState: "key_required",
      bestFor: ["holder graph", "transfer flows", "DEX trades", "top traders", "on-chain event context"],
      secondaryUse: ["cross-chain token flow", "wallet clustering inputs before manual labels"],
      neverUseFor: ["wallet identity without labels", "legal accusation", "future performance"],
      proofRequired: ["API key", "chain", "contract", "query hash", "window", "redaction policy"],
      cadenceTarget: "on-demand Advanced lane; cache redacted graph snapshots",
      keyPolicy: "required",
      uiDisclosure: "Wallet clusters are unclassified until labels are proven; do not call them team/insider by default.",
      advancedUnlockRule: "Unlock holder-flow conclusions only when labels, redactions and transfer windows are visible.",
    },
    {
      id: "geckoterminal",
      label: "GeckoTerminal pool OHLCV fallback",
      integrationState: "planned",
      bestFor: ["pool OHLCV", "DEX pool price", "pool volume", "pool liquidity fallback"],
      secondaryUse: ["second DEX provider overlay", "small-cap pool history"],
      neverUseFor: ["CEX depth", "protocol revenue", "formal audit"],
      proofRequired: ["network", "pool address", "timeframe", "limit", "cache age"],
      cadenceTarget: "1m cache target; pool data may update faster than cache",
      keyPolicy: "none",
      uiDisclosure: "Pool-specific data can diverge from listed market aggregators; show pool address.",
      advancedUnlockRule: "Use as second provider overlay for DEX tokens before macro chart copy.",
    },
    {
      id: "token-terminal",
      label: "Token Terminal standardized fundamentals",
      integrationState: "key_required",
      bestFor: ["standardized KPIs", "fees", "revenue", "usage metrics", "cross-protocol comparison"],
      secondaryUse: ["business-style diligence", "Advanced PDF fundamentals section"],
      neverUseFor: ["DEX exit depth", "contract exploit claim", "holder identity"],
      proofRequired: ["project mapping", "metric definition", "date range", "API plan", "source timestamp"],
      cadenceTarget: "daily/weekly fundamentals cache",
      keyPolicy: "required",
      uiDisclosure: "Comparable fundamentals require matched methodology; show definitions before ranking.",
      advancedUnlockRule: "Advanced fundamentals require definitions and provider agreement with DefiLlama when overlapping.",
    },
    {
      id: "artemis",
      label: "Artemis on-chain fundamentals candidate",
      integrationState: "planned",
      bestFor: ["chain activity", "stablecoin metrics", "user behavior", "developer/activity context"],
      secondaryUse: ["macro chain health", "cross-chain usage sanity check"],
      neverUseFor: ["contract safety", "spot order-book depth", "portfolio advice"],
      proofRequired: ["project/chain mapping", "metric definition", "time window", "data source note"],
      cadenceTarget: "daily chain/fundamental cache",
      keyPolicy: "enterprise",
      uiDisclosure: "Wallet-flow fundamentals are context; they do not prove token safety or future demand.",
      advancedUnlockRule: "Use only as an Advanced context overlay when methodology can be shown.",
    },
    {
      id: "coinmarketcap",
      label: "CoinMarketCap market + exchange fallback",
      integrationState: "planned",
      bestFor: ["ranked market view", "historical data", "exchange/pair coverage", "liquidity context"],
      secondaryUse: ["second market aggregator", "ticker mapping fallback"],
      neverUseFor: ["TVL", "contract exploit proof", "holder labels"],
      proofRequired: ["API key", "asset id", "quote", "timestamp", "plan limitations"],
      cadenceTarget: "paid-plan dependent; cache by asset id",
      keyPolicy: "required",
      uiDisclosure: "Market aggregator fallback; show if it disagrees with CoinGecko.",
      advancedUnlockRule: "Use as second market source before strong market-cap/volume language.",
    },
    {
      id: "l2beat",
      label: "L2BEAT L2 risk / TVL context",
      integrationState: "manual_review",
      bestFor: ["Ethereum L2 risk context", "rollup transparency", "L2 TVL/context"],
      secondaryUse: ["chain-level caveat for L2-native assets"],
      neverUseFor: ["token price", "DEX pool liquidity", "contract audit guarantee"],
      proofRequired: ["project match", "risk page/manual snapshot", "date", "operator review"],
      cadenceTarget: "manual/operator-reviewed until stable public contract is chosen",
      keyPolicy: "none",
      uiDisclosure: "L2 context is chain risk context, not token-level safety.",
      advancedUnlockRule: "Only show in Advanced when chain/project mapping is explicit.",
    },
    {
      id: "manual-review",
      label: "Velmère human/operator review",
      integrationState: "manual_review",
      bestFor: ["redaction", "customer-safe report", "provider contradiction decisions", "audit handoff"],
      secondaryUse: ["case notes", "PDF final review", "admin evidence queue"],
      neverUseFor: ["fabricating missing source data", "investment advice", "guaranteed safety"],
      proofRequired: ["operator id/session", "case id", "action log", "customer-safe summary", "redaction envelope"],
      cadenceTarget: "case SLA dependent",
      keyPolicy: "none",
      uiDisclosure: "Manual QA can classify evidence; it cannot invent missing source data.",
      advancedUnlockRule: "Advanced report delivery requires receipt, redaction and customer-safe envelope.",
    },
  ];
}

function fieldState(requiredAdvanced: string[], active: Set<string>, extraMissing: string[] = []) {
  const missing = requiredAdvanced.filter((id) => !active.has(id));
  const totalMissing = unique([...missing, ...extraMissing]);
  const state: Pass2448MethodologyState = totalMissing.length === 0 ? "ready" : totalMissing.length <= 2 ? "watch" : "blocked";
  const score = clamp(100 - totalMissing.length * 13);
  return { currentState: state, missingFor100: totalMissing, methodologyScore: score };
}

export function buildPass2448ProviderMethodologyRegistry(args: {
  sourceSync: VelmereSourceSyncPacket;
}): Pass2448ProviderMethodologyRegistry {
  const { sourceSync } = args;
  const active = new Set(sourceSync.lanes.filter((lane) => ["confirmed", "partial"].includes(lane.state)).map((lane) => lane.id));
  const providerCards = buildPass2448ProviderCards(sourceSync);
  const chartMissing = sourceSync.pass2447?.consensusFields.find((field) => field.id === "long_chart")?.missingProviders ?? ["2Y/5Y/MAX chart points", "second provider overlay"];
  const advancedBlockers = sourceSync.pass2447?.tierLocks.find((tier) => tier.tier === "advanced")?.blockedBy ?? [];

  const contracts: Pass2448FieldProviderContract[] = [
    {
      field: "identity" as const,
      label: "Asset identity / contract scope",
      basicProviders: ["CoinGecko or DEX Screener"],
      proProviders: ["provider logo/image", "chain/contract when available"],
      advancedProviders: ["chain + contract + security scan + manual review for ambiguous assets"],
      ...fieldState([active.has("coingecko") ? "coingecko" : "dexscreener"], active),
      forbiddenShortcut: "Do not infer contract safety from a symbol match.",
      scoreImpact: 8,
      uiRule: "Show the source provider and whether this is listed-coin, DEX-pair or contract-scoped.",
    },
    {
      field: "price" as const,
      label: "Price / quote consensus",
      basicProviders: ["CoinGecko or DEX Screener"],
      proProviders: ["second market provider or venue label"],
      advancedProviders: ["CoinGecko + Binance/DEX overlay + timestamp proof"],
      ...fieldState([active.has("dexscreener") ? "dexscreener" : "coingecko", "binance"], active),
      forbiddenShortcut: "Do not call one venue price a global truth.",
      scoreImpact: 10,
      uiRule: "Price tile must display source and observedAt/cadence weakness.",
    },
    {
      field: "market_cap" as const,
      label: "Market cap / FDV / supply",
      basicProviders: ["CoinGecko market cap"],
      proProviders: ["DEX Screener FDV for pair context"],
      advancedProviders: ["CoinGecko + CMC/Token Terminal mapping + supply/unlock proof"],
      ...fieldState(["coingecko"], active, ["supply/unlock proof", "second market-cap aggregator"].filter((item) => !advancedBlockers.some((blocker) => blocker.toLowerCase().includes(item.split("/")[0])))),
      forbiddenShortcut: "Market cap is not liquidity and FDV is not unlock proof.",
      scoreImpact: 10,
      uiRule: "FDV/MC ratio belongs in Pro/Advanced with unlock caveat.",
    },
    {
      field: "volume" as const,
      label: "Volume quality / wash-risk caveat",
      basicProviders: ["CoinGecko or DEX Screener 24h volume"],
      proProviders: ["DEX liquidity/volume pressure"],
      advancedProviders: ["Binance/venue overlay + DEX event history + Bitquery flow"],
      ...fieldState([active.has("dexscreener") ? "dexscreener" : "coingecko", "binance"], active, ["wash/organic volume cannot be proven without venue/trade flow"]),
      forbiddenShortcut: "Do not call volume organic without trade-flow or venue cross-check.",
      scoreImpact: 8,
      uiRule: "Show volume as observed activity, not demand quality.",
    },
    {
      field: "ohlcv_long_chart" as const,
      label: "2Y/5Y/MAX chart methodology",
      basicProviders: ["short sparkline"],
      proProviders: ["CoinGecko market_chart / OHLC"],
      advancedProviders: ["CoinGecko + Binance or GeckoTerminal overlay + gap annotations + checksum"],
      ...fieldState(["coingecko"], active, chartMissing),
      forbiddenShortcut: "Do not write macro trend from a 7d sparkline.",
      scoreImpact: 12,
      uiRule: "Macro/regime copy is locked until point count, range and gaps are visible.",
    },
    {
      field: "dex_liquidity" as const,
      label: "DEX liquidity / exit depth",
      basicProviders: ["visible liquidity when DEX pair exists"],
      proProviders: ["DEX Screener liquidity + volume pressure"],
      advancedProviders: ["DEX Screener + GeckoTerminal pool OHLCV + pool event history/slippage"],
      ...fieldState(["dexscreener"], active, ["pool event history", "slippage replay"]),
      forbiddenShortcut: "Visible liquidity is not guaranteed exit capacity.",
      scoreImpact: 12,
      uiRule: "Liquidity tile must be separate from market-cap tile.",
    },
    {
      field: "cex_depth" as const,
      label: "CEX order-book depth / spread",
      basicProviders: ["not shown unless venue mapped"],
      proProviders: ["Binance pair candidate"],
      advancedProviders: ["Binance + second venue depth + spread/slippage replay"],
      ...fieldState(["binance"], active, ["second venue depth", "spread replay"]),
      forbiddenShortcut: "CEX volume is not order-book depth.",
      scoreImpact: 12,
      uiRule: "Advanced depth conclusions need venue and snapshot time.",
    },
    {
      field: "tvl" as const,
      label: "TVL / protocol / chain context",
      basicProviders: ["none unless protocol matched"],
      proProviders: ["DefiLlama TVL/protocol/chain"],
      advancedProviders: ["DefiLlama + methodology note + fees/revenue/stablecoin/yields when relevant"],
      ...fieldState(["defillama"], active, ["pool-level exit depth is separate", "methodology note visible"]),
      forbiddenShortcut: "TVL is not token liquidity and not a safety certificate.",
      scoreImpact: 10,
      uiRule: "TVL appears as context lane only with evidence boundary.",
    },
    {
      field: "fees_revenue" as const,
      label: "Fees / revenue / usage fundamentals",
      basicProviders: ["not Basic"],
      proProviders: ["DefiLlama fees/revenue when protocol matched"],
      advancedProviders: ["DefiLlama + Token Terminal standardized KPIs + methodology definitions"],
      ...fieldState(["defillama"], active, ["Token Terminal API key", "metric definitions"]),
      forbiddenShortcut: "Do not compare protocols without normalized definitions.",
      scoreImpact: 8,
      uiRule: "Revenue/fees copy must name definitions and source window.",
    },
    {
      field: "stablecoin_supply" as const,
      label: "Stablecoin / reserve context",
      basicProviders: ["peg/price only"],
      proProviders: ["DefiLlama stablecoin supply by chain"],
      advancedProviders: ["DefiLlama + issuer disclosures/manual review"],
      ...fieldState(["defillama"], active, ["issuer disclosure", "chain distribution"]),
      forbiddenShortcut: "Peg price does not prove reserves.",
      scoreImpact: 7,
      uiRule: "Stablecoin lane must separate peg, supply, chain distribution and issuer proof.",
    },
    {
      field: "yield_context" as const,
      label: "Yield / APY risk context",
      basicProviders: ["not Basic"],
      proProviders: ["DefiLlama yields as context"],
      advancedProviders: ["DefiLlama yields + pool risk + protocol docs/manual review"],
      ...fieldState(["defillama"], active, ["pool risk", "reward token composition"]),
      forbiddenShortcut: "High APY is not quality and low APY is not safety.",
      scoreImpact: 6,
      uiRule: "Yield data is educational context, never a recommendation.",
    },
    {
      field: "holders_transfers" as const,
      label: "Holders / transfers / whale flow",
      basicProviders: ["not Basic except missing-data notice"],
      proProviders: ["security pre-screen holder hints"],
      advancedProviders: ["Bitquery holder/transfer graph + labels + redaction"],
      ...fieldState(["goplus"], active, ["Bitquery key", "wallet labels", "transfer window", "redaction envelope"]),
      forbiddenShortcut: "Do not call unlabelled wallets team/insider.",
      scoreImpact: 14,
      uiRule: "Show unclassified clusters until labels are proven.",
    },
    {
      field: "contract_security" as const,
      label: "Contract security / taxes / roles",
      basicProviders: ["contract missing notice"],
      proProviders: ["security scan pre-screen"],
      advancedProviders: ["GoPlus/security lane + source verification + manual audit queue"],
      ...fieldState(["goplus"], active, ["verified source snapshot", "privileged role timeline"]),
      forbiddenShortcut: "Security pre-screen is not an audit certificate.",
      scoreImpact: 14,
      uiRule: "Use safe remediation language only; no exploit steps.",
    },
    {
      field: "l2_risk" as const,
      label: "L2 / chain risk context",
      basicProviders: ["not Basic"],
      proProviders: ["chain label only"],
      advancedProviders: ["L2BEAT/manual chain risk snapshot when asset is L2-native"],
      ...fieldState([], active, ["L2 project mapping", "manual snapshot"]),
      forbiddenShortcut: "Do not apply L2 risk page to an unrelated token by ticker only.",
      scoreImpact: 5,
      uiRule: "L2 risk is chain/project context, not token-level safety.",
    },
  ].map((item) => ({ ...item, missingFor100: item.missingFor100.slice(0, 8), scoreImpact: clamp(item.scoreImpact) }));

  const avgContractScore = contracts.reduce((sum, item) => sum + Math.max(10, 100 - item.missingFor100.length * 12), 0) / Math.max(contracts.length, 1);
  const activeProviderCount = active.size;
  const blockerPenalty = contracts.filter((contract) => contract.currentState === "blocked").length * 2;
  const score = clamp(Math.min(sourceSync.pass2447?.score ?? sourceSync.confidenceCap, avgContractScore) + activeProviderCount * 2 - blockerPenalty);
  const state: Pass2448MethodologyState = score >= 78 ? "ready" : score >= 50 ? "watch" : "blocked";

  return {
    version: "provider-methodology-registry-v1",
    state,
    score,
    activeProviderCount,
    providerCards,
    fieldContracts: contracts,
    strongestStack: [
      "CoinGecko: listed market/chart backbone",
      "DEX Screener: DEX pair/liquidity backbone",
      "Binance: CEX OHLCV/depth venue overlay",
      "DefiLlama: TVL/protocol/chain/fundamentals context",
      "GoPlus/security lane: contract pre-screen",
      "Bitquery/GeckoTerminal/Token Terminal/Artemis/CMC/L2BEAT: Advanced expansion candidates with method disclosures",
    ],
    providerSyncPolicy: [
      "Every field must name its allowed provider set before Angel, Brain or PDF writes a conclusion.",
      "Provider disagreement lowers confidence and becomes visible copy; it is not hidden in prose.",
      "Advanced claims need field-level provider pairing, observedAt/cadence and missingFor100 list.",
      "A provider can be excellent for one lane and forbidden for another lane.",
    ],
    riskEngineRules: [
      "Risk score may not exceed PASS2448 score plus 8 when methodology contracts are blocked.",
      "TVL, market cap, liquidity, depth, holders and contract security stay independent lanes.",
      "Missing Bitquery/holder-flow means whale language is locked to unclassified clusters.",
      "Missing second chart provider means macro/regime copy must be cautious and source-bound.",
    ],
    pdfRules: [
      "PDF preview and download must include the same sourceSync.pass2448 object and payload fingerprint.",
      "Every table row must expose provider, field, observedAt/cadence weakness and missingFor100.",
      "No Advanced PDF conclusion can hide a blocked field contract.",
    ],
    angelRules: [
      "Angel order: provider methodology state → active providers → blocked fields → safe conclusion.",
      "Planned providers are not live evidence; Angel must not use a planned provider as if it was live.",
      "Angel should say which provider is better for the user’s question instead of generating generic prose.",
    ],
    nextIntegrations: [
      "Mount PASS2448 methodology strip in Shield modal, VLM Brain and Browser compact result.",
      "Wire GeckoTerminal pool OHLCV as second DEX chart overlay for contract/pair searches.",
      "Add Bitquery holder/transfer adapter behind Advanced entitlement and redaction envelope.",
      "Add Token Terminal/Artemis optional fundamentals registry behind env keys.",
      "Persist PASS2448 methodology snapshot in PDF preview/download and audit receipts.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function buildPass2448ChartMethodologyContract(args: {
  range: string;
  pointCount: number;
  continuityScore?: number;
  missingForAdvanced?: string[];
}): Pass2448ChartMethodologyContract {
  const macro = ["1y", "2y", "5y", "max"].includes(args.range);
  const missing = unique([
    ...(args.missingForAdvanced ?? []),
    macro && args.pointCount < 180 && "more long-range points",
    "second provider overlay",
    "observedAt/source badge",
    "PDF payload parity hash",
  ]).slice(0, 10);
  const score = clamp((args.continuityScore ?? 40) + (macro ? 8 : -8) + Math.min(20, Math.floor(args.pointCount / 30)) - missing.length * 5);
  return {
    version: "pass2448-chart-methodology-contract-v1",
    state: score >= 78 && missing.length <= 2 ? "ready" : score >= 50 ? "watch" : "blocked",
    score,
    range: args.range,
    pointCount: args.pointCount,
    acceptedPrimary: ["CoinGecko market_chart/OHLC", "Binance klines for mapped CEX pairs", "GeckoTerminal pool OHLCV for DEX-pool searches"],
    requiredOverlay: ["second provider overlay", "gap annotation", "observedAt badge", "checksum parity"],
    missingForAdvanced: missing,
    uiRule: "Show source, range, point count, continuity score and missing overlay before macro language.",
    proofRule: "Shield, Brain, Browser, PDF preview and PDF download must reuse the same chart payload hash.",
  };
}
