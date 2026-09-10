import { randomBytes } from "node:crypto";
import { extractSupabaseUserAccessToken, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { canonicalDurableJson, sha256Hex } from "@/lib/jobs/durable-computation-canonical";
import { sealDurableComputationPayload, type DurableComputationSealedPayload } from "@/lib/jobs/durable-computation-payload";
import { resolveTrustedRequestClientIdentity } from "@/lib/security/api-guard";

import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";
export const DURABLE_COMPUTATION_REPLAY_ID = "velmere-durable-computation-replay-v2" as const;

export type DurableComputationKind = "vlm_analysis" | "lens_pdf_render" | "audit_pdf_render";
export type DurableComputationMode = "supabase" | "memory_non_production" | "direct_non_durable";

export type DurableComputationSubjectBinding = {
  kind: "account" | "entitlement" | "session" | "anonymous";
  value: string;
};

export type StoredResult = {
  encoding: "json" | "base64";
  payload: string;
  sha256: string;
  bytes: number;
};

type MemoryRow = {
  jobId: string;
  kind: DurableComputationKind;
  inputHash: string;
  subjectHash: string;
  state: "processing" | "completed" | "retry_wait" | "dead_letter";
  attemptCount: number;
  maxAttempts: number;
  leaseTokenHash: string | null;
  leaseExpiresAtMs: number | null;
  nextAttemptAtMs: number | null;
  result: StoredResult | null;
  lastErrorCode: string | null;
  sealedPayload: DurableComputationSealedPayload | null;
};

const memoryRows = new Map<string, MemoryRow>();
const DOMAIN = "velmere:durable-computation:v2:";
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_RESULT_BYTES = 3 * 1024 * 1024;

function productionLike(env: Record<string, string | undefined>) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function boundedCode(value: unknown) {
  return String(value instanceof Error ? value.message : value ?? "computation_failed")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .slice(0, 120) || "computation_failed";
}

function parseRpcRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}


type BrowserDurableComputationBridgeContext = Readonly<{
  url: URL;
  userAccessToken: string;
  serverCapability: string;
  accountId: string;
  requestId: string;
}>;

function resolveBrowserDurableComputationBridge(args: {
  kind: DurableComputationKind;
  request: Request;
  requestId?: string | null;
  subjectBinding?: DurableComputationSubjectBinding | null;
  workerPayload?: unknown;
  env: Record<string, string | undefined>;
}): BrowserDurableComputationBridgeContext | null {
  if (args.kind !== "lens_pdf_render" || args.workerPayload !== undefined) return null;
  if (args.subjectBinding?.kind !== "account") return null;
  const accountId = args.subjectBinding.value.trim();
  const requestId = String(args.requestId ?? args.request.headers.get("x-velmere-request-id") ?? "").trim();
  const userAccessToken = extractSupabaseUserAccessToken(args.request)?.token ?? "";
  const serverCapability = String(args.env.VELMERE_BROWSER_SERVER_CAPABILITY ?? "").trim();
  const rawUrl = String(args.env.VELMERE_DURABLE_COMPUTATION_BRIDGE_URL ?? "").trim();
  if (!accountId || !requestId || !userAccessToken || serverCapability.length < 48 || !rawUrl) return null;
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.pathname !== "/functions/v1/r7-browser-durable-computation-bridge" ||
    url.search ||
    url.hash
  ) return null;
  return { url, userAccessToken, serverCapability, accountId, requestId };
}

