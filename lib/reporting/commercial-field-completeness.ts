import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  validatePass4824CanonicalFieldPacket,
  type Pass4824CanonicalFieldPacket,
  type Pass4824DataModule,
  type Pass4824DataTier,
  type Pass4824FieldObservation,
} from "@/lib/reporting/canonical-field-registry";
import type { SourceReceipt } from "@/lib/market-integrity/top1-risk-foundation";
import { verifyPass4993SourceReceiptProjection } from "@/lib/market-integrity/customer-report-source-binding";
import {
  verifyPass6ManualReviewAuthorityReceipt,
  type Pass6ManualReviewConsumption,
  type Pass6ManualReviewKeyRing,
} from "@/lib/reporting/pass6-manual-review-authority";

export const PASS6_COMMERCIAL_FIELD_COMPLETENESS_ID = "pass6-commercial-field-completeness-v1" as const;
export const PASS6_COMMERCIAL_FIELD_COMPLETENESS_TARGET_BPS = 9_990 as const;

const PASS6_MAX_SOURCE_RECEIPTS = 64;
const PASS6_MAX_FIELD_EVIDENCE_ROWS = 512;
const PASS6_MAX_EVIDENCE_REFS_PER_FIELD = 128;
const PASS6_MAX_TOTAL_EVIDENCE_REFS = 2_048;

export type Pass6CommercialFieldCompletenessReceipt = {
  schemaVersion: typeof PASS6_COMMERCIAL_FIELD_COMPLETENESS_ID;
  caseId: string;
  module: Pass4824DataModule;
  tier: Pass4824DataTier;
  status: "complete" | "preview_only" | "blocked";
  paidDeliveryEligible: boolean;
  targetCompletenessBps: typeof PASS6_COMMERCIAL_FIELD_COMPLETENESS_TARGET_BPS;
  completenessBps: number;
  expectedFieldCount: number;
  completeFieldCount: number;
  independentUpstreamCount: number;
  requiredIndependentUpstreamCount: number;
  independentUpstreams: string[];
  missingFields: string[];
  explicitMissingFields: string[];
  unavailableSentinelFields: string[];
  staleFields: string[];
  offlineFixtureFields: string[];
  unboundFields: string[];
  capabilityMismatchFields: string[];
  fieldEvidenceMismatchFields: string[];
  derivationMismatchFields: string[];
  quorumShortfallFields: string[];
  lowConfidenceFields: string[];
  missingEvidenceDeclared: boolean;
  manualReviewAuthorityVerified: boolean;
  manualReviewAuthorityFingerprint: string | null;
  blockers: string[];
  packetDigest: string;
  sourceReceiptRoot: string;
  receiptDigest: string;
};

export type Pass6ManualReviewAuthorityContext = {
  receipt: unknown;
  accountHash: string;
  keyRing: Pass6ManualReviewKeyRing;
  now: string | Date;
  /** Server-only verdict from the durable, one-time release transition. */
  consumption: Pick<
    Pass6ManualReviewConsumption,
    "ok" | "consumed" | "authorityFingerprint" | "replayProtection"
  >;
};

const TIER_CONFIDENCE_FLOOR: Record<Pass4824DataTier, number> = {
  basic: 50,
  pro: 65,
  advanced: 75,
};

const GLOBAL_QUORUM: Record<Pass4824DataModule, Record<Pass4824DataTier, number>> = {
  shield: { basic: 1, pro: 2, advanced: 3 },
  real_markets: { basic: 1, pro: 2, advanced: 3 },
  lens: { basic: 1, pro: 2, advanced: 3 },
  audit: { basic: 1, pro: 3, advanced: 4 },
};

