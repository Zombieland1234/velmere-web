import { createHash } from "node:crypto";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import {
  readJsonResponseBounded,
  readTextResponseBounded,
} from "@/lib/network/fetch-with-deadline";
import { canonicalJson } from "@/lib/security/canonical-json";
import type { MarketIntegrityRow } from "./coingecko";

export type MarketSnapshotSource = {
  key: string;
  page: number;
  perPage: number;
  rows: MarketIntegrityRow[];
  source: string;
  generatedAt: string;
  storedAt: number;
  expiresAt: number;
  payloadHash: string;
};

export type MarketSnapshotPersistenceMode =
  | "memory"
  | "supabase"
  | "memory_and_supabase";

export type MarketSnapshotPersistReceipt = {
  stored: boolean;
  mode: MarketSnapshotPersistenceMode;
  key: string;
  rowCount: number;
  payloadHash: string;
  durableConfigured: boolean;
  durableStored: boolean;
  latencyMs: number;
  error?: string;
};

export type MarketSnapshotReadResult = MarketSnapshotSource & {
  ageMs: number;
  readMode: "memory" | "supabase";
};

type SnapshotStore = {
  entries: Map<string, MarketSnapshotSource>;
  lastPersistAt?: string;
  lastDurablePersistAt?: string;
  lastDurableReadAt?: string;
  lastError?: string;
};

const GLOBAL_KEY = "__velmereMarketSnapshotCachePass4826";
const MAX_ENTRIES = 8;
const MAX_ROWS = 250;
const MAX_SERIALIZED_BYTES = 12 * 1024 * 1024;
const DURABLE_TRANSFER_MAX_BYTES = MAX_SERIALIZED_BYTES + 512 * 1024;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const DURABLE_TIMEOUT_MS = 2_500;
const TABLE = "velmere_market_snapshots";
export const MARKET_SNAPSHOT_MAX_PAGE = 20;
export const MARKET_SNAPSHOT_PER_PAGE_BUCKETS = [10, 25, 50, 100, 250] as const;

type GlobalWithSnapshotStore = typeof globalThis & {
  [GLOBAL_KEY]?: SnapshotStore;
};

type DurableSnapshotRow = {
  snapshot_key?: unknown;
  page?: unknown;
  per_page?: unknown;
  source?: unknown;
  generated_at?: unknown;
  stored_at?: unknown;
  expires_at?: unknown;
  row_count?: unknown;
  payload_hash?: unknown;
  rows?: unknown;
};

function store(): SnapshotStore {
  const root = globalThis as GlobalWithSnapshotStore;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = { entries: new Map() };
  return root[GLOBAL_KEY]!;
}

export function isCanonicalMarketSnapshotCoordinates(page: number, perPage: number) {
  return Number.isSafeInteger(page) &&
    page >= 1 &&
    page <= MARKET_SNAPSHOT_MAX_PAGE &&
    Number.isSafeInteger(perPage) &&
    (MARKET_SNAPSHOT_PER_PAGE_BUCKETS as readonly number[]).includes(perPage);
}

export function marketSnapshotKey(page: number, perPage: number) {
  if (!isCanonicalMarketSnapshotCoordinates(page, perPage)) {
    throw new Error("invalid_market_snapshot_coordinates");
  }
  return `${page}:${perPage}`;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/u, ""), key };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown durable market snapshot error";
  return message
    .replace(/Bearer\s+\S+/giu, "Bearer [redacted]")
    .replace(/service-role-[\w.-]+/giu, "[redacted]")
    .slice(0, 280);
}

function cloneRows(rows: MarketIntegrityRow[]) {
  return structuredClone(rows);
}

function finiteOptional(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: unknown, minimum: number, maximum: number) {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum;
}

function finiteInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 64) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now() + 5 * 60_000;
}

