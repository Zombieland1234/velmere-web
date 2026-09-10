import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { ASCII_CONTROL_PATTERN } from "@/lib/security/ascii-control-characters";
import { riskModelBindingDigest } from "./risk-model-binding";
import {
  verifyRiskHistoryCustomerRequestBindingShape,
  type RiskHistoryCustomerRequestBinding,
} from "./risk-history-customer-request-binding";
import type { RiskLevel, TokenRiskResult } from "./risk-types";

export const RISK_HISTORY_SNAPSHOT_SCHEMA = "velmere.risk-history-snapshot.v1" as const;
export const RISK_HISTORY_EVENT_SCHEMA = "velmere.risk-history-event.v1" as const;
export const RISK_HISTORY_CUSTOMER_SCHEMA = "velmere.risk-history.customer.v1" as const;
export const RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA = "velmere.risk-history.customer.v3" as const;
export const RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA = "velmere.risk-history-page-storage-proof.v2" as const;
export const RISK_HISTORY_PAGE_EVIDENCE_SCHEMA = "velmere.risk-history-page-evidence.v1" as const;
export const RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA = "velmere.risk-history.customer-window.v1" as const;
export const RISK_HISTORY_HEARTBEAT_MS = 24 * 60 * 60 * 1_000;

export type RiskHistoryIdentityClass = "CHAIN_CONTRACT" | "MARKET_ID" | "UNRESOLVED";
export type RiskHistoryPublicationState = "PUBLIC" | "WITHHELD";
export type RiskHistoryEventType =
  | "TRACKING_STARTED"
  | "SCORE_CHANGED"
  | "LEVEL_CHANGED"
  | "METHODOLOGY_CHANGED"
  | "EVIDENCE_CHANGED"
  | "PUBLICATION_STATE_CHANGED"
  | "HEARTBEAT";

export type RiskHistoryAssetResolutionState = "RESOLVED" | "EMPTY" | "AMBIGUOUS";

const RISK_HISTORY_IDENTITY_CLASSES = new Set<RiskHistoryIdentityClass>([
  "CHAIN_CONTRACT",
  "MARKET_ID",
  "UNRESOLVED",
]);
const RISK_HISTORY_PUBLICATION_STATES = new Set<RiskHistoryPublicationState>(["PUBLIC", "WITHHELD"]);
const RISK_HISTORY_LEVELS = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const RISK_HISTORY_EVENT_TYPES = new Set<RiskHistoryEventType>([
  "TRACKING_STARTED",
  "SCORE_CHANGED",
  "LEVEL_CHANGED",
  "METHODOLOGY_CHANGED",
  "EVIDENCE_CHANGED",
  "PUBLICATION_STATE_CHANGED",
  "HEARTBEAT",
]);
const RISK_HISTORY_SNAPSHOT_FIELDS = new Set([
  "schemaVersion", "id", "canonicalAssetId", "identityClass", "symbol", "name", "timestamp",
  "price", "marketCap", "volume24h", "score", "level", "signalCount", "dominantAgent",
  "confidence", "publicationState", "customerPublishable", "methodologyVersion", "scoreVersion",
  "evidenceVersion", "evidenceDigest", "sourceAsOf", "comparabilityKey", "snapshotDigest",
]);
const RISK_HISTORY_EVENT_FIELDS = new Set([
  "schemaVersion", "eventId", "eventDigest", "canonicalAssetId", "assetId", "identityClass",
  "symbol", "name", "observedAt", "recordedAt", "score", "level", "signalCount", "confidence",
  "publicationState", "customerPublishable", "methodologyVersion", "scoreVersion",
  "evidenceVersion", "evidenceDigest", "sourceAsOf", "comparabilityKey", "comparableToPrevious",
  "eventTypes", "changeReasons", "snapshot",
]);

export type RiskHistorySnapshotRecord = {
  schemaVersion: typeof RISK_HISTORY_SNAPSHOT_SCHEMA;
  id: string;
  canonicalAssetId: string;
  identityClass: RiskHistoryIdentityClass;
  symbol: string;
  name: string;
  timestamp: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  score: number;
  level: RiskLevel;
  signalCount: number;
  dominantAgent?: string;
  confidence?: number;
  publicationState: RiskHistoryPublicationState;
  customerPublishable: boolean;
  methodologyVersion: string;
  scoreVersion: string;
  evidenceVersion: string;
  evidenceDigest: string;
  sourceAsOf?: string;
  comparabilityKey: string;
  snapshotDigest: string;
};

export type RiskHistoryEvent = {
  schemaVersion: typeof RISK_HISTORY_EVENT_SCHEMA;
  eventId: string;
  eventDigest: string;
  canonicalAssetId: string;
  assetId: string;
  identityClass: RiskHistoryIdentityClass;
  symbol: string;
  name: string;
  observedAt: string;
  recordedAt: string;
  score: number;
  level: RiskLevel;
  signalCount: number;
  confidence?: number;
  publicationState: RiskHistoryPublicationState;
  customerPublishable: boolean;
  methodologyVersion: string;
  scoreVersion: string;
  evidenceVersion: string;
  evidenceDigest: string;
  sourceAsOf?: string;
  comparabilityKey: string;
  comparableToPrevious: boolean;
  eventTypes: RiskHistoryEventType[];
  changeReasons: string[];
  snapshot: RiskHistorySnapshotRecord;
};

