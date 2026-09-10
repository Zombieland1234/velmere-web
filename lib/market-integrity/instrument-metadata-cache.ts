import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { createHash } from "node:crypto";
import { readDurableJsonBounded, writeDurableJsonAtomic } from "@/lib/security/durable-file-boundary";
import path from "node:path";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import {
  isPass4644CommerciallyFreshReceipt,
  type Pass4644ProviderEvidenceReceipt,
  type Pass4644ProviderSurface,
} from "./provider-evidence-receipt";

export type Pass4653InstrumentMetadataSnapshot = {
  schemaVersion: "pass4653_instrument_metadata_snapshot_v1";
  cacheKey: string;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  canonicalSymbol: string;
  canonicalName: string;
  assetClass: VelmereMarketAssetClass;
  marketId: string | null;
  exchange: string | null;
  currency: string | null;
  providerId: string;
  providerFamily: string;
  observedAt: string;
  expiresAt: string;
  storedAt: string;
  snapshotHash: string;
};

export type Pass4653InstrumentMetadataRead = {
  schemaVersion: "pass4653_instrument_metadata_read_v1";
  snapshot: Pass4653InstrumentMetadataSnapshot | null;
  mode: "memory" | "filesystem" | "supabase" | "not_configured";
  readBackVerified: boolean;
  blockers: string[];
};

export type Pass4653InstrumentMetadataPersistence = {
  schemaVersion: "pass4653_instrument_metadata_persistence_v1";
  durable: boolean;
  mode: "memory" | "filesystem" | "supabase" | "not_configured";
  cacheKey: string;
  snapshotHash: string;
  readBackVerified: boolean;
  blockers: string[];
};

const GLOBAL_KEY = "__velmerePass4653InstrumentMetadata";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_MEMORY_ROWS = 20_000;

type GlobalWithMetadata = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, Pass4653InstrumentMetadataSnapshot>;
};

function stableSerialize(value: unknown): string {
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
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._\-/]+/g, "")
    .replace(/-usd$/, "") || "unknown";
}

function cacheKey(requestedIdentity: string, surface: Pass4644ProviderSurface) {
  return `${surface}:${normalizedIdentity(requestedIdentity)}`;
}

function memoryStore() {
  const root = globalThis as GlobalWithMetadata;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new Map();
  return root[GLOBAL_KEY]!;
}

function canonicalPayload(snapshot: Omit<Pass4653InstrumentMetadataSnapshot, "snapshotHash">) {
  return {
    schemaVersion: snapshot.schemaVersion,
    cacheKey: snapshot.cacheKey,
    requestedIdentity: snapshot.requestedIdentity,
    surface: snapshot.surface,
    canonicalSymbol: snapshot.canonicalSymbol,
    canonicalName: snapshot.canonicalName,
    assetClass: snapshot.assetClass,
    marketId: snapshot.marketId,
    exchange: snapshot.exchange,
    currency: snapshot.currency,
    providerId: snapshot.providerId,
    providerFamily: snapshot.providerFamily,
    observedAt: snapshot.observedAt,
    expiresAt: snapshot.expiresAt,
    storedAt: snapshot.storedAt,
  };
}

function snapshotHash(snapshot: Omit<Pass4653InstrumentMetadataSnapshot, "snapshotHash">) {
  return sha256(stableSerialize(canonicalPayload(snapshot)));
}

function validAssetClass(value: unknown): value is VelmereMarketAssetClass {
  return ["crypto", "stock", "etf", "index", "fx", "commodity", "real_estate", "exchange_equity", "unknown"].includes(String(value));
}

