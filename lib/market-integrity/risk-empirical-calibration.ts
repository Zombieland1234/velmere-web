import crypto from "node:crypto";
import { riskModelBindingDigest } from "./risk-model-binding";
import type { RiskModelBinding, TokenRiskResult } from "./risk-types";

export type RiskCalibrationModelBinding = RiskModelBinding & {
  outcomeHorizonMs: number;
};

export type RiskCalibrationObservation = {
  observationId: string;
  assetKey: string;
  riskScore: number;
  /** Latest timestamp of any feature used to compute riskScore. */
  featureCutoffAt: string;
  /** Timestamp at which the score was issued. */
  observedAt: string;
  /** Timestamp at which the configured outcome window became observable. */
  outcomeObservedAt: string;
  outcomeOccurred: boolean;
  cohort: string;
  modelBindingDigest: string;
};

export type RiskCalibrationBlock = {
  minScore: number;
  maxScore: number;
  calibratedProbability: number;
  sampleCount: number;
  positiveCount: number;
};

export type RiskCalibrationMetrics = {
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  baseRate: number;
  auroc: number;
  brierScore: number;
  baselineBrierScore: number;
  brierSkillScore: number;
  logLoss: number;
  expectedCalibrationError: number;
  maximumCalibrationError: number;
};

export type RiskCalibrationValidationGate = {
  id: string;
  passed: boolean;
  observed: number | string | boolean;
  required: number | string | boolean;
};

export type SignedRiskCalibrationProfile = {
  schemaVersion: "velmere.risk-empirical-calibration.v2";
  profileId: string;
  status: "holdout_validated" | "rejected";
  interpretation: "empirical_event_probability_for_declared_outcome_only";
  outcomeDefinition: string;
  scoreFormula: string;
  modelBinding: RiskCalibrationModelBinding;
  modelBindingDigest: string;
  trainWindow: { firstObservedAt: string; lastObservedAt: string; sampleCount: number };
  holdoutWindow: { firstObservedAt: string; lastObservedAt: string; sampleCount: number };
  purgeGapMs: number;
  trainingMetrics: Pick<RiskCalibrationMetrics, "sampleCount" | "positiveCount" | "negativeCount" | "baseRate">;
  holdoutMetrics: RiskCalibrationMetrics;
  mapping: RiskCalibrationBlock[];
  referenceScoreBins: Array<{
    lowerInclusive: number;
    upperInclusive: number;
    sampleCount: number;
    fraction: number;
  }>;
  datasetObservationCount: number;
  calibrationObservationKeyHashes: string[];
  datasetDiversity: {
    trainingDistinctAssetCount: number;
    holdoutDistinctAssetCount: number;
    holdoutPositiveDistinctAssetCount: number;
    holdoutNegativeDistinctAssetCount: number;
    maximumObservationsPerAssetObserved: number;
    maximumObservationsPerAssetAllowed: number;
  };
  validationGates: RiskCalibrationValidationGate[];
  datasetDigest: string;
  integrityDigest: string;
  issuedAt: string;
  expiresAt: string;
  signerKeyId: string;
  signature: string;
};

export type BuildRiskCalibrationProfileInput = {
  observations: RiskCalibrationObservation[];
  outcomeDefinition: string;
  scoreFormula: string;
  modelBinding: RiskCalibrationModelBinding;
  signerKeyId: string;
  signingSecret: string;
  issuedAt?: string;
  validityDays?: number;
  trainFraction?: number;
  purgeGapMs?: number;
  minimumHoldoutSamples?: number;
  minimumClassSamples?: number;
  minimumAuRoc?: number;
  minimumBrierSkill?: number;
  maximumEce?: number;
  minimumTrainingDistinctAssets?: number;
  minimumHoldoutDistinctAssets?: number;
  minimumHoldoutClassDistinctAssets?: number;
  maximumObservationsPerAsset?: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function dateMs(value: string, field: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`risk_calibration_invalid_${field}`);
  return parsed;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function calibrationObservationKeyHash(assetKey: string, observedAt: string) {
  return sha256(canonicalJson({
    assetKey: assetKey.trim().toLowerCase(),
    observedAt: new Date(dateMs(observedAt, "observation_key_observed_at")).toISOString(),
  }));
}

function hmac(value: string, secret: string) {
  return `hmac-sha256:${crypto.createHmac("sha256", secret).update(value).digest("hex")}`;
}

function safeEqual(left: unknown, right: unknown) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizedObservations(observations: RiskCalibrationObservation[]) {
  if (!Array.isArray(observations)) throw new Error("risk_calibration_observations_required");
  const ids = new Set<string>();
  const observationKeys = new Set<string>();
  const normalized = observations.map((observation) => {
    if (
      !observation ||
      typeof observation.observationId !== "string" ||
      typeof observation.assetKey !== "string" ||
      typeof observation.featureCutoffAt !== "string" ||
      typeof observation.observedAt !== "string" ||
      typeof observation.outcomeObservedAt !== "string" ||
      typeof observation.outcomeOccurred !== "boolean" ||
      typeof observation.cohort !== "string" ||
      typeof observation.modelBindingDigest !== "string"
    ) throw new Error("risk_calibration_observation_shape_invalid");
    const observationId = observation.observationId.trim();
    const assetKey = observation.assetKey.trim().toLowerCase();
    if (!observationId || !assetKey) throw new Error("risk_calibration_identity_required");
    if (ids.has(observationId)) throw new Error("risk_calibration_duplicate_observation");
    ids.add(observationId);
    if (!Number.isFinite(observation.riskScore) || observation.riskScore < 0 || observation.riskScore > 100) {
      throw new Error("risk_calibration_score_out_of_range");
    }
    const featureCutoff = dateMs(observation.featureCutoffAt, "feature_cutoff_at");
    const observed = dateMs(observation.observedAt, "observed_at");
    const outcomeObserved = dateMs(observation.outcomeObservedAt, "outcome_observed_at");
    if (featureCutoff > observed) throw new Error("risk_calibration_lookahead_feature_detected");
    if (outcomeObserved <= observed) throw new Error("risk_calibration_outcome_window_invalid");
    const observationKey = calibrationObservationKeyHash(assetKey, new Date(observed).toISOString());
    if (observationKeys.has(observationKey)) throw new Error("risk_calibration_duplicate_asset_time_observation");
    observationKeys.add(observationKey);
    return {
      ...observation,
      observationId,
      assetKey,
      riskScore: round(observation.riskScore, 8),
      featureCutoffMs: featureCutoff,
      observedMs: observed,
      outcomeObservedMs: outcomeObserved,
    };
  });
  normalized.sort((left, right) => left.observedMs - right.observedMs || left.observationId.localeCompare(right.observationId));
  return normalized;
}

type NormalizedObservation = ReturnType<typeof normalizedObservations>[number];

function fitIsotonic(observations: NormalizedObservation[]): RiskCalibrationBlock[] {
  const ordered = [...observations].sort(
    (left, right) => left.riskScore - right.riskScore || left.observedMs - right.observedMs,
  );
  type MutableBlock = RiskCalibrationBlock & { probabilitySum: number };
  const scoreGroups: MutableBlock[] = [];
  for (const observation of ordered) {
    const positive = observation.outcomeOccurred ? 1 : 0;
    const existing = scoreGroups.at(-1);
    if (existing?.minScore === observation.riskScore) {
      existing.probabilitySum += positive;
      existing.sampleCount += 1;
      existing.positiveCount += positive;
      existing.calibratedProbability = existing.probabilitySum / existing.sampleCount;
      continue;
    }
    scoreGroups.push({
      minScore: observation.riskScore,
      maxScore: observation.riskScore,
      calibratedProbability: positive,
      probabilitySum: positive,
      sampleCount: 1,
      positiveCount: positive,
    });
  }

  const blocks: MutableBlock[] = [];
  for (const group of scoreGroups) {
    blocks.push({ ...group });
    while (blocks.length >= 2) {
      const right = blocks.at(-1)!;
      const left = blocks.at(-2)!;
      if (left.calibratedProbability <= right.calibratedProbability) break;
      blocks.splice(-2, 2, {
        minScore: left.minScore,
        maxScore: right.maxScore,
        probabilitySum: left.probabilitySum + right.probabilitySum,
        sampleCount: left.sampleCount + right.sampleCount,
        positiveCount: left.positiveCount + right.positiveCount,
        calibratedProbability: (left.probabilitySum + right.probabilitySum) / (left.sampleCount + right.sampleCount),
      });
    }
  }
  return blocks.map(({ probabilitySum: _probabilitySum, ...block }) => ({
    ...block,
    minScore: round(block.minScore, 6),
    maxScore: round(block.maxScore, 6),
    calibratedProbability: round(block.calibratedProbability, 8),
  }));
}

function calibratedProbability(score: number, mapping: RiskCalibrationBlock[]) {
  if (!mapping.length) throw new Error("risk_calibration_mapping_empty");
  const exact = mapping.find((block) => score >= block.minScore && score <= block.maxScore);
  if (exact) return exact.calibratedProbability;
  if (score < mapping[0].minScore) return mapping[0].calibratedProbability;
  if (score > mapping.at(-1)!.maxScore) return mapping.at(-1)!.calibratedProbability;
  const rightIndex = mapping.findIndex((block) => block.minScore > score);
  const left = mapping[Math.max(0, rightIndex - 1)];
  const right = mapping[Math.max(0, rightIndex)];
  if (!right || right.minScore === left.maxScore) return left.calibratedProbability;
  const ratio = clamp((score - left.maxScore) / (right.minScore - left.maxScore));
  return left.calibratedProbability + (right.calibratedProbability - left.calibratedProbability) * ratio;
}

function areaUnderRoc(rows: Array<{ probability: number; outcome: boolean }>) {
  const positives = rows.filter((row) => row.outcome).length;
  const negatives = rows.length - positives;
  if (!positives || !negatives) return 0.5;
  const ordered = [...rows].sort((left, right) => left.probability - right.probability);
  let rankSum = 0;
  let index = 0;
  while (index < ordered.length) {
    let end = index + 1;
    while (end < ordered.length && ordered[end].probability === ordered[index].probability) end += 1;
    const averageRank = (index + 1 + end) / 2;
    for (let cursor = index; cursor < end; cursor += 1) if (ordered[cursor].outcome) rankSum += averageRank;
    index = end;
  }
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function calibrationMetrics(observations: NormalizedObservation[], mapping: RiskCalibrationBlock[], trainingBaseRate: number): RiskCalibrationMetrics {
  const rows = observations.map((observation) => ({
    probability: clamp(calibratedProbability(observation.riskScore, mapping), 1e-6, 1 - 1e-6),
    outcome: observation.outcomeOccurred,
  }));
  const positives = rows.filter((row) => row.outcome).length;
  const negatives = rows.length - positives;
  const brier = rows.reduce((sum, row) => sum + (row.probability - Number(row.outcome)) ** 2, 0) / rows.length;
  const baselineBrier = rows.reduce((sum, row) => sum + (trainingBaseRate - Number(row.outcome)) ** 2, 0) / rows.length;
  const logLoss = -rows.reduce(
    (sum, row) => sum + (row.outcome ? Math.log(row.probability) : Math.log(1 - row.probability)),
    0,
  ) / rows.length;
  const binCount = 10;
  let ece = 0;
  let mce = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const lower = bin / binCount;
    const upper = (bin + 1) / binCount;
    const members = rows.filter((row) => row.probability >= lower && (bin === binCount - 1 ? row.probability <= upper : row.probability < upper));
    if (!members.length) continue;
    const predicted = members.reduce((sum, row) => sum + row.probability, 0) / members.length;
    const observed = members.filter((row) => row.outcome).length / members.length;
    const error = Math.abs(predicted - observed);
    ece += (members.length / rows.length) * error;
    mce = Math.max(mce, error);
  }
  return {
    sampleCount: rows.length,
    positiveCount: positives,
    negativeCount: negatives,
    baseRate: round(positives / rows.length),
    auroc: round(areaUnderRoc(rows)),
    brierScore: round(brier),
    baselineBrierScore: round(baselineBrier),
    brierSkillScore: round(baselineBrier > 0 ? 1 - brier / baselineBrier : 0),
    logLoss: round(logLoss),
    expectedCalibrationError: round(ece),
    maximumCalibrationError: round(mce),
  };
}

function fixedScoreBins(scores: number[]) {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    lowerInclusive: index * 10,
    upperInclusive: index === 9 ? 100 : (index + 1) * 10,
    sampleCount: 0,
    fraction: 0,
  }));
  for (const score of scores) {
    const index = Math.min(9, Math.max(0, Math.floor(score / 10)));
    bins[index].sampleCount += 1;
  }
  return bins.map((bin) => ({ ...bin, fraction: round(bin.sampleCount / Math.max(1, scores.length), 8) }));
}

