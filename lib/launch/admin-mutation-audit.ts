import { createSafeOperatorLogLine } from "@/lib/launch/redacted-logger";
import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminMutationAuditStatus = "ready" | "partial" | "blocked" | "manual_review";

export type AdminMutationAuditItem = {
  id: string;
  label: string;
  status: AdminMutationAuditStatus;
  progress: number;
  sourceMode: "contract_draft" | "redaction_ready" | "storage_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type AdminMutationAction =
  | "product_import"
  | "provider_sync"
  | "draft_publish"
  | "active_publish"
  | "product_overwrite"
  | "refund_admin_note";

export type AdminMutationAuditEnvelope = {
  caseId: string;
  action: AdminMutationAction;
  status: "draft" | "blocked" | "manual_review" | "ready";
  operatorId: string;
  targetId: string;
  reason: string;
  sourceMode: "manual" | "provider" | "csv" | "system";
  createdAt: string;
  checklist: string[];
  redaction: {
    count: number;
    severity: "low" | "medium" | "high";
    markers: string[];
  };
  safePayload: string;
};

export const adminMutationAuditMatrix: AdminMutationAuditItem[] = [
  {
    id: "event-envelope",
    label: "Mutation event envelope",
    status: "manual_review",
    progress: 58,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every import, sync, publish and overwrite action has a case id, action, operator, target and reason.",
    safetyBoundary: "No admin mutation should be anonymous, reasonless or impossible to trace.",
    blockers: ["persistent storage", "operator id", "target id validation", "reason requirement"],
    nextStep: "Admin audit persistence contract now exists; next implement server storage and auth-bound operator id."
  },
  {
    id: "redacted-payload",
    label: "Redacted payload",
    status: "partial",
    progress: 54,
    sourceMode: "redaction_ready",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin audit can keep useful context without exposing provider tokens, secrets or private identifiers.",
    safetyBoundary: "No raw provider response, payment payload, webhook signature or secret in operator-visible logs.",
    blockers: ["response allowlist", "server logger wrapper", "storage policy"],
    nextStep: "Use redacted logger for provider sync, payment webhook and admin mutation events.",
  },
  {
    id: "publish-checklist",
    label: "Publish checklist snapshot",
    status: "blocked",
    progress: 46,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Publish event stores provider truth, shipping/returns truth, legal copy and operator permission result.",
    safetyBoundary: "No active publish event without checklist snapshot and rollback context.",
    blockers: ["provider truth snapshot", "shipping/returns snapshot", "legal copy check", "rollback id"],
    nextStep: "Publish rollback context now exists; next persist checklist snapshot and before/after diff."
  },
  {
    id: "rollback-context",
    label: "Rollback context",
    status: "blocked",
    progress: 34,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support can see what changed and how to reverse an unsafe publish or overwrite.",
    safetyBoundary: "No live catalogue mutation without previous state, new state and rollback reference.",
    blockers: ["previous state", "new state", "rollback id", "operator note"],
    nextStep: "Rollback diff contract now exists; next persist previous state, next state and rollback id."
  },
  {
    id: "support-handoff",
    label: "Support handoff",
    status: "manual_review",
    progress: 52,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "If a customer issue appears, support sees the safe audit trail, not raw internal payloads.",
    safetyBoundary: "Support view must expose source state and reason without leaking secrets or private provider payloads.",
    blockers: ["support-safe view", "redaction audit", "case timeline", "customer-safe summary"],
    nextStep: "Support-safe timeline contract now exists; next connect it to persisted audit and order ledgers."
  },
];

export function createAdminMutationAuditEnvelope(input: {
  action: AdminMutationAction;
  status: "draft" | "blocked" | "manual_review" | "ready";
  operatorId?: string;
  targetId?: string;
  reason?: string;
  sourceMode: "manual" | "provider" | "csv" | "system";
  checklist?: string[];
  payload?: unknown;
  now?: string;
}): AdminMutationAuditEnvelope {
  const operatorId = input.operatorId?.trim() || "operator:unknown";
  const targetId = input.targetId?.trim() || "target:unresolved";
  const createdAt = input.now ?? new Date(0).toISOString();
  const caseId = `admin-${input.action}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${targetId.replace(/[^a-z0-9_-]/gi, "").slice(0, 18) || "target"}`;
  const safeLog = createSafeOperatorLogLine({
    scope: "admin_mutation",
    action: input.action,
    status: input.status,
    payload: input.payload ?? {},
  });

  return {
    caseId,
    action: input.action,
    status: input.status,
    operatorId,
    targetId,
    reason: input.reason?.trim() || "reason:required-before-production",
    sourceMode: input.sourceMode,
    createdAt,
    checklist: input.checklist ?? [],
    redaction: safeLog.redaction,
    safePayload: safeLog.safePayload,
  };
}

export function getAdminMutationAuditSummary() {
  return summarizeLaunchReadiness(adminMutationAuditMatrix);
}

export const adminMutationAuditLaunchNote =
  "Admin mutation audit envelope is a contract and preview. Production still needs persistent storage, server auth context and rollback diff persistence.";
