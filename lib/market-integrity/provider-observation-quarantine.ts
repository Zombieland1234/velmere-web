import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";
import { getProviderObservationOperationalSnapshot } from "@/lib/market-integrity/provider-observation-operations";

type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

type Dependencies = { rpc: RpcRunner; now: () => Date };
const defaultDependencies: Dependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: () => new Date(),
};

type EnvLike = Record<string, string | undefined>;
export type ProviderQuarantineAction = "revalidate" | "release";

export type ProviderQuarantineSummary = {
  quarantinedCount: number;
  revalidationPendingCount: number;
  releasedCount: number;
  newlyQuarantined: number;
  releaseCandidates: number;
  lastTransitionAgeSeconds: number;
};

export type ProviderObservationPromotionQuality = {
  schemaVersion: "velmere.provider-observation-promotion-quality.v1";
  ready: boolean;
  qualityDigest: string;
  metrics: {
    totalObservations: number;
    assetCount: number;
    stableAssets: number;
    watchAssets: number;
    anomalousAssets: number;
    staleAssets: number;
    insufficientAssets: number;
    retentionViolations: number;
  };
  quarantine: ProviderQuarantineSummary;
  blockers: string[];
  warnings: string[];
  policy: {
    minStableAssets: number;
    maxAnomalousAssets: number;
    maxStaleAssets: number;
    maxInsufficientPercent: number;
    maxQuarantinedAssets: number;
  };
  privacyBoundary: string;
};

export type ProviderQuarantineApprovalRequest = {
  action: ProviderQuarantineAction;
  maxAssets: number;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(value: unknown) {
  return sha256(JSON.stringify(value));
}

function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return data.find((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) ?? null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

function summaryFromRow(value: Record<string, unknown>): ProviderQuarantineSummary {
  return {
    quarantinedCount: count(value.quarantined_count),
    revalidationPendingCount: count(value.revalidation_pending_count),
    releasedCount: count(value.released_count),
    newlyQuarantined: count(value.newly_quarantined),
    releaseCandidates: count(value.release_candidates),
    lastTransitionAgeSeconds: count(value.last_transition_age_seconds),
  };
}

function usableSecret(value: string) {
  return value.length >= 32 && !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(value);
}

function canonicalApprovalPayload(input: Omit<ProviderQuarantineApprovalRequest, "approvalSignature">) {
  return JSON.stringify({
    action: input.action,
    maxAssets: input.maxAssets,
    operatorHash: sha256(input.operatorId),
    reasonHash: sha256(input.reason),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
  });
}

export function signProviderQuarantineApproval(
  input: Omit<ProviderQuarantineApprovalRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret)) throw new Error("provider_quarantine_secret_missing_or_weak");
  return createHmac("sha256", secret).update(canonicalApprovalPayload(input)).digest("hex");
}

function normalizeApproval(input: ProviderQuarantineApprovalRequest): ProviderQuarantineApprovalRequest {
  const action = input.action === "revalidate" || input.action === "release" ? input.action : null;
  if (!action) throw new Error("provider_quarantine_action_invalid");
  const normalized = {
    ...input,
    action,
    maxAssets: clamp(input.maxAssets, 100, 1, 1_000),
    operatorId: clean(input.operatorId),
    reason: clean(input.reason),
    approvalNonce: clean(input.approvalNonce),
    approvalSignature: clean(input.approvalSignature).toLowerCase(),
  } satisfies ProviderQuarantineApprovalRequest;
  if (normalized.operatorId.length < 3 || normalized.operatorId.length > 160) throw new Error("provider_quarantine_operator_invalid");
  if (normalized.reason.length < 12 || normalized.reason.length > 500) throw new Error("provider_quarantine_reason_invalid");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(normalized.approvalNonce)) throw new Error("provider_quarantine_nonce_invalid");
  if (!/^[0-9a-f]{64}$/.test(normalized.approvalSignature)) throw new Error("provider_quarantine_signature_invalid");
  return normalized;
}

