import { timingSafeEqual } from "node:crypto";
import { applyVlmPaidEntitlementLifecycleEvent, type VlmPaidEntitlementLifecycleEvent } from "@/lib/commerce/vlm-entitlement-lifecycle";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { securityJson } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LifecycleBody = {
  entitlementId?: unknown;
  eventId?: unknown;
  event?: unknown;
  sourceEventId?: unknown;
  operatorId?: unknown;
  reason?: unknown;
};

function secretMatches(request: Request) {
  const expected = process.env.VELMERE_ENTITLEMENT_LIFECYCLE_SECRET?.trim() ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function eventValue(value: unknown): VlmPaidEntitlementLifecycleEvent | null {
  return value === "expire" || value === "refund" || value === "chargeback" || value === "manual_revoke" || value === "restore" ? value : null;
}

export async function POST(request: Request) {
  if (!secretMatches(request)) return securityJson({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = await readBoundedJsonBody<LifecycleBody>(request, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const event = eventValue(parsed.value.event);
  if (!event) return securityJson({ ok: false, error: "invalid_lifecycle_event" }, { status: 400 });
  const result = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: typeof parsed.value.entitlementId === "string" ? parsed.value.entitlementId : "",
    eventId: typeof parsed.value.eventId === "string" ? parsed.value.eventId : "",
    event,
    sourceEventId: typeof parsed.value.sourceEventId === "string" ? parsed.value.sourceEventId : null,
    operatorId: typeof parsed.value.operatorId === "string" ? parsed.value.operatorId : null,
    reason: typeof parsed.value.reason === "string" ? parsed.value.reason : null,
  });
  const status = result.ok ? 200 : result.retryable ? 503 : result.error === "entitlement_not_found" ? 404 : 409;
  return securityJson(result, { status });
}
