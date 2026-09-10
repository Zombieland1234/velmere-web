import { readJsonResponseBounded, readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { MarketCandle } from "./binance-klines";
import {
  canonicalKlineIdentityDigest,
  canonicalKlineSnapshotKey,
  isCanonicalKlineAssetIdentity,
  sameKlineIdentity,
  type KlineAssetIdentity,
} from "./kline-asset-identity";

export const PASS6_KLINE_SNAPSHOT_INTEGRITY_ID = "pass6-kline-snapshot-integrity-v1" as const;

export type KlineSourceObservation = {
  provider: string;
  observedAt: string;
  receivedAt: string;
};

export type KlineSnapshot = {
  key: string;
  assetIdentity: KlineAssetIdentity;
  identityDigest: string;
  pair: string;
  range: string;
  source: string;
  generatedAt: string;
  receivedAt: string;
  sourceObservations: KlineSourceObservation[];
  latestClosedAt: string;
  storedAt: number;
  expiresAt: number;
  payloadHash: string;
  payloadMac: string;
  integrityMode: "hmac_sha256" | "sha256_qa";
  integrityKeyId: string;
  candles: MarketCandle[];
};

export type KlineSnapshotPersistenceMode = "memory" | "supabase" | "memory_and_supabase";

export type KlineSnapshotPersistReceipt = {
  stored: boolean;
  mode: KlineSnapshotPersistenceMode;
  key: string;
  barCount: number;
  payloadHash: string;
  payloadMac: string;
  integrityMode: KlineSnapshot["integrityMode"] | "unavailable";
  integrityKeyId: string | null;
  durableConfigured: boolean;
  durableStored: boolean;
  latencyMs: number;
  error?: string;
};

export type KlineSnapshotReadResult = KlineSnapshot & {
  ageMs: number;
  storedAgeMs: number;
  sourceAgeMs: number;
  candleAgeMs: number;
  readMode: "memory" | "supabase";
};

type KlineSnapshotStore = {
  entries: Map<string, KlineSnapshot>;
  lastPersistAt?: string;
  lastDurablePersistAt?: string;
  lastDurableReadAt?: string;
  lastError?: string;
};

const GLOBAL_KEY = "__velmereKlineSnapshotCachePass6";
const MAX_ENTRIES = 36;
const MAX_BARS = 1_400;
const MIN_BARS = 8;
const MAX_SERIALIZED_BYTES = 1_500_000;
const DEFAULT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const DURABLE_TIMEOUT_MS = 2_500;
const TABLE = "velmere_kline_snapshots";
const RANGE_INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "1mo": 24 * 60 * 60_000,
};

type GlobalWithKlineSnapshots = typeof globalThis & {
  [GLOBAL_KEY]?: KlineSnapshotStore;
};

function store(): KlineSnapshotStore {
  const root = globalThis as GlobalWithKlineSnapshots;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = { entries: new Map() };
  return root[GLOBAL_KEY]!;
}

function keyFor(identity: KlineAssetIdentity, range: string) {
  return canonicalKlineSnapshotKey(identity, range);
}

function cloneCandles(candles: MarketCandle[]) {
  return candles.map((candle) => ({ ...candle }));
}

function validCandle(candle: MarketCandle) {
  return (
    Number.isFinite(candle.timestamp) &&
    candle.timestamp > 0 &&
    Number.isFinite(candle.open) &&
    candle.open > 0 &&
    Number.isFinite(candle.high) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    Number.isFinite(candle.low) &&
    candle.low > 0 &&
    candle.low <= Math.min(candle.open, candle.close) &&
    Number.isFinite(candle.close) &&
    candle.close > 0 &&
    Number.isFinite(candle.volume) &&
    candle.volume >= 0
  );
}

