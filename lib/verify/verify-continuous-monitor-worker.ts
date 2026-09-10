import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";
import {
  collectP82CurrentDeploymentReadonlyQuorumFromEnvironment,
  verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment,
  type P82CurrentDeploymentReadonlyQuorumReceipt,
} from "@/lib/security/audit-current-deployment-readonly-quorum-v2";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Hex } from "@/lib/security/cryptographic-digest";
import {
  AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS,
  AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS,
  currentDeploymentTimestampBlocker,
} from "@/lib/security/audit-current-deployment-freshness-policy";
import { deriveVerifyCanonicalDeploymentIdentityFromP82 } from "@/lib/verify/verify-canonical-deployment-identity";

const CLAIM_ROW_KEYS = [
  "attempt_count",
  "audited_deployment_digest",
  "chain_id",
  "contract_address",
  "current_status",
  "due_at",
  "expected_event_digest",
  "job_id",
  "lease_generation",
  "public_proof_id",
  "visibility",
] as const;
const SETTLE_RECEIPT_KEYS = [
  "currentStatus",
  "deadLettered",
  "eventDigest",
  "idempotent",
  "publicationVersion",
  "retryScheduled",
  "schemaVersion",
  "state",
] as const;
const HEALTH_KEYS = [
  "awaitingRevalidation",
  "deadLettered",
  "observedAt",
  "processingActive",
  "processingExpired",
  "queuedClaimable",
  "queuedDue",
  "queuedTotal",
  "schemaVersion",
  "total",
] as const;
const DIGEST = /^[a-f0-9]{64}$/;
const SHA256_DIGEST = /^sha256:([a-f0-9]{64})$/;
const ADDRESS = /^0x[a-f0-9]{40}$/;
const BLOCK_HASH = /^0x[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PUBLIC_PROOF_ID = /^pubidx-[a-f0-9]{48}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9_.-]{1,79}$/;
const ELIGIBLE_RIGHTS = new Set([
  "PUBLIC_DOMAIN",
  "OPEN_COMMERCIAL_ALLOWED",
  "PUBLIC_REUSE_ALLOWED",
  "DERIVED_USE_ONLY_ALLOWED",
  "ALLOWED_WITH_ATTRIBUTION",
]);
const FULL_P82_CLASSIFICATION = "PASS_EXACT_BLOCK_RUNTIME_PROXY_FORWARDER_QUORUM";
export const VERIFY_MONITOR_CADENCE_SECONDS = 86_400;
export const VERIFY_MONITOR_DOCUMENTED_JITTER_SECONDS = 3_540;
export const VERIFY_MONITOR_FRESHNESS_HORIZON_SECONDS =
  VERIFY_MONITOR_CADENCE_SECONDS + VERIFY_MONITOR_DOCUMENTED_JITTER_SECONDS;

export function nextVerifyMonitorDailyWindowEnd(observedAt: Date): Date {
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) throw new Error("verify_monitor_observed_at_invalid");
  const dayStart = Date.UTC(
    observedAt.getUTCFullYear(),
    observedAt.getUTCMonth(),
    observedAt.getUTCDate(),
  );
  const windowStart = dayStart + 3 * 60 * 60 * 1_000;
  const windowEnd = windowStart + VERIFY_MONITOR_DOCUMENTED_JITTER_SECONDS * 1_000;
  return new Date(observedMs < windowStart ? windowEnd : windowEnd + VERIFY_MONITOR_CADENCE_SECONDS * 1_000);
}

export function verifyMonitorTtlSeconds(observedAt: Date): number {
  const seconds = Math.ceil((nextVerifyMonitorDailyWindowEnd(observedAt).getTime() - observedAt.getTime()) / 1_000);
  if (seconds < 300 || seconds > VERIFY_MONITOR_FRESHNESS_HORIZON_SECONDS) {
    throw new Error("verify_monitor_window_ttl_invalid");
  }
  return seconds;
}

