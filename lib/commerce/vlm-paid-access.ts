import { normalizeInternalNavigationPath } from "@/lib/security/navigation-redirect-boundary";
import { getVlmCurrentSkuTruth, tierForVlmProductId } from "@/lib/commerce/vlm-current-sku-truth";
export const PASS2024_VLM_PAID_ACCESS_ID = "pass2024-vlm-paid-advanced-pdf-analysis" as const;
export const PASS2024_VLM_PAID_ACCESS_TASKS = 74 as const;
export const PASS2783_VLM_COMMERCIAL_TIER_LOCK_ID = "pass2783-basic-free-pro-7999-advanced-14999-receipt-lock" as const;

export type VlmPaidAccessLocale = "pl" | "en" | "de";
export type VlmPaidProductId =
  | "vlm_pro_analysis_single"
  | "vlm_pro_pdf_single"
  | "vlm_pro_audit_review"
  | "vlm_advanced_analysis_single"
  | "vlm_advanced_pdf_single"
  | "vlm_advanced_audit_human_review";

export type VlmPaidProduct = {
  id: VlmPaidProductId;
  amount: number;
  currency: "eur";
  priceLabel: string;
  label: string;
  shortLabel: string;
  checkoutCta: string;
  includedIn?: VlmPaidProductId[];
  accessScope:
    | "vlm_pro_analysis"
    | "vlm_pro_pdf"
    | "audit_pro_review"
    | "vlm_advanced_analysis"
    | "vlm_advanced_pdf"
    | "audit_advanced_analysis"
    | "audit_advanced_human_review";
  description: string;
  boundaries: string[];
  publicCheckoutAllowed: false;
  publicPrice: null;
  findingConfidence: "NOT_CALIBRATED";
  humanReviewIncluded: false;
  independentCertificationIncluded: false;
  customerDecision: "INVITATION_ONLY_CONTROLLED_BETA" | "NOT_FOR_SALE";
};

export type VlmPaidAccessContext = {
  surface: "shield" | "shield-pro" | "real-markets" | "browser" | "audit" | "unknown";
  locale: VlmPaidAccessLocale;
  assetId?: string;
  symbol?: string;
  depth?: "basic" | "pro" | "advanced";
  requestId?: string;
  auditCaseRef?: string;
  returnPath?: string;
  accountIdHash?: string;
};

const localeFallback: VlmPaidAccessLocale = "en";

export function resolveVlmPaidLocale(locale: string | undefined | null): VlmPaidAccessLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : localeFallback;
}

type ProductMeta = Pick<VlmPaidProduct, "id" | "accessScope"> & {
  label: Record<VlmPaidAccessLocale, string>;
  includedIn?: VlmPaidProductId[];
};

const PRODUCT_META: Record<VlmPaidProductId, ProductMeta> = {
  vlm_pro_analysis_single: {
    id: "vlm_pro_analysis_single",
    accessScope: "vlm_pro_analysis",
    label: { pl: "VLM Pro Analysis", en: "VLM Pro Analysis", de: "VLM Pro Analyse" },
  },
  vlm_pro_pdf_single: {
    id: "vlm_pro_pdf_single",
    accessScope: "vlm_pro_pdf",
    label: { pl: "VLM Pro PDF", en: "VLM Pro PDF", de: "VLM Pro PDF" },
  },
  vlm_pro_audit_review: {
    id: "vlm_pro_audit_review",
    accessScope: "audit_pro_review",
    includedIn: ["vlm_pro_pdf_single"],
    label: { pl: "Velmère Pro Audit", en: "Velmère Pro Audit", de: "Velmère Pro Audit" },
  },
  vlm_advanced_analysis_single: {
    id: "vlm_advanced_analysis_single",
    accessScope: "vlm_advanced_analysis",
    label: { pl: "VLM Advanced Analysis", en: "VLM Advanced Analysis", de: "VLM Advanced Analyse" },
  },
  vlm_advanced_pdf_single: {
    id: "vlm_advanced_pdf_single",
    accessScope: "vlm_advanced_pdf",
    label: { pl: "VLM Advanced PDF", en: "VLM Advanced PDF", de: "VLM Advanced PDF" },
  },
  vlm_advanced_audit_human_review: {
    id: "vlm_advanced_audit_human_review",
    accessScope: "audit_advanced_analysis",
    includedIn: ["vlm_advanced_pdf_single"],
    label: { pl: "Velmère Advanced Audit", en: "Velmère Advanced Audit", de: "Velmère Advanced Audit" },
  },
};

