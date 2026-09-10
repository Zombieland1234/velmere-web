export type MarketIntegritySourceLane =
  | "market"
  | "candles"
  | "orderbook"
  | "holders"
  | "contract"
  | "unlocks"
  | "osint";

export type SourceAdapterMode = "live" | "partial" | "fallback" | "missing" | "blocked";
export type SourceAdapterPriority = "P0" | "P1" | "P2";

export type SourceAdapterFreshnessRule = {
  lane: MarketIntegritySourceLane;
  label: string;
  priority: SourceAdapterPriority;
  targetTtlSeconds: number;
  staleAfterSeconds: number;
  productionRequirement: string;
  allowedFallback: string;
  mustNeverClaim: string[];
};

export type SourceAdapterReadinessItem = SourceAdapterFreshnessRule & {
  mode: SourceAdapterMode;
  progress: number;
  missing: string[];
  nextStep: string;
};

export const marketIntegritySourceFreshnessRules: SourceAdapterFreshnessRule[] = [
  {
    lane: "market",
    label: "Market / price / volume",
    priority: "P0",
    targetTtlSeconds: 300,
    staleAfterSeconds: 900,
    productionRequirement: "Price, 24h volume, market cap and rank must expose source id and timestamp.",
    allowedFallback: "Local demo table with visible fallback badge.",
    mustNeverClaim: ["live market if source failed", "guaranteed price accuracy"],
  },
  {
    lane: "candles",
    label: "Candles / OHLCV",
    priority: "P0",
    targetTtlSeconds: 900,
    staleAfterSeconds: 3600,
    productionRequirement: "OHLCV candles must expose exchange/source, interval, receivedAt and fallback state.",
    allowedFallback: "Synthetic/demo candles only with visible fallback label.",
    mustNeverClaim: ["exchange-grade feed if synthetic", "real-time execution data"],
  },
  {
    lane: "orderbook",
    label: "Orderbook / depth / spread",
    priority: "P0",
    targetTtlSeconds: 120,
    staleAfterSeconds: 600,
    productionRequirement: "Depth, spread and slippage estimate require source timestamp and venue/provider id.",
    allowedFallback: "Missing lane with review-required wording.",
    mustNeverClaim: ["exit liquidity verified", "slippage guaranteed"],
  },
  {
    lane: "holders",
    label: "Holders / concentration",
    priority: "P0",
    targetTtlSeconds: 1800,
    staleAfterSeconds: 86400,
    productionRequirement: "Holder clusters, top concentration and unknown clusters require chain adapter snapshot.",
    allowedFallback: "Partial/manual state with missing-data warning.",
    mustNeverClaim: ["ownership fully known", "whales identified as fact without evidence"],
  },
  {
    lane: "contract",
    label: "Contract / permissions",
    priority: "P0",
    targetTtlSeconds: 86400,
    staleAfterSeconds: 604800,
    productionRequirement: "Owner, proxy, mint, pause, blacklist and tax checks require address + chain + analyzer version.",
    allowedFallback: "Address-needed state.",
    mustNeverClaim: ["contract safe", "scam confirmed", "fraud proven"],
  },
  {
    lane: "unlocks",
    label: "Unlocks / vesting",
    priority: "P1",
    targetTtlSeconds: 86400,
    staleAfterSeconds: 604800,
    productionRequirement: "Unlock calendar needs source ledger, tokenomics source, date range and manual review marker.",
    allowedFallback: "Needs OSINT state.",
    mustNeverClaim: ["no unlock risk", "supply schedule fully verified without sources"],
  },
  {
    lane: "osint",
    label: "OSINT / social / KOL disclosure",
    priority: "P1",
    targetTtlSeconds: 21600,
    staleAfterSeconds: 172800,
    productionRequirement: "KOL/social/disclosure checks require source URLs, timestamps and safe paraphrase-only summary.",
    allowedFallback: "Manual review required.",
    mustNeverClaim: ["paid shill proven", "scam confirmed", "criminal intent"],
  },
];

