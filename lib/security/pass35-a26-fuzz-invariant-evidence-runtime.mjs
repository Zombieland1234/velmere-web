import { createHash } from "node:crypto";

export const A26_INPUT_SCHEMA = "velmere.pass35.a26-fuzz-invariant-evidence-input.v1";
export const A26_REPORT_SCHEMA = "velmere.pass35.a26-fuzz-invariant-evidence-report.v1";
export const A26_BENCHMARK_SCHEMA = "velmere.pass35.a26-fuzz-invariant-evidence-benchmark.v1";
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/u;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/u;
const ID_RE = /^[A-Z0-9][A-Z0-9_-]{2,95}$/u;
const CRITICALITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function digest(value) { return `sha256:${sha256(value)}`; }
function clone(value) { return structuredClone(value); }
function ratio(n, d) { return d === 0 ? 1 : Number((n / d).toFixed(6)); }
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

export function verifyA26Policy(policy) {
  return Boolean(policy
    && policy.schemaVersion === "velmere.pass35.a26-fuzz-invariant-evidence-policy.v1"
    && policy.passId === "PASS35_A26"
    && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy.sourceRevisionId ?? ""))
    && policy.benchmark?.families?.length === 12
    && policy.benchmark?.mutationTypes?.length === 12
    && policy.benchmark.expectedCases === 192
    && policy.benchmark.expectedFrozen === 72
    && policy.benchmark.expectedMutations === 2304
    && policy.thresholds?.criticalInvariantCoverage === 1
    && policy.thresholds?.highInvariantCoverage === 1
    && policy.thresholds?.stateKeyCoverage === 0.9
    && policy.thresholds?.minimumDistinctSeeds === 8
    && policy.thresholds?.minimumCampaignRuns === 8
    && policy.thresholds?.mutationKillRate === 0.95
    && policy.thresholds?.maximumShrinkRatio === 0.5
    && policy.thresholds?.minimumReplayDeterminism === 1);
}

function validateInput(input, policy, blockers) {
  if (!input || input.schemaVersion !== A26_INPUT_SCHEMA) blockers.push("a26_schema_invalid");
  if (!policy.allowedInputClasses.includes(input?.inputClass)) blockers.push("a26_input_class_not_local");
  if (!validId(input?.caseRef)) blockers.push("a26_case_ref_invalid");
  if (!input?.target || !/^[0-9]+$/u.test(String(input.target.chainId ?? "")) || !ADDRESS_RE.test(String(input.target.contractAddress ?? ""))) blockers.push("a26_target_identity_invalid");
  for (const key of ["runtimeBytecodeSha256", "sourceBundleSha256", "compilerReceiptSha256", "invariantRegistrySha256", "modelBindingSha256"]) if (!validDigest(input?.target?.[key])) blockers.push(`a26_target_digest_invalid:${key}`);
  if (!input?.runner || !validId(input.runner.familyId) || !validDigest(input.runner.executableSha256) || !validDigest(input.runner.versionOutputSha256) || !validDigest(input.runner.configSha256) || !validDigest(input.runner.rawOutputSha256)) blockers.push("a26_runner_binding_invalid");
  if (!input?.campaign || !validDigest(input.campaign.corpusSha256) || !validDigest(input.campaign.campaignConfigSha256) || !validDigest(input.campaign.shrinkerVersionSha256)) blockers.push("a26_campaign_binding_invalid");
  if (!Array.isArray(input?.invariants) || input.invariants.length === 0) blockers.push("a26_invariant_registry_empty");
  if (!Array.isArray(input?.runs) || input.runs.length === 0) blockers.push("a26_run_registry_empty");
  if (!Array.isArray(input?.mutations) || input.mutations.length === 0) blockers.push("a26_mutation_registry_empty");
}

function invariantValidity(invariant, blockers) {
  if (!validId(invariant?.invariantId) || !validId(invariant?.componentId) || !CRITICALITIES.has(invariant?.criticality) || !validDigest(invariant?.propertySha256)) blockers.push(`a26_invariant_invalid:${invariant?.invariantId ?? "unknown"}`);
  if (!Array.isArray(invariant?.requiredStateKeys) || invariant.requiredStateKeys.length === 0 || invariant.requiredStateKeys.some((id) => !validId(id))) blockers.push(`a26_state_key_registry_invalid:${invariant?.invariantId ?? "unknown"}`);
}