function pairMatchesIdentity(identity: KlineAssetIdentity, pair: string) {
  const normalized = pair.trim().toUpperCase().replace(/-/gu, "");
  const venueBase = identity.symbol === "BTC" ? "XBT" : identity.symbol === "DOGE" ? "XDG" : identity.symbol;
  return new Set([
    `${identity.symbol}USD`,
    `${venueBase}USD`,
    `X${identity.symbol}ZUSD`,
    `X${venueBase}ZUSD`,
  ]).has(normalized);
}

function normalizeCandles(candles: MarketCandle[]) {
  const byTimestamp = new Map<number, MarketCandle>();
  for (const candle of candles.slice(-MAX_BARS)) {
    if (!validCandle(candle) || byTimestamp.has(candle.timestamp)) continue;
    byTimestamp.set(candle.timestamp, { ...candle });
  }
  return Array.from(byTimestamp.values()).sort((left, right) => left.timestamp - right.timestamp);
}

function canonicalSnapshotPayload(input: {
  assetIdentity: KlineAssetIdentity;
  identityDigest: string;
  pair: string;
  range: string;
  source: string;
  generatedAt: string;
  receivedAt: string;
  sourceObservations: KlineSourceObservation[];
  latestClosedAt: string;
  candles: MarketCandle[];
}) {
  return JSON.stringify({
    schemaVersion: PASS6_KLINE_SNAPSHOT_INTEGRITY_ID,
    assetIdentity: input.assetIdentity,
    identityDigest: input.identityDigest,
    pair: input.pair.trim().toUpperCase(),
    range: input.range.trim().toLowerCase(),
    source: input.source.trim().slice(0, 500),
    generatedAt: input.generatedAt,
    receivedAt: input.receivedAt,
    sourceObservations: input.sourceObservations,
    latestClosedAt: input.latestClosedAt,
    candles: input.candles.map((candle) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      ...(typeof candle.quoteVolume === "number" && Number.isFinite(candle.quoteVolume) ? { quoteVolume: candle.quoteVolume } : {}),
      ...(typeof candle.trades === "number" && Number.isFinite(candle.trades) ? { trades: candle.trades } : {}),
    })),
  });
}

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function validHmacSecret(value: string | undefined) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}

function integrityKeys() {
  const current = validHmacSecret(process.env.VELMERE_KLINE_SNAPSHOT_HMAC_KEY_CURRENT);
  const previous = validHmacSecret(process.env.VELMERE_KLINE_SNAPSHOT_HMAC_KEY_PREVIOUS);
  const idFor = (secret: string, configured: string | undefined) =>
    configured?.trim().slice(0, 64) || `key-${createHash("sha256").update(secret).digest("hex").slice(0, 12)}`;
  return {
    current: current ? { secret: current, id: idFor(current, process.env.VELMERE_KLINE_SNAPSHOT_HMAC_KEY_ID_CURRENT) } : null,
    previous: previous ? { secret: previous, id: idFor(previous, process.env.VELMERE_KLINE_SNAPSHOT_HMAC_KEY_ID_PREVIOUS) } : null,
  };
}

function constantTimeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function hmacPayload(canonical: string, secret: string) {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

function signSnapshotPayload(canonical: string, payloadHash: string) {
  const keys = integrityKeys();
  if (keys.current) {
    return {
      payloadMac: hmacPayload(canonical, keys.current.secret),
      integrityMode: "hmac_sha256" as const,
      integrityKeyId: keys.current.id,
    };
  }
  if (productionLike()) return null;
  return { payloadMac: payloadHash, integrityMode: "sha256_qa" as const, integrityKeyId: "qa-no-secret" };
}

function verifySnapshotIntegrity(entry: KlineSnapshot) {
  const canonical = canonicalSnapshotPayload(entry);
  const expectedHash = createHash("sha256").update(canonical).digest("hex");
  if (!constantTimeHexEqual(expectedHash, entry.payloadHash)) return false;
  if (entry.integrityMode === "sha256_qa") {
    return !productionLike() && entry.integrityKeyId === "qa-no-secret" && constantTimeHexEqual(entry.payloadHash, entry.payloadMac);
  }
  const keys = integrityKeys();
  const candidates = [keys.current, keys.previous].filter((key): key is NonNullable<typeof key> => Boolean(key));
  return candidates.some((key) => key.id === entry.integrityKeyId && constantTimeHexEqual(hmacPayload(canonical, key.secret), entry.payloadMac));
}

function normalizeSourceObservations(rows: KlineSourceObservation[]) {
  const seen = new Set<string>();
  return rows.slice(0, 8).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    if (typeof row.provider !== "string" || typeof row.observedAt !== "string" || typeof row.receivedAt !== "string") return [];
    const provider = row.provider.trim().toLowerCase().replace(/[^a-z0-9_-]/gu, "").slice(0, 40);
    const observed = Date.parse(row.observedAt);
    const received = Date.parse(row.receivedAt);
    if (
      !provider || seen.has(provider) ||
      !Number.isFinite(observed) || !Number.isFinite(received) ||
      observed > received + 5_000
    ) return [];
    seen.add(provider);
    return [{ provider, observedAt: new Date(observed).toISOString(), receivedAt: new Date(received).toISOString() }];
  });
}

function snapshotFreshness(entry: KlineSnapshot, now = Date.now()) {
  const storedAgeMs = now - entry.storedAt;
  const received = Date.parse(entry.receivedAt);
  const latestClosed = Date.parse(entry.latestClosedAt);
  const sourceTimestamps = entry.sourceObservations.map((row) => Date.parse(row.observedAt));
  const sourceReceivedTimestamps = entry.sourceObservations.map((row) => Date.parse(row.receivedAt));
  if (
    !Number.isFinite(received) || !Number.isFinite(latestClosed) ||
    sourceTimestamps.some((timestamp) => !Number.isFinite(timestamp)) ||
    sourceReceivedTimestamps.some((timestamp) => !Number.isFinite(timestamp))
  ) return null;
  const sourceAgeMs = Math.max(
    0,
    now - received,
    ...sourceTimestamps.map((timestamp) => now - timestamp),
    ...sourceReceivedTimestamps.map((timestamp) => now - timestamp),
  );
  const candleAgeMs = Math.max(0, now - latestClosed);
  const future = [entry.storedAt, received, latestClosed, ...sourceTimestamps, ...sourceReceivedTimestamps]
    .some((timestamp) => timestamp > now + 5_000);
  if (future || storedAgeMs < -5_000) return null;
  return { storedAgeMs: Math.max(0, storedAgeMs), sourceAgeMs, candleAgeMs, ageMs: Math.max(0, storedAgeMs, sourceAgeMs, candleAgeMs) };
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown durable snapshot error";
  return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 280);
}

