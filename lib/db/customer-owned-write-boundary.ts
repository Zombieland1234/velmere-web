import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseUserClientForRequest,
  type SupabaseUserClientResolution,
} from "@/lib/db/supabase";
import {
  BoundedSupabaseRpcError,
  runBoundedSupabaseRpc,
  type SupabaseRpcClient,
} from "@/lib/db/bounded-supabase-rpc";

export type CustomerOwnedWriteBoundaryState =
  | "ready"
  | "missing_token"
  | "invalid_token"
  | "missing_public_config"
  | "account_unbound"
  | "account_mismatch"
  | "binding_unavailable";

export type CustomerOwnedWriteBoundary = {
  schemaVersion: "velmere.customer-owned-write-boundary.v1";
  state: "ready";
  accountId: string;
  client: SupabaseClient;
  rlsEnforced: true;
  serviceRoleUsed: false;
};

export class CustomerOwnedWriteBoundaryError extends Error {
  readonly code: Exclude<CustomerOwnedWriteBoundaryState, "ready">;
  readonly httpStatus: 401 | 403 | 503;

  constructor(code: CustomerOwnedWriteBoundaryError["code"]) {
    super(`customer_owned_write:${code}`);
    this.name = "CustomerOwnedWriteBoundaryError";
    this.code = code;
    this.httpStatus = code === "missing_token" || code === "invalid_token"
      ? 401
      : code === "account_unbound" || code === "account_mismatch"
        ? 403
        : 503;
  }
}

export type CustomerOwnedWriteBoundaryDependencies = {
  resolveUserClient: (request: Request) => SupabaseUserClientResolution;
  resolveBoundAccountId: (input: {
    request: Request;
    client: SupabaseRpcClient;
  }) => Promise<unknown>;
};

export const customerOwnedWriteBoundaryDependencies: CustomerOwnedWriteBoundaryDependencies = {
  resolveUserClient: getSupabaseUserClientForRequest,
  resolveBoundAccountId: async ({ request, client }) => {
    const { data } = await runBoundedSupabaseRpc({
      operation: "customer_account_binding_resolve",
      rpcName: "velmere_current_account_id",
      capability: "user_rls",
      request,
      clientOverride: client,
      deadlineMs: 3_000,
    });
    return data;
  },
};

const SAFE_ACCOUNT_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/;

function normalizeBoundAccountId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && value.length === 1) {
    const row = value[0];
    if (typeof row === "string") return row.trim() || null;
    if (row && typeof row === "object") {
      const candidate = (row as Record<string, unknown>).velmere_current_account_id
        ?? (row as Record<string, unknown>).account_id;
      return typeof candidate === "string" ? candidate.trim() || null : null;
    }
  }
  return null;
}

export async function resolveCustomerOwnedWriteBoundary(
  input: { request: Request; accountId: string },
  dependencies: CustomerOwnedWriteBoundaryDependencies = customerOwnedWriteBoundaryDependencies,
): Promise<CustomerOwnedWriteBoundary> {
  const accountId = input.accountId.trim();
  if (!SAFE_ACCOUNT_ID.test(accountId)) {
    throw new CustomerOwnedWriteBoundaryError("account_mismatch");
  }

  const resolution = dependencies.resolveUserClient(input.request);
  if (resolution.state !== "ready" || !resolution.client) {
    const code = resolution.state === "missing_token"
      ? "missing_token"
      : resolution.state === "invalid_token"
        ? "invalid_token"
        : "missing_public_config";
    throw new CustomerOwnedWriteBoundaryError(code);
  }

  let boundAccountId: string | null;
  try {
    boundAccountId = normalizeBoundAccountId(await dependencies.resolveBoundAccountId({
      request: input.request,
      client: resolution.client as unknown as SupabaseRpcClient,
    }));
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) throw error;
    if (error instanceof BoundedSupabaseRpcError && error.code === "rpc_capability_unavailable") {
      throw new CustomerOwnedWriteBoundaryError("missing_public_config");
    }
    if (error instanceof BoundedSupabaseRpcError) {
      const providerCode = error.providerCode?.toUpperCase() ?? "";
      if (["PGRST301", "PGRST302", "JWT_EXPIRED", "JWT_REVOKED", "401"].includes(providerCode)) {
        throw new CustomerOwnedWriteBoundaryError("invalid_token");
      }
    }
    throw new CustomerOwnedWriteBoundaryError("binding_unavailable");
  }

  if (!boundAccountId) throw new CustomerOwnedWriteBoundaryError("account_unbound");
  if (boundAccountId !== accountId) throw new CustomerOwnedWriteBoundaryError("account_mismatch");

  return {
    schemaVersion: "velmere.customer-owned-write-boundary.v1",
    state: "ready",
    accountId,
    client: resolution.client,
    rlsEnforced: true,
    serviceRoleUsed: false,
  };
}


export type CustomerOwnedDataBoundary = CustomerOwnedWriteBoundary;

/**
 * Generic owner-bound data access boundary. Read routes that use privileged
 * server storage must resolve this boundary first and pass its user-scoped
 * Supabase client into the storage layer. This prevents an account cookie or
 * trusted header from becoming a service-role read capability.
 */
export async function resolveCustomerOwnedDataBoundary(
  input: { request: Request; accountId: string },
  dependencies: CustomerOwnedWriteBoundaryDependencies = customerOwnedWriteBoundaryDependencies,
): Promise<CustomerOwnedDataBoundary> {
  return resolveCustomerOwnedWriteBoundary(input, dependencies);
}

export function customerOwnedDataErrorPayload(
  error: CustomerOwnedWriteBoundaryError,
  operation: "read" | "write" = "read",
) {
  return {
    error: operation === "read" ? "CUSTOMER_DATA_AUTH_REQUIRED" : "CUSTOMER_WRITE_AUTH_REQUIRED",
    code: error.code,
    retryable: error.httpStatus === 503,
    operation,
  } as const;
}
export function customerOwnedWriteErrorPayload(error: CustomerOwnedWriteBoundaryError) {
  return {
    error: "CUSTOMER_WRITE_AUTH_REQUIRED",
    code: error.code,
    retryable: error.httpStatus === 503,
  } as const;
}
