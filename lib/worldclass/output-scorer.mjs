import { createHash } from "node:crypto";

const HEX64 = /^[0-9a-f]{64}$/u;
const BLOCKED_EXPECTATIONS = new Set([
  "blocked_without_evidence",
  "blocked_without_commercial_data",
  "blocked_without_release_rights",
]);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex"); }
function isObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function strings(value) { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function hasPath(object, key) { return Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined && object[key] !== null; }
function evidenceFamilies(output) {
  if (!Array.isArray(output.evidence)) return new Set();
  return new Set(output.evidence.map((row) => isObject(row) ? row.family : null).filter((value) => typeof value === "string" && value.trim()));
}

export function scoreWorldclassOutput({ matrixRow, output, contract, corpusSha256 }) {
  const failures = [];
  const warnings = [];
  const fail = (code, detail = undefined) => failures.push({ code, ...(detail === undefined ? {} : { detail }) });
  const warn = (code, detail = undefined) => warnings.push({ code, ...(detail === undefined ? {} : { detail }) });
  if (!isObject(matrixRow)) fail("matrix_row_invalid");
  if (!isObject(output)) return { ok: false, status: "failed", failures: [{ code: "output_not_object" }], warnings, score: 0, outputSha256: null };
  if (!isObject(contract)) fail("contract_invalid");

  for (const field of contract.commonRequiredFields ?? []) if (!hasPath(output, field)) fail("missing_common_field", field);
  if (output.matrixId !== matrixRow.matrixId) fail("matrix_id_mismatch", { expected: matrixRow.matrixId, actual: output.matrixId });
  if (output.caseId !== matrixRow.caseId) fail("case_id_mismatch", { expected: matrixRow.caseId, actual: output.caseId });
  if (output.surface !== matrixRow.surface) fail("surface_mismatch", { expected: matrixRow.surface, actual: output.surface });
  if (output.tier !== matrixRow.tier) fail("tier_mismatch", { expected: matrixRow.tier, actual: output.tier });
  if (output.locale !== matrixRow.locale || output.language !== matrixRow.locale) fail("locale_mismatch", { expected: matrixRow.locale, actualLocale: output.locale, actualLanguage: output.language });
  if (!contract.statuses.includes(output.status)) fail("status_invalid", output.status);
  if (!HEX64.test(String(output.sourceSha256 ?? ""))) fail("source_sha_invalid");
  if (output.corpusSha256 !== corpusSha256) fail("corpus_sha_mismatch", { expected: corpusSha256, actual: output.corpusSha256 });
  if (!Array.isArray(output.evidence)) fail("evidence_not_array");
  if (!Array.isArray(output.missingData)) fail("missing_data_not_array");
  if (!Array.isArray(output.limitations)) fail("limitations_not_array");
  if (typeof output.confidence !== "number" || !Number.isFinite(output.confidence) || output.confidence < 0 || output.confidence > 100) fail("confidence_invalid", output.confidence);
  if (typeof output.nextSafeCheck !== "string" || !output.nextSafeCheck.trim()) fail("next_safe_check_missing");

  const tierContract = contract.tierRequirements?.[matrixRow.tier];
  if (!tierContract) fail("tier_contract_missing");
  const surfaceFields = contract.surfaceRequirements?.[matrixRow.surface] ?? [];
  const blockedExpected = BLOCKED_EXPECTATIONS.has(matrixRow.expectedOutcome);
  if (blockedExpected && output.status !== "blocked") fail("expected_block_not_enforced", matrixRow.expectedOutcome);
  const blockedOutput = output.status === "blocked";

  if (blockedOutput) {
    if (!strings(output.blockers) || output.blockers.length === 0) fail("blocked_output_without_blockers");
    if (output.confidence > 25) warn("blocked_output_high_confidence", output.confidence);
  } else {
    for (const field of tierContract?.requiredFields ?? []) if (!hasPath(output, field)) fail("missing_tier_field", field);
    for (const field of surfaceFields) if (!hasPath(output, field)) fail("missing_surface_field", field);
    const sections = isObject(output.sections) ? output.sections : {};
    for (const section of matrixRow.requiredSections ?? []) if (!hasPath(sections, section)) fail("missing_required_section", section);
  }

  const families = evidenceFamilies(output);
  const requiredFamilies = Number(matrixRow.minSourceFamilies ?? tierContract?.minimumIndependentSourceFamilies ?? 1);
  if (!blockedOutput && families.size < requiredFamilies) fail("source_family_floor_not_met", { required: requiredFamilies, actual: families.size });
  if (!blockedOutput && output.evidence.some((row) => !isObject(row) || typeof row.sourceId !== "string" || typeof row.family !== "string" || typeof row.freshnessStatus !== "string" || typeof row.licenseStatus !== "string")) {
    fail("evidence_row_invalid");
  }
  if (matrixRow.mustFailClosedOnMissingEvidence && Array.isArray(output.missingData) && output.missingData.length > 0 && output.status === "passed") fail("paid_output_released_with_missing_evidence");
  if (matrixRow.tier !== "basic" && output.commercialRights !== "verified" && output.status === "passed") fail("paid_output_without_commercial_rights", output.commercialRights);
  if (matrixRow.tier !== "basic" && output.entitlementStatus !== "verified" && output.status === "passed") fail("paid_output_without_entitlement", output.entitlementStatus);

  if (matrixRow.surface === "smart_contract_audit" && matrixRow.tier === "advanced" && output.status === "passed") {
    const reviewPolicy = contract.advancedAuditHumanReview ?? {};
    const automatedPolicy = contract.advancedAuditAutomatedInformational ?? null;
    const reviewRequired = reviewPolicy.required === true;
    const humanReviewIncluded = output.claimBoundary?.humanReviewIncluded === true;
    if (reviewRequired && !isObject(output.humanReview)) fail("advanced_audit_human_review_missing");
    if (humanReviewIncluded || reviewRequired) {
      if (!isObject(output.humanReview)) fail("advanced_audit_human_review_missing");
      else {
        for (const field of reviewPolicy.requiredFields ?? []) if (!hasPath(output.humanReview, field)) fail("advanced_audit_review_field_missing", field);
        if (!(reviewPolicy.allowedReviewStatusForRelease ?? ["approved"]).includes(output.humanReview.reviewStatus)) fail("advanced_audit_not_approved", output.humanReview.reviewStatus);
        if (!HEX64.test(String(output.humanReview.reviewReceiptSha256 ?? ""))) fail("advanced_audit_review_receipt_invalid");
      }
    }
    if (automatedPolicy) {
      if (output.analysisMode !== automatedPolicy.analysisMode) fail("advanced_audit_analysis_mode_invalid", output.analysisMode);
      if (!isObject(output.claimBoundary)) fail("advanced_audit_claim_boundary_missing");
      else {
        if (output.claimBoundary.independentCertificationClaimAllowed !== false) fail("advanced_audit_independent_certification_claim_forbidden");
        if (output.claimBoundary.personalisedAdviceAllowed !== false) fail("advanced_audit_personalised_advice_claim_forbidden");
        if (output.claimBoundary.securityGuaranteeAllowed !== false) fail("advanced_audit_security_guarantee_claim_forbidden");
        if (output.claimBoundary.humanReviewClaimAllowed === true && !humanReviewIncluded) fail("advanced_audit_human_review_claim_without_receipt");
      }
      for (const field of automatedPolicy.requiredFields ?? []) if (!hasPath(output, field)) fail("advanced_audit_automated_field_missing", field);
    }
  }

  if (matrixRow.surface === "lens_pdf" && output.status === "passed") {
    if (output.previewHash !== output.downloadHash || output.previewHash !== output.accountCopyHash) fail("pdf_customer_payload_parity_failed", {
      previewHash: output.previewHash,
      downloadHash: output.downloadHash,
      accountCopyHash: output.accountCopyHash,
    });
    for (const field of ["previewHash", "downloadHash", "accountCopyHash"]) if (!HEX64.test(String(output[field] ?? ""))) fail("pdf_hash_invalid", field);
  }

  if (typeof output.customerVerdict === "string" && /guaranteed|certain profit|100% safe/iu.test(output.customerVerdict)) fail("unsupported_certainty_language");
  if (output.numericRiskScore !== undefined && families.size === 0) fail("numeric_score_without_sources");

  const score = Math.max(0, 100 - failures.length * 8 - warnings.length * 2);
  return {
    ok: failures.length === 0,
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    warnings,
    score,
    evidenceFamilyCount: families.size,
    outputSha256: sha256(output),
  };
}
