import { randomBytes } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import {
  completeDurableComputationLease,
  encodeDurableBinaryResult,
  encodeDurableJsonResult,
  failDurableComputationLease,
  type DurableComputationKind,
} from "@/lib/jobs/durable-computation-replay";
import {
  getDurablePayloadKeyringReadiness,
  openDurableComputationPayload,
  type DurableComputationSealedPayload,
} from "@/lib/jobs/durable-computation-payload";
import { sha256Hex } from "@/lib/jobs/durable-computation-canonical";
import {
  DURABLE_WORKER_CAPABLE_KINDS,
  executeRegisteredDurableComputation,
  type DurableWorkerExecution,
} from "@/lib/jobs/durable-computation-executor-registry";

export const DURABLE_COMPUTATION_WORKER_ID = "velmere-durable-computation-worker-v1" as const;

export const DURABLE_COMPUTATION_KIND_COST_UNITS: Readonly<Record<DurableComputationKind, number>> = {
  vlm_analysis: 4,
  lens_pdf_render: 3,
  audit_pdf_render: 3,
};

type WorkerJob = {
  jobId: string;
  kind: DurableComputationKind;
  inputHash: string;
  subjectHash: string;
  attemptCount: number;
  leaseToken: string;
  sealedPayload: DurableComputationSealedPayload;
  costUnits?: number;
  sealedPayloadBytes?: number;
};

type WorkerClaimArgs = {
  workerIdHash: string;
  leaseToken: string;
  leaseSeconds: number;
  limit: number;
  perSubjectLimit: number;
  globalCostLimit: number;
  perSubjectCostLimit: number;
  maxClaimedPayloadBytes: number;
  kinds: DurableComputationKind[];
};

type WorkerDependencies = {
  claimBatch: (args: WorkerClaimArgs) => Promise<WorkerJob[]>;
  heartbeat: (args: { jobIds: string[]; leaseToken: string; leaseSeconds: number }) => Promise<string[] | number>;
  releaseClaims?: (args: { jobIds: string[]; leaseToken: string; reasonCode: string }) => Promise<string[] | number>;
  complete: typeof completeDurableComputationLease;
  fail: typeof failDurableComputationLease;
  execute: (kind: DurableComputationKind, payload: unknown) => Promise<DurableWorkerExecution>;
};

type WorkerBudgetLimits = {
  globalCostLimit: number;
  perSubjectCostLimit: number;
  maxClaimedPayloadBytes: number;
};

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function parseRpcRows(data: unknown) {
  return Array.isArray(data) ? data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
}

function asSealedPayload(value: unknown): DurableComputationSealedPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== "velmere.durable-computation.sealed-payload.v1" || row.algorithm !== "A256GCM") return null;
  return row as DurableComputationSealedPayload;
}

function normalizedKindCost(kind: DurableComputationKind, value: unknown) {
  const parsed = Number(value);
  const expected = DURABLE_COMPUTATION_KIND_COST_UNITS[kind];
  return Number.isInteger(parsed) && parsed >= expected && parsed <= 16 ? parsed : expected;
}

function estimatedSealedPayloadBytes(payload: DurableComputationSealedPayload, value: unknown) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 2 * 1024 * 1024) return parsed;
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

async function defaultClaimBatch(args: WorkerClaimArgs) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_worker_claim_batch_budgeted",
    args: {
      p_worker_id_hash: args.workerIdHash,
      p_lease_token: args.leaseToken,
      p_lease_seconds: args.leaseSeconds,
      p_limit: args.limit,
      p_per_subject_limit: args.perSubjectLimit,
      p_global_cost_limit: args.globalCostLimit,
      p_subject_cost_limit: args.perSubjectCostLimit,
      p_max_claimed_payload_bytes: args.maxClaimedPayloadBytes,
      p_kinds: args.kinds,
    },
  });
  return parseRpcRows(data).flatMap((row) => {
    const sealedPayload = asSealedPayload(row.sealed_payload);
    const kind = String(row.kind ?? "") as DurableComputationKind;
    const jobId = String(row.job_id ?? "");
    const inputHash = String(row.input_hash ?? "");
    const subjectHash = String(row.subject_hash ?? "");
    if (!sealedPayload || !/^dcj_[0-9a-f]{48}$/.test(jobId) || !/^[0-9a-f]{64}$/.test(inputHash) || !/^[0-9a-f]{64}$/.test(subjectHash)) return [];
    if (kind !== "vlm_analysis" && kind !== "lens_pdf_render" && kind !== "audit_pdf_render") return [];
    return [{
      jobId,
      kind,
      inputHash,
      subjectHash,
      attemptCount: Number(row.attempt_count ?? 1),
      leaseToken: args.leaseToken,
      sealedPayload,
      costUnits: normalizedKindCost(kind, row.cost_units),
      sealedPayloadBytes: estimatedSealedPayloadBytes(sealedPayload, row.sealed_payload_bytes),
    }];
  });
}

