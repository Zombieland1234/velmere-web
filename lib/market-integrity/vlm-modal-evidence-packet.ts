import { assessEvidenceTimestamp, independentProviderFamilies } from "@/lib/ai/evidence-normalization";
import { parseRiskScore } from "@/lib/market-integrity/risk-score-availability";

export type VlmModalEvidenceTier = "Basic" | "Pro" | "Advanced";

export type VlmModalEvidenceInput = {
  symbol: string;
  name: string;
  assetClassLabel?: string | null;
  exchangeLabel?: string | null;
  priceLabel?: string | null;
  changeLabel?: string | null;
  sourceLabel?: string | null;
  sourceTimeLabel?: string | null;
  observedAt?: string | number | null;
  providerLabels?: Array<string | null | undefined>;
  currencyLabel?: string | null;
  marketStatusLabel?: string | null;
  confidenceLabel?: string | null;
  /** Prefer the typed score. `riskLabel` remains a presentation-compatible fallback. */
  riskScore?: number | null;
  riskLabel?: string | null;
  candles?: Array<{ timestamp?: number; open?: number; high?: number; low?: number; close?: number; volume?: number | null }>;
};

export type VlmModalEvidenceLaneState = "confirmed" | "limited" | "missing" | "locked";

export type VlmModalEvidenceLane = {
  id: string;
  label: string;
  state: VlmModalEvidenceLaneState;
  reason: string;
  requiredFor: VlmModalEvidenceTier[];
};

export type VlmModalEvidencePacket = {
  schemaVersion: "velmere.modal.evidence-packet.v1";
  tier: VlmModalEvidenceTier;
  symbol: string;
  fieldBudget: number;
  sourceBudget: number;
  riskScore: number | null;
  riskState: "available" | "unavailable";
  evidenceCoverageCap: number;
  sourceCount: number;
  confirmedCount: number;
  limitedCount: number;
  missingCount: number;
  lockedCount: number;
  sourceSummary: string;
  coverageGrade: "Ready" | "Partial" | "Evidence-limited";
  tierDelta: string;
  nextMissingLane: string | null;
  missingData: string[];
  lanes: VlmModalEvidenceLane[];
  claimPolicy: {
    liquidityClaimsAllowed: boolean;
    holderClaimsAllowed: boolean;
    contractClaimsAllowed: boolean;
    crossVenueClaimsAllowed: boolean;
    publicRule: string;
  };
};

const TIER_FIELD_BUDGET: Record<VlmModalEvidenceTier, number> = {
  Basic: 10,
  Pro: 14,
  Advanced: 20,
};

const TIER_SOURCE_BUDGET: Record<VlmModalEvidenceTier, number> = {
  Basic: 1,
  Pro: 2,
  Advanced: 3,
};

function clean(value?: string | null) {
  return String(value ?? "").trim();
}

function hasPrice(input: VlmModalEvidenceInput) {
  const label = clean(input.priceLabel);
  return Boolean(label && label !== "—" && !/^n\/?a$/i.test(label));
}

function hasCandles(input: VlmModalEvidenceInput) {
  return (input.candles ?? []).filter((candle) =>
    typeof candle.close === "number" && Number.isFinite(candle.close) &&
    typeof candle.timestamp === "number" && Number.isFinite(candle.timestamp),
  ).length >= 8;
}

function hasVolume(input: VlmModalEvidenceInput) {
  return (input.candles ?? []).some((candle) => typeof candle.volume === "number" && Number.isFinite(candle.volume) && candle.volume > 0);
}

