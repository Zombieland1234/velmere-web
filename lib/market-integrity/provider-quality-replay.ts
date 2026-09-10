import { createHash } from "node:crypto";
import type { VelmereMarketAssetClass } from "./risk-types";
import {
  isPass4644CommerciallyFreshReceipt,
  pass4644CanonicalReceiptDigest,
  type Pass4644ProviderEvidenceReceipt,
  type Pass4644ProviderSurface,
} from "./provider-evidence-receipt";
import type { Pass4645ProviderEvidenceLedger } from "./provider-evidence-ledger";
import { verifyPass4645ProviderEvidenceLedger } from "./provider-evidence-ledger";
import { canonicalProviderRootFamily } from "./provider-quorum-reconciliation";
import type { Pass4650EvidenceCategory } from "./provider-evidence-contract";

export type { Pass4650EvidenceCategory } from "./provider-evidence-contract";

export type Pass4650Tier = "basic" | "pro" | "advanced";
export type Pass4650EvidenceProfile = "market" | "contract_audit";

export type Pass4650ReceiptRuntimeVerdict = {
  receiptId: string;
  providerId: string;
  providerFamily: string;
  providerRootFamily: string | null;
  accepted: boolean;
  independent: boolean;
  categories: Pass4650EvidenceCategory[];
  blockers: string[];
  warnings: string[];
};

export type Pass4650AcceptedReceiptBinding = {
  receiptId: string;
  providerId: string;
  providerRootFamily: string;
  surface: Pass4644ProviderSurface;
  payloadHash: string;
  receiptCanonicalDigest: string;
};

export type Pass4650ProviderQualitySnapshot = {
  schemaVersion: "pass4650_provider_quality_snapshot_v1";
  requestedIdentity: string;
  requestedIdentityAliases: string[];
  assetClass: VelmereMarketAssetClass;
  evidenceProfile: Pass4650EvidenceProfile;
  generatedAt: string;
  receiptCount: number;
  runtimeAcceptedReceiptCount: number;
  independentReceiptCount: number;
  independentProviderCount: number;
  independentProviderFamilyCount: number;
  independentProviders: string[];
  independentProviderFamilies: string[];
  acceptedReceiptBindings: Pass4650AcceptedReceiptBinding[];
  evidenceCategories: Pass4650EvidenceCategory[];
  corroboratedCategories: Pass4650EvidenceCategory[];
  mirroredPayloadHashes: string[];
  duplicateReceiptIds: string[];
  futureTimestampReceiptIds: string[];
  expiredReceiptIds: string[];
  rejectedReceiptIds: string[];
  qualityScore: number;
  commerciallyUsable: boolean;
  replayFingerprint: string;
  tierResilience: Record<Pass4650Tier, {
    fallbackTier: "none" | "basic" | "pro";
    survivesAnySingleFamilyOutage: boolean;
    failingFamilies: string[];
  }>;
  verdicts: Pass4650ReceiptRuntimeVerdict[];
  blockers: string[];
  warnings: string[];
};

export type Pass4650ReplayManifest = {
  schemaVersion: "pass4650_provider_replay_manifest_v1";
  requestedIdentity: string;
  requestedIdentityAliases: string[];
  assetClass: VelmereMarketAssetClass;
  evidenceProfile: Pass4650EvidenceProfile;
  ledgerId: string | null;
  ledgerHeadHash: string | null;
  ledgerRequestedIdentity: string | null;
  ledgerSurface: Pass4644ProviderSurface | null;
  ledgerDepth: "basic" | "pro" | "advanced" | null;
  ledgerEligibleReceiptCount: number;
  receiptFingerprint: string;
  acceptedReceiptBindingDigest: string;
  acceptedReceiptCount: number;
  independentReceiptCount: number;
  independentProviderFamilyCount: number;
  evidenceCategories: Pass4650EvidenceCategory[];
  generatedAt: string;
  manifestHash: string;
};

const MARKET_TIER_THRESHOLDS = {
  basic: { receipts: 2, families: 1, categories: 2 },
  pro: { receipts: 6, families: 2, categories: 4 },
  advanced: { receipts: 10, families: 3, categories: 6 },
} as const;

