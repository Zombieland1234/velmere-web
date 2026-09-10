import { createHash } from "node:crypto";

import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import {
  completePass4395DurableIdempotencyKey,
  failPass4395DurableIdempotencyKeyRetryable,
  reservePass4395DurableIdempotencyKey,
  type Pass4395DurableIdempotencyFinalizeResult,
  type Pass4395DurableIdempotencyReserveResult,
  type Pass4395IdempotencyDisposition,
  type Pass4395IdempotencyOutcome,
  type Pass4395IdempotencyState,
} from "@/lib/security/durable-idempotency-store";

export const PASS4394_CLIENT_REQUEST_IDEMPOTENCY_BOUNDARY =
  "pass4394-client-request-idempotency-boundary: a server-owned account scope and canonical request-body fingerprint are bound to a redacted client request id before mutation side effects; PENDING suppresses concurrent/crash-window duplicates, COMPLETED replays one atomically stored status/body outcome, FAILED_RETRYABLE may be reacquired only after an explicit pre-side-effect failure; production fails closed without durable storage, while provider-effect-plus-outcome atomicity remains an external transaction boundary" as const;

export type Pass4394ClientRequestIdempotencyState =
  | "missing_client_request_id"
  | "accepted_first_seen"
  | "accepted_retryable_reacquired"
  | "completed_replay"
  | "pending_blocked"
  | "request_fingerprint_conflict"
  | "durable_unavailable"
  | "duplicate_blocked";

export type Pass4394ClientRequestIdempotencyReceipt = {
  passId: "PASS4394_CLIENT_REQUEST_IDEMPOTENCY_RECEIPT";
  state: Pass4394ClientRequestIdempotencyState;
  ok: boolean;
  duplicate: boolean;
  action: string;
  targetType: string;
  targetId?: string;
  actorId: "actor:hashed" | "actor:unknown";
  accountScopeSource: "account_id" | "actor_id" | "anonymous";
  accountScopeHash: string;
  bodyFingerprintHash: string;
  bodyFingerprintBound: boolean;
  requestFingerprintHash?: string;
  route: string;
  method: string;
  clientRequestIdPresent: boolean;
  clientRequestIdHash?: string;
  idempotencyKeyHash?: string;
  firstSeenAt?: string;
  duplicateSeenAt?: string;
  storageMode:
    | "memory_runtime_only"
    | "not_registered_missing_id"
    | "upstash_rest_durable"
    | "supabase_durable"
    | "durable_required_missing"
    | "durable_write_failed";
  durableState?: Pass4395IdempotencyState;
  durableDisposition?: Pass4395IdempotencyDisposition;
  replayOutcome?: Pass4395IdempotencyOutcome;
  pass4395Durable?: Pass4395DurableIdempotencyReserveResult;
  durableRequiredForProduction: true;
  crossSystemEffectOutcomeAtomicityProven: false;
  boundary: typeof PASS4394_CLIENT_REQUEST_IDEMPOTENCY_BOUNDARY;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashJson(value: unknown) {
  return `sha256:${sha256(JSON.stringify(value ?? null))}`;
}

function routeFromRequest(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/internal/pass4394";
  }
}

function sanitizeClientRequestId(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(ASCII_CONTROL_PATTERN, "")
    .replace(/[^a-zA-Z0-9._:-]/gu, "")
    .trim()
    .slice(0, 96);
}

function canonicalJson(value: unknown): string {
  const active = new WeakSet<object>();

  function serialize(input: unknown, arrayItem = false): string | undefined {
    if (input === null) return "null";
    if (typeof input === "string") return JSON.stringify(input);
    if (typeof input === "boolean") return input ? "true" : "false";
    if (typeof input === "number") return Number.isFinite(input) ? JSON.stringify(input) : "null";
    if (typeof input === "bigint") return JSON.stringify({ $bigint: input.toString() });
    if (input === undefined || typeof input === "function" || typeof input === "symbol") {
      return arrayItem ? "null" : undefined;
    }
    if (typeof input !== "object") return JSON.stringify(String(input));
    if (active.has(input)) throw new Error("idempotency_body_cycle_forbidden");
    active.add(input);
    try {
      if (Array.isArray(input)) {
        return `[${input.map((item) => serialize(item, true) ?? "null").join(",")}]`;
      }
      const entries = Object.keys(input as Record<string, unknown>)
        .sort()
        .flatMap((key) => {
          const serialized = serialize((input as Record<string, unknown>)[key]);
          return serialized === undefined
            ? []
            : [`${JSON.stringify(key)}:${serialized}`];
        });
      return `{${entries.join(",")}}`;
    } finally {
      active.delete(input);
    }
  }

  return serialize(value, true) ?? "null";
}

