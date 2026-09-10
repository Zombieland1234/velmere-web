import { NextResponse } from "next/server";
import {
  buildDurableComputationAlertDeliveryReadiness,
  runDurableComputationAlertDelivery,
} from "@/lib/jobs/durable-computation-alert-delivery";
import {
  assertExactWorkerBodyKeys,
  authorizeInternalWorkerMutation,
  optionalWorkerId,
  optionalWorkerInteger,
} from "@/lib/security/internal-worker-mutation-boundary";

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function buildDurableComputationAlertRouteHealth(summary: unknown) {
  if (!summary || typeof summary !== "object") {
    return { ok: false, severity: "critical" as const, reasonCodes: ["telemetry_schema_invalid"] };
  }
  const row = summary as Record<string, unknown>;
  const values = [row.claimed, row.delivered, row.retryWait, row.deadLetter, row.conflicts, row.storeFailed];
  if (
    typeof row.configured !== "boolean"
    || !values.every(nonNegativeInteger)
    || row.claimed !== Number(row.delivered) + Number(row.retryWait) + Number(row.deadLetter) + Number(row.conflicts) + Number(row.storeFailed)
  ) {
    return { ok: false, severity: "critical" as const, reasonCodes: ["telemetry_schema_invalid"] };
  }
  const reasonCodes = [
    ...(!row.configured ? ["alert_sink_not_configured"] : []),
    ...(Number(row.retryWait) > 0 ? ["alert_retry_nonzero"] : []),
    ...(Number(row.deadLetter) > 0 ? ["alert_dead_letter_nonzero"] : []),
    ...(Number(row.conflicts) > 0 ? ["alert_settlement_conflict_nonzero"] : []),
    ...(Number(row.storeFailed) > 0 ? ["alert_settlement_store_failure_nonzero"] : []),
    ...(row.delivered !== row.claimed ? ["alert_delivery_incomplete"] : []),
  ];
  return {
    ok: reasonCodes.length === 0,
    severity: reasonCodes.length === 0 ? "none" as const : "critical" as const,
    reasonCodes,
  };
}

export async function POST(request: Request) {
  const authorized = await authorizeInternalWorkerMutation(request, { keyPrefix: "durable-computation-alert-worker" });
  if (!authorized.ok) return authorized.response;
  const guard = assertExactWorkerBodyKeys(authorized.body, ["action", "limit", "leaseSeconds", "timeoutMs", "workerId"]);
  if (guard) return guard;
  if (authorized.body.action !== undefined && authorized.body.action !== "run") return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
  const limit = optionalWorkerInteger(authorized.body, "limit", { min: 1, max: 100 });
  if (!limit.ok) return limit.response;
  const leaseSeconds = optionalWorkerInteger(authorized.body, "leaseSeconds", { min: 15, max: 600 });
  if (!leaseSeconds.ok) return leaseSeconds.response;
  const timeoutMs = optionalWorkerInteger(authorized.body, "timeoutMs", { min: 250, max: 30_000 });
  if (!timeoutMs.ok) return timeoutMs.response;
  const workerId = optionalWorkerId(authorized.body, "workerId");
  if (!workerId.ok) return workerId.response;
  try {
    const summary = await runDurableComputationAlertDelivery({
      limit: limit.value ?? 10,
      leaseSeconds: leaseSeconds.value ?? 60,
      timeoutMs: timeoutMs.value ?? 5000,
      workerId: workerId.value,
    });
    const health = buildDurableComputationAlertRouteHealth(summary);
    return NextResponse.json({ ok: health.ok, health, summary }, { status: health.ok ? 200 : 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow, noarchive" } });
  } catch {
    return NextResponse.json({ ok: false, retryable: true, error: "durable_computation_alert_delivery_unavailable", readiness: buildDurableComputationAlertDeliveryReadiness() }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
