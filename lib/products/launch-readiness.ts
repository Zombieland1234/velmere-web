import type { Product } from "./types";

export type CommerceLaunchLevel = "ready" | "review" | "blocked";

export type CommerceLaunchIssue = {
  id:
    | "not_active"
    | "checkout_disabled"
    | "manual_fulfilment"
    | "automatic_mapping_missing"
    | "images_missing"
    | "variants_missing"
    | "variants_unavailable"
    | "localized_copy_missing"
    | "product_truth_missing"
    | "material_missing"
    | "composition_missing"
    | "fit_missing"
    | "care_missing"
    | "size_guide_missing"
    | "delivery_note_missing"
    | "return_note_missing"
    | "provider_unconfirmed"
    | "preview_mode";
  severity: "info" | "warning" | "blocker";
  label: string;
};

export type ProductLaunchReadiness = {
  productId: string;
  slug: string;
  level: CommerceLaunchLevel;
  score: number;
  blockers: CommerceLaunchIssue[];
  warnings: CommerceLaunchIssue[];
  notes: CommerceLaunchIssue[];
};

export type CommerceLaunchAudit = {
  total: number;
  active: number;
  preview: number;
  purchasable: number;
  blocked: number;
  review: number;
  ready: number;
  averageScore: number;
  topIssues: CommerceLaunchIssue[];
  products: ProductLaunchReadiness[];
};

function hasLocalizedCopy(product: Product) {
  return Boolean(
    product.title.pl &&
      product.title.en &&
      product.title.de &&
      product.shortDescription.pl &&
      product.shortDescription.en &&
      product.shortDescription.de &&
      product.description.pl &&
      product.description.en &&
      product.description.de,
  );
}

function hasLocalized(value: { pl?: string; en?: string; de?: string } | undefined) {
  return Boolean(value?.pl && value.en && value.de);
}

function productTruthIssues(product: Product): CommerceLaunchIssue[] {
  const truth = product.truth;
  if (!truth) return [issue("product_truth_missing", "warning", "product truth profile missing")];

  const issues: CommerceLaunchIssue[] = [];

  if (!hasLocalized(truth.material)) issues.push(issue("material_missing", "warning", "material description missing"));
  if (!hasLocalized(truth.composition)) issues.push(issue("composition_missing", "warning", "composition note missing"));
  if (!hasLocalized(truth.fit)) issues.push(issue("fit_missing", "warning", "fit note missing"));
  if (!truth.care.length || truth.care.some((item) => !hasLocalized(item))) issues.push(issue("care_missing", "warning", "care instructions incomplete"));
  if (!truth.sizeGuide.measurements.length || !hasLocalized(truth.sizeGuide.note)) issues.push(issue("size_guide_missing", "warning", "size guide incomplete"));
  if (!hasLocalized(truth.deliveryNote)) issues.push(issue("delivery_note_missing", "warning", "delivery note missing"));
  if (!hasLocalized(truth.returnNote)) issues.push(issue("return_note_missing", "warning", "return note missing"));

  return issues;
}

function hasCompleteAutomaticFulfilment(product: Product) {
  if (product.fulfilmentMode !== "automatic") return true;
  if (!product.providerVariantIds) return false;
  return product.variants.every((variant) => Boolean(variant.providerVariantId || product.providerVariantIds?.[variant.id]));
}

function isPurchasable(product: Product) {
  return (
    product.status === "active" &&
    product.fulfilmentMode !== "disabled" &&
    product.price.amount > 0 &&
    product.images.length > 0 &&
    product.variants.length > 0 &&
    product.variants.some((variant) => variant.available !== false) &&
    hasCompleteAutomaticFulfilment(product)
  );
}

function issue(
  id: CommerceLaunchIssue["id"],
  severity: CommerceLaunchIssue["severity"],
  label: string,
): CommerceLaunchIssue {
  return { id, severity, label };
}

export function auditProductLaunchReadiness(product: Product): ProductLaunchReadiness {
  const issues: CommerceLaunchIssue[] = [];

  if (product.status !== "active") {
    issues.push(issue("not_active", product.status === "coming_soon" ? "info" : "blocker", `status:${product.status}`));
  }

  if (product.status === "coming_soon") {
    issues.push(issue("preview_mode", "info", "preview mode; checkout should stay closed"));
  }

  if (product.fulfilmentMode === "disabled") {
    issues.push(issue("checkout_disabled", product.status === "active" ? "blocker" : "info", "checkout disabled"));
  }

  if (product.fulfilmentMode === "manual") {
    issues.push(issue("manual_fulfilment", "warning", "manual fulfilment needs operator QA"));
  }

  if (product.fulfilmentMode === "automatic" && !hasCompleteAutomaticFulfilment(product)) {
    issues.push(issue("automatic_mapping_missing", "blocker", "automatic provider variant mapping missing"));
  }

  if (product.images.length === 0) {
    issues.push(issue("images_missing", "blocker", "product images missing"));
  }

  if (product.variants.length === 0) {
    issues.push(issue("variants_missing", "blocker", "size/variant set missing"));
  }

  if (product.variants.length > 0 && product.variants.every((variant) => variant.available === false)) {
    issues.push(issue("variants_unavailable", product.status === "active" ? "blocker" : "info", "all variants unavailable"));
  }

  if (!hasLocalizedCopy(product)) {
    issues.push(issue("localized_copy_missing", "warning", "PL/EN/DE product copy incomplete"));
  }

  issues.push(...productTruthIssues(product));

  if (product.provider === "manual" && product.status === "active") {
    issues.push(issue("provider_unconfirmed", "warning", "manual provider needs fulfilment confirmation"));
  }

  const blockers = issues.filter((item) => item.severity === "blocker");
  const warnings = issues.filter((item) => item.severity === "warning");
  const notes = issues.filter((item) => item.severity === "info");

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        blockers.length * 28 -
        warnings.length * 12 -
        notes.length * 5 -
        (isPurchasable(product) ? 0 : 12),
    ),
  );

  const level: CommerceLaunchLevel = blockers.length > 0 ? "blocked" : warnings.length > 0 || !isPurchasable(product) ? "review" : "ready";

  return {
    productId: product.id,
    slug: product.slug,
    level,
    score,
    blockers,
    warnings,
    notes,
  };
}

export function buildCommerceLaunchAudit(products: Product[]): CommerceLaunchAudit {
  const audited = products.map(auditProductLaunchReadiness);
  const issueRank = new Map<string, CommerceLaunchIssue & { count: number }>();

  for (const product of audited) {
    for (const item of [...product.blockers, ...product.warnings, ...product.notes]) {
      const existing = issueRank.get(item.id);
      if (existing) {
        existing.count += 1;
      } else {
        issueRank.set(item.id, { ...item, count: 1 });
      }
    }
  }

  const topIssues = Array.from(issueRank.values())
    .sort((a, b) => {
      const severityRank = { blocker: 3, warning: 2, info: 1 };
      return severityRank[b.severity] - severityRank[a.severity] || b.count - a.count || a.label.localeCompare(b.label);
    })
    .slice(0, 5);

  const total = products.length;
  const averageScore = total === 0 ? 0 : Math.round(audited.reduce((sum, product) => sum + product.score, 0) / total);

  return {
    total,
    active: products.filter((product) => product.status === "active").length,
    preview: products.filter((product) => product.status === "coming_soon").length,
    purchasable: products.filter(isPurchasable).length,
    blocked: audited.filter((product) => product.level === "blocked").length,
    review: audited.filter((product) => product.level === "review").length,
    ready: audited.filter((product) => product.level === "ready").length,
    averageScore,
    topIssues,
    products: audited,
  };
}
