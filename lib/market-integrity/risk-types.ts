import type { RiskIndicatorCustomerTruth } from "./risk-indicator-customer-truth";
import type { Pass4653RefreshRegistration } from "./refresh-contract";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type VelmereMarketAssetClass =
  | "crypto"
  | "stock"
  | "etf"
  | "index"
  | "fx"
  | "commodity"
  | "real_estate"
  | "exchange_equity"
  | "unknown";

export type RiskSignalId =
  | "extreme_drawdown"
  | "major_drawdown"
  | "severe_24h_drop"
  | "high_24h_drop"
  | "rapid_intraday_move"
  | "parabolic_24h_gain"
  | "parabolic_7d_gain"
  | "parabolic_30d_gain"
  | "multi_timeframe_pump"
  | "new_ath_repricing"
  | "thin_liquidity"
  | "very_thin_liquidity"
  | "volume_spike"
  | "wash_trading_risk"
  | "holder_concentration"
  | "orderbook_depth_collapse"
  | "orderbook_slippage_risk"
  | "orderbook_imbalance"
  | "rebrand_after_crash"
  | "exchange_deposit_anomaly"
  | "contract_privileges"
  | "honeypot_risk"
  | "high_sell_tax"
  | "mint_risk"
  | "blacklist_risk"
  | "sell_pressure_imbalance"
  | "low_dex_liquidity"
  | "market_volume_stress"
  | "fdv_marketcap_gap"
  | "supply_overhang"
  | "provider_health_degradation"
  | "source_divergence"
  | "stale_market_data"
  | "insufficient_data";

export type TokenRiskInput = {
  marketId?: string;
  symbol: string;
  name: string;
  image?: string;
  rank?: number;
  chainId?: string;
  tokenAddress?: string;
  pairAddress?: string;
  dexId?: string;
  url?: string;
  currentPrice?: number;
  athPrice?: number;
  marketCap?: number;
  fdv?: number;
  liquidityUsd?: number;
  volume24h?: number;
  averageVolume7d?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange14d?: number;
  priceChange30d?: number;
  buys24h?: number;
  sells24h?: number;
  top10HolderPercent?: number;
  holderCount?: number;
  hadRebrandAfterCrash?: boolean;
  abnormalExchangeDeposits?: boolean;
  suspiciousContractPrivileges?: boolean;
  orderBookDepthDropPercent?: number;
  simulatedSlippage10k?: number;
  bidAskImbalancePercent?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  buyTaxPercentage?: number;
  sellTaxPercentage?: number;
  isHoneypot?: boolean;
  canMintNewTokens?: boolean;
  canPauseTrading?: boolean;
  canBlacklist?: boolean;
  sparkline7d?: number[];
  dataSources?: string[];
  providerHealthScore?: number;
  sourceDivergenceBps?: number;
  freshnessSeconds?: number;
  freshnessState?: "fresh" | "aging" | "stale" | "missing";
  consensusState?: "aligned" | "watch" | "divergent" | "stale" | "single_source" | "unavailable";
  assetClass?: VelmereMarketAssetClass;
};


export type RiskAgentId =
  | "velocity"
  | "liquidity"
  | "microstructure"
  | "holders"
  | "contract"
  | "data";

export type RiskAgentScore = {
  id: RiskAgentId;
  label: string;
  score: number;
  weight: number;
  confidence: number;
  evidenceCount: number;
};

export type RiskAgentAssessment = RiskAgentScore & {
  status: RiskLevel;
  verdict: "clear" | "watch" | "warning" | "critical" | "insufficient_data";
  evidenceSignalIds: RiskSignalId[];
  reasoning: string;
  nextAction: string;
};

export type RiskMetaModel = {
  version: string;
  verdict: "clear" | "watch" | "warning" | "critical" | "insufficient_data";
  dominantAgent?: RiskAgentId;
  dataFusionScore: number;
  conflictLevel: "none" | "low" | "medium" | "high";
  requiredReview: boolean;
  summary: string;
  escalation: string;
  limitations: string[];
};

export type TokenRiskSignal = {
  id: RiskSignalId;
  severity: RiskLevel;
  points: number;
  metrics?: Record<string, number | string | boolean | null>;
};

export type Pass4644ProviderEvidenceReceiptLike = import("./provider-evidence-contract").Pass4644ProviderEvidenceReceipt;
export type Pass4645ProviderEvidenceLedgerLike = import("./provider-evidence-contract").Pass4645ProviderEvidenceLedger;
export type Pass4645ProviderEvidencePersistenceLike = import("./provider-evidence-contract").Pass4645LedgerPersistence;

export type RiskUncertaintyEnvelope = {
  schemaVersion: "velmere.risk-uncertainty.v1";
  /** Deterministic evidence range, not a statistical confidence interval. */
  method: "deterministic_evidence_sensitivity";
  interpretation: "sensitivity_band_not_empirical_confidence_interval";
  empiricalCalibrationStatus: "not_available" | "holdout_validated" | "expired" | "rejected";
  probabilityClaimAllowed: boolean;
  calibrationProfileId?: string;
  pointEstimate: number;
  lowerBound: number;
  upperBound: number;
  halfWidth: number;
  precision: "high" | "moderate" | "low" | "insufficient";
  evidenceState: "live_multi_source" | "live_single_source" | "partial" | "demo" | "insufficient";
  outOfDistribution: boolean;
  drivers: string[];
};

