import { createHash } from "node:crypto";

export const A22_POLICY_SCHEMA = "velmere.pass35.a22-severity-triage-policy.v1";
export const A22_INPUT_SCHEMA = "velmere.pass35.a22-severity-triage-input.v1";
export const A22_REPORT_SCHEMA = "velmere.pass35.a22-severity-triage-report.v1";
export const A22_BENCHMARK_SCHEMA = "velmere.pass35.a22-severity-triage-benchmark.v1";

const CASE_RE = /^AUD-[A-Z0-9-]{8,64}$/u;
const FINDING_RE = /^F-[A-Z0-9-]{4,64}$/u;
const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/iu;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/iu;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const PATH_STATES = new Set(["REACHABLE", "UNKNOWN", "UNREACHABLE"]);
const IMPACTS = new Set(["NONE", "PRIVACY", "AVAILABILITY", "INTEGRITY", "ARBITRARY_CODE", "GOVERNANCE", "FUNDS"]);
const ASSET_SCALES = new Set(["UNKNOWN", "LOW", "MEDIUM", "HIGH", "SYSTEMIC"]);
const BLAST = new Set(["SINGLE_USER", "MULTI_USER", "PROTOCOL_WIDE", "CROSS_PROTOCOL"]);
const EXPOSURE = new Set(["INTERNAL", "PRIVILEGED", "AUTHENTICATED", "PUBLIC"]);
const EXPLOITABILITY = new Set(["THEORETICAL", "HIGH_COMPLEXITY", "MODERATE", "LOW_COMPLEXITY"]);
const PERSISTENCE = new Set(["TRANSIENT", "PERSISTENT", "IRREVERSIBLE"]);
const INPUT_CLASSES = new Set(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"]);

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function digest(value) { return `sha256:${createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex")}`; }
function round(value, digits = 6) { return Number(value.toFixed(digits)); }
function ratio(num, den) { return den ? num / den : 0; }
function unique(values) { return [...new Set((values ?? []).map((value) => String(value)))].sort(); }
function severityRank(policy, severity) { return policy.severityOrder.indexOf(severity); }
function severityFromScore(policy, score) {
  if (score >= policy.scoreThresholds.CRITICAL) return "CRITICAL";
  if (score >= policy.scoreThresholds.HIGH) return "HIGH";
  if (score >= policy.scoreThresholds.MEDIUM) return "MEDIUM";
  if (score >= policy.scoreThresholds.LOW) return "LOW";
  return "INFORMATIONAL";
}
function capSeverity(policy, severity, maximum) {
  return severityRank(policy, severity) > severityRank(policy, maximum) ? maximum : severity;
}
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total; const z2 = z * z; const den = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / den;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / den;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)) };
}

export function verifyA22Policy(policy) {
  if (!policy || policy.schemaVersion !== A22_POLICY_SCHEMA || policy.passId !== "PASS35_A22") return false;
  if (!Array.isArray(policy.severityOrder) || policy.severityOrder.join("|") !== "SUPPRESSED|INFORMATIONAL|LOW|MEDIUM|HIGH|CRITICAL") return false;
  if (!Array.isArray(policy.raterProfiles) || policy.raterProfiles.length !== 2) return false;
  if (!policy.raterProfiles.every((profile) => Object.values(profile.weights ?? {}).reduce((sum, value) => sum + Number(value), 0) === 100)) return false;
  if (!Array.isArray(policy.benchmark?.families) || policy.benchmark.families.length !== 12) return false;
  if (policy.benchmark.expectedCases !== 192 || policy.benchmark.expectedMutations !== 2304 || policy.benchmark.mutationTypes?.length !== 12) return false;
  if (Object.values(policy.hardStops ?? {}).some((value) => value !== false)) return false;
  return true;
}

