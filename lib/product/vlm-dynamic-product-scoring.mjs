import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function loadR44P34ScoringInputs() {
  return {
    topology: read("config/pass36/a102r44p34-canonical-product-topology.json"),
    policy: read("config/pass36/a102r44p34-dynamic-scoring-policy.json"),
    ledger: read("config/pass36/a102r44p34-score-gate-ledger.json"),
    state: read("config/pass36/a102r44p34-action-required-current-state.json"),
  };
}

function productWeightClass(productId) {
  if (productId.startsWith("audit-")) return "AUDIT";
  if (productId.startsWith("pdf-")) return "PDF";
  if (productId.startsWith("browser-")) return "BROWSER";
  if (productId === "angel") return "ANGEL";
  if (productId === "risk-indicator") return "RISK";
  return "DATA_MODULE";
}

function scoreDimension(gates, dimension, statusCreditBps, phase) {
  const rows = gates.filter((gate) => gate.dimensions.includes(dimension));
  if (!rows.length) return null;
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const earned = rows.reduce((sum, row) => sum + row.weight * statusCreditBps[row[phase]], 0);
  return round2(earned / totalWeight / 100);
}

function weightedOverall(dimensionScores, weights) {
  let sum = 0;
  let total = 0;
  for (const [dimension, weight] of Object.entries(weights)) {
    const score = dimensionScores[dimension];
    if (typeof score !== "number") continue;
    sum += score * weight;
    total += weight;
  }
  return total ? round2(sum / total) : 0;
}

function releaseReadiness(gates, statusCreditBps, state, policy) {
  const rows = gates.filter((gate) => gate.releaseGate);
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const earned = rows.reduce((sum, row) => sum + row.weight * statusCreditBps[row.afterStatus], 0);
  let value = total ? earned / total / 100 : 0;
  if (state.testCycle.current < state.testCycle.total && !state.testCycle.fullRegressionCurrentPassExecuted) value = Math.min(value, policy.releaseRules.cycle1Or2ReleaseReadinessCapPct);
  if (!state.currentByteCredit.exactWindows) value = Math.min(value, policy.releaseRules.exactWindowsCapPct);
  return round2(value);
}

export function buildR44P34DynamicScorecard() {
  const { topology, policy, ledger, state } = loadR44P34ScoringInputs();
  const rows = topology.products.map((product) => {
    const gates = ledger.gates.filter((gate) => gate.productIds.includes(product.productId));
    const beforeDimensions = Object.fromEntries(policy.dimensions.map((dimension) => [dimension, scoreDimension(gates, dimension, policy.statusCreditBps, "beforeStatus")]));
    const afterDimensions = Object.fromEntries(policy.dimensions.map((dimension) => [dimension, scoreDimension(gates, dimension, policy.statusCreditBps, "afterStatus")]));
    const weights = policy.productClassWeights[productWeightClass(product.productId)];
    const before = weightedOverall(beforeDimensions, weights);
    const after = weightedOverall(afterDimensions, weights);
    const changedGates = gates.filter((gate) => gate.beforeStatus !== gate.afterStatus).map((gate) => ({ gateId: gate.gateId, before: gate.beforeStatus, after: gate.afterStatus, evidence: gate.evidence }));
    const blockers = gates.filter((gate) => gate.afterStatus === "MISSING" || gate.afterStatus === "BLOCKED").map((gate) => gate.gateId);
    const customerProof = typeof afterDimensions.customerProof === "number" ? afterDimensions.customerProof : 0;
    const accuracy = typeof afterDimensions.accuracySemanticTruth === "number" ? afterDimensions.accuracySemanticTruth : 0;
    const data = typeof afterDimensions.dataProvenance === "number" ? afterDimensions.dataProvenance : 0;
    const worldClassEvidence = round2((accuracy * 0.5) + (data * 0.3) + (customerProof * 0.2));
    const saleDecision = product.commercialRole === "CONTROLLED_BETA_CANDIDATE" ? "CONTROLLED_BETA_CANDIDATE_MANUAL_QA_REQUIRED" : product.commercialRole === "NOT_FOR_SALE" ? "NOT_FOR_SALE" : "FREE_ACTION_REQUIRED";
    return {
      productId: product.productId, displayName: product.displayName, productClass: product.productClass, tier: product.tier,
      scoreBeforePct: before, scoreAfterPct: after, deltaPct: round2(after - before),
      dimensionScoresBefore: beforeDimensions, dimensionScoresAfter: afterDimensions,
      releaseReadinessPct: releaseReadiness(gates, policy.statusCreditBps, state, policy), customerProofPct: customerProof, worldClassEvidencePct: worldClassEvidence,
      changedGates, openBlockers: blockers, reasonForNoMovement: before === after ? "No gate relevant to this product changed in R44P34." : null,
      commercialRole: product.commercialRole, saleDecision, saleEnabled: false, publicCheckoutAllowed: false,
    };
  });
  return {
    schemaVersion: "velmere.pass36.a102r44p34.dynamic-product-scorecard.v1", revisionId: topology.revisionId, testCycle: topology.testCycle,
    globalDecision: "NO_GO", saleEnabled: false, rows,
    summary: { productRows: rows.length, tieredRows: rows.filter((row) => row.tier !== null).length, standaloneRows: rows.filter((row) => row.tier === null).length, movedRows: rows.filter((row) => row.deltaPct !== 0).length, customerProvenRows: rows.filter((row) => row.customerProofPct > 0).length, saleEnabledRows: 0 },
    truthBoundary: "Dynamic scores are gate completion, not certification. Full current-child regression and real customer proof remain open.",
  };
}

