import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { applyApiRateLimit as applyPass2177SoftRateLimit, assertSameOriginRequest as assertPass2177SameOriginRequest, rejectLargeContentLength as rejectPass2177LargeContentLength } from "@/lib/security/api-guard";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import { buildProductPublishBatchDecision, type ProductPublishTargetStatus } from "@/lib/products/publish-decision";
import { createProductPublishAuditLedger } from "@/lib/products/product-publish-audit-ledger";
import { appendProductPublishAuditLedgerBestEffort, attachProductPublishAuditStorageResult, buildProductPublishAuditStorageReadiness } from "@/lib/products/product-publish-audit-storage";
import { buildProductPublishStateStorageReadiness, persistProductPublishStateBestEffort } from "@/lib/products/product-publish-state-storage";
import type { ProductImportDraft } from "@/lib/products/types";
import { reviewVlmProductBrainDraftsAfterOperatorEdits } from "@/lib/products/vlm-product-brain";
import { LocalProductStoreError, upsertLocalPublishedProducts } from "@/lib/products/local-product-store";

export const runtime = "nodejs";

type PublishRequestBody = {
  drafts?: ProductImportDraft[];
  status?: ProductPublishTargetStatus;
  dryRun?: boolean;
  operatorConfirmation?: {
    accepted?: boolean;
    targetStatus?: ProductPublishTargetStatus;
    batchTraceId?: string;
    confirmedAt?: string;
    operatorId?: string;
  };
};

