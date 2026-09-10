/**
 * Neutral provider-evidence DTO contract.
 * This module intentionally imports no runtime implementation and no risk engine.
 */
export type Pass4644ProviderSurface = "crypto" | "real_markets" | "contract_audit";
export type Pass4644ReceiptVerification = "normalized_response" | "raw_response" | "health_only";
export type Pass4644ReceiptState = "confirmed" | "partial" | "rejected";
export type Pass4644TimestampProvenance = "provider" | "transport_received" | "missing" | "invalid";

export type Pass4650EvidenceCategory =
  | "identity"
  | "market"
  | "liquidity"
  | "holders_ownership"
  | "contract_permissions"
  | "supply_tokenomics"
  | "fundamentals_filings"
  | "macro_rates"
  | "derivatives_microstructure"
  | "history_volatility"
  | "scenario_dependency";

export type Pass4653ContinuityReceiptMeta = {
  schemaVersion: "pass4653_continuity_receipt_v1";
  replayedFromReceiptId: string;
  snapshotHash: string;
  originalObservedAt: string;
  graceExpiresAt: string;
  replayedAt: string;
  reason: "provider_outage" | "provider_timeout" | "provider_rate_limited" | "scheduled_refresh_gap";
};

export type Pass4644ProviderIdentity = {
  requested: string;
  resolvedSymbol?: string;
  resolvedMarketId?: string;
  resolvedAddress?: string;
  resolvedChainId?: string;
  matched: boolean;
};

/**
 * Hash-only binding between one normalized provider field and the receipt that
 * carried it. Raw provider values stay out of the receipt, while downstream
 * consumers can still prove that a concrete fact value was present in the
 * exact hashed payload. Legacy receipts without this array remain readable,
 * but cannot satisfy field-level commercial quorum.
 */
export type Pass4644ProviderFieldEvidence = {
  fieldPath: string;
  capability: string;
  valueHash: string;
};

export type Pass4644ProviderEvidenceReceipt = {
  schemaVersion: "pass4644_provider_evidence_receipt_v1";
  receiptId: string;
  providerId: string;
  providerFamily: string;
  surface: Pass4644ProviderSurface;
  verification: Pass4644ReceiptVerification;
  state: Pass4644ReceiptState;
  identity: Pass4644ProviderIdentity;
  capabilities: string[];
  fieldEvidence?: Pass4644ProviderFieldEvidence[];
  timestampProvenance: Pass4644TimestampProvenance;
  observedAt: string;
  receivedAt: string;
  expiresAt: string;
  freshnessMs: number | null;
  fresh: boolean;
  httpStatus: number;
  latencyMs: number;
  payloadBytes: number;
  payloadHash: string;
  commercialEvidenceEligible: boolean;
  rejectionReasons: string[];
  continuity?: Pass4653ContinuityReceiptMeta;
};

export type Pass4645AnalysisDepth = "basic" | "pro" | "advanced";
export type Pass4645LedgerStorageMode = "filesystem" | "supabase" | "not_configured";

export type Pass4645ProviderEvidenceLedgerEntry = {
  schemaVersion: "pass4645_provider_evidence_ledger_entry_v1";
  ledgerId: string;
  sequence: number;
  previousEntryHash: string | null;
  entryHash: string;
  signature: string | null;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  depth: Pass4645AnalysisDepth;
  receiptId: string;
  providerId: string;
  providerFamily: string;
  payloadHash: string;
  receiptCanonicalDigest: string;
  commercialEvidenceEligible: boolean;
  timestampProvenance: Pass4644TimestampProvenance;
  observedAt: string;
  receivedAt: string;
  persistedAt: string;
  retentionExpiresAt: string;
};

export type Pass4645ProviderEvidenceLedger = {
  schemaVersion: "pass4645_provider_evidence_ledger_v1";
  ledgerId: string;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  depth: Pass4645AnalysisDepth;
  generatedAt: string;
  receiptCount: number;
  eligibleReceiptCount: number;
  headHash: string | null;
  signed: boolean;
  entries: Pass4645ProviderEvidenceLedgerEntry[];
};

export type Pass4645LedgerPersistence = {
  schemaVersion: "pass4645_provider_evidence_persistence_v1";
  durable: boolean;
  mode: Pass4645LedgerStorageMode;
  ledgerId: string;
  headHash: string | null;
  recordCount: number;
  readBackVerified: boolean;
  persistedAt: string | null;
  locator: string | null;
  blockers: string[];
};

export type Pass4653ContinuityMode = "live" | "continuity" | "degraded_basic_only" | "unavailable";

export type Pass4653ContinuityPersistence = {
  schemaVersion: "pass4653_continuity_persistence_v1";
  durable: boolean;
  mode: "memory" | "filesystem" | "supabase" | "not_configured";
  snapshotId: string;
  snapshotHash: string;
  readBackVerified: boolean;
  locator: string | null;
  blockers: string[];
};

export type Pass4653ContinuityHydration = {
  schemaVersion: "pass4653_continuity_hydration_v1";
  mode: Pass4653ContinuityMode;
  cacheHit: boolean;
  snapshotId: string | null;
  snapshotAgeMs: number | null;
  replayedReceiptCount: number;
  replayedProviderFamilies: string[];
  replayedCategories: Pass4650EvidenceCategory[];
  liveReceiptCount: number;
  liveProviderFamilies: string[];
  liveCategories: Pass4650EvidenceCategory[];
  liveCoreReadyForPro: boolean;
  liveCoreReadyForAdvanced: boolean;
  paidContinuityEligible: { pro: boolean; advanced: boolean };
  totalProviderOutage: boolean;
  blockers: string[];
};
