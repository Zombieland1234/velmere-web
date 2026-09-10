import { executeUpstashRestEval } from "@/lib/security/upstash-rest-atomic";
import { sha256Digest, sha256Token } from "@/lib/security/cryptographic-digest";
import type { ProductPublishAuditLedger } from "@/lib/products/product-publish-audit-ledger";
import type { ProductPublishBatchDecision } from "@/lib/products/publish-decision";
import type { ProductImportDraft, ProductStatus, SupportedCurrency } from "@/lib/products/types";

import { canonicalJson } from "@/lib/security/canonical-json";
export type ProductPublishStateStorageMode = "disabled" | "memory_only" | "upstash_hash" | "upstash_fallback_memory";
export type ProductPublishStateStorageProvider = "none" | "memory" | "upstash";

export type ProductPublicationStateRecord = {
  schemaVersion: "velmere.product.publication-state.v1";
  stateId: string;
  productId: string;
  draftId: string;
  slug: string;
  title: string;
  provider: string;
  previousStatus: ProductStatus;
  requestedStatus: ProductStatus;
  finalStatus: ProductStatus;
  statusChanged: boolean;
  batchTraceId: string;
  decisionId: string;
  receiptId: string | null;
  operatorId: string;
  updatedAt: string;
  checksum: string;
  customerVisibility: "hidden" | "preview" | "purchasable";
  redactionBoundary: {
    rawProviderPayloadStored: false;
    secretsStored: false;
    customerPiiStored: false;
  };
  snapshot: {
    priceAmount: number;
    currency: SupportedCurrency;
    imageCount: number;
    variantCount: number;
    providerMappedVariants: number;
    availableVariants: number;
    brainLevel: string;
    brainScore: number | null;
    providerMappingStatus: string;
    stockStatus: string;
    sizeGuideStatus: string;
    checkoutEnabled: boolean;
  };
};

export type ProductPublishStateStorageResult = {
  schemaVersion: "velmere.product.publish-state-storage-result.v1";
  ok: boolean;
  persisted: boolean;
  durableWrite: boolean;
  mode: ProductPublishStateStorageMode;
  provider: ProductPublishStateStorageProvider;
  attempted: boolean;
  batchTraceId: string;
  productCount: number;
  writtenProductCount: number;
  changedProductCount: number;
  duplicateDecisionCount: number;
  stateKey: string | null;
  timelineKey: string | null;
  idempotencyKeys: string[];
  providerError?: string;
  productionBoundary: string;
};

export type ProductPublishStateStorageReadiness = {
  schemaVersion: "velmere.product.publish-state-storage-readiness.v1";
  mode: ProductPublishStateStorageMode;
  provider: ProductPublishStateStorageProvider;
  hasUpstashUrl: boolean;
  hasUpstashToken: boolean;
  stateKeyConfigured: boolean;
  timelineKeyConfigured: boolean;
  maxTimelineRecords: number;
  recentAttempts: ProductPublishStateStorageResult[];
  recentFailureCount: number;
  durableStorageReady: boolean;
  productionBoundary: string;
};

const appendAttempts: ProductPublishStateStorageResult[] = [];
const memoryState = new Map<string, ProductPublicationStateRecord>();
const memoryTimeline: Array<{ batchTraceId: string; createdAt: string; records: ProductPublicationStateRecord[] }> = [];
const MAX_ATTEMPTS = 80;
const MAX_MEMORY_TIMELINE = 80;

function pushAttempt(result: ProductPublishStateStorageResult) {
  appendAttempts.unshift(result);
  if (appendAttempts.length > MAX_ATTEMPTS) appendAttempts.length = MAX_ATTEMPTS;
  return result;
}

function normalizeKey(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/[^a-zA-Z0-9:_@.-]/g, "_").slice(0, 180);
}

const stableStringify = canonicalJson;

function stableHash(input: unknown) {
  const payload = typeof input === "string" ? input : stableStringify(input);
  return sha256Token(payload, 24);
}

function stableDigest(input: unknown) {
  const payload = typeof input === "string" ? input : stableStringify(input);
  return sha256Digest(payload);
}

function getMode(): ProductPublishStateStorageMode {
  if (process.env.VELMERE_PRODUCT_STATUS_WRITE_DISABLED === "1") return "disabled";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_hash";
  return "memory_only";
}

function getProvider(mode: ProductPublishStateStorageMode): ProductPublishStateStorageProvider {
  if (mode === "upstash_hash" || mode === "upstash_fallback_memory") return "upstash";
  if (mode === "memory_only") return "memory";
  return "none";
}

