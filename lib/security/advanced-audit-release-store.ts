import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type { AdvancedAuditReleaseEnvelope } from "@/lib/security/advanced-audit-release-envelope";

export const PASS4803_ADVANCED_AUDIT_RELEASE_STORE_ID = "pass4803-advanced-audit-release-durable-store-v1" as const;

export type AdvancedAuditReleaseStoreState = "pending" | "blocked" | "ready" | "expired" | "revoked";
export type AdvancedAuditReleaseStoreTransition = "issued" | "approved" | "revoked";

export type AdvancedAuditReleaseStoreReceipt = {
  ok: true;
  mode: "durable" | "memory";
  idempotent: boolean;
  releaseId: string;
  state: AdvancedAuditReleaseStoreState;
  stateVersion: number;
  eventHash: string;
  envelopeDigest: string;
  entitlementRefHash: string;
  releaseRecordsRevoked?: number;
  artifactTokensRevoked?: number;
} | {
  ok: false;
  mode: "durable" | "memory";
  error: string;
  retryable: boolean;
};

type MemoryRelease = {
  releaseId: string;
  caseRef: string;
  entitlementRef: string | null;
  entitlementRefHash: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  envelopeDigest: string;
  state: AdvancedAuditReleaseStoreState;
  stateVersion: number;
  expiresAt: string;
  eventHashes: Set<string>;
};

const memoryReleases = new Map<string, MemoryRelease>();

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function digestValue(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "");
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("advanced_release_store_digest_invalid");
  return normalized;
}

function stateForEnvelope(envelope: AdvancedAuditReleaseEnvelope): AdvancedAuditReleaseStoreState {
  if (envelope.state === "revoked") return "revoked";
  if (envelope.state === "expired") return "expired";
  if (envelope.state === "ready") return "ready";
  return "blocked";
}

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function parseDurableResult(data: unknown, fallback: {
  releaseId: string;
  eventHash: string;
  envelopeDigest: string;
  entitlementRefHash: string;
}): AdvancedAuditReleaseStoreReceipt {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return { ok: false, mode: "durable", error: "advanced_release_store_result_invalid", retryable: true };
  const value = row as Record<string, unknown>;
  if (value.ok === false) {
    return {
      ok: false,
      mode: "durable",
      error: clean(value.error, 160) || "advanced_release_store_rejected",
      retryable: Boolean(value.retryable),
    };
  }
  const state = clean(value.release_state, 32) as AdvancedAuditReleaseStoreState;
  if (!["pending", "blocked", "ready", "expired", "revoked"].includes(state)) {
    return { ok: false, mode: "durable", error: "advanced_release_store_state_invalid", retryable: true };
  }
  let eventHash: string;
  let envelopeDigest: string;
  let entitlementRefHash: string;
  try {
    eventHash = digestValue(clean(value.event_hash, 80) || fallback.eventHash);
    envelopeDigest = digestValue(clean(value.envelope_digest, 80) || fallback.envelopeDigest);
    entitlementRefHash = digestValue(clean(value.entitlement_ref_hash, 80) || fallback.entitlementRefHash);
  } catch {
    return { ok: false, mode: "durable", error: "advanced_release_store_digest_result_invalid", retryable: true };
  }
  const stateVersion = Number(value.state_version ?? 1);
  if (!Number.isSafeInteger(stateVersion) || stateVersion < 1) {
    return { ok: false, mode: "durable", error: "advanced_release_store_version_invalid", retryable: true };
  }
  return {
    ok: true,
    mode: "durable",
    idempotent: Boolean(value.idempotent),
    releaseId: clean(value.release_id, 180) || fallback.releaseId,
    state,
    stateVersion,
    eventHash,
    envelopeDigest,
    entitlementRefHash,
    releaseRecordsRevoked: Number.isFinite(Number(value.release_records_revoked)) ? Number(value.release_records_revoked) : undefined,
    artifactTokensRevoked: Number.isFinite(Number(value.artifact_tokens_revoked)) ? Number(value.artifact_tokens_revoked) : undefined,
  };
}

