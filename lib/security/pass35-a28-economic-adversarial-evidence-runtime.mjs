import { createHash } from "node:crypto";

const A28_INPUT_SCHEMA = "velmere.pass35.a28-economic-adversarial-evidence-input.v1";
const A28_REPORT_SCHEMA = "velmere.pass35.a28-economic-adversarial-evidence-report.v1";
const A28_BENCHMARK_SCHEMA = "velmere.pass35.a28-economic-adversarial-evidence-benchmark.v1";
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const ADDRESS = /^0x[a-f0-9]{40}$/u;
const ID = /^[A-Z][A-Z0-9_]{2,80}$/u;
const CASE_REF = /^AUD-A28-[A-Z0-9-]{6,72}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const DIRECTIONS = new Set(["LOSS_INCREASE", "LOSS_DECREASE", "NO_MATERIAL_CHANGE"]);
const CRITICALITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function digest(value) { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ratio(n, d) { return d > 0 ? Number((n / d).toFixed(6)) : 0; }
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { lower: Number(((centre - margin) / denominator).toFixed(6)), upper: Number(((centre + margin) / denominator).toFixed(6)) };
}
function unique(values) { return new Set(values).size === values.length; }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function positiveDecimal(value) { return DECIMAL.test(String(value ?? "")) && BigInt(value) > 0n; }
function nonnegativeDecimal(value) { return DECIMAL.test(String(value ?? "")); }
function validDigest(value) { return DIGEST.test(String(value ?? "")); }
function validId(value) { return ID.test(String(value ?? "")); }
function add(blockers, condition, code) { if (!condition) blockers.push(code); }

export function verifyA28Policy(policy) {
  try {
    return policy?.schemaVersion === "velmere.pass35.a28-economic-adversarial-evidence-policy.v1"
      && policy?.passId === "PASS35_A28"
      && /^VELMERE_PASS35_A(?:30_THREAT_MODEL|31_PRIVILEGE_AUTHORIZATION|32_REPORT_DELIVERY)_EVIDENCE_NON_VISUAL$/u.test(String(policy?.sourceRevisionId ?? ""))
      && Array.isArray(policy.allowedInputClasses) && policy.allowedInputClasses.length === 2
      && Array.isArray(policy.requiredScenarioTypes) && policy.requiredScenarioTypes.length === 5 && unique(policy.requiredScenarioTypes)
      && policy.thresholds.minimumEvidenceFamilies >= 5
      && policy.thresholds.minimumEvidenceFamiliesPerScenario >= 2
      && policy.thresholds.minimumPrerequisitesPerScenario >= 2
      && policy.thresholds.minimumSensitivityPoints >= 4
      && policy.thresholds.maximumReplayCorrelationErrorBps >= 0
      && policy.thresholds.mutationKillRate >= 0.9 && policy.thresholds.mutationKillRate <= 1
      && policy.thresholds.requireScenarioDependencyDag === true
      && policy.thresholds.requireMonotonicSensitivity === true
      && policy.thresholds.requireBoundedUncertainty === true
      && policy.thresholds.requireClaimBoundary === true
      && Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 12 && unique(policy.benchmark.families)
      && Array.isArray(policy.benchmark?.mutationTypes) && policy.benchmark.mutationTypes.length === 12 && unique(policy.benchmark.mutationTypes)
      && policy.benchmark.expectedCases === 192
      && policy.benchmark.expectedFrozen === 72
      && policy.benchmark.expectedMutations === 2304
      && typeof policy.truthBoundary === "string" && policy.truthBoundary.length > 120;
  } catch { return false; }
}

function hasCycle(nodes, edges) {
  const graph = new Map(nodes.map((id) => [id, []]));
  for (const edge of edges) {
    if (!graph.has(edge.fromScenarioId) || !graph.has(edge.toScenarioId)) return true;
    graph.get(edge.fromScenarioId).push(edge.toScenarioId);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node)) if (visit(next)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return nodes.some(visit);
}

