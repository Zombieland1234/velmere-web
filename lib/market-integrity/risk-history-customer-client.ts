import {
  fetchSameOriginWithDeadline,
  readJsonResponseBounded,
} from "@/lib/network/fetch-with-deadline";
import { ASCII_CONTROL_PATTERN } from "@/lib/security/ascii-control-characters";
import {
  buildRiskHistoryPageEvidenceDigest,
  RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA,
  type PublicCustomerRiskHistoryProjection,
  type RiskHistoryEventType,
} from "./risk-history-contract";
import {
  verifyRiskHistoryCustomerRequestBinding,
  verifyRiskHistoryCustomerRequestBindingShape,
  type RiskHistoryCustomerRequestBinding,
  type RiskHistoryCustomerRequestIdentity,
} from "./risk-history-customer-request-binding";
import type { RiskLevel } from "./risk-types";

export const RISK_HISTORY_CUSTOMER_ROUTE_SCHEMA = "velmere.risk-history.customer-route.v3" as const;
export const RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA = "velmere.risk-history.customer.v3" as const;
export const RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA = "velmere.risk-history.customer-window.v1" as const;
export const RISK_HISTORY_CUSTOMER_MAX_EVENTS = 144;
export const RISK_HISTORY_CUSTOMER_MAX_MERGED_EVENTS = 5_000;
export const RISK_HISTORY_CUSTOMER_MAX_RESPONSE_BYTES = 512 * 1024;
export const RISK_HISTORY_CUSTOMER_FETCH_TIMEOUT_MS = 6_000;

const ASSET_ID = /^[a-zA-Z0-9:._-]{1,256}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const RISK_LEVELS = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const EVENT_TYPES = new Set<RiskHistoryEventType>([
  "TRACKING_STARTED",
  "SCORE_CHANGED",
  "LEVEL_CHANGED",
  "METHODOLOGY_CHANGED",
  "EVIDENCE_CHANGED",
  "PUBLICATION_STATE_CHANGED",
  "HEARTBEAT",
]);
const PAGE_SOURCES: ReadonlySet<string> = new Set(["DATABASE", "MEMORY"]);
const PAGE_READ_STATES: ReadonlySet<string> = new Set(["DATABASE_PAGE_RESPONSE_VERIFIED", "RUNTIME_PAGE_ONLY"]);
const PAGE_STORAGE_BLOCKERS = new Set([
  "database_page_read_not_verified",
  "multi_year_retention_not_proven",
  "backup_restore_not_proven",
]);

export type RiskHistoryCustomerRoutePayload = {
  schemaVersion: typeof RISK_HISTORY_CUSTOMER_ROUTE_SCHEMA;
  mode: "stored";
  requestBinding: RiskHistoryCustomerRequestBinding;
  publication: {
    evidenceState: "verified" | "withheld";
    liveClaimed: false;
    currentness: "event_observation_time_bound" | "unavailable";
  };
  riskHistory: PublicCustomerRiskHistoryProjection;
  generatedAt: string;
};

export type RiskHistoryCustomerMergedView = {
  asset: PublicCustomerRiskHistoryProjection["asset"];
  history: PublicCustomerRiskHistoryProjection["history"];
  segments: PublicCustomerRiskHistoryProjection["segments"];
  trackingStartedAt: string | null;
  observations: number;
  loadedPages: number;
  hasOlder: boolean;
  nextBefore: string | null;
  completeVisibleHistory: boolean;
};

export class RiskHistoryCustomerBoundaryError extends Error {
  readonly code:
    | "invalid_asset_identity"
    | "invalid_limit"
    | "invalid_cursor"
    | "request_failed"
    | "invalid_customer_projection"
    | "incompatible_history_pages";

  constructor(code: RiskHistoryCustomerBoundaryError["code"]) {
    super(code);
    this.name = "RiskHistoryCustomerBoundaryError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
}

function safeString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string"
    && value.length <= max
    && (allowEmpty || value.length > 0)
    && !ASCII_CONTROL_PATTERN.test(value);
}

