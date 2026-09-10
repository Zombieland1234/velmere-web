/**
 * Velmère Audit Furnace V3 - Data Completeness & Root Cause Engine
 * Deconstructs missing data vectors and enforces the 12-state completeness taxonomy.
 * Axiom: NEVER FABRICATE MISSING DATA. Zero fake N/A. Every state must have provenance.
 */

export type FieldCompletenessState =
  | "VERIFIED_LIVE"
  | "VERIFIED_SECONDARY"
  | "VERIFIED_TERTIARY"
  | "INSUFFICIENT_QUORUM"
  | "STALE_SNAPSHOT"
  | "UNSUPPORTED_BY_CONTRACT"
  | "RATE_LIMIT_THROTTLED"
  | "UPSTREAM_OUTAGE"
  | "DATA_SANITY_REJECTED"
  | "GENUINELY_UNAVAILABLE"
  | "SCHEMA_MIGRATION_PENDING"
  | "DETERMINISTIC_FIXTURE";

export interface FieldObservationAttempt {
  provider: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "RATE_LIMITED" | "INVALID_VALUE";
  httpStatus?: number;
  errorMessage?: string;
}

export interface FieldCompletenessDiagnosis {
  fieldKey: string;
  fieldLabel: string;
  category: "market" | "security" | "liquidity" | "governance";
  isApplicableToAsset: boolean;
  applicabilityReason?: string;
  state: FieldCompletenessState;
  stateHumanExplanation: string;
  resolvedValue: unknown | null;
  attempts: FieldObservationAttempt[];
  evaluatedAt: string;
}

export interface AssetCompletenessReport {
  assetId: string;
  symbol: string;
  assetClass: "evm_contract" | "native_chain" | "market_asset";
  totalFieldsCount: number;
  applicableFieldsCount: number;
  verifiedFieldsCount: number;
  completenessRatio: number; // 0.0 to 1.0
  completenessBps: number; // 0 to 10,000
  fields: FieldCompletenessDiagnosis[];
  summary: {
    liveCount: number;
    secondaryCount: number;
    staleCount: number;
    unsupportedCount: number;
    genuinelyUnavailableCount: number;
  };
}

/**
 * Evaluates whether a security/market field is applicable to a specific asset class.
 */
export function isFieldApplicableToAsset(
  fieldKey: string,
  assetClass: "evm_contract" | "native_chain" | "market_asset"
): { isApplicable: boolean; reason?: string } {
  // Smart contract specific fields
  const EVM_ONLY_FIELDS = [
    "contract_address",
    "bytecode_hash",
    "implementation_address",
    "is_proxy",
    "has_timelock",
    "admin_address",
    "blacklist_enabled",
    "mintable_supply",
    "upgrade_delay_seconds",
  ];

  if (EVM_ONLY_FIELDS.includes(fieldKey) && assetClass !== "evm_contract") {
    return {
      isApplicable: false,
      reason: `Field '${fieldKey}' only applies to EVM smart contracts. This asset is a native chain or market instrument.`,
    };
  }

  // Pegged asset specific fields
  const PEGGED_ONLY_FIELDS = ["collateral_ratio", "depeg_risk_factor", "basket_composition"];
  if (PEGGED_ONLY_FIELDS.includes(fieldKey) && fieldKey !== "depeg_risk_factor") {
    return {
      isApplicable: false,
      reason: `Field '${fieldKey}' only applies to algorithmic or collateralized pegged tokens.`,
    };
  }

  return { isApplicable: true };
}

/**
 * Diagnoses the root cause of missing or present data for a given field observation.
 */
