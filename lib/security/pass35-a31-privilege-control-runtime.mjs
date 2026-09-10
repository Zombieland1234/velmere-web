import { createHash } from "node:crypto";

const INPUT_SCHEMA = "velmere.pass35.a31-privilege-control-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a31-privilege-control-report.v1";
const BENCHMARK_SCHEMA = "velmere.pass35.a31-privilege-control-benchmark.v1";
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const ADDRESS = /^0x[a-f0-9]{40}$/u;
const SELECTOR = /^0x[a-f0-9]{8}$/u;
const ID = /^[A-Z][A-Z0-9_]{2,96}$/u;
const CASE_REF = /^AUD-A31-[A-Z0-9-]{6,96}$/u;
const ROLE_TYPES = new Set(["DEFAULT_ADMIN", "OWNER", "UPGRADER", "PAUSER", "MINTER", "TREASURER", "GUARDIAN", "OPERATOR", "ORACLE_ADMIN"]);
const PRINCIPAL_TYPES = new Set(["EOA", "MULTISIG", "TIMELOCK", "CONTRACT", "ROLE_ALIAS"]);
const ACCESS_MODES = new Set(["PUBLIC", "ROLE", "OWNER", "MULTISIG", "TIMELOCK", "INTERNAL"]);
const CRITICALITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const EFFECTS = new Set(["UPGRADE", "MINT", "PAUSE", "UNPAUSE", "TRANSFER_FUNDS", "CHANGE_ORACLE", "GRANT_ROLE", "REVOKE_ROLE", "CHANGE_FEES", "RESCUE", "BLACKLIST", "ARBITRARY_CALL"]);
const ESCALATION_RESULTS = new Set(["BLOCKED", "CONTAINED", "POSSIBLE_WITH_PREREQUISITES"]);

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
function hasCycle(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node, []]));
  for (const [from, to] of edges) if (graph.has(from) && graph.has(to)) graph.get(from).push(to);
  const visiting = new Set();
  const visited = new Set();
  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) if (visit(next)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return nodes.some(visit);
}

export function verifyA31Policy(policy) {
  try {
    return policy?.schemaVersion === "velmere.pass35.a31-privilege-control-policy.v1"
      && policy?.passId === "PASS35_A31"
      && new Set(["VELMERE_PASS35_A31_PRIVILEGE_AUTHORIZATION_EVIDENCE_NON_VISUAL", "VELMERE_PASS35_A32_REPORT_DELIVERY_EVIDENCE_NON_VISUAL"]).has(policy?.sourceRevisionId)
      && Array.isArray(policy.allowedInputClasses) && policy.allowedInputClasses.length === 2
      && Array.isArray(policy.requiredControlFamilies) && policy.requiredControlFamilies.length === 12 && unique(policy.requiredControlFamilies)
      && policy.thresholds.minimumRoles >= 7
      && policy.thresholds.minimumPrincipals >= 6
      && policy.thresholds.minimumPrivilegedEntryPoints >= 8
      && policy.thresholds.minimumRoleAdminEdges >= 6
      && policy.thresholds.minimumSeparationRules >= 4
      && policy.thresholds.minimumEscalationScenarios >= 6
      && policy.thresholds.minimumReplayRuns >= 3
      && policy.thresholds.criticalEntryPointCoverage === 1
      && policy.thresholds.roleHolderEvidenceCoverage === 1
      && policy.thresholds.mutationKillRate >= 0.9 && policy.thresholds.mutationKillRate <= 1
      && policy.thresholds.requireUniqueIds === true
      && policy.thresholds.requireAcyclicRoleAdminGraph === true
      && policy.thresholds.requireNoUnknownCriticalSelector === true
      && policy.thresholds.requireExplicitDefaultAdminControl === true
      && policy.thresholds.requireRevokeAndEmergencyRecovery === true
      && policy.thresholds.requireClaimBoundary === true
      && Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 12 && unique(policy.benchmark.families)
      && Array.isArray(policy.benchmark?.mutationTypes) && policy.benchmark.mutationTypes.length === 12 && unique(policy.benchmark.mutationTypes)
      && policy.benchmark.expectedCases === 192
      && policy.benchmark.expectedFrozen === 72
      && policy.benchmark.expectedMutations === 2304
      && typeof policy.truthBoundary === "string" && policy.truthBoundary.length > 200;
  } catch { return false; }
}

