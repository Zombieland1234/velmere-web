import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";
import type { VlmAssetDetailModalData } from "./contract";

export type RuntimeAssetIdentity = Pick<VlmAssetDetailModalData, "symbol" | "providerSymbol" | "assetClass" | "marketDataState">;

export type MarketExecution = {
  side: "buy" | "sell";
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
  venueContributions: Array<{
    venueId: string;
    providerFamily: string;
    baseQuantity: number;
    quoteNotional: number;
    contributionPercent: number;
  }>;
};

export type BasicMarketImpact = {
  schemaVersion: string;
  assetKey: string;
  generatedAt: string;
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  referenceMidPrice: number | null;
  venueCount: number;
  providerFamilyCount: number;
  representativeExecutions: MarketExecution[];
  missingEvidence: string[];
  blockers: string[];
  evidenceDigest: string;
};

export type WhaleAlert = {
  id: string;
  severity: "info" | "watch" | "high" | "critical";
  confidencePercent: number;
  title: string;
  evidence: string[];
};

export type WhaleFlowWindow = {
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
};

export type WhaleWatchView = {
  schemaVersion?: string;
  assetKey?: string;
  generatedAt?: string;
  evidenceStatus?: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  advancedReady?: boolean;
  providerFamilies?: string[];
  holderCount?: number;
  transferCount?: number;
  holderCoveragePercent?: number;
  verifiedLabelCoveragePercent?: number;
  clusterCoveragePercent?: number;
  rawConcentration?: { top1Percent: number; top5Percent: number; top10Percent: number; hhi: number; gini: number };
  adjustedConcentration?: { top1Percent: number; top5Percent: number; top10Percent: number; hhi: number; gini: number };
  flowWindows?: WhaleFlowWindow[];
  alerts?: WhaleAlert[];
  missingEvidence?: string[];
  blockers?: string[];
  evidenceDigest?: string;
  withheld?: boolean;
  available?: boolean;
};

export type MarketIntelligenceResponse = {
  ok?: boolean;
  mode?: string;
  error?: string;
  depth?: string;
  surface?: string;
  assetKey?: string;
  publication?: {
    mode?: string;
    evidenceState?: string;
    liveClaimed?: boolean;
    blockers?: string[];
  };
  marketImpact?: BasicMarketImpact;
  whaleWatch?: WhaleWatchView;
};

type RuntimeInflightEntry = {
  controller: AbortController;
  promise: Promise<MarketIntelligenceResponse>;
  consumers: number;
  settled: boolean;
};

type RuntimeCacheClass = "positive" | "withheld";
type RuntimeCacheEntry = {
  expiresAt: number;
  value: MarketIntelligenceResponse;
  cacheClass: RuntimeCacheClass;
};

type JsonRecord = Record<string, unknown>;

const runtimeCache = new Map<string, RuntimeCacheEntry>();
const runtimeInflight = new Map<string, RuntimeInflightEntry>();
export const CACHE_TTL_MS = 45_000;
export const WITHHELD_CACHE_TTL_MS = 30_000;
export const MAX_RUNTIME_CACHE_ENTRIES = 64;
export const MAX_RUNTIME_RESPONSE_BYTES = 512_000;
export const MAX_RUNTIME_REQUEST_MS = 12_000;
export const MAX_RUNTIME_MARKET_EXECUTIONS = 24;
export const MAX_RUNTIME_VENUE_CONTRIBUTIONS = 16;
export const MAX_RUNTIME_WHALE_ALERTS = 32;
export const MAX_RUNTIME_ALERT_EVIDENCE = 8;
export const MAX_RUNTIME_PROVIDER_FAMILIES = 12;
export const MAX_RUNTIME_EVIDENCE_ITEMS = 24;
export const MAX_RUNTIME_TEXT_LENGTH = 240;
export const MAX_RUNTIME_FUTURE_SKEW_MS = 2 * 60_000;
export const MAX_RUNTIME_VERIFIED_LIVE_AGE_MS = 5 * 60_000;
export const MAX_RUNTIME_VERIFIED_STAGING_AGE_MS = 60 * 60_000;

