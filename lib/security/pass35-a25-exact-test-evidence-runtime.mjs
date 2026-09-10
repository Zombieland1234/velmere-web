import { createHash } from "node:crypto";

export const A25_INPUT_SCHEMA = "velmere.pass35.a25-exact-test-evidence-input.v1";
export const A25_REPORT_SCHEMA = "velmere.pass35.a25-exact-test-evidence-report.v1";
export const A25_BENCHMARK_SCHEMA = "velmere.pass35.a25-exact-test-evidence-benchmark.v1";
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/u;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/u;
const ID_RE = /^[A-Z0-9][A-Z0-9_-]{2,95}$/u;
const CRITICALITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const OUTCOMES = new Set(["SUCCESS", "REVERT"]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function digest(value) { return `sha256:${sha256(value)}`; }
function clone(value) { return structuredClone(value); }
function ratio(n, d) { return d === 0 ? 1 : Number((n / d).toFixed(6)); }
function uniq(values) { return [...new Set(values)]; }
function validDigest(value) { return DIGEST_RE.test(String(value ?? "")); }
function validId(value) { return ID_RE.test(String(value ?? "")); }
function wilson(successes, total) {
  if (!total) return { lower: 0, upper: 0 };
  const z = 1.959963984540054;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return { lower: Number(Math.max(0, center - margin).toFixed(6)), upper: Number(Math.min(1, center + margin).toFixed(6)) };
}

export function verifyA25Policy(policy) {
  return Boolean(policy
    && policy.schemaVersion === "velmere.pass35.a25-exact-test-evidence-policy.v1"
    && policy.passId === "PASS35_A25"
    && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy.sourceRevisionId ?? ""))
    && Array.isArray(policy.allowedInputClasses)
    && policy.allowedInputClasses.includes("SYNTHETIC_OFFLINE")
    && policy.benchmark?.families?.length === 12
    && policy.benchmark?.mutationTypes?.length === 12
    && policy.benchmark.expectedCases === 192
    && policy.benchmark.expectedFrozen === 72
    && policy.benchmark.expectedMutations === 2304
    && policy.thresholds?.criticalBehaviorCoverage === 1
    && policy.thresholds?.highBehaviorCoverage === 1
    && policy.thresholds?.branchCoverage === 0.9
    && policy.thresholds?.stateTransitionCoverage === 0.9
    && policy.thresholds?.mutationKillRate === 0.95);
}

function validateInput(input, policy, blockers) {
  if (!input || input.schemaVersion !== A25_INPUT_SCHEMA) blockers.push("a25_schema_invalid");
  if (!policy.allowedInputClasses.includes(input?.inputClass)) blockers.push("a25_input_class_not_local");
  if (!validId(input?.caseRef)) blockers.push("a25_case_ref_invalid");
  if (!input?.target || !/^[0-9]+$/u.test(String(input.target.chainId ?? "")) || !ADDRESS_RE.test(String(input.target.contractAddress ?? ""))) blockers.push("a25_target_identity_invalid");
  for (const key of ["runtimeBytecodeSha256", "sourceBundleSha256", "compilerReceiptSha256", "behaviorRegistrySha256"]) if (!validDigest(input?.target?.[key])) blockers.push(`a25_target_digest_invalid:${key}`);
  if (!input?.runner || !validId(input.runner.familyId) || !validDigest(input.runner.executableSha256) || !validDigest(input.runner.versionOutputSha256) || !validDigest(input.runner.configSha256) || !validDigest(input.runner.rawOutputSha256)) blockers.push("a25_runner_binding_invalid");
  if (!Array.isArray(input?.behaviors) || input.behaviors.length === 0) blockers.push("a25_behavior_registry_empty");
  if (!Array.isArray(input?.executions) || input.executions.length === 0) blockers.push("a25_execution_registry_empty");
  if (!Array.isArray(input?.mutations) || input.mutations.length === 0) blockers.push("a25_mutation_registry_empty");
  if (!validDigest(input?.baselineStateRootSha256)) blockers.push("a25_baseline_state_root_invalid");
}

