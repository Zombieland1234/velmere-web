import { createHash } from "node:crypto";
import { getDurablePayloadKeyringReadiness } from "@/lib/jobs/durable-computation-payload";
import { DURABLE_WORKER_CAPABLE_KINDS } from "@/lib/jobs/durable-computation-executor-registry";
import { DURABLE_COMPUTATION_OPERATION_REGISTRY } from "@/lib/jobs/durable-computation-operations";

export const DURABLE_COMPUTATION_DEPLOYMENT_ID = "velmere-durable-computation-deployment-v1" as const;

type EnvLike = Record<string, string | undefined>;

export type DurableComputationRuntimePolicy = {
  limit: number;
  concurrency: number;
  leaseSeconds: number;
  heartbeatIntervalMs: number;
  perSubjectLimit: number;
  globalCostLimit: number;
  perSubjectCostLimit: number;
  maxClaimedPayloadBytes: number;
  completedRetentionDays: number;
  deadLetterRetentionDays: number;
  cleanupLimit: number;
  maintenanceLeaseSeconds: number;
  circuitExpiredLeaseCount: number;
  circuitOldestLeaseAgeSeconds: number;
  circuitHeartbeatFailureCount: number;
};

export type DurableDeploymentCheck = {
  id: string;
  area: "store" | "cron" | "keyring" | "worker" | "budget" | "runtime";
  ok: boolean;
  requiredForStaging: boolean;
  requiredForProduction: boolean;
  label: string;
};

