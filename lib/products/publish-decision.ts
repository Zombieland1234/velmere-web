import { sha256Token } from "@/lib/security/cryptographic-digest";
import { getStoreCheckoutReadiness } from "@/lib/checkout/readiness";
import type { ProductImportDraft, ProductStatus } from "@/lib/products/types";
import { normalizeExternalProductUrl, parseAllowedExternalHosts } from "@/lib/security/browser-external-navigation";

export type ProductPublishTargetStatus = Extract<ProductStatus, "coming_soon" | "active">;

export type ProductPublishDecisionReason = {
  code: string;
  label: string;
  severity: "info" | "review" | "block";
  source: "product" | "brain" | "checkout" | "operator";
};

export type ProductPublishDecision = {
  schemaVersion: "velmere.product.publish-decision.v1";
  decisionId: string;
  draftId: string;
  productId: string;
  slug: string;
  title: string;
  provider: string;
  targetStatus: ProductPublishTargetStatus;
  currentStatus: ProductStatus;
  finalStatus: ProductPublishTargetStatus;
  willChangeStatus: boolean;
  publishAllowed: boolean;
  activeBlocked: boolean;
  operatorConfirmationRequired: boolean;
  snapshot: {
    priceAmount: number;
    currency: string;
    imageCount: number;
    variantCount: number;
    providerMappedVariants: number;
    availableVariants: number;
    brainLevel: string;
    brainScore: number | null;
    garmentType: string;
    sourceQuality: string;
    providerMappingStatus: string;
    stockStatus: string;
    sizeGuideStatus: string;
    checkoutEnabled: boolean;
    externalLinkSafe: boolean;
  };
  reasons: ProductPublishDecisionReason[];
};

export type ProductPublishBatchDecision = {
  schemaVersion: "velmere.product.publish-batch.v1";
  batchTraceId: string;
  targetStatus: ProductPublishTargetStatus;
  createdAt: string;
  selectedCount: number;
  allowedCount: number;
  blockedCount: number;
  reviewCount: number;
  canCommit: boolean;
  decisions: ProductPublishDecision[];
};