export type RiskHistoryDecision =
  | { decision: "STORE"; reason: "FIRST_EVENT" | "MATERIAL_CHANGE" | "HEARTBEAT_DUE"; event: RiskHistoryEvent }
  | { decision: "SKIP"; reason: "EXACT_DUPLICATE" | "UNCHANGED_WITHIN_HEARTBEAT" }
  | { decision: "CONFLICT"; reason: "TIMESTAMP_COLLISION" | "NON_MONOTONIC_TIME" | "INVALID_SNAPSHOT" };

export type RiskHistoryDurabilityState =
  | "DURABLE_READBACK_VERIFIED"
  | "CONFIGURED_UNVERIFIED"
  | "DEGRADED_MEMORY_FALLBACK"
  | "RUNTIME_MEMORY_ONLY";

export type CustomerSafeRiskLedgerStatus = {
  schemaVersion: "velmere.risk-history-ledger.customer-status.v1";
  storageState: "DURABLE_VERIFIED" | "CONFIGURED_UNVERIFIED" | "DEGRADED" | "RUNTIME_ONLY";
  historyCompleteness: "DURABLE_BOUNDED" | "RUNTIME_BOUNDED" | "UNKNOWN";
  blockers: string[];
};

export type CustomerSafeRiskHistoryPageStorageProof = {
  schemaVersion: typeof RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA;
  pageSource: "DATABASE" | "MEMORY";
  pageReadState: "DATABASE_PAGE_RESPONSE_VERIFIED" | "RUNTIME_PAGE_ONLY";
  pageIntegrityVerified: true;
  durableRetentionClaimed: false;
  backupRestoreProven: false;
  pageEvidenceDigest: string;
  blockers: Array<
    | "database_page_read_not_verified"
    | "multi_year_retention_not_proven"
    | "backup_restore_not_proven"
  >;
};

export type RiskHistoryPublicPage = {
  requestedLimit: number;
  before: string | null;
  hasOlder: boolean;
  nextBefore: string | null;
};

export type RiskHistoryPublicRequestBinding = {
  schemaVersion: "velmere.risk-history-public-request-binding.v1";
  requestedId: string;
  resolutionKind: "CANONICAL" | "UNIQUE_ALIAS" | null;
};

export type CustomerRiskHistoryWindow = {
  schemaVersion: typeof RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA;
  requestedLimit: number;
  before: string | null;
  returnedObservations: number;
  hasOlder: boolean;
  nextBefore: string | null;
  isLatestWindow: boolean;
  reachesTrackingStart: boolean;
  completeVisibleHistory: boolean;
  oldestIncludedAt: string | null;
  newestIncludedAt: string | null;
};

export type CustomerRiskHistoryProjection = {
  schemaVersion: typeof RISK_HISTORY_CUSTOMER_SCHEMA;
  productId: "risk-indicator";
  capability: "risk-history";
  status: "AVAILABLE" | "WITHHELD" | "EMPTY";
  asset: {
    canonicalAssetId: string | null;
    symbol: string | null;
    name: string | null;
  };
  trackingStartedAt: string | null;
  observations: number;
  segments: Array<{
    comparabilityKey: string;
    methodologyVersion: string;
    scoreVersion: string;
    evidenceVersion: string;
    comparableWithPreviousSegment: boolean;
    startedAt: string;
    endedAt: string;
  }>;
  history: Array<{
    eventReference: string;
    observedAt: string;
    score: number;
    level: RiskLevel;
    confidence: number | null;
    eventTypes: RiskHistoryEventType[];
    changeReasons: string[];
    methodologyVersion: string;
    scoreVersion: string;
    evidenceVersion: string;
    comparabilityKey: string;
    comparableToPrevious: boolean;
    isProbability: false;
    probabilityPercent: null;
  }>;
  storage: CustomerSafeRiskLedgerStatus;
  limitations: string[];
};

export type PublicCustomerRiskHistoryProjection = Omit<CustomerRiskHistoryProjection, "schemaVersion" | "storage"> & {
  schemaVersion: typeof RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA;
  window: CustomerRiskHistoryWindow;
  storage: CustomerSafeRiskHistoryPageStorageProof;
};

function validIso(value: string | undefined): value is string {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validDigest(value: string | undefined): value is string {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/u.test(value));
}

function exactObjectKeys(value: unknown, allowed: Set<string>): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => allowed.has(key));
}

function validBoundedText(value: unknown, max: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= max
    && !ASCII_CONTROL_PATTERN.test(value)
    && value.trim() === value;
}

function validOptionalFinite(value: unknown, minimum = 0): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= minimum);
}

function sameOptional<T>(left: T | undefined, right: T | undefined): boolean {
  return left === right;
}

function normalizedText(value: unknown, max = 160): string {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_PATTERN, " ").replace(/\s+/gu, " ").trim().slice(0, max)
    : "";
}

