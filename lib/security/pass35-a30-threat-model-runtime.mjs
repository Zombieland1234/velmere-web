import { createHash } from "node:crypto";

const INPUT_SCHEMA = "velmere.pass35.a30-threat-model-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a30-threat-model-report.v1";
const BENCHMARK_SCHEMA = "velmere.pass35.a30-threat-model-benchmark.v1";
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const ADDRESS = /^0x[a-f0-9]{40}$/u;
const ID = /^[A-Z][A-Z0-9_]{2,80}$/u;
const CASE_REF = /^AUD-A30-[A-Z0-9-]{6,72}$/u;
const COMPONENT_TYPES = new Set(["CONTRACT", "PROXY", "ORACLE", "TOKEN", "VAULT", "DEX", "BRIDGE", "GOVERNANCE", "EXTERNAL_SERVICE"]);
const ASSET_TYPES = new Set(["FUNDS", "SUPPLY", "GOVERNANCE", "PRICE", "USER_DATA", "UPGRADE_CONTROL", "ACCOUNTING_STATE"]);
const ACTOR_TYPES = new Set(["USER", "ADMIN", "KEEPER", "ORACLE", "BRIDGE_RELAYER", "GOVERNANCE", "ATTACKER", "EXTERNAL_PROTOCOL"]);
const ACCESS_MODES = new Set(["PUBLIC", "ROLE", "OWNER", "MULTISIG", "TIMELOCK", "INTERNAL"]);
const ASSUMPTION_TYPES = new Set(["PROTOCOL", "MARKET", "ORACLE", "GOVERNANCE", "DEPENDENCY", "OPERATIONS"]);
const CRITICALITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const THREAT_CATEGORIES = new Set(["SPOOFING", "TAMPERING", "REPUDIATION", "INFORMATION_DISCLOSURE", "DENIAL_OF_SERVICE", "ELEVATION_OF_PRIVILEGE", "ECONOMIC_MANIPULATION"]);

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

export function verifyA30Policy(policy) {
  try {
    return policy?.schemaVersion === "velmere.pass35.a30-threat-model-policy.v1"
      && policy?.passId === "PASS35_A30"
      && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy?.sourceRevisionId ?? ""))
      && Array.isArray(policy.allowedInputClasses) && policy.allowedInputClasses.length === 2
      && Array.isArray(policy.requiredControlFamilies) && policy.requiredControlFamilies.length === 12 && unique(policy.requiredControlFamilies)
      && policy.thresholds.minimumComponents >= 5
      && policy.thresholds.minimumAssets >= 5
      && policy.thresholds.minimumActors >= 5
      && policy.thresholds.minimumTrustBoundaries >= 4
      && policy.thresholds.minimumDataFlows >= 6
      && policy.thresholds.minimumEntryPoints >= 6
      && policy.thresholds.minimumAssumptions >= 5
      && policy.thresholds.minimumInvariants >= 6
      && policy.thresholds.minimumAbuseCases >= 8
      && policy.thresholds.minimumReplayRuns >= 3
      && policy.thresholds.mutationKillRate >= 0.9 && policy.thresholds.mutationKillRate <= 1
      && policy.thresholds.requireUniqueIds === true
      && policy.thresholds.requireAcyclicAttackPaths === true
      && policy.thresholds.requireAssumptionInvalidationTriggers === true
      && policy.thresholds.requireResidualRiskAndLimitations === true
      && policy.thresholds.requireClaimBoundary === true
      && Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 12 && unique(policy.benchmark.families)
      && Array.isArray(policy.benchmark?.mutationTypes) && policy.benchmark.mutationTypes.length === 12 && unique(policy.benchmark.mutationTypes)
      && policy.benchmark.expectedCases === 192
      && policy.benchmark.expectedFrozen === 72
      && policy.benchmark.expectedMutations === 2304
      && typeof policy.truthBoundary === "string" && policy.truthBoundary.length > 180;
  } catch { return false; }
}