function validateInput(input) {
  const errors = []; const add = (condition, code) => { if (!condition) errors.push(code); };
  add(input?.schemaVersion === A22_INPUT_SCHEMA, "a22_schema_invalid");
  add(INPUT_CLASSES.has(input?.inputClass), "a22_input_class_invalid");
  add(CASE_RE.test(String(input?.caseRef ?? "")), "a22_case_ref_invalid");
  add(ISO_RE.test(String(input?.observedAt ?? "")), "a22_observed_at_invalid");
  add(/^\d+$/u.test(String(input?.subjectBinding?.chainId ?? "")), "a22_chain_id_invalid");
  add(ADDRESS_RE.test(String(input?.subjectBinding?.contractAddress ?? "")), "a22_address_invalid");
  add(typeof input?.subjectBinding?.exact === "boolean", "a22_exact_binding_invalid");
  if (input?.subjectBinding?.sourceBundleSha256 != null) add(DIGEST_RE.test(String(input.subjectBinding.sourceBundleSha256)), "a22_source_digest_invalid");
  if (input?.subjectBinding?.runtimeBytecodeSha256 != null) add(DIGEST_RE.test(String(input.subjectBinding.runtimeBytecodeSha256)), "a22_bytecode_digest_invalid");
  add(Array.isArray(input?.findings) && input.findings.length >= 1 && input.findings.length <= 12, "a22_findings_invalid");
  const ids = new Set();
  for (const finding of input?.findings ?? []) {
    add(FINDING_RE.test(String(finding?.findingId ?? "")), "a22_finding_id_invalid");
    add(!ids.has(finding?.findingId), "a22_finding_id_duplicate"); ids.add(finding?.findingId);
    add(/^[A-Z0-9_]{3,80}$/u.test(String(finding?.familyId ?? "")), "a22_family_id_invalid");
    add(PATH_STATES.has(finding?.pathFeasibility), "a22_path_state_invalid");
    add(Array.isArray(finding?.impactTypes) && finding.impactTypes.length >= 1 && finding.impactTypes.every((value) => IMPACTS.has(value)), "a22_impact_invalid");
    add(ASSET_SCALES.has(finding?.assetAtRisk?.scale), "a22_asset_scale_invalid");
    add(Array.isArray(finding?.assetAtRisk?.assets), "a22_assets_invalid");
    add(BLAST.has(finding?.blastRadius), "a22_blast_invalid");
    add(EXPOSURE.has(finding?.attackerExposure), "a22_exposure_invalid");
    add(EXPLOITABILITY.has(finding?.exploitability), "a22_exploitability_invalid");
    add(PERSISTENCE.has(finding?.persistence), "a22_persistence_invalid");
    add(typeof finding?.userInteractionRequired === "boolean", "a22_user_interaction_invalid");
    add(typeof finding?.prerequisitesComplete === "boolean", "a22_prerequisite_state_invalid");
    add(Array.isArray(finding?.prerequisites), "a22_prerequisites_invalid");
    add(Array.isArray(finding?.evidenceFamilies) && finding.evidenceFamilies.length >= 1, "a22_evidence_families_invalid");
    add(Array.isArray(finding?.evidenceRefs) && finding.evidenceRefs.length >= 1, "a22_evidence_refs_invalid");
    add(typeof finding?.evidenceConflict === "boolean", "a22_evidence_conflict_invalid");
    add(Array.isArray(finding?.affectedComponents), "a22_components_invalid");
    add(Array.isArray(finding?.limitations), "a22_limitations_invalid");
  }
  const edgeKeys = new Set();
  for (const edge of input?.attackEdges ?? []) {
    add(ids.has(edge?.from) && ids.has(edge?.to) && edge.from !== edge.to, "a22_attack_edge_invalid");
    const key = `${edge?.from}->${edge?.to}`;
    if (!edgeKeys.has(key)) edgeKeys.add(key);
    add(typeof edge?.evidenceRef === "string" && edge.evidenceRef.length >= 8, "a22_attack_edge_evidence_invalid");
  }
  return [...new Set(errors)].sort();
}