export function analyzeA28EconomicAdversarialEvidence(input, policy) {
  if (!verifyA28Policy(policy)) throw new Error("a28_policy_invalid");
  const blockers = [];
  add(blockers, input?.schemaVersion === A28_INPUT_SCHEMA, "a28_schema_invalid");
  add(blockers, policy.allowedInputClasses.includes(input?.inputClass), "a28_input_class_invalid");
  add(blockers, CASE_REF.test(String(input?.caseRef ?? "")), "a28_case_ref_invalid");
  const target = input?.target ?? {};
  add(blockers, positiveDecimal(target.chainId), "a28_chain_id_invalid");
  add(blockers, integer(target.blockNumber) && target.blockNumber > 0, "a28_block_number_invalid");
  add(blockers, ADDRESS.test(String(target.contractAddress ?? "")), "a28_contract_address_invalid");
  for (const field of ["blockHashSha256", "sourceBundleSha256", "runtimeBytecodeSha256", "deploymentReceiptSha256", "a27ForkReplayReceiptSha256", "methodologySha256", "modelConfigSha256"]) add(blockers, validDigest(target[field]), `a28_target_${field}_invalid`);

  const evidence = Array.isArray(input?.evidenceFamilies) ? input.evidenceFamilies : [];
  add(blockers, evidence.length >= policy.thresholds.minimumEvidenceFamilies, "a28_evidence_family_count_below_floor");
  add(blockers, unique(evidence.map((row) => row?.familyId)), "a28_evidence_family_duplicate");
  const evidenceIds = new Set();
  for (const row of evidence) {
    add(blockers, validId(row?.familyId), "a28_evidence_family_id_invalid");
    add(blockers, validDigest(row?.sourceReceiptSha256), "a28_evidence_source_receipt_invalid");
    add(blockers, validDigest(row?.observationSha256), "a28_evidence_observation_invalid");
    add(blockers, row?.independentFailureDomain === true, "a28_evidence_failure_domain_not_independent");
    add(blockers, row?.commercialRightsProven === false, "a28_evidence_commercial_rights_must_remain_unclaimed");
    if (validId(row?.familyId)) evidenceIds.add(row.familyId);
  }

  const prerequisites = Array.isArray(input?.prerequisites) ? input.prerequisites : [];
  add(blockers, prerequisites.length >= 10, "a28_prerequisite_registry_incomplete");
  add(blockers, unique(prerequisites.map((row) => row?.prerequisiteId)), "a28_prerequisite_duplicate");
  const prerequisiteIds = new Set();
  for (const row of prerequisites) {
    add(blockers, validId(row?.prerequisiteId), "a28_prerequisite_id_invalid");
    add(blockers, CRITICALITIES.has(row?.criticality), "a28_prerequisite_criticality_invalid");
    add(blockers, Array.isArray(row?.evidenceFamilyIds) && row.evidenceFamilyIds.length >= 1 && row.evidenceFamilyIds.every((id) => evidenceIds.has(id)), "a28_prerequisite_evidence_missing");
    add(blockers, validDigest(row?.definitionSha256), "a28_prerequisite_definition_invalid");
    if (validId(row?.prerequisiteId)) prerequisiteIds.add(row.prerequisiteId);
  }

  const scenarios = Array.isArray(input?.scenarios) ? input.scenarios : [];
  add(blockers, scenarios.length === policy.requiredScenarioTypes.length, "a28_scenario_count_invalid");
  add(blockers, unique(scenarios.map((row) => row?.scenarioId)), "a28_scenario_duplicate_id");
  for (const type of policy.requiredScenarioTypes) add(blockers, scenarios.some((row) => row?.type === type), `a28_required_scenario_missing:${type}`);
  const scenarioIds = scenarios.map((row) => row?.scenarioId).filter(validId);
  let correlated = 0;
  let uncertaintyCovered = 0;
  let conflictCount = 0;
  const summaries = [];
  for (const row of scenarios) {
    add(blockers, validId(row?.scenarioId), "a28_scenario_id_invalid");
    add(blockers, policy.requiredScenarioTypes.includes(row?.type), "a28_scenario_type_invalid");
    add(blockers, validDigest(row?.inputPacketSha256) && validDigest(row?.modelRunSha256), "a28_scenario_binding_invalid");
    add(blockers, Array.isArray(row?.evidenceFamilyIds) && row.evidenceFamilyIds.length >= policy.thresholds.minimumEvidenceFamiliesPerScenario && unique(row.evidenceFamilyIds) && row.evidenceFamilyIds.every((id) => evidenceIds.has(id)), "a28_scenario_evidence_floor_missing");
    add(blockers, Array.isArray(row?.prerequisiteIds) && row.prerequisiteIds.length >= policy.thresholds.minimumPrerequisitesPerScenario && unique(row.prerequisiteIds) && row.prerequisiteIds.every((id) => prerequisiteIds.has(id)), "a28_scenario_prerequisite_floor_missing");
    const points = Array.isArray(row?.sensitivityPoints) ? row.sensitivityPoints : [];
    add(blockers, points.length >= policy.thresholds.minimumSensitivityPoints, "a28_sensitivity_points_below_floor");
    add(blockers, points.every((point) => integer(point?.shockBps) && nonnegativeDecimal(point?.estimatedLossUsdE6) && nonnegativeDecimal(point?.attackCostUsdE6)), "a28_sensitivity_point_invalid");
    add(blockers, unique(points.map((point) => point?.shockBps)), "a28_sensitivity_shock_duplicate");
    const ordered = [...points].sort((a, b) => a.shockBps - b.shockBps);
    add(blockers, points.every((point, index) => point === ordered[index]), "a28_sensitivity_not_sorted");
    const monotonic = ordered.every((point, index) => index === 0 || BigInt(point.estimatedLossUsdE6) >= BigInt(ordered[index - 1].estimatedLossUsdE6));
    add(blockers, monotonic, "a28_sensitivity_non_monotonic");
    const uncertainty = row?.uncertainty ?? {};
    const bounded = nonnegativeDecimal(uncertainty.lowerLossUsdE6) && nonnegativeDecimal(uncertainty.centralLossUsdE6) && nonnegativeDecimal(uncertainty.upperLossUsdE6)
      && BigInt(uncertainty.lowerLossUsdE6) <= BigInt(uncertainty.centralLossUsdE6)
      && BigInt(uncertainty.centralLossUsdE6) <= BigInt(uncertainty.upperLossUsdE6)
      && uncertainty.probabilityClaimAllowed === false;
    add(blockers, bounded, "a28_uncertainty_unbounded");
    if (bounded) uncertaintyCovered += 1;
    const replay = row?.replayCorrelation ?? {};
    const replayOk = validDigest(replay.a27ReplayReceiptSha256)
      && DIRECTIONS.has(replay.predictedDirection)
      && replay.predictedDirection === replay.observedDirection
      && integer(replay.absoluteErrorBps)
      && replay.absoluteErrorBps <= policy.thresholds.maximumReplayCorrelationErrorBps
      && replay.officialForkReplay === false;
    add(blockers, replayOk, "a28_replay_correlation_invalid");
    if (replayOk) correlated += 1;
    const economics = row?.economics ?? {};
    const economicsOk = positiveDecimal(economics.attackCapitalUsdE6) && nonnegativeDecimal(economics.attackCostUsdE6) && nonnegativeDecimal(economics.grossBenefitUsdE6) && nonnegativeDecimal(economics.maximumLossUsdE6)
      && BigInt(economics.attackCostUsdE6) <= BigInt(economics.attackCapitalUsdE6)
      && BigInt(economics.maximumLossUsdE6) >= BigInt(uncertainty.centralLossUsdE6);
    add(blockers, economicsOk, "a28_economic_feasibility_invalid");
    add(blockers, row?.claimClass === "BOUNDED_ANALYTICAL_ESTIMATE" && row?.exploitProven === false && row?.realizedLossClaimed === false && row?.probabilityClaimAllowed === false, "a28_claim_boundary_invalid");
    if (row?.conflictState !== "NONE") conflictCount += 1;
    add(blockers, row?.conflictState === "NONE", "a28_scenario_conflict_unresolved");
    summaries.push({ scenarioId: row?.scenarioId ?? null, type: row?.type ?? null, evidenceFamilyCount: row?.evidenceFamilyIds?.length ?? 0, prerequisiteCount: row?.prerequisiteIds?.length ?? 0, sensitivityPointCount: points.length, replayCorrelated: replayOk, boundedUncertainty: bounded, centralLossUsdE6: bounded ? uncertainty.centralLossUsdE6 : null });
  }

  const edges = Array.isArray(input?.scenarioDependencies) ? input.scenarioDependencies : [];
  add(blockers, edges.length >= 4, "a28_dependency_graph_incomplete");
  add(blockers, unique(edges.map((row) => row?.edgeId)), "a28_dependency_edge_duplicate");
  for (const edge of edges) {
    add(blockers, validId(edge?.edgeId) && scenarioIds.includes(edge?.fromScenarioId) && scenarioIds.includes(edge?.toScenarioId) && edge.fromScenarioId !== edge.toScenarioId && validDigest(edge?.evidenceSha256), "a28_dependency_edge_invalid");
  }
  add(blockers, !hasCycle(scenarioIds, edges), "a28_dependency_cycle_detected");

  const modelRuns = Array.isArray(input?.modelRuns) ? input.modelRuns : [];
  add(blockers, modelRuns.length >= 4, "a28_model_run_count_below_floor");
  add(blockers, modelRuns.every((row) => validId(row?.runId) && validDigest(row?.inputSha256) && validDigest(row?.outputSha256) && validDigest(row?.configSha256)), "a28_model_run_binding_invalid");
  const deterministic = modelRuns.length >= 4 && new Set(modelRuns.map((row) => row.outputSha256)).size === 1 && new Set(modelRuns.map((row) => row.inputSha256)).size === 1 && new Set(modelRuns.map((row) => row.configSha256)).size === 1;
  add(blockers, deterministic, "a28_model_nondeterministic");

  const mutations = Array.isArray(input?.mutations) ? input.mutations : [];
  add(blockers, mutations.length >= 20 && unique(mutations.map((row) => row?.mutationId)), "a28_mutation_registry_invalid");
  add(blockers, mutations.every((row) => validId(row?.mutationId) && typeof row?.killed === "boolean" && validDigest(row?.receiptSha256)), "a28_mutation_row_invalid");
  const killed = mutations.filter((row) => row.killed).length;
  const mutationKillRate = ratio(killed, mutations.length);
  add(blockers, mutationKillRate >= policy.thresholds.mutationKillRate, "a28_mutation_kill_rate_below_floor");

  const criticalHigh = prerequisites.filter((row) => row.criticality === "CRITICAL" || row.criticality === "HIGH");
  const usedPrerequisites = new Set(scenarios.flatMap((row) => row?.prerequisiteIds ?? []));
  const criticalHighCoverage = ratio(criticalHigh.filter((row) => usedPrerequisites.has(row.prerequisiteId)).length, criticalHigh.length);
  add(blockers, criticalHighCoverage >= policy.thresholds.minimumCriticalHighPrerequisiteCoverage, "a28_critical_high_prerequisite_coverage_below_floor");
  const replayCorrelationCoverage = ratio(correlated, scenarios.length);
  const uncertaintyCoverage = ratio(uncertaintyCovered, scenarios.length);
  add(blockers, replayCorrelationCoverage >= policy.thresholds.minimumReplayCorrelationCoverage, "a28_replay_correlation_coverage_below_floor");
  add(blockers, uncertaintyCoverage >= policy.thresholds.minimumUncertaintyCoverage, "a28_uncertainty_coverage_below_floor");
  add(blockers, conflictCount <= policy.thresholds.maxConflictedScenarios, "a28_conflict_count_above_limit");

  const uniqueBlockers = [...new Set(blockers)].sort();
  const localEligibility = uniqueBlockers.length === 0;
  const core = {
    schemaVersion: A28_REPORT_SCHEMA,
    passId: "PASS35_A28",
    sourceRevisionId: policy.sourceRevisionId,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    target: { chainId: target.chainId ?? null, blockNumber: target.blockNumber ?? null, contractAddress: target.contractAddress ?? null, blockHashSha256: target.blockHashSha256 ?? null },
    denominators: { evidenceFamilies: evidence.length, prerequisites: prerequisites.length, scenarios: scenarios.length, scenarioDependencies: edges.length, modelRuns: modelRuns.length, mutations: mutations.length },
    coverage: { criticalHighPrerequisiteCoverage: criticalHighCoverage, replayCorrelationCoverage, uncertaintyCoverage },
    model: { deterministic, mutationKillRate, killedMutations: killed },
    scenarioSummaries: summaries,
    blockers: uniqueBlockers,
    localEligibility,
    currentRightsApprovedInputsUsed: false,
    officialForkedEvmExecuted: false,
    realEconomicExploitProven: false,
    realizedLossClaimed: false,
    calibratedProbabilityClaimAllowed: false,
    qualifiedHumanAdjudication: false,
    independentRerun: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, reportSha256: digest(core) };
}

