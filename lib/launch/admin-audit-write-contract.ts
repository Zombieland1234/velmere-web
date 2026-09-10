import { createAdminMutationAuditEnvelope, type AdminMutationAction } from "@/lib/launch/admin-mutation-audit";
import { createAdminAuditPersistencePreview } from "@/lib/launch/admin-audit-persistence";
import { createPublishRollbackDiff } from "@/lib/launch/publish-rollback-context";
import { createSupportSafeTimelinePreview } from "@/lib/launch/support-safe-timeline";
import { getAdminSessionPreviewFromEnv, requireAdminScope } from "@/lib/launch/admin-auth-session-guard";
import { createAdminIdempotencyPreview } from "@/lib/launch/admin-idempotency-store";
import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type AdminAuditWriteStatus = "accepted_preview" | "blocked" | "invalid";

export type AdminAuditWriteRequest = {
  action?: AdminMutationAction;
  operatorId?: string;
  targetId?: string;
  reason?: string;
  sourceMode?: "manual" | "provider" | "csv" | "system";
  checklist?: string[];
  payload?: unknown;
  idempotencyKey?: string;
  requestedState?: "draft" | "coming_soon" | "active" | "archived";
};

export type AdminAuditWriteResponse = {
  ok: boolean;
  status: AdminAuditWriteStatus;
  httpStatus: number;
  reason: string;
  missing: string[];
  idempotencyKey: string;
  auditEnvelope?: ReturnType<typeof createAdminMutationAuditEnvelope>;
  persistencePreview?: ReturnType<typeof createAdminAuditPersistencePreview>;
  rollbackPreview?: ReturnType<typeof createPublishRollbackDiff>;
  supportTimelinePreview?: ReturnType<typeof createSupportSafeTimelinePreview>;
  sessionPreview?: ReturnType<typeof getAdminSessionPreviewFromEnv>;
  permissionPreview?: ReturnType<typeof requireAdminScope>;
  idempotencyPreview?: ReturnType<typeof createAdminIdempotencyPreview>;
};

export type AdminAuditServerGate = {
  enabled: boolean;
  environment: string;
  hasAuthContext: boolean;
  hasStorage: boolean;
  mode: "locked_preview" | "server_ready";
};

export type AdminAuditWriteRouteItem = {
  id: string;
  label: string;
  status: "ready" | "partial" | "blocked" | "manual_review";
  progress: number;
  sourceMode: "api_contract" | "auth_missing" | "storage_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const adminAuditWriteRouteMatrix: AdminAuditWriteRouteItem[] = [
  {
    id: "api-route-skeleton",
    label: "Audit write route skeleton",
    status: "partial",
    progress: 58,
    sourceMode: "api_contract",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin audit events have a dedicated server route contract instead of client-only previews.",
    safetyBoundary: "Route must stay locked until auth context, storage and idempotency are production wired.",
    blockers: ["server auth", "persistent storage", "idempotency enforcement", "write adapter"],
    nextStep: "Auth session and idempotency contracts now exist; next wire route to real session middleware and storage adapter."
  },
  {
    id: "idempotency-contract",
    label: "Idempotency contract",
    status: "manual_review",
    progress: 58,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every audit write request carries an idempotency key and duplicate-write policy.",
    safetyBoundary: "No publish/write mutation should create duplicate audit events on retry.",
    blockers: ["idempotency store", "unique key", "retry policy", "duplicate response"],
    nextStep: "Idempotency store contract now exists; next persist unique keys with case id, action and target."
  },
  {
    id: "server-gate",
    label: "Server gate",
    status: "blocked",
    progress: 44,
    sourceMode: "auth_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Server decides whether audit write can run; client env flags never unlock persistence.",
    safetyBoundary: "No audit route may write storage without server auth context and storage-ready flag.",
    blockers: ["ADMIN_AUDIT_WRITE_ENABLED", "ADMIN_AUTH_CONTEXT_READY", "ADMIN_AUDIT_STORAGE_READY", "allowlisted environment"],
    nextStep: "Session scope guard contract now exists; next replace env preview with real server session reader."
  },
  {
    id: "storage-write-adapter",
    label: "Storage write adapter",
    status: "blocked",
    progress: 12,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Accepted audit write stores envelope, redacted snapshot and support-safe timeline reference.",
    safetyBoundary: "Preview response is not persistence and must not be treated as launch-ready storage.",
    blockers: ["database table", "write API", "checksum", "retention class"],
    nextStep: "Implement durable audit storage adapter and checksum verification.",
  },
];

export function getAdminAuditWriteRouteSummary() {
  return summarizeLaunchReadiness(adminAuditWriteRouteMatrix);
}


