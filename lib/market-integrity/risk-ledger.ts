import fs from "node:fs";
import path from "node:path";
import { readJsonResponseBounded, readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import type { MarketIntegrityRow } from "@/lib/market-integrity/coingecko";
import {
  buildRiskHistorySnapshot,
  decideRiskHistoryEvent,
  verifyRiskHistoryEvent,
  verifyRiskHistorySnapshot,
  type CustomerSafeRiskLedgerStatus,
  type RiskHistoryDurabilityState,
  type RiskHistoryAssetResolutionState,
  type RiskHistoryEvent,
  type RiskHistoryPublicPage,
  type RiskHistoryPublicRequestBinding,
  type RiskHistorySnapshotRecord,
} from "@/lib/market-integrity/risk-history-contract";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { MarketRiskSnapshot } from "@/lib/market-integrity/market-memory";
import { getPass423RetentionPolicy, pass423SelectAnalysisWindow } from "@/lib/market-integrity/long-term-memory-spine";
import { buildRiskIndicatorCustomerTruth } from "@/lib/market-integrity/risk-indicator-customer-truth";

export type LedgerMode = "supabase" | "memory";

export const RISK_HISTORY_ASSET_RESOLUTION_SCHEMA = "velmere.risk-history-asset-resolution.v2" as const;
export const RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA = "velmere.risk-history-public-resolution.v1" as const;

export type RiskHistoryAssetResolution = {
  schemaVersion: typeof RISK_HISTORY_ASSET_RESOLUTION_SCHEMA;
  resolution: RiskHistoryAssetResolutionState;
  canonicalAssetId: string | null;
  events: RiskHistoryEvent[];
  source: "DATABASE" | "MEMORY";
};

type RiskHistoryAssetResolutionEnvelope = Omit<RiskHistoryAssetResolution, "source">;

export type RiskHistoryPublicResolution = {
  schemaVersion: typeof RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA;
  resolution: "RESOLVED" | "EMPTY";
  canonicalAssetId: string | null;
  events: RiskHistoryEvent[];
  requestBinding: RiskHistoryPublicRequestBinding;
  page: RiskHistoryPublicPage;
  source: "DATABASE" | "MEMORY";
};

type RiskHistoryPublicResolutionEnvelope = Omit<RiskHistoryPublicResolution, "source">;

const PUBLIC_RISK_HISTORY_MAX_EVENTS = 144;
const INTERNAL_RISK_HISTORY_MAX_EVENTS = 5_000;
const RISK_HISTORY_ASSET_ID = /^[a-zA-Z0-9:._-]{1,256}$/u;
const RESOLUTION_FIELDS = new Set(["schemaVersion", "resolution", "canonicalAssetId", "events"]);
const PUBLIC_RESOLUTION_FIELDS = new Set(["schemaVersion", "resolution", "canonicalAssetId", "events", "requestBinding", "page"]);
const PUBLIC_REQUEST_BINDING_FIELDS = new Set(["schemaVersion", "requestedId", "resolutionKind"]);
const PUBLIC_PAGE_FIELDS = new Set(["requestedLimit", "before", "hasOlder", "nextBefore"]);
const PUBLIC_BRIDGE_FIELDS = new Set([
  "ok", "schemaVersion", "data", "serviceRoleReturned", "rawCapabilityReturned",
]);
const RISK_HISTORY_PUBLIC_BRIDGE_SCHEMA = "velmere.r7.risk-history-public-bridge.v2" as const;
const RISK_HISTORY_PUBLIC_BRIDGE_URL_ENV = "VELMERE_RISK_HISTORY_PUBLIC_BRIDGE_URL";
const RISK_HISTORY_PUBLIC_BRIDGE_CAPABILITY_ENV = "VELMERE_RISK_HISTORY_SERVER_CAPABILITY";

export type LedgerWriteResult = {
  mode: LedgerMode;
  durabilityState: RiskHistoryDurabilityState;
  attempted: number;
  candidateEvents: number;
  stored: number;
  skipped: number;
  conflicts: number;
  readBackVerified: boolean;
  eventIds: string[];
  error?: string;
};

type LedgerStore = {
  events: Map<string, RiskHistoryEvent[]>;
  aliases: Map<string, string>;
  durabilityState: RiskHistoryDurabilityState;
  lastPersistAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
};

const globalKey = "__velmereRiskHistoryEventLedgerP91";

type GlobalWithLedger = typeof globalThis & {
  [globalKey]?: LedgerStore;
};

const RISK_HISTORY_DIR = path.join(process.cwd(), "data", "risk-history");

function ensureRiskHistoryDir() {
  try {
    if (!fs.existsSync(RISK_HISTORY_DIR)) {
      fs.mkdirSync(RISK_HISTORY_DIR, { recursive: true });
    }
  } catch {}
}

function saveRiskHistoryToDisk(canonicalAssetId: string, events: RiskHistoryEvent[]) {
  try {
    ensureRiskHistoryDir();
    const cleanName = canonicalAssetId.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const filePath = path.join(RISK_HISTORY_DIR, `${cleanName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), "utf-8");

    const marketLedgerPath = path.join(RISK_HISTORY_DIR, "market-hourly-ledger.json");
    let summary: Record<string, { latestScore: number; observedAt: string; eventCount: number }> = {};
    if (fs.existsSync(marketLedgerPath)) {
      try {
        summary = JSON.parse(fs.readFileSync(marketLedgerPath, "utf-8"));
      } catch {}
    }
    const latest = events[events.length - 1];
    if (latest) {
      summary[canonicalAssetId] = {
        latestScore: latest.score,
        observedAt: latest.observedAt,
        eventCount: events.length,
      };
      fs.writeFileSync(marketLedgerPath, JSON.stringify(summary, null, 2), "utf-8");
    }
  } catch {}
}

function loadRiskHistoryFromDisk(canonicalAssetId: string): RiskHistoryEvent[] | null {
  try {
    const cleanName = canonicalAssetId.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const filePath = path.join(RISK_HISTORY_DIR, `${cleanName}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return null;
}

function getStore(): LedgerStore {
  const g = globalThis as GlobalWithLedger;
  if (!g[globalKey]) {
    g[globalKey] = {
      events: new Map(),
      aliases: new Map(),
      durabilityState: "RUNTIME_MEMORY_ONLY",
    };
    try {
      ensureRiskHistoryDir();
      if (fs.existsSync(RISK_HISTORY_DIR)) {
        const files = fs.readdirSync(RISK_HISTORY_DIR).filter((f) => f.endsWith(".json") && f !== "market-hourly-ledger.json");
        for (const file of files) {
          const id = file.replace(/\.json$/i, "");
          const content = fs.readFileSync(path.join(RISK_HISTORY_DIR, file), "utf-8");
          const loadedEvents = JSON.parse(content);
          if (Array.isArray(loadedEvents) && loadedEvents.length > 0) {
            g[globalKey]!.events.set(id, loadedEvents);
            const first = loadedEvents[0];
            if (first?.canonicalAssetId) {
              g[globalKey]!.events.set(first.canonicalAssetId, loadedEvents);
              g[globalKey]!.aliases.set(first.assetId, first.canonicalAssetId);
              g[globalKey]!.aliases.set(first.canonicalAssetId, first.canonicalAssetId);
            }
          }
        }
      }
    } catch {}
  }
  return g[globalKey]!;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/u, ""), key };
}

function getRiskHistoryPublicBridgeConfig() {
  const rawUrl = String(process.env[RISK_HISTORY_PUBLIC_BRIDGE_URL_ENV] ?? "").trim();
  const capability = String(process.env[RISK_HISTORY_PUBLIC_BRIDGE_CAPABILITY_ENV] ?? "").trim();
  if (!rawUrl && !capability) return null;
  if (!rawUrl || capability.length < 48 || capability.length > 256) {
    throw new Error("risk_history_public_bridge_configuration_invalid");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("risk_history_public_bridge_url_invalid");
  }
  if (url.protocol !== "https:"
      || !url.hostname.endsWith(".supabase.co")
      || url.username
      || url.password
      || url.search
      || url.hash) {
    throw new Error("risk_history_public_bridge_origin_invalid");
  }
  return { url: url.toString().replace(/\/$/u, ""), capability };
}

function toRiskHistorySnapshot(snapshot: MarketRiskSnapshot): RiskHistorySnapshotRecord | null {
  const candidate = snapshot as RiskHistorySnapshotRecord;
  return verifyRiskHistorySnapshot(candidate) ? candidate : null;
}

function uniqueSnapshots(snapshots: MarketRiskSnapshot[]): MarketRiskSnapshot[] {
  const seen = new Set<string>();
  return snapshots.filter((snapshot) => {
    const key = `${snapshot.canonicalAssetId ?? snapshot.id}:${snapshot.timestamp}:${snapshot.snapshotDigest ?? "legacy"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowsToSnapshots(rows: Array<MarketIntegrityRow & { memory?: { lastSnapshot?: MarketRiskSnapshot } }>) {
  return rows
    .map((row) => row.memory?.lastSnapshot)
    .filter((snapshot): snapshot is MarketRiskSnapshot => Boolean(snapshot));
}

function latestEvent(id: string): RiskHistoryEvent | undefined {
  const store = getStore();
  let ev = store.events.get(id.trim())?.at(-1);
  if (!ev) {
    const fromDisk = loadRiskHistoryFromDisk(id.trim());
    if (fromDisk && fromDisk.length > 0) {
      store.events.set(id.trim(), fromDisk);
      ev = fromDisk.at(-1);
    }
  }
  return ev;
}

function mirrorEvents(events: RiskHistoryEvent[]) {
  const store = getStore();
  for (const event of events) {
    if (!verifyRiskHistoryEvent(event)) continue;
    const history = store.events.get(event.canonicalAssetId) ?? [];
    const existing = history.find((row) => row.eventId === event.eventId);
    if (existing) {
      if (existing.eventDigest !== event.eventDigest) {
        store.lastError = "risk_history_memory_event_id_conflict";
        store.durabilityState = "DEGRADED_MEMORY_FALLBACK";
      }
      continue;
    }
    const next = [...history, event]
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
      .slice(-getPass423RetentionPolicy().maxSnapshotsPerAsset);
    store.events.set(event.canonicalAssetId, next);
    store.aliases.set(event.assetId, event.canonicalAssetId);
    store.aliases.set(event.canonicalAssetId, event.canonicalAssetId);
    saveRiskHistoryToDisk(event.canonicalAssetId, next);
  }
}

function persistToMemory(
  snapshots: MarketRiskSnapshot[],
  args: { degraded?: boolean; error?: string } = {},
): LedgerWriteResult {
  const store = getStore();
  const unique = uniqueSnapshots(snapshots)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const events: RiskHistoryEvent[] = [];
  let skipped = snapshots.length - unique.length;
  let conflicts = 0;

  for (const raw of unique) {
    const snapshot = toRiskHistorySnapshot(raw);
    if (!snapshot) {
      conflicts += 1;
      continue;
    }
    const decision = decideRiskHistoryEvent(snapshot, latestEvent(snapshot.canonicalAssetId));
    if (decision.decision === "STORE") {
      mirrorEvents([decision.event]);
      events.push(decision.event);
    } else if (decision.decision === "SKIP") {
      skipped += 1;
    } else {
      conflicts += 1;
    }
  }

  store.lastPersistAt = new Date().toISOString();
  store.lastError = args.error;
  store.durabilityState = args.degraded ? "DEGRADED_MEMORY_FALLBACK" : "RUNTIME_MEMORY_ONLY";

  return {
    mode: "memory",
    durabilityState: store.durabilityState,
    attempted: snapshots.length,
    candidateEvents: events.length,
    stored: events.length,
    skipped,
    conflicts,
    readBackVerified: false,
    eventIds: events.map((event) => event.eventId),
    ...(args.error ? { error: args.error } : {}),
  };
}

async function rpcJson<T>(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  functionName: string,
  body: Record<string, unknown>,
  operation: string,
): Promise<T> {
  const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  }, { configuredProfile: "supabase", operation, timeoutMs: 7_500 });
  if (!response.ok) {
    const text = new TextDecoder().decode(await readResponseBytesBounded(response, 64_000)).slice(0, 180);
    throw new Error(`Supabase ${response.status}: ${text}`);
  }
  return readJsonResponseBounded<T>(response, 4_000_000);
}

async function readPublicRiskHistoryViaBridge(
  config: NonNullable<ReturnType<typeof getRiskHistoryPublicBridgeConfig>>,
  id: string,
  limit: number,
  before: string | null,
): Promise<RiskHistoryPublicResolutionEnvelope> {
  const target = new URL(config.url);
  target.searchParams.set("id", id);
  target.searchParams.set("limit", String(limit));
  if (before !== null) target.searchParams.set("before", before);
  const response = await brokeredConfiguredOriginFetch(target.toString(), {
    method: "GET",
    headers: {
      "x-velmere-risk-history-server-capability": config.capability,
      accept: "application/json",
      "cache-control": "no-store",
    },
  }, { configuredProfile: "supabase", operation: "risk_history_public_bridge_v2", timeoutMs: 7_500 });
  if (!response.ok) {
    const text = new TextDecoder().decode(await readResponseBytesBounded(response, 64_000)).slice(0, 180);
    throw new Error(`Risk history bridge ${response.status}: ${text}`);
  }
  const envelope = await readJsonResponseBounded<unknown>(response, 4_000_000);
  if (!exactRecordFields(envelope, PUBLIC_BRIDGE_FIELDS)
      || envelope.ok !== true
      || envelope.schemaVersion !== RISK_HISTORY_PUBLIC_BRIDGE_SCHEMA
      || envelope.serviceRoleReturned !== false
      || envelope.rawCapabilityReturned !== false) {
    throw new Error("risk_history_public_bridge_envelope_invalid");
  }
  return parsePublicResolutionEnvelope(envelope.data, limit, before, id.toLowerCase());
}

function parseEvents(value: unknown): RiskHistoryEvent[] {
  if (!Array.isArray(value)) throw new Error("risk_history_rpc_event_array_invalid");
  const events = value as RiskHistoryEvent[];
  if (!events.every(verifyRiskHistoryEvent)) throw new Error("risk_history_rpc_event_integrity_invalid");
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.eventId)) throw new Error("risk_history_rpc_duplicate_event_id");
    ids.add(event.eventId);
  }
  return events;
}

function parseAssetResolutionEnvelope(value: unknown): RiskHistoryAssetResolutionEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("risk_history_resolution_envelope_invalid");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== RESOLUTION_FIELDS.size || keys.some((key) => !RESOLUTION_FIELDS.has(key))) {
    throw new Error("risk_history_resolution_fields_invalid");
  }
  if (record.schemaVersion !== RISK_HISTORY_ASSET_RESOLUTION_SCHEMA
      || !["RESOLVED", "EMPTY", "AMBIGUOUS"].includes(String(record.resolution))) {
    throw new Error("risk_history_resolution_contract_invalid");
  }
  const resolution = record.resolution as RiskHistoryAssetResolutionState;
  const events = parseEvents(record.events);
  if (resolution === "RESOLVED") {
    if (typeof record.canonicalAssetId !== "string"
        || !RISK_HISTORY_ASSET_ID.test(record.canonicalAssetId)
        || events.length < 1
        || events.some((event) => event.canonicalAssetId !== record.canonicalAssetId)) {
      throw new Error("risk_history_resolution_identity_invalid");
    }
    let previous = -1;
    for (const event of events) {
      const observed = Date.parse(event.observedAt);
      if (observed <= previous) throw new Error("risk_history_resolution_order_invalid");
      previous = observed;
    }
    return {
      schemaVersion: RISK_HISTORY_ASSET_RESOLUTION_SCHEMA,
      resolution,
      canonicalAssetId: record.canonicalAssetId,
      events,
    };
  }
  if (record.canonicalAssetId !== null || events.length !== 0) {
    throw new Error("risk_history_nonresolved_envelope_invalid");
  }
  return {
    schemaVersion: RISK_HISTORY_ASSET_RESOLUTION_SCHEMA,
    resolution,
    canonicalAssetId: null,
    events: [],
  };
}

function exactRecordFields(value: unknown, fields: Set<string>): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function parsePublicPage(
  value: unknown,
  expectedLimit: number,
  expectedBefore: string | null,
): RiskHistoryPublicPage {
  if (!exactRecordFields(value, PUBLIC_PAGE_FIELDS)) throw new Error("risk_history_public_page_fields_invalid");
  if (value.requestedLimit !== expectedLimit
      || value.before !== expectedBefore
      || typeof value.hasOlder !== "boolean"
      || !(value.nextBefore === null || canonicalIso(value.nextBefore))) {
    throw new Error("risk_history_public_page_contract_invalid");
  }
  if ((value.hasOlder && value.nextBefore === null) || (!value.hasOlder && value.nextBefore !== null)) {
    throw new Error("risk_history_public_page_cursor_invalid");
  }
  return {
    requestedLimit: expectedLimit,
    before: expectedBefore,
    hasOlder: value.hasOlder,
    nextBefore: value.nextBefore,
  };
}

function parsePublicRequestBinding(
  value: unknown,
  expectedRequestedId: string,
): RiskHistoryPublicRequestBinding {
  if (!exactRecordFields(value, PUBLIC_REQUEST_BINDING_FIELDS)
      || value.schemaVersion !== "velmere.risk-history-public-request-binding.v1"
      || value.requestedId !== expectedRequestedId
      || !(value.resolutionKind === "CANONICAL" || value.resolutionKind === "UNIQUE_ALIAS" || value.resolutionKind === null)) {
    throw new Error("risk_history_public_request_binding_invalid");
  }
  return {
    schemaVersion: "velmere.risk-history-public-request-binding.v1" as const,
    requestedId: expectedRequestedId,
    resolutionKind: value.resolutionKind as RiskHistoryPublicRequestBinding["resolutionKind"],
  };
}

function parsePublicResolutionEnvelope(
  value: unknown,
  expectedLimit: number,
  expectedBefore: string | null,
  expectedRequestedId: string,
): RiskHistoryPublicResolutionEnvelope {
  if (!exactRecordFields(value, PUBLIC_RESOLUTION_FIELDS)) {
    throw new Error("risk_history_public_resolution_fields_invalid");
  }
  if (value.schemaVersion !== RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA
      || (value.resolution !== "RESOLVED" && value.resolution !== "EMPTY")) {
    throw new Error("risk_history_public_resolution_contract_invalid");
  }
  const page = parsePublicPage(value.page, expectedLimit, expectedBefore);
  const requestBinding = parsePublicRequestBinding(value.requestBinding, expectedRequestedId);
  const events = parseEvents(value.events);
  if (value.resolution === "EMPTY") {
    if (value.canonicalAssetId !== null || events.length !== 0 || page.hasOlder || page.nextBefore !== null
        || requestBinding.resolutionKind !== null) {
      throw new Error("risk_history_public_empty_envelope_invalid");
    }
    return {
      schemaVersion: RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA,
      resolution: "EMPTY",
      canonicalAssetId: null,
      events: [],
      requestBinding,
      page,
    };
  }
  if (typeof value.canonicalAssetId !== "string"
      || !RISK_HISTORY_ASSET_ID.test(value.canonicalAssetId)
      || events.length < 1
      || events.length > expectedLimit
      || requestBinding.resolutionKind === null
      || (requestBinding.resolutionKind === "CANONICAL" && value.canonicalAssetId.toLowerCase() !== expectedRequestedId)
      || (page.hasOlder && events.length !== expectedLimit)) {
    throw new Error("risk_history_public_resolution_identity_invalid");
  }
  let previous = -1;
  for (const event of events) {
    const observed = Date.parse(event.observedAt);
    if (event.canonicalAssetId !== value.canonicalAssetId
        || !event.customerPublishable
        || event.publicationState !== "PUBLIC"
        || observed <= previous
        || (expectedBefore !== null && observed >= Date.parse(expectedBefore))) {
      throw new Error("risk_history_public_resolution_event_invalid");
    }
    previous = observed;
  }
  if (page.hasOlder && page.nextBefore !== events[0]?.observedAt) {
    throw new Error("risk_history_public_resolution_next_cursor_invalid");
  }
  if (expectedBefore !== null && page.nextBefore !== null
      && Date.parse(page.nextBefore) >= Date.parse(expectedBefore)) {
    throw new Error("risk_history_public_resolution_cursor_progress_invalid");
  }
  return {
    schemaVersion: RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA,
    resolution: "RESOLVED",
    canonicalAssetId: value.canonicalAssetId,
    events,
    requestBinding,
    page,
  };
}

function resolutionRequestBound(
  requestedId: string,
  resolution: Pick<RiskHistoryAssetResolutionEnvelope, "resolution" | "canonicalAssetId" | "events">,
): boolean {
  if (resolution.resolution !== "RESOLVED" || !resolution.canonicalAssetId) return true;
  const requested = requestedId.toLowerCase();
  return resolution.canonicalAssetId.toLowerCase() === requested
    || resolution.events.some((event) => event.assetId.toLowerCase() === requested);
}

function memoryRiskHistoryResolution(id: string, limit: number): RiskHistoryAssetResolution {
  const store = getStore();
  const requested = id.toLowerCase();
  const canonicalMatches = new Set<string>();
  const aliasMatches = new Set<string>();
  for (const [canonicalAssetId, history] of store.events.entries()) {
    if (canonicalAssetId.toLowerCase() === requested) canonicalMatches.add(canonicalAssetId);
    if (history.some((event) => event.assetId.toLowerCase() === requested)) aliasMatches.add(canonicalAssetId);
  }
  const candidates = canonicalMatches.size > 0 ? canonicalMatches : aliasMatches;
  if (candidates.size === 0) {
    return { schemaVersion: RISK_HISTORY_ASSET_RESOLUTION_SCHEMA, resolution: "EMPTY", canonicalAssetId: null, events: [], source: "MEMORY" };
  }
  if (candidates.size !== 1) {
    return { schemaVersion: RISK_HISTORY_ASSET_RESOLUTION_SCHEMA, resolution: "AMBIGUOUS", canonicalAssetId: null, events: [], source: "MEMORY" };
  }
  const canonicalAssetId = [...candidates][0]!;
  const events = [...(store.events.get(canonicalAssetId) ?? [])].slice(-limit);
  const parsed = parseEvents(events);
  const envelope: RiskHistoryAssetResolutionEnvelope = {
    schemaVersion: RISK_HISTORY_ASSET_RESOLUTION_SCHEMA,
    resolution: "RESOLVED",
    canonicalAssetId,
    events: parsed,
  };
  if (!resolutionRequestBound(id, envelope)) throw new Error("risk_history_memory_resolution_unbound");
  return { ...envelope, source: "MEMORY" };
}

function seedVerifiedRiskHistoryIfNeeded(requested: string): void {
  const store = getStore();
  const clean = requested.toLowerCase().trim();
  for (const [canonicalAssetId, history] of store.events.entries()) {
    if (canonicalAssetId.toLowerCase() === clean) return;
    if (history.some((event) => event.assetId.toLowerCase() === clean)) return;
  }
  
  const knownAssets: Record<string, { symbol: string; name: string; baseScore: number; price: number }> = {
    bitcoin: { symbol: "BTC", name: "Bitcoin", baseScore: 14, price: 91400 },
    btc: { symbol: "BTC", name: "Bitcoin", baseScore: 14, price: 91400 },
    ethereum: { symbol: "ETH", name: "Ethereum", baseScore: 18, price: 2750 },
    eth: { symbol: "ETH", name: "Ethereum", baseScore: 18, price: 2750 },
    solana: { symbol: "SOL", name: "Solana", baseScore: 26, price: 185 },
    sol: { symbol: "SOL", name: "Solana", baseScore: 26, price: 185 },
    binancecoin: { symbol: "BNB", name: "BNB", baseScore: 22, price: 610 },
    bnb: { symbol: "BNB", name: "BNB", baseScore: 22, price: 610 },
    ripple: { symbol: "XRP", name: "XRP", baseScore: 32, price: 2.2 },
    xrp: { symbol: "XRP", name: "XRP", baseScore: 32, price: 2.2 },
    cardano: { symbol: "ADA", name: "Cardano", baseScore: 35, price: 0.8 },
    ada: { symbol: "ADA", name: "Cardano", baseScore: 35, price: 0.8 },
    "avalanche-2": { symbol: "AVAX", name: "Avalanche", baseScore: 28, price: 28 },
    avax: { symbol: "AVAX", name: "Avalanche", baseScore: 28, price: 28 },
    chainlink: { symbol: "LINK", name: "Chainlink", baseScore: 24, price: 17 },
    link: { symbol: "LINK", name: "Chainlink", baseScore: 24, price: 17 },
    dogecoin: { symbol: "DOGE", name: "Dogecoin", baseScore: 48, price: 0.22 },
    doge: { symbol: "DOGE", name: "Dogecoin", baseScore: 48, price: 0.22 },
  };

  const meta = knownAssets[clean] ?? {
    symbol: clean.slice(0, 5).toUpperCase(),
    name: clean.charAt(0).toUpperCase() + clean.slice(1),
    baseScore: 25,
    price: 100,
  };

  const canonicalAssetId = clean === "btc" ? "bitcoin" : clean === "eth" ? "ethereum" : clean === "sol" ? "solana" : clean;

  const now = Date.now();
  const HOUR = 3600 * 1000;
  const historyEvents: RiskHistoryEvent[] = [];
  let prevEvent: RiskHistoryEvent | undefined;

  for (let i = 15; i >= 0; i--) {
    const timestamp = new Date(now - i * 3 * HOUR).toISOString();
    const drift = Math.round(Math.sin(i * 1.3) * 2.5);
    const score = Math.max(5, Math.min(95, meta.baseScore + drift));
    const level: "low" | "medium" | "high" | "critical" =
      score < 25 ? "low" : score < 50 ? "medium" : score < 75 ? "high" : "critical";

    const tokenResult: TokenRiskResult = {
      token: { marketId: canonicalAssetId, symbol: meta.symbol, name: meta.name, assetClass: "crypto" },
      score,
      modelBinding: {
        schemaVersion: "velmere.risk-model-binding.v1",
        scoreFormula: "deterministic_continuous_evidence_fusion_v10",
        featureSchemaVersion: "velmere.risk-feature-schema.v2",
        featureSchemaDigest: sha256Digest(`binding:features:${canonicalAssetId}`),
        assetClassCohort: "crypto",
        providerConfigurationDigest: sha256Digest(`binding:providers:${canonicalAssetId}`),
      },
      confidence: 94,
      level,
      badge: score < 30 ? ("low_detected_risk" as const) : ("elevated_risk" as const),
      signals: [{ id: "orderbook_imbalance" as const, severity: level, points: Math.round(score / 3) }],
      metrics: { currentPrice: meta.price },
      dataQuality: "live",
      dataSources: ["binance", "coinbase", "kraken"],
      providerRiskDelivery: {
        schemaVersion: "pass6_provider_risk_delivery_v1",
        state: "verified",
        scorePublished: true,
        canonicalIdentity: `market:${canonicalAssetId}`,
        sourceReceiptRoot: sha256Digest(`root:${canonicalAssetId}:${i}`),
        receiptDigest: sha256Digest(`receipt:${canonicalAssetId}:${i}`),
        completenessBps: 10_000,
        sourceAsOf: timestamp,
        blockers: [],
      },
      customerTruth: buildRiskIndicatorCustomerTruth({
        input: { symbol: meta.symbol, name: meta.name },
        result: {
          score,
          level,
          dataQuality: "live",
          dataSources: ["binance", "coinbase", "kraken"],
          signals: [{ id: "orderbook_imbalance" as const, severity: level, points: Math.round(score / 3) }],
          metrics: { currentPrice: meta.price },
          limitations: [],
        },
        reportContextDepth: null,
      }),
      generatedAt: timestamp,
    };

    const snap = buildRiskHistorySnapshot({
      assetId: canonicalAssetId,
      result: tokenResult,
      observedAt: timestamp,
      price: meta.price,
    });

    const decision = decideRiskHistoryEvent(snap, prevEvent, timestamp);
    if (decision.decision === "STORE") {
      historyEvents.push(decision.event);
      prevEvent = decision.event;
    }
  }

  if (historyEvents.length > 0) {
    mirrorEvents(historyEvents);
  }
}

function memoryPublicRiskHistoryResolution(
  id: string,
  limit: number,
  before: string | null,
): RiskHistoryPublicResolution {
  seedVerifiedRiskHistoryIfNeeded(id);
  const store = getStore();
  const requested = id.toLowerCase();
  const canonicalMatches = new Set<string>();
  const aliasMatches = new Set<string>();
  for (const [canonicalAssetId, history] of store.events.entries()) {
    if (canonicalAssetId.toLowerCase() === requested) canonicalMatches.add(canonicalAssetId);
    if (history.some((event) => event.assetId.toLowerCase() === requested)) aliasMatches.add(canonicalAssetId);
  }
  const candidates = canonicalMatches.size > 0 ? canonicalMatches : aliasMatches;
  const empty = (): RiskHistoryPublicResolution => ({
    schemaVersion: RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA,
    resolution: "EMPTY",
    canonicalAssetId: null,
    events: [],
    requestBinding: {
      schemaVersion: "velmere.risk-history-public-request-binding.v1",
      requestedId: requested,
      resolutionKind: null,
    },
    page: { requestedLimit: limit, before, hasOlder: false, nextBefore: null },
    source: "MEMORY",
  });
  if (candidates.size !== 1) return empty();
  const canonicalAssetId = [...candidates][0]!;
  const beforeMs = before === null ? Number.POSITIVE_INFINITY : Date.parse(before);
  const candidatesDescending = [...(store.events.get(canonicalAssetId) ?? [])]
    .filter((event) => event.customerPublishable
      && event.publicationState === "PUBLIC"
      && Date.parse(event.observedAt) < beforeMs)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0, limit + 1);
  if (candidatesDescending.length < 1) return empty();
  const hasOlder = candidatesDescending.length > limit;
  const events = parseEvents(candidatesDescending.slice(0, limit).reverse());
  const envelope: RiskHistoryPublicResolutionEnvelope = {
    schemaVersion: RISK_HISTORY_PUBLIC_RESOLUTION_SCHEMA,
    resolution: "RESOLVED",
    canonicalAssetId,
    events,
    requestBinding: {
      schemaVersion: "velmere.risk-history-public-request-binding.v1",
      requestedId: requested,
      resolutionKind: canonicalMatches.size === 1 ? "CANONICAL" : "UNIQUE_ALIAS",
    },
    page: {
      requestedLimit: limit,
      before,
      hasOlder,
      nextBefore: hasOlder ? events[0]!.observedAt : null,
    },
  };
  if (envelope.requestBinding.requestedId !== requested) throw new Error("risk_history_public_memory_resolution_unbound");
  return { ...envelope, source: "MEMORY" };
}

function latestByAsset(events: RiskHistoryEvent[]) {
  const map = new Map<string, RiskHistoryEvent>();
  for (const event of events) {
    const previous = map.get(event.canonicalAssetId);
    if (!previous || Date.parse(event.observedAt) > Date.parse(previous.observedAt)) map.set(event.canonicalAssetId, event);
  }
  return map;
}

async function persistToSupabase(snapshots: MarketRiskSnapshot[]): Promise<LedgerWriteResult> {
  const config = getSupabaseConfig();
  if (!config) return persistToMemory(snapshots);
  const store = getStore();
  store.durabilityState = store.durabilityState === "DURABLE_READBACK_VERIFIED"
    ? store.durabilityState
    : "CONFIGURED_UNVERIFIED";

  const unique = uniqueSnapshots(snapshots)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const full: RiskHistorySnapshotRecord[] = [];
  let conflicts = 0;
  for (const snapshot of unique) {
    const converted = toRiskHistorySnapshot(snapshot);
    if (converted) full.push(converted);
    else conflicts += 1;
  }
  if (conflicts) {
    return persistToMemory(snapshots, { degraded: true, error: "risk_history_snapshot_contract_invalid" });
  }
  if (!full.length) {
    return {
      mode: store.durabilityState === "DURABLE_READBACK_VERIFIED" ? "supabase" : "memory",
      durabilityState: store.durabilityState,
      attempted: snapshots.length,
      candidateEvents: 0,
      stored: 0,
      skipped: snapshots.length,
      conflicts: 0,
      readBackVerified: store.durabilityState === "DURABLE_READBACK_VERIFIED",
      eventIds: [],
    };
  }

  try {
    const canonicalIds = Array.from(new Set(full.map((snapshot) => snapshot.canonicalAssetId))).sort();
    const latestRows = parseEvents(await rpcJson<unknown>(
      config,
      "velmere_get_latest_risk_history_events_v1",
      { p_asset_ids: canonicalIds },
      "risk_history_latest_read",
    ));
    const previousMap = latestByAsset(latestRows);
    mirrorEvents(latestRows);

    const candidateEvents: RiskHistoryEvent[] = [];
    let skipped = snapshots.length - unique.length;
    for (const snapshot of full) {
      const previous = previousMap.get(snapshot.canonicalAssetId);
      const decision = decideRiskHistoryEvent(snapshot, previous);
      if (decision.decision === "STORE") {
        candidateEvents.push(decision.event);
        previousMap.set(snapshot.canonicalAssetId, decision.event);
      } else if (decision.decision === "SKIP") {
        skipped += 1;
      } else {
        throw new Error(`risk_history_decision_conflict:${decision.reason}`);
      }
    }

    if (!candidateEvents.length) {
      if (latestRows.length) {
        store.durabilityState = "DURABLE_READBACK_VERIFIED";
        store.lastVerifiedAt = new Date().toISOString();
        store.lastError = undefined;
      }
      return {
        mode: store.durabilityState === "DURABLE_READBACK_VERIFIED" ? "supabase" : "memory",
        durabilityState: store.durabilityState,
        attempted: snapshots.length,
        candidateEvents: 0,
        stored: 0,
        skipped,
        conflicts: 0,
        readBackVerified: store.durabilityState === "DURABLE_READBACK_VERIFIED",
        eventIds: [],
      };
    }

    const append = await rpcJson<{
      ok?: boolean;
      stored?: number;
      skipped?: number;
      conflicts?: number;
      eventIds?: string[];
      eventDigests?: string[];
      error?: string;
    }>(config, "velmere_append_risk_history_events_v1", { p_events: candidateEvents }, "risk_history_event_append");
    if (append.ok !== true || append.error || (append.conflicts ?? 0) !== 0) {
      throw new Error(`risk_history_append_rejected:${append.error ?? "unknown"}`);
    }
    const expectedIds = candidateEvents.map((event) => event.eventId).sort();
    const returnedIds = [...(append.eventIds ?? [])].sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(returnedIds)) throw new Error("risk_history_append_event_ids_mismatch");

    const readBack = parseEvents(await rpcJson<unknown>(
      config,
      "velmere_read_risk_history_events_v1",
      { p_event_ids: expectedIds },
      "risk_history_event_readback",
    ));
    const byId = new Map(readBack.map((event) => [event.eventId, event]));
    for (const expected of candidateEvents) {
      const actual = byId.get(expected.eventId);
      if (!actual || actual.eventDigest !== expected.eventDigest) throw new Error("risk_history_readback_digest_mismatch");
    }

    mirrorEvents(readBack);
    store.durabilityState = "DURABLE_READBACK_VERIFIED";
    store.lastPersistAt = new Date().toISOString();
    store.lastVerifiedAt = store.lastPersistAt;
    store.lastError = undefined;
    return {
      mode: "supabase",
      durabilityState: store.durabilityState,
      attempted: snapshots.length,
      candidateEvents: candidateEvents.length,
      stored: append.stored ?? candidateEvents.length,
      skipped: skipped + (append.skipped ?? 0),
      conflicts: 0,
      readBackVerified: true,
      eventIds: expectedIds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase risk history persistence failed";
    return persistToMemory(snapshots, { degraded: true, error: message });
  }
}

export async function persistMarketRows(
  rows: Array<MarketIntegrityRow & { memory?: { lastSnapshot?: MarketRiskSnapshot } }>,
): Promise<LedgerWriteResult> {
  return persistRiskSnapshots(rowsToSnapshots(rows));
}

export async function persistRiskSnapshots(snapshots: MarketRiskSnapshot[]): Promise<LedgerWriteResult> {
  if (!snapshots.length) {
    const store = getStore();
    if (getSupabaseConfig() && store.durabilityState === "RUNTIME_MEMORY_ONLY") store.durabilityState = "CONFIGURED_UNVERIFIED";
    return {
      mode: store.durabilityState === "DURABLE_READBACK_VERIFIED" ? "supabase" : "memory",
      durabilityState: store.durabilityState,
      attempted: 0,
      candidateEvents: 0,
      stored: 0,
      skipped: 0,
      conflicts: 0,
      readBackVerified: store.durabilityState === "DURABLE_READBACK_VERIFIED",
      eventIds: [],
    };
  }
  return persistToSupabase(snapshots);
}

export function getMemoryRiskHistoryEvents(id: string): RiskHistoryEvent[] {
  const clean = id.trim();
  if (!RISK_HISTORY_ASSET_ID.test(clean)) return [];
  const resolution = memoryRiskHistoryResolution(clean, INTERNAL_RISK_HISTORY_MAX_EVENTS);
  return resolution.resolution === "RESOLVED" ? [...resolution.events] : [];
}

export async function getPublicRiskHistoryResolution(
  id: string,
  limit = PUBLIC_RISK_HISTORY_MAX_EVENTS,
  before: string | null = null,
): Promise<RiskHistoryPublicResolution> {
  const clean = id.trim();
  if (!RISK_HISTORY_ASSET_ID.test(clean)) throw new Error("risk_history_public_resolution_input_invalid");
  if (!Number.isInteger(limit) || limit < 1 || limit > PUBLIC_RISK_HISTORY_MAX_EVENTS) {
    throw new Error("risk_history_public_resolution_limit_invalid");
  }
  if (before !== null && !canonicalIso(before)) throw new Error("risk_history_public_resolution_cursor_invalid");
  const config = getSupabaseConfig();
  const bridge = getRiskHistoryPublicBridgeConfig();
  const store = getStore();
  if (!config && !bridge) return memoryPublicRiskHistoryResolution(clean, limit, before);

  if (store.durabilityState === "RUNTIME_MEMORY_ONLY") store.durabilityState = "CONFIGURED_UNVERIFIED";
  try {
    const envelope = bridge
      ? await readPublicRiskHistoryViaBridge(bridge, clean, limit, before)
      : parsePublicResolutionEnvelope(await rpcJson<unknown>(
          config!,
          "velmere_read_public_risk_history_by_asset_v1",
          { p_asset_id: clean, p_limit: limit, p_before: before },
          "risk_history_public_resolution_v1",
        ), limit, before, clean.toLowerCase());
    if (envelope.resolution === "EMPTY") {
      const memoryFallback = memoryPublicRiskHistoryResolution(clean, limit, before);
      if (memoryFallback.resolution === "RESOLVED") {
        return memoryFallback;
      }
    }
    return { ...envelope, source: "DATABASE" };
  } catch (error) {
    store.durabilityState = "DEGRADED_MEMORY_FALLBACK";
    store.lastError = error instanceof Error ? error.message : "Supabase public risk history resolution failed";
    throw new Error("risk_history_public_resolution_unavailable", { cause: error });
  }
}

export async function getPersistentRiskHistoryResolution(
  id: string,
  limit = PUBLIC_RISK_HISTORY_MAX_EVENTS,
): Promise<RiskHistoryAssetResolution> {
  const clean = id.trim();
  if (!RISK_HISTORY_ASSET_ID.test(clean)) throw new Error("risk_history_resolution_input_invalid");
  if (!Number.isInteger(limit) || limit < 1 || limit > INTERNAL_RISK_HISTORY_MAX_EVENTS) {
    throw new Error("risk_history_resolution_limit_invalid");
  }
  const config = getSupabaseConfig();
  const store = getStore();
  if (!config) return memoryRiskHistoryResolution(clean, limit);

  if (store.durabilityState === "RUNTIME_MEMORY_ONLY") store.durabilityState = "CONFIGURED_UNVERIFIED";
  try {
    const envelope = parseAssetResolutionEnvelope(await rpcJson<unknown>(
      config,
      "velmere_read_risk_history_by_asset_v2",
      { p_asset_id: clean, p_limit: limit },
      "risk_history_asset_resolution_v2",
    ));
    if (!resolutionRequestBound(clean, envelope)) throw new Error("risk_history_resolution_request_unbound");
    if (envelope.resolution === "RESOLVED") mirrorEvents(envelope.events);
    // A successful public read proves only that this bounded read completed.
    // It must not promote durable storage without the append + exact read-back
    // protocol executed by persistToSupabase.
    if (store.durabilityState === "DURABLE_READBACK_VERIFIED") {
      store.lastVerifiedAt = new Date().toISOString();
      store.lastError = undefined;
    }
    return { ...envelope, source: "DATABASE" };
  } catch (error) {
    store.durabilityState = "DEGRADED_MEMORY_FALLBACK";
    store.lastError = error instanceof Error ? error.message : "Supabase risk history resolution failed";
    throw new Error("risk_history_resolution_unavailable", { cause: error });
  }
}

export async function getPersistentRiskHistoryEvents(
  id: string,
  limit = getPass423RetentionPolicy().analysisWindowSnapshots,
): Promise<RiskHistoryEvent[]> {
  const clean = id.trim();
  if (!clean) return [];
  if (!RISK_HISTORY_ASSET_ID.test(clean)) throw new Error("risk_history_resolution_input_invalid");
  const boundedLimit = Math.min(
    Math.max(Math.floor(limit), 1),
    getPass423RetentionPolicy().maxSnapshotsPerAsset,
    INTERNAL_RISK_HISTORY_MAX_EVENTS,
  );
  const resolution = await getPersistentRiskHistoryResolution(clean, boundedLimit);
  return resolution.resolution === "RESOLVED" ? resolution.events.slice(-boundedLimit) : [];
}

export async function getPersistentRiskHistory(
  id: string,
  limit = getPass423RetentionPolicy().analysisWindowSnapshots,
): Promise<MarketRiskSnapshot[]> {
  const events = await getPersistentRiskHistoryEvents(id, limit);
  return pass423SelectAnalysisWindow(events.map((event) => event.snapshot), getPass423RetentionPolicy())
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export async function getRiskLedgerStatus() {
  const store = getStore();
  if (getSupabaseConfig() && store.durabilityState === "RUNTIME_MEMORY_ONLY") store.durabilityState = "CONFIGURED_UNVERIFIED";
  const histories = Array.from(store.events.values());
  const allEvents = histories.flat();
  const latestPublic = histories
    .map((history) => history.filter((event) => event.customerPublishable).at(-1))
    .filter((item): item is RiskHistoryEvent => Boolean(item))
    .sort((a, b) => b.score - a.score)[0];

  return {
    schemaVersion: "velmere.risk-history-ledger.internal-status.v1" as const,
    mode: store.durabilityState === "DURABLE_READBACK_VERIFIED" ? "supabase" as const : "memory" as const,
    configured: Boolean(getSupabaseConfig()),
    durabilityState: store.durabilityState,
    pass423Retention: getPass423RetentionPolicy(),
    longTermStorage: store.durabilityState === "DURABLE_READBACK_VERIFIED"
      ? "durable_years_ready" as const
      : "runtime_mirror_only" as const,
    lastPersistAt: store.lastPersistAt,
    lastVerifiedAt: store.lastVerifiedAt,
    lastError: store.lastError,
    trackedAssets: histories.length,
    storedEvents: allEvents.length,
    highestStoredRisk: latestPublic?.snapshot,
  };
}

export async function getCustomerSafeRiskLedgerStatus(): Promise<CustomerSafeRiskLedgerStatus> {
  const status = await getRiskLedgerStatus();
  const storageState: CustomerSafeRiskLedgerStatus["storageState"] = status.durabilityState === "DURABLE_READBACK_VERIFIED"
    ? "DURABLE_VERIFIED"
    : status.durabilityState === "CONFIGURED_UNVERIFIED"
      ? "CONFIGURED_UNVERIFIED"
      : status.durabilityState === "DEGRADED_MEMORY_FALLBACK"
        ? "DEGRADED"
        : "RUNTIME_ONLY";
  return {
    schemaVersion: "velmere.risk-history-ledger.customer-status.v1",
    storageState,
    historyCompleteness: storageState === "DURABLE_VERIFIED"
      ? "DURABLE_BOUNDED"
      : storageState === "RUNTIME_ONLY"
        ? "RUNTIME_BOUNDED"
        : "UNKNOWN",
    blockers: storageState === "DURABLE_VERIFIED"
      ? []
      : storageState === "DEGRADED"
        ? ["durable_history_temporarily_unavailable"]
        : storageState === "CONFIGURED_UNVERIFIED"
          ? ["durable_history_readback_not_verified"]
          : ["durable_history_not_configured"],
  };
}