function attackGraph(input) {
  const ids = input.findings.map((finding) => finding.findingId);
  const edges = [];
  const seen = new Set();
  for (const edge of input.attackEdges ?? []) {
    const key = `${edge.from}->${edge.to}`;
    if (!seen.has(key)) { seen.add(key); edges.push({ from: edge.from, to: edge.to, type: edge.type ?? "ENABLES", evidenceRef: edge.evidenceRef }); }
  }
  const adjacency = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const visiting = new Set(); const visited = new Set(); let cycle = false;
  function visit(id) {
    if (visiting.has(id)) { cycle = true; return; }
    if (visited.has(id)) return;
    visiting.add(id); for (const next of adjacency.get(id) ?? []) visit(next); visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  if (cycle) return { cycle: true, edges, chains: [], classByFinding: Object.fromEntries(ids.map((id) => [id, "NONE"])) };
  const chains = [];
  function walk(id, path) {
    const nexts = adjacency.get(id) ?? [];
    if (!nexts.length) { if (path.length >= 2) chains.push(path); return; }
    for (const next of nexts) walk(next, [...path, next]);
  }
  const incoming = new Set(edges.map((edge) => edge.to));
  for (const root of ids.filter((id) => !incoming.has(id))) walk(root, [root]);
  const classByFinding = Object.fromEntries(ids.map((id) => [id, "NONE"]));
  for (const chain of chains) {
    const cls = chain.length >= 3 ? "THREE_PLUS_STEP" : "TWO_STEP";
    for (const id of chain) if (cls === "THREE_PLUS_STEP" || classByFinding[id] === "NONE") classByFinding[id] = cls;
  }
  return { cycle: false, edges, chains: chains.map((findingIds, index) => ({ chainId: `CHAIN-${String(index + 1).padStart(3, "0")}`, findingIds, length: findingIds.length, class: findingIds.length >= 3 ? "THREE_PLUS_STEP" : "TWO_STEP" })), classByFinding };
}

function featureVector(finding, chainClass, policy) {
  const values = policy.featureValues;
  const impact = Math.max(...finding.impactTypes.map((type) => Number(values.impact[type] ?? 0)));
  return {
    impact,
    assetScale: Number(values.assetScale[finding.assetAtRisk.scale] ?? 0),
    blastRadius: Number(values.blastRadius[finding.blastRadius] ?? 0),
    exposure: Number(values.exposure[finding.attackerExposure] ?? 0),
    exploitability: Math.max(0, Number(values.exploitability[finding.exploitability] ?? 0) - (finding.userInteractionRequired ? 0.12 : 0)),
    persistence: Number(values.persistence[finding.persistence] ?? 0),
    attackChain: Number(values.attackChain[chainClass] ?? 0),
  };
}
function scoreRater(profile, features) {
  return round(Object.entries(profile.weights).reduce((sum, [key, weight]) => sum + Number(weight) * Number(features[key] ?? 0), 0), 3);
}
function criticalRequirements(finding, evidenceFamilyCount, subjectExact) {
  return finding.pathFeasibility === "REACHABLE"
    && ["HIGH", "SYSTEMIC"].includes(finding.assetAtRisk.scale)
    && ["PROTOCOL_WIDE", "CROSS_PROTOCOL"].includes(finding.blastRadius)
    && evidenceFamilyCount >= 2
    && subjectExact
    && !finding.evidenceConflict;
}

export function analyzeA22SeverityCase(input, policy) {
  if (!verifyA22Policy(policy)) throw new Error("a22_policy_invalid");
  const errors = validateInput(input);
  const graph = errors.length ? { cycle: false, edges: [], chains: [], classByFinding: {} } : attackGraph(input);
  if (graph.cycle) errors.push("a22_attack_chain_cycle");
  if (errors.length) {
    const blockedCore = {
      schemaVersion: A22_REPORT_SCHEMA, passId: policy.passId, sourceRevisionId: policy.sourceRevisionId,
      caseRef: input?.caseRef ?? null, status: "BLOCKED", blockers: [...new Set(errors)].sort(), findings: [], attackChains: [],
      highestSeverity: "SUPPRESSED", paidGateEligible: false, fullAuditClaimAllowed: false, exploitabilityClaimAllowed: false,
      humanReviewed: false, independentAdjudication: false, truthBoundary: policy.truthBoundary,
    };
    return { ...blockedCore, integritySha256: digest(blockedCore) };
  }
  const findings = input.findings.map((finding) => {
    const evidenceFamilies = unique(finding.evidenceFamilies); const evidenceRefs = unique(finding.evidenceRefs);
    const assets = unique(finding.assetAtRisk.assets); const components = unique(finding.affectedComponents);
    const chainClass = graph.classByFinding[finding.findingId] ?? "NONE";
    const features = featureVector(finding, chainClass, policy);
    const raterScores = policy.raterProfiles.map((profile) => ({ raterId: profile.id, score: scoreRater(profile, features) }));
    const raterSeverities = raterScores.map((row) => ({ ...row, severity: severityFromScore(policy, row.score) }));
    const consensusScore = round(raterScores.reduce((sum, row) => sum + row.score, 0) / raterScores.length, 3);
    const preCapSeverity = severityFromScore(policy, consensusScore);
    let finalSeverity = preCapSeverity; const capsApplied = []; let suppressed = false;
    if (finding.pathFeasibility === "UNREACHABLE") { finalSeverity = "SUPPRESSED"; suppressed = true; capsApplied.push("UNREACHABLE_PATH_SUPPRESSED"); }
    if (!suppressed && finding.pathFeasibility === "UNKNOWN") { finalSeverity = capSeverity(policy, finalSeverity, policy.hardCaps.unknownPathMaximum); capsApplied.push("UNKNOWN_PATH_HIGH_CAP"); }
    if (!suppressed && finding.assetAtRisk.scale === "UNKNOWN") { finalSeverity = capSeverity(policy, finalSeverity, policy.hardCaps.missingAssetMaximum); capsApplied.push("MISSING_ASSET_MEDIUM_CAP"); }
    if (!suppressed && !input.subjectBinding.exact) { finalSeverity = capSeverity(policy, finalSeverity, policy.hardCaps.missingExactSubjectBindingMaximum); capsApplied.push("MISSING_EXACT_SUBJECT_BINDING_MEDIUM_CAP"); }
    if (!suppressed && evidenceFamilies.length < 2) { finalSeverity = capSeverity(policy, finalSeverity, policy.hardCaps.singleEvidenceFamilyMaximum); capsApplied.push("SINGLE_EVIDENCE_FAMILY_HIGH_CAP"); }
    if (!suppressed && finding.evidenceConflict) { finalSeverity = capSeverity(policy, finalSeverity, policy.hardCaps.conflictedEvidenceMaximum); capsApplied.push("CONFLICTED_EVIDENCE_HIGH_CAP"); }
    const disagreementDistance = Math.abs(severityRank(policy, raterSeverities[0].severity) - severityRank(policy, raterSeverities[1].severity));
    if (!suppressed && disagreementDistance > 1) { finalSeverity = capSeverity(policy, finalSeverity, "HIGH"); capsApplied.push("RATER_DISAGREEMENT_HIGH_CAP"); }
    const criticalJustified = criticalRequirements(finding, evidenceFamilies.length, input.subjectBinding.exact);
    if (!suppressed && finalSeverity === "CRITICAL" && !criticalJustified) { finalSeverity = "HIGH"; capsApplied.push("CRITICAL_REQUIREMENTS_NOT_MET"); }
    let confidence = policy.confidence.base + evidenceFamilies.length * policy.confidence.perEvidenceFamily;
    if (finding.pathFeasibility === "REACHABLE") confidence += policy.confidence.reachablePathBonus;
    if (input.subjectBinding.exact) confidence += policy.confidence.exactSubjectBindingBonus;
    if (finding.prerequisitesComplete) confidence += policy.confidence.completePrerequisiteBonus;
    confidence = Math.min(policy.confidence.maximum, confidence);
    if (finding.pathFeasibility === "UNKNOWN") confidence = Math.min(confidence, policy.confidence.unknownPathCap);
    if (evidenceFamilies.length < 2) confidence = Math.min(confidence, policy.confidence.singleEvidenceCap);
    if (finding.evidenceConflict) confidence = Math.min(confidence, policy.confidence.conflictedEvidenceCap);
    if (disagreementDistance > 1) confidence = Math.min(confidence, policy.confidence.raterDisagreementCap);
    if (suppressed) confidence = Math.min(confidence, 0.9);
    confidence = round(confidence, 3);
    const uncertainty = [];
    if (finding.pathFeasibility === "UNKNOWN") uncertainty.push("PATH_FEASIBILITY_UNKNOWN");
    if (!finding.prerequisitesComplete) uncertainty.push("PREREQUISITES_INCOMPLETE");
    if (finding.assetAtRisk.scale === "UNKNOWN") uncertainty.push("ASSET_AT_RISK_UNKNOWN");
    if (finding.evidenceConflict) uncertainty.push("EVIDENCE_CONFLICT");
    if (evidenceFamilies.length < 2) uncertainty.push("SINGLE_EVIDENCE_FAMILY");
    if (disagreementDistance > 0) uncertainty.push("RATER_DISAGREEMENT");
    return {
      findingId: finding.findingId, familyId: finding.familyId, title: finding.title,
      pathFeasibility: finding.pathFeasibility, impactTypes: unique(finding.impactTypes),
      assetAtRisk: { ...finding.assetAtRisk, assets }, blastRadius: finding.blastRadius,
      attackerExposure: finding.attackerExposure, exploitability: finding.exploitability,
      userInteractionRequired: finding.userInteractionRequired, persistence: finding.persistence,
      prerequisites: unique(finding.prerequisites), prerequisitesComplete: finding.prerequisitesComplete,
      evidenceFamilies, evidenceRefs, evidenceConflict: finding.evidenceConflict,
      affectedComponents: components, limitations: unique(finding.limitations), chainClass,
      features, raterScores: raterSeverities, raterDisagreementDistance: disagreementDistance,
      consensusScore, preCapSeverity, finalSeverity, confidence, confidenceBand: confidence >= 0.85 ? "HIGH" : confidence >= 0.65 ? "MEDIUM" : "LOW",
      capsApplied: unique(capsApplied), uncertainty: unique(uncertainty), suppressed, criticalJustified,
    };
  });
  const active = findings.filter((finding) => !finding.suppressed);
  const highestSeverity = active.reduce((current, finding) => severityRank(policy, finding.finalSeverity) > severityRank(policy, current) ? finding.finalSeverity : current, "SUPPRESSED");
  const unjustifiedCriticalCount = active.filter((finding) => finding.finalSeverity === "CRITICAL" && !finding.criticalJustified).length;
  const reportCore = {
    schemaVersion: A22_REPORT_SCHEMA, passId: policy.passId, sourceRevisionId: policy.sourceRevisionId,
    caseRef: input.caseRef, inputClass: input.inputClass, observedAt: input.observedAt,
    subjectBinding: input.subjectBinding, status: "PASS_LOCAL_TRIAGE_NOT_FOR_SALE", blockers: [],
    findings, attackChains: graph.chains, attackEdges: graph.edges, highestSeverity,
    severityCounts: Object.fromEntries(policy.severityOrder.map((severity) => [severity, findings.filter((finding) => finding.finalSeverity === severity).length])),
    unjustifiedCriticalCount, raterProfiles: policy.raterProfiles.map((profile) => profile.id),
    paidGateEligible: false, fullAuditClaimAllowed: false, exploitabilityClaimAllowed: false,
    humanReviewed: false, independentAdjudication: false, liveClaimed: false, customerValueProven: false,
    truthBoundary: policy.truthBoundary,
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

export function verifyA22SeverityReport(report) {
  if (!report || report.schemaVersion !== A22_REPORT_SCHEMA || !DIGEST_RE.test(String(report.integritySha256 ?? ""))) return false;
  const copy = { ...report }; delete copy.integritySha256;
  if (digest(copy) !== report.integritySha256) return false;
  if (report.paidGateEligible !== false || report.fullAuditClaimAllowed !== false || report.exploitabilityClaimAllowed !== false || report.humanReviewed !== false || report.independentAdjudication !== false) return false;
  if (report.status === "BLOCKED") return Array.isArray(report.blockers) && report.blockers.length > 0 && report.findings.length === 0;
  return report.unjustifiedCriticalCount === 0 && Array.isArray(report.findings) && report.findings.length > 0;
}

function baseFinding(id, overrides = {}) {
  return {
    findingId: id, familyId: "GENERIC_FINDING", title: "Evidence-bound finding",
    pathFeasibility: "REACHABLE", impactTypes: ["FUNDS"],
    assetAtRisk: { scale: "HIGH", lowerUsd: 1000000, upperUsd: 10000000, assets: ["USER_FUNDS"] },
    blastRadius: "PROTOCOL_WIDE", attackerExposure: "PUBLIC", exploitability: "LOW_COMPLEXITY",
    userInteractionRequired: false, persistence: "PERSISTENT", prerequisites: ["PUBLIC_ENTRYPOINT", "MATERIAL_STATE"],
    prerequisitesComplete: true, evidenceFamilies: ["STATIC_SOURCE", "ABSTRACT_PATH", "CHAIN_STATE"],
    evidenceRefs: ["sha256:" + "1".repeat(64), "sha256:" + "2".repeat(64), "sha256:" + "3".repeat(64)],
    evidenceConflict: false, affectedComponents: ["CORE_ACCOUNTING"], limitations: [], ...overrides,
  };
}
function splitForVariant(variant) { return variant <= 2 ? "development" : variant <= 4 ? "validation" : "frozen_test"; }
function idToken(value, max = 20) { return String(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max); }
function scenarioFindings(familyId, vulnerable, variant) {
  const suffix = String(variant).padStart(2, "0");
  const remediated = vulnerable ? {} : { pathFeasibility: "UNREACHABLE", impactTypes: ["NONE"], assetAtRisk: { scale: "LOW", lowerUsd: 0, upperUsd: 0, assets: [] }, blastRadius: "SINGLE_USER", attackerExposure: "INTERNAL", exploitability: "THEORETICAL", persistence: "TRANSIENT", prerequisitesComplete: true, limitations: ["REMEDIATED_CONTROL_PRESENT"] };
  const one = (overrides = {}) => [baseFinding(`F-${idToken(familyId, 18)}-${suffix}`, { familyId, ...overrides, ...remediated })];
  if (familyId === "PUBLIC_PROTOCOL_DRAIN_CRITICAL") return one();
  if (familyId === "PUBLIC_GOVERNANCE_TAKEOVER_CRITICAL") return one({ impactTypes: ["GOVERNANCE", "ARBITRARY_CODE"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 5000000, upperUsd: 50000000, assets: ["GOVERNANCE", "UPGRADE_AUTHORITY"] }, persistence: "IRREVERSIBLE" });
  if (familyId === "PRIVILEGED_UPGRADE_HIGH") return one({ impactTypes: ["GOVERNANCE", "ARBITRARY_CODE"], attackerExposure: "PRIVILEGED", exploitability: "MODERATE", assetAtRisk: { scale: "HIGH", lowerUsd: 1000000, upperUsd: 12000000, assets: ["UPGRADE_AUTHORITY"] } });
  if (familyId === "CROSS_PROTOCOL_ORACLE_CRITICAL") return one({ impactTypes: ["FUNDS", "INTEGRITY"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 10000000, upperUsd: 100000000, assets: ["ORACLE_DEPENDENT_FUNDS"] }, blastRadius: "CROSS_PROTOCOL", affectedComponents: ["ORACLE", "LENDING", "DEX"] });
  if (familyId === "PROTOCOL_WIDE_DOS_HIGH") return one({ impactTypes: ["AVAILABILITY"], assetAtRisk: { scale: "HIGH", lowerUsd: 500000, upperUsd: 5000000, assets: ["WITHDRAWAL_AVAILABILITY"] }, exploitability: "MODERATE" });
  if (familyId === "USER_INTERACTION_LOSS_MEDIUM") return one({ assetAtRisk: { scale: "MEDIUM", lowerUsd: 1000, upperUsd: 50000, assets: ["SINGLE_USER_FUNDS"] }, blastRadius: "SINGLE_USER", attackerExposure: "AUTHENTICATED", exploitability: "HIGH_COMPLEXITY", userInteractionRequired: true, persistence: "TRANSIENT" });
  if (familyId === "LOW_VALUE_SINGLE_USER_LOW") return one({ impactTypes: ["INTEGRITY"], assetAtRisk: { scale: "LOW", lowerUsd: 0, upperUsd: 500, assets: ["NONCRITICAL_METADATA"] }, blastRadius: "SINGLE_USER", attackerExposure: "INTERNAL", exploitability: "THEORETICAL", persistence: "TRANSIENT" });
  if (familyId === "UNKNOWN_PATH_CAPPED_HIGH") return one({ pathFeasibility: vulnerable ? "UNKNOWN" : "UNREACHABLE", impactTypes: ["FUNDS", "ARBITRARY_CODE"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 10000000, upperUsd: 100000000, assets: ["USER_FUNDS"] }, blastRadius: "CROSS_PROTOCOL", persistence: "IRREVERSIBLE", limitations: ["DYNAMIC_JUMP_UNRESOLVED"] });
  if (familyId === "UNREACHABLE_SUPPRESSED") return one({ pathFeasibility: "UNREACHABLE", impactTypes: ["FUNDS"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 10000000, upperUsd: 100000000, assets: ["USER_FUNDS"] }, blastRadius: "CROSS_PROTOCOL" });
  if (familyId === "MISSING_ASSET_CAPPED_MEDIUM") return one({ impactTypes: ["ARBITRARY_CODE"], assetAtRisk: { scale: vulnerable ? "UNKNOWN" : "LOW", lowerUsd: null, upperUsd: null, assets: [] }, blastRadius: "PROTOCOL_WIDE", limitations: ["ASSET_VALUE_NOT_ESTABLISHED"] });
  if (familyId === "CONFLICTED_EVIDENCE_HIGH_CAP") return one({ impactTypes: ["FUNDS", "GOVERNANCE"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 10000000, upperUsd: 100000000, assets: ["USER_FUNDS", "GOVERNANCE"] }, blastRadius: "CROSS_PROTOCOL", evidenceConflict: vulnerable, limitations: vulnerable ? ["ANALYZER_DISAGREEMENT"] : ["REMEDIATED_CONTROL_PRESENT"] });
  if (familyId === "THREE_STEP_ATTACK_CHAIN_CRITICAL") {
    const findings = [
      baseFinding(`F-CHAIN-INIT-${suffix}`, { familyId: "PUBLIC_INITIALIZER_NO_GUARD", impactTypes: ["GOVERNANCE"], assetAtRisk: { scale: "HIGH", lowerUsd: 1000000, upperUsd: 10000000, assets: ["UPGRADE_AUTHORITY"] }, blastRadius: "PROTOCOL_WIDE", attackerExposure: "PUBLIC", exploitability: "LOW_COMPLEXITY", persistence: "PERSISTENT", ...remediated }),
      baseFinding(`F-CHAIN-UPGRADE-${suffix}`, { familyId: "UNPROTECTED_UPGRADE", impactTypes: ["GOVERNANCE", "ARBITRARY_CODE"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 5000000, upperUsd: 50000000, assets: ["UPGRADE_AUTHORITY", "USER_FUNDS"] }, blastRadius: "PROTOCOL_WIDE", persistence: "IRREVERSIBLE", ...remediated }),
      baseFinding(`F-CHAIN-DRAIN-${suffix}`, { familyId: "UNTRUSTED_DELEGATECALL", impactTypes: ["FUNDS", "ARBITRARY_CODE"], assetAtRisk: { scale: "SYSTEMIC", lowerUsd: 10000000, upperUsd: 100000000, assets: ["USER_FUNDS"] }, blastRadius: "CROSS_PROTOCOL", persistence: "IRREVERSIBLE", ...remediated }),
    ];
    return findings;
  }
  throw new Error(`a22_unknown_family:${familyId}`);
}
function scenarioEdges(familyId, findings, vulnerable) {
  if (familyId !== "THREE_STEP_ATTACK_CHAIN_CRITICAL" || !vulnerable) return [];
  return [
    { from: findings[0].findingId, to: findings[1].findingId, type: "ENABLES", evidenceRef: "attack-edge-initializer-upgrade" },
    { from: findings[1].findingId, to: findings[2].findingId, type: "ENABLES", evidenceRef: "attack-edge-upgrade-drain" },
  ];
}
export function buildA22BenchmarkCase(familyId, vulnerable, variant) {
  const findings = scenarioFindings(familyId, vulnerable, variant);
  const expectedBase = familyId === "UNREACHABLE_SUPPRESSED" ? "SUPPRESSED" : vulnerable ? null : "SUPPRESSED";
  return {
    schemaVersion: A22_INPUT_SCHEMA, inputClass: "SYNTHETIC_OFFLINE",
    caseRef: `AUD-A22-${idToken(familyId, 20)}-${vulnerable ? "VULN" : "SAFE"}-${String(variant).padStart(2, "0")}`,
    observedAt: `2026-07-23T${String(variant).padStart(2, "0")}:22:00.000Z`,
    subjectBinding: { chainId: "1", contractAddress: `0x${String(variant + 1).padStart(40, "0")}`, exact: true, sourceBundleSha256: "sha256:" + "a".repeat(64), runtimeBytecodeSha256: "sha256:" + "b".repeat(64) },
    findings, attackEdges: scenarioEdges(familyId, findings, vulnerable),
    benchmarkMeta: { familyId, vulnerable, variant, split: splitForVariant(variant), expectedBase },
  };
}

function expectedSeverity(caseInput, policy) {
  if (!caseInput.benchmarkMeta.vulnerable) return "SUPPRESSED";
  return policy.benchmark.families.find((family) => family.id === caseInput.benchmarkMeta.familyId)?.expectedSeverity ?? "SUPPRESSED";
}
function ratingIndex(policy, severity) { return Math.max(0, severityRank(policy, severity)); }
function weightedKappa(policy, pairs) {
  if (!pairs.length) return 0;
  const k = policy.severityOrder.length; const matrix = Array.from({ length: k }, () => Array(k).fill(0));
  for (const [a, b] of pairs) matrix[ratingIndex(policy, a)][ratingIndex(policy, b)] += 1;
  const row = matrix.map((values) => values.reduce((sum, value) => sum + value, 0));
  const col = Array.from({ length: k }, (_, j) => matrix.reduce((sum, values) => sum + values[j], 0));
  let observed = 0; let expected = 0; const denom = (k - 1) ** 2;
  for (let i = 0; i < k; i += 1) for (let j = 0; j < k; j += 1) {
    const weight = 1 - ((i - j) ** 2) / denom;
    observed += weight * matrix[i][j] / pairs.length;
    expected += weight * (row[i] * col[j]) / (pairs.length ** 2);
  }
  return round((observed - expected) / (1 - expected || 1), 6);
}
function clone(value) { return structuredClone(value); }
function mutateCase(input, type, counterpart) {
  const mutated = clone(input);
  if (type === "reorder_evidence") for (const finding of mutated.findings) { finding.evidenceFamilies.reverse(); finding.evidenceRefs.reverse(); }
  else if (type === "duplicate_evidence") for (const finding of mutated.findings) { finding.evidenceFamilies.push(finding.evidenceFamilies[0]); finding.evidenceRefs.push(finding.evidenceRefs[0]); }
  else if (type === "reorder_assets") for (const finding of mutated.findings) finding.assetAtRisk.assets.reverse();
  else if (type === "add_irrelevant_limitation") for (const finding of mutated.findings) finding.limitations.push("FORMATTING_ONLY_LIMITATION");
  else if (type === "rename_nonsemantic_title") for (const finding of mutated.findings) finding.title = `Renamed ${finding.findingId}`;
  else if (type === "normalize_identifier_case") for (const finding of mutated.findings) finding.title = finding.title.toUpperCase();
  else if (type === "change_observed_at") mutated.observedAt = "2026-07-23T22:22:22.000Z";
  else if (type === "duplicate_attack_edge" && mutated.attackEdges.length) mutated.attackEdges.push(clone(mutated.attackEdges[0]));
  else if (type === "add_nonmaterial_component") for (const finding of mutated.findings) finding.affectedComponents.push("NON_MATERIAL_OBSERVABILITY_COMPONENT");
  else if (type === "remove_material_evidence") for (const finding of mutated.findings) { finding.evidenceFamilies = finding.evidenceFamilies.slice(0, 1); finding.evidenceRefs = finding.evidenceRefs.slice(0, 1); }
  else if (type === "paired_security_flip") return clone(counterpart);
  return mutated;
}

export function runA22Benchmark(policy) {
  if (!verifyA22Policy(policy)) throw new Error("a22_policy_invalid");
  const cases = [];
  for (const family of policy.benchmark.families) for (let variant = 0; variant < policy.benchmark.variantsPerFamily; variant += 1) {
    cases.push(buildA22BenchmarkCase(family.id, true, variant));
    cases.push(buildA22BenchmarkCase(family.id, false, variant));
  }
  const results = cases.map((input) => {
    const report = analyzeA22SeverityCase(input, policy); const expected = expectedSeverity(input, policy);
    return { caseRef: input.caseRef, familyId: input.benchmarkMeta.familyId, vulnerable: input.benchmarkMeta.vulnerable, split: input.benchmarkMeta.split, expectedSeverity: expected, observedSeverity: report.highestSeverity, matched: report.highestSeverity === expected, reportIntegritySha256: report.integritySha256, raterPairs: report.findings.map((finding) => [finding.raterScores[0].severity, finding.raterScores[1].severity]), unjustifiedCriticalCount: report.unjustifiedCriticalCount, falseCritical: !input.benchmarkMeta.vulnerable && report.highestSeverity === "CRITICAL" };
  });
  const byKey = new Map(cases.map((input) => [`${input.benchmarkMeta.familyId}|${input.benchmarkMeta.vulnerable}|${input.benchmarkMeta.variant}`, input]));
  const mutations = [];
  for (const input of cases) {
    const counterpart = byKey.get(`${input.benchmarkMeta.familyId}|${!input.benchmarkMeta.vulnerable}|${input.benchmarkMeta.variant}`);
    const baseline = analyzeA22SeverityCase(input, policy);
    for (const type of policy.benchmark.mutationTypes) {
      if (type === "tamper_integrity") {
        const tampered = clone(baseline); tampered.paidGateEligible = true;
        mutations.push({ caseRef: input.caseRef, type, killed: verifyA22SeverityReport(tampered) === false, expected: "INTEGRITY_REJECTED", observed: verifyA22SeverityReport(tampered) ? "ACCEPTED" : "REJECTED" });
        continue;
      }
      const mutatedInput = mutateCase(input, type, counterpart);
      const report = analyzeA22SeverityCase(mutatedInput, policy);
      let killed; let expected;
      if (type === "paired_security_flip") { expected = expectedSeverity(counterpart, policy); killed = report.highestSeverity === expected; }
      else if (type === "remove_material_evidence") {
        expected = "CAP_OR_CONFIDENCE_REDUCTION";
        killed = report.findings.every((finding, index) => finding.capsApplied.includes("SINGLE_EVIDENCE_FAMILY_HIGH_CAP") || finding.confidence < baseline.findings[index].confidence);
      } else { expected = baseline.highestSeverity; killed = report.highestSeverity === baseline.highestSeverity; }
      mutations.push({ caseRef: input.caseRef, type, killed, expected, observed: report.highestSeverity });
    }
  }
  const frozen = results.filter((result) => result.split === "frozen_test");
  const severityCorrect = frozen.filter((result) => result.matched).length;
  const suppressionRows = frozen.filter((result) => result.expectedSeverity === "SUPPRESSED");
  const suppressionCorrect = suppressionRows.filter((result) => result.matched).length;
  const raterPairs = frozen.flatMap((result) => result.raterPairs);
  const exactAgreement = ratio(raterPairs.filter(([a, b]) => a === b).length, raterPairs.length);
  const kappa = weightedKappa(policy, raterPairs);
  const mutationKilled = mutations.filter((mutation) => mutation.killed).length;
  const unjustifiedCritical = results.reduce((sum, result) => sum + Number(result.unjustifiedCriticalCount ?? 0), 0);
  const falseCriticalRemediated = results.filter((result) => result.falseCritical).length;
  const gates = {
    caseDenominator: cases.length === policy.benchmark.expectedCases,
    vulnerableDenominator: cases.filter((input) => input.benchmarkMeta.vulnerable).length === policy.benchmark.expectedVulnerable,
    remediatedDenominator: cases.filter((input) => !input.benchmarkMeta.vulnerable).length === policy.benchmark.expectedRemediated,
    splitDenominators: results.filter((result) => result.split === "development").length === policy.benchmark.expectedDevelopment && results.filter((result) => result.split === "validation").length === policy.benchmark.expectedValidation && frozen.length === policy.benchmark.expectedFrozen,
    mutationDenominator: mutations.length === policy.benchmark.expectedMutations,
    frozenSeverityAccuracy: ratio(severityCorrect, frozen.length) >= policy.thresholds.minimumFrozenSeverityAccuracy,
    frozenSuppressionAccuracy: ratio(suppressionCorrect, suppressionRows.length) >= policy.thresholds.minimumFrozenSuppressionAccuracy,
    mutationKillRate: ratio(mutationKilled, mutations.length) >= policy.thresholds.minimumMutationKillRate,
    raterExactAgreement: exactAgreement >= policy.thresholds.minimumRaterExactAgreement,
    weightedKappa: kappa >= policy.thresholds.minimumWeightedKappa,
    falseCriticalRemediated: falseCriticalRemediated <= policy.thresholds.maximumFalseCriticalRemediated,
    unjustifiedCritical: unjustifiedCritical <= policy.thresholds.maximumUnjustifiedCritical,
  };
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([id]) => id);
  const benchmarkCore = {
    schemaVersion: A22_BENCHMARK_SCHEMA, passId: policy.passId, sourceRevisionId: policy.sourceRevisionId,
    evaluatedAt: "2026-07-23T22:22:00.000+02:00",
    denominators: { families: policy.benchmark.families.length, cases: cases.length, vulnerable: cases.filter((input) => input.benchmarkMeta.vulnerable).length, remediated: cases.filter((input) => !input.benchmarkMeta.vulnerable).length, development: results.filter((result) => result.split === "development").length, validation: results.filter((result) => result.split === "validation").length, frozen: frozen.length, mutations: mutations.length },
    frozen: { severityAccuracy: round(ratio(severityCorrect, frozen.length)), severityWilson95: wilson(severityCorrect, frozen.length), suppressionAccuracy: round(ratio(suppressionCorrect, suppressionRows.length)), suppressionWilson95: wilson(suppressionCorrect, suppressionRows.length), raterExactAgreement: round(exactAgreement), weightedKappa: kappa, falseCriticalRemediated, unjustifiedCritical },
    mutation: { killed: mutationKilled, total: mutations.length, killRate: round(ratio(mutationKilled, mutations.length)), wilson95: wilson(mutationKilled, mutations.length) },
    gates, failedGates, localSeverityTriageBenchmarkPass: failedGates.length === 0,
    paidGateEligible: false, fullAuditClaimAllowed: false, exploitabilityClaimAllowed: false, independentHumanRatersClaimed: false, customerValueProven: false,
    results, mutations, truthBoundary: policy.truthBoundary,
  };
  return { ...benchmarkCore, integritySha256: digest(benchmarkCore) };
}

export function verifyA22Benchmark(benchmark, policy) {
  if (!benchmark || benchmark.schemaVersion !== A22_BENCHMARK_SCHEMA || !verifyA22Policy(policy)) return false;
  const copy = { ...benchmark }; delete copy.integritySha256;
  if (digest(copy) !== benchmark.integritySha256) return false;
  if (benchmark.denominators.cases !== policy.benchmark.expectedCases || benchmark.denominators.mutations !== policy.benchmark.expectedMutations) return false;
  if (benchmark.paidGateEligible !== false || benchmark.fullAuditClaimAllowed !== false || benchmark.exploitabilityClaimAllowed !== false || benchmark.independentHumanRatersClaimed !== false) return false;
  return benchmark.localSeverityTriageBenchmarkPass === (benchmark.failedGates.length === 0);
}
