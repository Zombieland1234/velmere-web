import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type { TokenRiskResult } from "./risk-types";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

export type Pass2447ConsensusState = "ready" | "watch" | "blocked";
export type Pass2447ContradictionLevel = "none" | "low" | "medium" | "high";

export type Pass2447ConsensusField = {
  id:
    | "identity"
    | "price"
    | "market_cap"
    | "fdv"
    | "volume_24h"
    | "visible_liquidity"
    | "cex_depth"
    | "tvl"
    | "fees_revenue"
    | "holder_graph"
    | "contract_security"
    | "long_chart";
  label: string;
  tier: "basic" | "pro" | "advanced";
  state: Pass2447ConsensusState;
  primaryProviders: string[];
  missingProviders: string[];
  observedFacts: string[];
  contradictionLevel: Pass2447ContradictionLevel;
  confidenceCap: number;
  riskImpact: "none" | "confidence_cap" | "review_priority" | "advanced_blocker";
  uiRule: string;
};

export type Pass2447RadarItem = {
  id: string;
  label: string;
  state: Pass2447ConsensusState;
  severity: Pass2447ContradictionLevel;
  detail: string;
  requiredBeforeAdvanced: string[];
};

export type Pass2447TierLock = {
  tier: "basic" | "pro" | "advanced";
  state: Pass2447ConsensusState;
  score: number;
  unlockRule: string;
  visibleProof: string[];
  blockedBy: string[];
};

