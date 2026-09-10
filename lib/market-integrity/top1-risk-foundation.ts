export type VelmereRiskGrade =
  | "very_low"
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "critical"
  | "extreme";

export type VelmereSourceFamily =
  | "coingecko"
  | "binance"
  | "mexc"
  | "dexscreener"
  | "defillama"
  | "scanner"
  | "yahoo_stooq"
  | "sec_edgar"
  | "velmere_internal"
  | "manual_review";

export type VelmereTier = "Basic" | "Pro" | "Advanced";

export type SourceRegistryEntry = {
  sourceId: string;
  sourceFamily: VelmereSourceFamily;
  label: string;
  endpoint: string;
  usedFor: string[];
  freshnessTtlSeconds: number;
  qualityScore: number;
  requiredTier: VelmereTier;
  licenseNote: string;
  providerConflictGroup: string;
};

export type SourceReceipt = {
  receiptId: string;
  provider: string;
  sourceFamily: VelmereSourceFamily;
  dataType: string;
  observedAt: string;
  ageSeconds: number;
  freshnessStatus: "fresh" | "watch" | "stale" | "missing";
  qualityScore: number;
  usedInLanes: string[];
  /** PASS4818: only content-bound receipts may count as paid evidence. */
  evidenceState?: "content_bound" | "label_only" | "registry_only" | "internal_estimate";
  payloadDigest?: string | null;
  providerReceiptId?: string | null;
  identityMatched?: boolean;
  commercialEvidenceEligible?: boolean;
  observedLabel?: string | null;
  registrySourceId?: string | null;
  /** PASS4818: normalized upstream root; Yahoo and Stooq remain independent even when they share a product lane. */
  upstreamRoot?: string | null;
  /** PASS6: canonical digest of the complete upstream provider receipt, not only its normalized payload. */
  providerReceiptCanonicalDigest?: string | null;
  /** PASS6: set only after the upstream receipt ID/content integrity check succeeds. */
  providerReceiptIntegrityVerified?: boolean;
  /** PASS6: paid evidence requires a provider-origin timestamp, not a local transport timestamp. */
  timestampProvenance?: "provider" | "transport_received" | "missing" | "invalid" | null;
  /** PASS6: immutable provider field/value hashes retained across the customer-report projection. */
  fieldEvidence?: Array<{
    fieldPath: string;
    capability: string;
    valueHash: string;
  }>;
  /** PASS4993: exact upstream identities retained instead of collapsing to a boolean. */
  targetCanonicalIdentity?: string | null;
  requestedCanonicalIdentity?: string | null;
  resolvedCanonicalIdentity?: string | null;
  resolvedIdentity?: {
    symbol: string | null;
    marketId: string | null;
    address: string | null;
    chainId: string | null;
  } | null;
  /** PASS4993: transport/freshness boundary retained across the projection. */
  receivedAt?: string | null;
  expiresAt?: string | null;
  /** PASS4993: provider product surface and verification strength are security-relevant. */
  providerSurface?: "crypto" | "real_markets" | "contract_audit" | null;
  providerVerification?: "normalized_response" | "raw_response" | "health_only" | null;
  /**
   * PASS4993: HMAC over every projected SourceReceipt property except this
   * envelope. Unsigned/invalid projections cannot authorize paid delivery.
   */
  projection?: {
    schemaVersion: "pass4993_source_receipt_projection_v1";
    algorithm: "HMAC-SHA256";
    keyId: string;
    payloadDigest: string;
    signature: string;
  } | null;
};

export type RiskMethodologySummary = {
  riskScore: number;
  confidenceScore: number;
  grade: VelmereRiskGrade;
  gradeLabel: string;
  sourceFamilyCount: number;
  missingEvidenceCount: number;
  sourceQuorum: "met" | "partial" | "failed";
  confidenceCapReason: string;
};