function evidenceFamily(index) {
  return { familyId: `EVIDENCE_FAMILY_${String(index).padStart(2, "0")}`, sourceReceiptSha256: `sha256:${String(index + 1).padStart(64, "0")}`, observationSha256: `sha256:${String(index + 21).padStart(64, "0")}`, independentFailureDomain: true, commercialRightsProven: false };
}
function prerequisite(index, evidenceIds) {
  return { prerequisiteId: `PREREQUISITE_${String(index).padStart(2, "0")}`, criticality: index < 2 ? "CRITICAL" : index < 5 ? "HIGH" : "MEDIUM", evidenceFamilyIds: [evidenceIds[index % evidenceIds.length]], definitionSha256: `sha256:${String(index + 41).padStart(64, "0")}` };
}
function validInput(family, index, policy) {
  const token = family.replaceAll("_", "-");
  const evidence = Array.from({ length: 6 }, (_, i) => evidenceFamily(i));
  const evidenceIds = evidence.map((row) => row.familyId);
  const prerequisites = Array.from({ length: 12 }, (_, i) => prerequisite(i, evidenceIds));
  const prerequisiteIds = prerequisites.map((row) => row.prerequisiteId);
  const scenarioIds = policy.requiredScenarioTypes.map((type, i) => `SCENARIO_${String(i).padStart(2, "0")}`);
  const scenarios = policy.requiredScenarioTypes.map((type, i) => {
    const central = BigInt((i + 2) * 1_000_000);
    const points = [100, 250, 500, 1000].map((shock, j) => ({ shockBps: shock, estimatedLossUsdE6: (central + BigInt(j) * 500_000n).toString(), attackCostUsdE6: String((i + 1) * 200_000) }));
    return {
      scenarioId: scenarioIds[i],
      type,
      inputPacketSha256: `sha256:${String(i + 61).padStart(64, "0")}`,
      modelRunSha256: `sha256:${String(i + 71).padStart(64, "0")}`,
      evidenceFamilyIds: [evidenceIds[i % evidenceIds.length], evidenceIds[(i + 1) % evidenceIds.length]],
      prerequisiteIds: [prerequisiteIds[i * 2], prerequisiteIds[i * 2 + 1]],
      sensitivityPoints: points,
      uncertainty: { lowerLossUsdE6: (central - 500_000n).toString(), centralLossUsdE6: central.toString(), upperLossUsdE6: (central + 2_000_000n).toString(), probabilityClaimAllowed: false },
      replayCorrelation: { a27ReplayReceiptSha256: `sha256:${String(i + 81).padStart(64, "0")}`, predictedDirection: "LOSS_INCREASE", observedDirection: "LOSS_INCREASE", absoluteErrorBps: 300 + i * 10, officialForkReplay: false },
      economics: { attackCapitalUsdE6: String((i + 5) * 1_000_000), attackCostUsdE6: String((i + 1) * 200_000), grossBenefitUsdE6: String((i + 2) * 1_500_000), maximumLossUsdE6: (central + 3_000_000n).toString() },
      conflictState: "NONE",
      claimClass: "BOUNDED_ANALYTICAL_ESTIMATE",
      exploitProven: false,
      realizedLossClaimed: false,
      probabilityClaimAllowed: false
    };
  });
  const scenarioDependencies = scenarioIds.slice(0, -1).map((id, i) => ({ edgeId: `DEPENDENCY_EDGE_${String(i).padStart(2, "0")}`, fromScenarioId: id, toScenarioId: scenarioIds[i + 1], evidenceSha256: `sha256:${String(i + 91).padStart(64, "0")}` }));
  const inputSha = `sha256:${"a".repeat(64)}`;
  const outputSha = `sha256:${"b".repeat(64)}`;
  const configSha = `sha256:${"c".repeat(64)}`;
  const modelRuns = Array.from({ length: 4 }, (_, i) => ({ runId: `MODEL_RUN_${String(i).padStart(2, "0")}`, inputSha256: inputSha, outputSha256: outputSha, configSha256: configSha }));
  const mutations = Array.from({ length: 20 }, (_, i) => ({ mutationId: `MUTATION_${String(i).padStart(2, "0")}`, killed: i < 19, receiptSha256: `sha256:${String(i + 111).padStart(64, "0")}` }));
  return {
    schemaVersion: A28_INPUT_SCHEMA,
    inputClass: "GENERATED_BENCHMARK",
    caseRef: `AUD-A28-${token}-${String(index).padStart(2, "0")}`,
    target: { chainId: "1", blockNumber: 19_000_000, contractAddress: "0x2222222222222222222222222222222222222222", blockHashSha256: `sha256:${"d".repeat(64)}`, sourceBundleSha256: `sha256:${"e".repeat(64)}`, runtimeBytecodeSha256: `sha256:${"f".repeat(64)}`, deploymentReceiptSha256: `sha256:${"1".repeat(64)}`, a27ForkReplayReceiptSha256: `sha256:${"2".repeat(64)}`, methodologySha256: `sha256:${"3".repeat(64)}`, modelConfigSha256: configSha },
    evidenceFamilies: evidence,
    prerequisites,
    scenarios,
    scenarioDependencies,
    modelRuns,
    mutations
  };
}
function defect(input, family, _policy) {
  const out = clone(input);
  switch (family) {
    case "TARGET_METHOD_BINDING": out.target.methodologySha256 = "bad"; break;
    case "SCENARIO_REGISTRY": out.scenarios.pop(); break;
    case "EVIDENCE_FAMILY_BINDING": out.scenarios[0].evidenceFamilyIds = [out.evidenceFamilies[0].familyId]; break;
    case "PREREQUISITE_COVERAGE": out.scenarios.forEach((row) => { row.prerequisiteIds = []; }); break;
    case "SENSITIVITY_MONOTONICITY": out.scenarios[0].sensitivityPoints[3].estimatedLossUsdE6 = "1"; break;
    case "UNCERTAINTY_BOUNDS": out.scenarios[0].uncertainty.lowerLossUsdE6 = "999999999"; break;
    case "DEPENDENCY_DAG": out.scenarioDependencies.push({ edgeId: "DEPENDENCY_EDGE_CYCLE", fromScenarioId: out.scenarios.at(-1).scenarioId, toScenarioId: out.scenarios[0].scenarioId, evidenceSha256: `sha256:${"4".repeat(64)}` }); break;
    case "REPLAY_CORRELATION": out.scenarios[0].replayCorrelation.observedDirection = "LOSS_DECREASE"; break;
    case "ECONOMIC_FEASIBILITY": out.scenarios[0].economics.attackCostUsdE6 = "999999999999"; break;
    case "MODEL_REPRODUCIBILITY": out.modelRuns[3].outputSha256 = `sha256:${"9".repeat(64)}`; break;
    case "MUTATION_SCORE": out.mutations.forEach((row, i) => { row.killed = i < 8; }); break;
    case "CLAIM_BOUNDARY": out.scenarios[0].exploitProven = true; break;
    default: throw new Error(`a28_unknown_family:${family}`);
  }
  return out;
}
function mutate(input, type) {
  const out = clone(input);
  switch (type) {
    case "schema_invalid": out.schemaVersion = "bad"; break;
    case "input_class_relabel": out.inputClass = "CUSTOMER_VERIFIED"; break;
    case "target_binding_break": out.target.a27ForkReplayReceiptSha256 = "bad"; break;
    case "scenario_missing": out.scenarios.pop(); break;
    case "evidence_family_drop": out.scenarios[0].evidenceFamilyIds = []; break;
    case "prerequisite_coverage_drop": out.scenarios.forEach((row) => { row.prerequisiteIds = []; }); break;
    case "sensitivity_non_monotonic": out.scenarios[0].sensitivityPoints[3].estimatedLossUsdE6 = "0"; break;
    case "uncertainty_inverted": out.scenarios[0].uncertainty.upperLossUsdE6 = "0"; break;
    case "dependency_cycle": out.scenarioDependencies.push({ edgeId: "DEPENDENCY_EDGE_MUTATION", fromScenarioId: out.scenarios.at(-1).scenarioId, toScenarioId: out.scenarios[0].scenarioId, evidenceSha256: `sha256:${"5".repeat(64)}` }); break;
    case "replay_correlation_break": out.scenarios[0].replayCorrelation.absoluteErrorBps = 9000; break;
    case "model_nondeterminism": out.modelRuns[2].outputSha256 = `sha256:${"9".repeat(64)}`; break;
    case "claim_boundary_break": out.scenarios[0].probabilityClaimAllowed = true; break;
    default: throw new Error(`a28_unknown_mutation:${type}`);
  }
  return out;
}