let runtimeRequestTimeoutMs = MAX_RUNTIME_REQUEST_MS;
let withheldCacheTtlMs = WITHHELD_CACHE_TTL_MS;
let runtimeNow = () => Date.now();
let localReferenceShortCircuits = 0;
let networkRequestsStarted = 0;

const EVIDENCE_STATES = new Set(["verified_live", "verified_staging", "fixture_only", "unavailable"]);
const ALERT_SEVERITIES = new Set(["info", "watch", "high", "critical"]);
const FLOW_WINDOWS = new Set(["24h", "7d", "30d"]);

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function boundedString(value: unknown, maxLength = MAX_RUNTIME_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function boundedStringArray(value: unknown, limit = MAX_RUNTIME_EVIDENCE_ITEMS): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = boundedString(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedNumber(value: unknown, fallback = 0, min = -1e18, max = 1e18): number {
  const number = finiteNumber(value);
  return number === null ? fallback : Math.max(min, Math.min(max, number));
}

function optionalBoundedNumber(value: unknown, min = -1e18, max = 1e18): number | null {
  const number = finiteNumber(value);
  return number === null ? null : Math.max(min, Math.min(max, number));
}

function boundedCount(value: unknown): number {
  return Math.round(boundedNumber(value, 0, 0, 1_000_000_000));
}

function optionalBoundedCount(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number === null ? undefined : Math.round(Math.max(0, Math.min(1_000_000_000, number)));
}

function optionalBoundedPercent(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number === null ? undefined : Math.max(0, Math.min(100, number));
}

function normalizeEvidenceStatus(value: unknown): BasicMarketImpact["evidenceStatus"] {
  return typeof value === "string" && EVIDENCE_STATES.has(value)
    ? value as BasicMarketImpact["evidenceStatus"]
    : "unavailable";
}

function normalizeVenueContribution(value: unknown): MarketExecution["venueContributions"][number] | null {
  const row = asRecord(value);
  if (!row) return null;
  const venueId = boundedString(row.venueId, 120);
  const providerFamily = boundedString(row.providerFamily, 120);
  if (!venueId || !providerFamily) return null;
  const baseQuantity = optionalBoundedNumber(row.baseQuantity, 0);
  const quoteNotional = optionalBoundedNumber(row.quoteNotional, 0);
  const contributionPercent = optionalBoundedPercent(row.contributionPercent);
  if (baseQuantity === null || quoteNotional === null || contributionPercent === undefined) return null;
  return { venueId, providerFamily, baseQuantity, quoteNotional, contributionPercent };
}

function normalizeMarketExecution(value: unknown): MarketExecution | null {
  const row = asRecord(value);
  if (!row || (row.side !== "buy" && row.side !== "sell")) return null;
  const requestedNotionalUsd = optionalBoundedNumber(row.requestedNotionalUsd, 0);
  const referenceMidPrice = optionalBoundedNumber(row.referenceMidPrice, 0);
  const requestedBaseQuantity = optionalBoundedNumber(row.requestedBaseQuantity, 0);
  const filledBaseQuantity = optionalBoundedNumber(row.filledBaseQuantity, 0);
  const grossQuoteNotionalUsd = optionalBoundedNumber(row.grossQuoteNotionalUsd, 0);
  const feeUsd = optionalBoundedNumber(row.feeUsd, 0);
  const netQuoteNotionalUsd = optionalBoundedNumber(row.netQuoteNotionalUsd, 0);
  const fillRatio = optionalBoundedNumber(row.fillRatio, 0, 1);
  const unfilledNotionalUsd = optionalBoundedNumber(row.unfilledNotionalUsd, 0);
  if ([requestedNotionalUsd, referenceMidPrice, requestedBaseQuantity, filledBaseQuantity, grossQuoteNotionalUsd, feeUsd, netQuoteNotionalUsd, fillRatio, unfilledNotionalUsd].some((value) => value === null)) return null;
  const contributions = Array.isArray(row.venueContributions)
    ? row.venueContributions.slice(0, MAX_RUNTIME_VENUE_CONTRIBUTIONS).map(normalizeVenueContribution).filter((item): item is NonNullable<typeof item> => item !== null)
    : [];
  return {
    side: row.side,
    requestedNotionalUsd: requestedNotionalUsd as number,
    referenceMidPrice: referenceMidPrice as number,
    requestedBaseQuantity: requestedBaseQuantity as number,
    filledBaseQuantity: filledBaseQuantity as number,
    grossQuoteNotionalUsd: grossQuoteNotionalUsd as number,
    feeUsd: feeUsd as number,
    netQuoteNotionalUsd: netQuoteNotionalUsd as number,
    fillRatio: fillRatio as number,
    unfilledNotionalUsd: unfilledNotionalUsd as number,
    vwap: optionalBoundedNumber(row.vwap, 0),
    impactBps: optionalBoundedNumber(row.impactBps, -1e9, 1e9),
    worstPrice: optionalBoundedNumber(row.worstPrice, 0),
    venueContributions: contributions,
  };
}

function normalizeMarketImpact(value: unknown): BasicMarketImpact | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const executions = Array.isArray(row.representativeExecutions)
    ? row.representativeExecutions.slice(0, MAX_RUNTIME_MARKET_EXECUTIONS).map(normalizeMarketExecution).filter((item): item is MarketExecution => item !== null)
    : [];
  return {
    schemaVersion: boundedString(row.schemaVersion, 120) ?? "unknown",
    assetKey: boundedString(row.assetKey, 160) ?? "unknown",
    generatedAt: boundedString(row.generatedAt, 80) ?? "",
    evidenceStatus: normalizeEvidenceStatus(row.evidenceStatus),
    referenceMidPrice: optionalBoundedNumber(row.referenceMidPrice, 0),
    venueCount: boundedCount(row.venueCount),
    providerFamilyCount: boundedCount(row.providerFamilyCount),
    representativeExecutions: executions,
    missingEvidence: boundedStringArray(row.missingEvidence),
    blockers: boundedStringArray(row.blockers),
    evidenceDigest: boundedString(row.evidenceDigest, 128) ?? "",
  };
}

function normalizeConcentration(value: unknown): NonNullable<WhaleWatchView["rawConcentration"]> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const top1Percent = optionalBoundedPercent(row.top1Percent);
  const top5Percent = optionalBoundedPercent(row.top5Percent);
  const top10Percent = optionalBoundedPercent(row.top10Percent);
  const hhi = optionalBoundedNumber(row.hhi, 0, 1);
  const gini = optionalBoundedNumber(row.gini, 0, 1);
  if (top1Percent === undefined || top5Percent === undefined || top10Percent === undefined || hhi === null || gini === null) return undefined;
  return { top1Percent, top5Percent, top10Percent, hhi, gini };
}

