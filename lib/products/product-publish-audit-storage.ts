import { executeUpstashRestEval } from "@/lib/security/upstash-rest-atomic";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { ProductPublishAuditLedger, ProductPublishAuditReceipt } from "@/lib/products/product-publish-audit-ledger";

export type ProductPublishAuditStorageMode = "disabled" | "memory_only" | "upstash_list" | "upstash_fallback_memory";
export type ProductPublishAuditStorageProvider = "none" | "memory" | "upstash";

export type ProductPublishAuditStorageResult = {
  schemaVersion: "velmere.product.publish-audit-storage-result.v1";
  ok: boolean;
  persisted: boolean;
  durableWrite: boolean;
  mode: ProductPublishAuditStorageMode;
  provider: ProductPublishAuditStorageProvider;
  attempted: boolean;
  batchReceiptId: string;
  batchTraceId: string;
  receiptCount: number;
  writtenReceiptCount: number;
  duplicateReceiptCount: number;
  ledgerKey: string | null;
  idempotencyKeys: string[];
  providerError?: string;
  productionBoundary: string;
};

export type ProductPublishAuditStorageReadiness = {
  schemaVersion: "velmere.product.publish-audit-storage-readiness.v1";
  mode: ProductPublishAuditStorageMode;
  provider: ProductPublishAuditStorageProvider;
  hasUpstashUrl: boolean;
  hasUpstashToken: boolean;
  keyConfigured: boolean;
  maxRecords: number;
  recentAttempts: ProductPublishAuditStorageResult[];
  recentFailureCount: number;
  durableStorageReady: boolean;
  productionBoundary: string;
};

const appendAttempts: ProductPublishAuditStorageResult[] = [];
const memoryLedger: Array<{ batchReceiptId: string; createdAt: string; payload: unknown }> = [];
const MAX_ATTEMPTS = 80;
const MAX_MEMORY_LEDGER = 80;

function pushAttempt(result: ProductPublishAuditStorageResult) {
  appendAttempts.unshift(result);
  if (appendAttempts.length > MAX_ATTEMPTS) appendAttempts.length = MAX_ATTEMPTS;
  return result;
}