function buildCurrentProduct(productId: VlmPaidProductId, locale: VlmPaidAccessLocale): VlmPaidProduct {
  const meta = PRODUCT_META[productId];
  const tier = tierForVlmProductId(productId);
  if (!tier) throw new Error(`unsupported_vlm_paid_product:${productId}`);
  const truth = getVlmCurrentSkuTruth(tier, locale);
  const isAudit = productId === "vlm_pro_audit_review" || productId === "vlm_advanced_audit_human_review";
  const suffix = tier === "pro"
    ? locale === "pl" ? " · beta" : locale === "de" ? " · Beta" : " · beta"
    : locale === "pl" ? " · niedostępny" : locale === "de" ? " · nicht verfügbar" : " · unavailable";
  return {
    id: meta.id,
    amount: 0,
    currency: "eur",
    priceLabel: truth.publicPriceLabel,
    label: `${meta.label[locale]}${suffix}`,
    shortLabel: truth.availabilityLabel,
    checkoutCta: truth.actionLabel,
    includedIn: meta.includedIn,
    accessScope: meta.accessScope,
    description: isAudit
      ? truth.description
      : `${truth.description} ${locale === "pl" ? "Zakres dotyczy automatycznej warstwy informacyjnej, nie płatnego publicznego produktu." : locale === "de" ? "Der Umfang betrifft eine automatisierte Informationsschicht, kein öffentlich verkauftes Produkt." : "The scope is an automated informational layer, not a publicly sold product."}`,
    boundaries: [...truth.boundaries],
    publicCheckoutAllowed: false,
    publicPrice: null,
    findingConfidence: truth.customerFindingConfidence,
    humanReviewIncluded: false,
    independentCertificationIncluded: false,
    customerDecision: truth.decision === "INVITATION_ONLY_CONTROLLED_BETA" ? truth.decision : "NOT_FOR_SALE",
  };
}

export function getVlmPaidProduct(productId: VlmPaidProductId, locale = "en"): VlmPaidProduct {
  const safeLocale = resolveVlmPaidLocale(locale);
  return buildCurrentProduct(productId, safeLocale);
}

export function listVlmPaidProducts(locale = "en"): VlmPaidProduct[] {
  const safeLocale = resolveVlmPaidLocale(locale);
  return [
    getVlmPaidProduct("vlm_pro_analysis_single", safeLocale),
    getVlmPaidProduct("vlm_pro_pdf_single", safeLocale),
    getVlmPaidProduct("vlm_pro_audit_review", safeLocale),
    getVlmPaidProduct("vlm_advanced_analysis_single", safeLocale),
    getVlmPaidProduct("vlm_advanced_pdf_single", safeLocale),
    getVlmPaidProduct("vlm_advanced_audit_human_review", safeLocale),
  ];
}

export function normalizeVlmPaidProductId(value: unknown): VlmPaidProductId | null {
  return value === "vlm_pro_analysis_single" ||
    value === "vlm_pro_pdf_single" ||
    value === "vlm_pro_audit_review" ||
    value === "vlm_advanced_analysis_single" ||
    value === "vlm_advanced_pdf_single" ||
    value === "vlm_advanced_audit_human_review"
    ? value
    : null;
}

export function normalizePaidContext(input: Partial<VlmPaidAccessContext> | undefined, locale = "en"): VlmPaidAccessContext {
  const safeLocale = resolveVlmPaidLocale(input?.locale ?? locale);
  const surface = input?.surface === "shield" || input?.surface === "shield-pro" || input?.surface === "real-markets" || input?.surface === "browser" || input?.surface === "audit"
    ? input.surface
    : "unknown";
  const depth = input?.depth === "basic" || input?.depth === "pro" || input?.depth === "advanced" ? input.depth : undefined;
  const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
  return {
    surface,
    locale: safeLocale,
    assetId: clean(input?.assetId, 96),
    symbol: clean(input?.symbol, 32),
    depth,
    requestId: clean(input?.requestId, 96),
    auditCaseRef: clean(input?.auditCaseRef, 32)?.toUpperCase(),
    returnPath: clean(input?.returnPath, 360),
    accountIdHash: typeof input?.accountIdHash === "string" && /^[a-f0-9]{64}$/i.test(input.accountIdHash.trim())
      ? input.accountIdHash.trim().toLowerCase()
      : undefined,
  };
}

export function buildVlmPaidAccessStorageKey(productId: VlmPaidProductId, context: Partial<VlmPaidAccessContext>): string {
  const normalized = normalizePaidContext(context, context.locale);
  const identity = [normalized.surface, normalized.locale, normalized.auditCaseRef || normalized.assetId || normalized.symbol || normalized.requestId || "generic", normalized.depth || "none", normalized.accountIdHash?.slice(0, 16) || "anonymous"]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .slice(0, 180);
  return `velmere.paid-access.${productId}.${identity}`;
}

export function buildVlmPaidReturnPath(context: Partial<VlmPaidAccessContext>, fallback = "/"): string {
  const fallbackPath = typeof fallback === "string" && fallback.startsWith("/") && !fallback.startsWith("//") ? fallback : "/en";
  const locale = resolveVlmPaidLocale(context.locale);
  return normalizeInternalNavigationPath(context.returnPath, {
    fallback: fallbackPath,
    locale,
    profile: "paid_return",
  });
}