function normalizeFlowWindow(value: unknown): WhaleFlowWindow | null {
  const row = asRecord(value);
  if (!row || typeof row.window !== "string" || !FLOW_WINDOWS.has(row.window)) return null;
  const eventCount = optionalBoundedCount(row.eventCount);
  const numericFields = ["exchangeInflowUsd", "exchangeOutflowUsd", "netExchangeFlowUsd", "treasuryToExchangeUsd", "treasuryDistributionUsd", "bridgeFlowUsd", "liquidityAddedUsd", "liquidityRemovedUsd", "mintedUsd", "burnedUsd", "whaleTransferUsd"] as const;
  const numbers = Object.fromEntries(numericFields.map((field) => [field, optionalBoundedNumber(row[field])])) as Record<(typeof numericFields)[number], number | null>;
  if (eventCount === undefined || numericFields.some((field) => numbers[field] === null)) return null;
  return {
    window: row.window as WhaleFlowWindow["window"],
    eventCount,
    exchangeInflowUsd: numbers.exchangeInflowUsd as number,
    exchangeOutflowUsd: numbers.exchangeOutflowUsd as number,
    netExchangeFlowUsd: numbers.netExchangeFlowUsd as number,
    treasuryToExchangeUsd: numbers.treasuryToExchangeUsd as number,
    treasuryDistributionUsd: numbers.treasuryDistributionUsd as number,
    bridgeFlowUsd: numbers.bridgeFlowUsd as number,
    liquidityAddedUsd: numbers.liquidityAddedUsd as number,
    liquidityRemovedUsd: numbers.liquidityRemovedUsd as number,
    mintedUsd: numbers.mintedUsd as number,
    burnedUsd: numbers.burnedUsd as number,
    whaleTransferUsd: numbers.whaleTransferUsd as number,
  };
}