function normalizeKey(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

function stableHash(input: string) {
  return sha256Token(input, 24);
}

function getMode(): ProductPublishAuditStorageMode {
  if (process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_APPEND_DISABLED === "1") return "disabled";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_list";
  return "memory_only";
}

function getProvider(mode: ProductPublishAuditStorageMode): ProductPublishAuditStorageProvider {
  if (mode === "upstash_list" || mode === "upstash_fallback_memory") return "upstash";
  if (mode === "memory_only") return "memory";
  return "none";
}

function getLedgerKey() {
  return normalizeKey(process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_UPSTASH_KEY, "velmere:products:publish-audit");
}

function getMaxRecords() {
  return Math.max(50, Math.min(Number(process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_UPSTASH_MAX ?? 500) || 500, 2_000));
}

function getTimeoutMs() {
  return Math.max(300, Math.min(Number(process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_APPEND_TIMEOUT_MS ?? 1_200) || 1_200, 3_000));
}

function idempotencyKeyForReceipt(receipt: ProductPublishAuditReceipt) {
  const safe = normalizeKey(receipt.idempotencyKey, `publish:${receipt.receiptId}`);
  return `velmere:products:publish-audit:idempotency:${stableHash(safe)}:${safe.slice(0, 72)}`;
}

function buildSafePayload(ledger: ProductPublishAuditLedger) {
  return {
    schemaVersion: "velmere.product.publish-audit-storage-payload.v1",
    batchReceiptId: ledger.batchReceiptId,
    batchTraceId: ledger.batchTraceId,
    createdAt: ledger.createdAt,
    operatorId: ledger.operatorId,
    targetStatus: ledger.targetStatus,
    selectedCount: ledger.selectedCount,
    receiptCount: ledger.receiptCount,
    summary: ledger.summary,
    receipts: ledger.receipts.map((receipt) => ({
      receiptId: receipt.receiptId,
      caseId: receipt.caseId,
      decisionId: receipt.decisionId,
      action: receipt.action,
      target: receipt.target,
      statusDiff: receipt.statusDiff,
      decisionSnapshot: receipt.decisionSnapshot,
      blockers: receipt.blockers.slice(0, 12),
      reviewNotes: receipt.reviewNotes.slice(0, 12),
      checklistSnapshot: receipt.checklistSnapshot.slice(0, 16),
      redaction: receipt.redaction,
      idempotencyKey: receipt.idempotencyKey,
      checksum: receipt.checksum,
      retentionClass: receipt.retentionClass,
    })),
    redactionBoundary: {
      rawProviderPayloadStored: false,
      secretsStored: false,
      customerPiiStored: false,
      allowedFields: [
        "batchReceiptId",
        "operatorId",
        "target product identifiers",
        "status diff",
        "AI/provider readiness snapshot",
        "blocker/review reason codes",
        "checksum",
      ],
    },
  };
}

function baseResult(ledger: ProductPublishAuditLedger, overrides: Partial<ProductPublishAuditStorageResult>): ProductPublishAuditStorageResult {
  const mode = overrides.mode ?? getMode();
  return {
    schemaVersion: "velmere.product.publish-audit-storage-result.v1",
    ok: false,
    persisted: false,
    durableWrite: false,
    mode,
    provider: overrides.provider ?? getProvider(mode),
    attempted: false,
    batchReceiptId: ledger.batchReceiptId,
    batchTraceId: ledger.batchTraceId,
    receiptCount: ledger.receiptCount,
    writtenReceiptCount: 0,
    duplicateReceiptCount: 0,
    ledgerKey: null,
    idempotencyKeys: ledger.receipts.map(idempotencyKeyForReceipt),
    productionBoundary:
      "Product publish audit storage stores only redacted receipts. It never stores raw provider payloads, authorization headers, raw customer data or secrets.",
    ...overrides,
  };
}

function appendMemory(ledger: ProductPublishAuditLedger, mode: ProductPublishAuditStorageMode, providerError?: string) {
  memoryLedger.unshift({ batchReceiptId: ledger.batchReceiptId, createdAt: ledger.createdAt, payload: buildSafePayload(ledger) });
  if (memoryLedger.length > MAX_MEMORY_LEDGER) memoryLedger.length = MAX_MEMORY_LEDGER;
  return pushAttempt(
    baseResult(ledger, {
      ok: mode !== "upstash_fallback_memory",
      persisted: false,
      durableWrite: false,
      mode,
      provider: mode === "memory_only" ? "memory" : "upstash",
      attempted: mode === "upstash_fallback_memory",
      writtenReceiptCount: ledger.receiptCount,
      ledgerKey: mode === "memory_only" ? "memory:products:publish-audit" : getLedgerKey(),
      providerError,
    }),
  );
}

async function appendToUpstash(ledger: ProductPublishAuditLedger): Promise<ProductPublishAuditStorageResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return appendMemory(ledger, "memory_only", "upstash_env_missing");

  const ledgerKey = getLedgerKey();
  const maxRecords = getMaxRecords();
  const idempotencyKeys = ledger.receipts.map(idempotencyKeyForReceipt);
  const idempotencyValues = ledger.receipts.map((receipt) => receipt.receiptId ?? ledger.batchReceiptId);
  const idempotencyTtlSeconds = Math.max(
    60 * 60 * 24,
    Math.min(Number(process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_IDEMPOTENCY_TTL_SECONDS ?? 60 * 60 * 24 * 90) || 60 * 60 * 24 * 90, 60 * 60 * 24 * 366),
  );
  const lua = [
    "local itemCount = #KEYS - 1",
    "local written = 0",
    "for i = 1, itemCount do",
    "  if redis.call('EXISTS', KEYS[i]) == 0 then",
    "    redis.call('SET', KEYS[i], ARGV[3 + i], 'EX', ARGV[1])",
    "    written = written + 1",
    "  end",
    "end",
    "if written > 0 then",
    "  redis.call('LPUSH', KEYS[#KEYS], ARGV[2])",
    "  redis.call('LTRIM', KEYS[#KEYS], 0, tonumber(ARGV[3]) - 1)",
    "end",
    "return {written, itemCount - written}",
  ].join("\n");

  try {
    const result = await executeUpstashRestEval<unknown>({
      script: lua,
      keys: [...idempotencyKeys, ledgerKey],
      argv: [
        String(idempotencyTtlSeconds),
        JSON.stringify(buildSafePayload(ledger)),
        String(maxRecords),
        ...idempotencyValues,
      ],
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs: getTimeoutMs(),
      operation: "product_publish_audit_atomic_append",
    });
    const values = Array.isArray(result) ? result : [];
    const writtenReceiptCount = Number(values[0]);
    const duplicateReceiptCount = Number(values[1]);
    if (!Number.isInteger(writtenReceiptCount) || writtenReceiptCount < 0 || !Number.isInteger(duplicateReceiptCount) || duplicateReceiptCount < 0 || writtenReceiptCount + duplicateReceiptCount !== ledger.receiptCount) {
      throw new Error("upstash_product_publish_audit_eval_result_invalid");
    }
    return pushAttempt(
      baseResult(ledger, {
        ok: true,
        persisted: true,
        durableWrite: true,
        mode: "upstash_list",
        provider: "upstash",
        attempted: true,
        writtenReceiptCount,
        duplicateReceiptCount,
        ledgerKey,
        idempotencyKeys,
      }),
    );
  } catch (error) {
    return appendMemory(ledger, "upstash_fallback_memory", error instanceof Error ? error.message.slice(0, 160) : "upstash_unknown_error");
  }
}