async function defaultHeartbeat(args: { jobIds: string[]; leaseToken: string; leaseSeconds: number }) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_worker_heartbeat_owned",
    args: { p_job_ids: args.jobIds, p_lease_token: args.leaseToken, p_lease_seconds: args.leaseSeconds },
  });
  return parseRpcRows(data)
    .map((row) => String(row.job_id ?? ""))
    .filter((jobId) => /^dcj_[0-9a-f]{48}$/.test(jobId));
}

async function defaultReleaseClaims(args: { jobIds: string[]; leaseToken: string; reasonCode: string }) {
  const { data } = await runRegisteredServiceRoleRpc({
    operation: "durable_computation_worker_release_claims_budget",
    args: { p_job_ids: args.jobIds, p_lease_token: args.leaseToken, p_reason_code: args.reasonCode },
  });
  return parseRpcRows(data)
    .map((row) => String(row.job_id ?? ""))
    .filter((jobId) => /^dcj_[0-9a-f]{48}$/.test(jobId));
}

function normalizeOwnedJobIds(value: string[] | number, requestedJobIds: readonly string[]) {
  const requested = new Set(requestedJobIds);
  if (typeof value === "number") return value === requestedJobIds.length ? [...requested] : [];
  const owned = new Set<string>();
  for (const jobId of value) if (requested.has(jobId)) owned.add(jobId);
  return [...owned];
}

function deduplicateClaimedJobs(jobs: readonly WorkerJob[]) {
  const unique: WorkerJob[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const job of jobs) {
    if (seen.has(job.jobId)) { duplicates += 1; continue; }
    seen.add(job.jobId);
    unique.push(job);
  }
  return { unique, duplicates };
}

function planBudgetedClaims(jobs: readonly WorkerJob[], limits: WorkerBudgetLimits) {
  const accepted: WorkerJob[] = [];
  const rejected: WorkerJob[] = [];
  const subjectCosts = new Map<string, number>();
  let totalCostUnits = 0;
  let totalPayloadBytes = 0;
  for (const job of jobs) {
    const costUnits = normalizedKindCost(job.kind, job.costUnits);
    const sealedPayloadBytes = estimatedSealedPayloadBytes(job.sealedPayload, job.sealedPayloadBytes);
    const subjectCost = subjectCosts.get(job.subjectHash) ?? 0;
    const exceeds = totalCostUnits + costUnits > limits.globalCostLimit
      || subjectCost + costUnits > limits.perSubjectCostLimit
      || totalPayloadBytes + sealedPayloadBytes > limits.maxClaimedPayloadBytes;
    const normalized = { ...job, costUnits, sealedPayloadBytes };
    if (exceeds) {
      rejected.push(normalized);
      continue;
    }
    accepted.push(normalized);
    totalCostUnits += costUnits;
    totalPayloadBytes += sealedPayloadBytes;
    subjectCosts.set(job.subjectHash, subjectCost + costUnits);
  }
  return { accepted, rejected, totalCostUnits, totalPayloadBytes };
}

const defaultDependencies: WorkerDependencies = {
  claimBatch: defaultClaimBatch,
  heartbeat: defaultHeartbeat,
  releaseClaims: defaultReleaseClaims,
  complete: completeDurableComputationLease,
  fail: failDurableComputationLease,
  execute: executeRegisteredDurableComputation,
};

function boundedError(error: unknown) {
  return String(error instanceof Error ? error.message : error ?? "durable_worker_failed")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .slice(0, 120) || "durable_worker_failed";
}

async function mapBounded<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

async function executeJob(
  job: WorkerJob,
  dependencies: WorkerDependencies,
  env: Record<string, string | undefined>,
  stillOwnsLease: () => boolean,
) {
  try {
    if (!stillOwnsLease()) return "lost_ownership" as const;
    const opened = openDurableComputationPayload<unknown>({
      jobId: job.jobId,
      kind: job.kind,
      inputHash: job.inputHash,
      subjectHash: job.subjectHash,
      sealedPayload: job.sealedPayload,
      env,
    });
    const execution = await dependencies.execute(job.kind, opened);
    if (!stillOwnsLease()) return "lost_ownership" as const;
    const result = execution.encoding === "binary"
      ? encodeDurableBinaryResult(execution.value, execution.maxResultBytes)
      : encodeDurableJsonResult(execution.value, execution.maxResultBytes);
    if (!stillOwnsLease()) return "lost_ownership" as const;
    const completed = await dependencies.complete({ jobId: job.jobId, leaseToken: job.leaseToken, result, env });
    return completed ? "completed" as const : "conflict" as const;
  } catch (error) {
    if (!stillOwnsLease()) return "lost_ownership" as const;
    const state = await dependencies.fail({
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      errorCode: boundedError(error),
      retryAfterSeconds: Math.min(300, 5 * 2 ** Math.max(0, job.attemptCount - 1)),
      env,
    });
    return state === "dead_letter" ? "dead_letter" as const : state === "retry_wait" ? "retry_wait" as const : "store_failed" as const;
  }
}