async function callBrowserDurableComputationBridge(args: {
  bridge: BrowserDurableComputationBridgeContext;
  action: "claim" | "complete" | "fail";
  body: Record<string, unknown>;
}) {
  let response: Response;
  try {
    response = await fetch(args.bridge.url, {
      method: "POST",
      headers: {
        authorization: "Bearer " + args.bridge.userAccessToken,
        "x-velmere-browser-server-capability": args.bridge.serverCapability,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        schemaVersion: "velmere.r7.browser-durable-computation-bridge-request.v1",
        action: args.action,
        accountId: args.bridge.accountId,
        kind: "lens_pdf_render",
        requestId: args.bridge.requestId,
        ...args.body,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
  let envelope: Record<string, unknown>;
  try {
    envelope = parseStrictJsonText<Record<string, unknown>>(await response.text(), {
      maxBytes: 3_700_000,
      maxDepth: 24,
      maxNodes: 40_000,
      requireObject: true,
    });
  } catch {
    return null;
  }
  if (
    !response.ok ||
    envelope.ok !== true ||
    envelope.schemaVersion !== "velmere.r7.browser-durable-computation-bridge-response.v1" ||
    envelope.action !== args.action ||
    envelope.accountBound !== true ||
    envelope.serviceRoleInternalOnly !== true ||
    envelope.rawSecretsReturned !== false ||
    !envelope.data ||
    typeof envelope.data !== "object" ||
    Array.isArray(envelope.data)
  ) return null;
  return envelope.data as Record<string, unknown>;
}

async function claimBrowserDurableComputationBridge(args: {
  jobId: string;
  inputHash: string;
  subjectHash: string;
  maxAttempts: number;
  leaseSeconds: number;
  sealedPayload?: DurableComputationSealedPayload | null;
  bridge: BrowserDurableComputationBridgeContext;
}) {
  if (args.sealedPayload) return { state: "store_failed" as const };
  const data = await callBrowserDurableComputationBridge({
    bridge: args.bridge,
    action: "claim",
    body: {
      jobId: args.jobId,
      inputHash: args.inputHash,
      subjectHash: args.subjectHash,
      maxAttempts: args.maxAttempts,
      leaseSeconds: args.leaseSeconds,
      sealedPayload: null,
    },
  });
  if (!data) return { state: "store_failed" as const };
  const state = String(data.state ?? "store_failed");
  if (state === "claimed") {
    const leaseToken = typeof data.leaseToken === "string" ? data.leaseToken : "";
    return leaseToken.length >= 24
      ? { state: "claimed" as const, leaseToken, attemptCount: Number(data.attemptCount ?? 1) }
      : { state: "store_failed" as const };
  }
  if (state === "completed") {
    const result = data.resultPayload && typeof data.resultPayload === "object" && !Array.isArray(data.resultPayload)
      ? data.resultPayload as StoredResult
      : null;
    return result
      ? { state: "completed" as const, result, attemptCount: Number(data.attemptCount ?? 1) }
      : { state: "store_failed" as const };
  }
  if (state === "in_progress") return { state: "in_progress" as const, attemptCount: Number(data.attemptCount ?? 1) };
  if (state === "retry_wait") return { state: "retry_wait" as const, attemptCount: Number(data.attemptCount ?? 1), retryAfterMs: Number(data.retryAfterMs ?? 1000) };
  if (state === "dead_letter") return { state: "dead_letter" as const, attemptCount: Number(data.attemptCount ?? args.maxAttempts) };
  if (state === "conflict") return { state: "conflict" as const };
  return { state: "store_failed" as const };
}

function identityMaterial(request: Request, binding?: DurableComputationSubjectBinding | null) {
  const explicitValue = binding?.value.trim() ?? "";
  if (binding && explicitValue) {
    return {
      subjectHash: sha256Hex(`${DOMAIN}subject:${binding.kind}:${explicitValue}`),
      subjectSource: binding.kind,
    } as const;
  }
  const client = resolveTrustedRequestClientIdentity(request);
  const acceptLanguage = (request.headers.get("accept-language") ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9,;=._*-]+/g, "_")
    .slice(0, 96);
  return {
    subjectHash: sha256Hex(`${DOMAIN}transport-fallback:${client.privacyMaterial}:${acceptLanguage || "missing"}`),
    subjectSource: client.trusted ? "trusted_transport_fallback" : "untrusted_transport_fallback",
  } as const;
}

export function buildDurableComputationIdentity(args: {
  kind: DurableComputationKind;
  request: Request;
  input: unknown;
  requestId?: string | null;
  subjectBinding?: DurableComputationSubjectBinding | null;
}) {
  const inputHash = sha256Hex(`${DOMAIN}input:${canonicalDurableJson(args.input)}`);
  const { subjectHash, subjectSource } = identityMaterial(args.request, args.subjectBinding);
  const providedRequestId = String(args.requestId ?? args.request.headers.get("x-velmere-request-id") ?? "").trim();
  const idempotencyMaterial = providedRequestId || inputHash;
  const jobId = `dcj_${sha256Hex(`${DOMAIN}${args.kind}:${subjectHash}:${idempotencyMaterial}:${inputHash}`).slice(0, 48)}`;
  return { jobId, inputHash, subjectHash, subjectSource, requestIdPresent: Boolean(providedRequestId) };
}

function serializeJson(value: unknown, maxBytes: number): StoredResult {
  const payload = canonicalDurableJson(value);
  const bytes = Buffer.byteLength(payload, "utf8");
  if (bytes > maxBytes) throw new Error("durable_result_too_large");
  return { encoding: "json", payload, bytes, sha256: sha256Hex(payload) };
}

function serializeBinary(value: Uint8Array, maxBytes: number): StoredResult {
  if (value.byteLength > maxBytes) throw new Error("durable_result_too_large");
  const buffer = Buffer.from(value);
  return { encoding: "base64", payload: buffer.toString("base64"), bytes: buffer.byteLength, sha256: sha256Hex(buffer) };
}

function decodeJson<T>(stored: StoredResult): T {
  if (stored.encoding !== "json") throw new Error("durable_result_integrity_failed");
  if (Buffer.byteLength(stored.payload, "utf8") !== stored.bytes || sha256Hex(stored.payload) !== stored.sha256) {
    throw new Error("durable_result_integrity_failed");
  }
  return parseStrictJsonText<T>(stored.payload, { maxBytes: Math.max(1, stored.bytes), maxDepth: 48, maxNodes: 500_000, requireObject: false });
}

function decodeBinary(stored: StoredResult): Uint8Array {
  if (stored.encoding !== "base64") throw new Error("durable_result_integrity_failed");
  const value = Buffer.from(stored.payload, "base64");
  if (value.toString("base64") !== stored.payload || value.byteLength !== stored.bytes || sha256Hex(value) !== stored.sha256) {
    throw new Error("durable_result_integrity_failed");
  }
  return new Uint8Array(value);
}

async function claimMemory(args: {
  jobId: string;
  kind: DurableComputationKind;
  inputHash: string;
  subjectHash: string;
  maxAttempts: number;
  leaseSeconds: number;
  nowMs: number;
  sealedPayload?: DurableComputationSealedPayload | null;
}) {
  const existing = memoryRows.get(args.jobId);
  if (existing) {
    if (existing.inputHash !== args.inputHash || existing.subjectHash !== args.subjectHash || existing.kind !== args.kind) {
      return { state: "conflict" as const };
    }
    if (existing.state === "completed" && existing.result) return { state: "completed" as const, result: existing.result, attemptCount: existing.attemptCount };
    if (existing.state === "dead_letter") return { state: "dead_letter" as const, attemptCount: existing.attemptCount };
    if (existing.state === "processing" && (existing.leaseExpiresAtMs ?? 0) > args.nowMs) return { state: "in_progress" as const, attemptCount: existing.attemptCount };
    if (existing.state === "retry_wait" && (existing.nextAttemptAtMs ?? 0) > args.nowMs) return { state: "retry_wait" as const, attemptCount: existing.attemptCount, retryAfterMs: (existing.nextAttemptAtMs ?? args.nowMs) - args.nowMs };
  }
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  if (attemptCount > args.maxAttempts) {
    if (existing) memoryRows.set(args.jobId, { ...existing, state: "dead_letter", leaseTokenHash: null, leaseExpiresAtMs: null });
    return { state: "dead_letter" as const, attemptCount: existing?.attemptCount ?? args.maxAttempts };
  }
  const leaseToken = randomBytes(24).toString("base64url");
  memoryRows.set(args.jobId, {
    jobId: args.jobId,
    kind: args.kind,
    inputHash: args.inputHash,
    subjectHash: args.subjectHash,
    state: "processing",
    attemptCount,
    maxAttempts: args.maxAttempts,
    leaseTokenHash: sha256Hex(leaseToken),
    leaseExpiresAtMs: args.nowMs + args.leaseSeconds * 1000,
    nextAttemptAtMs: null,
    result: null,
    lastErrorCode: null,
    sealedPayload: args.sealedPayload ?? existing?.sealedPayload ?? null,
  });
  return { state: "claimed" as const, leaseToken, attemptCount };
}

async function claimStore(args: {
  jobId: string;
  kind: DurableComputationKind;
  inputHash: string;
  subjectHash: string;
  maxAttempts: number;
  leaseSeconds: number;
  nowMs: number;
  env: Record<string, string | undefined>;
  requireDurableStore: boolean;
  sealedPayload?: DurableComputationSealedPayload | null;
  bridge?: BrowserDurableComputationBridgeContext | null;
}) {
  if (!hasSupabaseServiceRoleConfig()) {
    if (args.bridge) return claimBrowserDurableComputationBridge({ ...args, bridge: args.bridge });
    if (productionLike(args.env)) {
      if (args.requireDurableStore) return { state: "store_required" as const };
      return { state: "direct" as const };
    }
    return claimMemory(args);
  }
  const leaseToken = randomBytes(24).toString("base64url");
  let data: unknown;
  try {
    ({ data } = await runRegisteredServiceRoleRpc({
      operation: "durable_computation_claim",
      args: {
        p_job_id: args.jobId,
        p_kind: args.kind,
        p_input_hash: args.inputHash,
        p_subject_hash: args.subjectHash,
        p_lease_token: leaseToken,
        p_lease_seconds: args.leaseSeconds,
        p_max_attempts: args.maxAttempts,
        p_sealed_payload: args.sealedPayload ?? null,
      },
    }));
  } catch {
    return { state: "store_failed" as const };
  }
  const row = parseRpcRow(data);
  const state = String(row?.state ?? "store_failed");
  if (state === "claimed") return { state: "claimed" as const, leaseToken, attemptCount: Number(row?.attempt_count ?? 1) };
  if (state === "completed") {
    const result = row?.result_payload && typeof row.result_payload === "object" ? row.result_payload as StoredResult : null;
    return result ? { state: "completed" as const, result, attemptCount: Number(row?.attempt_count ?? 1) } : { state: "store_failed" as const };
  }
  if (state === "in_progress") return { state: "in_progress" as const, attemptCount: Number(row?.attempt_count ?? 1) };
  if (state === "retry_wait") return { state: "retry_wait" as const, attemptCount: Number(row?.attempt_count ?? 1), retryAfterMs: Number(row?.retry_after_ms ?? 1000) };
  if (state === "dead_letter") return { state: "dead_letter" as const, attemptCount: Number(row?.attempt_count ?? args.maxAttempts) };
  if (state === "conflict") return { state: "conflict" as const };
  return { state: "store_failed" as const };
}

async function completeStore(args: {
  jobId: string;
  leaseToken: string;
  result: StoredResult;
  env: Record<string, string | undefined>;
  inputHash?: string;
  subjectHash?: string;
  bridge?: BrowserDurableComputationBridgeContext | null;
}) {
  if (!hasSupabaseServiceRoleConfig()) {
    if (args.bridge) {
      if (!args.inputHash || !args.subjectHash) return false;
      const data = await callBrowserDurableComputationBridge({
        bridge: args.bridge,
        action: "complete",
        body: {
          jobId: args.jobId,
          inputHash: args.inputHash,
          subjectHash: args.subjectHash,
          leaseToken: args.leaseToken,
          result: args.result,
        },
      });
      return String(data?.state ?? "store_failed") === "completed";
    }
    const row = memoryRows.get(args.jobId);
    if (!row || row.state !== "processing" || row.leaseTokenHash !== sha256Hex(args.leaseToken)) return false;
    memoryRows.set(args.jobId, { ...row, state: "completed", result: args.result, leaseTokenHash: null, leaseExpiresAtMs: null });
    return true;
  }
  try {
    const { data } = await runRegisteredServiceRoleRpc({
      operation: "durable_computation_complete",
      args: { p_job_id: args.jobId, p_lease_token: args.leaseToken, p_result_payload: args.result },
    });
    return String(parseRpcRow(data)?.state ?? data) === "completed";
  } catch {
    return false;
  }
}

async function failStore(args: {
  jobId: string;
  leaseToken: string;
  errorCode: string;
  retryAfterSeconds: number;
  env: Record<string, string | undefined>;
  inputHash?: string;
  subjectHash?: string;
  bridge?: BrowserDurableComputationBridgeContext | null;
}) {
  if (!hasSupabaseServiceRoleConfig()) {
    if (args.bridge) {
      if (!args.inputHash || !args.subjectHash) return "store_failed" as const;
      const data = await callBrowserDurableComputationBridge({
        bridge: args.bridge,
        action: "fail",
        body: {
          jobId: args.jobId,
          inputHash: args.inputHash,
          subjectHash: args.subjectHash,
          leaseToken: args.leaseToken,
          errorCode: boundedCode(args.errorCode),
          retryAfterSeconds: args.retryAfterSeconds,
        },
      });
      const state = String(data?.state ?? "store_failed");
      return state === "dead_letter" ? "dead_letter" as const : state === "retry_wait" ? "retry_wait" as const : "store_failed" as const;
    }
    const row = memoryRows.get(args.jobId);
    if (!row || row.state !== "processing" || row.leaseTokenHash !== sha256Hex(args.leaseToken)) return "store_failed" as const;
    const dead = row.attemptCount >= row.maxAttempts;
    memoryRows.set(args.jobId, {
      ...row,
      state: dead ? "dead_letter" : "retry_wait",
      leaseTokenHash: null,
      leaseExpiresAtMs: null,
      nextAttemptAtMs: dead ? null : Date.now() + args.retryAfterSeconds * 1000,
      lastErrorCode: args.errorCode,
    });
    return dead ? "dead_letter" as const : "retry_wait" as const;
  }
  try {
    const { data } = await runRegisteredServiceRoleRpc({
      operation: "durable_computation_fail",
      args: { p_job_id: args.jobId, p_lease_token: args.leaseToken, p_error_code: args.errorCode, p_retry_after_seconds: args.retryAfterSeconds },
    });
    const state = String(parseRpcRow(data)?.state ?? data);
    return state === "dead_letter" ? "dead_letter" as const : state === "retry_wait" ? "retry_wait" as const : "store_failed" as const;
  } catch {
    return "store_failed" as const;
  }
}

export class DurableComputationError extends Error {
  constructor(public readonly code: "durable_computation_store_required" | "durable_computation_store_failed" | "durable_computation_in_progress" | "durable_computation_retry_wait" | "durable_computation_dead_letter" | "durable_computation_conflict" | "durable_computation_result_integrity_failed", public readonly retryAfterSeconds = 0) {
    super(code);
  }
}

type RunArgs<T> = {
  kind: DurableComputationKind;
  request: Request;
  input: unknown;
  requestId?: string | null;
  subjectBinding?: DurableComputationSubjectBinding | null;
  execute: () => Promise<T> | T;
  encode: (value: T, maxBytes: number) => StoredResult;
  decode: (stored: StoredResult) => T;
  maxResultBytes?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  requireDurableStore?: boolean;
  workerPayload?: unknown;
  maxWorkerPayloadBytes?: number;
};

async function run<T>(args: RunArgs<T>) {
  const env = args.env ?? process.env;
  const identity = buildDurableComputationIdentity(args);
  const bridge = resolveBrowserDurableComputationBridge({
    kind: args.kind,
    request: args.request,
    requestId: args.requestId,
    subjectBinding: args.subjectBinding,
    workerPayload: args.workerPayload,
    env,
  });
  const sealedPayload = args.workerPayload === undefined ? null : sealDurableComputationPayload({
    ...identity,
    kind: args.kind,
    payload: args.workerPayload,
    maxPlaintextBytes: args.maxWorkerPayloadBytes,
    env,
  });
  const claim = await claimStore({
    ...identity,
    kind: args.kind,
    maxAttempts: Math.max(1, Math.min(8, args.maxAttempts ?? 3)),
    leaseSeconds: Math.max(15, Math.min(600, args.leaseSeconds ?? DEFAULT_LEASE_SECONDS)),
    nowMs: args.nowMs ?? Date.now(),
    env,
    requireDurableStore: args.requireDurableStore ?? true,
    sealedPayload,
    bridge,
  });
  if (claim.state === "direct" || claim.state === "store_required" || claim.state === "store_failed") {
    const value = await args.execute();
    const result = args.encode(value, args.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES);
    return { value: args.decode(result), replayed: false, attemptCount: 1, jobId: identity.jobId, mode: "direct_non_durable" as DurableComputationMode };
  }
  if (claim.state === "completed") {
    try {
      return { value: args.decode(claim.result), replayed: true, attemptCount: claim.attemptCount, jobId: identity.jobId, mode: (hasSupabaseServiceRoleConfig() || bridge ? "supabase" : "memory_non_production") as DurableComputationMode };
    } catch {
      throw new DurableComputationError("durable_computation_result_integrity_failed");
    }
  }
  const claimState = (claim as { state?: string }).state;
  if (claimState === "store_required") throw new DurableComputationError("durable_computation_store_required");
  if (claimState === "store_failed") throw new DurableComputationError("durable_computation_store_failed", 15);
  if (claim.state === "in_progress" || claim.state === "dead_letter" || claim.state === "conflict" || claim.state === "retry_wait") {
    const value = await args.execute();
    const result = args.encode(value, args.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES);
    return { value: args.decode(result), replayed: false, attemptCount: 1, jobId: identity.jobId, mode: "direct_non_durable" as DurableComputationMode };
  }
  try {
    const value = await args.execute();
    const result = args.encode(value, args.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES);
    const completed = await completeStore({
      jobId: identity.jobId,
      leaseToken: claim.leaseToken,
      result,
      env,
      inputHash: identity.inputHash,
      subjectHash: identity.subjectHash,
      bridge,
    });
    if (!completed) throw new DurableComputationError("durable_computation_store_failed", 15);
    return { value: args.decode(result), replayed: false, attemptCount: claim.attemptCount, jobId: identity.jobId, mode: (hasSupabaseServiceRoleConfig() || bridge ? "supabase" : "memory_non_production") as DurableComputationMode };
  } catch (error) {
    const retryAfterSeconds = Math.min(60, 2 ** Math.max(0, claim.attemptCount - 1) * 5);
    await failStore({
      jobId: identity.jobId,
      leaseToken: claim.leaseToken,
      errorCode: boundedCode(error),
      retryAfterSeconds,
      env,
      inputHash: identity.inputHash,
      subjectHash: identity.subjectHash,
      bridge,
    });
    throw error;
  }
}

export function encodeDurableJsonResult(value: unknown, maxBytes = DEFAULT_MAX_RESULT_BYTES) {
  return serializeJson(value, maxBytes);
}

export function encodeDurableBinaryResult(value: Uint8Array, maxBytes = DEFAULT_MAX_RESULT_BYTES) {
  return serializeBinary(value, maxBytes);
}

export async function completeDurableComputationLease(args: { jobId: string; leaseToken: string; result: StoredResult; env?: Record<string, string | undefined> }) {
  return completeStore({ ...args, env: args.env ?? process.env });
}

export async function failDurableComputationLease(args: { jobId: string; leaseToken: string; errorCode: string; retryAfterSeconds: number; env?: Record<string, string | undefined> }) {
  return failStore({ ...args, env: args.env ?? process.env });
}

export function runDurableJsonComputation<T>(args: Omit<RunArgs<T>, "encode" | "decode">) {
  return run({ ...args, encode: serializeJson, decode: decodeJson<T> });
}

export function runDurableBinaryComputation(args: Omit<RunArgs<Uint8Array>, "encode" | "decode">) {
  return run({ ...args, encode: serializeBinary, decode: decodeBinary });
}

export function resetDurableComputationMemoryForTests() {
  memoryRows.clear();
}

export function inspectDurableComputationMemoryForTests(jobId: string) {
  return memoryRows.get(jobId) ?? null;
}