export function analyzeA30ThreatModel(input, policy) {
  if (!verifyA30Policy(policy)) throw new Error("a30_policy_invalid");
  const blockers = [];
  add(blockers, input?.schemaVersion === INPUT_SCHEMA, "a30_schema_invalid");
  add(blockers, policy.allowedInputClasses.includes(input?.inputClass), "a30_input_class_invalid");
  add(blockers, CASE_REF.test(String(input?.caseRef ?? "")), "a30_case_ref_invalid");
  const target = input?.target ?? {};
  add(blockers, integer(target.chainId) && target.chainId > 0, "a30_chain_id_invalid");
  add(blockers, integer(target.blockNumber) && target.blockNumber > 0, "a30_block_number_invalid");
  add(blockers, validAddress(target.contractAddress), "a30_contract_address_invalid");
  for (const field of ["blockHashSha256", "sourceBundleSha256", "runtimeBytecodeSha256", "deploymentReceiptSha256", "architectureSha256", "a29OperationsReceiptSha256"]) add(blockers, validDigest(target[field]), `a30_target_${field}_invalid`);

  const components = Array.isArray(input?.components) ? input.components : [];
  const componentIds = components.map((row) => row.componentId);
  add(blockers, components.length >= policy.thresholds.minimumComponents, "a30_component_count_below_floor");
  add(blockers, !policy.thresholds.requireUniqueIds || (componentIds.every(validId) && unique(componentIds)), "a30_component_ids_invalid_or_duplicate");
  for (const row of components) {
    add(blockers, COMPONENT_TYPES.has(row.componentType), `a30_component_type_invalid:${row.componentId}`);
    add(blockers, validDigest(row.evidenceSha256), `a30_component_evidence_invalid:${row.componentId}`);
  }
  const componentSet = new Set(componentIds);

  const assets = Array.isArray(input?.assets) ? input.assets : [];
  const assetIds = assets.map((row) => row.assetId);
  add(blockers, assets.length >= policy.thresholds.minimumAssets, "a30_asset_count_below_floor");
  add(blockers, !policy.thresholds.requireUniqueIds || (assetIds.every(validId) && unique(assetIds)), "a30_asset_ids_invalid_or_duplicate");
  for (const row of assets) {
    add(blockers, ASSET_TYPES.has(row.assetType), `a30_asset_type_invalid:${row.assetId}`);
    add(blockers, CRITICALITIES.has(row.criticality), `a30_asset_criticality_invalid:${row.assetId}`);
    add(blockers, componentSet.has(row.custodianComponentId), `a30_asset_custodian_missing:${row.assetId}`);
    add(blockers, validDigest(row.evidenceSha256), `a30_asset_evidence_invalid:${row.assetId}`);
  }
  const assetSet = new Set(assetIds);

  const actors = Array.isArray(input?.actors) ? input.actors : [];
  const actorIds = actors.map((row) => row.actorId);
  add(blockers, actors.length >= policy.thresholds.minimumActors, "a30_actor_count_below_floor");
  add(blockers, !policy.thresholds.requireUniqueIds || (actorIds.every(validId) && unique(actorIds)), "a30_actor_ids_invalid_or_duplicate");
  for (const row of actors) {
    add(blockers, ACTOR_TYPES.has(row.actorType), `a30_actor_type_invalid:${row.actorId}`);
    add(blockers, ["UNTRUSTED", "CONDITIONAL", "TRUSTED_PRIVILEGED"].includes(row.trustLevel), `a30_actor_trust_invalid:${row.actorId}`);
    add(blockers, validDigest(row.evidenceSha256), `a30_actor_evidence_invalid:${row.actorId}`);
  }
  const actorSet = new Set(actorIds);

  const entryPoints = Array.isArray(input?.entryPoints) ? input.entryPoints : [];
  const entryPointIds = entryPoints.map((row) => row.entryPointId);
  add(blockers, entryPoints.length >= policy.thresholds.minimumEntryPoints, "a30_entry_point_count_below_floor");
  add(blockers, entryPointIds.every(validId) && unique(entryPointIds), "a30_entry_point_ids_invalid_or_duplicate");
  for (const row of entryPoints) {
    add(blockers, componentSet.has(row.componentId), `a30_entry_point_component_missing:${row.entryPointId}`);
    add(blockers, /^0x[a-f0-9]{8}$/u.test(String(row.selector ?? "")), `a30_entry_point_selector_invalid:${row.entryPointId}`);
    add(blockers, ACCESS_MODES.has(row.accessMode), `a30_entry_point_access_invalid:${row.entryPointId}`);
    add(blockers, typeof row.stateChanging === "boolean", `a30_entry_point_state_flag_invalid:${row.entryPointId}`);
    add(blockers, validDigest(row.evidenceSha256), `a30_entry_point_evidence_invalid:${row.entryPointId}`);
  }
  const entryPointSet = new Set(entryPointIds);

  const flows = Array.isArray(input?.dataFlows) ? input.dataFlows : [];
  const flowIds = flows.map((row) => row.flowId);
  add(blockers, flows.length >= policy.thresholds.minimumDataFlows, "a30_data_flow_count_below_floor");
  add(blockers, flowIds.every(validId) && unique(flowIds), "a30_data_flow_ids_invalid_or_duplicate");
  for (const row of flows) {
    add(blockers, componentSet.has(row.fromComponentId) && componentSet.has(row.toComponentId), `a30_flow_component_missing:${row.flowId}`);
    add(blockers, Array.isArray(row.assetIds) && row.assetIds.length > 0 && row.assetIds.every((id) => assetSet.has(id)), `a30_flow_asset_binding_invalid:${row.flowId}`);
    add(blockers, entryPointSet.has(row.entryPointId), `a30_flow_entry_point_missing:${row.flowId}`);
    add(blockers, validDigest(row.evidenceSha256), `a30_flow_evidence_invalid:${row.flowId}`);
  }
  const flowSet = new Set(flowIds);

  const boundaries = Array.isArray(input?.trustBoundaries) ? input.trustBoundaries : [];
  const boundaryIds = boundaries.map((row) => row.boundaryId);
  add(blockers, boundaries.length >= policy.thresholds.minimumTrustBoundaries, "a30_boundary_count_below_floor");
  add(blockers, boundaryIds.every(validId) && unique(boundaryIds), "a30_boundary_ids_invalid_or_duplicate");
  for (const row of boundaries) {
    add(blockers, componentSet.has(row.fromComponentId) && componentSet.has(row.toComponentId) && row.fromComponentId !== row.toComponentId, `a30_boundary_component_invalid:${row.boundaryId}`);
    add(blockers, Array.isArray(row.dataFlowIds) && row.dataFlowIds.length > 0 && row.dataFlowIds.every((id) => flowSet.has(id)), `a30_boundary_flow_binding_invalid:${row.boundaryId}`);
    add(blockers, ACCESS_MODES.has(row.authenticationMode), `a30_boundary_auth_invalid:${row.boundaryId}`);
    add(blockers, validDigest(row.validationReceiptSha256), `a30_boundary_receipt_invalid:${row.boundaryId}`);
  }
  const boundarySet = new Set(boundaryIds);

  const assumptions = Array.isArray(input?.assumptions) ? input.assumptions : [];
  const assumptionIds = assumptions.map((row) => row.assumptionId);
  add(blockers, assumptions.length >= policy.thresholds.minimumAssumptions, "a30_assumption_count_below_floor");
  add(blockers, assumptionIds.every(validId) && unique(assumptionIds), "a30_assumption_ids_invalid_or_duplicate");
  for (const row of assumptions) {
    add(blockers, ASSUMPTION_TYPES.has(row.assumptionType), `a30_assumption_type_invalid:${row.assumptionId}`);
    add(blockers, validDigest(row.statementSha256) && validDigest(row.evidenceSha256), `a30_assumption_binding_invalid:${row.assumptionId}`);
    add(blockers, !policy.thresholds.requireAssumptionInvalidationTriggers || validDigest(row.invalidationTriggerSha256), `a30_assumption_trigger_missing:${row.assumptionId}`);
  }
  const assumptionSet = new Set(assumptionIds);

  const invariants = Array.isArray(input?.invariants) ? input.invariants : [];
  const invariantIds = invariants.map((row) => row.invariantId);
  add(blockers, invariants.length >= policy.thresholds.minimumInvariants, "a30_invariant_count_below_floor");
  add(blockers, invariantIds.every(validId) && unique(invariantIds), "a30_invariant_ids_invalid_or_duplicate");
  for (const row of invariants) {
    add(blockers, CRITICALITIES.has(row.criticality), `a30_invariant_criticality_invalid:${row.invariantId}`);
    add(blockers, Array.isArray(row.assetIds) && row.assetIds.length > 0 && row.assetIds.every((id) => assetSet.has(id)), `a30_invariant_assets_invalid:${row.invariantId}`);
    add(blockers, Array.isArray(row.componentIds) && row.componentIds.length > 0 && row.componentIds.every((id) => componentSet.has(id)), `a30_invariant_components_invalid:${row.invariantId}`);
    add(blockers, validDigest(row.evidenceSha256) && validDigest(row.testReceiptSha256), `a30_invariant_receipt_invalid:${row.invariantId}`);
  }

  const abuseCases = Array.isArray(input?.abuseCases) ? input.abuseCases : [];
  const abuseIds = abuseCases.map((row) => row.abuseCaseId);
  add(blockers, abuseCases.length >= policy.thresholds.minimumAbuseCases, "a30_abuse_case_count_below_floor");
  add(blockers, abuseIds.every(validId) && unique(abuseIds), "a30_abuse_case_ids_invalid_or_duplicate");
  const allStepIds = [];
  const attackEdges = [];
  for (const row of abuseCases) {
    add(blockers, THREAT_CATEGORIES.has(row.category), `a30_abuse_category_invalid:${row.abuseCaseId}`);
    add(blockers, actorSet.has(row.actorId), `a30_abuse_actor_missing:${row.abuseCaseId}`);
    add(blockers, Array.isArray(row.entryPointIds) && row.entryPointIds.length > 0 && row.entryPointIds.every((id) => entryPointSet.has(id)), `a30_abuse_entry_points_invalid:${row.abuseCaseId}`);
    add(blockers, Array.isArray(row.targetAssetIds) && row.targetAssetIds.length > 0 && row.targetAssetIds.every((id) => assetSet.has(id)), `a30_abuse_assets_invalid:${row.abuseCaseId}`);
    add(blockers, Array.isArray(row.preconditionIds) && row.preconditionIds.length > 0 && row.preconditionIds.every((id) => assumptionSet.has(id)), `a30_abuse_preconditions_invalid:${row.abuseCaseId}`);
    add(blockers, Array.isArray(row.affectedBoundaryIds) && row.affectedBoundaryIds.length > 0 && row.affectedBoundaryIds.every((id) => boundarySet.has(id)), `a30_abuse_boundaries_invalid:${row.abuseCaseId}`);
    const steps = Array.isArray(row.attackSteps) ? row.attackSteps : [];
    add(blockers, steps.length >= policy.thresholds.minimumAttackStepsPerAbuseCase, `a30_attack_steps_below_floor:${row.abuseCaseId}`);
    const localStepIds = steps.map((step) => step.stepId);
    add(blockers, localStepIds.every(validId) && unique(localStepIds), `a30_attack_step_ids_invalid:${row.abuseCaseId}`);
    allStepIds.push(...localStepIds);
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      add(blockers, validDigest(step.evidenceSha256), `a30_attack_step_evidence_invalid:${row.abuseCaseId}:${step.stepId}`);
      if (index > 0) attackEdges.push([steps[index - 1].stepId, step.stepId]);
    }
    const mitigations = Array.isArray(row.mitigations) ? row.mitigations : [];
    add(blockers, mitigations.length >= policy.thresholds.minimumMitigationsPerAbuseCase, `a30_mitigation_count_below_floor:${row.abuseCaseId}`);
    for (const mitigation of mitigations) add(blockers, validId(mitigation.mitigationId) && validDigest(mitigation.evidenceSha256) && validDigest(mitigation.testReceiptSha256), `a30_mitigation_invalid:${row.abuseCaseId}`);
    add(blockers, CRITICALITIES.has(row.residualRisk), `a30_residual_risk_invalid:${row.abuseCaseId}`);
    add(blockers, validDigest(row.limitationSha256), `a30_limitation_invalid:${row.abuseCaseId}`);
  }
  add(blockers, unique(allStepIds), "a30_attack_step_ids_duplicate_global");
  add(blockers, !policy.thresholds.requireAcyclicAttackPaths || !hasCycle(allStepIds, attackEdges), "a30_attack_path_cycle");

  const criticalAssets = assets.filter((row) => ["CRITICAL", "HIGH"].includes(row.criticality)).map((row) => row.assetId);
  const invariantAssetSet = new Set(invariants.flatMap((row) => row.assetIds));
  const abuseAssetSet = new Set(abuseCases.flatMap((row) => row.targetAssetIds));
  const criticalCovered = criticalAssets.filter((id) => invariantAssetSet.has(id) && abuseAssetSet.has(id)).length;
  const stateChanging = entryPoints.filter((row) => row.stateChanging).map((row) => row.entryPointId);
  const abuseEntrySet = new Set(abuseCases.flatMap((row) => row.entryPointIds));
  const stateChangingCovered = stateChanging.filter((id) => abuseEntrySet.has(id)).length;
  const abuseBoundarySet = new Set(abuseCases.flatMap((row) => row.affectedBoundaryIds));
  const boundaryCovered = boundaryIds.filter((id) => abuseBoundarySet.has(id)).length;
  const coverage = input?.coverage ?? {};
  add(blockers, coverage.criticalAssetTotal === criticalAssets.length && coverage.criticalAssetCovered === criticalCovered, "a30_critical_asset_denominator_mismatch");
  add(blockers, coverage.stateChangingEntryPointTotal === stateChanging.length && coverage.stateChangingEntryPointCovered === stateChangingCovered, "a30_entry_point_denominator_mismatch");
  add(blockers, coverage.trustBoundaryTotal === boundaryIds.length && coverage.trustBoundaryCovered === boundaryCovered, "a30_boundary_denominator_mismatch");
  add(blockers, ratio(criticalCovered, criticalAssets.length) >= policy.thresholds.minimumCriticalAssetCoverage, "a30_critical_asset_coverage_below_floor");
  add(blockers, ratio(stateChangingCovered, stateChanging.length) >= policy.thresholds.minimumStateChangingEntryPointCoverage, "a30_entry_point_coverage_below_floor");
  add(blockers, ratio(boundaryCovered, boundaryIds.length) >= policy.thresholds.minimumTrustBoundaryCoverage, "a30_boundary_coverage_below_floor");

  const replayRuns = Array.isArray(input?.threatModelReplayRuns) ? input.threatModelReplayRuns : [];
  add(blockers, replayRuns.length >= policy.thresholds.minimumReplayRuns, "a30_replay_count_below_floor");
  for (const run of replayRuns) add(blockers, integer(run.runIndex) && validDigest(run.inputSha256) && validDigest(run.outputSha256) && validDigest(run.coverageSha256) && run.passed === true, "a30_replay_run_invalid");
  if (replayRuns.length) {
    add(blockers, unique(replayRuns.map((row) => row.runIndex)), "a30_replay_index_duplicate");
    add(blockers, new Set(replayRuns.map((row) => row.inputSha256)).size === 1 && new Set(replayRuns.map((row) => row.outputSha256)).size === 1 && new Set(replayRuns.map((row) => row.coverageSha256)).size === 1, "a30_replay_nondeterministic");
  }

  const mutation = input?.mutationEvidence ?? {};
  add(blockers, integer(mutation.total) && mutation.total > 0 && integer(mutation.killed) && mutation.killed <= mutation.total, "a30_mutation_counts_invalid");
  add(blockers, ratio(mutation.killed, mutation.total) >= policy.thresholds.mutationKillRate, "a30_mutation_score_below_floor");
  add(blockers, validDigest(mutation.registrySha256) && validDigest(mutation.receiptSha256), "a30_mutation_binding_invalid");

  add(blockers, input?.protocolSpecificAssumptionsHumanValidated === false, "a30_human_assumption_validation_claim_forbidden");
  add(blockers, input?.businessLogicHumanReviewed === false, "a30_business_logic_review_claim_forbidden");
  add(blockers, input?.realArchitectureWorkshopExecuted === false, "a30_real_workshop_claim_forbidden");
  add(blockers, input?.independentRerun === false, "a30_independent_rerun_claim_forbidden");
  add(blockers, input?.paidGateEligible === false, "a30_paid_gate_claim_forbidden");

  const reportCore = {
    schemaVersion: REPORT_SCHEMA,
    passId: "PASS35_A30",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    eligibleLocalEvidenceContract: blockers.length === 0,
    blockers: [...new Set(blockers)].sort(),
    counts: { components: components.length, assets: assets.length, actors: actors.length, boundaries: boundaries.length, dataFlows: flows.length, entryPoints: entryPoints.length, assumptions: assumptions.length, invariants: invariants.length, abuseCases: abuseCases.length, attackSteps: allStepIds.length },
    coverage: { criticalAssetTotal: criticalAssets.length, criticalAssetCovered: criticalCovered, criticalAssetRatio: ratio(criticalCovered, criticalAssets.length), stateChangingEntryPointTotal: stateChanging.length, stateChangingEntryPointCovered: stateChangingCovered, stateChangingEntryPointRatio: ratio(stateChangingCovered, stateChanging.length), trustBoundaryTotal: boundaryIds.length, trustBoundaryCovered: boundaryCovered, trustBoundaryRatio: ratio(boundaryCovered, boundaryIds.length) },
    claims: { protocolSpecificAssumptionsHumanValidated: false, businessLogicHumanReviewed: false, realArchitectureWorkshopExecuted: false, everyRealWorldThreatModeled: false, independentRerun: false, paidGateEligible: false, sellEnabled: false },
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

const d = (value) => digest(value);
const addr = (value) => `0x${String(value).padStart(40, "0")}`;
function baseInput(caseRef) {
  const components = [
    ["COMP_PROXY", "PROXY"], ["COMP_CORE", "CONTRACT"], ["COMP_ORACLE", "ORACLE"], ["COMP_VAULT", "VAULT"], ["COMP_GOV", "GOVERNANCE"], ["COMP_DEX", "DEX"]
  ].map(([componentId, componentType], index) => ({ componentId, componentType, evidenceSha256: d(`${caseRef}:component:${index}`) }));
  const assets = [
    ["ASSET_FUNDS", "FUNDS", "CRITICAL", "COMP_VAULT"], ["ASSET_SUPPLY", "SUPPLY", "HIGH", "COMP_CORE"], ["ASSET_PRICE", "PRICE", "CRITICAL", "COMP_ORACLE"], ["ASSET_GOV", "GOVERNANCE", "HIGH", "COMP_GOV"], ["ASSET_UPGRADE", "UPGRADE_CONTROL", "CRITICAL", "COMP_PROXY"], ["ASSET_ACCOUNTING", "ACCOUNTING_STATE", "HIGH", "COMP_CORE"]
  ].map(([assetId, assetType, criticality, custodianComponentId], index) => ({ assetId, assetType, criticality, custodianComponentId, evidenceSha256: d(`${caseRef}:asset:${index}`) }));
  const actors = [
    ["ACT_USER", "USER", "UNTRUSTED"], ["ACT_ADMIN", "ADMIN", "TRUSTED_PRIVILEGED"], ["ACT_KEEPER", "KEEPER", "CONDITIONAL"], ["ACT_ORACLE", "ORACLE", "CONDITIONAL"], ["ACT_GOV", "GOVERNANCE", "TRUSTED_PRIVILEGED"], ["ACT_ATTACKER", "ATTACKER", "UNTRUSTED"]
  ].map(([actorId, actorType, trustLevel], index) => ({ actorId, actorType, trustLevel, evidenceSha256: d(`${caseRef}:actor:${index}`) }));
  const entryPoints = [
    ["EP_DEPOSIT", "COMP_VAULT", "0xd0e30db0", "PUBLIC", true], ["EP_WITHDRAW", "COMP_VAULT", "0x2e1a7d4d", "PUBLIC", true], ["EP_TRANSFER", "COMP_CORE", "0xa9059cbb", "PUBLIC", true], ["EP_UPDATE_PRICE", "COMP_ORACLE", "0x7b8a1f3d", "ROLE", true], ["EP_UPGRADE", "COMP_PROXY", "0x3659cfe6", "TIMELOCK", true], ["EP_GOV_EXEC", "COMP_GOV", "0x134008d3", "MULTISIG", true], ["EP_QUOTE", "COMP_DEX", "0xcdca1753", "PUBLIC", false]
  ].map(([entryPointId, componentId, selector, accessMode, stateChanging], index) => ({ entryPointId, componentId, selector, accessMode, stateChanging, evidenceSha256: d(`${caseRef}:entry:${index}`) }));
  const dataFlows = [
    ["FLOW_USER_VAULT", "COMP_PROXY", "COMP_VAULT", ["ASSET_FUNDS"], "EP_DEPOSIT"], ["FLOW_VAULT_CORE", "COMP_VAULT", "COMP_CORE", ["ASSET_FUNDS", "ASSET_ACCOUNTING"], "EP_WITHDRAW"], ["FLOW_ORACLE_CORE", "COMP_ORACLE", "COMP_CORE", ["ASSET_PRICE"], "EP_UPDATE_PRICE"], ["FLOW_GOV_PROXY", "COMP_GOV", "COMP_PROXY", ["ASSET_UPGRADE", "ASSET_GOV"], "EP_UPGRADE"], ["FLOW_CORE_DEX", "COMP_CORE", "COMP_DEX", ["ASSET_PRICE", "ASSET_FUNDS"], "EP_TRANSFER"], ["FLOW_DEX_CORE", "COMP_DEX", "COMP_CORE", ["ASSET_PRICE"], "EP_QUOTE"], ["FLOW_GOV_CORE", "COMP_GOV", "COMP_CORE", ["ASSET_GOV"], "EP_GOV_EXEC"]
  ].map(([flowId, fromComponentId, toComponentId, assetIds, entryPointId], index) => ({ flowId, fromComponentId, toComponentId, assetIds, entryPointId, evidenceSha256: d(`${caseRef}:flow:${index}`) }));
  const trustBoundaries = [
    ["BOUNDARY_USER", "COMP_PROXY", "COMP_VAULT", ["FLOW_USER_VAULT"], "PUBLIC"], ["BOUNDARY_ORACLE", "COMP_ORACLE", "COMP_CORE", ["FLOW_ORACLE_CORE"], "ROLE"], ["BOUNDARY_GOV", "COMP_GOV", "COMP_PROXY", ["FLOW_GOV_PROXY"], "TIMELOCK"], ["BOUNDARY_DEX_OUT", "COMP_CORE", "COMP_DEX", ["FLOW_CORE_DEX"], "PUBLIC"], ["BOUNDARY_DEX_IN", "COMP_DEX", "COMP_CORE", ["FLOW_DEX_CORE"], "PUBLIC"]
  ].map(([boundaryId, fromComponentId, toComponentId, dataFlowIds, authenticationMode], index) => ({ boundaryId, fromComponentId, toComponentId, dataFlowIds, authenticationMode, validationReceiptSha256: d(`${caseRef}:boundary:${index}`) }));
  const assumptions = [
    ["ASSUMP_ORACLE", "ORACLE"], ["ASSUMP_LIQUIDITY", "MARKET"], ["ASSUMP_GOV", "GOVERNANCE"], ["ASSUMP_DEPENDENCY", "DEPENDENCY"], ["ASSUMP_OPERATIONS", "OPERATIONS"], ["ASSUMP_PROTOCOL", "PROTOCOL"]
  ].map(([assumptionId, assumptionType], index) => ({ assumptionId, assumptionType, statementSha256: d(`${caseRef}:assumption-statement:${index}`), evidenceSha256: d(`${caseRef}:assumption-evidence:${index}`), invalidationTriggerSha256: d(`${caseRef}:assumption-trigger:${index}`) }));
  const invariants = [
    ["INV_FUNDS", "CRITICAL", ["ASSET_FUNDS"], ["COMP_VAULT", "COMP_CORE"]], ["INV_SUPPLY", "HIGH", ["ASSET_SUPPLY"], ["COMP_CORE"]], ["INV_PRICE", "CRITICAL", ["ASSET_PRICE"], ["COMP_ORACLE", "COMP_CORE"]], ["INV_GOV", "HIGH", ["ASSET_GOV"], ["COMP_GOV"]], ["INV_UPGRADE", "CRITICAL", ["ASSET_UPGRADE"], ["COMP_PROXY", "COMP_GOV"]], ["INV_ACCOUNTING", "HIGH", ["ASSET_ACCOUNTING"], ["COMP_CORE", "COMP_VAULT"]]
  ].map(([invariantId, criticality, assetIds, componentIds], index) => ({ invariantId, criticality, assetIds, componentIds, evidenceSha256: d(`${caseRef}:invariant:${index}`), testReceiptSha256: d(`${caseRef}:invariant-test:${index}`), monitored: true }));
  const categories = ["SPOOFING", "TAMPERING", "REPUDIATION", "INFORMATION_DISCLOSURE", "DENIAL_OF_SERVICE", "ELEVATION_OF_PRIVILEGE", "ECONOMIC_MANIPULATION", "TAMPERING"];
  const abuseCases = categories.map((category, index) => {
    const targetAssetIds = index === 0 ? ["ASSET_FUNDS"] : index === 1 ? ["ASSET_SUPPLY"] : index === 2 ? ["ASSET_ACCOUNTING"] : index === 3 ? ["ASSET_PRICE"] : index === 4 ? ["ASSET_FUNDS"] : index === 5 ? ["ASSET_UPGRADE", "ASSET_GOV"] : index === 6 ? ["ASSET_PRICE", "ASSET_FUNDS"] : ["ASSET_ACCOUNTING"];
    const entryPointIds = index === 5 ? ["EP_UPGRADE", "EP_GOV_EXEC"] : index === 6 ? ["EP_UPDATE_PRICE", "EP_TRANSFER"] : [entryPoints[index % 6].entryPointId];
    const affectedBoundaryIds = index === 5 ? ["BOUNDARY_GOV"] : index === 6 ? ["BOUNDARY_ORACLE", "BOUNDARY_DEX_OUT"] : [trustBoundaries[index % 5].boundaryId];
    return {
      abuseCaseId: `ABUSE_${String(index).padStart(2, "0")}`,
      category,
      actorId: index % 2 === 0 ? "ACT_ATTACKER" : "ACT_ADMIN",
      entryPointIds,
      targetAssetIds,
      preconditionIds: [assumptions[index % assumptions.length].assumptionId],
      affectedBoundaryIds,
      attackSteps: [0, 1, 2].map((stepIndex) => ({ stepId: `STEP_${String(index).padStart(2, "0")}_${stepIndex}`, evidenceSha256: d(`${caseRef}:abuse:${index}:step:${stepIndex}`) })),
      mitigations: [{ mitigationId: `MITIGATION_${String(index).padStart(2, "0")}`, evidenceSha256: d(`${caseRef}:mitigation:${index}`), testReceiptSha256: d(`${caseRef}:mitigation-test:${index}`) }],
      residualRisk: index < 2 ? "HIGH" : "MEDIUM",
      limitationSha256: d(`${caseRef}:limitation:${index}`)
    };
  });
  return {
    schemaVersion: INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef,
    target: { chainId: 1, blockNumber: 19000000, contractAddress: addr(950), blockHashSha256: d(`${caseRef}:block`), sourceBundleSha256: d(`${caseRef}:source`), runtimeBytecodeSha256: d(`${caseRef}:runtime`), deploymentReceiptSha256: d(`${caseRef}:deploy`), architectureSha256: d(`${caseRef}:architecture`), a29OperationsReceiptSha256: d(`${caseRef}:a29`) },
    components,
    assets,
    actors,
    trustBoundaries,
    dataFlows,
    entryPoints,
    assumptions,
    invariants,
    abuseCases,
    coverage: { criticalAssetTotal: 6, criticalAssetCovered: 6, stateChangingEntryPointTotal: 6, stateChangingEntryPointCovered: 6, trustBoundaryTotal: 5, trustBoundaryCovered: 5 },
    threatModelReplayRuns: [0, 1, 2].map((runIndex) => ({ runIndex, inputSha256: d(`${caseRef}:replay-input`), outputSha256: d(`${caseRef}:replay-output`), coverageSha256: d(`${caseRef}:replay-coverage`), passed: true })),
    mutationEvidence: { total: 100, killed: 100, registrySha256: d(`${caseRef}:mut-reg`), receiptSha256: d(`${caseRef}:mut-receipt`) },
    protocolSpecificAssumptionsHumanValidated: false,
    businessLogicHumanReviewed: false,
    realArchitectureWorkshopExecuted: false,
    independentRerun: false,
    paidGateEligible: false
  };
}

const faultMutators = {
  CASE_TARGET_ARCHITECTURE_BINDING: (v) => { v.target.architectureSha256 = "sha256:bad"; },
  COMPONENT_ASSET_ACTOR_REGISTRY: (v) => { v.components[1].componentId = v.components[0].componentId; },
  TRUST_BOUNDARY_DATA_FLOW_COVERAGE: (v) => { v.trustBoundaries[0].dataFlowIds = ["FLOW_MISSING"]; },
  ENTRY_POINT_ACCESS_MAPPING: (v) => { v.entryPoints[0].accessMode = "UNKNOWN"; },
  ASSUMPTION_INVALIDATION_REGISTRY: (v) => { v.assumptions[0].invalidationTriggerSha256 = "sha256:bad"; },
  CRITICAL_ASSET_INVARIANTS: (v) => { v.invariants = v.invariants.filter((row) => !row.assetIds.includes("ASSET_PRICE")); v.coverage.criticalAssetCovered = 5; },
  ABUSE_CASE_PRECONDITION_COVERAGE: (v) => { v.abuseCases[0].preconditionIds = ["ASSUMP_MISSING"]; },
  ATTACK_PATH_MITIGATION_BINDING: (v) => { v.abuseCases[0].mitigations = []; },
  RESIDUAL_RISK_LIMITATIONS: (v) => { v.abuseCases[0].limitationSha256 = "sha256:bad"; },
  COVERAGE_DENOMINATORS: (v) => { v.coverage.criticalAssetTotal = 999; },
  DETERMINISTIC_THREAT_MODEL_REPLAY: (v) => { v.threatModelReplayRuns[2].outputSha256 = d(`${v.caseRef}:different-output`); },
  MUTATION_EVIDENCE: (v) => { v.mutationEvidence.killed = 50; }
};
const mutationMutators = [
  (v) => { v.target.sourceBundleSha256 = "sha256:bad"; },
  (v) => { v.assets[0].custodianComponentId = "COMP_MISSING"; },
  (v) => { v.trustBoundaries[0].validationReceiptSha256 = "sha256:bad"; },
  (v) => { v.entryPoints[0].selector = "0x123"; },
  (v) => { v.assumptions[1].evidenceSha256 = "sha256:bad"; },
  (v) => { v.invariants[0].testReceiptSha256 = "sha256:bad"; },
  (v) => { v.abuseCases[0].actorId = "ACT_MISSING"; },
  (v) => { v.abuseCases[1].attackSteps[1].stepId = v.abuseCases[0].attackSteps[0].stepId; },
  (v) => { v.abuseCases[2].residualRisk = "UNKNOWN"; },
  (v) => { v.coverage.stateChangingEntryPointCovered = 5; },
  (v) => { v.threatModelReplayRuns[1].coverageSha256 = d(`${v.caseRef}:different-coverage`); },
  (v) => { v.mutationEvidence.receiptSha256 = "sha256:bad"; }
];

export function runA30Benchmark(policy) {
  if (!verifyA30Policy(policy)) throw new Error("a30_policy_invalid");
  const cases = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const caseRef = `AUD-A30-${family.replaceAll("_", "-")}-${String(index).padStart(2, "0")}`;
      const input = baseInput(caseRef);
      if (!expectedEligible) faultMutators[family](input);
      const report = analyzeA30ThreatModel(input, policy);
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
      const mutatedReport = analyzeA30ThreatModel(mutated, policy);
      mutationTotal += 1;
      if (mutatedReport.eligibleLocalEvidenceContract !== row.expectedEligible) killed += 1;
    }
  }
  const reportCore = {
    schemaVersion: BENCHMARK_SCHEMA,
    passId: "PASS35_A30",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: cases.length, frozen: frozenTotal, mutations: mutationTotal, families: policy.benchmark.families.length },
    development: { accuracy: ratio(correct, cases.length), correct, total: cases.length, wilson95: wilson(correct, cases.length) },
    frozen: { accuracy: ratio(frozenCorrect, frozenTotal), correct: frozenCorrect, total: frozenTotal, unsafeEligible, falseBlocks, wilson95: wilson(frozenCorrect, frozenTotal) },
    mutation: { killed, total: mutationTotal, killRate: ratio(killed, mutationTotal) },
    claims: { protocolSpecificAssumptionsHumanValidated: false, businessLogicHumanReviewed: false, realArchitectureWorkshopExecuted: false, everyRealWorldThreatModeled: false, independentRerun: false, paidGateEligible: false, sellEnabled: false },
    cases: cases.map(({ input, ...row }) => row),
    truthBoundary: policy.truthBoundary
  };
  return { ...reportCore, integritySha256: digest(reportCore) };
}

export function verifyA30Benchmark(report, policy) {
  try {
    return verifyA30Policy(policy)
      && report?.schemaVersion === BENCHMARK_SCHEMA
      && report?.passId === "PASS35_A30"
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
      && report.claims.protocolSpecificAssumptionsHumanValidated === false
      && report.claims.businessLogicHumanReviewed === false
      && report.claims.realArchitectureWorkshopExecuted === false
      && report.claims.everyRealWorldThreatModeled === false
      && report.claims.independentRerun === false
      && report.claims.paidGateEligible === false
      && report.claims.sellEnabled === false
      && report.integritySha256 === digest(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "integritySha256")));
  } catch { return false; }
}