const CONTRACT_AUDIT_TIER_THRESHOLDS = {
  basic: { receipts: 1, families: 1, categories: 1 },
  pro: { receipts: 4, families: 3, categories: 4 },
  advanced: { receipts: 5, families: 4, categories: 5 },
} as const;

function thresholdsFor(profile: Pass4650EvidenceProfile) {
  return profile === "contract_audit" ? CONTRACT_AUDIT_TIER_THRESHOLDS : MARKET_TIER_THRESHOLDS;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedIdentity(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:._^=\-/]+/g, "").replace(/-usd$/, "");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function pass4650CategoryForCapability(capability: string): Pass4650EvidenceCategory | null {
  const value = capability.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/identity|symbol|address|chain_context|protocol_identity/.test(value)) return "identity";
  if (/price|quote|market_cap|volume|ohlc/.test(value)) return "market";
  if (/liquidity|tvl|pool|slippage|depth|spread/.test(value)) return "liquidity";
  if (/holder|ownership|treasury|whale/.test(value)) return "holders_ownership";
  if (/permission|honeypot|tax|mint|blacklist|proxy|upgrade|abi|source_code|verified_source|bytecode|static_analysis/.test(value)) return "contract_permissions";
  if (/supply|unlock|emission|fdv|tokenomic/.test(value)) return "supply_tokenomics";
  if (/filing|fundamental|earnings|balance_sheet|cash_flow/.test(value)) return "fundamentals_filings";
  if (/macro|rate|yield|inflation|employment|central_bank/.test(value)) return "macro_rates";
  if (/orderbook|derivative|funding|open_interest|imbalance|microstructure/.test(value)) return "derivatives_microstructure";
  if (/history|volatility|drawdown|ath|time_series/.test(value)) return "history_volatility";
  if (/scenario|dependency|stress|correlation|contagion|simulation/.test(value)) return "scenario_dependency";
  return null;
}

function requiredCategories(assetClass: VelmereMarketAssetClass, tier: Pass4650Tier, profile: Pass4650EvidenceProfile): Pass4650EvidenceCategory[] {
  if (profile === "contract_audit") {
    if (tier === "basic") return ["identity"];
    if (tier === "pro") return ["identity", "contract_permissions", "liquidity", "holders_ownership"];
    return ["identity", "contract_permissions", "liquidity", "holders_ownership", "scenario_dependency"];
  }
  if (tier === "basic") return ["identity", "market"];
  if (assetClass === "crypto" || assetClass === "unknown") {
    return tier === "pro"
      ? ["identity", "market", "liquidity", "holders_ownership"]
      : ["identity", "market", "liquidity", "holders_ownership", "contract_permissions", "scenario_dependency"];
  }
  if (["fx", "commodity", "index"].includes(assetClass)) {
    return tier === "pro"
      ? ["identity", "market", "history_volatility", "macro_rates"]
      : ["identity", "market", "history_volatility", "macro_rates", "derivatives_microstructure", "scenario_dependency"];
  }
  return tier === "pro"
    ? ["identity", "market", "history_volatility", "fundamentals_filings"]
    : ["identity", "market", "history_volatility", "fundamentals_filings", "macro_rates", "scenario_dependency"];
}