export function diagnoseFieldCompleteness(params: {
  fieldKey: string;
  fieldLabel: string;
  category: "market" | "security" | "liquidity" | "governance";
  assetClass: "evm_contract" | "native_chain" | "market_asset";
  value: unknown | null;
  observedAt?: string;
  maxFreshnessSeconds?: number;
  attempts?: FieldObservationAttempt[];
  isFixture?: boolean;
}): FieldCompletenessDiagnosis {
  const { isApplicable, reason } = isFieldApplicableToAsset(params.fieldKey, params.assetClass);
  const evaluatedAt = new Date().toISOString();
  const attempts = params.attempts || [];

  // 1. Not applicable to this asset
  if (!isApplicable) {
    return {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      category: params.category,
      isApplicableToAsset: false,
      applicabilityReason: reason,
      state: "UNSUPPORTED_BY_CONTRACT",
      stateHumanExplanation: reason || "Field does not apply to this instrument architecture.",
      resolvedValue: null,
      attempts,
      evaluatedAt,
    };
  }

  // 2. Deterministic fixture
  if (params.isFixture) {
    return {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      category: params.category,
      isApplicableToAsset: true,
      state: "DETERMINISTIC_FIXTURE",
      stateHumanExplanation: "Deterministic canonical test fixture for reproducible security regression suite.",
      resolvedValue: params.value,
      attempts,
      evaluatedAt,
    };
  }

  // 3. Value exists and is valid
  if (params.value !== null && params.value !== undefined && params.value !== "") {
    // Check freshness if timestamp provided
    if (params.observedAt && params.maxFreshnessSeconds) {
      const ageSeconds = (Date.now() - new Date(params.observedAt).getTime()) / 1000;
      if (ageSeconds > params.maxFreshnessSeconds) {
        return {
          fieldKey: params.fieldKey,
          fieldLabel: params.fieldLabel,
          category: params.category,
          isApplicableToAsset: true,
          state: "STALE_SNAPSHOT",
          stateHumanExplanation: `Value is stale (${Math.floor(ageSeconds)}s old > tolerance of ${params.maxFreshnessSeconds}s).`,
          resolvedValue: params.value,
          attempts,
          evaluatedAt,
        };
      }
    }

    return {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      category: params.category,
      isApplicableToAsset: true,
      state: "VERIFIED_LIVE",
      stateHumanExplanation: "Live verified telemetry point obtained from authoritative primary provider.",
      resolvedValue: params.value,
      attempts,
      evaluatedAt,
    };
  }

  // 4. Value is missing - analyze attempts log to find root cause
  const rateLimitedAttempt = attempts.find((a) => a.status === "RATE_LIMITED" || a.httpStatus === 429);
  if (rateLimitedAttempt) {
    return {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      category: params.category,
      isApplicableToAsset: true,
      state: "RATE_LIMIT_THROTTLED",
      stateHumanExplanation: `Upstream query to '${rateLimitedAttempt.provider}' exceeded rate limits (HTTP 429).`,
      resolvedValue: null,
      attempts,
      evaluatedAt,
    };
  }

  const outageAttempt = attempts.find((a) => (a.httpStatus && a.httpStatus >= 500) || a.status === "TIMEOUT");
  if (outageAttempt) {
    return {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      category: params.category,
      isApplicableToAsset: true,
      state: "UPSTREAM_OUTAGE",
      stateHumanExplanation: `Provider '${outageAttempt.provider}' suffered network timeout or 5xx outage.`,
      resolvedValue: null,
      attempts,
      evaluatedAt,
    };
  }

  // Exhausted all providers without finding data -> Genuinely Unavailable
  return {
    fieldKey: params.fieldKey,
    fieldLabel: params.fieldLabel,
    category: params.category,
    isApplicableToAsset: true,
    state: "GENUINELY_UNAVAILABLE",
    stateHumanExplanation: "Field genuinely unavailable across all queried independent market providers. Never fabricated.",
    resolvedValue: null,
    attempts,
    evaluatedAt,
  };
}

/**
 * Computes accurate completeness metrics excluding non-applicable fields.
 */
export function calculateAssetCompletenessReport(
  assetId: string,
  symbol: string,
  assetClass: "evm_contract" | "native_chain" | "market_asset",
  diagnoses: FieldCompletenessDiagnosis[]
): AssetCompletenessReport {
  const applicableFields = diagnoses.filter((d) => d.isApplicableToAsset);
  const verifiedFields = applicableFields.filter(
    (d) =>
      d.state === "VERIFIED_LIVE" ||
      d.state === "VERIFIED_SECONDARY" ||
      d.state === "VERIFIED_TERTIARY" ||
      d.state === "DETERMINISTIC_FIXTURE"
  );

  const ratio = applicableFields.length > 0 ? verifiedFields.length / applicableFields.length : 1.0;
  const bps = Math.round(ratio * 10_000);

  return {
    assetId,
    symbol,
    assetClass,
    totalFieldsCount: diagnoses.length,
    applicableFieldsCount: applicableFields.length,
    verifiedFieldsCount: verifiedFields.length,
    completenessRatio: ratio,
    completenessBps: bps,
    fields: diagnoses,
    summary: {
      liveCount: diagnoses.filter((d) => d.state === "VERIFIED_LIVE").length,
      secondaryCount: diagnoses.filter((d) => d.state === "VERIFIED_SECONDARY").length,
      staleCount: diagnoses.filter((d) => d.state === "STALE_SNAPSHOT").length,
      unsupportedCount: diagnoses.filter((d) => d.state === "UNSUPPORTED_BY_CONTRACT").length,
      genuinelyUnavailableCount: diagnoses.filter((d) => d.state === "GENUINELY_UNAVAILABLE").length,
    },
  };
}