function memoryTransition(args: {
  transition: AdvancedAuditReleaseStoreTransition;
  envelope: AdvancedAuditReleaseEnvelope;
  entitlementRef?: string | null;
  eventHash: string;
  envelopeDigest: string;
  entitlementRefHash: string;
}): AdvancedAuditReleaseStoreReceipt {
  const releaseId = clean(args.envelope.releaseId, 180);
  const desired = stateForEnvelope(args.envelope);
  const existing = memoryReleases.get(releaseId);
  if (existing?.eventHashes.has(args.eventHash)) {
    return {
      ok: true,
      mode: "memory",
      idempotent: true,
      releaseId,
      state: existing.state,
      stateVersion: existing.stateVersion,
      eventHash: args.eventHash,
      envelopeDigest: existing.envelopeDigest,
      entitlementRefHash: existing.entitlementRefHash,
    };
  }
  if (args.transition === "issued") {
    const entitlementRef = clean(args.entitlementRef, 180);
    if (!entitlementRef) return { ok: false, mode: "memory", error: "advanced_release_store_entitlement_required", retryable: false };
    if (existing && (
      existing.caseRef !== args.envelope.caseRef
      || existing.entitlementRefHash !== args.entitlementRefHash
      || existing.payloadHash !== args.envelope.payloadHash.replace(/^sha256:/, "")
      || existing.sourceReceiptRoot !== args.envelope.sourceReceiptRoot.replace(/^sha256:/, "")
      || existing.pdfDigest !== args.envelope.pdfDigest.replace(/^sha256:/, "")
    )) {
      return { ok: false, mode: "memory", error: "advanced_release_store_identity_mismatch", retryable: false };
    }
    const next: MemoryRelease = existing ?? {
      releaseId,
      caseRef: args.envelope.caseRef,
      entitlementRef,
      entitlementRefHash: args.entitlementRefHash,
      payloadHash: args.envelope.payloadHash.replace(/^sha256:/, ""),
      sourceReceiptRoot: args.envelope.sourceReceiptRoot.replace(/^sha256:/, ""),
      pdfDigest: args.envelope.pdfDigest.replace(/^sha256:/, ""),
      envelopeDigest: args.envelopeDigest,
      state: desired,
      stateVersion: 0,
      expiresAt: args.envelope.expiresAt,
      eventHashes: new Set<string>(),
    };
    if (next.state === "revoked" && desired !== "revoked") return { ok: false, mode: "memory", error: "advanced_release_store_revoked_terminal", retryable: false };
    next.state = desired;
    next.envelopeDigest = args.envelopeDigest;
    next.expiresAt = args.envelope.expiresAt;
    next.stateVersion += 1;
    next.eventHashes.add(args.eventHash);
    memoryReleases.set(releaseId, next);
    return { ok: true, mode: "memory", idempotent: false, releaseId, state: next.state, stateVersion: next.stateVersion, eventHash: args.eventHash, envelopeDigest: next.envelopeDigest, entitlementRefHash: next.entitlementRefHash };
  }
  if (!existing) return { ok: false, mode: "memory", error: "advanced_release_store_release_not_found", retryable: false };
  if (existing.payloadHash !== args.envelope.payloadHash.replace(/^sha256:/, "")
    || existing.sourceReceiptRoot !== args.envelope.sourceReceiptRoot.replace(/^sha256:/, "")
    || existing.pdfDigest !== args.envelope.pdfDigest.replace(/^sha256:/, "")
    || existing.entitlementRefHash !== args.entitlementRefHash) {
    return { ok: false, mode: "memory", error: "advanced_release_store_identity_mismatch", retryable: false };
  }
  if (existing.state === "revoked" && desired !== "revoked") return { ok: false, mode: "memory", error: "advanced_release_store_revoked_terminal", retryable: false };
  if (args.transition === "approved" && desired !== "ready") return { ok: false, mode: "memory", error: "advanced_release_store_approval_not_ready", retryable: false };
  if (args.transition === "revoked" && desired !== "revoked") return { ok: false, mode: "memory", error: "advanced_release_store_revoke_state_invalid", retryable: false };
  existing.state = desired;
  existing.envelopeDigest = args.envelopeDigest;
  existing.expiresAt = args.envelope.expiresAt;
  existing.stateVersion += 1;
  existing.eventHashes.add(args.eventHash);
  return { ok: true, mode: "memory", idempotent: false, releaseId, state: existing.state, stateVersion: existing.stateVersion, eventHash: args.eventHash, envelopeDigest: existing.envelopeDigest, entitlementRefHash: existing.entitlementRefHash };
}