function verifySnapshot(snapshot: Pass4653InstrumentMetadataSnapshot, args: { requestedIdentity: string; surface: Pass4644ProviderSurface; now?: Date }) {
  const blockers: string[] = [];
  if (snapshot.schemaVersion !== "pass4653_instrument_metadata_snapshot_v1") blockers.push("metadata_schema_invalid");
  if (snapshot.cacheKey !== cacheKey(args.requestedIdentity, args.surface)) blockers.push("metadata_cache_key_mismatch");
  if (snapshot.surface !== args.surface) blockers.push("metadata_surface_mismatch");
  if (!snapshot.canonicalSymbol.trim()) blockers.push("metadata_symbol_missing");
  if (!snapshot.canonicalName.trim()) blockers.push("metadata_name_missing");
  if (!validAssetClass(snapshot.assetClass) || snapshot.assetClass === "unknown") blockers.push("metadata_asset_class_unverified");
  if (!snapshot.providerId.trim() || !snapshot.providerFamily.trim()) blockers.push("metadata_provider_missing");
  if (!Number.isFinite(Date.parse(snapshot.observedAt))) blockers.push("metadata_observed_at_invalid");
  if (!Number.isFinite(Date.parse(snapshot.expiresAt))) blockers.push("metadata_expires_at_invalid");
  const now = args.now ?? new Date();
  if (Date.parse(snapshot.expiresAt) <= now.getTime()) blockers.push("metadata_expired");
  const { snapshotHash: _ignored, ...withoutHash } = snapshot;
  if (snapshot.snapshotHash !== snapshotHash(withoutHash)) blockers.push("metadata_hash_mismatch");
  return { verified: blockers.length === 0, blockers };
}

function bestIdentityReceipt(result: TokenRiskResult, at: Date): Pass4644ProviderEvidenceReceipt | null {
  const receipts = (result.providerEvidenceReceipts ?? [])
    .filter((receipt) => !receipt.continuity)
    .filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, at))
    .filter((receipt) => receipt.identity.matched)
    .filter((receipt) => receipt.capabilities.includes("identity"))
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return receipts[0] ?? null;
}

export function buildPass4653InstrumentMetadataSnapshot(args: {
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  result: TokenRiskResult;
  storedAt?: Date | string;
  ttlMs?: number;
  exchange?: string | null;
  currency?: string | null;
}): Pass4653InstrumentMetadataSnapshot | null {
  const assetClass = args.result.token.assetClass ?? "unknown";
  const storedAt = args.storedAt instanceof Date ? args.storedAt : args.storedAt ? new Date(args.storedAt) : new Date();
  if (!Number.isFinite(storedAt.getTime())) return null;
  const receipt = bestIdentityReceipt(args.result, storedAt);
  if (!receipt || assetClass === "unknown") return null;
  const observedAt = new Date(receipt.observedAt);
  if (!Number.isFinite(observedAt.getTime())) return null;
  const ttlMs = Math.max(24 * 60 * 60_000, Math.min(90 * 24 * 60 * 60_000, args.ttlMs ?? DEFAULT_TTL_MS));
  const withoutHash: Omit<Pass4653InstrumentMetadataSnapshot, "snapshotHash"> = {
    schemaVersion: "pass4653_instrument_metadata_snapshot_v1",
    cacheKey: cacheKey(args.requestedIdentity, args.surface),
    requestedIdentity: normalizedIdentity(args.requestedIdentity),
    surface: args.surface,
    canonicalSymbol: args.result.token.symbol.trim().toUpperCase(),
    canonicalName: args.result.token.name.trim() || args.result.token.symbol.trim().toUpperCase(),
    assetClass,
    marketId: args.result.token.marketId ?? null,
    exchange: args.exchange?.trim() || null,
    currency: args.currency?.trim().toUpperCase() || null,
    providerId: receipt.providerId,
    providerFamily: receipt.providerFamily,
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(observedAt.getTime() + ttlMs).toISOString(),
    storedAt: storedAt.toISOString(),
  };
  return { ...withoutHash, snapshotHash: snapshotHash(withoutHash) };
}

function filesystemDir() {
  const configured = process.env.VELMERE_PASS4653_METADATA_CACHE_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.NODE_ENV === "test") return path.resolve(".velmere-test/pass4653-metadata");
  return null;
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 2_000) {
  const config = supabaseConfig();
  if (!config) throw new Error("instrument_metadata_supabase_not_configured");
  return brokeredConfiguredOriginFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }, {
    configuredProfile: "supabase",
    operation: "instrument_metadata_store",
    timeoutMs,
  });
}

function insertMemory(snapshot: Pass4653InstrumentMetadataSnapshot) {
  const store = memoryStore();
  store.set(snapshot.cacheKey, snapshot);
  if (store.size > MAX_MEMORY_ROWS) {
    const oldest = Array.from(store.values()).sort((a, b) => Date.parse(a.storedAt) - Date.parse(b.storedAt)).slice(0, store.size - MAX_MEMORY_ROWS);
    for (const row of oldest) store.delete(row.cacheKey);
  }
}

