import { createHash } from "node:crypto";
import { analyzeA22SeverityCase, verifyA22Policy, verifyA22SeverityReport } from "./pass35-a22-severity-triage-runtime.mjs";

export const A23_POLICY_SCHEMA = "velmere.pass35.a23-remediation-closure-policy.v1";
export const A23_INPUT_SCHEMA = "velmere.pass35.a23-remediation-closure-input.v1";
export const A23_REPORT_SCHEMA = "velmere.pass35.a23-remediation-closure-report.v1";
export const A23_BENCHMARK_SCHEMA = "velmere.pass35.a23-remediation-closure-benchmark.v1";

const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/iu;
const CASE_RE = /^AUD-[A-Z0-9-]{8,64}$/u;
const FINDING_RE = /^F-[A-Z0-9-]{4,64}$/u;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/iu;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const CONTROL_RE = /^A(?:0[1-9]|1[0-7])$/u;
const SEVERITIES = ["SUPPRESSED", "INFORMATIONAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const INPUT_CLASSES = new Set(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"]);

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function sha256(value) { return `sha256:${createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex")}`; }
function round(value, digits = 6) { return Number(value.toFixed(digits)); }
function ratio(n, d) { return d ? n / d : 0; }
function unique(values) { return [...new Set((values ?? []).map(String))].sort(); }
function clone(value) { return structuredClone(value); }
function severityRank(value) { return SEVERITIES.indexOf(value); }
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total; const z2 = z * z; const den = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / den;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / den;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)) };
}

export function verifyA23Policy(policy) {
  if (!policy || policy.schemaVersion !== A23_POLICY_SCHEMA || policy.passId !== "PASS35_A23") return false;
  const families = Object.keys(policy.requiredControlsByFindingFamily ?? {});
  if (families.length !== 12 || policy.benchmark?.families?.length !== 12) return false;
  if (!families.every((family) => policy.benchmark.families.includes(family))) return false;
  if (!families.every((family) => Array.isArray(policy.requiredControlsByFindingFamily[family]) && policy.requiredControlsByFindingFamily[family].length >= 4)) return false;
  if (policy.benchmark.expectedCases !== 192 || policy.benchmark.expectedMutations !== 2304 || policy.benchmark.mutationTypes?.length !== 12) return false;
  if (Object.values(policy.hardStops ?? {}).some((value) => value !== false)) return false;
  return SEVERITIES.includes(policy.closureSeverityMaximum);
}

