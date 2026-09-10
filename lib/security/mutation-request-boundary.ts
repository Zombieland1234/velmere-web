import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectOversizedUrl,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const PASS4681_MUTATION_REQUEST_BOUNDARY_ID =
  "pass4681-active-mutation-request-boundary-v1" as const;

export type Pass4681MutationJsonOptions = {
  keyPrefix: string;
  maxBytes: number;
  maxDepth?: number;
  rateLimit?: number;
  windowMs?: number;
  maxUrlLength?: number;
  allowMissingOrigin?: boolean;
};

export type Pass4681MutationJsonResult<T> =
  | {
      ok: true;
      value: T;
      byteLength: number;
      rateLimitRemaining: number;
      boundaryId: typeof PASS4681_MUTATION_REQUEST_BOUNDARY_ID;
    }
  | { ok: false; response: Response };

function stampBoundary(response: Response, mode: string) {
  response.headers.set(
    "x-velmere-mutation-boundary",
    PASS4681_MUTATION_REQUEST_BOUNDARY_ID,
  );
  response.headers.set("x-velmere-mutation-boundary-mode", mode);
  response.headers.set("cache-control", "no-store");
  return response;
}

/**
 * Shared fail-closed boundary for same-origin browser mutations.
 *
 * The helper intentionally validates the URL, Origin, rate limit and actual
 * streamed JSON byte count before a route receives the parsed value. It also
 * inherits duplicate-key, dangerous-key, UTF-8 and nesting checks from the
 * central bounded JSON reader.
 */
export async function readPublicMutationJsonBody<T>(
  request: Request,
  options: Pass4681MutationJsonOptions,
): Promise<Pass4681MutationJsonResult<T>> {
  const urlGuard = rejectOversizedUrl(request, options.maxUrlLength ?? 2_048);
  if (urlGuard) {
    return { ok: false, response: stampBoundary(urlGuard, "url_rejected") };
  }

  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin:
      options.allowMissingOrigin ?? process.env.NODE_ENV !== "production",
  });
  if (originGuard) {
    return {
      ok: false,
      response: stampBoundary(originGuard, "origin_rejected"),
    };
  }

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: options.keyPrefix,
    limit: options.rateLimit ?? 30,
    windowMs: options.windowMs ?? 60_000,
  });
  if (!rateLimit.ok) {
    return {
      ok: false,
      response: stampBoundary(rateLimit.response, "rate_limited"),
    };
  }

  const parsed = await readBoundedJsonBody<T>(request, options.maxBytes, {
    maxDepth: options.maxDepth ?? 16,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      response: stampBoundary(parsed.response, "body_rejected"),
    };
  }

  return {
    ok: true,
    value: parsed.value,
    byteLength: parsed.byteLength,
    rateLimitRemaining: rateLimit.remaining,
    boundaryId: PASS4681_MUTATION_REQUEST_BOUNDARY_ID,
  };
}