export async function POST(req: Request) {
  const pass2177SizeGuard = rejectPass2177LargeContentLength(req, 24 * 1024 * 1024);
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(req, { allowMissingOrigin: true });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  const pass2177RateLimit = await applyPass2177SoftRateLimit(req, {
    keyPrefix: "pass2177-admin-products-publish",
    limit: 24,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const auth = verifyAdminImportRequest(req);
  if (!auth.ok) return auth.response;

  const parsedBody = await readBoundedJsonBody<PublishRequestBody>(req, 8 * 1024 * 1024, { maxDepth: 24 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  if (!body.drafts?.length) {
    return NextResponse.json({ error: "No drafts were provided." }, { status: 400 });
  }

  const requestedStatus: ProductPublishTargetStatus = body.status === "active" ? "active" : "coming_soon";
  const reviewedDrafts = reviewVlmProductBrainDraftsAfterOperatorEdits(body.drafts);
  const batchDecision = buildProductPublishBatchDecision(reviewedDrafts, requestedStatus);
  const confirmation = body.operatorConfirmation;
  const isConfirmed =
    Boolean(confirmation?.accepted) &&
    confirmation?.targetStatus === requestedStatus &&
    confirmation?.batchTraceId === batchDecision.batchTraceId;

  let auditLedger = createProductPublishAuditLedger({
    batchDecision,
    operatorId: confirmation?.operatorId,
    confirmedAt: confirmation?.confirmedAt,
    commitIntent: !body.dryRun && isConfirmed,
  });

  const decisionByDraftId = new Map(batchDecision.decisions.map((decision) => [decision.draftId, decision]));
  const publishPreviewDrafts = reviewedDrafts.map((draft) => {
    const decision = decisionByDraftId.get(draft.draftId);
    return decision ? { ...draft, product: { ...draft.product, status: decision.finalStatus } } : draft;
  });

  const results = batchDecision.decisions.map((decision) => ({
    draftId: decision.draftId,
    status: decision.finalStatus,
    persisted: false,
    warning:
      "Product publication state will be persisted only when VELMERE_PRODUCT_STATUS_* storage is configured; otherwise this commit uses memory/dev fallback and catalog.generated.ts remains the static source.",
    activeBlocked: decision.activeBlocked,
    brainGate: reviewedDrafts.find((draft) => draft.draftId === decision.draftId)?.brain?.readiness ?? null,
    blockedReasons: decision.reasons.filter((item) => item.severity === "block").map((item) => `${item.source}: ${item.label}`),
    reviewReasons: decision.reasons.filter((item) => item.severity === "review").map((item) => `${item.source}: ${item.label}`),
    decision,
  }));

  if (body.dryRun) {
    return NextResponse.json({
      results,
      reviewedDrafts,
      persisted: false,
      dryRun: true,
      decision: batchDecision,
      auditLedger,
      storageReadiness: buildProductPublishAuditStorageReadiness(),
      productStateStorageReadiness: buildProductPublishStateStorageReadiness(),
      message: "Publish decision preview generated. Operator confirmation is required before commit.",
    });
  }

  if (!isConfirmed) {
    return NextResponse.json(
      {
        error: "Operator confirmation is required before publishing.",
        results,
        reviewedDrafts,
        persisted: false,
        decision: batchDecision,
        auditLedger,
        storageReadiness: buildProductPublishAuditStorageReadiness(),
        productStateStorageReadiness: buildProductPublishStateStorageReadiness(),
        message: "Open the publish decision modal, review the snapshot and confirm the exact batch trace.",
      },
      { status: 409 },
    );
  }

  const storageResult = await appendProductPublishAuditLedgerBestEffort(auditLedger);
  auditLedger = attachProductPublishAuditStorageResult(auditLedger, storageResult);
  const productStateStorage = await persistProductPublishStateBestEffort({
    drafts: publishPreviewDrafts,
    batchDecision,
    auditLedger,
  });
  let localProductStore: Awaited<ReturnType<typeof upsertLocalPublishedProducts>> | null = null;
  let localProductStoreFailure: { code: string; retryable: true } | null = null;
  try {
    localProductStore = await upsertLocalPublishedProducts(publishPreviewDrafts.map((draft) => draft.product));
  } catch (error) {
    localProductStoreFailure = {
      code: error instanceof LocalProductStoreError ? error.code : "unknown",
      retryable: true,
    };
  }
  const productStatusPersisted = productStateStorage.persisted || Boolean(localProductStore?.receipt.writtenCount);

  if (!productStatusPersisted) {
    return NextResponse.json(
      {
        error: "Product publication state could not be persisted.",
        code: "product_publication_persistence_unavailable",
        retryable: true,
        results,
        reviewedDrafts: publishPreviewDrafts,
        persisted: false,
        productStatusPersisted: false,
        auditPersisted: storageResult.persisted,
        decision: batchDecision,
        auditLedger,
        storageResult,
        productStateStorage,
        localProductStore: null,
        localProductStoreFailure,
      },
      { status: 503, headers: { "retry-after": "30", "cache-control": "no-store" } },
    );
  }

  return NextResponse.json({
    results: results.map((item) => ({ ...item, persisted: productStatusPersisted })),
    reviewedDrafts: publishPreviewDrafts,
    persisted: productStatusPersisted,
    productStatusPersisted,
    auditPersisted: storageResult.persisted,
    decision: batchDecision,
    auditLedger,
    storageResult,
    productStateStorage,
    localProductStore,
    localProductStoreFailure,
    storageReadiness: buildProductPublishAuditStorageReadiness(),
    productStateStorageReadiness: buildProductPublishStateStorageReadiness(),
    message:
      storageResult.persisted && productStateStorage.persisted
        ? localProductStoreFailure
          ? "Draft publish was validated and persisted to durable storage. The optional local preview store is unavailable and did not downgrade the durable commit."
          : "Draft publish was validated, confirmed by operator, audit receipts were written and product publication state was persisted to durable storage."
        : storageResult.persisted
          ? "Draft publish was validated and audit receipts were written, but product publication state is not durable yet. Configure product status storage before active public sales."
          : productStatusPersisted
            ? "Draft publish was validated and product publication state was persisted, but audit receipt storage is not durable yet. Configure audit storage before launch."
            : "Draft publish was validated and confirmed. Products were saved to the local admin store for /shop preview; configure durable storage before production launch.",
  });
}