export function verifyMonitorClaimLookaheadSeconds(observedAt: Date): number {
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) throw new Error("verify_monitor_observed_at_invalid");
  const dayStart = Date.UTC(
    observedAt.getUTCFullYear(),
    observedAt.getUTCMonth(),
    observedAt.getUTCDate(),
  );
  const windowStart = dayStart + 3 * 60 * 60 * 1_000;
  const windowEnd = windowStart + VERIFY_MONITOR_DOCUMENTED_JITTER_SECONDS * 1_000;
  if (observedMs < windowStart || observedMs > windowEnd) return 0;
  return Math.ceil((windowEnd - observedMs) / 1_000);
}

type RpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

export type VerifyMonitorClaim = {
  jobId: string;
  publicProofId: string;
  chainId: string;
  contractAddress: string;
  expectedEventDigest: string;
  auditedDeploymentDigest: string;
  currentStatus: "VERIFIED" | "VERIFIED_AGAIN" | "MONITORING_UNAVAILABLE";
  visibility: "PUBLIC" | "PUBLIC_SUMMARY_PRIVATE_REPORT" | "PRIVATE";
  dueAt: string;
  attemptCount: number;
  leaseGeneration: string;
};

export type VerifyMonitorObservation =
  | {
      outcome: "UNCHANGED" | "CHANGED";
      observedDeploymentDigest: string;
      verificationReceiptDigest: string;
      checkedBlockNumber: string;
      checkedBlockHash: string;
      checkedAt: string;
      failureCode: null;
    }
  | {
      outcome: "FAILURE";
      observedDeploymentDigest: null;
      verificationReceiptDigest: string;
      checkedBlockNumber: null;
      checkedBlockHash: null;
      checkedAt: string;
      failureCode:
        | "configuration_unavailable"
        | "provider_unavailable"
        | "provider_timeout"
        | "receipt_invalid"
        | "observation_unavailable";
    };

export type VerifyMonitorHealth = {
  schemaVersion: "velmere.verify-monitor-health.v1";
  total: number;
  queuedTotal: number;
  queuedDue: number;
  queuedClaimable: number;
  processingActive: number;
  processingExpired: number;
  awaitingRevalidation: number;
  deadLettered: number;
  observedAt: string;
};

export type VerifyContinuousMonitorDependencies = {
  rpc: RpcRunner;
  observe: (claim: VerifyMonitorClaim) => Promise<VerifyMonitorObservation>;
  workerToken: () => string;
  now: () => Date;
};

type ObservationDependencies = {
  collect: typeof collectP82CurrentDeploymentReadonlyQuorumFromEnvironment;
  verify: typeof verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment;
  now: () => Date;
  env: NodeJS.ProcessEnv;
};

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(value).sort().join("|") === [...expected].sort().join("|");
}

function finiteDate(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function boundedCount(value: unknown, name: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1_000_000) {
    throw new Error(`verify_monitor_${name}_invalid`);
  }
  return Number(value);
}

