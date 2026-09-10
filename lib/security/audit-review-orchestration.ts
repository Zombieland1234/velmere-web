import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { createHash, randomUUID } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { appendMemoryAuditCaseHistoryEvent } from "@/lib/security/audit-case-customer-history";
import type { AuditIntakeCaseRecord } from "@/lib/security/audit-intake-case-vault";

export const PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID = "pass4616-audit-review-assignment-sla-worker-lease" as const;
export const PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY =
  "Current Pro and Advanced are automated analysis modes. Historical Advanced reviewer assignment may be retained only as optional internal QA metadata; it is never a customer requirement, entitlement condition, release prerequisite or human-review claim. No reviewer or worker identity is returned to the customer." as const;

export type AuditReviewProcessingMode = "basic_prescreen" | "pro_automation" | "advanced_automation";
export type AuditReviewState = "queued" | "assigned" | "leased" | "retry_wait" | "dead_letter" | "completed" | "revoked";
export type AuditSlaState = "not_applicable" | "waiting_assignment" | "on_track" | "due_soon" | "breached" | "completed" | "revoked";

export type AuditReviewCustomerProjection = {
  passId: typeof PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID;
  available: boolean;
  processingMode: AuditReviewProcessingMode;
  state: AuditReviewState;
  humanReviewerAssigned: boolean;
  automationLeaseActive: boolean;
  attemptCount: number;
  maxAttempts: number;
  sla: {
    state: AuditSlaState;
    dueAt: string | null;
    assignedAt: string | null;
    completedAt: string | null;
  };
  boundary: typeof PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY;
  error?: "review_orchestration_unavailable";
};

type MemoryReviewRecord = {
  caseRef: string;
  tier: "basic" | "pro" | "advanced";
  state: AuditReviewState;
  reviewerPrincipalHash?: string;
  assignmentRequestHash?: string;
  assignedAt?: string;
  slaDueAt?: string;
  workerPrincipalHash?: string;
  leaseTokenHash?: string;
  leaseExpiresAt?: string;
  claimRequestHash?: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  deadLetterReason?: string;
  completedAt?: string;
  updatedAt: string;
};

export type AuditReviewMutationResult = {
  ok: boolean;
  idempotent?: boolean;
  staleLease?: boolean;
  caseRef?: string;
  state?: AuditReviewState;
  leaseExpiresAt?: string | null;
  retryAt?: string | null;
  attemptCount?: number;
  error?:
    | "invalid_request"
    | "case_not_eligible"
    | "review_already_assigned"
    | "lease_unavailable"
    | "lease_mismatch"
    | "review_orchestration_unavailable";
};

const memoryReviews = new Map<string, MemoryReviewRecord>();
const MAX_RETRY_ATTEMPTS = 3;

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function cleanCaseRef(value: string) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return /^AUD-[A-Z0-9]{8,16}$/.test(clean) ? clean : "";
}

function cleanPrincipal(value: string) {
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function cleanRequestId(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96);
  return clean || `review_${randomUUID()}`;
}

export function normalizeBasicAuditWorkerLeaseToken(value: unknown) {
  if (typeof value !== "string" || value !== value.trim() || !/^[A-Za-z0-9_-]{43}$/.test(value)) return "";
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.byteLength !== 32 || bytes.toString("base64url") !== value || new Set(bytes).size < 16) return "";
    return value;
  } catch {
    return "";
  }
}

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasDurableConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function eligibleAdvanced(record: AuditIntakeCaseRecord) {
  return record.tier === "advanced" && record.status === "queued_paid_review" && record.entitlementVerified && !record.analysisStarted;
}

function eligiblePro(record: AuditIntakeCaseRecord) {
  return record.tier === "pro" && record.status === "queued_paid_review" && record.entitlementVerified && !record.analysisStarted;
}

function eligibleBasic(record: AuditIntakeCaseRecord) {
  return record.tier === "basic"
    && record.status === "queued_basic_prescreen"
    && record.target.kind === "contract"
    && record.target.chainId === "56"
    && record.target.chainName === "BSC"
    && Boolean(record.accountId)
    && !record.entitlementRequired
    && !record.entitlementVerified
    && !record.entitlementId
    && !record.analysisStarted;
}

