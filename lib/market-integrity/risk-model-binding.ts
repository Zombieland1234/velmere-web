import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { RiskModelBinding, TokenRiskInput, VelmereMarketAssetClass } from "./risk-types";

export const RISK_SCORE_FORMULA = "deterministic_continuous_evidence_fusion_v10";
export const RISK_FEATURE_SCHEMA_VERSION = "velmere.risk-feature-schema.v2";

const RISK_FEATURE_SCHEMA = {
  numeric: [
    "rank", "currentPrice", "athPrice", "marketCap", "fdv", "liquidityUsd",
    "volume24h", "averageVolume7d", "priceChange1h", "priceChange6h",
    "priceChange24h", "priceChange7d", "priceChange14d", "priceChange30d",
    "buys24h", "sells24h", "top10HolderPercent", "holderCount",
    "orderBookDepthDropPercent", "simulatedSlippage10k", "bidAskImbalancePercent",
    "circulatingSupply", "totalSupply", "maxSupply", "buyTaxPercentage",
    "sellTaxPercentage", "providerHealthScore", "sourceDivergenceBps",
    "freshnessSeconds",
  ],
  boolean: [
    "hadRebrandAfterCrash", "abnormalExchangeDeposits", "suspiciousContractPrivileges",
    "isHoneypot", "canMintNewTokens", "canPauseTrading", "canBlacklist",
  ],
  categorical: ["assetClass", "freshnessState", "consensusState"],
  series: ["sparkline7d"],
} as const;

function sha256(value: string) {
  return sha256Digest(value);
}

export const RISK_FEATURE_SCHEMA_DIGEST = sha256(canonicalJson(RISK_FEATURE_SCHEMA));

export function riskProviderConfigurationDigest(input: Pick<TokenRiskInput, "assetClass" | "consensusState" | "dataSources">) {
  return sha256(canonicalJson({
    assetClass: input.assetClass ?? "unknown",
    consensusState: input.consensusState ?? "unavailable",
    dataSources: Array.from(new Set((input.dataSources ?? []).map((source) => source.trim().toLowerCase()).filter(Boolean))).sort(),
  }));
}

export function buildRiskModelBinding(
  input: TokenRiskInput,
  assetClass: VelmereMarketAssetClass,
): RiskModelBinding {
  return {
    schemaVersion: "velmere.risk-model-binding.v1",
    scoreFormula: RISK_SCORE_FORMULA,
    featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
    featureSchemaDigest: RISK_FEATURE_SCHEMA_DIGEST,
    assetClassCohort: assetClass,
    providerConfigurationDigest: riskProviderConfigurationDigest({
      assetClass,
      consensusState: input.consensusState,
      dataSources: input.dataSources,
    }),
  };
}

export function riskModelBindingDigest(binding: RiskModelBinding & { outcomeHorizonMs?: number }) {
  return sha256(canonicalJson(binding));
}