function validateInput(input, policy) {
  const blockers = []; const add = (ok, code) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === A23_INPUT_SCHEMA, "a23_schema_invalid");
  add(INPUT_CLASSES.has(input?.inputClass), "a23_input_class_invalid");
  add(CASE_RE.test(String(input?.caseRef ?? "")), "a23_case_ref_invalid");
  add(FINDING_RE.test(String(input?.findingId ?? "")), "a23_finding_id_invalid");
  add(ISO_RE.test(String(input?.observedAt ?? "")), "a23_observed_at_invalid");
  add(policy.benchmark.families.includes(input?.findingFamily), "a23_finding_family_invalid");
  add(SEVERITIES.includes(input?.originalFinding?.severity) && severityRank(input.originalFinding.severity) >= severityRank("LOW"), "a23_original_severity_invalid");
  add(Array.isArray(input?.originalFinding?.affectedComponents) && input.originalFinding.affectedComponents.length > 0, "a23_affected_components_invalid");
  add(Array.isArray(input?.originalFinding?.attackChainNodeIds), "a23_attack_chain_nodes_invalid");
  add(Array.isArray(input?.originalFinding?.evidenceFamilies) && input.originalFinding.evidenceFamilies.length >= 1, "a23_original_evidence_invalid");
  add(DIGEST_RE.test(String(input?.originalFinding?.findingReceiptSha256 ?? "")), "a23_finding_receipt_invalid");
  const subject = input?.subjectBinding ?? {};
  add(/^\d+$/u.test(String(subject.chainId ?? "")), "a23_chain_id_invalid");
  add(ADDRESS_RE.test(String(subject.contractAddress ?? "")), "a23_address_invalid");
  add(subject.exact === true, "a23_subject_not_exact");
  for (const field of ["originalSourceSha256", "originalRuntimeBytecodeSha256", "patchedSourceSha256", "patchedRuntimeBytecodeSha256"]) add(DIGEST_RE.test(String(subject[field] ?? "")), `a23_${field}_invalid`);
  add(subject.originalSourceSha256 !== subject.patchedSourceSha256, "a23_source_unchanged");
  add(subject.originalRuntimeBytecodeSha256 !== subject.patchedRuntimeBytecodeSha256, "a23_bytecode_unchanged");
  const patch = input?.patch ?? {};
  for (const field of ["patchCommitSha256", "diffSha256", "regressionPlanSha256"]) add(DIGEST_RE.test(String(patch[field] ?? "")), `a23_${field}_invalid`);
  add(Array.isArray(patch.changedComponents) && patch.changedComponents.length > 0, "a23_changed_components_invalid");
  add(Array.isArray(patch.changedFunctions) && patch.changedFunctions.length > 0, "a23_changed_functions_invalid");
  add(Array.isArray(patch.addedControls) && patch.addedControls.length > 0, "a23_added_controls_invalid");
  add(Array.isArray(patch.removedRiskSignals) && patch.removedRiskSignals.includes(input?.findingFamily), "a23_risk_signal_not_removed");
  add(Array.isArray(patch.impactEdges), "a23_patch_edges_invalid");
  const retests = input?.retests ?? [];
  add(Array.isArray(retests), "a23_retests_invalid");
  add(new Set(retests.map((row) => row?.controlId)).size === retests.length, "a23_retest_duplicate_control");
  for (const row of retests) {
    add(CONTROL_RE.test(String(row?.controlId ?? "")), "a23_retest_control_invalid");
    add(["REQUIRED", "LOCAL_NOT_APPLICABLE"].includes(row?.applicability), "a23_retest_applicability_invalid");
    add(["PASS", "FAIL", "NOT_RUN"].includes(row?.status), "a23_retest_status_invalid");
    add(DIGEST_RE.test(String(row?.preReceiptSha256 ?? "")) && DIGEST_RE.test(String(row?.postReceiptSha256 ?? "")), "a23_retest_receipt_digest_invalid");
    add(Array.isArray(row?.evidenceFamilies), "a23_retest_evidence_invalid");
    add(typeof row?.findingPresentAfter === "boolean", "a23_retest_finding_state_invalid");
    add(Array.isArray(row?.newFindingSeverities) && row.newFindingSeverities.every((severity) => SEVERITIES.includes(severity)), "a23_retest_regression_severity_invalid");
    add(Number.isFinite(row?.coverageBefore) && Number.isFinite(row?.coverageAfter), "a23_retest_coverage_invalid");
    add(typeof row?.realCaseExecution === "boolean" && typeof row?.paidGateEligible === "boolean", "a23_retest_truth_flags_invalid");
  }
  add(input?.postTriageInput?.schemaVersion === "velmere.pass35.a22-severity-triage-input.v1", "a23_post_triage_input_invalid");
  if (input?.reviewerAttestationSha256 != null) add(DIGEST_RE.test(String(input.reviewerAttestationSha256)), "a23_reviewer_attestation_invalid");
  if (input?.independentRetestSha256 != null) add(DIGEST_RE.test(String(input.independentRetestSha256)), "a23_independent_retest_invalid");
  return unique(blockers);
}

