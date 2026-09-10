import { NextResponse } from "next/server";
import { runAuthSecurityAlertWorker } from "@/lib/auth/auth-security-alert-worker";
import {
  assertExactWorkerBodyKeys,
  authorizeInternalWorkerMutation,
  optionalWorkerInteger,
} from "@/lib/security/internal-worker-mutation-boundary";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow, noarchive" } });
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function buildAuthSecurityAlertRouteHealth(summary: unknown) {
  if (!summary || typeof summary !== "object") {
    return { ok: false, severity: "critical" as const, reasonCodes: ["telemetry_schema_invalid"] };
  }
  const row = summary as Record<string, unknown>;
  const values = [row.claimed, row.delivered, row.retried, row.deadLettered, row.conflicts, row.notConfigured];
  if (
    !values.every(nonNegativeInteger)
    || row.claimed !== Number(row.delivered) + Number(row.retried) + Number(row.deadLettered) + Number(row.conflicts)
    || Number(row.notConfigured) > Number(row.retried) + Number(row.deadLettered) + Number(row.conflicts)
  ) {
    return { ok: false, severity: "critical" as const, reasonCodes: ["telemetry_schema_invalid"] };
  }
  const reasonCodes = [
    ...(Number(row.notConfigured) > 0 ? ["alert_sink_not_configured"] : []),
    ...(Number(row.retried) > 0 ? ["alert_retry_nonzero"] : []),
    ...(Number(row.deadLettered) > 0 ? ["alert_dead_letter_nonzero"] : []),
    ...(Number(row.conflicts) > 0 ? ["alert_settlement_conflict_nonzero"] : []),
    ...(row.delivered !== row.claimed ? ["alert_delivery_incomplete"] : []),
  ];
  return {
    ok: reasonCodes.length === 0,
    severity: reasonCodes.length === 0 ? "none" as const : "critical" as const,
    reasonCodes,
  };
}

export async function POST(request: Request) {
  const authorized = await authorizeInternalWorkerMutation(request, { keyPrefix: "auth-security-alert-worker" });
  if (!authorized.ok) return authorized.response;
  const bodyGuard = assertExactWorkerBodyKeys(authorized.body, ["action", "limit", "leaseSeconds"]);
  if (bodyGuard) return bodyGuard;
  if (authorized.body.action !== undefined && authorized.body.action !== "run") return json({ ok: false, error: "unsupported_action" }, 400);
  const limit = optionalWorkerInteger(authorized.body, "limit", { min: 1, max: 100 });
  if (!limit.ok) return limit.response;
  const leaseSeconds = optionalWorkerInteger(authorized.body, "leaseSeconds", { min: 15, max: 600 });
  if (!leaseSeconds.ok) return leaseSeconds.response;
  try {
    const summary = await runAuthSecurityAlertWorker({ limit: limit.value ?? 20, leaseSeconds: leaseSeconds.value ?? 60 });
    const health = buildAuthSecurityAlertRouteHealth(summary);
    return json(
      {
        ok: health.ok,
        health,
        summary,
        privacyBoundary: "Aggregate counts only; no account, subject, token, email, IP, user-agent or provider payload.",
      },
      health.ok ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: "auth_security_alert_worker_unavailable", retryable: true }, 503);
  }
}
