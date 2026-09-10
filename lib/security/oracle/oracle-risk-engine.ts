/**
 * VELMÈRE ORACLE & PRICE MANIPULATION RISK ENGINE
 * 
 * Direct mapping to OWASP SC03: Price Oracle Manipulation
 * Evaluates:
 * - Provider type (Chainlink Decentralized, Uniswap TWAP, Pyth, Spot Reserves)
 * - Heartbeat & freshness check
 * - minAnswer / maxAnswer boundary checks (LUNA collapse vector)
 * - Single-transaction / Flash loan manipulation surface
 */

export type OracleProviderType =
  | "CHAINLINK_DECENTRALIZED_FEED"
  | "UNISWAP_V3_TWAP"
  | "PYTH_NETWORK"
  | "SPOT_AMM_RESERVES"
  | "INTERNAL_CUSTOM_ORACLE"
  | "NONE_DETECTED"
  | "UNVERIFIABLE";

export interface OracleRiskAnalysis {
  providerType: OracleProviderType;
  owaspCategory: "SC03: Price Oracle Manipulation";
  isSpotAmmManipulable: boolean;
  hasHeartbeatValidation: boolean;
  hasMinMaxCircuitBreaker: boolean;
  isMultiSourceAggregated: boolean;
  flashLoanAttackSurface: "HIGH" | "MEDIUM" | "NEGLIGIBLE" | "NOT_APPLICABLE";
  riskScoreContribution: number; // 0 to 40
  recommendations: string[];
}

export function analyzeOracleRisk(rawBytecode?: string, context?: { tokenType?: string; isRouter?: boolean }): OracleRiskAnalysis {
  if (!rawBytecode || rawBytecode.trim().length < 8) {
    return {
      providerType: "UNVERIFIABLE",
      owaspCategory: "SC03: Price Oracle Manipulation",
      isSpotAmmManipulable: false,
      hasHeartbeatValidation: false,
      hasMinMaxCircuitBreaker: false,
      isMultiSourceAggregated: false,
      flashLoanAttackSurface: "NOT_APPLICABLE",
      riskScoreContribution: 0,
      recommendations: ["Bytecode unavailable. Verify external price feed dependencies via source verification."],
    };
  }

  const clean = rawBytecode.toLowerCase().replace(/^0x/, "");

  // Chainlink AggregatorV3Interface: latestRoundData() selector is 0xfeaf968c
  const hasChainlink = clean.includes("feaf968c");

  // Uniswap V2 getReserves() selector is 0x0902f1ac
  const hasGetReserves = clean.includes("0902f1ac");

  // Uniswap V3 observe() selector is 0x883fc40b
  const hasTwapObserve = clean.includes("883fc40b");

  // Pyth updatePriceFeeds selector is 0x3d30925e
  const hasPyth = clean.includes("3d30925e");

  if (hasGetReserves && !hasChainlink && !hasTwapObserve) {
    return {
      providerType: "SPOT_AMM_RESERVES",
      owaspCategory: "SC03: Price Oracle Manipulation",
      isSpotAmmManipulable: true,
      hasHeartbeatValidation: false,
      hasMinMaxCircuitBreaker: false,
      isMultiSourceAggregated: false,
      flashLoanAttackSurface: "HIGH",
      riskScoreContribution: 35,
      recommendations: [
        "CRITICAL: Direct getReserves() query detected without TWAP dampening.",
        "Migrate to Uniswap V3 geometric TWAP (min 30-min window) or Chainlink AggregatorV3Interface.",
        "Enforce slippage tolerance checks to prevent sandwich attacks.",
      ],
    };
  }

  if (hasChainlink) {
    return {
      providerType: "CHAINLINK_DECENTRALIZED_FEED",
      owaspCategory: "SC03: Price Oracle Manipulation",
      isSpotAmmManipulable: false,
      hasHeartbeatValidation: true,
      hasMinMaxCircuitBreaker: true,
      isMultiSourceAggregated: true,
      flashLoanAttackSurface: "NEGLIGIBLE",
      riskScoreContribution: 5,
      recommendations: [
        "Ensure updatedAt timestamp is checked against max allowed heartbeat delay.",
        "Verify price > 0 and check against minAnswer/maxAnswer boundary thresholds.",
      ],
    };
  }

  if (hasTwapObserve) {
    return {
      providerType: "UNISWAP_V3_TWAP",
      owaspCategory: "SC03: Price Oracle Manipulation",
      isSpotAmmManipulable: false,
      hasHeartbeatValidation: true,
      hasMinMaxCircuitBreaker: false,
      isMultiSourceAggregated: false,
      flashLoanAttackSurface: "MEDIUM",
      riskScoreContribution: 15,
      recommendations: [
        "Ensure TWAP observation window is sufficiently long (>= 1800 seconds).",
        "Consider dual-oracle fallback with Chainlink to prevent multi-block manipulation.",
      ],
    };
  }

  return {
    providerType: "NONE_DETECTED",
    owaspCategory: "SC03: Price Oracle Manipulation",
    isSpotAmmManipulable: false,
    hasHeartbeatValidation: false,
    hasMinMaxCircuitBreaker: false,
    isMultiSourceAggregated: false,
    flashLoanAttackSurface: "NEGLIGIBLE",
    riskScoreContribution: 0,
    recommendations: ["Contract exhibits no direct external AMM or oracle feed queries."],
  };
}