function canonicalContractIdentity(result: TokenRiskResult): { id: string; identityClass: RiskHistoryIdentityClass } {
  const deliveryIdentity = normalizedText(result.providerRiskDelivery?.canonicalIdentity, 256).toLowerCase();
  if (/^[a-z0-9][a-z0-9:._-]{2,255}$/u.test(deliveryIdentity)
      && !deliveryIdentity.startsWith("symbol:")
      && !deliveryIdentity.startsWith("local-reference-")) {
    return { id: deliveryIdentity, identityClass: /0x[a-f0-9]{40}/u.test(deliveryIdentity) ? "CHAIN_CONTRACT" : "MARKET_ID" };
  }

  const chainId = normalizedText(result.token.chainId, 80).toLowerCase();
  const address = normalizedText(result.token.tokenAddress, 64).toLowerCase();
  if (chainId && /^0x[a-f0-9]{40}$/u.test(address)) {
    return {
      id: /^\d+$/u.test(chainId) ? `eip155:${chainId}:${address}` : `chain:${chainId}:${address}`,
      identityClass: "CHAIN_CONTRACT",
    };
  }

  const marketId = normalizedText(result.token.marketId, 160).toLowerCase();
  if (marketId) return { id: `market:${marketId}`, identityClass: "MARKET_ID" };
  return { id: `unresolved:${normalizedText(result.token.symbol, 32).toLowerCase() || "unknown"}`, identityClass: "UNRESOLVED" };
}

function snapshotSeed(snapshot: Omit<RiskHistorySnapshotRecord, "snapshotDigest">) {
  return snapshot;
}

export function buildRiskHistorySnapshot(args: {
  assetId: string;
  result: TokenRiskResult;
  observedAt?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}): RiskHistorySnapshotRecord {
  const result = args.result;
  const identity = canonicalContractIdentity(result);
  const observedAt = validIso(args.observedAt)
    ? args.observedAt
    : validIso(result.generatedAt)
      ? result.generatedAt
      : new Date().toISOString();
  const modelBinding = result.modelBinding;
  const scoreVersion = modelBinding ? riskModelBindingDigest(modelBinding) : "unversioned";
  const methodologyVersion = normalizedText(modelBinding?.scoreFormula ?? result.scoreFormula, 160) || "unversioned";
  const evidenceVersion = normalizedText(result.providerRiskDelivery?.schemaVersion, 120) || "unverified";
  const evidenceDigest = validDigest(result.providerRiskDelivery?.receiptDigest)
    ? result.providerRiskDelivery!.receiptDigest
    : validDigest(result.providerRiskDelivery?.sourceReceiptRoot)
      ? result.providerRiskDelivery!.sourceReceiptRoot
      : "unverified";
  const comparabilityKey = modelBinding
    ? sha256Digest(canonicalJson({
        modelBindingDigest: scoreVersion,
        methodologyVersion,
        evidenceVersion,
      }))
    : "unversioned";
  const publicationEligible = result.providerRiskDelivery?.state === "verified"
    && result.providerRiskDelivery.scorePublished === true
    && result.dataQuality !== "demo"
    && identity.identityClass !== "UNRESOLVED"
    && validDigest(scoreVersion)
    && validDigest(evidenceDigest)
    && validDigest(comparabilityKey);

  const unsigned: Omit<RiskHistorySnapshotRecord, "snapshotDigest"> = {
    schemaVersion: RISK_HISTORY_SNAPSHOT_SCHEMA,
    id: normalizedText(args.assetId, 200) || identity.id,
    canonicalAssetId: identity.id,
    identityClass: identity.identityClass,
    symbol: normalizedText(result.token.symbol, 32).toUpperCase() || "UNKNOWN",
    name: normalizedText(result.token.name, 160) || normalizedText(result.token.symbol, 32) || "Unknown asset",
    timestamp: observedAt,
    ...(typeof args.price === "number" && Number.isFinite(args.price) ? { price: args.price } : {}),
    ...(typeof args.marketCap === "number" && Number.isFinite(args.marketCap) ? { marketCap: args.marketCap } : {}),
    ...(typeof args.volume24h === "number" && Number.isFinite(args.volume24h) ? { volume24h: args.volume24h } : {}),
    score: Number.isFinite(result.score) ? Math.min(100, Math.max(0, Math.round(result.score))) : 0,
    level: result.level,
    signalCount: result.signals?.length ?? 0,
    ...(result.metaModel?.dominantAgent ? { dominantAgent: result.metaModel.dominantAgent } : {}),
    ...(typeof result.confidence === "number" && Number.isFinite(result.confidence)
      ? { confidence: Math.min(100, Math.max(0, result.confidence)) }
      : {}),
    publicationState: publicationEligible ? "PUBLIC" : "WITHHELD",
    customerPublishable: publicationEligible,
    methodologyVersion,
    scoreVersion,
    evidenceVersion,
    evidenceDigest,
    ...(validIso(result.providerRiskDelivery?.sourceAsOf ?? undefined)
      ? { sourceAsOf: result.providerRiskDelivery!.sourceAsOf! }
      : {}),
    comparabilityKey,
  };
  return { ...unsigned, snapshotDigest: sha256Digest(canonicalJson(snapshotSeed(unsigned))) };
}