function processingMode(tier: AuditIntakeCaseRecord["tier"]): AuditReviewProcessingMode {
  return tier === "advanced" ? "advanced_automation" : tier === "pro" ? "pro_automation" : "basic_prescreen";
}

function defaultProjection(record: AuditIntakeCaseRecord): AuditReviewCustomerProjection {
  const revoked = record.status === "access_revoked" || record.status === "payment_blocked";
  return {
    passId: PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID,
    available: true,
    processingMode: processingMode(record.tier),
    state: revoked ? "revoked" : "queued",
    humanReviewerAssigned: false,
    automationLeaseActive: false,
    attemptCount: 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    sla: {
      state: revoked ? "revoked" : "not_applicable",
      dueAt: null,
      assignedAt: null,
      completedAt: null,
    },
    boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY,
  };
}

function memoryProjection(record: AuditIntakeCaseRecord): AuditReviewCustomerProjection {
  const current = memoryReviews.get(record.caseRef);
  if (!current) return defaultProjection(record);
  const revoked = record.status === "access_revoked" || record.status === "payment_blocked";
  const normalizedState: AuditReviewState = record.tier === "advanced" && current.state === "assigned" ? "queued" : current.state;
  const state: AuditReviewState = revoked ? "revoked" : normalizedState;
  const leaseActive = Boolean(current.leaseExpiresAt && new Date(current.leaseExpiresAt).getTime() > Date.now() && state === "leased");
  return {
    passId: PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID,
    available: true,
    processingMode: processingMode(record.tier),
    state,
    humanReviewerAssigned: false,
    automationLeaseActive: leaseActive,
    attemptCount: current.attemptCount,
    maxAttempts: current.maxAttempts,
    sla: {
      state: state === "revoked" ? "revoked" : state === "completed" ? "completed" : "not_applicable",
      dueAt: null,
      assignedAt: null,
      completedAt: current.completedAt ?? null,
    },
    boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY,
  };
}
function rowToProjection(record: AuditIntakeCaseRecord, row: Record<string, unknown> | null): AuditReviewCustomerProjection {
  if (!row) return defaultProjection(record);
  const rawState: AuditReviewState = row.review_state === "assigned" || row.review_state === "leased" || row.review_state === "retry_wait" || row.review_state === "dead_letter" || row.review_state === "completed" || row.review_state === "revoked" ? row.review_state : "queued";
  const normalizedState: AuditReviewState = record.tier === "advanced" && rawState === "assigned" ? "queued" : rawState;
  const state: AuditReviewState = record.status === "access_revoked" || record.status === "payment_blocked" ? "revoked" : normalizedState;
  const completedAt = row.completed_at ? String(row.completed_at) : null;
  const leaseExpiresAt = row.lease_expires_at ? new Date(String(row.lease_expires_at)).getTime() : 0;
  return {
    passId: PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID,
    available: true,
    processingMode: processingMode(record.tier),
    state,
    humanReviewerAssigned: false,
    automationLeaseActive: state === "leased" && Number.isFinite(leaseExpiresAt) && leaseExpiresAt > Date.now(),
    attemptCount: Math.max(0, Number(row.attempt_count ?? 0)),
    maxAttempts: Math.max(1, Number(row.max_attempts ?? MAX_RETRY_ATTEMPTS)),
    sla: {
      state: state === "revoked" ? "revoked" : state === "completed" ? "completed" : "not_applicable",
      dueAt: null,
      assignedAt: null,
      completedAt,
    },
    boundary: PASS4616_AUDIT_REVIEW_ORCHESTRATION_BOUNDARY,
  };
}
export async function getAuditReviewCustomerProjection(record: AuditIntakeCaseRecord): Promise<AuditReviewCustomerProjection> {
  if (!record.durable) return memoryProjection(record);
  if (!hasDurableConfig()) return { ...defaultProjection(record), available: false, error: "review_orchestration_unavailable" };
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("supabase_service_role_client_unavailable");
    const { data, error } = await supabase
      .from("velmere_audit_review_orchestration")
      .select("review_state,reviewer_principal_hash,assigned_at,sla_due_at,lease_expires_at,attempt_count,max_attempts,completed_at,updated_at")
      .eq("case_ref", record.caseRef)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return rowToProjection(record, data as Record<string, unknown> | null);
  } catch {
    return { ...defaultProjection(record), available: false, error: "review_orchestration_unavailable" };
  }
}

