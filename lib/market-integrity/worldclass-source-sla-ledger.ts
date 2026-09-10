import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type { TokenRiskResult } from "./risk-types";
import type { VelmereSourceSyncLane, VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2445WorldClassSlaState = "ready" | "watch" | "blocked" | "not_applicable";

export type Pass2445ProviderSla = {
  id: string;
  label: string;
  role: string;
  status: Pass2445WorldClassSlaState;
  liveState: VelmereSourceSyncLane["state"] | "planned";
  maxAgeSeconds: number;
  observedAt?: string;
  fields: string[];
  missing: string[];
  upgradePath: string[];
  confidenceCap: number;
  customerBoundary: string;
};

export type Pass2445FieldSla = {
  id: string;
  label: string;
  tier: "basic" | "pro" | "advanced";
  requiredProviders: string[];
  status: Pass2445WorldClassSlaState;
  confirmedBy: string[];
  missingProviders: string[];
  maxAgeSeconds: number;
  copyRule: string;
};

export type Pass2445WorldClassSourceSlaLedger = {
  version: "worldclass-source-sla-ledger-v1";
  state: "ready" | "watch" | "blocked";
  score: number;
  providerReadiness: Pass2445ProviderSla[];
  fieldSla: Pass2445FieldSla[];
  reconciliationRules: string[];
  longChartRequirements: string[];
  riskEngineLocks: string[];
  angelAnswerLocks: string[];
  nextFetchPlan: string[];
  worldClassBacklog: string[];
  generatedAt: string;
};

function unique<T>(items: Array<T | null | undefined | false>): T[] {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function findLane(lanes: VelmereSourceSyncLane[], id: string) {
  return lanes.find((lane) => lane.id === id);
}

function laneConfirms(lane: VelmereSourceSyncLane | undefined, needles: string[]) {
  if (!lane) return false;
  const confirmed = lane.confirmedFields.join(" ").toLowerCase();
  return needles.some((needle) => confirmed.includes(needle.toLowerCase()));
}

function hasObservedAt(lane?: VelmereSourceSyncLane) {
  return Boolean(lane?.observedAt && !Number.isNaN(Date.parse(lane.observedAt)));
}

function providerStatus(lane?: VelmereSourceSyncLane): Pass2445WorldClassSlaState {
  if (!lane) return "blocked";
  if (lane.state === "confirmed") return hasObservedAt(lane) ? "ready" : "watch";
  if (lane.state === "partial" || lane.state === "degraded") return "watch";
  if (lane.state === "not_applicable") return "not_applicable";
  return "blocked";
}

function buildProvider(args: {
  id: string;
  label: string;
  role: string;
  lane?: VelmereSourceSyncLane;
  maxAgeSeconds: number;
  requiredMissing: string[];
  upgradePath: string[];
  boundary: string;
  planned?: boolean;
}): Pass2445ProviderSla {
  const liveState = args.planned ? "planned" : args.lane?.state ?? "missing";
  const status = args.planned ? "watch" : providerStatus(args.lane);
  const missing = unique([
    ...(args.lane?.missingFields ?? []),
    !hasObservedAt(args.lane) && liveState !== "not_applicable" && "field-level observedAt timestamp",
    ...args.requiredMissing,
  ]).slice(0, 14);
  return {
    id: args.id,
    label: args.label,
    role: args.role,
    status,
    liveState,
    maxAgeSeconds: args.maxAgeSeconds,
    observedAt: args.lane?.observedAt,
    fields: args.lane?.confirmedFields?.slice(0, 14) ?? [],
    missing,
    upgradePath: args.upgradePath.slice(0, 8),
    confidenceCap: args.planned ? 38 : clamp(args.lane?.confidenceCap ?? 24),
    customerBoundary: args.boundary,
  };
}

function buildField(args: {
  id: string;
  label: string;
  tier: Pass2445FieldSla["tier"];
  requiredProviders: string[];
  providerIds: string[];
  confirmedBy: string[];
  maxAgeSeconds: number;
  copyRule: string;
}): Pass2445FieldSla {
  const confirmedSet = new Set(args.confirmedBy);
  const missingProviders = args.providerIds.filter((id) => !confirmedSet.has(id));
  const status: Pass2445WorldClassSlaState = missingProviders.length === 0 ? "ready" : confirmedSet.size ? "watch" : "blocked";
  return {
    id: args.id,
    label: args.label,
    tier: args.tier,
    requiredProviders: args.requiredProviders,
    status,
    confirmedBy: args.confirmedBy,
    missingProviders,
    maxAgeSeconds: args.maxAgeSeconds,
    copyRule: args.copyRule,
  };
}

export function buildPass2445WorldClassSourceSlaLedger(args: {
  sourceSync: Omit<VelmereSourceSyncPacket, "pass2444" | "pass2445">;
  result?: TokenRiskResult | null;
  defiLlama?: DefiLlamaRiskLane | null;
  historyCount?: number;
}): Pass2445WorldClassSourceSlaLedger {
  const lanes = args.sourceSync.lanes;
  const coingecko = findLane(lanes, "coingecko");
  const dexscreener = findLane(lanes, "dexscreener");
  const binance = findLane(lanes, "binance");
  const defillama = findLane(lanes, "defillama");
  const goplus = findLane(lanes, "goplus");
  const isContract = Boolean(args.result?.token?.tokenAddress && args.result?.token?.chainId);
  const isCexLike = Boolean(args.result?.token?.symbol && !args.result?.token?.tokenAddress);

  const providerReadiness: Pass2445ProviderSla[] = [
    buildProvider({
      id: "coingecko",
      label: "CoinGecko market/chart",
      role: "listed-asset price, market cap, volume, logo, long historical market_chart/ohlc when marketId is known",
      lane: coingecko,
      maxAgeSeconds: 180,
      requiredMissing: ["2Y/5Y/MAX chart payload parity", "market-cap and volume timeline", "second-provider price diff overlay"],
      upgradePath: ["persist exact provider observedAt per field", "cache long ranges separately from intraday ranges", "show chart gap badges in Shield/PDF"],
      boundary: "Market aggregation is context; it does not prove safety, liquidity or future price.",
    }),
    buildProvider({
      id: "dexscreener",
      label: "DEX Screener pair/liquidity",
      role: "DEX token pair liquidity, FDV, pair volume, tx pressure and pair identity when token address exists",
      lane: dexscreener,
      maxAgeSeconds: 90,
      requiredMissing: isContract ? ["pair address lock", "pool reserves/slippage replay", "pair creation age"] : ["contract address scope"],
      upgradePath: ["pick canonical pair by liquidity/chain", "store pair route in evidence packet", "flag pair liquidity vs volume contradiction"],
      boundary: "DEX pair liquidity is venue/pair specific. Do not treat one pair as total market depth.",
    }),
    buildProvider({
      id: "binance",
      label: "Binance OHLCV/depth",
      role: "CEX candles, spot depth and venue-specific order-book stress for symbols with active spot pairs",
      lane: binance,
      maxAgeSeconds: 30,
      requiredMissing: isCexLike ? ["order-book depth snapshots", "daily klines 2Y/5Y", "second CEX venue diff"] : ["CEX pair mapping"],
      upgradePath: ["attach symbol-to-venue resolver", "add depth notional buckets", "compare Binance vs Coinbase/Kraken/MEXC when available"],
      boundary: "CEX depth is venue-specific and must be separated from DEX liquidity.",
    }),
    buildProvider({
      id: "defillama",
      label: "DefiLlama protocol/TVL",
      role: "protocol TVL, chain context, fees/revenue/yields backlog and TVL change lane for DeFi protocols",
      lane: defillama,
      maxAgeSeconds: 300,
      requiredMissing: ["pool-level exit depth", "TVL methodology note", "fees/revenue lane", "stablecoin/bridge exposure lane"],
      upgradePath: ["map token name to protocol slug carefully", "never convert unresolved TVL into score boost", "attach TVL vs market-cap contradiction badge"],
      boundary: args.defiLlama?.evidenceBoundary ?? "TVL is a context lane, not a safety certificate.",
    }),
    buildProvider({
      id: "goplus",
      label: "Token security scanner",
      role: "contract taxes, blacklist/mint/pause/proxy hints and token-security evidence for contract scoped assets",
      lane: goplus,
      maxAgeSeconds: 600,
      requiredMissing: isContract ? ["source verified snapshot", "privileged role timeline", "honeypot simulation proof"] : ["contract address scope"],
      upgradePath: ["separate warning from accusation", "store contract fingerprint", "show missing scanner as confidence cap"],
      boundary: "Scanner output is triage, not an accusation or guarantee.",
    }),
    buildProvider({
      id: "bitquery",
      label: "Bitquery / holder-flow graph",
      role: "planned on-chain holder clusters, transfers, DEX trades, liquidity pools and slippage data across chains",
      maxAgeSeconds: 300,
      requiredMissing: ["API key/provider contract", "holder Gini/Nakamoto index", "CEX/team/LP wallet labels", "whale flow timeline"],
      upgradePath: ["add optional BITQUERY_API_KEY env", "create holder-flow adapter", "feed holder graph into Advanced only"],
      boundary: "Holder-flow data must be labeled and redacted safely; unlabeled wallets cannot be called malicious.",
      planned: true,
    }),
  ];

  const fieldSla: Pass2445FieldSla[] = [
    buildField({
      id: "basic_price_identity",
      label: "Basic identity + price + 24h move",
      tier: "basic",
      providerIds: ["coingecko"],
      requiredProviders: ["CoinGecko or DEX Screener"],
      confirmedBy: unique([
        laneConfirms(coingecko, ["price", "logo", "24h"]) && "coingecko",
        laneConfirms(dexscreener, ["price", "24h", "fdv"]) && "dexscreener",
      ]),
      maxAgeSeconds: 180,
      copyRule: "Basic can be short and useful only when identity and live market fields are visible with missing-data copy.",
    }),
    buildField({
      id: "pro_liquidity_tvl_context",
      label: "Pro liquidity + TVL context",
      tier: "pro",
      providerIds: isContract ? ["dexscreener", "defillama"] : ["defillama"],
      requiredProviders: isContract ? ["DEX Screener", "DefiLlama when protocol-scope"] : ["DefiLlama when protocol-scope"],
      confirmedBy: unique([
        laneConfirms(dexscreener, ["liquidity", "fdv", "volume"]) && "dexscreener",
        laneConfirms(defillama, ["protocol tvl", "chain", "category"]) && "defillama",
      ]),
      maxAgeSeconds: 300,
      copyRule: "Pro must show liquidity/TVL as separate lanes and label unresolved lanes instead of writing filler.",
    }),
    buildField({
      id: "advanced_long_chart",
      label: "Advanced 2Y/5Y/MAX chart continuity",
      tier: "advanced",
      providerIds: ["coingecko", "binance"],
      requiredProviders: ["CoinGecko market_chart", "Binance klines or second venue overlay"],
      confirmedBy: unique([
        (args.historyCount ?? 0) >= 240 && "coingecko",
        laneConfirms(binance, ["kline", "candles", "depth"]) && "binance",
      ]),
      maxAgeSeconds: 86_400,
      copyRule: "Advanced chart conclusions require long continuity, gap badges and second-provider overlay before stronger wording.",
    }),
    buildField({
      id: "advanced_exit_depth",
      label: "Advanced exit-depth stress",
      tier: "advanced",
      providerIds: isContract ? ["dexscreener", "bitquery"] : ["binance"],
      requiredProviders: isContract ? ["DEX pair liquidity", "on-chain slippage/liquidity pool history"] : ["CEX order-book depth"],
      confirmedBy: unique([
        laneConfirms(dexscreener, ["liquidity"]) && "dexscreener",
        laneConfirms(binance, ["depth", "order-book"]) && "binance",
      ]),
      maxAgeSeconds: 60,
      copyRule: "No exit-depth claim without actual depth/slippage evidence; missing depth becomes visible blocker.",
    }),
    buildField({
      id: "advanced_holder_security",
      label: "Advanced holder + contract security",
      tier: "advanced",
      providerIds: isContract ? ["goplus", "bitquery"] : [],
      requiredProviders: isContract ? ["security scanner", "holder-flow graph"] : ["not applicable until contract scope"],
      confirmedBy: unique([
        laneConfirms(goplus, ["tax", "honeypot", "mint", "admin"]) && "goplus",
      ]),
      maxAgeSeconds: 600,
      copyRule: "Advanced security must separate contract scanner, holders, wallet labels and missing proof; no accusations.",
    }),
  ];

  const ready = fieldSla.filter((field) => field.status === "ready").length;
  const watch = fieldSla.filter((field) => field.status === "watch").length;
  const blocked = fieldSla.filter((field) => field.status === "blocked").length;
  const providerScore = providerReadiness.reduce((sum, provider) => sum + (provider.status === "ready" ? 1 : provider.status === "watch" ? 0.55 : provider.status === "not_applicable" ? 0.75 : 0.2), 0) / providerReadiness.length;
  const fieldScore = (ready + watch * 0.55 + Math.max(0, fieldSla.length - ready - watch - blocked) * 0.3) / Math.max(fieldSla.length, 1);
  const score = clamp((providerScore * 0.45 + fieldScore * 0.55) * 100);
  const state = blocked >= 3 || score < 45 ? "blocked" : score >= 76 && blocked === 0 ? "ready" : "watch";

  return {
    version: "worldclass-source-sla-ledger-v1",
    state,
    score,
    providerReadiness,
    fieldSla,
    reconciliationRules: [
      "Every numeric claim needs provider id, observedAt, cadence and stale-data fallback.",
      "When CoinGecko and DEX Screener disagree, display disagreement and lower confidence instead of averaging silently.",
      "Keep TVL, liquidity, market cap, CEX depth and holder concentration as separate risk lanes.",
      "Do not let AI text upgrade an unresolved provider lane; unresolved proof must stay visible in Basic/Pro/Advanced and PDF.",
      "Use long history for regime context only; never present it as price prediction.",
    ],
    longChartRequirements: [
      "1Y/2Y/5Y/MAX must include point count, span, gap count, volume coverage and market-cap coverage.",
      "Advanced chart should show provider overlay/diff when Binance or another venue is available.",
      "Cache long ranges separately from intraday data to avoid UI lag and provider overuse.",
      "PDF and modal must use the same chart payload checksum to avoid preview/download drift.",
    ],
    riskEngineLocks: [
      "Risk score can be high, but confidence cannot exceed the weakest required lane plus calibration buffer.",
      "Missing holder/depth/security lanes should increase data uncertainty, not be hidden behind prose.",
      "Contradictions raise review priority; they are not proof of wrongdoing.",
      "Stablecoin, DeFi protocol, DEX token, CEX-listed coin and real-market equity need different scoring weights.",
    ],
    angelAnswerLocks: [
      "Angel must start market answers with source state, confidence cap and missing proof before narrative.",
      "Angel must say when DefiLlama is unresolved or only protocol context.",
      "Angel must not answer Advanced-style if SLA ledger says blocked.",
      "Angel must preserve PL/EN/DE locale and avoid filler when proof is missing.",
    ],
    nextFetchPlan: [
      "Add optional BITQUERY_API_KEY and holder-flow adapter for Advanced holder graph.",
      "Add second CEX venue adapter after Binance for cross-venue chart/depth diff.",
      "Add DefiLlama fees/revenue/stablecoin/bridge lanes for protocol risk context.",
      "Persist source SLA ledger to risk receipt so PDF, Browser, Shield and Angel read one truth packet.",
      "Expose SLA blockers in UI next to Basic/Pro/Advanced so value difference is obvious.",
    ],
    worldClassBacklog: [
      "Provider Observability Board: live/degraded/missing per provider with last success/failure.",
      "World-Class Confidence Waterfall: score, confidence, data uncertainty and missing proof in one compact strip.",
      "Chart Payload Fingerprint: identical checksum across modal, PDF preview and download.",
      "Source Diff Replay: show the exact provider disagreement window over time.",
      "Advanced Proof Lock: unlock advanced prose only when source SLA passes or explicitly shows why it cannot pass.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
