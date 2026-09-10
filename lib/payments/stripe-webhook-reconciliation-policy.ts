export type StripeWebhookReconciliationSeverity = "none" | "warning" | "critical";

type StripeWebhookWorkerAggregateValues = {
  leaseAcquired: boolean;
  scannedCount: number;
  staleReleasedCount: number;
  retryReadyCount: number;
  deadLetteredCount: number;
  completedWithoutEventCount: number;
  oldestProcessingAgeSeconds: number | null;
  errorBuckets: {
    provider: number;
    storage: number;
    entitlement: number;
    order: number;
    other: number;
  };
};

export type StripeWebhookWorkerAggregate = StripeWebhookWorkerAggregateValues & {
  telemetryValid: boolean;
  telemetryReasonCodes: string[];
};

export type StripeWebhookWorkerPolicy = {
  severity: StripeWebhookReconciliationSeverity;
  alertRequired: boolean;
  reasonCodes: string[];
};

const MAX_COUNT = 1_000_000;
const MAX_PROCESSING_AGE_SECONDS = 31_536_000;
const AGGREGATE_KEYS = [
  "leaseAcquired",
  "scannedCount",
  "staleReleasedCount",
  "retryReadyCount",
  "deadLetteredCount",
  "completedWithoutEventCount",
  "oldestProcessingAgeSeconds",
  "errorBuckets",
] as const;
const ERROR_BUCKET_KEYS = ["provider", "storage", "entitlement", "order", "other"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function pushOnce(errors: string[], code: string) {
  if (!errors.includes(code)) errors.push(code);
}

function rejectUnknownKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  errors: string[],
  code: string,
) {
  if (Object.keys(source).some((key) => !allowed.includes(key))) pushOnce(errors, code);
}

function strictCount(
  source: Record<string, unknown>,
  key: string,
  label: string,
  errors: string[],
  max = MAX_COUNT,
) {
  if (!hasOwn(source, key)) {
    pushOnce(errors, `telemetry_${label}_missing`);
    return 0;
  }
  const value = source[key];
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || !Number.isInteger(value)
    || value < 0
    || value > max
  ) {
    pushOnce(errors, `telemetry_${label}_invalid`);
    return 0;
  }
  return value;
}

function strictOldestProcessingAge(
  source: Record<string, unknown>,
  errors: string[],
) {
  const key = "oldestProcessingAgeSeconds";
  if (!hasOwn(source, key)) {
    pushOnce(errors, "telemetry_oldest_processing_age_seconds_missing");
    return null;
  }
  if (source[key] === null) return null;
  const value = source[key];
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || !Number.isInteger(value)
    || value < 0
    || value > MAX_PROCESSING_AGE_SECONDS
  ) {
    pushOnce(errors, "telemetry_oldest_processing_age_seconds_invalid");
    return null;
  }
  return value;
}

function strictErrorBuckets(
  source: Record<string, unknown>,
  errors: string[],
): StripeWebhookWorkerAggregateValues["errorBuckets"] {
  const raw = source.errorBuckets;
  if (!hasOwn(source, "errorBuckets")) {
    pushOnce(errors, "telemetry_error_buckets_missing");
  } else if (!isRecord(raw)) {
    pushOnce(errors, "telemetry_error_buckets_invalid");
  }
  const buckets = isRecord(raw) ? raw : {};
  rejectUnknownKeys(buckets, ERROR_BUCKET_KEYS, errors, "telemetry_error_buckets_unknown_fields");
  return {
    provider: strictCount(buckets, "provider", "error_bucket_provider", errors),
    storage: strictCount(buckets, "storage", "error_bucket_storage", errors),
    entitlement: strictCount(buckets, "entitlement", "error_bucket_entitlement", errors),
    order: strictCount(buckets, "order", "error_bucket_order", errors),
    other: strictCount(buckets, "other", "error_bucket_other", errors),
  };
}

function validateAggregateRelationships(
  aggregate: StripeWebhookWorkerAggregateValues,
  errors: string[],
) {
  if (!aggregate.leaseAcquired) {
    const nonZero = aggregate.scannedCount > 0
      || aggregate.staleReleasedCount > 0
      || aggregate.retryReadyCount > 0
      || aggregate.deadLetteredCount > 0
      || aggregate.completedWithoutEventCount > 0
      || aggregate.oldestProcessingAgeSeconds !== null
      || Object.values(aggregate.errorBuckets).some((count) => count > 0);
    if (nonZero) pushOnce(errors, "telemetry_lease_not_acquired_aggregate_nonzero");
    return;
  }

  if (aggregate.staleReleasedCount > aggregate.scannedCount) {
    pushOnce(errors, "telemetry_stale_released_exceeds_scanned");
  }
  if (aggregate.retryReadyCount > aggregate.scannedCount) {
    pushOnce(errors, "telemetry_retry_ready_exceeds_scanned");
  }
  if (aggregate.deadLetteredCount > aggregate.scannedCount) {
    pushOnce(errors, "telemetry_dead_lettered_exceeds_scanned");
  }
  for (const [bucket, count] of Object.entries(aggregate.errorBuckets)) {
    if (count > aggregate.scannedCount) {
      pushOnce(errors, `telemetry_error_bucket_${bucket}_exceeds_scanned`);
    }
  }
  if (aggregate.scannedCount === 0 && aggregate.oldestProcessingAgeSeconds !== null) {
    pushOnce(errors, "telemetry_processing_age_without_scanned_effects");
  }
}

