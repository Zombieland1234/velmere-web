import type { ProductImportDraft } from "@/lib/products/types";
import { applyVlmProductBrainToDraft } from "@/lib/products/vlm-product-brain";
import {
  createVlmKernelEvidenceItem,
  runVlmBrainKernel,
  type VlmBrainKernelDepth,
  type VlmBrainKernelEvidenceIndependence,
  type VlmBrainKernelFinding,
  type VlmBrainKernelLocale,
  type VlmBrainKernelOutput,
} from "./vlm-brain-kernel";

function productProviderMetadata(product: ProductImportDraft["product"]): {
  source: string;
  providerFamily: string;
  independence: VlmBrainKernelEvidenceIndependence;
  sourceTimestamp: string | null;
} {
  const sourceTimestamp = product.importSource?.importedAt ?? null;
  if (product.provider === "printful") {
    return { source: "Printful", providerFamily: "printful", independence: "independent", sourceTimestamp };
  }
  if (product.provider === "tapstitch") {
    return { source: "Tapstitch", providerFamily: "tapstitch", independence: "independent", sourceTimestamp };
  }
  if (product.provider === "manual") {
    return { source: "operator-product-intake", providerFamily: "operator-product-intake", independence: "operator", sourceTimestamp };
  }
  try {
    const url = product.externalUrl ? new URL(product.externalUrl) : null;
    const hostname = url?.hostname.replace(/^www\./, "") || "external-product-provider";
    return { source: hostname, providerFamily: hostname, independence: url ? "independent" : "unknown", sourceTimestamp };
  } catch {
    return { source: "external-product-provider", providerFamily: "external-product-provider", independence: "unknown", sourceTimestamp };
  }
}

export type VlmProductKernelPayload = {
  draft: ProductImportDraft;
  productReadiness: {
    canPublish: boolean;
    detectedProvider: string;
    variantCount: number;
    imageCount: number;
    warningCount: number;
    validationErrorCount: number;
    readinessScore?: number;
    readinessLevel?: string;
    missingCount?: number;
  };
};

function productFindings(draft: ProductImportDraft): VlmBrainKernelFinding[] {
  const product = draft.product;
  const findings: VlmBrainKernelFinding[] = [
    {
      id: "product.type-name-copy",
      title: "Product Brain przygotował nazwę, opis i tagi",
      body: `Draft ${product.id} został ujednolicony pod Velmère: title=${product.title.en}, provider=${product.provider}, variants=${product.variants.length}, images=${product.images.length}.`,
      severity: "info",
      confidence: draft.validationErrors.length ? 58 : 78,
      evidenceIds: ["product.provider", "product.variants", "product.images"],
    },
  ];

  if (draft.warnings.length > 0) {
    findings.push({
      id: "product.operator-warnings",
      title: "Produkt wymaga kontroli operatora przed publikacją",
      body: draft.warnings.slice(0, 5).join(" "),
      severity: draft.validationErrors.length ? "warning" : "watch",
      confidence: 72,
      evidenceIds: ["product.warnings"],
    });
  }

  return findings;
}