function resolveAccountScope(args: { accountId?: string; actorId?: string }) {
  if (args.accountId) {
    return {
      source: "account_id" as const,
      raw: args.accountId,
      actorId: "actor:hashed" as const,
    };
  }
  if (args.actorId) {
    return {
      source: "actor_id" as const,
      raw: args.actorId,
      actorId: "actor:hashed" as const,
    };
  }
  return {
    source: "anonymous" as const,
    raw: "anonymous:unbound",
    actorId: "actor:unknown" as const,
  };
}

function clientState(
  durable: Pass4395DurableIdempotencyReserveResult,
): Pass4394ClientRequestIdempotencyState {
  if (durable.disposition === "STARTED") return "accepted_first_seen";
  if (durable.disposition === "RETRY_STARTED") return "accepted_retryable_reacquired";
  if (durable.disposition === "REPLAY_COMPLETED") return "completed_replay";
  if (durable.disposition === "PENDING_BLOCKED") return "pending_blocked";
  if (durable.disposition === "REQUEST_FINGERPRINT_CONFLICT") {
    return "request_fingerprint_conflict";
  }
  return "durable_unavailable";
}

export function readPass4394ClientRequestId(request: Request, body?: unknown) {
  const headerValue =
    request.headers.get("x-velmere-client-request-id") ??
    request.headers.get("idempotency-key") ??
    request.headers.get("x-idempotency-key") ??
    "";
  const headerId = sanitizeClientRequestId(headerValue);
  if (headerId) return headerId;

  if (body && typeof body === "object" && "clientRequestId" in body) {
    return sanitizeClientRequestId((body as { clientRequestId?: unknown }).clientRequestId);
  }

  return "";
}

export async function registerPass4394ClientRequestMutation(args: {
  request: Request;
  action: string;
  targetType: string;
  targetId?: string;
  accountId?: string;
  actorId?: string;
  clientRequestId?: string;
  body?: unknown;
}): Promise<Pass4394ClientRequestIdempotencyReceipt> {
  const route = routeFromRequest(args.request);
  const method = args.request.method.toUpperCase();
  const accountScope = resolveAccountScope(args);
  const accountScopeHash = hashJson({
    scopeVersion: "pass4394.account.v1",
    value: accountScope.raw,
  });
  const bodyFingerprintHash = hashJson({
    fingerprintVersion: "pass4394.canonical-json.v1",
    body: canonicalJson(args.body ?? null),
  });
  const cleanClientRequestId = sanitizeClientRequestId(
    args.clientRequestId || readPass4394ClientRequestId(args.request, args.body),
  );
  const baseReceipt = {
    passId: "PASS4394_CLIENT_REQUEST_IDEMPOTENCY_RECEIPT" as const,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    actorId: accountScope.actorId,
    accountScopeSource: accountScope.source,
    accountScopeHash,
    bodyFingerprintHash,
    bodyFingerprintBound: args.body !== undefined,
    route,
    method,
    durableRequiredForProduction: true as const,
    crossSystemEffectOutcomeAtomicityProven: false as const,
    boundary: PASS4394_CLIENT_REQUEST_IDEMPOTENCY_BOUNDARY,
  };

  if (!cleanClientRequestId) {
    return {
      ...baseReceipt,
      state: "missing_client_request_id",
      ok: true,
      duplicate: false,
      clientRequestIdPresent: false,
      storageMode: "not_registered_missing_id",
    };
  }

  const clientRequestIdHash = hashJson({
    idVersion: "pass4394.client-request-id.v1",
    value: cleanClientRequestId,
  });
  const idempotencyKeyHash = hashJson({
    keyVersion: "pass4394.key.v2",
    route,
    method,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId ?? "",
    accountScopeHash,
    clientRequestIdHash,
  });
  const requestFingerprintHash = hashJson({
    fingerprintVersion: "pass4394.request.v2",
    route,
    method,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId ?? "",
    accountScopeHash,
    bodyFingerprintHash,
  });
  const pass4395Durable = await reservePass4395DurableIdempotencyKey({
    keyHash: idempotencyKeyHash,
    valueHash: requestFingerprintHash,
    ttlSeconds: 60 * 60 * 24,
    receipt: {
      route,
      method,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      accountScopeSource: accountScope.source,
      accountScopeHash,
      bodyFingerprintHash,
      bodyFingerprintBound: args.body !== undefined,
      clientRequestIdHash,
      idempotencyKeyHash,
      requestFingerprintHash,
      rawAccountIdStored: false,
      rawActorIdStored: false,
      rawClientRequestIdStored: false,
      rawBodyStored: false,
      pass4394Boundary: PASS4394_CLIENT_REQUEST_IDEMPOTENCY_BOUNDARY,
    },
  });
  const state = clientState(pass4395Durable);
  const started =
    state === "accepted_first_seen"
    || state === "accepted_retryable_reacquired";
  const now = new Date().toISOString();

  return {
    ...baseReceipt,
    state,
    ok: started,
    duplicate: pass4395Durable.duplicate,
    clientRequestIdPresent: true,
    clientRequestIdHash,
    idempotencyKeyHash,
    requestFingerprintHash,
    firstSeenAt: pass4395Durable.firstSeenAt,
    ...(!started
      ? { duplicateSeenAt: pass4395Durable.duplicateSeenAt ?? now }
      : {}),
    storageMode: pass4395Durable.storageMode,
    durableState: pass4395Durable.state,
    durableDisposition: pass4395Durable.disposition,
    ...(pass4395Durable.outcome
      ? { replayOutcome: pass4395Durable.outcome }
      : {}),
    pass4395Durable,
  };
}