function receiptRuntimeVerdict(args: {
  receipt: Pass4644ProviderEvidenceReceipt;
  requestedIdentity: string;
  requestedIdentityAliases: string[];
  nowMs: number;
  maxClockSkewMs: number;
  maxLatencyMs: number;
}): Pass4650ReceiptRuntimeVerdict {
  const { receipt, requestedIdentity, requestedIdentityAliases, nowMs, maxClockSkewMs, maxLatencyMs } = args;
  const observedMs = Date.parse(receipt.observedAt);
  const receivedMs = Date.parse(receipt.receivedAt);
  const expiresMs = Date.parse(receipt.expiresAt);
  const categories = unique(receipt.capabilities.map(pass4650CategoryForCapability).filter((value): value is Pass4650EvidenceCategory => Boolean(value))).sort();
  const continuity = receipt.continuity;
  const providerRootFamily = canonicalProviderRootFamily(receipt) || null;
  const continuityGraceMs = continuity ? Date.parse(continuity.graceExpiresAt) - Date.parse(continuity.originalObservedAt) : 0;
  const expectedIdentityTokens = new Set([requestedIdentity, ...requestedIdentityAliases].map(normalizedIdentity).filter(Boolean));
  const receiptIdentityTokens = [
    receipt.identity.requested,
    receipt.identity.resolvedSymbol,
    receipt.identity.resolvedMarketId,
    receipt.identity.resolvedAddress,
  ].map(normalizedIdentity).filter(Boolean);
  const identityBoundToRequest = requestedIdentityAliases.length === 0
    ? normalizedIdentity(receipt.identity.requested) === normalizedIdentity(requestedIdentity)
    : receiptIdentityTokens.length > 0 && receiptIdentityTokens.every((identity) => expectedIdentityTokens.has(identity));
  const continuityBlockers = continuity ? [
    continuity.schemaVersion !== "pass4653_continuity_receipt_v1" ? "continuity_schema_invalid" : null,
    !/^p4644_[a-f0-9]{24}$/i.test(continuity.replayedFromReceiptId) ? "continuity_origin_receipt_invalid" : null,
    !/^[a-f0-9]{64}$/i.test(continuity.snapshotHash) ? "continuity_snapshot_hash_invalid" : null,
    continuity.originalObservedAt !== receipt.observedAt ? "continuity_observed_at_mismatch" : null,
    continuity.graceExpiresAt !== receipt.expiresAt ? "continuity_grace_expiry_mismatch" : null,
    !Number.isFinite(continuityGraceMs) || continuityGraceMs <= 0 ? "continuity_grace_invalid" : null,
    Date.parse(continuity.replayedAt) > nowMs + maxClockSkewMs ? "continuity_replayed_at_from_future" : null,
  ] : [];
  const blockers = unique([
    receipt.schemaVersion !== "pass4644_provider_evidence_receipt_v1" ? "receipt_schema_invalid" : null,
    receipt.verification === "health_only" ? "health_only_not_evidence" : null,
    receipt.state !== "confirmed" ? `receipt_state_${receipt.state}` : null,
    receipt.commercialEvidenceEligible !== true ? "receipt_not_marked_commercial_eligible" : null,
    receipt.timestampProvenance !== "provider" ? `provider_timestamp_provenance_${receipt.timestampProvenance ?? "missing"}` : null,
    !providerRootFamily ? "provider_root_family_unknown" : null,
    !isPass4644CommerciallyFreshReceipt(receipt) ? "receipt_not_provider_fresh" : null,
    receipt.identity.matched !== true ? "asset_identity_mismatch" : null,
    !identityBoundToRequest ? "requested_identity_mismatch" : null,
    !Number.isFinite(observedMs) ? "observed_at_invalid" : null,
    !Number.isFinite(receivedMs) ? "received_at_invalid" : null,
    !Number.isFinite(expiresMs) ? "expires_at_invalid" : null,
    Number.isFinite(observedMs) && observedMs > nowMs + maxClockSkewMs ? "observed_at_from_future" : null,
    Number.isFinite(receivedMs) && receivedMs > nowMs + maxClockSkewMs ? "received_at_from_future" : null,
    Number.isFinite(expiresMs) && expiresMs < nowMs ? "receipt_expired_at_replay" : null,
    receipt.httpStatus < 200 || receipt.httpStatus >= 300 ? `http_status_${receipt.httpStatus}` : null,
    !/^[a-f0-9]{64}$/i.test(receipt.payloadHash) ? "payload_hash_invalid" : null,
    receipt.payloadBytes <= 2 ? "payload_empty" : null,
    categories.length === 0 ? "capability_category_missing" : null,
    ...(receipt.rejectionReasons ?? []).map((reason) => `receipt_rejection:${reason}`),
    ...continuityBlockers,
  ].filter((value): value is string => Boolean(value)));
  const warnings = unique([
    receipt.latencyMs > maxLatencyMs ? `provider_latency_high:${receipt.latencyMs}/${maxLatencyMs}` : null,
    receipt.payloadBytes < 32 ? `provider_payload_small:${receipt.payloadBytes}/32` : null,
    receipt.capabilities.length === 1 ? "single_capability_receipt" : null,
    continuity ? `continuity_cache_replay:${continuity.reason}` : null,
  ].filter((value): value is string => Boolean(value)));
  return {
    receiptId: receipt.receiptId,
    providerId: receipt.providerId,
    providerFamily: receipt.providerFamily,
    providerRootFamily,
    accepted: blockers.length === 0,
    independent: false,
    categories,
    blockers,
    warnings,
  };
}