export function analyzeA26FuzzInvariantEvidence(input, policy) {
  const blockers = [];
  if (!verifyA26Policy(policy)) blockers.push("a26_policy_invalid");
  validateInput(input, policy, blockers);
  const invariants = Array.isArray(input?.invariants) ? input.invariants : [];
  const runs = Array.isArray(input?.runs) ? input.runs : [];
  const mutations = Array.isArray(input?.mutations) ? input.mutations : [];
  for (const invariant of invariants) invariantValidity(invariant, blockers);
  const invariantIds = invariants.map((row) => row.invariantId);
  if (new Set(invariantIds).size !== invariantIds.length) blockers.push("a26_duplicate_invariant_id");
  const invariantMap = new Map(invariants.map((row) => [row.invariantId, row]));
  const coveredInvariants = new Set();
  const coveredStateKeys = new Set();
  const seeds = new Set();
  let deterministicReplays = 0;
  let flakyRuns = 0;
  for (const run of runs) {
    if (!validId(run?.runId) || !validDigest(run?.seedSha256) || !validDigest(run?.traceSha256) || !validDigest(run?.repeatTraceSha256) || !validDigest(run?.finalStateSha256) || !validDigest(run?.corpusSha256) || !validDigest(run?.targetRuntimeBytecodeSha256) || !validDigest(run?.runnerRawOutputSha256)) { blockers.push(`a26_run_binding_invalid:${run?.runId ?? "unknown"}`); continue; }
    if (run.corpusSha256 !== input?.campaign?.corpusSha256) blockers.push(`a26_run_corpus_mismatch:${run.runId}`);
    if (run.targetRuntimeBytecodeSha256 !== input?.target?.runtimeBytecodeSha256) blockers.push(`a26_run_target_mismatch:${run.runId}`);
    if (run.runnerRawOutputSha256 !== input?.runner?.rawOutputSha256) blockers.push(`a26_run_runner_mismatch:${run.runId}`);
    if (!Number.isInteger(run.sequenceLength) || run.sequenceLength < 1 || run.sequenceLength > 100000) blockers.push(`a26_sequence_length_invalid:${run.runId}`);
    seeds.add(run.seedSha256);
    for (const invariantId of run.coveredInvariantIds ?? []) {
      if (!invariantMap.has(invariantId)) blockers.push(`a26_unknown_covered_invariant:${run.runId}:${invariantId}`);
      else coveredInvariants.add(invariantId);
    }
    for (const stateKey of run.coveredStateKeys ?? []) coveredStateKeys.add(stateKey);
    if ((run.failedInvariantIds ?? []).some((id) => invariantMap.has(id))) blockers.push(`a26_reference_invariant_failure:${run.runId}`);
    if (run.traceSha256 === run.repeatTraceSha256) deterministicReplays += 1;
    else { flakyRuns += 1; blockers.push(`a26_replay_nondeterministic:${run.runId}`); }
  }
  if (runs.length < policy.thresholds.minimumCampaignRuns) blockers.push("a26_campaign_run_count_below_floor");
  if (seeds.size < policy.thresholds.minimumDistinctSeeds) blockers.push("a26_seed_diversity_below_floor");
  const coverageByCriticality = {};
  for (const criticality of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const declared = invariants.filter((row) => row.criticality === criticality);
    const covered = declared.filter((row) => coveredInvariants.has(row.invariantId)).length;
    coverageByCriticality[criticality] = { declared: declared.length, covered, ratio: ratio(covered, declared.length) };
  }
  if (coverageByCriticality.CRITICAL.ratio < policy.thresholds.criticalInvariantCoverage) blockers.push("a26_critical_invariant_coverage_below_floor");
  if (coverageByCriticality.HIGH.ratio < policy.thresholds.highInvariantCoverage) blockers.push("a26_high_invariant_coverage_below_floor");
  if (coverageByCriticality.MEDIUM.ratio < policy.thresholds.mediumInvariantCoverage) blockers.push("a26_medium_invariant_coverage_below_floor");
  const declaredStateKeys = new Set(invariants.flatMap((row) => row.requiredStateKeys ?? []));
  const stateKeyCoverage = ratio([...declaredStateKeys].filter((key) => coveredStateKeys.has(key)).length, declaredStateKeys.size);
  if (stateKeyCoverage < policy.thresholds.stateKeyCoverage) blockers.push("a26_state_key_coverage_below_floor");
  const replayDeterminism = ratio(deterministicReplays, runs.length);
  if (replayDeterminism < policy.thresholds.minimumReplayDeterminism || flakyRuns > policy.thresholds.maxFlakyRuns) blockers.push("a26_replay_determinism_below_floor");
  const mutationIds = mutations.map((row) => row.mutationId);
  if (new Set(mutationIds).size !== mutationIds.length) blockers.push("a26_duplicate_mutation_id");
  let killed = 0;
  let shrinkQualified = 0;
  for (const mutation of mutations) {
    if (!validId(mutation?.mutationId) || !invariantMap.has(mutation?.targetInvariantId) || !validDigest(mutation?.counterexampleReceiptSha256) || !validDigest(mutation?.replayReceiptSha256)) { blockers.push(`a26_mutation_invalid:${mutation?.mutationId ?? "unknown"}`); continue; }
    if (mutation.killed === true) killed += 1;
    if (!Number.isInteger(mutation.originalSteps) || !Number.isInteger(mutation.minimizedSteps) || mutation.originalSteps < 1 || mutation.minimizedSteps < 1 || mutation.minimizedSteps > mutation.originalSteps) blockers.push(`a26_shrink_steps_invalid:${mutation.mutationId}`);
    const shrinkRatio = ratio(mutation.minimizedSteps, mutation.originalSteps);
    if (mutation.killed === true && mutation.replayDeterministic === true && shrinkRatio <= policy.thresholds.maximumShrinkRatio) shrinkQualified += 1;
    else if (mutation.killed === true) blockers.push(`a26_counterexample_not_minimized_or_replayable:${mutation.mutationId}`);
  }
  const mutationKillRate = ratio(killed, mutations.length);
  if (mutationKillRate < policy.thresholds.mutationKillRate) blockers.push("a26_mutation_kill_rate_below_floor");
  if (shrinkQualified < killed) blockers.push("a26_shrink_qualification_incomplete");
  const localEligible = blockers.length === 0;
  const core = {
    schemaVersion: A26_REPORT_SCHEMA,
    passId: "PASS35_A26",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    status: localEligible ? "VERIFIED_LOCAL_FUZZ_INVARIANT_EVIDENCE" : "BLOCKED_LOCAL_FUZZ_INVARIANT_EVIDENCE",
    blockers: [...new Set(blockers)].sort(),
    invariantCount: invariants.length,
    runCount: runs.length,
    distinctSeedCount: seeds.size,
    coverageByCriticality,
    stateKeyCoverage,
    replayDeterminism,
    flakyRuns,
    mutation: { total: mutations.length, killed, killRate: mutationKillRate, shrinkQualified },
    localEligibility: localEligible,
    officialFoundryExecuted: false,
    officialEchidnaExecuted: false,
    compiledEvmExecutionProven: false,
    implementationModelEquivalenceProven: false,
    realCustomerCase: false,
    independentAdjudication: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, reportSha256: digest(core) };
}

