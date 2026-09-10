import { createHash } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";

export type Pass2178MutationReceiptMode = "supabase" | "memory_blocked_for_production";

export type Pass2178MutationReceipt = {
  schemaVersion: "velmere.pass2178.mutation-receipt.v1";
  receiptId: string;
  route: string;
  method: string;
  action: string;
  targetType: string;
  targetId?: string;
  actorId: string;
  actorMode: "admin" | "member" | "public" | "system" | "unknown";
  persisted: boolean;
  durableWrite: boolean;
  mode: Pass2178MutationReceiptMode;
  createdAt: string;
  redaction: {
    rawPayloadStored: false;
    redactedKeys: string[];
    retainedKeys: string[];
    payloadHash: string;
  };
  safeSummary: string;
  productionBoundary: string;
  providerError?: string;
};

export type Pass2178MutationReceiptSnapshot = {
  schemaVersion: "velmere.pass2178.mutation-receipt-vault-snapshot.v1";
  generatedAt: string;
  mode: Pass2178MutationReceiptMode;
  totalMemoryFallbackReceipts: number;
  recent: Pass2178MutationReceipt[];
  durableStorageReady: boolean;
  storageWritePerformed: boolean;
  productionBoundary: string;
};

const memoryReceipts: Pass2178MutationReceipt[] = [];
const MAX_MEMORY_RECEIPTS = 160;
const SENSITIVE_KEYS = new Set([
  "address",
  "authorization",
  "billing",
  "card",
  "cookie",
  "customer",
  "customerDetails",
  "email",
  "ip",
  "name",
  "phone",
  "raw",
  "rawBody",
  "rawPayload",
  "rawProviderPayload",
  "secret",
  "session",
  "stripeSecret",
  "token",
  "wallet",
]);

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function stableReceiptId(input: unknown) {
  return `vlm_mut_${hash(input).slice(0, 24)}`;
}

function redactPayload(payload: Record<string, unknown> = {}) {
  const redactedKeys: string[] = [];
  const retainedEntries: [string, unknown][] = [];

  for (const [key, value] of Object.entries(payload)) {
    const normalized = key.trim();
    const sensitive = SENSITIVE_KEYS.has(normalized) || /email|phone|address|secret|token|cookie|auth|wallet|card|customer/i.test(normalized);
    if (sensitive) {
      redactedKeys.push(normalized);
      continue;
    }
    if (value === undefined || typeof value === "function") continue;
    const safeValue = typeof value === "string" && value.length > 240 ? `${value.slice(0, 240)}…` : value;
    retainedEntries.push([normalized, safeValue]);
  }

  const retained = Object.fromEntries(retainedEntries.slice(0, 18));
  return {
    retained,
    redaction: {
      rawPayloadStored: false as const,
      redactedKeys: redactedKeys.sort(),
      retainedKeys: Object.keys(retained).sort(),
      payloadHash: `sha256:${hash(payload).slice(0, 32)}`,
    },
  };
}

function routeFromRequest(request?: Request, fallback = "/internal/pass2178") {
  if (!request) return fallback;
  try {
    return new URL(request.url).pathname;
  } catch {
    return fallback;
  }
}

function modeFromConfig(): Pass2178MutationReceiptMode {
  return hasSupabaseServiceRoleConfig() ? "supabase" : "memory_blocked_for_production";
}

export async function appendPass2178MutationReceipt(input: {
  request?: Request;
  route?: string;
  method?: string;
  action: string;
  targetType: string;
  targetId?: string;
  actorId?: string;
  actorMode?: Pass2178MutationReceipt["actorMode"];
  payload?: Record<string, unknown>;
  safeSummary?: string;
}): Promise<Pass2178MutationReceipt> {
  const createdAt = new Date().toISOString();
  const route = input.route ?? routeFromRequest(input.request);
  const method = input.method ?? input.request?.method ?? "INTERNAL";
  const actorId = input.actorId ?? "actor:unknown";
  const actorMode = input.actorMode ?? "unknown";
  const { retained, redaction } = redactPayload(input.payload);
  const receiptSeed = {
    route,
    method,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    actorId,
    actorMode,
    payloadHash: redaction.payloadHash,
    createdHour: createdAt.slice(0, 13),
  };
  const receiptId = stableReceiptId(receiptSeed);
  const base: Pass2178MutationReceipt = {
    schemaVersion: "velmere.pass2178.mutation-receipt.v1",
    receiptId,
    route,
    method,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    actorId,
    actorMode,
    persisted: false,
    durableWrite: false,
    mode: modeFromConfig(),
    createdAt,
    redaction,
    safeSummary:
      input.safeSummary ??
      `${method} ${route} mutation receipt created for ${input.action}; raw payload was hashed/redacted before storage attempt.`,
    productionBoundary:
      "BLOCKED: this receipt is memory-only until Supabase velmere_mutation_receipts accepts the redacted server write.",
  };

  if (!hasSupabaseServiceRoleConfig()) {
    memoryReceipts.unshift(base);
    memoryReceipts.length = Math.min(memoryReceipts.length, MAX_MEMORY_RECEIPTS);
    return base;
  }

  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("supabase_client_unavailable");
    const { error } = await supabase.from("velmere_mutation_receipts").insert({
      receipt_id: receiptId,
      route,
      method,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      actor_id: actorId,
      actor_mode: actorMode,
      redacted_payload: retained,
      redacted_keys: redaction.redactedKeys,
      retained_keys: redaction.retainedKeys,
      payload_hash: redaction.payloadHash,
      safe_summary: base.safeSummary,
    });
    if (error) throw error;
    return {
      ...base,
      persisted: true,
      durableWrite: true,
      mode: "supabase",
      productionBoundary: "Durable redacted mutation receipt written to Supabase server storage.",
    };
  } catch (error) {
    const fallback = {
      ...base,
      mode: "memory_blocked_for_production" as const,
      providerError: error instanceof Error ? error.message : "mutation_receipt_write_failed",
      productionBoundary:
        "BLOCKED: Supabase mutation receipt write failed; do not claim durable mutation truth until this receipt persists.",
    };
    memoryReceipts.unshift(fallback);
    memoryReceipts.length = Math.min(memoryReceipts.length, MAX_MEMORY_RECEIPTS);
    return fallback;
  }
}

export function buildPass2178MutationReceiptVaultSnapshot(limit = 40): Pass2178MutationReceiptSnapshot {
  const mode = modeFromConfig();
  const recent = memoryReceipts.slice(0, Math.max(1, Math.min(limit, 100)));
  return {
    schemaVersion: "velmere.pass2178.mutation-receipt-vault-snapshot.v1",
    generatedAt: new Date().toISOString(),
    mode,
    totalMemoryFallbackReceipts: memoryReceipts.length,
    recent,
    durableStorageReady: mode === "supabase",
    storageWritePerformed: recent.some((receipt) => receipt.durableWrite),
    productionBoundary:
      mode === "supabase"
        ? "Supabase env is configured. Runtime proof still requires a real successful receipt write in production."
        : "Mutation receipt vault is memory-only in this environment. Production requires Supabase service-role storage and retention policy.",
  };
}