export function verifyRiskHistorySnapshot(snapshot: RiskHistorySnapshotRecord): boolean {
  if (!exactObjectKeys(snapshot, RISK_HISTORY_SNAPSHOT_FIELDS)
      || snapshot.schemaVersion !== RISK_HISTORY_SNAPSHOT_SCHEMA
      || !validBoundedText(snapshot.id, 200)
      || !validBoundedText(snapshot.canonicalAssetId, 256)
      || !RISK_HISTORY_IDENTITY_CLASSES.has(snapshot.identityClass)
      || !validBoundedText(snapshot.symbol, 32)
      || !validBoundedText(snapshot.name, 160)
      || !validIso(snapshot.timestamp)
      || (snapshot.sourceAsOf !== undefined && !validIso(snapshot.sourceAsOf))
      || !validOptionalFinite(snapshot.price)
      || !validOptionalFinite(snapshot.marketCap)
      || !validOptionalFinite(snapshot.volume24h)
      || !Number.isInteger(snapshot.score)
      || snapshot.score < 0
      || snapshot.score > 100
      || !RISK_HISTORY_LEVELS.has(snapshot.level)
      || !Number.isInteger(snapshot.signalCount)
      || snapshot.signalCount < 0
      || (snapshot.dominantAgent !== undefined && !validBoundedText(snapshot.dominantAgent, 160))
      || !validOptionalFinite(snapshot.confidence)
      || (snapshot.confidence !== undefined && snapshot.confidence > 100)
      || !RISK_HISTORY_PUBLICATION_STATES.has(snapshot.publicationState)
      || typeof snapshot.customerPublishable !== "boolean"
      || !validBoundedText(snapshot.methodologyVersion, 160)
      || !validBoundedText(snapshot.scoreVersion, 160)
      || !validBoundedText(snapshot.evidenceVersion, 120)
      || !validBoundedText(snapshot.evidenceDigest, 160)
      || !validBoundedText(snapshot.comparabilityKey, 160)
      || !validDigest(snapshot.snapshotDigest)) return false;
  if (snapshot.customerPublishable !== (snapshot.publicationState === "PUBLIC")) return false;
  if (snapshot.customerPublishable && (
    snapshot.identityClass === "UNRESOLVED"
    || !validDigest(snapshot.scoreVersion)
    || !validDigest(snapshot.evidenceDigest)
    || !validDigest(snapshot.comparabilityKey)
  )) return false;
  const { snapshotDigest, ...unsigned } = snapshot;
  return sha256Digest(canonicalJson(snapshotSeed(unsigned))) === snapshotDigest;
}

function eventSeed(event: Omit<RiskHistoryEvent, "eventDigest">) {
  return event;
}

function eventId(snapshot: RiskHistorySnapshotRecord) {
  return `risk-history-${sha256Digest(canonicalJson({
    canonicalAssetId: snapshot.canonicalAssetId,
    observedAt: snapshot.timestamp,
  })).slice("sha256:".length, "sha256:".length + 40)}`;
}

function changeSet(previous: RiskHistoryEvent | undefined, snapshot: RiskHistorySnapshotRecord) {
  if (!previous) {
    return {
      eventTypes: ["TRACKING_STARTED"] as RiskHistoryEventType[],
      changeReasons: ["Velmère began tracking this asset at this observation."],
      comparableToPrevious: false,
    };
  }
  const eventTypes: RiskHistoryEventType[] = [];
  const reasons: string[] = [];
  if (previous.score !== snapshot.score) {
    eventTypes.push("SCORE_CHANGED");
    reasons.push(`Risk score changed from ${previous.score} to ${snapshot.score}.`);
  }
  if (previous.level !== snapshot.level) {
    eventTypes.push("LEVEL_CHANGED");
    reasons.push(`Risk level changed from ${previous.level} to ${snapshot.level}.`);
  }
  if (previous.comparabilityKey !== snapshot.comparabilityKey) {
    eventTypes.push("METHODOLOGY_CHANGED");
    reasons.push("Methodology or provider configuration changed; this starts a new comparability segment.");
  }
  if (previous.evidenceDigest !== snapshot.evidenceDigest || previous.evidenceVersion !== snapshot.evidenceVersion) {
    eventTypes.push("EVIDENCE_CHANGED");
    reasons.push("The evidence receipt bound to the score changed.");
  }
  if (previous.publicationState !== snapshot.publicationState) {
    eventTypes.push("PUBLICATION_STATE_CHANGED");
    reasons.push(snapshot.customerPublishable
      ? "The observation became eligible for customer publication."
      : "Customer publication was withheld because the evidence boundary changed.");
  }
  return {
    eventTypes,
    changeReasons: reasons,
    comparableToPrevious: previous.comparabilityKey === snapshot.comparabilityKey,
  };
}