export async function assignAdvancedAuditReviewer(args: {
  record: AuditIntakeCaseRecord;
  reviewerPrincipal: string;
  assignmentRequestId: string;
  slaMinutes?: number;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleAdvanced(args.record)) return { ok: false, error: "case_not_eligible" };
  const reviewer = cleanPrincipal(args.reviewerPrincipal);
  const requestId = cleanRequestId(args.assignmentRequestId);
  const slaMinutes = Math.max(30, Math.min(72 * 60, Math.floor(args.slaMinutes ?? 24 * 60)));
  if (!reviewer || !requestId) return { ok: false, error: "invalid_request" };

  if (args.record.durable && hasDurableConfig()) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_advanced_reviewer_assign",
        args: {
          p_case_ref: args.record.caseRef,
          p_reviewer_principal: reviewer,
          p_assignment_request_id: requestId,
          p_sla_minutes: slaMinutes,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string; state?: AuditReviewState };
      if (!rpc.ok) return { ok: false, error: rpc.error === "review_already_assigned" ? "review_already_assigned" : "case_not_eligible" };
      return { ok: true, idempotent: rpc.idempotent === true, caseRef: args.record.caseRef, state: rpc.state ?? "assigned" };
    } catch {
      if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const now = new Date();
  const current = memoryReviews.get(args.record.caseRef);
  const requestHash = sha256(requestId);
  const reviewerHash = sha256(reviewer);
  if (current?.assignmentRequestHash === requestHash || current?.reviewerPrincipalHash === reviewerHash) return { ok: true, idempotent: true, caseRef: args.record.caseRef, state: current.state };
  if (current?.state === "completed" || current?.state === "revoked") return { ok: false, error: "case_not_eligible" };
  if (current?.reviewerPrincipalHash && current.reviewerPrincipalHash !== reviewerHash) return { ok: false, error: "review_already_assigned" };
  const updated: MemoryReviewRecord = {
    ...(current ?? {
      caseRef: args.record.caseRef,
      tier: "advanced" as const,
      state: "queued" as const,
      attemptCount: 0,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      updatedAt: now.toISOString(),
    }),
    reviewerPrincipalHash: reviewerHash,
    assignmentRequestHash: requestHash,
    assignedAt: current?.assignedAt ?? now.toISOString(),
    slaDueAt: current?.slaDueAt ?? new Date(now.getTime() + slaMinutes * 60_000).toISOString(),
    updatedAt: now.toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  return { ok: true, caseRef: args.record.caseRef, state: updated.state };
}

export async function claimBasicAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  claimRequestId: string;
  leaseToken: string;
  leaseSeconds?: number;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleBasic(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const claimId = /^[a-zA-Z0-9:_-]{8,96}$/.test(args.claimRequestId.trim()) ? args.claimRequestId.trim() : "";
  const leaseToken = normalizeBasicAuditWorkerLeaseToken(args.leaseToken);
  const leaseSeconds = args.leaseSeconds ?? 5 * 60;
  if (!worker || !claimId || !leaseToken || !Number.isInteger(leaseSeconds) || leaseSeconds < 60 || leaseSeconds > 900) {
    return { ok: false, error: "invalid_request" };
  }

  if (args.record.durable) {
    if (!hasDurableConfig()) return { ok: false, error: "review_orchestration_unavailable" };
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_basic_worker_lease_claim",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_claim_request_id: claimId,
          p_lease_token: leaseToken,
          p_lease_seconds: leaseSeconds,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string; leaseExpiresAt?: string; retryAt?: string; state?: AuditReviewState; attemptCount?: number; staleLease?: boolean };
      if (!rpc.ok) return {
        ok: false,
        error: rpc.error === "lease_unavailable" ? "lease_unavailable" : "case_not_eligible",
        state: rpc.state,
        retryAt: rpc.retryAt ?? null,
        attemptCount: Number(rpc.attemptCount ?? 0),
        staleLease: rpc.staleLease === true,
      };
      return { ok: true, idempotent: rpc.idempotent === true, caseRef: args.record.caseRef, state: rpc.state ?? "leased", leaseExpiresAt: rpc.leaseExpiresAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const now = Date.now();
  const current = memoryReviews.get(args.record.caseRef);
  const claimHash = sha256(claimId);
  const tokenHash = sha256(leaseToken);
  if (current?.claimRequestHash === claimHash && current.leaseTokenHash === tokenHash
    && current.state === "leased" && current.leaseExpiresAt && new Date(current.leaseExpiresAt).getTime() > now) {
    return { ok: true, idempotent: true, caseRef: args.record.caseRef, state: current.state, leaseExpiresAt: current.leaseExpiresAt ?? null, attemptCount: current.attemptCount };
  }
  if (current?.tier !== undefined && current.tier !== "basic") return { ok: false, error: "case_not_eligible" };
  if (current?.state === "dead_letter" || current?.state === "completed" || current?.state === "revoked") return { ok: false, error: "case_not_eligible" };
  if (current?.state === "leased" && current.leaseExpiresAt && new Date(current.leaseExpiresAt).getTime() > now) {
    return { ok: false, error: "lease_unavailable", leaseExpiresAt: current.leaseExpiresAt };
  }
  if (current?.state === "leased") {
    const attemptCount = current.attemptCount + 1;
    const state: AuditReviewState = attemptCount >= current.maxAttempts ? "dead_letter" : "retry_wait";
    const retryAt = state === "retry_wait"
      ? new Date(now + Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1)) * 60_000).toISOString()
      : undefined;
    const expired: MemoryReviewRecord = {
      ...current,
      state,
      workerPrincipalHash: undefined,
      leaseTokenHash: undefined,
      claimRequestHash: undefined,
      leaseExpiresAt: undefined,
      attemptCount,
      nextAttemptAt: retryAt,
      deadLetterReason: state === "dead_letter" ? "lease_expired" : undefined,
      updatedAt: new Date(now).toISOString(),
    };
    memoryReviews.set(args.record.caseRef, expired);
    appendMemoryAuditCaseHistoryEvent(args.record, state === "dead_letter" ? "review_dead_lettered" : "review_requeued", {
      occurredAt: expired.updatedAt,
      reason: state === "dead_letter" ? "retry_exhausted" : "automation_retry",
    });
    return {
      ok: false,
      error: state === "dead_letter" ? "case_not_eligible" : "lease_unavailable",
      state,
      retryAt: retryAt ?? null,
      attemptCount,
      staleLease: true,
    };
  }
  if (current?.nextAttemptAt && new Date(current.nextAttemptAt).getTime() > now) return { ok: false, error: "lease_unavailable" };
  const leaseExpiresAt = new Date(now + leaseSeconds * 1000).toISOString();
  const updated: MemoryReviewRecord = {
    caseRef: args.record.caseRef,
    tier: "basic",
    state: "leased",
    workerPrincipalHash: sha256(worker),
    leaseTokenHash: tokenHash,
    claimRequestHash: claimHash,
    leaseExpiresAt,
    attemptCount: current?.attemptCount ?? 0,
    maxAttempts: current?.maxAttempts ?? MAX_RETRY_ATTEMPTS,
    updatedAt: new Date(now).toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, "automation_claimed", { occurredAt: updated.updatedAt });
  return { ok: true, caseRef: args.record.caseRef, state: "leased", leaseExpiresAt, attemptCount: updated.attemptCount };
}

