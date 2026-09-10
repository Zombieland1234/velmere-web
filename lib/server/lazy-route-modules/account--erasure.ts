import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildClearedVelmereAccountCookie,
  resolveRequestAccount,
  type VelmereResolvedAccount,
} from "@/lib/auth/account-session";
import {
  buildClearedAuthSessionFamilyCookieHeaders,
} from "@/lib/auth/auth-session-family";
import {
  revokeSupabaseCookieSession,
} from "@/lib/auth/supabase-auth-session";
import {
  appendSetCookieHeaders,
  buildClearedSupabaseAuthCookieHeaders,
} from "@/lib/auth/supabase-auth-cookies";
import {
  buildAccountErasureRevocationReceipt,
  buildPublicAccountErasureMetadata,
  cancelAccountErasure,
  confirmAccountErasureSessionRevocation,
  hashAccountErasureIdempotencyKey,
  isAccountErasureRequestId,
  readLatestAccountErasure,
  requestAccountErasure,
  type AccountErasureRecord,
  type AccountErasureSessionRevocation,
} from "@/lib/account/account-erasure";
import {
  CustomerOwnedWriteBoundaryError,
  customerOwnedDataErrorPayload,
  resolveCustomerOwnedDataBoundary,
  type CustomerOwnedDataBoundary,
} from "@/lib/db/customer-owned-write-boundary";
import { BoundedSupabaseRpcError } from "@/lib/db/bounded-supabase-rpc";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import { isProductionLikeEnvironment, validateExactObjectKeys, validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  vary: "Cookie, Authorization",
  "x-content-type-options": "nosniff",
} as const;

type RouteRateLimitResult = { ok: true } | { ok: false; response: Response };
type ErasureAction = "request" | "cancel" | "status";

export type AccountErasureRouteDependencies = {
  resolveAccount: (request: Request) => Promise<VelmereResolvedAccount | null>;
  resolveBoundary: (input: { request: Request; accountId: string }) => Promise<CustomerOwnedDataBoundary>;
  applyRateLimit: (request: Request, operation: ErasureAction) => Promise<RouteRateLimitResult>;
  requestErasure: (input: {
    request: Request;
    client: CustomerOwnedDataBoundary["client"];
    requestId: string;
    accountId: string;
    idempotencyKeyHash: string;
  }) => Promise<AccountErasureRecord>;
  cancelErasure: (input: {
    request: Request;
    client: CustomerOwnedDataBoundary["client"];
    requestId: string;
    accountId: string;
  }) => Promise<AccountErasureRecord>;
  readErasure: (input: {
    client: CustomerOwnedDataBoundary["client"];
    accountId: string;
    requestId?: string;
  }) => Promise<AccountErasureRecord | null>;
  revokeSessions: (request: Request) => Promise<AccountErasureSessionRevocation>;
  confirmRevocation: (input: { record: AccountErasureRecord; receiptSha256: string }) => Promise<AccountErasureRecord>;
  requestId: () => string;
};

const defaultDependencies: AccountErasureRouteDependencies = {
  resolveAccount: resolveRequestAccount,
  resolveBoundary: resolveCustomerOwnedDataBoundary,
  applyRateLimit: async (request, operation) => applyApiRateLimit(request, {
    keyPrefix: `account-erasure-${operation}`,
    limit: operation === "status" ? 30 : 5,
    windowMs: 60_000,
  }),
  requestErasure: requestAccountErasure,
  cancelErasure: cancelAccountErasure,
  readErasure: readLatestAccountErasure,
  revokeSessions: revokeSupabaseCookieSession,
  confirmRevocation: confirmAccountErasureSessionRevocation,
  requestId: randomUUID,
};

function jsonError(error: string, status: number, retryable = false, extra?: Record<string, unknown>) {
  return NextResponse.json({
    schemaVersion: "velmere.public-account-erasure-error.v1",
    ok: false,
    error,
    retryable,
    dataDeleted: false,
    legalDeletionClaimed: false,
    ...extra,
  }, { status, headers: PRIVATE_HEADERS });
}

