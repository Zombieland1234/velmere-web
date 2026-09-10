import { createHash } from "node:crypto";

import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase-config";
import { supabaseServiceRestRequest } from "@/lib/db/supabase-service-rest";
import {
  executeUpstashRestEval,
  type UpstashRestConfig,
} from "@/lib/security/upstash-rest-atomic";

export const PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY =
  "pass4395-durable-idempotency-boundary: a scoped request fingerprint is atomically admitted as PENDING before side effects; COMPLETED stores one bounded status/body outcome for exact replay; FAILED_RETRYABLE may be reacquired only after an explicit pre-side-effect failure; production fails closed without a durable adapter; cross-system effect-plus-outcome atomicity still requires a transactional outbox or provider recovery proof" as const;

export type Pass4395DurableIdempotencyStorageMode =
  | "upstash_rest_durable"
  | "supabase_durable"
  | "memory_runtime_only"
  | "durable_required_missing"
  | "durable_write_failed";

export type Pass4395IdempotencyState =
  | "PENDING"
  | "COMPLETED"
  | "FAILED_RETRYABLE";

export type Pass4395IdempotencyDisposition =
  | "STARTED"
  | "RETRY_STARTED"
  | "REPLAY_COMPLETED"
  | "PENDING_BLOCKED"
  | "REQUEST_FINGERPRINT_CONFLICT"
  | "DURABLE_UNAVAILABLE";

export type Pass4395IdempotencyOutcome = {
  status: number;
  body: unknown;
  bodyByteLength: number;
  bodySha256: string;
  committedAt: string;
};

type Pass4395StoredOutcome = Omit<Pass4395IdempotencyOutcome, "body"> & {
  bodyJson: string;
};

export type Pass4395DurableIdempotencyReserveResult = {
  passId: "PASS4395_DURABLE_IDEMPOTENCY_RECEIPT";
  ok: boolean;
  duplicate: boolean;
  state: Pass4395IdempotencyState;
  disposition: Pass4395IdempotencyDisposition;
  storageMode: Pass4395DurableIdempotencyStorageMode;
  durable: boolean;
  failClosed: boolean;
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  attempt: number;
  firstSeenAt?: string;
  duplicateSeenAt?: string;
  outcome?: Pass4395IdempotencyOutcome;
  provider?: "upstash" | "supabase" | "memory";
  providerError?: string;
  reason?: string;
  boundary: typeof PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY;
};

export type Pass4395DurableIdempotencyReserveInput = {
  keyHash: string;
  valueHash: string;
  receipt: Record<string, unknown>;
  ttlSeconds?: number;
};

export type Pass4395DurableIdempotencyFinalizeResult = {
  passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT";
  ok: boolean;
  state: Pass4395IdempotencyState;
  storageMode: Pass4395DurableIdempotencyStorageMode;
  durable: boolean;
  failClosed: boolean;
  keyHash: string;
  valueHash: string;
  attempt: number;
  outcome?: Pass4395IdempotencyOutcome;
  reason?: string;
  providerError?: string;
  boundary: typeof PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY;
};

type Pass4395StoredFailure = {
  reasonCode: string;
  failedAt: string;
  sideEffectStarted: false;
};

type Pass4395StoredRecord = {
  schemaVersion: "velmere.pass4395.idempotency-record.v2";
  valueHash: string;
  state: Pass4395IdempotencyState;
  firstSeenAt: string;
  updatedAt: string;
  pendingSince: string;
  attempt: number;
  ttlSeconds: number;
  receipt: Record<string, unknown>;
  outcome?: Pass4395StoredOutcome;
  failure?: Pass4395StoredFailure;
};

type AdapterDecisionKind =
  | "STARTED"
  | "RETRY_STARTED"
  | "REPLAY_COMPLETED"
  | "PENDING"
  | "REQUEST_CONFLICT"
  | "COMPLETED"
  | "FAILED_RETRYABLE"
  | "ALREADY_COMPLETED"
  | "NOT_PENDING"
  | "MISSING";

type AdapterDecision = {
  decision: AdapterDecisionKind;
  record: Pass4395StoredRecord | null;
};