export function loadR44P35ScoringInputs() {
  return {
    topology: read("config/pass36/a102r44p35-canonical-product-topology.json"),
    policy: read("config/pass36/a102r44p35-dynamic-scoring-policy.json"),
    ledger: read("config/pass36/a102r44p35-score-gate-ledger.json"),
    state: read("config/pass36/a102r44p35-action-required-current-state.json"),
  };
}

function buildDynamicScorecard(inputs, schemaVersion, noMovementReason) {
  const { topology, policy, ledger, state } = inputs;
  const rows = topology.products.map((product) => {
    const gates = ledger.gates.filter((gate) => gate.productIds.includes(product.productId));
    const beforeDimensions = Object.fromEntries(policy.dimensions.map((dimension) => [dimension, scoreDimension(gates, dimension, policy.statusCreditBps, "beforeStatus")]));
    const afterDimensions = Object.fromEntries(policy.dimensions.map((dimension) => [dimension, scoreDimension(gates, dimension, policy.statusCreditBps, "afterStatus")]));
    const weights = policy.productClassWeights[productWeightClass(product.productId)];
    const before = weightedOverall(beforeDimensions, weights);
    const after = weightedOverall(afterDimensions, weights);
    const changedGates = gates.filter((gate) => gate.beforeStatus !== gate.afterStatus).map((gate) => ({ gateId: gate.gateId, before: gate.beforeStatus, after: gate.afterStatus, evidence: gate.evidence }));
    const blockers = gates.filter((gate) => gate.afterStatus === "MISSING" || gate.afterStatus === "BLOCKED").map((gate) => gate.gateId);
    const customerProof = typeof afterDimensions.customerProof === "number" ? afterDimensions.customerProof : 0;
    const accuracy = typeof afterDimensions.accuracySemanticTruth === "number" ? afterDimensions.accuracySemanticTruth : 0;
    const data = typeof afterDimensions.dataProvenance === "number" ? afterDimensions.dataProvenance : 0;
    const rawWorldClassEvidence = round2((accuracy * 0.5) + (data * 0.3) + (customerProof * 0.2));
    const worldClassEvidence = customerProof <= 0
      ? Math.min(rawWorldClassEvidence, 49)
      : rawWorldClassEvidence;
    const worldClassCapReason = customerProof <= 0
      ? "WORLD_CLASS_EVIDENCE_CAPPED_BELOW_50_WITH_ZERO_REAL_CUSTOMER_PROOF"
      : null;
    const saleDecision = product.commercialRole === "CONTROLLED_BETA_CANDIDATE" ? "CONTROLLED_BETA_CANDIDATE_MANUAL_QA_REQUIRED" : product.commercialRole === "NOT_FOR_SALE" ? "NOT_FOR_SALE" : "FREE_ACTION_REQUIRED";
    return {
      productId: product.productId,
      displayName: product.displayName,
      productClass: product.productClass,
      tier: product.tier,
      scoreBeforePct: before,
      scoreAfterPct: after,
      deltaPct: round2(after - before),
      dimensionScoresBefore: beforeDimensions,
      dimensionScoresAfter: afterDimensions,
      releaseReadinessPct: releaseReadiness(gates, policy.statusCreditBps, state, policy),
      customerProofPct: customerProof,
      worldClassEvidencePct: worldClassEvidence,
      worldClassCapReason,
      changedGates,
      openBlockers: blockers,
      reasonForNoMovement: before === after ? noMovementReason : null,
      commercialRole: product.commercialRole,
      saleDecision,
      saleEnabled: false,
      publicCheckoutAllowed: false,
    };
  });
  return {
    schemaVersion,
    revisionId: topology.revisionId,
    testCycle: topology.testCycle,
    globalDecision: "NO_GO",
    saleEnabled: false,
    rows,
    summary: {
      productRows: rows.length,
      tieredRows: rows.filter((row) => row.tier !== null).length,
      standaloneRows: rows.filter((row) => row.tier === null).length,
      movedRows: rows.filter((row) => row.deltaPct !== 0).length,
      customerProvenRows: rows.filter((row) => row.customerProofPct > 0).length,
      saleEnabledRows: 0,
    },
    truthBoundary: "Cycle 2/3 targeted scores are gate completion, not certification. Full current-child regression, provider rights and real customer proof remain open.",
  };
}

export function buildR44P35DynamicScorecard() {
  return buildDynamicScorecard(
    loadR44P35ScoringInputs(),
    "velmere.pass36.a102r44p35.dynamic-product-scorecard.v1",
    "No gate relevant to this product changed in R44P35.",
  );
}
