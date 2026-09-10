import { after } from "next/server";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";

export type AuthSecurityEvent =
  | "signin_success" | "signin_rejected" | "signup_pending" | "signup_success"
  | "refresh_success" | "refresh_rejected" | "refresh_reuse_detected" | "logout_global"
  | "oauth_started" | "oauth_completed" | "oauth_rejected" | "oauth_cancelled"
  | "recovery_requested" | "recovery_completed" | "recovery_rejected"
  | "email_change_requested" | "email_change_completed" | "email_change_rejected"
  | "binding_conflict" | "flow_state_rejected";

type Bucket = { count: number; lastSeenAt: string };
const buckets = new Map<AuthSecurityEvent, Bucket>();

const durableMap: Record<AuthSecurityEvent, { family: "session" | "oauth" | "recovery" | "binding" | "rls"; outcome: "success" | "rejected" | "pending" | "conflict" | "unavailable" }> = {
  signin_success: { family: "session", outcome: "success" }, signin_rejected: { family: "session", outcome: "rejected" },
  signup_pending: { family: "session", outcome: "pending" }, signup_success: { family: "session", outcome: "success" },
  refresh_success: { family: "session", outcome: "success" }, refresh_rejected: { family: "session", outcome: "rejected" },
  refresh_reuse_detected: { family: "session", outcome: "conflict" }, logout_global: { family: "session", outcome: "success" },
  oauth_started: { family: "oauth", outcome: "pending" }, oauth_completed: { family: "oauth", outcome: "success" },
  oauth_rejected: { family: "oauth", outcome: "rejected" }, oauth_cancelled: { family: "oauth", outcome: "rejected" },
  recovery_requested: { family: "recovery", outcome: "pending" }, recovery_completed: { family: "recovery", outcome: "success" },
  recovery_rejected: { family: "recovery", outcome: "rejected" }, email_change_requested: { family: "binding", outcome: "pending" },
  email_change_completed: { family: "binding", outcome: "success" }, email_change_rejected: { family: "binding", outcome: "rejected" },
  binding_conflict: { family: "binding", outcome: "conflict" }, flow_state_rejected: { family: "session", outcome: "rejected" },
};

export async function recordAuthSecurityEvent(event: AuthSecurityEvent) {
  const existing = buckets.get(event);
  buckets.set(event, { count: Math.min(1_000_000, (existing?.count ?? 0) + 1), lastSeenAt: new Date().toISOString() });
  const durable = durableMap[event];
  try {
    await runRegisteredServiceRoleRpc({ operation: "auth_security_event_record", args: { p_event_family: durable.family, p_outcome: durable.outcome } });
    return { durable: true as const };
  } catch {
    return { durable: false as const };
  }
}

export function scheduleAuthSecurityEvent(event: AuthSecurityEvent) {
  const task = recordAuthSecurityEvent(event);
  try {
    after(task);
  } catch {
    // Direct route-unit tests and non-request runtimes have no Next request scope.
    // The promise is already started and remains deliberately best-effort.
    void task;
  }
}

export function getAuthSecuritySnapshot() {
  return {
    schemaVersion: "velmere.auth-security-observability.v2",
    generatedAt: new Date().toISOString(),
    events: Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([event, value]) => ({ event, ...value })),
    durableSink: "service-role bounded RPC; failures never block authentication availability",
    privacyBoundary: "Family-level counters only. No email, account ID, subject, token, provider payload, IP, user-agent or raw error.",
  } as const;
}
