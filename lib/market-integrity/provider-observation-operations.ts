import { createHash } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

type Dependencies = { rpc: RpcRunner };
const defaultDependencies: Dependencies = { rpc: runRegisteredServiceRoleRpc };

export type ProviderObservationOperationalMetrics = {
  totalObservations: number;
  assetCount: number;
  stableAssets: number;
  watchAssets: number;
  anomalousAssets: number;
  staleAssets: number;
  insufficientAssets: number;
  retentionViolations: number;
  oldestObservationAgeSeconds: number;
  latestObservationAgeSeconds: number;
  maxAssetObservations: number;
};

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

const SNAPSHOT_KEYS = Object.freeze([
  "total_observations",
  "asset_count",
  "stable_assets",
  "watch_assets",
  "anomalous_assets",
  "stale_assets",
  "insufficient_assets",
  "retention_violations",
  "oldest_observation_age_seconds",
  "latest_observation_age_seconds",
  "max_asset_observations",
] as const);

const COMPACTION_KEYS = Object.freeze([
  "affected_assets",
  "deleted_observations",
  "remaining_retention_violations",
] as const);

function telemetryError(code: string, reason: string): never {
  throw new Error(`${code}:${reason}`);
}

function exactTelemetryRow(
  data: unknown,
  requiredKeys: readonly string[],
  code: string,
): Record<string, unknown> {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length !== 1) telemetryError(code, "row_count");
  const candidate = rows[0];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    telemetryError(code, "row_shape");
  }
  const row = candidate as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  const expected = [...requiredKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    telemetryError(code, "field_set");
  }
  return row;
}

function telemetryInteger(row: Record<string, unknown>, key: string, code: string) {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    telemetryError(code, `invalid_integer:${key}`);
  }
  return value;
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function metricsFromRow(row: Record<string, unknown>): ProviderObservationOperationalMetrics {
  const code = "provider_observation_telemetry_schema_invalid";
  const metrics = {
    totalObservations: telemetryInteger(row, "total_observations", code),
    assetCount: telemetryInteger(row, "asset_count", code),
    stableAssets: telemetryInteger(row, "stable_assets", code),
    watchAssets: telemetryInteger(row, "watch_assets", code),
    anomalousAssets: telemetryInteger(row, "anomalous_assets", code),
    staleAssets: telemetryInteger(row, "stale_assets", code),
    insufficientAssets: telemetryInteger(row, "insufficient_assets", code),
    retentionViolations: telemetryInteger(row, "retention_violations", code),
    oldestObservationAgeSeconds: telemetryInteger(row, "oldest_observation_age_seconds", code),
    latestObservationAgeSeconds: telemetryInteger(row, "latest_observation_age_seconds", code),
    maxAssetObservations: telemetryInteger(row, "max_asset_observations", code),
  };
  const classifiedAssets = metrics.stableAssets + metrics.watchAssets
    + metrics.anomalousAssets + metrics.insufficientAssets;
  if (classifiedAssets !== metrics.assetCount) telemetryError(code, "asset_classification_total");
  if (metrics.totalObservations < metrics.assetCount) telemetryError(code, "observation_asset_total");
  if (metrics.staleAssets > metrics.assetCount) telemetryError(code, "stale_asset_total");
  if (metrics.retentionViolations > metrics.assetCount) telemetryError(code, "retention_asset_total");
  if (metrics.oldestObservationAgeSeconds < metrics.latestObservationAgeSeconds) {
    telemetryError(code, "observation_age_order");
  }
  if (metrics.assetCount === 0) {
    if (
      metrics.totalObservations !== 0
      || metrics.maxAssetObservations !== 0
      || metrics.oldestObservationAgeSeconds !== 0
      || metrics.latestObservationAgeSeconds !== 0
    ) telemetryError(code, "empty_ledger_nonzero");
  } else if (
    metrics.maxAssetObservations < 1
    || metrics.maxAssetObservations > metrics.totalObservations
  ) {
    telemetryError(code, "max_asset_observation_total");
  }
  return metrics;
}