export async function persistPass4653InstrumentMetadataSnapshot(snapshot: Pass4653InstrumentMetadataSnapshot): Promise<Pass4653InstrumentMetadataPersistence> {
  const verification = verifySnapshot(snapshot, { requestedIdentity: snapshot.requestedIdentity, surface: snapshot.surface, now: new Date(snapshot.storedAt) });
  if (!verification.verified) {
    return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: false, mode: "not_configured", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: false, blockers: verification.blockers };
  }
  insertMemory(snapshot);
  const config = supabaseConfig();
  if (config) {
    try {
      const response = await fetchWithTimeout(`${config.url}/rest/v1/instrument_identity_snapshots?on_conflict=cache_key`, {
        method: "POST",
        headers: { apikey: config.key, authorization: `Bearer ${config.key}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          cache_key: snapshot.cacheKey,
          requested_identity: snapshot.requestedIdentity,
          surface: snapshot.surface,
          canonical_symbol: snapshot.canonicalSymbol,
          canonical_name: snapshot.canonicalName,
          asset_class: snapshot.assetClass,
          market_id: snapshot.marketId,
          exchange: snapshot.exchange,
          currency: snapshot.currency,
          provider_id: snapshot.providerId,
          provider_family: snapshot.providerFamily,
          observed_at: snapshot.observedAt,
          expires_at: snapshot.expiresAt,
          stored_at: snapshot.storedAt,
          snapshot_hash: snapshot.snapshotHash,
          payload: snapshot,
          updated_at: new Date().toISOString(),
        }),
      });
      if (response.ok) {
        const readBack = await readPass4653InstrumentMetadataSnapshot({ requestedIdentity: snapshot.requestedIdentity, surface: snapshot.surface, bypassMemory: true, now: new Date(snapshot.storedAt) });
        return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: readBack.readBackVerified, mode: "supabase", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: readBack.readBackVerified && readBack.snapshot?.snapshotHash === snapshot.snapshotHash, blockers: readBack.blockers };
      }
      return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: false, mode: "supabase", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: false, blockers: [`metadata_supabase_http_${response.status}`] };
    } catch (error) {
      return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: false, mode: "supabase", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: false, blockers: [`metadata_supabase_error:${error instanceof Error ? error.name : "unknown"}`] };
    }
  }
  const dir = filesystemDir();
  if (dir) {
    try {
      const boundary = {
        rootDirectory: dir,
        fileName: `${sha256(snapshot.cacheKey).slice(0, 32)}.json`,
        maximumBytes: 512 * 1024,
        label: "instrument-metadata-cache",
      } as const;
      const writeReceipt = await writeDurableJsonAtomic(boundary, snapshot, true);
      const parsed = await readDurableJsonBounded<Pass4653InstrumentMetadataSnapshot>(boundary);
      const readVerification = verifySnapshot(parsed, { requestedIdentity: snapshot.requestedIdentity, surface: snapshot.surface, now: new Date(snapshot.storedAt) });
      const readBackVerified = writeReceipt.readBackVerified && readVerification.verified && parsed.snapshotHash === snapshot.snapshotHash;
      if (readBackVerified) insertMemory(parsed);
      return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: readBackVerified, mode: "filesystem", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified, blockers: readVerification.blockers };
    } catch (error) {
      return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: false, mode: "filesystem", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: false, blockers: [`metadata_filesystem_error:${error instanceof Error ? error.name : "unknown"}`] };
    }
  }
  return { schemaVersion: "pass4653_instrument_metadata_persistence_v1", durable: false, mode: "memory", cacheKey: snapshot.cacheKey, snapshotHash: snapshot.snapshotHash, readBackVerified: true, blockers: ["metadata_store_memory_only"] };
}

export async function readPass4653InstrumentMetadataSnapshot(args: {
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  now?: Date;
  bypassMemory?: boolean;
}): Promise<Pass4653InstrumentMetadataRead> {
  const key = cacheKey(args.requestedIdentity, args.surface);
  const now = args.now ?? new Date();
  if (!args.bypassMemory) {
    const memory = memoryStore().get(key);
    if (memory) {
      const verification = verifySnapshot(memory, { requestedIdentity: args.requestedIdentity, surface: args.surface, now });
      if (verification.verified) return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: memory, mode: "memory", readBackVerified: true, blockers: [] };
      memoryStore().delete(key);
    }
  }
  const config = supabaseConfig();
  if (config) {
    try {
      const response = await fetchWithTimeout(`${config.url}/rest/v1/instrument_identity_snapshots?cache_key=eq.${encodeURIComponent(key)}&select=payload&limit=1`, { headers: { apikey: config.key, authorization: `Bearer ${config.key}` } });
      if (response.ok) {
        const rows = await readJsonResponseBounded<Array<{ payload?: unknown }>>(response, 256 * 1024).catch(() => []);
        const payload = rows[0]?.payload;
        const snapshot = payload && typeof payload === "object"
          ? payload as Pass4653InstrumentMetadataSnapshot
          : undefined;
        if (snapshot) {
          const verification = verifySnapshot(snapshot, { requestedIdentity: args.requestedIdentity, surface: args.surface, now });
          if (verification.verified) {
            insertMemory(snapshot);
            return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot, mode: "supabase", readBackVerified: true, blockers: [] };
          }
          return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: null, mode: "supabase", readBackVerified: false, blockers: verification.blockers };
        }
      }
    } catch (error) {
      return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: null, mode: "supabase", readBackVerified: false, blockers: [`metadata_supabase_read_error:${error instanceof Error ? error.name : "unknown"}`] };
    }
  }
  const dir = filesystemDir();
  if (dir) {
    try {
      const snapshot = await readDurableJsonBounded<Pass4653InstrumentMetadataSnapshot>({
        rootDirectory: dir,
        fileName: `${sha256(key).slice(0, 32)}.json`,
        maximumBytes: 512 * 1024,
        label: "instrument-metadata-cache",
      });
      const verification = verifySnapshot(snapshot, { requestedIdentity: args.requestedIdentity, surface: args.surface, now });
      if (verification.verified) {
        insertMemory(snapshot);
        return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot, mode: "filesystem", readBackVerified: true, blockers: [] };
      }
      return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: null, mode: "filesystem", readBackVerified: false, blockers: verification.blockers };
    } catch (error) {
      const name = error instanceof Error ? error.name : "unknown";
      return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: null, mode: "filesystem", readBackVerified: false, blockers: name === "Error" ? ["metadata_snapshot_missing"] : [`metadata_filesystem_read_error:${name}`] };
    }
  }
  return { schemaVersion: "pass4653_instrument_metadata_read_v1", snapshot: null, mode: "not_configured", readBackVerified: false, blockers: ["metadata_snapshot_missing"] };
}

export function hydratePass4653InstrumentMetadata(args: {
  result: TokenRiskResult;
  snapshot: Pass4653InstrumentMetadataSnapshot | null;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
}) {
  const snapshot = args.snapshot;
  if (!snapshot) return { result: args.result, applied: false, blockers: ["metadata_snapshot_missing"] };
  const verification = verifySnapshot(snapshot, { requestedIdentity: args.requestedIdentity, surface: args.surface });
  if (!verification.verified) return { result: args.result, applied: false, blockers: verification.blockers };
  const currentClass = args.result.token.assetClass ?? "unknown";
  if (currentClass !== "unknown" && currentClass !== snapshot.assetClass) {
    return { result: args.result, applied: false, blockers: ["metadata_current_class_conflict"] };
  }
  const result: TokenRiskResult = {
    ...args.result,
    token: {
      ...args.result.token,
      symbol: snapshot.canonicalSymbol,
      name: snapshot.canonicalName,
      assetClass: snapshot.assetClass,
      marketId: snapshot.marketId ?? args.result.token.marketId,
    },
  };
  result.pass4653InstrumentMetadata = {
    schemaVersion: "pass4653_instrument_metadata_hydration_v1",
    applied: true,
    source: "verified_continuity_snapshot",
    snapshotHash: snapshot.snapshotHash,
    observedAt: snapshot.observedAt,
    expiresAt: snapshot.expiresAt,
    providerId: snapshot.providerId,
    providerFamily: snapshot.providerFamily,
  };
  return { result, applied: true, blockers: [] };
}

export function clearPass4653InstrumentMetadataMemoryForTests() {
  memoryStore().clear();
}
