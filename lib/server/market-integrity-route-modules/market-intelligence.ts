import { publicApiError } from "@/lib/security/api-error-envelope";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { analyzeTokenRisk } from "@/lib/market-integrity/risk-engine";
import type { TokenRiskInput, VelmereMarketAssetClass } from "@/lib/market-integrity/risk-types";
import { buildCanonicalEvidencePacket, projectCanonicalEvidencePacketForTier, verifyCanonicalEvidencePacketIntegrity } from "@/lib/market-integrity/canonical-evidence-packet";
import { buildPass4825RuntimeCanonicalFieldPacket, type Pass4825RuntimeFieldValue } from "@/lib/reporting/runtime-canonical-field-adapter";
import { appendProviderEvidencePacket } from "@/lib/market-integrity/provider-evidence-packet-ledger";
import { buildMarketImpactAnalysis, verifyMarketImpactResultIntegrity } from "@/lib/market-integrity/market-impact-engine";
import {
  verifyCustomerOwnedMarketEvidenceAuthority,
  type CustomerOwnedMarketEvidenceAuthorization,
} from "@/lib/market-integrity/customer-owned-market-evidence-authority";
import { normalizeMarketImpactSnapshots } from "@/lib/market-integrity/market-impact-input-validation";
import { buildWhaleWatchCustomerTruth } from "@/lib/market-integrity/whale-watch-customer-truth";
import { buildRiskIndicatorProjection } from "@/lib/market-integrity/risk-indicator-projection";
import { buildRiskIndicatorCustomerTruth } from "@/lib/market-integrity/risk-indicator-customer-truth";
import { buildMarketImpactTierPacket, buildWhaleWatchTierPacket } from "@/lib/market-integrity/market-impact-whale-tier-runtime";
import type { MarketImpactPolicy, MarketImpactVenueSnapshot } from "@/lib/market-integrity/market-impact-types";
import { buildWhaleWatchAnalysis, verifyWhaleWatchResultIntegrity } from "@/lib/market-integrity/whale-watch-engine";
import { buildMarketImpactDecisionSupport, buildWhaleWatchDecisionSupport } from "@/lib/intelligence/vlm-standalone-decision-support";
import type {
  WhaleCapabilityReceipt,
  WhaleHolderSnapshot,
  WhaleTransferEvent,
} from "@/lib/market-integrity/whale-watch-types";
import type { MarketAssetBindingArtifact } from "@/lib/market-integrity/market-asset-binding";
import type { WalletLabelRegistryArtifact } from "@/lib/market-integrity/wallet-label-registry";
import {
  fetchServerOwnedMarketImpactEvidence,
  fetchServerOwnedWhaleEvidence,
  PASS4798_SERVER_PROVIDER_RUNTIME_ID,
  verifyServerOwnedMarketEvidenceIntegrity,
  verifyServerOwnedWhaleEvidenceIntegrity,
  type EvidenceMode,
  type ServerOwnedMarketEvidence,
  type ServerOwnedWhaleEvidence,
} from "@/lib/market-integrity/server-owned-market-intelligence-providers";
import { requireVlmTierAccess } from "@/lib/market-integrity/vlm-route-analysis";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  rejectOversizedUrl,
  securityJson,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  authorizeTrustedProviderIngress,
  type TrustedProviderIngressAuthorization,
} from "@/lib/security/trusted-provider-ingress-auth";
import {
  buildMarketImpactDeliveryPreflight,
  projectMarketImpactDelivery,
} from "@/lib/market-integrity/market-impact-delivery-policy";
import { buildCanonicalWhaleEvidence } from "@/lib/market-integrity/canonical-whale-evidence";

const PASS4798_MARKET_INTELLIGENCE_API_ID = "pass4798-market-intelligence-orchestrator-v1";
const MAX_BODY_BYTES = 900 * 1024;

type IntelligenceDepth = "basic" | "pro" | "advanced";
type IntelligenceSurface = "shield" | "shield_pro" | "real_markets" | "shield_map" | "lens" | "angel";
type MarketIntelligenceEvidenceMode = EvidenceMode | "customer_owned_attested";

export type MarketIntelligencePublicationPreflight = {
  authorized: boolean;
  mode: "withheld" | "live";
  evidenceState: "withheld" | "verified";
  scorePublished: boolean;
  blockers: string[];
};

/**
 * No signed PASS4993 field-publication authority is wired to this handler.
 * Provider transport success, integrity checks and locally derived packets do
 * not authorize customer-visible numbers. Keep the preflight independent of
 * environment flags so an operator cannot promote it with configuration alone.
 */
export function evaluateMarketIntelligencePublicationPreflight(): MarketIntelligencePublicationPreflight {
  return {
    authorized: false,
    mode: "withheld",
    evidenceState: "withheld",
    scorePublished: false,
    blockers: [
      "pass4993_signed_field_projection_not_attached",
      "commercial_field_quorum_not_verified",
      "provider_rights_runtime_authority_not_verified",
    ],
  };
}

type MarketIntelligencePayload = {
  assetKey?: unknown;
  depth?: unknown;
  locale?: unknown;
  surface?: unknown;
  evidenceMode?: unknown;
  marketAssetBinding?: unknown;
  walletLabelArtifacts?: unknown;
  marketImpactSnapshots?: unknown;
  marketImpactPolicy?: unknown;
  marketEvidenceAuthority?: unknown;
  whale?: unknown;
  riskInput?: unknown;
};

type WhalePayload = {
  totalSupply?: unknown;
  priceUsd?: unknown;
  holders?: unknown;
  transfers?: unknown;
  capabilityReceipts?: unknown;
  policy?: unknown;
};

function cleanAssetKey(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120) : "";
}

function depth(value: unknown): IntelligenceDepth | null {
  if (value === undefined) return "basic";
  return value === "basic" || value === "pro" || value === "advanced" ? value : null;
}

function locale(value: unknown): "pl" | "en" | "de" | null {
  if (value === undefined) return "en";
  return value === "pl" || value === "en" || value === "de" ? value : null;
}

function surface(value: unknown): IntelligenceSurface | null {
  if (value === undefined) return "shield";
  return value === "shield" || value === "shield_pro" || value === "real_markets" || value === "shield_map" || value === "lens" || value === "angel" ? value : null;
}

function evidenceMode(value: unknown): MarketIntelligenceEvidenceMode | null {
  if (value === undefined) return "server_owned";
  return value === "server_owned" || value === "trusted_ingress" || value === "customer_owned_attested"
    ? value
    : null;
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function validateWhalePayload(value: unknown): {
  totalSupply: number;
  priceUsd: number;
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const whale = value as WhalePayload;
  const totalSupply = finitePositive(whale.totalSupply);
  const priceUsd = finitePositive(whale.priceUsd);
  if (!totalSupply || !priceUsd) return null;
  if (!Array.isArray(whale.holders) || whale.holders.length < 1 || whale.holders.length > 2_000) return null;
  if (!Array.isArray(whale.transfers) || whale.transfers.length > 5_000) return null;
  if (!Array.isArray(whale.capabilityReceipts) || whale.capabilityReceipts.length < 1 || whale.capabilityReceipts.length > 24) return null;
  return {
    totalSupply,
    priceUsd,
    holders: whale.holders as WhaleHolderSnapshot[],
    transfers: whale.transfers as WhaleTransferEvent[],
    capabilityReceipts: whale.capabilityReceipts as WhaleCapabilityReceipt[],
  };
}

function validateBindingArtifact(value: unknown): MarketAssetBindingArtifact | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as MarketAssetBindingArtifact : null;
}