export async function preflightBasicAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  leaseToken: string;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleBasic(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const leaseToken = normalizeBasicAuditWorkerLeaseToken(args.leaseToken);
  if (!worker || !leaseToken) return { ok: false, error: "invalid_request" };

  if (args.record.durable) {
    if (!hasDurableConfig()) return { ok: false, error: "review_orchestration_unavailable" };
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_basic_worker_lease_preflight",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_lease_token: leaseToken,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; error?: string; leaseExpiresAt?: string; attemptCount?: number; staleLease?: boolean };
      if (!rpc.ok) {
        return {
          ok: false,
          staleLease: rpc.staleLease === true,
          error: rpc.error === "case_not_eligible" ? "case_not_eligible" : "lease_mismatch",
        };
      }
      return {
        ok: true,
        caseRef: args.record.caseRef,
        state: "leased",
        leaseExpiresAt: rpc.leaseExpiresAt ?? null,
        attemptCount: Number(rpc.attemptCount ?? 0),
      };
    } catch {
      return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const current = memoryReviews.get(args.record.caseRef);
  if (!current || current.tier !== "basic" || current.state !== "leased"
    || current.workerPrincipalHash !== sha256(worker) || current.leaseTokenHash !== sha256(leaseToken)) {
    return { ok: false, error: "lease_mismatch" };
  }
  if (!current.leaseExpiresAt || new Date(current.leaseExpiresAt).getTime() <= Date.now()) {
    return { ok: false, staleLease: true, error: "lease_mismatch" };
  }
  return {
    ok: true,
    caseRef: args.record.caseRef,
    state: "leased",
    leaseExpiresAt: current.leaseExpiresAt,
    attemptCount: current.attemptCount,
  };
}

export async function executeAfterBasicAuditWorkerLeasePreflight<T>(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  leaseToken: string;
  execute: () => Promise<T>;
}) {
  const preflight = await preflightBasicAuditWorkerLease(args);
  if (!preflight.ok) return { ok: false as const, preflight };
  return { ok: true as const, preflight, value: await args.execute() };
}