function getStateKey() {
  return normalizeKey(process.env.VELMERE_PRODUCT_STATUS_UPSTASH_KEY, "velmere:products:publication-state");
}

function getTimelineKey() {
  return normalizeKey(process.env.VELMERE_PRODUCT_STATUS_TIMELINE_UPSTASH_KEY, "velmere:products:publication-timeline");
}

function getMaxTimelineRecords() {
  return Math.max(50, Math.min(Number(process.env.VELMERE_PRODUCT_STATUS_TIMELINE_MAX ?? 500) || 500, 2_000));
}

function getTimeoutMs() {
  return Math.max(300, Math.min(Number(process.env.VELMERE_PRODUCT_STATUS_WRITE_TIMEOUT_MS ?? 1_200) || 1_200, 3_000));
}

function customerVisibility(status: ProductStatus, checkoutEnabled: boolean): ProductPublicationStateRecord["customerVisibility"] {
  if (status === "active" && checkoutEnabled) return "purchasable";
  if (status === "coming_soon") return "preview";
  return "hidden";
}

function titleForDraft(draft: ProductImportDraft) {
  return draft.product.title.pl || draft.product.title.en || draft.product.title.de || draft.product.slug;
}

function buildStateRecords(input: {
  drafts: ProductImportDraft[];
  batchDecision: ProductPublishBatchDecision;
  auditLedger: ProductPublishAuditLedger;
}): ProductPublicationStateRecord[] {
  const draftById = new Map(input.drafts.map((draft) => [draft.draftId, draft]));
  const receiptByDecisionId = new Map(input.auditLedger.receipts.map((receipt) => [receipt.decisionId, receipt]));

  return input.batchDecision.decisions.map((decision) => {
    const draft = draftById.get(decision.draftId);
    const receipt = receiptByDecisionId.get(decision.decisionId);
    const stateSeed = {
      productId: decision.productId,
      decisionId: decision.decisionId,
      receiptId: receipt?.receiptId ?? null,
      batchTraceId: input.batchDecision.batchTraceId,
      previousStatus: decision.currentStatus,
      finalStatus: decision.finalStatus,
      snapshot: decision.snapshot,
    };
    const checksum = stableDigest(stateSeed);

    return {
      schemaVersion: "velmere.product.publication-state.v1",
      stateId: `vpps_${stableHash({ stateSeed, kind: "state" })}`,
      productId: decision.productId,
      draftId: decision.draftId,
      slug: decision.slug,
      title: draft ? titleForDraft(draft) : decision.title,
      provider: decision.provider,
      previousStatus: decision.currentStatus,
      requestedStatus: decision.targetStatus,
      finalStatus: decision.finalStatus,
      statusChanged: decision.willChangeStatus,
      batchTraceId: input.batchDecision.batchTraceId,
      decisionId: decision.decisionId,
      receiptId: receipt?.receiptId ?? null,
      operatorId: input.auditLedger.operatorId,
      updatedAt: input.auditLedger.createdAt,
      checksum,
      customerVisibility: customerVisibility(decision.finalStatus, decision.snapshot.checkoutEnabled),
      redactionBoundary: {
        rawProviderPayloadStored: false,
        secretsStored: false,
        customerPiiStored: false,
      },
      snapshot: {
        priceAmount: decision.snapshot.priceAmount,
        currency: (decision.snapshot.currency || "EUR") as SupportedCurrency,
        imageCount: decision.snapshot.imageCount,
        variantCount: decision.snapshot.variantCount,
        providerMappedVariants: decision.snapshot.providerMappedVariants,
        availableVariants: decision.snapshot.availableVariants,
        brainLevel: decision.snapshot.brainLevel,
        brainScore: decision.snapshot.brainScore,
        providerMappingStatus: decision.snapshot.providerMappingStatus,
        stockStatus: decision.snapshot.stockStatus,
        sizeGuideStatus: decision.snapshot.sizeGuideStatus,
        checkoutEnabled: decision.snapshot.checkoutEnabled,
      },
    };
  });
}

function idempotencyKeyForState(record: ProductPublicationStateRecord) {
  const safe = normalizeKey(`${record.batchTraceId}:${record.decisionId}:${record.finalStatus}:${record.checksum}`, record.stateId);
  return `velmere:products:publication-state:idempotency:${stableHash(safe)}:${safe.slice(0, 72)}`;
}