export const VELMERE_SOURCE_REGISTRY_V1: SourceRegistryEntry[] = [
  {
    sourceId: "coingecko-market-data",
    sourceFamily: "coingecko",
    label: "CoinGecko market data",
    endpoint: "coins/markets, market_chart, ohlc",
    usedFor: ["identity", "price", "market cap", "volume", "token image"],
    freshnessTtlSeconds: 60,
    qualityScore: 84,
    requiredTier: "Basic",
    licenseNote: "Use through approved API terms; cache metadata and show provider label.",
    providerConflictGroup: "spot_quote",
  },
  {
    sourceId: "binance-spot-depth-klines",
    sourceFamily: "binance",
    label: "Binance spot depth / klines",
    endpoint: "api/v3/depth, api/v3/klines, api/v3/ticker/bookTicker",
    usedFor: ["order book", "spread", "OHLCV", "depth", "slippage estimate"],
    freshnessTtlSeconds: 10,
    qualityScore: 91,
    requiredTier: "Pro",
    licenseNote: "Respect exchange API terms, rate limits and symbol support.",
    providerConflictGroup: "cex_microstructure",
  },
  {
    sourceId: "mexc-spot-depth-klines",
    sourceFamily: "mexc",
    label: "MEXC spot depth / klines",
    endpoint: "api/v3/depth, api/v3/klines, ticker endpoints",
    usedFor: ["second venue", "order book", "spread", "OHLCV", "venue conflict"],
    freshnessTtlSeconds: 10,
    qualityScore: 82,
    requiredTier: "Pro",
    licenseNote: "Use only supported symbols; never merge with Binance without source badge.",
    providerConflictGroup: "cex_microstructure",
  },
  {
    sourceId: "dexscreener-pairs",
    sourceFamily: "dexscreener",
    label: "DexScreener pair snapshots",
    endpoint: "latest/dex/search, token-pairs endpoints",
    usedFor: ["DEX liquidity", "pair volume", "pair price", "pool source"],
    freshnessTtlSeconds: 120,
    qualityScore: 76,
    requiredTier: "Basic",
    licenseNote: "Show DEX source and pair route; do not call it CEX depth.",
    providerConflictGroup: "dex_liquidity",
  },
  {
    sourceId: "defillama-protocol-stablecoin",
    sourceFamily: "defillama",
    label: "DeFiLlama protocol / stablecoin lanes",
    endpoint: "protocols, tvl, stablecoins, fees/revenue where available",
    usedFor: ["TVL", "stablecoin supply", "protocol health", "fees", "chain distribution"],
    freshnessTtlSeconds: 1800,
    qualityScore: 86,
    requiredTier: "Pro",
    licenseNote: "Treat as protocol evidence; missing match lowers confidence only.",
    providerConflictGroup: "defi_fundamentals",
  },
  {
    sourceId: "verified-chain-scanner",
    sourceFamily: "scanner",
    label: "Verified chain scanner",
    endpoint: "Etherscan/BscScan/PolygonScan/Solscan/Sourcify adapters",
    usedFor: ["contract source", "permissions", "holders", "deployer", "verified source"],
    freshnessTtlSeconds: 1800,
    qualityScore: 88,
    requiredTier: "Pro",
    licenseNote: "Use scanner terms and never expose secret keys client-side.",
    providerConflictGroup: "contract_evidence",
  },
  {
    sourceId: "real-markets-quote-filings",
    sourceFamily: "yahoo_stooq",
    label: "Real markets quote provider",
    endpoint: "Yahoo/Stooq/approved quote adapters",
    usedFor: ["equity quote", "ETF quote", "FX", "commodities", "quote freshness"],
    freshnessTtlSeconds: 60,
    qualityScore: 74,
    requiredTier: "Basic",
    licenseNote: "Display provider and freshness; add paid provider before institutional claims.",
    providerConflictGroup: "real_markets_quote",
  },
  {
    sourceId: "velmere-deterministic-kernel",
    sourceFamily: "velmere_internal",
    label: "Velmère deterministic risk kernel",
    endpoint: "internal pure calculation / no external fetch",
    usedFor: ["risk lanes", "confidence cap", "missing evidence cap", "tier boundary"],
    freshnessTtlSeconds: 86400,
    qualityScore: 68,
    requiredTier: "Basic",
    licenseNote: "Internal estimates must be labelled as estimates and never as live proof.",
    providerConflictGroup: "risk_calculation",
  },
  {
    sourceId: "advanced-human-review",
    sourceFamily: "manual_review",
    label: "Advanced analysis verification",
    endpoint: "operator notes / signed receipt / private delivery",
    usedFor: ["operator QA approval", "manual conflict resolution", "custom remediation notes"],
    freshnessTtlSeconds: 604800,
    qualityScore: 92,
    requiredTier: "Advanced",
    licenseNote: "Human notes require access control, audit trail and redaction boundary.",
    providerConflictGroup: "manual_review",
  },
];

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function formatDecimalPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${clampPercent(value).toFixed(2)}%`;
}

export function riskGradeFor(value: number): VelmereRiskGrade {
  const score = clampPercent(value);
  if (score >= 90) return "extreme";
  if (score >= 80) return "critical";
  if (score >= 65) return "high";
  if (score >= 50) return "elevated";
  if (score >= 35) return "moderate";
  if (score >= 20) return "low";
  return "very_low";
}

export function riskGradeLabel(grade: VelmereRiskGrade) {
  const labels: Record<VelmereRiskGrade, string> = {
    very_low: "Very Low Risk",
    low: "Low Risk",
    moderate: "Moderate Risk",
    elevated: "Elevated Risk",
    high: "High Risk",
    critical: "Critical Risk",
    extreme: "Extreme / Emergency Risk",
  };
  return labels[grade];
}

export function sourceQuorumFor(sourceFamilyCount: number, missingEvidenceCount: number) {
  if (sourceFamilyCount >= 5 && missingEvidenceCount <= 1) return "met" as const;
  if (sourceFamilyCount >= 2 && missingEvidenceCount <= 4) return "partial" as const;
  return "failed" as const;
}

export function confidenceCapForMissingEvidence(missingEvidenceCount: number, sourceFamilyCount: number) {
  const missingPenalty = Math.max(0, missingEvidenceCount) * 8.5;
  const quorumCredit = Math.min(24, Math.max(0, sourceFamilyCount - 1) * 6);
  return clampPercent(48 + quorumCredit - missingPenalty);
}

export function buildMethodologySummary(args: {
  riskScore: number;
  sourceFamilyCount: number;
  missingEvidenceCount: number;
  providerConflictCount?: number;
}): RiskMethodologySummary {
  const providerConflictCount = Math.max(0, args.providerConflictCount ?? 0);
  const cap = confidenceCapForMissingEvidence(args.missingEvidenceCount + providerConflictCount, args.sourceFamilyCount);
  const grade = riskGradeFor(args.riskScore);
  return {
    riskScore: clampPercent(args.riskScore),
    confidenceScore: cap,
    grade,
    gradeLabel: riskGradeLabel(grade),
    sourceFamilyCount: args.sourceFamilyCount,
    missingEvidenceCount: args.missingEvidenceCount,
    sourceQuorum: sourceQuorumFor(args.sourceFamilyCount, args.missingEvidenceCount + providerConflictCount),
    confidenceCapReason:
      args.missingEvidenceCount > 0
        ? `Confidence capped by ${args.missingEvidenceCount} missing evidence lane(s)${providerConflictCount ? ` and ${providerConflictCount} provider conflict(s)` : ""}.`
        : providerConflictCount
          ? `Confidence capped by ${providerConflictCount} provider conflict(s).`
          : "Confidence supported by current source quorum, still not a guarantee.",
  };
}


export type ChartLifecycleState =
  | "loading_skeleton"
  | "source_bound"
  | "unavailable_skeleton"
  | "stale_source_guarded";

export type ChartLifecycleReceipt = {
  schemaVersion: "pass2809_chart_lifecycle_v1";
  state: ChartLifecycleState;
  sourceLabel: string;
  timeframeLabel: string;
  lastUpdatedLabel: string;
  candleCount: number;
  confidenceScore: number;
  uiRule: string;
  pdfParityRule: string;
};

export type PdfChartRenderDecision = {
  schemaVersion: "pass2810_pdf_chart_lifecycle_enforcement_v1";
  renderMode: "source_chart" | "neutral_skeleton_box";
  acceptedForPdf: boolean;
  reason: string;
  customerVisibleCopy: string;
  requiredRendererRule: string;
};

export function buildChartLifecycleReceipt(args: {
  state: ChartLifecycleState;
  sourceLabel?: string | null;
  timeframeLabel?: string | null;
  lastUpdatedLabel?: string | null;
  candleCount?: number | null;
  confidenceScore?: number | null;
}): ChartLifecycleReceipt {
  const candleCount = Math.max(0, Math.floor(args.candleCount ?? 0));
  const confidenceScore = clampPercent(args.confidenceScore ?? (args.state === "source_bound" ? 58 : 25));
  return {
    schemaVersion: "pass2809_chart_lifecycle_v1",
    state: args.state,
    sourceLabel: args.sourceLabel || "source receipt pending",
    timeframeLabel: args.timeframeLabel || "timeframe pending",
    lastUpdatedLabel: args.lastUpdatedLabel || "last update pending",
    candleCount,
    confidenceScore,
    uiRule:
      args.state === "source_bound"
        ? "Chart may render as live-looking only because source candles are attached."
        : "Chart must render as a neutral grey skeleton until source candles return; no fake sparkline is allowed.",
    pdfParityRule: "The same chart lifecycle receipt must travel into PDF/source receipts before chart claims are rendered.",
  };
}

export function buildPdfChartLifecycleDecision(receipt: ChartLifecycleReceipt): PdfChartRenderDecision {
  const sourceBound = receipt.state === "source_bound" && receipt.candleCount >= 2;
  if (sourceBound) {
    return {
      schemaVersion: "pass2810_pdf_chart_lifecycle_enforcement_v1",
      renderMode: "source_chart",
      acceptedForPdf: true,
      reason: `Source-bound chart accepted with ${receipt.candleCount} candle/point receipt(s) from ${receipt.sourceLabel}.`,
      customerVisibleCopy: `Chart uses ${receipt.sourceLabel} · ${receipt.timeframeLabel} · ${receipt.candleCount} source point(s).`,
      requiredRendererRule: "PDF may render the same chart shape as UI only from this lifecycle receipt and must keep source/timeframe/last-updated visible.",
    };
  }
  return {
    schemaVersion: "pass2810_pdf_chart_lifecycle_enforcement_v1",
    renderMode: "neutral_skeleton_box",
    acceptedForPdf: false,
    reason: `Chart blocked for PDF because lifecycle=${receipt.state}, candles=${receipt.candleCount}.`,
    customerVisibleCopy: "Chart source unavailable for this payload. The report must show a neutral unavailable/skeleton box instead of a fake live chart.",
    requiredRendererRule: "PDF renderer must not draw a live-looking chart unless lifecycle=source_bound and candleCount>=2.",
  };
}

export function buildSourceReceipt(entry: SourceRegistryEntry, observedAt = new Date().toISOString(), ageSeconds = 0): SourceReceipt {
  const freshnessStatus = ageSeconds > entry.freshnessTtlSeconds * 2 ? "stale" : ageSeconds > entry.freshnessTtlSeconds ? "watch" : "fresh";
  return {
    receiptId: `${entry.sourceId}:${observedAt.slice(0, 19)}Z`,
    provider: entry.label,
    sourceFamily: entry.sourceFamily,
    dataType: entry.usedFor.join(" / "),
    observedAt,
    ageSeconds,
    freshnessStatus,
    qualityScore: entry.qualityScore,
    usedInLanes: entry.usedFor,
  };
}

export const CHART_ACCEPTANCE_GATES = [
  "Live-looking charts must use real OHLCV or display a fixture/fallback label.",
  "Every chart shows timeframe, source, last updated timestamp and confidence.",
  "UI chart payload and PDF chart payload must share one evidence fingerprint.",
  "PASS2810: PDF renderer must enforce ChartLifecycleReceipt before drawing any live-looking chart.",
  "PASS2810: lifecycle != source_bound or candleCount < 2 renders a neutral unavailable/skeleton box in PDF and UI.",
  "Order book, depth, spread, slippage and funding/OI lanes must stay provider-labelled.",
  "Mobile drag/pinch must not scroll-lock the full page or hide the close control.",
] as const;

export const BASIC_PRO_ADVANCED_BOUNDARY = [
  {
    tier: "Basic" as const,
    sourceFamilies: "2–4",
    visibleDepth: "identity, simple risk, confidence, top drivers, missing evidence",
    lockedDepth: "no deep order book, no receipt bundle, no manual QA",
  },
  {
    tier: "Pro" as const,
    sourceFamilies: "5–8",
    visibleDepth: "PDF, source receipts, chart payload, conflicts, liquidity and slippage lanes",
    lockedDepth: "manual signoff and private reviewer notes remain locked",
  },
  {
    tier: "Advanced" as const,
    sourceFamilies: "8–12+",
    visibleDepth: "manual QA boundary, operator notes, conflict resolution, private delivery",
    lockedDepth: "never unlock from client-only state or Stripe success URL alone",
  },
] as const;

export type Top1IntelligenceRailInput = {
  id?: string;
  symbol: string;
  name: string;
  family: string;
  priceLabel?: string;
  riskScore: number;
  confidenceScore?: number;
  change1m?: number | null;
  change5m?: number | null;
  change15m?: number | null;
  change1h?: number | null;
  change24h?: number | null;
  volume24h?: number | null;
  liquidityDepthUsd?: number | null;
  sourceFamilyCount?: number;
  missingEvidenceCount?: number;
  providerConflictCount?: number;
  freshnessLabel?: string;
  reason?: string;
};

export type Top1IntelligenceRailItem = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  family: string;
  lane: "top_risk" | "pump_velocity" | "dump_velocity" | "liquidity_stress" | "missing_evidence" | "provider_conflict";
  score: number;
  valueLabel: string;
  riskLabel: string;
  confidenceLabel: string;
  sourceQuorum: "met" | "partial" | "failed";
  missingEvidenceCount: number;
  providerConflictCount: number;
  reason: string;
};

export type Top1IntelligenceRail = {
  generatedAt: string;
  mode: "prepared_runtime_readout";
  disclaimer: string;
  topRisk: Top1IntelligenceRailItem[];
  topPumpVelocity: Top1IntelligenceRailItem[];
  topDumpVelocity: Top1IntelligenceRailItem[];
  topLiquidityStress: Top1IntelligenceRailItem[];
  topMissingEvidence: Top1IntelligenceRailItem[];
  topProviderConflict: Top1IntelligenceRailItem[];
};

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function largestPositiveMove(input: Top1IntelligenceRailInput) {
  return Math.max(
    safeNumber(input.change1m),
    safeNumber(input.change5m),
    safeNumber(input.change15m),
    safeNumber(input.change1h),
    safeNumber(input.change24h),
  );
}

function largestNegativeMove(input: Top1IntelligenceRailInput) {
  return Math.min(
    safeNumber(input.change1m),
    safeNumber(input.change5m),
    safeNumber(input.change15m),
    safeNumber(input.change1h),
    safeNumber(input.change24h),
  );
}

function railReason(input: Top1IntelligenceRailInput, lane: Top1IntelligenceRailItem["lane"]) {
  if (input.reason) return input.reason;
  const missing = safeNumber(input.missingEvidenceCount);
  const conflicts = safeNumber(input.providerConflictCount);
  if (lane === "pump_velocity") return `Fastest observed positive move; source quorum and missing evidence still limit confidence.`;
  if (lane === "dump_velocity") return `Fastest observed negative move; crash lane should be reviewed before any stronger conclusion.`;
  if (lane === "liquidity_stress") return `Risk is elevated relative to visible liquidity/depth; slippage needs a provider receipt.`;
  if (lane === "missing_evidence") return `${missing} missing evidence lane(s) cap confidence and block a false-safe conclusion.`;
  if (lane === "provider_conflict") return `${conflicts} provider conflict(s) require source receipt review.`;
  return `Highest combined risk readout with ${missing} missing lane(s) and ${conflicts} provider conflict(s).`;
}

function makeRailItem(input: Top1IntelligenceRailInput, lane: Top1IntelligenceRailItem["lane"], score: number, index: number, valueLabel: string): Top1IntelligenceRailItem {
  const sourceCount = Math.max(0, Math.floor(input.sourceFamilyCount ?? 0));
  const missingCount = Math.max(0, Math.floor(input.missingEvidenceCount ?? (sourceCount > 0 ? 0 : 1)));
  const summary = buildMethodologySummary({
    riskScore: input.riskScore,
    sourceFamilyCount: sourceCount,
    missingEvidenceCount: missingCount,
    providerConflictCount: input.providerConflictCount ?? 0,
  });
  const explicitConfidence = typeof input.confidenceScore === "number" && Number.isFinite(input.confidenceScore)
    ? clampPercent(input.confidenceScore)
    : null;
  const cappedConfidence = explicitConfidence === null ? null : Math.min(explicitConfidence, summary.confidenceScore);
  return {
    id: input.id ?? `${input.family}:${input.symbol}:${lane}`,
    rank: index + 1,
    symbol: input.symbol,
    name: input.name,
    family: input.family,
    lane,
    score: clampPercent(score),
    valueLabel,
    riskLabel: formatDecimalPercent(input.riskScore),
    confidenceLabel: cappedConfidence === null ? "—" : formatDecimalPercent(cappedConfidence),
    sourceQuorum: summary.sourceQuorum,
    missingEvidenceCount: missingCount,
    providerConflictCount: input.providerConflictCount ?? 0,
    reason: railReason(input, lane),
  };
}

function topByScore(inputs: Top1IntelligenceRailInput[], lane: Top1IntelligenceRailItem["lane"], scoreFor: (input: Top1IntelligenceRailInput) => number, valueFor: (input: Top1IntelligenceRailInput) => string, limit: number) {
  return [...inputs]
    .map((input) => ({ input, score: scoreFor(input) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry, index) => makeRailItem(entry.input, lane, entry.score, index, valueFor(entry.input)));
}

export function buildTop1IntelligenceRail(inputs: Top1IntelligenceRailInput[], limit = 5): Top1IntelligenceRail {
  const normalized = inputs.filter((input) => input.symbol && input.name);
  const sourceBound = normalized.filter((input) => Math.max(0, input.sourceFamilyCount ?? 0) > 0 && Number.isFinite(input.riskScore));
  return {
    generatedAt: new Date().toISOString(),
    mode: "prepared_runtime_readout",
    disclaimer: "Rail values summarize currently visible payloads. They are not buy/sell prompts and require source receipts before paid PDF claims.",
    topRisk: topByScore(sourceBound, "top_risk", (input) => input.riskScore, (input) => formatDecimalPercent(input.riskScore), limit),
    topPumpVelocity: topByScore(normalized, "pump_velocity", largestPositiveMove, (input) => `${largestPositiveMove(input).toFixed(2)}%`, limit),
    topDumpVelocity: topByScore(normalized, "dump_velocity", (input) => Math.abs(largestNegativeMove(input)), (input) => `${largestNegativeMove(input).toFixed(2)}%`, limit),
    topLiquidityStress: topByScore(
      normalized,
      "liquidity_stress",
      (input) => {
        const liquidity = Math.max(1, safeNumber(input.liquidityDepthUsd, safeNumber(input.volume24h, 1)));
        const volumePressure = safeNumber(input.volume24h) / liquidity;
        return input.riskScore * 0.62 + Math.min(32, volumePressure * 9) + safeNumber(input.missingEvidenceCount) * 1.8;
      },
      (input) => input.liquidityDepthUsd ? `$${Math.round(input.liquidityDepthUsd).toLocaleString("en-US")}` : "depth receipt pending",
      limit,
    ),
    topMissingEvidence: topByScore(normalized, "missing_evidence", (input) => safeNumber(input.missingEvidenceCount) * 12 + input.riskScore * 0.15, (input) => `${input.missingEvidenceCount ?? 0} missing`, limit),
    topProviderConflict: topByScore(normalized, "provider_conflict", (input) => safeNumber(input.providerConflictCount) * 18 + input.riskScore * 0.12, (input) => `${input.providerConflictCount ?? 0} conflict(s)`, limit),
  };
}