export async function settleBasicAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  leaseToken: string;
  outcome: "complete" | "retry" | "dead_letter";
  reasonCode?: string;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleBasic(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const leaseToken = normalizeBasicAuditWorkerLeaseToken(args.leaseToken);
  const reason = cleanPrincipal(args.reasonCode ?? "worker_result").slice(0, 80);
  if (!worker || !leaseToken) return { ok: false, error: "invalid_request" };

  if (args.record.durable) {
    if (!hasDurableConfig()) return { ok: false, error: "review_orchestration_unavailable" };
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_basic_worker_lease_settle",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_lease_token: leaseToken,
          p_outcome: args.outcome,
          p_reason_code: reason,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; error?: string; state?: AuditReviewState; retryAt?: string; attemptCount?: number; staleLease?: boolean };
      if (!rpc.ok) return { ok: false, staleLease: rpc.staleLease === true, error: rpc.error === "lease_mismatch" ? "lease_mismatch" : "case_not_eligible" };
      return { ok: true, caseRef: args.record.caseRef, state: rpc.state, retryAt: rpc.retryAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const current = memoryReviews.get(args.record.caseRef);
  if (!current || current.tier !== "basic" || current.state !== "leased"
    || current.workerPrincipalHash !== sha256(worker) || current.leaseTokenHash !== sha256(leaseToken)) {
    return { ok: false, error: "lease_mismatch" };
  }
  if (!current.leaseExpiresAt || new Date(current.leaseExpiresAt).getTime() <= Date.now()) return { ok: false, staleLease: true, error: "lease_mismatch" };
  const now = new Date();
  let state: AuditReviewState;
  let retryAt: string | undefined;
  let attemptCount = current.attemptCount;
  if (args.outcome === "complete") {
    state = "completed";
  } else {
    attemptCount += 1;
    state = args.outcome === "dead_letter" || attemptCount >= current.maxAttempts ? "dead_letter" : "retry_wait";
    if (state === "retry_wait") retryAt = new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1)) * 60_000).toISOString();
  }
  const updated: MemoryReviewRecord = {
    ...current,
    state,
    leaseTokenHash: undefined,
    workerPrincipalHash: undefined,
    leaseExpiresAt: undefined,
    claimRequestHash: undefined,
    attemptCount,
    nextAttemptAt: retryAt,
    deadLetterReason: state === "dead_letter" ? reason : undefined,
    completedAt: state === "completed" ? now.toISOString() : undefined,
    updatedAt: now.toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, state === "completed" ? "automation_completed" : state === "dead_letter" ? "review_dead_lettered" : "review_requeued", { occurredAt: updated.updatedAt, reason: state === "dead_letter" ? "retry_exhausted" : "automation_retry" });
  return { ok: true, caseRef: args.record.caseRef, state, retryAt: retryAt ?? null, attemptCount };
}

