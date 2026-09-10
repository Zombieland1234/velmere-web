import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import {
  authorizeMarketIntegrityWorkerMutation,
  marketIntegrityWorkerMutationErrorStatus,
  verifyMarketIntegrityWorkerMutationEnvelope,
} from "@/lib/security/market-integrity-cron-auth";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

function denied(reason: string, status: number) {
  return securityJson(
    { ok: false, error: "unauthorized_worker_mutation", reason },
    { status },
  );
}

export async function authorizeInternalWorkerMutation(
  request: Request,
  options: { keyPrefix: string; maxBytes?: number },
) {
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(
    request,
    options.maxBytes ?? 16 * 1024,
    {
      maxDepth: 8,
      requireObject: true,
      rejectDuplicateKeys: true,
      rejectDangerousKeys: true,
    },
  );
  if (!parsed.ok) return { ok: false as const, response: parsed.response };

  const verified = verifyMarketIntegrityWorkerMutationEnvelope({
    request,
    rawBody: parsed.raw,
  });
  if (!verified.authorized) {
    return {
      ok: false as const,
      response: denied(
        verified.error,
        marketIntegrityWorkerMutationErrorStatus(verified.error),
      ),
    };
  }

  const rate = await applyApiRateLimit(request, {
    keyPrefix: options.keyPrefix,
    limit: 12,
    windowMs: 60_000,
  });
  if (!rate.ok) return { ok: false as const, response: rate.response };

  const consumed = await authorizeMarketIntegrityWorkerMutation({
    request,
    rawBody: parsed.raw,
  });
  if (!consumed.authorized) {
    return {
      ok: false as const,
      response: denied(
        consumed.error,
        marketIntegrityWorkerMutationErrorStatus(consumed.error),
      ),
    };
  }
  return {
    ok: true as const,
    body: parsed.value,
    authorization: consumed,
  };
}

export function assertExactWorkerBodyKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(body).filter((key) => !allowedSet.has(key));
  return unknown.length
    ? securityJson(
        { ok: false, error: "worker_body_unknown_fields", fields: unknown.sort() },
        { status: 400 },
      )
    : null;
}

export function optionalWorkerInteger(
  body: Record<string, unknown>,
  name: string,
  limits: { min: number; max: number },
) {
  const value = body[name];
  if (value === undefined) return { ok: true as const, value: undefined };
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < limits.min ||
    value > limits.max
  ) {
    return {
      ok: false as const,
      response: securityJson(
        { ok: false, error: "worker_body_integer_invalid", field: name },
        { status: 400 },
      ),
    };
  }
  return { ok: true as const, value };
}

export function optionalWorkerId(
  body: Record<string, unknown>,
  name: string,
  maxLength = 120,
) {
  const value = body[name];
  if (value === undefined) return { ok: true as const, value: undefined };
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    !/^[A-Za-z0-9._:@-]+$/u.test(value)
  ) {
    return {
      ok: false as const,
      response: securityJson(
        { ok: false, error: "worker_body_identifier_invalid", field: name },
        { status: 400 },
      ),
    };
  }
  return { ok: true as const, value };
}
