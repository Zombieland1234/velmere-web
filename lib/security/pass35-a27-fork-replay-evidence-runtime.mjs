import { createHash } from "node:crypto";

export const A27_INPUT_SCHEMA = "velmere.pass35.a27-fork-replay-evidence-input.v1";
export const A27_REPORT_SCHEMA = "velmere.pass35.a27-fork-replay-evidence-report.v1";
export const A27_BENCHMARK_SCHEMA = "velmere.pass35.a27-fork-replay-evidence-benchmark.v1";
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/u;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/u;
const ID_RE = /^[A-Z0-9][A-Z0-9_-]{2,95}$/u;
const CRITICALITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const STATUSES = new Set(["SUCCESS", "REVERT"]);

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

export function verifyA27Policy(policy) {
  return Boolean(policy
    && policy.schemaVersion === "velmere.pass35.a27-fork-replay-evidence-policy.v1"
    && policy.passId === "PASS35_A27"
    && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy.sourceRevisionId ?? ""))
    && policy.benchmark?.families?.length === 12
    && policy.benchmark?.mutationTypes?.length === 12
    && policy.benchmark.expectedCases === 192
    && policy.benchmark.expectedFrozen === 72
    && policy.benchmark.expectedMutations === 2304
    && policy.thresholds?.minimumTransactions === 4
    && policy.thresholds?.minimumReplayRuns === 8
    && policy.thresholds?.criticalAssertionCoverage === 1
    && policy.thresholds?.highAssertionCoverage === 1
    && policy.thresholds?.criticalStateKeyCoverage === 1
    && policy.thresholds?.highStateKeyCoverage === 1
    && policy.thresholds?.dependencyCoverage === 1
    && policy.thresholds?.minimumReplayDeterminism === 1
    && policy.thresholds?.mutationKillRate === 0.95);
}

function validateInput(input, policy, blockers) {
  if (!input || input.schemaVersion !== A27_INPUT_SCHEMA) blockers.push("a27_schema_invalid");
  if (!policy.allowedInputClasses.includes(input?.inputClass)) blockers.push("a27_input_class_not_local");
  if (!validId(input?.caseRef)) blockers.push("a27_case_ref_invalid");
  const target = input?.target;
  if (!target || !/^[0-9]+$/u.test(String(target.chainId ?? "")) || !Number.isInteger(target.blockNumber) || target.blockNumber < 1 || !ADDRESS_RE.test(String(target.contractAddress ?? ""))) blockers.push("a27_target_identity_invalid");
  for (const key of ["blockHashSha256", "runtimeBytecodeSha256", "sourceBundleSha256", "deploymentReceiptSha256", "providerRightsReceiptSha256"]) if (!validDigest(target?.[key])) blockers.push(`a27_target_digest_invalid:${key}`);
  const runner = input?.runner;
  if (!runner || !validId(runner.familyId) || !validDigest(runner.executableSha256) || !validDigest(runner.versionOutputSha256) || !validDigest(runner.configSha256) || !validDigest(runner.rawOutputSha256)) blockers.push("a27_runner_binding_invalid");
  const snapshot = input?.snapshot;
  if (!snapshot) blockers.push("a27_snapshot_missing");
  else for (const key of ["providerEndpointSha256", "forkConfigSha256", "snapshotReceiptSha256", "isolationReceiptSha256", "preStateRootSha256", "expectedPostStateRootSha256"]) if (!validDigest(snapshot[key])) blockers.push(`a27_snapshot_digest_invalid:${key}`);
  if (!Array.isArray(input?.assertions) || input.assertions.length === 0) blockers.push("a27_assertion_registry_empty");
  if (!Array.isArray(input?.stateKeys) || input.stateKeys.length === 0) blockers.push("a27_state_key_registry_empty");
  if (!Array.isArray(input?.dependencies) || input.dependencies.length === 0) blockers.push("a27_dependency_registry_empty");
  if (!Array.isArray(input?.transactions) || input.transactions.length < policy.thresholds.minimumTransactions) blockers.push("a27_transaction_count_below_floor");
  if (!Array.isArray(input?.replays) || input.replays.length < policy.thresholds.minimumReplayRuns) blockers.push("a27_replay_count_below_floor");
  if (!Array.isArray(input?.mutations) || input.mutations.length === 0) blockers.push("a27_mutation_registry_empty");
}

