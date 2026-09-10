import { sha256Digest, sha256Token } from "@/lib/security/cryptographic-digest";
import type { ProductPublishBatchDecision, ProductPublishDecision, ProductPublishTargetStatus } from "@/lib/products/publish-decision";

import { canonicalJson } from "@/lib/security/canonical-json";
export type ProductPublishAuditLedgerMode = "preview_static_mvp" | "durable_pending" | "durable_append_ready" | "durable_append_written" | "durable_append_failed";

export type ProductPublishAuditReceipt = {
  schemaVersion: "velmere.product.publish-audit-receipt.v1";
  receiptId: string;
  caseId: string;
  decisionId: string;
  batchTraceId: string;
  createdAt: string;
  operatorId: string;
  action: "draft_publish" | "active_publish";
  target: {
    productId: string;
    draftId: string;
    slug: string;
    title: string;
    provider: string;
  };
  statusDiff: {
    previous: string;
    requested: ProductPublishTargetStatus;
    final: ProductPublishTargetStatus;
    changed: boolean;
    activeBlocked: boolean;
    publishAllowed: boolean;
  };
  decisionSnapshot: {
    brainScore: number | null;
    brainLevel: string;
    garmentType: string;
    sourceQuality: string;
    priceAmount: number;
    currency: string;
    imageCount: number;
    variantCount: number;
    providerMappedVariants: number;
    availableVariants: number;
    providerMappingStatus: string;
    stockStatus: string;
    sizeGuideStatus: string;
    checkoutEnabled: boolean;
  };
  blockers: string[];
  reviewNotes: string[];
  checklistSnapshot: string[];
  redaction: {
    rawProviderPayloadStored: false;
    secretsStored: false;
    customerSafe: boolean;
    allowedFields: string[];
  };
  idempotencyKey: string;
  checksum: string;
  retentionClass: "launch_review" | "customer_support" | "security_review";
};

export type ProductPublishAuditLedger = {
  schemaVersion: "velmere.product.publish-audit-ledger.v1";
  ledgerMode: ProductPublishAuditLedgerMode;
  batchReceiptId: string;
  batchTraceId: string;
  createdAt: string;
  operatorId: string;
  targetStatus: ProductPublishTargetStatus;
  selectedCount: number;
  receiptCount: number;
  durableWrite: boolean;
  storage: {
    persisted: boolean;
    mode:
      | "static_catalog_mvp"
      | "database_required"
      | "disabled"
      | "memory_only"
      | "upstash_list"
      | "upstash_fallback_memory";
    provider?: "none" | "memory" | "upstash";
    attempted?: boolean;
    ledgerKey?: string | null;
    writtenReceiptCount?: number;
    duplicateReceiptCount?: number;
    productionBlockers: string[];
    nextStep: string;
  };
  summary: {
    activePublishes: number;
    draftPublishes: number;
    blockedReceipts: number;
    changedStatuses: number;
  };
  receipts: ProductPublishAuditReceipt[];
};

type ProductPublishAuditLedgerInput = {
  batchDecision: ProductPublishBatchDecision;
  operatorId?: string;
  confirmedAt?: string;
  commitIntent?: boolean;
};

const stableStringify = canonicalJson;

function stableHash(input: unknown) {
  const payload = typeof input === "string" ? input : stableStringify(input);
  return sha256Token(payload, 24);
}

function stableDigest(input: unknown) {
  const payload = typeof input === "string" ? input : stableStringify(input);
  return sha256Digest(payload);
}

function safeOperatorId(value: string | undefined) {
  const candidate = String(value ?? "").trim();
  if (!candidate || candidate === "operator:unknown") return "operator:admin-import-token-preview";
  return candidate.replace(/[^a-z0-9:_@.-]/gi, "_").slice(0, 96);
}

function actionForDecision(decision: ProductPublishDecision): ProductPublishAuditReceipt["action"] {
  return decision.targetStatus === "active" ? "active_publish" : "draft_publish";
}

function checklistForDecision(decision: ProductPublishDecision) {
  const base = [
    `operator-confirmation-required:${decision.operatorConfirmationRequired}`,
    `target-status:${decision.targetStatus}`,
    `final-status:${decision.finalStatus}`,
    `brain:${decision.snapshot.brainLevel}:${decision.snapshot.brainScore ?? "na"}`,
    `provider-mapping:${decision.snapshot.providerMappingStatus}`,
    `stock:${decision.snapshot.stockStatus}`,
    `size-guide:${decision.snapshot.sizeGuideStatus}`,
    `checkout:${decision.snapshot.checkoutEnabled ? "enabled" : "blocked"}`,
  ];

  const blockers = decision.reasons
    .filter((item) => item.severity === "block")
    .slice(0, 6)
    .map((item) => `block:${item.source}:${item.code}`);

  return [...base, ...blockers];
}