export async function claimProAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  claimRequestId: string;
  leaseToken: string;
  leaseSeconds?: number;
}): Promise<AuditReviewMutationResult> {
  if (!eligiblePro(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const claimId = cleanRequestId(args.claimRequestId);
  const leaseToken = cleanPrincipal(args.leaseToken);
  const leaseSeconds = Math.max(60, Math.min(30 * 60, Math.floor(args.leaseSeconds ?? 5 * 60)));
  if (!worker || !claimId || leaseToken.length < 24) return { ok: false, error: "invalid_request" };

  if (args.record.durable && hasDurableConfig()) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_pro_worker_lease_claim",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_claim_request_id: claimId,
          p_lease_token: leaseToken,
          p_lease_seconds: leaseSeconds,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string; leaseExpiresAt?: string; state?: AuditReviewState; attemptCount?: number };
      if (!rpc.ok) return { ok: false, error: rpc.error === "lease_unavailable" ? "lease_unavailable" : "case_not_eligible" };
      return { ok: true, idempotent: rpc.idempotent === true, caseRef: args.record.caseRef, state: rpc.state ?? "leased", leaseExpiresAt: rpc.leaseExpiresAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const now = Date.now();
  const current = memoryReviews.get(args.record.caseRef);
  const claimHash = sha256(claimId);
  const tokenHash = sha256(leaseToken);
  if (current?.claimRequestHash === claimHash && current.leaseTokenHash === tokenHash) {
    return { ok: true, idempotent: true, caseRef: args.record.caseRef, state: current.state, leaseExpiresAt: current.leaseExpiresAt ?? null, attemptCount: current.attemptCount };
  }
  if (current?.state === "leased" && current.leaseExpiresAt && new Date(current.leaseExpiresAt).getTime() > now) return { ok: false, error: "lease_unavailable" };
  if (current?.state === "dead_letter" || current?.state === "completed") return { ok: false, error: "case_not_eligible" };
  if (current?.nextAttemptAt && new Date(current.nextAttemptAt).getTime() > now) return { ok: false, error: "lease_unavailable" };
  const leaseExpiresAt = new Date(now + leaseSeconds * 1000).toISOString();
  const updated: MemoryReviewRecord = {
    caseRef: args.record.caseRef,
    tier: "pro",
    state: "leased",
    workerPrincipalHash: sha256(worker),
    leaseTokenHash: tokenHash,
    claimRequestHash: claimHash,
    leaseExpiresAt,
    attemptCount: current?.attemptCount ?? 0,
    maxAttempts: current?.maxAttempts ?? MAX_RETRY_ATTEMPTS,
    updatedAt: new Date(now).toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, "automation_claimed", { occurredAt: updated.updatedAt, reason: "pro_worker_lease" });
  return { ok: true, caseRef: args.record.caseRef, state: "leased", leaseExpiresAt, attemptCount: updated.attemptCount };
}

export async function settleProAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  leaseToken: string;
  outcome: "complete" | "retry" | "dead_letter";
  reasonCode?: string;
}): Promise<AuditReviewMutationResult> {
  if (!eligiblePro(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const leaseToken = cleanPrincipal(args.leaseToken);
  const reason = cleanPrincipal(args.reasonCode ?? "worker_result").slice(0, 80);
  if (!worker || leaseToken.length < 24) return { ok: false, error: "invalid_request" };

  if (args.record.durable && hasDurableConfig()) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_pro_worker_lease_settle",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_lease_token: leaseToken,
          p_outcome: args.outcome,
          p_reason_code: reason,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; error?: string; state?: AuditReviewState; retryAt?: string; attemptCount?: number; staleLease?: boolean };
      if (!rpc.ok) return { ok: false, staleLease: rpc.staleLease === true, error: rpc.error === "lease_mismatch" ? "lease_mismatch" : "case_not_eligible" };
      return { ok: true, caseRef: args.record.caseRef, state: rpc.state, retryAt: rpc.retryAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const current = memoryReviews.get(args.record.caseRef);
  if (!current || current.state !== "leased" || current.workerPrincipalHash !== sha256(worker) || current.leaseTokenHash !== sha256(leaseToken)) return { ok: false, error: "lease_mismatch" };
  if (!current.leaseExpiresAt || new Date(current.leaseExpiresAt).getTime() < Date.now()) return { ok: false, staleLease: true, error: "lease_mismatch" };
  const now = new Date();
  let state: AuditReviewState;
  let retryAt: string | undefined;
  let attemptCount = current.attemptCount;
  if (args.outcome === "complete") {
    state = "completed";
  } else {
    attemptCount += 1;
    state = args.outcome === "dead_letter" || attemptCount >= current.maxAttempts ? "dead_letter" : "retry_wait";
    if (state === "retry_wait") retryAt = new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1)) * 60_000).toISOString();
  }
  const updated: MemoryReviewRecord = {
    ...current,
    state,
    leaseTokenHash: undefined,
    workerPrincipalHash: undefined,
    leaseExpiresAt: undefined,
    claimRequestHash: undefined,
    attemptCount,
    nextAttemptAt: retryAt,
    deadLetterReason: state === "dead_letter" ? reason : undefined,
    completedAt: state === "completed" ? now.toISOString() : undefined,
    updatedAt: now.toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, state === "completed" ? "automation_completed" : state === "dead_letter" ? "review_dead_lettered" : "review_requeued", { occurredAt: updated.updatedAt, reason: state === "dead_letter" ? "retry_exhausted" : "automation_retry" });
  return { ok: true, caseRef: args.record.caseRef, state, retryAt: retryAt ?? null, attemptCount };
}

