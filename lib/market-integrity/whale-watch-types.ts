import type { WhaleWatchCustomerTruth } from "./whale-watch-customer-truth";
import type { VlmCustomerLocale } from "../product/vlm-standalone-customer-truth";
import type { VlmReportContextDepth } from "../product/vlm-standalone-insight-contract";
import type { WalletLabelRegistryArtifact } from "./wallet-label-registry";
import type { HolderCategory } from "./whale-watch-contract-types";
export type { HolderCategory } from "./whale-watch-contract-types";
import type { MarketImpactExecution, MarketImpactVenueSnapshot } from "./market-impact-types";

export type WhaleEvidenceStatus = "verified_live" | "verified_staging" | "verified_fixture";

export type WhaleTransferKind =
  | "transfer"
  | "mint"
  | "burn"
  | "bridge"
  | "liquidity_add"
  | "liquidity_remove";

export type WhaleTransferFinality = "unconfirmed" | "confirmed" | "finalized";

export type WhaleTransferReorgState = "canonical" | "reorged" | "unresolved";


export type WhaleCapability =
  | "holder_distribution"
  | "wallet_labels"
  | "transfer_history";

export interface WhaleCapabilityReceipt {
  capability: WhaleCapability;
  providerFamily: string;
  observedAt: string;
  status: WhaleEvidenceStatus;
  recordCount: number;
  coverageComplete: boolean;
  sourceDigest: string;
}

export interface WhaleHolderSnapshot {
  holderId: string;
  balance: number;
  sharePercent?: number;
  category: HolderCategory;
  labelVerified: boolean;
  clusterId?: string;
  observedAt: string;
  providerFamily: string;
  status: WhaleEvidenceStatus;
  sourceDigest?: string;
}

export interface WhaleTransferEvent {
  eventId: string;
  /** Canonical CAIP-2 EVM chain identity; required for non-fixture transfer evidence. */
  chainId?: string;
  /** ERC-20 contract that emitted the physical log. */
  contractAddress?: string;
  txHash?: string;
  logIndex?: number;
  blockNumber?: number;
  blockHash?: string;
  confirmations?: number;
  finality?: WhaleTransferFinality;
  reorgState?: WhaleTransferReorgState;
  tokenDecimals?: number;
  observedAt: string;
  amountBase: number;
  amountUsd?: number;
  fromHolderId?: string;
  toHolderId?: string;
  fromCategory?: HolderCategory;
  toCategory?: HolderCategory;
  kind?: WhaleTransferKind;
  providerFamily: string;
  /** All independent observations merged into this one physical-log row. */
  providerFamilies?: string[];
  status: WhaleEvidenceStatus;
  sourceDigest?: string;
  sourceDigests?: string[];
}

export interface WhaleWatchPolicy {
  maximumHolderAgeMs: number;
  maximumTransferAgeMs: number;
  maximumReceiptAgeMs: number;
  minimumProviderFamilies: number;
  minimumHolderCoveragePercent: number;
  minimumVerifiedLabelCoveragePercent: number;
  minimumClusterCoveragePercent: number;
  minimumWalletLabelConfidencePercent: number;
  allowStaging: boolean;
  allowFixture: boolean;
  exitStressFractions: number[];
}

export interface WhaleConcentrationSummary {
  top1Percent: number;
  top5Percent: number;
  top10Percent: number;
  hhi: number;
  gini: number;
}

export interface WhaleFlowWindow {
  window: "24h" | "7d" | "30d";
  eventCount: number;
  exchangeInflowUsd: number;
  exchangeOutflowUsd: number;
  netExchangeFlowUsd: number;
  treasuryToExchangeUsd: number;
  treasuryDistributionUsd: number;
  bridgeFlowUsd: number;
  liquidityAddedUsd: number;
  liquidityRemovedUsd: number;
  mintedUsd: number;
  burnedUsd: number;
  whaleTransferUsd: number;
}

export interface WhaleWatchAlert {
  id: string;
  severity: "info" | "watch" | "high" | "critical";
  confidencePercent: number;
  title: string;
  evidence: string[];
}

export interface WhaleExitStressResult {
  holderRef: string;
  category: HolderCategory;
  holderSharePercent: number;
  fractionOfHolderBalance: number;
  notionalUsd: number;
  execution: MarketImpactExecution | null;
}

export interface WhaleWatchResult {
  schemaVersion: "velmere.whale-watch.v1";
  assetKey: string;
  generatedAt: string;
  sourceObservationTimes: {
    holderDistribution: string | null;
    transferHistory: string | null;
    capabilityReceipts: string | null;
  };
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  advancedReady: boolean;
  providerFamilies: string[];
  holderCount: number;
  transferCount: number;
  holderCoveragePercent: number;
  verifiedLabelCoveragePercent: number;
  clusterCoveragePercent: number;
  verifiedWalletLabelArtifactCount: number;
  walletLabelRegistryDigest: string;
  rawConcentration: WhaleConcentrationSummary;
  adjustedConcentration: WhaleConcentrationSummary;
  flowWindows: WhaleFlowWindow[];
  alerts: WhaleWatchAlert[];
  holderExitStress: WhaleExitStressResult[];
  missingEvidence: string[];
  blockers: string[];
  /** R44P35: standalone customer-truth contract; no Basic/Pro/Advanced Whale product variants. */
  customerTruth: WhaleWatchCustomerTruth;
  evidenceDigest: string;
}

export interface WhaleWatchInput {
  assetKey: string;
  totalSupply: number;
  priceUsd: number;
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  capabilityReceipts: WhaleCapabilityReceipt[];
  marketImpactSnapshots?: MarketImpactVenueSnapshot[];
  redactionSecret: string;
  walletLabelArtifacts?: WalletLabelRegistryArtifact[];
  walletLabelVerificationSecret?: string;
  now?: Date;
  policy?: Partial<WhaleWatchPolicy>;
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth;
}
