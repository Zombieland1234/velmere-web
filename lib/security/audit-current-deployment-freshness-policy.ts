export const AUDIT_CURRENT_DEPLOYMENT_FRESHNESS_POLICY_ID =
  "velmere.audit-current-deployment-freshness.15m-v1" as const;

// Existing Audit release-gate current-deployment window, shared with P82 so
// a freshly signed receipt cannot bless an old or implausibly future head.
export const AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS = 15 * 60 * 1_000;
export const AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS = 60 * 1_000;

export type CurrentDeploymentTimestampBlocker =
  | "current_deployment_snapshot_stale"
  | "current_deployment_snapshot_from_future"
  | "current_deployment_snapshot_timestamp_invalid";

export function currentDeploymentTimestampBlocker(
  timestampSeconds: unknown,
  observedAt: Date,
): CurrentDeploymentTimestampBlocker | null {
  if (!Number.isSafeInteger(timestampSeconds) || Number(timestampSeconds) < 0) {
    return "current_deployment_snapshot_timestamp_invalid";
  }
  const observedMs = observedAt.getTime();
  const snapshotMs = Number(timestampSeconds) * 1_000;
  if (!Number.isFinite(observedMs) || !Number.isFinite(snapshotMs)) {
    return "current_deployment_snapshot_timestamp_invalid";
  }
  if (snapshotMs > observedMs + AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS) {
    return "current_deployment_snapshot_from_future";
  }
  if (observedMs - snapshotMs > AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS) {
    return "current_deployment_snapshot_stale";
  }
  return null;
}