export type RiskModelBinding = {
  schemaVersion: "velmere.risk-model-binding.v1";
  scoreFormula: string;
  featureSchemaVersion: string;
  featureSchemaDigest: string;
  assetClassCohort: VelmereMarketAssetClass;
  providerConfigurationDigest: string;
};

export type TokenRiskResult = {
  token: {
    marketId?: string;
    symbol: string;
    name: string;
    image?: string;
    rank?: number;
    chainId?: string;
    tokenAddress?: string;
    pairAddress?: string;
    dexId?: string;
    url?: string;
    assetClass?: VelmereMarketAssetClass;
  };
  score: number;
  modelBinding?: RiskModelBinding;
  uncertainty?: RiskUncertaintyEnvelope;
  empiricalCalibration?: {
    schemaVersion: "velmere.risk-result-calibration.v1";
    status: "holdout_validated";
    profileId: string;
    outcomeDefinition: string;
    probability: number;
    issuedAt: string;
    expiresAt: string;
    integrityDigest: string;
    modelBindingDigest: string;
  };
  scoreFormula?: string;
  confidence?: number;
  scoreBreakdown?: RiskAgentScore[];
  agentAssessments?: RiskAgentAssessment[];
  metaModel?: RiskMetaModel;
  level: RiskLevel;
  badge: "low_detected_risk" | "elevated_risk" | "possible_manipulation_risk" | "critical_market_integrity_risk";
  signals: TokenRiskSignal[];
  metrics: {
    currentPrice?: number;
    athPrice?: number;
    drawdownPercent?: number;
    marketCap?: number;
    fdv?: number;
    fdvToMarketCapRatio?: number;
    liquidityUsd?: number;
    liquidityToMarketCapPercent?: number;
    volume24h?: number;
    volumeToLiquidityRatio?: number;
    volumeToMarketCapRatio?: number;
    priceChange1h?: number;
    priceChange6h?: number;
    priceChange24h?: number;
    priceChange7d?: number;
    priceChange14d?: number;
    priceChange30d?: number;
    buySellImbalancePercent?: number;
    top10HolderPercent?: number;
    holderCount?: number;
    buyTaxPercentage?: number;
    sellTaxPercentage?: number;
    simulatedSlippage10k?: number;
    bidAskImbalancePercent?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number;
    providerHealthScore?: number;
    sourceDivergenceBps?: number;
    freshnessSeconds?: number;
  };
  dataQuality: "demo" | "partial" | "live";
  chart?: { sevenDay?: number[] };
  aiSummary?: string;
  dataSources: string[];
  /** PASS4644: identity-bound provider receipts. Strings in dataSources remain display labels and are not commercial proof by themselves. */
  providerEvidenceReceipts?: Pass4644ProviderEvidenceReceiptLike[];
  /** PASS4645: append-only hash-chain ledger and durable write proof for provider evidence. */
  providerEvidenceLedger?: Pass4645ProviderEvidenceLedgerLike;
  providerEvidencePersistence?: Pass4645ProviderEvidencePersistenceLike;
  /** PASS4653: transparent stale-while-revalidate continuity status. Cached receipts are never presented as fresh live calls. */
  pass4653Continuity?: import("./provider-evidence-contract").Pass4653ContinuityHydration;
  /** PASS4653: durable persistence/read-back proof for the continuity snapshot. */
  pass4653ContinuityPersistence?: import("./provider-evidence-contract").Pass4653ContinuityPersistence;
  /** PASS4653: demand-adaptive background refresh registration for this asset/tier. */
  pass4653RefreshRegistration?: Pass4653RefreshRegistration;
  /** PASS4653: verified long-lived instrument identity/classification continuity metadata. */
  pass4653InstrumentMetadata?: {
    schemaVersion: "pass4653_instrument_metadata_hydration_v1";
    applied: boolean;
    source: "verified_continuity_snapshot";
    snapshotHash: string;
    observedAt: string;
    expiresAt: string;
    providerId: string;
    providerFamily: string;
  };
  /** PASS4142: premium/provider hydrators expose customer-visible missing lanes here; metaModel.limitations remains the canonical fallback. */
  limitations?: string[];
  /**
   * Server-owned publication decision.  Provider labels and a route-level
   * `live` string never authorize score delivery; only a signed, fresh,
   * identity/field-bound receipt chain can set this state to `verified`.
   */
  providerRiskDelivery?: {
    schemaVersion: "pass6_provider_risk_delivery_v1";
    state: "verified" | "withheld";
    scorePublished: boolean;
    canonicalIdentity: string;
    sourceReceiptRoot: string;
    receiptDigest: string;
    completenessBps: number;
    sourceAsOf: string | null;
    blockers: string[];
  };
  /** R44P35: one standalone Risk Indicator truth envelope; report depth cannot change the indicator. */
  customerTruth: RiskIndicatorCustomerTruth;
  generatedAt: string;
};
