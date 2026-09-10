/**
 * Neutral source-synchronization contract.
 *
 * This file intentionally imports no PASS implementation modules. Downstream
 * enrichers depend on this stable structural boundary instead of importing the
 * source-synchronizer orchestrator that imports them back.
 */
export type VelmereSyncedProviderId =
  | "coingecko"
  | "dexscreener"
  | "binance"
  | "binance-futures"
  | "bybit-derivatives"
  | "defillama"
  | "goplus"
  | "yahoo-finance"
  | "sec-xbrl"
  | "manual-review";

export type VelmereSourceSyncLane = {
  id: VelmereSyncedProviderId;
  label: string;
  state: "confirmed" | "partial" | "missing" | "not_applicable" | "degraded";
  scope: string;
  confirmedFields: string[];
  missingFields: string[];
  confidenceCap: number;
  cadence: string;
  observedAt?: string;
  boundary: string;
};

type SourceSyncPass2445Contract = {
  score?: number;
  fieldSla?: Array<{ label: string; status: string }>;
};

type SourceSyncDefiLlamaContract = {
  mode?: string;
  protocolSlug?: string;
  lanes: Array<{ id: string; status: string }>;
};

type SourceSyncPass2447Contract = {
  state?: string;
  score?: number;
  consensusFields: Array<{ id: string; missingProviders: string[] }>;
  tierLocks: Array<{ tier: string; blockedBy: string[] }>;
};

type SourceSyncPass2448Contract = {
  state?: string;
  score?: number;
  fieldContracts: Array<{ label: string; currentState: string }>;
};

type SourceSyncPass2449Contract = {
  providerOverlays: Array<{
    provider: string;
    label: string;
    state: string;
    missingInputs: string[];
  }>;
};

type SourceSyncPass2464Contract = {
  state?: string;
  reconciliationFingerprint?: string;
};

/**
 * Structural input accepted by PASS2444–PASS2465 enrichers. The concrete
 * orchestrator may expose additional PASS fields; callers must not depend on
 * those implementation details through this boundary.
 */
export type VelmereSourceSyncPacket = {
  version: "pass2443-source-sync-risk-engine-v1";
  pass2445?: SourceSyncPass2445Contract;
  pass2446DefiLlama?: SourceSyncDefiLlamaContract;
  pass2447?: SourceSyncPass2447Contract;
  pass2448?: SourceSyncPass2448Contract;
  pass2449?: SourceSyncPass2449Contract;
  pass2464?: SourceSyncPass2464Contract;
  query: string;
  symbol?: string;
  assetClass: string;
  mode: "multi_source" | "single_source" | "degraded";
  sourceCount: number;
  quorumState: "ready" | "watch" | "blocked";
  confidenceCap: number;
  lanes: VelmereSourceSyncLane[];
  crossChecks: Array<{
    id: string;
    label: string;
    state: "pass" | "watch" | "missing" | "not_applicable";
    detail: string;
    weight: number;
  }>;
  tierMatrix: {
    basic: string[];
    pro: string[];
    advanced: string[];
  };
  missingForWorldClass: string[];
  riskEngineAddons: string[];
  innovationBacklog: string[];
  generatedAt: string;
};
