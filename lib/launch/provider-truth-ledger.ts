import type { Product, ProductProvider } from "@/lib/products/types";

export type ProviderTruthStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "manual_review";

export type ProviderTruthLedgerEntry = {
  id: string;
  label: string;
  provider: ProductProvider | "multi";
  status: ProviderTruthStatus;
  progress: number;
  sourceMode: "manual" | "api" | "missing" | "mixed";
  requiredBeforeCheckout: boolean;
  evidence: string[];
  blockers: string[];
  nextStep: string;
};

export const providerTruthLedger: ProviderTruthLedgerEntry[] = [
  {
    id: "printful",
    label: "Printful provider truth",
    provider: "printful",
    status: "partial",
    progress: 42,
    sourceMode: "mixed",
    requiredBeforeCheckout: true,
    evidence: [
      "API token tooling exists",
      "import route exists",
      "provider IDs can be stored per variant",
    ],
    blockers: [
      "final SKU mapping",
      "production region",
      "shipping profile",
      "return exceptions",
    ],
    nextStep:
      "Snapshot SKU, variant, production time and shipping region per product before checkout activation.",
  },
  {
    id: "tapstitch",
    label: "Tapstitch provider truth",
    provider: "tapstitch",
    status: "manual_review",
    progress: 28,
    sourceMode: "manual",
    requiredBeforeCheckout: true,
    evidence: ["provider type exists in product model"],
    blockers: [
      "manual proof source",
      "SKU ledger",
      "shipping region",
      "returns policy",
    ],
    nextStep:
      "Create manual proof cards for every Tapstitch product before public checkout.",
  },
  {
    id: "contrado",
    label: "Contrado provider truth",
    provider: "external",
    status: "manual_review",
    progress: 22,
    sourceMode: "manual",
    requiredBeforeCheckout: true,
    evidence: ["external provider path can be represented"],
    blockers: [
      "provider identity",
      "SKU/variant source",
      "production time",
      "shipping price",
      "returns exceptions",
    ],
    nextStep:
      "Add Contrado as explicit provider or keep products in external/manual mode with visible checkout block.",
  },
  {
    id: "manual-products",
    label: "Manual product truth",
    provider: "manual",
    status: "blocked",
    progress: 24,
    sourceMode: "manual",
    requiredBeforeCheckout: true,
    evidence: ["manual fulfillment mode exists"],
    blockers: [
      "merchant fulfillment SOP",
      "stock proof",
      "shipping price",
      "return/refund process",
    ],
    nextStep:
      "Keep manual products non-purchasable until stock, dispatch and returns are proven.",
  },
  {
    id: "all-skus",
    label: "All SKU readiness",
    provider: "multi",
    status: "blocked",
    progress: 39,
    sourceMode: "mixed",
    requiredBeforeCheckout: true,
    evidence: [
      "variants can carry sku and providerVariantId",
      "launch readiness checks exist",
    ],
    blockers: [
      "providerVariantId coverage",
      "size proof",
      "region proof",
      "shipping proof",
      "return exception proof",
    ],
    nextStep:
      "SKU truth snapshots now surface on cards/details; next wire real provider source snapshots per SKU.",
  },
];

export type ProductProviderTruthSnapshot = {
  productId: string;
  slug: string;
  provider: ProductProvider;
  providerMode: "api_backed" | "manual_review" | "external_review" | "blocked";
  status: ProviderTruthStatus;
  score: number;
  missing: string[];
  sourceMode: ProviderTruthLedgerEntry["sourceMode"];
};

function providerMode(
  product: Product,
): ProductProviderTruthSnapshot["providerMode"] {
  if (product.provider === "printful")
    return product.providerProductId ? "api_backed" : "manual_review";
  if (product.provider === "manual") return "blocked";
  if (product.provider === "external") return "external_review";
  return "manual_review";
}

function textLooksUnconfirmed(value: string | undefined) {
  const text = (value ?? "").toLowerCase();
  return (
    !text.trim() ||
    /not confirmed|requires provider confirmation|wymaga potwierdzenia|nie został potwierdzony|muss.*bestätigt|erfordert provider/i.test(
      text,
    )
  );
}

function hasConfirmedSizeMeasurements(product: Product) {
  const measurements = product.truth?.sizeGuide?.measurements ?? [];
  return measurements.some((row) =>
    Boolean(
      row.chest ||
      row.length ||
      row.shoulders ||
      row.sleeve ||
      row.waist ||
      row.hip ||
      row.inseam,
    ),
  );
}

export function buildProductProviderTruthSnapshot(
  product: Product,
): ProductProviderTruthSnapshot {
  const missing: string[] = [];
  if (!product.providerProductId && product.provider !== "manual")
    missing.push("provider product id");
  if (product.variants.some((variant) => !variant.sku))
    missing.push("variant SKU");
  if (product.images.length === 0) missing.push("manual images");
  if (
    product.fulfilmentMode === "automatic" &&
    product.variants.some(
      (variant) =>
        !variant.providerVariantId && !product.providerVariantIds?.[variant.id],
    )
  ) {
    missing.push("provider variant mapping");
  }
  if (!product.truth?.deliveryNote) missing.push("delivery note");
  if (!product.truth?.returnNote) missing.push("return note");
  if (!hasConfirmedSizeMeasurements(product)) missing.push("size chart cm");
  if (
    textLooksUnconfirmed(product.truth?.material.en) ||
    textLooksUnconfirmed(product.truth?.composition.en)
  )
    missing.push("material/composition proof");

  const mode = providerMode(product);
  const score = Math.max(
    0,
    100 -
      missing.length * 12 -
      (mode === "blocked" ? 28 : mode === "manual_review" ? 12 : 0),
  );
  const status: ProviderTruthStatus =
    missing.length >= 4 || mode === "blocked"
      ? "blocked"
      : missing.length > 0
        ? "manual_review"
        : "partial";

  return {
    productId: product.id,
    slug: product.slug,
    provider: product.provider,
    providerMode: mode,
    status,
    score,
    missing,
    sourceMode:
      mode === "api_backed" ? "api" : mode === "blocked" ? "missing" : "manual",
  };
}

export function getProviderTruthLedgerSummary() {
  const total = providerTruthLedger.length;
  const averageProgress = Math.round(
    providerTruthLedger.reduce((sum, item) => sum + item.progress, 0) / total,
  );
  const blocked = providerTruthLedger.filter(
    (item) => item.status === "blocked",
  );
  const review = providerTruthLedger.filter(
    (item) => item.status === "manual_review",
  );
  return {
    total,
    averageProgress,
    blockedCount: blocked.length,
    reviewCount: review.length,
    nextCriticalStep:
      blocked[0]?.nextStep ??
      review[0]?.nextStep ??
      providerTruthLedger[0]?.nextStep,
  };
}