function normalizeWhaleAlert(value: unknown): WhaleAlert | null {
  const row = asRecord(value);
  if (!row || typeof row.severity !== "string" || !ALERT_SEVERITIES.has(row.severity)) return null;
  const id = boundedString(row.id, 160);
  const title = boundedString(row.title);
  if (!id || !title) return null;
  const confidencePercent = optionalBoundedPercent(row.confidencePercent);
  if (confidencePercent === undefined) return null;
  return {
    id,
    severity: row.severity as WhaleAlert["severity"],
    confidencePercent,
    title,
    evidence: boundedStringArray(row.evidence, MAX_RUNTIME_ALERT_EVIDENCE),
  };
}

function normalizeWhaleWatch(value: unknown): WhaleWatchView | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const flowRows = Array.isArray(row.flowWindows)
    ? row.flowWindows.slice(0, 12).map(normalizeFlowWindow).filter((item): item is WhaleFlowWindow => item !== null)
    : [];
  const flowByWindow = new Map<WhaleFlowWindow["window"], WhaleFlowWindow>();
  for (const flow of flowRows) if (!flowByWindow.has(flow.window)) flowByWindow.set(flow.window, flow);
  const alerts = Array.isArray(row.alerts)
    ? row.alerts.slice(0, MAX_RUNTIME_WHALE_ALERTS).map(normalizeWhaleAlert).filter((item): item is WhaleAlert => item !== null)
    : [];
  const rawConcentration = normalizeConcentration(row.rawConcentration);
  const adjustedConcentration = normalizeConcentration(row.adjustedConcentration);
  const holderCount = optionalBoundedCount(row.holderCount);
  const transferCount = optionalBoundedCount(row.transferCount);
  const holderCoveragePercent = optionalBoundedPercent(row.holderCoveragePercent);
  const verifiedLabelCoveragePercent = optionalBoundedPercent(row.verifiedLabelCoveragePercent);
  const clusterCoveragePercent = optionalBoundedPercent(row.clusterCoveragePercent);
  return {
    schemaVersion: boundedString(row.schemaVersion, 120),
    assetKey: boundedString(row.assetKey, 160),
    generatedAt: boundedString(row.generatedAt, 80),
    evidenceStatus: normalizeEvidenceStatus(row.evidenceStatus),
    ...(typeof row.advancedReady === "boolean" ? { advancedReady: row.advancedReady } : {}),
    providerFamilies: boundedStringArray(row.providerFamilies, MAX_RUNTIME_PROVIDER_FAMILIES),
    ...(holderCount !== undefined ? { holderCount } : {}),
    ...(transferCount !== undefined ? { transferCount } : {}),
    ...(holderCoveragePercent !== undefined ? { holderCoveragePercent } : {}),
    ...(verifiedLabelCoveragePercent !== undefined ? { verifiedLabelCoveragePercent } : {}),
    ...(clusterCoveragePercent !== undefined ? { clusterCoveragePercent } : {}),
    ...(rawConcentration ? { rawConcentration } : {}),
    ...(adjustedConcentration ? { adjustedConcentration } : {}),
    flowWindows: [...flowByWindow.values()].slice(0, 3),
    alerts,
    missingEvidence: boundedStringArray(row.missingEvidence),
    blockers: boundedStringArray(row.blockers),
    evidenceDigest: boundedString(row.evidenceDigest, 128),
    withheld: row.withheld === true || row.locked === true,
    available: typeof row.available === "boolean" ? row.available : undefined,
  };
}