function buildSnapshot(input: {
  assetIdentity: KlineAssetIdentity;
  pair: string;
  range: string;
  source: string;
  generatedAt?: string;
  receivedAt: string;
  sourceObservations: KlineSourceObservation[];
  latestClosedAt: string;
  ttlMs?: number;
  candles: MarketCandle[];
}) {
  const candles = normalizeCandles(input.candles);
  if (candles.length < MIN_BARS) return null;
  if (!isCanonicalKlineAssetIdentity(input.assetIdentity)) return null;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) return null;
  const receivedAtMs = Date.parse(input.receivedAt);
  const latestClosedAtMs = Date.parse(input.latestClosedAt);
  const sourceObservations = normalizeSourceObservations(input.sourceObservations);
  if (!Number.isFinite(receivedAtMs) || !Number.isFinite(latestClosedAtMs) || sourceObservations.length < 2) return null;
  const receivedAt = new Date(receivedAtMs).toISOString();
  const latestClosedAt = new Date(latestClosedAtMs).toISOString();
  const storedAt = Date.now();
  const ttlMs = Math.max(60_000, Math.min(24 * 60 * 60 * 1000, input.ttlMs ?? DEFAULT_MAX_AGE_MS));
  const pair = input.pair.trim().toUpperCase().slice(0, 32);
  const range = input.range.trim().toLowerCase().slice(0, 16);
  const source = input.source.trim().slice(0, 500);
  const intervalMs = RANGE_INTERVAL_MS[range];
  const latestCandle = candles.at(-1);
  const sourceTimestampsValid = sourceObservations.every((row) => (
    Date.parse(row.receivedAt) <= receivedAtMs + 5_000 &&
    Date.parse(row.observedAt) <= receivedAtMs + 5_000
  ));
  if (
    !intervalMs || !latestCandle ||
    Math.abs(latestCandle.timestamp + intervalMs - latestClosedAtMs) > 2_000 ||
    receivedAtMs > generatedAtMs + 5_000 ||
    latestClosedAtMs > receivedAtMs + 5_000 ||
    !sourceTimestampsValid ||
    !/^[A-Z0-9-]{2,32}$/u.test(pair) || !pairMatchesIdentity(input.assetIdentity, pair) || !source
  ) return null;
  const identityDigest = canonicalKlineIdentityDigest(input.assetIdentity);
  const canonicalInput = { assetIdentity: input.assetIdentity, identityDigest, pair, range, source, generatedAt, receivedAt, sourceObservations, latestClosedAt, candles };
  const canonical = canonicalSnapshotPayload(canonicalInput);
  if (Buffer.byteLength(canonical, "utf8") > MAX_SERIALIZED_BYTES) return null;
  const payloadHash = createHash("sha256").update(canonical).digest("hex");
  const signature = signSnapshotPayload(canonical, payloadHash);
  if (!signature) return null;
  return {
    key: keyFor(input.assetIdentity, range),
    assetIdentity: { ...input.assetIdentity },
    identityDigest,
    pair,
    range,
    source,
    generatedAt,
    receivedAt,
    sourceObservations,
    latestClosedAt,
    storedAt,
    expiresAt: storedAt + ttlMs,
    payloadHash,
    ...signature,
    candles,
  } satisfies KlineSnapshot;
}

function rememberSnapshotEntry(entry: KlineSnapshot) {
  const state = store();
  state.entries.set(entry.key, {
    ...entry,
    assetIdentity: { ...entry.assetIdentity },
    sourceObservations: entry.sourceObservations.map((row) => ({ ...row })),
    candles: cloneCandles(entry.candles),
  });
  if (state.entries.size > MAX_ENTRIES) {
    const oldest = Array.from(state.entries.values()).sort((left, right) => left.storedAt - right.storedAt)[0];
    if (oldest) state.entries.delete(oldest.key);
  }
  state.lastPersistAt = new Date().toISOString();
  return entry;
}

export function rememberKlineSnapshot(input: {
  assetIdentity: KlineAssetIdentity;
  pair: string;
  range: string;
  source: string;
  generatedAt?: string;
  receivedAt: string;
  sourceObservations: KlineSourceObservation[];
  latestClosedAt: string;
  ttlMs?: number;
  candles: MarketCandle[];
}) {
  const entry = buildSnapshot(input);
  return entry ? rememberSnapshotEntry(entry) : null;
}

