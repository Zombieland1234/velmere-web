export type LargeActorAssetClass = "stock" | "etf" | "index" | "fx" | "commodity" | "real_estate";
export type LargeActorEvidenceStatus = "verified_live" | "verified_staging" | "verified_fixture";

export type LargeActorCapability =
  | "institutional_positions"
  | "insider_transactions"
  | "block_trades"
  | "etf_flows"
  | "constituent_concentration"
  | "cot_positioning"
  | "open_interest"
  | "inventory"
  | "rebalancing_events"
  | "macro_flow";

export interface LargeActorCapabilityReceipt {
  capability: LargeActorCapability;
  providerFamily: string;
  observedAt: string;
  status: LargeActorEvidenceStatus;
  recordCount: number;
  coverageComplete: boolean;
  sourceDigest: string;
}

export interface LargeActorPosition {
  actorId: string;
  actorType: "institution" | "insider" | "fund" | "dealer" | "commercial" | "non_commercial" | "constituent" | "sponsor" | "unknown";
  capability: LargeActorCapability;
  ownershipPercent?: number;
  marketValueUsd?: number;
  notionalUsd?: number;
  direction?: "long" | "short" | "neutral";
  observedAt: string;
  providerFamily: string;
  status: LargeActorEvidenceStatus;
  sourceDigest?: string;
}

export interface LargeActorEvent {
  eventId: string;
  capability: LargeActorCapability;
  eventType: string;
  direction: "buy" | "sell" | "inflow" | "outflow" | "increase" | "decrease" | "long" | "short" | "neutral";
  amountUsd: number;
  observedAt: string;
  providerFamily: string;
  status: LargeActorEvidenceStatus;
  sourceDigest?: string;
}

export interface LargeActorWatchPolicy {
  maximumReceiptAgeMs: number;
  minimumProviderFamilies: number;
  allowStaging: boolean;
  allowFixture: boolean;
}

export interface LargeActorConcentration {
  top1Percent: number;
  top5Percent: number;
  top10Percent: number;
  reportedOwnershipPercent: number;
}

export interface LargeActorFlowWindow {
  window: "24h" | "7d" | "30d";
  eventCount: number;
  buyOrInflowUsd: number;
  sellOrOutflowUsd: number;
  netFlowUsd: number;
  longPressureUsd: number;
  shortPressureUsd: number;
}

export interface LargeActorAlert {
  id: string;
  severity: "info" | "watch" | "high" | "critical";
  confidencePercent: number;
  title: string;
  evidence: string[];
}

export interface LargeActorWatchResult {
  schemaVersion: "velmere.large-actor-watch.v1";
  assetKey: string;
  assetClass: LargeActorAssetClass;
  generatedAt: string;
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  advancedReady: boolean;
  requiredCapabilities: LargeActorCapability[];
  coveredCapabilities: LargeActorCapability[];
  providerFamilies: string[];
  positionCount: number;
  eventCount: number;
  concentration: LargeActorConcentration;
  flowWindows: LargeActorFlowWindow[];
  actorRefs: Array<{ actorRef: string; actorType: LargeActorPosition["actorType"]; ownershipPercent: number | null; marketValueUsd: number | null }>;
  alerts: LargeActorAlert[];
  missingEvidence: string[];
  blockers: string[];
  evidenceDigest: string;
}

export interface LargeActorWatchInput {
  assetKey: string;
  assetClass: LargeActorAssetClass;
  positions: LargeActorPosition[];
  events: LargeActorEvent[];
  capabilityReceipts: LargeActorCapabilityReceipt[];
  redactionSecret: string;
  now?: Date;
  policy?: Partial<LargeActorWatchPolicy>;
}
