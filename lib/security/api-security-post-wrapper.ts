import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
} from "@/lib/security/durable-rate-limit";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { Pass4824AuditProviderBudgetError } from "@/lib/security/audit-provider-budget";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";

export const PASS4281_API_SECURITY_POST_WRAPPER_ID =
  "PASS4281_API_SECURITY_POST_WRAPPER" as const;

export const PASS4281_API_SECURITY_POST_WRAPPER_SCHEMA =
  "velmere.pass4281.api_security_post_wrapper.v1" as const;

export type Pass4281AuditPostGuardOptions = {
  readonly routeId: string;
  readonly maxBytes?: number;
  readonly limit?: number;
  readonly windowMs?: number;
  readonly allowMissingOrigin?: boolean;
};

export type Pass4281AuditJsonResult<T extends object> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

export function buildPass4281AuditPostHeaders(routeId: string) {
  return {
    "cache-control": "no-store",
    "x-velmere-api-security-post-wrapper": PASS4281_API_SECURITY_POST_WRAPPER_ID,
    "x-velmere-pass4281-route-id": routeId,
    "x-velmere-no-seed-phrase": "true",
    "x-velmere-no-exploit-instructions": "true",
  } as const;
}

export async function guardPass4281AuditPostRequest(
  request: Request,
  options: Pass4281AuditPostGuardOptions,
) {
  if (request.method !== "POST") return null;

  const routeId = options.routeId.trim() || "audit-route";
  const maxBytes = Math.max(1_024, options.maxBytes ?? 32_768);
  const sizeGuard = rejectLargeContentLength(request, maxBytes);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin: options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
  });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: `pass4281:${routeId}`,
    limit: Math.max(1, options.limit ?? 30),
    windowMs: Math.max(1_000, options.windowMs ?? 60_000),
  });
  if (!rateLimit.ok) return rateLimit.response;

  const account = await resolveRequestAccount(request);
  if (!account) {
    return securityJson(
      { ok: false, mode: "account_session_required", routeId },
      { status: 401, headers: buildPass4281AuditPostHeaders(routeId) },
    );
  }

  const accountRateLimit = await applyDurableRateLimit({
    namespace: "pass4281:audit-provider-post-account-quota",
    key: `${routeId}:${hashVelmereAccountBinding(account.accountId)}`,
    limit: Math.max(1, Math.min(options.limit ?? 30, 12)),
    windowMs: Math.max(1_000, options.windowMs ?? 60_000),
  });
  if (!accountRateLimit.ok) {
    const unavailable = accountRateLimit.mode === "unavailable"
      || accountRateLimit.reason === "rate_limit_store_unavailable";
    return securityJson(
      {
        ok: false,
        mode: unavailable ? "rate_limit_storage_unavailable" : "audit_provider_account_quota_exceeded",
        routeId,
      },
      {
        status: unavailable ? 503 : 429,
        headers: {
          ...buildDurableRateLimitHeaders(accountRateLimit),
          ...buildPass4281AuditPostHeaders(routeId),
        },
      },
    );
  }

  return null;
}

export function withPass4281AuditPostBudget(
  request: Request,
  handler: () => Promise<Response>,
) {
  return withExpensiveRouteBudget(request, "audit_provider_post", async () => {
    try {
      return await handler();
    } catch (error) {
      if (!(error instanceof Pass4824AuditProviderBudgetError)) throw error;
      return securityJson(
        {
          ok: false,
          mode: error.message,
          providerId: error.providerId,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: error.status,
          headers: {
            ...buildDurableRateLimitHeaders(error.decision),
            "cache-control": "no-store",
            "retry-after": String(error.retryAfterSeconds),
          },
        },
      );
    }
  });
}

export async function readPass4281AuditJson<T extends object>(
  request: Request,
  options: { routeId: string; maxBytes?: number; maxDepth?: number },
): Promise<Pass4281AuditJsonResult<T>> {
  const routeId = options.routeId.trim() || "audit-route";
  if (request.method !== "POST") {
    return { ok: false, response: pass4281MalformedJsonResponse(routeId) };
  }
  const parsed = await readBoundedJsonBody<unknown>(
    request,
    Math.max(1_024, Math.min(options.maxBytes ?? 32_768, 1_048_576)),
    { maxDepth: Math.max(2, Math.min(options.maxDepth ?? 12, 32)) },
  );
  if (!parsed.ok) {
    return {
      ok: false,
      response: parsed.response.status === 400
        ? pass4281MalformedJsonResponse(routeId)
        : parsed.response,
    };
  }
  const value = parsed.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, response: pass4281MalformedJsonResponse(routeId) };
  }
  return { ok: true, value: value as T };
}

export function pass4281MalformedJsonResponse(routeId: string) {
  return securityJson(
    {
      ok: false,
      mode: "malformed_json",
      routeId,
      remediation: "Send a bounded JSON object payload or use GET query parameters for sample/read-only audit previews.",
    },
    {
      status: 400,
      headers: buildPass4281AuditPostHeaders(routeId),
    },
  );
}
