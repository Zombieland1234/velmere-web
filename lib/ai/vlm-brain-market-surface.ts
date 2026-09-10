import {
  createVlmKernelEvidenceItem,
  runVlmBrainKernel,
  type VlmBrainKernelDepth,
  type VlmBrainKernelFinding,
  type VlmBrainKernelFreshnessProfile,
  type VlmBrainKernelLocale,
  type VlmBrainKernelOutput,
  type VlmBrainKernelSeverity,
  type VlmBrainKernelSurface,
} from "./vlm-brain-kernel";
import type { UnifiedAuditEvidence } from "@/lib/market-integrity/unified-audit";
import { normalizePass2280RiskScore, detectPass2280AssetPolicy } from "@/lib/ai/audit-output-perfection";

export type VlmMarketKernelSurface = Extract<
  VlmBrainKernelSurface,
  "shield" | "real_markets" | "shield_map" | "browser" | "lens"
>;

export type VlmMarketKernelInput = {
  surface: VlmMarketKernelSurface;
  depth?: VlmBrainKernelDepth;
  locale?: VlmBrainKernelLocale;
  symbol: string;
  name?: string;
  marketType?: string;
  source?: string | null;
  sourceState?: "live" | "partial" | "stale" | "fallback" | "offline" | "unknown" | string | null;
  generatedAt?: string | null;
  price?: number | null;
  change1h?: number | null;
  change24h?: number | null;
  change7d?: number | null;
  change30d?: number | null;
  marketCap?: number | null;
  volume?: number | null;
  liquidity?: number | null;
  riskScore?: number | null;
  confidence?: number | null;
  candleCount?: number | null;
  historyCount?: number | null;
  missingLabels?: string[];
  nextCheck?: string;
  notes?: string[];
  marketSessionProfile?: "always_open" | "us_equity_regular" | "fx_week" | "commodity_week" | "none";
  marketClosureDates?: string[];
  providerLatencyMs?: number | null;
  providerLatencyP50Ms?: number | null;
  providerLatencyP95Ms?: number | null;
  providerLatencyP99Ms?: number | null;
  providerTelemetrySampleCount?: number;
  providerTelemetryUpdatedAt?: string | null;
  providerSlaMs?: number | null;
  providerFailureStreak?: number;
  providerClockSkewStreak?: number;
  providerInvalidTimestampStreak?: number;
  providerSlaBreachStreak?: number;
  providerQuarantined?: boolean;
};

export type VlmMarketKernelPayload = {
  subject: {
    symbol: string;
    name?: string;
    marketType: string;
  };
  market: {
    price: number | null;
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
    change30d: number | null;
    marketCap: number | null;
    volume: number | null;
    liquidity: number | null;
    riskScore: number | null;
  };
  sourceState: string;
  readiness: {
    verifiedCoreFields: number;
    missingCount: number;
    candleCount: number;
    historyCount: number;
  };
};

