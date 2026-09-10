import { createHash } from "node:crypto";

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = (value) => `sha256:${createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex")}`;
const round = (value) => Number(value.toFixed(8));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const logit = (p) => Math.log(clamp(p, 1e-8, 1 - 1e-8) / (1 - clamp(p, 1e-8, 1 - 1e-8)));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return [0, 0];
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denominator;
  return [round(clamp(center - half, 0, 1)), round(clamp(center + half, 0, 1))];
}

function calibrationRegression(rows) {
  if (rows.length < 3 || new Set(rows.map((row) => row.outcome)).size < 2) return { intercept: null, slope: null, converged: false, iterations: 0 };
  let a = 0;
  let b = 1;
  let converged = false;
  let iteration = 0;
  for (; iteration < 50; iteration += 1) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (const row of rows) {
      const x = logit(row.prediction);
      const q = sigmoid(a + b * x);
      const w = Math.max(1e-9, q * (1 - q));
      const residual = row.outcome - q;
      g0 += residual;
      g1 += residual * x;
      h00 -= w;
      h01 -= w * x;
      h11 -= w * x * x;
    }
    const determinant = h00 * h11 - h01 * h01;
    if (Math.abs(determinant) < 1e-12) break;
    const da = (g0 * h11 - g1 * h01) / determinant;
    const db = (h00 * g1 - h01 * g0) / determinant;
    a -= da;
    b -= db;
    if (Math.max(Math.abs(da), Math.abs(db)) < 1e-9) { converged = true; break; }
  }
  return { intercept: round(a), slope: round(b), converged, iterations: iteration + 1 };
}

export function computePass35A17CalibrationMetrics(rows, { bins = 10 } = {}) {
  const covered = rows.filter((row) => !row.abstained);
  if (!covered.length) return { count: rows.length, coveredCount: 0, coverage: 0, eventRate: null, brier: null, logLoss: null, ece: null, mce: null, brierSkillVsHalf: null, calibrationIntercept: null, calibrationSlope: null, calibrationConverged: false, bins: [] };
  const brier = covered.reduce((sum, row) => sum + (row.prediction - row.outcome) ** 2, 0) / covered.length;
  const logLoss = -covered.reduce((sum, row) => sum + row.outcome * Math.log(clamp(row.prediction, 1e-9, 1)) + (1 - row.outcome) * Math.log(clamp(1 - row.prediction, 1e-9, 1)), 0) / covered.length;
  const baselineBrier = covered.reduce((sum, row) => sum + (0.5 - row.outcome) ** 2, 0) / covered.length;
  const binRows = [];
  let ece = 0;
  let mce = 0;
  for (let index = 0; index < bins; index += 1) {
    const lower = index / bins;
    const upper = (index + 1) / bins;
    const members = covered.filter((row) => row.prediction >= lower && (index === bins - 1 ? row.prediction <= upper : row.prediction < upper));
    if (!members.length) continue;
    const meanPrediction = members.reduce((sum, row) => sum + row.prediction, 0) / members.length;
    const successes = members.reduce((sum, row) => sum + row.outcome, 0);
    const observedRate = successes / members.length;
    const absoluteGap = Math.abs(meanPrediction - observedRate);
    ece += (members.length / covered.length) * absoluteGap;
    mce = Math.max(mce, absoluteGap);
    binRows.push({
      bin: index,
      lower: round(lower),
      upper: round(upper),
      count: members.length,
      meanPrediction: round(meanPrediction),
      observedRate: round(observedRate),
      observedRateWilson95: wilson(successes, members.length),
      absoluteGap: round(absoluteGap),
    });
  }
  const regression = calibrationRegression(covered);
  const successes = covered.reduce((sum, row) => sum + row.outcome, 0);
  return {
    count: rows.length,
    coveredCount: covered.length,
    coverage: round(covered.length / rows.length),
    coverageWilson95: wilson(covered.length, rows.length),
    eventRate: round(successes / covered.length),
    eventRateWilson95: wilson(successes, covered.length),
    brier: round(brier),
    logLoss: round(logLoss),
    ece: round(ece),
    mce: round(mce),
    brierSkillVsHalf: round(1 - brier / baselineBrier),
    calibrationIntercept: regression.intercept,
    calibrationSlope: regression.slope,
    calibrationConverged: regression.converged,
    calibrationIterations: regression.iterations,
    bins: binRows,
  };
}

function assertTemporalRows(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.caseId)) throw new Error("a17_risk_duplicate_case");
    ids.add(row.caseId);
    const predictedAt = Date.parse(row.predictedAt);
    const observedAt = Date.parse(row.outcomeObservedAt);
    if (!Number.isFinite(predictedAt) || !Number.isFinite(observedAt) || predictedAt >= observedAt) throw new Error("a17_risk_temporal_leakage");
    if (row.prediction < 0 || row.prediction > 1 || ![0, 1].includes(row.outcome)) throw new Error("a17_risk_value_invalid");
  }
}

