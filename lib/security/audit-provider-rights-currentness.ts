import registrySource from "@/config/p90/audit-provider-field-rights-currentness-registry.json" with { type: "json" };
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildAuditProviderEvidenceDimensions,
  isSuccessfulAuditProviderLane,
  type AuditProviderEvidenceLaneLike,
} from "@/lib/security/audit-provider-evidence-dimensions";
import type { AuditTierId } from "@/lib/security/audit-tier-contract";

export const PASS4826_AUDIT_PROVIDER_RIGHTS_CURRENTNESS_ID = "pass4826-audit-provider-field-rights-currentness-v1" as const;
export const PASS4826_AUDIT_PROVIDER_RIGHTS_REGISTRY_SCHEMA = "velmere.p90.audit-provider-field-rights-currentness-registry.v1" as const;
export const PASS4826_AUDIT_PROVIDER_RIGHTS_SUMMARY_SCHEMA = "velmere.p90.audit-provider-rights-currentness-customer-summary.v1" as const;
export const PASS4830_AUDIT_PROVIDER_PUBLIC_AVAILABILITY_SCHEMA = "velmere.p90.audit-provider-public-availability.v1" as const;

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const FIELD_ID = /^[a-z0-9][a-z0-9._-]{2,119}$/;
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

export type AuditProviderRightsPurpose =
  | "internalDiagnosticAllowed"
  | "customerDerivedDisplayAllowed"
  | "paidTierAllowed"
  | "pdfDerivedExportAllowed"
  | "derivedEvidenceRetentionAllowed"
  | "rawRedistributionAllowed"
  | "aiRagAllowed";

export type AuditProviderRightsField = {
  fieldId: string;
  rawOrDerived: string;
  tiers: AuditTierId[];
  semanticClass: string;
  currentnessMode: string;
  customerCurrentnessEligible: boolean;
  customerLabelRequirement: string;
};

export type AuditProviderDataCurrentnessPolicy = {
  mode: "retrieval_snapshot" | "provider_timestamp_required";
  maxAgeSeconds: number;
  maxFutureSkewSeconds: number;
  allowedTimestampProvenance: Array<"provider" | "chain_block" | "retrieval_snapshot">;
};

export type AuditProviderRightsSource = {
  sourceId: string;
  title: string;
  url: string;
  officialDomain: string;
  sourceClass: string;
  capturedAt: string;
  observedLastUpdated: string | null;
  reverifyBy: string;
  facts: string[];
  rawDocumentStored: boolean;
  rawDocumentSha256: string | null;
  captureMethod: string;
  sourceLocationSha256: string;
  observationSha256: string;
};

export type AuditProviderRightsDecision = {
  providerId: string;
  providerFamily: string;
  technicalState: string;
  currentPlanEvidence: string;
  engineeringClassification: string;
  legalApprovalStatus: "APPROVED" | "NOT_APPROVED" | "WITHHELD";
  requiredPlanOrConsent: string;
  attributionRequired: boolean | null;
  sourceIds: string[];
  capturedAt: string;
  reverifyBy: string;
  currentness: AuditProviderDataCurrentnessPolicy;
  fields: AuditProviderRightsField[];
  rights: Record<AuditProviderRightsPurpose, boolean>;
  blockers: string[];
  decisionSha256: string;
};

export type AuditProviderRightsRegistry = {
  schemaVersion: typeof PASS4826_AUDIT_PROVIDER_RIGHTS_REGISTRY_SCHEMA;
  revisionId: string;
  capturedAt: string;
  reverifyBy: string;
  reviewClass: string;
  truthBoundary: string;
  rawTermsStoredInSource: boolean;
  rawTermsDocumentHashAvailable: boolean;
  globalState: Record<string, unknown>;
  requiredPurposesByTier: Record<AuditTierId, AuditProviderRightsPurpose[]>;
  sources: Record<string, AuditProviderRightsSource>;
  providers: AuditProviderRightsDecision[];
  registrySha256: string;
};

