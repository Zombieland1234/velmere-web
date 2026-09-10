import type { VlmPaidAccessContext, VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import {
  getVlmCurrentSkuTruth,
  resolveVlmCurrentSkuLocale,
  type VlmCurrentSkuDecision,
} from "@/lib/commerce/vlm-current-sku-truth";

export type VlmAccessDepth = "basic" | "pro" | "advanced";
export type VlmAccessSurface = VlmPaidAccessContext["surface"];
export type VlmAccessPurpose = "analysis" | "pdf" | "audit";
export type VlmAccessPaymentRail = "stripe_card" | "wallet_identity" | "wallet_token_future" | "manual_owner_grant";
export type VlmPaidAccessMode = "paid_pro" | "paid_advanced";

export type VlmTierPolicy = {
  depth: VlmAccessDepth;
  paid: boolean;
  targetPaid: boolean;
  commercialTarget: "GO_FREE" | "GO_PAID";
  freeAccessGuaranteed: boolean;
  decision: VlmCurrentSkuDecision;
  publicCheckoutAllowed: false;
  publicPrice: null;
  humanReviewIncluded: false;
  productId?: VlmPaidProductId;
  label: string;
  summary: string;
  userValue: string[];
  engineDepth: {
    targetSignals: number;
    evidenceRows: number;
    sourceChecks: number;
    pdfPages: string;
  };
  paymentRails: VlmAccessPaymentRail[];
  boundary: string[];
};

/**
 * Presentation-only product scope. This function does not inspect a request,
 * account, payment, wallet, token, or entitlement and cannot authorize access.
 * The current release has no public checkout for any audit/intelligence tier.
 */
export function buildVlmAdvancedOnlyTierPolicies(locale: string = "en"): Record<VlmAccessDepth, VlmTierPolicy> {
  const safeLocale = resolveVlmCurrentSkuLocale(locale);
  const basic = getVlmCurrentSkuTruth("basic", safeLocale);
  const pro = getVlmCurrentSkuTruth("pro", safeLocale);
  const advanced = getVlmCurrentSkuTruth("advanced", safeLocale);

  const value = {
    pl: {
      basic: ["krótki risk brief", "najważniejsze sygnały", "jawne braki dowodów", "bez gwarancji wyniku"],
      pro: ["więcej sygnałów", "source freshness", "rozszerzone evidence rows", "obowiązkowa kontrola jakości"],
      advanced: ["pełny evidence ledger", "contradiction scan", "proof capsule", "pakiet do przyszłej adjudykacji"],
    },
    en: {
      basic: ["short risk brief", "priority signals", "visible missing proof", "no outcome promise"],
      pro: ["more signals", "source freshness", "expanded evidence rows", "mandatory quality control"],
      advanced: ["full evidence ledger", "contradiction scan", "proof capsule", "future adjudication packet"],
    },
    de: {
      basic: ["kurzer Risk Brief", "wichtigste Signale", "sichtbare fehlende Nachweise", "keine Ergebnisgarantie"],
      pro: ["mehr Signale", "Source Freshness", "erweiterte Evidence Rows", "verpflichtende Qualitätsprüfung"],
      advanced: ["vollständiges Evidence Ledger", "Contradiction Scan", "Proof Capsule", "Paket für spätere Adjudikation"],
    },
  }[safeLocale];

  return {
    basic: {
      depth: "basic",
      paid: false,
      targetPaid: false,
      commercialTarget: basic.commercialTarget,
      freeAccessGuaranteed: true,
      decision: basic.decision,
      publicCheckoutAllowed: false,
      publicPrice: null,
      humanReviewIncluded: false,
      label: basic.availabilityLabel,
      summary: basic.description,
      userValue: value.basic,
      engineDepth: { targetSignals: 10, evidenceRows: 3, sourceChecks: 2, pdfPages: "1–2" },
      paymentRails: [],
      boundary: [...basic.boundaries],
    },
    pro: {
      depth: "pro",
      paid: false,
      targetPaid: true,
      commercialTarget: pro.commercialTarget,
      freeAccessGuaranteed: false,
      decision: pro.decision,
      publicCheckoutAllowed: false,
      publicPrice: null,
      humanReviewIncluded: false,
      productId: "vlm_pro_analysis_single",
      label: pro.availabilityLabel,
      summary: pro.description,
      userValue: value.pro,
      engineDepth: { targetSignals: 14, evidenceRows: 8, sourceChecks: 4, pdfPages: "3–5" },
      paymentRails: [],
      boundary: [...pro.boundaries],
    },
    advanced: {
      depth: "advanced",
      paid: false,
      targetPaid: true,
      commercialTarget: advanced.commercialTarget,
      freeAccessGuaranteed: false,
      decision: advanced.decision,
      publicCheckoutAllowed: false,
      publicPrice: null,
      humanReviewIncluded: false,
      productId: "vlm_advanced_analysis_single",
      label: advanced.availabilityLabel,
      summary: advanced.description,
      userValue: value.advanced,
      engineDepth: { targetSignals: 20, evidenceRows: 14, sourceChecks: 6, pdfPages: "8–12" },
      paymentRails: [],
      boundary: [...advanced.boundaries],
    },
  };
}