const ALLOWED_ACTIONS: AdminMutationAction[] = [
  "product_import",
  "provider_sync",
  "draft_publish",
  "active_publish",
  "product_overwrite",
  "refund_admin_note",
];

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeChecklist(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

export function getAdminAuditServerGate(): AdminAuditServerGate {
  const enabled = process.env.ADMIN_AUDIT_WRITE_ENABLED === "true";
  const environment = process.env.ADMIN_AUDIT_WRITE_ENV?.trim().toLowerCase() || "unset";
  const hasAuthContext = process.env.ADMIN_AUTH_CONTEXT_READY === "true";
  const hasStorage = process.env.ADMIN_AUDIT_STORAGE_READY === "true";
  const allowlistedEnv = ["local", "staging", "ops"].includes(environment);
  const serverReady = enabled && allowlistedEnv && hasAuthContext && hasStorage;

  return {
    enabled: enabled && allowlistedEnv,
    environment,
    hasAuthContext,
    hasStorage,
    mode: serverReady ? "server_ready" : "locked_preview",
  };
}

export function validateAdminAuditWriteRequest(input: unknown) {
  const request = (input && typeof input === "object" ? input : {}) as AdminAuditWriteRequest;
  const missing: string[] = [];
  const action = request.action;

  if (!action || !ALLOWED_ACTIONS.includes(action)) missing.push("valid action");
  if (!normalize(request.operatorId) || normalize(request.operatorId) === "operator:unknown") missing.push("auth-bound operator id");
  if (!normalize(request.targetId) || normalize(request.targetId) === "target:unresolved") missing.push("target id");
  if (!normalize(request.reason) || normalize(request.reason).startsWith("reason:")) missing.push("operator reason");
  if (!normalize(request.idempotencyKey)) missing.push("idempotency key");
  if ((action === "active_publish" || action === "product_overwrite") && normalizeChecklist(request.checklist).length < 3) {
    missing.push("publish checklist snapshot");
  }

  return { request, missing };
}

export function createAdminAuditWritePreview(input: unknown): AdminAuditWriteResponse {
  const gate = getAdminAuditServerGate();
  const sessionPreview = getAdminSessionPreviewFromEnv();
  const { request, missing } = validateAdminAuditWriteRequest(input);
  const action = request.action && ALLOWED_ACTIONS.includes(request.action) ? request.action : "product_import";
  const idempotencyKey = normalize(request.idempotencyKey) || `missing-idempotency-${action}`;
  const requiredScope = action === "active_publish" ? "product:active_publish" : action === "product_overwrite" ? "product:overwrite" : action === "provider_sync" ? "product:sync" : action === "draft_publish" ? "product:draft_publish" : "audit:write";
  const permissionPreview = requireAdminScope(sessionPreview, requiredScope);
  const idempotencyPreview = createAdminIdempotencyPreview({ idempotencyKey, action, targetId: normalize(request.targetId) || "target:unresolved", operatorId: sessionPreview.operatorId });
  const checklist = normalizeChecklist(request.checklist);
  const targetId = normalize(request.targetId) || "target:unresolved";

  const auditEnvelope = createAdminMutationAuditEnvelope({
    action,
    status: missing.length > 0 || gate.mode !== "server_ready" ? "blocked" : "manual_review",
    operatorId: normalize(request.operatorId) || "operator:unknown",
    targetId,
    reason: normalize(request.reason) || "reason:required-before-production",
    sourceMode: request.sourceMode ?? "manual",
    checklist,
    payload: request.payload ?? {},
    now: "2026-06-03T00:00:00.000Z",
  });

  const persistencePreview = createAdminAuditPersistencePreview({
    caseId: auditEnvelope.caseId,
    operatorId: auditEnvelope.operatorId,
    safePayload: auditEnvelope.safePayload,
    sourceSnapshotMode: "redacted",
    retentionClass: action === "refund_admin_note" ? "customer_support" : "launch_review",
  });

  const rollbackPreview = createPublishRollbackDiff({
    productId: targetId,
    previousState: "unknown",
    nextState: request.requestedState ?? (action === "active_publish" ? "active" : "coming_soon"),
    changedFields: action === "product_overwrite" ? ["providerMapping", "price", "status"] : ["status"],
    checklistSnapshot: checklist.length ? checklist : ["provider truth missing", "shipping/returns missing", "legal review missing"],
    customerImpact: action === "active_publish" ? "medium" : "low",
  });

  const supportTimelinePreview = createSupportSafeTimelinePreview([
    {
      id: `${auditEnvelope.caseId}-support`,
      time: auditEnvelope.createdAt,
      title: gate.mode === "server_ready" ? "Audit write ready for server storage" : "Audit write blocked in preview mode",
      sourceMode: "audit",
      visibility: "support_safe",
      summary: gate.mode === "server_ready"
        ? "Server gate reports auth and storage as ready, but write path still requires real route integration review."
        : "Audit write route remains locked because server auth, storage or environment gate is incomplete.",
      missingData: missing.length ? missing : ["production write confirmation", "support approval"],
    },
  ]);

  if (gate.mode !== "server_ready") {
    return {
      ok: false,
      status: "blocked",
      httpStatus: 423,
      reason: "Admin audit write route is locked until server auth context, storage and environment gate are ready.",
      missing: [...missing, ...permissionPreview.missing, ...idempotencyPreview.missing, ...(!gate.hasAuthContext ? ["server auth context"] : []), ...(!gate.hasStorage ? ["audit storage"] : [])],
      idempotencyKey,
      auditEnvelope,
      persistencePreview,
      rollbackPreview,
      supportTimelinePreview,
      sessionPreview,
      permissionPreview,
      idempotencyPreview,
    };
  }

  if (missing.length > 0) {
    return {
      ok: false,
      status: "invalid",
      httpStatus: 400,
      reason: "Admin audit write request is missing required production fields.",
      missing: [...missing, ...permissionPreview.missing, ...idempotencyPreview.missing],
      idempotencyKey,
      auditEnvelope,
      persistencePreview,
      rollbackPreview,
      supportTimelinePreview,
      sessionPreview,
      permissionPreview,
      idempotencyPreview,
    };
  }

  return {
    ok: true,
    status: "accepted_preview",
    httpStatus: 202,
    reason: "Server gate is ready, but this implementation returns a preview until persistent write adapter is wired.",
    missing: ["persistent write adapter implementation"],
    idempotencyKey,
    auditEnvelope,
    persistencePreview,
    rollbackPreview,
    supportTimelinePreview,
    sessionPreview,
    permissionPreview,
    idempotencyPreview,
  };
}

export const adminAuditWriteContractLaunchNote =
  "Admin audit write API is a locked server contract. It must not be treated as production persistence until auth-bound operator context, database writes and idempotency are implemented.";