export function analyzeProductDraftWithVlmKernel(input: {
  draft: ProductImportDraft;
  locale?: VlmBrainKernelLocale;
  depth?: VlmBrainKernelDepth;
}): VlmBrainKernelOutput<VlmProductKernelPayload> {
  const enrichedDraft = applyVlmProductBrainToDraft(input.draft);
  const product = enrichedDraft.product;
  const providerMetadata = productProviderMetadata(product);
  const providerLaneIndependence: VlmBrainKernelEvidenceIndependence = providerMetadata.independence === "independent"
    ? "same_provider"
    : providerMetadata.independence;
  const evidence = [
    createVlmKernelEvidenceItem({
      id: "product.provider",
      label: "Provider product source",
      source: providerMetadata.source,
      providerFamily: providerMetadata.providerFamily,
      independence: providerMetadata.independence,
      sourceTimestamp: providerMetadata.sourceTimestamp,
      freshnessProfile: "product_import",
      quality: product.providerProductId || product.externalUrl ? "strong" : "weak",
      freshness: "unknown",
      confidence: product.providerProductId || product.externalUrl ? 82 : 42,
      value: product.providerProductId ?? product.externalUrl ?? product.provider,
      missingReason: product.provider === "manual" && !product.externalUrl ? "Provider source is manual or not linked." : undefined,
    }),
    createVlmKernelEvidenceItem({
      id: "product.variants",
      label: "Product variants and sizes",
      source: providerMetadata.source,
      providerFamily: providerMetadata.providerFamily,
      independence: providerLaneIndependence,
      sourceTimestamp: providerMetadata.sourceTimestamp,
      freshnessProfile: "product_import",
      quality: product.variants.length > 0 ? "strong" : "missing",
      freshness: "unknown",
      confidence: product.variants.length > 0 ? 86 : 0,
      value: product.variants.length,
      missingReason: product.variants.length > 0 ? undefined : "No provider variants or sizes were detected.",
    }),
    createVlmKernelEvidenceItem({
      id: "product.images",
      label: "Product images and mockups",
      source: providerMetadata.source,
      providerFamily: providerMetadata.providerFamily,
      independence: providerLaneIndependence,
      sourceTimestamp: providerMetadata.sourceTimestamp,
      freshnessProfile: "product_import",
      quality: product.images.length > 0 ? "medium" : "missing",
      freshness: "unknown",
      confidence: product.images.length > 0 ? 70 : 0,
      value: product.images.length,
      missingReason: product.images.length > 0 ? undefined : "No product images are attached to the draft.",
    }),
    createVlmKernelEvidenceItem({
      id: "product.truth-profile",
      label: "Material, delivery, return and care proof",
      source: providerMetadata.source,
      providerFamily: providerMetadata.providerFamily,
      independence: providerLaneIndependence,
      sourceTimestamp: providerMetadata.sourceTimestamp,
      freshnessProfile: "product_import",
      quality: product.truth ? "medium" : "missing",
      freshness: "unknown",
      confidence: product.truth ? 66 : 0,
      value: Boolean(product.truth),
      missingReason: product.truth ? undefined : "Truth profile is not complete enough for active checkout.",
    }),
    createVlmKernelEvidenceItem({
      id: "product.warnings",
      label: "Product Brain warnings",
      source: "vlm-product-brain",
      providerFamily: "vlm-product-brain",
      independence: "derived",
      sourceTimestamp: enrichedDraft.brain?.createdAt ?? providerMetadata.sourceTimestamp,
      freshnessProfile: "product_import",
      quality: enrichedDraft.brain?.readiness.level === "blocked" ? "weak" : "medium",
      freshness: "fresh",
      confidence: enrichedDraft.brain?.readiness.score ?? (enrichedDraft.validationErrors.length ? 44 : 74),
      value: enrichedDraft.warnings.length,
    }),
  ];

  const canPublish = enrichedDraft.brain?.readiness.canPublishActive ?? (enrichedDraft.validationErrors.length === 0 && product.variants.length > 0 && product.images.length > 0 && Boolean(product.truth));

  return runVlmBrainKernel(
    {
      surface: "product",
      depth: input.depth ?? "advanced",
      locale: input.locale ?? "pl",
      input: input.draft,
      evidence,
      intent: "product_import_review",
      memoryKey: `product:${product.id}`,
    },
    {
      draft: enrichedDraft,
      productReadiness: {
        canPublish,
        detectedProvider: product.provider,
        variantCount: product.variants.length,
        imageCount: product.images.length,
        warningCount: enrichedDraft.warnings.length,
        validationErrorCount: enrichedDraft.validationErrors.length,
        readinessScore: enrichedDraft.brain?.readiness.score,
        readinessLevel: enrichedDraft.brain?.readiness.level,
        missingCount: enrichedDraft.brain?.readiness.missing.length,
      },
    },
    {
      confidence: canPublish ? 78 : (enrichedDraft.brain?.readiness.score ?? 54),
      status: canPublish ? "ready" : "needs_review",
      headline: canPublish ? "Product Brain: draft gotowy do review" : "Product Brain: draft wymaga uzupełnienia",
      summary: "VLM Kernel przepuścił import produktu przez Product Brain v2, sprawdził warianty, zdjęcia, truth profile, provider adapter i gate publikacji.",
      findings: productFindings(enrichedDraft),
      nextActions: [
        {
          id: "product.verify-size-chart",
          title: "Sprawdź size chart i warianty",
          body: "Porównaj rozmiary/SKU z Printful, Tapstitch lub CSV przed aktywnym checkoutem.",
          required: true,
          owner: "operator",
        },
        {
          id: "product.verify-truth",
          title: "Potwierdź materiał, care i delivery",
          body: "Nie publikuj obietnic o materiale, dostawie ani trwałości bez danych providera lub sample QA.",
          required: true,
          owner: "provider",
        },
      ],
    },
  );
}