function behaviorValidity(behavior, blockers) {
  if (!validId(behavior?.behaviorId) || !validId(behavior?.componentId) || !CRITICALITIES.has(behavior?.criticality) || !OUTCOMES.has(behavior?.expectedOutcome)) blockers.push(`a25_behavior_invalid:${behavior?.behaviorId ?? "unknown"}`);
  if (!Array.isArray(behavior?.requiredAssertions) || behavior.requiredAssertions.length === 0 || behavior.requiredAssertions.some((id) => !validId(id))) blockers.push(`a25_required_assertions_invalid:${behavior?.behaviorId ?? "unknown"}`);
  if (!Array.isArray(behavior?.branchIds) || behavior.branchIds.length === 0 || behavior.branchIds.some((id) => !validId(id))) blockers.push(`a25_branch_registry_invalid:${behavior?.behaviorId ?? "unknown"}`);
  if (!Array.isArray(behavior?.stateTransitionIds) || behavior.stateTransitionIds.length === 0 || behavior.stateTransitionIds.some((id) => !validId(id))) blockers.push(`a25_transition_registry_invalid:${behavior?.behaviorId ?? "unknown"}`);
  if (behavior.expectedOutcome === "REVERT" && !/^0x[0-9a-fA-F]{8}$/u.test(String(behavior.expectedRevertSelector ?? ""))) blockers.push(`a25_revert_selector_invalid:${behavior?.behaviorId ?? "unknown"}`);
}

export function analyzeA25ExactTestEvidence(input, policy) {
  const blockers = [];
  if (!verifyA25Policy(policy)) blockers.push("a25_policy_invalid");
  validateInput(input, policy, blockers);
  const behaviors = Array.isArray(input?.behaviors) ? input.behaviors : [];
  const executions = Array.isArray(input?.executions) ? input.executions : [];
  const mutations = Array.isArray(input?.mutations) ? input.mutations : [];
  for (const behavior of behaviors) behaviorValidity(behavior, blockers);
  const behaviorIds = behaviors.map((row) => row.behaviorId);
  if (new Set(behaviorIds).size !== behaviorIds.length) blockers.push("a25_duplicate_behavior_id");
  const executionIds = executions.map((row) => row.testId);
  if (new Set(executionIds).size !== executionIds.length) blockers.push("a25_duplicate_test_id");
  const behaviorMap = new Map(behaviors.map((row) => [row.behaviorId, row]));
  const executionsByBehavior = new Map();
  const coveredBranches = new Set();
  const coveredTransitions = new Set();
  let flakyTests = 0;
  for (const execution of executions) {
    if (!validId(execution?.testId) || !behaviorMap.has(execution?.behaviorId)) { blockers.push(`a25_execution_identity_invalid:${execution?.testId ?? "unknown"}`); continue; }
    const behavior = behaviorMap.get(execution.behaviorId);
    if (!validDigest(execution.targetRuntimeBytecodeSha256) || execution.targetRuntimeBytecodeSha256 !== input?.target?.runtimeBytecodeSha256) blockers.push(`a25_execution_target_mismatch:${execution.testId}`);
    if (!validDigest(execution.runnerRawOutputSha256) || execution.runnerRawOutputSha256 !== input?.runner?.rawOutputSha256) blockers.push(`a25_execution_runner_mismatch:${execution.testId}`);
    if (!validDigest(execution.beforeStateRootSha256) || !validDigest(execution.afterStateRootSha256) || !validDigest(execution.resetReceiptSha256) || !validDigest(execution.executionReceiptSha256)) blockers.push(`a25_execution_receipt_invalid:${execution.testId}`);
    if (policy.thresholds.requireIsolatedBaselineState && execution.beforeStateRootSha256 !== input?.baselineStateRootSha256) blockers.push(`a25_test_isolation_failed:${execution.testId}`);
    if (execution.passed !== true) blockers.push(`a25_test_failed:${execution.testId}`);
    if (behavior.expectedOutcome === "SUCCESS" && execution.reverted === true) blockers.push(`a25_unexpected_revert:${execution.testId}`);
    if (behavior.expectedOutcome === "REVERT" && (execution.reverted !== true || execution.revertSelector !== behavior.expectedRevertSelector)) blockers.push(`a25_expected_revert_not_proven:${execution.testId}`);
    const assertionResults = new Map((execution.assertionResults ?? []).map((row) => [row.assertionId, row.status]));
    for (const assertionId of behavior.requiredAssertions ?? []) if (assertionResults.get(assertionId) !== "PASS") blockers.push(`a25_required_assertion_missing_or_failed:${execution.testId}:${assertionId}`);
    for (const branchId of execution.coveredBranchIds ?? []) coveredBranches.add(branchId);
    for (const transitionId of execution.coveredStateTransitionIds ?? []) coveredTransitions.add(transitionId);
    const repeatDigests = execution.repeatResultSha256s ?? [];
    if (!Array.isArray(repeatDigests) || repeatDigests.length < 2 || repeatDigests.some((value) => !validDigest(value)) || new Set(repeatDigests).size !== 1) { flakyTests += 1; blockers.push(`a25_flaky_or_unrepeated_test:${execution.testId}`); }
    const list = executionsByBehavior.get(execution.behaviorId) ?? []; list.push(execution); executionsByBehavior.set(execution.behaviorId, list);
  }
  const coverageByCriticality = {};
  for (const criticality of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const declared = behaviors.filter((row) => row.criticality === criticality);
    const covered = declared.filter((row) => (executionsByBehavior.get(row.behaviorId) ?? []).some((execution) => execution.passed === true)).length;
    coverageByCriticality[criticality] = { declared: declared.length, covered, ratio: ratio(covered, declared.length) };
  }
  if (coverageByCriticality.CRITICAL.ratio < policy.thresholds.criticalBehaviorCoverage) blockers.push("a25_critical_behavior_coverage_below_floor");
  if (coverageByCriticality.HIGH.ratio < policy.thresholds.highBehaviorCoverage) blockers.push("a25_high_behavior_coverage_below_floor");
  if (coverageByCriticality.MEDIUM.ratio < policy.thresholds.mediumBehaviorCoverage) blockers.push("a25_medium_behavior_coverage_below_floor");
  const declaredBranches = uniq(behaviors.flatMap((row) => row.branchIds ?? []));
  const declaredTransitions = uniq(behaviors.flatMap((row) => row.stateTransitionIds ?? []));
  const branchCoverage = ratio(declaredBranches.filter((id) => coveredBranches.has(id)).length, declaredBranches.length);
  const stateTransitionCoverage = ratio(declaredTransitions.filter((id) => coveredTransitions.has(id)).length, declaredTransitions.length);
  if (branchCoverage < policy.thresholds.branchCoverage) blockers.push("a25_branch_coverage_below_floor");
  if (stateTransitionCoverage < policy.thresholds.stateTransitionCoverage) blockers.push("a25_state_transition_coverage_below_floor");
  const mutationIds = mutations.map((row) => row.mutationId);
  if (new Set(mutationIds).size !== mutationIds.length) blockers.push("a25_duplicate_mutation_id");
  for (const row of mutations) if (!validId(row?.mutationId) || !behaviorMap.has(row?.targetBehaviorId) || typeof row?.killed !== "boolean" || !validDigest(row?.receiptSha256)) blockers.push(`a25_mutation_row_invalid:${row?.mutationId ?? "unknown"}`);
  const killed = mutations.filter((row) => row.killed === true).length;
  const mutationKillRate = ratio(killed, mutations.length);
  if (mutationKillRate < policy.thresholds.mutationKillRate) blockers.push("a25_mutation_score_below_floor");
  if (flakyTests > policy.thresholds.maxFlakyTests) blockers.push("a25_flaky_test_budget_exceeded");
  const uniqueBlockers = uniq(blockers).sort();
  const core = {
    schemaVersion: A25_REPORT_SCHEMA,
    passId: "PASS35_A25",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    status: uniqueBlockers.length === 0 ? "VERIFIED_LOCAL_EXACT_TEST_EVIDENCE" : "BLOCKED_LOCAL_EXACT_TEST_EVIDENCE",
    behaviorCount: behaviors.length,
    executionCount: executions.length,
    mutationCount: mutations.length,
    coverageByCriticality,
    branchCoverage,
    stateTransitionCoverage,
    mutation: { killed, total: mutations.length, killRate: mutationKillRate },
    flakyTests,
    blockers: uniqueBlockers,
    closureEligibleLocal: uniqueBlockers.length === 0,
    officialForgeExecuted: false,
    compiledEvmExecutionProven: false,
    realCustomerCase: false,
    independentRerun: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, reportSha256: digest(core) };
}