type SupabaseIdempotencyRow = {
  key_hash?: unknown;
  value_hash?: unknown;
  first_seen_at?: unknown;
  expires_at?: unknown;
  ttl_seconds?: unknown;
  receipt?: unknown;
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;
const MAX_MEMORY_KEYS = 1500;
const MAX_OUTCOME_BODY_BYTES = 64 * 1024;
const pass4395MemoryKeys = new Map<string, Pass4395StoredRecord>();

export const PASS4395_UPSTASH_RESERVE_LUA = [
  "local existing = redis.call('GET', KEYS[1])",
  "if not existing then",
  "  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3], 'NX')",
  "  return cjson.encode({decision='STARTED', record=ARGV[1]})",
  "end",
  "local decoded, record = pcall(cjson.decode, existing)",
  "if not decoded then",
  "  return cjson.encode({decision='PENDING', record=existing})",
  "end",
  "if tostring(record.valueHash or '') ~= ARGV[2] then",
  "  return cjson.encode({decision='REQUEST_CONFLICT', record=cjson.encode(record)})",
  "end",
  "local state = tostring(record.state or 'PENDING')",
  "if state == 'COMPLETED' then",
  "  return cjson.encode({decision='REPLAY_COMPLETED', record=cjson.encode(record)})",
  "end",
  "if state == 'FAILED_RETRYABLE' then",
  "  record.state = 'PENDING'",
  "  record.attempt = tonumber(record.attempt or 1) + 1",
  "  record.pendingSince = ARGV[4]",
  "  record.updatedAt = ARGV[4]",
  "  record.failure = nil",
  "  record.outcome = nil",
  "  local retried = cjson.encode(record)",
  "  redis.call('SET', KEYS[1], retried, 'EX', ARGV[3], 'XX')",
  "  return cjson.encode({decision='RETRY_STARTED', record=retried})",
  "end",
  "return cjson.encode({decision='PENDING', record=cjson.encode(record)})",
].join("\n");

export const PASS4395_UPSTASH_FINALIZE_LUA = [
  "local existing = redis.call('GET', KEYS[1])",
  "if not existing then return cjson.encode({decision='MISSING'}) end",
  "local decoded, record = pcall(cjson.decode, existing)",
  "if not decoded then return cjson.encode({decision='NOT_PENDING', record=existing}) end",
  "if tostring(record.valueHash or '') ~= ARGV[1] then",
  "  return cjson.encode({decision='REQUEST_CONFLICT', record=cjson.encode(record)})",
  "end",
  "local state = tostring(record.state or 'PENDING')",
  "if state == 'COMPLETED' then",
  "  return cjson.encode({decision='ALREADY_COMPLETED', record=cjson.encode(record)})",
  "end",
  "if state ~= 'PENDING' then",
  "  return cjson.encode({decision='NOT_PENDING', record=cjson.encode(record)})",
  "end",
  "record.state = ARGV[2]",
  "record.updatedAt = ARGV[3]",
  "if ARGV[2] == 'COMPLETED' then",
  "  record.outcome = cjson.decode(ARGV[4])",
  "  record.failure = nil",
  "else",
  "  record.failure = cjson.decode(ARGV[5])",
  "  record.outcome = nil",
  "end",
  "local finalized = cjson.encode(record)",
  "redis.call('SET', KEYS[1], finalized, 'EX', ARGV[6], 'XX')",
  "return cjson.encode({decision=ARGV[2], record=finalized})",
].join("\n");

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanHash(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 96) || "sha256:missing";
}

function normalizeTtlSeconds(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_TTL_SECONDS;
  return Math.max(60, Math.min(60 * 60 * 24 * 7, Math.round(numberValue)));
}

function isDurableRequired() {
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  return productionLike || process.env.VELMERE_DURABLE_IDEMPOTENCY_REQUIRED === "1" || process.env.VELMERE_IDEMPOTENCY_FAIL_CLOSED === "1";
}

function hasUpstashConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isState(value: unknown): value is Pass4395IdempotencyState {
  return value === "PENDING" || value === "COMPLETED" || value === "FAILED_RETRYABLE";
}

function cloneJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

function publicOutcome(outcome: Pass4395StoredOutcome | undefined): Pass4395IdempotencyOutcome | undefined {
  if (!outcome) return undefined;
  return {
    status: outcome.status,
    body: JSON.parse(outcome.bodyJson) as unknown,
    bodyByteLength: outcome.bodyByteLength,
    bodySha256: outcome.bodySha256,
    committedAt: outcome.committedAt,
  };
}

function normalizeOutcome(input: { status: number; body: unknown }): Pass4395StoredOutcome {
  if (!Number.isInteger(input.status) || input.status < 100 || input.status > 599) {
    throw new Error("idempotency_outcome_status_invalid");
  }
  const bodyJson = JSON.stringify(input.body ?? null);
  const bodyByteLength = Buffer.byteLength(bodyJson);
  if (bodyByteLength > MAX_OUTCOME_BODY_BYTES) {
    throw new Error("idempotency_outcome_body_too_large");
  }
  return {
    status: input.status,
    bodyJson,
    bodyByteLength,
    bodySha256: `sha256:${sha256(bodyJson)}`,
    committedAt: nowIso(),
  };
}

function normalizeOutcomeFromStore(value: unknown): Pass4395StoredOutcome | undefined {
  if (!isRecord(value)) return undefined;
  const status = Number(value.status);
  const bodyByteLength = Number(value.bodyByteLength);
  const bodySha256 = typeof value.bodySha256 === "string" ? value.bodySha256 : "";
  const committedAt = typeof value.committedAt === "string" ? value.committedAt : "";
  const bodyJson = typeof value.bodyJson === "string" ? value.bodyJson : "";
  if (
    !Number.isInteger(status)
    || status < 100
    || status > 599
    || !Number.isInteger(bodyByteLength)
    || bodyByteLength < 0
    || bodyByteLength > MAX_OUTCOME_BODY_BYTES
    || !/^sha256:[a-f0-9]{64}$/u.test(bodySha256)
    || !committedAt
    || !bodyJson
  ) return undefined;
  if (
    Buffer.byteLength(bodyJson) !== bodyByteLength
    || `sha256:${sha256(bodyJson)}` !== bodySha256
  ) return undefined;
  try {
    JSON.parse(bodyJson);
  } catch {
    return undefined;
  }
  return {
    status,
    bodyJson,
    bodyByteLength,
    bodySha256,
    committedAt,
  };
}