const CAPABILITIES: ReadonlyArray<{ pattern: RegExp; anyOf: readonly string[] }> = Object.freeze([
  { pattern: /^evidence\./, anyOf: ["evidence", "missing_evidence", "gap", "claim", "claim_ledger", "verified_source"] },
  { pattern: /^identity\./, anyOf: ["identity", "pair_identity", "provider_identity", "issuer_identity", "product_identity", "network_identity", "contract_address", "verified_source"] },
  { pattern: /^risk\./, anyOf: ["price", "quote", "history", "liquidity", "holders", "holder", "permissions", "fundamentals", "macro_series", "scenario", "simulation"] },
  { pattern: /^market\.price$/, anyOf: ["price", "quote", "mark_price", "index_price", "pair_price", "real_market_quote"] },
  { pattern: /^market\.change_/, anyOf: ["history", "ohlcv", "klines", "price", "quote", "range_24h"] },
  { pattern: /^market\.volume_24h$/, anyOf: ["volume", "volume_24h", "ohlcv", "klines", "pair_volume"] },
  { pattern: /^market\.liquidity_usd$/, anyOf: ["liquidity", "dex_liquidity", "pool_liquidity", "depth"] },
  { pattern: /^market\.(impact_10k_bps|orderbook_depth_usd)$/, anyOf: ["orderbook", "depth", "slippage", "spread", "imbalance"] },
  { pattern: /^source\.second_source_divergence_bps$/, anyOf: ["price", "quote", "history", "real_market_quote"] },
  { pattern: /^source\.independent_quorum$/, anyOf: ["identity", "price", "quote", "source_code", "verified_source"] },
  { pattern: /^scenario\./, anyOf: ["scenario", "stress", "simulation", "history", "volatility", "drawdown"] },
  { pattern: /^holder\./, anyOf: ["holders", "holder", "holder_inputs", "token_balances", "transfers", "whale", "ownership"] },
  { pattern: /^contract\./, anyOf: ["permissions", "contract_permissions", "owner", "proxy", "upgrade", "mint", "blacklist", "tax", "token_security", "source_code", "verified_source", "abi"] },
  { pattern: /^fundamentals\./, anyOf: ["fundamentals", "company_facts", "10k", "10q", "8k", "issuer_identity", "earnings"] },
  { pattern: /^macro\./, anyOf: ["macro_series", "rates", "inflation", "employment", "yields", "policy_rates", "fx_reference", "monetary_statistics"] },
  { pattern: /^audit\.permission_summary$/, anyOf: ["permissions", "contract_permissions", "owner", "proxy", "upgrade", "mint", "blacklist", "tax", "token_security", "source_code", "verified_source", "abi"] },
  { pattern: /^audit\.liquidity_evidence$/, anyOf: ["liquidity", "dex_liquidity", "pool_liquidity", "orderbook", "depth", "lock", "lp"] },
  { pattern: /^audit\.holder_evidence$/, anyOf: ["holders", "holder", "holder_inputs", "token_balances", "transfers", "whale", "ownership"] },
  { pattern: /^audit\.manual_review_state$/, anyOf: ["manual_review", "review", "signoff"] },
  { pattern: /^audit\.(monitoring_state|revalidation_plan|finding_evidence_graph|false_positive_review)$/, anyOf: ["monitoring", "revalidation", "manual_review", "review", "signoff", "source_code", "permissions"] },
  { pattern: /^lens\.orderbook_context$/, anyOf: ["orderbook", "depth", "spread", "slippage"] },
  { pattern: /^lens\.holder_context$/, anyOf: ["holders", "holder", "whale", "transfers", "ownership"] },
  { pattern: /^lens\.unlock_context$/, anyOf: ["unlock", "supply", "tokenomics", "emission"] },
  { pattern: /^lens\.contract_context$/, anyOf: ["permissions", "source_code", "verified_source", "abi", "proxy", "owner"] },
  { pattern: /^lens\.scenario_analysis$/, anyOf: ["scenario", "stress", "simulation", "history", "volatility"] },
  { pattern: /^lens\.(query|summary|source_comparison|claim_atoms|freshness_summary)$/, anyOf: ["identity", "price", "quote", "history", "freshness", "source_code"] },
]);