export function decideRiskHistoryEvent(
  snapshot: RiskHistorySnapshotRecord,
  previous?: RiskHistoryEvent,
  recordedAt = snapshot.timestamp,
): RiskHistoryDecision {
  if (!verifyRiskHistorySnapshot(snapshot) || !validIso(recordedAt)) {
    return { decision: "CONFLICT", reason: "INVALID_SNAPSHOT" };
  }
  if (previous && !verifyRiskHistoryEvent(previous)) {
    return { decision: "CONFLICT", reason: "INVALID_SNAPSHOT" };
  }
  const observedMs = Date.parse(snapshot.timestamp);
  const previousMs = previous ? Date.parse(previous.observedAt) : 0;
  if (previous && observedMs < previousMs) return { decision: "CONFLICT", reason: "NON_MONOTONIC_TIME" };
  if (previous && observedMs === previousMs) {
    return previous.snapshot.snapshotDigest === snapshot.snapshotDigest
      ? { decision: "SKIP", reason: "EXACT_DUPLICATE" }
      : { decision: "CONFLICT", reason: "TIMESTAMP_COLLISION" };
  }

  const changes = changeSet(previous, snapshot);
  let reason: Extract<RiskHistoryDecision, { decision: "STORE" }>["reason"] = previous ? "MATERIAL_CHANGE" : "FIRST_EVENT";
  if (previous && changes.eventTypes.length === 0) {
    if (observedMs - previousMs < RISK_HISTORY_HEARTBEAT_MS) {
      return { decision: "SKIP", reason: "UNCHANGED_WITHIN_HEARTBEAT" };
    }
    changes.eventTypes.push("HEARTBEAT");
    changes.changeReasons.push("Daily continuity heartbeat; the score and versioned evidence remained unchanged.");
    reason = "HEARTBEAT_DUE";
  }

  const unsigned: Omit<RiskHistoryEvent, "eventDigest"> = {
    schemaVersion: RISK_HISTORY_EVENT_SCHEMA,
    eventId: eventId(snapshot),
    canonicalAssetId: snapshot.canonicalAssetId,
    assetId: snapshot.id,
    identityClass: snapshot.identityClass,
    symbol: snapshot.symbol,
    name: snapshot.name,
    observedAt: snapshot.timestamp,
    recordedAt,
    score: snapshot.score,
    level: snapshot.level,
    signalCount: snapshot.signalCount,
    ...(snapshot.confidence !== undefined ? { confidence: snapshot.confidence } : {}),
    publicationState: snapshot.publicationState,
    customerPublishable: snapshot.customerPublishable,
    methodologyVersion: snapshot.methodologyVersion,
    scoreVersion: snapshot.scoreVersion,
    evidenceVersion: snapshot.evidenceVersion,
    evidenceDigest: snapshot.evidenceDigest,
    ...(snapshot.sourceAsOf ? { sourceAsOf: snapshot.sourceAsOf } : {}),
    comparabilityKey: snapshot.comparabilityKey,
    comparableToPrevious: changes.comparableToPrevious,
    eventTypes: changes.eventTypes,
    changeReasons: changes.changeReasons,
    snapshot,
  };
  const event: RiskHistoryEvent = { ...unsigned, eventDigest: sha256Digest(canonicalJson(eventSeed(unsigned))) };
  return { decision: "STORE", reason, event };
}

export function verifyRiskHistoryEvent(event: RiskHistoryEvent): boolean {
  if (!exactObjectKeys(event, RISK_HISTORY_EVENT_FIELDS)
      || event.schemaVersion !== RISK_HISTORY_EVENT_SCHEMA
      || !/^risk-history-[a-f0-9]{40}$/u.test(event.eventId)
      || !validDigest(event.eventDigest)
      || !validIso(event.observedAt)
      || !validIso(event.recordedAt)
      || Date.parse(event.recordedAt) < Date.parse(event.observedAt)
      || !validBoundedText(event.canonicalAssetId, 256)
      || !validBoundedText(event.assetId, 200)
      || !RISK_HISTORY_IDENTITY_CLASSES.has(event.identityClass)
      || !validBoundedText(event.symbol, 32)
      || !validBoundedText(event.name, 160)
      || !Number.isInteger(event.score)
      || event.score < 0
      || event.score > 100
      || !RISK_HISTORY_LEVELS.has(event.level)
      || !Number.isInteger(event.signalCount)
      || event.signalCount < 0
      || !validOptionalFinite(event.confidence)
      || (event.confidence !== undefined && event.confidence > 100)
      || !RISK_HISTORY_PUBLICATION_STATES.has(event.publicationState)
      || typeof event.customerPublishable !== "boolean"
      || !validBoundedText(event.methodologyVersion, 160)
      || !validBoundedText(event.scoreVersion, 160)
      || !validBoundedText(event.evidenceVersion, 120)
      || !validBoundedText(event.evidenceDigest, 160)
      || (event.sourceAsOf !== undefined && !validIso(event.sourceAsOf))
      || !validBoundedText(event.comparabilityKey, 160)
      || typeof event.comparableToPrevious !== "boolean"
      || !Array.isArray(event.eventTypes)
      || event.eventTypes.length < 1
      || event.eventTypes.length > RISK_HISTORY_EVENT_TYPES.size
      || new Set(event.eventTypes).size !== event.eventTypes.length
      || !event.eventTypes.every((type) => RISK_HISTORY_EVENT_TYPES.has(type))
      || !Array.isArray(event.changeReasons)
      || event.changeReasons.length < 1
      || event.changeReasons.length > RISK_HISTORY_EVENT_TYPES.size
      || new Set(event.changeReasons).size !== event.changeReasons.length
      || !event.changeReasons.every((reason) => validBoundedText(reason, 240))
      || !verifyRiskHistorySnapshot(event.snapshot)
      || event.eventId !== eventId(event.snapshot)
      || event.canonicalAssetId !== event.snapshot.canonicalAssetId
      || event.assetId !== event.snapshot.id
      || event.identityClass !== event.snapshot.identityClass
      || event.symbol !== event.snapshot.symbol
      || event.name !== event.snapshot.name
      || event.observedAt !== event.snapshot.timestamp
      || event.score !== event.snapshot.score
      || event.level !== event.snapshot.level
      || event.signalCount !== event.snapshot.signalCount
      || !sameOptional(event.confidence, event.snapshot.confidence)
      || event.publicationState !== event.snapshot.publicationState
      || event.customerPublishable !== event.snapshot.customerPublishable
      || event.methodologyVersion !== event.snapshot.methodologyVersion
      || event.scoreVersion !== event.snapshot.scoreVersion
      || event.evidenceVersion !== event.snapshot.evidenceVersion
      || event.evidenceDigest !== event.snapshot.evidenceDigest
      || !sameOptional(event.sourceAsOf, event.snapshot.sourceAsOf)
      || event.comparabilityKey !== event.snapshot.comparabilityKey) return false;
  const { eventDigest, ...unsigned } = event;
  return sha256Digest(canonicalJson(eventSeed(unsigned))) === eventDigest;
}

