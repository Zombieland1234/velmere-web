import {
  VLM_FIELD_DEFINITIONS,
  type VlmFieldAvailabilityState,
  type VlmFieldEvidenceById,
} from "@/lib/commerce/vlm-field-level-readiness";
import type {
  VlmCommercialEvidence,
  VlmCommercialProductFamily,
} from "@/lib/commerce/vlm-commercial-readiness";

export const PASS36_R44P22_CURRENT_COMMERCIAL_EVIDENCE_ID =
  "pass36-a102r44p22-ruthless-customer-current-commercial-evidence" as const;

const CURRENT_R44P22_GATES = {
  source_authority: false,
  exact_windows: false,
  full_lint: false,
  full_typecheck: false,
  source_audit: true,
  dual_build: false,
  browser_matrix: false,
  accessibility: true,
  security_privacy: true,
  customer_truth: true,
  current_byte_pdf: false,
  independent_pdf_qa: false,
  external_accuracy: true,
  false_alert_control: true,
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
  entitlement_revocation: true,
} as const;

const availabilityBySource = {
  VELMERE_OWNED: "AVAILABLE_OWNED",
  PUBLIC_BLOCKCHAIN_DIRECT: "BLOCKED_DATA",
  VELMERE_DERIVED: "BLOCKED_DATA",
  USER_SUPPLIED: "AVAILABLE_USER_SUPPLIED",
  EXTERNAL_PROVIDER: "BLOCKED_RIGHTS",
  PUBLIC_REGULATOR_DATA: "BLOCKED_DATA",
  MANUAL_REVIEW: "BLOCKED_OPERATIONS",
  SYNTHETIC_FIXTURE: "SYNTHETIC_ONLY",
} as const satisfies Record<(typeof VLM_FIELD_DEFINITIONS)[number]["sourceClass"], VlmFieldAvailabilityState>;

export function buildCurrentR44P22FieldEvidence(): VlmFieldEvidenceById {
  return Object.fromEntries(VLM_FIELD_DEFINITIONS.map((field) => [field.id, {
    availability: availabilityBySource[field.sourceClass],
    alternativeReady: field.sourceClass === "EXTERNAL_PROVIDER"
      && field.alternative.strategy === "HIDE_FIELD",
    notes: field.sourceClass === "EXTERNAL_PROVIDER"
      ? "The exact provider field remains withheld pending reviewed commercial rights."
      : field.sourceClass === "PUBLIC_BLOCKCHAIN_DIRECT"
        ? "Architecture exists, but this R44P22 sandbox did not execute a current production node receipt."
        : field.sourceClass === "PUBLIC_REGULATOR_DATA"
          ? "Official-source candidate recorded; ingestion and reuse approval are not current-byte proven."
          : null,
  }])) as VlmFieldEvidenceById;
}

export function buildCurrentR44P22CommercialEvidence(
  _family: VlmCommercialProductFamily,
): VlmCommercialEvidence {
  return {
    gates: CURRENT_R44P22_GATES,
    fieldEvidence: buildCurrentR44P22FieldEvidence(),
    auditRecallBps: 9_565,
    controlFlagBps: 0,
    independentlyReviewedCases: 0,
    realCustomerCases: 0,
    rightsApprovedRows: 0,
  };
}

export function currentR44P22CommercialEvidenceSnapshot() {
  return {
    schemaVersion: PASS36_R44P22_CURRENT_COMMERCIAL_EVIDENCE_ID,
    globalDecision: "NO_GO" as const,
    live: false,
    saleEnabled: false,
    productionApproved: false,
    worldClassProven: false,
    currentGates: CURRENT_R44P22_GATES,
    auditRecallBps: 9_565,
    controlFlagBps: 0,
    independentlyReviewedCases: 0,
    realCustomerCases: 0,
    rightsApprovedRows: 0,
    exactRuntimeReason: "Exact Node 24.18.0, npm 11.16.0 and project dependencies were unavailable in the current sandbox; historical build/browser/PDF receipts are superseded by R44P22 source changes.",
  };
}
