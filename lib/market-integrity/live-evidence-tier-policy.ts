import { createHash } from "node:crypto";
import { canonicalProviderFamily } from "./provider-family-identity";

export type LiveEvidenceProduct = "shield" | "real_markets";
export type LiveEvidenceTier = "basic" | "pro" | "advanced";
export type LiveEvidenceStatus =
  | "verified_live"
  | "verified_staging"
  | "verified_fixture"
  | "unavailable"
  | "failed";

export interface LiveEvidenceSourceReceipt {
  providerFamily: string;
  sourceId: string;
  observedAt: string;
  digest: string;
  live: boolean;
}

export interface LiveEvidenceLane {
  lane: string;
  status: LiveEvidenceStatus;
  observedAt: string;
  sourceReceipts: LiveEvidenceSourceReceipt[];
  evidenceDigest: string;
}

export interface LiveEvidencePacket {
  product: LiveEvidenceProduct;
  assetClass: string;
  assetId: string;
  requestedTier: LiveEvidenceTier;
  generatedAt: string;
  lanes: LiveEvidenceLane[];
  packetDigest?: string;
}

export interface LiveEvidenceTierDecision {
  requestedTier: LiveEvidenceTier;
  grantedTier: LiveEvidenceTier | null;
  state: "ready" | "downgraded" | "unavailable";
  coveragePercent: number;
  distinctProviderFamilies: number;
  liveLaneCount: number;
  requiredLaneCount: number;
  missingLanes: string[];
  invalidLanes: string[];
  reasons: string[];
  refundOrCreditRequired: boolean;
  evidencePacketDigest: string;
}

type TierRequirements = {
  minimumCoverage: number;
  minimumProviderFamilies: number;
  minimumLiveLanes: number;
  required: string[];
};

const COMMON: Record<LiveEvidenceTier, TierRequirements> = {
  basic: {
    minimumCoverage: 60,
    minimumProviderFamilies: 1,
    minimumLiveLanes: 2,
    required: ["asset_identity", "market_snapshot", "source_provenance"],
  },
  pro: {
    minimumCoverage: 76,
    minimumProviderFamilies: 2,
    minimumLiveLanes: 5,
    required: [
      "asset_identity",
      "market_snapshot",
      "source_provenance",
      "historical_context",
      "liquidity",
      "risk_findings",
      "provider_reconciliation",
    ],
  },
  advanced: {
    minimumCoverage: 88,
    minimumProviderFamilies: 3,
    minimumLiveLanes: 8,
    required: [
      "asset_identity",
      "market_snapshot",
      "source_provenance",
      "historical_context",
      "liquidity",
      "risk_findings",
      "provider_reconciliation",
      "stress_scenarios",
      "monitoring_plan",
      "evidence_ledger",
    ],
  },
};

const PRODUCT_REQUIRED: Record<LiveEvidenceProduct, Record<LiveEvidenceTier, string[]>> = {
  shield: {
    basic: ["token_or_coin_identity"],
    pro: ["supply_and_concentration", "onchain_or_native_security"],
    advanced: ["liquidity_stress", "contract_or_protocol_controls", "market_impact", "whale_watch", "invalidation_conditions"],
  },
  real_markets: {
    basic: ["instrument_identity"],
    pro: ["benchmark_context", "corporate_or_macro_context"],
    advanced: ["market_impact", "large_actor_watch", "event_calendar", "invalidation_conditions"],
  },
};

const TIER_ORDER: LiveEvidenceTier[] = ["basic", "pro", "advanced"];
const ACCEPTABLE_STATUS = new Set<LiveEvidenceStatus>(["verified_live", "verified_staging"]);
const MAX_AGE_MS: Record<LiveEvidenceTier, number> = {
  basic: 30 * 60_000,
  pro: 15 * 60_000,
  advanced: 10 * 60_000,
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalLiveEvidenceDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function requirements(product: LiveEvidenceProduct, tier: LiveEvidenceTier): TierRequirements {
  const common = COMMON[tier];
  const productLanes: string[] = [];
  for (const candidate of TIER_ORDER) {
    productLanes.push(...PRODUCT_REQUIRED[product][candidate]);
    if (candidate === tier) break;
  }
  return {
    ...common,
    required: [...new Set([...common.required, ...productLanes])],
  };
}

function laneIsValid(lane: LiveEvidenceLane, tier: LiveEvidenceTier, nowMs: number): boolean {
  if (!ACCEPTABLE_STATUS.has(lane.status)) return false;
  const observedMs = Date.parse(lane.observedAt);
  if (!Number.isFinite(observedMs) || nowMs - observedMs > MAX_AGE_MS[tier] || observedMs > nowMs + 60_000) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(lane.evidenceDigest)) return false;
  if (lane.sourceReceipts.length === 0) return false;
  return lane.sourceReceipts.every((receipt) => {
    const receiptObservedMs = Date.parse(receipt.observedAt);
    return canonicalProviderFamily(receipt.providerFamily).length > 0 &&
      receipt.sourceId.trim().length > 0 &&
      Number.isFinite(receiptObservedMs) &&
      receiptObservedMs <= nowMs + 60_000 &&
      nowMs - receiptObservedMs <= MAX_AGE_MS[tier] &&
      (lane.status !== "verified_live" || receipt.live === true) &&
      /^[a-f0-9]{64}$/i.test(receipt.digest);
  });
}

