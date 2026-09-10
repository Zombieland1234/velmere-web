import { createHash } from "node:crypto";

const PURPOSE_TO_RIGHT = Object.freeze({
  internal_diagnostic: "internalDiagnosticAllowed",
  public_display: "publicDisplayAllowed",
  commercial_product: "commercialUseAllowed",
  customer_delivery: "customerDeliveryAllowed",
  caching: "cachingAllowed",
  retention: "retentionAllowed",
  redistribution: "redistributionAllowed",
  pdf_export: "pdfExportAllowed",
  ai_rag: "aiRagAllowed",
  derived_analytics_external: "derivedAnalyticsExternalAllowed",
  paid_tier: "paidTierAllowed",
});
const SHA64 = /^[a-f0-9]{64}$/u;
const clean = (value) => typeof value === "string" ? value.trim() : "";
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
const without = (value, key) => Object.fromEntries(Object.entries(value ?? {}).filter(([candidate]) => candidate !== key));

function validateMatrixBinding(matrix, blockers) {
  const declared = clean(matrix?.matrixSha256);
  if (!SHA64.test(declared)) blockers.push("matrix_digest_invalid");
  else if (sha256(without(matrix, "matrixSha256")) !== declared) blockers.push("matrix_digest_mismatch");
}

function validateSourceBinding(sourceId, source, blockers) {
  if (!source) {
    blockers.push(`source_missing:${sourceId}`);
    return;
  }
  const url = clean(source.url);
  if (!url.startsWith("https://")) blockers.push(`source_url_invalid:${sourceId}`);
  const locationHash = clean(source.sourceLocationHash);
  if (!SHA64.test(locationHash)) blockers.push(`source_location_hash_invalid:${sourceId}`);
  else if (sha256(url) !== locationHash) blockers.push(`source_location_hash_mismatch:${sourceId}`);
  const observationHash = clean(source.observationSha256);
  if (!SHA64.test(observationHash)) blockers.push(`source_observation_hash_invalid:${sourceId}`);
  else if (sha256(without(source, "observationSha256")) !== observationHash) blockers.push(`source_observation_hash_mismatch:${sourceId}`);
}

function validateProviderDecision(row, blockers) {
  const declared = clean(row?.decisionSha256);
  if (!SHA64.test(declared)) blockers.push("provider_decision_digest_invalid");
  else if (sha256(without(row, "decisionSha256")) !== declared) blockers.push("provider_decision_digest_mismatch");
}

export function resolveProviderDeliveryRights({ providerId, purpose, matrix }) {
  const rightKey = PURPOSE_TO_RIGHT[purpose];
  if (!rightKey) throw new TypeError(`Unsupported provider delivery purpose: ${purpose}`);
  const normalizedId = clean(providerId);
  const rows = (matrix?.providers ?? []).filter((row) => clean(row?.providerId) === normalizedId);
  const blockers = [];
  validateMatrixBinding(matrix, blockers);
  if (rows.length === 0) blockers.push("provider_rights_record_missing");
  if (rows.length > 1) blockers.push("ambiguous_provider_rights_records");
  const row = rows.length === 1 ? rows[0] : null;
  const sourceMap = matrix?.sources ?? {};
  const sourceIds = Array.isArray(row?.sourceIds) ? row.sourceIds : [];
  validateProviderDecision(row, blockers);
  if (sourceIds.length === 0) blockers.push("official_source_observation_missing");
  for (const sourceId of sourceIds) validateSourceBinding(sourceId, sourceMap[sourceId], blockers);
  if (purpose === "internal_diagnostic") {
    if (row?.internalDiagnosticAllowed !== true) blockers.push("internal_diagnostic_not_allowed");
  } else {
    if (row?.legalApprovalStatus !== "APPROVED") blockers.push("legal_approval_missing");
    if (row?.rights?.[rightKey] !== true) blockers.push(`purpose_not_allowed:${purpose}`);
    if (matrix?.sourceDocumentHashAvailable !== true) blockers.push("raw_terms_document_hash_unavailable");
  }
  const allowed = blockers.length === 0;
  const receipt = {
    schemaVersion: "velmere.pass36.a102r44p18.provider-delivery-rights-resolution.v2",
    providerId: normalizedId, purpose, allowed, blockers,
    legalApprovalStatus: row?.legalApprovalStatus ?? null,
    engineeringClassification: row?.engineeringClassification ?? null,
    requiredPlanOrConsent: row?.requiredPlanOrConsent ?? null,
    sourceIds, matrixSha256: matrix?.matrixSha256 ?? null,
    decisionSha256: row?.decisionSha256 ?? null,
    diagnosticOnly: matrix?.globalTruthBoundary?.diagnosticOnly === true,
  };
  return { ...receipt, receiptSha256: sha256(receipt) };
}

export function buildProviderRightsProjection({ providerId, matrix }) {
  const purposes = Object.keys(PURPOSE_TO_RIGHT);
  const decisions = Object.fromEntries(purposes.map((purpose) => [purpose, resolveProviderDeliveryRights({ providerId, purpose, matrix })]));
  return {
    schemaVersion: "velmere.pass36.a102r44p18.provider-rights-projection.v2",
    providerId: clean(providerId), decisions,
    customerDeliveryAllowed: decisions.customer_delivery.allowed,
    paidTierAllowed: decisions.paid_tier.allowed,
    publicDisplayAllowed: decisions.public_display.allowed,
    internalDiagnosticAllowed: decisions.internal_diagnostic.allowed,
    projectionSha256: sha256(decisions),
  };
}