function patchImpactGraph(input) {
  const nodes = new Set([`FINDING:${input.findingId}`, "PATCH", "POST_TRIAGE", "CLOSURE"]);
  for (const component of input.originalFinding.affectedComponents) nodes.add(`COMPONENT:${component}`);
  for (const row of input.retests) nodes.add(`RETEST:${row.controlId}`);
  const edges = [];
  for (const component of input.originalFinding.affectedComponents) edges.push({ from: `FINDING:${input.findingId}`, to: `COMPONENT:${component}`, type: "AFFECTS" });
  for (const edge of input.patch.impactEdges ?? []) {
    nodes.add(edge.from); nodes.add(edge.to); edges.push({ from: edge.from, to: edge.to, type: edge.type ?? "MODIFIES" });
  }
  for (const row of input.retests) { edges.push({ from: "PATCH", to: `RETEST:${row.controlId}`, type: "REQUIRES_RETEST" }); edges.push({ from: `RETEST:${row.controlId}`, to: "POST_TRIAGE", type: "SUPPORTS" }); }
  edges.push({ from: "POST_TRIAGE", to: "CLOSURE", type: "GATES" });
  const adjacency = new Map([...nodes].map((node) => [node, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  const visiting = new Set(); const visited = new Set(); let cycle = false;
  const visit = (node) => { if (visiting.has(node)) { cycle = true; return; } if (visited.has(node)) return; visiting.add(node); for (const next of adjacency.get(node) ?? []) visit(next); visiting.delete(node); visited.add(node); };
  for (const node of nodes) visit(node);
  return { nodes: [...nodes].sort(), edges: edges.sort((a, b) => `${a.from}|${a.to}|${a.type}`.localeCompare(`${b.from}|${b.to}|${b.type}`)), cycle };
}

export function analyzeA23RemediationCase(input, policy, a22Policy) {
  if (!verifyA23Policy(policy) || !verifyA22Policy(a22Policy)) throw new Error("a23_policy_invalid");
  const blockers = validateInput(input, policy);
  const requiredControls = unique(policy.requiredControlsByFindingFamily[input?.findingFamily] ?? []);
  const byControl = new Map((input?.retests ?? []).map((row) => [row.controlId, row]));
  for (const control of requiredControls) if (!byControl.has(control)) blockers.push(`a23_required_retest_missing:${control}`);
  for (const component of input?.originalFinding?.affectedComponents ?? []) if (!(input?.patch?.changedComponents ?? []).includes(component)) blockers.push(`a23_affected_component_uncovered:${component}`);
  const graph = input?.findingId && input?.originalFinding && input?.patch && Array.isArray(input?.retests) ? patchImpactGraph(input) : { nodes: [], edges: [], cycle: true };
  if (graph.cycle) blockers.push("a23_patch_impact_graph_cycle");
  const normalizedRetests = [];
  for (const control of requiredControls) {
    const row = byControl.get(control);
    if (!row) continue;
    const evidenceFamilies = unique(row.evidenceFamilies);
    const blockerSeverities = row.newFindingSeverities.filter((severity) => policy.blockingRegressionSeverities.includes(severity));
    const behavioral = policy.behavioralControls.includes(control);
    const coverageMaintained = !behavioral || row.coverageAfter >= row.coverageBefore + policy.minimumCoverageDeltaForBehavioralControls;
    const passed = row.applicability === "REQUIRED" && row.status === "PASS" && row.findingPresentAfter === false && blockerSeverities.length === 0 && evidenceFamilies.length >= policy.minimumEvidenceFamiliesPerRetest && coverageMaintained && row.preReceiptSha256 !== row.postReceiptSha256;
    if (!passed) blockers.push(`a23_retest_not_closed:${control}`);
    normalizedRetests.push({ controlId: control, applicability: row.applicability, status: row.status, findingPresentAfter: row.findingPresentAfter, evidenceFamilies, newFindingSeverities: [...row.newFindingSeverities].sort((a, b) => severityRank(b) - severityRank(a)), coverageBefore: row.coverageBefore, coverageAfter: row.coverageAfter, coverageMaintained, preReceiptSha256: row.preReceiptSha256, postReceiptSha256: row.postReceiptSha256, realCaseExecution: row.realCaseExecution, paidGateEligible: row.paidGateEligible, passed });
  }
  let postTriageReport = null;
  try { postTriageReport = analyzeA22SeverityCase(input.postTriageInput, a22Policy); if (!verifyA22SeverityReport(postTriageReport)) blockers.push("a23_post_triage_integrity_invalid"); }
  catch { blockers.push("a23_post_triage_execution_failed"); }
  const postSeverity = postTriageReport?.highestSeverity ?? "CRITICAL";
  if (severityRank(postSeverity) > severityRank(policy.closureSeverityMaximum)) blockers.push(`a23_post_severity_not_closed:${postSeverity}`);
  if (postTriageReport?.unjustifiedCriticalCount > 0) blockers.push("a23_post_triage_unjustified_critical");
  const regressionSeverities = normalizedRetests.flatMap((row) => row.newFindingSeverities);
  const uniqueBlockers = unique(blockers);
  const localClosureContractVerified = uniqueBlockers.length === 0 && requiredControls.length === normalizedRetests.length && normalizedRetests.every((row) => row.passed);
  const verifiedExternalInput = input?.inputClass === "CUSTOMER_SUPPLIED_VERIFIED";
  const allRealRetests = normalizedRetests.length > 0 && normalizedRetests.every((row) => row.realCaseExecution && row.paidGateEligible);
  const signedCustomerClosureEligible = localClosureContractVerified && verifiedExternalInput && allRealRetests && DIGEST_RE.test(String(input?.reviewerAttestationSha256 ?? "")) && DIGEST_RE.test(String(input?.independentRetestSha256 ?? ""));
  const reportCore = {
    schemaVersion: A23_REPORT_SCHEMA, passId: policy.passId, sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null, findingId: input?.findingId ?? null, findingFamily: input?.findingFamily ?? null, inputClass: input?.inputClass ?? null, observedAt: input?.observedAt ?? null,
    status: localClosureContractVerified ? "VERIFIED_LOCAL_CLOSURE_CONTRACT" : "BLOCKED",
    subjectBinding: input?.subjectBinding ?? null,
    originalFinding: { severity: input?.originalFinding?.severity ?? null, affectedComponents: unique(input?.originalFinding?.affectedComponents), attackChainNodeIds: unique(input?.originalFinding?.attackChainNodeIds), evidenceFamilies: unique(input?.originalFinding?.evidenceFamilies), findingReceiptSha256: input?.originalFinding?.findingReceiptSha256 ?? null },
    patch: { patchCommitSha256: input?.patch?.patchCommitSha256 ?? null, diffSha256: input?.patch?.diffSha256 ?? null, regressionPlanSha256: input?.patch?.regressionPlanSha256 ?? null, changedComponents: unique(input?.patch?.changedComponents), changedFunctions: unique(input?.patch?.changedFunctions), addedControls: unique(input?.patch?.addedControls), removedRiskSignals: unique(input?.patch?.removedRiskSignals) },
    patchImpactGraph: graph,
    requiredRetestControls: requiredControls,
    retests: normalizedRetests,
    postTriage: postTriageReport ? { highestSeverity: postSeverity, reportIntegritySha256: postTriageReport.integritySha256, findingCount: postTriageReport.findings.length, unjustifiedCriticalCount: postTriageReport.unjustifiedCriticalCount } : null,
    regressionFindingSeverities: [...regressionSeverities].sort((a, b) => severityRank(b) - severityRank(a)),
    localClosureContractVerified,
    signedCustomerClosureEligible,
    supersedesFindingReceiptSha256: input?.originalFinding?.findingReceiptSha256 ?? null,
    invalidationTriggers: ["PATCH_SOURCE_OR_BYTECODE_CHANGE", "RETEST_RECEIPT_CHANGE", "NEW_HIGH_OR_CRITICAL_FINDING", "POST_TRIAGE_REOPENED", "SUBJECT_BINDING_CHANGE", "POLICY_OR_TOOL_VERSION_CHANGE"],
    reviewerAttestationPresent: DIGEST_RE.test(String(input?.reviewerAttestationSha256 ?? "")),
    independentRetestPresent: DIGEST_RE.test(String(input?.independentRetestSha256 ?? "")),
    signedClosure: false, realCaseExecution: false, paidGateEligible: false, advancedDeliveryAllowed: false, fullAuditClaimAllowed: false, independentClosureClaimed: false, customerValueProven: false, liveClaimed: false,
    blockers: uniqueBlockers,
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: sha256(reportCore) };
}

export function verifyA23RemediationReport(report) {
  if (!report || report.schemaVersion !== A23_REPORT_SCHEMA || !DIGEST_RE.test(String(report.integritySha256 ?? ""))) return false;
  const copy = { ...report }; delete copy.integritySha256;
  if (sha256(copy) !== report.integritySha256) return false;
  if (report.paidGateEligible !== false || report.advancedDeliveryAllowed !== false || report.fullAuditClaimAllowed !== false || report.signedClosure !== false || report.realCaseExecution !== false || report.independentClosureClaimed !== false) return false;
  if (report.status === "BLOCKED") return report.localClosureContractVerified === false && report.blockers.length > 0;
  return report.status === "VERIFIED_LOCAL_CLOSURE_CONTRACT" && report.localClosureContractVerified === true && report.blockers.length === 0 && report.postTriage && severityRank(report.postTriage.highestSeverity) <= severityRank("INFORMATIONAL");
}

function splitForVariant(variant) { return variant <= 2 ? "development" : variant <= 4 ? "validation" : "frozen_test"; }
function token(value) { return String(value).replace(/[^A-Z0-9]/giu, "").toUpperCase().slice(0, 16); }
function d(char) { return `sha256:${char.repeat(64)}`; }
function postTriage(caseRef, findingId, closed) {
  return {
    schemaVersion: "velmere.pass35.a22-severity-triage-input.v1", inputClass: "SYNTHETIC_OFFLINE", caseRef, observedAt: "2026-07-23T23:23:00.000Z",
    subjectBinding: { chainId: "1", contractAddress: `0x${"a".repeat(40)}`, exact: true, sourceBundleSha256: d("a"), runtimeBytecodeSha256: d("b") },
    findings: [{ findingId, familyId: "POST_PATCH_RETEST", title: "Post patch finding", pathFeasibility: closed ? "UNREACHABLE" : "REACHABLE", impactTypes: closed ? ["NONE"] : ["FUNDS"], assetAtRisk: closed ? { scale: "LOW", lowerUsd: 0, upperUsd: 0, assets: [] } : { scale: "HIGH", lowerUsd: 1000000, upperUsd: 10000000, assets: ["USER_FUNDS"] }, blastRadius: closed ? "SINGLE_USER" : "PROTOCOL_WIDE", attackerExposure: closed ? "INTERNAL" : "PUBLIC", exploitability: closed ? "THEORETICAL" : "LOW_COMPLEXITY", userInteractionRequired: false, persistence: closed ? "TRANSIENT" : "PERSISTENT", prerequisites: closed ? ["REMEDIATED"] : ["PUBLIC_ENTRYPOINT"], prerequisitesComplete: true, evidenceFamilies: ["STATIC_SOURCE", "ABSTRACT_PATH", "EXACT_TESTS"], evidenceRefs: [d("1"), d("2"), d("3")], evidenceConflict: false, affectedComponents: ["CORE_COMPONENT"], limitations: closed ? ["POST_PATCH_LOCAL_ONLY"] : [] }], attackEdges: []
  };
}

export function buildA23BenchmarkCase(family, closable, variant, policy) {
  const caseRef = `AUD-A23-${token(family)}-${String(variant).padStart(2, "0")}-${closable ? "CLOSE" : "BLOCK"}`;
  const findingId = `F-${token(family)}-${String(variant).padStart(2, "0")}`;
  const required = policy.requiredControlsByFindingFamily[family];
  const affectedComponents = ["CORE_COMPONENT", `${token(family)}_MODULE`];
  const retests = required.map((control, index) => ({ controlId: control, applicability: "REQUIRED", status: "PASS", preReceiptSha256: sha256(`${caseRef}|${control}|pre`), postReceiptSha256: sha256(`${caseRef}|${control}|post`), findingPresentAfter: false, newFindingSeverities: [], coverageBefore: 70 + (index % 5), coverageAfter: 75 + (index % 5), evidenceFamilies: ["TOOL_OUTPUT", "EXACT_SUBJECT_BINDING", control === "A14" ? "SEVERITY_TRIAGE" : "RETEST_EXECUTION"], realCaseExecution: false, paidGateEligible: false }));
  const input = {
    schemaVersion: A23_INPUT_SCHEMA, inputClass: "SYNTHETIC_OFFLINE", caseRef, findingId, findingFamily: family, observedAt: "2026-07-23T23:23:00.000Z",
    subjectBinding: { chainId: "1", contractAddress: `0x${"a".repeat(40)}`, exact: true, originalSourceSha256: sha256(`${caseRef}|source|before`), originalRuntimeBytecodeSha256: sha256(`${caseRef}|bytecode|before`), patchedSourceSha256: sha256(`${caseRef}|source|after`), patchedRuntimeBytecodeSha256: sha256(`${caseRef}|bytecode|after`) },
    originalFinding: { severity: variant % 3 === 0 ? "CRITICAL" : "HIGH", affectedComponents, attackChainNodeIds: [`CHAIN-${String(variant + 1).padStart(3, "0")}`], evidenceFamilies: ["STATIC_SOURCE", "ABSTRACT_PATH", "SEVERITY_TRIAGE"], findingReceiptSha256: sha256(`${caseRef}|finding`) },
    patch: { patchCommitSha256: sha256(`${caseRef}|commit`), diffSha256: sha256(`${caseRef}|diff`), regressionPlanSha256: sha256(`${caseRef}|regression`), changedComponents: [...affectedComponents], changedFunctions: ["validateInput", "applyControl"], addedControls: [`CONTROL_${token(family)}`], removedRiskSignals: [family], impactEdges: affectedComponents.map((component) => ({ from: "PATCH", to: `COMPONENT:${component}`, type: "MODIFIES" })) },
    retests,
    postTriageInput: postTriage(caseRef, findingId, true),
    reviewerAttestationSha256: null, independentRetestSha256: null,
    benchmarkMeta: { family, closable, variant, split: splitForVariant(variant) }
  };
  if (!closable) {
    const mode = variant % 6;
    if (mode === 0) input.patch.changedComponents = [affectedComponents[0]];
    else if (mode === 1) input.retests = input.retests.filter((row) => row.controlId !== required.at(-1));
    else if (mode === 2) input.retests[0].findingPresentAfter = true;
    else if (mode === 3) input.retests[0].newFindingSeverities = ["HIGH"];
    else if (mode === 4) input.postTriageInput = postTriage(caseRef, findingId, false);
    else input.subjectBinding.patchedRuntimeBytecodeSha256 = input.subjectBinding.originalRuntimeBytecodeSha256;
  }
  return input;
}

function mutate(input, type, counterpart) {
  const value = clone(input);
  if (type === "reorder_retests") value.retests.reverse();
  else if (type === "duplicate_retest") value.retests.push(clone(value.retests[0]));
  else if (type === "remove_required_retest") value.retests.pop();
  else if (type === "tamper_post_receipt") value.retests[0].postReceiptSha256 = value.retests[0].preReceiptSha256;
  else if (type === "unchanged_source") value.subjectBinding.patchedSourceSha256 = value.subjectBinding.originalSourceSha256;
  else if (type === "unchanged_bytecode") value.subjectBinding.patchedRuntimeBytecodeSha256 = value.subjectBinding.originalRuntimeBytecodeSha256;
  else if (type === "drop_affected_component") value.patch.changedComponents = value.patch.changedComponents.slice(0, 1);
  else if (type === "add_high_regression") value.retests[0].newFindingSeverities = ["HIGH"];
  else if (type === "reopen_post_triage") value.postTriageInput = postTriage(value.caseRef, value.findingId, false);
  else if (type === "cycle_patch_graph") value.patch.impactEdges.push({ from: "COMPONENT:CORE_COMPONENT", to: "PATCH", type: "CYCLE" });
  else if (type === "paired_closure_flip") return clone(counterpart);
  return value;
}

export function runA23Benchmark(policy, a22Policy) {
  if (!verifyA23Policy(policy) || !verifyA22Policy(a22Policy)) throw new Error("a23_policy_invalid");
  const cases = [];
  for (const family of policy.benchmark.families) for (let variant = 0; variant < policy.benchmark.variantsPerFamily; variant += 1) { cases.push(buildA23BenchmarkCase(family, true, variant, policy)); cases.push(buildA23BenchmarkCase(family, false, variant, policy)); }
  const results = cases.map((input) => { const report = analyzeA23RemediationCase(input, policy, a22Policy); const expected = input.benchmarkMeta.closable; return { caseRef: input.caseRef, family: input.benchmarkMeta.family, closable: expected, split: input.benchmarkMeta.split, observedClosed: report.localClosureContractVerified, matched: report.localClosureContractVerified === expected, unsafeClosure: !expected && report.localClosureContractVerified, falseBlock: expected && !report.localClosureContractVerified, reportIntegritySha256: report.integritySha256 }; });
  const byKey = new Map(cases.map((input) => [`${input.benchmarkMeta.family}|${input.benchmarkMeta.closable}|${input.benchmarkMeta.variant}`, input]));
  const mutations = [];
  for (const input of cases) {
    const counterpart = byKey.get(`${input.benchmarkMeta.family}|${!input.benchmarkMeta.closable}|${input.benchmarkMeta.variant}`);
    const baseline = analyzeA23RemediationCase(input, policy, a22Policy);
    for (const type of policy.benchmark.mutationTypes) {
      if (type === "tamper_integrity") { const tampered = clone(baseline); tampered.paidGateEligible = true; const killed = verifyA23RemediationReport(tampered) === false; mutations.push({ caseRef: input.caseRef, type, killed, expected: "REJECTED", observed: killed ? "REJECTED" : "ACCEPTED" }); continue; }
      const mutatedInput = mutate(input, type, counterpart); const report = analyzeA23RemediationCase(mutatedInput, policy, a22Policy);
      let expected;
      if (type === "reorder_retests") expected = baseline.localClosureContractVerified;
      else if (type === "paired_closure_flip") expected = counterpart.benchmarkMeta.closable;
      else expected = false;
      const killed = report.localClosureContractVerified === expected;
      mutations.push({ caseRef: input.caseRef, type, killed, expected, observed: report.localClosureContractVerified });
    }
  }
  const frozen = results.filter((row) => row.split === "frozen_test");
  const correct = frozen.filter((row) => row.matched).length;
  const blockedRows = frozen.filter((row) => !row.closable); const blockedCorrect = blockedRows.filter((row) => row.matched).length;
  const unsafeClosures = results.filter((row) => row.unsafeClosure).length; const falseBlocks = results.filter((row) => row.falseBlock).length;
  const mutationKilled = mutations.filter((row) => row.killed).length;
  const gates = {
    caseDenominator: cases.length === policy.benchmark.expectedCases,
    closableDenominator: cases.filter((row) => row.benchmarkMeta.closable).length === policy.benchmark.expectedClosable,
    blockedDenominator: cases.filter((row) => !row.benchmarkMeta.closable).length === policy.benchmark.expectedBlocked,
    splitDenominators: results.filter((row) => row.split === "development").length === policy.benchmark.expectedDevelopment && results.filter((row) => row.split === "validation").length === policy.benchmark.expectedValidation && frozen.length === policy.benchmark.expectedFrozen,
    mutationDenominator: mutations.length === policy.benchmark.expectedMutations,
    frozenClosureAccuracy: ratio(correct, frozen.length) >= policy.thresholds.minimumFrozenClosureAccuracy,
    frozenUnsafeClosureSuppression: ratio(blockedCorrect, blockedRows.length) >= policy.thresholds.minimumFrozenUnsafeClosureSuppression,
    mutationKillRate: ratio(mutationKilled, mutations.length) >= policy.thresholds.minimumMutationKillRate,
    unsafeClosures: unsafeClosures <= policy.thresholds.maximumUnsafeClosures,
    falseBlocks: falseBlocks <= policy.thresholds.maximumFalseBlocksOnClosableCases
  };
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([id]) => id);
  const core = {
    schemaVersion: A23_BENCHMARK_SCHEMA, passId: policy.passId, sourceRevisionId: policy.sourceRevisionId, evaluatedAt: "2026-07-23T23:23:00.000+02:00",
    denominators: { families: policy.benchmark.families.length, cases: cases.length, closable: cases.filter((row) => row.benchmarkMeta.closable).length, blocked: cases.filter((row) => !row.benchmarkMeta.closable).length, development: results.filter((row) => row.split === "development").length, validation: results.filter((row) => row.split === "validation").length, frozen: frozen.length, mutations: mutations.length },
    frozen: { closureAccuracy: round(ratio(correct, frozen.length)), closureWilson95: wilson(correct, frozen.length), unsafeClosureSuppression: round(ratio(blockedCorrect, blockedRows.length)), suppressionWilson95: wilson(blockedCorrect, blockedRows.length), unsafeClosures, falseBlocks },
    mutation: { killed: mutationKilled, total: mutations.length, killRate: round(ratio(mutationKilled, mutations.length)), wilson95: wilson(mutationKilled, mutations.length) },
    gates, failedGates, localRemediationClosureBenchmarkPass: failedGates.length === 0,
    paidGateEligible: false, signedClosureClaimed: false, realFixClaimed: false, independentRetestClaimed: false, customerValueProven: false, liveClaimed: false,
    results, mutations, truthBoundary: policy.truthBoundary
  };
  return { ...core, integritySha256: sha256(core) };
}

export function verifyA23Benchmark(benchmark, policy) {
  if (!benchmark || benchmark.schemaVersion !== A23_BENCHMARK_SCHEMA || !verifyA23Policy(policy)) return false;
  const copy = { ...benchmark }; delete copy.integritySha256;
  if (sha256(copy) !== benchmark.integritySha256) return false;
  if (benchmark.denominators.cases !== policy.benchmark.expectedCases || benchmark.denominators.mutations !== policy.benchmark.expectedMutations) return false;
  if (benchmark.paidGateEligible !== false || benchmark.signedClosureClaimed !== false || benchmark.realFixClaimed !== false || benchmark.independentRetestClaimed !== false) return false;
  return benchmark.localRemediationClosureBenchmarkPass === (benchmark.failedGates.length === 0);
}