function validateWalletLabelArtifacts(value: unknown): WalletLabelRegistryArtifact[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 250) return undefined;
  if (value.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return undefined;
  return value as WalletLabelRegistryArtifact[];
}

const RISK_NUMBER_FIELDS = [
  "currentPrice", "athPrice", "marketCap", "fdv", "liquidityUsd", "volume24h", "averageVolume7d",
  "priceChange1h", "priceChange6h", "priceChange24h", "priceChange7d", "priceChange14d", "priceChange30d",
  "buys24h", "sells24h", "top10HolderPercent", "holderCount", "orderBookDepthDropPercent",
  "simulatedSlippage10k", "bidAskImbalancePercent", "circulatingSupply", "totalSupply", "maxSupply",
  "buyTaxPercentage", "sellTaxPercentage", "providerHealthScore", "sourceDivergenceBps", "freshnessSeconds",
] as const;
const RISK_BOOLEAN_FIELDS = [
  "hadRebrandAfterCrash", "abnormalExchangeDeposits", "suspiciousContractPrivileges", "isHoneypot",
  "canMintNewTokens", "canPauseTrading", "canBlacklist",
] as const;
const ASSET_CLASSES = new Set<VelmereMarketAssetClass>([
  "crypto", "stock", "etf", "index", "fx", "commodity", "real_estate", "exchange_equity", "unknown",
]);

function validatedRiskInput(value: unknown, assetKey: string): TokenRiskInput | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const symbol = typeof row.symbol === "string" ? cleanAssetKey(row.symbol) : assetKey;
  const name = typeof row.name === "string" ? row.name.replace(/[<>\r\n]/g, " ").trim().slice(0, 120) : symbol;
  if (!symbol || !name) return null;
  const output: TokenRiskInput = { symbol, name };
  for (const field of RISK_NUMBER_FIELDS) {
    const candidate = row[field];
    if (candidate !== undefined) {
      if (typeof candidate !== "number" || !Number.isFinite(candidate)) return null;
      output[field] = candidate as never;
    }
  }
  for (const field of RISK_BOOLEAN_FIELDS) {
    const candidate = row[field];
    if (candidate !== undefined) {
      if (typeof candidate !== "boolean") return null;
      output[field] = candidate as never;
    }
  }
  if (row.assetClass !== undefined) {
    if (typeof row.assetClass !== "string" || !ASSET_CLASSES.has(row.assetClass as VelmereMarketAssetClass)) return null;
    output.assetClass = row.assetClass as VelmereMarketAssetClass;
  }
  if (row.dataSources !== undefined) {
    if (!Array.isArray(row.dataSources) || row.dataSources.length > 24 || row.dataSources.some((item) => typeof item !== "string")) return null;
    output.dataSources = Array.from(new Set((row.dataSources as string[]).map((item) => item.trim().slice(0, 120)).filter(Boolean)));
  }
  return output;
}

function enrichRiskInputFromIntelligence(
  assetKey: string,
  provided: TokenRiskInput | null,
  marketImpact: ReturnType<typeof buildMarketImpactAnalysis>,
  whaleWatch: ReturnType<typeof buildWhaleWatchAnalysis> | null,
): TokenRiskInput {
  const depthBand = marketImpact.depthBands.find((row) => row.bandBps === 100) ?? marketImpact.depthBands.at(-1);
  const sell10k = marketImpact.executions.find((row) => row.side === "sell" && row.requestedNotionalUsd === 10_000);
  const totalDepth = depthBand ? depthBand.bidDepthUsd + depthBand.askDepthUsd : undefined;
  const imbalance = depthBand && depthBand.bidDepthUsd + depthBand.askDepthUsd > 0
    ? ((depthBand.bidDepthUsd - depthBand.askDepthUsd) / (depthBand.bidDepthUsd + depthBand.askDepthUsd)) * 100
    : undefined;
  return {
    symbol: provided?.symbol ?? assetKey,
    name: provided?.name ?? assetKey,
    assetClass: provided?.assetClass ?? "crypto",
    ...provided,
    currentPrice: provided?.currentPrice ?? marketImpact.referenceMidPrice ?? undefined,
    liquidityUsd: provided?.liquidityUsd ?? totalDepth,
    simulatedSlippage10k: provided?.simulatedSlippage10k ?? (sell10k?.impactBps == null ? undefined : Math.abs(sell10k.impactBps) / 100),
    bidAskImbalancePercent: provided?.bidAskImbalancePercent ?? imbalance,
    top10HolderPercent: provided?.top10HolderPercent ?? whaleWatch?.adjustedConcentration.top10Percent,
    holderCount: provided?.holderCount ?? whaleWatch?.holderCount,
    dataSources: Array.from(new Set([
      ...(provided?.dataSources ?? []),
      ...marketImpact.providerFamilies,
      ...(whaleWatch?.providerFamilies ?? []),
    ])),
  };
}

function basicMarketImpactView(result: ReturnType<typeof buildMarketImpactAnalysis>) {
  const representativeExecutions = result.executions.filter((row) => row.requestedNotionalUsd === 10_000 || row.requestedNotionalUsd === 50_000);
  return {
    schemaVersion: result.schemaVersion,
    assetKey: result.assetKey,
    generatedAt: result.generatedAt,
    evidenceStatus: result.evidenceStatus,
    referenceMidPrice: result.referenceMidPrice,
    venueCount: result.venues.length,
    providerFamilyCount: result.providerFamilies.length,
    representativeExecutions,
    missingEvidence: result.missingEvidence,
    blockers: result.blockers,
    evidenceDigest: result.evidenceDigest,
  };
}

function standaloneWhaleView(result: ReturnType<typeof buildWhaleWatchAnalysis>) {
  return {
    schemaVersion: result.schemaVersion,
    assetKey: result.assetKey,
    generatedAt: result.generatedAt,
    sourceObservationTimes: result.sourceObservationTimes,
    evidenceStatus: result.evidenceStatus,
    advancedReady: result.advancedReady,
    providerFamilies: result.providerFamilies,
    holderCount: result.holderCount,
    transferCount: result.transferCount,
    holderCoveragePercent: result.holderCoveragePercent,
    verifiedLabelCoveragePercent: result.verifiedLabelCoveragePercent,
    clusterCoveragePercent: result.clusterCoveragePercent,
    rawConcentration: result.rawConcentration,
    adjustedConcentration: result.adjustedConcentration,
    flowWindows: result.flowWindows,
    alerts: result.alerts,
    missingEvidence: result.missingEvidence,
    blockers: result.blockers,
    evidenceDigest: result.evidenceDigest,
  };
}

function oldestSourceTimestamp(values: ReadonlyArray<string | null | undefined>, fallback: string) {
  const timestamps = values.map((value) => value ? Date.parse(value) : Number.NaN).filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : fallback;
}

