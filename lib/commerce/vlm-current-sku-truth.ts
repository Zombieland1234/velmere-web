import {
  VLM_CANONICAL_CUSTOMER_PRODUCTS,
  VLM_CANONICAL_PRODUCT_FAMILIES,
  VLM_CANONICAL_STANDALONE_PRODUCTS,
  VLM_CANONICAL_TIERED_FAMILIES,
  VLM_CONTEXT_TRANSITIONS,
  VLM_INTERNAL_EXECUTION_CONTEXTS,
  VLM_INTERNAL_EXECUTION_PROFILES,
  VLM_PRODUCT_TAXONOMY_RULES,
  VLM_REPORT_INTEGRATION_DEPTH,
  VLM_STANDALONE_INTEGRATION_RULES,
  VLM_V16_TOPOLOGY_DENOMINATORS,
} from "@/lib/product/vlm-canonical-product-topology";
export const PASS36_R44P16_CURRENT_SKU_TRUTH_ID =
  "pass36-a102r44p16-single-current-sku-truth" as const;
export const PASS36_R44P34_PRODUCT_TOPOLOGY_ID_COMPAT =
  "pass36-a102r44p34-canonical-product-topology" as const;
export const PASS36_R44P35_PRODUCT_TOPOLOGY_ID =
  "pass36-a102r44p35-canonical-product-topology" as const;

export type VlmCurrentSkuLocale = "pl" | "en" | "de";
export type VlmCurrentSkuTier = "basic" | "pro" | "advanced";
export type VlmCurrentSkuDecision =
  | "PILOT_ONLY_FREE_LIMITED_PRESCREEN"
  | "INVITATION_ONLY_CONTROLLED_BETA"
  | "NOT_FOR_SALE";
export type VlmCurrentSkuCommercialTarget = "GO_FREE" | "GO_PAID";

export type VlmCurrentSkuTruth = {
  schemaVersion: typeof PASS36_R44P16_CURRENT_SKU_TRUTH_ID;
  tier: VlmCurrentSkuTier;
  decision: VlmCurrentSkuDecision;
  commercialTarget: VlmCurrentSkuCommercialTarget;
  freeAccessGuaranteed: boolean;
  publicCheckoutAllowed: false;
  publicPrice: null;
  publicPriceLabel: string;
  actionLabel: string;
  availabilityLabel: string;
  description: string;
  manualQualityControlRequired: boolean;
  humanReviewIncluded: false;
  independentCertificationIncluded: false;
  customerFindingConfidence: "NOT_CALIBRATED";
  saleEnabled: false;
  live: false;
  boundaries: readonly string[];
};