function normalizedCapability(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function capabilityTokens(receipt: SourceReceipt) {
  return new Set([
    ...receipt.usedInLanes,
    receipt.dataType,
  ].flatMap((value) => {
    const normalized = normalizedCapability(value);
    return [normalized, ...normalized.split("_").filter(Boolean)];
  }));
}

function capabilityRule(fieldId: string) {
  return CAPABILITIES.find((item) => item.pattern.test(fieldId));
}

export function pass6SourceReceiptMatchesField(fieldId: string, receipt: SourceReceipt) {
  const rule = capabilityRule(fieldId);
  if (!rule) return false;
  const tokens = capabilityTokens(receipt);
  return rule.anyOf.some((capability) => {
    const normalized = normalizedCapability(capability);
    return tokens.has(normalized);
  });
}

function pass6FieldValueHash(value: unknown) {
  return sha256Digest(canonicalJson(value)).slice("sha256:".length);
}

function validFieldEvidenceRows(receipt: SourceReceipt) {
  const rows = receipt.fieldEvidence ?? [];
  if (rows.length === 0 || rows.length > PASS6_MAX_FIELD_EVIDENCE_ROWS) return false;
  const uniqueRows = new Set<string>();
  for (const item of rows) {
    if (typeof item.fieldPath !== "string" || !item.fieldPath.trim()
      || typeof item.capability !== "string" || !item.capability.trim()
      || !/^[a-f0-9]{64}$/i.test(item.valueHash)) return false;
    const key = `${item.fieldPath.trim()}\u0000${normalizedCapability(item.capability)}\u0000${item.valueHash.toLowerCase()}`;
    if (uniqueRows.has(key)) return false;
    uniqueRows.add(key);
  }
  return true;
}

export function pass6SourceReceiptHasFieldEvidenceForField(
  fieldId: string,
  receipt: SourceReceipt,
  expectedRawValue?: unknown,
) {
  const rule = capabilityRule(fieldId);
  if (!rule) return false;
  const expectedValueHash = typeof expectedRawValue === "undefined" ? null : pass6FieldValueHash(expectedRawValue);
  return (receipt.fieldEvidence ?? []).some((evidence) => {
    if (!/^[a-f0-9]{64}$/i.test(evidence.valueHash) || !evidence.fieldPath.trim()) return false;
    const evidenceCapability = normalizedCapability(evidence.capability);
    return rule.anyOf.some((capability) => evidenceCapability === normalizedCapability(capability))
      && (expectedValueHash === null || evidence.valueHash.toLowerCase() === expectedValueHash);
  });
}

function validDigest(value: string | null | undefined) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

export function verifyPass6SourceReceiptProjection(
  receipt: SourceReceipt,
  expectedCanonicalIdentity: string,
  generatedAt: string | number | Date,
) {
  return verifyPass4993SourceReceiptProjection({
    receipt,
    expectedCanonicalIdentity,
    atTime: generatedAt,
  }).ok;
}

export function pass6SourceReceiptRefs(receipt: SourceReceipt) {
  return Array.from(new Set([
    receipt.receiptId,
    receipt.providerReceiptId ?? null,
    receipt.payloadDigest ?? null,
    receipt.providerReceiptCanonicalDigest ?? null,
  ].filter((value): value is string => Boolean(value))));
}

function eligibleReceipt(
  receipt: SourceReceipt,
  generatedAtMs: number,
  tier: Pass4824DataTier,
  expectedCanonicalIdentity: string,
) {
  const observedAtMs = Date.parse(receipt.observedAt);
  const measuredAgeSeconds = Number.isFinite(generatedAtMs) && Number.isFinite(observedAtMs)
    ? Math.max(0, Math.round((generatedAtMs - observedAtMs) / 1_000))
    : Number.NaN;
  const providerIntegrityReady = receipt.providerReceiptIntegrityVerified === true
    && validDigest(receipt.providerReceiptCanonicalDigest)
    && receipt.timestampProvenance === "provider"
    && Array.isArray(receipt.fieldEvidence)
    && receipt.fieldEvidence.length > 0
    && validFieldEvidenceRows(receipt);
  return receipt.evidenceState === "content_bound"
    && receipt.commercialEvidenceEligible === true
    && receipt.identityMatched === true
    && receipt.freshnessStatus === "fresh"
    && validDigest(receipt.payloadDigest)
    && typeof receipt.receiptId === "string"
    && receipt.receiptId.trim().length > 0
    && typeof receipt.providerReceiptId === "string"
    && receipt.providerReceiptId.trim().length > 0
    && Number.isFinite(observedAtMs)
    && observedAtMs <= generatedAtMs + 1_000
    && Number.isFinite(receipt.ageSeconds)
    && receipt.ageSeconds >= 0
    && Number.isFinite(measuredAgeSeconds)
    && Math.abs(receipt.ageSeconds - measuredAgeSeconds) <= 2
    && Number.isFinite(receipt.qualityScore)
    && receipt.qualityScore >= TIER_CONFIDENCE_FLOOR[tier]
    && providerIntegrityReady
    && verifyPass6SourceReceiptProjection(receipt, expectedCanonicalIdentity, generatedAtMs);
}

function independentUpstream(receipt: SourceReceipt) {
  if (receipt.sourceFamily === "velmere_internal" || receipt.sourceFamily === "manual_review") return null;
  return String(receipt.upstreamRoot ?? receipt.sourceFamily).trim().toLowerCase() || null;
}

function independentReceipts(receipts: readonly SourceReceipt[]) {
  const usedRoots = new Set<string>();
  const usedPayloadDigests = new Set<string>();
  const independent: SourceReceipt[] = [];
  for (const receipt of [...receipts].sort((left, right) => left.receiptId.localeCompare(right.receiptId))) {
    const root = independentUpstream(receipt);
    const payloadDigest = receipt.payloadDigest?.toLowerCase() ?? null;
    if (!root || !payloadDigest || usedRoots.has(root) || usedPayloadDigests.has(payloadDigest)) continue;
    usedRoots.add(root);
    usedPayloadDigests.add(payloadDigest);
    independent.push(receipt);
  }
  return independent;
}

export function pass6SourceReceiptRoot(receipts: readonly SourceReceipt[]) {
  const rows = receipts.map((receipt) => ({
    receiptId: receipt.receiptId,
    providerReceiptId: receipt.providerReceiptId ?? null,
    provider: receipt.provider,
    payloadDigest: receipt.payloadDigest ?? null,
    sourceFamily: receipt.sourceFamily,
    upstreamRoot: receipt.upstreamRoot ?? null,
    dataType: receipt.dataType,
    usedInLanes: [...receipt.usedInLanes].sort(),
    observedAt: receipt.observedAt,
    ageSeconds: receipt.ageSeconds,
    freshnessStatus: receipt.freshnessStatus,
    qualityScore: receipt.qualityScore,
    evidenceState: receipt.evidenceState,
    identityMatched: receipt.identityMatched === true,
    commercialEvidenceEligible: receipt.commercialEvidenceEligible === true,
    registrySourceId: receipt.registrySourceId ?? null,
    providerReceiptCanonicalDigest: receipt.providerReceiptCanonicalDigest ?? null,
    providerReceiptIntegrityVerified: receipt.providerReceiptIntegrityVerified === true,
    timestampProvenance: receipt.timestampProvenance ?? null,
    fieldEvidence: (receipt.fieldEvidence ?? []).map((item) => ({
      fieldPath: item.fieldPath,
      capability: item.capability,
      valueHash: item.valueHash,
    })).sort((left, right) => left.fieldPath.localeCompare(right.fieldPath)
      || left.capability.localeCompare(right.capability)
      || left.valueHash.localeCompare(right.valueHash)),
    targetCanonicalIdentity: receipt.targetCanonicalIdentity ?? null,
    requestedCanonicalIdentity: receipt.requestedCanonicalIdentity ?? null,
    resolvedCanonicalIdentity: receipt.resolvedCanonicalIdentity ?? null,
    resolvedIdentity: receipt.resolvedIdentity ?? null,
    receivedAt: receipt.receivedAt ?? null,
    expiresAt: receipt.expiresAt ?? null,
    providerSurface: receipt.providerSurface ?? null,
    providerVerification: receipt.providerVerification ?? null,
    projection: receipt.projection ?? null,
  }));
  rows.sort((left, right) => {
    const receiptOrder = left.receiptId.localeCompare(right.receiptId);
    if (receiptOrder !== 0) return receiptOrder;
    const providerReceiptOrder = String(left.providerReceiptId).localeCompare(String(right.providerReceiptId));
    if (providerReceiptOrder !== 0) return providerReceiptOrder;
    return canonicalJson(left).localeCompare(canonicalJson(right));
  });
  return sha256Digest(canonicalJson(rows));
}

export function pass6AllowedDerivationFormula(fieldId: string) {
  return `pass4825_adapter_projection:${fieldId}`;
}

export function pass6ObservationDerivationDigest(args: {
  fieldId: string;
  value: unknown;
  rawValue: unknown;
  formula: string;
  evidenceRefs: readonly string[];
  sourceReceipts: readonly SourceReceipt[];
}) {
  const references = new Set(args.evidenceRefs);
  const boundReceipts = args.sourceReceipts.filter((receipt) => (
    pass6SourceReceiptRefs(receipt).some((reference) => references.has(reference))
    && pass6SourceReceiptMatchesField(args.fieldId, receipt)
    && pass6SourceReceiptHasFieldEvidenceForField(args.fieldId, receipt, args.rawValue)
  ));
  return sha256Digest(canonicalJson({
    schemaVersion: "pass6-observation-derivation-binding-v1",
    fieldId: args.fieldId,
    value: args.value,
    rawValue: args.rawValue,
    formula: args.formula,
    evidenceRefs: Array.from(new Set(args.evidenceRefs)).sort(),
    sourceReceiptRoot: pass6SourceReceiptRoot(boundReceipts),
  }));
}

function hasUnavailableSentinel(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (typeof value === "string") {
    return /^(?:unavailable|unverified|not[_ -]?configured|not[_ -]?connected|missing|blocked|unknown)$/i.test(value.trim());
  }
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasUnavailableSentinel(item, depth + 1));
  const record = value as Record<string, unknown>;
  if (typeof record.state === "string" && /^(?:unavailable|unverified|missing|blocked|not[_ -]?configured)$/i.test(record.state.trim())) return true;
  if (typeof record.status === "string" && /^(?:unavailable|unverified|missing|blocked|not[_ -]?configured)$/i.test(record.status.trim())) return true;
  if (typeof record.limitation === "string" && /(?:unavailable|not[_ -]?(?:supplied|verified|connected|generated)|missing)/i.test(record.limitation)) return true;
  return Object.values(record).some((item) => hasUnavailableSentinel(item, depth + 1));
}