function meetsTier(args: {
  tier: Pass4650Tier;
  receipts: Array<{ providerFamily: string; categories: Pass4650EvidenceCategory[] }>;
  assetClass: VelmereMarketAssetClass;
  evidenceProfile: Pass4650EvidenceProfile;
}) {
  const threshold = thresholdsFor(args.evidenceProfile)[args.tier];
  const families = unique(args.receipts.map((item) => item.providerFamily));
  const categories = unique(args.receipts.flatMap((item) => item.categories));
  const required = requiredCategories(args.assetClass, args.tier, args.evidenceProfile);
  return args.receipts.length >= threshold.receipts &&
    families.length >= threshold.families &&
    categories.length >= threshold.categories &&
    required.every((category) => categories.includes(category));
}

export function buildPass4650ProviderQualitySnapshot(args: {
  receipts?: Pass4644ProviderEvidenceReceipt[] | null;
  requestedIdentity: string;
  /** Known symbol/market/address aliases for one asset; all populated receipt identities must remain inside this set. */
  requestedIdentityAliases?: string[] | null;
  assetClass?: VelmereMarketAssetClass | null;
  now?: string | Date;
  maxClockSkewMs?: number;
  maxLatencyMs?: number;
  evidenceProfile?: Pass4650EvidenceProfile;
}): Pass4650ProviderQualitySnapshot {
  const receipts = args.receipts ?? [];
  const requestedIdentity = normalizedIdentity(args.requestedIdentity) || "unknown";
  const requestedIdentityAliases = unique((args.requestedIdentityAliases ?? []).map(normalizedIdentity).filter(Boolean));
  const recordedIdentityAliases = unique([requestedIdentity, ...requestedIdentityAliases]).sort();
  const assetClass = args.assetClass ?? "unknown";
  const evidenceProfile = args.evidenceProfile ?? "market";
  const now = args.now instanceof Date ? args.now : args.now ? new Date(args.now) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const nowMs = safeNow.getTime();
  const maxClockSkewMs = Math.max(0, args.maxClockSkewMs ?? 120_000);
  const maxLatencyMs = Math.max(1_000, args.maxLatencyMs ?? 30_000);

  const seenReceiptIds = new Set<string>();
  const duplicateReceiptIds: string[] = [];
  const verdicts = receipts.map((receipt) => {
    const verdict = receiptRuntimeVerdict({ receipt, requestedIdentity, requestedIdentityAliases, nowMs, maxClockSkewMs, maxLatencyMs });
    if (seenReceiptIds.has(receipt.receiptId)) {
      verdict.blockers.push("duplicate_receipt_id");
      verdict.accepted = false;
      duplicateReceiptIds.push(receipt.receiptId);
    }
    seenReceiptIds.add(receipt.receiptId);
    return verdict;
  });

  const payloadFamilies = new Map<string, Set<string>>();
  for (const [index, receipt] of receipts.entries()) {
    const verdict = verdicts[index];
    if (!verdict?.accepted || !verdict.providerRootFamily) continue;
    const families = payloadFamilies.get(receipt.payloadHash) ?? new Set<string>();
    families.add(verdict.providerRootFamily);
    payloadFamilies.set(receipt.payloadHash, families);
  }
  const mirroredPayloadHashes = Array.from(payloadFamilies.entries())
    .filter(([, families]) => families.size > 1)
    .map(([hash]) => hash)
    .sort();

  const seenProviderPayload = new Set<string>();
  const seenPayloadAcrossFamilies = new Set<string>();
  const seenProviderRoots = new Set<string>();
  const independentIndexes: number[] = [];
  for (const [index, receipt] of receipts.entries()) {
    const verdict = verdicts[index];
    if (!verdict?.accepted || !verdict.providerRootFamily) continue;
    if (seenProviderRoots.has(verdict.providerRootFamily)) {
      verdict.warnings.push("duplicate_canonical_provider_root_not_counted");
      continue;
    }
    const providerPayloadKey = `${receipt.providerId}:${receipt.payloadHash}`;
    if (seenProviderPayload.has(providerPayloadKey)) {
      verdict.warnings.push("duplicate_provider_payload_not_counted");
      continue;
    }
    seenProviderPayload.add(providerPayloadKey);
    if (mirroredPayloadHashes.includes(receipt.payloadHash) && seenPayloadAcrossFamilies.has(receipt.payloadHash)) {
      verdict.warnings.push("mirrored_cross_family_payload_not_independent");
      continue;
    }
    seenPayloadAcrossFamilies.add(receipt.payloadHash);
    seenProviderRoots.add(verdict.providerRootFamily);
    verdict.independent = true;
    independentIndexes.push(index);
  }

  const acceptedRows = receipts.flatMap((receipt, index) => {
    const verdict = verdicts[index];
    return verdict?.accepted && verdict.providerRootFamily ? [{ receipt, verdict }] : [];
  });
  const independentRows = independentIndexes.map((index) => ({ receipt: receipts[index]!, verdict: verdicts[index]! }));
  const acceptedReceiptBindings = receipts.flatMap((receipt, index): Pass4650AcceptedReceiptBinding[] => {
    const verdict = verdicts[index];
    if (!verdict?.accepted || !verdict.providerRootFamily) return [];
    return [{
      receiptId: receipt.receiptId,
      providerId: receipt.providerId,
      providerRootFamily: verdict.providerRootFamily,
      surface: receipt.surface,
      payloadHash: receipt.payloadHash.toLowerCase(),
      receiptCanonicalDigest: pass4644CanonicalReceiptDigest(receipt),
    }];
  }).sort((left, right) => left.receiptId.localeCompare(right.receiptId)
    || left.providerId.localeCompare(right.providerId)
    || left.providerRootFamily.localeCompare(right.providerRootFamily)
    || left.payloadHash.localeCompare(right.payloadHash)
    || left.receiptCanonicalDigest.localeCompare(right.receiptCanonicalDigest));
  const independentProviders = unique(independentRows.map(({ receipt }) => receipt.providerId)).sort();
  const independentProviderFamilies = unique(independentRows.map(({ verdict }) => verdict.providerRootFamily).filter((value): value is string => Boolean(value))).sort();
  // Same-root receipts can add distinct evidence categories, but never add an
  // independent upstream organization. Corroboration below still requires two
  // canonical roots and two distinct payloads.
  const evidenceCategories = unique(acceptedRows.flatMap(({ verdict }) => verdict.categories)).sort();
  const categoryFamilies = new Map<Pass4650EvidenceCategory, Set<string>>();
  const categoryPayloadHashes = new Map<Pass4650EvidenceCategory, Set<string>>();
  for (const { receipt, verdict } of acceptedRows) {
    for (const category of verdict.categories) {
      const families = categoryFamilies.get(category) ?? new Set<string>();
      families.add(verdict.providerRootFamily!);
      categoryFamilies.set(category, families);
      const hashes = categoryPayloadHashes.get(category) ?? new Set<string>();
      hashes.add(receipt.payloadHash);
      categoryPayloadHashes.set(category, hashes);
    }
  }
  const corroboratedCategories = evidenceCategories.filter((category) =>
    (categoryFamilies.get(category)?.size ?? 0) >= 2 && (categoryPayloadHashes.get(category)?.size ?? 0) >= 2,
  );

  const acceptedForTier = acceptedRows.map(({ verdict }) => ({ providerFamily: verdict.providerRootFamily!, categories: verdict.categories }));
  const tierThresholds = thresholdsFor(evidenceProfile);
  const tierResilience = Object.fromEntries((Object.keys(tierThresholds) as Pass4650Tier[]).map((tier) => {
    const fallbackTier = tier === "advanced" ? "pro" : tier === "pro" ? "basic" : "none";
    if (fallbackTier === "none") return [tier, { fallbackTier, survivesAnySingleFamilyOutage: true, failingFamilies: [] }];
    const failingFamilies = independentProviderFamilies.filter((family) => {
      const remaining = acceptedForTier.filter((item) => item.providerFamily !== family);
      return !meetsTier({ tier: fallbackTier, receipts: remaining, assetClass, evidenceProfile });
    });
    return [tier, { fallbackTier, survivesAnySingleFamilyOutage: failingFamilies.length === 0, failingFamilies }];
  })) as Pass4650ProviderQualitySnapshot["tierResilience"];

  const futureTimestampReceiptIds = verdicts.filter((verdict) => verdict.blockers.some((item) => item.includes("from_future"))).map((verdict) => verdict.receiptId);
  const expiredReceiptIds = verdicts.filter((verdict) => verdict.blockers.includes("receipt_expired_at_replay")).map((verdict) => verdict.receiptId);
  const rejectedReceiptIds = verdicts.filter((verdict) => !verdict.accepted).map((verdict) => verdict.receiptId);
  const replayFingerprint = sha256(stableSerialize(acceptedRows.map(({ receipt, verdict }) => ({
    receiptId: receipt.receiptId,
    providerId: receipt.providerId,
    providerFamily: verdict.providerRootFamily,
    payloadHash: receipt.payloadHash,
    receiptCanonicalDigest: pass4644CanonicalReceiptDigest(receipt),
    capabilities: receipt.capabilities.slice().sort(),
    categories: verdict.categories,
    observedAt: receipt.observedAt,
    expiresAt: receipt.expiresAt,
  })).sort((a, b) => a.receiptId.localeCompare(b.receiptId))));

  const identityScore = receipts.length > 0 && rejectedReceiptIds.length === 0 ? 20 : receipts.length > rejectedReceiptIds.length ? 10 : 0;
  const freshnessScore = futureTimestampReceiptIds.length === 0 && expiredReceiptIds.length === 0 ? 15 : 0;
  const independenceRatio = receipts.length ? independentRows.length / receipts.length : 0;
  const independenceScore = Math.round(20 * Math.min(1, independenceRatio));
  const basicRequired = requiredCategories(assetClass, "basic", evidenceProfile);
  const categoryScore = Math.round(20 * (basicRequired.filter((category) => evidenceCategories.includes(category)).length / basicRequired.length));
  const corroborationScore = Math.min(15, corroboratedCategories.length * 5);
  const latencyWarnings = verdicts.filter((verdict) => verdict.warnings.some((item) => item.startsWith("provider_latency_high"))).length;
  const latencyScore = receipts.length === 0 ? 0 : Math.round(10 * Math.max(0, 1 - latencyWarnings / receipts.length));
  const qualityScore = Math.max(0, Math.min(100, identityScore + freshnessScore + independenceScore + categoryScore + corroborationScore + latencyScore));
  const missingBasicCategories = basicRequired.filter((category) => !evidenceCategories.includes(category));
  const basicTierReady = meetsTier({
    tier: "basic",
    receipts: acceptedForTier,
    assetClass,
    evidenceProfile,
  });
  const blockers = unique([
    independentRows.length === 0 ? "no_independent_runtime_receipts" : null,
    missingBasicCategories.length > 0 ? `basic_category_coverage_missing:${missingBasicCategories.join(",")}` : null,
    mirroredPayloadHashes.length > 0 ? `mirrored_payloads:${mirroredPayloadHashes.length}` : null,
    futureTimestampReceiptIds.length > 0 ? `future_timestamps:${futureTimestampReceiptIds.length}` : null,
    expiredReceiptIds.length > 0 ? `expired_at_replay:${expiredReceiptIds.length}` : null,
  ].filter((value): value is string => Boolean(value)));
  const warnings = unique(verdicts.flatMap((verdict) => verdict.warnings));

  return {
    schemaVersion: "pass4650_provider_quality_snapshot_v1",
    requestedIdentity,
    requestedIdentityAliases: recordedIdentityAliases,
    assetClass,
    evidenceProfile,
    generatedAt: safeNow.toISOString(),
    receiptCount: receipts.length,
    runtimeAcceptedReceiptCount: verdicts.filter((verdict) => verdict.accepted).length,
    independentReceiptCount: independentRows.length,
    independentProviderCount: independentProviders.length,
    independentProviderFamilyCount: independentProviderFamilies.length,
    independentProviders,
    independentProviderFamilies,
    acceptedReceiptBindings,
    evidenceCategories,
    corroboratedCategories,
    mirroredPayloadHashes,
    duplicateReceiptIds: unique(duplicateReceiptIds),
    futureTimestampReceiptIds,
    expiredReceiptIds,
    rejectedReceiptIds,
    qualityScore,
    commerciallyUsable: independentRows.length >= tierThresholds.basic.receipts && basicTierReady && blockers.length === 0,
    replayFingerprint,
    tierResilience,
    verdicts,
    blockers,
    warnings,
  };
}