function structurallySafeJson(
  value: unknown,
  state: { nodes: number } = { nodes: 0 },
  depth = 0,
): boolean {
  state.nodes += 1;
  if (state.nodes > 20_000 || depth > 18) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 32_000;
  if (Array.isArray(value)) {
    return value.length <= 5_000 && value.every((item) => structurallySafeJson(item, state, depth + 1));
  }
  if (!plainRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 512 && entries.every(([key, item]) =>
    key.length > 0 && key.length <= 240 && structurallySafeJson(item, state, depth + 1));
}

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const RISK_BADGES = new Set([
  "low_detected_risk",
  "elevated_risk",
  "possible_manipulation_risk",
  "critical_market_integrity_risk",
]);
const RISK_BADGE_BY_LEVEL: Record<string, string> = {
  low: "low_detected_risk",
  medium: "elevated_risk",
  high: "possible_manipulation_risk",
  critical: "critical_market_integrity_risk",
};

function expectedRiskLevel(score: number) {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function validRiskSignal(value: unknown) {
  if (!plainRecord(value)) return false;
  if (!boundedText(value.id, 1, 160) || !RISK_LEVELS.has(String(value.severity))) return false;
  if (!finiteInRange(value.points, -1_000, 1_000)) return false;
  if (value.metrics !== undefined) {
    if (!plainRecord(value.metrics) || Object.keys(value.metrics).length > 128) return false;
    if (!Object.entries(value.metrics).every(([key, item]) =>
      key.length > 0 && key.length <= 160 &&
      (item === null || typeof item === "string" || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))))) {
      return false;
    }
  }
  return true;
}

function validTokenRiskResult(value: unknown, row: {
  id: string;
  symbol: string;
  name: string;
  sparkline7d: number[];
}) {
  if (!plainRecord(value) || !plainRecord(value.token) || !plainRecord(value.metrics)) return false;
  const score = value.score;
  if (typeof score !== "number" || !finiteInRange(score, 0, 100)) return false;
  const level = String(value.level);
  const badge = String(value.badge);
  if (!RISK_LEVELS.has(level) || !RISK_BADGES.has(badge)) return false;
  if (level !== expectedRiskLevel(score) || badge !== RISK_BADGE_BY_LEVEL[level]) return false;
  if (!boundedText(value.token.symbol, 1, 32) || !boundedText(value.token.name, 1, 240)) return false;
  if (String(value.token.symbol).toUpperCase() !== row.symbol.toUpperCase()) return false;
  if (value.token.marketId !== row.id || value.token.name !== row.name) return false;
  if (!Array.isArray(value.signals) || value.signals.length > 128 || !value.signals.every(validRiskSignal)) return false;
  if (Object.keys(value.metrics).length > 128 || !Object.entries(value.metrics).every(([key, item]) =>
    key.length > 0 && key.length <= 160 && typeof item === "number" && Number.isFinite(item))) return false;
  if (value.confidence !== undefined && !finiteInRange(value.confidence, 0, 1)) return false;
  if (!["demo", "partial", "live"].includes(String(value.dataQuality))) return false;
  if (!Array.isArray(value.dataSources) || value.dataSources.length < 1 || value.dataSources.length > 64 ||
      value.dataSources.some((source) => !boundedText(source, 1, 500))) return false;
  if (!validIsoTimestamp(value.generatedAt)) return false;
  if (!plainRecord(value.chart) || !Array.isArray(value.chart.sevenDay) ||
      value.chart.sevenDay.length !== row.sparkline7d.length ||
      value.chart.sevenDay.some((point, index) =>
        !finiteInRange(point, 0, Number.MAX_VALUE) || point !== row.sparkline7d[index])) return false;
  return structurallySafeJson(value);
}

function validMarketRow(value: unknown): value is MarketIntegrityRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<MarketIntegrityRow>;
  if (
    typeof row.id !== "string" || row.id.trim().length < 1 || row.id.length > 160 ||
    typeof row.symbol !== "string" || row.symbol.trim().length < 1 || row.symbol.length > 32 ||
    typeof row.name !== "string" || row.name.trim().length < 1 || row.name.length > 240 ||
    !Array.isArray(row.sparkline7d) || row.sparkline7d.length > 2_500 ||
    row.sparkline7d.some((point) => typeof point !== "number" || !Number.isFinite(point) || point < 0) ||
    !validTokenRiskResult(row.result, {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      sparkline7d: row.sparkline7d,
    })
  ) return false;

  if (row.image !== undefined && (typeof row.image !== "string" || row.image.length > 2_048)) return false;
  if (row.observedAt !== undefined && !validIsoTimestamp(row.observedAt)) return false;
  if (row.memory !== undefined && !structurallySafeJson(row.memory)) return false;
  if (row.rank !== undefined && (!Number.isSafeInteger(row.rank) || row.rank < 1)) return false;
  for (const item of [
    row.price,
    row.marketCap,
    row.fdv,
    row.volume24h,
    row.high24h,
    row.low24h,
    row.ath,
    row.circulatingSupply,
    row.totalSupply,
    row.maxSupply,
  ]) {
    if (item !== undefined && (!Number.isFinite(item) || item < 0)) return false;
  }

  return [
    row.rank,
    row.price,
    row.priceChange1h,
    row.priceChange24h,
    row.priceChange7d,
    row.priceChange14d,
    row.priceChange30d,
    row.marketCap,
    row.fdv,
    row.volume24h,
    row.high24h,
    row.low24h,
    row.ath,
    row.athChangePercent,
    row.circulatingSupply,
    row.totalSupply,
    row.maxSupply,
  ].every(finiteOptional);
}

