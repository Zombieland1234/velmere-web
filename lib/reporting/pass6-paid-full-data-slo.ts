import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS6_PAID_FULL_DATA_SLO_ID = "pass6-paid-full-data-slo-v1" as const;
export const PASS6_PAID_FULL_DATA_AVAILABILITY_TARGET_BPS = 9_990 as const;
export const PASS6_PAID_DELIVERY_COMPLETENESS_REQUIRED_BPS = 10_000 as const;
export const PASS6_PAID_FULL_DATA_MIN_REQUESTS_PER_COHORT = 10_000 as const;
export const PASS6_PAID_FULL_DATA_MIN_WINDOW_DAYS = 30 as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const DAY_MS = 86_400_000;
const MAX_WINDOW_DAYS = 45;

export const PASS6_PAID_FULL_DATA_COHORT_IDS = Object.freeze([
  "shield:pro:crypto",
  "shield:advanced:crypto",
  "real_markets:pro:equity",
  "real_markets:pro:fx",
  "real_markets:pro:etf",
  "real_markets:pro:commodity",
  "real_markets:pro:real_estate",
  "real_markets:pro:crypto",
  "real_markets:advanced:equity",
  "real_markets:advanced:fx",
  "real_markets:advanced:etf",
  "real_markets:advanced:commodity",
  "real_markets:advanced:real_estate",
  "real_markets:advanced:crypto",
  "audit:pro:smart_contract",
  "audit:advanced:smart_contract",
  "lens:pro:multi_asset",
  "lens:advanced:multi_asset",
] as const);

export type Pass6PaidFullDataCohortId = typeof PASS6_PAID_FULL_DATA_COHORT_IDS[number];

export type Pass6PaidFullDataCohortWindow = {
  cohortId: Pass6PaidFullDataCohortId;
  requestedCount: number;
  fullDeliveryCount: number;
  blockedBeforeDeliveryCount: number;
  systemErrorCount: number;
  incompleteDeliveredCount: number;
  paidDeliveryCount: number;
  commercialReceiptCount: number;
  identityBoundCount: number;
  freshnessCompliantCount: number;
  quorumCompliantCount: number;
  telemetryCompleteCount: number;
  evidenceRecordCount: number;
  evidenceRoot: string;
};

export type Pass6PaidFullDataSloInput = {
  environment: "staging" | "production";
  evidenceClass: "real_shadow_observation" | "real_canary_observation" | "real_production_observation";
  windowStartedAt: string;
  windowEndedAt: string;
  generatedAt: string;
  deploymentDigest: string;
  providerConfigRoot: string;
  canonicalFieldRegistryDigest: string;
  cohorts: Pass6PaidFullDataCohortWindow[];
};

export type Pass6PaidFullDataCohortResult = Pass6PaidFullDataCohortWindow & {
  fullDataAvailabilityBps: number;
  deliveredCompletenessBps: number;
  passed: boolean;
  blockers: string[];
};

export type Pass6PaidFullDataSloReceipt = {
  schemaVersion: typeof PASS6_PAID_FULL_DATA_SLO_ID;
  status: "pass" | "blocked";
  environment: Pass6PaidFullDataSloInput["environment"];
  evidenceClass: Pass6PaidFullDataSloInput["evidenceClass"];
  availabilityTargetBps: typeof PASS6_PAID_FULL_DATA_AVAILABILITY_TARGET_BPS;
  deliveredCompletenessRequiredBps: typeof PASS6_PAID_DELIVERY_COMPLETENESS_REQUIRED_BPS;
  minimumRequestsPerCohort: typeof PASS6_PAID_FULL_DATA_MIN_REQUESTS_PER_COHORT;
  minimumWindowDays: typeof PASS6_PAID_FULL_DATA_MIN_WINDOW_DAYS;
  windowStartedAt: string;
  windowEndedAt: string;
  generatedAt: string;
  deploymentDigest: string;
  providerConfigRoot: string;
  canonicalFieldRegistryDigest: string;
  requiredCohortCount: number;
  passingCohortCount: number;
  requestedCount: number;
  fullDeliveryCount: number;
  blockedBeforeDeliveryCount: number;
  systemErrorCount: number;
  incompleteDeliveredCount: number;
  cohorts: Pass6PaidFullDataCohortResult[];
  blockers: string[];
  receiptDigest: string;
};