async function writeDurableSnapshot(entry: KlineSnapshot) {
  const config = getSupabaseConfig();
  if (!config) return { stored: false, configured: false as const };
  const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/${TABLE}?on_conflict=snapshot_key`, {
    method: "POST",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      snapshot_key: entry.key,
      asset_identity: entry.assetIdentity,
      identity_digest: entry.identityDigest,
      pair: entry.pair,
      range: entry.range,
      source: entry.source,
      generated_at: entry.generatedAt,
      received_at: entry.receivedAt,
      source_observations: entry.sourceObservations,
      latest_closed_at: entry.latestClosedAt,
      stored_at: new Date(entry.storedAt).toISOString(),
      expires_at: new Date(entry.expiresAt).toISOString(),
      bar_count: entry.candles.length,
      payload_hash: entry.payloadHash,
      payload_mac: entry.payloadMac,
      integrity_mode: entry.integrityMode,
      integrity_key_id: entry.integrityKeyId,
      candles: entry.candles,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(DURABLE_TIMEOUT_MS),
  }, { configuredProfile: "supabase", operation: "kline_snapshot_write", timeoutMs: DURABLE_TIMEOUT_MS });
  if (!response.ok) {
    const detail = await readTextResponseBounded(response, 64 * 1024).catch(() => "");
    throw new Error(`supabase snapshot write ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }
  return { stored: true, configured: true as const };
}

