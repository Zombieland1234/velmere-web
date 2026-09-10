import { applyApiRateLimit } from "@/lib/security/api-guard";

export type GuardrailRoute =
  | "investigator"
  | "evidence-export"
  | "source-snapshots"
  | "market-integrity";

export type RateLimitResult = {
  ok: boolean;
  route: GuardrailRoute;
  key: string;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
  status: number;
  mode: string;
  response: Response | null;
};

function routeLimit(route: GuardrailRoute) {
  if (route === "evidence-export") return { limit: 16, windowMs: 10 * 60 * 1000 };
  if (route === "investigator") return { limit: 120, windowMs: 10 * 60 * 1000 };
  if (route === "source-snapshots") return { limit: 120, windowMs: 10 * 60 * 1000 };
  return { limit: 180, windowMs: 10 * 60 * 1000 };
}

function headerInteger(headers: Headers, name: string, fallback: number) {
  const value = Number(headers.get(name));
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export async function checkRateLimit(request: Request, route: GuardrailRoute): Promise<RateLimitResult> {
  const { limit, windowMs } = routeLimit(route);
  const result = await applyApiRateLimit(request, {
    keyPrefix: `market-integrity:${route}`,
    limit,
    windowMs,
  });
  if (!result.ok) {
    const headers = result.response.headers;
    headers.set("cache-control", "no-store");
    headers.set("x-velmere-shield", "api-guarded");
    const resetEpochSeconds = headerInteger(headers, "x-ratelimit-reset", Math.ceil(Date.now() / 1000) + 60);
    return {
      ok: false,
      route,
      key: `market-integrity:${route}:blocked`,
      limit: headerInteger(headers, "x-ratelimit-limit", limit),
      remaining: headerInteger(headers, "x-ratelimit-remaining", 0),
      resetAt: new Date(resetEpochSeconds * 1000).toISOString(),
      retryAfterSeconds: headerInteger(headers, "retry-after", 60),
      status: result.response.status,
      mode: headers.get("x-velmere-rate-limit-mode") ?? "trusted_client_or_durable_rate_limit_unavailable",
      response: result.response,
    };
  }
  return {
    ok: true,
    route,
    key: result.decision.boundaryKey,
    limit: result.decision.limit,
    remaining: result.decision.remaining,
    resetAt: new Date(result.decision.resetAt).toISOString(),
    retryAfterSeconds: 0,
    status: 200,
    mode: result.decision.mode,
    response: null,
  };
}

export function guardrailHeaders(rateLimit: RateLimitResult) {
  return {
    "cache-control": "no-store",
    "x-velmere-shield": "api-guarded",
    "x-ratelimit-limit": String(rateLimit.limit),
    "x-ratelimit-remaining": String(rateLimit.remaining),
    "x-ratelimit-reset": String(Math.ceil(Date.parse(rateLimit.resetAt) / 1000)),
    "x-velmere-rate-limit-mode": rateLimit.mode,
    ...(rateLimit.ok ? {} : { "retry-after": String(rateLimit.retryAfterSeconds) }),
  };
}

export function noStoreHeaders(extra: Record<string, string> = {}) {
  return {
    "cache-control": "no-store",
    "x-velmere-shield": "no-store",
    ...extra,
  };
}
