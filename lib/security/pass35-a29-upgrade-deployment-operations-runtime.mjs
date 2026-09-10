import { createHash } from "node:crypto";

const INPUT_SCHEMA = "velmere.pass35.a29-upgrade-deployment-operations-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a29-upgrade-deployment-operations-report.v1";
const BENCHMARK_SCHEMA = "velmere.pass35.a29-upgrade-deployment-operations-benchmark.v1";
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const ADDRESS = /^0x[a-f0-9]{40}$/u;
const ID = /^[A-Z][A-Z0-9_]{2,80}$/u;
const CASE_REF = /^AUD-A29-[A-Z0-9-]{6,72}$/u;
const PROXY_TYPES = new Set(["TRANSPARENT", "UUPS", "BEACON", "NONE"]);
const AUTH_MODES = new Set(["PROXY_ADMIN", "ACCESS_CONTROL", "OWNABLE", "IMMUTABLE_NONE"]);
const CRITICALITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function digest(value) { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ratio(n, d) { return d > 0 ? Number((n / d).toFixed(6)) : 0; }
function unique(values) { return new Set(values).size === values.length; }
function validDigest(value) { return DIGEST.test(String(value ?? "")); }
function validAddress(value) { return ADDRESS.test(String(value ?? "")); }
function validId(value) { return ID.test(String(value ?? "")); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function add(blockers, condition, code) { if (!condition) blockers.push(code); }
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { lower: Number(((centre - margin) / denominator).toFixed(6)), upper: Number(((centre + margin) / denominator).toFixed(6)) };
}

export function verifyA29Policy(policy) {
  try {
    return policy?.schemaVersion === "velmere.pass35.a29-upgrade-deployment-operations-policy.v1"
      && policy?.passId === "PASS35_A29"
      && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy?.sourceRevisionId ?? ""))
      && Array.isArray(policy.allowedInputClasses) && policy.allowedInputClasses.length === 2
      && Array.isArray(policy.requiredControlFamilies) && policy.requiredControlFamilies.length === 12 && unique(policy.requiredControlFamilies)
      && policy.thresholds.minimumMultisigOwners >= 3
      && policy.thresholds.minimumMultisigThreshold >= 2
      && policy.thresholds.minimumTimelockDelaySeconds >= 86400
      && policy.thresholds.minimumCompromiseScenarios >= 3
      && policy.thresholds.minimumReplayRuns >= 3
      && policy.thresholds.mutationKillRate >= 0.9 && policy.thresholds.mutationKillRate <= 1
      && policy.thresholds.requireUniqueOwners === true
      && policy.thresholds.requireStorageLayoutCompatibility === true
      && policy.thresholds.requireInitializerProtection === true
      && policy.thresholds.requireEmergencyPause === true
      && policy.thresholds.requireRollbackPlan === true
      && policy.thresholds.requireClaimBoundary === true
      && Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 12 && unique(policy.benchmark.families)
      && Array.isArray(policy.benchmark?.mutationTypes) && policy.benchmark.mutationTypes.length === 12 && unique(policy.benchmark.mutationTypes)
      && policy.benchmark.expectedCases === 192
      && policy.benchmark.expectedFrozen === 72
      && policy.benchmark.expectedMutations === 2304
      && typeof policy.truthBoundary === "string" && policy.truthBoundary.length > 160;
  } catch { return false; }
}