export function runPass35A17RiskCalibrationEvaluationRuntime({ rows = [], evaluatedAt = "2026-07-23T04:00:00.000Z", thresholds = { abstainBelowEvidence: 0.55, humanOverrideAt: 0.8, calibrationBins: 10 } } = {}) {
  assertTemporalRows(rows);
  const evaluatedAtMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs) || new Date(evaluatedAtMs).toISOString() !== evaluatedAt) throw new Error("a17_risk_evaluated_at_invalid");
  const thresholdRegistry = {
    schemaVersion: "velmere.pass35.a17.risk-threshold-registry.v1",
    thresholds,
    frozenBeforeEvaluation: true,
    mutationAllowedAfterOutcome: false,
  };
  const thresholdRegistrySha256 = sha256(thresholdRegistry);
  const splits = Object.fromEntries(["train", "validation", "prospective"].map((split) => [split, rows.filter((row) => row.split === split)]));
  const splitMetrics = Object.fromEntries(Object.entries(splits).map(([split, splitRows]) => [split, computePass35A17CalibrationMetrics(splitRows, { bins: thresholds.calibrationBins })]));
  const segmentMetrics = Object.fromEntries([...new Set(rows.map((row) => row.segment))].sort().map((segment) => [segment, computePass35A17CalibrationMetrics(rows.filter((row) => row.segment === segment), { bins: thresholds.calibrationBins })]));
  const regimeMetrics = Object.fromEntries([...new Set(rows.map((row) => row.regime))].sort().map((regime) => [regime, computePass35A17CalibrationMetrics(rows.filter((row) => row.regime === regime), { bins: thresholds.calibrationBins })]));
  const prospectiveReceipts = splits.prospective.map((row) => {
    const closeAtMs = Date.parse(row.outcomeObservedAt);
    const outcomeWindowClosed = evaluatedAtMs >= closeAtMs;
    const predictionCore = {
      caseId: row.caseId,
      prediction: row.prediction,
      predictedAt: row.predictedAt,
      segment: row.segment,
      regime: row.regime,
      thresholdRegistrySha256,
    };
    return {
      ...predictionCore,
      predictionSha256: sha256(predictionCore),
      outcomeObservedAt: row.outcomeObservedAt,
      outcomeWindowClosed,
      outcomeAccessState: outcomeWindowClosed ? "AVAILABLE_FOR_FROZEN_EVALUATION" : "SEALED_UNTIL_WINDOW_CLOSE",
      outcomeIncludedInClaimMetrics: false,
      thresholdMutationAllowed: false,
    };
  });
  const prospectiveWindowClosedCount = prospectiveReceipts.filter((row) => row.outcomeWindowClosed).length;
  const metricsClaimAllowed = prospectiveWindowClosedCount === prospectiveReceipts.length && prospectiveReceipts.length > 0;
  const core = {
    schemaVersion: "velmere.pass35.a17.risk-calibration-evaluation-runtime.v1",
    runtimeId: "pass35-a17-risk-calibration-evaluation-v1",
    evaluatedAt,
    rowDenominator: rows.length,
    splitCounts: Object.fromEntries(Object.entries(splits).map(([key, value]) => [key, value.length])),
    thresholdRegistry,
    thresholdRegistrySha256,
    splitMetrics,
    segmentMetrics,
    regimeMetrics,
    prospectiveReceipts,
    prospectiveWindowClosedCount,
    prospectiveWindowOpenCount: prospectiveReceipts.length - prospectiveWindowClosedCount,
    empiricalCalibrationInfrastructureReady: true,
    prospectiveEvaluationInfrastructureReady: true,
    empiricalProbabilityClaimAllowed: false,
    prospectivePerformanceClaimAllowed: false,
    metricsClaimWouldBeAllowedAfterIndependentRealWindow: metricsClaimAllowed,
    sellEnabled: false,
    liveClaimed: false,
    truthBoundary: "A17 implements exact ECE/MCE, Brier skill, calibration slope/intercept, Wilson intervals, immutable thresholds and sealed prospective receipts. Synthetic outcomes cannot authorize empirical probability, live or paid claims.",
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function verifyPass35A17RiskCalibrationEvaluationRuntime(value) {
  try {
    if (value?.schemaVersion !== "velmere.pass35.a17.risk-calibration-evaluation-runtime.v1") return false;
    if (value.rowDenominator !== 600 || value.splitCounts.train !== 360 || value.splitCounts.validation !== 140 || value.splitCounts.prospective !== 100) return false;
    if (!value.splitMetrics.validation || typeof value.splitMetrics.validation.ece !== "number") return false;
    if (!value.thresholdRegistry.frozenBeforeEvaluation || value.thresholdRegistry.mutationAllowedAfterOutcome) return false;
    if (value.empiricalProbabilityClaimAllowed || value.prospectivePerformanceClaimAllowed || value.sellEnabled || value.liveClaimed) return false;
    if (value.prospectiveReceipts.some((row) => row.thresholdRegistrySha256 !== value.thresholdRegistrySha256 || row.thresholdMutationAllowed)) return false;
    const { integrity, ...core } = value;
    return integrity?.digest === sha256(core);
  } catch {
    return false;
  }
}