function nullableSafeString(value: unknown, max: number): value is string | null {
  return value === null || safeString(value, max);
}

function iso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function nullableIso(value: unknown): value is string | null {
  return value === null || iso(value);
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function digest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const output: string[] = [];
  for (const item of value) {
    if (!safeString(item, maxLength)) return null;
    output.push(item);
  }
  return output;
}

function parseEventTypes(value: unknown): RiskHistoryEventType[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > EVENT_TYPES.size) return null;
  const output: RiskHistoryEventType[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !EVENT_TYPES.has(item as RiskHistoryEventType)) return null;
    if (output.includes(item as RiskHistoryEventType)) return null;
    output.push(item as RiskHistoryEventType);
  }
  return output;
}

function parseHistoryRow(value: unknown): PublicCustomerRiskHistoryProjection["history"][number] | null {
  if (!isRecord(value) || !exactKeys(value, [
    "eventReference",
    "observedAt",
    "score",
    "level",
    "confidence",
    "eventTypes",
    "changeReasons",
    "methodologyVersion",
    "scoreVersion",
    "evidenceVersion",
    "comparabilityKey",
    "comparableToPrevious",
    "isProbability",
    "probabilityPercent",
  ])) return null;
  if (!digest(value.eventReference)
      || !iso(value.observedAt)
      || !integer(value.score, 0, 100)
      || typeof value.level !== "string"
      || !RISK_LEVELS.has(value.level as RiskLevel)
      || !(value.confidence === null || finite(value.confidence, 0, 100))
      || !safeString(value.methodologyVersion, 160)
      || !digest(value.scoreVersion)
      || !safeString(value.evidenceVersion, 160)
      || !digest(value.comparabilityKey)
      || typeof value.comparableToPrevious !== "boolean"
      || value.isProbability !== false
      || value.probabilityPercent !== null) return null;
  const eventTypes = parseEventTypes(value.eventTypes);
  const changeReasons = parseStringArray(value.changeReasons, 8, 240);
  if (!eventTypes || !changeReasons || changeReasons.length < 1) return null;
  return {
    eventReference: value.eventReference,
    observedAt: value.observedAt,
    score: value.score,
    level: value.level as RiskLevel,
    confidence: value.confidence,
    eventTypes,
    changeReasons,
    methodologyVersion: value.methodologyVersion,
    scoreVersion: value.scoreVersion,
    evidenceVersion: value.evidenceVersion,
    comparabilityKey: value.comparabilityKey,
    comparableToPrevious: value.comparableToPrevious,
    isProbability: false,
    probabilityPercent: null,
  };
}

function parseSegment(value: unknown): PublicCustomerRiskHistoryProjection["segments"][number] | null {
  if (!isRecord(value) || !exactKeys(value, [
    "comparabilityKey",
    "methodologyVersion",
    "scoreVersion",
    "evidenceVersion",
    "comparableWithPreviousSegment",
    "startedAt",
    "endedAt",
  ])) return null;
  if (!digest(value.comparabilityKey)
      || !safeString(value.methodologyVersion, 160)
      || !digest(value.scoreVersion)
      || !safeString(value.evidenceVersion, 160)
      || typeof value.comparableWithPreviousSegment !== "boolean"
      || !iso(value.startedAt)
      || !iso(value.endedAt)
      || Date.parse(value.endedAt) < Date.parse(value.startedAt)) return null;
  return {
    comparabilityKey: value.comparabilityKey,
    methodologyVersion: value.methodologyVersion,
    scoreVersion: value.scoreVersion,
    evidenceVersion: value.evidenceVersion,
    comparableWithPreviousSegment: value.comparableWithPreviousSegment,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
  };
}

