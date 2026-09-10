import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";

export const PASS4799_PROVIDER_PACKET_LEDGER_ID = "pass4799-provider-evidence-packet-ledger-v1" as const;

export type ProviderEvidencePacketDomain = "kline_series" | "market_impact" | "whale_watch" | "canonical_evidence";

export type ProviderEvidencePacketLedgerEntry = {
  schemaVersion: typeof PASS4799_PROVIDER_PACKET_LEDGER_ID;
  ledgerId: string;
  sequence: number;
  previousEntryHash: string | null;
  entryHash: string;
  domain: ProviderEvidencePacketDomain;
  assetKey: string;
  scope: string;
  packetId: string;
  payloadDigest: string;
  metadataDigest: string;
  metadataKeys: string[];
  observedAt: string;
  recordedAt: string;
};

export type ProviderEvidencePacketLedgerSnapshot = {
  schemaVersion: typeof PASS4799_PROVIDER_PACKET_LEDGER_ID;
  ledgerId: string;
  anchorSequence: number;
  anchorHash: string | null;
  nextSequence: number;
  entryCount: number;
  headHash: string | null;
  entries: ProviderEvidencePacketLedgerEntry[];
};

export type ProviderEvidencePacketLedgerReceipt = {
  schemaVersion: typeof PASS4799_PROVIDER_PACKET_LEDGER_ID;
  ok: boolean;
  idempotent: boolean;
  durable: boolean;
  durableMode: "supabase_rpc" | "not_configured" | "failed";
  ledgerId: string;
  sequence: number | null;
  entryHash: string | null;
  headHash: string | null;
  payloadDigest: string;
  readBackVerified: boolean;
  blockers: string[];
};

type LedgerPacketIndexEntry = {
  payloadDigest: string;
  sequence: number;
  entryHash: string;
};

type LedgerState = {
  anchorSequence: number;
  anchorHash: string | null;
  nextSequence: number;
  entries: ProviderEvidencePacketLedgerEntry[];
  packetIndex: Map<string, LedgerPacketIndexEntry>;
  lock: Promise<void>;
};

type GlobalLedgerRoot = typeof globalThis & {
  __velmereProviderEvidencePacketLedgersPass4799?: Map<string, LedgerState>;
};

const MAX_IN_MEMORY_ENTRIES = 2_000;
const DIGEST_PATTERN = /^(?:sha256:)?[a-f0-9]{64}$/;

function ledgers() {
  const root = globalThis as GlobalLedgerRoot;
  if (!root.__velmereProviderEvidencePacketLedgersPass4799) {
    root.__velmereProviderEvidencePacketLedgersPass4799 = new Map();
  }
  return root.__velmereProviderEvidencePacketLedgersPass4799;
}

function clean(value: string, max = 180) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._\-/]+/g, "-").replace(/-+/g, "-").slice(0, max) || "unknown";
}

function normalizeDigest(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!DIGEST_PATTERN.test(normalized)) throw new Error("sha256_payload_digest_required");
  return normalized.startsWith("sha256:") ? normalized : `sha256:${normalized}`;
}

function safeDate(value?: string | Date) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function buildLedgerId(domain: ProviderEvidencePacketDomain, assetKey: string, scope: string) {
  return `p4799:${domain}:${clean(assetKey, 96)}:${clean(scope, 96)}`;
}

function getState(ledgerId: string) {
  const root = ledgers();
  const existing = root.get(ledgerId);
  if (existing) return existing;
  const state: LedgerState = {
    anchorSequence: 0,
    anchorHash: null,
    nextSequence: 1,
    entries: [],
    packetIndex: new Map(),
    lock: Promise.resolve(),
  };
  root.set(ledgerId, state);
  return state;
}

function entryUnsigned(entry: Omit<ProviderEvidencePacketLedgerEntry, "entryHash">) {
  return entry;
}

function hashEntry(entry: Omit<ProviderEvidencePacketLedgerEntry, "entryHash">) {
  return sha256Digest(canonicalJson(entry));
}

function snapshotFromState(ledgerId: string, state: LedgerState): ProviderEvidencePacketLedgerSnapshot {
  return {
    schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
    ledgerId,
    anchorSequence: state.anchorSequence,
    anchorHash: state.anchorHash,
    nextSequence: state.nextSequence,
    entryCount: state.entries.length,
    headHash: state.entries.at(-1)?.entryHash ?? state.anchorHash,
    entries: state.entries.map((entry) => ({ ...entry, metadataKeys: [...entry.metadataKeys] })),
  };
}