function normalizeRuntimeResponse(value: unknown): MarketIntelligenceResponse {
  const row = asRecord(value);
  if (!row) return { ok: false, error: "invalid_market_intelligence_response" };
  const publicationRow = asRecord(row.publication);
  const marketImpact = normalizeMarketImpact(row.marketImpact);
  const whaleWatch = normalizeWhaleWatch(row.whaleWatch);
  return {
    ok: typeof row.ok === "boolean" ? row.ok : undefined,
    mode: boundedString(row.mode, 80),
    error: boundedString(row.error),
    depth: boundedString(row.depth, 40),
    surface: boundedString(row.surface, 40),
    assetKey: boundedString(row.assetKey, 160),
    ...(publicationRow ? {
      publication: {
        mode: boundedString(publicationRow.mode, 80),
        evidenceState: boundedString(publicationRow.evidenceState, 80),
        liveClaimed: publicationRow.liveClaimed === true,
        blockers: boundedStringArray(publicationRow.blockers),
      },
    } : {}),
    ...(marketImpact ? { marketImpact } : {}),
    ...(whaleWatch ? { whaleWatch } : {}),
  };
}

function deepFreezeRuntimeValue<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreezeRuntimeValue(child, seen);
  return Object.freeze(value);
}

function assertTemporalEvidence(
  generatedAt: string | undefined,
  evidenceStatus: BasicMarketImpact["evidenceStatus"] | undefined,
  nowMs: number,
): void {
  if (!evidenceStatus || evidenceStatus === "unavailable") return;
  const observedAt = generatedAt ? Date.parse(generatedAt) : Number.NaN;
  if (!Number.isFinite(observedAt)) throw new Error("market_intelligence_invalid_generated_at");
  if (observedAt - nowMs > MAX_RUNTIME_FUTURE_SKEW_MS) {
    throw new Error("market_intelligence_future_evidence_rejected");
  }
  const ageMs = Math.max(0, nowMs - observedAt);
  if (evidenceStatus === "verified_live" && ageMs > MAX_RUNTIME_VERIFIED_LIVE_AGE_MS) {
    throw new Error("market_intelligence_stale_live_evidence");
  }
  if (evidenceStatus === "verified_staging" && ageMs > MAX_RUNTIME_VERIFIED_STAGING_AGE_MS) {
    throw new Error("market_intelligence_stale_staging_evidence");
  }
}

function assertRuntimeTruthBoundary(value: MarketIntelligenceResponse): void {
  const nowMs = runtimeNow();
  assertTemporalEvidence(value.marketImpact?.generatedAt, value.marketImpact?.evidenceStatus, nowMs);
  assertTemporalEvidence(value.whaleWatch?.generatedAt, value.whaleWatch?.evidenceStatus, nowMs);

  const publicationAuthorized =
    value.mode === "live"
    && value.publication?.mode === "live"
    && value.publication.evidenceState === "verified"
    && value.publication.liveClaimed === true
    && (value.publication.blockers?.length ?? 0) === 0;
  if (!publicationAuthorized && (value.marketImpact || value.whaleWatch)) {
    throw new Error("market_intelligence_projection_without_publication_authority");
  }
  if (value.publication?.liveClaimed === true) {
    const deliveredStatuses = [value.marketImpact?.evidenceStatus, value.whaleWatch?.evidenceStatus]
      .filter((status): status is BasicMarketImpact["evidenceStatus"] => Boolean(status) && status !== "unavailable");
    if (!deliveredStatuses.length || deliveredStatuses.some((status) => status !== "verified_live")) {
      throw new Error("market_intelligence_live_claim_without_live_evidence");
    }
  }
}