function baseBehavior(index, overrides = {}) {
  const id = String(index).padStart(2, "0");
  return {
    behaviorId: `BEHAVIOR_${id}`,
    componentId: `COMPONENT_${id}`,
    criticality: index === 0 ? "CRITICAL" : index === 1 ? "HIGH" : "MEDIUM",
    expectedOutcome: index === 1 ? "REVERT" : "SUCCESS",
    expectedRevertSelector: index === 1 ? "0x08c379a0" : null,
    requiredAssertions: [`ASSERT_${id}_A`, `ASSERT_${id}_B`],
    branchIds: [`BRANCH_${id}_A`, `BRANCH_${id}_B`],
    stateTransitionIds: [`TRANSITION_${id}_A`, `TRANSITION_${id}_B`],
    ...overrides
  };
}
function executionFor(behavior, targetDigest, runnerDigest, baselineDigest, index) {
  const id = String(index).padStart(2, "0");
  const repeat = `sha256:${String(index + 7).padStart(64, "0").slice(-64)}`;
  return {
    testId: `TEST_${id}`,
    behaviorId: behavior.behaviorId,
    targetRuntimeBytecodeSha256: targetDigest,
    runnerRawOutputSha256: runnerDigest,
    beforeStateRootSha256: baselineDigest,
    afterStateRootSha256: `sha256:${String(index + 20).padStart(64, "0").slice(-64)}`,
    resetReceiptSha256: `sha256:${String(index + 40).padStart(64, "0").slice(-64)}`,
    executionReceiptSha256: `sha256:${String(index + 60).padStart(64, "0").slice(-64)}`,
    passed: true,
    reverted: behavior.expectedOutcome === "REVERT",
    revertSelector: behavior.expectedOutcome === "REVERT" ? behavior.expectedRevertSelector : null,
    assertionResults: behavior.requiredAssertions.map((assertionId) => ({ assertionId, status: "PASS" })),
    coveredBranchIds: [...behavior.branchIds],
    coveredStateTransitionIds: [...behavior.stateTransitionIds],
    repeatResultSha256s: [repeat, repeat]
  };
}
function makeValidInput(family, index) {
  const familyToken = family.replaceAll("_", "-");
  const targetDigest = `sha256:${"a".repeat(64)}`;
  const runnerDigest = `sha256:${"b".repeat(64)}`;
  const baselineDigest = `sha256:${"c".repeat(64)}`;
  const behaviors = [baseBehavior(0), baseBehavior(1), baseBehavior(2)];
  const executions = behaviors.map((behavior, executionIndex) => executionFor(behavior, targetDigest, runnerDigest, baselineDigest, executionIndex));
  const mutations = Array.from({ length: 20 }, (_, mutationIndex) => ({ mutationId: `MUTATION_${String(mutationIndex).padStart(2, "0")}`, targetBehaviorId: behaviors[mutationIndex % behaviors.length].behaviorId, killed: mutationIndex < 19, receiptSha256: `sha256:${String(mutationIndex + 100).padStart(64, "0").slice(-64)}` }));
  return {
    schemaVersion: A25_INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef: `AUD-A25-${familyToken}-${String(index).padStart(2, "0")}`,
    target: { chainId: "1", contractAddress: "0x1111111111111111111111111111111111111111", runtimeBytecodeSha256: targetDigest, sourceBundleSha256: `sha256:${"d".repeat(64)}`, compilerReceiptSha256: `sha256:${"e".repeat(64)}`, behaviorRegistrySha256: `sha256:${"f".repeat(64)}` },
    runner: { familyId: "LOCAL_EXACT_TEST_RUNNER", executableSha256: `sha256:${"1".repeat(64)}`, versionOutputSha256: `sha256:${"2".repeat(64)}`, configSha256: `sha256:${"3".repeat(64)}`, rawOutputSha256: runnerDigest },
    baselineStateRootSha256: baselineDigest,
    behaviors,
    executions,
    mutations
  };
}
function applyFamilyDefect(input, family) {
  const out = clone(input);
  switch (family) {
    case "CRITICAL_SUCCESS_BEHAVIOR": out.executions = out.executions.filter((row) => row.behaviorId !== "BEHAVIOR_00"); break;
    case "CRITICAL_REVERT_BEHAVIOR": out.executions.find((row) => row.behaviorId === "BEHAVIOR_01").reverted = false; break;
    case "EVENT_ASSERTION": out.executions[0].assertionResults = out.executions[0].assertionResults.slice(0, 1); break;
    case "STATE_DIFF_ASSERTION": out.executions[2].assertionResults[1].status = "FAIL"; break;
    case "BRANCH_COVERAGE": out.executions.forEach((row) => { row.coveredBranchIds = []; }); break;
    case "STATE_TRANSITION_COVERAGE": out.executions.forEach((row) => { row.coveredStateTransitionIds = []; }); break;
    case "TEST_ISOLATION": out.executions[0].beforeStateRootSha256 = `sha256:${"9".repeat(64)}`; break;
    case "MUTATION_SCORE": out.mutations.forEach((row, i) => { row.killed = i < 10; }); break;
    case "FLAKINESS_REPEAT": out.executions[0].repeatResultSha256s[1] = `sha256:${"8".repeat(64)}`; break;
    case "TARGET_BINDING": out.executions[0].targetRuntimeBytecodeSha256 = `sha256:${"7".repeat(64)}`; break;
    case "RUNNER_BINDING": out.executions[0].runnerRawOutputSha256 = `sha256:${"6".repeat(64)}`; break;
    case "BEHAVIOR_REGISTRY_COMPLETENESS": out.behaviors.push(clone(out.behaviors[0])); break;
    default: throw new Error(`a25_unknown_family:${family}`);
  }
  return out;
}
function mutateValid(input, type) {
  const out = clone(input);
  switch (type) {
    case "schema_invalid": out.schemaVersion = "bad"; break;
    case "input_class_relabel": out.inputClass = "CUSTOMER_VERIFIED"; break;
    case "target_digest_invalid": out.target.runtimeBytecodeSha256 = "bad"; break;
    case "duplicate_behavior": out.behaviors.push(clone(out.behaviors[0])); break;
    case "missing_critical_execution": out.executions = out.executions.filter((row) => row.behaviorId !== "BEHAVIOR_00"); break;
    case "failed_execution": out.executions[0].passed = false; break;
    case "missing_required_assertion": out.executions[0].assertionResults = []; break;
    case "branch_coverage_drop": out.executions.forEach((row) => { row.coveredBranchIds = []; }); break;
    case "transition_coverage_drop": out.executions.forEach((row) => { row.coveredStateTransitionIds = []; }); break;
    case "isolation_break": out.executions[0].beforeStateRootSha256 = `sha256:${"9".repeat(64)}`; break;
    case "mutation_score_drop": out.mutations.forEach((row, i) => { row.killed = i < 5; }); break;
    case "flaky_repeat": out.executions[0].repeatResultSha256s[1] = `sha256:${"8".repeat(64)}`; break;
    default: throw new Error(`a25_unknown_mutation:${type}`);
  }
  return out;
}

