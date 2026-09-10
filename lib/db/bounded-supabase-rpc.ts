import {
  getSupabasePublicClient,
  getSupabaseServiceRoleClient,
  getSupabaseUserClientForRequest,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
} from "@/lib/db/supabase";

export type SupabaseRpcCapability = "public_read" | "user_rls" | "service_role_write";

export type SupabaseRpcErrorShape = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type SupabaseRpcResult = {
  data: unknown;
  error: SupabaseRpcErrorShape | null;
};

export type SupabaseRpcQuery = PromiseLike<SupabaseRpcResult> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<SupabaseRpcResult>;
};

export type SupabaseRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => SupabaseRpcQuery;
};

export type SupabaseRpcCapabilityResolution = {
  schemaVersion: "velmere.supabase-rpc-capability.v1";
  capability: SupabaseRpcCapability;
  state: "ready" | "missing_config" | "missing_request" | "invalid_user_token";
  client: SupabaseRpcClient | null;
  rlsEnforced: boolean;
  serviceRoleUsed: boolean;
};

export type BoundedRpcReceipt = {
  schemaVersion: "velmere.bounded-rpc-receipt.v1";
  operation: string;
  capability: SupabaseRpcCapability;
  durationMs: number;
  deadlineMs: number;
  aborted: boolean;
  durableBoundary: "service_role" | "rls" | "public";
};

export class BoundedSupabaseRpcError extends Error {
  readonly code:
    | "rpc_capability_unavailable"
    | "rpc_deadline_exceeded"
    | "rpc_aborted"
    | "rpc_failed"
    | "rpc_invalid_operation";
  readonly operation: string;
  readonly capability: SupabaseRpcCapability;
  readonly providerCode: string | null;

  constructor(input: {
    code: BoundedSupabaseRpcError["code"];
    operation: string;
    capability: SupabaseRpcCapability;
    providerCode?: string | null;
  }) {
    super(`${input.operation}:${input.code}`);
    this.name = "BoundedSupabaseRpcError";
    this.code = input.code;
    this.operation = input.operation;
    this.capability = input.capability;
    this.providerCode = input.providerCode?.slice(0, 40) || null;
  }
}

const SAFE_OPERATION = /^[a-z0-9][a-z0-9:_-]{2,79}$/;

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

export function resolveSupabaseRpcCapability(input: {
  capability: SupabaseRpcCapability;
  request?: Request;
  clientOverride?: SupabaseRpcClient | null;
}): SupabaseRpcCapabilityResolution {
  if (input.clientOverride !== undefined) {
    return {
      schemaVersion: "velmere.supabase-rpc-capability.v1",
      capability: input.capability,
      state: input.clientOverride ? "ready" : "missing_config",
      client: input.clientOverride,
      rlsEnforced: input.capability === "user_rls",
      serviceRoleUsed: input.capability === "service_role_write",
    };
  }

  if (input.capability === "service_role_write") {
    const client = hasSupabaseServiceRoleConfig()
      ? (getSupabaseServiceRoleClient() as SupabaseRpcClient | null)
      : null;
    return {
      schemaVersion: "velmere.supabase-rpc-capability.v1",
      capability: input.capability,
      state: client ? "ready" : "missing_config",
      client,
      rlsEnforced: false,
      serviceRoleUsed: Boolean(client),
    };
  }

  if (input.capability === "public_read") {
    const client = hasSupabasePublicConfig()
      ? (getSupabasePublicClient() as SupabaseRpcClient | null)
      : null;
    return {
      schemaVersion: "velmere.supabase-rpc-capability.v1",
      capability: input.capability,
      state: client ? "ready" : "missing_config",
      client,
      rlsEnforced: false,
      serviceRoleUsed: false,
    };
  }

  if (!input.request) {
    return {
      schemaVersion: "velmere.supabase-rpc-capability.v1",
      capability: input.capability,
      state: "missing_request",
      client: null,
      rlsEnforced: false,
      serviceRoleUsed: false,
    };
  }
  const user = getSupabaseUserClientForRequest(input.request);
  return {
    schemaVersion: "velmere.supabase-rpc-capability.v1",
    capability: input.capability,
    state: user.state === "ready" ? "ready" : user.state === "invalid_token" ? "invalid_user_token" : "missing_config",
    client: user.client as SupabaseRpcClient | null,
    rlsEnforced: user.rlsEnforced,
    serviceRoleUsed: false,
  };
}

export async function runBoundedSupabaseRpc(input: {
  operation: string;
  rpcName: string;
  args?: Record<string, unknown>;
  capability: SupabaseRpcCapability;
  request?: Request;
  deadlineMs?: number;
  clientOverride?: SupabaseRpcClient | null;
  now?: () => number;
}): Promise<{ data: unknown; receipt: BoundedRpcReceipt }> {
  const operation = input.operation.trim().toLowerCase();
  if (!SAFE_OPERATION.test(operation)) {
    throw new BoundedSupabaseRpcError({
      code: "rpc_invalid_operation",
      operation: "bounded_rpc",
      capability: input.capability,
    });
  }
  const deadlineMs = boundedInteger(input.deadlineMs, 5_000, 250, 20_000);
  const now = input.now ?? Date.now;
  const startedAt = now();
  const resolved = resolveSupabaseRpcCapability({
    capability: input.capability,
    request: input.request,
    clientOverride: input.clientOverride,
  });
  if (resolved.state !== "ready" || !resolved.client) {
    throw new BoundedSupabaseRpcError({
      code: "rpc_capability_unavailable",
      operation,
      capability: input.capability,
    });
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    const query = resolved.client.rpc(input.rpcName, input.args);
    const abortable = typeof query.abortSignal === "function" ? query.abortSignal(controller.signal) : query;
    const result = await Promise.race([
      Promise.resolve(abortable),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new BoundedSupabaseRpcError({
            code: "rpc_deadline_exceeded",
            operation,
            capability: input.capability,
          }));
          controller.abort();
        }, deadlineMs);
      }),
    ]);
    if (result.error) {
      throw new BoundedSupabaseRpcError({
        code: controller.signal.aborted ? "rpc_aborted" : "rpc_failed",
        operation,
        capability: input.capability,
        providerCode: result.error.code,
      });
    }
    return {
      data: result.data,
      receipt: {
        schemaVersion: "velmere.bounded-rpc-receipt.v1",
        operation,
        capability: input.capability,
        durationMs: Math.max(0, now() - startedAt),
        deadlineMs,
        aborted: false,
        durableBoundary:
          input.capability === "service_role_write"
            ? "service_role"
            : input.capability === "user_rls"
              ? "rls"
              : "public",
      },
    };
  } catch (error) {
    if (error instanceof BoundedSupabaseRpcError) throw error;
    throw new BoundedSupabaseRpcError({
      code: timedOut || controller.signal.aborted ? "rpc_aborted" : "rpc_failed",
      operation,
      capability: input.capability,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function runBoundedServiceRoleRpc(input: Omit<Parameters<typeof runBoundedSupabaseRpc>[0], "capability" | "request">) {
  return runBoundedSupabaseRpc({ ...input, capability: "service_role_write" });
}