export function analyzeA31PrivilegeControl(input, policy) {
  if (!verifyA31Policy(policy)) throw new Error("a31_policy_invalid");
  const blockers = [];
  add(blockers, input?.schemaVersion === INPUT_SCHEMA, "a31_schema_invalid");
  add(blockers, policy.allowedInputClasses.includes(input?.inputClass), "a31_input_class_invalid");
  add(blockers, CASE_REF.test(String(input?.caseRef ?? "")), "a31_case_ref_invalid");

  const target = input?.target ?? {};
  add(blockers, integer(target.chainId) && target.chainId > 0, "a31_chain_id_invalid");
  add(blockers, integer(target.blockNumber) && target.blockNumber > 0, "a31_block_number_invalid");
  add(blockers, validAddress(target.contractAddress), "a31_contract_address_invalid");
  for (const field of ["blockHashSha256", "sourceBundleSha256", "runtimeBytecodeSha256", "deploymentReceiptSha256", "a29OperationsReceiptSha256", "a30ThreatModelReceiptSha256", "roleStateSnapshotSha256"]) {
    add(blockers, validDigest(target[field]), `a31_target_${field}_invalid`);
  }

  const principals = Array.isArray(input?.principals) ? input.principals : [];
  const principalIds = principals.map((row) => row.principalId);
  add(blockers, principals.length >= policy.thresholds.minimumPrincipals, "a31_principal_count_below_floor");
  add(blockers, principalIds.every(validId) && unique(principalIds), "a31_principal_ids_invalid_or_duplicate");
  for (const row of principals) {
    add(blockers, PRINCIPAL_TYPES.has(row.principalType), `a31_principal_type_invalid:${row.principalId}`);
    if (row.principalType !== "ROLE_ALIAS") add(blockers, validAddress(row.address), `a31_principal_address_invalid:${row.principalId}`);
    add(blockers, validDigest(row.identityEvidenceSha256) && validDigest(row.currentStateEvidenceSha256), `a31_principal_evidence_invalid:${row.principalId}`);
    if (row.principalType === "MULTISIG") add(blockers, integer(row.ownerCount) && row.ownerCount >= 3 && integer(row.threshold) && row.threshold >= 2 && row.threshold <= row.ownerCount, `a31_multisig_quorum_invalid:${row.principalId}`);
    if (row.principalType === "TIMELOCK") add(blockers, integer(row.minimumDelaySeconds) && row.minimumDelaySeconds >= 3600, `a31_timelock_delay_invalid:${row.principalId}`);
  }
  const principalSet = new Set(principalIds);

  const roles = Array.isArray(input?.roles) ? input.roles : [];
  const roleIds = roles.map((row) => row.roleId);
  add(blockers, roles.length >= policy.thresholds.minimumRoles, "a31_role_count_below_floor");
  add(blockers, roleIds.every(validId) && unique(roleIds), "a31_role_ids_invalid_or_duplicate");
  for (const row of roles) {
    add(blockers, ROLE_TYPES.has(row.roleType), `a31_role_type_invalid:${row.roleId}`);
    add(blockers, validDigest(row.roleConstantSha256) && validDigest(row.sourceEvidenceSha256) && validDigest(row.abiEvidenceSha256), `a31_role_evidence_invalid:${row.roleId}`);
    add(blockers, Array.isArray(row.holderPrincipalIds) && row.holderPrincipalIds.length > 0 && row.holderPrincipalIds.every((id) => principalSet.has(id)) && unique(row.holderPrincipalIds), `a31_role_holders_invalid:${row.roleId}`);
    add(blockers, validDigest(row.holderStateReceiptSha256), `a31_role_holder_state_invalid:${row.roleId}`);
    add(blockers, typeof row.critical === "boolean", `a31_role_critical_flag_invalid:${row.roleId}`);
  }
  const roleSet = new Set(roleIds);
  const defaultAdminRoles = roles.filter((row) => row.roleType === "DEFAULT_ADMIN");
  add(blockers, !policy.thresholds.requireExplicitDefaultAdminControl || defaultAdminRoles.length === 1, "a31_default_admin_role_missing_or_duplicate");

  const adminEdges = Array.isArray(input?.roleAdminEdges) ? input.roleAdminEdges : [];
  const adminEdgeIds = adminEdges.map((row) => row.edgeId);
  add(blockers, adminEdges.length >= policy.thresholds.minimumRoleAdminEdges, "a31_role_admin_edge_count_below_floor");
  add(blockers, adminEdgeIds.every(validId) && unique(adminEdgeIds), "a31_role_admin_edge_ids_invalid_or_duplicate");
  for (const row of adminEdges) {
    add(blockers, roleSet.has(row.adminRoleId) && roleSet.has(row.managedRoleId), `a31_role_admin_reference_invalid:${row.edgeId}`);
    add(blockers, row.adminRoleId !== row.managedRoleId || row.adminRoleId === defaultAdminRoles[0]?.roleId, `a31_role_admin_self_cycle:${row.edgeId}`);
    add(blockers, validDigest(row.evidenceSha256), `a31_role_admin_evidence_invalid:${row.edgeId}`);
  }
  if (policy.thresholds.requireAcyclicRoleAdminGraph) {
    const nonRootEdges = adminEdges.filter((row) => !(row.adminRoleId === defaultAdminRoles[0]?.roleId && row.managedRoleId === defaultAdminRoles[0]?.roleId));
    add(blockers, !hasCycle(roleIds, nonRootEdges.map((row) => [row.adminRoleId, row.managedRoleId])), "a31_role_admin_cycle_detected");
  }

  const entryPoints = Array.isArray(input?.privilegedEntryPoints) ? input.privilegedEntryPoints : [];
  const entryPointIds = entryPoints.map((row) => row.entryPointId);
  add(blockers, entryPoints.length >= policy.thresholds.minimumPrivilegedEntryPoints, "a31_privileged_entry_point_count_below_floor");
  add(blockers, entryPointIds.every(validId) && unique(entryPointIds), "a31_entry_point_ids_invalid_or_duplicate");
  for (const row of entryPoints) {
    add(blockers, SELECTOR.test(String(row.selector ?? "")), `a31_selector_invalid:${row.entryPointId}`);
    add(blockers, ACCESS_MODES.has(row.accessMode) && row.accessMode !== "PUBLIC", `a31_privileged_access_mode_invalid:${row.entryPointId}`);
    add(blockers, Array.isArray(row.requiredRoleIds) && row.requiredRoleIds.length > 0 && row.requiredRoleIds.every((id) => roleSet.has(id)), `a31_entry_point_roles_invalid:${row.entryPointId}`);
    add(blockers, CRITICALITIES.has(row.criticality), `a31_entry_point_criticality_invalid:${row.entryPointId}`);
    add(blockers, Array.isArray(row.effects) && row.effects.length > 0 && row.effects.every((effect) => EFFECTS.has(effect)), `a31_entry_point_effects_invalid:${row.entryPointId}`);
    add(blockers, validDigest(row.sourceEvidenceSha256) && validDigest(row.abiEvidenceSha256) && validDigest(row.authorizationReceiptSha256), `a31_entry_point_evidence_invalid:${row.entryPointId}`);
    if (["CRITICAL", "HIGH"].includes(row.criticality)) add(blockers, row.authorizationVerified === true, `a31_critical_authorization_unverified:${row.entryPointId}`);
  }
  const criticalEntryPoints = entryPoints.filter((row) => ["CRITICAL", "HIGH"].includes(row.criticality));

  const proxyAuthority = input?.proxyAuthority ?? {};
  add(blockers, ["TRANSPARENT", "UUPS", "BEACON", "NONE"].includes(proxyAuthority.proxyType), "a31_proxy_type_invalid");
  if (proxyAuthority.proxyType !== "NONE") {
    add(blockers, validDigest(proxyAuthority.implementationSlotReceiptSha256), "a31_proxy_implementation_slot_missing");
    if (proxyAuthority.proxyType === "TRANSPARENT") add(blockers, validDigest(proxyAuthority.adminSlotReceiptSha256), "a31_proxy_admin_slot_missing");
    if (proxyAuthority.proxyType === "BEACON") add(blockers, validDigest(proxyAuthority.beaconSlotReceiptSha256), "a31_proxy_beacon_slot_missing");
    add(blockers, roleSet.has(proxyAuthority.upgradeRoleId), "a31_proxy_upgrade_role_invalid");
    add(blockers, principalSet.has(proxyAuthority.adminPrincipalId), "a31_proxy_admin_principal_invalid");
    add(blockers, validDigest(proxyAuthority.authorizationPathReceiptSha256), "a31_proxy_authorization_path_invalid");
  }

  const delegation = input?.delegation ?? {};
  add(blockers, principalSet.has(delegation.multisigPrincipalId) && principalSet.has(delegation.timelockPrincipalId), "a31_delegation_principal_invalid");
  add(blockers, roleSet.has(delegation.delegatedRoleId), "a31_delegation_role_invalid");
  add(blockers, delegation.directBypassAllowed === false, "a31_timelock_or_multisig_bypass_allowed");
  add(blockers, validDigest(delegation.multisigConfigurationReceiptSha256) && validDigest(delegation.timelockConfigurationReceiptSha256) && validDigest(delegation.delegationReceiptSha256), "a31_delegation_evidence_invalid");

  const separationRules = Array.isArray(input?.separationOfDuties) ? input.separationOfDuties : [];
  add(blockers, separationRules.length >= policy.thresholds.minimumSeparationRules, "a31_separation_rule_count_below_floor");
  add(blockers, separationRules.map((row) => row.ruleId).every(validId) && unique(separationRules.map((row) => row.ruleId)), "a31_separation_rule_ids_invalid_or_duplicate");
  for (const row of separationRules) {
    add(blockers, Array.isArray(row.incompatibleRoleIds) && row.incompatibleRoleIds.length >= 2 && row.incompatibleRoleIds.every((id) => roleSet.has(id)), `a31_separation_roles_invalid:${row.ruleId}`);
    add(blockers, row.violationDetected === false, `a31_separation_violation:${row.ruleId}`);
    add(blockers, validDigest(row.evaluationReceiptSha256), `a31_separation_evidence_invalid:${row.ruleId}`);
  }
  for (const principal of principals) {
    const held = roles.filter((role) => role.holderPrincipalIds.includes(principal.principalId)).map((role) => role.roleId);
    for (const rule of separationRules) {
      const conflict = rule.incompatibleRoleIds.every((roleId) => held.includes(roleId));
      add(blockers, !conflict, `a31_separation_runtime_conflict:${rule.ruleId}:${principal.principalId}`);
    }
  }

  const escalations = Array.isArray(input?.escalationScenarios) ? input.escalationScenarios : [];
  add(blockers, escalations.length >= policy.thresholds.minimumEscalationScenarios, "a31_escalation_scenario_count_below_floor");
  add(blockers, escalations.map((row) => row.scenarioId).every(validId) && unique(escalations.map((row) => row.scenarioId)), "a31_escalation_scenario_ids_invalid_or_duplicate");
  for (const row of escalations) {
    add(blockers, principalSet.has(row.startPrincipalId), `a31_escalation_start_principal_invalid:${row.scenarioId}`);
    add(blockers, roleSet.has(row.targetRoleId), `a31_escalation_target_role_invalid:${row.scenarioId}`);
    add(blockers, Array.isArray(row.pathRoleIds) && row.pathRoleIds.length > 0 && row.pathRoleIds.every((id) => roleSet.has(id)), `a31_escalation_path_invalid:${row.scenarioId}`);
    add(blockers, ESCALATION_RESULTS.has(row.result), `a31_escalation_result_invalid:${row.scenarioId}`);
    add(blockers, row.result !== "POSSIBLE_WITH_PREREQUISITES" || (Array.isArray(row.prerequisiteReceiptSha256s) && row.prerequisiteReceiptSha256s.length > 0 && row.prerequisiteReceiptSha256s.every(validDigest)), `a31_escalation_prerequisites_missing:${row.scenarioId}`);
    add(blockers, validDigest(row.pathReceiptSha256) && validDigest(row.mitigationReceiptSha256), `a31_escalation_evidence_invalid:${row.scenarioId}`);
  }

  const lifecycle = input?.privilegeLifecycle ?? {};
  add(blockers, lifecycle.grantRoleVerified === true && lifecycle.revokeRoleVerified === true && lifecycle.renounceRoleVerified === true, "a31_role_lifecycle_incomplete");
  add(blockers, lifecycle.emergencyRevokeVerified === true && lifecycle.adminRecoveryVerified === true, "a31_emergency_recovery_incomplete");
  add(blockers, lifecycle.noOrphanedCriticalRole === true, "a31_orphaned_critical_role");
  add(blockers, validDigest(lifecycle.grantReceiptSha256) && validDigest(lifecycle.revokeReceiptSha256) && validDigest(lifecycle.renounceReceiptSha256) && validDigest(lifecycle.emergencyReceiptSha256) && validDigest(lifecycle.recoveryReceiptSha256), "a31_role_lifecycle_evidence_invalid");

  const hidden = Array.isArray(input?.hiddenPrivilegedSurfaces) ? input.hiddenPrivilegedSurfaces : [];
  add(blockers, hidden.length >= 3, "a31_hidden_surface_scan_below_floor");
  add(blockers, hidden.map((row) => row.surfaceId).every(validId) && unique(hidden.map((row) => row.surfaceId)), "a31_hidden_surface_ids_invalid_or_duplicate");
  for (const row of hidden) {
    add(blockers, ["DELEGATECALL", "ARBITRARY_CALL", "TX_ORIGIN", "ASSEMBLY_SLOT_WRITE", "FALLBACK_ROUTER"].includes(row.surfaceType), `a31_hidden_surface_type_invalid:${row.surfaceId}`);
    add(blockers, row.mapped === true, `a31_hidden_surface_unmapped:${row.surfaceId}`);
    add(blockers, row.authorizedRoleIds.every((id) => roleSet.has(id)) && row.authorizedRoleIds.length > 0, `a31_hidden_surface_roles_invalid:${row.surfaceId}`);
    add(blockers, validDigest(row.sourceEvidenceSha256) && validDigest(row.authorizationReceiptSha256), `a31_hidden_surface_evidence_invalid:${row.surfaceId}`);
  }

  const coverage = input?.coverage ?? {};
  const criticalMapped = criticalEntryPoints.filter((row) => row.authorizationVerified === true).length;
  const roleHolderBound = roles.filter((row) => validDigest(row.holderStateReceiptSha256)).length;
  add(blockers, coverage.criticalEntryPointTotal === criticalEntryPoints.length && coverage.criticalEntryPointCovered === criticalMapped, "a31_critical_entry_point_denominator_mismatch");
  add(blockers, ratio(criticalMapped, criticalEntryPoints.length) >= policy.thresholds.criticalEntryPointCoverage, "a31_critical_entry_point_coverage_below_floor");
  add(blockers, coverage.roleTotal === roles.length && coverage.roleHolderEvidenceCovered === roleHolderBound, "a31_role_holder_denominator_mismatch");
  add(blockers, ratio(roleHolderBound, roles.length) >= policy.thresholds.roleHolderEvidenceCoverage, "a31_role_holder_coverage_below_floor");
  add(blockers, coverage.hiddenSurfaceTotal === hidden.length && coverage.hiddenSurfaceMapped === hidden.filter((row) => row.mapped).length, "a31_hidden_surface_denominator_mismatch");

  const replays = Array.isArray(input?.privilegeReplayRuns) ? input.privilegeReplayRuns : [];
  add(blockers, replays.length >= policy.thresholds.minimumReplayRuns, "a31_replay_count_below_floor");
  add(blockers, replays.map((row) => row.runIndex).every(integer) && unique(replays.map((row) => row.runIndex)), "a31_replay_indices_invalid_or_duplicate");
  for (const row of replays) {
    add(blockers, validDigest(row.inputSha256) && validDigest(row.outputSha256) && validDigest(row.coverageSha256) && row.passed === true, `a31_replay_invalid:${row.runIndex}`);
  }
  if (replays.length > 0) {
    add(blockers, new Set(replays.map((row) => row.inputSha256)).size === 1, "a31_replay_input_drift");
    add(blockers, new Set(replays.map((row) => row.outputSha256)).size === 1, "a31_replay_output_drift");
    add(blockers, new Set(replays.map((row) => row.coverageSha256)).size === 1, "a31_replay_coverage_drift");
  }

  const mutation = input?.mutationEvidence ?? {};
  add(blockers, integer(mutation.total) && mutation.total > 0 && integer(mutation.killed) && mutation.killed <= mutation.total, "a31_mutation_counts_invalid");
  add(blockers, ratio(mutation.killed, mutation.total) >= policy.thresholds.mutationKillRate, "a31_mutation_score_below_floor");
  add(blockers, validDigest(mutation.registrySha256) && validDigest(mutation.receiptSha256), "a31_mutation_binding_invalid");

  add(blockers, input?.currentOnchainRoleStateProven === false, "a31_current_onchain_claim_forbidden");
  add(blockers, input?.manualAuthorizationReviewed === false, "a31_manual_review_claim_forbidden");
  add(blockers, input?.allHiddenPrivilegesExcluded === false, "a31_hidden_privilege_completeness_claim_forbidden");
  add(blockers, input?.independentRerun === false, "a31_independent_rerun_claim_forbidden");
  add(blockers, input?.paidGateEligible === false, "a31_paid_gate_claim_forbidden");

  const reportCore = {
    schemaVersion: REPORT_SCHEMA,
    passId: "PASS35_A31",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    eligibleLocalEvidenceContract: blockers.length === 0,
    blockers: [...new Set(blockers)].sort(),
    counts: { principals: principals.length, roles: roles.length, roleAdminEdges: adminEdges.length, privilegedEntryPoints: entryPoints.length, separationRules: separationRules.length, escalationScenarios: escalations.length, hiddenPrivilegedSurfaces: hidden.length },
    coverage: { criticalEntryPointTotal: criticalEntryPoints.length, criticalEntryPointCovered: criticalMapped, criticalEntryPointRatio: ratio(criticalMapped, criticalEntryPoints.length), roleTotal: roles.length, roleHolderEvidenceCovered: roleHolderBound, roleHolderEvidenceRatio: ratio(roleHolderBound, roles.length), hiddenSurfaceTotal: hidden.length, hiddenSurfaceMapped: hidden.filter((row) => row.mapped).length, hiddenSurfaceRatio: ratio(hidden.filter((row) => row.mapped).length, hidden.length) },
    claims: { currentOnchainRoleStateProven: false, manualAuthorizationReviewed: false, allHiddenPrivilegesExcluded: false, independentRerun: false, paidGateEligible: false, sellEnabled: false },
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

const d = (value) => digest(value);
const addr = (value) => `0x${String(value).padStart(40, "0")}`;
function baseInput(caseRef) {
  const principals = [
    ["PRINCIPAL_GOV_MSIG", "MULTISIG", 3, 2, 0],
    ["PRINCIPAL_TIMELOCK", "TIMELOCK", 0, 0, 86400],
    ["PRINCIPAL_GUARDIAN", "EOA", 0, 0, 0],
    ["PRINCIPAL_TREASURY", "MULTISIG", 4, 3, 0],
    ["PRINCIPAL_ORACLE", "CONTRACT", 0, 0, 0],
    ["PRINCIPAL_OPERATOR", "EOA", 0, 0, 0],
    ["PRINCIPAL_ROLE_ALIAS", "ROLE_ALIAS", 0, 0, 0]
  ].map(([principalId, principalType, ownerCount, threshold, minimumDelaySeconds], index) => ({ principalId, principalType, address: principalType === "ROLE_ALIAS" ? null : addr(1000 + index), ownerCount, threshold, minimumDelaySeconds, identityEvidenceSha256: d(`${caseRef}:principal:${index}:identity`), currentStateEvidenceSha256: d(`${caseRef}:principal:${index}:state`) }));
  const roles = [
    ["ROLE_DEFAULT_ADMIN", "DEFAULT_ADMIN", ["PRINCIPAL_TIMELOCK"], true],
    ["ROLE_OWNER", "OWNER", ["PRINCIPAL_GOV_MSIG"], true],
    ["ROLE_UPGRADER", "UPGRADER", ["PRINCIPAL_TIMELOCK"], true],
    ["ROLE_PAUSER", "PAUSER", ["PRINCIPAL_GUARDIAN"], true],
    ["ROLE_MINTER", "MINTER", ["PRINCIPAL_OPERATOR"], true],
    ["ROLE_TREASURER", "TREASURER", ["PRINCIPAL_TREASURY"], true],
    ["ROLE_GUARDIAN", "GUARDIAN", ["PRINCIPAL_GUARDIAN"], false],
    ["ROLE_OPERATOR", "OPERATOR", ["PRINCIPAL_OPERATOR"], false],
    ["ROLE_ORACLE_ADMIN", "ORACLE_ADMIN", ["PRINCIPAL_ORACLE"], true]
  ].map(([roleId, roleType, holderPrincipalIds, critical], index) => ({ roleId, roleType, holderPrincipalIds, critical, roleConstantSha256: d(`${caseRef}:role:${index}:constant`), sourceEvidenceSha256: d(`${caseRef}:role:${index}:source`), abiEvidenceSha256: d(`${caseRef}:role:${index}:abi`), holderStateReceiptSha256: d(`${caseRef}:role:${index}:holders`) }));
  const roleAdminEdges = [
    ["EDGE_ADMIN_SELF", "ROLE_DEFAULT_ADMIN", "ROLE_DEFAULT_ADMIN"],
    ["EDGE_ADMIN_OWNER", "ROLE_DEFAULT_ADMIN", "ROLE_OWNER"],
    ["EDGE_ADMIN_UPGRADER", "ROLE_DEFAULT_ADMIN", "ROLE_UPGRADER"],
    ["EDGE_ADMIN_PAUSER", "ROLE_DEFAULT_ADMIN", "ROLE_PAUSER"],
    ["EDGE_ADMIN_MINTER", "ROLE_DEFAULT_ADMIN", "ROLE_MINTER"],
    ["EDGE_ADMIN_TREASURER", "ROLE_DEFAULT_ADMIN", "ROLE_TREASURER"],
    ["EDGE_OWNER_OPERATOR", "ROLE_OWNER", "ROLE_OPERATOR"],
    ["EDGE_OWNER_ORACLE", "ROLE_OWNER", "ROLE_ORACLE_ADMIN"],
    ["EDGE_OWNER_GUARDIAN", "ROLE_OWNER", "ROLE_GUARDIAN"]
  ].map(([edgeId, adminRoleId, managedRoleId], index) => ({ edgeId, adminRoleId, managedRoleId, evidenceSha256: d(`${caseRef}:admin-edge:${index}`) }));
  const privilegedEntryPoints = [
    ["EP_UPGRADE", "0x3659cfe6", "TIMELOCK", ["ROLE_UPGRADER"], "CRITICAL", ["UPGRADE"]],
    ["EP_GRANT_ROLE", "0x2f2ff15d", "TIMELOCK", ["ROLE_DEFAULT_ADMIN"], "CRITICAL", ["GRANT_ROLE"]],
    ["EP_REVOKE_ROLE", "0xd547741f", "TIMELOCK", ["ROLE_DEFAULT_ADMIN"], "CRITICAL", ["REVOKE_ROLE"]],
    ["EP_PAUSE", "0x8456cb59", "ROLE", ["ROLE_PAUSER"], "HIGH", ["PAUSE"]],
    ["EP_UNPAUSE", "0x3f4ba83a", "ROLE", ["ROLE_PAUSER"], "HIGH", ["UNPAUSE"]],
    ["EP_MINT", "0x40c10f19", "ROLE", ["ROLE_MINTER"], "CRITICAL", ["MINT"]],
    ["EP_TREASURY", "0xb61d27f6", "MULTISIG", ["ROLE_TREASURER"], "CRITICAL", ["TRANSFER_FUNDS", "ARBITRARY_CALL"]],
    ["EP_ORACLE", "0x7b8a1f3d", "ROLE", ["ROLE_ORACLE_ADMIN"], "CRITICAL", ["CHANGE_ORACLE"]],
    ["EP_FEES", "0x69fe0e2d", "OWNER", ["ROLE_OWNER"], "HIGH", ["CHANGE_FEES"]],
    ["EP_RESCUE", "0x85fb709d", "MULTISIG", ["ROLE_TREASURER"], "HIGH", ["RESCUE"]],
    ["EP_BLACKLIST", "0xe47d6060", "ROLE", ["ROLE_GUARDIAN"], "HIGH", ["BLACKLIST"]]
  ].map(([entryPointId, selector, accessMode, requiredRoleIds, criticality, effects], index) => ({ entryPointId, selector, accessMode, requiredRoleIds, criticality, effects, authorizationVerified: true, sourceEvidenceSha256: d(`${caseRef}:entry:${index}:source`), abiEvidenceSha256: d(`${caseRef}:entry:${index}:abi`), authorizationReceiptSha256: d(`${caseRef}:entry:${index}:auth`) }));
  const separationOfDuties = [
    ["SOD_UPGRADE_PAUSE", ["ROLE_UPGRADER", "ROLE_PAUSER"]],
    ["SOD_MINT_TREASURY", ["ROLE_MINTER", "ROLE_TREASURER"]],
    ["SOD_ORACLE_TREASURY", ["ROLE_ORACLE_ADMIN", "ROLE_TREASURER"]],
    ["SOD_DEFAULT_ADMIN_MINTER", ["ROLE_DEFAULT_ADMIN", "ROLE_MINTER"]],
    ["SOD_OWNER_OPERATOR", ["ROLE_OWNER", "ROLE_OPERATOR"]]
  ].map(([ruleId, incompatibleRoleIds], index) => ({ ruleId, incompatibleRoleIds, violationDetected: false, evaluationReceiptSha256: d(`${caseRef}:sod:${index}`) }));
  const escalationScenarios = [
    ["ESC_OPERATOR_TO_MINTER", "PRINCIPAL_OPERATOR", "ROLE_MINTER", ["ROLE_OPERATOR", "ROLE_MINTER"], "CONTAINED"],
    ["ESC_GUARDIAN_TO_UPGRADER", "PRINCIPAL_GUARDIAN", "ROLE_UPGRADER", ["ROLE_GUARDIAN", "ROLE_PAUSER", "ROLE_UPGRADER"], "BLOCKED"],
    ["ESC_TREASURY_TO_ADMIN", "PRINCIPAL_TREASURY", "ROLE_DEFAULT_ADMIN", ["ROLE_TREASURER", "ROLE_OWNER", "ROLE_DEFAULT_ADMIN"], "BLOCKED"],
    ["ESC_ORACLE_TO_OWNER", "PRINCIPAL_ORACLE", "ROLE_OWNER", ["ROLE_ORACLE_ADMIN", "ROLE_OWNER"], "BLOCKED"],
    ["ESC_GOV_TO_UPGRADER", "PRINCIPAL_GOV_MSIG", "ROLE_UPGRADER", ["ROLE_OWNER", "ROLE_DEFAULT_ADMIN", "ROLE_UPGRADER"], "POSSIBLE_WITH_PREREQUISITES"],
    ["ESC_TIMELOCK_TO_OWNER", "PRINCIPAL_TIMELOCK", "ROLE_OWNER", ["ROLE_DEFAULT_ADMIN", "ROLE_OWNER"], "POSSIBLE_WITH_PREREQUISITES"]
  ].map(([scenarioId, startPrincipalId, targetRoleId, pathRoleIds, result], index) => ({ scenarioId, startPrincipalId, targetRoleId, pathRoleIds, result, prerequisiteReceiptSha256s: result === "POSSIBLE_WITH_PREREQUISITES" ? [d(`${caseRef}:escalation:${index}:prereq`)] : [], pathReceiptSha256: d(`${caseRef}:escalation:${index}:path`), mitigationReceiptSha256: d(`${caseRef}:escalation:${index}:mitigation`) }));
  const hiddenPrivilegedSurfaces = [
    ["SURFACE_DELEGATECALL", "DELEGATECALL", ["ROLE_UPGRADER"]],
    ["SURFACE_ARBITRARY_CALL", "ARBITRARY_CALL", ["ROLE_TREASURER"]],
    ["SURFACE_ASSEMBLY_SLOT", "ASSEMBLY_SLOT_WRITE", ["ROLE_DEFAULT_ADMIN"]],
    ["SURFACE_FALLBACK_ROUTER", "FALLBACK_ROUTER", ["ROLE_OWNER"]]
  ].map(([surfaceId, surfaceType, authorizedRoleIds], index) => ({ surfaceId, surfaceType, authorizedRoleIds, mapped: true, sourceEvidenceSha256: d(`${caseRef}:hidden:${index}:source`), authorizationReceiptSha256: d(`${caseRef}:hidden:${index}:auth`) }));
  return {
    schemaVersion: INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef,
    target: { chainId: 1, blockNumber: 19000000, contractAddress: addr(1200), blockHashSha256: d(`${caseRef}:block`), sourceBundleSha256: d(`${caseRef}:source`), runtimeBytecodeSha256: d(`${caseRef}:runtime`), deploymentReceiptSha256: d(`${caseRef}:deploy`), a29OperationsReceiptSha256: d(`${caseRef}:a29`), a30ThreatModelReceiptSha256: d(`${caseRef}:a30`), roleStateSnapshotSha256: d(`${caseRef}:role-state`) },
    principals,
    roles,
    roleAdminEdges,
    privilegedEntryPoints,
    proxyAuthority: { proxyType: "TRANSPARENT", implementationSlotReceiptSha256: d(`${caseRef}:proxy:impl`), adminSlotReceiptSha256: d(`${caseRef}:proxy:admin`), beaconSlotReceiptSha256: null, upgradeRoleId: "ROLE_UPGRADER", adminPrincipalId: "PRINCIPAL_TIMELOCK", authorizationPathReceiptSha256: d(`${caseRef}:proxy:path`) },
    delegation: { multisigPrincipalId: "PRINCIPAL_GOV_MSIG", timelockPrincipalId: "PRINCIPAL_TIMELOCK", delegatedRoleId: "ROLE_DEFAULT_ADMIN", directBypassAllowed: false, multisigConfigurationReceiptSha256: d(`${caseRef}:delegation:multisig`), timelockConfigurationReceiptSha256: d(`${caseRef}:delegation:timelock`), delegationReceiptSha256: d(`${caseRef}:delegation:receipt`) },
    separationOfDuties,
    escalationScenarios,
    privilegeLifecycle: { grantRoleVerified: true, revokeRoleVerified: true, renounceRoleVerified: true, emergencyRevokeVerified: true, adminRecoveryVerified: true, noOrphanedCriticalRole: true, grantReceiptSha256: d(`${caseRef}:lifecycle:grant`), revokeReceiptSha256: d(`${caseRef}:lifecycle:revoke`), renounceReceiptSha256: d(`${caseRef}:lifecycle:renounce`), emergencyReceiptSha256: d(`${caseRef}:lifecycle:emergency`), recoveryReceiptSha256: d(`${caseRef}:lifecycle:recovery`) },
    hiddenPrivilegedSurfaces,
    coverage: { criticalEntryPointTotal: 11, criticalEntryPointCovered: 11, roleTotal: 9, roleHolderEvidenceCovered: 9, hiddenSurfaceTotal: 4, hiddenSurfaceMapped: 4 },
    privilegeReplayRuns: [0, 1, 2].map((runIndex) => ({ runIndex, inputSha256: d(`${caseRef}:replay-input`), outputSha256: d(`${caseRef}:replay-output`), coverageSha256: d(`${caseRef}:replay-coverage`), passed: true })),
    mutationEvidence: { total: 100, killed: 100, registrySha256: d(`${caseRef}:mutation-registry`), receiptSha256: d(`${caseRef}:mutation-receipt`) },
    currentOnchainRoleStateProven: false,
    manualAuthorizationReviewed: false,
    allHiddenPrivilegesExcluded: false,
    independentRerun: false,
    paidGateEligible: false
  };
}

const faultMutators = {
  CASE_TARGET_ROLE_STATE_BINDING: (v) => { v.target.roleStateSnapshotSha256 = "sha256:bad"; },
  ROLE_HOLDER_SOURCE_EVIDENCE: (v) => { v.roles[0].holderStateReceiptSha256 = "sha256:bad"; },
  SELECTOR_PERMISSION_COVERAGE: (v) => { v.privilegedEntryPoints[0].authorizationVerified = false; v.coverage.criticalEntryPointCovered = 10; },
  ROLE_ADMIN_GRAPH_INTEGRITY: (v) => { v.roleAdminEdges.push({ edgeId: "EDGE_CYCLE", adminRoleId: "ROLE_OPERATOR", managedRoleId: "ROLE_OWNER", evidenceSha256: d(`${v.caseRef}:cycle`) }); },
  PROXY_ADMIN_AUTHORITY_BINDING: (v) => { v.proxyAuthority.adminSlotReceiptSha256 = "sha256:bad"; },
  MULTISIG_TIMELOCK_DELEGATION: (v) => { v.delegation.directBypassAllowed = true; },
  SEPARATION_OF_DUTIES: (v) => { v.roles.find((r) => r.roleId === "ROLE_MINTER").holderPrincipalIds = ["PRINCIPAL_TREASURY"]; },
  PRIVILEGE_ESCALATION_PATHS: (v) => { v.escalationScenarios[0].targetRoleId = "ROLE_MISSING"; },
  REVOKE_RENOUNCE_RECOVERY_CONTROLS: (v) => { v.privilegeLifecycle.emergencyRevokeVerified = false; },
  HIDDEN_PRIVILEGED_SURFACE_DETECTION: (v) => { v.hiddenPrivilegedSurfaces[0].mapped = false; v.coverage.hiddenSurfaceMapped = 3; },
  DETERMINISTIC_PRIVILEGE_REPLAY: (v) => { v.privilegeReplayRuns[2].outputSha256 = d(`${v.caseRef}:replay-drift`); },
  MUTATION_EVIDENCE: (v) => { v.mutationEvidence.killed = 50; }
};
const mutationMutators = [
  (v) => { v.target.sourceBundleSha256 = "sha256:bad"; },
  (v) => { v.roles[1].sourceEvidenceSha256 = "sha256:bad"; },
  (v) => { v.privilegedEntryPoints[1].selector = "0x123"; },
  (v) => { v.roleAdminEdges.push({ edgeId: "EDGE_BACK", adminRoleId: "ROLE_OPERATOR", managedRoleId: "ROLE_OWNER", evidenceSha256: d(`${v.caseRef}:back`) }); },
  (v) => { v.proxyAuthority.authorizationPathReceiptSha256 = "sha256:bad"; },
  (v) => { v.principals.find((p) => p.principalId === "PRINCIPAL_GOV_MSIG").threshold = 1; },
  (v) => { v.separationOfDuties[0].violationDetected = true; },
  (v) => { v.escalationScenarios[1].pathReceiptSha256 = "sha256:bad"; },
  (v) => { v.privilegeLifecycle.revokeReceiptSha256 = "sha256:bad"; },
  (v) => { v.hiddenPrivilegedSurfaces[1].authorizedRoleIds = []; },
  (v) => { v.privilegeReplayRuns[1].coverageSha256 = d(`${v.caseRef}:coverage-drift`); },
  (v) => { v.mutationEvidence.receiptSha256 = "sha256:bad"; }
];

export function runA31Benchmark(policy) {
  if (!verifyA31Policy(policy)) throw new Error("a31_policy_invalid");
  const cases = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const caseRef = `AUD-A31-${family.replaceAll("_", "-")}-${String(index).padStart(2, "0")}`;
      const input = baseInput(caseRef);
      if (!expectedEligible) faultMutators[family](input);
      const report = analyzeA31PrivilegeControl(input, policy);
      cases.push({ family, index, frozen: index >= 10, expectedEligible, observedEligible: report.eligibleLocalEvidenceContract, blockers: report.blockers, reportIntegritySha256: report.integritySha256, inputSha256: digest(input), input });
    }
  }
  let correct = 0; let frozenCorrect = 0; let frozenTotal = 0; let unsafeEligible = 0; let falseBlocks = 0; let killed = 0; let mutationTotal = 0;
  for (const row of cases) {
    const match = row.expectedEligible === row.observedEligible;
    if (match) correct += 1;
    if (row.frozen) { frozenTotal += 1; if (match) frozenCorrect += 1; if (!row.expectedEligible && row.observedEligible) unsafeEligible += 1; if (row.expectedEligible && !row.observedEligible) falseBlocks += 1; }
    for (const mutate of mutationMutators) {
      const mutated = row.expectedEligible ? clone(row.input) : baseInput(row.input.caseRef);
      if (row.expectedEligible) mutate(mutated);
      const mutatedReport = analyzeA31PrivilegeControl(mutated, policy);
      mutationTotal += 1;
      if (mutatedReport.eligibleLocalEvidenceContract !== row.expectedEligible) killed += 1;
    }
  }
  const reportCore = {
    schemaVersion: BENCHMARK_SCHEMA,
    passId: "PASS35_A31",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: cases.length, frozen: frozenTotal, mutations: mutationTotal, families: policy.benchmark.families.length },
    development: { accuracy: ratio(correct, cases.length), correct, total: cases.length, wilson95: wilson(correct, cases.length) },
    frozen: { accuracy: ratio(frozenCorrect, frozenTotal), correct: frozenCorrect, total: frozenTotal, unsafeEligible, falseBlocks, wilson95: wilson(frozenCorrect, frozenTotal) },
    mutation: { killed, total: mutationTotal, killRate: ratio(killed, mutationTotal) },
    claims: { currentOnchainRoleStateProven: false, manualAuthorizationReviewed: false, allHiddenPrivilegesExcluded: false, independentRerun: false, paidGateEligible: false, sellEnabled: false },
    cases: cases.map(({ input, ...row }) => row),
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

export function verifyA31Benchmark(report, policy) {
  try {
    return verifyA31Policy(policy)
      && report?.schemaVersion === BENCHMARK_SCHEMA
      && report?.passId === "PASS35_A31"
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
      && report.claims.currentOnchainRoleStateProven === false
      && report.claims.manualAuthorizationReviewed === false
      && report.claims.allHiddenPrivilegesExcluded === false
      && report.claims.independentRerun === false
      && report.claims.paidGateEligible === false
      && report.claims.sellEnabled === false
      && report.integritySha256 === digest(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "integritySha256")));
  } catch { return false; }
}