function buildSegments(
  history: PublicCustomerRiskHistoryProjection["history"],
): PublicCustomerRiskHistoryProjection["segments"] {
  const segments: PublicCustomerRiskHistoryProjection["segments"] = [];
  for (const row of history) {
    const last = segments.at(-1);
    if (!last || last.comparabilityKey !== row.comparabilityKey) {
      segments.push({
        comparabilityKey: row.comparabilityKey,
        methodologyVersion: row.methodologyVersion,
        scoreVersion: row.scoreVersion,
        evidenceVersion: row.evidenceVersion,
        comparableWithPreviousSegment: segments.length > 0 && row.comparableToPrevious,
        startedAt: row.observedAt,
        endedAt: row.observedAt,
      });
    } else {
      last.endedAt = row.observedAt;
    }
  }
  return segments;
}

function sameSegments(
  left: PublicCustomerRiskHistoryProjection["segments"],
  right: PublicCustomerRiskHistoryProjection["segments"],
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseWindow(value: unknown, status: PublicCustomerRiskHistoryProjection["status"], observations: number) {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion",
    "requestedLimit",
    "before",
    "returnedObservations",
    "hasOlder",
    "nextBefore",
    "isLatestWindow",
    "reachesTrackingStart",
    "completeVisibleHistory",
    "oldestIncludedAt",
    "newestIncludedAt",
  ])) return null;
  if (value.schemaVersion !== RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA
      || !integer(value.requestedLimit, 1, RISK_HISTORY_CUSTOMER_MAX_EVENTS)
      || !nullableIso(value.before)
      || value.returnedObservations !== observations
      || typeof value.hasOlder !== "boolean"
      || !nullableIso(value.nextBefore)
      || typeof value.isLatestWindow !== "boolean"
      || typeof value.reachesTrackingStart !== "boolean"
      || typeof value.completeVisibleHistory !== "boolean"
      || !nullableIso(value.oldestIncludedAt)
      || !nullableIso(value.newestIncludedAt)) return null;
  if (value.isLatestWindow !== (value.before === null)
      || value.hasOlder !== (value.nextBefore !== null)
      || (value.hasOlder && observations !== value.requestedLimit)
      || value.completeVisibleHistory !== (status === "AVAILABLE" && value.isLatestWindow && value.reachesTrackingStart)) return null;
  if (status === "AVAILABLE") {
    if (observations < 1 || value.oldestIncludedAt === null || value.newestIncludedAt === null) return null;
    if (value.hasOlder && value.nextBefore !== value.oldestIncludedAt) return null;
    if (value.before !== null && Date.parse(value.newestIncludedAt) >= Date.parse(value.before)) return null;
  } else if (value.oldestIncludedAt !== null || value.newestIncludedAt !== null
      || value.hasOlder || value.nextBefore !== null || value.reachesTrackingStart || value.completeVisibleHistory) return null;
  return {
    schemaVersion: RISK_HISTORY_CUSTOMER_WINDOW_SCHEMA,
    requestedLimit: value.requestedLimit,
    before: value.before,
    returnedObservations: value.returnedObservations,
    hasOlder: value.hasOlder,
    nextBefore: value.nextBefore,
    isLatestWindow: value.isLatestWindow,
    reachesTrackingStart: value.reachesTrackingStart,
    completeVisibleHistory: value.completeVisibleHistory,
    oldestIncludedAt: value.oldestIncludedAt,
    newestIncludedAt: value.newestIncludedAt,
  } as PublicCustomerRiskHistoryProjection["window"];
}