export async function claimAdvancedAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  claimRequestId: string;
  leaseToken: string;
  leaseSeconds?: number;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleAdvanced(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const claimId = cleanRequestId(args.claimRequestId);
  const leaseToken = cleanPrincipal(args.leaseToken);
  const leaseSeconds = Math.max(60, Math.min(30 * 60, Math.floor(args.leaseSeconds ?? 5 * 60)));
  if (!worker || !claimId || leaseToken.length < 24) return { ok: false, error: "invalid_request" };

  if (args.record.durable && hasDurableConfig()) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_advanced_worker_lease_claim",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_claim_request_id: claimId,
          p_lease_token: leaseToken,
          p_lease_seconds: leaseSeconds,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string; leaseExpiresAt?: string; state?: AuditReviewState; attemptCount?: number };
      if (!rpc.ok) return { ok: false, error: rpc.error === "lease_unavailable" ? "lease_unavailable" : "case_not_eligible" };
      return { ok: true, idempotent: rpc.idempotent === true, caseRef: args.record.caseRef, state: rpc.state ?? "leased", leaseExpiresAt: rpc.leaseExpiresAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const now = Date.now();
  const current = memoryReviews.get(args.record.caseRef);
  const claimHash = sha256(claimId);
  const tokenHash = sha256(leaseToken);
  if (current?.claimRequestHash === claimHash && current.leaseTokenHash === tokenHash) {
    return { ok: true, idempotent: true, caseRef: args.record.caseRef, state: current.state, leaseExpiresAt: current.leaseExpiresAt ?? null, attemptCount: current.attemptCount };
  }
  if (current?.state === "leased" && current.leaseExpiresAt && new Date(current.leaseExpiresAt).getTime() > now) return { ok: false, error: "lease_unavailable" };
  if (current?.state === "dead_letter" || current?.state === "completed") return { ok: false, error: "case_not_eligible" };
  if (current?.nextAttemptAt && new Date(current.nextAttemptAt).getTime() > now) return { ok: false, error: "lease_unavailable" };
  const leaseExpiresAt = new Date(now + leaseSeconds * 1000).toISOString();
  const updated: MemoryReviewRecord = {
    caseRef: args.record.caseRef,
    tier: "advanced",
    state: "leased",
    workerPrincipalHash: sha256(worker),
    leaseTokenHash: tokenHash,
    claimRequestHash: claimHash,
    leaseExpiresAt,
    attemptCount: current?.attemptCount ?? 0,
    maxAttempts: current?.maxAttempts ?? MAX_RETRY_ATTEMPTS,
    updatedAt: new Date(now).toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, "automation_claimed", { occurredAt: updated.updatedAt, reason: "advanced_worker_lease" });
  return { ok: true, caseRef: args.record.caseRef, state: "leased", leaseExpiresAt, attemptCount: updated.attemptCount };
}