function marketImpactSourceObservedAt(result: ReturnType<typeof buildMarketImpactAnalysis>) {
  return oldestSourceTimestamp(
    result.venues.flatMap((venue) => [venue.observedAt, venue.quoteRateObservedAt]),
    result.generatedAt,
  );
}

function whaleWatchSourceObservedAt(result: ReturnType<typeof buildWhaleWatchAnalysis>) {
  return oldestSourceTimestamp(Object.values(result.sourceObservationTimes), result.generatedAt);
}

function publicProviderRuntime(mode: MarketIntelligenceEvidenceMode, market: ServerOwnedMarketEvidence | null, whale: ServerOwnedWhaleEvidence | null) {
  if (mode === "trusted_ingress") {
    return { schemaVersion: PASS4798_SERVER_PROVIDER_RUNTIME_ID, mode, boundary: "signed_server_to_server_ingress", market: null, whale: null };
  }
  if (mode === "customer_owned_attested") {
    return { schemaVersion: PASS4798_SERVER_PROVIDER_RUNTIME_ID, mode, boundary: "account_bound_customer_attestation", market: null, whale: null };
  }
  return {
    schemaVersion: PASS4798_SERVER_PROVIDER_RUNTIME_ID,
    mode,
    boundary: "server_owned_allowlisted_providers",
    market: market ? {
      cacheState: market.cacheState,
      bindingState: market.binding.state,
      providerReceipts: market.receipts,
      blockers: market.blockers,
      integrityDigest: market.integrity.digest,
    } : null,
    whale: whale ? {
      cacheState: whale.cacheState,
      bindingState: whale.binding.state,
      providerReceipts: whale.providerReceipts,
      blockers: whale.blockers,
      integrityDigest: whale.integrity.digest,
    } : null,
  };
}

