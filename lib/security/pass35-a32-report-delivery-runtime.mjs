import { createHash } from "node:crypto";

const INPUT_SCHEMA = "velmere.pass35.a32-report-delivery-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a32-report-delivery-report.v1";
const BENCHMARK_SCHEMA = "velmere.pass35.a32-report-delivery-benchmark.v1";
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const ID = /^[A-Z][A-Z0-9_]{2,96}$/u;
const CASE_REF = /^AUD-A32-[A-Z0-9-]{6,96}$/u;
const TIERS = new Set(["PRO", "ADVANCED"]);
const CLAIM_CLASSES = new Set(["FACT", "FINDING", "INFERENCE", "ASSUMPTION", "LIMITATION", "NOT_TESTED"]);
const SEVERITIES = new Set(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const FAMILY_IDS = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A14","A15","A17"];

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function digest(value) { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return new Set(values).size === values.length; }
function validDigest(value) { return DIGEST.test(String(value ?? "")); }
function validId(value) { return ID.test(String(value ?? "")); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function add(blockers, condition, code) { if (!condition) blockers.push(code); }
function ratio(n, d) { return d > 0 ? Number((n / d).toFixed(6)) : 0; }
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { lower: Number(((centre - margin) / denominator).toFixed(6)), upper: Number(((centre + margin) / denominator).toFixed(6)) };
}

export function verifyA32Policy(policy) {
  try {
    return policy?.schemaVersion === "velmere.pass35.a32-report-delivery-policy.v1"
      && policy?.passId === "PASS35_A32"
      && policy?.sourceRevisionId === "VELMERE_PASS35_A32_REPORT_DELIVERY_EVIDENCE_NON_VISUAL"
      && Array.isArray(policy.allowedInputClasses) && policy.allowedInputClasses.length === 2
      && Array.isArray(policy.requiredControlFamilies) && policy.requiredControlFamilies.length === 12 && unique(policy.requiredControlFamilies)
      && policy.thresholds.minimumProSections >= 12
      && policy.thresholds.minimumAdvancedSections >= 18
      && policy.thresholds.minimumProClaims >= 16
      && policy.thresholds.minimumAdvancedClaims >= 24
      && policy.thresholds.minimumProAnalyzerReceipts >= 8
      && policy.thresholds.minimumAdvancedAnalyzerReceipts >= 12
      && policy.thresholds.criticalSectionCoverage === 1
      && policy.thresholds.tierFieldCoverage === 1
      && policy.thresholds.maximumDownloadTokenTtlSeconds <= 900
      && policy.thresholds.maximumPrivateRetentionDays <= 30
      && policy.thresholds.minimumComprehensionChecks >= 4
      && policy.thresholds.minimumReplayRuns >= 3
      && policy.thresholds.mutationKillRate >= 0.9 && policy.thresholds.mutationKillRate <= 1
      && policy.thresholds.requireUniqueIds === true
      && policy.thresholds.requireAllClaimClasses === true
      && policy.thresholds.requireNoGuaranteeLanguage === true
      && policy.thresholds.requireOneTimeDownload === true
      && policy.thresholds.requireSupersessionRules === true
      && policy.thresholds.requireMachineSeal === true
      && policy.thresholds.requireClaimBoundary === true
      && Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 12 && unique(policy.benchmark.families)
      && Array.isArray(policy.benchmark?.mutationTypes) && policy.benchmark.mutationTypes.length === 12 && unique(policy.benchmark.mutationTypes)
      && policy.benchmark.expectedCases === 192
      && policy.benchmark.expectedFrozen === 72
      && policy.benchmark.expectedMutations === 2304
      && typeof policy.truthBoundary === "string" && policy.truthBoundary.length > 240;
  } catch { return false; }
}

export function analyzeA32ReportDelivery(input, policy) {
  if (!verifyA32Policy(policy)) throw new Error("a32_policy_invalid");
  const blockers = [];
  add(blockers, input?.schemaVersion === INPUT_SCHEMA, "a32_schema_invalid");
  add(blockers, policy.allowedInputClasses.includes(input?.inputClass), "a32_input_class_invalid");
  add(blockers, CASE_REF.test(String(input?.caseRef ?? "")), "a32_case_ref_invalid");

  const target = input?.target ?? {};
  add(blockers, integer(target.chainId) && target.chainId > 0, "a32_chain_id_invalid");
  add(blockers, /^0x[a-f0-9]{40}$/u.test(String(target.contractAddress ?? "")), "a32_contract_address_invalid");
  for (const field of ["canonicalPacketSha256","factsSha256","findingsSha256","sourceRevisionSha256","reportSchemaSha256","a31PrivilegeReceiptSha256"]) add(blockers, validDigest(target[field]), `a32_target_${field}_invalid`);

  const audience = input?.audience ?? {};
  add(blockers, TIERS.has(audience.tier), "a32_tier_invalid");
  add(blockers, validDigest(audience.accountRefSha256) && validDigest(audience.caseRefSha256) && validDigest(audience.entitlementReceiptSha256) && validDigest(audience.accessPolicySha256), "a32_audience_binding_invalid");
  add(blockers, audience.surfaceId === "audit_evm", "a32_surface_invalid");
  add(blockers, audience.serverAuthorized === true && audience.accountBound === true && audience.caseBound === true && audience.tierBound === true, "a32_entitlement_binding_incomplete");
  add(blockers, audience.paidDeliveryAllowed === false && audience.sellEnabled === false, "a32_paid_truth_invalid");

  const receipts = Array.isArray(input?.analyzerReceipts) ? input.analyzerReceipts : [];
  const receiptIds = receipts.map((row) => row.receiptId);
  const minimumReceipts = audience.tier === "ADVANCED" ? policy.thresholds.minimumAdvancedAnalyzerReceipts : policy.thresholds.minimumProAnalyzerReceipts;
  add(blockers, receipts.length >= minimumReceipts, "a32_analyzer_receipt_count_below_floor");
  add(blockers, receiptIds.every(validId) && unique(receiptIds), "a32_analyzer_receipt_ids_invalid_or_duplicate");
  for (const row of receipts) {
    add(blockers, FAMILY_IDS.includes(row.familyId), `a32_analyzer_family_invalid:${row.receiptId}`);
    add(blockers, validDigest(row.inputSha256) && validDigest(row.rawOutputSha256) && validDigest(row.normalizedOutputSha256) && validDigest(row.toolOrMethodSha256), `a32_analyzer_receipt_digest_invalid:${row.receiptId}`);
    add(blockers, row.applicable === true && row.status === "PASS_LOCAL_EVIDENCE", `a32_analyzer_receipt_status_invalid:${row.receiptId}`);
    add(blockers, row.realExecutionClaimed === false && row.independentClaimed === false, `a32_analyzer_claim_boundary_invalid:${row.receiptId}`);
  }

  const sections = Array.isArray(input?.sections) ? input.sections : [];
  const sectionIds = sections.map((row) => row.sectionId);
  const minimumSections = audience.tier === "ADVANCED" ? policy.thresholds.minimumAdvancedSections : policy.thresholds.minimumProSections;
  add(blockers, sections.length >= minimumSections, "a32_section_count_below_floor");
  add(blockers, sectionIds.every(validId) && unique(sectionIds), "a32_section_ids_invalid_or_duplicate");
  for (const row of sections) {
    add(blockers, typeof row.critical === "boolean" && typeof row.complete === "boolean", `a32_section_flags_invalid:${row.sectionId}`);
    add(blockers, Array.isArray(row.claimIds) && row.claimIds.length > 0 && unique(row.claimIds), `a32_section_claims_invalid:${row.sectionId}`);
    add(blockers, validDigest(row.sectionContentSha256), `a32_section_digest_invalid:${row.sectionId}`);
    if (row.critical) add(blockers, row.complete === true, `a32_critical_section_incomplete:${row.sectionId}`);
  }
  const criticalSections = sections.filter((row) => row.critical);
  add(blockers, ratio(criticalSections.filter((row) => row.complete).length, criticalSections.length) === policy.thresholds.criticalSectionCoverage, "a32_critical_section_coverage_incomplete");

  const claims = Array.isArray(input?.claims) ? input.claims : [];
  const claimIds = claims.map((row) => row.claimId);
  const minimumClaims = audience.tier === "ADVANCED" ? policy.thresholds.minimumAdvancedClaims : policy.thresholds.minimumProClaims;
  add(blockers, claims.length >= minimumClaims, "a32_claim_count_below_floor");
  add(blockers, claimIds.every(validId) && unique(claimIds), "a32_claim_ids_invalid_or_duplicate");
  const observedClasses = new Set();
  for (const row of claims) {
    add(blockers, CLAIM_CLASSES.has(row.claimClass), `a32_claim_class_invalid:${row.claimId}`);
    observedClasses.add(row.claimClass);
    add(blockers, SEVERITIES.has(row.severity), `a32_claim_severity_invalid:${row.claimId}`);
    add(blockers, Number.isFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1, `a32_claim_confidence_invalid:${row.claimId}`);
    add(blockers, validDigest(row.evidenceSha256) && validDigest(row.textSha256), `a32_claim_digest_invalid:${row.claimId}`);
    add(blockers, typeof row.sensitive === "boolean" && typeof row.redactedInCustomerView === "boolean", `a32_claim_redaction_flags_invalid:${row.claimId}`);
    if (row.sensitive) add(blockers, row.redactedInCustomerView === true && validDigest(row.privateLaneReferenceSha256), `a32_sensitive_claim_exposed:${row.claimId}`);
    add(blockers, !/(guaranteed safe|no vulnerabilities|certified secure|will not lose)/iu.test(String(row.customerText ?? "")), `a32_guarantee_language_detected:${row.claimId}`);
  }
  if (policy.thresholds.requireAllClaimClasses) for (const klass of CLAIM_CLASSES) add(blockers, observedClasses.has(klass), `a32_claim_class_missing:${klass}`);
  const claimSet = new Set(claimIds);
  for (const row of sections) add(blockers, row.claimIds.every((id) => claimSet.has(id)), `a32_section_claim_reference_missing:${row.sectionId}`);

  const tierScope = input?.tierScope ?? {};
  add(blockers, tierScope.tier === audience.tier, "a32_tier_scope_mismatch");
  add(blockers, Array.isArray(tierScope.allowedFieldIds) && Array.isArray(tierScope.presentFieldIds) && tierScope.presentFieldIds.every((id) => tierScope.allowedFieldIds.includes(id)), "a32_tier_field_leakage");
  add(blockers, ratio(tierScope.requiredFieldIds?.filter((id) => tierScope.presentFieldIds?.includes(id)).length ?? 0, tierScope.requiredFieldIds?.length ?? 0) === policy.thresholds.tierFieldCoverage, "a32_tier_field_coverage_incomplete");
  add(blockers, audience.tier !== "PRO" || tierScope.advancedOnlyFieldIds.every((id) => !tierScope.presentFieldIds.includes(id)), "a32_advanced_field_in_pro");

  const artifact = input?.artifact ?? {};
  add(blockers, artifact.format === "PDF_A4" && integer(artifact.pageCount) && artifact.pageCount === (audience.tier === "ADVANCED" ? 8 : 4), "a32_page_contract_invalid");
  for (const field of ["packetSha256","contentSha256","reportSha256","receiptIndexSha256","machineSealSha256"]) add(blockers, validDigest(artifact[field]), `a32_artifact_${field}_invalid`);
  add(blockers, artifact.packetSha256 === target.canonicalPacketSha256, "a32_artifact_packet_binding_mismatch");
  add(blockers, artifact.machineSealed === true && artifact.humanSigned === false, "a32_artifact_seal_truth_invalid");
  add(blockers, artifact.customerViewContainsRawSource === false && artifact.customerViewContainsRawSecrets === false, "a32_artifact_sensitive_material_exposed");

  const delivery = input?.delivery ?? {};
  add(blockers, validDigest(delivery.downloadTokenSha256) && validDigest(delivery.deliveryReceiptSha256) && validDigest(delivery.downloadedArtifactSha256), "a32_delivery_digest_invalid");
  add(blockers, integer(delivery.tokenTtlSeconds) && delivery.tokenTtlSeconds > 0 && delivery.tokenTtlSeconds <= policy.thresholds.maximumDownloadTokenTtlSeconds, "a32_download_token_ttl_invalid");
  add(blockers, delivery.oneTimeToken === true && delivery.tokenUseCount === 1 && delivery.replayRejected === true, "a32_download_token_reuse_or_replay");
  add(blockers, delivery.accountRefSha256 === audience.accountRefSha256 && delivery.caseRefSha256 === audience.caseRefSha256, "a32_delivery_account_case_mismatch");
  add(blockers, delivery.downloadedArtifactSha256 === artifact.reportSha256, "a32_downloaded_artifact_mismatch");
  add(blockers, Array.isArray(delivery.auditTrail) && delivery.auditTrail.length >= 4 && delivery.auditTrail.every((row) => validId(row.eventId) && validDigest(row.eventSha256)), "a32_delivery_audit_trail_invalid");

  const supersession = input?.supersession ?? {};
  add(blockers, typeof supersession.correctedReport === "boolean" && Array.isArray(supersession.invalidationTriggers) && supersession.invalidationTriggers.length >= 4 && unique(supersession.invalidationTriggers), "a32_supersession_rules_incomplete");
  if (supersession.correctedReport) add(blockers, validDigest(supersession.previousReportSha256) && validDigest(supersession.supersedingReportSha256) && supersession.supersedingReportSha256 === artifact.reportSha256, "a32_supersession_binding_invalid");
  add(blockers, supersession.oldDownloadRevoked === true && supersession.immutableHistoryRetained === true, "a32_supersession_revocation_history_invalid");

  const comprehension = input?.comprehension ?? {};
  add(blockers, Array.isArray(comprehension.checks) && comprehension.checks.length >= policy.thresholds.minimumComprehensionChecks && comprehension.checks.every((row) => row.passed === true && validId(row.checkId)), "a32_comprehension_checks_incomplete");
  add(blockers, comprehension.scopeAcknowledged === true && comprehension.limitationsAcknowledged === true && comprehension.notTestedAcknowledged === true && comprehension.falseSafetyWarningAcknowledged === true, "a32_comprehension_acknowledgement_incomplete");
  add(blockers, comprehension.customerOutcomeClaimed === false && comprehension.willingnessToPayProven === false, "a32_comprehension_claim_boundary_invalid");

  const privacy = input?.privacy ?? {};
  add(blockers, privacy.piiMinimized === true && privacy.secretsRedacted === true && privacy.rawSourceExcludedFromCustomerView === true, "a32_privacy_redaction_incomplete");
  add(blockers, integer(privacy.retentionDays) && privacy.retentionDays > 0 && privacy.retentionDays <= policy.thresholds.maximumPrivateRetentionDays, "a32_retention_window_invalid");
  add(blockers, validDigest(privacy.retentionPolicySha256) && validDigest(privacy.deletionPolicySha256) && validDigest(privacy.exportPolicySha256), "a32_privacy_policy_binding_invalid");
  add(blockers, privacy.deletionSupported === true && privacy.exportSupported === true && privacy.backupExpiryDeclared === true, "a32_privacy_lifecycle_incomplete");

  const replay = Array.isArray(input?.replayRuns) ? input.replayRuns : [];
  add(blockers, replay.length >= policy.thresholds.minimumReplayRuns, "a32_replay_count_below_floor");
  add(blockers, replay.every((row) => row.reportSha256 === artifact.reportSha256 && row.deliveryDecision === "LOCAL_ELIGIBLE" && validDigest(row.runSha256)), "a32_replay_not_deterministic");
  add(blockers, input?.truthBoundary?.realAnalyzerExecutionClaimed === false && input?.truthBoundary?.realCustomerComprehensionClaimed === false && input?.truthBoundary?.stagingDeliveryClaimed === false && input?.truthBoundary?.humanSignedClaimed === false && input?.truthBoundary?.paidValueClaimed === false, "a32_truth_boundary_invalid");

  const uniqueBlockers = [...new Set(blockers)].sort();
  const localEligible = uniqueBlockers.length === 0;
  const core = {
    schemaVersion: REPORT_SCHEMA,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    tier: audience.tier ?? null,
    status: localEligible ? "PASS_LOCAL_REPORT_DELIVERY_EVIDENCE_NOT_STAGING_NOT_CUSTOMER_PROVEN" : "BLOCKED_FAIL_CLOSED",
    localEligible,
    paidDeliveryAllowed: false,
    sellEnabled: false,
    chargeAllowed: false,
    realAnalyzerExecutionProven: false,
    realCustomerComprehensionProven: false,
    stagingDeliveryProven: false,
    qualifiedSignatureProven: false,
    blockers: uniqueBlockers,
    coverage: {
      analyzerReceipts: receipts.length,
      sections: sections.length,
      claims: claims.length,
      criticalSectionCoverage: ratio(criticalSections.filter((row) => row.complete).length, criticalSections.length),
      tierFieldCoverage: ratio(tierScope.requiredFieldIds?.filter((id) => tierScope.presentFieldIds?.includes(id)).length ?? 0, tierScope.requiredFieldIds?.length ?? 0),
      replayRuns: replay.length
    },
    reportSha256: validDigest(artifact.reportSha256) ? artifact.reportSha256 : null,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, integritySha256: digest(core) };
}

function goodInput(family, index) {
  const tier = index % 3 === 0 ? "ADVANCED" : "PRO";
  const sectionCount = tier === "ADVANCED" ? 18 : 12;
  const claimCount = tier === "ADVANCED" ? 24 : 18;
  const receiptCount = tier === "ADVANCED" ? 12 : 8;
  const caseKey = `${family}-${String(index).padStart(2,"0")}`;
  const canonicalPacketSha256 = digest({ caseKey, kind: "packet" });
  const reportSha256 = digest({ caseKey, kind: "report", tier });
  const claims = Array.from({ length: claimCount }, (_, i) => {
    const classes = [...CLAIM_CLASSES];
    const claimClass = classes[i % classes.length];
    const sensitive = i % 7 === 0;
    return {
      claimId: `CLAIM_${String(i + 1).padStart(2,"0")}`,
      claimClass,
      severity: claimClass === "FINDING" ? (i % 2 ? "HIGH" : "MEDIUM") : "NONE",
      confidence: claimClass === "FINDING" ? 0.82 : 0.7,
      evidenceSha256: digest({ caseKey, claim: i, evidence: true }),
      textSha256: digest({ caseKey, claim: i, text: true }),
      customerText: claimClass === "LIMITATION" ? "This result is bounded by the declared evidence." : `Bounded ${claimClass.toLowerCase()} ${i}`,
      sensitive,
      redactedInCustomerView: sensitive,
      privateLaneReferenceSha256: sensitive ? digest({ caseKey, claim: i, private: true }) : null
    };
  });
  const sections = Array.from({ length: sectionCount }, (_, i) => ({
    sectionId: `SECTION_${String(i + 1).padStart(2,"0")}`,
    critical: i < 6,
    complete: true,
    claimIds: [claims[i % claims.length].claimId, claims[(i + 6) % claims.length].claimId],
    sectionContentSha256: digest({ caseKey, section: i })
  }));
  const analyzerReceipts = Array.from({ length: receiptCount }, (_, i) => ({
    receiptId: `RECEIPT_${String(i + 1).padStart(2,"0")}`,
    familyId: FAMILY_IDS[i],
    inputSha256: digest({ caseKey, receipt: i, input: true }),
    rawOutputSha256: digest({ caseKey, receipt: i, raw: true }),
    normalizedOutputSha256: digest({ caseKey, receipt: i, normalized: true }),
    toolOrMethodSha256: digest({ caseKey, receipt: i, tool: true }),
    applicable: true,
    status: "PASS_LOCAL_EVIDENCE",
    realExecutionClaimed: false,
    independentClaimed: false
  }));
  const allowedFieldIds = Array.from({ length: tier === "ADVANCED" ? 32 : 24 }, (_, i) => `FIELD_${String(i + 1).padStart(2,"0")}`);
  const requiredFieldIds = allowedFieldIds.slice(0, tier === "ADVANCED" ? 28 : 20);
  const advancedOnlyFieldIds = Array.from({ length: 8 }, (_, i) => `ADV_FIELD_${String(i + 1).padStart(2,"0")}`);
  if (tier === "ADVANCED") allowedFieldIds.push(...advancedOnlyFieldIds);
  const presentFieldIds = [...requiredFieldIds, ...(tier === "ADVANCED" ? advancedOnlyFieldIds : [])];
  const accountRefSha256 = digest({ caseKey, account: true });
  const caseRefSha256 = digest({ caseKey, case: true });
  const input = {
    schemaVersion: INPUT_SCHEMA,
    inputClass: "GENERATED_OFFLINE",
    caseRef: `AUD-A32-${family.replaceAll("_", "-")}-${String(index).padStart(2,"0")}`,
    target: {
      chainId: 1,
      contractAddress: `0x${createHash("sha256").update(caseKey).digest("hex").slice(0,40)}`,
      canonicalPacketSha256,
      factsSha256: digest({ caseKey, facts: true }),
      findingsSha256: digest({ caseKey, findings: true }),
      sourceRevisionSha256: digest({ caseKey, revision: true }),
      reportSchemaSha256: digest({ caseKey, schema: true }),
      a31PrivilegeReceiptSha256: digest({ caseKey, a31: true })
    },
    audience: {
      tier, surfaceId: "audit_evm", accountRefSha256, caseRefSha256,
      entitlementReceiptSha256: digest({ caseKey, entitlement: true }),
      accessPolicySha256: digest({ caseKey, access: true }),
      serverAuthorized: true, accountBound: true, caseBound: true, tierBound: true,
      paidDeliveryAllowed: false, sellEnabled: false
    },
    analyzerReceipts,
    sections,
    claims,
    tierScope: { tier, allowedFieldIds, requiredFieldIds, presentFieldIds, advancedOnlyFieldIds },
    artifact: {
      format: "PDF_A4", pageCount: tier === "ADVANCED" ? 8 : 4,
      packetSha256: canonicalPacketSha256,
      contentSha256: digest({ caseKey, content: true }),
      reportSha256,
      receiptIndexSha256: digest(analyzerReceipts.map((r) => r.normalizedOutputSha256)),
      machineSealSha256: digest({ caseKey, seal: true }),
      machineSealed: true, humanSigned: false,
      customerViewContainsRawSource: false, customerViewContainsRawSecrets: false
    },
    delivery: {
      downloadTokenSha256: digest({ caseKey, token: true }),
      deliveryReceiptSha256: digest({ caseKey, delivery: true }),
      downloadedArtifactSha256: reportSha256,
      tokenTtlSeconds: 600, oneTimeToken: true, tokenUseCount: 1, replayRejected: true,
      accountRefSha256, caseRefSha256,
      auditTrail: Array.from({ length: 4 }, (_, i) => ({ eventId: `EVENT_${String(i + 1).padStart(2,"0")}`, eventSha256: digest({ caseKey, event: i }) }))
    },
    supersession: {
      correctedReport: index % 4 === 0,
      previousReportSha256: digest({ caseKey, previous: true }),
      supersedingReportSha256: reportSha256,
      invalidationTriggers: ["SOURCE_CHANGE", "BYTECODE_CHANGE", "RIGHTS_REVOKE", "MATERIAL_FINDING_CHANGE", "EVIDENCE_EXPIRY"],
      oldDownloadRevoked: true, immutableHistoryRetained: true
    },
    comprehension: {
      checks: Array.from({ length: 4 }, (_, i) => ({ checkId: `CHECK_${String(i + 1).padStart(2,"0")}`, passed: true })),
      scopeAcknowledged: true, limitationsAcknowledged: true, notTestedAcknowledged: true,
      falseSafetyWarningAcknowledged: true, customerOutcomeClaimed: false, willingnessToPayProven: false
    },
    privacy: {
      piiMinimized: true, secretsRedacted: true, rawSourceExcludedFromCustomerView: true,
      retentionDays: 30,
      retentionPolicySha256: digest({ caseKey, retention: true }),
      deletionPolicySha256: digest({ caseKey, deletion: true }),
      exportPolicySha256: digest({ caseKey, export: true }),
      deletionSupported: true, exportSupported: true, backupExpiryDeclared: true
    },
    replayRuns: Array.from({ length: 3 }, (_, i) => ({ reportSha256, deliveryDecision: "LOCAL_ELIGIBLE", runSha256: digest({ caseKey, replay: i }) })),
    truthBoundary: { realAnalyzerExecutionClaimed: false, realCustomerComprehensionClaimed: false, stagingDeliveryClaimed: false, humanSignedClaimed: false, paidValueClaimed: false }
  };
  return input;
}

function applyDefect(input, family) {
  const x = clone(input);
  switch (family) {
    case "PACKET_BINDING": x.artifact.packetSha256 = digest({ bad: "packet" }); break;
    case "RECEIPT_COVERAGE": x.analyzerReceipts.length = 2; break;
    case "CLAIM_TAXONOMY": x.claims = x.claims.filter((row) => row.claimClass !== "LIMITATION"); break;
    case "TIER_SCOPE": if (x.audience.tier === "PRO") x.tierScope.presentFieldIds.push(x.tierScope.advancedOnlyFieldIds[0]); else x.tierScope.presentFieldIds = x.tierScope.presentFieldIds.filter((id) => id !== x.tierScope.requiredFieldIds[0]); break;
    case "SENSITIVE_REDACTION": { const row=x.claims.find((c)=>c.sensitive); row.redactedInCustomerView=false; } break;
    case "ENTITLEMENT_BINDING": x.delivery.accountRefSha256 = digest({ bad: "account" }); break;
    case "REPORT_STRUCTURE": x.sections.find((row)=>row.critical).complete=false; break;
    case "ARTIFACT_INTEGRITY": x.delivery.downloadedArtifactSha256=digest({ bad:"artifact" }); break;
    case "DOWNLOAD_TOKEN": x.delivery.tokenUseCount=2; x.delivery.replayRejected=false; break;
    case "SUPERSESSION": x.supersession.invalidationTriggers=[]; break;
    case "COMPREHENSION": x.comprehension.falseSafetyWarningAcknowledged=false; break;
    case "PRIVACY_RETENTION": x.privacy.retentionDays=365; break;
    default: throw new Error(`a32_unknown_family:${family}`);
  }
  return x;
}

function applyMutation(input, mutationType) {
  const map = {
    break_packet_hash: "PACKET_BINDING", drop_analyzer_receipt: "RECEIPT_COVERAGE", remove_limitation_class: "CLAIM_TAXONOMY",
    inject_advanced_field_into_pro: "TIER_SCOPE", expose_sensitive_claim: "SENSITIVE_REDACTION", swap_account_binding: "ENTITLEMENT_BINDING",
    remove_critical_section: "REPORT_STRUCTURE", tamper_artifact_hash: "ARTIFACT_INTEGRITY", reuse_download_token: "DOWNLOAD_TOKEN",
    remove_invalidation_trigger: "SUPERSESSION", remove_false_safety_warning: "COMPREHENSION", extend_retention_without_policy: "PRIVACY_RETENTION"
  };
  return applyDefect(input, map[mutationType]);
}

function metrics(rows) {
  let tp=0,tn=0,fp=0,fn=0;
  for (const row of rows) {
    if (row.expected && row.actual) tp++;
    else if (!row.expected && !row.actual) tn++;
    else if (!row.expected && row.actual) fp++;
    else fn++;
  }
  const total=rows.length, correct=tp+tn;
  return { total, tp, tn, fp, fn, accuracy: ratio(correct,total), precision: ratio(tp,tp+fp), recall: ratio(tp,tp+fn), specificity: ratio(tn,tn+fp), unsafeEligible: fp, falseBlocks: fn, accuracyWilson95: wilson(correct,total) };
}

export function runA32Benchmark(policy) {
  if (!verifyA32Policy(policy)) throw new Error("a32_policy_invalid");
  const cases=[];
  for (const family of policy.benchmark.families) {
    for (let index=0; index<16; index++) {
      const baseInput=goodInput(family,index);
      const expected=index%2===0;
      const input=expected ? clone(baseInput) : applyDefect(baseInput,family);
      const report=analyzeA32ReportDelivery(input,policy);
      cases.push({ family,index,split:index>=10?"FROZEN":"DEVELOPMENT",expected,actual:report.localEligible,blockers:report.blockers,reportIntegritySha256:report.integritySha256,baseInput });
    }
  }
  const developmentRows=cases.filter((row)=>row.split==="DEVELOPMENT");
  const frozenRows=cases.filter((row)=>row.split==="FROZEN");
  let killed=0,totalMutations=0;
  const mutationRows=[];
  for (const row of cases) for (const mutationType of policy.benchmark.mutationTypes) {
    totalMutations++;
    const mutated=applyMutation(row.baseInput,mutationType);
    const output=analyzeA32ReportDelivery(mutated,policy);
    const isKilled=!output.localEligible;
    if (isKilled) killed++;
    mutationRows.push({ family:row.family,index:row.index,mutationType,killed:isKilled,blockers:output.blockers });
  }
  const core={
    schemaVersion:BENCHMARK_SCHEMA, passId:"PASS35_A32", sourceRevisionId:policy.sourceRevisionId,
    denominators:{cases:cases.length,frozen:frozenRows.length,mutations:totalMutations,families:policy.benchmark.families.length},
    development:metrics(developmentRows), frozen:metrics(frozenRows),
    mutation:{total:totalMutations,killed,killRate:ratio(killed,totalMutations)},
    caseResults:cases.map(({baseInput,...row})=>row), mutationResults:mutationRows,
    realAnalyzerExecutionProven:false, realCustomerComprehensionProven:false, stagingDeliveryProven:false, paidGateEligible:false, sellEnabled:false,
    truthBoundary:policy.truthBoundary
  };
  return {...core,integritySha256:digest(core)};
}

export function verifyA32Benchmark(benchmark,policy) {
  try {
    if (!verifyA32Policy(policy)) return false;
    const {integritySha256,...core}=benchmark;
    return benchmark?.schemaVersion===BENCHMARK_SCHEMA
      && benchmark?.sourceRevisionId===policy.sourceRevisionId
      && benchmark.denominators.cases===policy.benchmark.expectedCases
      && benchmark.denominators.frozen===policy.benchmark.expectedFrozen
      && benchmark.denominators.mutations===policy.benchmark.expectedMutations
      && benchmark.denominators.families===12
      && benchmark.development.accuracy===1 && benchmark.frozen.accuracy===1
      && benchmark.frozen.unsafeEligible===0 && benchmark.frozen.falseBlocks===0
      && benchmark.mutation.killRate===1
      && benchmark.realAnalyzerExecutionProven===false && benchmark.realCustomerComprehensionProven===false
      && benchmark.stagingDeliveryProven===false && benchmark.paidGateEligible===false && benchmark.sellEnabled===false
      && integritySha256===digest(core);
  } catch { return false; }
}