function profileUnsigned(profile: SignedRiskCalibrationProfile) {
  const { signature: _signature, ...unsigned } = profile;
  return unsigned;
}

export function buildSignedRiskCalibrationProfile(input: BuildRiskCalibrationProfileInput): SignedRiskCalibrationProfile {
  const observations = normalizedObservations(input.observations);
  if (!input.modelBinding || typeof input.modelBinding !== "object") {
    throw new Error("risk_calibration_model_binding_invalid");
  }
  const modelBinding = {
    ...input.modelBinding,
    scoreFormula: input.modelBinding.scoreFormula.trim(),
    featureSchemaVersion: input.modelBinding.featureSchemaVersion.trim(),
    featureSchemaDigest: input.modelBinding.featureSchemaDigest.trim(),
    providerConfigurationDigest: input.modelBinding.providerConfigurationDigest.trim(),
  } satisfies RiskCalibrationModelBinding;
  const modelBindingDigest = riskModelBindingDigest(modelBinding);
  if (
    input.scoreFormula.trim() !== modelBinding.scoreFormula ||
    modelBinding.schemaVersion !== "velmere.risk-model-binding.v1" ||
    !modelBinding.featureSchemaVersion ||
    !/^sha256:[a-f0-9]{64}$/u.test(modelBinding.featureSchemaDigest) ||
    !/^sha256:[a-f0-9]{64}$/u.test(modelBinding.providerConfigurationDigest) ||
    !modelBinding.assetClassCohort ||
    !Number.isSafeInteger(modelBinding.outcomeHorizonMs) ||
    modelBinding.outcomeHorizonMs < 60 * 60_000 ||
    modelBinding.outcomeHorizonMs > 365 * 24 * 60 * 60_000
  ) throw new Error("risk_calibration_model_binding_invalid");
  for (const observation of observations) {
    if (observation.modelBindingDigest !== modelBindingDigest) throw new Error("risk_calibration_observation_model_binding_mismatch");
    if (observation.cohort.trim().toLowerCase() !== modelBinding.assetClassCohort) throw new Error("risk_calibration_observation_cohort_mismatch");
    const observedHorizonMs = observation.outcomeObservedMs - observation.observedMs;
    if (Math.abs(observedHorizonMs - modelBinding.outcomeHorizonMs) > 60_000) throw new Error("risk_calibration_observation_horizon_mismatch");
  }
  if (observations.length < 300) throw new Error("risk_calibration_dataset_too_small");
  const trainFraction = input.trainFraction ?? 0.7;
  if (!Number.isFinite(trainFraction) || trainFraction < 0.5 || trainFraction > 0.85) {
    throw new Error("risk_calibration_train_fraction_invalid");
  }
  const purgeGapMs = input.purgeGapMs ?? 24 * 60 * 60 * 1000;
  if (!Number.isSafeInteger(purgeGapMs) || purgeGapMs < 0 || purgeGapMs > 365 * 24 * 60 * 60 * 1000) {
    throw new Error("risk_calibration_purge_gap_invalid");
  }
  const rawSplitIndex = Math.max(1, Math.min(observations.length - 1, Math.floor(observations.length * trainFraction)));
  const holdoutStartMs = observations[rawSplitIndex].observedMs;
  const holdoutAssetKeys = new Set(observations.slice(rawSplitIndex).map((observation) => observation.assetKey));
  const train = observations
    .slice(0, rawSplitIndex)
    .filter((observation) => observation.outcomeObservedMs <= holdoutStartMs - purgeGapMs)
    .filter((observation) => !holdoutAssetKeys.has(observation.assetKey));
  const holdout = observations.slice(rawSplitIndex);
  if (train.length < 100) throw new Error("risk_calibration_training_sample_too_small");
  if (!holdout.length) throw new Error("risk_calibration_holdout_empty");
  const mapping = fitIsotonic(train);
  const trainingPositiveCount = train.filter((observation) => observation.outcomeOccurred).length;
  const trainingBaseRate = trainingPositiveCount / train.length;
  const holdoutMetrics = calibrationMetrics(holdout, mapping, trainingBaseRate);
  const minimumHoldoutSamples = input.minimumHoldoutSamples ?? 200;
  const minimumClassSamples = input.minimumClassSamples ?? 30;
  const minimumAuRoc = input.minimumAuRoc ?? 0.65;
  const minimumBrierSkill = input.minimumBrierSkill ?? 0;
  const maximumEce = input.maximumEce ?? 0.12;
  const minimumTrainingDistinctAssets = input.minimumTrainingDistinctAssets ?? 100;
  const minimumHoldoutDistinctAssets = input.minimumHoldoutDistinctAssets ?? 100;
  const minimumHoldoutClassDistinctAssets = input.minimumHoldoutClassDistinctAssets ?? 30;
  const maximumObservationsPerAsset = input.maximumObservationsPerAsset ?? 20;
  if (!Number.isSafeInteger(minimumHoldoutSamples) || minimumHoldoutSamples < 200) {
    throw new Error("risk_calibration_holdout_gate_invalid");
  }
  if (!Number.isSafeInteger(minimumClassSamples) || minimumClassSamples < 30) {
    throw new Error("risk_calibration_class_gate_invalid");
  }
  if (!Number.isFinite(minimumAuRoc) || minimumAuRoc < 0.65 || minimumAuRoc > 1) {
    throw new Error("risk_calibration_auroc_gate_invalid");
  }
  if (!Number.isFinite(minimumBrierSkill) || minimumBrierSkill < 0 || minimumBrierSkill >= 1) {
    throw new Error("risk_calibration_brier_gate_invalid");
  }
  if (!Number.isFinite(maximumEce) || maximumEce <= 0 || maximumEce > 0.12) {
    throw new Error("risk_calibration_ece_gate_invalid");
  }
  if (!Number.isSafeInteger(minimumTrainingDistinctAssets) || minimumTrainingDistinctAssets < 100) {
    throw new Error("risk_calibration_training_asset_gate_invalid");
  }
  if (!Number.isSafeInteger(minimumHoldoutDistinctAssets) || minimumHoldoutDistinctAssets < 100) {
    throw new Error("risk_calibration_holdout_asset_gate_invalid");
  }
  if (!Number.isSafeInteger(minimumHoldoutClassDistinctAssets) || minimumHoldoutClassDistinctAssets < 30) {
    throw new Error("risk_calibration_class_asset_gate_invalid");
  }
  if (!Number.isSafeInteger(maximumObservationsPerAsset) || maximumObservationsPerAsset < 1 || maximumObservationsPerAsset > 20) {
    throw new Error("risk_calibration_asset_replication_gate_invalid");
  }
  const trainingDistinctAssetCount = new Set(train.map((observation) => observation.assetKey)).size;
  const holdoutDistinctAssetCount = new Set(holdout.map((observation) => observation.assetKey)).size;
  const holdoutPositiveDistinctAssetCount = new Set(
    holdout.filter((observation) => observation.outcomeOccurred).map((observation) => observation.assetKey),
  ).size;
  const holdoutNegativeDistinctAssetCount = new Set(
    holdout.filter((observation) => !observation.outcomeOccurred).map((observation) => observation.assetKey),
  ).size;
  const observationsPerAsset = new Map<string, number>();
  for (const observation of observations) {
    observationsPerAsset.set(observation.assetKey, (observationsPerAsset.get(observation.assetKey) ?? 0) + 1);
  }
  const maximumObservationsPerAssetObserved = Math.max(...observationsPerAsset.values());
  const gates: RiskCalibrationValidationGate[] = [
    { id: "zero_asset_overlap", passed: train.every((observation) => !holdoutAssetKeys.has(observation.assetKey)), observed: train.filter((observation) => holdoutAssetKeys.has(observation.assetKey)).length, required: 0 },
    { id: "minimum_holdout_samples", passed: holdoutMetrics.sampleCount >= minimumHoldoutSamples, observed: holdoutMetrics.sampleCount, required: minimumHoldoutSamples },
    { id: "minimum_positive_samples", passed: holdoutMetrics.positiveCount >= minimumClassSamples, observed: holdoutMetrics.positiveCount, required: minimumClassSamples },
    { id: "minimum_negative_samples", passed: holdoutMetrics.negativeCount >= minimumClassSamples, observed: holdoutMetrics.negativeCount, required: minimumClassSamples },
    { id: "minimum_auroc", passed: holdoutMetrics.auroc >= minimumAuRoc, observed: holdoutMetrics.auroc, required: minimumAuRoc },
    { id: "positive_brier_skill", passed: holdoutMetrics.brierSkillScore > minimumBrierSkill, observed: holdoutMetrics.brierSkillScore, required: minimumBrierSkill },
    { id: "maximum_ece", passed: holdoutMetrics.expectedCalibrationError <= maximumEce, observed: holdoutMetrics.expectedCalibrationError, required: maximumEce },
    { id: "minimum_training_distinct_assets", passed: trainingDistinctAssetCount >= minimumTrainingDistinctAssets, observed: trainingDistinctAssetCount, required: minimumTrainingDistinctAssets },
    { id: "minimum_holdout_distinct_assets", passed: holdoutDistinctAssetCount >= minimumHoldoutDistinctAssets, observed: holdoutDistinctAssetCount, required: minimumHoldoutDistinctAssets },
    { id: "minimum_holdout_positive_distinct_assets", passed: holdoutPositiveDistinctAssetCount >= minimumHoldoutClassDistinctAssets, observed: holdoutPositiveDistinctAssetCount, required: minimumHoldoutClassDistinctAssets },
    { id: "minimum_holdout_negative_distinct_assets", passed: holdoutNegativeDistinctAssetCount >= minimumHoldoutClassDistinctAssets, observed: holdoutNegativeDistinctAssetCount, required: minimumHoldoutClassDistinctAssets },
    { id: "maximum_observations_per_asset", passed: maximumObservationsPerAssetObserved <= maximumObservationsPerAsset, observed: maximumObservationsPerAssetObserved, required: maximumObservationsPerAsset },
  ];
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const issuedMs = dateMs(issuedAt, "issued_at");
  if (observations.some((observation) => observation.observedMs > issuedMs)) {
    throw new Error("risk_calibration_observation_after_issue_detected");
  }
  if (observations.some((observation) => observation.outcomeObservedMs > issuedMs)) {
    throw new Error("risk_calibration_outcome_not_observed_at_issue");
  }
  const validityDays = input.validityDays ?? 30;
  if (!Number.isSafeInteger(validityDays) || validityDays < 1 || validityDays > 365) {
    throw new Error("risk_calibration_validity_invalid");
  }
  const expiresAt = new Date(issuedMs + validityDays * 24 * 60 * 60 * 1000).toISOString();
  const datasetDigest = sha256(canonicalJson(observations.map((observation) => ({
    observationId: observation.observationId,
    assetKey: observation.assetKey,
    riskScore: observation.riskScore,
    featureCutoffAt: observation.featureCutoffAt,
    observedAt: observation.observedAt,
    outcomeObservedAt: observation.outcomeObservedAt,
    outcomeOccurred: observation.outcomeOccurred,
    cohort: observation.cohort ?? null,
    modelBindingDigest: observation.modelBindingDigest,
  }))));
  const calibrationObservationKeyHashes = observations
    .map((observation) => calibrationObservationKeyHash(observation.assetKey, observation.observedAt))
    .sort((left, right) => left.localeCompare(right));
  const profileBase = {
    schemaVersion: "velmere.risk-empirical-calibration.v2" as const,
    profileId: "",
    status: gates.every((gate) => gate.passed) ? "holdout_validated" as const : "rejected" as const,
    interpretation: "empirical_event_probability_for_declared_outcome_only" as const,
    outcomeDefinition: input.outcomeDefinition.trim(),
    scoreFormula: input.scoreFormula.trim(),
    modelBinding,
    modelBindingDigest,
    trainWindow: {
      firstObservedAt: train[0].observedAt,
      lastObservedAt: train.at(-1)!.observedAt,
      sampleCount: train.length,
    },
    holdoutWindow: {
      firstObservedAt: holdout[0].observedAt,
      lastObservedAt: holdout.at(-1)!.observedAt,
      sampleCount: holdout.length,
    },
    purgeGapMs,
    trainingMetrics: {
      sampleCount: train.length,
      positiveCount: trainingPositiveCount,
      negativeCount: train.length - trainingPositiveCount,
      baseRate: round(trainingBaseRate),
    },
    holdoutMetrics,
    mapping,
    referenceScoreBins: fixedScoreBins(train.map((observation) => observation.riskScore)),
    datasetObservationCount: observations.length,
    calibrationObservationKeyHashes,
    datasetDiversity: {
      trainingDistinctAssetCount,
      holdoutDistinctAssetCount,
      holdoutPositiveDistinctAssetCount,
      holdoutNegativeDistinctAssetCount,
      maximumObservationsPerAssetObserved,
      maximumObservationsPerAssetAllowed: maximumObservationsPerAsset,
    },
    validationGates: gates,
    datasetDigest,
    integrityDigest: "",
    issuedAt: new Date(issuedMs).toISOString(),
    expiresAt,
    signerKeyId: input.signerKeyId.trim(),
    signature: "",
  } satisfies SignedRiskCalibrationProfile;
  if (!profileBase.outcomeDefinition || !profileBase.scoreFormula || !profileBase.signerKeyId || input.signingSecret.length < 32) {
    throw new Error("risk_calibration_signing_contract_invalid");
  }
  const identityDigest = sha256(canonicalJson({ ...profileBase, profileId: undefined, integrityDigest: undefined, signature: undefined }));
  profileBase.profileId = `risk-cal-${identityDigest.slice("sha256:".length, "sha256:".length + 24)}`;
  profileBase.integrityDigest = sha256(canonicalJson({ ...profileBase, integrityDigest: undefined, signature: undefined }));
  profileBase.signature = hmac(canonicalJson(profileUnsigned(profileBase)), input.signingSecret);
  return profileBase;
}

