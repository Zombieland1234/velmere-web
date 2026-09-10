import { canonicalJson } from "@/lib/security/canonical-json";
import { isSha256Digest, sha256Hex } from "@/lib/security/cryptographic-digest";
import type { ShieldMapCanonicalCustomerIdentity } from "./shield-map-customer-identity";

const MAX_EVIDENCE_AGE_MS = 5 * 60_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const MAX_CALIBRATION_LIFETIME_MS = 366 * 24 * 60 * 60_000;
const RAW_SHA256 = /^[a-f0-9]{64}$/u;
const PROFILE_ID = /^risk-cal-[a-f0-9]{24}$/u;
const RECEIPT_ID = /^p4644_[a-f0-9]{64}$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._:/-]{0,119}$/u;
const SAFE_SYMBOL = /^[A-Z0-9.^=/-]{1,32}$/u;
const REQUIRED_RIGHTS_PURPOSES = [
  "public_display",
  "commercial_product",
  "customer_delivery",
  "derived_analytics_external",
] as const;

type UnknownRecord = Record<string, unknown>;

export type ShieldMapCustomerConfidenceProjection =
  | {
      state: "published";
      value: number;
      calibrationProfileId: string;
      outcomeDefinition: string;
    }
  | {
      state: "withheld";
      value: null;
      blockers: string[];
    };

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const clean = value.trim();
  const hasAsciiControl = Array.from(clean).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  return clean
    && clean.length <= maxLength
    && clean.normalize("NFKC") === clean
    && !hasAsciiControl
    ? clean
    : "";
}

function emptyStringArray(value: unknown): value is [] {
  return Array.isArray(value) && value.length === 0;
}

function validRawDigest(value: unknown) {
  return typeof value === "string" && RAW_SHA256.test(value);
}

function dateMs(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  return Number.NaN;
}

function canonicalIdentity(identity: ShieldMapCanonicalCustomerIdentity | null) {
  const row = asRecord(identity);
  if (!row) return null;
  const providerId = cleanText(row.providerId, 80).toLowerCase();
  const providerFamily = cleanText(row.providerFamily, 80).toLowerCase();
  const symbol = cleanText(row.resolvedSymbol, 32).toUpperCase();
  if (
    !SAFE_ID.test(providerId)
    || !SAFE_ID.test(providerFamily)
    || !SAFE_SYMBOL.test(symbol)
    || row.resolvedQuote !== "USD"
    || typeof row.receiptId !== "string"
    || !RECEIPT_ID.test(row.receiptId)
  ) return null;

  if (row.namespace === "symbol_or_market") {
    const marketId = cleanText(row.resolvedMarketId, 120).toLowerCase();
    return SAFE_ID.test(marketId)
      ? { value: `market:${marketId}`, providerId }
      : null;
  }
  if (row.namespace === "address") {
    const address = cleanText(row.resolvedAddress, 42).toLowerCase();
    const chainId = cleanText(row.resolvedChainId, 80).toLowerCase();
    return /^0x[a-f0-9]{40}$/u.test(address) && SAFE_ID.test(chainId)
      ? { value: `address:${chainId}:${address}`, providerId }
      : null;
  }
  return null;
}

function verifyRightsDecision(
  value: unknown,
  providerId: string,
  purpose: typeof REQUIRED_RIGHTS_PURPOSES[number],
) {
  const decision = asRecord(value);
  if (!decision) return false;
  const sourceIds = decision.sourceIds;
  if (
    decision.schemaVersion !== "velmere.pass36.a102r44p18.provider-delivery-rights-resolution.v2"
    || decision.providerId !== providerId
    || decision.purpose !== purpose
    || decision.allowed !== true
    || !emptyStringArray(decision.blockers)
    || decision.legalApprovalStatus !== "APPROVED"
    || decision.diagnosticOnly !== false
    || !Array.isArray(sourceIds)
    || sourceIds.length === 0
    || !sourceIds.every((sourceId) => Boolean(cleanText(sourceId, 160)))
    || !validRawDigest(decision.matrixSha256)
    || !validRawDigest(decision.decisionSha256)
    || !validRawDigest(decision.receiptSha256)
  ) return false;

  const { receiptSha256: _receiptSha256, ...unsigned } = decision;
  return sha256Hex(canonicalJson(unsigned)) === decision.receiptSha256;
}

function verifyRightsProjection(value: unknown, providerId: string) {
  const projection = asRecord(value);
  const decisions = asRecord(projection?.decisions);
  if (
    !projection
    || !decisions
    || projection.schemaVersion !== "velmere.pass36.a102r44p18.provider-rights-projection.v2"
    || projection.providerId !== providerId
    || projection.customerDeliveryAllowed !== true
    || projection.publicDisplayAllowed !== true
    || !validRawDigest(projection.projectionSha256)
    || sha256Hex(canonicalJson(decisions)) !== projection.projectionSha256
  ) return false;
  return REQUIRED_RIGHTS_PURPOSES.every((purpose) =>
    verifyRightsDecision(decisions[purpose], providerId, purpose));
}

