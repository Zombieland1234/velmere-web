import { createHash } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";

export type FulfilmentIncidentStatus = "open" | "in_review" | "resolved" | "escalated" | "blocked";
export type FulfilmentIncidentSeverity = "info" | "warning" | "error" | "critical";

export type FulfilmentIncidentCaseSnapshot = {
  schemaVersion: "velmere.fulfilment-incident-case.v1";
  caseId: string;
  orderDraftId?: string;
  retryQueueId?: string;
  status: FulfilmentIncidentStatus;
  severity: FulfilmentIncidentSeverity;
  assignedRole: "owner" | "operator" | "support" | "viewer";
  incidentType: string;
  decision?: string;
  operatorNote?: string;
  supportPacket: Record<string, unknown>;
  redactedSnapshot: Record<string, unknown>;
  receiptId: string;
  createdAt: string;
  redactionBoundary: { rawCustomerPiiStored: false; rawProviderPayloadStored: false; secretsStored: false; allowedFields: string[] };
};

function hash(value: unknown, prefix = "incidentcase") {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 22)}`;
}

const BLOCKED_KEY_PATTERN = /(email|phone|address|customer|raw|secret|token|authorization|bearer|api[_-]?key)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const LONG_DIGIT_PATTERN = /\b\+?\d[\d\s().-]{7,}\d\b/g;

function redactText(value: string, maxLength = 300) {
  return value
    .slice(0, maxLength)
    .replace(EMAIL_PATTERN, "[redacted_email]")
    .replace(BEARER_PATTERN, "[redacted_bearer]")
    .replace(LONG_DIGIT_PATTERN, "[redacted_number]");
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[depth_limited]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !BLOCKED_KEY_PATTERN.test(key))
    .slice(0, 40)
    .map(([key, nested]) => [key.slice(0, 80), sanitizeValue(nested, depth + 1)] as const)
    .filter(([, nested]) => nested !== undefined);
  return Object.fromEntries(entries);
}

export function sanitizeFulfilmentIncidentPayload(value: Record<string, unknown> = {}) {
  const sanitized = sanitizeValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}

export async function upsertFulfilmentIncidentCase(input: {
  orderDraftId?: string;
  retryQueueId?: string;
  status?: FulfilmentIncidentStatus;
  severity?: FulfilmentIncidentSeverity;
  assignedRole?: "owner" | "operator" | "support" | "viewer";
  incidentType: string;
  decision?: string;
  operatorNote?: string;
  supportPacket?: Record<string, unknown>;
  redactedSnapshot?: Record<string, unknown>;
}) {
  const createdAt = new Date().toISOString();
  const caseId = hash({ orderDraftId: input.orderDraftId, retryQueueId: input.retryQueueId, incidentType: input.incidentType }, "fulfilment_case");
  const receiptId = hash({ caseId, status: input.status ?? "open", createdAt }, "fulfilment_receipt");
  const snapshot: FulfilmentIncidentCaseSnapshot = {
    schemaVersion: "velmere.fulfilment-incident-case.v1",
    caseId,
    orderDraftId: input.orderDraftId,
    retryQueueId: input.retryQueueId,
    status: input.status ?? "open",
    severity: input.severity ?? "warning",
    assignedRole: input.assignedRole ?? "operator",
    incidentType: input.incidentType,
    decision: input.decision,
    operatorNote: input.operatorNote ? redactText(input.operatorNote, 600) : undefined,
    supportPacket: sanitizeFulfilmentIncidentPayload(input.supportPacket),
    redactedSnapshot: sanitizeFulfilmentIncidentPayload(input.redactedSnapshot),
    receiptId,
    createdAt,
    redactionBoundary: { rawCustomerPiiStored: false, rawProviderPayloadStored: false, secretsStored: false, allowedFields: ["case id", "order id", "retry id", "status", "severity", "operator note", "support-safe packet", "redacted snapshot", "receipt"] },
  };
  if (!hasSupabaseServiceRoleConfig()) return { persisted: false as const, durableWrite: false as const, mode: "memory_blocked_for_production" as const, snapshot, productionBoundary: "BLOCKED: Supabase service-role ENV missing; incident case is not durable." };
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("Supabase client unavailable.");
    const { error } = await supabase.from("velmere_fulfilment_incidents").upsert({
      case_id: caseId,
      order_id: null,
      order_draft_id: snapshot.orderDraftId ?? null,
      status: snapshot.status,
      severity: snapshot.severity,
      assigned_role: snapshot.assignedRole,
      incident_type: snapshot.incidentType,
      decision: snapshot.decision ?? null,
      operator_note: snapshot.operatorNote ?? null,
      support_packet: snapshot.supportPacket,
      redacted_snapshot: snapshot.redactedSnapshot,
      receipt_id: snapshot.receiptId,
      updated_at: createdAt,
    }, { onConflict: "case_id" });
    if (error) throw error;
    return { persisted: true as const, durableWrite: true as const, mode: "supabase" as const, snapshot, productionBoundary: "Durable fulfilment incident case stored with support-safe redaction boundary." };
  } catch {
    return { persisted: false as const, durableWrite: false as const, mode: "memory_blocked_for_production" as const, snapshot, providerError: "incident_case_write_failed", productionBoundary: "BLOCKED: incident case DB write failed." };
  }
}