function invariant(index, overrides = {}) {
  const id = String(index).padStart(2, "0");
  return { invariantId: `INVARIANT_${id}`, componentId: `COMPONENT_${id}`, criticality: index === 0 ? "CRITICAL" : index === 1 ? "HIGH" : "MEDIUM", requiredStateKeys: [`STATE_${id}_A`, `STATE_${id}_B`], propertySha256: `sha256:${String(index + 1).padStart(64, "0")}`, ...overrides };
}
function validInput(family, index) {
  const familyToken = family.replaceAll("_", "-");
  const target = `sha256:${"a".repeat(64)}`;
  const runner = `sha256:${"b".repeat(64)}`;
  const corpus = `sha256:${"c".repeat(64)}`;
  const invariants = [invariant(0), invariant(1), invariant(2)];
  const runs = Array.from({ length: 8 }, (_, runIndex) => {
    const trace = `sha256:${String(runIndex + 100).padStart(64, "0")}`;
    return { runId: `RUN_${String(runIndex).padStart(2, "0")}`, seedSha256: `sha256:${String(runIndex + 200).padStart(64, "0")}`, sequenceLength: 100 + runIndex, traceSha256: trace, repeatTraceSha256: trace, finalStateSha256: `sha256:${String(runIndex + 300).padStart(64, "0")}`, corpusSha256: corpus, targetRuntimeBytecodeSha256: target, runnerRawOutputSha256: runner, coveredInvariantIds: invariants.map((row) => row.invariantId), coveredStateKeys: invariants.flatMap((row) => row.requiredStateKeys), failedInvariantIds: [] };
  });
  const mutations = Array.from({ length: 20 }, (_, mutationIndex) => ({ mutationId: `MUTATION_${String(mutationIndex).padStart(2, "0")}`, targetInvariantId: invariants[mutationIndex % invariants.length].invariantId, killed: mutationIndex < 19, originalSteps: 100, minimizedSteps: 20, replayDeterministic: true, counterexampleReceiptSha256: `sha256:${String(mutationIndex + 400).padStart(64, "0")}`, replayReceiptSha256: `sha256:${String(mutationIndex + 500).padStart(64, "0")}` }));
  return { schemaVersion: A26_INPUT_SCHEMA, inputClass: "GENERATED_BENCHMARK", caseRef: `AUD-A26-${familyToken}-${String(index).padStart(2, "0")}`, target: { chainId: "1", contractAddress: "0x1111111111111111111111111111111111111111", runtimeBytecodeSha256: target, sourceBundleSha256: `sha256:${"d".repeat(64)}`, compilerReceiptSha256: `sha256:${"e".repeat(64)}`, invariantRegistrySha256: `sha256:${"f".repeat(64)}`, modelBindingSha256: `sha256:${"1".repeat(64)}` }, runner: { familyId: "LOCAL_MODEL_FUZZ_RUNNER", executableSha256: `sha256:${"2".repeat(64)}`, versionOutputSha256: `sha256:${"3".repeat(64)}`, configSha256: `sha256:${"4".repeat(64)}`, rawOutputSha256: runner }, campaign: { corpusSha256: corpus, campaignConfigSha256: `sha256:${"5".repeat(64)}`, shrinkerVersionSha256: `sha256:${"6".repeat(64)}` }, invariants, runs, mutations };
}
function defect(input, family) {
  const out = clone(input);
  switch (family) {
    case "CRITICAL_INVARIANT_COVERAGE": out.runs.forEach((row) => { row.coveredInvariantIds = row.coveredInvariantIds.filter((id) => id !== "INVARIANT_00"); }); break;
    case "HIGH_INVARIANT_COVERAGE": out.runs.forEach((row) => { row.coveredInvariantIds = row.coveredInvariantIds.filter((id) => id !== "INVARIANT_01"); }); break;
    case "STATE_KEY_COVERAGE": out.runs.forEach((row) => { row.coveredStateKeys = []; }); break;
    case "SEED_DIVERSITY": out.runs.forEach((row) => { row.seedSha256 = out.runs[0].seedSha256; }); break;
    case "CORPUS_BINDING": out.runs[0].corpusSha256 = `sha256:${"9".repeat(64)}`; break;
    case "TARGET_BINDING": out.runs[0].targetRuntimeBytecodeSha256 = `sha256:${"8".repeat(64)}`; break;
    case "RUNNER_BINDING": out.runs[0].runnerRawOutputSha256 = `sha256:${"7".repeat(64)}`; break;
    case "MODEL_BINDING": out.target.modelBindingSha256 = "bad"; break;
    case "TRACE_REPLAY": out.runs[0].repeatTraceSha256 = `sha256:${"6".repeat(64)}`; break;
    case "SHRINK_MINIMIZATION": out.mutations[0].minimizedSteps = 90; break;
    case "MUTATION_SCORE": out.mutations.forEach((row, i) => { row.killed = i < 10; }); break;
    case "INVARIANT_REGISTRY_COMPLETENESS": out.invariants.push(clone(out.invariants[0])); break;
    default: throw new Error(`a26_unknown_family:${family}`);
  }
  return out;
}
function mutate(input, type) {
  const out = clone(input);
  switch (type) {
    case "schema_invalid": out.schemaVersion = "bad"; break;
    case "input_class_relabel": out.inputClass = "CUSTOMER_VERIFIED"; break;
    case "target_digest_invalid": out.target.runtimeBytecodeSha256 = "bad"; break;
    case "duplicate_invariant": out.invariants.push(clone(out.invariants[0])); break;
    case "missing_critical_coverage": out.runs.forEach((row) => { row.coveredInvariantIds = row.coveredInvariantIds.filter((id) => id !== "INVARIANT_00"); }); break;
    case "state_coverage_drop": out.runs.forEach((row) => { row.coveredStateKeys = []; }); break;
    case "seed_diversity_drop": out.runs.forEach((row) => { row.seedSha256 = out.runs[0].seedSha256; }); break;
    case "corpus_binding_break": out.runs[0].corpusSha256 = `sha256:${"9".repeat(64)}`; break;
    case "runner_binding_break": out.runs[0].runnerRawOutputSha256 = `sha256:${"8".repeat(64)}`; break;
    case "replay_break": out.runs[0].repeatTraceSha256 = `sha256:${"7".repeat(64)}`; break;
    case "shrink_quality_drop": out.mutations[0].minimizedSteps = 99; break;
    case "mutation_score_drop": out.mutations.forEach((row, i) => { row.killed = i < 5; }); break;
    default: throw new Error(`a26_unknown_mutation:${type}`);
  }
  return out;
}