function customerSafeChangeReasons(event: RiskHistoryEvent): string[] {
  const reasons: string[] = [];
  for (const type of event.eventTypes) {
    if (type === "TRACKING_STARTED") reasons.push("Velmère began verified tracking for this asset.");
    else if (type === "SCORE_CHANGED") reasons.push("The version-bound descriptive risk score changed.");
    else if (type === "LEVEL_CHANGED") reasons.push("The descriptive risk level changed.");
    else if (type === "METHODOLOGY_CHANGED") reasons.push("Methodology or provider configuration changed; this starts a new comparability segment.");
    else if (type === "EVIDENCE_CHANGED") reasons.push("The evidence receipt bound to the observation changed.");
    else if (type === "PUBLICATION_STATE_CHANGED") reasons.push("The observation became eligible for customer publication.");
    else if (type === "HEARTBEAT") reasons.push("A bounded continuity heartbeat confirmed no material score or version change.");
  }
  return Array.from(new Set(reasons));
}

export function buildCustomerRiskHistoryProjection(args: {
  requestedId: string;
  events: RiskHistoryEvent[];
  storage: CustomerSafeRiskLedgerStatus;
  limit?: number;
}): CustomerRiskHistoryProjection {
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 144), 1), 500);
  const valid = args.events
    .filter(verifyRiskHistoryEvent)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const publicEvents = valid.filter((event) => event.customerPublishable && event.publicationState === "PUBLIC").slice(-limit);
  const firstPublic = publicEvents[0];
  const segments: CustomerRiskHistoryProjection["segments"] = [];
  for (const event of publicEvents) {
    const last = segments.at(-1);
    if (!last || last.comparabilityKey !== event.comparabilityKey) {
      segments.push({
        comparabilityKey: event.comparabilityKey,
        methodologyVersion: event.methodologyVersion,
        scoreVersion: event.scoreVersion,
        evidenceVersion: event.evidenceVersion,
        comparableWithPreviousSegment: segments.length > 0 && event.comparableToPrevious,
        startedAt: event.observedAt,
        endedAt: event.observedAt,
      });
    } else {
      last.endedAt = event.observedAt;
    }
  }

  const status: CustomerRiskHistoryProjection["status"] = publicEvents.length
    ? "AVAILABLE"
    : valid.length
      ? "WITHHELD"
      : "EMPTY";
  return {
    schemaVersion: RISK_HISTORY_CUSTOMER_SCHEMA,
    productId: "risk-indicator",
    capability: "risk-history",
    status,
    asset: {
      canonicalAssetId: firstPublic?.canonicalAssetId ?? null,
      symbol: firstPublic?.symbol ?? null,
      name: firstPublic?.name ?? null,
    },
    trackingStartedAt: firstPublic?.observedAt ?? null,
    observations: publicEvents.length,
    segments,
    history: publicEvents.map((event) => ({
      eventReference: event.eventDigest,
      observedAt: event.observedAt,
      score: event.score,
      level: event.level,
      confidence: event.confidence ?? null,
      eventTypes: [...event.eventTypes],
      changeReasons: customerSafeChangeReasons(event),
      methodologyVersion: event.methodologyVersion,
      scoreVersion: event.scoreVersion,
      evidenceVersion: event.evidenceVersion,
      comparabilityKey: event.comparabilityKey,
      comparableToPrevious: event.comparableToPrevious,
      isProbability: false,
      probabilityPercent: null,
    })),
    storage: args.storage,
    limitations: [
      "Risk history begins when Velmère starts verified tracking; it is not reconstructed before that date.",
      "The score is a descriptive review-priority signal, not a probability, price forecast or trade instruction.",
      "A methodology or provider-configuration change starts a new segment when old and new scores are not directly comparable.",
      ...(status === "WITHHELD" ? ["Stored observations exist, but none currently satisfy the customer publication boundary."] : []),
      ...(args.storage.storageState !== "DURABLE_VERIFIED" ? ["Multi-year durable history is not yet verified by an exact database read-back proof."] : []),
    ],
  };
}