export async function appendProductPublishAuditLedgerBestEffort(ledger: ProductPublishAuditLedger): Promise<ProductPublishAuditStorageResult> {
  const mode = getMode();
  if (mode === "disabled") {
    return pushAttempt(
      baseResult(ledger, {
        ok: true,
        mode,
        provider: "none",
        attempted: false,
        providerError: "append_disabled_by_env",
      }),
    );
  }

  if (mode === "memory_only") return appendMemory(ledger, mode);
  return appendToUpstash(ledger);
}

export function attachProductPublishAuditStorageResult(
  ledger: ProductPublishAuditLedger,
  result: ProductPublishAuditStorageResult,
): ProductPublishAuditLedger {
  return {
    ...ledger,
    ledgerMode: result.persisted ? "durable_append_written" : result.mode === "upstash_fallback_memory" ? "durable_append_failed" : ledger.ledgerMode,
    durableWrite: result.durableWrite,
    storage: {
      persisted: result.persisted,
      mode: result.mode,
      provider: result.provider,
      attempted: result.attempted,
      ledgerKey: result.ledgerKey,
      writtenReceiptCount: result.writtenReceiptCount,
      duplicateReceiptCount: result.duplicateReceiptCount,
      productionBlockers: result.persisted
        ? []
        : result.mode === "memory_only"
          ? ["UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured.", "Memory ledger is not durable across deploys/restarts."]
          : result.mode === "disabled"
            ? ["Product publish audit append is disabled by VELMERE_PRODUCT_PUBLISH_AUDIT_APPEND_DISABLED=1."]
            : [result.providerError ?? "Durable append failed and fell back to memory."],
      nextStep: result.persisted
        ? "Audit ledger receipt was appended to durable Upstash list; next connect admin read/export UI."
        : "Configure Upstash Redis REST env vars before public active-selling operations.",
    },
  };
}

export function listProductPublishAuditStorageAttempts(limit = 30) {
  return appendAttempts.slice(0, Math.max(1, Math.min(limit, 80)));
}

export function listProductPublishAuditMemoryLedger(limit = 20) {
  return memoryLedger.slice(0, Math.max(1, Math.min(limit, MAX_MEMORY_LEDGER)));
}

export function buildProductPublishAuditStorageReadiness(): ProductPublishAuditStorageReadiness {
  const mode = getMode();
  const recent = listProductPublishAuditStorageAttempts(20);
  return {
    schemaVersion: "velmere.product.publish-audit-storage-readiness.v1",
    mode,
    provider: getProvider(mode),
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    keyConfigured: Boolean(process.env.VELMERE_PRODUCT_PUBLISH_AUDIT_UPSTASH_KEY),
    maxRecords: getMaxRecords(),
    recentAttempts: recent,
    recentFailureCount: recent.filter((attempt) => !attempt.ok).length,
    durableStorageReady: mode === "upstash_list",
    productionBoundary:
      "Ready means a server-only Upstash append path is configured. Product status persistence is still separate from audit receipt storage.",
  };
}
