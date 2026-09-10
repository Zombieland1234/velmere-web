import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";
export type AdminAuditPersistenceStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminAuditPersistenceItem = {
  id: string;
  label: string;
  status: AdminAuditPersistenceStatus;
  progress: number;
  sourceMode: "contract_draft" | "storage_missing" | "auth_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type AdminAuditPersistenceRecord = {
  caseId: string;
  writeMode: "draft_preview" | "server_persisted";
  storageMode: "missing" | "database" | "append_only_log";
  operatorId: string;
  checksum: string;
  retentionClass: "launch_review" | "customer_support" | "security_review";
  sourceSnapshotMode: "none" | "redacted" | "allowlisted";
  supportVisible: boolean;
};

export const adminAuditPersistenceMatrix: AdminAuditPersistenceItem[] = [
  {
    id: "storage-adapter",
    label: "Persistent storage adapter",
    status: "blocked",
    progress: 32,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Audit events are saved server-side instead of living only in UI memory.",
    safetyBoundary: "No import, publish or overwrite action should be production without durable event storage.",
    blockers: ["database/table", "write API", "server auth context", "retention policy"],
    nextStep: "Audit write API route contract now exists; next connect it to durable database storage."
  },
  {
    id: "operator-context",
    label: "Operator context",
    status: "blocked",
    progress: 18,
    sourceMode: "auth_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every audit record stores the real authenticated operator id and permission scope.",
    safetyBoundary: "Preview ids like operator:unknown must never be accepted in production mutation storage.",
    blockers: ["auth session", "role scope", "permission scope", "reauth timestamp"],
    nextStep: "Bind audit envelope to server auth session and role/permission snapshot.",
  },
  {
    id: "idempotent-write",
    label: "Idempotent audit write",
    status: "blocked",
    progress: 38,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Retries do not create duplicate publish or import audit events.",
    safetyBoundary: "No mutation endpoint without idempotency key, case id and duplicate-write policy.",
    blockers: ["idempotency key", "unique case id", "retry state", "duplicate handling"],
    nextStep: "Idempotency contract now exists in audit write route; next persist keys with case id and target."
  },
  {
    id: "source-snapshot",
    label: "Redacted source snapshot",
    status: "manual_review",
    progress: 34,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Audit stores a reviewed snapshot of provider/source data without raw secrets.",
    safetyBoundary: "No raw provider JSON, payment payload or private token in audit storage.",
    blockers: ["safe allowlist", "redaction proof", "source timestamp", "provider mode"],
    nextStep: "Define allowlisted provider/product fields for audit snapshots.",
  },
  {
    id: "retention-export",
    label: "Retention and export policy",
    status: "blocked",
    progress: 16,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Audit records have retention class and export rules for launch review and support.",
    safetyBoundary: "No indefinite private logs without retention class, redaction and access policy.",
    blockers: ["retention class", "access policy", "export rules", "deletion policy"],
    nextStep: "Define retention classes and support-safe export rules before storing production events.",
  },
];

function stableChecksum(input: string) {
  return sha256Digest(input);
}

export function createAdminAuditPersistencePreview(input: {
  caseId: string;
  operatorId?: string;
  safePayload?: string;
  sourceSnapshotMode?: "none" | "redacted" | "allowlisted";
  retentionClass?: "launch_review" | "customer_support" | "security_review";
}): AdminAuditPersistenceRecord {
  const operatorId = input.operatorId?.trim() || "operator:unknown";
  const safePayload = input.safePayload ?? "{}";
  return {
    caseId: input.caseId,
    writeMode: "draft_preview",
    storageMode: "missing",
    operatorId,
    checksum: stableChecksum(`${input.caseId}:${operatorId}:${safePayload}`),
    retentionClass: input.retentionClass ?? "launch_review",
    sourceSnapshotMode: input.sourceSnapshotMode ?? "redacted",
    supportVisible: false,
  };
}

export function getAdminAuditPersistenceSummary() {
  return summarizeLaunchReadiness(adminAuditPersistenceMatrix);
}

export const adminAuditPersistenceLaunchNote =
  "Admin audit persistence is still a contract/preview. Production requires server storage, authenticated operator context and retention policy.";