export function buildRiskHistoryPageEvidenceDigest(args: {
  pageSource: "DATABASE" | "MEMORY";
  resolution: "RESOLVED" | "EMPTY";
  canonicalAssetId: string | null;
  requestBinding: RiskHistoryCustomerRequestBinding;
  page: RiskHistoryPublicPage;
  events: Array<{ eventReference: string; observedAt: string }>;
}): string {
  if ((args.pageSource !== "DATABASE" && args.pageSource !== "MEMORY")
      || (args.resolution !== "RESOLVED" && args.resolution !== "EMPTY")
      || !validPublicPage(args.page, args.requestBinding.requestedLimit)
      || args.page.before !== args.requestBinding.before
      || !verifyRiskHistoryCustomerRequestBindingShape(args.requestBinding)) {
    throw new Error("risk_history_page_evidence_input_invalid");
  }
  if (args.resolution === "EMPTY") {
    if (args.canonicalAssetId !== null || args.events.length !== 0 || args.page.hasOlder || args.page.nextBefore !== null) {
      throw new Error("risk_history_empty_page_evidence_invalid");
    }
  } else if (!validBoundedText(args.canonicalAssetId, 256) || args.events.length < 1) {
    throw new Error("risk_history_resolved_page_evidence_invalid");
  }
  if (args.events.length > args.page.requestedLimit
      || (args.page.hasOlder && args.events.length !== args.page.requestedLimit)) {
    throw new Error("risk_history_page_event_count_invalid");
  }
  const seen = new Set<string>();
  let previous = -Infinity;
  for (const event of args.events) {
    if (!validDigest(event.eventReference) || !validIso(event.observedAt)) {
      throw new Error("risk_history_page_event_reference_invalid");
    }
    const timestamp = Date.parse(event.observedAt);
    if (timestamp <= previous || seen.has(event.eventReference)) {
      throw new Error("risk_history_page_event_sequence_invalid");
    }
    if (args.page.before !== null && timestamp >= Date.parse(args.page.before)) {
      throw new Error("risk_history_page_event_cursor_invalid");
    }
    previous = timestamp;
    seen.add(event.eventReference);
  }
  if (args.resolution === "RESOLVED" && args.page.hasOlder
      && args.page.nextBefore !== args.events[0]?.observedAt) {
    throw new Error("risk_history_page_next_cursor_invalid");
  }
  return sha256Digest(canonicalJson({
    schemaVersion: RISK_HISTORY_PAGE_EVIDENCE_SCHEMA,
    pageSource: args.pageSource,
    resolution: args.resolution,
    canonicalAssetId: args.canonicalAssetId,
    requestBinding: args.requestBinding,
    page: args.page,
    events: args.events,
  }));
}

export function buildCustomerSafeRiskHistoryPageStorageProof(args: {
  pageSource: "DATABASE" | "MEMORY";
  resolution: "RESOLVED" | "EMPTY";
  canonicalAssetId: string | null;
  requestBinding: RiskHistoryCustomerRequestBinding;
  page: RiskHistoryPublicPage;
  events: Array<{ eventReference: string; observedAt: string }>;
}): CustomerSafeRiskHistoryPageStorageProof {
  const database = args.pageSource === "DATABASE";
  return {
    schemaVersion: RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA,
    pageSource: args.pageSource,
    pageReadState: database ? "DATABASE_PAGE_RESPONSE_VERIFIED" : "RUNTIME_PAGE_ONLY",
    pageIntegrityVerified: true,
    durableRetentionClaimed: false,
    backupRestoreProven: false,
    pageEvidenceDigest: buildRiskHistoryPageEvidenceDigest(args),
    blockers: database
      ? ["multi_year_retention_not_proven", "backup_restore_not_proven"]
      : ["database_page_read_not_verified", "multi_year_retention_not_proven", "backup_restore_not_proven"],
  };
}

function validPublicPage(page: RiskHistoryPublicPage, limit: number): boolean {
  if (!Number.isInteger(page.requestedLimit) || page.requestedLimit !== limit || limit < 1 || limit > 144) return false;
  if (page.before !== null && !validIso(page.before)) return false;
  if (typeof page.hasOlder !== "boolean") return false;
  if (page.nextBefore !== null && !validIso(page.nextBefore)) return false;
  return page.hasOlder ? page.nextBefore !== null : page.nextBefore === null;
}

function emptyPublicRiskHistoryProjection(
  storage: CustomerSafeRiskHistoryPageStorageProof,
  page: RiskHistoryPublicPage,
): PublicCustomerRiskHistoryProjection {
  return {
    schemaVersion: RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA,
    productId: "risk-indicator",
    capability: "risk-history",
    status: "EMPTY",
    asset: { canonicalAssetId: null, symbol: null, name: null },
    trackingStartedAt: null,
    observations: 0,
    segments: [],
    history: [],
    window: {
      schemaVersion: RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA,
      requestedLimit: page.requestedLimit,
      before: page.before,
      returnedObservations: 0,
      hasOlder: false,
      nextBefore: null,
      isLatestWindow: page.before === null,
      reachesTrackingStart: false,
      completeVisibleHistory: false,
      oldestIncludedAt: null,
      newestIncludedAt: null,
    },
    storage,
    limitations: [
      "No customer-publishable risk history is available for this request.",
      "The score is a descriptive review-priority signal, not a probability, price forecast or trade instruction.",
      "Multi-year retention and backup restoration are not claimed by this bounded page read.",
    ],
  };
}

/**
 * Public route projection with canonical identity isolation, public-only
 * pagination and non-enumerating empty behavior. Internal EMPTY, AMBIGUOUS,
 * private-only and exhausted invalid requests are deliberately
 * indistinguishable at this boundary.
 */