function parseClaims(data: unknown): VerifyMonitorClaim[] {
  if (!Array.isArray(data)) throw new Error("verify_monitor_claim_telemetry_invalid");
  return data.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`verify_monitor_claim_row_invalid:${index}`);
    }
    const row = item as Record<string, unknown>;
    if (!exactKeys(row, CLAIM_ROW_KEYS)) throw new Error(`verify_monitor_claim_keys_invalid:${index}`);
    const jobId = String(row.job_id ?? "").toLowerCase();
    const publicProofId = String(row.public_proof_id ?? "").toLowerCase();
    const chainId = String(row.chain_id ?? "");
    const contractAddress = String(row.contract_address ?? "").toLowerCase();
    const expectedEventDigest = String(row.expected_event_digest ?? "").toLowerCase();
    const auditedDeploymentDigest = String(row.audited_deployment_digest ?? "").toLowerCase();
    const currentStatus = String(row.current_status ?? "");
    const visibility = String(row.visibility ?? "");
    const dueAt = finiteDate(row.due_at);
    const leaseGeneration = String(row.lease_generation ?? "");
    if (!UUID.test(jobId)) throw new Error(`verify_monitor_claim_job_invalid:${index}`);
    if (!PUBLIC_PROOF_ID.test(publicProofId)) throw new Error(`verify_monitor_claim_proof_invalid:${index}`);
    if (!/^[1-9][0-9]{0,19}$/.test(chainId)) throw new Error(`verify_monitor_claim_chain_invalid:${index}`);
    if (!ADDRESS.test(contractAddress)) throw new Error(`verify_monitor_claim_address_invalid:${index}`);
    if (!DIGEST.test(expectedEventDigest) || !DIGEST.test(auditedDeploymentDigest)) {
      throw new Error(`verify_monitor_claim_digest_invalid:${index}`);
    }
    if (!["VERIFIED", "VERIFIED_AGAIN", "MONITORING_UNAVAILABLE"].includes(currentStatus)) {
      throw new Error(`verify_monitor_claim_status_invalid:${index}`);
    }
    if (!["PUBLIC", "PUBLIC_SUMMARY_PRIVATE_REPORT", "PRIVATE"].includes(visibility)) {
      throw new Error(`verify_monitor_claim_visibility_invalid:${index}`);
    }
    if (!dueAt) throw new Error(`verify_monitor_claim_due_invalid:${index}`);
    if (!/^[1-9][0-9]{0,18}$/.test(leaseGeneration)) {
      throw new Error(`verify_monitor_claim_generation_invalid:${index}`);
    }
    return {
      jobId,
      publicProofId,
      chainId,
      contractAddress,
      expectedEventDigest,
      auditedDeploymentDigest,
      currentStatus: currentStatus as VerifyMonitorClaim["currentStatus"],
      visibility: visibility as VerifyMonitorClaim["visibility"],
      dueAt,
      attemptCount: boundedCount(row.attempt_count, `attempt_invalid:${index}`),
      leaseGeneration,
    };
  });
}

function validateClaimBatch(
  claims: VerifyMonitorClaim[],
  input: {
    limit: number;
    startedAt: Date;
    claimLookaheadSeconds: number;
  },
) {
  if (claims.length > input.limit) throw new Error("verify_monitor_claim_count_exceeds_limit");
  const jobIds = new Set<string>();
  const proofIds = new Set<string>();
  const latestEligibleDueAt = input.startedAt.getTime() + input.claimLookaheadSeconds * 1_000 + 5_000;
  for (const [index, claim] of claims.entries()) {
    if (claim.attemptCount < 1) throw new Error(`verify_monitor_claim_attempt_invalid:${index}`);
    if (jobIds.has(claim.jobId)) throw new Error(`verify_monitor_claim_job_duplicate:${index}`);
    if (proofIds.has(claim.publicProofId)) throw new Error(`verify_monitor_claim_proof_duplicate:${index}`);
    jobIds.add(claim.jobId);
    proofIds.add(claim.publicProofId);
    if (Date.parse(claim.dueAt) > latestEligibleDueAt) {
      throw new Error(`verify_monitor_claim_due_outside_window:${index}`);
    }
  }
}