function normalizeRows(rows: MarketIntegrityRow[]) {
  try {
    const normalized = JSON.parse(JSON.stringify(rows)) as unknown;
    if (!Array.isArray(normalized) || normalized.length < 1 || normalized.length > MAX_ROWS) return null;
    if (!normalized.every(validMarketRow)) return null;
    return normalized as MarketIntegrityRow[];
  } catch {
    return null;
  }
}

function rowsFitSnapshotCoordinates(rows: MarketIntegrityRow[], perPage: number) {
  if (rows.length > perPage) return false;
  const identities = rows.map((row) => row.id);
  return new Set(identities).size === identities.length;
}

function canonicalSnapshotPayload(input: {
  page: number;
  perPage: number;
  source: string;
  generatedAt: string;
  rows: MarketIntegrityRow[];
}) {
  return canonicalJson({
    page: input.page,
    perPage: input.perPage,
    source: input.source,
    generatedAt: input.generatedAt,
    rows: input.rows,
  });
}

function hashSnapshotPayload(input: {
  page: number;
  perPage: number;
  source: string;
  generatedAt: string;
  rows: MarketIntegrityRow[];
}) {
  return createHash("sha256").update(canonicalSnapshotPayload(input)).digest("hex");
}

function buildSnapshot(input: {
  page: number;
  perPage: number;
  rows: MarketIntegrityRow[];
  source: string;
  generatedAt?: string;
  ttlMs?: number;
}) {
  if (!isCanonicalMarketSnapshotCoordinates(input.page, input.perPage)) return null;
  const page = input.page;
  const perPage = input.perPage;
  const rows = normalizeRows(input.rows);
  const source = input.source.trim().slice(0, 500);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt);
  if (!rows || !rowsFitSnapshotCoordinates(rows, perPage) || !source || !Number.isFinite(generatedAtMs)) return null;
  if (generatedAtMs > Date.now() + 5 * 60_000) return null;

  const canonical = canonicalSnapshotPayload({ page, perPage, source, generatedAt, rows });
  if (Buffer.byteLength(canonical, "utf8") > MAX_SERIALIZED_BYTES) return null;

  const storedAt = Date.now();
  const requestedTtlMs = input.ttlMs ?? DEFAULT_MAX_AGE_MS;
  if (!Number.isFinite(requestedTtlMs)) return null;
  const ttlMs = Math.max(60_000, Math.min(MAX_TTL_MS, requestedTtlMs));
  return {
    key: marketSnapshotKey(page, perPage),
    page,
    perPage,
    rows,
    source,
    generatedAt,
    storedAt,
    expiresAt: storedAt + ttlMs,
    payloadHash: createHash("sha256").update(canonical).digest("hex"),
  } satisfies MarketSnapshotSource;
}

function rememberSnapshotEntry(entry: MarketSnapshotSource) {
  const state = store();
  state.entries.set(entry.key, { ...entry, rows: cloneRows(entry.rows) });
  if (state.entries.size > MAX_ENTRIES) {
    const oldest = Array.from(state.entries.values()).sort(
      (left, right) => left.storedAt - right.storedAt,
    )[0];
    if (oldest) state.entries.delete(oldest.key);
  }
  state.lastPersistAt = new Date().toISOString();
  return entry;
}

export function rememberMarketSnapshot(input: {
  page: number;
  perPage: number;
  rows: MarketIntegrityRow[];
  source: string;
  generatedAt?: string;
  ttlMs?: number;
}) {
  const entry = buildSnapshot(input);
  return entry ? rememberSnapshotEntry(entry) : null;
}