function buildPendingRecord(input: {
  valueHash: string;
  receipt: Record<string, unknown>;
  ttlSeconds: number;
  firstSeenAt?: string;
  attempt?: number;
}): Pass4395StoredRecord {
  const timestamp = input.firstSeenAt ?? nowIso();
  return {
    schemaVersion: "velmere.pass4395.idempotency-record.v2",
    valueHash: cleanHash(input.valueHash),
    state: "PENDING",
    firstSeenAt: timestamp,
    updatedAt: timestamp,
    pendingSince: timestamp,
    attempt: Math.max(1, Math.trunc(input.attempt ?? 1)),
    ttlSeconds: input.ttlSeconds,
    receipt: cloneJsonValue(input.receipt) as Record<string, unknown>,
  };
}

function normalizeStoredRecord(
  value: unknown,
  fallback: {
    valueHash: string;
    ttlSeconds: number;
    firstSeenAt?: string;
    receipt?: Record<string, unknown>;
  },
): Pass4395StoredRecord {
  if (isRecord(value) && value.schemaVersion === "velmere.pass4395.idempotency-record.v2") {
    const firstSeenAt = typeof value.firstSeenAt === "string" ? value.firstSeenAt : fallback.firstSeenAt ?? nowIso();
    const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : firstSeenAt;
    const pendingSince = typeof value.pendingSince === "string" ? value.pendingSince : firstSeenAt;
    const state = isState(value.state) ? value.state : "PENDING";
    const outcome = normalizeOutcomeFromStore(value.outcome);
    const failure = isRecord(value.failure)
      && typeof value.failure.reasonCode === "string"
      && typeof value.failure.failedAt === "string"
      && value.failure.sideEffectStarted === false
      ? {
          reasonCode: value.failure.reasonCode.slice(0, 120),
          failedAt: value.failure.failedAt,
          sideEffectStarted: false as const,
        }
      : undefined;
    return {
      schemaVersion: "velmere.pass4395.idempotency-record.v2",
      valueHash: cleanHash(typeof value.valueHash === "string" ? value.valueHash : fallback.valueHash),
      state: state === "COMPLETED" && !outcome ? "PENDING" : state,
      firstSeenAt,
      updatedAt,
      pendingSince,
      attempt: Math.max(1, Math.trunc(Number(value.attempt) || 1)),
      ttlSeconds: normalizeTtlSeconds(value.ttlSeconds ?? fallback.ttlSeconds),
      receipt: isRecord(value.receipt)
        ? cloneJsonValue(value.receipt) as Record<string, unknown>
        : cloneJsonValue(fallback.receipt ?? {}) as Record<string, unknown>,
      ...(outcome ? { outcome } : {}),
      ...(failure ? { failure } : {}),
    };
  }

  const legacy = isRecord(value) ? value : {};
  const firstSeenAt = typeof legacy.firstSeenAt === "string"
    ? legacy.firstSeenAt
    : fallback.firstSeenAt ?? nowIso();
  return {
    schemaVersion: "velmere.pass4395.idempotency-record.v2",
    valueHash: cleanHash(
      typeof legacy.valueHash === "string" ? legacy.valueHash : fallback.valueHash,
    ),
    state: "PENDING",
    firstSeenAt,
    updatedAt: firstSeenAt,
    pendingSince: firstSeenAt,
    attempt: 1,
    ttlSeconds: normalizeTtlSeconds(legacy.ttlSeconds ?? fallback.ttlSeconds),
    receipt: isRecord(legacy.receipt)
      ? cloneJsonValue(legacy.receipt) as Record<string, unknown>
      : cloneJsonValue(fallback.receipt ?? legacy) as Record<string, unknown>,
  };
}

function parseAdapterDecision(
  value: unknown,
  fallback: Parameters<typeof normalizeStoredRecord>[1],
): AdapterDecision {
  const outer = typeof value === "string"
    ? JSON.parse(value) as unknown
    : value;
  if (!isRecord(outer) || typeof outer.decision !== "string") {
    throw new Error("idempotency_adapter_decision_invalid");
  }
  const allowed = new Set<AdapterDecisionKind>([
    "STARTED",
    "RETRY_STARTED",
    "REPLAY_COMPLETED",
    "PENDING",
    "REQUEST_CONFLICT",
    "COMPLETED",
    "FAILED_RETRYABLE",
    "ALREADY_COMPLETED",
    "NOT_PENDING",
    "MISSING",
  ]);
  if (!allowed.has(outer.decision as AdapterDecisionKind)) {
    throw new Error("idempotency_adapter_decision_unknown");
  }
  let rawRecord = outer.record;
  if (typeof rawRecord === "string") {
    try {
      rawRecord = JSON.parse(rawRecord) as unknown;
    } catch {
      rawRecord = null;
    }
  }
  return {
    decision: outer.decision as AdapterDecisionKind,
    record: rawRecord === null || rawRecord === undefined
      ? null
      : normalizeStoredRecord(rawRecord, fallback),
  };
}

