export const R44P17_COMMERCIAL_PROMOTION_ALLOWED = false as const;
export const R44P17_DIAGNOSTIC_ASSET_DENOMINATOR = 50 as const;
export const R44P17_DIAGNOSTIC_PROVIDER_ROW_DENOMINATOR = 100 as const;
export const R44P17_SHIELD_DENOMINATOR = 318 as const;
export const R44P17_REAL_MARKETS_DENOMINATOR = 583 as const;

export type R44P17TerminalState = "AVAILABLE" | "PARTIAL" | "CONFLICTED" | "RATE_LIMITED" | "FAILED";

export interface R44P17ProviderDiagnosticInput {
  observedAssets: number;
  providerRows: number;
  availableProviderRows: number;
  twoProviderAssets: number;
  oneProviderAssets: number;
  conflictedAssets: number;
  failedOrRateLimitedAssets: number;
  rightsApprovedCommercialUse: boolean;
  displayRightsApproved: boolean;
  cacheRightsApproved: boolean;
  pdfExportRightsApproved: boolean;
  aiRagRightsApproved: boolean;
  fullShieldCatalogObserved: boolean;
  fullRealMarketsCatalogObserved: boolean;
}

export interface R44P17CrossSurfaceTruth {
  observationClass: "REAL_NETWORK_DIAGNOSTIC_ONLY";
  selectionClass: "DETERMINISTIC_SEEDED_NON_CHERRY_PICKED";
  freshnessClass: "CAPTURE_TIME_ONLY_NOT_CONTINUOUS";
  rightsStatus: "BLOCKED_RIGHTS";
  coverage: {
    shield: { observed: number; denominator: 318; percent: number };
    realMarkets: { observed: number; denominator: 583; percent: number };
  };
  providerRows: { observed: number; available: number; twoProviderAssets: number; oneProviderAssets: number };
  terminalSummary: { conflictedAssets: number; failedOrRateLimitedAssets: number };
  surfaces: {
    shieldBasic: "REFERENCE_DIAGNOSTIC_ONLY";
    shieldPro: "BLOCKED_RIGHTS_DEPTH_AND_ENTITLEMENT";
    shieldMap: "REFERENCE_DIAGNOSTIC_ONLY";
    realMarketsBasic: "REFERENCE_DIAGNOSTIC_ONLY";
    realMarketsPro: "BLOCKED_RIGHTS_AND_CATALOG";
    realMarketsAdvanced: "BLOCKED_RIGHTS_AND_CUSTOMER_VALUE";
    marketImpact: "BLOCKED_CURRENT_ORDER_BOOK_AND_REALIZED_SLIPPAGE";
    whaleWatch: "BLOCKED_CURRENT_TRANSFER_AND_SIGNED_LABEL_EVIDENCE";
    angelRisk: "REFERENCE_CONTEXT_ONLY_NOT_DECISION_AUTHORITY";
  };
  displayEligible: false;
  cacheEligible: false;
  pdfExportEligible: false;
  aiRagEligible: false;
  paidTierEligible: false;
  liveEligible: false;
  blockedReasons: readonly string[];
}

const bounded = (value: number, max: number, code: string): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(code);
  return value;
};