export function analyzeA27ForkReplayEvidence(input, policy) {
  const blockers = [];
  if (!verifyA27Policy(policy)) blockers.push("a27_policy_invalid");
  validateInput(input, policy, blockers);
  const assertions = Array.isArray(input?.assertions) ? input.assertions : [];
  const stateKeys = Array.isArray(input?.stateKeys) ? input.stateKeys : [];
  const dependencies = Array.isArray(input?.dependencies) ? input.dependencies : [];
  const transactions = Array.isArray(input?.transactions) ? [...input.transactions].sort((a, b) => a.sequenceIndex - b.sequenceIndex) : [];
  const replays = Array.isArray(input?.replays) ? input.replays : [];
  const mutations = Array.isArray(input?.mutations) ? input.mutations : [];

  const assertionIds = assertions.map((row) => row.assertionId);
  const stateKeyIds = stateKeys.map((row) => row.stateKeyId);
  const dependencyIds = dependencies.map((row) => row.dependencyId);
  const txIds = transactions.map((row) => row.transactionId);
  for (const [name, ids] of [["assertion", assertionIds], ["state_key", stateKeyIds], ["dependency", dependencyIds], ["transaction", txIds]]) if (new Set(ids).size !== ids.length) blockers.push(`a27_duplicate_${name}_id`);
  const assertionMap = new Map(assertions.map((row) => [row.assertionId, row]));
  const stateKeyMap = new Map(stateKeys.map((row) => [row.stateKeyId, row]));
  const dependencyMap = new Map(dependencies.map((row) => [row.dependencyId, row]));

  for (const assertion of assertions) {
    if (!validId(assertion?.assertionId) || !CRITICALITIES.has(assertion?.criticality) || !validId(assertion?.transactionId) || !validId(assertion?.assertionType) || !validDigest(assertion?.expectedDigestSha256)) blockers.push(`a27_assertion_invalid:${assertion?.assertionId ?? "unknown"}`);
  }
  for (const stateKey of stateKeys) if (!validId(stateKey?.stateKeyId) || !CRITICALITIES.has(stateKey?.criticality) || !validDigest(stateKey?.definitionSha256)) blockers.push(`a27_state_key_invalid:${stateKey?.stateKeyId ?? "unknown"}`);
  for (const dependency of dependencies) if (!validId(dependency?.dependencyId) || !ADDRESS_RE.test(String(dependency?.address ?? "")) || !validDigest(dependency?.codeSha256) || !validDigest(dependency?.stateSha256) || !validDigest(dependency?.balanceSha256)) blockers.push(`a27_dependency_invalid:${dependency?.dependencyId ?? "unknown"}`);

  const coveredAssertions = new Set();
  const coveredStateKeys = new Set();
  const coveredDependencies = new Set();
  let statusMatches = 0;
  let continuityMatches = 0;
  let previousPost = input?.snapshot?.preStateRootSha256;
  for (let index = 0; index < transactions.length; index += 1) {
    const tx = transactions[index];
    if (!validId(tx?.transactionId) || tx.sequenceIndex !== index || !validDigest(tx?.transactionHashSha256) || !ADDRESS_RE.test(String(tx?.sender ?? "")) || !ADDRESS_RE.test(String(tx?.to ?? ""))) blockers.push(`a27_transaction_identity_invalid:${tx?.transactionId ?? "unknown"}`);
    for (const key of ["calldataSha256", "returnDataSha256", "logsSha256", "stateDiffSha256", "preStateRootSha256", "postStateRootSha256", "runnerRawOutputSha256"]) if (!validDigest(tx?.[key])) blockers.push(`a27_transaction_digest_invalid:${tx?.transactionId ?? "unknown"}:${key}`);
    if (!STATUSES.has(tx?.expectedStatus) || !STATUSES.has(tx?.actualStatus) || tx.expectedStatus !== tx.actualStatus) blockers.push(`a27_transaction_status_mismatch:${tx?.transactionId ?? "unknown"}`); else statusMatches += 1;
    if (tx.runnerRawOutputSha256 !== input?.runner?.rawOutputSha256) blockers.push(`a27_transaction_runner_mismatch:${tx?.transactionId ?? "unknown"}`);
    if (tx.preStateRootSha256 !== previousPost) blockers.push(`a27_state_root_continuity_break:${tx?.transactionId ?? "unknown"}`); else continuityMatches += 1;
    previousPost = tx.postStateRootSha256;
    for (const assertionId of tx.coveredAssertionIds ?? []) {
      const assertion = assertionMap.get(assertionId);
      if (!assertion || assertion.transactionId !== tx.transactionId) blockers.push(`a27_assertion_binding_invalid:${tx.transactionId}:${assertionId}`); else coveredAssertions.add(assertionId);
    }
    for (const keyId of tx.coveredStateKeyIds ?? []) {
      if (!stateKeyMap.has(keyId)) blockers.push(`a27_unknown_state_key:${tx.transactionId}:${keyId}`); else coveredStateKeys.add(keyId);
    }
    for (const dependencyId of tx.dependencyIds ?? []) {
      if (!dependencyMap.has(dependencyId)) blockers.push(`a27_unknown_dependency:${tx.transactionId}:${dependencyId}`); else coveredDependencies.add(dependencyId);
    }
  }
  if (transactions.length && transactions.at(-1)?.postStateRootSha256 !== input?.snapshot?.expectedPostStateRootSha256) blockers.push("a27_final_state_root_mismatch");
  for (const assertion of assertions) if (!txIds.includes(assertion.transactionId)) blockers.push(`a27_assertion_transaction_missing:${assertion.assertionId}`);

  const coverageByCriticality = {};
  for (const criticality of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    const declaredAssertions = assertions.filter((row) => row.criticality === criticality);
    const declaredStateKeys = stateKeys.filter((row) => row.criticality === criticality);
    coverageByCriticality[criticality] = {
      assertions: { declared: declaredAssertions.length, covered: declaredAssertions.filter((row) => coveredAssertions.has(row.assertionId)).length, ratio: ratio(declaredAssertions.filter((row) => coveredAssertions.has(row.assertionId)).length, declaredAssertions.length) },
      stateKeys: { declared: declaredStateKeys.length, covered: declaredStateKeys.filter((row) => coveredStateKeys.has(row.stateKeyId)).length, ratio: ratio(declaredStateKeys.filter((row) => coveredStateKeys.has(row.stateKeyId)).length, declaredStateKeys.length) }
    };
  }
  if (coverageByCriticality.CRITICAL.assertions.ratio < policy.thresholds.criticalAssertionCoverage) blockers.push("a27_critical_assertion_coverage_below_floor");
  if (coverageByCriticality.HIGH.assertions.ratio < policy.thresholds.highAssertionCoverage) blockers.push("a27_high_assertion_coverage_below_floor");
  if (coverageByCriticality.CRITICAL.stateKeys.ratio < policy.thresholds.criticalStateKeyCoverage) blockers.push("a27_critical_state_key_coverage_below_floor");
  if (coverageByCriticality.HIGH.stateKeys.ratio < policy.thresholds.highStateKeyCoverage) blockers.push("a27_high_state_key_coverage_below_floor");
  const dependencyCoverage = ratio(coveredDependencies.size, dependencies.length);
  if (dependencyCoverage < policy.thresholds.dependencyCoverage) blockers.push("a27_dependency_coverage_below_floor");

  const expectedSequenceDigest = digest(txIds);
  let deterministicReplays = 0;
  let flakyReplays = 0;
  for (const replay of replays) {
    if (!validId(replay?.replayId) || !validDigest(replay?.txSequenceSha256) || !validDigest(replay?.initialStateRootSha256) || !validDigest(replay?.finalStateRootSha256) || !validDigest(replay?.repeatFinalStateRootSha256) || !validDigest(replay?.aggregateStateDiffSha256) || !validDigest(replay?.repeatAggregateStateDiffSha256) || !validDigest(replay?.isolationReceiptSha256) || !validDigest(replay?.rawOutputSha256)) { blockers.push(`a27_replay_binding_invalid:${replay?.replayId ?? "unknown"}`); continue; }
    if (replay.txSequenceSha256 !== expectedSequenceDigest || JSON.stringify(replay.replayedTransactionIds ?? []) !== JSON.stringify(txIds)) blockers.push(`a27_replay_sequence_mismatch:${replay.replayId}`);
    if (replay.initialStateRootSha256 !== input?.snapshot?.preStateRootSha256 || replay.finalStateRootSha256 !== input?.snapshot?.expectedPostStateRootSha256) blockers.push(`a27_replay_state_root_mismatch:${replay.replayId}`);
    if (replay.isolationReceiptSha256 !== input?.snapshot?.isolationReceiptSha256) blockers.push(`a27_replay_isolation_mismatch:${replay.replayId}`);
    if (replay.rawOutputSha256 !== input?.runner?.rawOutputSha256) blockers.push(`a27_replay_runner_mismatch:${replay.replayId}`);
    if (replay.finalStateRootSha256 === replay.repeatFinalStateRootSha256 && replay.aggregateStateDiffSha256 === replay.repeatAggregateStateDiffSha256) deterministicReplays += 1;
    else { flakyReplays += 1; blockers.push(`a27_replay_nondeterministic:${replay.replayId}`); }
  }
  const replayDeterminism = ratio(deterministicReplays, replays.length);
  if (replayDeterminism < policy.thresholds.minimumReplayDeterminism || flakyReplays > policy.thresholds.maxFlakyReplays) blockers.push("a27_replay_determinism_below_floor");

  const mutationIds = mutations.map((row) => row.mutationId);
  if (new Set(mutationIds).size !== mutationIds.length) blockers.push("a27_duplicate_mutation_id");
  let killed = 0;
  for (const mutation of mutations) {
    if (!validId(mutation?.mutationId) || !validId(mutation?.targetId) || !validDigest(mutation?.replayReceiptSha256) || !validDigest(mutation?.counterexampleSha256)) blockers.push(`a27_mutation_invalid:${mutation?.mutationId ?? "unknown"}`);
    if (mutation.killed === true && mutation.replayDeterministic === true) killed += 1;
  }
  const mutationKillRate = ratio(killed, mutations.length);
  if (mutationKillRate < policy.thresholds.mutationKillRate) blockers.push("a27_mutation_kill_rate_below_floor");

  const localEligibility = blockers.length === 0;
  const core = {
    schemaVersion: A27_REPORT_SCHEMA,
    passId: "PASS35_A27",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    blockers: [...new Set(blockers)].sort(),
    transactionCount: transactions.length,
    assertionCount: assertions.length,
    stateKeyCount: stateKeys.length,
    dependencyCount: dependencies.length,
    replayCount: replays.length,
    statusMatchRatio: ratio(statusMatches, transactions.length),
    stateRootContinuityRatio: ratio(continuityMatches, transactions.length),
    coverageByCriticality,
    dependencyCoverage,
    replayDeterminism,
    flakyReplays,
    mutation: { total: mutations.length, killed, killRate: mutationKillRate },
    localEligibility,
    officialNativeForkRunnerExecuted: false,
    publicNetworkProviderUsed: false,
    realHistoricalExploitReplayed: false,
    realCustomerWorkflowReplayed: false,
    commercialProviderRightsProven: false,
    independentRerun: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, reportSha256: digest(core) };
}