function evaluateExistingRecord(record: Pass4395StoredRecord, valueHash: string): AdapterDecision {
  if (record.valueHash !== cleanHash(valueHash)) {
    return { decision: "REQUEST_CONFLICT", record };
  }
  if (record.state === "COMPLETED" && record.outcome) {
    return { decision: "REPLAY_COMPLETED", record };
  }
  return {
    decision: record.state === "FAILED_RETRYABLE" ? "FAILED_RETRYABLE" : "PENDING",
    record,
  };
}

export function getPass4395DurableIdempotencyRuntimeMode() {
  const upstashReady = hasUpstashConfig();
  const supabaseReady = hasSupabaseServiceRoleConfig();
  const durableRequired = isDurableRequired();
  return {
    passId: "PASS4395_DURABLE_IDEMPOTENCY_RUNTIME_MODE" as const,
    upstashReady,
    supabaseReady,
    durableReady: upstashReady || supabaseReady,
    durableRequired,
    failClosedWhenRequired: true,
    memoryAllowed: !durableRequired,
    productionDefaultFailClosed: true,
    outcomeStateMachine: ["PENDING", "COMPLETED", "FAILED_RETRYABLE"] as const,
    crossSystemEffectOutcomeAtomicityProven: false,
    boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
  };
}

function upstashConfig(): UpstashRestConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token
    ? { url: url.replace(/\/$/u, ""), token, provider: "upstash" }
    : null;
}

async function reserveWithUpstash(input: {
  keyHash: string;
  valueHash: string;
  receipt: Record<string, unknown>;
  ttlSeconds: number;
}): Promise<AdapterDecision | null> {
  const config = upstashConfig();
  if (!config) return null;
  const key = `velmere:idempotency:${cleanHash(input.keyHash)}`;
  const pending = buildPendingRecord(input);
  const result = await executeUpstashRestEval<unknown>({
    script: PASS4395_UPSTASH_RESERVE_LUA,
    keys: [key],
    argv: [
      JSON.stringify(pending),
      cleanHash(input.valueHash),
      input.ttlSeconds,
      nowIso(),
    ],
    config,
    timeoutMs: 2_200,
    operation: "pass4395_idempotency_reserve_v2",
  });
  return parseAdapterDecision(result, input);
}

function supabaseRows(value: string): SupabaseIdempotencyRow[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((row): row is SupabaseIdempotencyRow => isRecord(row))
    : [];
}

function supabaseFilter(value: string) {
  return encodeURIComponent(value);
}

async function readSupabaseRecord(input: {
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  receipt: Record<string, unknown>;
}): Promise<Pass4395StoredRecord | null> {
  const response = await supabaseServiceRestRequest(
    `/velmere_idempotency_keys?key_hash=eq.${supabaseFilter(cleanHash(input.keyHash))}&select=key_hash,value_hash,first_seen_at,expires_at,ttl_seconds,receipt&limit=1`,
    { method: "GET" },
  );
  if (!response) return null;
  if (!response.ok) throw new Error(`supabase_http_${response.status}:read_failed`);
  const rows = supabaseRows((await response.text()).slice(0, 262_144));
  const row = rows[0];
  if (!row) return null;
  return normalizeStoredRecord(row.receipt, {
    valueHash: typeof row.value_hash === "string" ? row.value_hash : input.valueHash,
    ttlSeconds: Number(row.ttl_seconds) || input.ttlSeconds,
    firstSeenAt: typeof row.first_seen_at === "string" ? row.first_seen_at : undefined,
    receipt: input.receipt,
  });
}