export function buildPass4650ReplayManifest(args: {
  quality: Pass4650ProviderQualitySnapshot;
  ledger?: Pass4645ProviderEvidenceLedger | null;
  generatedAt?: string | Date;
}): Pass4650ReplayManifest {
  const generatedAt = args.generatedAt instanceof Date ? args.generatedAt : args.generatedAt ? new Date(args.generatedAt) : new Date();
  const safeGeneratedAt = Number.isFinite(generatedAt.getTime()) ? generatedAt : new Date();
  const unsigned = {
    schemaVersion: "pass4650_provider_replay_manifest_v1" as const,
    requestedIdentity: args.quality.requestedIdentity,
    requestedIdentityAliases: args.quality.requestedIdentityAliases.slice().sort(),
    assetClass: args.quality.assetClass,
    evidenceProfile: args.quality.evidenceProfile,
    ledgerId: args.ledger?.ledgerId ?? null,
    ledgerHeadHash: args.ledger?.headHash ?? null,
    ledgerRequestedIdentity: args.ledger?.requestedIdentity ?? null,
    ledgerSurface: args.ledger?.surface ?? null,
    ledgerDepth: args.ledger?.depth ?? null,
    ledgerEligibleReceiptCount: args.ledger?.eligibleReceiptCount ?? 0,
    receiptFingerprint: args.quality.replayFingerprint,
    acceptedReceiptBindingDigest: sha256(stableSerialize(args.quality.acceptedReceiptBindings)),
    acceptedReceiptCount: args.quality.acceptedReceiptBindings.length,
    independentReceiptCount: args.quality.independentReceiptCount,
    independentProviderFamilyCount: args.quality.independentProviderFamilyCount,
    evidenceCategories: args.quality.evidenceCategories.slice().sort(),
    generatedAt: safeGeneratedAt.toISOString(),
  };
  return { ...unsigned, manifestHash: sha256(stableSerialize(unsigned)) };
}

