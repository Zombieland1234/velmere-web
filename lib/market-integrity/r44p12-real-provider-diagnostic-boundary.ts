export const R44P12_CHECKPOINT_ALLOWS_COMMERCIAL_PROMOTION = false as const;
export const R44P12_DIAGNOSTIC_ASSET_DENOMINATOR = 15 as const;
export const R44P12_SHIELD_FULL_DENOMINATOR = 318 as const;
export const R44P12_REAL_MARKETS_FULL_DENOMINATOR = 583 as const;

export interface R44P12ProviderDiagnosticInput {
  observedAssets: number;
  availableProviderRows: number;
  rightsApprovedCommercialUse: boolean;
  redistributionApproved: boolean;
  pdfExportApproved: boolean;
  aiRagUseApproved: boolean;
  fullShieldCatalogObserved: boolean;
  fullRealMarketsCatalogObserved: boolean;
}

export interface R44P12ProviderDiagnosticTruth {
  observationClass: "REAL_NETWORK_DIAGNOSTIC";
  dataFreshnessClaim: "CAPTURE_TIME_ONLY_NOT_CONTINUOUS";
  rightsStatus: "BLOCKED_RIGHTS";
  shieldDiagnosticCoverage: { observed: number; denominator: 318; percent: number };
  realMarketsDiagnosticCoverage: { observed: number; denominator: 583; percent: number };
  providerAvailableRows: number;
  displayEligible: false;
  pdfExportEligible: false;
  aiRagEligible: false;
  paidTierEligible: false;
  liveEligible: false;
  blockedReasons: readonly string[];
}

const boundedCount = (value: number, maximum: number): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error("R44P12_DIAGNOSTIC_COUNT_INVALID");
  }
  return value;
};

export function deriveR44P12ProviderDiagnosticTruth(input: R44P12ProviderDiagnosticInput): R44P12ProviderDiagnosticTruth {
  const observedAssets = boundedCount(input.observedAssets, R44P12_DIAGNOSTIC_ASSET_DENOMINATOR);
  const availableProviderRows = boundedCount(input.availableProviderRows, R44P12_DIAGNOSTIC_ASSET_DENOMINATOR * 2);
  void input.rightsApprovedCommercialUse;
  void input.redistributionApproved;
  void input.pdfExportApproved;
  void input.aiRagUseApproved;
  void input.fullShieldCatalogObserved;
  void input.fullRealMarketsCatalogObserved;
  const blockedReasons = [
    "CHECKPOINT_COMMERCIAL_PROMOTION_DISABLED",
    "PROVIDER_RIGHTS_NOT_APPROVED",
    "FULL_318_SHIELD_DENOMINATOR_NOT_OBSERVED",
    "FULL_583_REAL_MARKETS_DENOMINATOR_NOT_OBSERVED",
    "CONTINUOUS_FRESHNESS_CORRECTION_AND_UPTIME_NOT_PROVEN",
    "CUSTOMER_VALUE_AND_WILLINGNESS_TO_PAY_NOT_PROVEN",
  ] as const;

  return {
    observationClass: "REAL_NETWORK_DIAGNOSTIC",
    dataFreshnessClaim: "CAPTURE_TIME_ONLY_NOT_CONTINUOUS",
    rightsStatus: "BLOCKED_RIGHTS",
    shieldDiagnosticCoverage: {
      observed: observedAssets,
      denominator: R44P12_SHIELD_FULL_DENOMINATOR,
      percent: Number(((observedAssets / R44P12_SHIELD_FULL_DENOMINATOR) * 100).toFixed(4)),
    },
    realMarketsDiagnosticCoverage: {
      observed: observedAssets,
      denominator: R44P12_REAL_MARKETS_FULL_DENOMINATOR,
      percent: Number(((observedAssets / R44P12_REAL_MARKETS_FULL_DENOMINATOR) * 100).toFixed(4)),
    },
    providerAvailableRows: availableProviderRows,
    displayEligible: false,
    pdfExportEligible: false,
    aiRagEligible: false,
    paidTierEligible: false,
    liveEligible: false,
    blockedReasons,
  };
}
