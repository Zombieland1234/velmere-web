import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveRequestAccount, type VelmereResolvedAccount } from "@/lib/auth/account-session";
import {
  buildAccountDataExportDelivery,
  buildPublicAccountDataExportMetadata,
  hashAccountDataExportIdempotencyKey,
  isAccountDataExportId,
  readAccountDataExport,
  requestAccountDataExport,
  type AccountDataExportRecord,
} from "@/lib/account/account-data-export";
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

export type AccountDataExportRouteDependencies = {
  resolveAccount: (request: Request) => Promise<VelmereResolvedAccount | null>;
  resolveBoundary: (input: { request: Request; accountId: string }) => Promise<CustomerOwnedDataBoundary>;
  applyRateLimit: (request: Request, operation: "create" | "read") => Promise<RouteRateLimitResult>;
  requestExport: (input: {
    request: Request;
    client: CustomerOwnedDataBoundary["client"];
    exportId: string;
    accountId: string;
    idempotencyKeyHash: string;
  }) => Promise<AccountDataExportRecord>;
  readExport: (input: {
    client: CustomerOwnedDataBoundary["client"];
    exportId: string;
    accountId: string;
  }) => Promise<AccountDataExportRecord | null>;
  now: () => Date;
};

const defaultDependencies: AccountDataExportRouteDependencies = {
  resolveAccount: resolveRequestAccount,
  resolveBoundary: resolveCustomerOwnedDataBoundary,
  applyRateLimit: async (request, operation) => applyApiRateLimit(request, {
    keyPrefix: `account-data-export-${operation}`,
    limit: operation === "create" ? 5 : 60,
    windowMs: 60_000,
  }),
  requestExport: requestAccountDataExport,
  readExport: readAccountDataExport,
  now: () => new Date(),
};

function jsonError(error: string, status: number, retryable = false, extra?: Record<string, unknown>) {
  return NextResponse.json({
    schemaVersion: "velmere.public-account-data-export-error.v1",
    ok: false,
    error,
    retryable,
    ...extra,
  }, { status, headers: PRIVATE_HEADERS });
}

async function resolveOwnerBoundary(
  request: Request,
  dependencies: AccountDataExportRouteDependencies,
) {
  const account = await dependencies.resolveAccount(request);
  if (!account || account.accountId.startsWith("preview:")) {
    return { response: jsonError("account_session_required", 401) } as const;
  }
  try {
    const boundary = await dependencies.resolveBoundary({ request, accountId: account.accountId });
    if (boundary.accountId !== account.accountId) {
      return { response: jsonError("account_data_auth_required", 403) } as const;
    }
    return { account, boundary } as const;
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return {
        response: NextResponse.json(customerOwnedDataErrorPayload(error, "read"), {
          status: error.httpStatus,
          headers: PRIVATE_HEADERS,
        }),
      } as const;
    }
    return { response: jsonError("account_data_auth_unavailable", 503, true) } as const;
  }
}

export async function handleAccountDataExportPost(
  request: Request,
  dependencies: AccountDataExportRouteDependencies = defaultDependencies,
) {
  const sizeGuard = rejectLargeContentLength(request, 4096);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin: !isProductionLikeEnvironment(),
  });
  if (originGuard) return originGuard;
  const limited = await dependencies.applyRateLimit(request, "create");
  if (!limited.ok) return limited.response;

  const parsed = await readBoundedJsonBody<unknown>(request, 4096, { maxDepth: 4 });
  if (!parsed.ok) return parsed.response;
  const exact = validateExactObjectKeys(parsed.value, ["idempotencyKey"]);
  if (!exact.ok) return exact.response;
  const body = parsed.value as { idempotencyKey?: unknown };
  if (typeof body.idempotencyKey !== "string") {
    return jsonError("invalid_account_export_request", 400);
  }

  const owner = await resolveOwnerBoundary(request, dependencies);
  if ("response" in owner) return owner.response;
  let idempotencyKeyHash: string;
  try {
    idempotencyKeyHash = hashAccountDataExportIdempotencyKey(
      owner.account.accountId,
      body.idempotencyKey,
    );
  } catch {
    return jsonError("invalid_account_export_request", 400);
  }

  try {
    const record = await dependencies.requestExport({
      request,
      client: owner.boundary.client,
      exportId: randomUUID(),
      accountId: owner.account.accountId,
      idempotencyKeyHash,
    });
    if (Date.parse(record.expiresAt) <= dependencies.now().getTime()) {
      return jsonError("account_export_not_available", 409);
    }
    return NextResponse.json({
      ok: true,
      ...buildPublicAccountDataExportMetadata(record),
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof BoundedSupabaseRpcError && error.providerCode === "P0001") {
      return jsonError("account_export_rate_limited", 429, true, { retryAfterSeconds: 60 });
    }
    if (error instanceof BoundedSupabaseRpcError && error.providerCode === "54000") {
      return jsonError("account_export_scope_exceeds_current_bound", 409, false);
    }
    return jsonError("account_export_creation_unavailable", 503, true);
  }
}

export async function handleAccountDataExportGet(
  request: Request,
  dependencies: AccountDataExportRouteDependencies = defaultDependencies,
) {
  const sizeGuard = rejectLargeContentLength(request, 4096);
  if (sizeGuard) return sizeGuard;
  const url = new URL(request.url);
  const exact = validateExactSearchParams(url, ["id", "disposition"]);
  if (!exact.ok) return exact.response;
  const exportId = String(exact.values.id ?? "").trim();
  const disposition = exact.values.disposition ?? "metadata";
  if (!isAccountDataExportId(exportId)) {
    return jsonError("invalid_account_export_request", 400);
  }
  if (disposition !== "metadata" && disposition !== "preview" && disposition !== "download") {
    return jsonError("invalid_account_export_request", 400);
  }
  const limited = await dependencies.applyRateLimit(request, "read");
  if (!limited.ok) return limited.response;

  const owner = await resolveOwnerBoundary(request, dependencies);
  if ("response" in owner) return owner.response;
  let record: AccountDataExportRecord | null;
  try {
    record = await dependencies.readExport({
      client: owner.boundary.client,
      exportId,
      accountId: owner.account.accountId,
    });
  } catch {
    return jsonError("account_export_read_unavailable", 503, true);
  }
  if (!record || Date.parse(record.expiresAt) <= dependencies.now().getTime()) {
    return jsonError("account_export_not_available", 404);
  }
  if (disposition === "metadata") {
    return NextResponse.json({
      ok: true,
      ...buildPublicAccountDataExportMetadata(record),
    }, { status: 200, headers: PRIVATE_HEADERS });
  }

  try {
    const delivery = buildAccountDataExportDelivery(
      record,
      disposition === "preview" ? "inline" : "attachment",
    );
    return new NextResponse(delivery.bytes as BodyInit, {
      status: 200,
      headers: delivery.headers,
    });
  } catch {
    return jsonError("account_export_integrity_unavailable", 409);
  }
}

export function GET(request: Request) {
  return handleAccountDataExportGet(request);
}

export function POST(request: Request) {
  return handleAccountDataExportPost(request);
}
