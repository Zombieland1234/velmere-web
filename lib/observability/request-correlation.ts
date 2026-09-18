import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";

const SAFE_REQUEST_CORRELATION_ID = /^req_[a-f0-9]{32}$/;

export function normalizeRequestCorrelationId(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SAFE_REQUEST_CORRELATION_ID.test(normalized) ? normalized : null;
}

export function resolveRequestCorrelationId(request?: Request | null) {
  const forwarded = request?.headers.get("x-correlation-id")
    ?? request?.headers.get("x-request-id")
    ?? null;
  return normalizeRequestCorrelationId(forwarded) ?? createSecureRuntimeId("req");
}

export function withRequestCorrelation(response: Response, correlationId: string) {
  const safe = normalizeRequestCorrelationId(correlationId) ?? createSecureRuntimeId("req");
  try {
    response.headers.set("x-correlation-id", safe);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("x-correlation-id", safe);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