export function runA28Benchmark(policy) {
  if (!verifyA28Policy(policy)) throw new Error("a28_policy_invalid");
  const rows = [];
  for (const family of policy.benchmark.families) {
    for (let index = 0; index < 16; index += 1) {
      const expectedEligible = index % 2 === 0;
      const input = expectedEligible ? validInput(family, index, policy) : defect(validInput(family, index, policy), family, policy);
      const report = analyzeA28EconomicAdversarialEvidence(input, policy);
      rows.push({ family, index, frozen: index >= 10, expectedEligible, actualEligible: report.localEligibility, passed: expectedEligible === report.localEligibility, blockers: report.blockers, reportSha256: report.reportSha256 });
    }
  }
  const mutations = [];
  for (const [rowIndex, row] of rows.entries()) {
    const base = validInput(row.family, row.index, policy);
    for (const type of policy.benchmark.mutationTypes) {
      const report = analyzeA28EconomicAdversarialEvidence(mutate(base, type), policy);
      mutations.push({ rowIndex, family: row.family, type, killed: !report.localEligibility, reportSha256: report.reportSha256 });
    }
  }
  const frozen = rows.filter((row) => row.frozen);
  const correct = frozen.filter((row) => row.passed).length;
  const unsafeEligible = frozen.filter((row) => !row.expectedEligible && row.actualEligible).length;
  const falseBlocks = frozen.filter((row) => row.expectedEligible && !row.actualEligible).length;
  const killed = mutations.filter((row) => row.killed).length;
  const core = {
    schemaVersion: A28_BENCHMARK_SCHEMA,
    passId: "PASS35_A28",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: rows.length, frozen: frozen.length, mutations: mutations.length, families: policy.benchmark.families.length },
    frozen: { correct, accuracy: ratio(correct, frozen.length), unsafeEligible, falseBlocks, wilson95: wilson(correct, frozen.length) },
    mutation: { total: mutations.length, killed, survived: mutations.length - killed, killRate: ratio(killed, mutations.length) },
    rows,
    mutations,
    localOnly: true,
    currentRightsApprovedInputsUsed: false,
    officialForkedEvmExecuted: false,
    realEconomicExploitProven: false,
    realizedLossClaimed: false,
    calibratedProbabilityClaimAllowed: false,
    qualifiedHumanAdjudication: false,
    independentRerun: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, integritySha256: digest(core) };
}

export function verifyA28Benchmark(report, policy) {
  return verifyA28Policy(policy)
    && report?.schemaVersion === A28_BENCHMARK_SCHEMA
    && report?.passId === "PASS35_A28"
    && report?.sourceRevisionId === policy.sourceRevisionId
    && report?.denominators?.cases === policy.benchmark.expectedCases
    && report?.denominators?.frozen === policy.benchmark.expectedFrozen
    && report?.denominators?.mutations === policy.benchmark.expectedMutations
    && report?.denominators?.families === policy.benchmark.families.length
    && report?.frozen?.accuracy === 1
    && report?.frozen?.unsafeEligible === 0
    && report?.frozen?.falseBlocks === 0
    && report?.mutation?.killRate === 1
    && report?.currentRightsApprovedInputsUsed === false
    && report?.officialForkedEvmExecuted === false
    && report?.realEconomicExploitProven === false
    && report?.realizedLossClaimed === false
    && report?.calibratedProbabilityClaimAllowed === false
    && report?.qualifiedHumanAdjudication === false
    && report?.independentRerun === false
    && report?.paidGateEligible === false
    && report?.sellEnabled === false
    && report?.integritySha256 === digest(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "integritySha256")));
}