export function deriveR44P17CrossSurfaceTruth(input: R44P17ProviderDiagnosticInput): R44P17CrossSurfaceTruth {
  const observedAssets = bounded(input.observedAssets, R44P17_DIAGNOSTIC_ASSET_DENOMINATOR, "R44P17_ASSET_COUNT_INVALID");
  const providerRows = bounded(input.providerRows, R44P17_DIAGNOSTIC_PROVIDER_ROW_DENOMINATOR, "R44P17_PROVIDER_ROW_COUNT_INVALID");
  const availableProviderRows = bounded(input.availableProviderRows, providerRows, "R44P17_AVAILABLE_ROW_COUNT_INVALID");
  const twoProviderAssets = bounded(input.twoProviderAssets, observedAssets, "R44P17_TWO_PROVIDER_COUNT_INVALID");
  const oneProviderAssets = bounded(input.oneProviderAssets, observedAssets, "R44P17_ONE_PROVIDER_COUNT_INVALID");
  const conflictedAssets = bounded(input.conflictedAssets, observedAssets, "R44P17_CONFLICT_COUNT_INVALID");
  const failedOrRateLimitedAssets = bounded(input.failedOrRateLimitedAssets, observedAssets, "R44P17_FAILURE_COUNT_INVALID");
  if (twoProviderAssets + oneProviderAssets + failedOrRateLimitedAssets < observedAssets) throw new Error("R44P17_TERMINAL_DENOMINATOR_INCOMPLETE");
  if (providerRows !== observedAssets * 2) throw new Error("R44P17_PROVIDER_ROW_DENOMINATOR_MISMATCH");
  void input.rightsApprovedCommercialUse;
  void input.displayRightsApproved;
  void input.cacheRightsApproved;
  void input.pdfExportRightsApproved;
  void input.aiRagRightsApproved;
  void input.fullShieldCatalogObserved;
  void input.fullRealMarketsCatalogObserved;
  return {
    observationClass: "REAL_NETWORK_DIAGNOSTIC_ONLY",
    selectionClass: "DETERMINISTIC_SEEDED_NON_CHERRY_PICKED",
    freshnessClass: "CAPTURE_TIME_ONLY_NOT_CONTINUOUS",
    rightsStatus: "BLOCKED_RIGHTS",
    coverage: {
      shield: { observed: observedAssets, denominator: 318, percent: Number(((observedAssets / 318) * 100).toFixed(4)) },
      realMarkets: { observed: observedAssets, denominator: 583, percent: Number(((observedAssets / 583) * 100).toFixed(4)) },
    },
    providerRows: { observed: providerRows, available: availableProviderRows, twoProviderAssets, oneProviderAssets },
    terminalSummary: { conflictedAssets, failedOrRateLimitedAssets },
    surfaces: {
      shieldBasic: "REFERENCE_DIAGNOSTIC_ONLY",
      shieldPro: "BLOCKED_RIGHTS_DEPTH_AND_ENTITLEMENT",
      shieldMap: "REFERENCE_DIAGNOSTIC_ONLY",
      realMarketsBasic: "REFERENCE_DIAGNOSTIC_ONLY",
      realMarketsPro: "BLOCKED_RIGHTS_AND_CATALOG",
      realMarketsAdvanced: "BLOCKED_RIGHTS_AND_CUSTOMER_VALUE",
      marketImpact: "BLOCKED_CURRENT_ORDER_BOOK_AND_REALIZED_SLIPPAGE",
      whaleWatch: "BLOCKED_CURRENT_TRANSFER_AND_SIGNED_LABEL_EVIDENCE",
      angelRisk: "REFERENCE_CONTEXT_ONLY_NOT_DECISION_AUTHORITY",
    },
    displayEligible: false,
    cacheEligible: false,
    pdfExportEligible: false,
    aiRagEligible: false,
    paidTierEligible: false,
    liveEligible: false,
    blockedReasons: [
      "CHECKPOINT_COMMERCIAL_PROMOTION_DISABLED",
      "PROVIDER_RIGHTS_NOT_APPROVED",
      "FULL_318_SHIELD_DENOMINATOR_NOT_OBSERVED",
      "FULL_583_REAL_MARKETS_DENOMINATOR_NOT_OBSERVED",
      "CONTINUOUS_FRESHNESS_CORRECTIONS_AND_UPTIME_NOT_PROVEN",
      "CURRENT_ORDER_BOOK_AND_REALIZED_SLIPPAGE_NOT_PROVEN",
      "SIGNED_LABEL_AND_TRANSFER_EVIDENCE_NOT_PROVEN",
      "CUSTOMER_VALUE_AND_WILLINGNESS_TO_PAY_NOT_PROVEN",
    ] as const,
  };
}