export function buildDurableComputationWorkerReadiness(env: Record<string, string | undefined> = process.env) {
  const keyring = getDurablePayloadKeyringReadiness(env);
  return {
    schemaVersion: "velmere.durable-computation-worker-readiness.v2" as const,
    durableStoreConfigured: hasSupabaseServiceRoleConfig(),
    keyring,
    workerCapableKinds: [...DURABLE_WORKER_CAPABLE_KINDS],
    requestBoundKinds: [] as DurableComputationKind[],
    executable: hasSupabaseServiceRoleConfig() && keyring.configured && keyring.valid,
    costUnits: DURABLE_COMPUTATION_KIND_COST_UNITS,
    truth: "All three durable kinds are executable only with Supabase service-role configuration and a valid AES-256-GCM payload keyring. Worker admission is bounded by count, per-subject count, cost units and encrypted payload bytes.",
  };
}

export async function runDurableComputationWorkerDrain(input: {
  limit?: number;
  concurrency?: number;
  leaseSeconds?: number;
  heartbeatIntervalMs?: number;
  perSubjectLimit?: number;
  globalCostLimit?: number;
  perSubjectCostLimit?: number;
  maxClaimedPayloadBytes?: number;
  workerId?: string;
  env?: Record<string, string | undefined>;
  dependencies?: WorkerDependencies;
}) {
  const env = input.env ?? process.env;
  const dependencies = input.dependencies ?? defaultDependencies;
  if (dependencies === defaultDependencies && !hasSupabaseServiceRoleConfig()) throw new Error("durable_computation_store_required");
  const keyring = getDurablePayloadKeyringReadiness(env);
  if (!keyring.configured || !keyring.valid) throw new Error("durable_payload_keyring_required");
  const limit = clamp(input.limit, 8, 1, 25);
  const concurrency = clamp(input.concurrency, 2, 1, 4);
  const leaseSeconds = clamp(input.leaseSeconds, 180, 30, 600);
  const heartbeatIntervalMs = clamp(input.heartbeatIntervalMs, Math.max(10_000, Math.floor(leaseSeconds * 1000 / 3)), 100, 200_000);
  const perSubjectLimit = clamp(input.perSubjectLimit, 2, 1, 4);
  const globalCostLimit = clamp(input.globalCostLimit, 48, 1, 128);
  const perSubjectCostLimit = clamp(input.perSubjectCostLimit, 16, 1, 32);
  const maxClaimedPayloadBytes = clamp(input.maxClaimedPayloadBytes, 4 * 1024 * 1024, 64 * 1024, 8 * 1024 * 1024);
  const workerId = (input.workerId ?? env.VERCEL_REGION ?? env.HOSTNAME ?? "velmere-worker").slice(0, 120);
  const workerIdHash = sha256Hex(`velmere:durable-worker:${workerId}`);
  const leaseToken = randomBytes(24).toString("base64url");
  const claimedJobs = await dependencies.claimBatch({
    workerIdHash,
    leaseToken,
    leaseSeconds,
    limit,
    perSubjectLimit,
    globalCostLimit,
    perSubjectCostLimit,
    maxClaimedPayloadBytes,
    kinds: [...DURABLE_WORKER_CAPABLE_KINDS],
  });
  const emptySummary = {
    schemaVersion: "velmere.durable-computation-worker-drain.v2" as const,
    claimed: 0,
    admitted: 0,
    owned: 0,
    completed: 0,
    retryWait: 0,
    deadLetter: 0,
    conflicts: 0,
    duplicateClaims: 0,
    budgetRejected: 0,
    releasedClaims: 0,
    releaseFailures: 0,
    lostBeforeExecution: 0,
    lostDuringExecution: 0,
    storeFailed: 0,
    heartbeatFailures: 0,
    admittedCostUnits: 0,
    admittedPayloadBytes: 0,
    globalCostLimit,
    perSubjectCostLimit,
    maxClaimedPayloadBytes,
    perSubjectLimit,
    keyId: keyring.activeKeyId,
  };
  if (claimedJobs.length === 0) return emptySummary;

  const { unique: uniqueJobs, duplicates: duplicateClaims } = deduplicateClaimedJobs(claimedJobs);
  const budgetPlan = planBudgetedClaims(uniqueJobs, { globalCostLimit, perSubjectCostLimit, maxClaimedPayloadBytes });
  let releasedClaims = 0;
  let releaseFailures = 0;
  if (budgetPlan.rejected.length > 0) {
    if (!dependencies.releaseClaims) {
      releaseFailures = budgetPlan.rejected.length;
    } else {
      try {
        const released = normalizeOwnedJobIds(
          await dependencies.releaseClaims({
            jobIds: budgetPlan.rejected.map((job) => job.jobId),
            leaseToken,
            reasonCode: "worker_budget_overflow",
          }),
          budgetPlan.rejected.map((job) => job.jobId),
        );
        releasedClaims = released.length;
        releaseFailures = budgetPlan.rejected.length - released.length;
      } catch {
        releaseFailures = budgetPlan.rejected.length;
      }
    }
  }

  if (budgetPlan.accepted.length === 0) {
    return {
      ...emptySummary,
      claimed: claimedJobs.length,
      duplicateClaims,
      budgetRejected: budgetPlan.rejected.length,
      releasedClaims,
      releaseFailures,
      conflicts: duplicateClaims,
    };
  }

  const initialOwned = normalizeOwnedJobIds(
    await dependencies.heartbeat({ jobIds: budgetPlan.accepted.map((job) => job.jobId), leaseToken, leaseSeconds }),
    budgetPlan.accepted.map((job) => job.jobId),
  );
  const ownedSet = new Set(initialOwned);
  const jobs = budgetPlan.accepted.filter((job) => ownedSet.has(job.jobId));
  const lostBeforeExecution = budgetPlan.accepted.length - jobs.length;
  if (jobs.length === 0) {
    return {
      ...emptySummary,
      claimed: claimedJobs.length,
      admitted: budgetPlan.accepted.length,
      duplicateClaims,
      budgetRejected: budgetPlan.rejected.length,
      releasedClaims,
      releaseFailures,
      lostBeforeExecution,
      conflicts: duplicateClaims + lostBeforeExecution,
      admittedCostUnits: budgetPlan.totalCostUnits,
      admittedPayloadBytes: budgetPlan.totalPayloadBytes,
    };
  }

  let heartbeatFailures = 0;
  const activeJobIds = new Set(jobs.map((job) => job.jobId));
  const currentOwnership = new Set(jobs.map((job) => job.jobId));
  const timer = setInterval(() => {
    const requested = [...activeJobIds].filter((jobId) => currentOwnership.has(jobId));
    if (requested.length === 0) return;
    dependencies.heartbeat({ jobIds: requested, leaseToken, leaseSeconds })
      .then((value) => {
        const ownedNow = new Set(normalizeOwnedJobIds(value, requested));
        for (const jobId of requested) if (!ownedNow.has(jobId)) currentOwnership.delete(jobId);
      })
      .catch(() => {
        heartbeatFailures += 1;
        for (const jobId of requested) currentOwnership.delete(jobId);
      });
  }, heartbeatIntervalMs);
  (timer as unknown as { unref?: () => void }).unref?.();

  try {
    const results = await mapBounded(jobs, concurrency, async (job) => {
      const state = await executeJob(job, dependencies, env, () => currentOwnership.has(job.jobId));
      activeJobIds.delete(job.jobId);
      currentOwnership.delete(job.jobId);
      return state;
    });
    const summary = {
      completed: 0,
      retryWait: 0,
      deadLetter: 0,
      conflicts: duplicateClaims + lostBeforeExecution,
      lostDuringExecution: 0,
      storeFailed: 0,
    };
    for (const state of results) {
      if (state === "completed") summary.completed += 1;
      else if (state === "retry_wait") summary.retryWait += 1;
      else if (state === "dead_letter") summary.deadLetter += 1;
      else if (state === "conflict") summary.conflicts += 1;
      else if (state === "lost_ownership") summary.lostDuringExecution += 1;
      else summary.storeFailed += 1;
    }
    return {
      schemaVersion: "velmere.durable-computation-worker-drain.v2" as const,
      claimed: claimedJobs.length,
      admitted: budgetPlan.accepted.length,
      owned: jobs.length,
      duplicateClaims,
      budgetRejected: budgetPlan.rejected.length,
      releasedClaims,
      releaseFailures,
      lostBeforeExecution,
      ...summary,
      heartbeatFailures,
      admittedCostUnits: budgetPlan.totalCostUnits,
      admittedPayloadBytes: budgetPlan.totalPayloadBytes,
      globalCostLimit,
      perSubjectCostLimit,
      maxClaimedPayloadBytes,
      perSubjectLimit,
      keyId: keyring.activeKeyId,
      privacyBoundary: "Aggregate counts, bounded resource totals and active key ID only; no job, account, query, prompt, subject or result data is returned.",
    };
  } finally {
    clearInterval(timer);
  }
}