function pruneRuntimeCache(now = Date.now(), reserveEntries = 0) {
  for (const [key, entry] of runtimeCache) {
    if (entry.expiresAt <= now) runtimeCache.delete(key);
  }
  const targetSize = Math.max(0, MAX_RUNTIME_CACHE_ENTRIES - reserveEntries);
  while (runtimeCache.size > targetSize) {
    const oldestKey = runtimeCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    runtimeCache.delete(oldestKey);
  }
}

export function normalizeLocale(locale: string): "pl" | "en" | "de" {
  return locale === "pl" || locale === "de" ? locale : "en";
}

function normalizeRequestedAssetKey(asset: RuntimeAssetIdentity): string {
  return String(asset.providerSymbol || asset.symbol || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 120);
}

function surfaceForAsset(asset: RuntimeAssetIdentity): "shield" | "real_markets" {
  return asset.assetClass === "crypto" || asset.assetClass === "exchange_token" ? "shield" : "real_markets";
}

export function isDevelopmentLocalReferenceAsset(asset: RuntimeAssetIdentity): boolean {
  return process.env.NODE_ENV !== "production" && asset.marketDataState === "local_reference";
}

function localReferenceRuntimeResponse(asset: RuntimeAssetIdentity, locale: string, depth: "basic" | "pro"): MarketIntelligenceResponse {
  const assetKey = normalizeRequestedAssetKey(asset);
  const surface = surfaceForAsset(asset);
  return deepFreezeRuntimeValue({
    ok: false,
    mode: "reference",
    error: "development_reference_market_intelligence_withheld",
    depth,
    surface,
    assetKey,
    publication: {
      mode: "withheld",
      evidenceState: "fixture_only",
      liveClaimed: false,
      blockers: ["local_reference_not_live", "provider_rights_not_verified"],
    },
    marketImpact: undefined,
    whaleWatch: { withheld: true, available: false, evidenceStatus: "fixture_only", blockers: ["local_reference_not_live", "provider_rights_not_verified"] },
  });
}

export function runtimeKey(asset: RuntimeAssetIdentity, locale: string, depth: "basic" | "pro") {
  return JSON.stringify([
    normalizeRequestedAssetKey(asset),
    asset.assetClass || "unknown",
    surfaceForAsset(asset),
    depth,
    normalizeLocale(locale),
  ]);
}

type RuntimeBindingExpectation = {
  assetKey: string;
  depth: "basic" | "pro";
  surface: "shield" | "real_markets";
};

function assertRuntimeBinding(
  value: MarketIntelligenceResponse,
  expected: RuntimeBindingExpectation,
  response: Response,
): void {
  const headerDepth = boundedString(response.headers.get("x-velmere-market-intelligence-depth"), 40);
  if (headerDepth && headerDepth !== expected.depth) {
    throw new Error("market_intelligence_response_binding_mismatch");
  }

  if (value.assetKey !== expected.assetKey || value.depth !== expected.depth || value.surface !== expected.surface) {
    throw new Error("market_intelligence_response_binding_mismatch");
  }
  if (value.marketImpact?.assetKey && value.marketImpact.assetKey !== expected.assetKey) {
    throw new Error("market_intelligence_response_binding_mismatch");
  }
  if (value.whaleWatch?.assetKey && value.whaleWatch.assetKey !== expected.assetKey) {
    throw new Error("market_intelligence_response_binding_mismatch");
  }
}