function parseSettleReceipt(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("verify_monitor_settle_receipt_invalid");
  }
  const row = data as Record<string, unknown>;
  if (!exactKeys(row, SETTLE_RECEIPT_KEYS)) throw new Error("verify_monitor_settle_keys_invalid");
  if (row.schemaVersion !== "velmere.verify-monitor-settle-receipt.v1") {
    throw new Error("verify_monitor_settle_schema_invalid");
  }
  if (!["MONITORED_UNCHANGED", "REVALIDATION_REQUIRED", "MONITORING_UNAVAILABLE"].includes(String(row.state))) {
    throw new Error("verify_monitor_settle_state_invalid");
  }
  if (!["VERIFIED", "VERIFIED_AGAIN", "REVALIDATION_REQUIRED", "MONITORING_UNAVAILABLE"].includes(String(row.currentStatus))) {
    throw new Error("verify_monitor_settle_status_invalid");
  }
  if (!DIGEST.test(String(row.eventDigest ?? ""))) throw new Error("verify_monitor_settle_digest_invalid");
  if (!/^[1-9][0-9]{0,18}$/.test(String(row.publicationVersion ?? ""))) {
    throw new Error("verify_monitor_settle_version_invalid");
  }
  if (typeof row.idempotent !== "boolean" || typeof row.retryScheduled !== "boolean" || typeof row.deadLettered !== "boolean") {
    throw new Error("verify_monitor_settle_flags_invalid");
  }
  const state = row.state as "MONITORED_UNCHANGED" | "REVALIDATION_REQUIRED" | "MONITORING_UNAVAILABLE";
  const currentStatus = String(row.currentStatus);
  const retryScheduled = row.retryScheduled as boolean;
  const deadLettered = row.deadLettered as boolean;
  if (state === "MONITORED_UNCHANGED") {
    if (!["VERIFIED", "VERIFIED_AGAIN"].includes(currentStatus) || retryScheduled || deadLettered) {
      throw new Error("verify_monitor_settle_monitored_semantics_invalid");
    }
  } else if (state === "REVALIDATION_REQUIRED") {
    if (currentStatus !== "REVALIDATION_REQUIRED" || retryScheduled || deadLettered) {
      throw new Error("verify_monitor_settle_revalidation_semantics_invalid");
    }
  } else if (
    currentStatus !== "MONITORING_UNAVAILABLE"
    || retryScheduled === deadLettered
  ) {
    throw new Error("verify_monitor_settle_unavailable_semantics_invalid");
  }
  return {
    state,
    retryScheduled,
    deadLettered,
  };
}

function parseHealth(data: unknown): VerifyMonitorHealth {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("verify_monitor_health_invalid");
  }
  const row = data as Record<string, unknown>;
  if (!exactKeys(row, HEALTH_KEYS) || row.schemaVersion !== "velmere.verify-monitor-health.v1") {
    throw new Error("verify_monitor_health_schema_invalid");
  }
  const observedAt = finiteDate(row.observedAt);
  if (!observedAt) throw new Error("verify_monitor_health_time_invalid");
  const health: VerifyMonitorHealth = {
    schemaVersion: "velmere.verify-monitor-health.v1",
    total: boundedCount(row.total, "health_total"),
    queuedTotal: boundedCount(row.queuedTotal, "health_queued_total"),
    queuedDue: boundedCount(row.queuedDue, "health_queued_due"),
    queuedClaimable: boundedCount(row.queuedClaimable, "health_queued_claimable"),
    processingActive: boundedCount(row.processingActive, "health_processing_active"),
    processingExpired: boundedCount(row.processingExpired, "health_processing_expired"),
    awaitingRevalidation: boundedCount(row.awaitingRevalidation, "health_awaiting_revalidation"),
    deadLettered: boundedCount(row.deadLettered, "health_dead_lettered"),
    observedAt,
  };
  if (
    health.queuedDue > health.queuedClaimable
    || health.queuedClaimable > health.queuedTotal
    || health.queuedTotal
      + health.processingActive
      + health.processingExpired
      + health.awaitingRevalidation
      + health.deadLettered !== health.total
  ) {
    throw new Error("verify_monitor_health_invariants_invalid");
  }
  return health;
}

function rawReceiptDigest(receipt: P82CurrentDeploymentReadonlyQuorumReceipt): string | null {
  const match = SHA256_DIGEST.exec(receipt.receiptDigest.toLowerCase());
  return match?.[1] ?? null;
}

function failureObservation(
  claim: VerifyMonitorClaim,
  failureCode: Extract<VerifyMonitorObservation, { outcome: "FAILURE" }>["failureCode"],
  now: Date,
  receiptDigest?: string | null,
): VerifyMonitorObservation {
  const checkedAt = now.toISOString();
  return {
    outcome: "FAILURE",
    observedDeploymentDigest: null,
    verificationReceiptDigest: receiptDigest && DIGEST.test(receiptDigest)
      ? receiptDigest
      : sha256Hex(canonicalJson({
          schemaVersion: "velmere.verify-monitor-failure-receipt.v1",
          chainId: claim.chainId,
          contractAddress: claim.contractAddress,
          expectedEventDigest: claim.expectedEventDigest,
          failureCode,
          checkedAt,
        })),
    checkedBlockNumber: null,
    checkedBlockHash: null,
    checkedAt,
    failureCode,
  };
}

