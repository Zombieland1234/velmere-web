import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";

import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { TokenRiskResult } from "./risk-types";

export type CustomerSourceLane = {
  id: "market" | "defillama" | "derivatives" | "security";
  state: "confirmed" | "partial" | "missing" | "not_applicable" | "degraded";
  observedAt?: string;
  confidenceCap: number;
  confirmedFields: string[];
  missingFields: string[];
};

export type CustomerSourceSyncPayload = {
  schemaVersion: "velmere_customer_source_sync_v2";
  mode: "multi_source" | "single_source" | "degraded";
  query: string;
  asset: {
    symbol?: string;
    name?: string;
    assetClass?: string;
    marketId?: string;
  };
  risk: ReturnType<typeof projectCustomerRiskResult>;
  defi: ReturnType<typeof projectCustomerDefiLlama>;
  derivatives: ReturnType<typeof projectCustomerDerivatives>;
  sourceHealth: {
    sourceCount: number;
    quorumState: "ready" | "watch" | "blocked";
    confidenceCap: number;
    lanes: CustomerSourceLane[];
    missingEvidence: string[];
  };
  tierReadiness: {
    basic: "ready" | "degraded";
    pro: "ready" | "degraded" | "blocked";
    advanced: "ready" | "degraded" | "blocked";
    reasons: string[];
  };
  generatedAt: string;
};