function appendClearedSessionCookies(response: Response) {
  response.headers.append("Set-Cookie", buildClearedVelmereAccountCookie());
  appendSetCookieHeaders(response.headers, buildClearedSupabaseAuthCookieHeaders());
  appendSetCookieHeaders(response.headers, buildClearedAuthSessionFamilyCookieHeaders());
}

async function resolveOwnerBoundary(
  request: Request,
  dependencies: AccountErasureRouteDependencies,
) {
  const account = await dependencies.resolveAccount(request);
  if (!account || account.accountId.startsWith("preview:")) {
    return { response: jsonError("account_session_required", 401) } as const;
  }
  try {
    const boundary = await dependencies.resolveBoundary({ request, accountId: account.accountId });
    if (boundary.accountId !== account.accountId) {
      return { response: jsonError("account_erasure_auth_required", 403) } as const;
    }
    return { account, boundary } as const;
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return {
        response: NextResponse.json({
          ...customerOwnedDataErrorPayload(error, "write"),
          schemaVersion: "velmere.public-account-erasure-error.v1",
          ok: false,
          dataDeleted: false,
          legalDeletionClaimed: false,
        }, { status: error.httpStatus, headers: PRIVATE_HEADERS }),
      } as const;
    }
    return { response: jsonError("account_erasure_auth_unavailable", 503, true) } as const;
  }
}

function storageError(error: unknown) {
  if (error instanceof BoundedSupabaseRpcError) {
    if (error.providerCode === "VE001") return jsonError("account_export_required_before_erasure", 409);
    if (error.providerCode === "VE002") return jsonError("account_erasure_recent_auth_required", 401);
    if (error.providerCode === "VE003") return jsonError("account_erasure_active_request_exists", 409);
    if (error.providerCode === "VE004") return jsonError("account_erasure_request_cancelled", 409);
    if (error.providerCode === "VE005") return jsonError("account_erasure_request_not_found", 404);
  }
  return jsonError("account_erasure_storage_unavailable", 503, true);
}

type Body = {
  action?: unknown;
  idempotencyKey?: unknown;
  confirmation?: unknown;
  requestId?: unknown;
};