export type AuditProviderRightsResolution = {
  schemaVersion: typeof PASS4826_AUDIT_PROVIDER_RIGHTS_CURRENTNESS_ID;
  providerId: string;
  providerFamily: string | null;
  tier: AuditTierId;
  allowed: boolean;
  current: boolean;
  legalApprovalStatus: string | null;
  requiredPurposes: AuditProviderRightsPurpose[];
  allowedPurposes: AuditProviderRightsPurpose[];
  fieldIds: string[];
  sourceIds: string[];
  reverifyBy: string | null;
  registrySha256: string | null;
  decisionSha256: string | null;
  blockers: string[];
  resolutionSha256: string;
};


export type AuditProviderPublicAvailability = {
  schemaVersion: typeof PASS4830_AUDIT_PROVIDER_PUBLIC_AVAILABILITY_SCHEMA;
  tier: AuditTierId;
  status: "eligible" | "withheld";
  commercialUseReady: boolean;
  reasonCode: "provider_evidence_available" | "provider_evidence_rights_or_currentness_unverified";
  registryDigest: string;
  evaluatedAt: string;
  reverifyBy: string | null;
  limitationCodes: string[];
  availabilityDigest: string;
};

export type AuditProviderRightsCustomerSummary = {
  schemaVersion: typeof PASS4826_AUDIT_PROVIDER_RIGHTS_SUMMARY_SCHEMA;
  registryDigest: string;
  evaluatedAt: string;
  reverifyBy: string | null;
  tier: AuditTierId;
  successfulTechnicalProviders: number;
  dataCurrentProviders: number;
  rightsCurrentProviders: number;
  technicalStrictReceipts: number;
  rightsCurrentStrictReceipts: number;
  technicalLiveExecutions: number;
  rightsCurrentLiveExecutions: number;
  rightsCurrentProviderFamilies: number;
  rightsCurrentUpstreamRoots: number;
  customerRelevantFields: number;
  rightsCurrentFields: number;
  blockedFields: number;
  commercialUseReady: boolean;
  limitationCodes: string[];
  summaryDigest: string;
};

function digestBare(value: unknown) {
  return sha256Digest(typeof value === "string" ? value : canonicalJson(value)).replace(/^sha256:/, "");
}