function sanitizeCustomerText(value: string, maxLength = 180): string {
  return value
    .replace(ASCII_CONTROL_PATTERN, " ")
    .replace(/\bpass\d{3,5}(?:[_-][a-z0-9_-]+)?\b/gi, "internal evidence control")
    .replace(/\b(provider evidence|source|receipt|persistence|operator|runtime) ledger\b/gi, "evidence record")
    .replace(/(?:[a-zA-Z]:\\|\/)(?:[^\s,;]+[/\\]){1,}[^\s,;]*/g, "[internal path removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function boundedStrings(values: unknown, limit = 12, maxLength = 180): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => sanitizeCustomerText(value, maxLength))
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function projectCustomerRiskResult(result?: TokenRiskResult | null) {
  if (!result) return null;
  return {
    token: {
      marketId: result.token.marketId,
      symbol: result.token.symbol,
      name: result.token.name,
      image: result.token.image,
      rank: result.token.rank,
      chainId: result.token.chainId,
      tokenAddress: result.token.tokenAddress,
      pairAddress: result.token.pairAddress,
      dexId: result.token.dexId,
      url: result.token.url,
      assetClass: result.token.assetClass,
    },
    score: result.score,
    confidence: result.confidence,
    level: result.level,
    badge: result.badge,
    signals: result.signals.slice(0, 16).map((signal) => ({
      id: signal.id,
      severity: signal.severity,
      points: signal.points,
      metrics: signal.metrics,
    })),
    metrics: result.metrics,
    dataQuality: result.dataQuality,
    chart: result.chart?.sevenDay ? { sevenDay: result.chart.sevenDay.slice(-240) } : undefined,
    aiSummary: typeof result.aiSummary === "string" ? sanitizeCustomerText(result.aiSummary, 1_200) : undefined,
    dataSources: boundedStrings(result.dataSources, 12, 100),
    limitations: boundedStrings(result.limitations ?? result.metaModel?.limitations, 12),
    generatedAt: result.generatedAt,
  };
}

export function projectCustomerDefiLlama(defi?: DefiLlamaRiskLane | null) {
  if (!defi) {
    return {
      state: "missing" as const,
      provider: "DefiLlama" as const,
      confidenceCap: 30,
      missingData: ["protocol or chain TVL evidence unavailable"],
    };
  }
  return {
    state: defi.mode,
    provider: defi.provider,
    confidenceCap: clamp(defi.confidenceCap),
    riskLane: defi.riskLane,
    scoreImpact: defi.scoreImpact,
    protocol: defi.matchedProtocol
      ? {
          slug: defi.matchedProtocol.slug,
          name: defi.matchedProtocol.name,
          symbol: defi.matchedProtocol.symbol,
          category: defi.matchedProtocol.category,
          chains: defi.matchedProtocol.chains.slice(0, 8),
          tvlUsd: finite(defi.matchedProtocol.tvlUsd),
          marketCapUsd: finite(defi.matchedProtocol.marketCapUsd),
          change1d: finite(defi.matchedProtocol.change1d),
          change7d: finite(defi.matchedProtocol.change7d),
          change1m: finite(defi.matchedProtocol.change1m),
          matchQuality: defi.matchedProtocol.matchQuality,
        }
      : undefined,
    chainContext: defi.chainContext
      ? {
          chainName: defi.chainContext.chainName,
          chainTvlUsd: finite(defi.chainContext.chainTvlUsd),
          chainChange1d: finite(defi.chainContext.chainChange1d),
          chainChange7d: finite(defi.chainContext.chainChange7d),
        }
      : undefined,
    sourceFacts: boundedStrings(defi.sourceFacts, 8),
    missingData: boundedStrings(defi.missingData, 10),
    generatedAt: defi.generatedAt,
  };
}

export function projectCustomerDerivatives(
  squeeze?: Pass2466DerivativesSqueezeProof | null,
  longShort?: Pass2467LiquidationLongShortProof | null,
) {
  if (!squeeze && !longShort) {
    return {
      state: "not_applicable" as const,
      confirmedSqueezeAllowed: false,
      missingEvidence: [],
    };
  }
  return {
    state: longShort?.state ?? squeeze?.state ?? "blocked",
    score: clamp(longShort?.score ?? squeeze?.score ?? 0),
    direction: squeeze?.direction,
    normalizedPair: longShort?.normalizedPair ?? squeeze?.normalizedPair,
    copyMode: longShort?.copyMode,
    confirmedSqueezeAllowed: longShort?.confirmedSqueezeAllowed === true,
    venues: (squeeze?.venues ?? []).slice(0, 4).map((venue) => ({
      venue: venue.venue,
      label: venue.label,
      state: venue.state,
      observedAt: venue.observedAt,
      openInterestUsd: finite(venue.openInterestUsd),
      fundingRatePercent: finite(venue.fundingRatePercent),
      priceChange24hPercent: finite(venue.priceChange24hPercent),
      volume24hUsd: finite(venue.volume24hUsd),
      missingFields: boundedStrings(venue.missingFields, 8),
    })),
    longShort: (longShort?.longShortSnapshots ?? []).slice(0, 4).map((snapshot) => ({
      venue: snapshot.venue,
      label: snapshot.label,
      state: snapshot.state,
      observedAt: snapshot.observedAt,
      longAccountPercent: finite(snapshot.longAccountPercent),
      shortAccountPercent: finite(snapshot.shortAccountPercent),
      longShortRatio: finite(snapshot.longShortRatio),
      topTraderLongShortRatio: finite(snapshot.topTraderLongShortRatio),
      missingFields: boundedStrings(snapshot.missingFields, 8),
    })),
    missingEvidence: boundedStrings(
      [...(squeeze?.missingForWorldClass ?? []), ...(longShort?.missingForWorldClass ?? [])],
      16,
    ),
    generatedAt: longShort?.generatedAt ?? squeeze?.generatedAt,
  };
}

function lane(args: CustomerSourceLane): CustomerSourceLane {
  return {
    ...args,
    confidenceCap: clamp(args.confidenceCap),
    confirmedFields: boundedStrings(args.confirmedFields, 12, 100),
    missingFields: boundedStrings(args.missingFields, 12, 140),
  };
}

export function buildCustomerSourceSyncPayload(args: {
  query: string;
  result?: TokenRiskResult | null;
  defi?: DefiLlamaRiskLane | null;
  squeeze?: Pass2466DerivativesSqueezeProof | null;
  longShort?: Pass2467LiquidationLongShortProof | null;
}): CustomerSourceSyncPayload {
  const risk = projectCustomerRiskResult(args.result);
  const defi = projectCustomerDefiLlama(args.defi);
  const derivatives = projectCustomerDerivatives(args.squeeze, args.longShort);
  const marketConfirmed = Boolean(risk && risk.dataSources.length > 0);
  const securityConfirmed = Boolean(risk && risk.signals.length > 0 && risk.dataQuality !== "demo");
  const derivativesApplicable = args.result?.token.assetClass === "crypto" || !args.result?.token.assetClass;
  const lanes: CustomerSourceLane[] = [
    lane({
      id: "market",
      state: marketConfirmed ? (risk?.dataQuality === "live" ? "confirmed" : "partial") : "missing",
      observedAt: risk?.generatedAt,
      confidenceCap: risk?.confidence !== undefined ? (risk.confidence <= 1 ? risk.confidence * 100 : risk.confidence) : (marketConfirmed ? 62 : 24),
      confirmedFields: [
        risk?.metrics.currentPrice !== undefined ? "price" : "",
        risk?.metrics.marketCap !== undefined ? "market cap" : "",
        risk?.metrics.volume24h !== undefined ? "24h volume" : "",
        risk?.metrics.priceChange24h !== undefined ? "24h change" : "",
      ],
      missingFields: [
        risk?.metrics.currentPrice === undefined ? "price" : "",
        risk?.metrics.marketCap === undefined ? "market cap" : "",
        risk?.metrics.volume24h === undefined ? "24h volume" : "",
      ],
    }),
    lane({
      id: "defillama",
      state: defi.state === "partial" ? "partial" : defi.state === "degraded" ? "degraded" : "missing",
      observedAt: "generatedAt" in defi ? defi.generatedAt : undefined,
      confidenceCap: defi.confidenceCap,
      confirmedFields: "sourceFacts" in defi ? (defi.sourceFacts ?? []) : [],
      missingFields: defi.missingData,
    }),
    lane({
      id: "derivatives",
      state: !derivativesApplicable
        ? "not_applicable"
        : derivatives.state === "ready"
          ? "confirmed"
          : derivatives.state === "watch"
            ? "partial"
            : derivatives.state === "not_applicable"
              ? "not_applicable"
              : "missing",
      observedAt: derivatives.generatedAt,
      confidenceCap: derivatives.score ?? 0,
      confirmedFields: derivatives.confirmedSqueezeAllowed ? ["cross-venue derivatives confirmation"] : [],
      missingFields: derivatives.missingEvidence,
    }),
    lane({
      id: "security",
      state: securityConfirmed ? "confirmed" : risk ? "partial" : "missing",
      observedAt: risk?.generatedAt,
      confidenceCap: risk?.confidence !== undefined ? (risk.confidence <= 1 ? risk.confidence * 100 : risk.confidence) : 35,
      confirmedFields: risk?.signals.map((signal) => signal.id) ?? [],
      missingFields: risk?.limitations ?? ["risk evidence unavailable"],
    }),
  ];
  const sourceCount = lanes.filter((item) => item.state === "confirmed" || item.state === "partial").length;
  const missingEvidence = boundedStrings(lanes.flatMap((item) => item.missingFields), 20);
  const confidenceCap = clamp(Math.min(...lanes.filter((item) => item.state !== "not_applicable").map((item) => item.confidenceCap)));
  const quorumState = sourceCount >= 3 && missingEvidence.length <= 4 ? "ready" : sourceCount >= 2 ? "watch" : "blocked";
  const basic = risk ? (missingEvidence.length > 8 ? "degraded" : "ready") : "degraded";
  const pro = sourceCount >= 2 ? (quorumState === "ready" ? "ready" : "degraded") : "blocked";
  const advanced = sourceCount >= 3 && confidenceCap >= 60 && missingEvidence.length <= 4 ? "ready" : sourceCount >= 2 ? "degraded" : "blocked";
  return {
    schemaVersion: "velmere_customer_source_sync_v2",
    mode: sourceCount >= 3 ? "multi_source" : sourceCount >= 1 ? "single_source" : "degraded",
    query: args.query,
    asset: {
      symbol: args.result?.token.symbol,
      name: args.result?.token.name,
      assetClass: args.result?.token.assetClass,
      marketId: args.result?.token.marketId,
    },
    risk,
    defi,
    derivatives,
    sourceHealth: {
      sourceCount,
      quorumState,
      confidenceCap,
      lanes,
      missingEvidence,
    },
    tierReadiness: {
      basic,
      pro,
      advanced,
      reasons: missingEvidence.slice(0, 8),
    },
    generatedAt: new Date().toISOString(),
  };
}