function validateObservation(value: unknown): VerifyMonitorObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("verify_monitor_observation_invalid");
  }
  const row = value as Record<string, unknown>;
  if (!exactKeys(row, [
    "checkedAt",
    "checkedBlockHash",
    "checkedBlockNumber",
    "failureCode",
    "observedDeploymentDigest",
    "outcome",
    "verificationReceiptDigest",
  ])) throw new Error("verify_monitor_observation_keys_invalid");
  const checkedAt = finiteDate(row.checkedAt);
  if (!checkedAt || !DIGEST.test(String(row.verificationReceiptDigest ?? ""))) {
    throw new Error("verify_monitor_observation_receipt_invalid");
  }
  if (row.outcome === "FAILURE") {
    if (
      row.observedDeploymentDigest !== null
      || row.checkedBlockNumber !== null
      || row.checkedBlockHash !== null
      || ![
        "configuration_unavailable",
        "provider_unavailable",
        "provider_timeout",
        "receipt_invalid",
        "observation_unavailable",
      ].includes(String(row.failureCode))
    ) throw new Error("verify_monitor_failure_observation_invalid");
    return {
      outcome: "FAILURE",
      observedDeploymentDigest: null,
      verificationReceiptDigest: String(row.verificationReceiptDigest),
      checkedBlockNumber: null,
      checkedBlockHash: null,
      checkedAt,
      failureCode: row.failureCode as Extract<VerifyMonitorObservation, { outcome: "FAILURE" }>["failureCode"],
    };
  }
  if (
    !["UNCHANGED", "CHANGED"].includes(String(row.outcome))
    || !DIGEST.test(String(row.observedDeploymentDigest ?? ""))
    || !/^(0|[1-9][0-9]{0,77})$/.test(String(row.checkedBlockNumber ?? ""))
    || !BLOCK_HASH.test(String(row.checkedBlockHash ?? ""))
    || row.failureCode !== null
  ) throw new Error("verify_monitor_success_observation_invalid");
  return {
    outcome: row.outcome as "UNCHANGED" | "CHANGED",
    observedDeploymentDigest: String(row.observedDeploymentDigest),
    verificationReceiptDigest: String(row.verificationReceiptDigest),
    checkedBlockNumber: String(row.checkedBlockNumber),
    checkedBlockHash: String(row.checkedBlockHash),
    checkedAt,
    failureCode: null,
  };
}