function omitKey<T extends Record<string, unknown>>(value: T, key: string) {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function dateIsCurrent(capturedAt: unknown, reverifyBy: unknown, nowMs: number) {
  return validDate(capturedAt)
    && validDate(reverifyBy)
    && Date.parse(String(capturedAt)) <= nowMs
    && Date.parse(String(reverifyBy)) > nowMs;
}

function cleanBlocker(value: string) {
  return value.replace(/[^a-z0-9:._/-]+/gi, "_").slice(0, 180);
}

function classifyCustomerLimitation(blocker: string) {
  if (/expired|reverify|not_effective|captured_in_future|timestamp|stale|currentness|future|age_seconds/i.test(blocker)) return "rights_currentness_unverified";
  if (/registry|digest|schema|source_|decision_|record_missing|ambiguous|duplicate/i.test(blocker)) return "rights_evidence_integrity_unverified";
  if (/legal_approval|purpose_not_allowed|customer_delivery|paid_tier|pdf_export|retention|written|consent/i.test(blocker)) return "commercial_rights_unapproved";
  if (/plan|attribution/i.test(blocker)) return "provider_plan_or_attribution_unbound";
  return "provider_rights_unverified";
}

export function getCanonicalAuditProviderRightsRegistry(): AuditProviderRightsRegistry {
  return structuredClone(registrySource) as AuditProviderRightsRegistry;
}

export function verifyAuditProviderRightsRegistry(
  registry: AuditProviderRightsRegistry,
  now = new Date().toISOString(),
) {
  const blockers: string[] = [];
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) blockers.push("evaluation_time_invalid");
  if (registry.schemaVersion !== PASS4826_AUDIT_PROVIDER_RIGHTS_REGISTRY_SCHEMA) blockers.push("registry_schema_invalid");
  if (!SHA256_HEX.test(registry.registrySha256 ?? "")) blockers.push("registry_digest_invalid");
  else if (digestBare(omitKey(registry as unknown as Record<string, unknown>, "registrySha256")) !== registry.registrySha256) blockers.push("registry_digest_mismatch");
  if (registry.rawTermsStoredInSource !== false) blockers.push("raw_terms_must_not_be_packaged");
  if (typeof registry.rawTermsDocumentHashAvailable !== "boolean") blockers.push("raw_terms_document_hash_availability_invalid");
  if (!dateIsCurrent(registry.capturedAt, registry.reverifyBy, nowMs)) blockers.push("registry_currentness_invalid");

  const expectedPurposes: Record<AuditTierId, AuditProviderRightsPurpose[]> = {
    basic: ["customerDerivedDisplayAllowed", "pdfDerivedExportAllowed", "derivedEvidenceRetentionAllowed"],
    pro: ["customerDerivedDisplayAllowed", "paidTierAllowed", "pdfDerivedExportAllowed", "derivedEvidenceRetentionAllowed"],
    advanced: ["customerDerivedDisplayAllowed", "paidTierAllowed", "pdfDerivedExportAllowed", "derivedEvidenceRetentionAllowed"],
  };
  for (const tier of ["basic", "pro", "advanced"] as const) {
    const actual = unique((registry.requiredPurposesByTier?.[tier] ?? []).map(String));
    const expected = unique(expectedPurposes[tier]);
    if (canonicalJson(actual) !== canonicalJson(expected)) blockers.push(`required_purposes_invalid:${tier}`);
  }

  const sourceIds = Object.keys(registry.sources ?? {});
  if (sourceIds.length === 0) blockers.push("sources_missing");
  for (const [sourceId, source] of Object.entries(registry.sources ?? {})) {
    if (source.sourceId !== sourceId) blockers.push(`source_id_mismatch:${sourceId}`);
    if (!source.url?.startsWith("https://")) blockers.push(`source_url_invalid:${sourceId}`);
    try {
      const host = new URL(source.url).hostname.toLowerCase();
      if (host !== source.officialDomain?.toLowerCase()) blockers.push(`source_domain_mismatch:${sourceId}`);
    } catch {
      blockers.push(`source_url_parse_failed:${sourceId}`);
    }
    if (!SHA256_HEX.test(source.sourceLocationSha256 ?? "") || digestBare(source.url) !== source.sourceLocationSha256) blockers.push(`source_location_digest_invalid:${sourceId}`);
    if (!SHA256_HEX.test(source.observationSha256 ?? "") || digestBare(omitKey(source as unknown as Record<string, unknown>, "observationSha256")) !== source.observationSha256) blockers.push(`source_observation_digest_invalid:${sourceId}`);
    if (!dateIsCurrent(source.capturedAt, source.reverifyBy, nowMs)) blockers.push(`source_currentness_invalid:${sourceId}`);
    if (source.rawDocumentStored !== false) blockers.push(`raw_source_packaged:${sourceId}`);
    if (source.rawDocumentSha256 != null && !SHA256_HEX.test(source.rawDocumentSha256)) blockers.push(`raw_source_digest_invalid:${sourceId}`);
    if (registry.rawTermsDocumentHashAvailable === true && !SHA256_HEX.test(source.rawDocumentSha256 ?? "")) blockers.push(`raw_terms_document_hash_missing:${sourceId}`);
    if (!Array.isArray(source.facts) || source.facts.length === 0) blockers.push(`source_facts_missing:${sourceId}`);
  }

  const seenProviders = new Set<string>();
  for (const provider of registry.providers ?? []) {
    const providerId = provider.providerId?.trim().toLowerCase();
    if (!PROVIDER_ID.test(providerId ?? "")) blockers.push(`provider_id_invalid:${providerId || "missing"}`);
    if (seenProviders.has(providerId)) blockers.push(`ambiguous_provider_record:${providerId}`);
    seenProviders.add(providerId);
    if (!SHA256_HEX.test(provider.decisionSha256 ?? "") || digestBare(omitKey(provider as unknown as Record<string, unknown>, "decisionSha256")) !== provider.decisionSha256) blockers.push(`provider_decision_digest_invalid:${providerId}`);
    if (!dateIsCurrent(provider.capturedAt, provider.reverifyBy, nowMs)) blockers.push(`provider_currentness_invalid:${providerId}`);
    if (!Array.isArray(provider.sourceIds) || provider.sourceIds.length === 0) blockers.push(`provider_sources_missing:${providerId}`);
    for (const sourceId of provider.sourceIds ?? []) if (!registry.sources?.[sourceId]) blockers.push(`provider_source_unbound:${providerId}:${sourceId}`);
    const currentness = provider.currentness;
    if (!currentness || (currentness.mode !== "retrieval_snapshot" && currentness.mode !== "provider_timestamp_required")) blockers.push(`provider_data_currentness_mode_invalid:${providerId}`);
    if (!Number.isInteger(currentness?.maxAgeSeconds) || currentness.maxAgeSeconds < 1 || currentness.maxAgeSeconds > 86_400) blockers.push(`provider_data_currentness_max_age_invalid:${providerId}`);
    if (!Number.isInteger(currentness?.maxFutureSkewSeconds) || currentness.maxFutureSkewSeconds < 0 || currentness.maxFutureSkewSeconds > 600) blockers.push(`provider_data_currentness_future_skew_invalid:${providerId}`);
    const allowedTimestampProvenance = unique((currentness?.allowedTimestampProvenance ?? []).map(String));
    if (allowedTimestampProvenance.length === 0 || allowedTimestampProvenance.some((item) => !["provider", "chain_block", "retrieval_snapshot"].includes(item))) blockers.push(`provider_data_currentness_provenance_invalid:${providerId}`);
    if (currentness?.mode === "provider_timestamp_required" && allowedTimestampProvenance.includes("retrieval_snapshot")) blockers.push(`provider_data_currentness_retrieval_not_allowed:${providerId}`);
    const fieldIds = new Set<string>();
    for (const field of provider.fields ?? []) {
      if (!FIELD_ID.test(field.fieldId ?? "")) blockers.push(`field_id_invalid:${providerId}`);
      if (fieldIds.has(field.fieldId)) blockers.push(`duplicate_field_id:${providerId}:${field.fieldId}`);
      fieldIds.add(field.fieldId);
      if (!Array.isArray(field.tiers) || field.tiers.length === 0 || field.tiers.some((tier) => !["basic", "pro", "advanced"].includes(tier))) blockers.push(`field_tiers_invalid:${providerId}:${field.fieldId}`);
      if (!field.semanticClass || !/^[a-z0-9._-]{3,80}$/i.test(field.semanticClass)) blockers.push(`field_semantic_class_invalid:${providerId}:${field.fieldId}`);
      if (!field.currentnessMode || !/^[a-z0-9._-]{3,120}$/i.test(field.currentnessMode)) blockers.push(`field_currentness_mode_invalid:${providerId}:${field.fieldId}`);
      if (typeof field.customerCurrentnessEligible !== "boolean") blockers.push(`field_currentness_eligibility_missing:${providerId}:${field.fieldId}`);
      if (!field.customerLabelRequirement || field.customerLabelRequirement.length > 180) blockers.push(`field_customer_label_requirement_invalid:${providerId}:${field.fieldId}`);
    }
  }

  return {
    valid: blockers.length === 0,
    blockers: unique(blockers.map(cleanBlocker)),
    registrySha256: SHA256_HEX.test(registry.registrySha256 ?? "") ? registry.registrySha256 : null,
    reverifyBy: validDate(registry.reverifyBy) ? registry.reverifyBy : null,
  } as const;
}