export type Pass2447EvidenceConsensusReconciler = {
  version: "evidence-consensus-reconciler-v1";
  state: Pass2447ConsensusState;
  score: number;
  confidenceCap: number;
  consensusFields: Pass2447ConsensusField[];
  contradictionRadar: Pass2447RadarItem[];
  tierLocks: Pass2447TierLock[];
  synchronizationRules: string[];
  providerPairingMatrix: Array<{
    field: string;
    acceptedPairing: string;
    forbiddenShortcut: string;
  }>;
  angelFirstBlock: string[];
  pdfParityRules: string[];
  nextOps: string[];
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function money(value?: number) {
  if (value === undefined) return "missing";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(Math.abs(value) < 1 ? 6 : 2)}`;
}

function pct(value?: number) {
  if (value === undefined) return "missing";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function hasLane(sourceSync: VelmereSourceSyncPacket, providerId: string) {
  return sourceSync.lanes.find((lane) => lane.id === providerId && ["confirmed", "partial"].includes(lane.state));
}

function laneMissing(sourceSync: VelmereSourceSyncPacket, providerId: string) {
  const lane = sourceSync.lanes.find((item) => item.id === providerId);
  return !lane || ["missing", "degraded"].includes(lane.state);
}

type Pass2447OptionalText = string | false | null | undefined;

type Pass2447ConsensusFieldInput = Omit<
  Pass2447ConsensusField,
  "primaryProviders" | "missingProviders" | "observedFacts"
> & {
  primaryProviders: Pass2447OptionalText[];
  missingProviders: Pass2447OptionalText[];
  observedFacts: Pass2447OptionalText[];
};

function field(args: Pass2447ConsensusFieldInput): Pass2447ConsensusField {
  return {
    ...args,
    primaryProviders: unique(args.primaryProviders).slice(0, 8),
    missingProviders: unique(args.missingProviders).slice(0, 8),
    observedFacts: unique(args.observedFacts).slice(0, 8),
    confidenceCap: clamp(args.confidenceCap),
  };
}

function fieldScore(row: Pass2447ConsensusField) {
  const stateBase = row.state === "ready" ? 100 : row.state === "watch" ? 62 : 28;
  const contradictionPenalty = row.contradictionLevel === "high" ? 34 : row.contradictionLevel === "medium" ? 20 : row.contradictionLevel === "low" ? 8 : 0;
  const tierPenalty = row.tier === "advanced" && row.state === "blocked" ? 16 : 0;
  return clamp(Math.min(row.confidenceCap, stateBase - contradictionPenalty - tierPenalty));
}

function ratio(a?: number, b?: number) {
  if (!a || !b || b <= 0) return undefined;
  return a / b;
}

function contradictionState(level: Pass2447ContradictionLevel): Pass2447ConsensusState {
  if (level === "high") return "blocked";
  if (level === "medium") return "watch";
  return "ready";
}

function severityFromVolumeLiquidity(volume?: number, liquidity?: number): Pass2447ContradictionLevel {
  const r = ratio(volume, liquidity);
  if (r === undefined) return "medium";
  if (r > 25) return "high";
  if (r > 10) return "medium";
  if (r > 4) return "low";
  return "none";
}

function severityFromFdvMc(fdv?: number, marketCap?: number): Pass2447ContradictionLevel {
  const r = ratio(fdv, marketCap);
  if (r === undefined) return "medium";
  if (r > 12) return "high";
  if (r > 5) return "medium";
  if (r > 2.5) return "low";
  return "none";
}

function severityFromTvlMc(tvl?: number, marketCap?: number): Pass2447ContradictionLevel {
  const r = ratio(tvl, marketCap);
  if (tvl === undefined) return "medium";
  if (marketCap === undefined) return "low";
  if (r === undefined || r < 0.01) return "high";
  if (r < 0.05) return "medium";
  if (r < 0.15) return "low";
  return "none";
}

export function buildPass2447EvidenceConsensusReconciler(args: {
  sourceSync: VelmereSourceSyncPacket;
  result?: TokenRiskResult | null;
  defiLlama?: DefiLlamaRiskLane | null;
  historyCount?: number;
}): Pass2447EvidenceConsensusReconciler {
  const { sourceSync, result, defiLlama } = args;
  const metrics = result?.metrics;
  const marketCap = finite(metrics?.marketCap);
  const fdv = finite(metrics?.fdv);
  const volume24h = finite(metrics?.volume24h);
  const liquidityUsd = finite(metrics?.liquidityUsd);
  const tvlUsd = finite(defiLlama?.matchedProtocol?.tvlUsd);
  const hasMarketLane = Boolean(hasLane(sourceSync, "coingecko") || hasLane(sourceSync, "dexscreener"));
  const hasDexLane = Boolean(hasLane(sourceSync, "dexscreener"));
  const hasBinanceLane = Boolean(hasLane(sourceSync, "binance"));
  const hasDefiLlamaLane = Boolean(hasLane(sourceSync, "defillama"));
  const hasSecurityLane = Boolean(hasLane(sourceSync, "goplus"));
  const hasContract = Boolean(result?.token.tokenAddress && result.token.chainId);
  const chartBars = result?.chart?.sevenDay?.length ?? 0;
  const volumeLiquiditySeverity = severityFromVolumeLiquidity(volume24h, liquidityUsd);
  const fdvMcSeverity = severityFromFdvMc(fdv, marketCap);
  const tvlMarketSeverity = severityFromTvlMc(tvlUsd, marketCap);

  const consensusFields = [
    field({
      id: "identity",
      label: "Asset identity / symbol / contract",
      tier: "basic",
      state: result ? "ready" : "blocked",
      primaryProviders: [result?.dataSources?.[0] ?? "market resolver"],
      missingProviders: [!result?.token.image && "logo source", hasContract ? null : "contract scope for token-security lane"],
      observedFacts: [result?.token.symbol && `symbol: ${result.token.symbol}`, result?.token.name && `name: ${result.token.name}`, result?.token.chainId && `chain: ${result.token.chainId}`],
      contradictionLevel: "none",
      confidenceCap: result ? 84 : 22,
      riskImpact: result ? "none" : "advanced_blocker",
      uiRule: "Basic must show identity and source label; if contract is absent, security/holder claims stay locked.",
    }),
    field({
      id: "price",
      label: "Price consensus",
      tier: "basic",
      state: metrics?.currentPrice !== undefined && hasMarketLane ? "ready" : metrics?.currentPrice !== undefined ? "watch" : "blocked",
      primaryProviders: [hasLane(sourceSync, "coingecko") && "CoinGecko", hasLane(sourceSync, "dexscreener") && "DEX Screener", hasBinanceLane && "Binance spot overlay"],
      missingProviders: [!hasMarketLane && "primary market provider", !hasBinanceLane && "second venue/CEX overlay"],
      observedFacts: [metrics?.currentPrice !== undefined && `price: ${money(metrics.currentPrice)}`, metrics?.priceChange24h !== undefined && `24h: ${pct(metrics.priceChange24h)}`],
      contradictionLevel: hasMarketLane && hasBinanceLane ? "none" : "low",
      confidenceCap: metrics?.currentPrice !== undefined ? (hasBinanceLane ? 86 : 72) : 24,
      riskImpact: "confidence_cap",
      uiRule: "Price can be visible in Basic; Pro/Advanced must show provider and timestamp before detailed conclusion.",
    }),
    field({
      id: "market_cap",
      label: "Market cap consensus",
      tier: "basic",
      state: marketCap !== undefined ? (hasMarketLane ? "ready" : "watch") : "blocked",
      primaryProviders: [hasLane(sourceSync, "coingecko") && "CoinGecko", hasLane(sourceSync, "dexscreener") && "DEX Screener"],
      missingProviders: [marketCap === undefined && "market cap", !hasMarketLane && "market cap provider"],
      observedFacts: [marketCap !== undefined && `market cap: ${money(marketCap)}`],
      contradictionLevel: "none",
      confidenceCap: marketCap !== undefined ? 78 : 30,
      riskImpact: "confidence_cap",
      uiRule: "Do not show market-cap as exact truth unless source and update time are visible.",
    }),
    field({
      id: "fdv",
      label: "FDV / market-cap overhang",
      tier: "pro",
      state: fdv !== undefined && marketCap !== undefined ? (fdvMcSeverity === "high" ? "watch" : "ready") : "blocked",
      primaryProviders: [hasLane(sourceSync, "coingecko") && "CoinGecko", hasLane(sourceSync, "dexscreener") && "DEX Screener"],
      missingProviders: [fdv === undefined && "FDV", marketCap === undefined && "market cap", "vesting/unlock calendar"],
      observedFacts: [fdv !== undefined && `FDV: ${money(fdv)}`, marketCap !== undefined && `MC: ${money(marketCap)}`, ratio(fdv, marketCap) !== undefined && `FDV/MC: ${ratio(fdv, marketCap)?.toFixed(2)}x`],
      contradictionLevel: fdvMcSeverity,
      confidenceCap: fdv !== undefined && marketCap !== undefined ? 72 : 38,
      riskImpact: fdvMcSeverity === "high" ? "review_priority" : "confidence_cap",
      uiRule: "FDV overhang belongs in Pro/Advanced; Basic should not drown user with unlock jargon.",
    }),
    field({
      id: "volume_24h",
      label: "24h volume consensus",
      tier: "basic",
      state: volume24h !== undefined ? "ready" : "blocked",
      primaryProviders: [hasLane(sourceSync, "coingecko") && "CoinGecko", hasLane(sourceSync, "dexscreener") && "DEX Screener", hasBinanceLane && "Binance"],
      missingProviders: [volume24h === undefined && "24h volume", !hasBinanceLane && "venue overlay"],
      observedFacts: [volume24h !== undefined && `24h volume: ${money(volume24h)}`],
      contradictionLevel: volumeLiquiditySeverity === "high" ? "medium" : volumeLiquiditySeverity,
      confidenceCap: volume24h !== undefined ? 76 : 28,
      riskImpact: "confidence_cap",
      uiRule: "Volume must be shown with source and cannot be called organic without wash/venue cross-checks.",
    }),
    field({
      id: "visible_liquidity",
      label: "Visible DEX liquidity / exit depth",
      tier: "pro",
      state: liquidityUsd !== undefined ? (hasDexLane ? "ready" : "watch") : "blocked",
      primaryProviders: [hasDexLane && "DEX Screener", "DEX pool event adapter planned"],
      missingProviders: [liquidityUsd === undefined && "visible liquidity", "pool event history", "LP lock/unlock proof"],
      observedFacts: [liquidityUsd !== undefined && `liquidity: ${money(liquidityUsd)}`, volume24h !== undefined && `volume: ${money(volume24h)}`],
      contradictionLevel: volumeLiquiditySeverity,
      confidenceCap: liquidityUsd !== undefined ? 68 : 34,
      riskImpact: volumeLiquiditySeverity === "high" ? "advanced_blocker" : "review_priority",
      uiRule: "Liquidity/exit-depth must remain separate from market cap; missing liquidity blocks strong Advanced copy.",
    }),
    field({
      id: "cex_depth",
      label: "CEX order-book depth overlay",
      tier: "advanced",
      state: hasBinanceLane ? "watch" : "blocked",
      primaryProviders: [hasBinanceLane && "Binance depth", "MEXC/Coinbase/Kraken planned"],
      missingProviders: [!hasBinanceLane && "Binance depth", "second venue depth", "spread/slippage replay"],
      observedFacts: [hasBinanceLane && "CEX pair candidate detected"],
      contradictionLevel: hasBinanceLane ? "low" : "medium",
      confidenceCap: hasBinanceLane ? 58 : 32,
      riskImpact: "advanced_blocker",
      uiRule: "Advanced macro conclusion must expose missing order-book/depth overlays.",
    }),
    field({
      id: "tvl",
      label: "DefiLlama TVL / protocol / chain context",
      tier: "pro",
      state: hasDefiLlamaLane && tvlUsd !== undefined ? "ready" : hasDefiLlamaLane ? "watch" : "blocked",
      primaryProviders: [hasDefiLlamaLane && "DefiLlama"],
      missingProviders: [!hasDefiLlamaLane && "DefiLlama", tvlUsd === undefined && "protocol TVL", "pool-level exit depth"],
      observedFacts: [defiLlama?.matchedProtocol?.name && `protocol: ${defiLlama.matchedProtocol.name}`, tvlUsd !== undefined && `TVL: ${money(tvlUsd)}`],
      contradictionLevel: tvlMarketSeverity,
      confidenceCap: hasDefiLlamaLane ? 70 : 30,
      riskImpact: "confidence_cap",
      uiRule: "DefiLlama is DeFi context only: TVL/protocol/chain, never a safety certificate or price proof.",
    }),
    field({
      id: "fees_revenue",
      label: "Fees / revenue / activity quality",
      tier: "advanced",
      state: sourceSync.pass2446DefiLlama?.lanes.some((lane) => lane.id === "fees_revenue" && lane.status === "ready_to_fetch") ? "watch" : "blocked",
      primaryProviders: ["DefiLlama fees/revenue lane"],
      missingProviders: ["/summary/fees/{protocol}", "daily fees", "daily revenue", "history window"],
      observedFacts: [sourceSync.pass2446DefiLlama?.protocolSlug && `protocol slug: ${sourceSync.pass2446DefiLlama.protocolSlug}`],
      contradictionLevel: "low",
      confidenceCap: 44,
      riskImpact: "advanced_blocker",
      uiRule: "Revenue/activity claims stay locked until fees/revenue fetchers and methodology copy are visible.",
    }),
    field({
      id: "holder_graph",
      label: "Holder graph / concentration / flow",
      tier: "advanced",
      state: hasSecurityLane && metrics?.top10HolderPercent !== undefined ? "watch" : "blocked",
      primaryProviders: [hasSecurityLane && "GoPlus/security lane", "Bitquery holder/transfers planned"],
      missingProviders: [metrics?.top10HolderPercent === undefined && "top holders", "holder labels", "CEX/team/LP classification", "transfer flow history"],
      observedFacts: [metrics?.top10HolderPercent !== undefined && `top10: ${pct(metrics.top10HolderPercent)}`, metrics?.holderCount !== undefined && `holders: ${metrics.holderCount}`],
      contradictionLevel: metrics?.top10HolderPercent !== undefined && metrics.top10HolderPercent > 65 ? "high" : metrics?.top10HolderPercent !== undefined && metrics.top10HolderPercent > 35 ? "medium" : "low",
      confidenceCap: metrics?.top10HolderPercent !== undefined ? 58 : 28,
      riskImpact: "advanced_blocker",
      uiRule: "Do not infer whale/team behavior until holders are labeled; show unclassified clusters instead.",
    }),
    field({
      id: "contract_security",
      label: "Contract security / tax / privileged roles",
      tier: "advanced",
      state: hasContract ? (hasSecurityLane ? "watch" : "blocked") : "blocked",
      primaryProviders: [hasSecurityLane && "GoPlus/security lane", "manual audit queue"],
      missingProviders: [!hasContract && "token contract", laneMissing(sourceSync, "goplus") && "security provider", "source verification", "owner/admin timeline"],
      observedFacts: [metrics?.buyTaxPercentage !== undefined && `buy tax: ${pct(metrics.buyTaxPercentage)}`, metrics?.sellTaxPercentage !== undefined && `sell tax: ${pct(metrics.sellTaxPercentage)}`],
      contradictionLevel: hasContract && !hasSecurityLane ? "medium" : "low",
      confidenceCap: hasContract && hasSecurityLane ? 60 : 30,
      riskImpact: "advanced_blocker",
      uiRule: "Advanced contract claims require token address, chain, security provider and safe wording; no exploit details.",
    }),
    field({
      id: "long_chart",
      label: "Long chart continuity / 2Y / 5Y / MAX",
      tier: "advanced",
      state: chartBars >= 120 || (args.historyCount ?? 0) >= 120 ? "watch" : "blocked",
      primaryProviders: [chartBars ? "risk result sparkline" : null, "CoinGecko market_chart endpoint", "second provider overlay planned"],
      missingProviders: [chartBars < 120 && "2Y/5Y/MAX chart points", "gap annotations", "second provider overlay", "PDF payload checksum"],
      observedFacts: [chartBars ? `${chartBars} local chart points` : null, args.historyCount ? `${args.historyCount} stored risk snapshots` : null],
      contradictionLevel: chartBars >= 120 ? "low" : "medium",
      confidenceCap: chartBars >= 120 ? 62 : 36,
      riskImpact: "advanced_blocker",
      uiRule: "Macro/regime language stays locked until long chart coverage, gaps and source provenance are visible.",
    }),
  ];

  const contradictionRadar: Pass2447RadarItem[] = [
    {
      id: "volume_liquidity_divergence",
      label: "Volume vs visible liquidity divergence",
      state: contradictionState(volumeLiquiditySeverity),
      severity: volumeLiquiditySeverity,
      detail: liquidityUsd !== undefined && volume24h !== undefined
        ? `24h volume ${money(volume24h)} vs visible liquidity ${money(liquidityUsd)}; ratio ${ratio(volume24h, liquidityUsd)?.toFixed(2)}x.`
        : "Volume or liquidity missing; cannot reconcile exit depth.",
      requiredBeforeAdvanced: ["DEX pool liquidity", "volume provider", "pool event history", "slippage/depth simulation"],
    },
    {
      id: "fdv_marketcap_overhang",
      label: "FDV vs market-cap overhang",
      state: contradictionState(fdvMcSeverity),
      severity: fdvMcSeverity,
      detail: fdv !== undefined && marketCap !== undefined ? `FDV ${money(fdv)} vs market cap ${money(marketCap)}.` : "FDV or market cap missing.",
      requiredBeforeAdvanced: ["FDV", "market cap", "supply/unlock schedule", "source timestamp"],
    },
    {
      id: "tvl_market_context_gap",
      label: "TVL vs market context gap",
      state: contradictionState(tvlMarketSeverity),
      severity: tvlMarketSeverity,
      detail: tvlUsd !== undefined ? `DefiLlama TVL ${money(tvlUsd)}${marketCap !== undefined ? ` vs market cap ${money(marketCap)}` : " with market cap missing"}.` : "No matched DefiLlama TVL lane.",
      requiredBeforeAdvanced: ["DefiLlama protocol match", "TVL", "market cap", "methodology note"],
    },
    {
      id: "holder_security_gap",
      label: "Holder/security proof gap",
      state: metrics?.top10HolderPercent !== undefined && hasSecurityLane ? "watch" : "blocked",
      severity: metrics?.top10HolderPercent !== undefined && metrics.top10HolderPercent > 65 ? "high" : metrics?.top10HolderPercent !== undefined ? "medium" : "high",
      detail: metrics?.top10HolderPercent !== undefined ? `Top-10 holder concentration ${pct(metrics.top10HolderPercent)}; labels still required.` : "Holder graph is missing.",
      requiredBeforeAdvanced: ["holder graph", "wallet labels", "contract source snapshot", "privileged role timeline"],
    },
    {
      id: "chart_regime_gap",
      label: "Long chart / regime gap",
      state: chartBars >= 120 ? "watch" : "blocked",
      severity: chartBars >= 120 ? "low" : "medium",
      detail: chartBars ? `${chartBars} attached chart points; long-range endpoint must certify 2Y/5Y/MAX before macro copy.` : "No attached chart points in risk result.",
      requiredBeforeAdvanced: ["2Y/5Y/MAX points", "gap count", "market cap/volume timeline", "second provider overlay"],
    },
  ];

  const consensusScore = clamp(consensusFields.reduce((sum, row) => sum + fieldScore(row), 0) / consensusFields.length);
  const radarPenalty = contradictionRadar.filter((item) => item.state === "blocked").length * 7 + contradictionRadar.filter((item) => item.state === "watch").length * 3;
  const score = clamp(consensusScore - radarPenalty);
  const advancedBlockedFields = consensusFields.filter((row) => row.tier === "advanced" && row.state === "blocked");
  const state: Pass2447ConsensusState = score >= 78 && advancedBlockedFields.length <= 1 ? "ready" : score >= 48 ? "watch" : "blocked";
  const confidenceCap = clamp(Math.min(sourceSync.confidenceCap, score + 8, ...consensusFields.map((row) => row.confidenceCap)));

  const fieldsForTier = (tier: Pass2447TierLock["tier"]) => consensusFields.filter((row) => row.tier === tier);
  const tierLocks: Pass2447TierLock[] = (["basic", "pro", "advanced"] as const).map((tier) => {
    const scoped = fieldsForTier(tier);
    const tierScore = clamp(scoped.reduce((sum, row) => sum + fieldScore(row), 0) / Math.max(scoped.length, 1));
    const blockedBy = scoped
      .filter((row) => row.state !== "ready")
      .flatMap((row) => row.missingProviders.map((provider) => `${row.label}: ${provider}`))
      .slice(0, 10);
    return {
      tier,
      state: tier === "advanced" && blockedBy.length ? "blocked" : tierScore >= 76 ? "ready" : tierScore >= 50 ? "watch" : "blocked",
      score: tierScore,
      unlockRule:
        tier === "basic"
          ? "Basic can answer with short facts, missing-data badge and confidence cap."
          : tier === "pro"
            ? "Pro can explain contradictions only when source/provider labels are visible."
            : "Advanced can be detailed only if every blocker is displayed; missing depth/holders/long-chart proof must lower claim strength.",
      visibleProof: scoped.flatMap((row) => row.observedFacts.map((fact) => `${row.label}: ${fact}`)).slice(0, 12),
      blockedBy,
    };
  });

  return {
    version: "evidence-consensus-reconciler-v1",
    state,
    score,
    confidenceCap,
    consensusFields,
    contradictionRadar,
    tierLocks,
    synchronizationRules: [
      "Each numeric field must name the provider role and missing providers before Angel/PDF can make a conclusion.",
      "DefiLlama context can reconcile TVL, fees, stablecoin, yield and chain lanes; it must not override price, order-book or holder evidence.",
      "CoinGecko/market chart can power 2Y/5Y/MAX price/market-cap/volume history; DEX Screener powers DEX pair liquidity and FDV where pair scope exists.",
      "Binance/CEX depth is venue-specific and must be paired with at least one second venue before strong Advanced microstructure language.",
      "Bitquery-style holder/transfer data is planned as Advanced proof and must be redacted into labels, not exposed as raw wallet accusations.",
      "If preview/PDF/Brain hashes drift, the UI must show source drift and regenerate from canonical sourceSync/chart payload.",
    ],
    providerPairingMatrix: [
      { field: "TVL / protocol", acceptedPairing: "DefiLlama + protocol methodology note", forbiddenShortcut: "Using TVL as proof that a token is safe" },
      { field: "Price / market cap", acceptedPairing: "CoinGecko or DEX Screener + observedAt + second venue overlay", forbiddenShortcut: "Mixing stale price with fresh volume" },
      { field: "DEX liquidity", acceptedPairing: "DEX Screener pair + pool events + slippage/depth replay", forbiddenShortcut: "Treating market cap as available exit liquidity" },
      { field: "CEX depth", acceptedPairing: "Binance depth + second CEX overlay", forbiddenShortcut: "Calling global depth from one venue" },
      { field: "Holder graph", acceptedPairing: "Bitquery/GoPlus + label redaction + concentration metrics", forbiddenShortcut: "Accusing wallets without labels/evidence" },
      { field: "Long chart", acceptedPairing: "CoinGecko market_chart/OHLC + gap annotations + PDF checksum", forbiddenShortcut: "Macro wording from 7d sparkline" },
    ],
    angelFirstBlock: [
      `PASS2447 consensus state: ${state}, score ${score}/100, confidence cap ${confidenceCap}/100.`,
      `Advanced blockers: ${advancedBlockedFields.length ? advancedBlockedFields.map((item) => item.label).join(", ") : "none visible"}.`,
      "Answer order: consensus fields → contradiction radar → missing proof → tier-safe conclusion.",
      "No filler: if source proof is missing, state it plainly and keep the recommendation as verification steps only.",
    ],
    pdfParityRules: [
      "PDF preview and PDF download must render the same consensusFields and contradictionRadar payload.",
      "Every Advanced table row needs provider, observedAt/freshness status, confidence cap and missing providers.",
      "If chart range is 2Y/5Y/MAX, PDF must include point count, gap count, source and checksum.",
      "Translated PL/EN/DE copies must keep the same numbers and provider names.",
    ],
    nextOps: unique([
      "Render PASS2447 consensus strip in Shield modal and VLM Brain right rail.",
      "Add Browser/PDF section: Source Consensus & Contradiction Radar.",
      "Persist sourceSync.pass2447 fingerprint to audit receipt and account messages.",
      "Build Bitquery holder-flow adapter for Advanced only with wallet-label redaction.",
      "Add multi-venue chart overlay for BTC/ETH/SOL: CoinGecko + Binance + optional MEXC/Coinbase/Kraken.",
      "Add DefiLlama fees/revenue cached fetchers and methodology note before revenue claims.",
      "Add operator alert when any field moves from ready to blocked across refreshes.",
      "Add mobile compact view for Basic/Pro/Advanced proof locks.",
    ]),
    generatedAt: new Date().toISOString(),
  };
}