function parseProjection(
  value: unknown,
  requestBinding: RiskHistoryCustomerRequestBinding,
): PublicCustomerRiskHistoryProjection | null {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion",
    "productId",
    "capability",
    "status",
    "asset",
    "trackingStartedAt",
    "observations",
    "segments",
    "history",
    "window",
    "storage",
    "limitations",
  ])) return null;
  if (value.schemaVersion !== RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA
      || value.productId !== "risk-indicator"
      || value.capability !== "risk-history"
      || (value.status !== "AVAILABLE" && value.status !== "EMPTY")
      || !nullableIso(value.trackingStartedAt)
      || !integer(value.observations, 0, RISK_HISTORY_CUSTOMER_MAX_EVENTS)
      || !Array.isArray(value.segments)
      || value.segments.length > RISK_HISTORY_CUSTOMER_MAX_EVENTS
      || !Array.isArray(value.history)
      || value.history.length > RISK_HISTORY_CUSTOMER_MAX_EVENTS) return null;

  if (!isRecord(value.asset) || !exactKeys(value.asset, ["canonicalAssetId", "symbol", "name"])
      || !nullableSafeString(value.asset.canonicalAssetId, 256)
      || !nullableSafeString(value.asset.symbol, 32)
      || !nullableSafeString(value.asset.name, 160)) return null;

  const segments = value.segments.map(parseSegment);
  const history = value.history.map(parseHistoryRow);
  if (segments.some((item) => item === null) || history.some((item) => item === null)) return null;
  const parsedSegments = segments as PublicCustomerRiskHistoryProjection["segments"];
  const parsedHistory = history as PublicCustomerRiskHistoryProjection["history"];
  if (parsedHistory.length !== value.observations) return null;
  if ((value.status === "AVAILABLE") !== (parsedHistory.length > 0)) return null;

  const seenEvents = new Set<string>();
  let previousTime = -Infinity;
  for (const row of parsedHistory) {
    const time = Date.parse(row.observedAt);
    if (time <= previousTime || seenEvents.has(row.eventReference)) return null;
    previousTime = time;
    seenEvents.add(row.eventReference);
  }
  const expectedSegments = buildSegments(parsedHistory);
  if (!sameSegments(parsedSegments, expectedSegments)) return null;

  const window = parseWindow(value.window, value.status, parsedHistory.length);
  if (!window) return null;
  if (value.status === "AVAILABLE") {
    if (value.asset.canonicalAssetId === null || value.asset.symbol === null || value.asset.name === null
        || window.oldestIncludedAt !== parsedHistory[0]?.observedAt
        || window.newestIncludedAt !== parsedHistory.at(-1)?.observedAt
        || (window.reachesTrackingStart ? value.trackingStartedAt !== parsedHistory[0]?.observedAt : value.trackingStartedAt !== null)) return null;
  } else if (value.trackingStartedAt !== null || value.asset.canonicalAssetId !== null
      || value.asset.symbol !== null || value.asset.name !== null || parsedSegments.length !== 0) return null;

  if (!isRecord(value.storage) || !exactKeys(value.storage, [
    "schemaVersion",
    "pageSource",
    "pageReadState",
    "pageIntegrityVerified",
    "durableRetentionClaimed",
    "backupRestoreProven",
    "pageEvidenceDigest",
    "blockers",
  ])
      || value.storage.schemaVersion !== RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA
      || typeof value.storage.pageSource !== "string"
      || !PAGE_SOURCES.has(value.storage.pageSource)
      || typeof value.storage.pageReadState !== "string"
      || !PAGE_READ_STATES.has(value.storage.pageReadState)
      || value.storage.pageIntegrityVerified !== true
      || value.storage.durableRetentionClaimed !== false
      || value.storage.backupRestoreProven !== false
      || !digest(value.storage.pageEvidenceDigest)) return null;
  const blockers = parseStringArray(value.storage.blockers, 3, 80);
  if (!blockers || blockers.some((item) => !PAGE_STORAGE_BLOCKERS.has(item))) return null;
  const expectedBlockers = value.storage.pageSource === "DATABASE"
    ? ["multi_year_retention_not_proven", "backup_restore_not_proven"]
    : ["database_page_read_not_verified", "multi_year_retention_not_proven", "backup_restore_not_proven"];
  const storageContract = value.storage.pageSource === "DATABASE"
    ? value.storage.pageReadState === "DATABASE_PAGE_RESPONSE_VERIFIED"
    : value.storage.pageReadState === "RUNTIME_PAGE_ONLY";
  if (!storageContract || JSON.stringify(blockers) !== JSON.stringify(expectedBlockers)) return null;
  let expectedPageEvidenceDigest: string;
  try {
    expectedPageEvidenceDigest = buildRiskHistoryPageEvidenceDigest({
      pageSource: value.storage.pageSource as "DATABASE" | "MEMORY",
      resolution: value.status === "AVAILABLE" ? "RESOLVED" : "EMPTY",
      canonicalAssetId: value.status === "AVAILABLE" ? value.asset.canonicalAssetId : null,
      requestBinding,
      page: {
        requestedLimit: window.requestedLimit,
        before: window.before,
        hasOlder: window.hasOlder,
        nextBefore: window.nextBefore,
      },
      events: parsedHistory.map((row) => ({
        eventReference: row.eventReference,
        observedAt: row.observedAt,
      })),
    });
  } catch {
    return null;
  }
  if (expectedPageEvidenceDigest !== value.storage.pageEvidenceDigest) return null;

  const limitations = parseStringArray(value.limitations, 8, 320);
  if (!limitations || limitations.length < 2) return null;

  return {
    schemaVersion: RISK_HISTORY_PUBLIC_CUSTOMER_SCHEMA,
    productId: "risk-indicator",
    capability: "risk-history",
    status: value.status,
    asset: {
      canonicalAssetId: value.asset.canonicalAssetId,
      symbol: value.asset.symbol,
      name: value.asset.name,
    },
    trackingStartedAt: value.trackingStartedAt,
    observations: value.observations,
    segments: parsedSegments,
    history: parsedHistory,
    window,
    storage: {
      schemaVersion: RISK_HISTORY_PAGE_STORAGE_PROOF_SCHEMA,
      pageSource: value.storage.pageSource as PublicCustomerRiskHistoryProjection["storage"]["pageSource"],
      pageReadState: value.storage.pageReadState as PublicCustomerRiskHistoryProjection["storage"]["pageReadState"],
      pageIntegrityVerified: true,
      durableRetentionClaimed: false,
      backupRestoreProven: false,
      pageEvidenceDigest: value.storage.pageEvidenceDigest,
      blockers: blockers as PublicCustomerRiskHistoryProjection["storage"]["blockers"],
    },
    limitations,
  };
}