export function resolveAuditProviderRightsCurrentness(input: {
  providerId: string;
  tier: AuditTierId;
  registry?: AuditProviderRightsRegistry;
  now?: string;
}): AuditProviderRightsResolution {
  const registry = input.registry ?? getCanonicalAuditProviderRightsRegistry();
  const now = input.now ?? new Date().toISOString();
  const registryProof = verifyAuditProviderRightsRegistry(registry, now);
  const normalizedId = input.providerId.trim().toLowerCase();
  const matches = registry.providers.filter((row) => row.providerId.trim().toLowerCase() === normalizedId);
  const provider = matches.length === 1 ? matches[0]! : null;
  const blockers = [...registryProof.blockers];
  if (matches.length === 0) blockers.push("provider_rights_record_missing");
  if (matches.length > 1) blockers.push("ambiguous_provider_rights_records");
  const nowMs = Date.parse(now);
  if (provider && !dateIsCurrent(provider.capturedAt, provider.reverifyBy, nowMs)) blockers.push("provider_rights_currentness_invalid");
  if (provider?.legalApprovalStatus !== "APPROVED") blockers.push("legal_approval_missing");
  if (registry.rawTermsDocumentHashAvailable !== true) blockers.push("raw_terms_document_hash_unavailable");

  const requiredPurposes = registry.requiredPurposesByTier?.[input.tier] ?? [];
  const allowedPurposes = requiredPurposes.filter((purpose) => provider?.rights?.[purpose] === true);
  for (const purpose of requiredPurposes) {
    if (provider?.rights?.[purpose] !== true) blockers.push(`purpose_not_allowed:${purpose}`);
  }
  const sourceIds = provider?.sourceIds ?? [];
  for (const sourceId of sourceIds) {
    const source = registry.sources?.[sourceId];
    if (!source) continue;
    if (!dateIsCurrent(source.capturedAt, source.reverifyBy, nowMs)) blockers.push(`source_currentness_invalid:${sourceId}`);
    if (registry.rawTermsDocumentHashAvailable === true && !SHA256_HEX.test(source.rawDocumentSha256 ?? "")) blockers.push(`raw_terms_document_hash_missing:${sourceId}`);
  }
  blockers.push(...(provider?.blockers ?? []).filter((item) => /pending|unapproved|not_|missing|blocked|restricted|unbound|consent|review/i.test(item)));
  const tierFields = (provider?.fields ?? []).filter((field) => field.tiers.includes(input.tier));
  const fieldIds = unique(tierFields.map((field) => field.fieldId));
  if (fieldIds.length === 0) blockers.push("tier_field_mapping_missing");
  for (const field of tierFields) {
    if (field.customerCurrentnessEligible !== true) blockers.push(`field_currentness_not_customer_eligible:${field.fieldId}`);
    if (!field.customerLabelRequirement) blockers.push(`field_customer_label_requirement_missing:${field.fieldId}`);
  }
  const normalizedBlockers = unique(blockers.map(cleanBlocker));
  const unsigned = {
    schemaVersion: PASS4826_AUDIT_PROVIDER_RIGHTS_CURRENTNESS_ID,
    providerId: normalizedId,
    providerFamily: provider?.providerFamily ?? null,
    tier: input.tier,
    allowed: normalizedBlockers.length === 0,
    current: provider ? dateIsCurrent(provider.capturedAt, provider.reverifyBy, nowMs) && registryProof.valid : false,
    legalApprovalStatus: provider?.legalApprovalStatus ?? null,
    requiredPurposes,
    allowedPurposes,
    fieldIds,
    sourceIds,
    reverifyBy: provider?.reverifyBy ?? null,
    registrySha256: registryProof.registrySha256,
    decisionSha256: provider?.decisionSha256 ?? null,
    blockers: normalizedBlockers,
  };
  return { ...unsigned, resolutionSha256: digestBare(unsigned) };
}