async function reacquireSupabaseRetry(input: {
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  receipt: Record<string, unknown>;
  existing: Pass4395StoredRecord;
}): Promise<AdapterDecision> {
  const timestamp = nowIso();
  const retried: Pass4395StoredRecord = {
    ...input.existing,
    state: "PENDING",
    updatedAt: timestamp,
    pendingSince: timestamp,
    attempt: input.existing.attempt + 1,
    ttlSeconds: input.ttlSeconds,
    receipt: cloneJsonValue(input.receipt) as Record<string, unknown>,
  };
  delete retried.failure;
  delete retried.outcome;
  const expiresAt = new Date(nowMs() + input.ttlSeconds * 1000).toISOString();
  const response = await supabaseServiceRestRequest(
    `/velmere_idempotency_keys?key_hash=eq.${supabaseFilter(cleanHash(input.keyHash))}&value_hash=eq.${supabaseFilter(cleanHash(input.valueHash))}&receipt->>state=eq.FAILED_RETRYABLE&receipt->>attempt=eq.${input.existing.attempt}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        receipt: retried,
        expires_at: expiresAt,
        ttl_seconds: input.ttlSeconds,
      }),
    },
  );
  if (!response) throw new Error("supabase_retry_adapter_unavailable");
  if (!response.ok) throw new Error(`supabase_http_${response.status}:retry_failed`);
  const rows = supabaseRows((await response.text()).slice(0, 262_144));
  if (rows.length === 1) return { decision: "RETRY_STARTED", record: retried };
  const raced = await readSupabaseRecord(input);
  return raced ? evaluateExistingRecord(raced, input.valueHash) : { decision: "MISSING", record: null };
}

async function reserveWithSupabase(input: {
  keyHash: string;
  valueHash: string;
  receipt: Record<string, unknown>;
  ttlSeconds: number;
}): Promise<AdapterDecision | null> {
  if (!hasSupabaseServiceRoleConfig()) return null;
  const pending = buildPendingRecord(input);
  const expiresAt = new Date(nowMs() + input.ttlSeconds * 1000).toISOString();
  const response = await supabaseServiceRestRequest("/velmere_idempotency_keys", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      key_hash: cleanHash(input.keyHash),
      value_hash: cleanHash(input.valueHash),
      first_seen_at: pending.firstSeenAt,
      expires_at: expiresAt,
      ttl_seconds: input.ttlSeconds,
      receipt: pending,
      source: "pass4395_client_request_idempotency_v2",
    }),
  });
  if (!response) return null;
  if (response.ok) return { decision: "STARTED", record: pending };
  const responseText = (await response.text()).slice(0, 400);
  if (response.status !== 409 && !/23505|duplicate|unique/iu.test(responseText)) {
    throw new Error(`supabase_http_${response.status}:write_failed`);
  }
  const existing = await readSupabaseRecord(input);
  if (!existing) throw new Error("supabase_duplicate_record_unreadable");
  const evaluated = evaluateExistingRecord(existing, input.valueHash);
  if (evaluated.decision === "FAILED_RETRYABLE") {
    return reacquireSupabaseRetry({ ...input, existing });
  }
  return evaluated;
}

function reserveWithMemory(input: {
  keyHash: string;
  valueHash: string;
  receipt: Record<string, unknown>;
  ttlSeconds: number;
}): AdapterDecision {
  const key = cleanHash(input.keyHash);
  const existing = pass4395MemoryKeys.get(key);
  const now = nowMs();
  if (existing) {
    const expiresAt = Date.parse(existing.firstSeenAt) + existing.ttlSeconds * 1000;
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      pass4395MemoryKeys.delete(key);
    } else {
      const evaluated = evaluateExistingRecord(existing, input.valueHash);
      if (evaluated.decision !== "FAILED_RETRYABLE") return evaluated;
      const timestamp = nowIso();
      const retried: Pass4395StoredRecord = {
        ...existing,
        state: "PENDING",
        updatedAt: timestamp,
        pendingSince: timestamp,
        attempt: existing.attempt + 1,
        ttlSeconds: input.ttlSeconds,
        receipt: cloneJsonValue(input.receipt) as Record<string, unknown>,
      };
      delete retried.failure;
      delete retried.outcome;
      pass4395MemoryKeys.set(key, retried);
      return { decision: "RETRY_STARTED", record: retried };
    }
  }
  const pending = buildPendingRecord(input);
  pass4395MemoryKeys.set(key, pending);
  if (pass4395MemoryKeys.size > MAX_MEMORY_KEYS) {
    const oldest = pass4395MemoryKeys.keys().next().value as string | undefined;
    if (oldest) pass4395MemoryKeys.delete(oldest);
  }
  return { decision: "STARTED", record: pending };
}

function reserveResult(input: {
  decision: AdapterDecision;
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  storageMode: Pass4395DurableIdempotencyStorageMode;
  durable: boolean;
  provider: "upstash" | "supabase" | "memory";
}): Pass4395DurableIdempotencyReserveResult {
  const record = input.decision.record ?? buildPendingRecord({
    valueHash: input.valueHash,
    receipt: {},
    ttlSeconds: input.ttlSeconds,
  });
  const started = input.decision.decision === "STARTED" || input.decision.decision === "RETRY_STARTED";
  const disposition: Pass4395IdempotencyDisposition =
    input.decision.decision === "STARTED"
      ? "STARTED"
      : input.decision.decision === "RETRY_STARTED"
        ? "RETRY_STARTED"
        : input.decision.decision === "REPLAY_COMPLETED"
          ? "REPLAY_COMPLETED"
          : input.decision.decision === "REQUEST_CONFLICT"
            ? "REQUEST_FINGERPRINT_CONFLICT"
            : "PENDING_BLOCKED";
  return {
    passId: "PASS4395_DURABLE_IDEMPOTENCY_RECEIPT",
    ok: started,
    duplicate: !started,
    state: record.state,
    disposition,
    storageMode: input.storageMode,
    durable: input.durable,
    failClosed: input.durable,
    keyHash: cleanHash(input.keyHash),
    valueHash: cleanHash(input.valueHash),
    ttlSeconds: input.ttlSeconds,
    attempt: record.attempt,
    firstSeenAt: record.firstSeenAt,
    ...(!started ? { duplicateSeenAt: nowIso() } : {}),
    ...(record.outcome ? { outcome: publicOutcome(record.outcome) } : {}),
    provider: input.provider,
    ...(disposition === "REQUEST_FINGERPRINT_CONFLICT"
      ? { reason: "same_idempotency_key_has_different_account_or_body_fingerprint" }
      : disposition === "PENDING_BLOCKED"
        ? { reason: "idempotency_request_pending_or_legacy_unfinalized" }
        : {}),
    boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
  };
}

export async function reservePass4395DurableIdempotencyKey(
  input: Pass4395DurableIdempotencyReserveInput,
): Promise<Pass4395DurableIdempotencyReserveResult> {
  const keyHash = cleanHash(input.keyHash);
  const valueHash = cleanHash(input.valueHash);
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds);
  const runtimeMode = getPass4395DurableIdempotencyRuntimeMode();

  if (!runtimeMode.durableReady && runtimeMode.durableRequired) {
    return {
      passId: "PASS4395_DURABLE_IDEMPOTENCY_RECEIPT",
      ok: false,
      duplicate: false,
      state: "PENDING",
      disposition: "DURABLE_UNAVAILABLE",
      storageMode: "durable_required_missing",
      durable: false,
      failClosed: true,
      keyHash,
      valueHash,
      ttlSeconds,
      attempt: 0,
      reason: "durable_idempotency_required_but_no_adapter_configured",
      boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
    };
  }

  try {
    const upstash = await reserveWithUpstash({
      keyHash,
      valueHash,
      receipt: input.receipt,
      ttlSeconds,
    });
    if (upstash) {
      return reserveResult({
        decision: upstash,
        keyHash,
        valueHash,
        ttlSeconds,
        storageMode: "upstash_rest_durable",
        durable: true,
        provider: "upstash",
      });
    }

    const supabase = await reserveWithSupabase({
      keyHash,
      valueHash,
      receipt: input.receipt,
      ttlSeconds,
    });
    if (supabase) {
      return reserveResult({
        decision: supabase,
        keyHash,
        valueHash,
        ttlSeconds,
        storageMode: "supabase_durable",
        durable: true,
        provider: "supabase",
      });
    }
  } catch (error) {
    if (runtimeMode.durableRequired) {
      return {
        passId: "PASS4395_DURABLE_IDEMPOTENCY_RECEIPT",
        ok: false,
        duplicate: false,
        state: "PENDING",
        disposition: "DURABLE_UNAVAILABLE",
        storageMode: "durable_write_failed",
        durable: false,
        failClosed: true,
        keyHash,
        valueHash,
        ttlSeconds,
        attempt: 0,
        providerError: error instanceof Error ? error.message : "durable_adapter_write_failed",
        reason: "durable_adapter_write_failed_fail_closed",
        boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
      };
    }
  }

  const memory = reserveWithMemory({
    keyHash,
    valueHash,
    receipt: input.receipt,
    ttlSeconds,
  });
  return {
    ...reserveResult({
      decision: memory,
      keyHash,
      valueHash,
      ttlSeconds,
      storageMode: "memory_runtime_only",
      durable: false,
      provider: "memory",
    }),
    failClosed: false,
    reason: memory.decision === "REQUEST_CONFLICT"
      ? "same_idempotency_key_has_different_account_or_body_fingerprint"
      : "local_dev_memory_fallback_only",
  };
}

async function finalizeWithUpstash(input: {
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  state: "COMPLETED" | "FAILED_RETRYABLE";
  outcome?: Pass4395StoredOutcome;
  failure?: Pass4395StoredFailure;
}): Promise<AdapterDecision | null> {
  const config = upstashConfig();
  if (!config) return null;
  const result = await executeUpstashRestEval<unknown>({
    script: PASS4395_UPSTASH_FINALIZE_LUA,
    keys: [`velmere:idempotency:${cleanHash(input.keyHash)}`],
    argv: [
      cleanHash(input.valueHash),
      input.state,
      nowIso(),
      JSON.stringify(input.outcome ?? null),
      JSON.stringify(input.failure ?? null),
      input.ttlSeconds,
    ],
    config,
    timeoutMs: 2_200,
    operation: "pass4395_idempotency_finalize_v2",
  });
  return parseAdapterDecision(result, {
    valueHash: input.valueHash,
    ttlSeconds: input.ttlSeconds,
  });
}

async function finalizeWithSupabase(input: {
  keyHash: string;
  valueHash: string;
  ttlSeconds: number;
  state: "COMPLETED" | "FAILED_RETRYABLE";
  outcome?: Pass4395StoredOutcome;
  failure?: Pass4395StoredFailure;
}): Promise<AdapterDecision | null> {
  if (!hasSupabaseServiceRoleConfig()) return null;
  const existing = await readSupabaseRecord({
    keyHash: input.keyHash,
    valueHash: input.valueHash,
    ttlSeconds: input.ttlSeconds,
    receipt: {},
  });
  if (!existing) return { decision: "MISSING", record: null };
  if (existing.valueHash !== cleanHash(input.valueHash)) {
    return { decision: "REQUEST_CONFLICT", record: existing };
  }
  if (existing.state === "COMPLETED") {
    return { decision: "ALREADY_COMPLETED", record: existing };
  }
  if (existing.state !== "PENDING") return { decision: "NOT_PENDING", record: existing };
  const finalized: Pass4395StoredRecord = {
    ...existing,
    state: input.state,
    updatedAt: nowIso(),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.failure ? { failure: input.failure } : {}),
  };
  if (input.state === "COMPLETED") delete finalized.failure;
  else delete finalized.outcome;
  const response = await supabaseServiceRestRequest(
    `/velmere_idempotency_keys?key_hash=eq.${supabaseFilter(cleanHash(input.keyHash))}&value_hash=eq.${supabaseFilter(cleanHash(input.valueHash))}&receipt->>state=eq.PENDING&receipt->>attempt=eq.${existing.attempt}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ receipt: finalized }),
    },
  );
  if (!response) throw new Error("supabase_finalize_adapter_unavailable");
  if (!response.ok) throw new Error(`supabase_http_${response.status}:finalize_failed`);
  const rows = supabaseRows((await response.text()).slice(0, 262_144));
  if (rows.length === 1) return { decision: input.state, record: finalized };
  const raced = await readSupabaseRecord({
    keyHash: input.keyHash,
    valueHash: input.valueHash,
    ttlSeconds: input.ttlSeconds,
    receipt: {},
  });
  return raced
    ? {
        decision: raced.state === "COMPLETED" ? "ALREADY_COMPLETED" : "NOT_PENDING",
        record: raced,
      }
    : { decision: "MISSING", record: null };
}