export async function recordAdvancedAuditReleaseTransition(args: {
  transition: AdvancedAuditReleaseStoreTransition;
  envelope: AdvancedAuditReleaseEnvelope;
  entitlementRef?: string | null;
  eventId: string;
  transitionAt?: string | Date;
  dependencies?: { rpc?: typeof runRegisteredServiceRoleRpc };
}): Promise<AdvancedAuditReleaseStoreReceipt> {
  const releaseId = clean(args.envelope.releaseId, 180);
  const eventId = clean(args.eventId, 220);
  if (!releaseId || !eventId) return { ok: false, mode: hasSupabaseServiceRoleConfig() ? "durable" : "memory", error: "advanced_release_store_request_invalid", retryable: false };
  const eventHash = sha256Digest(eventId);
  const envelopeDigest = sha256Digest(canonicalJson(args.envelope));
  const entitlementRefHash = digestValue(args.envelope.entitlementRefHash);
  const payloadHash = digestValue(args.envelope.payloadHash);
  const state = stateForEnvelope(args.envelope);
  const reviewOperatorHash = args.envelope.review ? sha256Digest(args.envelope.review.operatorPseudonym) : null;
  const approvalOperatorHash = args.envelope.dualControl?.approverPseudonym ? sha256Digest(args.envelope.dualControl.approverPseudonym) : null;
  const approvalReceiptHash = args.envelope.dualControl?.approvalReceiptId ? sha256Digest(args.envelope.dualControl.approvalReceiptId) : null;
  const transitionAt = args.transitionAt instanceof Date ? args.transitionAt.toISOString() : new Date(args.transitionAt ?? new Date()).toISOString();

  if (hasSupabaseServiceRoleConfig()) {
    try {
      const rpc = args.dependencies?.rpc ?? runRegisteredServiceRoleRpc;
      const result = await rpc({
        operation: "advanced_audit_release_transition_record",
        args: {
          p_transition: args.transition,
          p_release_id: releaseId,
          p_case_ref: args.envelope.caseRef,
          p_entitlement_id: args.transition === "issued" ? clean(args.entitlementRef, 180) || null : null,
          p_entitlement_ref_hash: entitlementRefHash,
          p_payload_hash: payloadHash,
          p_source_receipt_root: digestValue(args.envelope.sourceReceiptRoot),
          p_pdf_digest: digestValue(args.envelope.pdfDigest),
          p_envelope_digest: envelopeDigest,
          p_release_state: state,
          p_event_hash: eventHash,
          p_review_operator_hash: reviewOperatorHash,
          p_approval_operator_hash: approvalOperatorHash,
          p_approval_receipt_hash: approvalReceiptHash,
          p_issued_at: args.envelope.issuedAt,
          p_expires_at: args.envelope.expiresAt,
          p_transition_at: transitionAt,
        },
      });
      return parseDurableResult(result.data, { releaseId, eventHash, envelopeDigest, entitlementRefHash });
    } catch {
      return { ok: false, mode: "durable", error: "advanced_release_store_failed", retryable: true };
    }
  }
  if (isProductionLike()) return { ok: false, mode: "durable", error: "advanced_release_durable_store_required", retryable: true };
  return memoryTransition({ transition: args.transition, envelope: args.envelope, entitlementRef: args.entitlementRef, eventHash, envelopeDigest, entitlementRefHash });
}

export function revokeMemoryAdvancedAuditReleasesForEntitlement(args: { entitlementRef: string; eventId: string }) {
  const entitlementRef = clean(args.entitlementRef, 180);
  if (!entitlementRef) return 0;
  const hash = digestValue(sha256Digest(entitlementRef.toLowerCase()));
  let revoked = 0;
  for (const record of memoryReleases.values()) {
    if (record.entitlementRefHash !== hash || record.state === "revoked") continue;
    record.state = "revoked";
    record.stateVersion += 1;
    record.eventHashes.add(sha256Digest(args.eventId));
    revoked += 1;
  }
  return revoked;
}

export function getMemoryAdvancedAuditReleaseStoreSnapshot() {
  return Array.from(memoryReleases.values()).map((record) => ({
    releaseId: record.releaseId,
    caseRef: record.caseRef,
    entitlementRefHash: record.entitlementRefHash,
    payloadHash: record.payloadHash,
    sourceReceiptRoot: record.sourceReceiptRoot,
    pdfDigest: record.pdfDigest,
    envelopeDigest: record.envelopeDigest,
    state: record.state,
    stateVersion: record.stateVersion,
    expiresAt: record.expiresAt,
    eventCount: record.eventHashes.size,
  }));
}