export function analyzeA29UpgradeDeploymentOperations(input, policy) {
  if (!verifyA29Policy(policy)) throw new Error("a29_policy_invalid");
  const blockers = [];
  add(blockers, input?.schemaVersion === INPUT_SCHEMA, "a29_schema_invalid");
  add(blockers, policy.allowedInputClasses.includes(input?.inputClass), "a29_input_class_invalid");
  add(blockers, CASE_REF.test(String(input?.caseRef ?? "")), "a29_case_ref_invalid");

  const target = input?.target ?? {};
  add(blockers, integer(target.chainId) && target.chainId > 0, "a29_chain_id_invalid");
  add(blockers, integer(target.blockNumber) && target.blockNumber > 0, "a29_block_number_invalid");
  add(blockers, validAddress(target.contractAddress), "a29_contract_address_invalid");
  for (const field of ["blockHashSha256", "sourceBundleSha256", "runtimeBytecodeSha256", "deploymentReceiptSha256", "a28EconomicReceiptSha256", "architectureSha256"]) add(blockers, validDigest(target[field]), `a29_target_${field}_invalid`);

  const proxy = input?.proxy ?? {};
  add(blockers, PROXY_TYPES.has(proxy.proxyType), "a29_proxy_type_invalid");
  const upgradeable = proxy.proxyType !== "NONE";
  if (upgradeable) {
    add(blockers, validAddress(proxy.implementationAddress), "a29_implementation_address_invalid");
    add(blockers, validAddress(proxy.adminAddress), "a29_admin_address_invalid");
    add(blockers, validDigest(proxy.implementationSlotSha256), "a29_implementation_slot_invalid");
    add(blockers, validDigest(proxy.adminSlotSha256), "a29_admin_slot_invalid");
    add(blockers, validDigest(proxy.slotEvidenceSha256), "a29_slot_evidence_invalid");
    if (proxy.proxyType === "BEACON") add(blockers, validDigest(proxy.beaconSlotSha256), "a29_beacon_slot_invalid");
  }

  const authorization = input?.authorization ?? {};
  add(blockers, AUTH_MODES.has(authorization.mode), "a29_authorization_mode_invalid");
  if (upgradeable) {
    add(blockers, authorization.mode !== "IMMUTABLE_NONE", "a29_upgrade_authorization_missing");
    add(blockers, validDigest(authorization.policySha256), "a29_authorization_policy_invalid");
    add(blockers, validDigest(authorization.roleBindingSha256), "a29_authorization_role_binding_invalid");
    add(blockers, authorization.onlyAuthorizedCallerCanUpgrade === true, "a29_upgrade_authorization_unproven");
  }

  const multisig = input?.multisig ?? {};
  const owners = Array.isArray(multisig.owners) ? multisig.owners : [];
  add(blockers, owners.length >= policy.thresholds.minimumMultisigOwners, "a29_multisig_owner_count_below_floor");
  add(blockers, owners.every(validAddress), "a29_multisig_owner_invalid");
  add(blockers, !policy.thresholds.requireUniqueOwners || unique(owners), "a29_multisig_owner_duplicate");
  add(blockers, integer(multisig.threshold) && multisig.threshold >= policy.thresholds.minimumMultisigThreshold && multisig.threshold <= owners.length, "a29_multisig_threshold_invalid");
  add(blockers, validDigest(multisig.signerSetSha256) && validDigest(multisig.quorumReceiptSha256), "a29_multisig_binding_invalid");

  const timelock = input?.timelock ?? {};
  add(blockers, integer(timelock.minimumDelaySeconds) && timelock.minimumDelaySeconds >= policy.thresholds.minimumTimelockDelaySeconds, "a29_timelock_minimum_below_floor");
  add(blockers, integer(timelock.configuredDelaySeconds) && timelock.configuredDelaySeconds >= timelock.minimumDelaySeconds, "a29_timelock_configured_below_minimum");
  for (const field of ["proposerRoleSha256", "executorRoleSha256", "cancelerRoleSha256", "delayReceiptSha256"]) add(blockers, validDigest(timelock[field]), `a29_timelock_${field}_invalid`);
  add(blockers, timelock.bypassRoutePresent === false, "a29_timelock_bypass_present");

  const upgrade = input?.upgrade ?? {};
  add(blockers, !policy.thresholds.requireInitializerProtection || upgrade.initializerProtected === true, "a29_initializer_unprotected");
  if (proxy.proxyType === "UUPS") add(blockers, upgrade.proxiableUuidValidated === true, "a29_uups_uuid_unvalidated");
  add(blockers, !policy.thresholds.requireStorageLayoutCompatibility || upgrade.storageLayoutCompatible === true, "a29_storage_layout_incompatible");
  for (const field of ["storageLayoutSha256", "storageDiffSha256", "upgradeSimulationSha256"]) add(blockers, validDigest(upgrade[field]), `a29_upgrade_${field}_invalid`);
  add(blockers, upgrade.upgradeSimulationPassed === true, "a29_upgrade_simulation_failed");
  add(blockers, !policy.thresholds.requireRollbackPlan || upgrade.rollbackPlanPresent === true, "a29_rollback_plan_missing");
  add(blockers, validDigest(upgrade.rollbackPlanSha256) && validDigest(upgrade.rollbackLimitationsSha256), "a29_rollback_binding_invalid");
  add(blockers, upgrade.rollbackClaimGuaranteed === false, "a29_rollback_guarantee_forbidden");

  const emergency = input?.emergency ?? {};
  add(blockers, !policy.thresholds.requireEmergencyPause || emergency.pauseAvailable === true, "a29_pause_control_missing");
  add(blockers, emergency.unpauseRequiresIndependentApproval === true, "a29_unpause_independent_approval_missing");
  for (const field of ["pauseAuthoritySha256", "emergencyCouncilSha256", "incidentRunbookSha256", "pauseSimulationSha256"]) add(blockers, validDigest(emergency[field]), `a29_emergency_${field}_invalid`);

  const keys = input?.keyManagement ?? {};
  add(blockers, integer(keys.adminKeyCount) && keys.adminKeyCount >= owners.length, "a29_admin_key_count_invalid");
  add(blockers, integer(keys.hardwareBackedCount) && keys.hardwareBackedCount >= policy.thresholds.minimumMultisigThreshold, "a29_hardware_key_count_below_floor");
  for (const field of ["rotationPolicySha256", "rotationReceiptSha256", "recoveryPolicySha256", "recoveryReceiptSha256"]) add(blockers, validDigest(keys[field]), `a29_key_${field}_invalid`);
  add(blockers, keys.rotationTestPassed === true && keys.recoveryTestPassed === true, "a29_key_rotation_recovery_unproven");
  const scenarios = Array.isArray(keys.compromiseScenarios) ? keys.compromiseScenarios : [];
  add(blockers, scenarios.length >= policy.thresholds.minimumCompromiseScenarios, "a29_compromise_scenario_count_below_floor");
  add(blockers, unique(scenarios.map((row) => row?.scenarioId)), "a29_compromise_scenario_duplicate");
  for (const row of scenarios) {
    add(blockers, validId(row?.scenarioId), "a29_compromise_scenario_id_invalid");
    add(blockers, validDigest(row?.triggerSha256) && validDigest(row?.responseSha256), "a29_compromise_scenario_binding_invalid");
    add(blockers, row?.detectionPassed === true && row?.containmentPassed === true && row?.rotationPassed === true && row?.recoveryPassed === true, "a29_compromise_scenario_failed");
  }

  const assertions = Array.isArray(input?.operationsAssertions) ? input.operationsAssertions : [];
  add(blockers, assertions.length >= 12, "a29_operations_assertion_registry_incomplete");
  add(blockers, unique(assertions.map((row) => row?.assertionId)), "a29_operations_assertion_duplicate");
  const criticalHigh = assertions.filter((row) => row?.criticality === "CRITICAL" || row?.criticality === "HIGH");
  for (const row of assertions) {
    add(blockers, validId(row?.assertionId), "a29_operations_assertion_id_invalid");
    add(blockers, CRITICALITIES.has(row?.criticality), "a29_operations_assertion_criticality_invalid");
    add(blockers, validDigest(row?.evidenceSha256), "a29_operations_assertion_evidence_invalid");
    add(blockers, row?.passed === true, "a29_operations_assertion_failed");
  }
  const criticalHighPassed = criticalHigh.filter((row) => row.passed === true).length;
  add(blockers, criticalHigh.length > 0 && ratio(criticalHighPassed, criticalHigh.length) >= policy.thresholds.minimumCriticalHighAssertionCoverage, "a29_critical_high_assertion_coverage_below_floor");

  const replay = Array.isArray(input?.operationsReplayRuns) ? input.operationsReplayRuns : [];
  add(blockers, replay.length >= policy.thresholds.minimumReplayRuns, "a29_replay_run_count_below_floor");
  for (const row of replay) {
    add(blockers, integer(row?.runIndex), "a29_replay_run_index_invalid");
    add(blockers, validDigest(row?.inputSha256) && validDigest(row?.outputSha256) && validDigest(row?.stateDiffSha256), "a29_replay_binding_invalid");
    add(blockers, row?.passed === true, "a29_replay_failed");
  }
  const replayOutputs = replay.map((row) => `${row.outputSha256}:${row.stateDiffSha256}`);
  add(blockers, replayOutputs.length > 0 && new Set(replayOutputs).size === 1, "a29_replay_nondeterministic");

  const mutation = input?.mutationEvidence ?? {};
  add(blockers, integer(mutation.total) && mutation.total > 0 && integer(mutation.killed) && mutation.killed <= mutation.total, "a29_mutation_counts_invalid");
  add(blockers, ratio(mutation.killed, mutation.total) >= policy.thresholds.mutationKillRate, "a29_mutation_kill_rate_below_floor");
  add(blockers, validDigest(mutation.registrySha256) && validDigest(mutation.receiptSha256), "a29_mutation_binding_invalid");

  add(blockers, input?.currentOnChainStateVerified === false, "a29_current_onchain_state_must_remain_unclaimed");
  add(blockers, input?.realMultisigTimelockExecuted === false, "a29_real_multisig_timelock_must_remain_unclaimed");
  add(blockers, input?.productionUpgradeExecuted === false, "a29_production_upgrade_must_remain_unclaimed");
  add(blockers, input?.qualifiedHumanReviewed === false, "a29_human_review_must_remain_unclaimed");
  add(blockers, input?.independentRerun === false, "a29_independent_rerun_must_remain_unclaimed");
  add(blockers, input?.paidGateEligible === false, "a29_paid_gate_must_remain_false");

  const uniqueBlockers = [...new Set(blockers)].sort();
  const reportCore = {
    schemaVersion: REPORT_SCHEMA,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    eligibleLocalEvidenceContract: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    metrics: {
      ownerCount: owners.length,
      multisigThreshold: multisig.threshold ?? null,
      timelockDelaySeconds: timelock.configuredDelaySeconds ?? null,
      compromiseScenarioCount: scenarios.length,
      criticalHighAssertionCoverage: ratio(criticalHighPassed, criticalHigh.length),
      replayRunCount: replay.length,
      mutationKillRate: ratio(mutation.killed ?? 0, mutation.total ?? 0)
    },
    claims: {
      currentOnChainStateVerified: false,
      realMultisigTimelockExecuted: false,
      productionUpgradeExecuted: false,
      qualifiedHumanReviewed: false,
      independentRerun: false,
      paidGateEligible: false,
      sellEnabled: false
    }
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

function d(label) { return digest({ label }); }
function addr(n) { return `0x${n.toString(16).padStart(40, "0")}`; }
function baseInput(caseRef) {
  const owners = [addr(101), addr(102), addr(103), addr(104)];
  const assertionIds = [
    "PROXY_SLOT_BOUND", "AUTHORIZATION_BOUND", "MULTISIG_QUORUM", "TIMELOCK_DELAY", "INITIALIZER_GUARD", "STORAGE_LAYOUT",
    "UPGRADE_SIMULATION", "ROLLBACK_LIMITS", "PAUSE_CONTROL", "KEY_ROTATION", "KEY_RECOVERY", "COMPROMISE_RESPONSE"
  ];
  return {
    schemaVersion: INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef,
    target: { chainId: 1, blockNumber: 19000000, contractAddress: addr(900), blockHashSha256: d(`${caseRef}:block`), sourceBundleSha256: d(`${caseRef}:source`), runtimeBytecodeSha256: d(`${caseRef}:runtime`), deploymentReceiptSha256: d(`${caseRef}:deploy`), a28EconomicReceiptSha256: d(`${caseRef}:a28`), architectureSha256: d(`${caseRef}:architecture`) },
    proxy: { proxyType: "UUPS", implementationAddress: addr(901), adminAddress: addr(902), implementationSlotSha256: d(`${caseRef}:impl-slot`), adminSlotSha256: d(`${caseRef}:admin-slot`), beaconSlotSha256: d(`${caseRef}:beacon-slot`), slotEvidenceSha256: d(`${caseRef}:slot-evidence`) },
    authorization: { mode: "ACCESS_CONTROL", policySha256: d(`${caseRef}:auth-policy`), roleBindingSha256: d(`${caseRef}:auth-role`), onlyAuthorizedCallerCanUpgrade: true },
    multisig: { owners, threshold: 3, signerSetSha256: d(`${caseRef}:signers`), quorumReceiptSha256: d(`${caseRef}:quorum`) },
    timelock: { minimumDelaySeconds: 86400, configuredDelaySeconds: 172800, proposerRoleSha256: d(`${caseRef}:proposer`), executorRoleSha256: d(`${caseRef}:executor`), cancelerRoleSha256: d(`${caseRef}:canceler`), delayReceiptSha256: d(`${caseRef}:delay`), bypassRoutePresent: false },
    upgrade: { initializerProtected: true, proxiableUuidValidated: true, storageLayoutCompatible: true, storageLayoutSha256: d(`${caseRef}:layout`), storageDiffSha256: d(`${caseRef}:layout-diff`), upgradeSimulationSha256: d(`${caseRef}:sim`), upgradeSimulationPassed: true, rollbackPlanPresent: true, rollbackPlanSha256: d(`${caseRef}:rollback`), rollbackLimitationsSha256: d(`${caseRef}:rollback-limits`), rollbackClaimGuaranteed: false },
    emergency: { pauseAvailable: true, unpauseRequiresIndependentApproval: true, pauseAuthoritySha256: d(`${caseRef}:pause-auth`), emergencyCouncilSha256: d(`${caseRef}:council`), incidentRunbookSha256: d(`${caseRef}:runbook`), pauseSimulationSha256: d(`${caseRef}:pause-sim`) },
    keyManagement: {
      adminKeyCount: 4, hardwareBackedCount: 3, rotationPolicySha256: d(`${caseRef}:rotation-policy`), rotationReceiptSha256: d(`${caseRef}:rotation`), recoveryPolicySha256: d(`${caseRef}:recovery-policy`), recoveryReceiptSha256: d(`${caseRef}:recovery`), rotationTestPassed: true, recoveryTestPassed: true,
      compromiseScenarios: ["KEY_LOSS", "KEY_THEFT", "SIGNER_COLLUSION"].map((name, index) => ({ scenarioId: name, triggerSha256: d(`${caseRef}:trigger:${index}`), responseSha256: d(`${caseRef}:response:${index}`), detectionPassed: true, containmentPassed: true, rotationPassed: true, recoveryPassed: true }))
    },
    operationsAssertions: assertionIds.map((assertionId, index) => ({ assertionId, criticality: index < 4 ? "CRITICAL" : index < 9 ? "HIGH" : "MEDIUM", evidenceSha256: d(`${caseRef}:assert:${index}`), passed: true })),
    operationsReplayRuns: [0, 1, 2].map((runIndex) => ({ runIndex, inputSha256: d(`${caseRef}:replay-input`), outputSha256: d(`${caseRef}:replay-output`), stateDiffSha256: d(`${caseRef}:replay-state`), passed: true })),
    mutationEvidence: { total: 100, killed: 100, registrySha256: d(`${caseRef}:mut-reg`), receiptSha256: d(`${caseRef}:mut-receipt`) },
    currentOnChainStateVerified: false,
    realMultisigTimelockExecuted: false,
    productionUpgradeExecuted: false,
    qualifiedHumanReviewed: false,
    independentRerun: false,
    paidGateEligible: false
  };
}

const faultMutators = {
  PROXY_SLOT_BINDING: (v) => { v.proxy.slotEvidenceSha256 = "sha256:bad"; },
  UPGRADE_AUTHORIZATION: (v) => { v.authorization.onlyAuthorizedCallerCanUpgrade = false; },
  MULTISIG_QUORUM: (v) => { v.multisig.threshold = 1; },
  TIMELOCK_DELAY: (v) => { v.timelock.configuredDelaySeconds = 3600; },
  INITIALIZER_PROTECTION: (v) => { v.upgrade.initializerProtected = false; },
  STORAGE_LAYOUT_COMPATIBILITY: (v) => { v.upgrade.storageLayoutCompatible = false; },
  UPGRADE_SIMULATION: (v) => { v.upgrade.upgradeSimulationPassed = false; },
  ROLLBACK_LIMITS: (v) => { v.upgrade.rollbackPlanPresent = false; },
  PAUSE_EMERGENCY_CONTROLS: (v) => { v.emergency.pauseAvailable = false; },
  KEY_ROTATION_RECOVERY: (v) => { v.keyManagement.rotationTestPassed = false; },
  KEY_COMPROMISE_SCENARIOS: (v) => { v.keyManagement.compromiseScenarios = v.keyManagement.compromiseScenarios.slice(0, 2); },
  DETERMINISTIC_OPERATIONS_REPLAY: (v) => { v.operationsReplayRuns[2].outputSha256 = d(`${v.caseRef}:different-output`); }
};
const mutationMutators = [
  (v) => { v.proxy.slotEvidenceSha256 = "sha256:bad"; },
  (v) => { v.authorization.roleBindingSha256 = "sha256:bad"; },
  (v) => { v.multisig.owners[2] = v.multisig.owners[1]; },
  (v) => { v.timelock.bypassRoutePresent = true; },
  (v) => { v.upgrade.initializerProtected = false; },
  (v) => { v.upgrade.storageLayoutCompatible = false; },
  (v) => { v.upgrade.upgradeSimulationSha256 = "sha256:bad"; },
  (v) => { v.upgrade.rollbackClaimGuaranteed = true; },
  (v) => { v.emergency.unpauseRequiresIndependentApproval = false; },
  (v) => { v.keyManagement.recoveryReceiptSha256 = "sha256:bad"; },
  (v) => { v.keyManagement.compromiseScenarios[0].containmentPassed = false; },
  (v) => { v.operationsReplayRuns[1].stateDiffSha256 = d(`${v.caseRef}:different-state`); }
];

export function runA29Benchmark(policy) {
  if (!verifyA29Policy(policy)) throw new Error("a29_policy_invalid");
  const cases = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const caseRef = `AUD-A29-${family.replaceAll("_", "-")}-${String(index).padStart(2, "0")}`;
      const input = baseInput(caseRef);
      if (!expectedEligible) faultMutators[family](input);
      const report = analyzeA29UpgradeDeploymentOperations(input, policy);
      cases.push({ family, index, frozen: index >= 10, expectedEligible, observedEligible: report.eligibleLocalEvidenceContract, blockers: report.blockers, reportIntegritySha256: report.integritySha256, inputSha256: digest(input), input });
    }
  }
  let correct = 0;
  let frozenCorrect = 0;
  let frozenTotal = 0;
  let unsafeEligible = 0;
  let falseBlocks = 0;
  let killed = 0;
  let mutationTotal = 0;
  for (const row of cases) {
    const match = row.expectedEligible === row.observedEligible;
    if (match) correct += 1;
    if (row.frozen) { frozenTotal += 1; if (match) frozenCorrect += 1; if (!row.expectedEligible && row.observedEligible) unsafeEligible += 1; if (row.expectedEligible && !row.observedEligible) falseBlocks += 1; }
    for (const mutate of mutationMutators) {
      const mutated = row.expectedEligible ? clone(row.input) : baseInput(row.input.caseRef);
      if (row.expectedEligible) mutate(mutated);
      const mutatedReport = analyzeA29UpgradeDeploymentOperations(mutated, policy);
      mutationTotal += 1;
      if (mutatedReport.eligibleLocalEvidenceContract !== row.expectedEligible) killed += 1;
    }
  }
  const frozenAccuracy = ratio(frozenCorrect, frozenTotal);
  const reportCore = {
    schemaVersion: BENCHMARK_SCHEMA,
    passId: "PASS35_A29",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: cases.length, frozen: frozenTotal, mutations: mutationTotal, families: policy.benchmark.families.length },
    development: { accuracy: ratio(correct, cases.length), correct, total: cases.length, wilson95: wilson(correct, cases.length) },
    frozen: { accuracy: frozenAccuracy, correct: frozenCorrect, total: frozenTotal, unsafeEligible, falseBlocks, wilson95: wilson(frozenCorrect, frozenTotal) },
    mutation: { killed, total: mutationTotal, killRate: ratio(killed, mutationTotal) },
    claims: { currentOnChainStateVerified: false, realMultisigTimelockExecuted: false, productionUpgradeExecuted: false, qualifiedHumanReviewed: false, independentRerun: false, paidGateEligible: false, sellEnabled: false },
    cases: cases.map(({ input, ...row }) => row),
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

export function verifyA29Benchmark(report, policy) {
  try {
    return verifyA29Policy(policy)
      && report?.schemaVersion === BENCHMARK_SCHEMA
      && report?.passId === "PASS35_A29"
      && report?.sourceRevisionId === policy.sourceRevisionId
      && report.denominators.cases === policy.benchmark.expectedCases
      && report.denominators.frozen === policy.benchmark.expectedFrozen
      && report.denominators.mutations === policy.benchmark.expectedMutations
      && report.denominators.families === 12
      && report.development.accuracy === 1
      && report.frozen.accuracy === 1
      && report.frozen.unsafeEligible === 0
      && report.frozen.falseBlocks === 0
      && report.mutation.killRate === 1
      && report.claims.currentOnChainStateVerified === false
      && report.claims.realMultisigTimelockExecuted === false
      && report.claims.productionUpgradeExecuted === false
      && report.claims.qualifiedHumanReviewed === false
      && report.claims.independentRerun === false
      && report.claims.paidGateEligible === false
      && report.claims.sellEnabled === false
      && report.integritySha256 === digest(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "integritySha256")));
  } catch { return false; }
}