function withheld(blockers: Array<string | null | false>): ShieldMapCustomerConfidenceProjection {
  return {
    state: "withheld",
    value: null,
    blockers: Array.from(new Set(blockers.filter((item): item is string => Boolean(item)))).sort(),
  };
}

/**
 * Customer-visible Shield Map confidence is an empirical probability claim,
 * not the investigator's evidence-coverage heuristic. A number is released
 * only when calibration, current identity-bound delivery and the existing
 * provider-rights resolution are all explicit and internally consistent.
 */
export function projectShieldMapCustomerConfidence(args: {
  identity: ShieldMapCanonicalCustomerIdentity | null;
  result: unknown;
  publication: unknown;
  rightsProjection: unknown;
  evaluatedAt: Date | number | string;
}): ShieldMapCustomerConfidenceProjection {
  try {
    const evaluatedAtMs = dateMs(args.evaluatedAt);
    const boundIdentity = canonicalIdentity(args.identity);
    const result = asRecord(args.result);
    const publication = asRecord(args.publication);
    const delivery = asRecord(result?.providerRiskDelivery);
    const calibration = asRecord(result?.empiricalCalibration);
    const uncertainty = asRecord(result?.uncertainty);
    const customerTruth = asRecord(result?.customerTruth);
    const modelBinding = asRecord(result?.modelBinding);
    const sourceAsOfMs = dateMs(delivery?.sourceAsOf);
    const issuedAtMs = dateMs(calibration?.issuedAt);
    const expiresAtMs = dateMs(calibration?.expiresAt);
    const profileId = cleanText(calibration?.profileId, 80);
    const outcomeDefinition = cleanText(calibration?.outcomeDefinition, 240);
    const probability = calibration?.probability;
    const reasonCards = customerTruth?.reasonCards;

    const blockers: Array<string | null | false> = [
      Number.isFinite(evaluatedAtMs) ? null : "confidence_evaluation_time_invalid",
      boundIdentity ? null : "confidence_identity_unverified",
      result ? null : "confidence_result_invalid",
      publication ? null : "confidence_publication_missing",
      delivery ? null : "confidence_delivery_missing",
      calibration ? null : "confidence_calibration_missing",
      uncertainty ? null : "confidence_uncertainty_missing",
      customerTruth ? null : "confidence_customer_truth_missing",
      modelBinding ? null : "confidence_model_binding_missing",
    ];

    if (!boundIdentity || !result || !publication || !delivery || !calibration || !uncertainty || !customerTruth || !modelBinding) {
      return withheld(blockers);
    }

    blockers.push(
      publication.schemaVersion === "pass6_legacy_route_publication_truth_v1" ? null : "confidence_publication_schema_invalid",
      publication.mode === "live" ? null : "confidence_publication_not_live",
      publication.evidenceState === "verified" ? null : "confidence_publication_unverified",
      publication.scorePublished === true ? null : "confidence_score_not_published",
      publication.canonicalIdentity === boundIdentity.value ? null : "confidence_publication_identity_mismatch",
      publication.completenessBps === 10_000 ? null : "confidence_publication_incomplete",
      emptyStringArray(publication.blockers) ? null : "confidence_publication_blocked",
      delivery.schemaVersion === "pass6_provider_risk_delivery_v1" ? null : "confidence_delivery_schema_invalid",
      delivery.state === "verified" ? null : "confidence_delivery_unverified",
      delivery.scorePublished === true ? null : "confidence_delivery_score_withheld",
      delivery.canonicalIdentity === boundIdentity.value ? null : "confidence_delivery_identity_mismatch",
      delivery.completenessBps === 10_000 ? null : "confidence_delivery_incomplete",
      emptyStringArray(delivery.blockers) ? null : "confidence_delivery_blocked",
      isSha256Digest(delivery.sourceReceiptRoot) ? null : "confidence_source_receipt_invalid",
      isSha256Digest(delivery.receiptDigest) ? null : "confidence_delivery_receipt_invalid",
      publication.sourceReceiptRoot === delivery.sourceReceiptRoot ? null : "confidence_source_receipt_mismatch",
      publication.receiptDigest === delivery.receiptDigest ? null : "confidence_delivery_receipt_mismatch",
      publication.sourceAsOf === delivery.sourceAsOf ? null : "confidence_source_time_mismatch",
      Number.isFinite(sourceAsOfMs) ? null : "confidence_source_time_invalid",
      Number.isFinite(sourceAsOfMs) && Number.isFinite(evaluatedAtMs) && sourceAsOfMs <= evaluatedAtMs + MAX_CLOCK_SKEW_MS
        ? null
        : "confidence_source_time_in_future",
      Number.isFinite(sourceAsOfMs) && Number.isFinite(evaluatedAtMs) && evaluatedAtMs - sourceAsOfMs <= MAX_EVIDENCE_AGE_MS
        ? null
        : "confidence_source_time_stale",
      result.dataQuality === "live" ? null : "confidence_data_not_live",
      modelBinding.schemaVersion === "velmere.risk-model-binding.v1" ? null : "confidence_model_binding_schema_invalid",
      cleanText(modelBinding.scoreFormula, 160) ? null : "confidence_score_formula_missing",
      cleanText(modelBinding.featureSchemaVersion, 120) ? null : "confidence_feature_schema_missing",
      isSha256Digest(modelBinding.featureSchemaDigest) ? null : "confidence_feature_schema_digest_invalid",
      isSha256Digest(modelBinding.providerConfigurationDigest) ? null : "confidence_provider_configuration_digest_invalid",
      cleanText(modelBinding.assetClassCohort, 80) ? null : "confidence_model_cohort_missing",
      calibration.schemaVersion === "velmere.risk-result-calibration.v1" ? null : "confidence_calibration_schema_invalid",
      calibration.status === "holdout_validated" ? null : "confidence_calibration_not_validated",
      PROFILE_ID.test(profileId) ? null : "confidence_calibration_profile_invalid",
      outcomeDefinition ? null : "confidence_calibration_outcome_missing",
      typeof probability === "number" && Number.isFinite(probability) && probability >= 0 && probability <= 1
        ? null
        : "confidence_calibration_probability_invalid",
      isSha256Digest(calibration.integrityDigest) ? null : "confidence_calibration_digest_invalid",
      isSha256Digest(calibration.modelBindingDigest) ? null : "confidence_calibration_binding_digest_invalid",
      Number.isFinite(issuedAtMs) && issuedAtMs <= evaluatedAtMs + MAX_CLOCK_SKEW_MS
        ? null
        : "confidence_calibration_issued_in_future",
      Number.isFinite(expiresAtMs) && expiresAtMs > evaluatedAtMs
        ? null
        : "confidence_calibration_expired",
      Number.isFinite(issuedAtMs) && Number.isFinite(expiresAtMs)
        && expiresAtMs > issuedAtMs && expiresAtMs - issuedAtMs <= MAX_CALIBRATION_LIFETIME_MS
        ? null
        : "confidence_calibration_window_invalid",
      uncertainty.schemaVersion === "velmere.risk-uncertainty.v1" ? null : "confidence_uncertainty_schema_invalid",
      uncertainty.method === "deterministic_evidence_sensitivity" ? null : "confidence_uncertainty_method_invalid",
      uncertainty.interpretation === "sensitivity_band_not_empirical_confidence_interval" ? null : "confidence_uncertainty_interpretation_invalid",
      uncertainty.empiricalCalibrationStatus === "holdout_validated" ? null : "confidence_uncertainty_not_calibrated",
      uncertainty.probabilityClaimAllowed === true ? null : "confidence_probability_claim_disallowed",
      uncertainty.calibrationProfileId === profileId ? null : "confidence_calibration_profile_mismatch",
      uncertainty.outOfDistribution === false ? null : "confidence_out_of_distribution",
      uncertainty.evidenceState === "live_multi_source" ? null : "confidence_multi_source_evidence_missing",
      customerTruth.schemaVersion === "velmere.standalone-customer-truth.v1" ? null : "confidence_customer_truth_schema_invalid",
      customerTruth.contractId === "pass36-a102r44p35-standalone-customer-truth" ? null : "confidence_customer_truth_contract_invalid",
      customerTruth.truthState === "CONFIRMED" ? null : "confidence_customer_truth_not_confirmed",
      customerTruth.confidenceClass === "EVIDENCE_BOUND" ? null : "confidence_not_evidence_bound",
      customerTruth.probabilityClaimAllowed === true ? null : "confidence_customer_probability_disallowed",
      customerTruth.investmentRecommendationAllowed === false ? null : "confidence_investment_boundary_invalid",
      customerTruth.leverageRecommendationAllowed === false ? null : "confidence_leverage_boundary_invalid",
      customerTruth.guaranteedOutcomeClaimAllowed === false ? null : "confidence_guarantee_boundary_invalid",
      emptyStringArray(customerTruth.conflicts) ? null : "confidence_customer_conflict_present",
      emptyStringArray(customerTruth.missingProof) ? null : "confidence_customer_proof_missing",
      Array.isArray(reasonCards) && reasonCards.every((value) => asRecord(value)?.severity !== "BLOCK")
        ? null
        : "confidence_customer_blocking_reason_present",
      verifyRightsProjection(args.rightsProjection, boundIdentity.providerId) ? null : "confidence_rights_unverified",
    );

    if (blockers.some(Boolean)) return withheld(blockers);
    return {
      state: "published",
      value: Math.round((probability as number) * 10_000) / 100,
      calibrationProfileId: profileId,
      outcomeDefinition,
    };
  } catch {
    return withheld(["confidence_projection_invalid"]);
  }
}