export function buildRiskHistoryCustomerPath(
  assetId: string,
  limit = RISK_HISTORY_CUSTOMER_MAX_EVENTS,
  before: string | null = null,
): string {
  const clean = assetId.trim();
  if (!ASSET_ID.test(clean)) throw new RiskHistoryCustomerBoundaryError("invalid_asset_identity");
  if (!Number.isInteger(limit) || limit < 1 || limit > RISK_HISTORY_CUSTOMER_MAX_EVENTS) {
    throw new RiskHistoryCustomerBoundaryError("invalid_limit");
  }
  if (before !== null && !iso(before)) throw new RiskHistoryCustomerBoundaryError("invalid_cursor");
  const query = new URLSearchParams({ id: clean, limit: String(limit) });
  if (before !== null) query.set("before", before);
  return `/api/market-integrity/history?${query.toString()}`;
}

export function parseRiskHistoryCustomerPayload(
  input: unknown,
  expectedRequest: RiskHistoryCustomerRequestIdentity,
): RiskHistoryCustomerRoutePayload {
  if (!isRecord(input) || !exactKeys(input, ["schemaVersion", "mode", "requestBinding", "publication", "riskHistory", "generatedAt"])) {
    throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  }
  if (input.schemaVersion !== RISK_HISTORY_CUSTOMER_ROUTE_SCHEMA || input.mode !== "stored" || !iso(input.generatedAt)
      || !verifyRiskHistoryCustomerRequestBinding(input.requestBinding, expectedRequest)) {
    throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  }
  const requestBinding = input.requestBinding;
  if (!isRecord(input.publication) || !exactKeys(input.publication, ["evidenceState", "liveClaimed", "currentness"])
      || (input.publication.evidenceState !== "verified" && input.publication.evidenceState !== "withheld")
      || input.publication.liveClaimed !== false
      || (input.publication.currentness !== "event_observation_time_bound" && input.publication.currentness !== "unavailable")) {
    throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  }
  const riskHistory = parseProjection(input.riskHistory, requestBinding);
  if (!riskHistory) throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  const available = riskHistory.status === "AVAILABLE";
  const lastObservation = riskHistory.history.at(-1)?.observedAt ?? null;
  if (lastObservation && Date.parse(lastObservation) > Date.parse(input.generatedAt)) {
    throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  }
  if ((input.publication.evidenceState === "verified") !== available
      || (input.publication.currentness === "event_observation_time_bound") !== available) {
    throw new RiskHistoryCustomerBoundaryError("invalid_customer_projection");
  }
  return {
    schemaVersion: RISK_HISTORY_CUSTOMER_ROUTE_SCHEMA,
    mode: "stored",
    requestBinding,
    publication: {
      evidenceState: input.publication.evidenceState,
      liveClaimed: false,
      currentness: input.publication.currentness,
    },
    riskHistory,
    generatedAt: input.generatedAt,
  };
}