export function runA25Benchmark(policy) {
  if (!verifyA25Policy(policy)) throw new Error("a25_policy_invalid");
  const rows = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const valid = index % 2 === 0;
      const input = valid ? makeValidInput(family, index) : applyFamilyDefect(makeValidInput(family, index), family);
      const report = analyzeA25ExactTestEvidence(input, policy);
      rows.push({ family, index, frozen: index >= 10, expectedEligible: valid, actualEligible: report.closureEligibleLocal, passed: valid === report.closureEligibleLocal, blockers: report.blockers, reportSha256: report.reportSha256 });
    }
  }
  const mutations = [];
  for (const [rowIndex, row] of rows.entries()) {
    const base = makeValidInput(row.family, row.index);
    for (const type of policy.benchmark.mutationTypes) {
      const report = analyzeA25ExactTestEvidence(mutateValid(base, type), policy);
      mutations.push({ rowIndex, family: row.family, type, killed: !report.closureEligibleLocal, reportSha256: report.reportSha256 });
    }
  }
  const frozen = rows.filter((row) => row.frozen);
  const correct = frozen.filter((row) => row.passed).length;
  const unsafeEligible = frozen.filter((row) => !row.expectedEligible && row.actualEligible).length;
  const falseBlocks = frozen.filter((row) => row.expectedEligible && !row.actualEligible).length;
  const killed = mutations.filter((row) => row.killed).length;
  const core = {
    schemaVersion: A25_BENCHMARK_SCHEMA,
    passId: "PASS35_A25",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: rows.length, frozen: frozen.length, mutations: mutations.length, families: policy.benchmark.families.length },
    frozen: { correct, accuracy: ratio(correct, frozen.length), unsafeEligible, falseBlocks, wilson95: wilson(correct, frozen.length) },
    mutation: { total: mutations.length, killed, survived: mutations.length - killed, killRate: ratio(killed, mutations.length) },
    rows,
    mutations,
    localOnly: true,
    officialForgeExecuted: false,
    compiledEvmExecutionProven: false,
    realCustomerCase: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, integritySha256: digest(core) };
}

export function verifyA25Report(report) {
  if (!report || report.schemaVersion !== A25_REPORT_SCHEMA || !validDigest(report.reportSha256)) return false;
  const { reportSha256, ...core } = report;
  return digest(core) === reportSha256 && report.officialForgeExecuted === false && report.compiledEvmExecutionProven === false && report.paidGateEligible === false && report.sellEnabled === false;
}
export function verifyA25Benchmark(report, policy) {
  if (!report || report.schemaVersion !== A25_BENCHMARK_SCHEMA || !verifyA25Policy(policy)) return false;
  const { integritySha256, ...core } = report;
  return digest(core) === integritySha256
    && report.denominators.cases === policy.benchmark.expectedCases
    && report.denominators.frozen === policy.benchmark.expectedFrozen
    && report.denominators.mutations === policy.benchmark.expectedMutations
    && report.frozen.accuracy === 1
    && report.frozen.unsafeEligible === 0
    && report.frozen.falseBlocks === 0
    && report.mutation.killRate === 1
    && report.officialForgeExecuted === false
    && report.paidGateEligible === false;
}