export async function getProviderObservationOperationalSnapshot(input: {
  staleAfterSeconds?: number;
  retentionLimit?: number;
  minStableSamples?: number;
  dependencies?: Dependencies;
} = {}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  const policy = {
    staleAfterSeconds: clamp(input.staleAfterSeconds, 1_800, 300, 86_400),
    retentionLimit: clamp(input.retentionLimit, 96, 12, 512),
    minStableSamples: clamp(input.minStableSamples, 3, 2, 12),
  };
  const { data } = await dependencies.rpc({
    operation: "provider_observation_reconcile",
    args: {
      p_stale_after_seconds: policy.staleAfterSeconds,
      p_retention_limit: policy.retentionLimit,
      p_min_stable_samples: policy.minStableSamples,
    },
  });
  const row = exactTelemetryRow(
    data,
    SNAPSHOT_KEYS,
    "provider_observation_telemetry_schema_invalid",
  );
  const metrics = metricsFromRow(row);
  const blockers = [
    ...(metrics.retentionViolations > 0 ? ["provider_observation_retention_violation"] : []),
    ...(metrics.anomalousAssets > 0 ? ["provider_history_anomaly"] : []),
    ...(metrics.assetCount > 0 && metrics.staleAssets === metrics.assetCount ? ["provider_observation_ledger_stale"] : []),
  ];
  const warnings = [
    ...(metrics.staleAssets > 0 && metrics.staleAssets < metrics.assetCount ? ["provider_observation_assets_stale"] : []),
    ...(metrics.insufficientAssets > 0 ? ["provider_observation_history_insufficient"] : []),
  ];
  return {
    schemaVersion: "velmere.provider-observation-operations-snapshot.v1" as const,
    ok: blockers.length === 0,
    severity: blockers.includes("provider_observation_retention_violation") || blockers.includes("provider_history_anomaly")
      ? "critical" as const
      : blockers.length || warnings.length ? "warning" as const : "none" as const,
    policy,
    metrics,
    blockers,
    warnings,
    snapshotDigest: digest({ policy, metrics, blockers, warnings }),
    privacyBoundary: "Aggregate counts and ages only. Asset identifiers, asset hashes, provider payloads, prices and observation digests are never returned.",
  };
}

export async function runProviderObservationOperations(input: {
  staleAfterSeconds?: number;
  retentionLimit?: number;
  minStableSamples?: number;
  maxAssetsPerCompaction?: number;
  anomalyAlertThreshold?: number;
  staleAssetAlertThreshold?: number;
  dependencies?: Dependencies;
} = {}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  const snapshot = await getProviderObservationOperationalSnapshot({ ...input, dependencies });
  const maxAssetsPerCompaction = clamp(input.maxAssetsPerCompaction, 250, 1, 2_000);
  const anomalyAlertThreshold = clamp(input.anomalyAlertThreshold, 1, 1, 10_000);
  const staleAssetAlertThreshold = clamp(input.staleAssetAlertThreshold, 10, 1, 100_000);
  const { data: compactData } = await dependencies.rpc({
    operation: "provider_observation_compact",
    args: {
      p_retention_limit: snapshot.policy.retentionLimit,
      p_max_assets: maxAssetsPerCompaction,
    },
  });
  const compactCode = "provider_observation_compaction_telemetry_schema_invalid";
  const compactRow = exactTelemetryRow(compactData, COMPACTION_KEYS, compactCode);
  const compaction = {
    affectedAssets: telemetryInteger(compactRow, "affected_assets", compactCode),
    deletedObservations: telemetryInteger(compactRow, "deleted_observations", compactCode),
    remainingRetentionViolations: telemetryInteger(compactRow, "remaining_retention_violations", compactCode),
  };
  if (compaction.affectedAssets > compaction.deletedObservations) {
    telemetryError(compactCode, "affected_deleted_total");
  }

  const alertRequests = [
    ...(snapshot.metrics.anomalousAssets >= anomalyAlertThreshold ? [{
      code: "provider_history_anomaly",
      severity: "critical",
      value: snapshot.metrics.anomalousAssets,
      threshold: anomalyAlertThreshold,
    }] : []),
    ...(snapshot.metrics.retentionViolations > 0 || compaction.remainingRetentionViolations > 0 ? [{
      code: "provider_observation_retention_drift",
      severity: "critical",
      value: Math.max(snapshot.metrics.retentionViolations, compaction.remainingRetentionViolations),
      threshold: 0,
    }] : []),
    ...(snapshot.metrics.staleAssets >= staleAssetAlertThreshold ? [{
      code: "provider_observation_ledger_stale",
      severity: "warning",
      value: snapshot.metrics.staleAssets,
      threshold: staleAssetAlertThreshold,
    }] : []),
  ] as const;

  const alertResults: Array<{ code: string; state: string }> = [];
  for (const alert of alertRequests) {
    const { data } = await dependencies.rpc({
      operation: "provider_observation_alert_record",
      args: {
        p_code: alert.code,
        p_severity: alert.severity,
        p_value: alert.value,
        p_threshold: alert.threshold,
      },
    });
    const row = firstRow(data);
    alertResults.push({ code: alert.code, state: String(row?.state ?? "store_failed") });
  }

  const storeFailed = alertResults.filter((item) => !["recorded", "deduplicated"].includes(item.state)).length;
  return {
    schemaVersion: "velmere.provider-observation-operations-run.v1" as const,
    ok: storeFailed === 0 && compaction.remainingRetentionViolations === 0 && snapshot.metrics.anomalousAssets < anomalyAlertThreshold,
    snapshot,
    compaction,
    alerts: {
      requested: alertRequests.length,
      recorded: alertResults.filter((item) => item.state === "recorded").length,
      deduplicated: alertResults.filter((item) => item.state === "deduplicated").length,
      storeFailed,
      codes: alertResults.map((item) => item.code),
    },
    operationDigest: digest({ snapshot: snapshot.snapshotDigest, compaction, alertResults }),
    privacyBoundary: "Only aggregate operations metrics and alert codes are returned. No asset identifiers, hashes, provider payloads, prices, webhook destinations or alert IDs are exposed.",
  };
}