export function runA26Benchmark(policy) {
  if (!verifyA26Policy(policy)) throw new Error("a26_policy_invalid");
  const rows = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const input = expectedEligible ? validInput(family, index) : defect(validInput(family, index), family);
      const report = analyzeA26FuzzInvariantEvidence(input, policy);
      rows.push({ family, index, frozen: index >= 10, expectedEligible, actualEligible: report.localEligibility, passed: expectedEligible === report.localEligibility, blockers: report.blockers, reportSha256: report.reportSha256 });
    }
  }
  const mutations = [];
  for (const [rowIndex, row] of rows.entries()) {
    const base = validInput(row.family, row.index);
    for (const type of policy.benchmark.mutationTypes) {
      const report = analyzeA26FuzzInvariantEvidence(mutate(base, type), policy);
      mutations.push({ rowIndex, family: row.family, type, killed: !report.localEligibility, reportSha256: report.reportSha256 });
    }
  }
  const frozen = rows.filter((row) => row.frozen);
  const correct = frozen.filter((row) => row.passed).length;
  const unsafeEligible = frozen.filter((row) => !row.expectedEligible && row.actualEligible).length;
  const falseBlocks = frozen.filter((row) => row.expectedEligible && !row.actualEligible).length;
  const killed = mutations.filter((row) => row.killed).length;
  const core = { schemaVersion: A26_BENCHMARK_SCHEMA, passId: "PASS35_A26", sourceRevisionId: policy.sourceRevisionId, denominators: { cases: rows.length, frozen: frozen.length, mutations: mutations.length, families: policy.benchmark.families.length }, frozen: { correct, accuracy: ratio(correct, frozen.length), unsafeEligible, falseBlocks, wilson95: wilson(correct, frozen.length) }, mutation: { total: mutations.length, killed, survived: mutations.length - killed, killRate: ratio(killed, mutations.length) }, rows, mutations, localOnly: true, officialFoundryExecuted: false, officialEchidnaExecuted: false, compiledEvmExecutionProven: false, implementationModelEquivalenceProven: false, realCustomerCase: false, paidGateEligible: false, sellEnabled: false, truthBoundary: policy.truthBoundary };
  return { ...core, integritySha256: digest(core) };
}
export function verifyA26Report(report) {
  if (!report || report.schemaVersion !== A26_REPORT_SCHEMA || !validDigest(report.reportSha256)) return false;
  const { reportSha256, ...core } = report;
  return digest(core) === reportSha256 && report.officialFoundryExecuted === false && report.officialEchidnaExecuted === false && report.compiledEvmExecutionProven === false && report.paidGateEligible === false && report.sellEnabled === false;
}
export function verifyA26Benchmark(report, policy) {
  if (!report || report.schemaVersion !== A26_BENCHMARK_SCHEMA || !verifyA26Policy(policy)) return false;
  const { integritySha256, ...core } = report;
  return digest(core) === integritySha256 && report.denominators.cases === policy.benchmark.expectedCases && report.denominators.frozen === policy.benchmark.expectedFrozen && report.denominators.mutations === policy.benchmark.expectedMutations && report.frozen.accuracy === 1 && report.frozen.unsafeEligible === 0 && report.frozen.falseBlocks === 0 && report.mutation.killRate === 1 && report.officialFoundryExecuted === false && report.officialEchidnaExecuted === false && report.paidGateEligible === false;
}