export function verifySignedRiskCalibrationProfile(input: {
  profile: SignedRiskCalibrationProfile;
  signingSecret: string;
  now?: string;
}) {
  const rejected = {
    ok: false,
    integrityValid: false,
    signatureValid: false,
    signingKeyValid: false,
    notIssuedInFuture: false,
    notExpired: false,
    validated: false,
    gatesComplete: false,
    gateSemanticsValid: false,
    bindingValid: false,
    mappingValid: false,
    metricsValid: false,
    windowsValid: false,
    profileIdValid: false,
    digestShapesValid: false,
    datasetBindingValid: false,
  };
  try {
    const { profile, signingSecret } = input;
    if (!profile || typeof profile !== "object") return rejected;
    const signingKeyValid = typeof signingSecret === "string" && signingSecret.length >= 32;
    if (!signingKeyValid) return { ...rejected, signingKeyValid };

    const expectedIntegrity = sha256(canonicalJson({ ...profile, integrityDigest: undefined, signature: undefined }));
    const expectedSignature = hmac(canonicalJson(profileUnsigned(profile)), signingSecret);
    const expectedIdentityDigest = sha256(canonicalJson({
      ...profile,
      profileId: undefined,
      integrityDigest: undefined,
      signature: undefined,
    }));
    const expectedProfileId = `risk-cal-${expectedIdentityDigest.slice("sha256:".length, "sha256:".length + 24)}`;
    const nowMs = dateMs(input.now ?? new Date().toISOString(), "verification_time");
    const issuedMs = dateMs(profile.issuedAt, "issued_at");
    const expiresMs = dateMs(profile.expiresAt, "expires_at");
    const integrityValid = safeEqual(profile.integrityDigest, expectedIntegrity);
    const signatureValid = safeEqual(profile.signature, expectedSignature);
    const profileIdValid = safeEqual(profile.profileId, expectedProfileId);
    const notIssuedInFuture = issuedMs <= nowMs + 5 * 60_000;
    const notExpired = expiresMs > nowMs && expiresMs > issuedMs && expiresMs - issuedMs <= 365 * 24 * 60 * 60 * 1000;

    const requiredGateIds = new Set([
      "zero_asset_overlap",
      "minimum_holdout_samples",
      "minimum_positive_samples",
      "minimum_negative_samples",
      "minimum_auroc",
      "positive_brier_skill",
      "maximum_ece",
      "minimum_training_distinct_assets",
      "minimum_holdout_distinct_assets",
      "minimum_holdout_positive_distinct_assets",
      "minimum_holdout_negative_distinct_assets",
      "maximum_observations_per_asset",
    ]);
    const gateRows = Array.isArray(profile.validationGates) ? profile.validationGates : [];
    const actualGateIds = new Set(gateRows.map((gate) => gate?.id));
    const gatesComplete =
      gateRows.length === requiredGateIds.size &&
      actualGateIds.size === requiredGateIds.size &&
      [...requiredGateIds].every((id) => actualGateIds.has(id));
    const gateById = new Map(gateRows.map((gate) => [gate.id, gate]));
    const gate = (id: string) => gateById.get(id);
    const zeroOverlap = gate("zero_asset_overlap");
    const holdoutGate = gate("minimum_holdout_samples");
    const positiveGate = gate("minimum_positive_samples");
    const negativeGate = gate("minimum_negative_samples");
    const aurocGate = gate("minimum_auroc");
    const brierGate = gate("positive_brier_skill");
    const eceGate = gate("maximum_ece");
    const trainingAssetsGate = gate("minimum_training_distinct_assets");
    const holdoutAssetsGate = gate("minimum_holdout_distinct_assets");
    const holdoutPositiveAssetsGate = gate("minimum_holdout_positive_distinct_assets");
    const holdoutNegativeAssetsGate = gate("minimum_holdout_negative_distinct_assets");
    const replicationGate = gate("maximum_observations_per_asset");
    const diversity = profile.datasetDiversity;
    const gateSemanticsValid = gatesComplete && Boolean(
      zeroOverlap?.passed === true && zeroOverlap.observed === 0 && zeroOverlap.required === 0 &&
      holdoutGate?.passed === true && Number.isSafeInteger(holdoutGate.required) && Number(holdoutGate.required) >= 200 && holdoutGate.observed === profile.holdoutMetrics?.sampleCount && Number(holdoutGate.observed) >= Number(holdoutGate.required) &&
      positiveGate?.passed === true && Number.isSafeInteger(positiveGate.required) && Number(positiveGate.required) >= 30 && positiveGate.observed === profile.holdoutMetrics?.positiveCount && Number(positiveGate.observed) >= Number(positiveGate.required) &&
      negativeGate?.passed === true && Number.isSafeInteger(negativeGate.required) && Number(negativeGate.required) >= 30 && negativeGate.observed === profile.holdoutMetrics?.negativeCount && Number(negativeGate.observed) >= Number(negativeGate.required) &&
      aurocGate?.passed === true && typeof aurocGate.required === "number" && aurocGate.required >= 0.65 && aurocGate.required <= 1 && aurocGate.observed === profile.holdoutMetrics?.auroc && Number(aurocGate.observed) >= aurocGate.required &&
      brierGate?.passed === true && typeof brierGate.required === "number" && brierGate.required >= 0 && brierGate.required < 1 && brierGate.observed === profile.holdoutMetrics?.brierSkillScore && Number(brierGate.observed) > brierGate.required &&
      eceGate?.passed === true && typeof eceGate.required === "number" && eceGate.required > 0 && eceGate.required <= 0.12 && eceGate.observed === profile.holdoutMetrics?.expectedCalibrationError && Number(eceGate.observed) <= eceGate.required &&
      trainingAssetsGate?.passed === true && Number.isSafeInteger(trainingAssetsGate.required) && Number(trainingAssetsGate.required) >= 100 && trainingAssetsGate.observed === diversity?.trainingDistinctAssetCount && Number(trainingAssetsGate.observed) >= Number(trainingAssetsGate.required) &&
      holdoutAssetsGate?.passed === true && Number.isSafeInteger(holdoutAssetsGate.required) && Number(holdoutAssetsGate.required) >= 100 && holdoutAssetsGate.observed === diversity?.holdoutDistinctAssetCount && Number(holdoutAssetsGate.observed) >= Number(holdoutAssetsGate.required) &&
      holdoutPositiveAssetsGate?.passed === true && Number.isSafeInteger(holdoutPositiveAssetsGate.required) && Number(holdoutPositiveAssetsGate.required) >= 30 && holdoutPositiveAssetsGate.observed === diversity?.holdoutPositiveDistinctAssetCount && Number(holdoutPositiveAssetsGate.observed) >= Number(holdoutPositiveAssetsGate.required) &&
      holdoutNegativeAssetsGate?.passed === true && Number.isSafeInteger(holdoutNegativeAssetsGate.required) && Number(holdoutNegativeAssetsGate.required) >= 30 && holdoutNegativeAssetsGate.observed === diversity?.holdoutNegativeDistinctAssetCount && Number(holdoutNegativeAssetsGate.observed) >= Number(holdoutNegativeAssetsGate.required) &&
      replicationGate?.passed === true && Number.isSafeInteger(replicationGate.required) && Number(replicationGate.required) >= 1 && Number(replicationGate.required) <= 20 && replicationGate.observed === diversity?.maximumObservationsPerAssetObserved && Number(replicationGate.observed) <= Number(replicationGate.required)
    );

    const modelBinding = profile.modelBinding;
    const bindingValid = Boolean(
      profile.schemaVersion === "velmere.risk-empirical-calibration.v2" &&
      profile.interpretation === "empirical_event_probability_for_declared_outcome_only" &&
      modelBinding && typeof modelBinding === "object" &&
      modelBinding.schemaVersion === "velmere.risk-model-binding.v1" &&
      profile.scoreFormula === modelBinding.scoreFormula &&
      profile.modelBindingDigest === riskModelBindingDigest(modelBinding) &&
      /^sha256:[a-f0-9]{64}$/u.test(modelBinding.featureSchemaDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(modelBinding.providerConfigurationDigest) &&
      Number.isSafeInteger(modelBinding.outcomeHorizonMs) &&
      modelBinding.outcomeHorizonMs >= 60 * 60_000 &&
      modelBinding.outcomeHorizonMs <= 365 * 24 * 60 * 60_000
    );

    const mapping = Array.isArray(profile.mapping) ? profile.mapping : [];
    const mappingRowsValid = mapping.length > 0 && mapping.every((block, index, blocks) =>
      Number.isFinite(block?.minScore) && Number.isFinite(block?.maxScore) &&
      block.minScore >= 0 && block.maxScore <= 100 && block.minScore <= block.maxScore &&
      Number.isFinite(block.calibratedProbability) && block.calibratedProbability >= 0 && block.calibratedProbability <= 1 &&
      Number.isSafeInteger(block.sampleCount) && block.sampleCount > 0 &&
      Number.isSafeInteger(block.positiveCount) && block.positiveCount >= 0 && block.positiveCount <= block.sampleCount &&
      (index === 0 || (blocks[index - 1].maxScore < block.minScore && blocks[index - 1].calibratedProbability <= block.calibratedProbability))
    );
    const mappingSampleCount = mapping.reduce((sum, block) => sum + Number(block?.sampleCount ?? 0), 0);
    const mappingPositiveCount = mapping.reduce((sum, block) => sum + Number(block?.positiveCount ?? 0), 0);
    const mappingValid = mappingRowsValid &&
      mappingSampleCount === profile.trainingMetrics?.sampleCount &&
      mappingPositiveCount === profile.trainingMetrics?.positiveCount;

    const metricValues = profile.holdoutMetrics ? Object.values(profile.holdoutMetrics) : [];
    const metricsValid = Boolean(
      profile.trainingMetrics && profile.holdoutMetrics &&
      Number.isSafeInteger(profile.trainingMetrics.sampleCount) && profile.trainingMetrics.sampleCount >= 100 &&
      Number.isSafeInteger(profile.trainingMetrics.positiveCount) &&
      Number.isSafeInteger(profile.trainingMetrics.negativeCount) &&
      profile.trainingMetrics.positiveCount + profile.trainingMetrics.negativeCount === profile.trainingMetrics.sampleCount &&
      Number.isFinite(profile.trainingMetrics.baseRate) && profile.trainingMetrics.baseRate >= 0 && profile.trainingMetrics.baseRate <= 1 &&
      Number.isSafeInteger(profile.holdoutMetrics.sampleCount) &&
      Number.isSafeInteger(profile.holdoutMetrics.positiveCount) &&
      Number.isSafeInteger(profile.holdoutMetrics.negativeCount) &&
      profile.holdoutMetrics.positiveCount + profile.holdoutMetrics.negativeCount === profile.holdoutMetrics.sampleCount &&
      metricValues.every((value) => typeof value === "number" && Number.isFinite(value)) &&
      profile.holdoutMetrics.baseRate >= 0 && profile.holdoutMetrics.baseRate <= 1 &&
      profile.holdoutMetrics.auroc >= 0 && profile.holdoutMetrics.auroc <= 1 &&
      profile.holdoutMetrics.expectedCalibrationError >= 0 && profile.holdoutMetrics.expectedCalibrationError <= 1 &&
      profile.holdoutMetrics.maximumCalibrationError >= 0 && profile.holdoutMetrics.maximumCalibrationError <= 1
    );

    const trainFirst = dateMs(profile.trainWindow?.firstObservedAt, "train_first_observed_at");
    const trainLast = dateMs(profile.trainWindow?.lastObservedAt, "train_last_observed_at");
    const holdoutFirst = dateMs(profile.holdoutWindow?.firstObservedAt, "holdout_first_observed_at");
    const holdoutLast = dateMs(profile.holdoutWindow?.lastObservedAt, "holdout_last_observed_at");
    const windowsValid = Boolean(
      profile.trainWindow?.sampleCount === profile.trainingMetrics?.sampleCount &&
      profile.holdoutWindow?.sampleCount === profile.holdoutMetrics?.sampleCount &&
      trainFirst <= trainLast && trainLast < holdoutFirst && holdoutFirst <= holdoutLast &&
      Number.isSafeInteger(profile.purgeGapMs) && profile.purgeGapMs >= 0 &&
      profile.purgeGapMs <= 365 * 24 * 60 * 60 * 1000
    );
    const bins = Array.isArray(profile.referenceScoreBins) ? profile.referenceScoreBins : [];
    const referenceBinsValid = bins.length === 10 && bins.every((bin, index) =>
      bin?.lowerInclusive === index * 10 &&
      bin.upperInclusive === (index === 9 ? 100 : (index + 1) * 10) &&
      Number.isSafeInteger(bin.sampleCount) && bin.sampleCount >= 0 &&
      Number.isFinite(bin.fraction) && bin.fraction >= 0 && bin.fraction <= 1
    ) && bins.reduce((sum, bin) => sum + bin.sampleCount, 0) === profile.trainingMetrics?.sampleCount &&
      Math.abs(bins.reduce((sum, bin) => sum + bin.fraction, 0) - 1) <= 1e-6;
    const calibrationObservationKeyHashes = Array.isArray(profile.calibrationObservationKeyHashes)
      ? profile.calibrationObservationKeyHashes
      : [];
    const sortedCalibrationObservationKeyHashes = [...calibrationObservationKeyHashes]
      .sort((left, right) => String(left).localeCompare(String(right)));
    const datasetBindingValid = Boolean(
      Number.isSafeInteger(profile.datasetObservationCount) &&
      profile.datasetObservationCount >= 300 &&
      profile.datasetObservationCount >= Number(profile.trainingMetrics?.sampleCount ?? 0) + Number(profile.holdoutMetrics?.sampleCount ?? 0) &&
      calibrationObservationKeyHashes.length === profile.datasetObservationCount &&
      new Set(calibrationObservationKeyHashes).size === calibrationObservationKeyHashes.length &&
      calibrationObservationKeyHashes.every((hash, index) =>
        typeof hash === "string" &&
        /^sha256:[a-f0-9]{64}$/u.test(hash) &&
        hash === sortedCalibrationObservationKeyHashes[index]
      ) &&
      diversity && typeof diversity === "object" &&
      Number.isSafeInteger(diversity.trainingDistinctAssetCount) &&
      diversity.trainingDistinctAssetCount >= 100 &&
      diversity.trainingDistinctAssetCount <= Number(profile.trainingMetrics?.sampleCount ?? 0) &&
      Number.isSafeInteger(diversity.holdoutDistinctAssetCount) &&
      diversity.holdoutDistinctAssetCount >= 100 &&
      diversity.holdoutDistinctAssetCount <= Number(profile.holdoutMetrics?.sampleCount ?? 0) &&
      Number.isSafeInteger(diversity.holdoutPositiveDistinctAssetCount) &&
      diversity.holdoutPositiveDistinctAssetCount >= 30 &&
      diversity.holdoutPositiveDistinctAssetCount <= Number(profile.holdoutMetrics?.positiveCount ?? 0) &&
      Number.isSafeInteger(diversity.holdoutNegativeDistinctAssetCount) &&
      diversity.holdoutNegativeDistinctAssetCount >= 30 &&
      diversity.holdoutNegativeDistinctAssetCount <= Number(profile.holdoutMetrics?.negativeCount ?? 0) &&
      Number.isSafeInteger(diversity.maximumObservationsPerAssetObserved) &&
      diversity.maximumObservationsPerAssetObserved >= 1 &&
      diversity.maximumObservationsPerAssetObserved <= diversity.maximumObservationsPerAssetAllowed &&
      Number.isSafeInteger(diversity.maximumObservationsPerAssetAllowed) &&
      diversity.maximumObservationsPerAssetAllowed >= 1 &&
      diversity.maximumObservationsPerAssetAllowed <= 20
    );
    const digestShapesValid =
      /^sha256:[a-f0-9]{64}$/u.test(profile.datasetDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(profile.integrityDigest) &&
      /^hmac-sha256:[a-f0-9]{64}$/u.test(profile.signature) &&
      /^risk-cal-[a-f0-9]{24}$/u.test(profile.profileId);
    const validated = Boolean(
      profile.status === "holdout_validated" &&
      typeof profile.outcomeDefinition === "string" && profile.outcomeDefinition.trim() &&
      typeof profile.scoreFormula === "string" && profile.scoreFormula.trim() &&
      typeof profile.signerKeyId === "string" && profile.signerKeyId.trim() &&
      gateSemanticsValid && bindingValid && mappingValid && metricsValid && windowsValid && referenceBinsValid &&
      datasetBindingValid && profileIdValid && digestShapesValid
    );
    return {
      ok: integrityValid && signatureValid && signingKeyValid && notIssuedInFuture && notExpired && validated,
      integrityValid,
      signatureValid,
      signingKeyValid,
      notIssuedInFuture,
      notExpired,
      validated,
      gatesComplete,
      gateSemanticsValid,
      bindingValid,
      mappingValid,
      metricsValid,
      windowsValid,
      profileIdValid,
      digestShapesValid,
      datasetBindingValid,
    };
  } catch {
    return rejected;
  }
}

export function applySignedRiskCalibrationProfile(input: {
  score: number;
  profile: SignedRiskCalibrationProfile;
  signingSecret: string;
  modelBindingDigest: string;
  now?: string;
}) {
  const verification = verifySignedRiskCalibrationProfile(input);
  if (!verification.ok) throw new Error("risk_calibration_profile_not_eligible");
  if (!safeEqual(input.modelBindingDigest, input.profile.modelBindingDigest)) throw new Error("risk_calibration_model_binding_mismatch");
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) throw new Error("risk_calibration_score_out_of_range");
  return {
    probability: round(calibratedProbability(input.score, input.profile.mapping), 6),
    outcomeDefinition: input.profile.outcomeDefinition,
    profileId: input.profile.profileId,
    calibrationStatus: "holdout_validated" as const,
  };
}

export function attachSignedRiskCalibrationToResult(input: {
  result: TokenRiskResult;
  profile: SignedRiskCalibrationProfile;
  signingSecret: string;
  driftReceipt: SignedRiskCalibrationDriftReceipt;
  monitoringSecret: string;
  now?: string;
}): TokenRiskResult {
  const resultBinding = input.result.modelBinding;
  if (
    !resultBinding ||
    input.result.scoreFormula !== input.profile.scoreFormula ||
    resultBinding.scoreFormula !== input.profile.modelBinding.scoreFormula ||
    resultBinding.featureSchemaVersion !== input.profile.modelBinding.featureSchemaVersion ||
    resultBinding.featureSchemaDigest !== input.profile.modelBinding.featureSchemaDigest ||
    resultBinding.assetClassCohort !== input.profile.modelBinding.assetClassCohort ||
    resultBinding.providerConfigurationDigest !== input.profile.modelBinding.providerConfigurationDigest
  ) throw new Error("risk_calibration_result_model_binding_mismatch");
  const calibrated = applySignedRiskCalibrationProfile({
    score: input.result.score,
    profile: input.profile,
    signingSecret: input.signingSecret,
    modelBindingDigest: riskModelBindingDigest({ ...resultBinding, outcomeHorizonMs: input.profile.modelBinding.outcomeHorizonMs }),
    now: input.now,
  });
  const driftVerification = verifySignedRiskCalibrationDriftReceipt({
    receipt: input.driftReceipt,
    monitoringSecret: input.monitoringSecret,
    now: input.now,
  });
  if (
    !driftVerification.ok ||
    input.driftReceipt.profileId !== input.profile.profileId ||
    input.driftReceipt.profileDatasetDigest !== input.profile.datasetDigest ||
    input.driftReceipt.profileModelBindingDigest !== input.profile.modelBindingDigest ||
    input.driftReceipt.cohort !== input.profile.modelBinding.assetClassCohort ||
    input.driftReceipt.outcomeHorizonMs !== input.profile.modelBinding.outcomeHorizonMs ||
    input.driftReceipt.status !== "ready"
  ) {
    throw new Error("risk_calibration_current_drift_not_eligible");
  }
  return {
    ...input.result,
    uncertainty: input.result.uncertainty
      ? {
          ...input.result.uncertainty,
          empiricalCalibrationStatus: "holdout_validated",
          probabilityClaimAllowed: true,
          calibrationProfileId: input.profile.profileId,
        }
      : input.result.uncertainty,
    empiricalCalibration: {
      schemaVersion: "velmere.risk-result-calibration.v1",
      status: "holdout_validated",
      profileId: input.profile.profileId,
      outcomeDefinition: calibrated.outcomeDefinition,
      probability: calibrated.probability,
      issuedAt: input.profile.issuedAt,
      expiresAt: input.profile.expiresAt,
      integrityDigest: input.profile.integrityDigest,
      modelBindingDigest: input.profile.modelBindingDigest,
    },
  };
}


export type RiskCalibrationDriftObservation = {
  observationId: string;
  assetKey: string;
  riskScore: number;
  observedAt: string;
  outcomeObservedAt?: string;
  outcomeOccurred?: boolean;
  cohort: string;
  modelBindingDigest: string;
  profileId: string;
};

export type SignedRiskCalibrationDriftReceipt = {
  schemaVersion: "velmere.risk-calibration-drift.v2";
  receiptId: string;
  profileId: string;
  profileDatasetDigest: string;
  profileModelBindingDigest: string;
  cohort: string;
  outcomeHorizonMs: number;
  status: "ready" | "watch" | "blocked";
  policy: {
    watchPsi: number;
    blockedPsi: number;
    maximumCurrentEce: number;
    minimumLabeledSamples: number;
    maximumObservationAgeMs: number;
    minimumDistinctAssets: number;
  };
  observationSetDigest: string;
  observationCount: number;
  distinctAssetCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  calibrationOverlapCount: 0;
  scorePopulationStabilityIndex: number;
  currentScoreBins: SignedRiskCalibrationProfile["referenceScoreBins"];
  labeledSampleCount: number;
  currentBrierScore: number | null;
  currentExpectedCalibrationError: number | null;
  reasons: string[];
  monitoredAt: string;
  signerKeyId: string;
  integrityDigest: string;
  signature: string;
};

function driftUnsigned(receipt: SignedRiskCalibrationDriftReceipt) {
  const { signature: _signature, ...unsigned } = receipt;
  return unsigned;
}

export function buildSignedRiskCalibrationDriftReceipt(input: {
  profile: SignedRiskCalibrationProfile;
  profileSigningSecret: string;
  observations: RiskCalibrationDriftObservation[];
  monitoredAt?: string;
  signerKeyId: string;
  monitoringSecret: string;
  watchPsi?: number;
  blockedPsi?: number;
  maximumCurrentEce?: number;
  minimumLabeledSamples?: number;
  maximumObservationAgeMs?: number;
  minimumDistinctAssets?: number;
}): SignedRiskCalibrationDriftReceipt {
  const monitoredAt = input.monitoredAt ?? new Date().toISOString();
  const monitoredMs = dateMs(monitoredAt, "drift_monitored_at");
  const profileVerification = verifySignedRiskCalibrationProfile({
    profile: input.profile,
    signingSecret: input.profileSigningSecret,
    now: monitoredAt,
  });
  if (!profileVerification.ok) throw new Error("risk_calibration_drift_profile_not_eligible");
  if (input.monitoringSecret.length < 32 || !input.signerKeyId.trim()) throw new Error("risk_calibration_monitor_signing_contract_invalid");

  const minimumLabeledSamples = input.minimumLabeledSamples ?? 100;
  const watchPsi = input.watchPsi ?? 0.1;
  const blockedPsi = input.blockedPsi ?? 0.25;
  const maximumCurrentEce = input.maximumCurrentEce ?? 0.15;
  const maximumObservationAgeMs = input.maximumObservationAgeMs ?? 36 * 60 * 60_000;
  const minimumDistinctAssets = input.minimumDistinctAssets ?? 30;
  if (!Number.isFinite(watchPsi) || watchPsi <= 0 || watchPsi > 0.1) throw new Error("risk_calibration_drift_watch_policy_invalid");
  if (!Number.isFinite(blockedPsi) || blockedPsi <= watchPsi || blockedPsi > 0.25) throw new Error("risk_calibration_drift_block_policy_invalid");
  if (!Number.isFinite(maximumCurrentEce) || maximumCurrentEce <= 0 || maximumCurrentEce > 0.15) throw new Error("risk_calibration_drift_ece_policy_invalid");
  if (!Number.isSafeInteger(minimumLabeledSamples) || minimumLabeledSamples < 100) throw new Error("risk_calibration_drift_label_policy_invalid");
  if (
    !Number.isSafeInteger(maximumObservationAgeMs) ||
    maximumObservationAgeMs < 60 * 60_000 ||
    maximumObservationAgeMs > 7 * 24 * 60 * 60_000
  ) throw new Error("risk_calibration_drift_freshness_policy_invalid");
  if (!Number.isSafeInteger(minimumDistinctAssets) || minimumDistinctAssets < 30) {
    throw new Error("risk_calibration_drift_asset_policy_invalid");
  }

  const ids = new Set<string>();
  const observationKeys = new Set<string>();
  const calibrationKeys = new Set(input.profile.calibrationObservationKeyHashes);
  if (!Array.isArray(input.observations)) throw new Error("risk_calibration_drift_observations_required");
  const observations = input.observations.map((observation) => {
    if (
      !observation ||
      typeof observation.observationId !== "string" ||
      typeof observation.assetKey !== "string" ||
      typeof observation.observedAt !== "string" ||
      typeof observation.cohort !== "string" ||
      typeof observation.modelBindingDigest !== "string" ||
      typeof observation.profileId !== "string" ||
      (observation.outcomeOccurred !== undefined && typeof observation.outcomeOccurred !== "boolean") ||
      (observation.outcomeObservedAt !== undefined && typeof observation.outcomeObservedAt !== "string")
    ) throw new Error("risk_calibration_drift_observation_shape_invalid");
    const observationId = observation.observationId.trim();
    const assetKey = observation.assetKey.trim().toLowerCase();
    const cohort = observation.cohort.trim().toLowerCase();
    if (!observationId || ids.has(observationId)) throw new Error("risk_calibration_drift_duplicate_observation");
    if (!assetKey) throw new Error("risk_calibration_drift_asset_identity_required");
    ids.add(observationId);
    if (!Number.isFinite(observation.riskScore) || observation.riskScore < 0 || observation.riskScore > 100) {
      throw new Error("risk_calibration_drift_score_out_of_range");
    }
    if (cohort !== input.profile.modelBinding.assetClassCohort) {
      throw new Error("risk_calibration_drift_cohort_mismatch");
    }
    if (observation.modelBindingDigest !== input.profile.modelBindingDigest) {
      throw new Error("risk_calibration_drift_model_binding_mismatch");
    }
    if (observation.profileId !== input.profile.profileId) {
      throw new Error("risk_calibration_drift_profile_binding_mismatch");
    }
    const observedMs = dateMs(observation.observedAt, "drift_observed_at");
    const observedAt = new Date(observedMs).toISOString();
    if (observedMs > monitoredMs) throw new Error("risk_calibration_drift_future_observation");
    if (observedMs < monitoredMs - maximumObservationAgeMs) {
      throw new Error("risk_calibration_drift_stale_observation");
    }
    const hasOutcome = typeof observation.outcomeOccurred === "boolean";
    const hasOutcomeTimestamp = typeof observation.outcomeObservedAt === "string";
    if (hasOutcome !== hasOutcomeTimestamp) throw new Error("risk_calibration_drift_outcome_timestamp_required");
    let outcomeObservedAt: string | undefined;
    if (hasOutcomeTimestamp) {
      const outcomeObservedMs = dateMs(observation.outcomeObservedAt!, "drift_outcome_observed_at");
      if (outcomeObservedMs <= observedMs || outcomeObservedMs > monitoredMs) {
        throw new Error("risk_calibration_drift_outcome_window_invalid");
      }
      if (Math.abs(outcomeObservedMs - observedMs - input.profile.modelBinding.outcomeHorizonMs) > 60_000) {
        throw new Error("risk_calibration_drift_outcome_horizon_mismatch");
      }
      outcomeObservedAt = new Date(outcomeObservedMs).toISOString();
    }
    const observationKey = calibrationObservationKeyHash(assetKey, observedAt);
    if (observationKeys.has(observationKey)) throw new Error("risk_calibration_drift_duplicate_asset_time_observation");
    if (calibrationKeys.has(observationKey)) throw new Error("risk_calibration_drift_calibration_dataset_overlap");
    observationKeys.add(observationKey);
    return {
      observationId,
      assetKey,
      riskScore: round(observation.riskScore, 8),
      observedAt,
      outcomeObservedAt,
      outcomeOccurred: observation.outcomeOccurred,
      cohort,
      modelBindingDigest: observation.modelBindingDigest,
      profileId: observation.profileId,
      observedMs,
    };
  });
  if (observations.length < 100) throw new Error("risk_calibration_drift_sample_too_small");
  observations.sort((left, right) => left.observedMs - right.observedMs || left.observationId.localeCompare(right.observationId));
  const distinctAssetCount = new Set(observations.map((observation) => observation.assetKey)).size;
  if (distinctAssetCount < minimumDistinctAssets) throw new Error("risk_calibration_drift_distinct_assets_too_small");
  const currentBins = fixedScoreBins(observations.map((observation) => observation.riskScore));
  const epsilon = 1e-6;
  const psi = currentBins.reduce((sum, current, index) => {
    const referenceFraction = Math.max(epsilon, input.profile.referenceScoreBins[index]?.fraction ?? 0);
    const currentFraction = Math.max(epsilon, current.fraction);
    return sum + (currentFraction - referenceFraction) * Math.log(currentFraction / referenceFraction);
  }, 0);
  const labeled = observations.filter((observation) => typeof observation.outcomeOccurred === "boolean");
  let currentBrierScore: number | null = null;
  let currentExpectedCalibrationError: number | null = null;
  if (labeled.length >= minimumLabeledSamples) {
    const rows = labeled.map((observation) => ({
      probability: clamp(calibratedProbability(observation.riskScore, input.profile.mapping), 1e-6, 1 - 1e-6),
      outcome: observation.outcomeOccurred,
    }));
    currentBrierScore = round(rows.reduce((sum, row) => sum + (row.probability - Number(row.outcome)) ** 2, 0) / rows.length);
    let ece = 0;
    for (let bin = 0; bin < 10; bin += 1) {
      const lower = bin / 10;
      const upper = (bin + 1) / 10;
      const members = rows.filter((row) => row.probability >= lower && (bin === 9 ? row.probability <= upper : row.probability < upper));
      if (!members.length) continue;
      const predicted = members.reduce((sum, row) => sum + row.probability, 0) / members.length;
      const observed = members.filter((row) => row.outcome).length / members.length;
      ece += (members.length / rows.length) * Math.abs(predicted - observed);
    }
    currentExpectedCalibrationError = round(ece);
  }
  const reasons: string[] = [];
  let status: SignedRiskCalibrationDriftReceipt["status"] = "ready";
  if (psi >= blockedPsi) {
    status = "blocked";
    reasons.push("score_population_drift_blocked");
  } else if (psi >= watchPsi) {
    status = "watch";
    reasons.push("score_population_drift_watch");
  }
  if (currentExpectedCalibrationError !== null && currentExpectedCalibrationError > maximumCurrentEce) {
    status = "blocked";
    reasons.push("current_calibration_error_exceeded");
  }
  if (labeled.length < minimumLabeledSamples && status === "ready") {
    status = "watch";
    reasons.push("insufficient_recent_outcome_labels");
  }
  if (!reasons.length) reasons.push("profile_and_recent_distribution_within_declared_gates");
  const observationSetDigest = sha256(canonicalJson(observations.map((observation) => ({
    observationId: observation.observationId,
    assetKey: observation.assetKey,
    riskScore: observation.riskScore,
    observedAt: observation.observedAt,
    outcomeObservedAt: observation.outcomeObservedAt ?? null,
    outcomeOccurred: observation.outcomeOccurred ?? null,
    cohort: observation.cohort,
    modelBindingDigest: observation.modelBindingDigest,
    profileId: observation.profileId,
  }))));
  const base = {
    schemaVersion: "velmere.risk-calibration-drift.v2" as const,
    receiptId: "",
    profileId: input.profile.profileId,
    profileDatasetDigest: input.profile.datasetDigest,
    profileModelBindingDigest: input.profile.modelBindingDigest,
    cohort: input.profile.modelBinding.assetClassCohort,
    outcomeHorizonMs: input.profile.modelBinding.outcomeHorizonMs,
    status,
    policy: {
      watchPsi,
      blockedPsi,
      maximumCurrentEce,
      minimumLabeledSamples,
      maximumObservationAgeMs,
      minimumDistinctAssets,
    },
    observationSetDigest,
    observationCount: observations.length,
    distinctAssetCount,
    firstObservedAt: observations[0].observedAt,
    lastObservedAt: observations.at(-1)!.observedAt,
    calibrationOverlapCount: 0 as const,
    scorePopulationStabilityIndex: round(psi),
    currentScoreBins: currentBins,
    labeledSampleCount: labeled.length,
    currentBrierScore,
    currentExpectedCalibrationError,
    reasons,
    monitoredAt: new Date(monitoredMs).toISOString(),
    signerKeyId: input.signerKeyId.trim(),
    integrityDigest: "",
    signature: "",
  } satisfies SignedRiskCalibrationDriftReceipt;
  const identityDigest = sha256(canonicalJson({ ...base, receiptId: undefined, integrityDigest: undefined, signature: undefined }));
  base.receiptId = `risk-drift-${identityDigest.slice("sha256:".length, "sha256:".length + 24)}`;
  base.integrityDigest = sha256(canonicalJson({ ...base, integrityDigest: undefined, signature: undefined }));
  base.signature = hmac(canonicalJson(driftUnsigned(base)), input.monitoringSecret);
  return base;
}

export function verifySignedRiskCalibrationDriftReceipt(input: {
  receipt: SignedRiskCalibrationDriftReceipt;
  monitoringSecret: string;
  now?: string;
  maximumAgeMs?: number;
}) {
  const rejected = {
    ok: false,
    integrityValid: false,
    signatureValid: false,
    signingKeyValid: false,
    receiptIdValid: false,
    shapeValid: false,
    policyValid: false,
    profileBindingValid: false,
    observationWindowValid: false,
    statusSemanticsValid: false,
    notFromFuture: false,
    fresh: false,
    maximumAgeMs: 0,
  };
  try {
    const { receipt, monitoringSecret } = input;
    if (!receipt || typeof receipt !== "object") return rejected;
    const signingKeyValid = typeof monitoringSecret === "string" && monitoringSecret.length >= 32;
    if (!signingKeyValid) return { ...rejected, signingKeyValid };
    const maximumAgeMs = input.maximumAgeMs ?? 36 * 60 * 60_000;
    if (!Number.isSafeInteger(maximumAgeMs) || maximumAgeMs < 60 * 60_000 || maximumAgeMs > 7 * 24 * 60 * 60_000) {
      return { ...rejected, signingKeyValid, maximumAgeMs: 0 };
    }
    const expectedIntegrity = sha256(canonicalJson({ ...receipt, integrityDigest: undefined, signature: undefined }));
    const expectedSignature = hmac(canonicalJson(driftUnsigned(receipt)), monitoringSecret);
    const expectedIdentityDigest = sha256(canonicalJson({
      ...receipt,
      receiptId: undefined,
      integrityDigest: undefined,
      signature: undefined,
    }));
    const expectedReceiptId = `risk-drift-${expectedIdentityDigest.slice("sha256:".length, "sha256:".length + 24)}`;
    const integrityValid = safeEqual(receipt.integrityDigest, expectedIntegrity);
    const signatureValid = safeEqual(receipt.signature, expectedSignature);
    const receiptIdValid = safeEqual(receipt.receiptId, expectedReceiptId);
    const nowMs = dateMs(input.now ?? new Date().toISOString(), "drift_verification_time");
    const monitoredMs = dateMs(receipt.monitoredAt, "drift_monitored_at");
    const notFromFuture = monitoredMs <= nowMs + 5 * 60_000;
    const fresh = monitoredMs >= nowMs - maximumAgeMs;
    const policy = receipt.policy;
    const policyValid = Boolean(
      policy && typeof policy === "object" &&
      Number.isFinite(policy.watchPsi) && policy.watchPsi > 0 && policy.watchPsi <= 0.1 &&
      Number.isFinite(policy.blockedPsi) && policy.blockedPsi > policy.watchPsi && policy.blockedPsi <= 0.25 &&
      Number.isFinite(policy.maximumCurrentEce) && policy.maximumCurrentEce > 0 && policy.maximumCurrentEce <= 0.15 &&
      Number.isSafeInteger(policy.minimumLabeledSamples) && policy.minimumLabeledSamples >= 100 &&
      Number.isSafeInteger(policy.maximumObservationAgeMs) &&
      policy.maximumObservationAgeMs >= 60 * 60_000 &&
      policy.maximumObservationAgeMs <= 7 * 24 * 60 * 60_000 &&
      Number.isSafeInteger(policy.minimumDistinctAssets) && policy.minimumDistinctAssets >= 30
    );
    const bins = Array.isArray(receipt.currentScoreBins) ? receipt.currentScoreBins : [];
    const binsValid = bins.length === 10 && bins.every((bin, index) =>
      bin?.lowerInclusive === index * 10 &&
      bin.upperInclusive === (index === 9 ? 100 : (index + 1) * 10) &&
      Number.isSafeInteger(bin.sampleCount) && bin.sampleCount >= 0 &&
      Number.isFinite(bin.fraction) && bin.fraction >= 0 && bin.fraction <= 1
    );
    const observationCount = bins.reduce((sum, bin) => sum + Number(bin?.sampleCount ?? 0), 0);
    const fractionTotal = bins.reduce((sum, bin) => sum + Number(bin?.fraction ?? 0), 0);
    const firstObservedMs = dateMs(receipt.firstObservedAt, "drift_first_observed_at");
    const lastObservedMs = dateMs(receipt.lastObservedAt, "drift_last_observed_at");
    const observationWindowValid = Boolean(
      policyValid &&
      firstObservedMs <= lastObservedMs &&
      lastObservedMs <= monitoredMs &&
      firstObservedMs >= monitoredMs - policy.maximumObservationAgeMs
    );
    const profileBindingValid = Boolean(
      /^risk-cal-[a-f0-9]{24}$/u.test(receipt.profileId) &&
      /^sha256:[a-f0-9]{64}$/u.test(receipt.profileDatasetDigest) &&
      /^sha256:[a-f0-9]{64}$/u.test(receipt.profileModelBindingDigest) &&
      typeof receipt.cohort === "string" &&
      Boolean(receipt.cohort.trim()) &&
      receipt.cohort === receipt.cohort.trim().toLowerCase() &&
      Number.isSafeInteger(receipt.outcomeHorizonMs) &&
      receipt.outcomeHorizonMs >= 60 * 60_000 &&
      receipt.outcomeHorizonMs <= 365 * 24 * 60 * 60_000
    );
    const observationMetadataValid = Boolean(
      /^sha256:[a-f0-9]{64}$/u.test(receipt.observationSetDigest) &&
      Number.isSafeInteger(receipt.observationCount) &&
      receipt.observationCount === observationCount &&
      Number.isSafeInteger(receipt.distinctAssetCount) &&
      receipt.distinctAssetCount >= policy.minimumDistinctAssets &&
      receipt.distinctAssetCount <= receipt.observationCount &&
      receipt.calibrationOverlapCount === 0
    );
    const labeledMetricsSemanticsValid = policyValid && (
      receipt.labeledSampleCount >= policy.minimumLabeledSamples
        ? receipt.currentBrierScore !== null && receipt.currentExpectedCalibrationError !== null
        : receipt.currentBrierScore === null && receipt.currentExpectedCalibrationError === null
    );
    const metricsValid =
      Number.isFinite(receipt.scorePopulationStabilityIndex) && receipt.scorePopulationStabilityIndex >= 0 &&
      Number.isSafeInteger(receipt.labeledSampleCount) && receipt.labeledSampleCount >= 0 && receipt.labeledSampleCount <= observationCount &&
      (receipt.currentBrierScore === null || (Number.isFinite(receipt.currentBrierScore) && receipt.currentBrierScore >= 0 && receipt.currentBrierScore <= 1)) &&
      (receipt.currentExpectedCalibrationError === null || (Number.isFinite(receipt.currentExpectedCalibrationError) && receipt.currentExpectedCalibrationError >= 0 && receipt.currentExpectedCalibrationError <= 1)) &&
      labeledMetricsSemanticsValid;
    const shapeValid = Boolean(
      receipt.schemaVersion === "velmere.risk-calibration-drift.v2" &&
      /^risk-drift-[a-f0-9]{24}$/u.test(receipt.receiptId) &&
      ["ready", "watch", "blocked"].includes(receipt.status) &&
      binsValid && observationCount >= 100 && Math.abs(fractionTotal - 1) <= 1e-6 && metricsValid &&
      profileBindingValid && observationMetadataValid && observationWindowValid &&
      Array.isArray(receipt.reasons) && receipt.reasons.length > 0 && receipt.reasons.every((reason) => typeof reason === "string" && Boolean(reason.trim())) &&
      typeof receipt.signerKeyId === "string" && Boolean(receipt.signerKeyId.trim()) &&
      /^sha256:[a-f0-9]{64}$/u.test(receipt.integrityDigest) &&
      /^hmac-sha256:[a-f0-9]{64}$/u.test(receipt.signature)
    );
    let minimumStatus: SignedRiskCalibrationDriftReceipt["status"] = "ready";
    if (policyValid && (
      receipt.scorePopulationStabilityIndex >= policy.blockedPsi ||
      (receipt.currentExpectedCalibrationError !== null && receipt.currentExpectedCalibrationError > policy.maximumCurrentEce)
    )) minimumStatus = "blocked";
    else if (policyValid && (
      receipt.scorePopulationStabilityIndex >= policy.watchPsi ||
      receipt.labeledSampleCount < policy.minimumLabeledSamples
    )) minimumStatus = "watch";
    const severity = { ready: 0, watch: 1, blocked: 2 } as const;
    const statusSemanticsValid = policyValid && severity[receipt.status] >= severity[minimumStatus];
    return {
      ok: integrityValid && signatureValid && signingKeyValid && receiptIdValid && shapeValid && policyValid && profileBindingValid && observationWindowValid && statusSemanticsValid && notFromFuture && fresh,
      integrityValid,
      signatureValid,
      signingKeyValid,
      receiptIdValid,
      shapeValid,
      policyValid,
      profileBindingValid,
      observationWindowValid,
      statusSemanticsValid,
      notFromFuture,
      fresh,
      maximumAgeMs,
    };
  } catch {
    return rejected;
  }
}