function assertion(index, transactionId) {
  const id = String(index).padStart(2, "0");
  return { assertionId: `ASSERTION_${id}`, transactionId, assertionType: `ASSERT_TYPE_${id}`, criticality: index === 0 ? "CRITICAL" : index === 1 ? "HIGH" : "MEDIUM", expectedDigestSha256: `sha256:${String(index + 1).padStart(64, "0")}` };
}
function stateKey(index) {
  const id = String(index).padStart(2, "0");
  return { stateKeyId: `STATE_KEY_${id}`, criticality: index === 0 ? "CRITICAL" : index === 1 ? "HIGH" : "MEDIUM", definitionSha256: `sha256:${String(index + 20).padStart(64, "0")}` };
}
function validInput(family, index) {
  const token = family.replaceAll("_", "-");
  const runnerRaw = `sha256:${"b".repeat(64)}`;
  const preRoot = `sha256:${"1".repeat(64)}`;
  const dependencies = Array.from({ length: 3 }, (_, i) => ({ dependencyId: `DEPENDENCY_${String(i).padStart(2, "0")}`, address: `0x${String(i + 2).repeat(40)}`, codeSha256: `sha256:${String(i + 30).padStart(64, "0")}`, stateSha256: `sha256:${String(i + 40).padStart(64, "0")}`, balanceSha256: `sha256:${String(i + 50).padStart(64, "0")}` }));
  const stateKeys = [stateKey(0), stateKey(1), stateKey(2)];
  const txIds = Array.from({ length: 4 }, (_, i) => `TX_${String(i).padStart(2, "0")}`);
  const assertions = txIds.map((txId, i) => assertion(i, txId));
  const roots = [preRoot, ...Array.from({ length: 4 }, (_, i) => `sha256:${String(i + 60).padStart(64, "0")}`)];
  const transactions = txIds.map((txId, i) => ({
    transactionId: txId,
    transactionHashSha256: `sha256:${String(i + 70).padStart(64, "0")}`,
    sequenceIndex: i,
    sender: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    calldataSha256: `sha256:${String(i + 80).padStart(64, "0")}`,
    expectedStatus: i === 3 ? "REVERT" : "SUCCESS",
    actualStatus: i === 3 ? "REVERT" : "SUCCESS",
    returnDataSha256: `sha256:${String(i + 90).padStart(64, "0")}`,
    logsSha256: `sha256:${String(i + 100).padStart(64, "0")}`,
    stateDiffSha256: `sha256:${String(i + 110).padStart(64, "0")}`,
    preStateRootSha256: roots[i],
    postStateRootSha256: roots[i + 1],
    runnerRawOutputSha256: runnerRaw,
    coveredAssertionIds: [assertions[i].assertionId],
    coveredStateKeyIds: stateKeys.map((row) => row.stateKeyId),
    dependencyIds: [dependencies[i % dependencies.length].dependencyId]
  }));
  transactions[0].dependencyIds = dependencies.map((row) => row.dependencyId);
  const sequenceSha = digest(txIds);
  const finalRoot = roots.at(-1);
  const replays = Array.from({ length: 8 }, (_, i) => {
    const diff = `sha256:${String(i + 120).padStart(64, "0")}`;
    return { replayId: `REPLAY_${String(i).padStart(2, "0")}`, txSequenceSha256: sequenceSha, replayedTransactionIds: txIds, initialStateRootSha256: preRoot, finalStateRootSha256: finalRoot, repeatFinalStateRootSha256: finalRoot, aggregateStateDiffSha256: diff, repeatAggregateStateDiffSha256: diff, isolationReceiptSha256: `sha256:${"7".repeat(64)}`, rawOutputSha256: runnerRaw };
  });
  const mutations = Array.from({ length: 20 }, (_, i) => ({ mutationId: `MUTATION_${String(i).padStart(2, "0")}`, targetId: txIds[i % txIds.length], killed: i < 19, replayDeterministic: true, replayReceiptSha256: `sha256:${String(i + 140).padStart(64, "0")}`, counterexampleSha256: `sha256:${String(i + 160).padStart(64, "0")}` }));
  return {
    schemaVersion: A27_INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef: `AUD-A27-${token}-${String(index).padStart(2, "0")}`,
    target: { chainId: "1", blockNumber: 19000000, contractAddress: "0x2222222222222222222222222222222222222222", blockHashSha256: `sha256:${"a".repeat(64)}`, runtimeBytecodeSha256: `sha256:${"c".repeat(64)}`, sourceBundleSha256: `sha256:${"d".repeat(64)}`, deploymentReceiptSha256: `sha256:${"e".repeat(64)}`, providerRightsReceiptSha256: `sha256:${"f".repeat(64)}` },
    runner: { familyId: "LOCAL_FORK_REPLAY_MODEL", executableSha256: `sha256:${"2".repeat(64)}`, versionOutputSha256: `sha256:${"3".repeat(64)}`, configSha256: `sha256:${"4".repeat(64)}`, rawOutputSha256: runnerRaw },
    snapshot: { providerEndpointSha256: `sha256:${"5".repeat(64)}`, forkConfigSha256: `sha256:${"6".repeat(64)}`, snapshotReceiptSha256: `sha256:${"8".repeat(64)}`, isolationReceiptSha256: `sha256:${"7".repeat(64)}`, preStateRootSha256: preRoot, expectedPostStateRootSha256: finalRoot },
    assertions, stateKeys, dependencies, transactions, replays, mutations
  };
}
function defect(input, family) {
  const out = clone(input);
  switch (family) {
    case "CHAIN_BLOCK_BINDING": out.target.blockHashSha256 = "bad"; break;
    case "STATE_ROOT_CONTINUITY": out.transactions[1].preStateRootSha256 = `sha256:${"9".repeat(64)}`; break;
    case "TRANSACTION_SEQUENCE": out.transactions[1].sequenceIndex = 7; break;
    case "ASSERTION_COVERAGE": out.transactions[0].coveredAssertionIds = []; break;
    case "STATE_DIFF_COVERAGE": out.transactions.forEach((tx) => { tx.coveredStateKeyIds = []; }); break;
    case "DEPENDENCY_BINDING": out.transactions.forEach((tx) => { tx.dependencyIds = []; }); break;
    case "LOG_RETURN_BINDING": out.transactions[0].logsSha256 = "bad"; break;
    case "RUNNER_BINDING": out.transactions[0].runnerRawOutputSha256 = `sha256:${"9".repeat(64)}`; break;
    case "SNAPSHOT_ISOLATION": out.replays[0].isolationReceiptSha256 = `sha256:${"9".repeat(64)}`; break;
    case "REPLAY_DETERMINISM": out.replays[0].repeatFinalStateRootSha256 = `sha256:${"9".repeat(64)}`; break;
    case "MUTATION_SCORE": out.mutations.forEach((row, i) => { row.killed = i < 8; }); break;
    case "REGISTRY_COMPLETENESS": out.assertions.push(clone(out.assertions[0])); break;
    default: throw new Error(`a27_unknown_family:${family}`);
  }
  return out;
}
function mutate(input, type) {
  const out = clone(input);
  switch (type) {
    case "schema_invalid": out.schemaVersion = "bad"; break;
    case "input_class_relabel": out.inputClass = "CUSTOMER_VERIFIED"; break;
    case "block_binding_break": out.target.blockHashSha256 = "bad"; break;
    case "state_continuity_break": out.transactions[1].preStateRootSha256 = `sha256:${"9".repeat(64)}`; break;
    case "sequence_break": out.transactions[1].sequenceIndex = 9; break;
    case "assertion_coverage_drop": out.transactions[0].coveredAssertionIds = []; break;
    case "state_coverage_drop": out.transactions.forEach((tx) => { tx.coveredStateKeyIds = []; }); break;
    case "dependency_coverage_drop": out.transactions.forEach((tx) => { tx.dependencyIds = []; }); break;
    case "runner_binding_break": out.replays[0].rawOutputSha256 = `sha256:${"9".repeat(64)}`; break;
    case "isolation_break": out.replays[0].isolationReceiptSha256 = `sha256:${"9".repeat(64)}`; break;
    case "replay_nondeterminism": out.replays[0].repeatAggregateStateDiffSha256 = `sha256:${"9".repeat(64)}`; break;
    case "mutation_score_drop": out.mutations.forEach((row, i) => { row.killed = i < 5; }); break;
    default: throw new Error(`a27_unknown_mutation:${type}`);
  }
  return out;
}