function buildTimelinePayload(records: ProductPublicationStateRecord[], auditLedger: ProductPublishAuditLedger) {
  return {
    schemaVersion: "velmere.product.publication-timeline-entry.v1",
    batchTraceId: auditLedger.batchTraceId,
    batchReceiptId: auditLedger.batchReceiptId,
    operatorId: auditLedger.operatorId,
    createdAt: auditLedger.createdAt,
    targetStatus: auditLedger.targetStatus,
    selectedCount: auditLedger.selectedCount,
    receiptCount: auditLedger.receiptCount,
    changedCount: records.filter((record) => record.statusChanged).length,
    records: records.map((record) => ({
      stateId: record.stateId,
      productId: record.productId,
      draftId: record.draftId,
      slug: record.slug,
      title: record.title,
      previousStatus: record.previousStatus,
      requestedStatus: record.requestedStatus,
      finalStatus: record.finalStatus,
      statusChanged: record.statusChanged,
      customerVisibility: record.customerVisibility,
      decisionId: record.decisionId,
      receiptId: record.receiptId,
      checksum: record.checksum,
    })),
    redactionBoundary: {
      rawProviderPayloadStored: false,
      secretsStored: false,
      customerPiiStored: false,
      allowedFields: ["product identifiers", "status diff", "decision/receipt ids", "readiness snapshot hash", "operator id"],
    },
  };
}

function baseResult(records: ProductPublicationStateRecord[], auditLedger: ProductPublishAuditLedger, overrides: Partial<ProductPublishStateStorageResult>): ProductPublishStateStorageResult {
  const mode = overrides.mode ?? getMode();
  return {
    schemaVersion: "velmere.product.publish-state-storage-result.v1",
    ok: false,
    persisted: false,
    durableWrite: false,
    mode,
    provider: overrides.provider ?? getProvider(mode),
    attempted: false,
    batchTraceId: auditLedger.batchTraceId,
    productCount: records.length,
    writtenProductCount: 0,
    changedProductCount: records.filter((record) => record.statusChanged).length,
    duplicateDecisionCount: 0,
    stateKey: null,
    timelineKey: null,
    idempotencyKeys: records.map(idempotencyKeyForState),
    productionBoundary:
      "Product publication state storage stores only redacted status overrides and readiness snapshots. It never stores raw provider payloads, auth headers, customer PII or secrets.",
    ...overrides,
  };
}

function appendMemory(records: ProductPublicationStateRecord[], auditLedger: ProductPublishAuditLedger, mode: ProductPublishStateStorageMode, providerError?: string) {
  for (const record of records) memoryState.set(record.productId, record);
  memoryTimeline.unshift({ batchTraceId: auditLedger.batchTraceId, createdAt: auditLedger.createdAt, records });
  if (memoryTimeline.length > MAX_MEMORY_TIMELINE) memoryTimeline.length = MAX_MEMORY_TIMELINE;

  return pushAttempt(
    baseResult(records, auditLedger, {
      ok: mode !== "upstash_fallback_memory",
      persisted: false,
      durableWrite: false,
      mode,
      provider: mode === "memory_only" ? "memory" : "upstash",
      attempted: mode === "upstash_fallback_memory",
      writtenProductCount: records.length,
      stateKey: mode === "memory_only" ? "memory:products:publication-state" : getStateKey(),
      timelineKey: mode === "memory_only" ? "memory:products:publication-timeline" : getTimelineKey(),
      providerError,
    }),
  );
}

