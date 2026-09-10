import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import {
  buildPass4650ProviderQualitySnapshot,
  type Pass4650ProviderQualitySnapshot,
} from "@/lib/market-integrity/provider-quality-replay";
import {
  pass4644FieldValueHash,
  type Pass4644ProviderEvidenceReceipt,
} from "@/lib/market-integrity/provider-evidence-receipt";
import type { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import type { VlmFact, VlmFreshness, VlmSource } from "./vlm-contract";
import { boundedNumber, sanitizeIdentifier, sanitizeVlmText } from "./vlm-security";
import { arbitrateVlmSources, type VlmSourceArbitration } from "./vlm-source-arbitration";
import { governVlmSourceVerdict, type VlmSourceVerdictGovernor } from "./vlm-source-verdict-governor";

export type RiskBrainSnapshot = ReturnType<typeof buildRiskBrain>;

export type VlmCanonicalFactPacket = {
  schemaVersion: "velmere.vlm.fact-packet.v1";
  asset: {
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    chainId?: string;
    contractAddress?: string;
    family: import("./vlm-source-verdict-governor").VlmVerdictAssetFamily;
  };
  observedAt: string;
  dataQuality: "demo" | "partial" | "live";
  deterministicScore: number;
  deterministicVerdict: string;
  confidenceCap: number;
  sourceArbitration: VlmSourceArbitration;
  facts: VlmFact[];
  sources: VlmSource[];
  signals: Array<{ id: string; severity: string; points: number; sourceIds: string[] }>;
  layers: Array<{ id: string; label: string; score: number; confidence: number; state: string; evidence: string[] }>;
  conflicts: Array<{ description: string; sourceIds: string[] }>;
  missingData: string[];
  nextChecks: string[];
  allowedSourceIds: string[];
  verdictGovernor: VlmSourceVerdictGovernor;
};

function validIso(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function freshnessFromTime(observedAt: string, dataQuality: TokenRiskResult["dataQuality"]): VlmFreshness {
  if (dataQuality === "demo") return "unknown";
  const ageMs = Date.now() - new Date(observedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "unknown";
  if (ageMs <= 15 * 60_000) return "fresh";
  if (ageMs <= 6 * 60 * 60_000) return "aging";
  return "stale";
}

type ReceiptVerdict = Pass4650ProviderQualitySnapshot["verdicts"][number];
type ReceiptSourceRow = {
  receipt: Pass4644ProviderEvidenceReceipt;
  verdict: ReceiptVerdict;
  source: VlmSource;
};

function receiptSourceId(receiptId: string) {
  return sanitizeIdentifier(`receipt:${receiptId}`, "receipt:invalid", 180);
}

/** Display labels never enter the source plane. Only replay-accepted receipts do. */
function makeReceiptSources(result: TokenRiskResult, observedAt: string) {
  const quality = buildPass4650ProviderQualitySnapshot({
    receipts: result.providerEvidenceReceipts,
    requestedIdentity: result.token.tokenAddress ?? result.token.marketId ?? result.token.symbol,
    requestedIdentityAliases: [result.token.symbol, result.token.marketId, result.token.tokenAddress].filter((value): value is string => Boolean(value)),
    assetClass: result.token.assetClass ?? "unknown",
    evidenceProfile: "market",
    now: new Date(),
  });
  const rows = (result.providerEvidenceReceipts ?? []).flatMap((receipt, index): ReceiptSourceRow[] => {
    const verdict = quality.verdicts[index];
    if (!verdict?.accepted || !verdict.providerRootFamily) return [];
    return [{
      receipt,
      verdict,
      source: {
        id: receiptSourceId(receipt.receiptId),
        provider: sanitizeVlmText(verdict.providerRootFamily, 100),
        providerFamily: sanitizeVlmText(receipt.providerFamily, 120),
        label: sanitizeVlmText(receipt.providerId, 180),
        observedAt: validIso(receipt.observedAt),
        quality: verdict.independent ? 88 : 68,
        receiptId: receipt.receiptId,
        payloadHash: receipt.payloadHash,
        capabilities: receipt.capabilities.slice(0, 32),
      },
    }];
  }).slice(0, 23);
  const internal: VlmSource = {
    id: "internal:risk-engine",
    provider: "Velmère deterministic engine",
    providerFamily: "vlm-risk-engine",
    label: "Internal deterministic derivation",
    observedAt,
    quality: 88,
  };
  return { quality, rows, sources: [internal, ...rows.map((row) => row.source)] };
}

const FACT_FIELD_PATTERNS: Record<string, RegExp> = {
  price: /(?:^|\.)(?:price|priceUsd|currentPrice|lastPrice)$/i,
  "price-change-1h": /(?:^|\.)(?:priceChange1h|change1h)$/i,
  "price-change-24h": /(?:^|\.)(?:priceChange24h|priceChangePercent|change24h)$/i,
  "price-change-7d": /(?:^|\.)(?:priceChange7d|change7d)$/i,
  "price-change-30d": /(?:^|\.)(?:priceChange30d|change30d)$/i,
  "market-cap": /(?:^|\.)(?:marketCap|market_cap)$/i,
  fdv: /(?:^|\.)(?:fdv|fullyDilutedValuation)$/i,
  "volume-24h": /(?:^|\.)(?:volume24h|volume|quoteVolume)$/i,
  "liquidity-usd": /(?:^|\.)(?:liquidityUsd|liquidity\.usd)$/i,
  "holder-count": /(?:^|\.)(?:holderCount|holder_count)$/i,
  "top10-holder-percent": /(?:^|\.)(?:top10HolderPercent|top10_holder_percent)$/i,
  "slippage-10k": /(?:^|\.)(?:simulatedSlippage10k|simulatedSellSlippage10k|simulatedBuySlippage10k)$/i,
  "sell-tax": /(?:^|\.)(?:sellTaxPercentage|sell_tax|sellTax)$/i,
};

function conservativeFactTime(rows: ReceiptSourceRow[]) {
  const timestamps = rows.map((row) => Date.parse(row.receipt.observedAt)).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
}

function factFreshness(observedAt: string | null): VlmFreshness {
  if (!observedAt) return "unknown";
  const ageMs = Date.now() - Date.parse(observedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return "unknown";
  if (ageMs <= 15 * 60_000) return "fresh";
  if (ageMs <= 6 * 60 * 60_000) return "aging";
  return "stale";
}

function metricFact(
  id: string,
  label: string,
  value: unknown,
  receiptRows: ReceiptSourceRow[],
): VlmFact {
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : value == null ? null : sanitizeVlmText(value, 500);
  if (normalized === null) return { id, label, value: null, sourceIds: [], observedAt: null, freshness: "unknown", evidenceBindings: [], providerFamilyCount: 0, quorumState: "missing" };
  const expectedHash = pass4644FieldValueHash(normalized);
  const fieldPattern = FACT_FIELD_PATTERNS[id];
  const bindings = fieldPattern ? receiptRows.flatMap((row) => {
    const match = (row.receipt.fieldEvidence ?? []).find((field) => field.valueHash === expectedHash && fieldPattern.test(field.fieldPath));
    if (!match) return [];
    return [{
      sourceId: row.source.id,
      receiptId: row.receipt.receiptId,
      providerFamily: row.verdict.providerRootFamily!,
      fieldPath: match.fieldPath,
      capability: match.capability,
      valueHash: match.valueHash,
      observedAt: validIso(row.receipt.observedAt),
    }];
  }) : [];
  const exactRows = receiptRows.filter((row) => bindings.some((binding) => binding.receiptId === row.receipt.receiptId));
  const providerFamilies = new Set(bindings.map((binding) => binding.providerFamily));
  const observedAt = conservativeFactTime(exactRows);
  const freshness = factFreshness(observedAt);
  const quorumState: VlmFact["quorumState"] = bindings.length === 0
    ? "missing"
    : freshness === "stale" || freshness === "unknown"
      ? "stale"
      : providerFamilies.size >= 2
        ? "confirmed"
        : "single_source";
  return {
    id,
    label,
    value: normalized,
    sourceIds: Array.from(new Set(bindings.map((binding) => binding.sourceId))).slice(0, 8),
    observedAt,
    freshness,
    evidenceBindings: bindings.slice(0, 8),
    providerFamilyCount: providerFamilies.size,
    quorumState,
  };
}

function internalFact(id: string, label: string, value: unknown, observedAt: string): VlmFact {
  const normalized = typeof value === "number" && Number.isFinite(value) ? value : value == null ? null : sanitizeVlmText(value, 500);
  return {
    id,
    label,
    value: normalized,
    sourceIds: normalized === null ? [] : ["internal:risk-engine"],
    observedAt: normalized === null ? null : observedAt,
    freshness: normalized === null ? "unknown" : freshnessFromTime(observedAt, "live"),
    evidenceBindings: [],
    providerFamilyCount: 0,
    quorumState: normalized === null ? "missing" : "internal_only",
  };
}


function applyPacketConfidenceGovernor(input: {
  cap: number;
  dataQuality: TokenRiskResult["dataQuality"];
  sourceCount: number;
  providerCount: number;
  missingDataCount: number;
  conflictCount: number;
  quorumStatus: VlmSourceArbitration["evidenceQuorum"]["status"];
  sourceIntegrityStatus: VlmSourceArbitration["sourceIntegrity"]["status"];
  sourceIntegrityPenalty: number;
  temporalConsistencyStatus: VlmSourceArbitration["temporalConsistency"]["status"];
  temporalConsistencyPenalty: number;
}) {
  const reasons: string[] = [];
  let governed = Math.round(boundedNumber(input.cap, 8, 94, 28));

  if (input.dataQuality !== "live") {
    governed = Math.min(governed, input.dataQuality === "partial" ? 39 : 28);
    reasons.push(`Data quality is ${input.dataQuality}; public confidence is capped.`);
  }
  if (input.sourceCount < 2 || input.providerCount < 2) {
    governed = Math.min(governed, 39);
    reasons.push("Independent second source is missing; confidence cannot exceed fallback band.");
  }
  if (input.missingDataCount > 0) {
    const missingCap = input.missingDataCount === 1 ? 72 : input.missingDataCount === 2 ? 58 : 39;
    governed = Math.min(governed, missingCap);
    reasons.push(
      input.missingDataCount <= 2
        ? "Limited missing data is visible; confidence stays conditional instead of collapsing to a static 35 band."
        : "Multiple missing data lanes are present; confidence cannot exceed fallback band.",
    );
  }
  if (input.conflictCount > 0) {
    governed = Math.min(governed, 52);
    reasons.push("Conflicting evidence requires a conservative confidence cap.");
  }
  if (input.quorumStatus === "weak") {
    governed = Math.min(governed, 34);
    reasons.push("Evidence quorum is weak; AI cannot publish high-confidence conclusions.");
  } else if (input.quorumStatus === "mixed") {
    governed = Math.min(governed, 52);
    reasons.push("Evidence quorum is mixed; AI must keep conclusions conditional.");
  }
  if (input.sourceIntegrityStatus === "quarantined") {
    governed = Math.min(governed - input.sourceIntegrityPenalty, 28);
    reasons.push("Source Integrity Sentinel quarantined evidence; live confidence is blocked.");
  } else if (input.sourceIntegrityStatus === "degraded") {
    governed = Math.min(governed - Math.ceil(input.sourceIntegrityPenalty / 2), 44);
    reasons.push("Source Integrity Sentinel degraded evidence; confidence remains conditional.");
  }
  if (input.temporalConsistencyStatus === "invalid") {
    governed = Math.min(governed - input.temporalConsistencyPenalty, 24);
    reasons.push("Temporal Consistency Sentinel found invalid or future-dated evidence; live confidence is blocked.");
  } else if (input.temporalConsistencyStatus === "stale") {
    governed = Math.min(governed - Math.ceil(input.temporalConsistencyPenalty / 2), 34);
    reasons.push("Evidence Half-Life marks key facts as stale; AI cannot publish a live-strength conclusion.");
  } else if (input.temporalConsistencyStatus === "aging") {
    governed = Math.min(governed - Math.ceil(input.temporalConsistencyPenalty / 3), 52);
    reasons.push("Evidence Half-Life marks some facts as aging; AI must keep conclusions conditional.");
  }

  return { confidenceCap: Math.max(8, governed), reasons };
}

function normalizeConfidence(result: TokenRiskResult, brain: RiskBrainSnapshot) {
  const resultConfidence = typeof result.confidence === "number"
    ? result.confidence <= 1 ? result.confidence * 100 : result.confidence
    : 45;
  const brainConfidence = typeof brain.confidence === "number"
    ? brain.confidence <= 1 ? brain.confidence * 100 : brain.confidence
    : 34;
  const dataCap = result.dataQuality === "live" ? 88 : result.dataQuality === "partial" ? 62 : 34;
  const secondSourcePenalty = result.dataSources.length < 2 ? 12 : 0;
  return Math.round(boundedNumber(Math.min(resultConfidence, brainConfidence, dataCap) - secondSourcePenalty, 8, 94, 28));
}

export function buildCanonicalFactPacket(result: TokenRiskResult, brain: RiskBrainSnapshot): VlmCanonicalFactPacket {
  const observedAt = validIso(result.generatedAt);
  const receiptPlane = makeReceiptSources(result, observedAt);
  const sources = receiptPlane.sources;
  const allowedSourceIds = sources.map((source) => source.id);
  const deterministicSource = ["internal:risk-engine"];
  const baseConfidenceCap = normalizeConfidence(result, brain);
  const assetClass = result.token.assetClass ?? "crypto";
  const isTokenLikeAsset = assetClass === "crypto" || assetClass === "unknown";
  const facts = [
    internalFact("asset-class", "Asset class", assetClass, observedAt),
    metricFact("price", "Current price", result.metrics.currentPrice, receiptPlane.rows),
    metricFact("price-change-1h", "Price change 1h (%)", result.metrics.priceChange1h, receiptPlane.rows),
    metricFact("price-change-24h", "Price change 24h (%)", result.metrics.priceChange24h, receiptPlane.rows),
    metricFact("price-change-7d", "Price change 7d (%)", result.metrics.priceChange7d, receiptPlane.rows),
    metricFact("price-change-30d", "Price change 30d (%)", result.metrics.priceChange30d, receiptPlane.rows),
    metricFact("market-cap", assetClass === "index" ? "Reference level / index value" : "Market capitalization", result.metrics.marketCap, receiptPlane.rows),
    metricFact("fdv", "Fully diluted valuation", isTokenLikeAsset ? result.metrics.fdv : null, receiptPlane.rows),
    metricFact("volume-24h", "Volume 24h", result.metrics.volume24h, receiptPlane.rows),
    ...(isTokenLikeAsset ? [
      metricFact("liquidity-usd", "Liquidity (USD)", result.metrics.liquidityUsd, receiptPlane.rows),
      metricFact("holder-count", "Holder count", result.metrics.holderCount, receiptPlane.rows),
      metricFact("top10-holder-percent", "Top 10 holder concentration (%)", result.metrics.top10HolderPercent, receiptPlane.rows),
      metricFact("slippage-10k", "Simulated slippage at 10k", result.metrics.simulatedSlippage10k, receiptPlane.rows),
      metricFact("sell-tax", "Sell tax (%)", result.metrics.sellTaxPercentage, receiptPlane.rows),
    ] : [
      internalFact("venue-source-coverage", "Venue/source coverage", receiptPlane.quality.independentProviderFamilyCount >= 2 ? `${receiptPlane.quality.independentProviderFamilyCount} receipt-backed provider families` : null, observedAt),
    ]),
    internalFact("risk-score", "Deterministic risk score", brain.brainScore, observedAt),
  ];

  const conflictCount = result.metaModel?.conflictLevel && result.metaModel.conflictLevel !== "none" ? 1 : 0;
  const rawSourceArbitration = arbitrateVlmSources({ sources, facts, conflictCount, baseConfidenceCap });

  const preliminaryMissingData = Array.from(new Set([
    ...brain.missingData.map((item) => sanitizeVlmText(item, 220)),
    ...facts.filter((fact) => fact.value === null).map((fact) => fact.label),
    ...(receiptPlane.quality.independentProviderFamilyCount < 2 ? ["independent second receipt-backed provider family"] : []),
  ])).filter(Boolean);

  const governedConfidence = applyPacketConfidenceGovernor({
    cap: rawSourceArbitration.confidenceCap,
    dataQuality: result.dataQuality,
    sourceCount: rawSourceArbitration.sourceCount,
    providerCount: rawSourceArbitration.providerCount,
    missingDataCount: preliminaryMissingData.length,
    conflictCount,
    quorumStatus: rawSourceArbitration.evidenceQuorum.status,
    sourceIntegrityStatus: rawSourceArbitration.sourceIntegrity.status,
    sourceIntegrityPenalty: rawSourceArbitration.sourceIntegrity.confidencePenalty,
    temporalConsistencyStatus: rawSourceArbitration.temporalConsistency.status,
    temporalConsistencyPenalty: rawSourceArbitration.temporalConsistency.confidencePenalty,
  });
  const sourceArbitration = {
    ...rawSourceArbitration,
    confidenceCap: governedConfidence.confidenceCap,
    reasons: Array.from(new Set([
      ...rawSourceArbitration.reasons,
      ...governedConfidence.reasons,
    ])).slice(0, 12),
  };
  const preliminaryConfidenceCap = sourceArbitration.confidenceCap;
  const verdictGovernor = governVlmSourceVerdict({
    symbol: result.token.symbol,
    assetClass,
    contractAddress: result.token.tokenAddress,
    chainId: result.token.chainId,
    facts,
    sourceArbitration,
    deterministicScore: Math.round(boundedNumber(brain.brainScore, 0, 100, result.score)),
    confidenceCap: preliminaryConfidenceCap,
    dataQuality: result.dataQuality,
    conflictCount,
  });
  const confidenceCap = Math.min(sourceArbitration.confidenceCap, verdictGovernor.confidenceCap);
  sourceArbitration.confidenceCap = confidenceCap;
  sourceArbitration.reasons = Array.from(new Set([
    ...sourceArbitration.reasons,
    ...verdictGovernor.reasons,
  ])).slice(0, 16);
  const missingData = Array.from(new Set([
    ...preliminaryMissingData,
    ...(sourceArbitration.evidenceQuorum.status !== "strong" ? ["evidence quorum below strong threshold"] : []),
    ...(sourceArbitration.sourceIntegrity.status !== "trusted" ? [`source integrity ${sourceArbitration.sourceIntegrity.status}`] : []),
    ...(sourceArbitration.temporalConsistency.status !== "current" ? [`temporal consistency ${sourceArbitration.temporalConsistency.status}`] : []),
    ...(verdictGovernor.status !== "publishable" ? [`source verdict governor ${verdictGovernor.status}`] : []),
    ...verdictGovernor.missingProofLanes.map((lane) => `missing ${verdictGovernor.assetFamily} proof lane: ${lane}`),
    ...verdictGovernor.familyMismatchFlags.map((flag) => `asset family mismatch: ${flag}`),
    ...sourceArbitration.sourceIntegrity.reasons.slice(0, 6).map((reason) => `source integrity: ${reason}`),
    ...sourceArbitration.temporalConsistency.reasons.slice(0, 6).map((reason) => `temporal consistency: ${reason}`),
    ...sourceArbitration.temporalConsistency.staleFactIds.slice(0, 6).map((factId) => `stale temporal evidence for ${factId}`),
    ...sourceArbitration.evidenceQuorum.weakFactIds.slice(0, 6).map((factId) => `weak quorum for ${factId}`),
  ])).filter(Boolean).slice(0, 28);

  return {
    schemaVersion: "velmere.vlm.fact-packet.v1",
    asset: {
      id: sanitizeIdentifier(result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol, "unknown-asset"),
      symbol: sanitizeVlmText(result.token.symbol, 30) || "?",
      name: sanitizeVlmText(result.token.name, 140) || sanitizeVlmText(result.token.symbol, 30) || "Unknown asset",
      assetClass,
      chainId: result.token.chainId ? sanitizeVlmText(result.token.chainId, 60) : undefined,
      contractAddress: result.token.tokenAddress ? sanitizeVlmText(result.token.tokenAddress, 120) : undefined,
      family: verdictGovernor.assetFamily,
    },
    observedAt,
    dataQuality: result.dataQuality,
    deterministicScore: Math.round(boundedNumber(brain.brainScore, 0, 100, result.score)),
    deterministicVerdict: sanitizeVlmText(brain.verdict, 60),
    confidenceCap,
    sourceArbitration,
    facts,
    sources,
    signals: result.signals.slice(0, 24).map((signal) => ({
      id: sanitizeIdentifier(signal.id, "signal"), severity: signal.severity, points: boundedNumber(signal.points, 0, 100), sourceIds: deterministicSource,
    })),
    layers: brain.activeLayers.slice(0, 12).map((layer) => ({
      id: sanitizeIdentifier(layer.id, "layer"), label: sanitizeVlmText(layer.label, 100), score: Math.round(boundedNumber(layer.score, 0, 100)),
      confidence: Math.round(boundedNumber(layer.confidence <= 1 ? layer.confidence * 100 : layer.confidence, 0, 100)), state: sanitizeVlmText(layer.state, 40), evidence: layer.evidence.map((item) => sanitizeVlmText(item, 100)).slice(0, 10),
    })),
    conflicts: result.metaModel?.conflictLevel && result.metaModel.conflictLevel !== "none"
      ? [{ description: `Deterministic agents report ${result.metaModel.conflictLevel} evidence conflict.`, sourceIds: deterministicSource }]
      : [],
    missingData,
    nextChecks: Array.from(new Set([
      ...verdictGovernor.nextChecks,
      ...brain.nextActions.map((item) => sanitizeVlmText(item, 300)),
    ].filter(Boolean))).slice(0, 14),
    allowedSourceIds,
    verdictGovernor,
  };
}