function finalizeWithMemory(input: {
  keyHash: string;
  valueHash: string;
  state: "COMPLETED" | "FAILED_RETRYABLE";
  outcome?: Pass4395StoredOutcome;
  failure?: Pass4395StoredFailure;
}): AdapterDecision {
  const key = cleanHash(input.keyHash);
  const existing = pass4395MemoryKeys.get(key);
  if (!existing) return { decision: "MISSING", record: null };
  if (existing.valueHash !== cleanHash(input.valueHash)) {
    return { decision: "REQUEST_CONFLICT", record: existing };
  }
  if (existing.state === "COMPLETED") {
    return { decision: "ALREADY_COMPLETED", record: existing };
  }
  if (existing.state !== "PENDING") return { decision: "NOT_PENDING", record: existing };
  const finalized: Pass4395StoredRecord = {
    ...existing,
    state: input.state,
    updatedAt: nowIso(),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.failure ? { failure: input.failure } : {}),
  };
  if (input.state === "COMPLETED") delete finalized.failure;
  else delete finalized.outcome;
  pass4395MemoryKeys.set(key, finalized);
  return { decision: input.state, record: finalized };
}

function outcomesEqual(
  first: Pass4395StoredOutcome | undefined,
  second: Pass4395StoredOutcome | undefined,
) {
  return Boolean(
    first
    && second
    && first.status === second.status
    && first.bodyByteLength === second.bodyByteLength
    && first.bodySha256 === second.bodySha256,
  );
}