function safeString(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(input: unknown) {
  return sha256Token(JSON.stringify(input), 24);
}

function reason(code: string, label: string, severity: ProductPublishDecisionReason["severity"], source: ProductPublishDecisionReason["source"]): ProductPublishDecisionReason {
  return { code, label, severity, source };
}

function countProviderMappedVariants(draft: ProductImportDraft) {
  const providerMap = draft.product.providerVariantIds ?? {};
  return draft.product.variants.filter((variant) => Boolean(variant.providerVariantId || providerMap[variant.id])).length;
}

function countAvailableVariants(draft: ProductImportDraft) {
  return draft.product.variants.filter((variant) => variant.available !== false).length;
}

function localizedTitle(draft: ProductImportDraft) {
  return safeString(draft.product.title.pl || draft.product.title.en || draft.product.title.de || draft.product.slug);
}

export function buildProductPublishDecision(draft: ProductImportDraft, targetStatus: ProductPublishTargetStatus): ProductPublishDecision {
  const candidateProduct = { ...draft.product, status: targetStatus };
  const checkout = getStoreCheckoutReadiness(candidateProduct);
  const brain = draft.brain;
  const brainMissing = brain?.readiness.missing ?? [];
  const brainBlockers = brainMissing.filter((item) => item.blocksActivePublish);
  const reasons: ProductPublishDecisionReason[] = [];
  const externalAllowedHosts = parseAllowedExternalHosts(process.env.VELMERE_PRODUCT_IMPORT_ALLOWED_HOSTS ?? "");
  const normalizedExternalUrl = normalizeExternalProductUrl(draft.product.externalUrl, externalAllowedHosts);
  const externalLinkSafe = draft.product.fulfilmentMode !== "external_link"
    || Boolean(normalizedExternalUrl && normalizedExternalUrl === draft.product.externalUrl);

  if (!externalLinkSafe) {
    reasons.push(reason(
      "external_link_unsafe",
      "External product link must be an exact allowlisted HTTPS URL without credentials, ports, query data or fragments.",
      "block",
      "product",
    ));
  }

  for (const validationError of draft.validationErrors) {
    reasons.push(reason("validation_error", validationError, targetStatus === "active" ? "block" : "review", "product"));
  }

  for (const warning of draft.warnings.filter((item) => !draft.validationErrors.includes(item))) {
    if (warning.startsWith("VLM Product Brain v2:")) continue;
    if (warning.startsWith("VLM Provider Adapter:")) continue;
    reasons.push(reason("draft_warning", warning, "review", "product"));
  }

  for (const missing of brainMissing) {
    reasons.push(
      reason(
        missing.id,
        `${missing.label} — ${missing.reason}`,
        missing.blocksActivePublish && targetStatus === "active" ? "block" : "review",
        "brain",
      ),
    );
  }

  if (!brain) {
    reasons.push(reason("brain_missing", "VLM Product Brain review is missing. Run AI review before publishing.", targetStatus === "active" ? "block" : "review", "brain"));
  }

  if (targetStatus === "active") {
    for (const checkoutReason of checkout.reasons) {
      reasons.push(reason(checkoutReason.code, checkoutReason.message, "block", "checkout"));
    }
  }

  if (targetStatus === "coming_soon" && brain && !brain.readiness.canPublishComingSoon) {
    reasons.push(reason("coming_soon_gate", "Product Brain does not allow customer-facing coming soon preview yet.", "block", "brain"));
  }

  const activeBlocked =
    targetStatus === "active" &&
    (draft.validationErrors.length > 0 || !checkout.enabled || brainBlockers.length > 0 || !externalLinkSafe || !(brain?.readiness.canPublishActive ?? false));
  const comingSoonBlocked = targetStatus === "coming_soon" && (Boolean(brain && !brain.readiness.canPublishComingSoon) || !externalLinkSafe);
  const publishAllowed = targetStatus === "active" ? !activeBlocked : !comingSoonBlocked;
  const finalStatus: ProductPublishTargetStatus = targetStatus === "active" && activeBlocked ? "coming_soon" : targetStatus;
  const snapshot = {
    priceAmount: draft.product.price.amount,
    currency: draft.product.price.currency,
    imageCount: draft.product.images.length,
    variantCount: draft.product.variants.length,
    providerMappedVariants: countProviderMappedVariants(draft),
    availableVariants: countAvailableVariants(draft),
    brainLevel: brain?.readiness.level ?? "missing",
    brainScore: brain?.readiness.score ?? null,
    garmentType: brain?.detected.garmentType ?? "unknown",
    sourceQuality: brain?.providerAdapter.sourceQuality ?? "unknown",
    providerMappingStatus: brain?.providerAdapter.variantMappingStatus ?? "unknown",
    stockStatus: brain?.providerAdapter.stockStatus ?? "unknown",
    sizeGuideStatus: brain?.providerAdapter.sizeGuideStatus ?? "unknown",
    checkoutEnabled: checkout.enabled,
    externalLinkSafe,
  };
  const decisionSeed = {
    draftId: draft.draftId,
    productId: draft.product.id,
    slug: draft.product.slug,
    targetStatus,
    currentStatus: draft.product.status,
    finalStatus,
    snapshot,
    reasonCodes: reasons.map((item) => `${item.source}:${item.severity}:${item.code}:${item.label}`),
  };

  return {
    schemaVersion: "velmere.product.publish-decision.v1",
    decisionId: `vpd_${stableHash(decisionSeed)}`,
    draftId: draft.draftId,
    productId: draft.product.id,
    slug: draft.product.slug,
    title: localizedTitle(draft),
    provider: draft.product.provider,
    targetStatus,
    currentStatus: draft.product.status,
    finalStatus,
    willChangeStatus: draft.product.status !== finalStatus,
    publishAllowed,
    activeBlocked,
    operatorConfirmationRequired: true,
    snapshot,
    reasons,
  };
}

export function buildProductPublishBatchDecision(drafts: ProductImportDraft[], targetStatus: ProductPublishTargetStatus): ProductPublishBatchDecision {
  const decisions = drafts.map((draft) => buildProductPublishDecision(draft, targetStatus));
  const blockedCount = decisions.filter((decision) => !decision.publishAllowed || decision.finalStatus !== targetStatus).length;
  const reviewCount = decisions.filter((decision) => decision.reasons.some((item) => item.severity === "review") && decision.publishAllowed).length;
  const allowedCount = decisions.filter((decision) => decision.publishAllowed).length;
  const batchSeed = {
    targetStatus,
    decisions: decisions.map((decision) => ({ id: decision.decisionId, finalStatus: decision.finalStatus, allowed: decision.publishAllowed })),
  };

  return {
    schemaVersion: "velmere.product.publish-batch.v1",
    batchTraceId: `vpb_${stableHash(batchSeed)}`,
    targetStatus,
    createdAt: new Date().toISOString(),
    selectedCount: drafts.length,
    allowedCount,
    blockedCount,
    reviewCount,
    canCommit: decisions.length > 0 && (targetStatus === "coming_soon" ? blockedCount === 0 : decisions.every((decision) => decision.finalStatus === "active" && decision.publishAllowed)),
    decisions,
  };
}