export function verifyProviderEvidencePacketLedger(snapshot: ProviderEvidencePacketLedgerSnapshot) {
  const blockers: string[] = [];
  let previousHash = snapshot.anchorHash;
  let expectedSequence = snapshot.anchorSequence + 1;
  const packetDigests = new Map<string, string>();

  for (const entry of snapshot.entries) {
    if (entry.ledgerId !== snapshot.ledgerId) blockers.push(`ledger_id_mismatch:${entry.sequence}`);
    if (entry.sequence !== expectedSequence) blockers.push(`sequence_mismatch:${entry.sequence}/${expectedSequence}`);
    if (entry.previousEntryHash !== previousHash) blockers.push(`chain_mismatch:${entry.sequence}`);
    const { entryHash, ...unsigned } = entry;
    if (hashEntry(entryUnsigned(unsigned)) !== entryHash) blockers.push(`entry_hash_mismatch:${entry.sequence}`);
    const prior = packetDigests.get(entry.packetId);
    if (prior && prior !== entry.payloadDigest) blockers.push(`packet_digest_conflict:${entry.packetId}`);
    packetDigests.set(entry.packetId, entry.payloadDigest);
    previousHash = entry.entryHash;
    expectedSequence += 1;
  }

  const expectedHead = snapshot.entries.at(-1)?.entryHash ?? snapshot.anchorHash;
  if (snapshot.headHash !== expectedHead) blockers.push("head_hash_mismatch");
  if (snapshot.nextSequence !== snapshot.anchorSequence + snapshot.entries.length + 1) blockers.push("next_sequence_mismatch");
  if (snapshot.entryCount !== snapshot.entries.length) blockers.push("entry_count_mismatch");
  return { valid: blockers.length === 0, blockers } as const;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function persistSupabase(entry: ProviderEvidencePacketLedgerEntry) {
  const config = supabaseConfig();
  if (!config) return { durable: false, mode: "not_configured" as const, readBackVerified: false, blockers: ["durable_packet_ledger_not_configured"] };
  try {
    const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/rpc/append_market_integrity_provider_evidence_packet`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_ledger_id: entry.ledgerId,
        p_sequence: entry.sequence,
        p_previous_entry_hash: entry.previousEntryHash,
        p_entry_hash: entry.entryHash,
        p_domain: entry.domain,
        p_asset_key: entry.assetKey,
        p_scope: entry.scope,
        p_packet_id: entry.packetId,
        p_payload_digest: entry.payloadDigest,
        p_metadata_digest: entry.metadataDigest,
        p_metadata_keys: entry.metadataKeys,
        p_observed_at: entry.observedAt,
        p_recorded_at: entry.recordedAt,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    }, { configuredProfile: "supabase", operation: "provider_evidence_packet_append", timeoutMs: 3_500 });
    if (!response.ok) return { durable: false, mode: "failed" as const, readBackVerified: false, blockers: [`supabase_rpc_http_${response.status}`] };
    const payload = await readJsonResponseBounded<unknown>(response, 256 * 1024).catch(() => null);
    const row = Array.isArray(payload) ? payload[0] : payload;
    const record = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
    const readBackVerified = record.entry_hash === entry.entryHash && Number(record.sequence) === entry.sequence;
    return {
      durable: readBackVerified,
      mode: "supabase_rpc" as const,
      readBackVerified,
      blockers: readBackVerified ? [] : ["supabase_rpc_readback_mismatch"],
    };
  } catch (error) {
    return { durable: false, mode: "failed" as const, readBackVerified: false, blockers: [`supabase_rpc_failed:${error instanceof Error ? error.name : "unknown"}`] };
  }
}

export function digestProviderEvidencePacket(payload: unknown) {
  return sha256Digest(canonicalJson(payload));
}

export async function appendProviderEvidencePacket(args: {
  domain: ProviderEvidencePacketDomain;
  assetKey: string;
  scope: string;
  packetId: string;
  payloadDigest: string;
  metadata?: Record<string, unknown>;
  observedAt?: string | Date;
}) : Promise<ProviderEvidencePacketLedgerReceipt> {
  const assetKey = clean(args.assetKey, 180);
  const scope = clean(args.scope, 120);
  const packetId = clean(args.packetId, 220);
  const payloadDigest = normalizeDigest(args.payloadDigest);
  const metadata = args.metadata ?? {};
  const metadataDigest = sha256Digest(canonicalJson(metadata));
  const metadataKeys = Object.keys(metadata).sort().slice(0, 64);
  const observedAt = safeDate(args.observedAt);
  const ledgerId = buildLedgerId(args.domain, assetKey, scope);
  const state = getState(ledgerId);

  let releaseLock: (() => void) | undefined;
  const previousLock = state.lock;
  state.lock = new Promise<void>((resolve) => { releaseLock = resolve; });
  await previousLock;

  try {
    const samePacket = state.packetIndex.get(packetId);
    if (samePacket) {
      if (samePacket.payloadDigest !== payloadDigest) {
        return {
          schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
          ok: false,
          idempotent: false,
          durable: false,
          durableMode: "failed",
          ledgerId,
          sequence: samePacket.sequence,
          entryHash: samePacket.entryHash,
          headHash: state.entries.at(-1)?.entryHash ?? state.anchorHash,
          payloadDigest,
          readBackVerified: false,
          blockers: ["packet_digest_conflict"],
        };
      }
      return {
        schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
        ok: true,
        idempotent: true,
        durable: false,
        durableMode: "not_configured",
        ledgerId,
        sequence: samePacket.sequence,
        entryHash: samePacket.entryHash,
        headHash: state.entries.at(-1)?.entryHash ?? state.anchorHash,
        payloadDigest,
        readBackVerified: true,
        blockers: [],
      };
    }

    const previousEntryHash = state.entries.at(-1)?.entryHash ?? state.anchorHash;
    const unsigned: Omit<ProviderEvidencePacketLedgerEntry, "entryHash"> = {
      schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
      ledgerId,
      sequence: state.nextSequence,
      previousEntryHash,
      domain: args.domain,
      assetKey,
      scope,
      packetId,
      payloadDigest,
      metadataDigest,
      metadataKeys,
      observedAt,
      recordedAt: new Date().toISOString(),
    };
    const entry: ProviderEvidencePacketLedgerEntry = { ...unsigned, entryHash: hashEntry(unsigned) };
    const appendBlockers: string[] = [];
    if (entry.sequence !== state.nextSequence) appendBlockers.push("next_sequence_mismatch");
    if (entry.previousEntryHash !== previousEntryHash) appendBlockers.push("previous_entry_hash_mismatch");
    if (entry.entryHash !== hashEntry(unsigned)) appendBlockers.push("entry_hash_mismatch");
    if (appendBlockers.length > 0) {
      return {
        schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
        ok: false,
        idempotent: false,
        durable: false,
        durableMode: "failed",
        ledgerId,
        sequence: null,
        entryHash: null,
        headHash: state.entries.at(-1)?.entryHash ?? state.anchorHash,
        payloadDigest,
        readBackVerified: false,
        blockers: appendBlockers,
      };
    }
    state.entries.push(entry);
    state.packetIndex.set(packetId, { payloadDigest: entry.payloadDigest, sequence: entry.sequence, entryHash: entry.entryHash });
    state.nextSequence += 1;
    if (state.entries.length > MAX_IN_MEMORY_ENTRIES) {
      const removed = state.entries.shift();
      if (removed) { state.anchorSequence = removed.sequence; state.anchorHash = removed.entryHash; }
    }
    const durable = await persistSupabase(entry);
    return {
      schemaVersion: PASS4799_PROVIDER_PACKET_LEDGER_ID,
      ok: true,
      idempotent: false,
      durable: durable.durable,
      durableMode: durable.mode,
      ledgerId,
      sequence: entry.sequence,
      entryHash: entry.entryHash,
      headHash: state.entries.at(-1)?.entryHash ?? state.anchorHash,
      payloadDigest,
      readBackVerified: durable.mode === "not_configured" ? true : durable.readBackVerified,
      blockers: durable.blockers,
    };
  } finally {
    releaseLock?.();
  }
}

export function readProviderEvidencePacketLedger(args: {
  domain: ProviderEvidencePacketDomain;
  assetKey: string;
  scope: string;
}) {
  const ledgerId = buildLedgerId(args.domain, clean(args.assetKey, 180), clean(args.scope, 120));
  return snapshotFromState(ledgerId, getState(ledgerId));
}
