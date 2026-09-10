import type { SecurityAdminScope } from "@/lib/security/security-admin-contract";
import { createClientFingerprint } from "@/lib/security/security-event-ledger";
import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";

export type SecurityAdminAuditKind =
  | "security_admin_allowed"
  | "security_admin_denied"
  | "security_admin_not_configured"
  | "security_export_read"
  | "security_event_read"
  | "security_alert_read"
  | "security_event_store_read";

export type SecurityAdminAuditRecord = {
  id: string;
  kind: SecurityAdminAuditKind;
  route: string;
  method: string;
  operatorId: string;
  clientFingerprint: string;
  scopes: SecurityAdminScope[];
  result: "allowed" | "denied" | "not_configured";
  createdAt: string;
  safeSummary: string;
};

const adminAuditEvents: SecurityAdminAuditRecord[] = [];
const MAX_ADMIN_AUDIT_EVENTS = 180;


function auditId(kind: SecurityAdminAuditKind) {
  return createSecureRuntimeId(kind);
}

function inferKind(scopes: SecurityAdminScope[], result: SecurityAdminAuditRecord["result"]): SecurityAdminAuditKind {
  if (result === "not_configured") return "security_admin_not_configured";
  if (result === "denied") return "security_admin_denied";
  if (scopes.includes("security:export")) return "security_export_read";
  if (scopes.includes("security:alerts")) return "security_alert_read";
  if (scopes.includes("security:events")) return "security_event_read";
  return "security_admin_allowed";
}

export function recordSecurityAdminAudit(input: {
  request: Request;
  scopes: SecurityAdminScope[];
  result: "allowed" | "denied" | "not_configured";
  operatorId?: string;
  kind?: SecurityAdminAuditKind;
  safeSummary?: string;
}) {
  const createdAt = new Date().toISOString();
  const route = new URL(input.request.url).pathname;
  const kind = input.kind ?? inferKind(input.scopes, input.result);
  const record: SecurityAdminAuditRecord = {
    id: auditId(kind),
    kind,
    route,
    method: input.request.method,
    operatorId: input.operatorId ?? (input.result === "allowed" ? "security-admin" : "unknown"),
    clientFingerprint: createClientFingerprint(input.request),
    scopes: input.scopes,
    result: input.result,
    createdAt,
    safeSummary:
      input.safeSummary ??
      `Security admin ${input.result} for ${route}. Stored with fingerprint only; no raw token, raw IP or raw query is persisted.`,
  };

  adminAuditEvents.unshift(record);
  if (adminAuditEvents.length > MAX_ADMIN_AUDIT_EVENTS) adminAuditEvents.length = MAX_ADMIN_AUDIT_EVENTS;
  return record;
}

export function listSecurityAdminAuditEvents(limit = 40) {
  return adminAuditEvents.slice(0, Math.max(1, Math.min(limit, 100)));
}

export function buildSecurityAdminAuditSnapshot() {
  const recent = listSecurityAdminAuditEvents(30);
  return {
    schemaVersion: "velmere-security-admin-audit-v1",
    mode: "in_memory_admin_security_audit",
    generatedAt: new Date().toISOString(),
    total: adminAuditEvents.length,
    allowed: adminAuditEvents.filter((event) => event.result === "allowed").length,
    denied: adminAuditEvents.filter((event) => event.result === "denied").length,
    notConfigured: adminAuditEvents.filter((event) => event.result === "not_configured").length,
    recent,
    storageWritePerformed: false,
    durableStorageReady: false,
    productionBoundary:
      "Admin security audit is in-memory preview. Production needs durable storage, retention policy and admin-only viewer.",
  };
}