function fieldQuorum(tier: Pass4824DataTier, observation: Pass4824FieldObservation) {
  if (observation.fieldId.startsWith("evidence.")) return 1;
  if (observation.fieldId === "audit.manual_review_state") return 1;
  if (tier === "basic") return 1;
  if (/^(?:identity\.|risk\.|market\.|source\.second_source|scenario\.|holder\.|contract\.|audit\.(?:permission|liquidity|holder)|lens\.(?:orderbook|holder|unlock|contract|scenario))/.test(observation.fieldId)) return 2;
  return 1;
}

function evidenceConsistencyMismatchFields(packet: Pass4824CanonicalFieldPacket) {
  const byField = new Map(packet.observations.map((observation) => [observation.fieldId, observation]));
  const missing = byField.get("evidence.missing");
  const gapCount = byField.get("evidence.gap_count");
  const primaryGap = byField.get("evidence.primary_gap");
  const mismatches = new Set<string>();
  if (missing && gapCount && primaryGap) {
    const rows = missing.value;
    const normalizedRows = Array.isArray(rows)
      && rows.length <= 256
      && rows.every((row) => typeof row === "string" && row.trim().length > 0 && row.length <= 512)
      ? rows.map((row) => String(row).trim())
      : null;
    const uniqueRows = normalizedRows ? new Set(normalizedRows) : null;
    const expectedPrimary = normalizedRows?.[0] ?? "none";
    const primaryValue = typeof primaryGap.value === "string" ? primaryGap.value.trim() : null;
    if (!normalizedRows || uniqueRows?.size !== normalizedRows.length
      || gapCount.value !== normalizedRows.length
      || primaryValue?.toLowerCase() !== expectedPrimary.toLowerCase()) {
      mismatches.add(missing.fieldId);
      mismatches.add(gapCount.fieldId);
      mismatches.add(primaryGap.fieldId);
    }
  }

  const claimLedger = byField.get("evidence.claim_ledger");
  if (claimLedger) {
    const ledger = claimLedger.value;
    let valid = Boolean(ledger) && typeof ledger === "object" && !Array.isArray(ledger);
    if (valid) {
      const record = ledger as Record<string, unknown>;
      const state = typeof record.state === "string" ? record.state.trim().toLowerCase() : "";
      const claims = record.claims;
      valid = ["verified", "durable", "content_bound"].includes(state)
        && Array.isArray(claims)
        && claims.length <= 512;
      if (valid) {
        const claimIds = new Set<string>();
        for (const candidate of claims as unknown[]) {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            valid = false;
            break;
          }
          const claim = candidate as Record<string, unknown>;
          const id = typeof claim.id === "string" ? claim.id.trim() : "";
          const claimState = typeof claim.state === "string" ? claim.state.trim() : "";
          const evidenceCount = claim.evidenceCount;
          if (!id || id.length > 256 || !claimState || claimState.length > 64 || claimIds.has(id)
            || !Number.isSafeInteger(evidenceCount) || Number(evidenceCount) < 0 || Number(evidenceCount) > 1_000_000) {
            valid = false;
            break;
          }
          claimIds.add(id);
        }
      }
      for (const key of ["blocked", "unresolved"] as const) {
        const rows = record[key];
        if (typeof rows !== "undefined" && (!Array.isArray(rows) || rows.length > 512)) valid = false;
      }
    }
    if (!valid) mismatches.add(claimLedger.fieldId);
  }
  return mismatches;
}