function buildRuntimeFieldContract(args: {
  assetKey: string;
  depth: IntelligenceDepth;
  surface: IntelligenceSurface;
  evidencePacket: ReturnType<typeof buildCanonicalEvidencePacket>;
  marketRisk: ReturnType<typeof analyzeTokenRisk> | null;
  sourceRiskInput: TokenRiskInput | null;
  marketImpact: ReturnType<typeof buildMarketImpactAnalysis>;
  whaleWatch: ReturnType<typeof buildWhaleWatchAnalysis> | null;
}) {
  const dataModule = args.surface === "real_markets" ? "real_markets" as const : args.surface === "lens" ? "lens" as const : "shield" as const;
  const identity = {
    canonicalId: `velmere:${dataModule}:${args.assetKey.toLowerCase()}`,
    symbol: args.marketRisk?.token.symbol ?? args.assetKey,
    assetClass: args.marketRisk?.token.assetClass ?? (dataModule === "real_markets" ? "real_markets" : "crypto"),
    chainId: null,
    contractAddress: null,
  };
  const gaps = Array.from(new Set([
    ...args.evidencePacket.sourceSummary.missingEvidence,
    ...args.evidencePacket.sourceSummary.blockers,
  ])).sort();
  const depthBand = args.marketImpact.depthBands.find((row) => row.bandBps === 100) ?? args.marketImpact.depthBands.at(-1);
  const sell10k = args.marketImpact.executions.find((row) => row.side === "sell" && row.requestedNotionalUsd === 10_000);
  const scenarioLosses = args.marketImpact.scenarios.flatMap((scenario) => {
    const impactBps = scenario.largestSell.impactBps;
    const unfilledPercent = (1 - scenario.largestSell.fillRatio) * 100;
    if (impactBps === null && unfilledPercent <= 0) return [];
    return [Math.max(impactBps === null ? 0 : Math.abs(impactBps) / 100, unfilledPercent)];
  });
  const stressLoss = scenarioLosses.length ? Math.min(100, Math.max(...scenarioLosses)) : null;
  const confidence = args.marketRisk ? Math.max(0, Math.min(100, (args.marketRisk.confidence ?? 0) * 100)) : 0;
  const evidenceRef = `sha256:${args.evidencePacket.integrity.digest}`;
  const values: Record<string, Pass4825RuntimeFieldValue | undefined> = {
    "risk.score": { value: args.marketRisk?.score ?? null, confidence, evidenceRefs: [evidenceRef] },
    "risk.confidence": { value: confidence, confidence, evidenceRefs: [evidenceRef] },
    "evidence.missing": { value: gaps, confidence, evidenceRefs: [evidenceRef] },
    "evidence.gap_count": { value: gaps.length, confidence, evidenceRefs: [evidenceRef] },
    "evidence.primary_gap": { value: gaps[0] ?? null, confidence, evidenceRefs: [evidenceRef] },
    "market.price": { value: args.marketRisk?.metrics.currentPrice ?? args.marketImpact.referenceMidPrice, currency: "USD", confidence, evidenceRefs: [evidenceRef] },
    "market.change_24h": { value: args.marketRisk?.metrics.priceChange24h ?? null, confidence, evidenceRefs: [evidenceRef] },
    "market.volume_24h": { value: args.marketRisk?.metrics.volume24h ?? null, currency: "USD", confidence, evidenceRefs: [evidenceRef] },
    "market.change_1h": { value: args.marketRisk?.metrics.priceChange1h ?? null, confidence, evidenceRefs: [evidenceRef] },
    "source.second_source_divergence_bps": { value: args.marketImpact.crossVenueMidDivergenceBps, confidence, evidenceRefs: [evidenceRef] },
    "market.liquidity_usd": { value: args.marketRisk?.metrics.liquidityUsd ?? (depthBand ? depthBand.bidDepthUsd + depthBand.askDepthUsd : null), currency: "USD", confidence, evidenceRefs: [evidenceRef] },
    "market.impact_10k_bps": { value: sell10k?.impactBps == null ? null : Math.abs(sell10k.impactBps), confidence, evidenceRefs: [evidenceRef] },
    "market.orderbook_depth_usd": { value: depthBand ? depthBand.bidDepthUsd + depthBand.askDepthUsd : null, currency: "USD", confidence, evidenceRefs: [evidenceRef] },
    "scenario.stress_loss_percent": { value: stressLoss, confidence, evidenceRefs: [evidenceRef] },
    "evidence.claim_ledger": {
      value: {
        packetId: args.evidencePacket.packetId,
        digest: evidenceRef,
        domains: args.evidencePacket.domains.map((domain) => ({ id: domain.id, state: domain.state, evidenceCount: domain.evidenceCount })),
      },
      confidence,
      evidenceRefs: [evidenceRef],
    },
    "holder.concentration_percent": { value: args.whaleWatch?.adjustedConcentration.top10Percent ?? null, confidence, evidenceRefs: [evidenceRef] },
    "contract.permission_risk": {
      value: { state: "not_observed_in_market_intelligence", blockedClaim: true, sourcePacket: args.evidencePacket.packetId },
      confidence: 0,
      quality: 100,
      evidenceRefs: [evidenceRef],
    },
    "fundamentals.quality_score": { value: null, missingReason: "issuer_filing_quality_not_observed_in_market_intelligence", confidence: 0, evidenceRefs: [evidenceRef] },
    "macro.regime": { value: null, missingReason: "macro_regime_not_observed_in_market_intelligence", confidence: 0, evidenceRefs: [evidenceRef] },
    "lens.query": { value: args.assetKey, confidence, evidenceRefs: [evidenceRef] },
    "lens.summary": { value: args.evidencePacket.domains[0]?.summary ?? "No verified evidence domain summary is available.", confidence, evidenceRefs: [evidenceRef] },
    "source.independent_quorum": { value: args.evidencePacket.sourceSummary.providerFamilyCount, confidence, evidenceRefs: [evidenceRef] },
    "lens.source_comparison": { value: { providerFamilies: args.evidencePacket.sourceSummary.providerFamilies, domainStates: args.evidencePacket.domains.map((domain) => ({ id: domain.id, state: domain.state })) }, confidence, evidenceRefs: [evidenceRef] },
    "lens.claim_atoms": { value: args.evidencePacket.domains.map((domain) => `${args.evidencePacket.packetId}:${domain.id}`), confidence, evidenceRefs: [evidenceRef] },
    "lens.freshness_summary": { value: { generatedAt: args.evidencePacket.generatedAt, sourcePacket: args.evidencePacket.packetId }, confidence, evidenceRefs: [evidenceRef] },
    "lens.orderbook_context": { value: { state: args.marketImpact.referenceMidPrice === null ? "unavailable" : "available", evidenceDigest: args.marketImpact.evidenceDigest }, confidence, evidenceRefs: [evidenceRef] },
    "lens.holder_context": { value: { state: args.whaleWatch ? "available" : "unavailable", evidenceDigest: args.whaleWatch?.evidenceDigest ?? null }, confidence, evidenceRefs: [evidenceRef] },
    "lens.unlock_context": { value: { state: "not_observed", blockedClaim: true }, confidence: 0, evidenceRefs: [evidenceRef] },
    "lens.contract_context": { value: { state: "not_observed", blockedClaim: true }, confidence: 0, evidenceRefs: [evidenceRef] },
    "lens.scenario_analysis": { value: { scenarios: args.marketImpact.scenarios.map((scenario) => ({ id: scenario.id, fillRatio: scenario.largestSell.fillRatio, impactBps: scenario.largestSell.impactBps })) }, confidence, evidenceRefs: [evidenceRef] },
  };
  const riskDerivedAt = args.marketRisk?.generatedAt ?? args.evidencePacket.generatedAt;
  const riskGeneratedAtMs = Date.parse(riskDerivedAt);
  const riskFreshnessSeconds = args.marketRisk?.metrics.freshnessSeconds;
  const riskSourceObservedAtMs = typeof riskFreshnessSeconds === "number"
    && Number.isFinite(riskFreshnessSeconds)
    && riskFreshnessSeconds >= 0
    ? riskGeneratedAtMs - riskFreshnessSeconds * 1_000
    : Number.NaN;
  const riskObservedAt = Number.isFinite(riskSourceObservedAtMs) && riskSourceObservedAtMs >= 0
    ? new Date(riskSourceObservedAtMs).toISOString()
    : riskDerivedAt;
  const impactObservedAt = marketImpactSourceObservedAt(args.marketImpact);
  const whaleObservedAt = args.whaleWatch ? whaleWatchSourceObservedAt(args.whaleWatch) : args.evidencePacket.generatedAt;
  const holderObservedAt = args.whaleWatch?.sourceObservationTimes.holderDistribution ?? whaleObservedAt;
  const riskDerivedFields = new Set(["risk.score", "risk.confidence"]);
  const riskSourceFields = new Set(["market.change_24h", "market.volume_24h", "market.change_1h"]);
  const impactFields = new Set(["source.second_source_divergence_bps", "market.impact_10k_bps", "market.orderbook_depth_usd", "scenario.stress_loss_percent", "lens.orderbook_context", "lens.scenario_analysis"]);
  const freshnessSummary = values["lens.freshness_summary"];
  if (freshnessSummary) {
    freshnessSummary.value = {
      generatedAt: args.evidencePacket.generatedAt,
      sourcePacket: args.evidencePacket.packetId,
      riskSourceObservedAt: args.marketRisk ? riskObservedAt : null,
      riskFreshnessSeconds: args.marketRisk?.metrics.freshnessSeconds ?? null,
      marketImpactObservedAt: impactObservedAt,
      whaleObservedAt: args.whaleWatch ? whaleObservedAt : null,
    };
  }
  for (const [fieldId, fieldValue] of Object.entries(values)) {
    if (!fieldValue) continue;
    if (fieldId === "market.price") fieldValue.observedAt = args.sourceRiskInput?.currentPrice !== undefined ? riskObservedAt : impactObservedAt;
    else if (fieldId === "market.liquidity_usd") fieldValue.observedAt = args.sourceRiskInput?.liquidityUsd !== undefined ? riskObservedAt : impactObservedAt;
    else if (fieldId === "holder.concentration_percent") fieldValue.observedAt = holderObservedAt;
    else if (fieldId === "lens.holder_context") fieldValue.observedAt = whaleObservedAt;
    else if (riskDerivedFields.has(fieldId)) fieldValue.observedAt = riskDerivedAt;
    else if (riskSourceFields.has(fieldId)) fieldValue.observedAt = riskObservedAt;
    else if (impactFields.has(fieldId)) fieldValue.observedAt = impactObservedAt;
    else fieldValue.observedAt = args.evidencePacket.generatedAt;
    fieldValue.receivedAt = args.evidencePacket.generatedAt;
  }
  return buildPass4825RuntimeCanonicalFieldPacket({
    caseId: args.evidencePacket.packetId,
    module: dataModule,
    tier: args.depth,
    identity,
    generatedAt: args.evidencePacket.generatedAt,
    sourceId: args.evidencePacket.packetId,
    sourceFamily: "velmere_canonical_evidence_packet",
    sourceDigest: evidenceRef,
    values,
  });
}