export async function fetchRiskHistoryCustomerPayload(args: {
  assetId: string;
  limit?: number;
  before?: string | null;
  signal?: AbortSignal;
}): Promise<RiskHistoryCustomerRoutePayload> {
  const limit = args.limit ?? RISK_HISTORY_CUSTOMER_MAX_EVENTS;
  const before = args.before ?? null;
  const response = await fetchSameOriginWithDeadline(
    buildRiskHistoryCustomerPath(args.assetId, limit, before),
    {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      signal: args.signal,
    },
    {
      timeoutMs: RISK_HISTORY_CUSTOMER_FETCH_TIMEOUT_MS,
      operation: "risk_history_customer_read",
    },
  );
  if (!response.ok) throw new RiskHistoryCustomerBoundaryError("request_failed");
  const raw = await readJsonResponseBounded<unknown>(
    response,
    RISK_HISTORY_CUSTOMER_MAX_RESPONSE_BYTES,
    {
      timeoutMs: RISK_HISTORY_CUSTOMER_FETCH_TIMEOUT_MS,
      operation: "risk_history_customer_response",
    },
  );
  return parseRiskHistoryCustomerPayload(raw, { assetId: args.assetId, limit, before });
}

function sameStorageBoundary(
  left: PublicCustomerRiskHistoryProjection["storage"],
  right: PublicCustomerRiskHistoryProjection["storage"],
) {
  return left.schemaVersion === right.schemaVersion
    && left.pageSource === right.pageSource
    && left.pageReadState === right.pageReadState
    && left.pageIntegrityVerified === right.pageIntegrityVerified
    && left.durableRetentionClaimed === right.durableRetentionClaimed
    && left.backupRestoreProven === right.backupRestoreProven
    && JSON.stringify(left.blockers) === JSON.stringify(right.blockers);
}