function finalizeResult(input: {
  decision: AdapterDecision;
  reservation: Pass4395DurableIdempotencyReserveResult;
  expectedState: "COMPLETED" | "FAILED_RETRYABLE";
  expectedOutcome?: Pass4395StoredOutcome;
}): Pass4395DurableIdempotencyFinalizeResult {
  const record = input.decision.record;
  const exactExistingCompletion =
    input.expectedState === "COMPLETED"
    && input.decision.decision === "ALREADY_COMPLETED"
    && outcomesEqual(record?.outcome, input.expectedOutcome);
  const ok =
    input.decision.decision === input.expectedState
    || exactExistingCompletion;
  return {
    passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
    ok,
    state: record?.state ?? input.expectedState,
    storageMode: input.reservation.storageMode,
    durable: input.reservation.durable,
    failClosed: input.reservation.durable,
    keyHash: input.reservation.keyHash,
    valueHash: input.reservation.valueHash,
    attempt: record?.attempt ?? input.reservation.attempt,
    ...(record?.outcome ? { outcome: publicOutcome(record.outcome) } : {}),
    ...(!ok
      ? {
          reason: input.decision.decision === "REQUEST_CONFLICT"
            ? "request_fingerprint_conflict"
            : input.decision.decision === "ALREADY_COMPLETED"
              ? "completed_outcome_conflict"
              : `idempotency_finalize_${input.decision.decision.toLowerCase()}`,
        }
      : {}),
    boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
  };
}