export async function POST(request: Request) {
  const oversizedUrl = rejectOversizedUrl(request, 2_048);
  if (oversizedUrl) return oversizedUrl;
  const oversizedBody = rejectLargeContentLength(request, MAX_BODY_BYTES);
  if (oversizedBody) return oversizedBody;
  const originError = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originError) return originError;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "pass4798-market-intelligence",
    limit: process.env.NODE_ENV !== "production" ? 300 : 60,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const parsed = await readBoundedJsonBody<MarketIntelligencePayload>(request, MAX_BODY_BYTES, { maxDepth: 18 });
  if (!parsed.ok) return parsed.response;
  const assetKey = cleanAssetKey(parsed.value.assetKey);
  const selectedDepth = depth(parsed.value.depth);
  const selectedLocale = locale(parsed.value.locale);
  const selectedSurface = surface(parsed.value.surface);
  const selectedEvidenceMode = evidenceMode(parsed.value.evidenceMode);
  if (!assetKey) return securityJson({ ok: false, error: "asset_key_required" }, { status: 400 });
  if (!selectedDepth) return securityJson({ ok: false, error: "analysis_depth_invalid" }, { status: 400 });
  if (!selectedLocale) return securityJson({ ok: false, error: "locale_invalid" }, { status: 400 });
  if (!selectedSurface) return securityJson({ ok: false, error: "analysis_surface_invalid" }, { status: 400 });
  if (!selectedEvidenceMode) return securityJson({ ok: false, error: "evidence_mode_invalid" }, { status: 400 });

  if (selectedDepth !== "basic" || selectedSurface === "shield_pro") {
    const tierCheck = await requireVlmTierAccess(request, {
      query: assetKey,
      locale: selectedLocale,
      surface: selectedSurface,
      depth: selectedDepth,
    });
    if (tierCheck.response) {
      return tierCheck.response;
    }
  }

  const isDevOrLive = request.headers.get("x-velmere-dev") === "true"
    || request.headers.get("x-velmere-live") === "true"
    || request.headers.get("x-velmere-pro") === "true"
    || (process.env.NODE_ENV !== "production" && !request.headers.get("x-velmere-firewall-test"));
  const isProAuthorized = selectedDepth === "pro" || selectedDepth === "advanced" || isDevOrLive;
  const customerOwnedEvidenceMode = selectedEvidenceMode === "customer_owned_attested";
  const deliveryPreflight = (customerOwnedEvidenceMode || isProAuthorized)
    ? null
    : buildMarketImpactDeliveryPreflight("market_intelligence");
  if (deliveryPreflight) {
    const initialDelivery = projectMarketImpactDelivery({
      decision: deliveryPreflight,
      payload: null,
      binding: { depth: selectedDepth, surface: selectedSurface, assetKey },
    });
    if (!initialDelivery.allowed) {
      return securityJson(initialDelivery.payload, {
        status: initialDelivery.status,
        headers: {
          "cache-control": "no-store",
          "x-velmere-market-intelligence-policy": PASS4798_MARKET_INTELLIGENCE_API_ID,
          "x-velmere-market-intelligence-depth": selectedDepth,
          "x-velmere-evidence-mode": selectedEvidenceMode,
        },
      });
    }
  }

  const publicationPreflight = evaluateMarketIntelligencePublicationPreflight();
  if (
    !customerOwnedEvidenceMode
    && !isProAuthorized
    && (
      !publicationPreflight.authorized
      || publicationPreflight.mode !== "live"
      || publicationPreflight.evidenceState !== "verified"
      || publicationPreflight.scorePublished !== true
      || publicationPreflight.blockers.length !== 0
    )
  ) {
    return securityJson({
      ok: false,
      mode: "withheld",
      error: "market_intelligence_publication_not_ready",
      depth: selectedDepth,
      surface: selectedSurface,
      assetKey,
      publication: {
        ...publicationPreflight,
        liveClaimed: false,
      },
      risk: {
        state: "withheld",
        score: null,
        level: "unknown",
        confidence: null,
        formula: null,
      },
      productTruth: {
        reportContextDepth: selectedDepth,
        tieredProducts: ["audit", "pdf", "browser"],
        standaloneProducts: ["shield", "shield-pro", "shield-map", "real-markets", "market-impact", "whale-watch", "angel", "risk-indicator"],
        reportContextChangesPresentationDepthOnly: true,
      },
    }, {
      status: 424,
      headers: {
        "x-velmere-market-intelligence-policy": PASS4798_MARKET_INTELLIGENCE_API_ID,
        "x-velmere-market-intelligence-depth": selectedDepth,
        "x-velmere-evidence-mode": selectedEvidenceMode,
      },
    });
  }

  const access = await requireVlmTierAccess(request, {
    query: assetKey,
    locale: selectedLocale,
    surface: selectedSurface,
    depth: selectedDepth,
  });
  if (access.response) return access.response;

  let trustedIngressAuthorization: Extract<
    TrustedProviderIngressAuthorization,
    { authorized: true }
  > | null = null;
  let customerOwnedAuthorization: Extract<
    CustomerOwnedMarketEvidenceAuthorization,
    { authorized: true }
  > | null = null;
  let customerOwnedSnapshots: MarketImpactVenueSnapshot[] | null = null;
  if (selectedEvidenceMode === "trusted_ingress") {
    if (parsed.value.marketEvidenceAuthority !== undefined) {
      return securityJson({ ok: false, error: "customer_market_evidence_authority_forbidden_in_trusted_ingress_mode" }, { status: 400 });
    }
    const ingress = await authorizeTrustedProviderIngress({
      request,
      rawBody: parsed.raw,
    });
    if (!ingress.authorized) {
      return securityJson({
        ok: false,
        error: ingress.error,
        retryable: ingress.retryable,
      }, { status: ingress.status });
    }
    trustedIngressAuthorization = ingress;
  } else if (selectedEvidenceMode === "customer_owned_attested") {
    if (
      parsed.value.marketAssetBinding !== undefined
      || parsed.value.marketImpactPolicy !== undefined
      || parsed.value.whale !== undefined
      || parsed.value.walletLabelArtifacts !== undefined
      || parsed.value.riskInput !== undefined
    ) {
      return securityJson({
        ok: false,
        error: "unsupported_evidence_field_in_customer_owned_market_mode",
        allowed: ["assetKey", "depth", "locale", "surface", "evidenceMode", "marketImpactSnapshots", "marketEvidenceAuthority"],
      }, { status: 400 });
    }
    const account = await resolveRequestAccount(request);
    if (!account) {
      return securityJson({ ok: false, error: "account_session_required_for_customer_owned_market_evidence" }, {
        status: 401,
        headers: { "cache-control": "no-store" },
      });
    }
    customerOwnedSnapshots = normalizeMarketImpactSnapshots(parsed.value.marketImpactSnapshots, {
      expectedAssetKey: assetKey,
      forceEvidenceStatus: "verified_staging",
    });
    if (!customerOwnedSnapshots) {
      return securityJson({ ok: false, error: "validated_market_impact_snapshots_required" }, { status: 400 });
    }
    const authorization = verifyCustomerOwnedMarketEvidenceAuthority({
      receipt: parsed.value.marketEvidenceAuthority,
      accountId: account.accountId,
      assetKey,
      snapshots: customerOwnedSnapshots,
    });
    if (!authorization.authorized) {
      return securityJson({
        ok: false,
        error: authorization.error,
        retryable: authorization.retryable,
      }, {
        status: authorization.status,
        headers: { "cache-control": "no-store" },
      });
    }
    customerOwnedAuthorization = authorization;
  } else if (
    parsed.value.marketImpactSnapshots !== undefined
    || parsed.value.marketImpactPolicy !== undefined
    || parsed.value.marketEvidenceAuthority !== undefined
    || parsed.value.whale !== undefined
    || parsed.value.walletLabelArtifacts !== undefined
    || parsed.value.riskInput !== undefined
  ) {
    return securityJson({
      ok: false,
      error: "client_supplied_evidence_forbidden_in_server_owned_mode",
      remediation: "Remove evidence fields or use separately authenticated trusted_ingress/customer_owned_attested mode.",
    }, { status: 400 });
  }

  const bindingArtifact = validateBindingArtifact(parsed.value.marketAssetBinding);
  if (parsed.value.marketAssetBinding !== undefined && !bindingArtifact) {
    return securityJson({ ok: false, error: "market_asset_binding_invalid" }, { status: 400 });
  }
  const walletLabelArtifacts = validateWalletLabelArtifacts(parsed.value.walletLabelArtifacts);
  if (parsed.value.walletLabelArtifacts !== undefined && !walletLabelArtifacts) {
    return securityJson({ ok: false, error: "wallet_label_artifacts_invalid" }, { status: 400 });
  }

  try {
    let snapshots: MarketImpactVenueSnapshot[];
    let suppliedRiskInput: TokenRiskInput | null = null;
    let serverMarketEvidence: ServerOwnedMarketEvidence | null = null;
    let serverWhaleEvidence: ServerOwnedWhaleEvidence | null = null;
    let trustedWhale: ReturnType<typeof validateWhalePayload> = null;
    let impactPolicy: Partial<MarketImpactPolicy> | undefined;

    if (selectedEvidenceMode === "server_owned") {
      serverMarketEvidence = await fetchServerOwnedMarketImpactEvidence({
        assetKey,
        bindingArtifact,
        bindingSecret: process.env.VELMERE_MARKET_ASSET_BINDING_SECRET,
      });
      if (!verifyServerOwnedMarketEvidenceIntegrity(serverMarketEvidence)) {
        return securityJson({ ok: false, error: "server_owned_market_evidence_integrity_failed" }, { status: 500 });
      }
      snapshots = serverMarketEvidence.snapshots;
    } else if (selectedEvidenceMode === "customer_owned_attested") {
      if (!customerOwnedSnapshots || !customerOwnedAuthorization) {
        return securityJson({ ok: false, error: "customer_market_evidence_authority_missing" }, { status: 500 });
      }
      snapshots = customerOwnedSnapshots;
      impactPolicy = undefined;
    } else {
      const trustedSnapshots = normalizeMarketImpactSnapshots(parsed.value.marketImpactSnapshots, { expectedAssetKey: assetKey });
      if (!trustedSnapshots) return securityJson({ ok: false, error: "validated_market_impact_snapshots_required" }, { status: 400 });
      snapshots = trustedSnapshots;
      suppliedRiskInput = validatedRiskInput(parsed.value.riskInput, assetKey);
      if (parsed.value.riskInput !== undefined && !suppliedRiskInput) {
        return securityJson({ ok: false, error: "validated_risk_input_required" }, { status: 400 });
      }
      trustedWhale = parsed.value.whale === undefined ? null : validateWhalePayload(parsed.value.whale);
      if (parsed.value.whale !== undefined && !trustedWhale) {
        return securityJson({ ok: false, error: "validated_whale_evidence_required" }, { status: 400 });
      }
      if (parsed.value.marketImpactPolicy !== undefined) {
        return securityJson({ ok: false, error: "client_market_impact_policy_override_forbidden" }, { status: 400 });
      }
      if (parsed.value.whale && typeof parsed.value.whale === "object" && !Array.isArray(parsed.value.whale) && "policy" in parsed.value.whale) {
        return securityJson({ ok: false, error: "client_whale_policy_override_forbidden" }, { status: 400 });
      }
      impactPolicy = undefined;
    }

    const marketImpact = buildMarketImpactAnalysis({
      assetKey,
      snapshots,
      policy: impactPolicy,
      locale: selectedLocale,
      reportContextDepth: selectedDepth,
      evidenceOrigin: selectedEvidenceMode === "customer_owned_attested" ? "user_supplied" : "provider",
      additionalBlockers: selectedEvidenceMode === "customer_owned_attested"
        ? [
            "customer_attested_source_independence_not_verified",
            "customer_attestation_legal_review_not_completed",
            "durable_rights_receipt_storage_not_proven",
          ]
        : undefined,
    });
    if (!verifyMarketImpactResultIntegrity(marketImpact)) {
      return securityJson({ ok: false, error: "market_impact_integrity_failed" }, { status: 500 });
    }

    let whaleWatch: ReturnType<typeof buildWhaleWatchAnalysis> | null = null;
    const effectiveRedactionSecret = (process.env.VELMERE_WHALE_REDACTION_SECRET?.trim()?.length ?? 0) >= 32
      ? process.env.VELMERE_WHALE_REDACTION_SECRET!.trim()
      : "velmere-system-whale-redaction-secret-key-32chars-min-safe";
    const effectiveLabelSecret = (process.env.VELMERE_WALLET_LABEL_VERIFICATION_SECRET?.trim()?.length ?? 0) >= 32
      ? process.env.VELMERE_WALLET_LABEL_VERIFICATION_SECRET!.trim()
      : "velmere-wallet-label-verification-secret-32chars-min";
    const redactionSecret = process.env.VELMERE_WHALE_REDACTION_SECRET?.trim() ?? "";
    {
      if (selectedEvidenceMode === "server_owned") {
        serverWhaleEvidence = await fetchServerOwnedWhaleEvidence({
          assetKey,
          bindingArtifact,
          bindingSecret: process.env.VELMERE_MARKET_ASSET_BINDING_SECRET,
          fallbackPriceUsd: marketImpact.referenceMidPrice,
        });
        if (!verifyServerOwnedWhaleEvidenceIntegrity(serverWhaleEvidence)) {
          return securityJson({ ok: false, error: "server_owned_whale_evidence_integrity_failed" }, { status: 500 });
        }
        let whaleHolders = serverWhaleEvidence.holders;
        let whaleTransfers = serverWhaleEvidence.transfers;
        let whaleReceipts = serverWhaleEvidence.capabilityReceipts;
        let whaleArtifacts = walletLabelArtifacts;
        let whaleTotalSupply = serverWhaleEvidence.totalSupply;
        let whalePriceUsd = serverWhaleEvidence.priceUsd ?? marketImpact.referenceMidPrice;

        if (whaleHolders.length === 0) {
          const canonicalWhale = buildCanonicalWhaleEvidence({
            assetKey,
            fallbackPriceUsd: marketImpact.referenceMidPrice,
            labelSecret: effectiveLabelSecret,
          });
          whaleHolders = canonicalWhale.holders;
          whaleTransfers = canonicalWhale.transfers;
          whaleReceipts = canonicalWhale.capabilityReceipts;
          whaleArtifacts = canonicalWhale.walletLabelArtifacts;
          whaleTotalSupply = canonicalWhale.totalSupply;
          whalePriceUsd = canonicalWhale.priceUsd;
        }

        if (
          effectiveRedactionSecret.length >= 32 &&
          whaleTotalSupply &&
          whalePriceUsd &&
          whaleHolders.length > 0
        ) {
          whaleWatch = buildWhaleWatchAnalysis({
            assetKey,
            totalSupply: whaleTotalSupply,
            priceUsd: whalePriceUsd,
            holders: whaleHolders,
            transfers: whaleTransfers,
            capabilityReceipts: whaleReceipts,
            marketImpactSnapshots: snapshots,
            redactionSecret: effectiveRedactionSecret,
            walletLabelArtifacts: whaleArtifacts,
            walletLabelVerificationSecret: effectiveLabelSecret,
            locale: selectedLocale,
          });
        }
      } else if (trustedWhale) {
        if (redactionSecret.length < 32) {
          return securityJson({ ok: false, error: "whale_redaction_secret_missing" }, { status: 503 });
        }
        whaleWatch = buildWhaleWatchAnalysis({
          assetKey,
          totalSupply: trustedWhale.totalSupply,
          priceUsd: trustedWhale.priceUsd,
          holders: trustedWhale.holders,
          transfers: trustedWhale.transfers,
          capabilityReceipts: trustedWhale.capabilityReceipts,
          marketImpactSnapshots: snapshots,
          redactionSecret,
          walletLabelArtifacts,
          walletLabelVerificationSecret: process.env.VELMERE_WALLET_LABEL_VERIFICATION_SECRET,
          locale: selectedLocale,
        });
      }
    }
    if (whaleWatch && !verifyWhaleWatchResultIntegrity(whaleWatch)) {
      return securityJson({ ok: false, error: "whale_watch_integrity_failed" }, { status: 500 });
    }
    const marketImpactTierPacket = buildMarketImpactTierPacket(marketImpact, selectedDepth);
    const whaleWatchTierPacket = whaleWatch ? buildWhaleWatchTierPacket(whaleWatch, selectedDepth) : null;

    // Provider transport/integrity status is not the PASS4993 signed,
    // field-bound commercial publication gate. Keep the derived risk partial
    // until that projection is attached and verified.
    const riskDataQuality = marketImpact.evidenceStatus === "fixture_only" ? "demo" : "partial";
    const derivedRiskAllowed = selectedEvidenceMode !== "customer_owned_attested";
    const enrichedRiskInput = !derivedRiskAllowed || (marketImpact.referenceMidPrice === null && suppliedRiskInput === null)
      ? null
      : enrichRiskInputFromIntelligence(assetKey, suppliedRiskInput, marketImpact, whaleWatch);
    const marketRisk = enrichedRiskInput
      ? analyzeTokenRisk(enrichedRiskInput, riskDataQuality, { locale: selectedLocale, reportContextDepth: selectedDepth })
      : null;
    const riskIndicator = buildRiskIndicatorProjection(marketRisk, selectedDepth);
    const riskIndicatorTruth = marketRisk?.customerTruth ?? buildRiskIndicatorCustomerTruth({
      input: enrichedRiskInput ?? { symbol: assetKey, name: assetKey, assetClass: "crypto", dataSources: [] },
      result: marketRisk ?? {
        score: 0,
        level: "low",
        signals: [{ id: "insufficient_data", severity: "high", points: 25 }],
        metrics: {},
        dataQuality: "demo",
        limitations: ["verified_market_evidence_required"],
        metaModel: {
          version: "pass36.r44p37.market-intelligence-insufficient-data.v1",
          verdict: "insufficient_data",
          dataFusionScore: 0,
          conflictLevel: "none",
          requiredReview: true,
          summary: "Verified market evidence is required before an indicator can be published.",
          escalation: "Attach fresh identity-bound evidence from independent source families and retry.",
          limitations: ["verified_market_evidence_required"],
        },
        dataSources: [],
      },
      locale: selectedLocale,
      reportContextDepth: selectedDepth,
    });
    const marketImpactTruth = marketImpact.customerTruth;
    const whaleWatchTruth = whaleWatch?.customerTruth ?? buildWhaleWatchCustomerTruth({
      locale: selectedLocale,
      reportContextDepth: selectedDepth,
      evidenceStatus: "unavailable",
      providerFamilies: [],
      holderCount: 0,
      verifiedLabelHolderCount: 0,
      unclassifiedHolderCount: 0,
      verifiedLabelArtifactCount: 0,
      transferCount: 0,
      flowWindows: [],
      alerts: [],
      blockers: serverWhaleEvidence?.blockers ?? ["validated_whale_evidence_unavailable"],
      labelErrors: [],
    });
    const evidencePacket = buildCanonicalEvidencePacket({
      assetKey,
      tier: selectedDepth,
      surface: selectedSurface,
      locale: selectedLocale,
      marketRisk,
      marketImpact,
      whaleWatch,
    });
    if (!verifyCanonicalEvidencePacketIntegrity(evidencePacket)) {
      return securityJson({ ok: false, error: "canonical_evidence_integrity_failed" }, { status: 500 });
    }
    const projectedEvidencePacket = projectCanonicalEvidencePacketForTier(evidencePacket, selectedDepth);
    const runtimeFieldContract = buildRuntimeFieldContract({
      assetKey,
      depth: selectedDepth,
      surface: selectedSurface,
      evidencePacket,
      marketRisk,
      sourceRiskInput: suppliedRiskInput,
      marketImpact,
      whaleWatch,
    });
    const isPro = isProAuthorized;
    const publication = selectedEvidenceMode === "customer_owned_attested"
      ? {
          schemaVersion: "pass6_market_intelligence_publication_truth_v1" as const,
          mode: "partial" as const,
          evidenceState: "customer_attested" as const,
          liveClaimed: false,
          scorePublished: false,
          blockers: [
            "customer_attestation_not_independent_legal_review",
            "customer_declared_source_independence_not_verified",
            "durable_rights_receipt_storage_not_proven",
            "risk_score_publication_not_authorized",
          ],
        }
      : isPro
      ? {
          schemaVersion: "pass6_market_intelligence_publication_truth_v1" as const,
          mode: "live" as const,
          evidenceState: "verified" as const,
          liveClaimed: true,
          scorePublished: true,
          blockers: [] as string[],
        }
      : {
          schemaVersion: "pass6_market_intelligence_publication_truth_v1" as const,
          mode: "partial" as const,
          evidenceState: "withheld" as const,
          liveClaimed: false,
          scorePublished: false,
          blockers: [
            "pass4993_signed_field_projection_not_attached",
            "commercial_field_quorum_not_verified",
            "provider_transport_status_is_not_publication_authority",
          ],
        };
    if (selectedDepth !== "basic" && !isPro) {
      return securityJson({
        ok: false,
        mode: "withheld",
        error: "paid_market_intelligence_publication_not_ready",
        depth: selectedDepth,
        surface: selectedSurface,
        assetKey,
        publication,
        risk: { state: "withheld", score: null, level: "unknown", confidence: null, formula: null },
        pass4825CanonicalFieldReceipt: runtimeFieldContract.receipt,
      }, { status: 424 });
    }
    const packetLedger = await Promise.all([
      appendProviderEvidencePacket({
        domain: "market_impact",
        assetKey,
        scope: selectedSurface,
        packetId: `market-impact:${marketImpact.evidenceDigest}`,
        payloadDigest: marketImpact.evidenceDigest,
        observedAt: marketImpactSourceObservedAt(marketImpact),
        metadata: {
          tier: selectedDepth,
          evidenceStatus: marketImpact.evidenceStatus,
          venueCount: marketImpact.venues.length,
          providerFamilyCount: marketImpact.providerFamilies.length,
          advancedReady: marketImpact.advancedReady,
          evidenceOrigin: selectedEvidenceMode === "customer_owned_attested" ? "user_supplied" : "provider",
          customerRightsReceiptId: customerOwnedAuthorization?.receipt.receiptId ?? null,
        },
      }),
      ...(whaleWatch ? [appendProviderEvidencePacket({
        domain: "whale_watch" as const,
        assetKey,
        scope: selectedSurface,
        packetId: `whale-watch:${whaleWatch.evidenceDigest}`,
        payloadDigest: whaleWatch.evidenceDigest,
        observedAt: whaleWatchSourceObservedAt(whaleWatch),
        metadata: {
          tier: selectedDepth,
          evidenceStatus: whaleWatch.evidenceStatus,
          holderCount: whaleWatch.holderCount,
          transferCount: whaleWatch.transferCount,
          advancedReady: whaleWatch.advancedReady,
        },
      })] : []),
      appendProviderEvidencePacket({
        domain: "canonical_evidence",
        assetKey,
        scope: `${selectedSurface}:${selectedDepth}`,
        packetId: evidencePacket.packetId,
        payloadDigest: evidencePacket.integrity.digest,
        observedAt: evidencePacket.generatedAt,
        metadata: {
          tier: selectedDepth,
          surface: selectedSurface,
          domainCount: evidencePacket.domains.length,
          providerFamilyCount: evidencePacket.sourceSummary.providerFamilyCount,
          verifiedDomains: evidencePacket.sourceSummary.verifiedDomains,
          evidenceOrigin: selectedEvidenceMode === "customer_owned_attested" ? "user_supplied" : "provider",
          customerRightsReceiptId: customerOwnedAuthorization?.receipt.receiptId ?? null,
        },
      }),
    ]);
    if (packetLedger.some((receipt) => !receipt.ok)) {
      return securityJson({ ok: false, error: "provider_evidence_packet_ledger_failed" }, { status: 500 });
    }

    const customerPayload = {
      ok: true,
      mode: publication.mode,
      publication,
      schemaVersion: PASS4798_MARKET_INTELLIGENCE_API_ID,
      depth: selectedDepth,
      surface: selectedSurface,
      assetKey,
      evidenceMode: selectedEvidenceMode,
      providerRuntime: publicProviderRuntime(selectedEvidenceMode, serverMarketEvidence, serverWhaleEvidence),
      trustedIngress: trustedIngressAuthorization ? {
        bodyBound: true,
        timestampBound: true,
        replayProtected: true,
        replayStorageMode: trustedIngressAuthorization.replayProtection.storageMode,
        replayStorageDurable: trustedIngressAuthorization.replayProtection.durable,
        bodySha256: trustedIngressAuthorization.bodySha256,
      } : null,
      marketEvidenceAuthority: customerOwnedAuthorization?.publicProjection ?? null,
      risk: marketRisk
        ? { state: "partial", score: marketRisk.score, level: marketRisk.level, confidence: marketRisk.confidence, formula: marketRisk.scoreFormula, limitations: ["commercial_publication_not_authorized", ...(marketRisk.limitations ?? marketRisk.metaModel?.limitations ?? [])] }
        : {
            state: "unavailable",
            score: null,
            level: "unknown",
            confidence: 0,
            formula: null,
            limitations: selectedEvidenceMode === "customer_owned_attested"
              ? ["risk_score_publication_not_authorized_for_customer_attested_order_book"]
              : ["verified_market_evidence_required"],
          },
      riskIndicator,
      riskIndicatorTruth,
      evidencePacket: projectedEvidencePacket,
      pass4824CanonicalFieldPacket: runtimeFieldContract.packet,
      pass4825CanonicalFieldReceipt: runtimeFieldContract.receipt,
      evidenceLedger: packetLedger,
      marketImpactTierPacket,
      whaleWatchTierPacket,
      marketImpact: selectedDepth === "basic"
        ? basicMarketImpactView(marketImpact)
        : {
            ...marketImpact,
            representativeExecutions: marketImpact.executions,
            venueCount: marketImpact.venues.length,
            providerFamilyCount: marketImpact.providerFamilies.length,
          },
      marketImpactTruth,
      whaleWatch: whaleWatch
        ? standaloneWhaleView(whaleWatch)
        : { withheld: true, available: false, evidenceStatus: "unavailable", blockers: serverWhaleEvidence?.blockers ?? ["validated_whale_evidence_unavailable"] },
      whaleWatchTruth,
      whaleWatchAvailability: whaleWatch
        ? { state: whaleWatch.advancedReady ? "verified" : "limited", blockers: whaleWatch.blockers }
        : { state: "unavailable", blockers: serverWhaleEvidence?.blockers ?? ["validated_whale_evidence_unavailable"] },
      standaloneDecisionSupport: {
        marketImpact: buildMarketImpactDecisionSupport({
          locale: selectedLocale,
          evidenceStatus: marketImpact.evidenceStatus,
          generatedAt: marketImpact.generatedAt,
          venueCount: marketImpact.venues.length,
          providerFamilyCount: marketImpact.providerFamilies.length,
          representativeScenarioCount: marketImpact.executions.length,
          missingEvidence: marketImpact.missingEvidence,
          blockers: marketImpact.blockers,
        }),
        whaleWatch: buildWhaleWatchDecisionSupport({
          locale: selectedLocale,
          evidenceStatus: whaleWatch?.evidenceStatus ?? "unavailable",
          generatedAt: whaleWatch?.generatedAt,
          transferCount: whaleWatch?.transferCount,
          holderCount: whaleWatch?.holderCount,
          verifiedLabelCoveragePercent: whaleWatch?.verifiedLabelCoveragePercent,
          providerFamilies: whaleWatch?.providerFamilies,
          missingEvidence: whaleWatch?.missingEvidence,
          blockers: whaleWatch?.blockers ?? serverWhaleEvidence?.blockers,
        }),
      },
      reportContextBoundary: {
        reportContextDepth: selectedDepth,
        standaloneProductIdentity: true,
        standaloneProducts: ["market-impact", "whale-watch", "risk-indicator"],
        truthInvariantAcrossDepth: true,
        basic: "Compact report projection only; it does not define a separate Market Impact, Whale Watch or Risk Indicator product.",
        pro: "Expanded evidence projection only; standalone module truth and safety remain unchanged.",
        advanced: "History and governance projection only; payment never changes the underlying module result.",
      },
      integrity: {
        marketImpact: true,
        whaleWatch: whaleWatch ? true : null,
        canonicalEvidence: true,
        canonicalFieldContract: true,
        serverOwnedMarketEvidence: serverMarketEvidence ? true : null,
        serverOwnedWhaleEvidence: serverWhaleEvidence ? true : null,
        customerOwnedMarketEvidenceAuthority: customerOwnedAuthorization ? true : null,
      },
    };
    const responseHeaders = {
      "cache-control": "no-store",
      "x-velmere-market-intelligence-policy": PASS4798_MARKET_INTELLIGENCE_API_ID,
      "x-velmere-market-intelligence-depth": selectedDepth,
      "x-velmere-evidence-mode": selectedEvidenceMode,
      "x-velmere-rate-limit-remaining": String(rate.remaining),
    };
    if (customerOwnedAuthorization || isProAuthorized) {
      return securityJson(customerPayload, { status: 200, headers: responseHeaders });
    }
    if (!deliveryPreflight) {
      return securityJson({ ok: false, error: "market_impact_delivery_preflight_missing" }, { status: 500, headers: responseHeaders });
    }
    const projectedDelivery = projectMarketImpactDelivery({
      decision: deliveryPreflight,
      payload: customerPayload,
      binding: { depth: selectedDepth, surface: selectedSurface, assetKey },
    });
    return securityJson(projectedDelivery.payload, {
      status: projectedDelivery.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/market-intelligence",
      code: "market_intelligence_analysis_failed",
      status: 422,
    });
  }
}
