import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readDurableJsonBounded, writeDurableJsonAtomic } from "@/lib/security/durable-file-boundary";
import type { TokenRiskResult } from "./risk-types";
import {
  attachPass4644ProviderReceipts,
  createPass4644ProviderEvidenceReceipt,
  isPass4644CommerciallyFreshReceipt,
  pass4644IdentityMatches,
  type Pass4644ProviderEvidenceReceipt,
  type Pass4644ProviderSurface,
} from "./provider-evidence-receipt";
import { pass4650CategoryForCapability, type Pass4650EvidenceCategory } from "./provider-quality-replay";

export type Pass4653ContinuityMode = "live" | "continuity" | "degraded_basic_only" | "unavailable";

export type Pass4653ContinuityReceiptMeta = {
  schemaVersion: "pass4653_continuity_receipt_v1";
  replayedFromReceiptId: string;
  snapshotHash: string;
  originalObservedAt: string;
  graceExpiresAt: string;
  replayedAt: string;
  reason: "provider_outage" | "provider_timeout" | "provider_rate_limited" | "scheduled_refresh_gap";
};

export type Pass4653ContinuitySnapshot = {
  schemaVersion: "pass4653_continuity_snapshot_v1";
  snapshotId: string;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  storedAt: string;
  sourceGeneratedAt: string;
  snapshotHash: string;
  snapshotAuth?: {
    algorithm: "hmac-sha256";
    keyId: string;
    tag: string;
  };
  result: TokenRiskResult;
};

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

const GLOBAL_KEY = "__velmerePass4653ContinuitySnapshots";
const MAX_MEMORY_SNAPSHOTS = 5000;

type GlobalWithContinuity = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, Pass4653ContinuitySnapshot>;
};

/**
 * Maximum stale-while-revalidate grace by evidence category. The receipt keeps
 * its original observedAt and cannot be extended by re-saving the snapshot.
 */
const CATEGORY_GRACE_MS: Record<Pass4650EvidenceCategory, number> = {
  identity: 24 * 60 * 60_000,
  market: 2 * 60_000,
  liquidity: 10 * 60_000,
  holders_ownership: 30 * 60_000,
  contract_permissions: 6 * 60 * 60_000,
  supply_tokenomics: 6 * 60 * 60_000,
  fundamentals_filings: 24 * 60 * 60_000,
  macro_rates: 6 * 60 * 60_000,
  derivatives_microstructure: 90_000,
  history_volatility: 60 * 60_000,
  scenario_dependency: 30 * 60_000,
};

const METRIC_CATEGORY: Record<string, Pass4650EvidenceCategory> = {
  currentPrice: "market",
  marketCap: "market",
  volume24h: "market",
  priceChange24h: "market",
  liquidityUsd: "liquidity",
  liquidityToMarketCapPercent: "liquidity",
  simulatedSlippage10k: "liquidity",
  top10HolderPercent: "holders_ownership",
  holderCount: "holders_ownership",
  buyTaxPercentage: "contract_permissions",
  sellTaxPercentage: "contract_permissions",
  circulatingSupply: "supply_tokenomics",
  totalSupply: "supply_tokenomics",
  maxSupply: "supply_tokenomics",
  fdv: "supply_tokenomics",
  fdvToMarketCapRatio: "supply_tokenomics",
  priceChange1h: "history_volatility",
  priceChange6h: "history_volatility",
  priceChange7d: "history_volatility",
  priceChange14d: "history_volatility",
  priceChange30d: "history_volatility",
  drawdownPercent: "history_volatility",
  athPrice: "history_volatility",
  bidAskImbalancePercent: "derivatives_microstructure",
  buySellImbalancePercent: "derivatives_microstructure",
  volumeToLiquidityRatio: "derivatives_microstructure",
};

function stableSerialize(value: unknown): string {
  // Match JSON persistence semantics so a snapshot hashes identically before
  // and after a filesystem/Supabase round-trip. Object properties whose value
  // is undefined are omitted; undefined array entries become null.
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item === undefined ? null : item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
    .join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedIdentity(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:._\-/]+/g, "").replace(/-usd$/, "") || "unknown";
}

function cacheKey(requestedIdentity: string, surface: Pass4644ProviderSurface) {
  return `${surface}:${normalizedIdentity(requestedIdentity)}`;
}