export function mergeRiskHistoryCustomerPages(
  pages: RiskHistoryCustomerRoutePayload[],
): RiskHistoryCustomerMergedView | null {
  if (pages.length < 1) return null;
  const first = pages[0]!;
  if (first.riskHistory.status !== "AVAILABLE" || !first.riskHistory.window.isLatestWindow) {
    throw new RiskHistoryCustomerBoundaryError("incompatible_history_pages");
  }
  const canonicalAssetId = first.riskHistory.asset.canonicalAssetId;
  if (!canonicalAssetId || !verifyRiskHistoryCustomerRequestBindingShape(first.requestBinding)
      || first.requestBinding.before !== null
      || first.requestBinding.requestedLimit !== first.riskHistory.window.requestedLimit) {
    throw new RiskHistoryCustomerBoundaryError("incompatible_history_pages");
  }
  const assetReference = first.requestBinding.assetReference;
  const pageReferences = new Set<string>();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    const previous = pages[index - 1];
    if (!verifyRiskHistoryCustomerRequestBindingShape(page.requestBinding)
        || pageReferences.has(page.requestBinding.pageReference)
        || page.requestBinding.assetReference !== assetReference
        || page.requestBinding.requestedLimit !== page.riskHistory.window.requestedLimit
        || page.requestBinding.before !== page.riskHistory.window.before
        || page.riskHistory.status !== "AVAILABLE"
        || page.riskHistory.asset.canonicalAssetId !== canonicalAssetId
        || page.riskHistory.asset.symbol !== first.riskHistory.asset.symbol
        || page.riskHistory.asset.name !== first.riskHistory.asset.name
        || !sameStorageBoundary(page.riskHistory.storage, first.riskHistory.storage)
        || (index === 0
          ? !page.riskHistory.window.isLatestWindow
          : page.requestBinding.before !== previous?.riskHistory.window.nextBefore)) {
      throw new RiskHistoryCustomerBoundaryError("incompatible_history_pages");
    }
    pageReferences.add(page.requestBinding.pageReference);
  }
  const history = pages
    .slice()
    .reverse()
    .flatMap((page) => page.riskHistory.history);
  if (history.length > RISK_HISTORY_CUSTOMER_MAX_MERGED_EVENTS) {
    throw new RiskHistoryCustomerBoundaryError("incompatible_history_pages");
  }
  const seen = new Set<string>();
  let previousTime = -Infinity;
  for (const row of history) {
    const time = Date.parse(row.observedAt);
    if (time <= previousTime || seen.has(row.eventReference)) {
      throw new RiskHistoryCustomerBoundaryError("incompatible_history_pages");
    }
    previousTime = time;
    seen.add(row.eventReference);
  }
  const oldestLoadedPage = pages.at(-1)!;
  const reachesTrackingStart = oldestLoadedPage.riskHistory.window.reachesTrackingStart;
  const hasOlder = oldestLoadedPage.riskHistory.window.hasOlder;
  return {
    asset: first.riskHistory.asset,
    history,
    segments: buildSegments(history),
    trackingStartedAt: reachesTrackingStart ? history[0]?.observedAt ?? null : null,
    observations: history.length,
    loadedPages: pages.length,
    hasOlder,
    nextBefore: hasOlder ? oldestLoadedPage.riskHistory.window.nextBefore : null,
    completeVisibleHistory: !hasOlder && reachesTrackingStart,
  };
}

export function buildRiskHistoryChartPolyline(
  history: PublicCustomerRiskHistoryProjection["history"],
  width = 280,
  height = 88,
  padding = 8,
): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(padding)) return "";
  const safeWidth = Math.max(48, Math.min(width, 2_000));
  const safeHeight = Math.max(32, Math.min(height, 1_000));
  const safePadding = Math.max(0, Math.min(padding, Math.min(safeWidth, safeHeight) / 3));
  if (!history.length) return "";
  const timestamps = history.map((row) => Date.parse(row.observedAt));
  if (timestamps.some((value) => !Number.isFinite(value))) return "";
  for (let index = 1; index < timestamps.length; index += 1) {
    if (timestamps[index]! <= timestamps[index - 1]!) return "";
  }
  const minimumTime = timestamps[0]!;
  const maximumTime = timestamps.at(-1)!;
  const timeSpan = maximumTime - minimumTime;
  const innerWidth = Math.max(1, safeWidth - safePadding * 2);
  const innerHeight = Math.max(1, safeHeight - safePadding * 2);
  return history.map((row, index) => {
    const timeRatio = history.length === 1 || timeSpan === 0
      ? 0.5
      : (timestamps[index]! - minimumTime) / timeSpan;
    const x = safePadding + timeRatio * innerWidth;
    const y = safePadding + ((100 - Math.min(100, Math.max(0, row.score))) / 100) * innerHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}