export async function settleAdvancedAuditWorkerLease(args: {
  record: AuditIntakeCaseRecord;
  workerPrincipal: string;
  leaseToken: string;
  outcome: "complete" | "retry" | "dead_letter";
  reasonCode?: string;
}): Promise<AuditReviewMutationResult> {
  if (!eligibleAdvanced(args.record)) return { ok: false, error: "case_not_eligible" };
  const worker = cleanPrincipal(args.workerPrincipal);
  const leaseToken = cleanPrincipal(args.leaseToken);
  const reason = cleanPrincipal(args.reasonCode ?? "worker_result").slice(0, 80);
  if (!worker || leaseToken.length < 24) return { ok: false, error: "invalid_request" };

  if (args.record.durable && hasDurableConfig()) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_advanced_worker_lease_settle",
        args: {
          p_case_ref: args.record.caseRef,
          p_worker_principal: worker,
          p_lease_token: leaseToken,
          p_outcome: args.outcome,
          p_reason_code: reason,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; error?: string; state?: AuditReviewState; retryAt?: string; attemptCount?: number; staleLease?: boolean };
      if (!rpc.ok) return { ok: false, staleLease: rpc.staleLease === true, error: rpc.error === "lease_mismatch" ? "lease_mismatch" : "case_not_eligible" };
      return { ok: true, caseRef: args.record.caseRef, state: rpc.state, retryAt: rpc.retryAt ?? null, attemptCount: Number(rpc.attemptCount ?? 0) };
    } catch {
      if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };
    }
  }
  if (productionLike()) return { ok: false, error: "review_orchestration_unavailable" };

  const current = memoryReviews.get(args.record.caseRef);
  if (!current || current.state !== "leased" || current.workerPrincipalHash !== sha256(worker) || current.leaseTokenHash !== sha256(leaseToken)) return { ok: false, error: "lease_mismatch" };
  if (!current.leaseExpiresAt || new Date(current.leaseExpiresAt).getTime() < Date.now()) return { ok: false, staleLease: true, error: "lease_mismatch" };
  const now = new Date();
  let state: AuditReviewState;
  let retryAt: string | undefined;
  let attemptCount = current.attemptCount;
  if (args.outcome === "complete") {
    state = "completed";
  } else {
    attemptCount += 1;
    state = args.outcome === "dead_letter" || attemptCount >= current.maxAttempts ? "dead_letter" : "retry_wait";
    if (state === "retry_wait") retryAt = new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1)) * 60_000).toISOString();
  }
  const updated: MemoryReviewRecord = {
    ...current,
    state,
    leaseTokenHash: undefined,
    workerPrincipalHash: undefined,
    leaseExpiresAt: undefined,
    claimRequestHash: undefined,
    attemptCount,
    nextAttemptAt: retryAt,
    deadLetterReason: state === "dead_letter" ? reason : undefined,
    completedAt: state === "completed" ? now.toISOString() : undefined,
    updatedAt: now.toISOString(),
  };
  memoryReviews.set(args.record.caseRef, updated);
  appendMemoryAuditCaseHistoryEvent(args.record, state === "completed" ? "automation_completed" : state === "dead_letter" ? "review_dead_lettered" : "review_requeued", { occurredAt: updated.updatedAt, reason: state === "dead_letter" ? "retry_exhausted" : "automation_retry" });
  return { ok: true, caseRef: args.record.caseRef, state, retryAt: retryAt ?? null, attemptCount };
}

export function getMemoryAuditReviewOrchestration(caseRef: string) {
  return memoryReviews.get(cleanCaseRef(caseRef)) ?? null;
}
