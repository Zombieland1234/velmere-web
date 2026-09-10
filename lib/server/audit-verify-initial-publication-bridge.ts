import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

const CASE_REF = /^[A-Za-z0-9:_-]{8,160}$/u;
const PUBLIC_PROOF_ID = /^pubidx-[a-f0-9]{48}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PREFIXED_SHA256 = /^sha256:[a-f0-9]{64}$/u;

const RECEIPT_KEYS = new Set([
  "schemaVersion", "ok", "verifyActive", "publiclyVisible", "publicProofId",
  "visibility", "currentStatus", "eventDigest", "reportId", "snapshotDigest",
  "artifactBindingDigest", "idempotent", "reason", "truthBoundary",
]);

export type AuditVerifyInitialPublicationResult =
  | Readonly<{
    status: "ACTIVE_PRIVATE";
    publicProofId: string;
    visibility: "PRIVATE";
    currentStatus: "VERIFIED" | "VERIFIED_AGAIN";
    eventDigest: string;
    reportId: string;
    snapshotDigest: string;
    artifactBindingDigest: string;
    idempotent: boolean;
  }>
  | Readonly<{
    status: "WITHHELD";
    publicProofId: null;
    visibility: "PRIVATE";
    currentStatus: null;
    reason: "VERIFY_PUBLICATION_FAILED" | "VERIFY_PUBLICATION_RECEIPT_INVALID" | "VERIFY_MONITORING_NOT_CURRENT";
  }>;

type RpcRunner = typeof runRegisteredServiceRoleRpc;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactRpcObject(value: unknown) {
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0])) return value[0];
  return value;
}

function hasExactKeys(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length === RECEIPT_KEYS.size && keys.every((key) => RECEIPT_KEYS.has(key));
}

/**
 * Runs only after durable Audit completion. PRIVATE is deliberately hard-coded:
 * a worker/admin completion request is not customer consent for publication.
 * The SQL producer re-reads all immutable bindings and may still fail closed.
 */
export async function publishCompletedAuditToPrivateVerify(
  caseRef: string,
  dependencies: { rpc?: RpcRunner } = {},
): Promise<AuditVerifyInitialPublicationResult> {
  const canonicalCaseRef = caseRef.trim();
  if (!CASE_REF.test(canonicalCaseRef)) {
    return {
      status: "WITHHELD",
      publicProofId: null,
      visibility: "PRIVATE",
      currentStatus: null,
      reason: "VERIFY_PUBLICATION_FAILED",
    };
  }
  const rpc = dependencies.rpc ?? runRegisteredServiceRoleRpc;
  let raw: unknown;
  try {
    raw = exactRpcObject((await rpc({
      operation: "audit_verify_initial_publish",
      args: {
        p_case_ref: canonicalCaseRef,
        p_requested_visibility: "PRIVATE",
      },
    })).data);
  } catch {
    return {
      status: "WITHHELD",
      publicProofId: null,
      visibility: "PRIVATE",
      currentStatus: null,
      reason: "VERIFY_PUBLICATION_FAILED",
    };
  }

  if (!isRecord(raw) || !hasExactKeys(raw)
    || raw.schemaVersion !== "velmere.audit-verify-initial-producer-receipt.v1"
    || raw.ok !== true
    || raw.visibility !== "PRIVATE"
    || raw.publiclyVisible !== false
    || typeof raw.publicProofId !== "string" || !PUBLIC_PROOF_ID.test(raw.publicProofId)
    || typeof raw.eventDigest !== "string" || !SHA256.test(raw.eventDigest)
    || typeof raw.reportId !== "string" || raw.reportId.length < 1 || raw.reportId.length > 160
    || typeof raw.snapshotDigest !== "string" || !PREFIXED_SHA256.test(raw.snapshotDigest)
    || typeof raw.artifactBindingDigest !== "string" || !SHA256.test(raw.artifactBindingDigest)
    || typeof raw.idempotent !== "boolean"
    || typeof raw.truthBoundary !== "string" || raw.truthBoundary.length < 20) {
    return {
      status: "WITHHELD",
      publicProofId: null,
      visibility: "PRIVATE",
      currentStatus: null,
      reason: "VERIFY_PUBLICATION_RECEIPT_INVALID",
    };
  }
  if (raw.verifyActive !== true
    || (raw.currentStatus !== "VERIFIED" && raw.currentStatus !== "VERIFIED_AGAIN")
    || raw.reason !== null) {
    return {
      status: "WITHHELD",
      publicProofId: null,
      visibility: "PRIVATE",
      currentStatus: null,
      reason: "VERIFY_MONITORING_NOT_CURRENT",
    };
  }
  return {
    status: "ACTIVE_PRIVATE",
    publicProofId: raw.publicProofId,
    visibility: "PRIVATE",
    currentStatus: raw.currentStatus,
    eventDigest: raw.eventDigest,
    reportId: raw.reportId,
    snapshotDigest: raw.snapshotDigest,
    artifactBindingDigest: raw.artifactBindingDigest,
    idempotent: raw.idempotent,
  };
}
