import { createHash } from "node:crypto";

const PURPOSE_KEYS = Object.freeze({
  display: "displayUseAllowed",
  commercial: "commercialUseAllowed",
  redistribution: "redistributionAllowed",
  model_training: "modelTrainingAllowed",
});
const SHA64 = /^[a-f0-9]{64}$/u;
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }

export function resolveProviderRights({ providerId, purpose = "display", registry, evidenceManifest, now = new Date().toISOString() }) {
  const purposeKey = PURPOSE_KEYS[purpose];
  if (!purposeKey) throw new TypeError(`Unsupported provider-rights purpose: ${purpose}`);
  const provider = registry?.providers?.find((row) => clean(row?.id) === clean(providerId)) ?? null;
  const blockers = [];
  if (!provider) blockers.push("provider_not_registered");
  if (provider && provider.technicalState !== "CODE_PRESENT") blockers.push("provider_code_not_present");
  const records = (evidenceManifest?.evidence ?? []).filter((row) => row?.providerId === providerId);
  if (records.length === 0) blockers.push("reviewed_rights_evidence_missing");
  if (records.length > 1) blockers.push("ambiguous_multiple_rights_records");
  const evidence = records.length === 1 ? records[0] : null;
  const nowMs = Date.parse(now);
  if (evidence) {
    if (evidence.reviewDecision !== "APPROVED") blockers.push("rights_review_not_approved");
    if (evidence.reviewer?.legalReview !== true) blockers.push("legal_review_missing");
    if (!SHA64.test(clean(evidence.documentSha256))) blockers.push("document_hash_invalid");
    if (!Number.isFinite(Date.parse(evidence.effectiveAt)) || Date.parse(evidence.effectiveAt) > nowMs) blockers.push("rights_not_effective");
    if (evidence.expiresAt != null && (!Number.isFinite(Date.parse(evidence.expiresAt)) || Date.parse(evidence.expiresAt) <= nowMs)) blockers.push("rights_expired");
    if (evidence.rights?.[purposeKey] !== true) blockers.push(`purpose_not_allowed:${purpose}`);
  }
  const allowed = blockers.length === 0;
  const receipt = {
    schemaVersion: "velmere.pass22.provider-rights-resolution.v1",
    providerId: clean(providerId),
    purpose,
    allowed,
    blockers,
    technicalState: provider?.technicalState ?? "UNKNOWN",
    evidenceId: evidence?.evidenceId ?? null,
    documentSha256: evidence?.documentSha256 ?? null,
    reviewDecision: evidence?.reviewDecision ?? null,
    effectiveAt: evidence?.effectiveAt ?? null,
    expiresAt: evidence?.expiresAt ?? null,
    rawDocumentStored: false,
  };
  return { ...receipt, receiptSha256: sha256(receipt) };
}

export function canonicalLicenseState(args) {
  const display = resolveProviderRights({ ...args, purpose: "display" });
  const commercial = resolveProviderRights({ ...args, purpose: "commercial" });
  if (commercial.allowed) return { licenseStatus: "verified", display, commercial };
  if (display.allowed) return { licenseStatus: "display_only", display, commercial };
  return { licenseStatus: "restricted", display, commercial };
}
