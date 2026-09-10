import {
  VLM_FIELD_DEFINITIONS,
  type VlmFieldAvailabilityState,
  type VlmFieldEvidenceById,
} from "@/lib/commerce/vlm-field-level-readiness";
import type {
  VlmCommercialEvidence,
  VlmCommercialGateId,
  VlmCommercialProductFamily,
} from "@/lib/commerce/vlm-commercial-readiness";

/**
 * Runtime evidence is intentionally conservative. A gate may be true here only
 * when a current-source P36 receipt names the exact claim. Historical R44P21
 * booleans are retained through compatibility aliases below, but no longer
 * drive checkout/readiness decisions.
 */
export const P36_CURRENT_COMMERCIAL_EVIDENCE_ID =
  "velmere.p36.current-commercial-evidence.v1" as const;

export const P36_CURRENT_COMMERCIAL_EVIDENCE_AUTHORITY = Object.freeze({
  schemaVersion: P36_CURRENT_COMMERCIAL_EVIDENCE_ID,
  closureRevision: "P36_CURRENT_BYTE_EVIDENCE_REBASE",
  sourceLineage: "R44P46_P35_PARENT_WITH_P36_CURRENT_CHILD",
  parentSourceAggregateSha256:
    "ddd765b2279d7c5f310a26cc4cba349bee38629d2f44ad5b1d323dc6df91a202",
  evidenceClass: "CURRENT_SOURCE_INTERNAL_ONLY",
  saleEnabled: false,
  live: false,
  productionApproved: false,
  externalAccuracyCases: 0,
  realCustomerCases: 0,
  independentlyReviewedCases: 0,
  rightsApprovedRows: 0,
  receiptBindings: Object.freeze({
    boundedP35Contract: "artifacts/closure/p35/P35_STATIC_SCREEN.json",
    exactToolchainAndBuild: "artifacts/closure/p36/P36_CURRENT_BYTE_BUILD_GATES.json",
    currentEligibilityMatrix: "artifacts/closure/p36/P36_CURRENT_EVIDENCE_AVAILABILITY_MATRIX.json",
    browserRuntimeProfiles: "artifacts/closure/p36/P36_BROWSER_TIER_RUNTIME_PROFILES.json",
    exactCustomerPdf: "artifacts/closure/p36/P36_EXACT_CUSTOMER_PDF_INTEGRATION.json",
    finalTierValue: "artifacts/closure/p36/P36_INTERNAL_FINAL_TIER_CAMPAIGN.json",
    aiOutputRevalidation: "artifacts/closure/p36/P36_AI_FINAL_OUTPUT_REVALIDATION.json",
  }),
  invalidationTriggers: Object.freeze([
    "source-change",
    "lockfile-change",
    "runtime-change",
    "provider-or-rights-change",
    "schema-or-policy-change",
    "product-contract-change",
  ]),
  truthBoundary:
    "Only gates explicitly represented by the current P36 source contract may be true. Missing receipts, real customers, independent review, provider rights, staging, sale and LIVE remain fail-closed.",
} as const);

/**
 * Checkout/readiness cannot read and authenticate filesystem receipts.  It
 * must therefore not mirror audit-runner results as compile-time booleans.
 * Current technical receipts are reported by the P36 closure authority, while
 * this customer-facing runtime remains fail-closed until case-bound evidence
 * is supplied and verified server-side.
 */
const CURRENT_LOCAL_GATES: Readonly<Record<VlmCommercialGateId, boolean>> = Object.freeze({
  source_authority: true,
  exact_windows: false,
  full_lint: false,
  full_typecheck: false,
  source_audit: false,
  dual_build: false,
  browser_matrix: false,
  accessibility: false,
  security_privacy: false,
  customer_truth: false,
  current_byte_pdf: false,
  independent_pdf_qa: false,
  external_accuracy: false,
  false_alert_control: false,
  severity_calibration: false,
  manual_quality_control: false,
  independent_adjudication: false,
  incremental_detection_value: false,
  provider_rights: false,
  real_current_data: false,
  freshness_corrections: false,
  multi_provider_failover: false,
  realized_slippage: false,
  signed_labels: false,
  real_unseen_eval: false,
  probability_calibration: false,
  customer_value: false,
  legal_claims_review: false,
  support_refund_operations: false,
  staging_operations: false,
  payment_test_lifecycle: false,
  entitlement_revocation: false,
});