export type AdvancedAuditReleaseDeliveryGate =
  | { ok: true; ready: true; mode: "durable" | "memory"; releaseId: string; state: "ready"; expiresAt: string }
  | { ok: false; ready: false; mode: "durable" | "memory"; error: string; retryable: boolean; state?: AdvancedAuditReleaseStoreState; expiresAt?: string };

export async function readAdvancedAuditReleaseDeliveryGate(args: {
  caseRef: string;
  entitlementRef: string;
  payloadHash: string;
  sourceReceiptRoot: string;
  pdfDigest: string;
  now?: string | Date;
}): Promise<AdvancedAuditReleaseDeliveryGate> {
  const caseRef = clean(args.caseRef, 48).toUpperCase();
  const entitlementRef = clean(args.entitlementRef, 180);
  let payloadHash: string;
  let sourceReceiptRoot: string;
  let pdfDigest: string;
  try {
    payloadHash = digestValue(args.payloadHash);
    sourceReceiptRoot = digestValue(args.sourceReceiptRoot);
    pdfDigest = digestValue(args.pdfDigest);
  } catch {
    return { ok: false, ready: false, mode: hasSupabaseServiceRoleConfig() ? "durable" : "memory", error: "advanced_release_artifact_binding_invalid", retryable: false };
  }
  const now = new Date(args.now ?? new Date());
  if (!caseRef || !entitlementRef || !Number.isFinite(now.getTime())) {
    return { ok: false, ready: false, mode: hasSupabaseServiceRoleConfig() ? "durable" : "memory", error: "advanced_release_delivery_binding_invalid", retryable: false };
  }
  if (hasSupabaseServiceRoleConfig()) {
    try {
      const supabase = getSupabaseServiceRoleClient();
      if (!supabase) throw new Error("advanced_release_service_role_unavailable");
      const { data, error } = await supabase
        .from("velmere_advanced_audit_releases")
        .select("release_id,release_state,expires_at,source_receipt_root,pdf_digest")
        .eq("case_ref", caseRef)
        .eq("entitlement_id", entitlementRef)
        .eq("payload_hash", payloadHash)
        .eq("source_receipt_root", sourceReceiptRoot)
        .eq("pdf_digest", pdfDigest)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { ok: false, ready: false, mode: "durable", error: "advanced_release_not_ready", retryable: false };
      const row = data as Record<string, unknown>;
      const releaseId = clean(row.release_id, 180);
      const state = clean(row.release_state, 32) as AdvancedAuditReleaseStoreState;
      const expiresAt = clean(row.expires_at, 64);
      const expiresMs = Date.parse(expiresAt);
      if (!releaseId || !["pending", "blocked", "ready", "expired", "revoked"].includes(state) || !Number.isFinite(expiresMs)) {
        return { ok: false, ready: false, mode: "durable", error: "advanced_release_delivery_row_invalid", retryable: true };
      }
      if (state !== "ready") return { ok: false, ready: false, mode: "durable", error: `advanced_release_${state}`, retryable: false, state, expiresAt };
      if (expiresMs <= now.getTime()) return { ok: false, ready: false, mode: "durable", error: "advanced_release_expired", retryable: false, state: "expired", expiresAt };
      return { ok: true, ready: true, mode: "durable", releaseId, state: "ready", expiresAt };
    } catch (error) {
      return { ok: false, ready: false, mode: "durable", error: error instanceof Error ? error.message : "advanced_release_delivery_read_failed", retryable: true };
    }
  }
  if (isProductionLike()) return { ok: false, ready: false, mode: "memory", error: "advanced_release_durable_store_required", retryable: true };
  const record = Array.from(memoryReleases.values()).find((item) =>
    item.caseRef === caseRef
    && item.entitlementRef === entitlementRef
    && item.payloadHash === payloadHash
    && item.sourceReceiptRoot === sourceReceiptRoot
    && item.pdfDigest === pdfDigest,
  );
  if (!record) return { ok: false, ready: false, mode: "memory", error: "advanced_release_not_ready", retryable: false };
  const expiresMs = Date.parse(record.expiresAt);
  if (record.state !== "ready") return { ok: false, ready: false, mode: "memory", error: `advanced_release_${record.state}`, retryable: false, state: record.state, expiresAt: record.expiresAt };
  if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) return { ok: false, ready: false, mode: "memory", error: "advanced_release_expired", retryable: false, state: "expired", expiresAt: record.expiresAt };
  return { ok: true, ready: true, mode: "memory", releaseId: record.releaseId, state: "ready", expiresAt: record.expiresAt };
}