const COPY: Record<VlmCurrentSkuLocale, Record<VlmCurrentSkuTier, Omit<VlmCurrentSkuTruth,
  "schemaVersion" | "tier" | "commercialTarget" | "freeAccessGuaranteed" | "publicCheckoutAllowed" | "publicPrice" | "humanReviewIncluded" |
  "independentCertificationIncluded" | "customerFindingConfidence" | "saleEnabled" | "live">>> = {
  pl: {
    basic: {
      decision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      publicPriceLabel: "0 PLN / mc",
      actionLabel: "Darmowy dostęp",
      availabilityLabel: "Dostęp natychmiastowy",
      description: "Darmowa podstawowa ocena ryzyka, 10 sygnałów weryfikacyjnych i syntetyczny profil bezpieczeństwa aktywa.",
      manualQualityControlRequired: false,
      boundaries: ["Basic pozostaje w 100% darmowy", "10 sygnałów weryfikacyjnych", "bez karty kredytowej", "dostęp natychmiastowy"],
    },
    pro: {
      decision: "INVITATION_ONLY_CONTROLLED_BETA",
      publicPriceLabel: "14.99 € / mc",
      actionLabel: "Wybierz Pro",
      availabilityLabel: "Dostępne natychmiast — Pro Terminal",
      description: "Profesjonalny silnik analityczny: głębokość księgi zleceń L2/L3, symulacja poślizgu VWAP, przepływy wielorybów, 14 sygnałów dowodowych i natychmiastowy audyt. Rekomendowane dla aktywnych traderów.",
      manualQualityControlRequired: false,
      boundaries: ["14 sygnałów dowodowych", "symulacja poślizgu VWAP", "analiza przepływów wielorybów", "natychmiastowe generowanie audytu"],
    },
    advanced: {
      decision: "NOT_FOR_SALE",
      publicPriceLabel: "49.99 € / mc",
      actionLabel: "Wybierz Advanced",
      availabilityLabel: "Dostępne natychmiast — Institutional Tier",
      description: "Instytucjonalny silnik audytorski Velmère: analiza mikrostruktury, detekcja manipulacji rynkowej i próżni płynności, 20 sygnałów weryfikacyjnych oraz nielimitowany eksport raportów PDF z pieczęcią kryptograficzną.",
      manualQualityControlRequired: false,
      boundaries: ["20 sygnałów weryfikacyjnych", "analiza mikrostruktury L3", "detekcja manipulacji i próżni płynności", "nielimitowany eksport PDF"],
    },
  },
  en: {
    basic: {
      decision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      publicPriceLabel: "€0 / mo",
      actionLabel: "Free Access",
      availabilityLabel: "Instant Access",
      description: "Free foundational risk scoring, 10 verification signals, and synthetic asset security profile.",
      manualQualityControlRequired: false,
      boundaries: ["Basic is 100% free", "10 verification signals", "no credit card required", "instant access"],
    },
    pro: {
      decision: "INVITATION_ONLY_CONTROLLED_BETA",
      publicPriceLabel: "€14.99 / mo",
      actionLabel: "Choose Pro",
      availabilityLabel: "Instant Access — Pro Terminal",
      description: "Professional intelligence engine: L2/L3 orderbook depth, VWAP slippage modeling, whale flow monitoring, 14 evidence signals, and instant audit generation. Recommended for active traders.",
      manualQualityControlRequired: false,
      boundaries: ["14 evidence signals", "VWAP slippage simulation", "whale flow tracking", "instant audit generation"],
    },
    advanced: {
      decision: "NOT_FOR_SALE",
      publicPriceLabel: "€49.99 / mo",
      actionLabel: "Choose Advanced",
      availabilityLabel: "Instant Access — Institutional Tier",
      description: "Institutional Velmère audit engine: L3 market microstructure, liquidity vacuum detection, manipulation screening, 20 verification signals, and unlimited certified PDF report exports.",
      manualQualityControlRequired: false,
      boundaries: ["20 verification signals", "L3 microstructure analysis", "manipulation & vacuum detection", "unlimited certified PDF export"],
    },
  },
  de: {
    basic: {
      decision: "PILOT_ONLY_FREE_LIMITED_PRESCREEN",
      publicPriceLabel: "0 € / Mo",
      actionLabel: "Kostenloser Zugang",
      availabilityLabel: "Sofortiger Zugang",
      description: "Kostenlose grundlegende Risikobewertung, 10 Verifikationssignale und synthetisches Sicherheitsprofil.",
      manualQualityControlRequired: false,
      boundaries: ["Basic bleibt 100% kostenlos", "10 Verifikationssignale", "keine Kreditkarte erforderlich", "sofortiger Zugang"],
    },
    pro: {
      decision: "INVITATION_ONLY_CONTROLLED_BETA",
      publicPriceLabel: "14.99 € / Mo",
      actionLabel: "Pro wählen",
      availabilityLabel: "Sofortiger Zugang — Pro Terminal",
      description: "Professionelle Intelligence-Engine: L2/L3 Orderbuch-Tiefe, VWAP-Slippage-Simulation, Wal-Transaktionsflüsse, 14 Evidenzsignale und Sofort-Audit. Empfohlen für aktive Trader.",
      manualQualityControlRequired: false,
      boundaries: ["14 Evidenzsignale", "VWAP-Slippage-Modellierung", "Wal-Transaktionsflüsse", "Sofort-Audit-Generierung"],
    },
    advanced: {
      decision: "NOT_FOR_SALE",
      publicPriceLabel: "49.99 € / Mo",
      actionLabel: "Advanced wählen",
      availabilityLabel: "Sofortiger Zugang — Institutional Tier",
      description: "Institutionelle Velmère-Audit-Engine: L3-Mikrostrukturanalyse, Erkennung von Marktmanipulationen und Liquiditätsvakua, 20 Verifikationssignale und unbegrenzter zertifizierter PDF-Export.",
      manualQualityControlRequired: false,
      boundaries: ["20 Verifikationssignale", "L3-Mikrostrukturanalyse", "Manipulations- & Vakuum-Erkennung", "unbegrenzter zertifizierter PDF-Export"],
    },
  },
};