function memoryStore() {
  const root = globalThis as GlobalWithContinuity;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new Map();
  return root[GLOBAL_KEY]!;
}

function cloneResult(result: TokenRiskResult): TokenRiskResult {
  return JSON.parse(JSON.stringify(result)) as TokenRiskResult;
}

function continuityDirectory() {
  return process.env.VELMERE_CONTINUITY_CACHE_DIR?.trim() || null;
}

function fileNameForKey(key: string) {
  return `${sha256(key)}.json`;
}

function snapshotHashPayload(snapshot: Omit<Pass4653ContinuitySnapshot, "snapshotHash" | "snapshotAuth">) {
  return stableSerialize(snapshot);
}

function continuityHmacSecret() {
  return process.env.VELMERE_CONTINUITY_HMAC_SECRET?.trim() || "";
}

function snapshotAuthTag(snapshotHash: string, payload: string, secret: string) {
  return createHmac("sha256", secret).update(`${snapshotHash}:${payload}`).digest("hex");
}

function safeTagEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function receiptCategories(receipt: Pass4644ProviderEvidenceReceipt) {
  return Array.from(new Set(receipt.capabilities
    .map(pass4650CategoryForCapability)
    .filter((value): value is Pass4650EvidenceCategory => Boolean(value))));
}

function graceForReceipt(receipt: Pass4644ProviderEvidenceReceipt) {
  const categories = receiptCategories(receipt);
  if (categories.length === 0) return 0;
  return Math.min(...categories.map((category) => CATEGORY_GRACE_MS[category]));
}

function receiptStillInsideGrace(receipt: Pass4644ProviderEvidenceReceipt, at: Date) {
  const observed = Date.parse(receipt.observedAt);
  const grace = graceForReceipt(receipt);
  return Number.isFinite(observed) && grace > 0 && observed + grace >= at.getTime();
}

function receiptMergeKey(receipt: Pass4644ProviderEvidenceReceipt) {
  return [
    receipt.surface,
    receipt.providerId,
    receipt.providerFamily,
    receipt.identity.resolvedAddress ?? receipt.identity.resolvedMarketId ?? receipt.identity.resolvedSymbol ?? receipt.identity.requested,
    receipt.capabilities.slice().sort().join("|"),
  ].join(":");
}

function signalCategory(id: string): Pass4650EvidenceCategory | null {
  if (/liquidity|slippage/.test(id)) return "liquidity";
  if (/holder/.test(id)) return "holders_ownership";
  if (/contract|mint|blacklist|honeypot|tax/.test(id)) return "contract_permissions";
  if (/supply|fdv/.test(id)) return "supply_tokenomics";
  if (/drawdown|drop|gain|ath|intraday|pump/.test(id)) return "history_volatility";
  if (/orderbook|imbalance|volume_spike|wash_trading/.test(id)) return "derivatives_microstructure";
  return null;
}