export async function persistKlineSnapshot(input: {
  assetIdentity: KlineAssetIdentity;
  pair: string;
  range: string;
  source: string;
  generatedAt?: string;
  receivedAt: string;
  sourceObservations: KlineSourceObservation[];
  latestClosedAt: string;
  ttlMs?: number;
  candles: MarketCandle[];
}): Promise<KlineSnapshotPersistReceipt> {
  const startedAt = Date.now();
  const entry = rememberKlineSnapshot(input);
  const configured = Boolean(getSupabaseConfig());
  if (!entry) {
    return {
      stored: false,
      mode: "memory",
      key: keyFor(input.assetIdentity, input.range),
      barCount: 0,
      payloadHash: "",
      payloadMac: "",
      integrityMode: "unavailable",
      integrityKeyId: null,
      durableConfigured: configured,
      durableStored: false,
      latencyMs: Date.now() - startedAt,
      error: productionLike() && !integrityKeys().current
        ? "Snapshot rejected: current HMAC key is required in production"
        : "Snapshot rejected: identity, timestamps, source quorum, candles or payload are invalid",
    };
  }

  try {
    const durable = await writeDurableSnapshot(entry);
    if (durable.stored) store().lastDurablePersistAt = new Date().toISOString();
    store().lastError = undefined;
    return {
      stored: true,
      mode: durable.stored ? "memory_and_supabase" : "memory",
      key: entry.key,
      barCount: entry.candles.length,
      payloadHash: entry.payloadHash,
      payloadMac: entry.payloadMac,
      integrityMode: entry.integrityMode,
      integrityKeyId: entry.integrityKeyId,
      durableConfigured: durable.configured,
      durableStored: durable.stored,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = safeError(error);
    store().lastError = message;
    return {
      stored: true,
      mode: "memory",
      key: entry.key,
      barCount: entry.candles.length,
      payloadHash: entry.payloadHash,
      payloadMac: entry.payloadMac,
      integrityMode: entry.integrityMode,
      integrityKeyId: entry.integrityKeyId,
      durableConfigured: configured,
      durableStored: false,
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
}

export function readKlineSnapshot(input: {
  assetIdentity: KlineAssetIdentity;
  range: string;
  maxAgeMs?: number;
}): KlineSnapshotReadResult | null {
  const entry = store().entries.get(keyFor(input.assetIdentity, input.range));
  if (!entry) return null;
  if (!sameKlineIdentity(entry.assetIdentity, input.assetIdentity)) return null;
  const freshness = snapshotFreshness(entry);
  const maxAgeMs = Math.max(60_000, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  if (!freshness || freshness.ageMs > maxAgeMs || Date.now() > entry.expiresAt) return null;
  if (!verifySnapshotIntegrity(entry)) {
    store().entries.delete(entry.key);
    store().lastError = "Memory snapshot integrity mismatch";
    return null;
  }
  return {
    ...entry,
    assetIdentity: { ...entry.assetIdentity },
    sourceObservations: entry.sourceObservations.map((row) => ({ ...row })),
    candles: cloneCandles(entry.candles),
    ...freshness,
    readMode: "memory",
  };
}

type DurableSnapshotRow = {
  snapshot_key?: unknown;
  asset_identity?: unknown;
  identity_digest?: unknown;
  pair?: unknown;
  range?: unknown;
  source?: unknown;
  generated_at?: unknown;
  received_at?: unknown;
  source_observations?: unknown;
  latest_closed_at?: unknown;
  stored_at?: unknown;
  expires_at?: unknown;
  bar_count?: unknown;
  payload_hash?: unknown;
  payload_mac?: unknown;
  integrity_mode?: unknown;
  integrity_key_id?: unknown;
  candles?: unknown;
};

function parseDurableRow(row: DurableSnapshotRow): KlineSnapshot | null {
  if (
    typeof row.snapshot_key !== "string" ||
    !row.asset_identity || typeof row.asset_identity !== "object" || Array.isArray(row.asset_identity) ||
    typeof row.identity_digest !== "string" ||
    typeof row.pair !== "string" ||
    typeof row.range !== "string" ||
    typeof row.source !== "string" ||
    typeof row.generated_at !== "string" ||
    typeof row.received_at !== "string" ||
    !Array.isArray(row.source_observations) ||
    typeof row.latest_closed_at !== "string" ||
    typeof row.stored_at !== "string" ||
    typeof row.expires_at !== "string" ||
    typeof row.payload_hash !== "string" ||
    typeof row.payload_mac !== "string" ||
    (row.integrity_mode !== "hmac_sha256" && row.integrity_mode !== "sha256_qa") ||
    typeof row.integrity_key_id !== "string" ||
    !Array.isArray(row.candles)
  ) return null;

  const storedAt = Date.parse(row.stored_at);
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(storedAt) || !Number.isFinite(expiresAt)) return null;
  const candles = normalizeCandles(row.candles as MarketCandle[]);
  if (!isCanonicalKlineAssetIdentity(row.asset_identity)) return null;
  const assetIdentity = row.asset_identity;
  const sourceObservations = normalizeSourceObservations(row.source_observations as KlineSourceObservation[]);
  if (
    candles.length < MIN_BARS || candles.length !== row.candles.length ||
    typeof row.bar_count !== "number" || !Number.isInteger(row.bar_count) || candles.length !== row.bar_count
  ) return null;
  if (
    sourceObservations.length < 2 || sourceObservations.length !== row.source_observations.length ||
    canonicalKlineIdentityDigest(assetIdentity) !== row.identity_digest
  ) return null;
  const intervalMs = RANGE_INTERVAL_MS[row.range];
  const generatedAt = Date.parse(row.generated_at);
  const receivedAt = Date.parse(row.received_at);
  const latestClosedAt = Date.parse(row.latest_closed_at);
  const latestCandle = candles.at(-1);
  const sourceTimestampsValid = sourceObservations.every((observation) => (
    Date.parse(observation.receivedAt) <= receivedAt + 5_000 &&
    Date.parse(observation.observedAt) <= receivedAt + 5_000
  ));
  if (
    row.pair !== row.pair.trim().toUpperCase() || row.pair.length < 2 || row.pair.length > 32 ||
    !pairMatchesIdentity(assetIdentity, row.pair) ||
    row.range !== row.range.trim().toLowerCase() || row.range.length < 1 || row.range.length > 16 ||
    row.source !== row.source.trim() || row.source.length > 500 ||
    !intervalMs || !latestCandle ||
    !Number.isFinite(generatedAt) || !Number.isFinite(receivedAt) || !Number.isFinite(latestClosedAt) ||
    Math.abs(latestCandle.timestamp + intervalMs - latestClosedAt) > 2_000 ||
    receivedAt > generatedAt + 5_000 || latestClosedAt > receivedAt + 5_000 || !sourceTimestampsValid ||
    expiresAt <= storedAt || expiresAt - storedAt > 24 * 60 * 60 * 1_000
  ) return null;
  const entry: KlineSnapshot = {
    key: row.snapshot_key,
    assetIdentity,
    identityDigest: row.identity_digest,
    pair: row.pair,
    range: row.range,
    source: row.source,
    generatedAt: row.generated_at,
    receivedAt: row.received_at,
    sourceObservations,
    latestClosedAt: row.latest_closed_at,
    storedAt,
    expiresAt,
    payloadHash: row.payload_hash,
    payloadMac: row.payload_mac,
    integrityMode: row.integrity_mode,
    integrityKeyId: row.integrity_key_id,
    candles,
  };
  if (entry.key !== keyFor(entry.assetIdentity, entry.range)) return null;
  if (!verifySnapshotIntegrity(entry)) return null;
  return entry;
}

async function readDurableSnapshot(input: { assetIdentity: KlineAssetIdentity; range: string }) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    select: "snapshot_key,asset_identity,identity_digest,pair,range,source,generated_at,received_at,source_observations,latest_closed_at,stored_at,expires_at,bar_count,payload_hash,payload_mac,integrity_mode,integrity_key_id,candles",
    snapshot_key: `eq.${keyFor(input.assetIdentity, input.range)}`,
    limit: "1",
  });
  const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/${TABLE}?${params.toString()}`, {
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(DURABLE_TIMEOUT_MS),
  }, { configuredProfile: "supabase", operation: "kline_snapshot_read", timeoutMs: DURABLE_TIMEOUT_MS });
  if (!response.ok) {
    const detail = await readTextResponseBounded(response, 64 * 1024).catch(() => "");
    throw new Error(`supabase snapshot read ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }
  const rows = await readJsonResponseBounded<DurableSnapshotRow[]>(response, 2 * 1024 * 1024);
  return rows[0] ? parseDurableRow(rows[0]) : null;
}