export const marketIntegritySourceReadiness: SourceAdapterReadinessItem[] = [
  {
    ...marketIntegritySourceFreshnessRules[0],
    mode: "partial",
    progress: 68,
    missing: ["provider timestamp normalization", "rate-limit cache", "source id in final export"],
    nextStep: "Normalize market source envelope and cache short-lived responses server-side.",
  },
  {
    ...marketIntegritySourceFreshnessRules[1],
    mode: "partial",
    progress: 64,
    missing: ["exchange id in UI", "fallback/demo banner per interval", "older-candles pagination policy"],
    nextStep: "Attach candle source metadata to the chart footer without debug labels.",
  },
  {
    ...marketIntegritySourceFreshnessRules[2],
    mode: "missing",
    progress: 42,
    missing: ["orderbook adapter", "spread/depth storage snapshot", "slippage estimate boundary"],
    nextStep: "Create server adapter that returns bidDepthUsd, askDepthUsd, spreadPercent, receivedAt and provider.",
  },
  {
    ...marketIntegritySourceFreshnessRules[3],
    mode: "missing",
    progress: 39,
    missing: ["chain holder adapter", "top cluster model", "CEX/custody heuristic disclaimer"],
    nextStep: "Add holder snapshot adapter and keep unknown clusters visible instead of treating them as neutral.",
  },
  {
    ...marketIntegritySourceFreshnessRules[4],
    mode: "missing",
    progress: 46,
    missing: ["contract analyzer", "proxy/owner permissions schema", "chain/address validation"],
    nextStep: "Add contract analyzer envelope with owner/proxy/mint/pause/tax/blacklist fields and review-required copy.",
  },
  {
    ...marketIntegritySourceFreshnessRules[5],
    mode: "blocked",
    progress: 31,
    missing: ["unlock source ledger", "tokenomics URL/source id", "manual verification workflow"],
    nextStep: "Keep unlock lane blocked until source-ledger and manual review workflow exists.",
  },
  {
    ...marketIntegritySourceFreshnessRules[6],
    mode: "blocked",
    progress: 34,
    missing: ["OSINT source queue", "safe paraphrase storage", "reviewer identity"],
    nextStep: "Build OSINT queue with source URLs, timestamps and no defamatory final claims.",
  },
];

export function summarizeMarketIntegritySourceReadiness(items = marketIntegritySourceReadiness) {
  const averageProgress = Math.round(items.reduce((sum, item) => sum + item.progress, 0) / Math.max(items.length, 1));
  const p0Open = items.filter((item) => item.priority === "P0" && item.mode !== "live").length;
  const blockedCount = items.filter((item) => item.mode === "blocked" || item.mode === "missing").length;
  const liveOrPartialCount = items.filter((item) => item.mode === "live" || item.mode === "partial").length;
  return {
    schemaVersion: "velmere-market-integrity-source-readiness-v1",
    generatedAt: new Date().toISOString(),
    averageProgress,
    p0Open,
    blockedCount,
    liveOrPartialCount,
    total: items.length,
    nextCriticalStep:
      items.find((item) => item.priority === "P0" && (item.mode === "missing" || item.mode === "blocked"))?.nextStep ??
      items.find((item) => item.mode !== "live")?.nextStep ??
      "Keep monitoring source freshness and adapter error rates.",
  };
}

export function createMarketIntegritySourceReadinessSnapshot() {
  return {
    ...summarizeMarketIntegritySourceReadiness(),
    mode: "readiness_preview",
    storageWritePerformed: false,
    productionBoundary:
      "Source readiness snapshot only. Do not present missing, fallback or partial lanes as verified live risk evidence.",
    items: marketIntegritySourceReadiness.map((item) => ({
      lane: item.lane,
      label: item.label,
      priority: item.priority,
      mode: item.mode,
      progress: item.progress,
      targetTtlSeconds: item.targetTtlSeconds,
      staleAfterSeconds: item.staleAfterSeconds,
      missing: item.missing,
      nextStep: item.nextStep,
      mustNeverClaim: item.mustNeverClaim,
    })),
  };
}