function verifyApproval(request: ProviderQuarantineApprovalRequest, env: EnvLike, now: Date) {
  const secret = clean(env.VELMERE_PROVIDER_QUARANTINE_SECRET);
  if (!usableSecret(secret)) throw new Error("provider_quarantine_secret_missing_or_weak");
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (!Number.isInteger(request.approvalTimestamp) || Math.abs(nowSeconds - request.approvalTimestamp) > 300) {
    throw new Error("provider_quarantine_approval_expired_or_future");
  }
  const { approvalSignature: _signature, ...unsigned } = request;
  const expected = signProviderQuarantineApproval(unsigned, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(request.approvalSignature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new Error("provider_quarantine_signature_mismatch");
  }
}

export async function reconcileProviderObservationQuarantine(input: {
  minStableSamples?: number;
  maxAssets?: number;
  dependencies?: Pick<Dependencies, "rpc">;
} = {}) {
  const dependencies = input.dependencies ?? defaultDependencies;
  const minStableSamples = clamp(input.minStableSamples, 3, 2, 12);
  const maxAssets = clamp(input.maxAssets, 500, 1, 2_000);
  const { data } = await dependencies.rpc({
    operation: "provider_observation_quarantine_reconcile",
    args: {
      p_min_stable_samples: minStableSamples,
      p_max_assets: maxAssets,
    },
  });
  const value = row(data);
  if (!value) throw new Error("provider_quarantine_reconciliation_empty");
  const summary = summaryFromRow(value);
  return {
    schemaVersion: "velmere.provider-observation-quarantine-reconcile.v1" as const,
    ok: summary.newlyQuarantined === 0 && summary.quarantinedCount === 0,
    summary,
    reconciliationDigest: digest({ minStableSamples, maxAssets, summary }),
    privacyBoundary: "Aggregate quarantine counts only. Asset keys, asset hashes, prices, provider payloads, observation digests and database row identifiers are never returned.",
  };
}

export async function getProviderObservationPromotionQuality(input: {
  minStableAssets?: number;
  maxAnomalousAssets?: number;
  maxStaleAssets?: number;
  maxInsufficientPercent?: number;
  maxQuarantinedAssets?: number;
  dependencies?: Pick<Dependencies, "rpc">;
} = {}): Promise<ProviderObservationPromotionQuality> {
  const dependencies = input.dependencies ?? defaultDependencies;
  const policy = {
    minStableAssets: clamp(input.minStableAssets, 1, 1, 10_000),
    maxAnomalousAssets: clamp(input.maxAnomalousAssets, 0, 0, 10_000),
    maxStaleAssets: clamp(input.maxStaleAssets, 0, 0, 10_000),
    maxInsufficientPercent: clamp(input.maxInsufficientPercent, 25, 0, 100),
    maxQuarantinedAssets: clamp(input.maxQuarantinedAssets, 0, 0, 10_000),
  };
  const [operations, quarantine] = await Promise.all([
    getProviderObservationOperationalSnapshot({ dependencies }),
    reconcileProviderObservationQuarantine({ dependencies }),
  ]);
  const metrics = {
    totalObservations: operations.metrics.totalObservations,
    assetCount: operations.metrics.assetCount,
    stableAssets: operations.metrics.stableAssets,
    watchAssets: operations.metrics.watchAssets,
    anomalousAssets: operations.metrics.anomalousAssets,
    staleAssets: operations.metrics.staleAssets,
    insufficientAssets: operations.metrics.insufficientAssets,
    retentionViolations: operations.metrics.retentionViolations,
  };
  const insufficientPercent = metrics.assetCount > 0
    ? Math.round((metrics.insufficientAssets / metrics.assetCount) * 100)
    : 100;
  const blockers = [
    ...(metrics.assetCount === 0 ? ["provider_history_empty"] : []),
    ...(metrics.stableAssets < policy.minStableAssets ? ["provider_stable_asset_floor_not_met"] : []),
    ...(metrics.anomalousAssets > policy.maxAnomalousAssets ? ["provider_anomaly_budget_exceeded"] : []),
    ...(metrics.staleAssets > policy.maxStaleAssets ? ["provider_stale_asset_budget_exceeded"] : []),
    ...(metrics.retentionViolations > 0 ? ["provider_retention_violation"] : []),
    ...(insufficientPercent > policy.maxInsufficientPercent ? ["provider_insufficient_history_budget_exceeded"] : []),
    ...(quarantine.summary.quarantinedCount > policy.maxQuarantinedAssets ? ["provider_quarantine_not_empty"] : []),
    ...(quarantine.summary.revalidationPendingCount > 0 ? ["provider_revalidation_pending"] : []),
  ];
  const warnings = [
    ...(metrics.watchAssets > 0 ? ["provider_watch_assets_nonzero"] : []),
    ...(quarantine.summary.releaseCandidates > 0 ? ["provider_quarantine_release_candidates_pending_operator"] : []),
  ];
  const qualityDigest = digest({ policy, metrics, quarantine: quarantine.summary, blockers, warnings });
  return {
    schemaVersion: "velmere.provider-observation-promotion-quality.v1",
    ready: blockers.length === 0,
    qualityDigest,
    metrics,
    quarantine: quarantine.summary,
    blockers,
    warnings,
    policy,
    privacyBoundary: "Promotion quality exposes aggregate counts, policy limits and a SHA-256 digest only. Asset identifiers, hashes, prices, provider payloads and raw operator data are omitted.",
  };
}

export async function applyProviderObservationQuarantineAction(input: {
  request: ProviderQuarantineApprovalRequest;
  env?: EnvLike;
  dependencies?: Partial<Dependencies>;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const request = normalizeApproval(input.request);
  verifyApproval(request, env, dependencies.now());
  const operatorHash = sha256(request.operatorId);
  const reasonHash = sha256(request.reason);
  const approvalDigest = digest(canonicalApprovalPayload({
    action: request.action,
    maxAssets: request.maxAssets,
    operatorId: request.operatorId,
    reason: request.reason,
    approvalTimestamp: request.approvalTimestamp,
    approvalNonce: request.approvalNonce,
  }));
  const { data } = await dependencies.rpc({
    operation: "provider_observation_quarantine_action",
    args: {
      p_action: request.action,
      p_max_assets: request.maxAssets,
      p_operator_hash: operatorHash,
      p_reason_hash: reasonHash,
      p_approval_digest: approvalDigest,
    },
  });
  const value = row(data);
  if (!value) throw new Error("provider_quarantine_action_empty");
  const affectedAssets = count(value.affected_assets);
  const remainingQuarantined = count(value.remaining_quarantined);
  const remainingPending = count(value.remaining_revalidation_pending);
  return {
    schemaVersion: "velmere.provider-observation-quarantine-action.v1" as const,
    ok: request.action === "release" ? remainingPending === 0 : true,
    action: request.action,
    affectedAssets,
    remainingQuarantined,
    remainingRevalidationPending: remainingPending,
    approvalDigest,
    privacyBoundary: "Only aggregate action counts and a request digest are returned. Operator identity, reason, signature, asset identifiers, asset hashes and row identifiers are omitted.",
  };
}