function verifyEnvironmentPreflight(
  claim: VerifyMonitorClaim,
  env: NodeJS.ProcessEnv,
  now: Date,
) {
  if (claim.chainId !== "56" || !ADDRESS.test(claim.contractAddress)) return false;
  if (env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_ENABLED !== "true") return false;
  const keyId = String(env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_KEY_ID_CURRENT ?? "").trim();
  const secret = String(env.VELMERE_CURRENT_DEPLOYMENT_QUORUM_SECRET_CURRENT ?? "");
  if (!SAFE_ID.test(keyId) || secret.length < 32) return false;
  const raw = String(env.VELMERE_BSC_CURRENT_RPC_QUORUM_CONFIG_JSON ?? "");
  if (!raw || raw.length > 32_768) return false;
  let providers: unknown;
  try {
    providers = JSON.parse(raw);
  } catch {
    return false;
  }
  const minimum = Number(env.VELMERE_BSC_CURRENT_RPC_MINIMUM_PROVIDERS ?? "3");
  if (!Number.isInteger(minimum) || minimum < 3 || minimum > 7 || !Array.isArray(providers) || providers.length < minimum || providers.length > 7) {
    return false;
  }
  const ids: string[] = [];
  const operators: string[] = [];
  const families: string[] = [];
  const correlations: string[] = [];
  for (const item of providers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const provider = item as Record<string, unknown>;
    const providerId = String(provider.providerId ?? "");
    const operatorId = String(provider.operatorId ?? "");
    const family = String(provider.providerFamily ?? "");
    const correlation = String(provider.correlationGroup ?? "");
    if (![providerId, operatorId, family, correlation].every((value) => SAFE_ID.test(value))) return false;
    let endpoint: URL;
    try {
      endpoint = new URL(String(provider.rpcUrl ?? ""));
    } catch {
      return false;
    }
    const hostname = endpoint.hostname.toLowerCase();
    const pathSegments = endpoint.pathname.split("/").filter(Boolean);
    if (
      endpoint.protocol !== "https:"
      || endpoint.username
      || endpoint.password
      || endpoint.search
      || endpoint.hash
      || (endpoint.port && endpoint.port !== "443")
      || isIP(hostname) !== 0
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || /\.(?:invalid|test|example)$/u.test(hostname)
      || endpoint.pathname.length > 160
      || pathSegments.some((part) => part.length > 96 || /^(?:[a-f0-9]{32,}|[a-z0-9_-]{48,})$/iu.test(part))
    ) return false;
    const rights = provider.rights;
    if (!rights || typeof rights !== "object" || Array.isArray(rights)) return false;
    const rightsRow = rights as Record<string, unknown>;
    const checkedAt = finiteDate(rightsRow.termsCheckedAt);
    const reverifyBy = finiteDate(rightsRow.reverifyBy);
    if (
      !ELIGIBLE_RIGHTS.has(String(rightsRow.status ?? ""))
      || !SHA256_DIGEST.test(String(rightsRow.evidenceSha256 ?? "").toLowerCase())
      || !checkedAt
      || !reverifyBy
      || Date.parse(checkedAt) > now.getTime()
      || Date.parse(reverifyBy) < now.getTime()
      || rightsRow.derivedUseAllowed !== true
      || rightsRow.displayAllowed !== true
      || typeof rightsRow.attributionRequired !== "boolean"
    ) return false;
    ids.push(providerId);
    operators.push(operatorId);
    families.push(family);
    correlations.push(correlation);
  }
  return new Set(ids).size === providers.length
    && new Set(operators).size >= minimum
    && new Set(families).size >= minimum
    && new Set(correlations).size >= minimum;
}

export async function observeVerifyDeployment(
  claim: VerifyMonitorClaim,
  dependencies: Partial<ObservationDependencies> = {},
): Promise<VerifyMonitorObservation> {
  const now = dependencies.now ?? (() => new Date());
  const observedAt = now();
  const env = dependencies.env ?? process.env;
  if (!verifyEnvironmentPreflight(claim, env, observedAt)) {
    return failureObservation(claim, "configuration_unavailable", observedAt);
  }
  const collect = dependencies.collect ?? collectP82CurrentDeploymentReadonlyQuorumFromEnvironment;
  const verify = dependencies.verify ?? verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment;
  const receipt = await collect({
    chain: claim.chainId,
    contractAddress: claim.contractAddress,
    timeoutMs: 3_500,
    maxResponseBytes: 256 * 1024,
  });
  if (!receipt) return failureObservation(claim, "provider_unavailable", now());
  const receiptDigest = rawReceiptDigest(receipt);
  if (!receiptDigest || !verify(receipt)) {
    return failureObservation(claim, "receipt_invalid", now(), receiptDigest);
  }
  if (
    receipt.target.chainId !== claim.chainId
    || receipt.target.address !== claim.contractAddress
    || receipt.executionClass !== "PUBLIC_READONLY_CURRENT"
    || receipt.transportClass !== "DEFAULT_NETWORK_STACK"
  ) {
    return failureObservation(claim, "receipt_invalid", now(), receiptDigest);
  }
  const fullProof = receipt.classification === FULL_P82_CLASSIFICATION
    && receipt.proof.exactBlockConsensusProven
    && receipt.proof.currentRuntimeStateProven
    && receipt.proof.currentProxyImplementationProven
    && receipt.proof.currentTrustedForwarderStateProven
    && receipt.customerCurrentRuntimeFactEligible
    && receipt.rights.customerFactRightsEligible;
  if (!fullProof || receipt.snapshot.blockNumber === null || !receipt.snapshot.blockHash) {
    const timedOut = receipt.blockers.some((code) => code.includes("timeout"));
    return failureObservation(claim, timedOut ? "provider_timeout" : "provider_unavailable", now(), receiptDigest);
  }
  const checkedAt = finiteDate(receipt.generatedAt);
  const checkedBlockHash = receipt.snapshot.blockHash.toLowerCase();
  const checkedAtMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!checkedAt
    || checkedAtMs > observedAt.getTime() + AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS
    || observedAt.getTime() - checkedAtMs > AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS
    || currentDeploymentTimestampBlocker(receipt.snapshot.timestamp, observedAt) !== null
    || !BLOCK_HASH.test(checkedBlockHash)
    || !Number.isSafeInteger(receipt.snapshot.blockNumber)
    || receipt.snapshot.blockNumber < 0) {
    return failureObservation(claim, "receipt_invalid", now(), receiptDigest);
  }
  const canonicalDeployment = deriveVerifyCanonicalDeploymentIdentityFromP82(receipt);
  if (!canonicalDeployment) {
    return failureObservation(claim, "receipt_invalid", now(), receiptDigest);
  }
  const observedDeploymentDigest = canonicalDeployment.digest;
  const unchanged = observedDeploymentDigest === claim.auditedDeploymentDigest;
  return {
    outcome: unchanged ? "UNCHANGED" : "CHANGED",
    observedDeploymentDigest,
    verificationReceiptDigest: receiptDigest,
    checkedBlockNumber: String(receipt.snapshot.blockNumber),
    checkedBlockHash,
    checkedAt,
    failureCode: null,
  };
}