export async function readKlineSnapshotWithDurable(input: {
  assetIdentity: KlineAssetIdentity;
  range: string;
  maxAgeMs?: number;
}): Promise<KlineSnapshotReadResult | null> {
  const memory = readKlineSnapshot(input);
  if (memory) return memory;
  if (!getSupabaseConfig()) return null;

  try {
    const entry = await readDurableSnapshot(input);
    if (!entry) return null;
    if (!sameKlineIdentity(entry.assetIdentity, input.assetIdentity)) return null;
    const freshness = snapshotFreshness(entry);
    const maxAgeMs = Math.max(60_000, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
    if (!freshness || freshness.ageMs > maxAgeMs || Date.now() > entry.expiresAt) return null;
    rememberSnapshotEntry(entry);
    store().lastDurableReadAt = new Date().toISOString();
    store().lastError = undefined;
    return {
      ...entry,
      assetIdentity: { ...entry.assetIdentity },
      sourceObservations: entry.sourceObservations.map((row) => ({ ...row })),
      candles: cloneCandles(entry.candles),
      ...freshness,
      readMode: "supabase",
    };
  } catch (error) {
    store().lastError = safeError(error);
    return null;
  }
}

export function getKlineSnapshotCacheStatus() {
  const entries = Array.from(store().entries.values());
  const newest = [...entries].sort((left, right) => right.storedAt - left.storedAt)[0];
  const state = store();
  return {
    mode: getSupabaseConfig() ? "memory+supabase" as const : "memory" as const,
    durableConfigured: Boolean(getSupabaseConfig()),
    entries: entries.length,
    newestGeneratedAt: newest?.generatedAt,
    newestSource: newest?.source,
    newestIdentityDigest: newest?.identityDigest,
    newestIntegrityMode: newest?.integrityMode,
    productionIntegrityReady: Boolean(integrityKeys().current),
    lastPersistAt: state.lastPersistAt,
    lastDurablePersistAt: state.lastDurablePersistAt,
    lastDurableReadAt: state.lastDurableReadAt,
    lastError: state.lastError,
  };
}
