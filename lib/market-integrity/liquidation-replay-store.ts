import { createHash } from "node:crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase-config";
import { supabaseServiceRestRequest } from "@/lib/db/supabase-service-rest";
import { normalizePass2466DerivativesPair } from "./derivatives-squeeze-proof";
import type { Pass2468LiquidationSide, Pass2468SignedLiquidationSnapshot, Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";

export const PASS2469_LIQUIDATION_REPLAY_STORE_ID = "liquidation-replay-store-v1" as const;
const TABLE_NAME = "velmere_liquidation_snapshot_replays";
const MEMORY_LIMIT_PER_SYMBOL = 72;
const DEFAULT_REPLAY_MAX_AGE_SECONDS = 15 * 60;

type ReplaySource = "memory" | "supabase" | "adapter_contract";
export type Pass2469ReplayState = "ready" | "watch" | "blocked" | "not_applicable";

export type Pass2469LiquidationReplayRecord = {
  passId: typeof PASS2469_LIQUIDATION_REPLAY_STORE_ID;
  replayId: string;
  symbol: string;
  venue: string;
  snapshotId: string;
  snapshotFingerprint: string;
  ledgerFingerprint: string;
  replayFingerprint: string;
  state: "fresh" | "expired" | "invalid";
  observedAt: string;
  receivedAt: string;
  expiresAt: string;
  ageSeconds: number;
  maxAgeSeconds: number;
  eventCount: number;
  longLiquidationCount: number;
  shortLiquidationCount: number;
  dominantSide: Pass2468LiquidationSide;
  totalNotionalUsd?: number;
  largestEventNotionalUsd?: number;
  source: ReplaySource;
  surfaceReplayRequired: string[];
  copyBoundary: string;
};

export type Pass2469LiquidationReplayStore = {
  version: typeof PASS2469_LIQUIDATION_REPLAY_STORE_ID;
  state: Pass2469ReplayState;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  replayCount: number;
  freshReplayCount: number;
  expiredReplayCount: number;
  invalidReplayCount: number;
  venueCount: number;
  twoVenueReplayReady: boolean;
  latestReplayFingerprint?: string;
  latestLedgerFingerprint?: string;
  replayStoreFingerprint: string;
  storageMode: "memory_fallback" | "supabase_ready" | "adapter_contract" | "not_applicable";
  records: Pass2469LiquidationReplayRecord[];
  surfaceReplayChecklist: string[];
  lanes: Array<{
    id: "durable_write" | "fingerprint_replay" | "freshness_replay" | "two_venue_replay" | "pdf_shield_brain_parity";
    label: string;
    state: Pass2469ReplayState;
    confirmedEvidence: string[];
    missingEvidence: string[];
    copyBoundary: string;
  }>;
  advancedCopyRule: string;
  missingForWorldClass: string[];
  nextImplementationActions: string[];
  generatedAt: string;
};

type DbReplayRow = {
  replay_id?: string;
  symbol?: string;
  venue?: string;
  snapshot_id?: string;
  snapshot_fingerprint?: string;
  ledger_fingerprint?: string;
  replay_fingerprint?: string;
  state?: string;
  observed_at?: string;
  received_at?: string;
  expires_at?: string;
  age_seconds?: number;
  max_age_seconds?: number;
  event_count?: number;
  long_liquidation_count?: number;
  short_liquidation_count?: number;
  dominant_side?: string;
  total_notional_usd?: number;
  largest_event_notional_usd?: number;
  source?: ReplaySource;
  payload?: Record<string, unknown>;
};

const memoryReplayStore = new Map<string, Pass2469LiquidationReplayRecord[]>();

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function nowIso(now = new Date()) {
  return now.toISOString();
}

function unique(items: Array<string | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function secondsBetween(now: Date, thenIso: string) {
  const ms = new Date(thenIso).getTime();
  if (!Number.isFinite(ms)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((now.getTime() - ms) / 1000));
}

function expiresAtFor(observedAt: string, maxAgeSeconds: number) {
  const observed = new Date(observedAt).getTime();
  const base = Number.isFinite(observed) ? observed : Date.now();
  return new Date(base + maxAgeSeconds * 1000).toISOString();
}

function replayIdFor(args: { symbol: string; venue: string; snapshotFingerprint: string; ledgerFingerprint: string }) {
  return `pass2469_${args.venue}_${args.symbol}_${args.snapshotFingerprint}_${args.ledgerFingerprint}`
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 160);
}

function dominantSide(value: unknown): Pass2468LiquidationSide {
  if (value === "long_liquidated" || value === "short_liquidated" || value === "mixed" || value === "unknown") return value;
  return "unknown";
}

export function resolvePass2469LiquidationReplayStorageMode() {
  return hasSupabaseServiceRoleConfig() ? "supabase_ready" as const : "memory_fallback" as const;
}

export function buildPass2469ReplayRecord(args: {
  snapshot: Pass2468SignedLiquidationSnapshot;
  ledgerFingerprint?: string;
  source?: ReplaySource;
  now?: Date;
}): Pass2469LiquidationReplayRecord {
  const now = args.now ?? new Date();
  const maxAgeSeconds = clamp(Math.round(args.snapshot.maxAgeSeconds || DEFAULT_REPLAY_MAX_AGE_SECONDS), 30, 3600);
  const ageSeconds = secondsBetween(now, args.snapshot.observedAt);
  const ledgerFingerprint = args.ledgerFingerprint || `PASS2469-LEDGER-${args.snapshot.fingerprint}`;
  const replayFingerprint = `PASS2469-${stableHash({
    snapshotFingerprint: args.snapshot.fingerprint,
    ledgerFingerprint,
    symbol: args.snapshot.symbol,
    venue: args.snapshot.venue,
    observedAt: args.snapshot.observedAt,
    eventCount: args.snapshot.eventCount,
    totalNotionalUsd: args.snapshot.totalNotionalUsd,
  }).slice(0, 24).toUpperCase()}`;
  const state = args.snapshot.state !== "signed_snapshot"
    ? "invalid"
    : ageSeconds <= maxAgeSeconds
      ? "fresh"
      : "expired";

  return {
    passId: PASS2469_LIQUIDATION_REPLAY_STORE_ID,
    replayId: replayIdFor({ symbol: args.snapshot.symbol, venue: args.snapshot.venue, snapshotFingerprint: args.snapshot.fingerprint, ledgerFingerprint }),
    symbol: args.snapshot.symbol,
    venue: args.snapshot.venue,
    snapshotId: args.snapshot.id,
    snapshotFingerprint: args.snapshot.fingerprint,
    ledgerFingerprint,
    replayFingerprint,
    state,
    observedAt: args.snapshot.observedAt,
    receivedAt: nowIso(now),
    expiresAt: expiresAtFor(args.snapshot.observedAt, maxAgeSeconds),
    ageSeconds,
    maxAgeSeconds,
    eventCount: args.snapshot.eventCount,
    longLiquidationCount: args.snapshot.longLiquidationCount,
    shortLiquidationCount: args.snapshot.shortLiquidationCount,
    dominantSide: args.snapshot.dominantSide,
    totalNotionalUsd: args.snapshot.totalNotionalUsd,
    largestEventNotionalUsd: args.snapshot.largestEventNotionalUsd,
    source: args.source ?? "memory",
    surfaceReplayRequired: ["Shield Advanced", "PDF Advanced", "VLM Brain", "Angel", "Audit/progress TXT"],
    copyBoundary: "PASS2469 replay proves the stored liquidation snapshot lineage/fingerprint only. It still cannot become leverage, entry, exit or confirmed squeeze advice by itself.",
  };
}

function recordMemoryReplay(record: Pass2469LiquidationReplayRecord) {
  const key = record.symbol.toUpperCase();
  const current = memoryReplayStore.get(key) ?? [];
  const next = [record, ...current.filter((item) => item.replayId !== record.replayId)].slice(0, MEMORY_LIMIT_PER_SYMBOL);
  memoryReplayStore.set(key, next);
  return record;
}

function rowFromRecord(record: Pass2469LiquidationReplayRecord): DbReplayRow {
  return {
    replay_id: record.replayId,
    symbol: record.symbol,
    venue: record.venue,
    snapshot_id: record.snapshotId,
    snapshot_fingerprint: record.snapshotFingerprint,
    ledger_fingerprint: record.ledgerFingerprint,
    replay_fingerprint: record.replayFingerprint,
    state: record.state,
    observed_at: record.observedAt,
    received_at: record.receivedAt,
    expires_at: record.expiresAt,
    age_seconds: record.ageSeconds,
    max_age_seconds: record.maxAgeSeconds,
    event_count: record.eventCount,
    long_liquidation_count: record.longLiquidationCount,
    short_liquidation_count: record.shortLiquidationCount,
    dominant_side: record.dominantSide,
    total_notional_usd: record.totalNotionalUsd,
    largest_event_notional_usd: record.largestEventNotionalUsd,
    source: record.source,
    payload: {
      passId: record.passId,
      surfaceReplayRequired: record.surfaceReplayRequired,
      copyBoundary: record.copyBoundary,
    },
  };
}

function recordFromRow(row: DbReplayRow, now = new Date()): Pass2469LiquidationReplayRecord | null {
  if (!row.replay_id || !row.symbol || !row.snapshot_fingerprint || !row.ledger_fingerprint || !row.replay_fingerprint) return null;
  const observedAt = row.observed_at || nowIso(now);
  const maxAgeSeconds = typeof row.max_age_seconds === "number" ? row.max_age_seconds : DEFAULT_REPLAY_MAX_AGE_SECONDS;
  const ageSeconds = secondsBetween(now, observedAt);
  return {
    passId: PASS2469_LIQUIDATION_REPLAY_STORE_ID,
    replayId: row.replay_id,
    symbol: row.symbol,
    venue: row.venue || "unknown_venue",
    snapshotId: row.snapshot_id || row.replay_id,
    snapshotFingerprint: row.snapshot_fingerprint,
    ledgerFingerprint: row.ledger_fingerprint,
    replayFingerprint: row.replay_fingerprint,
    state: row.state === "fresh" && ageSeconds <= maxAgeSeconds ? "fresh" : row.state === "invalid" ? "invalid" : ageSeconds > maxAgeSeconds ? "expired" : "fresh",
    observedAt,
    receivedAt: row.received_at || nowIso(now),
    expiresAt: row.expires_at || expiresAtFor(observedAt, maxAgeSeconds),
    ageSeconds,
    maxAgeSeconds,
    eventCount: typeof row.event_count === "number" ? row.event_count : 0,
    longLiquidationCount: typeof row.long_liquidation_count === "number" ? row.long_liquidation_count : 0,
    shortLiquidationCount: typeof row.short_liquidation_count === "number" ? row.short_liquidation_count : 0,
    dominantSide: dominantSide(row.dominant_side),
    totalNotionalUsd: typeof row.total_notional_usd === "number" ? row.total_notional_usd : undefined,
    largestEventNotionalUsd: typeof row.largest_event_notional_usd === "number" ? row.largest_event_notional_usd : undefined,
    source: row.source || "supabase",
    surfaceReplayRequired: ["Shield Advanced", "PDF Advanced", "VLM Brain", "Angel", "Audit/progress TXT"],
    copyBoundary: "PASS2469 replay proves the stored liquidation snapshot lineage/fingerprint only. It still cannot become leverage, entry, exit or confirmed squeeze advice by itself.",
  };
}

export async function persistPass2469LiquidationReplay(args: {
  snapshot: Pass2468SignedLiquidationSnapshot;
  ledgerFingerprint?: string;
  now?: Date;
}) {
  const record = recordMemoryReplay(buildPass2469ReplayRecord({ snapshot: args.snapshot, ledgerFingerprint: args.ledgerFingerprint, source: "memory", now: args.now }));
  if (hasSupabaseServiceRoleConfig()) {
    const durableRecord = { ...record, source: "supabase" as const };
    try {
      const response = await supabaseServiceRestRequest(`/${TABLE_NAME}?on_conflict=replay_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rowFromRecord(durableRecord)),
      });
      if (response?.ok) {
        recordMemoryReplay(durableRecord);
        return { record: durableRecord, storageMode: "supabase_ready" as const, persisted: true };
      }
    } catch {
      // A durable outage must never be mislabeled as persisted evidence.
    }
  }
  return { record, storageMode: "memory_fallback" as const, persisted: false };
}

export async function listPass2469LiquidationReplays(args: {
  query?: string;
  symbol?: string;
  fingerprint?: string;
  limit?: number;
  now?: Date;
}): Promise<{ records: Pass2469LiquidationReplayRecord[]; storageMode: Pass2469LiquidationReplayStore["storageMode"] }> {
  const now = args.now ?? new Date();
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.query);
  const limit = clamp(Math.round(args.limit ?? 24), 1, MEMORY_LIMIT_PER_SYMBOL);
  const memory = pair ? (memoryReplayStore.get(pair.toUpperCase()) ?? []) : Array.from(memoryReplayStore.values()).flat();
  const filteredMemory = memory
    .filter((record) => !args.fingerprint || record.replayFingerprint === args.fingerprint || record.snapshotFingerprint === args.fingerprint || record.ledgerFingerprint === args.fingerprint)
    .slice(0, limit)
    .map((record) => ({ ...record, ageSeconds: secondsBetween(now, record.observedAt), state: secondsBetween(now, record.observedAt) <= record.maxAgeSeconds && record.state !== "invalid" ? "fresh" as const : record.state === "invalid" ? "invalid" as const : "expired" as const }));

  if (!hasSupabaseServiceRoleConfig() || !pair) {
    return { records: filteredMemory, storageMode: resolvePass2469LiquidationReplayStorageMode() };
  }

  const params = new URLSearchParams({
    select: "*",
    symbol: `eq.${pair}`,
    order: "observed_at.desc",
    limit: String(limit),
  });
  if (args.fingerprint) {
    const fingerprint = args.fingerprint.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 180);
    if (fingerprint) {
      params.set("or", `(replay_fingerprint.eq.${fingerprint},snapshot_fingerprint.eq.${fingerprint},ledger_fingerprint.eq.${fingerprint})`);
    }
  }
  try {
    const response = await supabaseServiceRestRequest(`/${TABLE_NAME}?${params.toString()}`, { method: "GET" });
    if (!response?.ok) return { records: filteredMemory, storageMode: "memory_fallback" };
    const data = await response.json() as DbReplayRow[];
    const supabaseRecords = data.map((row) => recordFromRow(row, now)).filter((item): item is Pass2469LiquidationReplayRecord => Boolean(item));
    const merged = [...supabaseRecords, ...filteredMemory].filter((record, index, all) => all.findIndex((item) => item.replayId === record.replayId) === index).slice(0, limit);
    return { records: merged, storageMode: "supabase_ready" };
  } catch {
    return { records: filteredMemory, storageMode: "memory_fallback" };
  }
}

export function buildPass2469LiquidationReplayStore(args: {
  query?: string;
  symbol?: string;
  ledger?: Pass2468LiquidationSnapshotLedger | null;
  records?: Pass2469LiquidationReplayRecord[];
  now?: Date;
}): Pass2469LiquidationReplayStore {
  const now = args.now ?? new Date();
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.ledger?.symbol ?? args.query);
  if (!pair) {
    return {
      version: PASS2469_LIQUIDATION_REPLAY_STORE_ID,
      state: "not_applicable",
      query: args.query,
      symbol: args.symbol,
      normalizedPair: undefined,
      replayCount: 0,
      freshReplayCount: 0,
      expiredReplayCount: 0,
      invalidReplayCount: 0,
      venueCount: 0,
      twoVenueReplayReady: false,
      replayStoreFingerprint: "PASS2469-NOT-APPLICABLE",
      storageMode: "not_applicable",
      records: [],
      surfaceReplayChecklist: [],
      lanes: [],
      advancedCopyRule: "PASS2469 replay store applies only when a crypto perpetual pair is mapped.",
      missingForWorldClass: ["perpetual pair mapping"],
      nextImplementationActions: ["Map the asset to a derivatives venue before replaying liquidation snapshots."],
      generatedAt: nowIso(now),
    };
  }
  const fromLedger = (args.ledger?.snapshots ?? []).map((snapshot) => buildPass2469ReplayRecord({ snapshot, ledgerFingerprint: args.ledger?.ledgerFingerprint, source: "adapter_contract", now }));
  const fromMemory = memoryReplayStore.get(pair.toUpperCase()) ?? [];
  const records = [...(args.records ?? []), ...fromLedger, ...fromMemory]
    .filter((record, index, all) => all.findIndex((item) => item.replayId === record.replayId) === index)
    .map((record) => {
      const ageSeconds = secondsBetween(now, record.observedAt);
      return {
        ...record,
        ageSeconds,
        state: record.state === "invalid" ? "invalid" as const : ageSeconds <= record.maxAgeSeconds ? "fresh" as const : "expired" as const,
      };
    })
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, MEMORY_LIMIT_PER_SYMBOL);
  const fresh = records.filter((record) => record.state === "fresh");
  const expired = records.filter((record) => record.state === "expired");
  const invalid = records.filter((record) => record.state === "invalid");
  const venues = new Set(fresh.map((record) => record.venue));
  const latest = records[0];
  const storageMode: Pass2469LiquidationReplayStore["storageMode"] = records.some((record) => record.source === "supabase")
    ? "supabase_ready"
    : resolvePass2469LiquidationReplayStorageMode() === "supabase_ready"
      ? "adapter_contract"
      : "memory_fallback";
  const twoVenueReplayReady = venues.size >= 2;
  const lanes: Pass2469LiquidationReplayStore["lanes"] = [
    {
      id: "durable_write",
      label: "Durable liquidation replay write",
      state: storageMode === "supabase_ready" ? "ready" : fresh.length ? "watch" : "blocked",
      confirmedEvidence: records.map((record) => `${record.source}:${record.replayFingerprint}`).slice(0, 4),
      missingEvidence: storageMode === "supabase_ready" ? [] : ["Supabase table replay persistence or approved durable adapter"],
      copyBoundary: "Memory replay can support local QA only; paid Advanced needs durable replay persistence.",
    },
    {
      id: "fingerprint_replay",
      label: "Fingerprint replay by symbol/fingerprint",
      state: records.length ? "ready" : "blocked",
      confirmedEvidence: records.map((record) => record.replayFingerprint).slice(0, 4),
      missingEvidence: records.length ? [] : ["stored replay record for this symbol"],
      copyBoundary: "Every surface must quote the same replayFingerprint before it can reference this proof lane.",
    },
    {
      id: "freshness_replay",
      label: "Freshness replay max-age",
      state: fresh.length ? "ready" : expired.length ? "blocked" : "watch",
      confirmedEvidence: fresh.map((record) => `${record.venue}: age ${record.ageSeconds}s / max ${record.maxAgeSeconds}s`).slice(0, 4),
      missingEvidence: fresh.length ? [] : ["fresh replay inside max-age"],
      copyBoundary: "Expired replay can stay in audit history, but current Advanced copy must downgrade to historical pressure only.",
    },
    {
      id: "two_venue_replay",
      label: "Two-venue liquidation replay",
      state: twoVenueReplayReady ? "ready" : fresh.length ? "watch" : "blocked",
      confirmedEvidence: Array.from(venues).map((venue) => `${venue} fresh replay`),
      missingEvidence: twoVenueReplayReady ? [] : ["fresh replay from a second derivatives venue"],
      copyBoundary: "Single-venue replay cannot become a confirmed squeeze claim.",
    },
    {
      id: "pdf_shield_brain_parity",
      label: "PDF / Shield / Brain / Angel replay parity",
      state: latest ? "watch" : "blocked",
      confirmedEvidence: latest ? [`latest replay ${latest.replayFingerprint}`] : [],
      missingEvidence: ["render in Shield Advanced", "render in PDF Advanced", "render in VLM Brain", "render in Angel context"],
      copyBoundary: "If one surface cannot replay the fingerprint, all surfaces must downgrade the wording.",
    },
  ];
  const replayStoreFingerprint = records.length
    ? `PASS2469-${stableHash(records.map((record) => record.replayFingerprint)).slice(0, 24).toUpperCase()}`
    : `PASS2469-${pair}-EMPTY-REPLAY-STORE`;
  return {
    version: PASS2469_LIQUIDATION_REPLAY_STORE_ID,
    state: fresh.length ? "ready" : records.length ? "watch" : "blocked",
    query: args.query,
    symbol: args.symbol ?? args.ledger?.symbol ?? pair.replace(/USDT$/, ""),
    normalizedPair: pair,
    replayCount: records.length,
    freshReplayCount: fresh.length,
    expiredReplayCount: expired.length,
    invalidReplayCount: invalid.length,
    venueCount: venues.size,
    twoVenueReplayReady,
    latestReplayFingerprint: latest?.replayFingerprint,
    latestLedgerFingerprint: latest?.ledgerFingerprint,
    replayStoreFingerprint,
    storageMode,
    records,
    surfaceReplayChecklist: ["Shield Advanced row", "PDF Advanced appendix", "VLM Brain evidence capsule", "Angel active context", "operator replay board"],
    lanes,
    advancedCopyRule: "PASS2469 allows Advanced to replay liquidation evidence by symbol/fingerprint. It strengthens proof lineage only; it never creates entry/exit/leverage instructions or a confirmed squeeze without PASS2466/PASS2467 agreement.",
    missingForWorldClass: unique([
      ...lanes.flatMap((lane) => lane.missingEvidence.map((item) => `${lane.label}: ${item}`)),
      storageMode !== "supabase_ready" && "durable Supabase/Redis replay persistence",
      !twoVenueReplayReady && "two-venue replay before confirmed squeeze wording",
      !fresh.length && "fresh replay inside max-age",
      "runtime collector daemon / WebSocket worker",
      "PDF/Shield/Brain/Angel surface replay parity test",
    ]).slice(0, 14),
    nextImplementationActions: [
      "Run SQL migration for velmere_liquidation_snapshot_replays in Supabase.",
      "Wire the liquidation collector daemon to POST PASS2468 snapshots and persist PASS2469 replay records.",
      "Add an operator replay board filtered by symbol, venue, fingerprint and stale status.",
      "Render replayFingerprint in Advanced PDF appendix and VLM Brain result card.",
    ],
    generatedAt: nowIso(now),
  };
}