export function verifyPass4650ReplayManifest(args: {
  manifest: Pass4650ReplayManifest;
  quality: Pass4650ProviderQualitySnapshot;
  ledger?: Pass4645ProviderEvidenceLedger | null;
  signingSecret?: string | null;
}) {
  const { manifest, quality, ledger } = args;
  const { manifestHash, ...unsigned } = manifest;
  const expectedHash = sha256(stableSerialize(unsigned));
  const ledgerVerification = ledger ? verifyPass4645ProviderEvidenceLedger(ledger, args.signingSecret) : null;
  const verifiedLedger = ledgerVerification?.valid ? ledger : null;
  const qualityBindingDigest = sha256(stableSerialize(quality.acceptedReceiptBindings));
  const manifestIdentityAliases = Array.isArray(manifest.requestedIdentityAliases) ? manifest.requestedIdentityAliases.slice().sort() : [];
  const qualityIdentityAliases = Array.isArray(quality.requestedIdentityAliases) ? quality.requestedIdentityAliases.slice().sort() : [];
  const manifestEvidenceCategories = Array.isArray(manifest.evidenceCategories) ? manifest.evidenceCategories.slice().sort() : [];
  const expectedSurface: Pass4644ProviderSurface = quality.evidenceProfile === "contract_audit"
    ? "contract_audit"
    : quality.assetClass === "crypto" || quality.assetClass === "unknown"
      ? "crypto"
      : "real_markets";
  const ledgerBindings = verifiedLedger?.entries
    .filter((entry) => entry.commercialEvidenceEligible === true)
    .map((entry): Pass4650AcceptedReceiptBinding => ({
      receiptId: entry.receiptId,
      providerId: entry.providerId,
      providerRootFamily: canonicalProviderRootFamily(entry),
      surface: entry.surface,
      payloadHash: entry.payloadHash.toLowerCase(),
      receiptCanonicalDigest: entry.receiptCanonicalDigest,
    }))
    .sort((left, right) => left.receiptId.localeCompare(right.receiptId)
      || left.providerId.localeCompare(right.providerId)
      || left.providerRootFamily.localeCompare(right.providerRootFamily)
      || left.payloadHash.localeCompare(right.payloadHash)
      || left.receiptCanonicalDigest.localeCompare(right.receiptCanonicalDigest)) ?? [];
  const ledgerBindingDigest = sha256(stableSerialize(ledgerBindings));
  const blockers = unique([
    manifest.schemaVersion !== "pass4650_provider_replay_manifest_v1" ? "manifest_schema_invalid" : null,
    manifestHash !== expectedHash ? "manifest_hash_mismatch" : null,
    manifest.requestedIdentity !== quality.requestedIdentity ? "manifest_identity_mismatch" : null,
    !Array.isArray(manifest.requestedIdentityAliases) ? "manifest_identity_aliases_invalid" : null,
    stableSerialize(manifestIdentityAliases) !== stableSerialize(qualityIdentityAliases) ? "manifest_identity_aliases_mismatch" : null,
    manifest.assetClass !== quality.assetClass ? "manifest_asset_class_mismatch" : null,
    manifest.evidenceProfile !== quality.evidenceProfile ? "manifest_evidence_profile_mismatch" : null,
    manifest.receiptFingerprint !== quality.replayFingerprint ? "manifest_receipt_fingerprint_mismatch" : null,
    manifest.acceptedReceiptBindingDigest !== qualityBindingDigest ? "manifest_receipt_binding_digest_mismatch" : null,
    manifest.acceptedReceiptCount !== quality.acceptedReceiptBindings.length ? "manifest_accepted_receipt_count_mismatch" : null,
    manifest.independentReceiptCount !== quality.independentReceiptCount ? "manifest_receipt_count_mismatch" : null,
    manifest.independentProviderFamilyCount !== quality.independentProviderFamilyCount ? "manifest_family_count_mismatch" : null,
    stableSerialize(manifestEvidenceCategories) !== stableSerialize(quality.evidenceCategories.slice().sort()) ? "manifest_category_mismatch" : null,
    (ledger?.ledgerId ?? null) !== manifest.ledgerId ? "manifest_ledger_id_mismatch" : null,
    (ledger?.headHash ?? null) !== manifest.ledgerHeadHash ? "manifest_ledger_head_mismatch" : null,
    (ledger?.requestedIdentity ?? null) !== manifest.ledgerRequestedIdentity ? "manifest_ledger_identity_mismatch" : null,
    (ledger?.surface ?? null) !== manifest.ledgerSurface ? "manifest_ledger_surface_mismatch" : null,
    (ledger?.depth ?? null) !== manifest.ledgerDepth ? "manifest_ledger_depth_mismatch" : null,
    (ledger?.eligibleReceiptCount ?? 0) !== manifest.ledgerEligibleReceiptCount ? "manifest_ledger_eligible_count_mismatch" : null,
    ledger && normalizedIdentity(ledger.requestedIdentity) !== quality.requestedIdentity ? "ledger_quality_identity_mismatch" : null,
    ledger && ledger.surface !== expectedSurface ? "ledger_quality_surface_mismatch" : null,
    ledger && ledger.eligibleReceiptCount !== quality.acceptedReceiptBindings.length ? "ledger_quality_eligible_count_mismatch" : null,
    ledger && ledgerBindingDigest !== qualityBindingDigest ? "ledger_quality_receipt_multiset_mismatch" : null,
    ledgerBindings.some((binding) => !binding.providerRootFamily) ? "ledger_provider_root_unknown" : null,
    ledgerVerification && !ledgerVerification.valid ? `ledger_invalid:${ledgerVerification.blockers.join("|")}` : null,
  ].filter((value): value is string => Boolean(value)));
  return {
    schemaVersion: "pass4650_provider_replay_verification_v1",
    valid: blockers.length === 0,
    manifestHash: manifest.manifestHash,
    currentReceiptFingerprint: quality.replayFingerprint,
    ledgerValid: ledgerVerification?.valid ?? false,
    blockers,
  } as const;
}