async function writeDurableSnapshot(entry: MarketSnapshotSource) {
  const config = getSupabaseConfig();
  if (!config) return { stored: false, configured: false as const };
  const response = await brokeredConfiguredOriginFetch(
    `${config.url}/rest/v1/${TABLE}?on_conflict=snapshot_key`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        snapshot_key: entry.key,
        page: entry.page,
        per_page: entry.perPage,
        source: entry.source,
        generated_at: entry.generatedAt,
        stored_at: new Date(entry.storedAt).toISOString(),
        expires_at: new Date(entry.expiresAt).toISOString(),
        row_count: entry.rows.length,
        payload_hash: entry.payloadHash,
        rows: entry.rows,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DURABLE_TIMEOUT_MS),
    },
    {
      configuredProfile: "supabase",
      operation: "market_snapshot_write",
      timeoutMs: DURABLE_TIMEOUT_MS,
      maxRequestBytes: DURABLE_TRANSFER_MAX_BYTES,
      maxResponseBytes: 256 * 1024,
    },
  );
  if (!response.ok) {
    const detail = await readTextResponseBounded(response, 64 * 1024).catch(() => "");
    throw new Error(`supabase market snapshot write ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }
  return { stored: true, configured: true as const };
}

export async function persistMarketSnapshot(input: {
  page: number;
  perPage: number;
  rows: MarketIntegrityRow[];
  source: string;
  generatedAt?: string;
  ttlMs?: number;
}): Promise<MarketSnapshotPersistReceipt> {
  const startedAt = Date.now();
  const entry = rememberMarketSnapshot(input);
  const configured = Boolean(getSupabaseConfig());
  if (!entry) {
    return {
      stored: false,
      mode: "memory",
      key: isCanonicalMarketSnapshotCoordinates(input.page, input.perPage)
        ? marketSnapshotKey(input.page, input.perPage)
        : "invalid",
      rowCount: 0,
      payloadHash: "",
      durableConfigured: configured,
      durableStored: false,
      latencyMs: Date.now() - startedAt,
      error: "Snapshot rejected: empty, malformed, future-dated or oversized payload",
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
      rowCount: entry.rows.length,
      payloadHash: entry.payloadHash,
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
      rowCount: entry.rows.length,
      payloadHash: entry.payloadHash,
      durableConfigured: configured,
      durableStored: false,
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
}

function snapshotAgeMs(entry: MarketSnapshotSource) {
  const generatedAt = Date.parse(entry.generatedAt);
  if (!Number.isFinite(generatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - Math.min(entry.storedAt, generatedAt));
}

function snapshotStillUsable(entry: MarketSnapshotSource, maxAgeMs: number) {
  return snapshotAgeMs(entry) <= maxAgeMs && Date.now() <= entry.expiresAt;
}

export function readMarketSnapshot(input: {
  page: number;
  perPage: number;
  maxAgeMs?: number;
}): MarketSnapshotReadResult | null {
  if (!isCanonicalMarketSnapshotCoordinates(input.page, input.perPage)) return null;
  const state = store();
  const entry = state.entries.get(marketSnapshotKey(input.page, input.perPage));
  if (!entry) return null;
  const maxAgeMs = Math.max(60_000, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  if (!snapshotStillUsable(entry, maxAgeMs)) return null;
  if (hashSnapshotPayload(entry) !== entry.payloadHash) {
    state.entries.delete(entry.key);
    state.lastError = "Memory market snapshot integrity mismatch";
    return null;
  }
  return {
    ...entry,
    rows: cloneRows(entry.rows),
    ageMs: snapshotAgeMs(entry),
    readMode: "memory",
  };
}

function parseDurableRow(row: DurableSnapshotRow): MarketSnapshotSource | null {
  if (
    typeof row.snapshot_key !== "string" ||
    typeof row.source !== "string" ||
    typeof row.generated_at !== "string" ||
    typeof row.stored_at !== "string" ||
    typeof row.expires_at !== "string" ||
    typeof row.payload_hash !== "string" ||
    !Array.isArray(row.rows)
  ) return null;

  const page = row.page;
  const perPage = row.per_page;
  const storedAt = Date.parse(row.stored_at);
  const expiresAt = Date.parse(row.expires_at);
  const rows = normalizeRows(row.rows as MarketIntegrityRow[]);
  if (
    typeof page !== "number" || typeof perPage !== "number" ||
    typeof row.row_count !== "number" || !Number.isSafeInteger(row.row_count) ||
    !isCanonicalMarketSnapshotCoordinates(page, perPage) ||
    !Number.isFinite(storedAt) || storedAt > Date.now() + 5 * 60_000 ||
    !Number.isFinite(expiresAt) || expiresAt <= storedAt || expiresAt - storedAt > MAX_TTL_MS ||
    !rows || !rowsFitSnapshotCoordinates(rows, perPage) || rows.length !== row.row_count ||
    row.source.trim().length < 1 || row.source.length > 500 ||
    !validIsoTimestamp(row.generated_at) ||
    !/^[a-f0-9]{64}$/u.test(row.payload_hash)
  ) return null;

  const entry: MarketSnapshotSource = {
    key: row.snapshot_key,
    page,
    perPage,
    rows,
    source: row.source,
    generatedAt: row.generated_at,
    storedAt,
    expiresAt,
    payloadHash: row.payload_hash,
  };
  if (entry.key !== marketSnapshotKey(page, perPage)) return null;
  return hashSnapshotPayload(entry) === entry.payloadHash ? entry : null;
}

async function readDurableSnapshot(input: { page: number; perPage: number }) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    select: "snapshot_key,page,per_page,source,generated_at,stored_at,expires_at,row_count,payload_hash,rows",
    snapshot_key: `eq.${marketSnapshotKey(input.page, input.perPage)}`,
    limit: "1",
  });
  const response = await brokeredConfiguredOriginFetch(
    `${config.url}/rest/v1/${TABLE}?${params.toString()}`,
    {
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(DURABLE_TIMEOUT_MS),
    },
    {
      configuredProfile: "supabase",
      operation: "market_snapshot_read",
      timeoutMs: DURABLE_TIMEOUT_MS,
      maxResponseBytes: DURABLE_TRANSFER_MAX_BYTES,
    },
  );
  if (!response.ok) {
    const detail = await readTextResponseBounded(response, 64 * 1024).catch(() => "");
    throw new Error(`supabase market snapshot read ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }
  const rows = await readJsonResponseBounded<DurableSnapshotRow[]>(response, DURABLE_TRANSFER_MAX_BYTES, {
    timeoutMs: DURABLE_TIMEOUT_MS,
    operation: "market_snapshot_json_read",
    jsonMaxDepth: 64,
    jsonMaxNodes: 1_000_000,
  });
  return rows[0] ? parseDurableRow(rows[0]) : null;
}