async function writeToUpstash(records: ProductPublicationStateRecord[], auditLedger: ProductPublishAuditLedger): Promise<ProductPublishStateStorageResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return appendMemory(records, auditLedger, "memory_only", "upstash_env_missing");

  const stateKey = getStateKey();
  const timelineKey = getTimelineKey();
  const maxTimelineRecords = getMaxTimelineRecords();
  const idempotencyKeys = records.map(idempotencyKeyForState);
  const idempotencyTtlSeconds = Math.max(
    60 * 60 * 24,
    Math.min(Number(process.env.VELMERE_PRODUCT_STATUS_IDEMPOTENCY_TTL_SECONDS ?? 60 * 60 * 24 * 90) || 60 * 60 * 24 * 90, 60 * 60 * 24 * 366),
  );
  const recordArguments = records.flatMap((record) => [record.stateId ?? auditLedger.batchTraceId, record.productId, JSON.stringify(record)]);
  const lua = [
    "local itemCount = #KEYS - 2",
    "local stateKey = KEYS[#KEYS - 1]",
    "local timelineKey = KEYS[#KEYS]",
    "local written = 0",
    "for i = 1, itemCount do",
    "  local offset = 3 + ((i - 1) * 3)",
    "  if redis.call('EXISTS', KEYS[i]) == 0 then",
    "    redis.call('SET', KEYS[i], ARGV[offset + 1], 'EX', ARGV[1])",
    "    redis.call('HSET', stateKey, ARGV[offset + 2], ARGV[offset + 3])",
    "    written = written + 1",
    "  end",
    "end",
    "if written > 0 then",
    "  redis.call('LPUSH', timelineKey, ARGV[2])",
    "  redis.call('LTRIM', timelineKey, 0, tonumber(ARGV[3]) - 1)",
    "end",
    "return {written, itemCount - written}",
  ].join("\n");

  try {
    const result = await executeUpstashRestEval<unknown>({
      script: lua,
      keys: [...idempotencyKeys, stateKey, timelineKey],
      argv: [
        String(idempotencyTtlSeconds),
        JSON.stringify(buildTimelinePayload(records, auditLedger)),
        String(maxTimelineRecords),
        ...recordArguments,
      ],
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs: getTimeoutMs(),
      operation: "product_publication_state_atomic_write",
    });
    const values = Array.isArray(result) ? result : [];
    const writtenProductCount = Number(values[0]);
    const duplicateDecisionCount = Number(values[1]);
    if (!Number.isInteger(writtenProductCount) || writtenProductCount < 0 || !Number.isInteger(duplicateDecisionCount) || duplicateDecisionCount < 0 || writtenProductCount + duplicateDecisionCount !== records.length) {
      throw new Error("upstash_product_publication_state_eval_result_invalid");
    }
    return pushAttempt(
      baseResult(records, auditLedger, {
        ok: true,
        persisted: true,
        durableWrite: true,
        mode: "upstash_hash",
        provider: "upstash",
        attempted: true,
        writtenProductCount,
        duplicateDecisionCount,
        stateKey,
        timelineKey,
        idempotencyKeys,
      }),
    );
  } catch (error) {
    return appendMemory(records, auditLedger, "upstash_fallback_memory", error instanceof Error ? error.message.slice(0, 160) : "upstash_state_unknown_error");
  }
}

export async function persistProductPublishStateBestEffort(input: {
  drafts: ProductImportDraft[];
  batchDecision: ProductPublishBatchDecision;
  auditLedger: ProductPublishAuditLedger;
}): Promise<ProductPublishStateStorageResult> {
  const records = buildStateRecords(input);
  const mode = getMode();

  if (mode === "disabled") {
    return pushAttempt(
      baseResult(records, input.auditLedger, {
        ok: true,
        mode,
        provider: "none",
        attempted: false,
        providerError: "product_status_write_disabled_by_env",
      }),
    );
  }

  if (mode === "memory_only") return appendMemory(records, input.auditLedger, mode);
  return writeToUpstash(records, input.auditLedger);
}

export function listProductPublishStateStorageAttempts(limit = 30) {
  return appendAttempts.slice(0, Math.max(1, Math.min(limit, MAX_ATTEMPTS)));
}

export function listProductPublishStateMemoryRecords(limit = 50) {
  return Array.from(memoryState.values()).slice(0, Math.max(1, Math.min(limit, 200)));
}

export function listProductPublishStateMemoryTimeline(limit = 20) {
  return memoryTimeline.slice(0, Math.max(1, Math.min(limit, MAX_MEMORY_TIMELINE)));
}

export function buildProductPublishStateStorageReadiness(): ProductPublishStateStorageReadiness {
  const mode = getMode();
  const recent = listProductPublishStateStorageAttempts(20);
  return {
    schemaVersion: "velmere.product.publish-state-storage-readiness.v1",
    mode,
    provider: getProvider(mode),
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    stateKeyConfigured: Boolean(process.env.VELMERE_PRODUCT_STATUS_UPSTASH_KEY),
    timelineKeyConfigured: Boolean(process.env.VELMERE_PRODUCT_STATUS_TIMELINE_UPSTASH_KEY),
    maxTimelineRecords: getMaxTimelineRecords(),
    recentAttempts: recent,
    recentFailureCount: recent.filter((attempt) => !attempt.ok).length,
    durableStorageReady: mode === "upstash_hash",
    productionBoundary:
      "Ready means a server-only Upstash status override path is configured. Full commerce database/order persistence remains a separate launch gate.",
  };
}
