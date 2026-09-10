import type { MarketImpactCustomerTruth } from "./market-impact-customer-truth";
export type MarketImpactEvidenceStatus =
  | "verified_live"
  | "verified_staging"
  | "verified_fixture";

export type MarketImpactSide = "buy" | "sell";

export interface MarketImpactLevelInput {
  price: number;
  baseQuantity: number;
}

export interface MarketImpactQuoteRateEvidence {
  usdRate: number;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  providerFamily: string;
  sourceDigest: string;
}

export interface MarketImpactVenueSnapshot {
  venueId: string;
  providerFamily: string;
  assetKey: string;
  quoteCurrency: "USD" | "USDT" | "USDC";
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  feeBps?: number;
  quoteToUsd?: MarketImpactQuoteRateEvidence;
  bids: MarketImpactLevelInput[];
  asks: MarketImpactLevelInput[];
  sourceDigest?: string;
}

export interface MarketImpactPolicy {
  notionalUsdGrid: number[];
  maxAgeMs: number;
  maximumQuoteRateAgeMs: number;
  maximumStableQuoteDeviationBps: number;
  minimumVenueCount: number;
  minimumProviderFamilies: number;
  minimumFillRatio: number;
  maximumCrossVenueMidDivergenceBps: number;
  maximumSpreadBps: number;
  allowStaging: boolean;
  allowFixture: boolean;
  maximumLevelsPerSide: number;
}

export interface MarketImpactNormalizedLevel {
  venueId: string;
  providerFamily: string;
  price: number;
  baseQuantity: number;
  quoteNotional: number;
  feeBps: number;
}

export interface MarketImpactVenueSummary {
  venueId: string;
  providerFamily: string;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  quoteCurrency: "USD" | "USDT" | "USDC";
  quoteToUsdRate: number;
  quoteRateObservedAt: string | null;
  quoteRateStatus: MarketImpactEvidenceStatus | null;
  quoteRateProviderFamily: string | null;
  quoteRateSourceDigest: string | null;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spreadBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  sourceDigest: string | null;
}

export interface MarketImpactVenueContribution {
  venueId: string;
  providerFamily: string;
  baseQuantity: number;
  quoteNotional: number;
  contributionPercent: number;
}

export interface MarketImpactExecution {
  side: MarketImpactSide;
  requestedNotionalUsd: number;
  referenceMidPrice: number;
  requestedBaseQuantity: number;
  filledBaseQuantity: number;
  grossQuoteNotionalUsd: number;
  feeUsd: number;
  netQuoteNotionalUsd: number;
  fillRatio: number;
  unfilledNotionalUsd: number;
  vwap: number | null;
  impactBps: number | null;
  worstPrice: number | null;
  venueContributions: MarketImpactVenueContribution[];
}

export interface MarketImpactDepthBand {
  bandBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
}

export interface MarketImpactScenarioResult {
  id:
    | "visible_depth_minus_25"
    | "visible_depth_minus_50"
    | "visible_depth_minus_75"
    | "deepest_venue_outage"
    | "spread_x3_depth_minus_50";
  label: string;
  depthMultiplier: number;
  removedVenueId: string | null;
  spreadMultiplier: number;
  largestBuy: MarketImpactExecution;
  largestSell: MarketImpactExecution;
}

export interface MarketImpactResult {
  schemaVersion: "velmere.market-impact.v1";
  assetKey: string;
  generatedAt: string;
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  advancedReady: boolean;
  providerFamilies: string[];
  venues: MarketImpactVenueSummary[];
  excludedVenues: Array<{ venueId: string; reason: string }>;
  referenceMidPrice: number | null;
  crossVenueMidDivergenceBps: number | null;
  depthBands: MarketImpactDepthBand[];
  executions: MarketImpactExecution[];
  scenarios: MarketImpactScenarioResult[];
  missingEvidence: string[];
  blockers: string[];
  /** R44P35: customer-facing truth boundary; this is one standalone product, not a tiered SKU. */
  customerTruth: MarketImpactCustomerTruth;
  evidenceDigest: string;
}