type AuditProviderLaneTimestampReceipt = AuditProviderEvidenceLaneLike["receipt"] & {
  sourceObservedAt?: string;
  sourceTimestampProvenance?: "provider" | "chain_block" | "retrieval_snapshot" | "transport_received" | "missing" | "invalid";
};

export type AuditProviderLaneCurrentnessResolution = {
  providerId: string;
  current: boolean;
  sourceObservedAt: string | null;
  timestampProvenance: string;
  maxAgeSeconds: number | null;
  ageSeconds: number | null;
  blockers: string[];
  currentnessDigest: string;
};

function resolveAuditProviderLaneCurrentness<T extends AuditProviderEvidenceLaneLike>(input: {
  lane: T;
  provider: AuditProviderRightsDecision | null;
  now: string;
}): AuditProviderLaneCurrentnessResolution {
  const providerId = input.lane.lineage.providerId.trim().toLowerCase();
  const blockers: string[] = [];
  const nowMs = Date.parse(input.now);
  const receipt = input.lane.receipt as AuditProviderLaneTimestampReceipt | undefined;
  const sourceObservedAt = typeof receipt?.sourceObservedAt === "string" ? receipt.sourceObservedAt : null;
  const provenance = typeof receipt?.sourceTimestampProvenance === "string" ? receipt.sourceTimestampProvenance : "missing";
  const sourceMs = sourceObservedAt ? Date.parse(sourceObservedAt) : Number.NaN;
  const transportMs = receipt?.observedAt ? Date.parse(receipt.observedAt) : Number.NaN;
  const policy = input.provider?.currentness ?? null;
  if (!policy) blockers.push("data_currentness_policy_missing");
  if (!receipt) blockers.push("provider_receipt_missing");
  if (!sourceObservedAt) blockers.push("source_timestamp_missing");
  if (sourceObservedAt && !Number.isFinite(sourceMs)) blockers.push("source_timestamp_invalid");
  if (!Number.isFinite(nowMs)) blockers.push("evaluation_time_invalid");
  if (!policy?.allowedTimestampProvenance.includes(provenance as "provider" | "chain_block" | "retrieval_snapshot")) blockers.push(`timestamp_provenance_not_allowed:${provenance}`);
  if (policy?.mode === "provider_timestamp_required" && provenance !== "provider" && provenance !== "chain_block") blockers.push("provider_or_chain_timestamp_required");
  const ageSeconds = Number.isFinite(nowMs) && Number.isFinite(sourceMs) ? Math.floor((nowMs - sourceMs) / 1000) : null;
  if (ageSeconds != null && policy && ageSeconds > policy.maxAgeSeconds) blockers.push(`source_timestamp_stale:${ageSeconds}/${policy.maxAgeSeconds}`);
  if (ageSeconds != null && policy && ageSeconds < -policy.maxFutureSkewSeconds) blockers.push(`source_timestamp_from_future:${ageSeconds}`);
  if (Number.isFinite(sourceMs) && Number.isFinite(transportMs) && policy && sourceMs > transportMs + policy.maxFutureSkewSeconds * 1000) blockers.push("source_timestamp_after_transport");
  const normalized = unique(blockers.map(cleanBlocker));
  const unsigned = {
    providerId,
    current: normalized.length === 0,
    sourceObservedAt,
    timestampProvenance: provenance,
    maxAgeSeconds: policy?.maxAgeSeconds ?? null,
    ageSeconds,
    blockers: normalized,
  };
  return { ...unsigned, currentnessDigest: digestBare(unsigned) };
}