export async function completePass4394ClientRequestMutation(args: {
  receipt: Pass4394ClientRequestIdempotencyReceipt;
  status: number;
  body: unknown;
}): Promise<Pass4395DurableIdempotencyFinalizeResult | null> {
  if (
    !args.receipt.pass4395Durable
    || (
      args.receipt.state !== "accepted_first_seen"
      && args.receipt.state !== "accepted_retryable_reacquired"
    )
  ) return null;
  return completePass4395DurableIdempotencyKey({
    reservation: args.receipt.pass4395Durable,
    status: args.status,
    body: args.body,
  });
}

export async function failPass4394ClientRequestMutationRetryable(args: {
  receipt: Pass4394ClientRequestIdempotencyReceipt;
  reasonCode: string;
  sideEffectStarted: boolean;
}): Promise<Pass4395DurableIdempotencyFinalizeResult | null> {
  if (
    !args.receipt.pass4395Durable
    || (
      args.receipt.state !== "accepted_first_seen"
      && args.receipt.state !== "accepted_retryable_reacquired"
    )
  ) return null;
  return failPass4395DurableIdempotencyKeyRetryable({
    reservation: args.receipt.pass4395Durable,
    reasonCode: args.reasonCode,
    sideEffectStarted: args.sideEffectStarted,
  });
}

export async function completePass4394ClientRequestJsonResponse(args: {
  receipt: Pass4394ClientRequestIdempotencyReceipt;
  status?: number;
  body: unknown;
  headers?: HeadersInit;
}): Promise<Response> {
  const status = args.status ?? 200;
  const completion = await completePass4394ClientRequestMutation({
    receipt: args.receipt,
    status,
    body: args.body,
  });
  const headers = new Headers(args.headers);
  const idempotencyHeaders = new Headers(pass4394IdempotencyHeaders(args.receipt));
  idempotencyHeaders.forEach((value, key) => headers.set(key, value));
  headers.set(
    "x-velmere-pass4395-outcome-commit",
    completion === null ? "untracked" : completion.ok ? "completed" : "failed_closed_pending",
  );
  headers.set(
    "x-velmere-pass4395-cross-system-atomicity",
    "not-proven",
  );
  return Response.json(args.body, { status, headers });
}

export function pass4394IdempotencyHeaders(
  receipt: Pass4394ClientRequestIdempotencyReceipt,
): HeadersInit {
  return {
    "x-velmere-pass4394-idempotency": receipt.state,
    "x-velmere-pass4394-client-request-id": receipt.clientRequestIdPresent
      ? "hashed"
      : "missing",
    "x-velmere-pass4394-account-scope": "hashed",
    "x-velmere-pass4394-body-fingerprint": receipt.bodyFingerprintBound
      ? "bound"
      : "null-bound",
    "x-velmere-pass4395-idempotency-mode":
      receipt.pass4395Durable?.storageMode ?? receipt.storageMode,
    "x-velmere-pass4395-idempotency-durable": receipt.pass4395Durable?.durable
      ? "true"
      : "false",
    "x-velmere-pass4395-idempotency-state":
      receipt.pass4395Durable?.state ?? "UNRESERVED",
    "x-velmere-pass4395-idempotency-disposition":
      receipt.pass4395Durable?.disposition ?? "UNRESERVED",
  };
}