export function buildPublicCustomerRiskHistoryProjection(args: {
  requestedId: string;
  resolution: "RESOLVED" | "EMPTY";
  canonicalAssetId: string | null;
  events: RiskHistoryEvent[];
  requestBinding: RiskHistoryPublicRequestBinding;
  page: RiskHistoryPublicPage;
  storage: CustomerSafeRiskHistoryPageStorageProof;
  limit?: number;
}): PublicCustomerRiskHistoryProjection {
  const limit = args.limit ?? 144;
  if (!validPublicPage(args.page, limit)) throw new Error("risk_history_public_page_invalid");
  if (args.resolution !== "RESOLVED") {
    if (args.canonicalAssetId !== null || args.events.length !== 0 || args.page.hasOlder || args.page.nextBefore !== null
        || args.requestBinding.schemaVersion !== "velmere.risk-history-public-request-binding.v1"
        || args.requestBinding.requestedId !== args.requestedId.trim().toLowerCase()
        || args.requestBinding.resolutionKind !== null) {
      throw new Error("risk_history_nonresolved_payload_invalid");
    }
    return emptyPublicRiskHistoryProjection(args.storage, args.page);
  }
  if (!args.canonicalAssetId || args.events.length < 1 || args.events.length > limit) {
    throw new Error("risk_history_resolved_payload_incomplete");
  }
  if (!args.events.every(verifyRiskHistoryEvent)) throw new Error("risk_history_public_event_integrity_invalid");

  const canonicalLower = args.canonicalAssetId.toLowerCase();
  const requestLower = args.requestedId.trim().toLowerCase();
  if (args.requestBinding.schemaVersion !== "velmere.risk-history-public-request-binding.v1"
      || args.requestBinding.requestedId !== requestLower
      || args.requestBinding.resolutionKind === null
      || (args.requestBinding.resolutionKind === "CANONICAL" && requestLower !== canonicalLower)) {
    throw new Error("risk_history_public_request_identity_unbound");
  }
  const eventIds = new Set<string>();
  const eventDigests = new Set<string>();
  let previousObservedAt = -1;
  for (const event of args.events) {
    if (!event.customerPublishable || event.publicationState !== "PUBLIC") {
      throw new Error("risk_history_nonpublic_event_crossed_boundary");
    }
    if (event.canonicalAssetId.toLowerCase() !== canonicalLower) throw new Error("risk_history_public_identity_mix");
    if (eventIds.has(event.eventId) || eventDigests.has(event.eventDigest)) throw new Error("risk_history_public_duplicate_event");
    eventIds.add(event.eventId);
    eventDigests.add(event.eventDigest);
    const observedAt = Date.parse(event.observedAt);
    if (observedAt <= previousObservedAt) throw new Error("risk_history_public_order_invalid");
    if (args.page.before !== null && observedAt >= Date.parse(args.page.before)) {
      throw new Error("risk_history_public_cursor_boundary_invalid");
    }
    previousObservedAt = observedAt;
  }
  const firstPublic = args.events[0]!;
  const latestPublic = args.events.at(-1)!;
  if (args.page.hasOlder && args.page.nextBefore !== firstPublic.observedAt) {
    throw new Error("risk_history_public_next_cursor_invalid");
  }
  const reachesTrackingStart = !args.page.hasOlder;
  const completeVisibleHistory = args.page.before === null && reachesTrackingStart;
  const segments: PublicCustomerRiskHistoryProjection["segments"] = [];
  for (const event of args.events) {
    const last = segments.at(-1);
    if (!last || last.comparabilityKey !== event.comparabilityKey) {
      segments.push({
        comparabilityKey: event.comparabilityKey,
        methodologyVersion: event.methodologyVersion,
        scoreVersion: event.scoreVersion,
        evidenceVersion: event.evidenceVersion,
        comparableWithPreviousSegment: segments.length > 0 && event.comparableToPrevious,
        startedAt: event.observedAt,
        endedAt: event.observedAt,
      });
    } else {
      last.endedAt = event.observedAt;
    }
  }

  return {
    schemaVersion: RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA,
    productId: "risk-indicator",
    capability: "risk-history",
    status: "AVAILABLE",
    asset: {
      canonicalAssetId: firstPublic.canonicalAssetId,
      symbol: firstPublic.symbol,
      name: firstPublic.name,
    },
    trackingStartedAt: reachesTrackingStart ? firstPublic.observedAt : null,
    observations: args.events.length,
    segments,
    history: args.events.map((event) => ({
      eventReference: event.eventDigest,
      observedAt: event.observedAt,
      score: event.score,
      level: event.level,
      confidence: event.confidence ?? null,
      eventTypes: [...event.eventTypes],
      changeReasons: customerSafeChangeReasons(event),
      methodologyVersion: event.methodologyVersion,
      scoreVersion: event.scoreVersion,
      evidenceVersion: event.evidenceVersion,
      comparabilityKey: event.comparabilityKey,
      comparableToPrevious: event.comparableToPrevious,
      isProbability: false,
      probabilityPercent: null,
    })),
    window: {
      schemaVersion: RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA,
      requestedLimit: args.page.requestedLimit,
      before: args.page.before,
      returnedObservations: args.events.length,
      hasOlder: args.page.hasOlder,
      nextBefore: args.page.nextBefore,
      isLatestWindow: args.page.before === null,
      reachesTrackingStart,
      completeVisibleHistory,
      oldestIncludedAt: firstPublic.observedAt,
      newestIncludedAt: latestPublic.observedAt,
    },
    storage: args.storage,
    limitations: [
      reachesTrackingStart
        ? "Customer-visible history begins with the earliest publishable observation returned by Velmère; no earlier internal tracking is implied."
        : "This is a bounded customer-visible window; older public observations require explicit pagination.",
      "The score is a descriptive review-priority signal, not a probability, price forecast or trade instruction.",
      "A methodology or provider-configuration change starts a new segment when old and new scores are not directly comparable.",
      "Multi-year retention and backup restoration are not claimed by this bounded page read.",
    ],
  };
}