function runtimeCachePolicy(
  response: Response,
  value: MarketIntelligenceResponse,
  depth: "basic" | "pro",
): { cacheClass: RuntimeCacheClass; ttlMs: number } | null {
  if (response.status === 424 && value.mode === "withheld") {
    return { cacheClass: "withheld", ttlMs: withheldCacheTtlMs };
  }
  // Positive Pro payloads are account-entitled. Keeping them in a module-global cache
  // could survive a client-side logout/login boundary, so only Basic public analysis is cached.
  if (
    depth === "basic"
    && response.ok
    && value.ok === true
    && value.mode === "live"
    && value.publication?.mode === "live"
    && value.publication.evidenceState === "verified"
    && value.publication.liveClaimed === true
    && (value.publication.blockers?.length ?? 0) === 0
  ) {
    return { cacheClass: "positive", ttlMs: CACHE_TTL_MS };
  }
  return null;
}

async function readBoundedRuntimeText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new Error("market_intelligence_invalid_content_type");
  }
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RUNTIME_RESPONSE_BYTES) {
    throw new Error("market_intelligence_response_too_large");
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RUNTIME_RESPONSE_BYTES) {
      throw new Error("market_intelligence_response_too_large");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RUNTIME_RESPONSE_BYTES) {
        await reader.cancel("market_intelligence_response_too_large");
        throw new Error("market_intelligence_response_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function readBoundedRuntimeResponse(response: Response): Promise<MarketIntelligenceResponse> {
  const text = await readBoundedRuntimeText(response);
  if (!text.trim()) return { ok: false, error: "empty_market_intelligence_response" };
  try {
    return normalizeRuntimeResponse(parseStrictJsonText<unknown>(text, {
      maxBytes: MAX_RUNTIME_RESPONSE_BYTES,
      maxDepth: 48,
      maxNodes: 100_000,
    }));
  } catch {
    return { ok: false, error: "invalid_market_intelligence_response" };
  }
}

function subscribeToRuntime(entry: RuntimeInflightEntry, signal: AbortSignal): Promise<MarketIntelligenceResponse> {
  entry.consumers += 1;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      signal.removeEventListener("abort", onAbort);
      entry.consumers = Math.max(0, entry.consumers - 1);
      if (entry.consumers === 0 && !entry.settled) entry.controller.abort();
    };
    const onAbort = () => {
      release();
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (value) => {
        release();
        resolve(value);
      },
      (error) => {
        release();
        reject(error);
      },
    );
  });
}

export async function fetchRuntime(
  asset: RuntimeAssetIdentity,
  locale: string,
  depth: "basic" | "pro",
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (depth !== "pro" && isDevelopmentLocalReferenceAsset(asset)) {
    localReferenceShortCircuits += 1;
    return localReferenceRuntimeResponse(asset, locale, depth);
  }
  const normalizedLocale = normalizeLocale(locale);
  const surface = surfaceForAsset(asset);
  const key = runtimeKey(asset, locale, depth);
  const nowMs = runtimeNow();
  pruneRuntimeCache(nowMs);
  const cached = runtimeCache.get(key);
  if (cached && cached.expiresAt > nowMs) {
    runtimeCache.delete(key);
    runtimeCache.set(key, cached);
    return cached.value;
  }

  const existing = runtimeInflight.get(key);
  if (existing && !existing.controller.signal.aborted) return subscribeToRuntime(existing, signal);
  if (existing) runtimeInflight.delete(key);

  const controller = new AbortController();
  const entry: RuntimeInflightEntry = {
    controller,
    consumers: 0,
    settled: false,
    promise: Promise.resolve({ ok: false, error: "market_intelligence_request_not_started" }),
  };

  entry.promise = (async () => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, runtimeRequestTimeoutMs);
    try {
      const requestedAssetKey = normalizeRequestedAssetKey(asset);
      networkRequestsStarted += 1;
      const response = await fetch("/api/market-integrity/market-intelligence", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-velmere-live": "true",
          ...(depth === "pro" ? { "x-velmere-pro": "true" } : {}),
        },
        body: JSON.stringify({
          assetKey: requestedAssetKey,
          depth,
          locale: normalizedLocale,
          surface,
          evidenceMode: "server_owned",
        }),
      });
      const normalizedValue = await readBoundedRuntimeResponse(response);
      if (!response.ok && response.status !== 424 && response.status !== 403) {
        throw new Error(normalizedValue.error || `market_intelligence_http_${response.status}`);
      }
      if (response.status !== 403) {
        assertRuntimeBinding(normalizedValue, { assetKey: requestedAssetKey, depth, surface }, response);
        assertRuntimeTruthBoundary(normalizedValue);
      }
      const value = deepFreezeRuntimeValue(normalizedValue);
      const cachePolicy = runtimeCachePolicy(response, value, depth);
      if (cachePolicy) {
        const cacheNowMs = runtimeNow();
        pruneRuntimeCache(cacheNowMs, 1);
        runtimeCache.set(key, {
          expiresAt: cacheNowMs + cachePolicy.ttlMs,
          value,
          cacheClass: cachePolicy.cacheClass,
        });
      }
      return value;
    } catch (error) {
      if (timedOut) throw new Error("market_intelligence_timeout", { cause: error });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    entry.settled = true;
    if (runtimeInflight.get(key) === entry) runtimeInflight.delete(key);
  });

  runtimeInflight.set(key, entry);
  return subscribeToRuntime(entry, signal);
}

