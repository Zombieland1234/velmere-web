export const CUSTOMER_CONFIDENCE_NOT_CALIBRATED = "NOT_CALIBRATED";

const STATUS_MAP = Object.freeze({
  human_review_queued: "analysis_queue",
  human_review_processing: "analysis_processing",
  human_review_completed: "analysis_completed",
  operator_signoff_pending: "analysis_verification_pending",
});

export function normalizeCustomerStatus(value) {
  const raw = String(value ?? "").trim();
  return STATUS_MAP[raw] ?? raw;
}

export function toCustomerFacingAssessment(input = {}) {
  return Object.freeze({
    findingConfidence: CUSTOMER_CONFIDENCE_NOT_CALIBRATED,
    evidenceCompleteness: input.evidenceCompleteness ?? "UNKNOWN",
    sourceIdentityConfidence: input.sourceIdentityConfidence ?? "NOT_AVAILABLE",
    deploymentReproductionConfidence: input.deploymentReproductionConfidence ?? "NOT_AVAILABLE",
    toolAgreementState: input.toolAgreementState ?? "NOT_APPLICABLE",
    reviewStatus: "AUTOMATED_UNREVIEWED",
    adjudicationStatus: "NOT_PERFORMED",
    uncertainty: Array.isArray(input.uncertainty) ? [...input.uncertainty] : [
      "false-positive rate not independently validated",
      "false-negative rate not independently validated",
      "exploitability not confirmed",
    ],
  });
}