function availabilityForSource(
  sourceClass: (typeof VLM_FIELD_DEFINITIONS)[number]["sourceClass"],
): VlmFieldAvailabilityState {
  if (sourceClass === "EXTERNAL_PROVIDER") {
    return "BLOCKED_RIGHTS";
  }
  if (sourceClass === "MANUAL_REVIEW") {
    return "BLOCKED_OPERATIONS";
  }
  if (sourceClass === "SYNTHETIC_FIXTURE") return "SYNTHETIC_ONLY";

  // VELMERE_OWNED, VELMERE_DERIVED, USER_SUPPLIED and public-source
  // classifications describe provenance, not availability.  The generic
  // matrix has no case identifier, observation time, freshness receipt,
  // provider/policy binding or immutable evidence payload, so it may not
  // promote any of them to AVAILABLE_*.
  return "BLOCKED_DATA";
}

export function buildCurrentP36FieldEvidence(): VlmFieldEvidenceById {
  return Object.fromEntries(VLM_FIELD_DEFINITIONS.map((field) => {
    const availability = availabilityForSource(field.sourceClass);
    return [field.id, {
      availability,
      alternativeReady:
        availability === "BLOCKED_RIGHTS"
        && field.alternative.strategy === "HIDE_FIELD"
        && field.alternative.zeroBudgetPossible === true,
      notes: availability === "BLOCKED_RIGHTS"
        ? "Withheld until a current, reviewed commercial-rights receipt is bound."
        : availability === "BLOCKED_DATA"
          ? "Current evidence or current-source execution receipt is missing."
          : availability === "BLOCKED_OPERATIONS"
            ? "Manual or independent operations are not currently available."
            : availability === "SYNTHETIC_ONLY"
              ? "Fixture evidence is diagnostic only and cannot be presented as current real evidence."
              : null,
    }];
  })) as VlmFieldEvidenceById;
}

export function buildCurrentP36CommercialEvidence(
  _family: VlmCommercialProductFamily,
): VlmCommercialEvidence {
  return {
    gates: CURRENT_LOCAL_GATES,
    fieldEvidence: buildCurrentP36FieldEvidence(),
    auditRecallBps: null,
    controlFlagBps: null,
    independentlyReviewedCases: 0,
    realCustomerCases: 0,
    rightsApprovedRows: 0,
  };
}

export function currentP36CommercialEvidenceSnapshot() {
  return {
    ...P36_CURRENT_COMMERCIAL_EVIDENCE_AUTHORITY,
    currentLocalGates: CURRENT_LOCAL_GATES,
    auditRecallBps: null,
    controlFlagBps: null,
  } as const;
}

/** @deprecated Historical name retained only for older bounded verifiers. */
export const PASS36_R44P21_CURRENT_COMMERCIAL_EVIDENCE_ID = P36_CURRENT_COMMERCIAL_EVIDENCE_ID;
/** @deprecated Use buildCurrentP36FieldEvidence. */
export const buildCurrentR44P21FieldEvidence = buildCurrentP36FieldEvidence;
/** @deprecated Use buildCurrentP36CommercialEvidence. */
export const buildCurrentR44P21CommercialEvidence = buildCurrentP36CommercialEvidence;
/** @deprecated Use currentP36CommercialEvidenceSnapshot. */
export const currentR44P21CommercialEvidenceSnapshot = currentP36CommercialEvidenceSnapshot;
