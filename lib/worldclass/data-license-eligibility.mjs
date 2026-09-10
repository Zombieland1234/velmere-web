import { createHash } from "node:crypto";

const HEX64 = /^[0-9a-f]{64}$/u;
const TIERS = new Set(["basic", "pro", "advanced"]);
const LICENSES = new Set(["verified", "display_only", "restricted", "unknown"]);
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function isObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function unique(values) { return [...new Set(values)]; }

export function evaluateDataLicenseEligibility({ cell, evidenceRows = [], entitlementStatus = "unverified", humanReviewStatus = "not_required", renderParityStatus = "not_applicable", evidenceMode = "synthetic", now = new Date().toISOString() }) {
  if (!isObject(cell) || !TIERS.has(cell.tier)) throw new TypeError("Invalid PASS20 matrix cell");
  const nowMs = Date.parse(now);
  const allowed = new Set(cell.allowedLicenseStates ?? []);
  const matching = evidenceRows.filter((row) => isObject(row) && clean(row.fieldId) === cell.fieldId && clean(row.canonicalIdentity) === cell.canonicalIdentity);
  const normalized = matching.map((row) => {
    const observedMs = Date.parse(clean(row.observedAt));
    const ageSeconds = Number.isFinite(nowMs) && Number.isFinite(observedMs) ? Math.max(0, Math.floor((nowMs - observedMs) / 1000)) : Number.POSITIVE_INFINITY;
    const licenseStatus = LICENSES.has(clean(row.licenseStatus)) ? clean(row.licenseStatus) : "unknown";
    return {
      sourceId: clean(row.sourceId),
      family: clean(row.family),
      canonicalIdentity: clean(row.canonicalIdentity),
      fieldId: clean(row.fieldId),
      observedAt: clean(row.observedAt),
      ageSeconds,
      freshnessStatus: ageSeconds <= Number(cell.maxAgeSeconds ?? 0) ? "fresh" : "stale",
      licenseStatus,
      payloadSha256: HEX64.test(clean(row.payloadSha256)) ? clean(row.payloadSha256) : sha256(row.value),
      providerId: clean(row.providerId),
      rightsEvidenceId: clean(row.rightsEvidenceId),
      rightsDocumentSha256: clean(row.rightsDocumentSha256),
      rightsVerified: row.rightsVerified === true,
    };
  });
  const canonicalRightsRequired = evidenceMode === "canonical";
  const usable = normalized.filter((row) => row.freshnessStatus === "fresh" && allowed.has(row.licenseStatus) && (!canonicalRightsRequired || (row.rightsVerified && row.providerId && row.rightsEvidenceId && HEX64.test(row.rightsDocumentSha256))));
  const families = unique(usable.map((row) => row.family).filter(Boolean));
  const blockers = [];
  if (!matching.length) blockers.push("field_evidence_missing");
  if (matching.length && !normalized.some((row) => row.freshnessStatus === "fresh")) blockers.push("field_evidence_stale");
  if (matching.length && !normalized.some((row) => allowed.has(row.licenseStatus))) blockers.push("license_not_eligible");
  if (canonicalRightsRequired && matching.length && !normalized.some((row) => row.rightsVerified && row.providerId && row.rightsEvidenceId && HEX64.test(row.rightsDocumentSha256))) blockers.push("provider_rights_evidence_not_bound");
  if (families.length < Number(cell.minimumIndependentFamilies ?? 1)) blockers.push("independent_source_family_floor_not_met");
  if (cell.requiresCommercialRights && (matching.length === 0 || !normalized.every((row) => row.licenseStatus === "verified"))) blockers.push("commercial_rights_not_verified");
  if (cell.requiresEntitlement && entitlementStatus !== "verified") blockers.push("server_entitlement_not_verified");
  if ((cell.specialGates ?? []).includes("human_review_approved") && humanReviewStatus !== "approved") blockers.push("human_review_not_approved");
  if ((cell.specialGates ?? []).includes("preview_download_account_parity_verified") && renderParityStatus !== "verified") blockers.push("render_parity_not_verified");
  const status = blockers.length ? "blocked" : "eligible";
  const completenessBps = matching.length ? Math.min(10000, Math.round((usable.length / Math.max(1, cell.minimumIndependentFamilies)) * 10000)) : 0;
  const receipt = {
    schemaVersion: "velmere.pass20.data-license-eligibility-receipt.v1",
    cellId: cell.cellId,
    caseId: cell.caseId,
    surface: cell.surface,
    tier: cell.tier,
    fieldId: cell.fieldId,
    canonicalIdentity: cell.canonicalIdentity,
    status,
    blockers,
    independentSourceFamilies: families,
    completenessBps,
    entitlementStatus: cell.requiresEntitlement ? entitlementStatus : "not_required",
    humanReviewStatus,
    renderParityStatus,
    evidenceMode,
    evidence: usable.map(({ sourceId, family, observedAt, ageSeconds, freshnessStatus, licenseStatus, payloadSha256, providerId, rightsEvidenceId, rightsDocumentSha256 }) => ({ sourceId, family, observedAt, ageSeconds, freshnessStatus, licenseStatus, payloadSha256, providerId: providerId || null, rightsEvidenceId: rightsEvidenceId || null, rightsDocumentSha256: rightsDocumentSha256 || null })),
  };
  return { ...receipt, receiptSha256: sha256(receipt) };
}

export function buildRedactedDataLicenseReceipt(input) {
  const receipt = evaluateDataLicenseEligibility(input);
  return {
    schemaVersion: receipt.schemaVersion,
    cellId: receipt.cellId,
    status: receipt.status,
    blockers: receipt.blockers,
    independentSourceFamilies: receipt.independentSourceFamilies,
    completenessBps: receipt.completenessBps,
    evidence: receipt.evidence.map(({ sourceId, family, observedAt, freshnessStatus, licenseStatus, payloadSha256, providerId, rightsEvidenceId, rightsDocumentSha256 }) => ({ sourceId, family, observedAt, freshnessStatus, licenseStatus, payloadSha256, providerId, rightsEvidenceId, rightsDocumentSha256 })),
    receiptSha256: receipt.receiptSha256,
    rawPayloadStored: false,
  };
}