function receiptForDecision(input: {
  decision: ProductPublishDecision;
  batchTraceId: string;
  createdAt: string;
  operatorId: string;
  commitIntent: boolean;
}): ProductPublishAuditReceipt {
  const { decision, batchTraceId, createdAt, operatorId, commitIntent } = input;
  const blockers = decision.reasons.filter((item) => item.severity === "block").map((item) => `${item.source}:${item.code}:${item.label}`);
  const reviewNotes = decision.reasons.filter((item) => item.severity === "review").map((item) => `${item.source}:${item.code}:${item.label}`);
  const checksumSeed = {
    batchTraceId,
    decisionId: decision.decisionId,
    operatorId,
    createdAt,
    targetStatus: decision.targetStatus,
    finalStatus: decision.finalStatus,
    snapshot: decision.snapshot,
    blockers,
    reviewNotes,
    commitIntent,
  };
  const checksum = stableDigest(checksumSeed);
  const action = actionForDecision(decision);
  const caseSeed = `${batchTraceId}:${decision.decisionId}:${decision.productId}:${decision.finalStatus}:${checksum}`;

  return {
    schemaVersion: "velmere.product.publish-audit-receipt.v1",
    receiptId: `vpar_${stableHash({ caseSeed, kind: "receipt" })}`,
    caseId: `product-${action}-${stableHash(caseSeed)}`,
    decisionId: decision.decisionId,
    batchTraceId,
    createdAt,
    operatorId,
    action,
    target: {
      productId: decision.productId,
      draftId: decision.draftId,
      slug: decision.slug,
      title: decision.title,
      provider: decision.provider,
    },
    statusDiff: {
      previous: decision.currentStatus,
      requested: decision.targetStatus,
      final: decision.finalStatus,
      changed: decision.willChangeStatus,
      activeBlocked: decision.activeBlocked,
      publishAllowed: decision.publishAllowed,
    },
    decisionSnapshot: { ...decision.snapshot },
    blockers,
    reviewNotes,
    checklistSnapshot: checklistForDecision(decision),
    redaction: {
      rawProviderPayloadStored: false,
      secretsStored: false,
      customerSafe: blockers.length === 0,
      allowedFields: [
        "productId",
        "draftId",
        "slug",
        "provider",
        "statusDiff",
        "brainScore",
        "providerMappingStatus",
        "stockStatus",
        "sizeGuideStatus",
        "checkoutEnabled",
        "reasonCodes",
      ],
    },
    idempotencyKey: `publish:${batchTraceId}:${decision.decisionId}:${decision.finalStatus}`,
    checksum,
    retentionClass: "launch_review",
  };
}

export function createProductPublishAuditLedger(input: ProductPublishAuditLedgerInput): ProductPublishAuditLedger {
  const createdAt = input.confirmedAt?.trim() || new Date().toISOString();
  const operatorId = safeOperatorId(input.operatorId);
  const receipts = input.batchDecision.decisions.map((decision) =>
    receiptForDecision({
      decision,
      batchTraceId: input.batchDecision.batchTraceId,
      createdAt,
      operatorId,
      commitIntent: Boolean(input.commitIntent),
    }),
  );
  const activePublishes = receipts.filter((receipt) => receipt.action === "active_publish" && receipt.statusDiff.final === "active").length;
  const draftPublishes = receipts.filter((receipt) => receipt.statusDiff.final === "coming_soon").length;
  const blockedReceipts = receipts.filter((receipt) => !receipt.statusDiff.publishAllowed || receipt.statusDiff.activeBlocked || receipt.blockers.length > 0).length;
  const changedStatuses = receipts.filter((receipt) => receipt.statusDiff.changed).length;
  const batchReceiptId = `vpal_${stableHash({
    batchTraceId: input.batchDecision.batchTraceId,
    createdAt,
    operatorId,
    receipts: receipts.map((receipt) => receipt.receiptId),
  })}`;

  return {
    schemaVersion: "velmere.product.publish-audit-ledger.v1",
    ledgerMode: "preview_static_mvp",
    batchReceiptId,
    batchTraceId: input.batchDecision.batchTraceId,
    createdAt,
    operatorId,
    targetStatus: input.batchDecision.targetStatus,
    selectedCount: input.batchDecision.selectedCount,
    receiptCount: receipts.length,
    durableWrite: false,
    storage: {
      persisted: false,
      mode: "static_catalog_mvp",
      productionBlockers: [
        "No durable product database is configured yet.",
        "No auth-bound operator session is attached to the admin import token yet.",
        "Audit receipts are returned to the operator but not stored server-side in this MVP.",
      ],
      nextStep: "Wire this ledger to the durable storage adapter before public active-selling operations.",
    },
    summary: {
      activePublishes,
      draftPublishes,
      blockedReceipts,
      changedStatuses,
    },
    receipts,
  };
}