export function runA27Benchmark(policy) {
  if (!verifyA27Policy(policy)) throw new Error("a27_policy_invalid");
  const rows = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const input = expectedEligible ? validInput(family, index) : defect(validInput(family, index), family);
      const report = analyzeA27ForkReplayEvidence(input, policy);
      rows.push({ family, index, frozen: index >= 10, expectedEligible, actualEligible: report.localEligibility, passed: expectedEligible === report.localEligibility, blockers: report.blockers, reportSha256: report.reportSha256 });
    }
  }
  const mutations = [];
  for (const [rowIndex, row] of rows.entries()) {
    const base = validInput(row.family, row.index);
    for (const type of policy.benchmark.mutationTypes) {
      const report = analyzeA27ForkReplayEvidence(mutate(base, type), policy);
      mutations.push({ rowIndex, family: row.family, type, killed: !report.localEligibility, reportSha256: report.reportSha256 });
    }
  }
  const frozen = rows.filter((row) => row.frozen);
  const correct = frozen.filter((row) => row.passed).length;
  const unsafeEligible = frozen.filter((row) => !row.expectedEligible && row.actualEligible).length;
  const falseBlocks = frozen.filter((row) => row.expectedEligible && !row.actualEligible).length;
  const killed = mutations.filter((row) => row.killed).length;
  const core = { schemaVersion: A27_BENCHMARK_SCHEMA, passId: "PASS35_A27", sourceRevisionId: policy.sourceRevisionId, denominators: { cases: rows.length, frozen: frozen.length, mutations: mutations.length, families: policy.benchmark.families.length }, frozen: { correct, accuracy: ratio(correct, frozen.length), unsafeEligible, falseBlocks, wilson95: wilson(correct, frozen.length) }, mutation: { total: mutations.length, killed, survived: mutations.length - killed, killRate: ratio(killed, mutations.length) }, rows, mutations, localOnly: true, officialNativeForkRunnerExecuted: false, publicNetworkProviderUsed: false, realHistoricalExploitReplayed: false, realCustomerWorkflowReplayed: false, commercialProviderRightsProven: false, independentRerun: false, paidGateEligible: false, sellEnabled: false, truthBoundary: policy.truthBoundary };
  return { ...core, integritySha256: digest(core) };
}
export function verifyA27Report(report) {
  if (!report || report.schemaVersion !== A27_REPORT_SCHEMA || !validDigest(report.reportSha256)) return false;
  const { reportSha256, ...core } = report;
  return digest(core) === reportSha256 && report.officialNativeForkRunnerExecuted === false && report.publicNetworkProviderUsed === false && report.paidGateEligible === false && report.sellEnabled === false;
}
export function verifyA27Benchmark(report, policy) {
  if (!report || report.schemaVersion !== A27_BENCHMARK_SCHEMA || !verifyA27Policy(policy)) return false;
  const { integritySha256, ...core } = report;
  return digest(core) === integritySha256 && report.denominators.cases === policy.benchmark.expectedCases && report.denominators.frozen === policy.benchmark.expectedFrozen && report.denominators.mutations === policy.benchmark.expectedMutations && report.frozen.accuracy === 1 && report.frozen.unsafeEligible === 0 && report.frozen.falseBlocks === 0 && report.mutation.killRate === 1 && report.officialNativeForkRunnerExecuted === false && report.publicNetworkProviderUsed === false && report.paidGateEligible === false;
}
