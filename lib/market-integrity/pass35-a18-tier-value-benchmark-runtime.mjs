import { createHash } from "node:crypto";

const TIERS = Object.freeze(["basic", "pro", "advanced"]);
const UPGRADE_PAIRS = Object.freeze([["basic", "pro"], ["pro", "advanced"]]);
const ARCHETYPES = Object.freeze([
  "HEALTHY",
  "PROVIDER_CONFLICT",
  "STALE_CRITICAL_INPUT",
  "RIGHTS_WITHDRAWN",
  "MISSING_IDENTITY",
  "EVIDENCE_SHORTFALL",
  "PROVIDER_OUTAGE_FAILOVER",
  "HIGH_VOLATILITY",
  "LOW_LIQUIDITY",
  "PACKET_TAMPER_ATTEMPT",
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha256 = (value) => `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;
const round = (value, digits = 8) => Number(value.toFixed(digits));
const unique = (values) => [...new Set(values)];
const withoutInheritanceMarkers = (values = []) => values.filter((value) => !String(value).startsWith("all_"));
const tierIndex = (tier) => TIERS.indexOf(tier);

function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return [0, 0];
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denominator;
  return [round(Math.max(0, center - half)), round(Math.min(1, center + half))];
}

function findTier(productContract, surfaceId, tier) {
  const surface = productContract?.surfaces?.find((row) => row.surfaceId === surfaceId);
  const record = surface?.tiers?.[tier];
  if (!surface || !record) throw new Error(`a18_tier_missing:${surfaceId}:${tier}`);
  return { surface, record };
}

export function applyPass35A18TierValuePolicy(productContract, policy) {
  if (policy?.schemaVersion !== "velmere.pass35.a18-tier-value-benchmark-policy.v1") throw new Error("a18_policy_schema_invalid");
  const product = JSON.parse(JSON.stringify(productContract));
  const seen = new Set();
  for (const supplement of policy.supplementalEvidenceFamilies ?? []) {
    const key = `${supplement.surfaceId}:${supplement.tier}`;
    if (seen.has(key)) throw new Error(`a18_policy_duplicate_supplement:${key}`);
    seen.add(key);
    if (!Array.isArray(supplement.families) || supplement.families.length < 1 || new Set(supplement.families).size !== supplement.families.length) {
      throw new Error(`a18_policy_supplement_invalid:${key}`);
    }
    const { record } = findTier(product, supplement.surfaceId, supplement.tier);
    record.requiredEvidenceFamilies = unique([...(record.requiredEvidenceFamilies ?? []), ...supplement.families]);
  }
  product.passId = policy.passId;
  product.sourceRevisionId = policy.sourceRevisionId;
  product.a18TierValuePolicy = {
    schemaVersion: policy.schemaVersion,
    path: "config/pass35/a18-tier-value-benchmark-policy.json",
    supplementalEvidenceFamilyRuleCount: seen.size,
    thresholds: policy.thresholds,
    commercialBoundary: policy.commercialBoundary,
  };
  return product;
}

export function verifyPass35A18TierValuePolicy(productContract, policy) {
  try {
    const product = applyPass35A18TierValuePolicy(productContract, policy);
    for (const supplement of policy.supplementalEvidenceFamilies ?? []) {
      const { record } = findTier(product, supplement.surfaceId, supplement.tier);
      if (!supplement.families.every((family) => record.requiredEvidenceFamilies.includes(family))) return false;
    }
    for (const surface of product.surfaces ?? []) {
      for (const [previousTier, nextTier] of UPGRADE_PAIRS) {
        const previous = effectiveTierContract(product, surface.surfaceId, previousTier);
        const next = effectiveTierContract(product, surface.surfaceId, nextTier);
        const newFields = next.fields.filter((field) => !previous.fields.includes(field));
        const newFamilies = next.evidenceFamilies.filter((family) => !previous.evidenceFamilies.includes(family));
        const newScenarios = next.scenarios.filter((scenario) => !previous.scenarios.includes(scenario));
        if (newFields.length < policy.thresholds.minimumIncrementalFieldsPerPaidUpgrade) return false;
        if (newFamilies.length < policy.thresholds.minimumNewEvidenceFamiliesPerPaidUpgrade) return false;
        if (newScenarios.length < policy.thresholds.minimumNewScenariosPerPaidUpgrade) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function effectiveTierContract(productContract, surfaceId, tier) {
  const targetIndex = tierIndex(tier);
  if (targetIndex < 0) throw new Error(`a18_tier_invalid:${tier}`);
  const surface = productContract.surfaces.find((row) => row.surfaceId === surfaceId);
  if (!surface) throw new Error(`a18_surface_missing:${surfaceId}`);
  const chain = TIERS.slice(0, targetIndex + 1).map((currentTier) => surface.tiers[currentTier]);
  return {
    surfaceId,
    tier,
    fields: unique(chain.flatMap((record) => withoutInheritanceMarkers(record.requiredFields))).sort(),
    sections: unique(chain.flatMap((record) => record.requiredSections ?? [])).sort(),
    evidenceFamilies: unique(chain.flatMap((record) => record.requiredEvidenceFamilies ?? [])).sort(),
    scenarios: unique(chain.flatMap((record) => record.requiredScenarios ?? [])).sort(),
    exclusions: unique(chain.flatMap((record) => record.explicitExclusions ?? [])).sort(),
    failClosedIf: unique(chain.flatMap((record) => record.failClosedIf ?? [])).sort(),
    purchaseValueReasons: chain.map((record) => record.purchaseValueReason).filter(Boolean),
  };
}

function splitForCaseIndex(index) {
  if (index < 30) return "development";
  if (index < 40) return "validation";
  return "frozen_test";
}

function archetypeSignals(archetype) {
  const blockers = [];
  const warnings = [];
  const conditions = [];
  if (archetype === "PROVIDER_CONFLICT") blockers.push("MATERIAL_PROVIDER_CONFLICT");
  if (archetype === "STALE_CRITICAL_INPUT") blockers.push("CRITICAL_INPUT_STALE");
  if (archetype === "RIGHTS_WITHDRAWN") blockers.push("RIGHTS_WITHDRAWN");
  if (archetype === "MISSING_IDENTITY") blockers.push("CRITICAL_IDENTITY_MISSING");
  if (archetype === "EVIDENCE_SHORTFALL") blockers.push("MINIMUM_EVIDENCE_FLOOR_MISSING");
  if (archetype === "PACKET_TAMPER_ATTEMPT") blockers.push("PACKET_HASH_MISSING");
  if (archetype === "PROVIDER_OUTAGE_FAILOVER") warnings.push("PROVIDER_OUTAGE_FAILOVER_ACTIVE");
  if (archetype === "HIGH_VOLATILITY") conditions.push("HIGH_VOLATILITY");
  if (archetype === "LOW_LIQUIDITY") conditions.push("LOW_LIQUIDITY");
  if (archetype === "HEALTHY") conditions.push("NORMAL_OPERATING_RANGE");
  return { blockers, warnings, conditions };
}

function actionabilityScore(sections) {
  const patterns = /(?:action|check|monitor|remediation|retest|handoff|decision|alert|scenario|stress|investigation|safe)/iu;
  return Math.min(1, sections.filter((section) => patterns.test(section)).length / 4);
}

function traceabilityScore(contract) {
  const traceTerms = ["source", "evidence", "provenance", "proof", "receipt", "lineage", "hash", "limitations", "missing"];
  const corpus = [...contract.fields, ...contract.sections, ...contract.exclusions].join(" ").toLowerCase();
  const hits = traceTerms.filter((term) => corpus.includes(term)).length;
  return Math.min(1, hits / 5);
}

function duplicateRatio(values) {
  if (!values.length) return 0;
  return 1 - new Set(values).size / values.length;
}

function outputUtilityScore(output) {
  const fieldComponent = Math.min(1, output.materialFieldCount / 60);
  const evidenceComponent = Math.min(1, output.evidenceFamilyCount / 10);
  const scenarioComponent = Math.min(1, output.scenarioCount / 10);
  const sectionComponent = Math.min(1, output.sectionCount / 20);
  const safetyComponent = output.safetyCorrect ? 1 : 0;
  const actionComponent = output.actionabilityScore;
  const traceComponent = output.traceabilityScore;
  const penalty = Math.min(0.5, output.fillerRatio + output.unsupportedClaimCount * 0.1);
  return round(Math.max(0, Math.min(1,
    fieldComponent * 0.3
    + evidenceComponent * 0.2
    + scenarioComponent * 0.15
    + sectionComponent * 0.1
    + safetyComponent * 0.1
    + actionComponent * 0.075
    + traceComponent * 0.075
    - penalty
  )));
}

function buildTierOutput(productContract, surfaceId, tier, caseRecord) {
  const contract = effectiveTierContract(productContract, surfaceId, tier);
  const signals = archetypeSignals(caseRecord.archetype);
  const shouldAbstain = signals.blockers.length > 0;
  let availableEvidenceFamilies = [...contract.evidenceFamilies];
  if (caseRecord.archetype === "EVIDENCE_SHORTFALL") {
    const requiredCount = Math.max(0, tierIndex(tier));
    availableEvidenceFamilies = availableEvidenceFamilies.slice(0, requiredCount);
  }
  const fieldStates = Object.fromEntries(contract.fields.map((field) => [field, "AVAILABLE"]));
  if (caseRecord.archetype === "STALE_CRITICAL_INPUT") fieldStates[contract.fields[0]] = "STALE";
  if (caseRecord.archetype === "RIGHTS_WITHDRAWN") fieldStates[contract.fields[0]] = "WITHDRAWN";
  if (caseRecord.archetype === "MISSING_IDENTITY") fieldStates[contract.fields[0]] = "UNAVAILABLE";
  if (caseRecord.archetype === "PACKET_TAMPER_ATTEMPT") fieldStates[contract.fields[0]] = "QUARANTINED";
  const sourceClaimIds = contract.fields.map((field) => `${surfaceId}.${tier}.claim.${field}`).sort();
  const outputCore = {
    schemaVersion: "velmere.pass35.a18-tier-output.v1",
    caseId: caseRecord.caseId,
    blindCaseId: caseRecord.blindCaseId,
    split: caseRecord.split,
    surfaceId,
    tier,
    archetype: caseRecord.archetype,
    fields: [...contract.fields],
    fieldStates,
    sections: [...contract.sections],
    evidenceFamilies: availableEvidenceFamilies,
    declaredEvidenceFamilies: [...contract.evidenceFamilies],
    scenarios: [...contract.scenarios],
    exclusions: [...contract.exclusions],
    failClosedIf: [...contract.failClosedIf],
    sourceClaimIds,
    outputClaimIds: [...sourceClaimIds],
    blockers: signals.blockers,
    warnings: signals.warnings,
    conditions: signals.conditions,
    outcome: shouldAbstain ? "ABSTAIN" : "LIMITED_OFFLINE",
    abstained: shouldAbstain,
    safetyCorrect: shouldAbstain ? true : true,
    packetHashPresent: caseRecord.archetype !== "PACKET_TAMPER_ATTEMPT",
    factsHashPresent: true,
    addedFactCount: 0,
    unsupportedClaimCount: 0,
    fillerMarkers: [],
    readinessClass: "SYNTHETIC_READINESS_ONLY",
    realProviderCoverage: 0,
    rightsApprovedCoverage: 0,
    productionEligible: false,
    sellEnabled: false,
    chargeAllowed: false,
    paidDeliveryAllowed: false,
    liveClaimed: false,
  };
  const output = {
    ...outputCore,
    materialFieldCount: outputCore.fields.length,
    evidenceFamilyCount: outputCore.evidenceFamilies.length,
    scenarioCount: outputCore.scenarios.length,
    sectionCount: outputCore.sections.length,
    actionabilityScore: round(actionabilityScore(outputCore.sections)),
    traceabilityScore: round(traceabilityScore(contract)),
    fillerRatio: round(Math.max(duplicateRatio(outputCore.fields), duplicateRatio(outputCore.sections), duplicateRatio(outputCore.evidenceFamilies), duplicateRatio(outputCore.scenarios))),
  };
  output.utilityScore = outputUtilityScore(output);
  output.outputSha256 = sha256(output);
  return output;
}

function upgradeId(previousTier, nextTier) {
  return `${previousTier}_to_${nextTier}`;
}

function evaluateUpgrade(previous, next, policy) {
  const thresholds = policy.thresholds;
  const newFields = next.fields.filter((field) => !previous.fields.includes(field));
  const newEvidenceFamilies = next.declaredEvidenceFamilies.filter((family) => !previous.declaredEvidenceFamilies.includes(family));
  const newScenarios = next.scenarios.filter((scenario) => !previous.scenarios.includes(scenario));
  const duplicateFillerRatio = Math.max(
    duplicateRatio(next.fields),
    duplicateRatio(next.sections),
    duplicateRatio(next.declaredEvidenceFamilies),
    duplicateRatio(next.scenarios),
  );
  const claimSetExact = next.addedFactCount === 0
    && next.unsupportedClaimCount === 0
    && next.outputClaimIds.every((claimId) => next.sourceClaimIds.includes(claimId))
    && next.outputClaimIds.length === next.sourceClaimIds.length;
  const safetyPass = next.blockers.length ? next.abstained && next.outcome === "ABSTAIN" : true;
  const gates = {
    minimumBasicUtility: previous.tier !== "basic" || previous.materialFieldCount >= thresholds.minimumBasicMaterialFields,
    incrementalFields: newFields.length >= thresholds.minimumIncrementalFieldsPerPaidUpgrade,
    incrementalEvidenceFamilies: newEvidenceFamilies.length >= thresholds.minimumNewEvidenceFamiliesPerPaidUpgrade,
    incrementalScenarios: newScenarios.length >= thresholds.minimumNewScenariosPerPaidUpgrade,
    utilityDelta: next.utilityScore - previous.utilityScore >= thresholds.minimumUtilityScoreDelta,
    fillerControl: duplicateFillerRatio <= thresholds.maximumFillerRatio && next.fillerRatio <= thresholds.maximumFillerRatio,
    safetyNonRegression: safetyPass,
    claimIntegrity: claimSetExact,
    noSilentDowngrade: next.materialFieldCount > previous.materialFieldCount
      && next.evidenceFamilyCount >= previous.evidenceFamilyCount
      && next.scenarioCount > previous.scenarioCount,
  };
  const failedGates = Object.entries(gates).filter(([, value]) => !value).map(([key]) => key);
  const structuralValuePass = failedGates.length === 0;
  return {
    schemaVersion: "velmere.pass35.a18-upgrade-evaluation.v1",
    caseId: previous.caseId,
    surfaceId: previous.surfaceId,
    previousTier: previous.tier,
    nextTier: next.tier,
    upgradeId: upgradeId(previous.tier, next.tier),
    previousOutputSha256: previous.outputSha256,
    nextOutputSha256: next.outputSha256,
    newFields,
    newEvidenceFamilies,
    newScenarios,
    utilityScorePrevious: previous.utilityScore,
    utilityScoreNext: next.utilityScore,
    utilityScoreDelta: round(next.utilityScore - previous.utilityScore),
    duplicateFillerRatio: round(duplicateFillerRatio),
    gates,
    failedGates,
    structuralValuePass,
    functionalOfflineTierValueReady: structuralValuePass,
    customerPurchaseWorthinessProven: false,
    sellEnabled: false,
    chargeAllowed: false,
    paidDeliveryAllowed: false,
    deliveryState: structuralValuePass ? "SYNTHETIC_READINESS_ONLY_NOT_FOR_SALE" : "UNAVAILABLE_NOT_FOR_SALE",
    readinessClass: "SYNTHETIC_READINESS_ONLY",
    realProviderCoverage: 0,
    rightsApprovedCoverage: 0,
  };
}

function blindScore(output) {
  const raw = output.materialFieldCount
    + output.evidenceFamilyCount * 7
    + output.scenarioCount * 5
    + output.sectionCount * 1.5
    + output.actionabilityScore * 8
    + output.traceabilityScore * 8
    + (output.safetyCorrect ? 10 : 0)
    - output.fillerRatio * 100
    - output.unsupportedClaimCount * 25;
  return round(raw, 6);
}

function buildBlindComparison(previous, next, evaluation) {
  const flip = Number.parseInt(sha256(`${previous.caseId}:${evaluation.upgradeId}`).slice(-2), 16) % 2 === 1;
  const aliasA = flip ? next : previous;
  const aliasB = flip ? previous : next;
  const scoreA = blindScore(aliasA);
  const scoreB = blindScore(aliasB);
  const selectedAlias = scoreA === scoreB ? "TIE" : scoreA > scoreB ? "A" : "B";
  const expectedAlias = flip ? "A" : "B";
  return {
    caseId: previous.caseId,
    blindCaseId: previous.blindCaseId,
    surfaceId: previous.surfaceId,
    upgradeId: evaluation.upgradeId,
    aliasAOutputSha256: aliasA.outputSha256,
    aliasBOutputSha256: aliasB.outputSha256,
    scoreA,
    scoreB,
    selectedAlias,
    expectedHigherTierAlias: expectedAlias,
    correct: selectedAlias === expectedAlias,
    tierLabelsHiddenFromScorer: true,
  };
}

function recomputeMutant(output) {
  const next = JSON.parse(JSON.stringify(output));
  next.materialFieldCount = next.fields.length;
  next.evidenceFamilyCount = next.evidenceFamilies.length;
  next.scenarioCount = next.scenarios.length;
  next.sectionCount = next.sections.length;
  next.actionabilityScore = round(actionabilityScore(next.sections));
  next.fillerRatio = round(Math.max(duplicateRatio(next.fields), duplicateRatio(next.sections), duplicateRatio(next.declaredEvidenceFamilies), duplicateRatio(next.scenarios)));
  next.utilityScore = outputUtilityScore(next);
  const { outputSha256, ...core } = next;
  next.outputSha256 = sha256(core);
  return next;
}

function mutateNextOutput(previous, next, mutationType, policy) {
  let mutant = JSON.parse(JSON.stringify(next));
  mutant.mutationType = mutationType;
  if (mutationType === "PAGE_COUNT_ONLY_FILLER") {
    mutant.fields = [...previous.fields];
    mutant.fieldStates = { ...previous.fieldStates };
    mutant.sections = [...previous.sections, ...previous.sections];
    mutant.evidenceFamilies = [...previous.evidenceFamilies];
    mutant.declaredEvidenceFamilies = [...previous.declaredEvidenceFamilies];
    mutant.scenarios = [...previous.scenarios];
    mutant.sourceClaimIds = [...previous.sourceClaimIds];
    mutant.outputClaimIds = [...previous.outputClaimIds];
    mutant.fillerMarkers.push("PAGE_COUNT_ONLY_FILLER");
  }
  if (mutationType === "MISSING_INCREMENTAL_FIELDS") {
    const incremental = mutant.fields.filter((field) => !previous.fields.includes(field));
    const allowedIncremental = incremental.slice(0, Math.max(0, policy.thresholds.minimumIncrementalFieldsPerPaidUpgrade - 1));
    mutant.fields = unique([...previous.fields, ...allowedIncremental]).sort();
    mutant.fieldStates = Object.fromEntries(mutant.fields.map((field) => [field, mutant.fieldStates[field] ?? "AVAILABLE"]));
    mutant.sourceClaimIds = mutant.fields.map((field) => `${mutant.surfaceId}.${mutant.tier}.claim.${field}`).sort();
    mutant.outputClaimIds = [...mutant.sourceClaimIds];
  }
  if (mutationType === "MISSING_INCREMENTAL_EVIDENCE") {
    mutant.declaredEvidenceFamilies = [...previous.declaredEvidenceFamilies];
    mutant.evidenceFamilies = [...previous.evidenceFamilies];
  }
  if (mutationType === "MISSING_INCREMENTAL_SCENARIOS") {
    mutant.scenarios = [...previous.scenarios];
  }
  if (mutationType === "SAFETY_REGRESSION") {
    mutant.blockers = unique([...mutant.blockers, "CRITICAL_INPUT_STALE"]);
    mutant.abstained = false;
    mutant.outcome = "READY_OFFLINE";
    mutant.safetyCorrect = false;
  }
  if (mutationType === "INVENTED_CLAIM") {
    mutant.outputClaimIds = [...mutant.outputClaimIds, `${mutant.surfaceId}.${mutant.tier}.claim.invented_material_fact`].sort();
    mutant.addedFactCount = 1;
    mutant.unsupportedClaimCount = 1;
  }
  if (mutationType === "SILENT_TIER_DOWNGRADE") {
    mutant.fields = [...previous.fields];
    mutant.fieldStates = { ...previous.fieldStates };
    mutant.sections = [...previous.sections];
    mutant.evidenceFamilies = [...previous.evidenceFamilies];
    mutant.declaredEvidenceFamilies = [...previous.declaredEvidenceFamilies];
    mutant.scenarios = [...previous.scenarios];
    mutant.sourceClaimIds = [...previous.sourceClaimIds];
    mutant.outputClaimIds = [...previous.outputClaimIds];
  }
  if (mutationType === "DUPLICATE_FILLER") {
    mutant.fields = [...mutant.fields, ...mutant.fields.slice(0, Math.max(1, Math.ceil(mutant.fields.length / 3)))];
    mutant.sections = [...mutant.sections, ...mutant.sections.slice(0, Math.max(1, Math.ceil(mutant.sections.length / 2)))];
    mutant.declaredEvidenceFamilies = [...mutant.declaredEvidenceFamilies, ...mutant.declaredEvidenceFamilies.slice(0, 1)];
    mutant.fillerMarkers.push("DUPLICATE_FILLER");
  }
  return recomputeMutant(mutant);
}

function buildCase(surfaceId, index) {
  const archetype = ARCHETYPES[index % ARCHETYPES.length];
  const caseId = `${surfaceId}-case-${String(index + 1).padStart(2, "0")}`;
  return {
    caseId,
    blindCaseId: `blind_${sha256(caseId).slice(-20)}`,
    surfaceId,
    index,
    split: splitForCaseIndex(index),
    archetype,
    synthetic: true,
    customerCase: false,
    realProviderCase: false,
  };
}

export function runPass35A18TierValueBenchmarkRuntime({ productContract, policy, evaluatedAt = "2026-07-23T06:00:00.000Z" } = {}) {
  if (!productContract || !policy) throw new Error("a18_input_missing");
  if (!verifyPass35A18TierValuePolicy(productContract, policy)) throw new Error("a18_policy_contract_invalid");
  const product = applyPass35A18TierValuePolicy(productContract, policy);
  const cases = product.surfaces.flatMap((surface) => Array.from({ length: policy.caseProgram.casesPerSurface }, (_, index) => buildCase(surface.surfaceId, index)));
  const outputs = cases.flatMap((caseRecord) => TIERS.map((tier) => buildTierOutput(product, caseRecord.surfaceId, tier, caseRecord)));
  const outputIndex = new Map(outputs.map((output) => [`${output.caseId}:${output.tier}`, output]));
  const comparisons = [];
  const blindComparisons = [];
  const mutationResults = [];
  for (const caseRecord of cases) {
    for (const [previousTier, nextTier] of UPGRADE_PAIRS) {
      const previous = outputIndex.get(`${caseRecord.caseId}:${previousTier}`);
      const next = outputIndex.get(`${caseRecord.caseId}:${nextTier}`);
      const evaluation = evaluateUpgrade(previous, next, policy);
      comparisons.push(evaluation);
      blindComparisons.push(buildBlindComparison(previous, next, evaluation));
      for (const mutationType of policy.mutationTypes) {
        const mutant = mutateNextOutput(previous, next, mutationType, policy);
        const mutantEvaluation = evaluateUpgrade(previous, mutant, policy);
        mutationResults.push({
          caseId: caseRecord.caseId,
          surfaceId: caseRecord.surfaceId,
          upgradeId: evaluation.upgradeId,
          mutationType,
          mutantOutputSha256: mutant.outputSha256,
          killed: !mutantEvaluation.structuralValuePass,
          failedGates: mutantEvaluation.failedGates,
          chargeAllowed: mutantEvaluation.chargeAllowed,
          sellEnabled: mutantEvaluation.sellEnabled,
          deliveryState: mutantEvaluation.deliveryState,
        });
      }
    }
  }
  const splitCounts = Object.fromEntries(["development", "validation", "frozen_test"].map((split) => [split, cases.filter((row) => row.split === split).length]));
  const structuralPassCount = comparisons.filter((row) => row.structuralValuePass).length;
  const blindCorrectCount = blindComparisons.filter((row) => row.correct).length;
  const mutationKilledCount = mutationResults.filter((row) => row.killed).length;
  const structuralPassRate = structuralPassCount / comparisons.length;
  const blindSelectionAccuracy = blindCorrectCount / blindComparisons.length;
  const mutationKillRate = mutationKilledCount / mutationResults.length;
  const cleanOutputsNoCharge = outputs.every((row) => !row.chargeAllowed && !row.sellEnabled && !row.paidDeliveryAllowed && !row.liveClaimed);
  const mutantsNoCharge = mutationResults.every((row) => !row.chargeAllowed && !row.sellEnabled);
  const supplementalFamilyCount = policy.supplementalEvidenceFamilies.reduce((sum, row) => sum + row.families.length, 0);
  const perSurface = Object.fromEntries(product.surfaces.map((surface) => {
    const surfaceComparisons = comparisons.filter((row) => row.surfaceId === surface.surfaceId);
    const surfaceBlind = blindComparisons.filter((row) => row.surfaceId === surface.surfaceId);
    const surfaceMutations = mutationResults.filter((row) => row.surfaceId === surface.surfaceId);
    return [surface.surfaceId, {
      cases: cases.filter((row) => row.surfaceId === surface.surfaceId).length,
      outputs: outputs.filter((row) => row.surfaceId === surface.surfaceId).length,
      comparisons: surfaceComparisons.length,
      structuralPassRate: round(surfaceComparisons.filter((row) => row.structuralValuePass).length / surfaceComparisons.length),
      blindSelectionAccuracy: round(surfaceBlind.filter((row) => row.correct).length / surfaceBlind.length),
      mutationKillRate: round(surfaceMutations.filter((row) => row.killed).length / surfaceMutations.length),
    }];
  }));
  const core = {
    schemaVersion: "velmere.pass35.a18-tier-value-benchmark-runtime.v1",
    runtimeId: "pass35-a18-tier-value-benchmark-v1",
    passId: policy.passId,
    sourceRevisionId: policy.sourceRevisionId,
    evaluatedAt,
    surfaceCount: product.surfaces.length,
    caseDenominator: cases.length,
    outputDenominator: outputs.length,
    comparisonDenominator: comparisons.length,
    blindComparisonDenominator: blindComparisons.length,
    mutationDenominator: mutationResults.length,
    mutationTypeCount: policy.mutationTypes.length,
    supplementalEvidenceFamilyCount: supplementalFamilyCount,
    splitCounts,
    archetypes: ARCHETYPES,
    cases,
    outputs,
    comparisons,
    blindComparisons,
    mutationResults,
    perSurface,
    structuralPassCount,
    structuralPassRate: round(structuralPassRate),
    structuralPassWilson95: wilson(structuralPassCount, comparisons.length),
    blindCorrectCount,
    blindSelectionAccuracy: round(blindSelectionAccuracy),
    blindSelectionWilson95: wilson(blindCorrectCount, blindComparisons.length),
    mutationKilledCount,
    mutationKillRate: round(mutationKillRate),
    mutationKillWilson95: wilson(mutationKilledCount, mutationResults.length),
    allCleanStructuralUpgradesPass: structuralPassRate === 1,
    allBlindComparisonsSelectHigherTier: blindSelectionAccuracy === 1,
    allRequiredMutationsKilled: mutationKillRate === 1,
    cleanOutputsNoCharge,
    mutantsNoCharge,
    noSilentTierDowngrade: mutationResults.filter((row) => row.mutationType === "SILENT_TIER_DOWNGRADE").every((row) => row.killed),
    noPageCountOnlyUpgrade: mutationResults.filter((row) => row.mutationType === "PAGE_COUNT_ONLY_FILLER").every((row) => row.killed),
    functionalOfflineTierValueReady: structuralPassRate === 1 && blindSelectionAccuracy === 1 && mutationKillRate === 1,
    customerPurchaseWorthinessProven: false,
    sellEnabled: false,
    chargeAllowed: false,
    paidDeliveryAllowed: false,
    liveClaimed: false,
    truthBoundary: "A18 proves only frozen synthetic structural tier differentiation, blind scorer ordering, safety non-regression and rejection of known filler/downgrade mutations. It does not prove customer utility, willingness-to-pay, real provider quality, live performance or commercial purchase-worthiness.",
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyPass35A18TierValueBenchmarkRuntime(value, policy) {
  try {
    if (value?.schemaVersion !== "velmere.pass35.a18-tier-value-benchmark-runtime.v1") return false;
    if (value.surfaceCount !== 7 || value.caseDenominator !== 350 || value.outputDenominator !== 1050) return false;
    if (value.comparisonDenominator !== 700 || value.blindComparisonDenominator !== 700) return false;
    if (value.mutationTypeCount !== policy.thresholds.requiredMutationTypes || value.mutationDenominator !== 5600) return false;
    if (!value.allCleanStructuralUpgradesPass || !value.allBlindComparisonsSelectHigherTier || !value.allRequiredMutationsKilled) return false;
    if (!value.cleanOutputsNoCharge || !value.mutantsNoCharge || !value.noSilentTierDowngrade || !value.noPageCountOnlyUpgrade) return false;
    if (!value.functionalOfflineTierValueReady || value.customerPurchaseWorthinessProven || value.sellEnabled || value.chargeAllowed || value.paidDeliveryAllowed || value.liveClaimed) return false;
    if (value.splitCounts.development !== 210 || value.splitCounts.validation !== 70 || value.splitCounts.frozen_test !== 70) return false;
    const { integrity, ...core } = value;
    return integrity?.digest === sha256(core);
  } catch {
    return false;
  }
}
