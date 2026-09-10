import type { TokenRiskResult } from "./risk-types";
import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type { VelmereSourceSyncLane, VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2444QuorumFieldId =
  | "identity"
  | "price"
  | "market_cap"
  | "volume"
  | "fdv"
  | "dex_liquidity"
  | "cex_depth"
  | "long_history"
  | "tvl"
  | "contract_security"
  | "holder_graph"
  | "source_timestamp";

export type Pass2444QuorumField = {
  id: Pass2444QuorumFieldId;
  label: string;
  state: "verified" | "partial" | "missing" | "not_applicable";
  providers: string[];
  missingProof: string[];
  confidenceCap: number;
  basicVisible: boolean;
  proVisible: boolean;
  advancedVisible: boolean;
  customerCopyBoundary: string;
};

export type Pass2444SourceQuorumGate = {
  version: "pass2444-source-quorum-worldclass-gate-v1";
  score: number;
  state: "ready" | "watch" | "blocked";
  providerAgreement: "strong" | "medium" | "weak" | "unknown";
  fields: Pass2444QuorumField[];
  blockers: string[];
  nextDataFetches: string[];
  tierRules: {
    basic: string[];
    pro: string[];
    advanced: string[];
  };
  riskEngineDirectives: string[];
  innovationCandidates: string[];
  generatedAt: string;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasField(lanes: VelmereSourceSyncLane[], field: string) {
  const needle = field.toLowerCase();
  return lanes.some((lane) =>
    lane.confirmedFields.some((confirmed) => confirmed.toLowerCase().includes(needle)),
  );
}

function laneState(lanes: VelmereSourceSyncLane[], id: string) {
  return lanes.find((lane) => lane.id === id)?.state ?? "missing";
}

function providersFor(lanes: VelmereSourceSyncLane[], field: string) {
  const needle = field.toLowerCase();
  return lanes
    .filter((lane) => lane.confirmedFields.some((confirmed) => confirmed.toLowerCase().includes(needle)))
    .map((lane) => lane.label);
}

function buildField(args: {
  id: Pass2444QuorumFieldId;
  label: string;
  state: Pass2444QuorumField["state"];
  providers: string[];
  missingProof: string[];
  confidenceCap: number;
  basic?: boolean;
  pro?: boolean;
  advanced?: boolean;
  boundary?: string;
}): Pass2444QuorumField {
  return {
    id: args.id,
    label: args.label,
    state: args.state,
    providers: Array.from(new Set(args.providers)).slice(0, 8),
    missingProof: Array.from(new Set(args.missingProof)).slice(0, 8),
    confidenceCap: Math.max(0, Math.min(100, Math.round(args.confidenceCap))),
    basicVisible: args.basic ?? true,
    proVisible: args.pro ?? true,
    advancedVisible: args.advanced ?? true,
    customerCopyBoundary:
      args.boundary ??
      "Visible evidence can support a cautious risk readout only; missing proof must stay visible and cannot be replaced by AI text.",
  };
}

export function buildPass2444SourceQuorumGate(args: {
  sourceSync: Omit<VelmereSourceSyncPacket, "pass2444">;
  result?: TokenRiskResult | null;
  defiLlama?: DefiLlamaRiskLane | null;
  historyCount?: number;
}): Pass2444SourceQuorumGate {
  const lanes = args.sourceSync.lanes;
  const result = args.result;
  const metrics = result?.metrics;
  const isContract = Boolean(result?.token.tokenAddress && result.token.chainId);
  const isCexLike = Boolean(result?.token.symbol && !result.token.tokenAddress);
  const historyCount = args.historyCount ?? 0;

  const fields: Pass2444QuorumField[] = [
    buildField({
      id: "identity",
      label: "Asset identity / logo / canonical symbol",
      state: result?.token.symbol ? "verified" : "missing",
      providers: result?.token.symbol ? ["CoinGecko / DEX Screener resolver"] : [],
      missingProof: result?.token.symbol ? [] : ["canonical id", "symbol", "asset image/logo"],
      confidenceCap: result?.token.symbol ? 92 : 30,
      boundary: "Identity is the first gate; no score should look final until symbol/name/provider mapping is clean.",
    }),
    buildField({
      id: "price",
      label: "Spot price",
      state: finite(metrics?.currentPrice) ? (providersFor(lanes, "price").length >= 1 ? "partial" : "missing") : "missing",
      providers: providersFor(lanes, "price"),
      missingProof: finite(metrics?.currentPrice) ? ["second venue price diff"] : ["spot price", "second venue price diff"],
      confidenceCap: finite(metrics?.currentPrice) ? 78 : 28,
      boundary: "A single spot price is a market snapshot, not a trade signal.",
    }),
    buildField({
      id: "market_cap",
      label: "Market cap / supply context",
      state: finite(metrics?.marketCap) ? "partial" : "missing",
      providers: providersFor(lanes, "market cap"),
      missingProof: finite(metrics?.marketCap) ? ["circulating supply proof", "second market-cap provider"] : ["market cap", "circulating supply proof"],
      confidenceCap: finite(metrics?.marketCap) ? 74 : 32,
    }),
    buildField({
      id: "volume",
      label: "24h volume",
      state: finite(metrics?.volume24h) ? "partial" : "missing",
      providers: providersFor(lanes, "volume"),
      missingProof: finite(metrics?.volume24h) ? ["wash-volume filter", "exchange/pair split"] : ["24h volume", "exchange/pair split"],
      confidenceCap: finite(metrics?.volume24h) ? 72 : 30,
    }),
    buildField({
      id: "fdv",
      label: "FDV / unlock pressure",
      state: finite(metrics?.fdv) ? "partial" : "missing",
      providers: providersFor(lanes, "fdv"),
      missingProof: finite(metrics?.fdv) ? ["vesting/unlock calendar", "team wallet labels"] : ["FDV", "vesting/unlock calendar"],
      confidenceCap: finite(metrics?.fdv) ? 68 : 34,
      basic: false,
      boundary: "FDV gap is an overhang indicator, not proof of a dump.",
    }),
    buildField({
      id: "dex_liquidity",
      label: "DEX liquidity / pair depth",
      state: finite(metrics?.liquidityUsd) ? "partial" : isContract ? "missing" : "not_applicable",
      providers: providersFor(lanes, "liquidity"),
      missingProof: finite(metrics?.liquidityUsd) ? ["pool age", "LP lock proof", "slippage replay"] : isContract ? ["liquidity USD", "pool age", "LP lock proof"] : ["DEX pair scope"],
      confidenceCap: finite(metrics?.liquidityUsd) ? 70 : isContract ? 36 : 72,
      basic: false,
    }),
    buildField({
      id: "cex_depth",
      label: "CEX order-book depth",
      state: isCexLike && laneState(lanes, "binance") !== "missing" ? "partial" : isCexLike ? "missing" : "not_applicable",
      providers: isCexLike && laneState(lanes, "binance") !== "missing" ? ["Binance OHLCV/depth target"] : [],
      missingProof: isCexLike ? ["top-of-book depth", "1%/2% depth", "MEXC/Coinbase/Kraken comparison"] : ["CEX pair mapping"],
      confidenceCap: isCexLike ? 58 : 72,
      basic: false,
      pro: true,
    }),
    buildField({
      id: "long_history",
      label: "Long-range chart continuity",
      state: historyCount >= 365 || hasField(lanes, "sparkline") ? (historyCount >= 365 ? "verified" : "partial") : "missing",
      providers: historyCount >= 365 ? ["risk-ledger timeline", "CoinGecko market_chart target"] : hasField(lanes, "sparkline") ? ["7d sparkline"] : [],
      missingProof: historyCount >= 365 ? [] : ["2Y/5Y price history", "gap report", "macro-volatility regime"],
      confidenceCap: historyCount >= 365 ? 82 : hasField(lanes, "sparkline") ? 54 : 34,
      basic: false,
      boundary: "Long history explains regime; it must never promise future returns.",
    }),
    buildField({
      id: "tvl",
      label: "DefiLlama TVL / protocol lane",
      state: args.defiLlama ? "partial" : "missing",
      providers: args.defiLlama ? ["DefiLlama"] : [],
      missingProof: args.defiLlama?.missingData?.length ? args.defiLlama.missingData : ["matched protocol", "TVL", "chain context"],
      confidenceCap: args.defiLlama?.confidenceCap ?? 30,
      basic: false,
      boundary: "TVL is protocol context, not a safety certificate.",
    }),
    buildField({
      id: "contract_security",
      label: "Contract security lane",
      state: isContract && hasField(lanes, "tax") ? "partial" : isContract ? "missing" : "not_applicable",
      providers: hasField(lanes, "tax") ? ["GoPlus/security lane target"] : [],
      missingProof: isContract ? ["verified source", "privileged roles", "tax/honeypot/blacklist scan", "owner timeline"] : ["token contract address"],
      confidenceCap: isContract ? (hasField(lanes, "tax") ? 58 : 38) : 72,
      basic: false,
      boundary: "Security lane must show safe remediation only and never exploit steps.",
    }),
    buildField({
      id: "holder_graph",
      label: "Holder concentration / wallet labels",
      state: finite(metrics?.top10HolderPercent) || finite(metrics?.holderCount) ? "partial" : isContract ? "missing" : "not_applicable",
      providers: finite(metrics?.top10HolderPercent) || finite(metrics?.holderCount) ? ["holder provider target"] : [],
      missingProof: isContract ? ["top holder clusters", "LP/team/CEX wallet labels", "fresh wallet detection"] : ["contract scope"],
      confidenceCap: finite(metrics?.top10HolderPercent) || finite(metrics?.holderCount) ? 62 : isContract ? 34 : 72,
      basic: false,
    }),
    buildField({
      id: "source_timestamp",
      label: "Field-level observedAt timestamps",
      state: lanes.some((lane) => lane.observedAt) ? "partial" : "missing",
      providers: lanes.filter((lane) => lane.observedAt).map((lane) => lane.label),
      missingProof: ["observedAt per field", "stale-data warning", "provider cooldown ledger"],
      confidenceCap: lanes.some((lane) => lane.observedAt) ? 60 : 42,
      basic: false,
      boundary: "Old data must lower confidence even when the raw number looks precise.",
    }),
  ];

  const verified = fields.filter((field) => field.state === "verified").length;
  const partial = fields.filter((field) => field.state === "partial").length;
  const missing = fields.filter((field) => field.state === "missing").length;
  const applicable = fields.filter((field) => field.state !== "not_applicable").length || 1;
  const score = Math.round(((verified * 1 + partial * 0.55) / applicable) * 100);
  const hardMissing = fields
    .filter((field) => field.state === "missing" && ["price", "market_cap", "volume", "source_timestamp"].includes(field.id))
    .map((field) => field.label);
  const state = hardMissing.length ? "blocked" : score >= 76 ? "ready" : "watch";
  const providerAgreement =
    args.sourceSync.sourceCount >= 4 && missing <= 2
      ? "strong"
      : args.sourceSync.sourceCount >= 3
        ? "medium"
        : args.sourceSync.sourceCount >= 2
          ? "weak"
          : "unknown";

  return {
    version: "pass2444-source-quorum-worldclass-gate-v1",
    score,
    state,
    providerAgreement,
    fields,
    blockers: hardMissing.length
      ? hardMissing.map((label) => `${label} missing/insufficient for world-class output.`)
      : fields
          .filter((field) => field.state === "missing")
          .slice(0, 6)
          .map((field) => `${field.label}: ${field.missingProof.slice(0, 3).join(", ")}`),
    nextDataFetches: [
      "Fetch CoinGecko market_chart for 2Y/5Y/MAX macro context when marketId is known.",
      "Fetch Binance spot klines and order-book depth for CEX symbols with active USDT pairs.",
      "Fetch DEX Screener pair data for tokenAddress/chain scope before liquidity claims.",
      "Fetch DefiLlama protocol + chain TVL for DeFi protocol names; keep it separate from token safety.",
      "Fetch contract security + holder concentration only when a contract address exists.",
      "Persist field-level observedAt and provider errors to a freshness ledger.",
    ],
    tierRules: {
      basic: [
        "Show identity, price, 24h move, market cap/volume if verified, top risk flag, missing data and confidence cap.",
        "No long narrative, no fake certainty, no advanced scenario language.",
      ],
      pro: [
        "Add FDV/MC, liquidity/volume, TVL lane, chart density and provider cadence.",
        "Show what is still missing before any stronger interpretation.",
      ],
      advanced: [
        "Require long-range chart continuity, second venue check, order-book/depth replay, holder graph and source disagreement matrix where applicable.",
        "Advanced can say 'insufficient proof' and must not fill missing lanes with AI prose.",
      ],
    },
    riskEngineDirectives: [
      `Risk confidence cannot exceed ${Math.min(...fields.map((field) => field.confidenceCap)) + 18} until hard missing lanes are resolved.`,
      "Contradictions between TVL, liquidity, volume and price should raise review priority, not become accusations.",
      "Separate market risk, contract risk, venue risk, liquidity risk and evidence quality into different rows.",
      "Every public result should include sourceSync.quorumState + pass2444.score + top missing proof.",
    ],
    innovationCandidates: [
      "Quorum Ribbon: small UI strip showing every provider and field agreement before the chart.",
      "Evidence Lock: Advanced sections stay dimmed until the required source lane is live or explicitly marked missing.",
      "Contradiction Replay: timeline that marks the exact day provider lanes started disagreeing.",
      "World-Class Gate: each module must pass score, missing-proof and no-overclaim checks before launch.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