async function finalizePass4395(input: {
  reservation: Pass4395DurableIdempotencyReserveResult;
  state: "COMPLETED" | "FAILED_RETRYABLE";
  outcome?: Pass4395StoredOutcome;
  failure?: Pass4395StoredFailure;
}): Promise<Pass4395DurableIdempotencyFinalizeResult> {
  const { reservation } = input;
  try {
    let decision: AdapterDecision | null = null;
    if (reservation.storageMode === "memory_runtime_only") {
      decision = finalizeWithMemory({
        keyHash: reservation.keyHash,
        valueHash: reservation.valueHash,
        state: input.state,
        outcome: input.outcome,
        failure: input.failure,
      });
    } else if (reservation.storageMode === "upstash_rest_durable") {
      decision = await finalizeWithUpstash({
        keyHash: reservation.keyHash,
        valueHash: reservation.valueHash,
        ttlSeconds: reservation.ttlSeconds,
        state: input.state,
        outcome: input.outcome,
        failure: input.failure,
      });
    } else if (reservation.storageMode === "supabase_durable") {
      decision = await finalizeWithSupabase({
        keyHash: reservation.keyHash,
        valueHash: reservation.valueHash,
        ttlSeconds: reservation.ttlSeconds,
        state: input.state,
        outcome: input.outcome,
        failure: input.failure,
      });
    }
    if (!decision) {
      return {
        passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
        ok: false,
        state: input.state,
        storageMode: reservation.storageMode,
        durable: false,
        failClosed: true,
        keyHash: reservation.keyHash,
        valueHash: reservation.valueHash,
        attempt: reservation.attempt,
        reason: "idempotency_finalize_adapter_unavailable",
        boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
      };
    }
    return finalizeResult({
      decision,
      reservation,
      expectedState: input.state,
      expectedOutcome: input.outcome,
    });
  } catch (error) {
    return {
      passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
      ok: false,
      state: input.state,
      storageMode: reservation.storageMode,
      durable: false,
      failClosed: true,
      keyHash: reservation.keyHash,
      valueHash: reservation.valueHash,
      attempt: reservation.attempt,
      reason: "idempotency_finalize_failed_closed",
      providerError: error instanceof Error ? error.message : "idempotency_finalize_failed",
      boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
    };
  }
}

export async function completePass4395DurableIdempotencyKey(input: {
  reservation: Pass4395DurableIdempotencyReserveResult;
  status: number;
  body: unknown;
}): Promise<Pass4395DurableIdempotencyFinalizeResult> {
  let outcome: Pass4395StoredOutcome;
  try {
    outcome = normalizeOutcome({ status: input.status, body: input.body });
  } catch (error) {
    return {
      passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
      ok: false,
      state: "PENDING",
      storageMode: input.reservation.storageMode,
      durable: input.reservation.durable,
      failClosed: true,
      keyHash: input.reservation.keyHash,
      valueHash: input.reservation.valueHash,
      attempt: input.reservation.attempt,
      reason: error instanceof Error ? error.message : "idempotency_outcome_invalid",
      boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
    };
  }
  return finalizePass4395({
    reservation: input.reservation,
    state: "COMPLETED",
    outcome,
  });
}

export async function failPass4395DurableIdempotencyKeyRetryable(input: {
  reservation: Pass4395DurableIdempotencyReserveResult;
  reasonCode: string;
  sideEffectStarted: boolean;
}): Promise<Pass4395DurableIdempotencyFinalizeResult> {
  if (input.sideEffectStarted !== false) {
    return {
      passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
      ok: false,
      state: "PENDING",
      storageMode: input.reservation.storageMode,
      durable: input.reservation.durable,
      failClosed: true,
      keyHash: input.reservation.keyHash,
      valueHash: input.reservation.valueHash,
      attempt: input.reservation.attempt,
      reason: "retryable_transition_forbidden_after_side_effect_start",
      boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
    };
  }
  const reasonCode = input.reasonCode
    .trim()
    .replace(/[^a-zA-Z0-9:_.-]/gu, "_")
    .slice(0, 120);
  if (!reasonCode) {
    return {
      passId: "PASS4395_DURABLE_IDEMPOTENCY_FINALIZE_RECEIPT",
      ok: false,
      state: "PENDING",
      storageMode: input.reservation.storageMode,
      durable: input.reservation.durable,
      failClosed: true,
      keyHash: input.reservation.keyHash,
      valueHash: input.reservation.valueHash,
      attempt: input.reservation.attempt,
      reason: "retryable_reason_code_missing",
      boundary: PASS4395_DURABLE_IDEMPOTENCY_BOUNDARY,
    };
  }
  return finalizePass4395({
    reservation: input.reservation,
    state: "FAILED_RETRYABLE",
    failure: {
      reasonCode,
      failedAt: nowIso(),
      sideEffectStarted: false,
    },
  });
}

export function pass4395DurableIdempotencyHeaders(
  receipt: Pass4395DurableIdempotencyReserveResult,
): HeadersInit {
  return {
    "x-velmere-pass4395-idempotency-mode": receipt.storageMode,
    "x-velmere-pass4395-idempotency-durable": receipt.durable ? "true" : "false",
    "x-velmere-pass4395-idempotency-fail-closed": receipt.failClosed ? "true" : "false",
    "x-velmere-pass4395-idempotency-state": receipt.state,
    "x-velmere-pass4395-idempotency-disposition": receipt.disposition,
  };
}