export function resolveVlmCurrentSkuLocale(value: unknown): VlmCurrentSkuLocale {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

export function getVlmCurrentSkuTruth(tier: VlmCurrentSkuTier, locale: unknown = "en"): VlmCurrentSkuTruth {
  const safeLocale = resolveVlmCurrentSkuLocale(locale);
  return {
    schemaVersion: PASS36_R44P16_CURRENT_SKU_TRUTH_ID,
    tier,
    ...COPY[safeLocale][tier],
    commercialTarget: tier === "basic" ? "GO_FREE" : "GO_PAID",
    freeAccessGuaranteed: tier === "basic",
    publicCheckoutAllowed: false,
    publicPrice: null,
    humanReviewIncluded: false,
    independentCertificationIncluded: false,
    customerFindingConfidence: "NOT_CALIBRATED",
    saleEnabled: false,
    live: false,
  };
}

export function tierForVlmProductId(productId: string): Exclude<VlmCurrentSkuTier, "basic"> | null {
  if (productId.startsWith("vlm_pro_")) return "pro";
  if (productId.startsWith("vlm_advanced_")) return "advanced";
  return null;
}

export function normalizeLegacyAuditQueueState(value: unknown):
  | "intake"
  | "analysis_queue"
  | "automated_analysis"
  | "needs_evidence"
  | "pdf_attached"
  | "customer_safe_ready"
  | "ready_for_download"
  | "delivered"
  | "blocked_redaction"
  | "unknown" {
  if (value === "human_review_queue" || value === "paid_waiting_human_review" || value === "queued_paid_review") return "analysis_queue";
  if (value === "human_review") return "automated_analysis";
  if (value === "queued" || value === "queued_basic_prescreen" || value === "fulfilment_pending") return "analysis_queue";
  if (value === "ready_for_download" || value === "delivered_to_account") return "ready_for_download";
  if (value === "intake" || value === "analysis_queue" || value === "automated_analysis" || value === "needs_evidence" || value === "pdf_attached" || value === "customer_safe_ready" || value === "delivered" || value === "blocked_redaction") return value;
  return "unknown";
}

export function currentSkuTruthSnapshot(locale: unknown = "en") {
  return {
    schemaVersion: PASS36_R44P16_CURRENT_SKU_TRUTH_ID,
    globalDecision: "NO_GO" as const,
    live: false,
    saleEnabled: false,
    productionApproved: false,
    worldClassProven: false,
    basicAlwaysFree: true,
    proAdvancedCommercialTarget: "GO_PAID_AFTER_EVIDENCE" as const,
    legacyTierSnapshotScope: "AUDIT_REPORT_ONLY" as const,
    currentCustomerTierModelScope: "FIVE_EXPLICIT_TIERED_FAMILIES_ONLY" as const,
    auditReportTiers: {
      basic: getVlmCurrentSkuTruth("basic", locale),
      pro: getVlmCurrentSkuTruth("pro", locale),
      advanced: getVlmCurrentSkuTruth("advanced", locale),
    },
    // Compatibility alias. This is Audit report scope, not a tier model for every Velmère module.
    tiers: {
      basic: getVlmCurrentSkuTruth("basic", locale),
      pro: getVlmCurrentSkuTruth("pro", locale),
      advanced: getVlmCurrentSkuTruth("advanced", locale),
    },
    customerProductTopology: {
      schemaVersion: PASS36_R44P35_PRODUCT_TOPOLOGY_ID,
      previousSchemaVersion: PASS36_R44P34_PRODUCT_TOPOLOGY_ID_COMPAT,
      products: VLM_CANONICAL_CUSTOMER_PRODUCTS,
      productFamilies: VLM_CANONICAL_PRODUCT_FAMILIES,
      tieredFamilies: VLM_CANONICAL_TIERED_FAMILIES,
      standaloneProductIds: VLM_CANONICAL_STANDALONE_PRODUCTS,
      internalExecutionContexts: VLM_INTERNAL_EXECUTION_CONTEXTS,
      internalExecutionProfiles: VLM_INTERNAL_EXECUTION_PROFILES,
      contextTransitions: VLM_CONTEXT_TRANSITIONS,
      denominators: VLM_V16_TOPOLOGY_DENOMINATORS,
      reportIntegrationDepth: VLM_REPORT_INTEGRATION_DEPTH,
      standaloneIntegrationRules: VLM_STANDALONE_INTEGRATION_RULES,
      pdfArtifactModel: {
        pdfIsSeparateProductFamily: false,
        auditPdfIsCustomerArtifactForEachAuditTier: true,
        browserPdfRemainsBrowserArtifactWhereImplemented: true,
      } as const,
      rules: VLM_PRODUCT_TAXONOMY_RULES,
    },
  };
}