function providerIdOf<T extends AuditProviderEvidenceLaneLike>(lane: T) {
  return lane.lineage.providerId.trim().toLowerCase();
}

export function evaluateAuditProviderRightsCurrentness<T extends AuditProviderEvidenceLaneLike>(input: {
  lanes: T[];
  tier: AuditTierId;
  registry?: AuditProviderRightsRegistry;
  now?: string;
}) {
  const registry = input.registry ?? getCanonicalAuditProviderRightsRegistry();
  const now = input.now ?? new Date().toISOString();
  const eligibleLanes = input.lanes.filter((lane) => Array.isArray((lane as T & { tier?: string[] }).tier)
    ? ((lane as T & { tier?: string[] }).tier ?? []).includes(input.tier)
    : true);
  const dimensions = buildAuditProviderEvidenceDimensions(eligibleLanes);
  const rawSuccessfulLanes = eligibleLanes.filter(isSuccessfulAuditProviderLane);
  const rawSuccessfulProviderCounts = new Map<string, number>();
  for (const lane of rawSuccessfulLanes) {
    const providerId = providerIdOf(lane);
    rawSuccessfulProviderCounts.set(providerId, (rawSuccessfulProviderCounts.get(providerId) ?? 0) + 1);
  }
  const duplicateSuccessfulProviderIds = Array.from(rawSuccessfulProviderCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([providerId]) => providerId)
    .sort();
  const providerIds = unique(dimensions.successfulLiveLanes.map(providerIdOf));
  const resolutions = providerIds.map((providerId) => resolveAuditProviderRightsCurrentness({ providerId, tier: input.tier, registry, now }));
  const resolutionByProvider = new Map(resolutions.map((row) => [row.providerId, row]));
  const providerDecisionById = new Map(registry.providers.map((row) => [row.providerId.trim().toLowerCase(), row]));
  const laneCurrentness = dimensions.successfulLiveLanes.map((lane) => resolveAuditProviderLaneCurrentness({
    lane,
    provider: providerDecisionById.get(providerIdOf(lane)) ?? null,
    now,
  }));
  const currentnessByProvider = new Map(laneCurrentness.map((row) => [row.providerId, row]));
  const laneCustomerEligible = (lane: T) => resolutionByProvider.get(providerIdOf(lane))?.allowed === true
    && currentnessByProvider.get(providerIdOf(lane))?.current === true;
  const dataCurrentProviderIds = unique(laneCurrentness.filter((row) => row.current).map((row) => row.providerId));
  const rightsCurrentStrictLanes = dimensions.strictLanes.filter(laneCustomerEligible);
  const rightsCurrentLiveLanes = dimensions.successfulLiveLanes.filter(laneCustomerEligible);
  const rightsCurrentProviderFamilies = unique(resolutions.filter((row) => row.allowed && currentnessByProvider.get(row.providerId)?.current === true).map((row) => row.providerFamily ?? ""));
  const rightsCurrentUpstreamRoots = unique(rightsCurrentStrictLanes.map((lane) => lane.lineage.upstreamRoot.trim().toLowerCase()));
  const customerRelevantFieldIds = unique(resolutions.flatMap((row) => row.fieldIds));
  const rightsCurrentFieldIds = unique(resolutions.filter((row) => row.allowed && currentnessByProvider.get(row.providerId)?.current === true).flatMap((row) => row.fieldIds));
  const blockedFieldIds = unique(resolutions.filter((row) => !(row.allowed && currentnessByProvider.get(row.providerId)?.current === true)).flatMap((row) => row.fieldIds));
  const blockers = unique([
    ...resolutions.flatMap((resolution) => resolution.blockers.map((blocker) => `${resolution.providerId}:${blocker}`)),
    ...laneCurrentness.flatMap((resolution) => resolution.blockers.map((blocker) => `${resolution.providerId}:${blocker}`)),
    ...providerIds.filter((providerId) => !resolutionByProvider.has(providerId)).map((providerId) => `${providerId}:provider_rights_record_missing`),
    ...duplicateSuccessfulProviderIds.map((providerId) => `${providerId}:duplicate_successful_provider_contributor`),
  ]);
  const registryProof = verifyAuditProviderRightsRegistry(registry, now);
  const commercialUseReady = providerIds.length > 0
    && rightsCurrentLiveLanes.length === dimensions.successfulLiveLanes.length
    && blockedFieldIds.length === 0
    && duplicateSuccessfulProviderIds.length === 0
    && registryProof.valid;
  const result = {
    passId: PASS4826_AUDIT_PROVIDER_RIGHTS_CURRENTNESS_ID,
    tier: input.tier,
    evaluatedAt: now,
    registrySha256: registryProof.registrySha256,
    registryReverifyBy: registryProof.reverifyBy,
    registryValid: registryProof.valid,
    registryBlockers: registryProof.blockers,
    successfulTechnicalProviderIds: providerIds,
    dataCurrentProviderIds,
    rightsCurrentProviderIds: unique(resolutions.filter((row) => row.allowed && currentnessByProvider.get(row.providerId)?.current === true).map((row) => row.providerId)),
    technicalStrictReceiptCount: dimensions.strictReceiptCount,
    rightsCurrentStrictReceiptCount: rightsCurrentStrictLanes.length,
    technicalSuccessfulLiveLaneCount: dimensions.successfulLiveLaneCount,
    rightsCurrentSuccessfulLiveLaneCount: rightsCurrentLiveLanes.length,
    rawSuccessfulLiveLaneCount: rawSuccessfulLanes.length,
    duplicateSuccessfulProviderIds,
    duplicateSuccessfulProviderContributorsRejected: rawSuccessfulLanes.length - dimensions.successfulLiveLaneCount,
    rightsCurrentProviderFamilies,
    rightsCurrentIndependentUpstreamRoots: rightsCurrentUpstreamRoots,
    customerRelevantFieldIds,
    rightsCurrentFieldIds,
    blockedFieldIds,
    resolutions,
    laneCurrentness,
    blockers,
    commercialUseReady,
    truthBoundary: "A provider can contribute to technical readiness without contributing to customer delivery. Commercial readiness counts only successful/strict contributors whose current field-level decision explicitly permits customer-derived display, tier use where applicable, PDF export and derived-evidence retention, and whose source timestamp satisfies the provider-specific currentness policy. Duplicate successful lanes for one canonical provider block commercial readiness instead of depending on order. URLs, retries, transport receipt time and technical success cannot create rights or source currentness.",
  };
  return { ...result, rightsCurrentnessDigest: digestBare(result) } as const;
}