function sanitizeSnapshotResult(args: {
  result: TokenRiskResult;
  previousSnapshot?: Pass4653ContinuitySnapshot | null;
  storedAt: Date;
}) {
  const current = cloneResult(args.result);
  const previous = args.previousSnapshot && verifyPass4653ContinuitySnapshot(args.previousSnapshot).valid
    ? cloneResult(args.previousSnapshot.result)
    : null;

  const receiptMap = new Map<string, Pass4644ProviderEvidenceReceipt>();
  for (const receipt of previous?.providerEvidenceReceipts ?? []) {
    if (receipt.continuity || !isPass4644CommerciallyFreshReceipt(receipt, args.storedAt) || !receiptStillInsideGrace(receipt, args.storedAt)) continue;
    receiptMap.set(receiptMergeKey(receipt), receipt);
  }
  for (const receipt of current.providerEvidenceReceipts ?? []) {
    if (receipt.continuity || !isPass4644CommerciallyFreshReceipt(receipt, args.storedAt) || !receiptStillInsideGrace(receipt, args.storedAt)) continue;
    const key = receiptMergeKey(receipt);
    const old = receiptMap.get(key);
    if (!old || Date.parse(receipt.observedAt) >= Date.parse(old.observedAt)) receiptMap.set(key, receipt);
  }
  const receipts = Array.from(receiptMap.values());
  if (receipts.length === 0) return null;

  const allCategories = new Set(receipts.flatMap(receiptCategories));
  const currentLiveCategories = new Set((current.providerEvidenceReceipts ?? [])
    .filter((receipt) => !receipt.continuity && isPass4644CommerciallyFreshReceipt(receipt, args.storedAt))
    .flatMap(receiptCategories));

  const metrics: TokenRiskResult["metrics"] = { ...(previous?.metrics ?? {}) };
  for (const [key, value] of Object.entries(current.metrics ?? {})) {
    const category = METRIC_CATEGORY[key];
    if (!category || currentLiveCategories.has(category)) {
      (metrics as Record<string, number | undefined>)[key] = value;
    }
  }
  for (const key of Object.keys(metrics)) {
    const category = METRIC_CATEGORY[key];
    if (category && !allCategories.has(category)) delete (metrics as Record<string, number | undefined>)[key];
  }

  const signalMap = new Map<string, TokenRiskResult["signals"][number]>();
  for (const signal of previous?.signals ?? []) {
    const category = signalCategory(signal.id);
    if (!category || allCategories.has(category)) signalMap.set(signal.id, signal);
  }
  for (const signal of current.signals ?? []) {
    const category = signalCategory(signal.id);
    if (!category || currentLiveCategories.has(category)) signalMap.set(signal.id, signal);
  }

  const token = current.token?.symbol ? current.token : previous?.token ?? current.token;
  const sourceLabels = receipts.map((receipt) => `${receipt.providerId} · verified snapshot`);
  const sanitized: TokenRiskResult = {
    ...current,
    token,
    metrics,
    signals: Array.from(signalMap.values()),
    dataSources: Array.from(new Set(sourceLabels)),
    providerEvidenceReceipts: receipts,
    providerEvidenceLedger: undefined,
    providerEvidencePersistence: undefined,
    pass4653Continuity: undefined,
    limitations: Array.from(new Set([...(current.limitations ?? []), ...(previous?.limitations ?? [])]))
      .filter((item) => !/continuity cache|replayed from/i.test(item)),
    generatedAt: current.generatedAt || args.storedAt.toISOString(),
  };
  return sanitized;
}

export function buildPass4653ContinuitySnapshot(args: {
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  result: TokenRiskResult;
  previousSnapshot?: Pass4653ContinuitySnapshot | null;
  storedAt?: string | Date;
}): Pass4653ContinuitySnapshot | null {
  const storedAt = args.storedAt instanceof Date ? args.storedAt : args.storedAt ? new Date(args.storedAt) : new Date();
  const safeStoredAt = Number.isFinite(storedAt.getTime()) ? storedAt : new Date();
  const sanitized = sanitizeSnapshotResult({ result: args.result, previousSnapshot: args.previousSnapshot, storedAt: safeStoredAt });
  if (!sanitized) return null;
  const requestedIdentity = normalizedIdentity(args.requestedIdentity);
  const receipts = sanitized.providerEvidenceReceipts ?? [];
  const snapshotId = `p4653_${sha256(stableSerialize({
    requestedIdentity,
    surface: args.surface,
    storedAt: safeStoredAt.toISOString(),
    receipts: receipts.map((receipt) => `${receipt.receiptId}:${receipt.payloadHash}`).sort(),
  })).slice(0, 28)}`;
  const base: Omit<Pass4653ContinuitySnapshot, "snapshotHash" | "snapshotAuth"> = {
    schemaVersion: "pass4653_continuity_snapshot_v1",
    snapshotId,
    requestedIdentity,
    surface: args.surface,
    storedAt: safeStoredAt.toISOString(),
    sourceGeneratedAt: sanitized.generatedAt,
    result: sanitized,
  };
  const payload = snapshotHashPayload(base);
  const snapshotHash = sha256(payload);
  const secret = continuityHmacSecret();
  const snapshotAuth = secret
    ? {
        algorithm: "hmac-sha256" as const,
        keyId: sha256(secret).slice(0, 12),
        tag: snapshotAuthTag(snapshotHash, payload, secret),
      }
    : undefined;
  return { ...base, snapshotHash, ...(snapshotAuth ? { snapshotAuth } : {}) };
}