function clampPercent(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sourceQuality(state: VlmMarketKernelInput["sourceState"]) {
  if (state === "live") return { quality: "strong" as const, freshness: "fresh" as const, confidence: 86 };
  if (state === "partial") return { quality: "medium" as const, freshness: "aging" as const, confidence: 64 };
  if (state === "stale") return { quality: "weak" as const, freshness: "stale" as const, confidence: 38 };
  if (state === "fallback") return { quality: "weak" as const, freshness: "unknown" as const, confidence: 34 };
  if (state === "offline") return { quality: "missing" as const, freshness: "unknown" as const, confidence: 0 };
  return { quality: "weak" as const, freshness: "unknown" as const, confidence: 36 };
}


export function marketFreshnessProfileForTelemetry(input: VlmMarketKernelInput): VlmBrainKernelFreshnessProfile {
  const fingerprint = `${input.surface} ${input.marketType ?? ""} ${input.symbol} ${input.name ?? ""}`.toLowerCase();
  if (input.surface === "shield" || input.surface === "shield_map" || /crypto|token|coin/.test(fingerprint)) return "crypto_market";
  if (/forex|\bfx\b|currency|eurusd|gbpusd|usdjpy/.test(fingerprint)) return "fx_market";
  if (/commodity|gold|silver|oil|brent|wti|metal|energy/.test(fingerprint)) return "commodity_market";
  if (input.surface === "real_markets" || /equity|stock|etf|reit|index/.test(fingerprint)) return "equity_market";
  return "generic";
}

function riskSeverity(score: number | null | undefined): VlmBrainKernelSeverity {
  if (!hasNumber(score)) return "watch";
  if (score >= 82) return "critical";
  if (score >= 65) return "warning";
  if (score >= 35) return "watch";
  return "info";
}

function localizedCopy(locale: VlmBrainKernelLocale) {
  if (locale === "de") return {
    headlineReady: "VLM Kernel: Marktbild bereit",
    headlineReview: "VLM Kernel: Quellenprüfung empfohlen",
    headlineBlocked: "VLM Kernel: Datenlücken begrenzen das Ergebnis",
    summary: "Ein Kernel-Ergebnis verbindet Preis, Bewegung, Quelle, Risiko, fehlende Daten und nächste Prüfung für Shield, Real Markets, PDF und Audit.",
    price: "Preis",
    movement: "Bewegung",
    liquidity: "Volumen / Liquidität",
    risk: "Risikodruck",
    source: "Quellenzustand",
    history: "Analysehistorie",
    next: "Nächste Prüfung",
    missing: "Datenlücke",
  };
  if (locale === "en") return {
    headlineReady: "VLM Kernel: market read is ready",
    headlineReview: "VLM Kernel: source review recommended",
    headlineBlocked: "VLM Kernel: missing data limits the result",
    summary: "One kernel result merges price, movement, source, risk, missing data and next check for Shield, Real Markets, PDF and Audit.",
    price: "Price",
    movement: "Movement",
    liquidity: "Volume / liquidity",
    risk: "Risk pressure",
    source: "Source state",
    history: "Analysis history",
    next: "Next check",
    missing: "Data gap",
  };
  return {
    headlineReady: "VLM Kernel: obraz rynku gotowy",
    headlineReview: "VLM Kernel: zalecana weryfikacja źródeł",
    headlineBlocked: "VLM Kernel: braki danych ograniczają wynik",
    summary: "Jeden wynik kernela łączy cenę, ruch, źródła, ryzyko, braki danych i następny krok dla Shield, Real Markets, PDF oraz audytu.",
    price: "Cena",
    movement: "Ruch rynku",
    liquidity: "Wolumen / płynność",
    risk: "Presja ryzyka",
    source: "Stan źródeł",
    history: "Historia analiz",
    next: "Następna kontrola",
    missing: "Luka danych",
  };
}

function qualityStatus(quality: string): UnifiedAuditEvidence["status"] {
  if (quality === "strong" || quality === "medium") return "verified";
  if (quality === "weak") return "review";
  return "missing";
}

export function analyzeMarketSurfaceWithVlmKernel(input: VlmMarketKernelInput): VlmBrainKernelOutput<VlmMarketKernelPayload> {
  const locale: VlmBrainKernelLocale = input.locale === "de" || input.locale === "en" ? input.locale : "pl";
  const depth: VlmBrainKernelDepth = input.depth === "basic" || input.depth === "pro" || input.depth === "advanced" ? input.depth : "basic";
  const copy = localizedCopy(locale);
  const sourceState = input.sourceState ?? "unknown";
  const source = input.source || (input.surface === "real_markets" ? "real-markets-adapter" : "shield-adapter");
  const missingLabels = Array.from(new Set((input.missingLabels ?? []).filter(Boolean))).slice(0, 16);
  const sourceScore = sourceQuality(sourceState);
  const freshnessProfile = marketFreshnessProfileForTelemetry(input);
  const verifiedCoreFields = [input.price, input.change24h, input.marketCap, input.volume, input.riskScore, input.confidence].filter(hasNumber).length;
  const inferredConfidence = clampPercent(input.confidence, sourceScore.confidence);
  const pass2280Policy = detectPass2280AssetPolicy(`${input.symbol} ${input.name ?? ""} ${input.marketType ?? ""}`);
  const riskScore = hasNumber(input.riskScore)
    ? normalizePass2280RiskScore({
        symbol: `${input.symbol} ${input.name ?? ""}`,
        marketType: input.marketType,
        sourceState: String(sourceState),
        score: clampPercent(input.riskScore, 0),
        missingLabels,
        hasPrimaryQuote: hasNumber(input.price),
      })
    : null;

  const evidence = [
    createVlmKernelEvidenceItem({
      id: "market.price",
      label: copy.price,
      source,
      providerFamily: source,
      independence: "same_provider",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      marketSessionProfile: input.marketSessionProfile,
      marketClosureDates: input.marketClosureDates,
      providerLatencyMs: input.providerLatencyMs,
      providerLatencyP50Ms: input.providerLatencyP50Ms,
      providerLatencyP95Ms: input.providerLatencyP95Ms,
      providerLatencyP99Ms: input.providerLatencyP99Ms,
      providerTelemetrySampleCount: input.providerTelemetrySampleCount,
      providerTelemetryUpdatedAt: input.providerTelemetryUpdatedAt,
      providerSlaMs: input.providerSlaMs,
      providerFailureStreak: input.providerFailureStreak,
      providerClockSkewStreak: input.providerClockSkewStreak,
      providerInvalidTimestampStreak: input.providerInvalidTimestampStreak,
      providerSlaBreachStreak: input.providerSlaBreachStreak,
      providerQuarantined: input.providerQuarantined,
      quality: hasNumber(input.price) ? "strong" : "missing",
      freshness: sourceScore.freshness,
      confidence: hasNumber(input.price) ? Math.min(88, inferredConfidence + 8) : 0,
      value: input.price ?? null,
      observedAt: input.generatedAt ?? null,
      missingReason: hasNumber(input.price) ? undefined : "Price is not available from the current adapter.",
    }),
    createVlmKernelEvidenceItem({
      id: "market.movement",
      label: copy.movement,
      source,
      providerFamily: source,
      independence: "same_provider",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      marketSessionProfile: input.marketSessionProfile,
      marketClosureDates: input.marketClosureDates,
      providerLatencyMs: input.providerLatencyMs,
      providerLatencyP50Ms: input.providerLatencyP50Ms,
      providerLatencyP95Ms: input.providerLatencyP95Ms,
      providerLatencyP99Ms: input.providerLatencyP99Ms,
      providerTelemetrySampleCount: input.providerTelemetrySampleCount,
      providerTelemetryUpdatedAt: input.providerTelemetryUpdatedAt,
      providerSlaMs: input.providerSlaMs,
      providerFailureStreak: input.providerFailureStreak,
      providerClockSkewStreak: input.providerClockSkewStreak,
      providerInvalidTimestampStreak: input.providerInvalidTimestampStreak,
      providerSlaBreachStreak: input.providerSlaBreachStreak,
      providerQuarantined: input.providerQuarantined,
      quality: [input.change1h, input.change24h, input.change7d, input.change30d].some(hasNumber) ? "medium" : "missing",
      freshness: sourceScore.freshness,
      confidence: [input.change1h, input.change24h, input.change7d, input.change30d].some(hasNumber) ? Math.min(82, inferredConfidence + 2) : 0,
      value: input.change24h ?? input.change7d ?? input.change1h ?? input.change30d ?? null,
      observedAt: input.generatedAt ?? null,
      missingReason: [input.change1h, input.change24h, input.change7d, input.change30d].some(hasNumber) ? undefined : "No timeframe movement was resolved.",
    }),
    createVlmKernelEvidenceItem({
      id: "market.volume-liquidity",
      label: copy.liquidity,
      source,
      providerFamily: source,
      independence: "same_provider",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      marketSessionProfile: input.marketSessionProfile,
      marketClosureDates: input.marketClosureDates,
      providerLatencyMs: input.providerLatencyMs,
      providerLatencyP50Ms: input.providerLatencyP50Ms,
      providerLatencyP95Ms: input.providerLatencyP95Ms,
      providerLatencyP99Ms: input.providerLatencyP99Ms,
      providerTelemetrySampleCount: input.providerTelemetrySampleCount,
      providerTelemetryUpdatedAt: input.providerTelemetryUpdatedAt,
      providerSlaMs: input.providerSlaMs,
      providerFailureStreak: input.providerFailureStreak,
      providerClockSkewStreak: input.providerClockSkewStreak,
      providerInvalidTimestampStreak: input.providerInvalidTimestampStreak,
      providerSlaBreachStreak: input.providerSlaBreachStreak,
      providerQuarantined: input.providerQuarantined,
      quality: hasNumber(input.volume) || hasNumber(input.liquidity) ? "medium" : "weak",
      freshness: sourceScore.freshness,
      confidence: hasNumber(input.volume) || hasNumber(input.liquidity) ? Math.min(78, inferredConfidence) : 38,
      value: input.volume ?? input.liquidity ?? null,
    }),
    createVlmKernelEvidenceItem({
      id: "market.risk",
      label: copy.risk,
      source: "vlm-risk-engine",
      providerFamily: "vlm-risk-engine",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      quality: hasNumber(riskScore) ? "medium" : "weak",
      freshness: "fresh",
      confidence: hasNumber(riskScore) ? Math.min(80, inferredConfidence) : 36,
      value: riskScore,
    }),
    createVlmKernelEvidenceItem({
      id: "market.source-state",
      label: copy.source,
      source,
      providerFamily: source,
      independence: "same_provider",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      marketSessionProfile: input.marketSessionProfile,
      marketClosureDates: input.marketClosureDates,
      providerLatencyMs: input.providerLatencyMs,
      providerLatencyP50Ms: input.providerLatencyP50Ms,
      providerLatencyP95Ms: input.providerLatencyP95Ms,
      providerLatencyP99Ms: input.providerLatencyP99Ms,
      providerTelemetrySampleCount: input.providerTelemetrySampleCount,
      providerTelemetryUpdatedAt: input.providerTelemetryUpdatedAt,
      providerSlaMs: input.providerSlaMs,
      providerFailureStreak: input.providerFailureStreak,
      providerClockSkewStreak: input.providerClockSkewStreak,
      providerInvalidTimestampStreak: input.providerInvalidTimestampStreak,
      providerSlaBreachStreak: input.providerSlaBreachStreak,
      providerQuarantined: input.providerQuarantined,
      quality: sourceScore.quality,
      freshness: sourceScore.freshness,
      confidence: sourceScore.confidence,
      value: sourceState,
      observedAt: input.generatedAt ?? null,
      missingReason: sourceScore.quality === "missing" ? "Source adapter is offline or did not return a usable snapshot." : undefined,
    }),
    createVlmKernelEvidenceItem({
      id: "market.history",
      label: copy.history,
      source: "vlm-memory",
      providerFamily: "vlm-memory",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      quality: (input.historyCount ?? 0) >= 2 ? "medium" : "missing",
      freshness: "unknown",
      confidence: (input.historyCount ?? 0) >= 2 ? 64 : 0,
      value: input.historyCount ?? 0,
      missingReason: (input.historyCount ?? 0) >= 2 ? undefined : "Persistent history has fewer than two snapshots.",
    }),
    ...missingLabels.slice(0, 8).map((label, index) => createVlmKernelEvidenceItem({
      id: `market.missing.${index + 1}`,
      label,
      source: "vlm-gap-detector",
      providerFamily: "vlm-gap-detector",
      independence: "derived",
      sourceTimestamp: input.generatedAt ?? null,
      freshnessProfile,
      quality: "missing" as const,
      freshness: "unknown" as const,
      confidence: 0,
      value: null,
      missingReason: label,
    })),
  ];

  const findings: VlmBrainKernelFinding[] = [
    {
      id: "market.kernel-summary",
      title: `${input.symbol}: ${riskScore == null ? "risk pending" : `${riskScore}/100`}`,
      body: input.notes?.join(" ") || copy.summary,
      severity: riskSeverity(riskScore),
      confidence: inferredConfidence,
      evidenceIds: ["market.price", "market.movement", "market.source-state", "market.risk"],
    },
    {
      id: "market.source-boundary",
      title: copy.source,
      body: `${source}: ${sourceState}. Confidence stays capped by source freshness, candle coverage, volume/liquidity and history depth.${pass2280Policy ? ` PASS2280 lane: ${pass2280Policy.kind}; ${pass2280Policy.static35Brake}` : ""}`,
      severity: sourceScore.quality === "missing" ? "warning" : sourceScore.quality === "weak" ? "watch" : "info",
      confidence: sourceScore.confidence,
      evidenceIds: ["market.source-state", "market.history"],
    },
  ];

  const status = sourceScore.quality === "missing" || missingLabels.length >= 5
    ? "blocked"
    : inferredConfidence < 62 || missingLabels.length > 0
      ? "needs_review"
      : "ready";

  return runVlmBrainKernel(
    {
      surface: input.surface,
      depth,
      locale,
      input,
      evidence,
      intent: "market_surface_read",
      memoryKey: `market:${input.surface}:${input.symbol}`,
      generatedAt: input.generatedAt ?? undefined,
    },
    {
      subject: {
        symbol: input.symbol,
        name: input.name,
        marketType: input.marketType ?? pass2280Policy?.kind ?? input.surface,
      },
      market: {
        price: input.price ?? null,
        change1h: input.change1h ?? null,
        change24h: input.change24h ?? null,
        change7d: input.change7d ?? null,
        change30d: input.change30d ?? null,
        marketCap: input.marketCap ?? null,
        volume: input.volume ?? null,
        liquidity: input.liquidity ?? null,
        riskScore,
      },
      sourceState: String(sourceState),
      readiness: {
        verifiedCoreFields,
        missingCount: missingLabels.length,
        candleCount: input.candleCount ?? 0,
        historyCount: input.historyCount ?? 0,
      },
    },
    {
      status,
      confidence: inferredConfidence,
      headline: status === "blocked" ? copy.headlineBlocked : status === "needs_review" ? copy.headlineReview : copy.headlineReady,
      summary: copy.summary,
      findings,
      missingData: missingLabels.map((label, index) => ({
        id: `market.gap.${index + 1}`,
        label,
        reason: label,
        blocksPublish: false,
      })),
      nextActions: [
        {
          id: "market.next-check",
          title: copy.next,
          body: input.nextCheck || "Refresh source adapters, compare second source and recalculate the kernel output.",
          required: status !== "ready",
          owner: "operator",
        },
      ],
    },
  );
}

export function vlmKernelOutputToUnifiedAuditEvidence(
  kernel: VlmBrainKernelOutput,
  options?: { maxItems?: number },
): UnifiedAuditEvidence[] {
  const output: UnifiedAuditEvidence[] = [
    {
      id: "kernel.headline",
      label: "VLM Brain Kernel",
      value: `${kernel.headline} · ${kernel.confidence}%`,
      note: `${kernel.summary} Source count: ${kernel.sourceCount}. Evidence quality: ${kernel.evidenceQuality}.`,
      status: kernel.status === "ready" ? "verified" : kernel.status === "needs_review" ? "review" : "missing",
    },
    {
      id: "kernel.confidence-cap",
      label: "Confidence cap",
      value: `${kernel.confidenceCap}%`,
      note: "Kernel caps confidence by source count, evidence quality, freshness and missing data.",
      status: kernel.confidenceCap >= 62 ? "verified" : kernel.confidenceCap >= 35 ? "review" : "missing",
    },
    ...kernel.findings.slice(0, 5).map((finding) => ({
      id: finding.id,
      label: finding.title,
      value: `${finding.confidence}%`,
      note: finding.body,
      status: finding.severity === "info" ? "verified" : finding.severity === "watch" ? "review" : "missing",
    } satisfies UnifiedAuditEvidence)),
    ...kernel.missingData.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.label,
      value: item.blocksPublish ? "blocked" : "review",
      note: item.reason,
      status: "missing" as const,
    })),
    ...kernel.nextActions.slice(0, 4).map((action) => ({
      id: action.id,
      label: action.title,
      value: action.required ? "required" : "next",
      note: action.body,
      status: action.required ? "review" : "verified",
    } satisfies UnifiedAuditEvidence)),
    ...kernel.evidence.slice(0, 8).map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value === undefined || item.value === null ? "—" : String(item.value),
      note: `${item.source} · ${item.quality} · ${item.freshness} · ${item.confidence}%${item.missingReason ? ` · ${item.missingReason}` : ""}`,
      status: qualityStatus(item.quality),
    } satisfies UnifiedAuditEvidence)),
  ];

  const seen = new Set<string>();
  const deduped = output.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return deduped.slice(0, options?.maxItems ?? 20);
}