export async function handleAccountErasurePost(
  request: Request,
  dependencies: AccountErasureRouteDependencies = defaultDependencies,
) {
  const sizeGuard = rejectLargeContentLength(request, 4096);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin: !isProductionLikeEnvironment(),
  });
  if (originGuard) return originGuard;
  const parsed = await readBoundedJsonBody<unknown>(request, 4096, { maxDepth: 4 });
  if (!parsed.ok) return parsed.response;
  const exact = validateExactObjectKeys(parsed.value, ["action", "idempotencyKey", "confirmation", "requestId"]);
  if (!exact.ok) return exact.response;
  const body = parsed.value as Body;
  if (body.action !== "request" && body.action !== "cancel") {
    return jsonError("invalid_account_erasure_request", 400);
  }
  const limited = await dependencies.applyRateLimit(request, body.action);
  if (!limited.ok) return limited.response;

  if (body.action === "request") {
    if (typeof body.idempotencyKey !== "string"
        || body.confirmation !== "DELETE MY ACCOUNT"
        || body.requestId !== undefined) {
      return jsonError("invalid_account_erasure_request", 400);
    }
    const owner = await resolveOwnerBoundary(request, dependencies);
    if ("response" in owner) return owner.response;
    let idempotencyKeyHash: string;
    try {
      idempotencyKeyHash = hashAccountErasureIdempotencyKey(owner.account.accountId, body.idempotencyKey);
    } catch {
      return jsonError("invalid_account_erasure_request", 400);
    }

    let record: AccountErasureRecord;
    try {
      record = await dependencies.requestErasure({
        request,
        client: owner.boundary.client,
        requestId: dependencies.requestId(),
        accountId: owner.account.accountId,
        idempotencyKeyHash,
      });
    } catch (error) {
      return storageError(error);
    }
    if (record.state === "CANCELLED") {
      return jsonError("account_erasure_request_cancelled", 409);
    }

    let revocation: AccountErasureSessionRevocation;
    try {
      revocation = await dependencies.revokeSessions(request);
    } catch {
      const response = jsonError("account_erasure_session_revocation_unavailable", 503, true, {
        requestId: record.requestId,
        status: record.state,
      });
      // The revocation adapter can fail after a partial durable transition.
      // Clear browser credentials on every uncertain outcome; the request stays
      // SESSION_REVOCATION_PENDING and the customer can reauthenticate to retry.
      appendClearedSessionCookies(response);
      return response;
    }
    if (!revocation.providerRevoked || !revocation.localRevoked || revocation.reason !== "revoked") {
      const response = jsonError("account_erasure_session_revocation_incomplete", 503, true, {
        requestId: record.requestId,
        status: "SESSION_REVOCATION_PENDING",
      });
      if (revocation.providerRevoked || revocation.localRevoked) appendClearedSessionCookies(response);
      return response;
    }

    let confirmed: AccountErasureRecord;
    try {
      const receiptSha256 = buildAccountErasureRevocationReceipt(record, revocation);
      confirmed = await dependencies.confirmRevocation({ record, receiptSha256 });
      if (confirmed.state !== "POLICY_BLOCKED" || confirmed.sessionRevocationState !== "CONFIRMED") {
        throw new Error("account_erasure_revocation_confirmation_invalid");
      }
    } catch {
      const response = jsonError("account_erasure_session_confirmation_unavailable", 503, true, {
        requestId: record.requestId,
        status: "SESSION_REVOCATION_PENDING",
      });
      appendClearedSessionCookies(response);
      return response;
    }

    const response = NextResponse.json({
      ok: true,
      ...buildPublicAccountErasureMetadata(confirmed),
    }, { status: 202, headers: PRIVATE_HEADERS });
    appendClearedSessionCookies(response);
    return response;
  }

  if (typeof body.requestId !== "string"
      || !isAccountErasureRequestId(body.requestId)
      || body.confirmation !== "CANCEL ACCOUNT DELETION"
      || body.idempotencyKey !== undefined) {
    return jsonError("invalid_account_erasure_request", 400);
  }
  const owner = await resolveOwnerBoundary(request, dependencies);
  if ("response" in owner) return owner.response;
  try {
    const record = await dependencies.cancelErasure({
      request,
      client: owner.boundary.client,
      requestId: body.requestId,
      accountId: owner.account.accountId,
    });
    return NextResponse.json({
      ok: true,
      ...buildPublicAccountErasureMetadata(record),
    }, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    return storageError(error);
  }
}

export async function handleAccountErasureGet(
  request: Request,
  dependencies: AccountErasureRouteDependencies = defaultDependencies,
) {
  const sizeGuard = rejectLargeContentLength(request, 4096);
  if (sizeGuard) return sizeGuard;
  const url = new URL(request.url);
  const exact = validateExactSearchParams(url, ["id"]);
  if (!exact.ok) return exact.response;
  const requestId = exact.values.id?.trim() || undefined;
  if (requestId !== undefined && !isAccountErasureRequestId(requestId)) {
    return jsonError("invalid_account_erasure_request", 400);
  }
  const limited = await dependencies.applyRateLimit(request, "status");
  if (!limited.ok) return limited.response;
  const owner = await resolveOwnerBoundary(request, dependencies);
  if ("response" in owner) return owner.response;
  try {
    const record = await dependencies.readErasure({
      client: owner.boundary.client,
      accountId: owner.account.accountId,
      requestId,
    });
    if (!record) return jsonError("account_erasure_request_not_found", 404);
    return NextResponse.json({
      ok: true,
      ...buildPublicAccountErasureMetadata(record),
    }, { status: 200, headers: PRIVATE_HEADERS });
  } catch {
    return jsonError("account_erasure_read_unavailable", 503, true);
  }
}

export function GET(request: Request) {
  return handleAccountErasureGet(request);
}

export function POST(request: Request) {
  return handleAccountErasurePost(request);
}