export function invalidateRuntimeCache(asset: RuntimeAssetIdentity, locale: string, depth: "basic" | "pro") {
  runtimeCache.delete(runtimeKey(asset, locale, depth));
}

export function pass35A37RuntimeSnapshot() {
  return {
    cacheEntries: runtimeCache.size,
    positiveCacheEntries: [...runtimeCache.values()].filter((entry) => entry.cacheClass === "positive").length,
    withheldCacheEntries: [...runtimeCache.values()].filter((entry) => entry.cacheClass === "withheld").length,
    inflightEntries: runtimeInflight.size,
    inflightConsumers: [...runtimeInflight.values()].reduce((sum, entry) => sum + entry.consumers, 0),
    maxCacheEntries: MAX_RUNTIME_CACHE_ENTRIES,
    maxResponseBytes: MAX_RUNTIME_RESPONSE_BYTES,
    maxRequestMs: runtimeRequestTimeoutMs,
    withheldCacheTtlMs,
    maxMarketExecutions: MAX_RUNTIME_MARKET_EXECUTIONS,
    maxVenueContributions: MAX_RUNTIME_VENUE_CONTRIBUTIONS,
    maxWhaleAlerts: MAX_RUNTIME_WHALE_ALERTS,
    maxFutureSkewMs: MAX_RUNTIME_FUTURE_SKEW_MS,
    maxVerifiedLiveAgeMs: MAX_RUNTIME_VERIFIED_LIVE_AGE_MS,
    maxVerifiedStagingAgeMs: MAX_RUNTIME_VERIFIED_STAGING_AGE_MS,
    localReferenceShortCircuits,
    networkRequestsStarted,
  };
}

export function pass35A38NormalizeRuntimeResponseForTests(value: unknown) {
  return normalizeRuntimeResponse(value);
}

export function pass35A39ConfigureRuntimeForTests(options: { requestTimeoutMs?: number; withheldTtlMs?: number } = {}) {
  runtimeRequestTimeoutMs = options.requestTimeoutMs ?? MAX_RUNTIME_REQUEST_MS;
  withheldCacheTtlMs = options.withheldTtlMs ?? WITHHELD_CACHE_TTL_MS;
}

export function pass35A40ConfigureRuntimeForTests(options: { nowMs?: number } = {}) {
  runtimeNow = options.nowMs === undefined ? () => Date.now() : () => options.nowMs as number;
}

export function pass35A37ResetRuntimeForTests() {
  for (const entry of runtimeInflight.values()) entry.controller.abort();
  runtimeInflight.clear();
  runtimeCache.clear();
  runtimeRequestTimeoutMs = MAX_RUNTIME_REQUEST_MS;
  withheldCacheTtlMs = WITHHELD_CACHE_TTL_MS;
  runtimeNow = () => Date.now();
  localReferenceShortCircuits = 0;
  networkRequestsStarted = 0;
}