export function verifyPass4653ContinuitySnapshot(snapshot: Pass4653ContinuitySnapshot) {
  const { snapshotHash, snapshotAuth, ...base } = snapshot;
  const payload = snapshotHashPayload(base);
  const expectedHash = sha256(payload);
  const secret = continuityHmacSecret();
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const expectedAuthTag = secret ? snapshotAuthTag(expectedHash, payload, secret) : null;
  const authValid = Boolean(
    snapshotAuth?.algorithm === "hmac-sha256" &&
    expectedAuthTag &&
    safeTagEqual(snapshotAuth.tag, expectedAuthTag),
  );
  const receipts = snapshot.result.providerEvidenceReceipts ?? [];
  const blockers = [
    snapshot.schemaVersion !== "pass4653_continuity_snapshot_v1" ? "snapshot_schema_invalid" : null,
    snapshotHash !== expectedHash ? "snapshot_hash_mismatch" : null,
    secret && !snapshotAuth ? "snapshot_hmac_missing" : null,
    secret && snapshotAuth && !authValid ? "snapshot_hmac_mismatch" : null,
    productionLike && !secret ? "snapshot_hmac_secret_missing" : null,
    !Number.isFinite(Date.parse(snapshot.storedAt)) ? "snapshot_stored_at_invalid" : null,
    normalizedIdentity(snapshot.requestedIdentity) === "unknown" ? "snapshot_identity_invalid" : null,
    receipts.length === 0 ? "snapshot_receipts_missing" : null,
    receipts.some((receipt) => Boolean(receipt.continuity)) ? "snapshot_contains_replayed_receipt" : null,
    receipts.some((receipt) => !isPass4644CommerciallyFreshReceipt(receipt, Date.parse(snapshot.storedAt))) ? "snapshot_contains_ineligible_receipt" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    valid: blockers.length === 0,
    blockers,
    expectedHash,
    authMode: snapshotAuth ? "hmac-sha256" : "sha256-only",
    authValid: snapshotAuth ? authValid : !productionLike && !secret,
  } as const;
}

async function persistFilesystem(snapshot: Pass4653ContinuitySnapshot, directory: string): Promise<Pass4653ContinuityPersistence> {
  const verification = verifyPass4653ContinuitySnapshot(snapshot);
  if (!verification.valid) return { schemaVersion: "pass4653_continuity_persistence_v1", durable: false, mode: "filesystem", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified: false, locator: null, blockers: verification.blockers };
  const key = cacheKey(snapshot.requestedIdentity, snapshot.surface);
  const boundary = {
    rootDirectory: directory,
    fileName: fileNameForKey(key),
    maximumBytes: 16 * 1024 * 1024,
    label: "continuity-snapshot",
  } as const;
  const writeReceipt = await writeDurableJsonAtomic(boundary, snapshot);
  const stored = await readDurableJsonBounded<Pass4653ContinuitySnapshot>(boundary);
  const readBack = verifyPass4653ContinuitySnapshot(stored);
  const readBackVerified = writeReceipt.readBackVerified && readBack.valid && stored.snapshotHash === snapshot.snapshotHash;
  return { schemaVersion: "pass4653_continuity_persistence_v1", durable: readBackVerified, mode: "filesystem", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified, locator: readBackVerified ? writeReceipt.filePath : null, blockers: readBack.blockers };
}