export function buildCustomerSafeAuditProviderRightsSummary(input: ReturnType<typeof evaluateAuditProviderRightsCurrentness>): AuditProviderRightsCustomerSummary {
  const limitationCodes = unique(input.blockers.map((blocker) => classifyCustomerLimitation(blocker)));
  const unsigned = {
    schemaVersion: PASS4826_AUDIT_PROVIDER_RIGHTS_SUMMARY_SCHEMA,
    registryDigest: input.registrySha256 ? `sha256:${input.registrySha256}` : "unavailable",
    evaluatedAt: input.evaluatedAt,
    reverifyBy: input.registryReverifyBy,
    tier: input.tier,
    successfulTechnicalProviders: input.successfulTechnicalProviderIds.length,
    dataCurrentProviders: input.dataCurrentProviderIds.length,
    rightsCurrentProviders: input.rightsCurrentProviderIds.length,
    technicalStrictReceipts: input.technicalStrictReceiptCount,
    rightsCurrentStrictReceipts: input.rightsCurrentStrictReceiptCount,
    technicalLiveExecutions: input.technicalSuccessfulLiveLaneCount,
    rightsCurrentLiveExecutions: input.rightsCurrentSuccessfulLiveLaneCount,
    rightsCurrentProviderFamilies: input.rightsCurrentProviderFamilies.length,
    rightsCurrentUpstreamRoots: input.rightsCurrentIndependentUpstreamRoots.length,
    customerRelevantFields: input.customerRelevantFieldIds.length,
    rightsCurrentFields: input.rightsCurrentFieldIds.length,
    blockedFields: input.blockedFieldIds.length,
    commercialUseReady: input.commercialUseReady,
    limitationCodes,
  };
  return { ...unsigned, summaryDigest: `sha256:${digestBare(unsigned)}` };
}