/**
 * Strictly decodes the service-role RPC aggregate. Invalid values are never coerced,
 * truncated or clamped into a healthy row. Safe zero/null projections are returned only
 * so an aggregate-only critical alert can be emitted without echoing provider data.
 */
export function normalizeStripeWebhookWorkerAggregate(value: unknown): StripeWebhookWorkerAggregate {
  const errors: string[] = [];
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) pushOnce(errors, "telemetry_payload_invalid");
  rejectUnknownKeys(source, AGGREGATE_KEYS, errors, "telemetry_unknown_fields");

  let leaseAcquired = false;
  if (!hasOwn(source, "leaseAcquired")) {
    pushOnce(errors, "telemetry_lease_acquired_missing");
  } else if (typeof source.leaseAcquired !== "boolean") {
    pushOnce(errors, "telemetry_lease_acquired_invalid");
  } else {
    leaseAcquired = source.leaseAcquired;
  }

  const aggregate: StripeWebhookWorkerAggregateValues = {
    leaseAcquired,
    scannedCount: strictCount(source, "scannedCount", "scanned_count", errors),
    staleReleasedCount: strictCount(source, "staleReleasedCount", "stale_released_count", errors),
    retryReadyCount: strictCount(source, "retryReadyCount", "retry_ready_count", errors),
    deadLetteredCount: strictCount(source, "deadLetteredCount", "dead_lettered_count", errors),
    completedWithoutEventCount: strictCount(
      source,
      "completedWithoutEventCount",
      "completed_without_event_count",
      errors,
    ),
    oldestProcessingAgeSeconds: strictOldestProcessingAge(source, errors),
    errorBuckets: strictErrorBuckets(source, errors),
  };
  validateAggregateRelationships(aggregate, errors);

  return {
    ...aggregate,
    telemetryValid: errors.length === 0,
    telemetryReasonCodes: errors.length ? ["telemetry_invalid", ...errors] : [],
  };
}

export function classifyStripeWebhookWorkerRun(
  input: StripeWebhookWorkerAggregate,
): StripeWebhookWorkerPolicy {
  if (input.telemetryValid !== true) {
    const reasonCodes = Array.isArray(input.telemetryReasonCodes)
      && input.telemetryReasonCodes.length > 0
      ? input.telemetryReasonCodes
      : ["telemetry_invalid", "telemetry_validation_state_missing"];
    return { severity: "critical", alertRequired: true, reasonCodes };
  }

  if (!input.leaseAcquired) {
    return { severity: "none", alertRequired: false, reasonCodes: ["worker_already_running"] };
  }

  const reasons: string[] = [];
  if (input.deadLetteredCount > 0) reasons.push("effects_dead_lettered");
  if (input.completedWithoutEventCount > 0) reasons.push("completed_effect_event_mismatch");
  if (input.errorBuckets.provider > 0) reasons.push("provider_failures_present");
  if (input.errorBuckets.storage > 0) reasons.push("storage_failures_present");
  if (input.errorBuckets.entitlement > 0) reasons.push("entitlement_failures_present");
  if (input.errorBuckets.order > 0) reasons.push("order_failures_present");
  if (input.errorBuckets.other > 0) reasons.push("other_failures_present");
  if (input.staleReleasedCount > 0) reasons.push("stale_leases_released");
  if (input.oldestProcessingAgeSeconds !== null && input.oldestProcessingAgeSeconds >= 900) {
    reasons.push("processing_age_above_15m");
  }

  const critical = input.deadLetteredCount > 0 || input.completedWithoutEventCount > 0;
  const warning = reasons.length > 0;
  return {
    severity: critical ? "critical" : warning ? "warning" : "none",
    alertRequired: warning,
    reasonCodes: reasons.length ? reasons : ["healthy"],
  };
}

export function isStripeWebhookReconciliationRouteOk(input: {
  severity: StripeWebhookReconciliationSeverity;
  alertDelivery: string;
}) {
  if (input.severity === "critical") return false;
  if (input.severity === "warning") return input.alertDelivery === "delivered";
  if (input.severity === "none") return input.alertDelivery === "not_required";
  return false;
}