async function persistSupabase(snapshot: Pass4653ContinuitySnapshot, url: string, serviceRoleKey: string): Promise<Pass4653ContinuityPersistence> {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/provider_evidence_snapshots?on_conflict=cache_key`;
  const key = cacheKey(snapshot.requestedIdentity, snapshot.surface);
  const response = await brokeredConfiguredOriginFetch(endpoint, {
    method: "POST",
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ cache_key: key, snapshot_id: snapshot.snapshotId, requested_identity: snapshot.requestedIdentity, surface: snapshot.surface, snapshot_hash: snapshot.snapshotHash, stored_at: snapshot.storedAt, payload: snapshot }),
    cache: "no-store",
  }, { configuredProfile: "supabase", operation: "continuity_snapshot_write", timeoutMs: 5_000 });
  if (!response.ok) return { schemaVersion: "pass4653_continuity_persistence_v1", durable: false, mode: "supabase", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified: false, locator: null, blockers: [`supabase_http_${response.status}`] };
  const rows = await readJsonResponseBounded<Array<{ snapshot_hash?: unknown; snapshot_id?: unknown }>>(response, 2_000_000).catch(() => []);
  const row = rows[0];
  const readBackVerified = row?.snapshot_hash === snapshot.snapshotHash && row?.snapshot_id === snapshot.snapshotId;
  return { schemaVersion: "pass4653_continuity_persistence_v1", durable: readBackVerified, mode: "supabase", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified, locator: readBackVerified ? `supabase:provider_evidence_snapshots:${key}` : null, blockers: readBackVerified ? [] : ["supabase_readback_mismatch"] };
}

export async function persistPass4653ContinuitySnapshot(snapshot: Pass4653ContinuitySnapshot): Promise<Pass4653ContinuityPersistence> {
  const verification = verifyPass4653ContinuitySnapshot(snapshot);
  if (!verification.valid) return { schemaVersion: "pass4653_continuity_persistence_v1", durable: false, mode: "not_configured", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified: false, locator: null, blockers: verification.blockers };
  const key = cacheKey(snapshot.requestedIdentity, snapshot.surface);
  const store = memoryStore();
  store.set(key, snapshot);
  if (store.size > MAX_MEMORY_SNAPSHOTS) store.delete(store.keys().next().value as string);
  const directory = continuityDirectory();
  if (directory) return persistFilesystem(snapshot, directory);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceRoleKey) return persistSupabase(snapshot, supabaseUrl, serviceRoleKey);
  return { schemaVersion: "pass4653_continuity_persistence_v1", durable: false, mode: "memory", snapshotId: snapshot.snapshotId, snapshotHash: snapshot.snapshotHash, readBackVerified: true, locator: `memory:${key}`, blockers: ["continuity_store_not_durable"] };
}

async function readSupabase(requestedIdentity: string, surface: Pass4644ProviderSurface, url: string, serviceRoleKey: string) {
  const key = cacheKey(requestedIdentity, surface);
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/provider_evidence_snapshots?cache_key=eq.${encodeURIComponent(key)}&select=payload&limit=1`;
  const response = await brokeredConfiguredOriginFetch(endpoint, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store" }, { configuredProfile: "supabase", operation: "continuity_snapshot_read", timeoutMs: 5_000 });
  if (!response.ok) return null;
  const rows = await readJsonResponseBounded<Array<{ payload?: unknown }>>(response, 2_000_000).catch(() => []);
  const payload = rows[0]?.payload;
  return payload && typeof payload === "object"
    ? payload as Pass4653ContinuitySnapshot
    : undefined;
}

export async function readPass4653ContinuitySnapshot(args: { requestedIdentity: string; surface: Pass4644ProviderSurface }): Promise<Pass4653ContinuitySnapshot | null> {
  const key = cacheKey(args.requestedIdentity, args.surface);
  const memory = memoryStore().get(key);
  if (memory && verifyPass4653ContinuitySnapshot(memory).valid) return JSON.parse(JSON.stringify(memory)) as Pass4653ContinuitySnapshot;
  const directory = continuityDirectory();
  if (directory) {
    try {
      const snapshot = await readDurableJsonBounded<Pass4653ContinuitySnapshot>({
        rootDirectory: directory,
        fileName: fileNameForKey(key),
        maximumBytes: 16 * 1024 * 1024,
        label: "continuity-snapshot",
      });
      if (verifyPass4653ContinuitySnapshot(snapshot).valid) { memoryStore().set(key, snapshot); return snapshot; }
    } catch { /* cache miss */ }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceRoleKey) {
    const snapshot = await readSupabase(args.requestedIdentity, args.surface, supabaseUrl, serviceRoleKey).catch(() => null);
    if (snapshot && verifyPass4653ContinuitySnapshot(snapshot).valid) { memoryStore().set(key, snapshot); return snapshot; }
  }
  return null;
}

function replayReceipt(args: { receipt: Pass4644ProviderEvidenceReceipt; snapshot: Pass4653ContinuitySnapshot; requestedIdentity: string; now: Date; reason: Pass4653ContinuityReceiptMeta["reason"] }) {
  const graceMs = graceForReceipt(args.receipt);
  const observedMs = Date.parse(args.receipt.observedAt);
  if (!Number.isFinite(observedMs) || graceMs <= 0 || observedMs + graceMs < args.now.getTime()) return null;
  const identityMatched = pass4644IdentityMatches(args.requestedIdentity, {
    symbol: args.receipt.identity.resolvedSymbol,
    marketId: args.receipt.identity.resolvedMarketId,
    address: args.receipt.identity.resolvedAddress,
  });
  const receipt = createPass4644ProviderEvidenceReceipt({
    providerId: args.receipt.providerId,
    providerFamily: args.receipt.providerFamily,
    surface: args.receipt.surface,
    verification: "normalized_response",
    requestedIdentity: args.requestedIdentity,
    resolvedSymbol: args.receipt.identity.resolvedSymbol,
    resolvedMarketId: args.receipt.identity.resolvedMarketId,
    resolvedAddress: args.receipt.identity.resolvedAddress,
    resolvedChainId: args.receipt.identity.resolvedChainId,
    identityMatched,
    capabilities: args.receipt.capabilities,
    timestampProvenance: args.receipt.timestampProvenance === "provider" ? "provider" : "transport_received",
    observedAt: args.receipt.observedAt,
    receivedAt: args.now,
    ttlMs: graceMs,
    httpStatus: 200,
    latencyMs: 0,
    normalizedPayload: { originalPayloadHash: args.receipt.payloadHash, snapshotHash: args.snapshot.snapshotHash, replayedFromReceiptId: args.receipt.receiptId },
  });
  receipt.continuity = {
    schemaVersion: "pass4653_continuity_receipt_v1",
    replayedFromReceiptId: args.receipt.receiptId,
    snapshotHash: args.snapshot.snapshotHash,
    originalObservedAt: args.receipt.observedAt,
    graceExpiresAt: new Date(observedMs + graceMs).toISOString(),
    replayedAt: args.now.toISOString(),
    reason: args.reason,
  };
  return receipt;
}

function requiredContinuityCategories(surface: Pass4644ProviderSurface, assetClass: TokenRiskResult["token"]["assetClass"], tier: "pro" | "advanced"): Pass4650EvidenceCategory[] {
  if (surface === "contract_audit") {
    return tier === "pro"
      ? ["identity", "contract_permissions", "liquidity", "holders_ownership"]
      : ["identity", "contract_permissions", "liquidity", "holders_ownership", "scenario_dependency"];
  }
  if (assetClass === "crypto" || assetClass === "unknown") {
    return tier === "pro"
      ? ["identity", "market", "liquidity", "holders_ownership"]
      : ["identity", "market", "liquidity", "holders_ownership", "contract_permissions", "scenario_dependency"];
  }
  if (["fx", "commodity", "index"].includes(assetClass ?? "unknown")) {
    return tier === "pro"
      ? ["identity", "market", "history_volatility", "macro_rates"]
      : ["identity", "market", "history_volatility", "macro_rates", "derivatives_microstructure", "scenario_dependency"];
  }
  return tier === "pro"
    ? ["identity", "market", "history_volatility", "fundamentals_filings"]
    : ["identity", "market", "history_volatility", "fundamentals_filings", "macro_rates", "scenario_dependency"];
}

function paidContinuityEligibility(args: {
  surface: Pass4644ProviderSurface;
  assetClass: TokenRiskResult["token"]["assetClass"];
  snapshotAgeMs: number;
  liveState: ReturnType<typeof liveCoreState>;
  replayed: Pass4644ProviderEvidenceReceipt[];
}) {
  const liveReceipts = args.liveState.live;
  const combined = [...liveReceipts, ...args.replayed];
  const families = new Set(combined.map((receipt) => receipt.providerFamily));
  const categories = new Set(combined.flatMap(receiptCategories));
  const requiredPro = requiredContinuityCategories(args.surface, args.assetClass, "pro");
  const requiredAdvanced = requiredContinuityCategories(args.surface, args.assetClass, "advanced");
  const cacheOnlyMaxAgeMs = args.surface === "contract_audit" ? 15 * 60_000 : 90_000;
  const mixedAdvancedMaxAgeMs = args.surface === "contract_audit" ? 30 * 60_000 : 90_000;
  const proThreshold = args.surface === "contract_audit"
    ? { receipts: 4, families: 3, categories: 4 }
    : { receipts: 6, families: 2, categories: 4 };
  const advancedThreshold = args.surface === "contract_audit"
    ? { receipts: 5, families: 4, categories: 5 }
    : { receipts: 10, families: 3, categories: 6 };

  const replayProReady = args.replayed.length >= proThreshold.receipts &&
    families.size >= proThreshold.families &&
    categories.size >= proThreshold.categories &&
    requiredPro.every((category) => categories.has(category));
  const combinedAdvancedReady = combined.length >= advancedThreshold.receipts &&
    families.size >= advancedThreshold.families &&
    categories.size >= advancedThreshold.categories &&
    requiredAdvanced.every((category) => categories.has(category));

  // A very short, cryptographically verified continuity window may keep Pro
  // purchasable during a total provider interruption. Advanced always needs at
  // least one live core lane; cached-only Advanced is intentionally forbidden.
  const pro = args.liveState.pro || (
    liveReceipts.length === 0 &&
    args.snapshotAgeMs <= cacheOnlyMaxAgeMs &&
    replayProReady
  );
  const advanced = args.liveState.advanced || (
    args.liveState.pro &&
    args.snapshotAgeMs <= mixedAdvancedMaxAgeMs &&
    combinedAdvancedReady
  );
  return { pro, advanced, replayProReady, combinedAdvancedReady };
}

function liveCoreState(surface: Pass4644ProviderSurface, receipts: Pass4644ProviderEvidenceReceipt[], now: Date) {
  const live = receipts.filter((receipt) => !receipt.continuity && isPass4644CommerciallyFreshReceipt(receipt, now));
  const families = Array.from(new Set(live.map((receipt) => receipt.providerFamily)));
  const categories = Array.from(new Set(live.flatMap(receiptCategories)));
  if (surface === "contract_audit") {
    const coreFamilies = new Set(live.filter((receipt) => receiptCategories(receipt).some((category) => category === "identity" || category === "contract_permissions")).map((receipt) => receipt.providerFamily));
    return {
      live,
      families,
      categories,
      pro: categories.includes("identity") && categories.includes("contract_permissions") && coreFamilies.size >= 1,
      advanced: categories.includes("identity") && categories.includes("contract_permissions") && coreFamilies.size >= 2,
    };
  }
  const marketFamilies = new Set(live.filter((receipt) => receiptCategories(receipt).includes("market")).map((receipt) => receipt.providerFamily));
  return {
    live,
    families,
    categories,
    pro: marketFamilies.size >= 1,
    advanced: marketFamilies.size >= 2,
  };
}

export function hydratePass4653ContinuityEvidence(args: {
  currentResult: TokenRiskResult;
  snapshot: Pass4653ContinuitySnapshot | null;
  requestedIdentity: string;
  surface?: Pass4644ProviderSurface;
  now?: string | Date;
  reason?: Pass4653ContinuityReceiptMeta["reason"];
}) {
  const now = args.now instanceof Date ? args.now : args.now ? new Date(args.now) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  let current = cloneResult(args.currentResult);
  const inferredSurface: Pass4644ProviderSurface = args.surface ?? (current.token.assetClass && current.token.assetClass !== "crypto" && current.token.assetClass !== "unknown" ? "real_markets" : "crypto");
  const liveState = liveCoreState(inferredSurface, current.providerEvidenceReceipts ?? [], safeNow);
  const blockers: string[] = [];

  const noSnapshot: Pass4653ContinuityHydration = {
    schemaVersion: "pass4653_continuity_hydration_v1",
    mode: liveState.live.length ? "live" : "unavailable",
    cacheHit: false,
    snapshotId: null,
    snapshotAgeMs: null,
    replayedReceiptCount: 0,
    replayedProviderFamilies: [],
    replayedCategories: [],
    liveReceiptCount: liveState.live.length,
    liveProviderFamilies: liveState.families,
    liveCategories: liveState.categories,
    liveCoreReadyForPro: liveState.pro,
    liveCoreReadyForAdvanced: liveState.advanced,
    paidContinuityEligible: { pro: liveState.pro, advanced: liveState.advanced },
    totalProviderOutage: liveState.live.length === 0,
    blockers: liveState.live.length ? [] : ["continuity_snapshot_missing"],
  };

  if (!args.snapshot) {
    current.pass4653Continuity = noSnapshot;
    return { result: current, continuity: noSnapshot };
  }
  const verification = verifyPass4653ContinuitySnapshot(args.snapshot);
  if (!verification.valid) blockers.push(...verification.blockers);
  if (args.snapshot.surface !== inferredSurface) blockers.push("continuity_surface_mismatch");
  if (normalizedIdentity(args.snapshot.requestedIdentity) !== normalizedIdentity(args.requestedIdentity)) blockers.push("continuity_requested_identity_mismatch");
  const snapshotIdentityMatches = pass4644IdentityMatches(args.requestedIdentity, { symbol: args.snapshot.result.token.symbol, marketId: args.snapshot.result.token.marketId, address: args.snapshot.result.token.tokenAddress });
  if (!snapshotIdentityMatches) blockers.push("continuity_asset_identity_mismatch");
  if (blockers.length) {
    const invalid = { ...noSnapshot, snapshotId: args.snapshot.snapshotId, snapshotAgeMs: Math.max(0, safeNow.getTime() - Date.parse(args.snapshot.storedAt)), blockers };
    current.pass4653Continuity = invalid;
    return { result: current, continuity: invalid };
  }

  const replayed = (args.snapshot.result.providerEvidenceReceipts ?? [])
    .filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt))
    .map((receipt) => replayReceipt({ receipt, snapshot: args.snapshot!, requestedIdentity: args.requestedIdentity, now: safeNow, reason: args.reason ?? "provider_outage" }))
    .filter((receipt): receipt is Pass4644ProviderEvidenceReceipt => Boolean(receipt));
  const replayedCategories = Array.from(new Set(replayed.flatMap(receiptCategories)));
  const replayedFamilies = Array.from(new Set(replayed.map((receipt) => receipt.providerFamily)));

  if (replayed.length) {
    const cached = args.snapshot.result;
    if (liveState.live.length === 0) {
      // Replay one complete, authenticated derived state. Mixing cached metrics or
      // signals into a separately scored current result would make score, level,
      // agents and uncertainty internally inconsistent.
      current = cloneResult(cached);
      current.providerEvidenceReceipts = [];
      current.dataQuality = "partial";
      current.empiricalCalibration = undefined;
      current.uncertainty = current.uncertainty
        ? {
            ...current.uncertainty,
            empiricalCalibrationStatus: "expired",
            probabilityClaimAllowed: false,
            calibrationProfileId: undefined,
            drivers: Array.from(new Set([...current.uncertainty.drivers, "continuity_snapshot_replay"])),
          }
        : current.uncertainty;
    }
    current.limitations = Array.from(new Set([
      ...(current.limitations ?? []),
      liveState.live.length === 0
        ? "The complete derived result was replayed from one authenticated continuity snapshot; empirical probability claims are disabled until a fresh recomputation."
        : "Continuity receipts are attached as availability metadata only; cached metrics and signals were not merged into the current derived score.",
      "Paid tiers still require the declared live-core or short authenticated continuity policy.",
    ]));
    attachPass4644ProviderReceipts(current, replayed);
  }

  const snapshotAgeMs = Math.max(0, safeNow.getTime() - Date.parse(args.snapshot.storedAt));
  const paidEligibility = paidContinuityEligibility({
    surface: inferredSurface,
    assetClass: current.token.assetClass,
    snapshotAgeMs,
    liveState,
    replayed,
  });
  const mode: Pass4653ContinuityMode = liveState.live.length && replayed.length
    ? "continuity"
    : liveState.live.length
      ? "live"
      : paidEligibility.pro
        ? "continuity"
        : replayed.length
          ? "degraded_basic_only"
          : "unavailable";
  const continuity: Pass4653ContinuityHydration = {
    schemaVersion: "pass4653_continuity_hydration_v1",
    mode,
    cacheHit: replayed.length > 0,
    snapshotId: args.snapshot.snapshotId,
    snapshotAgeMs,
    replayedReceiptCount: replayed.length,
    replayedProviderFamilies: replayedFamilies,
    replayedCategories,
    liveReceiptCount: liveState.live.length,
    liveProviderFamilies: liveState.families,
    liveCategories: liveState.categories,
    liveCoreReadyForPro: liveState.pro,
    liveCoreReadyForAdvanced: liveState.advanced,
    paidContinuityEligible: { pro: paidEligibility.pro, advanced: paidEligibility.advanced },
    totalProviderOutage: liveState.live.length === 0,
    blockers: replayed.length
      ? [
          !paidEligibility.pro && liveState.live.length === 0 ? "continuity_not_sell_ready_for_pro" : null,
          !paidEligibility.advanced ? "continuity_not_sell_ready_for_advanced" : null,
        ].filter((value): value is string => Boolean(value))
      : ["continuity_snapshot_outside_grace"],
  };
  current.pass4653Continuity = continuity;
  return { result: current, continuity };
}
