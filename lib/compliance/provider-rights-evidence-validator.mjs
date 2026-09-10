import { createHash } from "node:crypto";

const shaPattern = /^[a-f0-9]{64}$/u;
const evidencePattern = /^pre_[a-f0-9]{24}$/u;
const providerPattern = /^[a-z0-9_]{2,64}$/u;
const kinds = new Set(["SIGNED_CONTRACT", "ORDER_FORM", "TERMS_SNAPSHOT", "DPA", "LICENSE_ADDENDUM"]);
const decisions = new Set(["APPROVED", "REJECTED", "NEEDS_CLARIFICATION"]);
const allowedRowKeys = new Set(["schemaVersion","providerId","evidenceId","documentKind","documentSha256","sourceLocationHash","capturedAt","effectiveAt","expiresAt","jurisdiction","reviewer","reviewDecision","rights","restrictions","notesRedacted"]);
const forbiddenRawKey = /(?:raw|body|text|content|attachment|base64|binary|pdf|contractDocument|termsDocument)/iu;

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export function containsForbiddenRawFields(value, path = "root", failures = []) {
  if (Array.isArray(value)) value.forEach((child, index) => containsForbiddenRawFields(child, `${path}[${index}]`, failures));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenRawKey.test(key) && !new Set(["documentSha256","sourceLocationHash","reviewerIdHash","notesRedacted"]).has(key)) failures.push(`${path}.${key}`);
      containsForbiddenRawFields(child, `${path}.${key}`, failures);
    }
  }
  return failures;
}
function validDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
export function validateEvidenceManifest({ registry, manifest, now = Date.now(), requireSingleEvidencePerProvider = true }) {
  const errors=[];
  const providerIds=new Set((registry.providers??[]).map(row=>row.id));
  const seenEvidence=new Set();const seenProviders=new Set();
  if(manifest?.schemaVersion!=="velmere.pass22.provider-rights-evidence-manifest.v1")errors.push("manifest:schema_version");
  if(!Array.isArray(manifest?.evidence))errors.push("manifest:evidence_not_array");
  for(const [index,row] of (manifest?.evidence??[]).entries()){
    const prefix=`evidence[${index}]`;
    if(!row||typeof row!=="object"||Array.isArray(row)){errors.push(`${prefix}:not_object`);continue;}
    for(const key of Object.keys(row))if(!allowedRowKeys.has(key))errors.push(`${prefix}:unknown_field:${key}`);
    if(row.schemaVersion!=="velmere.pass22.provider-rights-evidence.v1")errors.push(`${prefix}:schema_version`);
    if(!providerPattern.test(row.providerId??"")||!providerIds.has(row.providerId))errors.push(`${prefix}:unknown_provider`);
    if(!evidencePattern.test(row.evidenceId??""))errors.push(`${prefix}:evidence_id`);
    if(seenEvidence.has(row.evidenceId))errors.push(`${prefix}:duplicate_evidence_id`);seenEvidence.add(row.evidenceId);
    if(requireSingleEvidencePerProvider&&seenProviders.has(row.providerId))errors.push(`${prefix}:duplicate_provider_evidence`);seenProviders.add(row.providerId);
    if(!kinds.has(row.documentKind))errors.push(`${prefix}:document_kind`);
    if(!shaPattern.test(row.documentSha256??""))errors.push(`${prefix}:document_sha256`);
    if(row.sourceLocationHash!=null&&!shaPattern.test(row.sourceLocationHash))errors.push(`${prefix}:source_location_hash`);
    if(!validDate(row.capturedAt)||!validDate(row.effectiveAt))errors.push(`${prefix}:date`);
    if(row.expiresAt!=null&&!validDate(row.expiresAt))errors.push(`${prefix}:expiry_date`);
    if(typeof row.jurisdiction!=="string"||row.jurisdiction.length<2||row.jurisdiction.length>120)errors.push(`${prefix}:jurisdiction`);
    if(!decisions.has(row.reviewDecision))errors.push(`${prefix}:decision`);
    if(!row.reviewer||!shaPattern.test(row.reviewer.reviewerIdHash??"")||!validDate(row.reviewer.reviewedAt)||typeof row.reviewer.legalReview!=="boolean")errors.push(`${prefix}:reviewer`);
    const rights=row.rights??{};for(const key of ["displayUseAllowed","commercialUseAllowed","redistributionAllowed","modelTrainingAllowed"])if(typeof rights[key]!=="boolean")errors.push(`${prefix}:right_${key}`);
    if(row.reviewDecision==="APPROVED"){
      if(row.reviewer?.legalReview!==true)errors.push(`${prefix}:approved_without_legal_review`);
      if(Date.parse(row.effectiveAt)>now)errors.push(`${prefix}:not_yet_effective`);
      if(row.expiresAt!=null&&Date.parse(row.expiresAt)<=now)errors.push(`${prefix}:expired`);
      if(row.documentKind==="DPA"&&(rights.displayUseAllowed||rights.commercialUseAllowed||rights.redistributionAllowed))errors.push(`${prefix}:dpa_cannot_grant_product_rights`);
      if(rights.redistributionAllowed&&!rights.commercialUseAllowed)errors.push(`${prefix}:redistribution_without_commercial_use`);
    }else if(Object.values(rights).some(Boolean))errors.push(`${prefix}:non_approved_rights_must_be_false`);
    for(const failure of containsForbiddenRawFields(row,prefix,[]))errors.push(`${prefix}:forbidden_raw_field:${failure}`);
  }
  return errors;
}
export function canonicalizeEvidenceManifest(manifest){
  const evidence=[...(manifest.evidence??[])].map(row=>JSON.parse(JSON.stringify(row))).sort((a,b)=>`${a.providerId}\0${a.evidenceId}`.localeCompare(`${b.providerId}\0${b.evidenceId}`));
  return {schemaVersion:"velmere.pass22.provider-rights-evidence-manifest.v1",truthBoundary:"Only redacted, reviewed metadata and external document hashes are retained. Raw contracts and terms remain outside the source repository.",evidence};
}