function splitProviderLabels(value: string) {
  return value
    .split(/\s*(?:\+|,|;|\||\bvs\.?\b|\bversus\b|\band\b|&)\s*/iu)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sourceLabelProviderCandidates(value: string) {
  return splitProviderLabels(value).filter((entry) => !/(?:order\s*book|orderbook|depth|spread|slippage|holder|supply|unlock|treasury|issuance|float|contract|proxy|mint|blacklist|owner|admin|governance|rug|honeypot|liquidity\s*lock|pool|sell\s*tax|funding|open\s*interest|liquidation|perp|futures|basis)/iu.test(entry));
}

function providerFamilies(input: VlmModalEvidenceInput) {
  const explicit = (input.providerLabels ?? []).map((entry) => clean(entry)).filter(Boolean);
  const candidates = explicit.length > 0 ? explicit : sourceLabelProviderCandidates(clean(input.sourceLabel));
  return independentProviderFamilies(candidates);
}

function hasSource(input: VlmModalEvidenceInput) { return providerFamilies(input).length > 0; }

function sourceTimestampAssessment(input: VlmModalEvidenceInput) {
  const observedAt = input.observedAt;
  if (typeof observedAt === "number" && Number.isFinite(observedAt)) return assessEvidenceTimestamp(new Date(observedAt).toISOString());
  if (typeof observedAt === "string" && observedAt.trim()) return assessEvidenceTimestamp(observedAt);
  const label = clean(input.sourceTimeLabel);
  if (!label) return assessEvidenceTimestamp(null);
  const absolute = assessEvidenceTimestamp(label);
  if (absolute.state !== "invalid") return absolute;
  if (/^(?:now|just now|live|current|request now|stream now)$/iu.test(label)) return { state: "fresh", observedAt: null, ageMinutes: 0, futureSkewSeconds: 0 } as const;
  const relative = label.match(/(\d+)\s*(?:m|min|mins|minute|minutes|minut|minuty|minuten)\b/iu);
  if (relative) {
    const ageMinutes = Number(relative[1]);
    const state = ageMinutes <= 5 ? "fresh" : ageMinutes <= 30 ? "aging" : "stale";
    return { state, observedAt: null, ageMinutes, futureSkewSeconds: 0 } as const;
  }
  return absolute;
}

function hasOrderbook(input: VlmModalEvidenceInput) {
  const haystack = `${input.sourceLabel ?? ""} ${input.exchangeLabel ?? ""}`.toLowerCase();
  return /order\s*book|orderbook|depth|spread|slippage/.test(haystack);
}

function hasCrossVenue(input: VlmModalEvidenceInput) {
  return providerFamilies(input).length >= 2;
}

function hasHolderSupply(input: VlmModalEvidenceInput) {
  const haystack = `${input.sourceLabel ?? ""} ${input.assetClassLabel ?? ""}`.toLowerCase();
  return /holder|supply|unlock|treasury|issuance|float/.test(haystack);
}

function hasContractAdmin(input: VlmModalEvidenceInput) {
  const haystack = `${input.sourceLabel ?? ""} ${input.assetClassLabel ?? ""}`.toLowerCase();
  return /contract|proxy|mint|blacklist|owner|admin|governance/.test(haystack);
}

function hasRugPullTrapEvidence(input: VlmModalEvidenceInput) {
  const haystack = `${input.sourceLabel ?? ""} ${input.assetClassLabel ?? ""} ${input.exchangeLabel ?? ""}`.toLowerCase();
  return /rug|honeypot|blacklist|mint|owner|admin|lp\s*lock|liquidity\s*lock|pool\s*withdraw|sell\s*tax|proxy|contract/.test(haystack);
}

function hasLongShortSqueezeEvidence(input: VlmModalEvidenceInput) {
  const haystack = `${input.sourceLabel ?? ""} ${input.assetClassLabel ?? ""} ${input.exchangeLabel ?? ""} ${input.marketStatusLabel ?? ""}`.toLowerCase();
  return /squeeze|long|short|funding|open\s*interest|oi\b|liquidation|perp|futures|basis|depth|order\s*book|orderbook/.test(haystack);
}

function lane(state: VlmModalEvidenceLaneState, id: string, label: string, reason: string, requiredFor: VlmModalEvidenceTier[]): VlmModalEvidenceLane {
  return { id, label, state, reason, requiredFor };
}



export function buildVlmModalEvidencePacket(input: VlmModalEvidenceInput & { tier: VlmModalEvidenceTier }): VlmModalEvidencePacket {
  const tier = input.tier;
  const families = providerFamilies(input);
  const sourceCount = families.length;
  const timestamp = sourceTimestampAssessment(input);
  const risk = input.riskScore === undefined
    ? parseRiskScore(input.riskLabel)
    : parseRiskScore(input.riskScore);
  const lanes: VlmModalEvidenceLane[] = [
    lane(hasPrice(input) ? "confirmed" : "missing", "price", "Price feed", hasPrice(input) ? "Provider supplied a usable price." : "Provider did not supply a usable price.", ["Basic", "Pro", "Advanced"]),
    lane(hasSource(input) ? "confirmed" : "missing", "primary-source", "Primary source", hasSource(input) ? `Independent provider family: ${families[0]}.` : "No external provider family is attached.", ["Basic", "Pro", "Advanced"]),
    lane(hasCandles(input) ? "confirmed" : "limited", "candles", "Candle history", hasCandles(input) ? "Candle series is present for chart-derived structure." : "Candle series is too sparse for a strong structure read.", ["Basic", "Pro", "Advanced"]),
    lane(risk === null ? "missing" : "confirmed", "risk-score", "Risk score", risk === null ? "No explicit 0..100 risk score is attached; no default score is permitted." : `Explicit risk score ${risk}/100 is attached.`, ["Basic", "Pro", "Advanced"]),
    lane(hasVolume(input) ? "limited" : "missing", "volume", "Volume context", hasVolume(input) ? "Volume exists in candles but still does not equal order-book liquidity." : "Volume lane is not attached in the visible packet.", ["Pro", "Advanced"]),
    lane(timestamp.state === "fresh" || timestamp.state === "aging" ? "confirmed" : timestamp.state === "stale" ? "limited" : "missing", "timestamp", "Freshness timestamp", timestamp.state === "fresh" || timestamp.state === "aging" ? `Timestamp state: ${timestamp.state}.` : timestamp.state === "stale" ? "The timestamp is stale; freshness-dependent claims stay limited." : `Timestamp state ${timestamp.state}; freshness-dependent claims are blocked.`, ["Pro", "Advanced"]),
    lane(sourceCount >= 2 ? "confirmed" : "missing", "provider-quorum", "Independent provider quorum", `${sourceCount}/2 independent provider families attached.`, ["Pro", "Advanced"]),
    lane(sourceCount >= 3 ? "confirmed" : "missing", "advanced-provider-quorum", "Advanced provider quorum", `${sourceCount}/3 independent provider families attached.`, ["Advanced"]),
    lane(hasOrderbook(input) ? "confirmed" : "missing", "orderbook", "Order-book / spread", hasOrderbook(input) ? "Depth/spread proof is attached." : "Depth, spread and slippage proof are not attached.", ["Advanced"]),
    lane(hasCrossVenue(input) ? "confirmed" : "missing", "cross-venue", "Cross-venue check", hasCrossVenue(input) ? `${families.slice(0, 3).join(" + ")} are independent provider families.` : "A second independent provider family is required before cross-venue claims.", ["Advanced"]),
    lane(hasHolderSupply(input) ? "confirmed" : "locked", "holders-supply", "Holder / supply lane", hasHolderSupply(input) ? "Holder/supply data is attached." : "Requires holder, unlock, treasury or issuance source.", ["Advanced"]),
    lane(hasContractAdmin(input) ? "confirmed" : "locked", "contract-admin", "Contract / admin lane", hasContractAdmin(input) ? "Contract/admin evidence is attached." : "Requires contract, proxy, mint, blacklist or governance evidence where relevant.", ["Advanced"]),
    lane(hasRugPullTrapEvidence(input) ? "confirmed" : "locked", "rug-pull-trap", "Rug-pull / trap scenario", hasRugPullTrapEvidence(input) ? "Contract/liquidity trap evidence appears in the attached source labels." : "Requires contract security, holder graph, LP/pool lock and tax/honeypot evidence before any rug-pull/trap wording.", ["Advanced"]),
    lane(hasLongShortSqueezeEvidence(input) ? "confirmed" : "locked", "long-short-squeeze", "Long/short squeeze scenario", hasLongShortSqueezeEvidence(input) ? "Squeeze/depth/derivatives evidence appears in the attached source labels." : "Requires depth, open interest, funding, liquidation and venue data before squeeze wording.", ["Pro", "Advanced"]),
  ];

  const visibleLanes = tier === "Basic"
    ? lanes.filter((item) => item.requiredFor.includes("Basic"))
    : tier === "Pro"
      ? lanes.filter((item) => item.requiredFor.includes("Basic") || item.requiredFor.includes("Pro"))
      : lanes;

  const missingData = visibleLanes
    .filter((item) => item.state === "missing" || item.state === "locked")
    .map((item) => item.label)
    .slice(0, tier === "Advanced" ? 12 : tier === "Pro" ? 8 : 4);

  const confirmedCount = visibleLanes.filter((item) => item.state === "confirmed").length;
  const limitedCount = visibleLanes.filter((item) => item.state === "limited").length;
  const missingCount = visibleLanes.filter((item) => item.state === "missing").length;
  const lockedCount = visibleLanes.filter((item) => item.state === "locked").length;
  // Deterministic tier-evidence coverage only. This is not a calibrated probability or calibrated confidence and must
  // not be changed by risk direction/severity or arbitrary tier floors. Confirmed lanes
  // contribute 1.0, limited lanes 0.5, missing/locked lanes 0.0.
  const evidenceCoverageCap = visibleLanes.length
    ? Math.round(((confirmedCount + limitedCount * 0.5) / visibleLanes.length) * 100)
    : 0;
  const gapCount = missingCount + lockedCount;
  const coverageGrade = gapCount > 0 ? "Evidence-limited" : limitedCount > 0 ? "Partial" : "Ready";
  const tierDelta = tier === "Advanced"
    ? "Advanced exposes paid-depth lanes: order-book, cross-venue, holder/supply, contract/admin, rug-pull/trap, long/short squeeze and narrative gaps. It must not upgrade evidence coverage unless those lanes are attached."
    : tier === "Pro"
      ? "Pro adds structure, volume/freshness, feed-health and squeeze-watch lanes as unconfirmed pressure. It is deeper than Basic, but still blocks paid-depth claims without source proof."
      : "Basic is a 10-field identity, price, source and missing-data read. It intentionally keeps paid-depth lanes out of the claim set.";
  const nextMissingLane = visibleLanes.find((item) => item.state === "missing" || item.state === "locked")?.label ?? null;

  return {
    schemaVersion: "velmere.modal.evidence-packet.v1",
    tier,
    symbol: clean(input.symbol).toUpperCase() || "ASSET",
    fieldBudget: TIER_FIELD_BUDGET[tier],
    sourceBudget: TIER_SOURCE_BUDGET[tier],
    riskScore: risk,
    riskState: risk === null ? "unavailable" : "available",
    evidenceCoverageCap,
    sourceCount,
    confirmedCount,
    limitedCount,
    missingCount,
    lockedCount,
    sourceSummary: `${sourceCount} independent provider famil${sourceCount === 1 ? "y" : "ies"} attached · ${TIER_SOURCE_BUDGET[tier]} tier target`,
    coverageGrade,
    tierDelta,
    nextMissingLane,
    missingData,
    lanes: visibleLanes,
    claimPolicy: {
      liquidityClaimsAllowed: hasOrderbook(input),
      holderClaimsAllowed: hasHolderSupply(input),
      contractClaimsAllowed: hasContractAdmin(input) && hasRugPullTrapEvidence(input),
      crossVenueClaimsAllowed: hasCrossVenue(input),
      publicRule: "No claim can be stronger than its attached source lane. Missing evidence must stay visible.",
    },
  };
}
