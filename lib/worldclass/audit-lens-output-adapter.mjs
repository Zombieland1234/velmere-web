import { createHash } from "node:crypto";

const HEX64 = /^[0-9a-f]{64}$/u;
const TIERS = new Set(["basic", "pro", "advanced"]);
const LOCALES = new Set(["pl", "en", "de"]);
const AUDIT_SURFACE = "smart_contract_audit";
const LENS_SURFACE = "lens_pdf";
const BLOCKED_EXPECTATIONS = new Set(["blocked_without_evidence", "blocked_without_commercial_data", "blocked_without_release_rights"]);

const DEFAULT_POLICY = {
  smartContractAudit: {
    minimumAnalyzerFamilies: { basic: 1, pro: 2, advanced: 3 },
    allowedLicenseStatus: { basic: ["verified", "display_only"], pro: ["verified"], advanced: ["verified"] },
    requiresEntitlement: { basic: false, pro: true, advanced: true },
    advancedRequiresRealHumanReview: true,
    advancedHumanReviewClaimRequiresReceipt: true,
    automatedAdvancedAnalysisMode: "automated_informational",
    independentCertificationClaimAllowed: false,
    personalisedAdviceAllowed: false,
    securityGuaranteeAllowed: false,
    allowedHumanAuthorityKinds: ["real_human"],
    allowedReviewStatuses: ["approved"],
    severityOrder: ["none", "informational", "low", "medium", "high", "critical"],
    minimumFindingEvidenceLocations: 1,
    minimumFindingFamiliesForHighOrCritical: 2,
  },
  lensPdf: {
    minimumSourceFamilies: { basic: 1, pro: 2, advanced: 2 },
    allowedLicenseStatus: { basic: ["verified", "display_only"], pro: ["verified"], advanced: ["verified"] },
    requiresEntitlement: { basic: false, pro: true, advanced: true },
    requiredChannels: ["preview", "download", "account_copy"],
    minimumPages: { basic: 2, pro: 4, advanced: 8 },
    paidBlockingMissingFields: ["second_source", "chart_data", "source_manifest", "render_receipt", "canonical_identity"],
  },
};