export async function readMarketSnapshotWithDurable(input: {
  page: number;
  perPage: number;
  maxAgeMs?: number;
}): Promise<MarketSnapshotReadResult | null> {
  if (!isCanonicalMarketSnapshotCoordinates(input.page, input.perPage)) return null;
  const memory = readMarketSnapshot(input);
  if (memory) return memory;
  if (!getSupabaseConfig()) return null;

  try {
    const entry = await readDurableSnapshot(input);
    if (!entry) return null;
    const maxAgeMs = Math.max(60_000, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
    if (!snapshotStillUsable(entry, maxAgeMs)) return null;
    rememberSnapshotEntry(entry);
    store().lastDurableReadAt = new Date().toISOString();
    store().lastError = undefined;
    return {
      ...entry,
      rows: cloneRows(entry.rows),
      ageMs: snapshotAgeMs(entry),
      readMode: "supabase",
    };
  } catch (error) {
    store().lastError = safeError(error);
    return null;
  }
}

export function getMarketSnapshotCacheStatus() {
  const state = store();
  const entries = Array.from(state.entries.values());
  const newest = [...entries].sort((left, right) => right.storedAt - left.storedAt)[0];
  return {
    mode: getSupabaseConfig() ? "memory+supabase" as const : "memory" as const,
    durableConfigured: Boolean(getSupabaseConfig()),
    entries: entries.length,
    newestGeneratedAt: newest?.generatedAt,
    newestSource: newest?.source,
    newestPayloadHash: newest?.payloadHash,
    lastPersistAt: state.lastPersistAt,
    lastDurablePersistAt: state.lastDurablePersistAt,
    lastDurableReadAt: state.lastDurableReadAt,
    lastError: state.lastError,
  };
}