function canonicalReceiptSeed(receipt: Omit<Pass6CommercialFieldCompletenessReceipt, "receiptDigest">) {
  return receipt;
}

export function buildPass6CommercialFieldCompletenessReceipt(args: {
  packet: Pass4824CanonicalFieldPacket;
  sourceReceipts: readonly SourceReceipt[];
  requestedTier: Pass4824DataTier;
  manualReviewAuthority?: Pass6ManualReviewAuthorityContext | null;
}): Pass6CommercialFieldCompletenessReceipt {
  if (args.sourceReceipts.length > PASS6_MAX_SOURCE_RECEIPTS) {
    throw new Error(`pass6_source_receipt_limit_exceeded:${args.sourceReceipts.length}/${PASS6_MAX_SOURCE_RECEIPTS}`);
  }
  let totalEvidenceRefs = 0;
  for (const observation of args.packet.observations) {
    if (observation.evidenceRefs.length > PASS6_MAX_EVIDENCE_REFS_PER_FIELD) {
      throw new Error(`pass6_field_evidence_ref_limit_exceeded:${observation.fieldId}:${observation.evidenceRefs.length}/${PASS6_MAX_EVIDENCE_REFS_PER_FIELD}`);
    }
    totalEvidenceRefs += observation.evidenceRefs.length;
  }
  if (totalEvidenceRefs > PASS6_MAX_TOTAL_EVIDENCE_REFS) {
    throw new Error(`pass6_total_evidence_ref_limit_exceeded:${totalEvidenceRefs}/${PASS6_MAX_TOTAL_EVIDENCE_REFS}`);
  }
  const canonicalReceipt = validatePass4824CanonicalFieldPacket(args.packet);
  const sourceReceiptRoot = pass6SourceReceiptRoot(args.sourceReceipts);
  const manualReviewAuthorityRequired = args.packet.module === "audit" && args.packet.tier === "advanced";
  const manualReviewAuthorityVerification = manualReviewAuthorityRequired && args.manualReviewAuthority
    ? verifyPass6ManualReviewAuthorityReceipt({
      receipt: args.manualReviewAuthority.receipt,
      keyRing: args.manualReviewAuthority.keyRing,
      expected: {
        caseId: args.packet.caseId,
        accountHash: args.manualReviewAuthority.accountHash,
        tier: "advanced",
        packetDigest: canonicalReceipt.packetDigest,
        sourceReceiptRoot,
      },
      now: args.manualReviewAuthority.now,
    })
    : null;
  const manualReviewConsumption = args.manualReviewAuthority?.consumption ?? null;
  const manualReviewAuthorityVerified = manualReviewAuthorityVerification?.ok === true
    && manualReviewConsumption?.ok === true
    && manualReviewConsumption.consumed === true
    && manualReviewConsumption.replayProtection?.durable === true
    && manualReviewConsumption.authorityFingerprint === manualReviewAuthorityVerification.authorityFingerprint;
  const manualReviewAuthorityFingerprint = manualReviewAuthorityVerified
    ? manualReviewAuthorityVerification.authorityFingerprint
    : null;
  const generatedAtMs = Date.parse(args.packet.generatedAt);
  const eligibleCandidates = args.sourceReceipts.filter((receipt) => eligibleReceipt(
    receipt,
    generatedAtMs,
    args.packet.tier,
    args.packet.identity.canonicalId,
  ));
  const uniqueIdentifierCounts = new Map<string, number>();
  for (const receipt of eligibleCandidates) {
    const identifiers = new Set([receipt.receiptId, receipt.providerReceiptId, receipt.providerReceiptCanonicalDigest]
      .filter((identifier): identifier is string => Boolean(identifier))
      .map((identifier) => identifier.toLowerCase()));
    for (const key of identifiers) {
      uniqueIdentifierCounts.set(key, (uniqueIdentifierCounts.get(key) ?? 0) + 1);
    }
  }
  const eligible = eligibleCandidates.filter((receipt) => (
    [receipt.receiptId, receipt.providerReceiptId, receipt.providerReceiptCanonicalDigest]
      .filter((identifier): identifier is string => Boolean(identifier))
      .every((identifier) => uniqueIdentifierCounts.get(identifier.toLowerCase()) === 1)
  ));
  const referenceIndex = new Map<string, SourceReceipt | null>();
  for (const receipt of eligible) {
    for (const reference of pass6SourceReceiptRefs(receipt)) {
      if (!referenceIndex.has(reference)) referenceIndex.set(reference, receipt);
      else if (referenceIndex.get(reference) !== receipt) referenceIndex.set(reference, null);
    }
  }
  const requiredIndependentUpstreamCount = GLOBAL_QUORUM[args.packet.module][args.packet.tier];
  const expectedFieldCount = args.packet.observations.length;
  const missingFields: string[] = [];
  const explicitMissingFields: string[] = [];
  const unavailableSentinelFields: string[] = [];
  const staleFields: string[] = [];
  const offlineFixtureFields: string[] = [];
  const unboundFields: string[] = [];
  const capabilityMismatchFields: string[] = [];
  const fieldEvidenceMismatchFields: string[] = [];
  const derivationMismatchFields: string[] = [];
  const quorumShortfallFields: string[] = [];
  const lowConfidenceFields: string[] = [];
  const completeFields = new Set<string>();
  const packetReferencedReceipts = new Set<SourceReceipt>();
  const consistencyMismatches = evidenceConsistencyMismatchFields(args.packet);
  let missingEvidenceDeclared = false;

  for (const observation of args.packet.observations) {
    let fieldOk = true;
    if (observation.availability !== "available" || observation.value === null) {
      explicitMissingFields.push(observation.fieldId);
      fieldOk = false;
    }
    if (observation.provenance.mode === "offline_fixture") {
      offlineFixtureFields.push(observation.fieldId);
      fieldOk = false;
    }
    if (observation.provenance.mode === "explicit_missing") fieldOk = false;
    if (hasUnavailableSentinel(observation.value)) {
      unavailableSentinelFields.push(observation.fieldId);
      fieldOk = false;
    }
    const observedAtMs = Date.parse(observation.provenance.observedAt);
    const validUntilMs = Date.parse(observation.validUntil);
    if (!Number.isFinite(generatedAtMs) || !Number.isFinite(observedAtMs) || !Number.isFinite(validUntilMs)
      || observedAtMs > generatedAtMs + 1_000 || validUntilMs < generatedAtMs) {
      staleFields.push(observation.fieldId);
      fieldOk = false;
    }
    const confidenceFloor = TIER_CONFIDENCE_FLOOR[args.packet.tier];
    if (observation.confidence.score < confidenceFloor || observation.quality.score < confidenceFloor) {
      lowConfidenceFields.push(observation.fieldId);
      fieldOk = false;
    }

    if (observation.fieldId === "evidence.missing" && Array.isArray(observation.value) && observation.value.length > 0) {
      missingEvidenceDeclared = true;
      fieldOk = false;
    }
    if (observation.fieldId === "evidence.gap_count" && typeof observation.value === "number" && observation.value > 0) {
      missingEvidenceDeclared = true;
      fieldOk = false;
    }
    if (observation.fieldId === "evidence.primary_gap" && typeof observation.value === "string" && observation.value.trim().toLowerCase() !== "none") {
      missingEvidenceDeclared = true;
      fieldOk = false;
    }
    if (consistencyMismatches.has(observation.fieldId)) {
      derivationMismatchFields.push(observation.fieldId);
      fieldOk = false;
    }

    const requiredFieldQuorum = fieldQuorum(args.packet.tier, observation);
    if (requiredFieldQuorum > 0) {
      const uniqueEvidenceRefs = Array.from(new Set(observation.evidenceRefs)).sort();
      const referenced = Array.from(new Set(uniqueEvidenceRefs
        .map((reference) => referenceIndex.get(reference))
        .filter((value): value is SourceReceipt => Boolean(value))));
      if (referenced.length === 0
        || uniqueEvidenceRefs.some((reference) => !referenceIndex.get(reference))) {
        unboundFields.push(observation.fieldId);
        fieldOk = false;
      }
      const capabilityMatched = referenced.filter((receipt) => pass6SourceReceiptMatchesField(observation.fieldId, receipt));
      if (referenced.length > 0 && capabilityMatched.length !== referenced.length) {
        capabilityMismatchFields.push(observation.fieldId);
        fieldOk = false;
      }
      const fieldEvidenceMatched = typeof observation.rawValue === "undefined"
        ? []
        : capabilityMatched.filter((receipt) => (
          pass6SourceReceiptHasFieldEvidenceForField(observation.fieldId, receipt, observation.rawValue)
        ));
      if (capabilityMatched.length > 0 && fieldEvidenceMatched.length !== capabilityMatched.length) {
        fieldEvidenceMismatchFields.push(observation.fieldId);
        fieldOk = false;
      }
      for (const receipt of fieldEvidenceMatched) packetReferencedReceipts.add(receipt);
      const fieldUpstreams = independentReceipts(fieldEvidenceMatched)
        .map(independentUpstream)
        .filter((value): value is string => Boolean(value));
      const manualReviewSatisfied = observation.fieldId === "audit.manual_review_state"
        && observation.provenance.mode === "manual_review"
        && fieldEvidenceMatched.some((receipt) => receipt.sourceFamily === "manual_review")
        && manualReviewAuthorityVerified;
      if (!manualReviewSatisfied && fieldUpstreams.length < requiredFieldQuorum) {
        quorumShortfallFields.push(observation.fieldId);
        fieldOk = false;
      }
      if (observation.provenance.mode === "manual_review" && !manualReviewSatisfied) {
        fieldEvidenceMismatchFields.push(observation.fieldId);
        fieldOk = false;
      }
      if (observation.fieldId === "source.independent_quorum"
        && observation.value !== fieldUpstreams.length) {
        derivationMismatchFields.push(observation.fieldId);
        fieldOk = false;
      }
      if (observation.provenance.mode === "derived_from_observations") {
        const formula = observation.lineage.formula?.trim() ?? "";
        const allowlistedFormula = pass6AllowedDerivationFormula(observation.fieldId);
        const expectedDerivationDigest = formula === allowlistedFormula
          ? pass6ObservationDerivationDigest({
            fieldId: observation.fieldId,
            value: observation.value,
            rawValue: observation.rawValue,
            formula,
            evidenceRefs: observation.evidenceRefs,
            sourceReceipts: fieldEvidenceMatched,
          })
          : null;
        if (!expectedDerivationDigest || observation.provenance.derivationDigest !== expectedDerivationDigest) {
          derivationMismatchFields.push(observation.fieldId);
          fieldOk = false;
        }
      } else if (observation.provenance.mode === "provider_observation"
        || observation.provenance.mode === "durable_snapshot"
        || observation.provenance.mode === "manual_review") {
        if (observation.lineage.formula !== null || observation.provenance.derivationDigest !== null
          || fieldEvidenceMatched.length === 0) {
          derivationMismatchFields.push(observation.fieldId);
          fieldOk = false;
        }
      }
    }
    if (fieldOk) completeFields.add(observation.fieldId);
    else missingFields.push(observation.fieldId);
  }

  // Only receipts actually bound by a canonical field may satisfy the packet's
  // tier quorum.  Otherwise unrelated, unused receipts could pad the global
  // count while the exported claims remain backed by fewer sources.
  const independentUpstreams = independentReceipts([...packetReferencedReceipts])
    .map(independentUpstream)
    .filter((value): value is string => Boolean(value))
    .sort();
  const completenessBps = expectedFieldCount > 0
    ? Math.floor((completeFields.size * 10_000) / expectedFieldCount)
    : 0;
  const blockers = Array.from(new Set([
    canonicalReceipt.status !== "passed" ? `canonical_packet_invalid:${canonicalReceipt.errors.join(",")}` : null,
    args.packet.tier !== args.requestedTier ? `requested_tier_mismatch:${args.requestedTier}:${args.packet.tier}` : null,
    independentUpstreams.length < requiredIndependentUpstreamCount
      ? `independent_upstream_quorum:${independentUpstreams.length}/${requiredIndependentUpstreamCount}`
      : null,
    completenessBps < 10_000 ? `critical_field_completeness:${completenessBps}/10000` : null,
    missingEvidenceDeclared ? "missing_evidence_declared" : null,
    manualReviewAuthorityRequired && !manualReviewAuthorityVerified
      ? `manual_review_authority:${manualReviewAuthorityVerification?.blockers.join(",")
        || (manualReviewAuthorityVerification?.ok ? "durable_nonce_consumption_required" : "missing")}`
      : null,
    missingFields.length ? `incomplete_fields:${missingFields.length}` : null,
  ].filter((value): value is string => Boolean(value))));
  const criticalFieldComplete = blockers.length === 0 && completenessBps === 10_000;
  // Basic is always a consciously non-paid preview, even when every preview
  // field is complete.  Keeping the paid bit false prevents a signed Basic
  // receipt from being reused as an accidental paid-delivery authorization.
  const paidDeliveryEligible = args.packet.tier !== "basic" && criticalFieldComplete;
  const unsigned: Omit<Pass6CommercialFieldCompletenessReceipt, "receiptDigest"> = {
    schemaVersion: PASS6_COMMERCIAL_FIELD_COMPLETENESS_ID,
    caseId: args.packet.caseId,
    module: args.packet.module,
    tier: args.packet.tier,
    status: criticalFieldComplete ? "complete" : args.packet.tier === "basic" ? "preview_only" : "blocked",
    paidDeliveryEligible,
    targetCompletenessBps: PASS6_COMMERCIAL_FIELD_COMPLETENESS_TARGET_BPS,
    completenessBps,
    expectedFieldCount,
    completeFieldCount: completeFields.size,
    independentUpstreamCount: independentUpstreams.length,
    requiredIndependentUpstreamCount,
    independentUpstreams,
    missingFields: Array.from(new Set(missingFields)).sort(),
    explicitMissingFields: Array.from(new Set(explicitMissingFields)).sort(),
    unavailableSentinelFields: Array.from(new Set(unavailableSentinelFields)).sort(),
    staleFields: Array.from(new Set(staleFields)).sort(),
    offlineFixtureFields: Array.from(new Set(offlineFixtureFields)).sort(),
    unboundFields: Array.from(new Set(unboundFields)).sort(),
    capabilityMismatchFields: Array.from(new Set(capabilityMismatchFields)).sort(),
    fieldEvidenceMismatchFields: Array.from(new Set(fieldEvidenceMismatchFields)).sort(),
    derivationMismatchFields: Array.from(new Set(derivationMismatchFields)).sort(),
    quorumShortfallFields: Array.from(new Set(quorumShortfallFields)).sort(),
    lowConfidenceFields: Array.from(new Set(lowConfidenceFields)).sort(),
    missingEvidenceDeclared,
    manualReviewAuthorityVerified,
    manualReviewAuthorityFingerprint,
    blockers,
    packetDigest: canonicalReceipt.packetDigest,
    sourceReceiptRoot,
  };
  return { ...unsigned, receiptDigest: sha256Digest(canonicalJson(canonicalReceiptSeed(unsigned))) };
}