function value(env: EnvLike, name: string) {
  return String(env[name] ?? "").trim();
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function usableSecret(secret: string, minimum = 32) {
  if (secret.length < minimum) return false;
  return !/(placeholder|example|changeme|replace[-_ ]?me|dummy|never[-_ ]?production)/i.test(secret);
}

function usableHttpsUrl(url: string) {
  if (!/^https:\/\//i.test(url)) return false;
  return !/(localhost|127\.0\.0\.1|example\.)/i.test(url);
}

function fingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function getDurableComputationRuntimePolicy(env: EnvLike = process.env): DurableComputationRuntimePolicy {
  const leaseSeconds = clamp(value(env, "VELMERE_DURABLE_WORKER_LEASE_SECONDS"), 180, 30, 600);
  return {
    limit: clamp(value(env, "VELMERE_DURABLE_WORKER_LIMIT"), 8, 1, 25),
    concurrency: clamp(value(env, "VELMERE_DURABLE_WORKER_CONCURRENCY"), 2, 1, 4),
    leaseSeconds,
    heartbeatIntervalMs: clamp(
      value(env, "VELMERE_DURABLE_WORKER_HEARTBEAT_MS"),
      Math.max(10_000, Math.floor((leaseSeconds * 1000) / 3)),
      100,
      200_000,
    ),
    perSubjectLimit: clamp(value(env, "VELMERE_DURABLE_WORKER_PER_SUBJECT_LIMIT"), 2, 1, 4),
    globalCostLimit: clamp(value(env, "VELMERE_DURABLE_WORKER_GLOBAL_COST_LIMIT"), 48, 1, 128),
    perSubjectCostLimit: clamp(value(env, "VELMERE_DURABLE_WORKER_SUBJECT_COST_LIMIT"), 16, 1, 32),
    maxClaimedPayloadBytes: clamp(value(env, "VELMERE_DURABLE_WORKER_MAX_PAYLOAD_BYTES"), 4 * 1024 * 1024, 64 * 1024, 8 * 1024 * 1024),
    completedRetentionDays: clamp(value(env, "VELMERE_DURABLE_COMPLETED_RETENTION_DAYS"), 30, 1, 365),
    deadLetterRetentionDays: clamp(value(env, "VELMERE_DURABLE_DEAD_LETTER_RETENTION_DAYS"), 90, 7, 730),
    cleanupLimit: clamp(value(env, "VELMERE_DURABLE_CLEANUP_LIMIT"), 500, 1, 5_000),
    maintenanceLeaseSeconds: clamp(value(env, "VELMERE_DURABLE_MAINTENANCE_LEASE_SECONDS"), 60, 15, 300),
    circuitExpiredLeaseCount: clamp(value(env, "VELMERE_DURABLE_CIRCUIT_EXPIRED_LEASES"), 25, 1, 100_000),
    circuitOldestLeaseAgeSeconds: clamp(value(env, "VELMERE_DURABLE_CIRCUIT_OLDEST_LEASE_SECONDS"), 900, 60, 86_400),
    circuitHeartbeatFailureCount: clamp(value(env, "VELMERE_DURABLE_CIRCUIT_HEARTBEAT_FAILURES"), 3, 1, 100),
  };
}

export function buildDurableComputationDeploymentContract(env: EnvLike = process.env) {
  const url = value(env, "SUPABASE_URL") || value(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = value(env, "SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = value(env, "MARKET_INTEGRITY_CRON_SECRET") || value(env, "CRON_SECRET");
  const keyring = getDurablePayloadKeyringReadiness(env);
  const policy = getDurableComputationRuntimePolicy(env);
  const registryEntries = Object.entries(DURABLE_COMPUTATION_OPERATION_REGISTRY);
  const capable = new Set(DURABLE_WORKER_CAPABLE_KINDS);
  const registryConsistent = registryEntries.every(([kind, entry]) => capable.has(kind as never) && entry.workerCapable && entry.payloadPersistence === "sealed_payload");
  const checks: DurableDeploymentCheck[] = [
    { id: "supabase_https_url", area: "store", ok: usableHttpsUrl(url), requiredForStaging: true, requiredForProduction: true, label: "Supabase project URL is HTTPS and non-placeholder" },
    { id: "supabase_service_role", area: "store", ok: usableSecret(serviceRole), requiredForStaging: true, requiredForProduction: true, label: "Supabase service-role secret is configured" },
    { id: "cron_secret", area: "cron", ok: usableSecret(cronSecret), requiredForStaging: true, requiredForProduction: true, label: "internal worker cron secret is configured" },
    { id: "payload_keyring", area: "keyring", ok: keyring.configured && keyring.valid, requiredForStaging: true, requiredForProduction: true, label: "AES-256-GCM payload keyring is valid" },
    { id: "all_worker_kinds_registered", area: "worker", ok: registryConsistent && capable.size === 3, requiredForStaging: true, requiredForProduction: true, label: "VLM, Lens PDF and Audit PDF are consistently registered as sealed worker kinds" },
    { id: "bounded_concurrency", area: "budget", ok: policy.concurrency >= 1 && policy.concurrency <= 4, requiredForStaging: true, requiredForProduction: true, label: "worker concurrency is bounded" },
    { id: "subject_budget_not_above_global", area: "budget", ok: policy.perSubjectCostLimit <= policy.globalCostLimit, requiredForStaging: true, requiredForProduction: true, label: "per-subject compute budget does not exceed global batch budget" },
    { id: "heartbeat_before_lease_expiry", area: "runtime", ok: policy.heartbeatIntervalMs < policy.leaseSeconds * 1000, requiredForStaging: true, requiredForProduction: true, label: "heartbeat cadence is below lease duration" },
    { id: "payload_budget_bounded", area: "budget", ok: policy.maxClaimedPayloadBytes <= 8 * 1024 * 1024, requiredForStaging: true, requiredForProduction: true, label: "claimed encrypted payload bytes are bounded" },
  ];
  const blockers = {
    staging: checks.filter((item) => item.requiredForStaging && !item.ok).map((item) => `${item.area}:${item.id}`),
    production: checks.filter((item) => item.requiredForProduction && !item.ok).map((item) => `${item.area}:${item.id}`),
  };
  const publicPolicy = {
    ...policy,
    keyId: keyring.activeKeyId,
    workerKinds: [...DURABLE_WORKER_CAPABLE_KINDS],
  };
  return {
    schemaVersion: "velmere.durable-computation-deployment-contract.v1" as const,
    deploymentId: DURABLE_COMPUTATION_DEPLOYMENT_ID,
    productionLike: env.NODE_ENV === "production" || env.VERCEL_ENV === "production",
    stagingConfigured: blockers.staging.length === 0,
    productionConfigured: blockers.production.length === 0,
    stagingProven: false,
    productionLiveProven: false,
    checks,
    blockers,
    policy: publicPolicy,
    deploymentFingerprint: fingerprint(publicPolicy),
    secretValuesDisclosed: false as const,
    truth: "Configured means static environment and policy checks passed. It does not claim migrations, PostgreSQL race behavior, KMS custody, staging execution or production uptime.",
  };
}