const defaultDependencies: VerifyContinuousMonitorDependencies = {
  rpc: runRegisteredServiceRoleRpc,
  observe: (claim) => observeVerifyDeployment(claim),
  workerToken: randomUUID,
  now: () => new Date(),
};

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function getVerifyContinuousMonitorRuntimePolicy(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
) {
  return {
    batchLimit: clampInteger(env.VELMERE_VERIFY_MONITOR_BATCH_LIMIT, 5, 1, 5),
    concurrency: clampInteger(env.VELMERE_VERIFY_MONITOR_CONCURRENCY, 2, 1, 2),
    leaseSeconds: 180,
    claimLookaheadSeconds: verifyMonitorClaimLookaheadSeconds(now),
    deadlineMs: 25_000,
  } as const;
}

function rpcConflict(error: unknown) {
  const providerCode = String((error as { providerCode?: unknown })?.providerCode ?? "");
  return ["40001", "42501", "23505", "23514"].includes(providerCode);
}

export async function runVerifyContinuousMonitorWorker(
  input: {
    limit?: number;
    concurrency?: number;
    leaseSeconds?: number;
    claimLookaheadSeconds?: number;
    deadlineMs?: number;
  } = {},
  dependencies: VerifyContinuousMonitorDependencies = defaultDependencies,
) {
  const limit = clampInteger(input.limit, 1, 1, 5);
  const concurrency = clampInteger(input.concurrency, 1, 1, 2);
  const leaseSeconds = clampInteger(input.leaseSeconds, 180, 30, 300);
  const startedAt = dependencies.now();
  const windowLookaheadSeconds = verifyMonitorClaimLookaheadSeconds(startedAt);
  const claimLookaheadSeconds = clampInteger(
    input.claimLookaheadSeconds,
    windowLookaheadSeconds,
    0,
    windowLookaheadSeconds,
  );
  const deadlineMs = clampInteger(input.deadlineMs, 25_000, 5_000, 25_000);
  const workerToken = dependencies.workerToken();
  if (!/^[A-Za-z0-9._:@-]{16,160}$/.test(workerToken)) throw new Error("verify_monitor_worker_token_invalid");
  const deadlineAt = startedAt.getTime() + deadlineMs;
  const claimed = await dependencies.rpc({
    operation: "verify_monitor_job_claim",
    args: {
      p_worker_token: workerToken,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
      p_lookahead_seconds: claimLookaheadSeconds,
    },
  });
  const claims = parseClaims(claimed.data);
  validateClaimBatch(claims, { limit, startedAt, claimLookaheadSeconds });
  const summary = {
    schemaVersion: "velmere.verify-continuous-monitor-worker.v1" as const,
    claimed: claims.length,
    monitored: 0,
    revalidationRequired: 0,
    unavailable: 0,
    retried: 0,
    deadLettered: 0,
    conflicts: 0,
    storeFailed: 0,
    configurationUnavailable: 0,
    providerUnavailable: 0,
    providerTimeout: 0,
    receiptInvalid: 0,
    batchDeadlineReached: false,
  };

  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, claims.length) }, async () => {
    while (cursor < claims.length) {
      const index = cursor;
      cursor += 1;
      const claim = claims[index];
      const remaining = deadlineAt - dependencies.now().getTime();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let observation: VerifyMonitorObservation;
      if (remaining <= 0) {
        summary.batchDeadlineReached = true;
        observation = failureObservation(claim, "observation_unavailable", dependencies.now());
      } else {
        try {
          observation = validateObservation(await Promise.race([
            dependencies.observe(claim),
            new Promise<VerifyMonitorObservation>((resolve) => {
              timer = setTimeout(() => {
                summary.batchDeadlineReached = true;
                resolve(failureObservation(claim, "provider_timeout", dependencies.now()));
              }, remaining);
            }),
          ]));
        } catch {
          observation = failureObservation(claim, "observation_unavailable", dependencies.now());
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      if (observation.outcome === "FAILURE") {
        summary.unavailable += 1;
        if (observation.failureCode === "configuration_unavailable") summary.configurationUnavailable += 1;
        else if (observation.failureCode === "provider_unavailable") summary.providerUnavailable += 1;
        else if (observation.failureCode === "provider_timeout") summary.providerTimeout += 1;
        else if (observation.failureCode === "receipt_invalid") summary.receiptInvalid += 1;
      }
      try {
        const settled = await dependencies.rpc({
          operation: "verify_monitor_job_settle",
          args: {
            p_job_id: claim.jobId,
            p_worker_token: workerToken,
            p_expected_event_digest: claim.expectedEventDigest,
            p_observation_outcome: observation.outcome,
            p_observed_deployment_digest: observation.observedDeploymentDigest,
            p_verification_receipt_digest: observation.verificationReceiptDigest,
            p_checked_block_number: observation.checkedBlockNumber,
            p_checked_block_hash: observation.checkedBlockHash,
            p_checked_at: observation.checkedAt,
            p_monitoring_ttl_seconds: observation.outcome === "FAILURE"
              ? null
              : verifyMonitorTtlSeconds(new Date(observation.checkedAt)),
            p_failure_code: observation.failureCode,
          },
        });
        const receipt = parseSettleReceipt(settled.data);
        if (receipt.state === "MONITORED_UNCHANGED") summary.monitored += 1;
        else if (receipt.state === "REVALIDATION_REQUIRED") summary.revalidationRequired += 1;
        if (receipt.retryScheduled) summary.retried += 1;
        if (receipt.deadLettered) summary.deadLettered += 1;
      } catch (error) {
        if (rpcConflict(error)) summary.conflicts += 1;
        else summary.storeFailed += 1;
      }
    }
  });
  await Promise.all(runners);

  let health: VerifyMonitorHealth | null = null;
  try {
    const result = await dependencies.rpc({ operation: "verify_monitor_health" });
    health = parseHealth(result.data);
  } catch {
    summary.storeFailed += 1;
  }
  return {
    ...summary,
    health,
    schedulerTiming: {
      codeCadenceSeconds: VERIFY_MONITOR_CADENCE_SECONDS,
      documentedDeliveryJitterSeconds: VERIFY_MONITOR_DOCUMENTED_JITTER_SECONDS,
      claimLookaheadSeconds,
      maximumFreshnessHorizonSeconds: VERIFY_MONITOR_FRESHNESS_HORIZON_SECONDS,
      nextWindowBound: true,
      schedulerRetriesAssumed: false,
      preciseFreshnessGuaranteed: false,
      truthSource: "observed_append_only_event_monitor_due_at",
    },
    privacyBoundary:
      "Aggregate counters only; no proof, contract, account, lease, provider, endpoint or failure-detail identifiers are returned.",
  };
}