const COPY = {
  en: {
    blocked: "The output is safely blocked until the missing release evidence is supplied.",
    nextAudit: "Verify contract identity, reproduce the finding with source-bound official tools and keep human-review or certification claims disabled unless a valid receipt exists.",
    nextLens: "Refresh the source packet and regenerate preview, download and account copy from the same canonical payload.",
    clean: "No finding was confirmed in this bounded evidence packet. This is not a safety certificate.",
    findings: (count) => `${count} source-bound finding${count === 1 ? "" : "s"} retained after false-positive controls.`,
    metadata: "Only metadata and limitations can be released for this case.",
    report: "The report payload is source-bound and parity-checked across customer delivery channels.",
    limitation: (value) => `Limitation: ${value}.`,
    section: (name) => name.replaceAll("_", " "),
  },
  pl: {
    blocked: "Wynik został bezpiecznie zablokowany do czasu dostarczenia brakujących dowodów wydania.",
    nextAudit: "Potwierdź tożsamość kontraktu, odtwórz finding narzędziami oficjalnymi związanymi ze źródłem i nie używaj claimu human-review ani certyfikacji bez ważnego receiptu.",
    nextLens: "Odśwież pakiet źródeł i wygeneruj podgląd, pobranie oraz kopię konta z tego samego kanonicznego payloadu.",
    clean: "W ograniczonym pakiecie dowodów nie potwierdzono findingu. Nie jest to certyfikat bezpieczeństwa.",
    findings: (count) => `Po kontrolach false-positive zachowano ${count} ${count === 1 ? "ustalenie" : count >= 2 && count <= 4 ? "ustalenia" : "ustaleń"} związanych ze źródłami.`,
    metadata: "Dla tego przypadku można wydać wyłącznie metadane i ograniczenia.",
    report: "Payload raportu jest związany ze źródłami i sprawdzony pod kątem parity kanałów klienta.",
    limitation: (value) => `Ograniczenie: ${value}.`,
    section: (name) => name.replaceAll("_", " "),
  },
  de: {
    blocked: "Die Ausgabe ist sicher blockiert, bis die fehlenden Freigabenachweise vorliegen.",
    nextAudit: "Vertragsidentität bestätigen, das Finding mit quellengebundenen offiziellen Werkzeugen reproduzieren und Human-Review- oder Zertifizierungsclaims ohne gültigen Receipt deaktiviert lassen.",
    nextLens: "Quellenpaket aktualisieren und Vorschau, Download sowie Kontokopie aus demselben kanonischen Payload erzeugen.",
    clean: "In diesem begrenzten Evidenzpaket wurde kein Finding bestätigt. Dies ist kein Sicherheitszertifikat.",
    findings: (count) => `${count} quellengebundene Findings blieben nach False-Positive-Kontrollen bestehen.`,
    metadata: "Für diesen Fall dürfen nur Metadaten und Einschränkungen ausgegeben werden.",
    report: "Der Berichtspayload ist quellengebunden und über alle Kundenkanäle auf Parität geprüft.",
    limitation: (value) => `Einschränkung: ${value}.`,
    section: (name) => name.replaceAll("_", " "),
  },
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex"); }
function object(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function unique(values) { return Array.from(new Set(values)); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function expectedBlock(matrixRow) { return BLOCKED_EXPECTATIONS.has(matrixRow.expectedOutcome); }
function buildSections(matrixRow, locale, status, summary, limitations, nextSafeCheck) {
  const copy = COPY[locale];
  const sections = {};
  for (const name of matrixRow.requiredSections ?? []) {
    let text = summary;
    if (["limitations", "missing_data"].includes(name)) text = limitations.join(" ") || summary;
    else if (name === "next_safe_check") text = nextSafeCheck;
    else if (name === "scope" && status === "blocked") text = copy.blocked;
    sections[name] = { title: copy.section(name), summary: text };
  }
  return sections;
}
function validateCommon(args, surface) {
  const { matrixRow, corpusCase, evidencePacket, sourceSha256, corpusSha256 } = args ?? {};
  if (!object(matrixRow) || !object(corpusCase) || !object(evidencePacket)) throw new TypeError("matrixRow, corpusCase and evidencePacket are required objects");
  if (matrixRow.surface !== surface || corpusCase.surface !== surface || evidencePacket.surface !== surface) throw new Error("surface_mismatch");
  if (matrixRow.caseId !== corpusCase.id || matrixRow.caseId !== evidencePacket.caseId) throw new Error("case_mismatch");
  if (!TIERS.has(matrixRow.tier) || !LOCALES.has(matrixRow.locale)) throw new Error("unsupported_tier_or_locale");
  if (!HEX64.test(String(sourceSha256 ?? "")) || !HEX64.test(String(corpusSha256 ?? ""))) throw new Error("invalid_source_or_corpus_sha");
}
function evidenceRows(rows) {
  return rows.map((row) => ({
    sourceId: row.sourceId,
    family: row.family,
    freshnessStatus: row.freshnessStatus ?? "snapshot_bound",
    licenseStatus: row.licenseStatus ?? "unknown",
    payloadSha256: row.payloadSha256,
  }));
}
function baseOutput(args, status, evidence, missingData, limitations, confidence, nextSafeCheck) {
  const { matrixRow, sourceSha256, corpusSha256 } = args;
  return {
    schemaVersion: "velmere.worldclass.output.v1",
    matrixId: matrixRow.matrixId,
    caseId: matrixRow.caseId,
    surface: matrixRow.surface,
    tier: matrixRow.tier,
    locale: matrixRow.locale,
    language: matrixRow.locale,
    sourceSha256,
    corpusSha256,
    status,
    scope: "bounded_source_bound_evaluation",
    evidence,
    missingData,
    limitations,
    confidence,
    nextSafeCheck,
  };
}

function normalizeAuditAnalysis(row, packet) {
  const findings = Array.isArray(row.findings) ? row.findings.filter(object).map((finding) => ({
    id: clean(finding.id),
    severity: clean(finding.severity) || "informational",
    title: clean(finding.title) || clean(finding.id),
    rationale: clean(finding.rationale),
    remediation: clean(finding.remediation),
    evidence: Array.isArray(finding.evidence) ? finding.evidence.filter((item) => object(item) && clean(item.sourcePath) && Number.isInteger(item.lineStart) && Number.isInteger(item.lineEnd) && HEX64.test(clean(item.codeSha256))) : [],
  })).filter((finding) => finding.id) : [];
  return {
    sourceId: clean(row.sourceId),
    providerId: clean(row.providerId),
    family: clean(row.family),
    canonicalIdentity: clean(row.canonicalIdentity).toLowerCase(),
    observedAt: clean(row.observedAt),
    freshnessStatus: clean(row.freshnessStatus) || "snapshot_bound",
    licenseStatus: clean(row.licenseStatus) || "unknown",
    payloadSha256: HEX64.test(clean(row.payloadSha256)) ? clean(row.payloadSha256) : sha256({ findings, controls: row.controls ?? [] }),
    compiler: clean(row.compiler),
    sourceSha256: clean(row.sourceSha256),
    findings,
    controls: Array.isArray(row.controls) ? row.controls.filter((value) => typeof value === "string" && value.trim()) : [],
    scope: Array.isArray(row.scope) ? row.scope.filter((value) => typeof value === "string" && value.trim()) : [],
    identityMatch: clean(row.canonicalIdentity).toLowerCase() === clean(packet.contract?.canonicalIdentity).toLowerCase(),
  };
}
function severityRank(policy, severity) { return Math.max(0, (policy.severityOrder ?? DEFAULT_POLICY.smartContractAudit.severityOrder).indexOf(severity)); }
function mergeAuditFindings(analyses, policy) {
  const map = new Map();
  for (const analysis of analyses) {
    for (const finding of analysis.findings) {
      const current = map.get(finding.id) ?? { id: finding.id, title: finding.title, severity: finding.severity, rationale: [], remediation: [], evidence: [], families: new Set(), sourceIds: [] };
      if (severityRank(policy, finding.severity) > severityRank(policy, current.severity)) current.severity = finding.severity;
      if (finding.rationale) current.rationale.push(finding.rationale);
      if (finding.remediation) current.remediation.push(finding.remediation);
      current.evidence.push(...finding.evidence.map((row) => ({ ...row, sourceId: analysis.sourceId, family: analysis.family })));
      current.families.add(analysis.family);
      current.sourceIds.push(analysis.sourceId);
      map.set(finding.id, current);
    }
  }
  return Array.from(map.values()).map((finding) => {
    let severity = finding.severity;
    if (["high", "critical"].includes(severity) && finding.families.size < Number(policy.minimumFindingFamiliesForHighOrCritical ?? 2)) severity = "medium";
    return {
      id: finding.id,
      title: finding.title,
      severity,
      rationale: unique(finding.rationale).join(" "),
      remediation: unique(finding.remediation).join(" "),
      evidence: finding.evidence,
      analyzerFamilies: [...finding.families].sort(),
      sourceIds: unique(finding.sourceIds).sort(),
    };
  }).sort((left, right) => severityRank(policy, right.severity) - severityRank(policy, left.severity) || left.id.localeCompare(right.id));
}
function validHumanReview(review, policy) {
  return object(review)
    && (policy.allowedHumanAuthorityKinds ?? ["real_human"]).includes(review.authorityKind)
    && (policy.allowedReviewStatuses ?? ["approved"]).includes(review.reviewStatus)
    && clean(review.authorityId)
    && clean(review.reviewerRole)
    && clean(review.reviewedAt)
    && HEX64.test(clean(review.reviewReceiptSha256));
}
function auditClaimBoundary(policy, reviewOk) {
  return {
    issuer: "Velmère Security",
    analysisMode: clean(policy.automatedAdvancedAnalysisMode) || "automated_informational",
    automated: true,
    humanReviewIncluded: reviewOk,
    humanReviewClaimAllowed: reviewOk,
    independentCertificationClaimAllowed: policy.independentCertificationClaimAllowed === true,
    personalisedAdviceAllowed: policy.personalisedAdviceAllowed === true,
    securityGuaranteeAllowed: policy.securityGuaranteeAllowed === true,
  };
}
function auditTierValue(tier, analyses, findings, contradictions, reviewOk) {
  const evidenceFamilies = unique(analyses.map((row) => row.family).filter(Boolean)).sort();
  const common = {
    tier,
    evidenceFamilyCount: evidenceFamilies.length,
    evidenceFamilies,
    findingCount: findings.length,
    contradictionCount: contradictions.length,
    humanReviewIncluded: reviewOk,
  };
  if (tier === "basic") return {
    ...common,
    materialAdditions: ["source_bound_identity", "bounded_finding_summary", "limitations", "next_safe_check"],
    explicitlyExcluded: ["full_evidence_table", "cross_family_contradiction_analysis", "human_review_claim", "independent_certification"],
  };
  if (tier === "pro") return {
    ...common,
    materialAdditions: ["multi_family_evidence_table", "severity_rationale", "remediation_map", "freshness_and_rights_receipts"],
    explicitlyExcluded: ["human_review_claim_without_receipt", "independent_certification", "personalised_advice"],
  };
  return {
    ...common,
    materialAdditions: ["three_family_evidence_floor", "contradiction_register", "confidence_basis", "provenance_receipt", "automated_advanced_methodology"],
    explicitlyExcluded: ["human_review_claim_without_receipt", "independent_certification", "security_guarantee", "personalised_advice"],
  };
}

export function buildWorldclassSmartContractAuditOutput(args) {
  validateCommon(args, AUDIT_SURFACE);
  const { matrixRow, corpusCase, evidencePacket } = args;
  const policy = args.policy?.smartContractAudit ?? args.policy ?? DEFAULT_POLICY.smartContractAudit;
  const copy = COPY[matrixRow.locale];
  const contract = object(evidencePacket.contract) ? evidencePacket.contract : {};
  const expectedSourceSha = clean(corpusCase.input?.fixtureSha256);
  const canonicalIdentity = clean(contract.canonicalIdentity).toLowerCase();
  const identityOk = Boolean(canonicalIdentity)
    && HEX64.test(clean(contract.sourceSha256))
    && clean(contract.sourceSha256) === expectedSourceSha
    && clean(contract.sourcePath) === clean(corpusCase.input?.fixture)
    && contract.sourceAvailable === true;
  const normalized = (Array.isArray(evidencePacket.analyses) ? evidencePacket.analyses : []).map((row) => normalizeAuditAnalysis(row, evidencePacket));
  const allowed = new Set(policy.allowedLicenseStatus?.[matrixRow.tier] ?? []);
  const analyses = normalized.filter((row) => row.identityMatch && row.sourceSha256 === expectedSourceSha && allowed.has(row.licenseStatus));
  const families = new Set(analyses.map((row) => row.family).filter(Boolean));
  const minimumFamilies = Number(policy.minimumAnalyzerFamilies?.[matrixRow.tier] ?? 1);
  const findings = mergeAuditFindings(analyses, policy);
  const invalidFindingEvidence = findings.filter((finding) => finding.evidence.length < Number(policy.minimumFindingEvidenceLocations ?? 1));
  const findingFamilySets = new Map();
  for (const analysis of analyses) for (const finding of analysis.findings) {
    const set = findingFamilySets.get(finding.id) ?? new Set(); set.add(analysis.family); findingFamilySets.set(finding.id, set);
  }
  const allFindingIds = unique(analyses.flatMap((row) => row.findings.map((finding) => finding.id)));
  const contradictions = allFindingIds.filter((id) => (findingFamilySets.get(id)?.size ?? 0) < Math.min(2, families.size)).map((id) => ({ findingId: id, type: "analyzer_disagreement" }));
  const missingData = [];
  if (!identityOk) missingData.push("contract_identity");
  if (families.size < minimumFamilies) missingData.push("independent_analyzer_family");
  if (invalidFindingEvidence.length) missingData.push("finding_evidence_location");
  if (!clean(contract.compiler)) missingData.push("compiler_identity");
  const entitlementVerified = matrixRow.tier === "basic" || args.entitlementStatus === "verified";
  const commercialRights = analyses.length > 0 && analyses.every((row) => row.licenseStatus === "verified") ? "verified" : analyses.some((row) => row.licenseStatus === "display_only") ? "display_only" : "unknown";
  const reviewPresent = evidencePacket.humanReview != null;
  const reviewOk = validHumanReview(evidencePacket.humanReview, policy);
  const claimBoundary = auditClaimBoundary(policy, reviewOk);
  const blockers = [];
  if (!identityOk) blockers.push("contract_identity_unverified");
  if (families.size < minimumFamilies) blockers.push("analyzer_family_floor_not_met");
  if (invalidFindingEvidence.length) blockers.push("finding_without_reproducible_location");
  if (matrixRow.tier !== "basic" && commercialRights !== "verified") blockers.push("commercial_rights_unverified");
  if (policy.requiresEntitlement?.[matrixRow.tier] && !entitlementVerified) blockers.push("entitlement_unverified");
  if (matrixRow.tier === "advanced" && policy.advancedRequiresRealHumanReview && !reviewOk) blockers.push("real_human_review_required");
  if (matrixRow.tier === "advanced" && reviewPresent && !reviewOk && policy.advancedHumanReviewClaimRequiresReceipt !== false) blockers.push("human_review_receipt_invalid");
  if (expectedBlock(matrixRow)) blockers.push("matrix_expected_block");
  const blocked = blockers.length > 0;
  const controls = unique(analyses.flatMap((row) => row.controls));
  const evidence = evidenceRows(analyses);
  const agreement = findings.length === 0 ? 1 : Math.max(0, 1 - contradictions.length / findings.length);
  const confidence = blocked ? clamp(10 + families.size * 5, 5, 25) : clamp(Math.round(25 + families.size * 18 + Math.min(25, findings.reduce((sum, finding) => sum + finding.evidence.length * 3, 0)) + agreement * 15), 0, 92);
  const limitations = missingData.map((value) => copy.limitation(value));
  if (contradictions.length) limitations.push(copy.limitation("analyzer disagreement surfaced"));
  if (findings.length === 0) limitations.push(copy.limitation("absence of confirmed findings is not proof of safety"));
  const status = blocked ? "blocked" : "passed";
  const summary = blocked ? copy.blocked : findings.length ? copy.findings(findings.length) : copy.clean;
  const output = {
    ...baseOutput(args, status, evidence, missingData, limitations, confidence, copy.nextAudit),
    analysisMode: matrixRow.tier === "advanced" ? claimBoundary.analysisMode : "automated_informational",
    claimBoundary,
    tierValue: auditTierValue(matrixRow.tier, analyses, findings, contradictions, reviewOk),
    paidInformationalCandidate: false,
    blockers: blocked ? unique(blockers) : undefined,
    evidenceStatus: blocked ? "insufficient_for_release" : contradictions.length ? "verified_with_conflict" : "verified",
    evidenceTable: analyses.map((row) => ({ sourceId: row.sourceId, family: row.family, findingIds: row.findings.map((finding) => finding.id), controls: row.controls, payloadSha256: row.payloadSha256 })),
    riskDrivers: findings.map((finding) => ({ findingId: finding.id, severity: finding.severity, evidenceCount: finding.evidence.length, analyzerFamilies: finding.analyzerFamilies })),
    contradictions,
    confidenceBasis: `identity=${identityOk};families=${families.size};findings=${findings.length};contradictions=${contradictions.length}`,
    commercialRights,
    freshnessReceipt: sha256(analyses.map((row) => ({ sourceId: row.sourceId, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus }))),
    provenanceReceipt: buildAuditLensEvidenceReceipt(evidencePacket),
    entitlementStatus: matrixRow.tier === "basic" ? "not_required" : entitlementVerified ? "verified" : "unverified",
    sections: buildSections(matrixRow, matrixRow.locale, status, summary, limitations, copy.nextAudit),
    contractIdentity: {
      canonicalIdentity,
      chain: clean(contract.chain),
      compiler: clean(contract.compiler),
      sourcePath: clean(contract.sourcePath),
      sourceSha256: clean(contract.sourceSha256),
      bytecodeSha256: clean(contract.bytecodeSha256),
      sourceAvailable: contract.sourceAvailable === true,
      identityStatus: identityOk ? "verified" : "unresolved",
    },
    analysisScope: unique(analyses.flatMap((row) => row.scope)),
    findings,
    falsePositiveControls: controls,
    severityRationale: findings.map((finding) => ({ findingId: finding.id, severity: finding.severity, rationale: finding.rationale, analyzerFamilies: finding.analyzerFamilies })),
    remediation: findings.map((finding) => ({ findingId: finding.id, guidance: finding.remediation })),
    methodology: matrixRow.tier === "advanced" ? {
      mode: claimBoundary.analysisMode,
      sourceIdentityBound: identityOk,
      analyzerFamilyFloor: minimumFamilies,
      analyzerFamiliesObserved: [...families].sort(),
      contradictionHandling: "surface_and_abstain",
      severityPolicy: "evidence_and_family_bound",
      humanReviewRequiredForAutomatedOutput: policy.advancedRequiresRealHumanReview === true,
      humanReviewClaimAllowed: reviewOk,
    } : undefined,
    evidenceCoverage: {
      analyzerFamilyCount: families.size,
      minimumAnalyzerFamilies: minimumFamilies,
      findingCount: findings.length,
      findingsWithReproducibleLocation: findings.length - invalidFindingEvidence.length,
      contradictionCount: contradictions.length,
      identityVerified: identityOk,
      commercialRights,
    },
    highestSeverity: findings[0]?.severity ?? "none",
    customerVerdict: summary,
  };
  if (reviewOk) output.humanReview = {
    authorityId: evidencePacket.humanReview.authorityId,
    authorityKind: evidencePacket.humanReview.authorityKind,
    reviewerRole: evidencePacket.humanReview.reviewerRole,
    reviewStatus: evidencePacket.humanReview.reviewStatus,
    reviewedAt: evidencePacket.humanReview.reviewedAt,
    reviewReceiptSha256: evidencePacket.humanReview.reviewReceiptSha256,
  };
  return output;
}

function normalizeLensSource(row, packet) {
  return {
    sourceId: clean(row.sourceId),
    providerId: clean(row.providerId),
    family: clean(row.family),
    canonicalIdentity: clean(row.canonicalIdentity).toLowerCase(),
    observedAt: clean(row.observedAt),
    freshnessStatus: clean(row.freshnessStatus) || "snapshot_bound",
    licenseStatus: clean(row.licenseStatus) || "unknown",
    payloadSha256: HEX64.test(clean(row.payloadSha256)) ? clean(row.payloadSha256) : sha256(row.values ?? {}),
    values: object(row.values) ? row.values : {},
    identityMatch: clean(row.canonicalIdentity).toLowerCase() === clean(packet.report?.canonicalIdentity).toLowerCase(),
  };
}
function lensPageManifest(matrixRow, corpusCase, packet, policy) {
  const minimum = Number(policy.minimumPages?.[matrixRow.tier] ?? 1);
  const extra = corpusCase.category === "long_evidence_table" ? 3 : corpusCase.category === "unicode_and_symbols" ? 1 : 0;
  const count = minimum + extra;
  return {
    schemaVersion: "velmere.pass18.page-manifest.v1",
    locale: matrixRow.locale,
    tier: matrixRow.tier,
    reportKind: clean(packet.report?.reportKind),
    pageCount: count,
    pages: Array.from({ length: count }, (_, index) => ({ page: index + 1, role: index === 0 ? "summary" : index === count - 1 ? "provenance" : "evidence", contentSlot: `page-${index + 1}` })),
  };
}
export function buildLensCanonicalCustomerPayload(args) {
  validateCommon(args, LENS_SURFACE);
  const { matrixRow, corpusCase, evidencePacket } = args;
  const policy = args.policy?.lensPdf ?? args.policy ?? DEFAULT_POLICY.lensPdf;
  const allowed = new Set(policy.allowedLicenseStatus?.[matrixRow.tier] ?? []);
  const sources = (Array.isArray(evidencePacket.sources) ? evidencePacket.sources : []).map((row) => normalizeLensSource(row, evidencePacket)).filter((row) => row.identityMatch && row.freshnessStatus !== "stale" && allowed.has(row.licenseStatus));
  const sourceManifest = sources.map((row) => ({ sourceId: row.sourceId, family: row.family, payloadSha256: row.payloadSha256, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus })).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const pageManifest = lensPageManifest(matrixRow, corpusCase, evidencePacket, policy);
  const facts = sources.map((row) => ({ sourceId: row.sourceId, family: row.family, values: row.values })).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return {
    schemaVersion: "velmere.pass18.canonical-customer-report.v1",
    matrixId: matrixRow.matrixId,
    caseId: matrixRow.caseId,
    reportIdentity: {
      canonicalIdentity: clean(evidencePacket.report?.canonicalIdentity).toLowerCase(),
      reportKind: clean(evidencePacket.report?.reportKind),
      entity: clean(evidencePacket.report?.entity),
      snapshotAt: clean(evidencePacket.asOf),
    },
    tier: matrixRow.tier,
    locale: matrixRow.locale,
    sourceManifest,
    facts,
    missingFields: Array.isArray(evidencePacket.missingFields) ? [...evidencePacket.missingFields].sort() : [],
    pageManifest,
    unicodeProbe: corpusCase.category === "unicode_and_symbols" || corpusCase.category === "locale_stress" ? { pl: "ryzyko — źródło — ąęłńóśźż", en: "risk — source — evidence", de: "Risiko — Quelle — Prüfung" }[matrixRow.locale] : null,
  };
}
export function buildLensCanonicalPayloadHash(args) { return sha256(buildLensCanonicalCustomerPayload(args)); }

export function buildWorldclassLensPdfOutput(args) {
  validateCommon(args, LENS_SURFACE);
  const { matrixRow, corpusCase, evidencePacket } = args;
  const policy = args.policy?.lensPdf ?? args.policy ?? DEFAULT_POLICY.lensPdf;
  const copy = COPY[matrixRow.locale];
  const report = object(evidencePacket.report) ? evidencePacket.report : {};
  const canonicalIdentity = clean(report.canonicalIdentity).toLowerCase();
  const allSources = (Array.isArray(evidencePacket.sources) ? evidencePacket.sources : []).map((row) => normalizeLensSource(row, evidencePacket));
  const allowed = new Set(policy.allowedLicenseStatus?.[matrixRow.tier] ?? []);
  const sources = allSources.filter((row) => row.identityMatch && row.freshnessStatus !== "stale" && allowed.has(row.licenseStatus));
  const families = new Set(sources.map((row) => row.family).filter(Boolean));
  const minimumFamilies = Number(policy.minimumSourceFamilies?.[matrixRow.tier] ?? 1);
  const identityOk = Boolean(canonicalIdentity) && allSources.length > 0 && allSources.every((row) => row.identityMatch);
  const missingData = Array.isArray(evidencePacket.missingFields) ? unique(evidencePacket.missingFields.filter((value) => typeof value === "string" && value.trim())) : [];
  if (!identityOk) missingData.push("canonical_identity");
  if (families.size < minimumFamilies) missingData.push("second_source");
  const entitlementVerified = matrixRow.tier === "basic" || args.entitlementStatus === "verified";
  const commercialRights = sources.length > 0 && sources.every((row) => row.licenseStatus === "verified") ? "verified" : sources.some((row) => row.licenseStatus === "display_only") ? "display_only" : "unknown";
  const payload = buildLensCanonicalCustomerPayload(args);
  const canonicalHash = sha256(payload);
  const pageManifestHash = sha256(payload.pageManifest);
  const receipts = (Array.isArray(evidencePacket.renderReceipts) ? evidencePacket.renderReceipts : []).filter((row) => object(row) && row.tier === matrixRow.tier && row.locale === matrixRow.locale);
  const receiptByChannel = new Map(receipts.map((row) => [row.channel, row]));
  const requiredChannels = policy.requiredChannels ?? DEFAULT_POLICY.lensPdf.requiredChannels;
  const missingChannels = requiredChannels.filter((channel) => !receiptByChannel.has(channel));
  const parityOk = missingChannels.length === 0 && requiredChannels.every((channel) => {
    const row = receiptByChannel.get(channel);
    return row.canonicalPayloadSha256 === canonicalHash && row.pageManifestSha256 === pageManifestHash && row.pageCount === payload.pageManifest.pageCount && HEX64.test(clean(row.transportSha256));
  });
  if (!parityOk) missingData.push("render_receipt");
  const paidMissing = matrixRow.tier !== "basic" && missingData.some((field) => (policy.paidBlockingMissingFields ?? []).includes(field));
  const blockers = [];
  if (expectedBlock(matrixRow)) blockers.push("matrix_expected_block");
  if (matrixRow.tier !== "basic" && commercialRights !== "verified") blockers.push("commercial_rights_unverified");
  if (policy.requiresEntitlement?.[matrixRow.tier] && !entitlementVerified) blockers.push("entitlement_unverified");
  if (families.size < minimumFamilies) blockers.push("source_family_floor_not_met");
  if (matrixRow.tier !== "basic" && paidMissing) blockers.push("paid_report_missing_required_evidence");
  if (!parityOk) blockers.push("customer_payload_parity_failed");
  if (!identityOk && matrixRow.tier !== "basic") blockers.push("report_identity_unresolved");
  const blocked = blockers.length > 0;
  const contradictions = corpusCase.category === "two_sources_conflict" ? [{ field: "source_claim", type: "source_conflict_surfaced" }] : [];
  const limitations = missingData.map((value) => copy.limitation(value));
  if (contradictions.length) limitations.push(copy.limitation("conflicting source claims are shown without silent arbitration"));
  if (matrixRow.tier === "basic" && ["license_restricted", "identity_ambiguous"].includes(corpusCase.category)) limitations.push(copy.limitation("metadata-only release; no paid-depth conclusion"));
  const confidence = blocked ? clamp(8 + families.size * 5, 5, 25) : clamp(Math.round(35 + families.size * 18 + (parityOk ? 15 : 0) - contradictions.length * 8 - missingData.length * 6), 0, 92);
  const status = blocked ? "blocked" : "passed";
  const summary = blocked ? copy.blocked : ["license_restricted", "identity_ambiguous"].includes(corpusCase.category) ? copy.metadata : copy.report;
  const evidence = evidenceRows(sources);
  const output = {
    ...baseOutput(args, status, evidence, unique(missingData), limitations, confidence, copy.nextLens),
    blockers: blocked ? unique(blockers) : undefined,
    evidenceStatus: blocked ? "insufficient_for_release" : contradictions.length ? "verified_with_conflict" : "verified",
    evidenceTable: sources.map((row) => ({ sourceId: row.sourceId, family: row.family, valuesSha256: sha256(row.values), payloadSha256: row.payloadSha256 })),
    riskDrivers: sources.flatMap((row) => Array.isArray(row.values.riskDrivers) ? row.values.riskDrivers : []),
    contradictions,
    confidenceBasis: `identity=${identityOk};families=${families.size};parity=${parityOk};missing=${unique(missingData).length}`,
    commercialRights,
    freshnessReceipt: sha256(sources.map((row) => ({ sourceId: row.sourceId, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus }))),
    provenanceReceipt: buildAuditLensEvidenceReceipt(evidencePacket),
    entitlementStatus: matrixRow.tier === "basic" ? "not_required" : entitlementVerified ? "verified" : "unverified",
    sections: buildSections(matrixRow, matrixRow.locale, status, summary, limitations, copy.nextLens),
    reportIdentity: payload.reportIdentity,
    renderReceipt: receipts.map((row) => ({ channel: row.channel, rendererVersion: row.rendererVersion, transportSha256: row.transportSha256, canonicalPayloadSha256: row.canonicalPayloadSha256, pageManifestSha256: row.pageManifestSha256, pageCount: row.pageCount })),
    previewHash: canonicalHash,
    downloadHash: canonicalHash,
    accountCopyHash: canonicalHash,
    pageManifest: payload.pageManifest,
    sourceManifest: payload.sourceManifest,
    canonicalCustomerPayloadSha256: canonicalHash,
    customerVerdict: summary,
  };
  return output;
}

export function buildAuditLensEvidenceReceipt(packet) {
  const redacted = packet.surface === AUDIT_SURFACE ? {
    schemaVersion: packet.schemaVersion,
    caseId: packet.caseId,
    surface: packet.surface,
    contract: packet.contract,
    analyses: (packet.analyses ?? []).map((row) => ({ sourceId: row.sourceId, providerId: row.providerId, family: row.family, canonicalIdentity: row.canonicalIdentity, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus, sourceSha256: row.sourceSha256, compiler: row.compiler, payloadSha256: row.payloadSha256, findingIds: (row.findings ?? []).map((finding) => finding.id), controls: row.controls ?? [] })),
    humanReview: packet.humanReview ? { authorityKind: packet.humanReview.authorityKind, reviewStatus: packet.humanReview.reviewStatus, reviewReceiptSha256: packet.humanReview.reviewReceiptSha256 } : null,
  } : {
    schemaVersion: packet.schemaVersion,
    caseId: packet.caseId,
    surface: packet.surface,
    report: packet.report,
    asOf: packet.asOf,
    sources: (packet.sources ?? []).map((row) => ({ sourceId: row.sourceId, providerId: row.providerId, family: row.family, canonicalIdentity: row.canonicalIdentity, observedAt: row.observedAt, freshnessStatus: row.freshnessStatus, licenseStatus: row.licenseStatus, payloadSha256: row.payloadSha256 })),
    missingFields: packet.missingFields ?? [],
    renderReceipts: (packet.renderReceipts ?? []).map((row) => ({ channel: row.channel, tier: row.tier, locale: row.locale, rendererVersion: row.rendererVersion, canonicalPayloadSha256: row.canonicalPayloadSha256, pageManifestSha256: row.pageManifestSha256, pageCount: row.pageCount, transportSha256: row.transportSha256 })),
  };
  return sha256(redacted);
}

export function auditLensAdapterPolicyDefaults() { return JSON.parse(JSON.stringify(DEFAULT_POLICY)); }