export function verifyPass6CommercialFieldCompletenessReceipt(receipt: Pass6CommercialFieldCompletenessReceipt) {
  if (receipt.schemaVersion !== PASS6_COMMERCIAL_FIELD_COMPLETENESS_ID) return false;
  if (!/^sha256:[a-f0-9]{64}$/i.test(receipt.packetDigest)
    || !/^sha256:[a-f0-9]{64}$/i.test(receipt.sourceReceiptRoot)
    || !/^sha256:[a-f0-9]{64}$/i.test(receipt.receiptDigest)) return false;
  const { receiptDigest, ...unsigned } = receipt;
  return sha256Digest(canonicalJson(canonicalReceiptSeed(unsigned))) === receiptDigest;
}

export function assertPass6PaidCommercialCompleteness(
  payload: unknown,
  requestedTier: string,
  manualReviewAuthority?: Pass6ManualReviewAuthorityContext | null,
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("pass6_paid_payload_object_required");
  }
  const normalizedTier = requestedTier.toLowerCase();
  if (normalizedTier !== "basic" && normalizedTier !== "pro" && normalizedTier !== "advanced") {
    throw new Error("pass6_commercial_tier_invalid");
  }
  const basicPreview = normalizedTier === "basic";
  const requestedTierLabel = normalizedTier === "advanced" ? "Advanced" : normalizedTier === "pro" ? "Pro" : "Basic";
  const candidate = payload as {
    deliveryPolicy?: { status?: string; visibleTier?: string | null; paidEvidenceAllowed?: boolean };
    pass6CommercialFieldCompleteness?: Pass6CommercialFieldCompletenessReceipt;
    pass4824CanonicalFieldPacket?: Pass4824CanonicalFieldPacket;
    receipts?: SourceReceipt[];
  };
  const deliveryReady = basicPreview
    ? candidate.deliveryPolicy?.status === "ready_basic"
      && candidate.deliveryPolicy.visibleTier === "Basic"
      && candidate.deliveryPolicy.paidEvidenceAllowed === false
    : candidate.deliveryPolicy?.status === "ready_paid"
      && candidate.deliveryPolicy.visibleTier === requestedTierLabel
      && candidate.deliveryPolicy.paidEvidenceAllowed === true;
  if (!deliveryReady) {
    throw new Error("pass6_paid_delivery_policy_not_ready");
  }
  const receipt = candidate.pass6CommercialFieldCompleteness;
  if (!receipt || !verifyPass6CommercialFieldCompletenessReceipt(receipt)) {
    throw new Error("pass6_paid_completeness_receipt_missing_or_invalid");
  }
  if (!basicPreview && (!receipt.paidDeliveryEligible || receipt.status !== "complete" || receipt.completenessBps !== 10_000)) {
    throw new Error(`pass6_paid_critical_fields_incomplete:${receipt.completenessBps}:${receipt.blockers.join("|")}`);
  }
  if (basicPreview && receipt.status !== "complete" && receipt.status !== "preview_only") {
    throw new Error("pass6_basic_preview_completeness_state_invalid");
  }
  if (basicPreview && receipt.paidDeliveryEligible) {
    throw new Error("pass6_basic_preview_must_not_be_paid_eligible");
  }
  if (basicPreview && receipt.blockers.some((blocker) => (
    blocker.startsWith("canonical_packet_invalid:") || blocker.startsWith("requested_tier_mismatch:")
  ))) {
    throw new Error("pass6_basic_preview_canonical_packet_invalid");
  }
  if (receipt.tier !== normalizedTier) throw new Error("pass6_paid_completeness_tier_mismatch");
  const packet = candidate.pass4824CanonicalFieldPacket;
  if (!packet || !Array.isArray(candidate.receipts)) {
    throw new Error("pass6_paid_completeness_inputs_missing");
  }
  let recomputed: Pass6CommercialFieldCompletenessReceipt;
  try {
    recomputed = buildPass6CommercialFieldCompletenessReceipt({
      packet,
      sourceReceipts: candidate.receipts,
      requestedTier: normalizedTier as Pass4824DataTier,
      manualReviewAuthority,
    });
  } catch {
    throw new Error("pass6_paid_completeness_recomputation_failed");
  }
  if (recomputed.receiptDigest !== receipt.receiptDigest
    || recomputed.packetDigest !== receipt.packetDigest
    || recomputed.sourceReceiptRoot !== receipt.sourceReceiptRoot) {
    throw new Error("pass6_paid_completeness_receipt_payload_mismatch");
  }
  if (!basicPreview && (!recomputed.paidDeliveryEligible || recomputed.completenessBps !== 10_000)) {
    throw new Error(`pass6_paid_critical_fields_recomputed_incomplete:${recomputed.completenessBps}:${recomputed.blockers.join("|")}`);
  }
  if (basicPreview && recomputed.status !== "complete" && recomputed.status !== "preview_only") {
    throw new Error("pass6_basic_preview_recomputed_state_invalid");
  }
  if (basicPreview && recomputed.paidDeliveryEligible) {
    throw new Error("pass6_basic_preview_recomputed_paid_eligibility_invalid");
  }
  if (basicPreview && recomputed.blockers.some((blocker) => (
    blocker.startsWith("canonical_packet_invalid:") || blocker.startsWith("requested_tier_mismatch:")
  ))) {
    throw new Error("pass6_basic_preview_recomputed_canonical_packet_invalid");
  }
}