function assessTier(packet: LiveEvidencePacket, tier: LiveEvidenceTier, nowMs: number) {
  const rule = requirements(packet.product, tier);
  const laneMap = new Map(packet.lanes.map((lane) => [lane.lane, lane]));
  const missingLanes: string[] = [];
  const invalidLanes: string[] = [];
  const providerFamilies = new Set<string>();
  let liveLaneCount = 0;
  let validRequiredCount = 0;

  for (const requiredLane of rule.required) {
    const lane = laneMap.get(requiredLane);
    if (!lane) {
      missingLanes.push(requiredLane);
      continue;
    }
    if (!laneIsValid(lane, tier, nowMs)) {
      invalidLanes.push(requiredLane);
      continue;
    }
    validRequiredCount += 1;
    if (lane.status === "verified_live") liveLaneCount += 1;
    for (const receipt of lane.sourceReceipts) {
      const family = canonicalProviderFamily(receipt.providerFamily);
      if (family) providerFamilies.add(family);
    }
  }

  const coveragePercent = rule.required.length === 0
    ? 0
    : Math.floor((validRequiredCount / rule.required.length) * 100);
  const passes =
    missingLanes.length === 0 &&
    invalidLanes.length === 0 &&
    coveragePercent >= rule.minimumCoverage &&
    providerFamilies.size >= rule.minimumProviderFamilies &&
    liveLaneCount >= rule.minimumLiveLanes;

  return {
    passes,
    rule,
    missingLanes,
    invalidLanes,
    coveragePercent,
    distinctProviderFamilies: providerFamilies.size,
    liveLaneCount,
  };
}

export function evaluateLiveEvidenceTierPolicy(
  packet: LiveEvidencePacket,
  options: { now?: Date } = {},
): LiveEvidenceTierDecision {
  const nowMs = (options.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("invalid_now");
  if (packet.product !== "shield" && packet.product !== "real_markets") {
    throw new Error("unsupported_product");
  }
  if (!TIER_ORDER.includes(packet.requestedTier)) throw new Error("unsupported_tier");
  if (!packet.assetId.trim() || !packet.assetClass.trim()) throw new Error("missing_asset_identity");

  const packetForDigest = { ...packet, packetDigest: undefined };
  const evidencePacketDigest = canonicalLiveEvidenceDigest(packetForDigest);
  if (packet.packetDigest && packet.packetDigest !== evidencePacketDigest) {
    return {
      requestedTier: packet.requestedTier,
      grantedTier: null,
      state: "unavailable",
      coveragePercent: 0,
      distinctProviderFamilies: 0,
      liveLaneCount: 0,
      requiredLaneCount: requirements(packet.product, packet.requestedTier).required.length,
      missingLanes: [],
      invalidLanes: ["packet_digest_mismatch"],
      reasons: ["evidence_packet_integrity_failed"],
      refundOrCreditRequired: packet.requestedTier !== "basic",
      evidencePacketDigest,
    };
  }

  const requestedIndex = TIER_ORDER.indexOf(packet.requestedTier);
  const requestedAssessment = assessTier(packet, packet.requestedTier, nowMs);
  for (let index = requestedIndex; index >= 0; index -= 1) {
    const candidate = TIER_ORDER[index];
    const assessment = candidate === packet.requestedTier
      ? requestedAssessment
      : assessTier(packet, candidate, nowMs);
    if (!assessment.passes) continue;
    const downgraded = candidate !== packet.requestedTier;
    const reasons: string[] = [];
    if (downgraded) {
      reasons.push(
        ...requestedAssessment.missingLanes.map((lane) => `missing:${lane}`),
        ...requestedAssessment.invalidLanes.map((lane) => `invalid:${lane}`),
        "requested_tier_evidence_gate_failed",
      );
    }
    return {
      requestedTier: packet.requestedTier,
      grantedTier: candidate,
      state: downgraded ? "downgraded" : "ready",
      coveragePercent: assessment.coveragePercent,
      distinctProviderFamilies: assessment.distinctProviderFamilies,
      liveLaneCount: assessment.liveLaneCount,
      requiredLaneCount: assessment.rule.required.length,
      missingLanes: requestedAssessment.missingLanes,
      invalidLanes: requestedAssessment.invalidLanes,
      reasons,
      refundOrCreditRequired: downgraded,
      evidencePacketDigest,
    };
  }

  return {
    requestedTier: packet.requestedTier,
    grantedTier: null,
    state: "unavailable",
    coveragePercent: requestedAssessment.coveragePercent,
    distinctProviderFamilies: requestedAssessment.distinctProviderFamilies,
    liveLaneCount: requestedAssessment.liveLaneCount,
    requiredLaneCount: requestedAssessment.rule.required.length,
    missingLanes: requestedAssessment.missingLanes,
    invalidLanes: requestedAssessment.invalidLanes,
    reasons: [
      ...requestedAssessment.missingLanes.map((lane) => `missing:${lane}`),
      ...requestedAssessment.invalidLanes.map((lane) => `invalid:${lane}`),
      "basic_evidence_gate_failed",
    ],
    refundOrCreditRequired: packet.requestedTier !== "basic",
    evidencePacketDigest,
  };
}

export function assertLiveEvidencePacketIntegrity(packet: LiveEvidencePacket): string {
  const actual = canonicalLiveEvidenceDigest({ ...packet, packetDigest: undefined });
  if (!packet.packetDigest || packet.packetDigest !== actual) {
    throw new Error("evidence_packet_digest_mismatch");
  }
  return actual;
}