export function buildPublicAuditProviderAvailability(
  input: AuditProviderRightsCustomerSummary,
): AuditProviderPublicAvailability {
  const limitationCodes = unique(input.limitationCodes.map((code) => {
    if ([
      "rights_currentness_unverified",
      "rights_evidence_integrity_unverified",
      "commercial_rights_unapproved",
      "provider_plan_or_attribution_unbound",
      "provider_rights_unverified",
    ].includes(code)) return code;
    return "provider_rights_unverified";
  })).slice(0, 8);
  const unsigned = {
    schemaVersion: PASS4830_AUDIT_PROVIDER_PUBLIC_AVAILABILITY_SCHEMA,
    tier: input.tier,
    status: input.commercialUseReady ? "eligible" as const : "withheld" as const,
    commercialUseReady: input.commercialUseReady,
    reasonCode: input.commercialUseReady
      ? "provider_evidence_available" as const
      : "provider_evidence_rights_or_currentness_unverified" as const,
    registryDigest: input.registryDigest,
    evaluatedAt: input.evaluatedAt,
    reverifyBy: input.reverifyBy,
    limitationCodes: input.commercialUseReady ? [] : limitationCodes.length ? limitationCodes : ["provider_rights_unverified"],
  };
  return { ...unsigned, availabilityDigest: `sha256:${digestBare(unsigned)}` };
}