function integer(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function ratioBps(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Math.floor((numerator * 10_000) / denominator);
}

function evaluateCohort(cohort: Pass6PaidFullDataCohortWindow): Pass6PaidFullDataCohortResult {
  const blockers: string[] = [];
  const countEntries = Object.entries(cohort).filter(([key]) => key.endsWith("Count"));
  for (const [key, value] of countEntries) {
    if (!integer(value as number)) blockers.push(`cohort_count_invalid:${cohort.cohortId}:${key}`);
  }

  const outcomes = cohort.fullDeliveryCount + cohort.blockedBeforeDeliveryCount + cohort.systemErrorCount;
  if (outcomes !== cohort.requestedCount) blockers.push(`cohort_outcome_sum_invalid:${cohort.cohortId}`);
  if (cohort.requestedCount < PASS6_PAID_FULL_DATA_MIN_REQUESTS_PER_COHORT) {
    blockers.push(`cohort_sample_shortfall:${cohort.cohortId}`);
  }
  if (cohort.paidDeliveryCount !== cohort.fullDeliveryCount + cohort.incompleteDeliveredCount) {
    blockers.push(`cohort_paid_delivery_sum_invalid:${cohort.cohortId}`);
  }
  if (cohort.incompleteDeliveredCount !== 0) blockers.push(`incomplete_paid_delivery_detected:${cohort.cohortId}`);
  for (const [label, count] of [
    ["commercial_receipt", cohort.commercialReceiptCount],
    ["identity_bound", cohort.identityBoundCount],
    ["freshness", cohort.freshnessCompliantCount],
    ["quorum", cohort.quorumCompliantCount],
    ["telemetry", cohort.telemetryCompleteCount],
  ] as const) {
    if (count !== cohort.fullDeliveryCount) blockers.push(`cohort_${label}_coverage_invalid:${cohort.cohortId}`);
  }
  if (cohort.evidenceRecordCount !== cohort.requestedCount) blockers.push(`cohort_evidence_coverage_invalid:${cohort.cohortId}`);
  if (!DIGEST.test(cohort.evidenceRoot)) blockers.push(`cohort_evidence_root_invalid:${cohort.cohortId}`);

  const fullDataAvailabilityBps = ratioBps(cohort.fullDeliveryCount, cohort.requestedCount);
  const deliveredCompletenessBps = cohort.paidDeliveryCount > 0 && cohort.incompleteDeliveredCount === 0
    ? PASS6_PAID_DELIVERY_COMPLETENESS_REQUIRED_BPS
    : 0;
  if (fullDataAvailabilityBps < PASS6_PAID_FULL_DATA_AVAILABILITY_TARGET_BPS) {
    blockers.push(`cohort_99_9_slo_failed:${cohort.cohortId}`);
  }
  if (deliveredCompletenessBps !== PASS6_PAID_DELIVERY_COMPLETENESS_REQUIRED_BPS) {
    blockers.push(`cohort_100_percent_delivery_invariant_failed:${cohort.cohortId}`);
  }
  return {
    ...cohort,
    fullDataAvailabilityBps,
    deliveredCompletenessBps,
    passed: blockers.length === 0,
    blockers: Array.from(new Set(blockers)).sort(),
  };
}

export function buildPass6PaidFullDataSloReceipt(input: Pass6PaidFullDataSloInput): Pass6PaidFullDataSloReceipt {
  const blockers: string[] = [];
  const startedAtMs = Date.parse(input.windowStartedAt);
  const endedAtMs = Date.parse(input.windowEndedAt);
  const generatedAtMs = Date.parse(input.generatedAt);
  if (![startedAtMs, endedAtMs, generatedAtMs].every(Number.isFinite)) blockers.push("slo_window_timestamp_invalid");
  const durationMs = endedAtMs - startedAtMs;
  if (durationMs < PASS6_PAID_FULL_DATA_MIN_WINDOW_DAYS * DAY_MS || durationMs > MAX_WINDOW_DAYS * DAY_MS) {
    blockers.push("slo_window_duration_invalid");
  }
  if (generatedAtMs < endedAtMs || generatedAtMs > endedAtMs + DAY_MS) blockers.push("slo_generated_at_not_bound_to_window");
  if (![input.deploymentDigest, input.providerConfigRoot, input.canonicalFieldRegistryDigest].every((value) => DIGEST.test(value))) {
    blockers.push("slo_configuration_digest_invalid");
  }
  if (input.cohorts.length !== PASS6_PAID_FULL_DATA_COHORT_IDS.length) blockers.push("slo_cohort_count_invalid");
  const suppliedIds = input.cohorts.map((cohort) => cohort.cohortId);
  if (new Set(suppliedIds).size !== suppliedIds.length) blockers.push("slo_duplicate_cohort");
  const expectedIds = new Set<string>(PASS6_PAID_FULL_DATA_COHORT_IDS);
  if (suppliedIds.some((id) => !expectedIds.has(id)) || PASS6_PAID_FULL_DATA_COHORT_IDS.some((id) => !suppliedIds.includes(id))) {
    blockers.push("slo_required_cohort_set_mismatch");
  }

  const cohorts = [...input.cohorts]
    .sort((left, right) => left.cohortId.localeCompare(right.cohortId))
    .map(evaluateCohort);
  for (const cohort of cohorts) blockers.push(...cohort.blockers);
  const sum = (key: "requestedCount" | "fullDeliveryCount" | "blockedBeforeDeliveryCount" | "systemErrorCount" | "incompleteDeliveredCount") =>
    cohorts.reduce((total, cohort) => total + cohort[key], 0);
  const core = {
    schemaVersion: PASS6_PAID_FULL_DATA_SLO_ID,
    status: blockers.length === 0 ? "pass" as const : "blocked" as const,
    environment: input.environment,
    evidenceClass: input.evidenceClass,
    availabilityTargetBps: PASS6_PAID_FULL_DATA_AVAILABILITY_TARGET_BPS,
    deliveredCompletenessRequiredBps: PASS6_PAID_DELIVERY_COMPLETENESS_REQUIRED_BPS,
    minimumRequestsPerCohort: PASS6_PAID_FULL_DATA_MIN_REQUESTS_PER_COHORT,
    minimumWindowDays: PASS6_PAID_FULL_DATA_MIN_WINDOW_DAYS,
    windowStartedAt: input.windowStartedAt,
    windowEndedAt: input.windowEndedAt,
    generatedAt: input.generatedAt,
    deploymentDigest: input.deploymentDigest,
    providerConfigRoot: input.providerConfigRoot,
    canonicalFieldRegistryDigest: input.canonicalFieldRegistryDigest,
    requiredCohortCount: PASS6_PAID_FULL_DATA_COHORT_IDS.length,
    passingCohortCount: cohorts.filter((cohort) => cohort.passed).length,
    requestedCount: sum("requestedCount"),
    fullDeliveryCount: sum("fullDeliveryCount"),
    blockedBeforeDeliveryCount: sum("blockedBeforeDeliveryCount"),
    systemErrorCount: sum("systemErrorCount"),
    incompleteDeliveredCount: sum("incompleteDeliveredCount"),
    cohorts,
    blockers: Array.from(new Set(blockers)).sort(),
  };
  return { ...core, receiptDigest: sha256Digest(canonicalJson(core)) };
}

