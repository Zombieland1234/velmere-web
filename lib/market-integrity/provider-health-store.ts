import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  brokeredConfiguredOriginFetch,
  type Pass4825ConfiguredEgressOptions,
} from "@/lib/network/brokered-egress";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AnalysisDepth } from "./analysis-readiness";
import {
  buildPass4656ProviderHealthLedger,
  type Pass4656ProviderHealthObservation,
} from "./provider-health-ledger";

export type Pass4656ProviderHealthLedger = ReturnType<typeof buildPass4656ProviderHealthLedger>;

export type Pass4656ProviderHealthSnapshot = {
  schemaVersion: "pass4656_provider_health_snapshot_v1";
  scopeKey: "global";
  generatedAt: string;
  expiresAt: string;
  keyId: string;
  ledgerFingerprint: string;
  payloadHash: string;
  signature: string;
  ledger: Pass4656ProviderHealthLedger;
  observations: Pass4656ProviderHealthObservation[];
};

export type Pass4656ProviderRuntimeDecision = {
  schemaVersion: "pass4656_provider_runtime_decision_v1";
  providerId: string;
  providerFamily: string;
  tier: AnalysisDepth;
  action: "allow" | "allow_degraded" | "probe_only" | "block";
  customerEvidenceEligible: boolean;
  maximumConcurrentRequests: number | null;
  nextAttemptAt: string | null;
  snapshotFresh: boolean;
  blockers: string[];
  ledgerFingerprint: string | null;
};

type EnvLike = Record<string, string | undefined>;
export type Pass4656ProviderHealthTransport = (
  input: string | URL,
  init: RequestInit,
  options: Pass4825ConfiguredEgressOptions,
) => Promise<Response>;
type HealthStoreRoot = typeof globalThis & { __velmerePass4656ProviderHealthSnapshot?: Pass4656ProviderHealthSnapshot };

function durableTransport(transport?: Pass4656ProviderHealthTransport) {
  return transport ?? brokeredConfiguredOriginFetch;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function constantTimeHexEqual(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveSigningKeys(env: EnvLike = process.env) {
  const production = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const current = env.VELMERE_PROVIDER_HEALTH_SIGNING_SECRET_CURRENT?.trim()
    || (!production ? env.VELMERE_PROVIDER_HEALTH_SIGNING_SECRET?.trim() : "");
  const previous = env.VELMERE_PROVIDER_HEALTH_SIGNING_SECRET_PREVIOUS?.trim() || "";
  const currentKeyId = env.VELMERE_PROVIDER_HEALTH_KEY_ID?.trim() || "health-current";
  const previousKeyId = env.VELMERE_PROVIDER_HEALTH_PREVIOUS_KEY_ID?.trim() || "health-previous";
  const reusedSecrets = [
    env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET,
    env.VELMERE_LENS_RENDER_TOKEN_SECRET,
    env.VELMERE_LENS_RENDER_TOKEN_SECRET_CURRENT,
    env.VELMERE_AUDIT_BENCHMARK_SIGNING_SECRET,
  ].map((value) => value?.trim()).filter(Boolean);
  const currentReused = Boolean(current && reusedSecrets.includes(current));
  return {
    production,
    current: current && current.length >= 32 && !(production && currentReused) ? current : null,
    previous: previous && previous.length >= 32 ? previous : null,
    currentKeyId,
    previousKeyId,
    currentReused,
  };
}

function snapshotSigningPayload(snapshot: Omit<Pass4656ProviderHealthSnapshot, "signature">) {
  return stableSerialize({
    schemaVersion: snapshot.schemaVersion,
    scopeKey: snapshot.scopeKey,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    keyId: snapshot.keyId,
    ledgerFingerprint: snapshot.ledgerFingerprint,
    payloadHash: snapshot.payloadHash,
  });
}

export function buildPass4656ProviderHealthSnapshot(args: {
  ledger: Pass4656ProviderHealthLedger;
  observations?: Pass4656ProviderHealthObservation[];
  now?: Date;
  ttlMs?: number;
  env?: EnvLike;
}) {
  const keys = resolveSigningKeys(args.env);
  if (!keys.current) {
    return {
      ok: false as const,
      error: keys.currentReused
        ? "provider_health_secret_reuse_forbidden"
        : "provider_health_secret_missing_or_short",
    };
  }
  const now = args.now ?? new Date();
  const ttlMs = Math.min(60 * 60_000, Math.max(30_000, args.ttlMs ?? 5 * 60_000));
  const generatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const observations = (args.observations ?? []).slice(-400);
  const payloadHash = sha256(stableSerialize({ ledger: args.ledger, observations }));
  const unsigned: Omit<Pass4656ProviderHealthSnapshot, "signature"> = {
    schemaVersion: "pass4656_provider_health_snapshot_v1",
    scopeKey: "global",
    generatedAt,
    expiresAt,
    keyId: keys.currentKeyId,
    ledgerFingerprint: args.ledger.fingerprint,
    payloadHash,
    ledger: args.ledger,
    observations,
  };
  return {
    ok: true as const,
    snapshot: {
      ...unsigned,
      signature: hmac(snapshotSigningPayload(unsigned), keys.current),
    },
  };
}

export function verifyPass4656ProviderHealthSnapshot(args: {
  snapshot: Pass4656ProviderHealthSnapshot;
  now?: Date;
  env?: EnvLike;
}) {
  const keys = resolveSigningKeys(args.env);
  const snapshot = args.snapshot;
  const nowMs = (args.now ?? new Date()).getTime();
  const observations = Array.isArray(snapshot.observations) ? snapshot.observations : [];
  const payloadHash = sha256(stableSerialize({ ledger: snapshot.ledger, observations }));
  const unsigned: Omit<Pass4656ProviderHealthSnapshot, "signature"> = {
    schemaVersion: snapshot.schemaVersion,
    scopeKey: snapshot.scopeKey,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    keyId: snapshot.keyId,
    ledgerFingerprint: snapshot.ledgerFingerprint,
    payloadHash: snapshot.payloadHash,
    ledger: snapshot.ledger,
    observations,
  };
  const candidateSecrets = [
    snapshot.keyId === keys.currentKeyId && keys.current ? keys.current : null,
    snapshot.keyId === keys.previousKeyId && keys.previous ? keys.previous : null,
  ].filter((value): value is string => Boolean(value));
  const signatureValid = candidateSecrets.some((secret) => constantTimeHexEqual(snapshot.signature, hmac(snapshotSigningPayload(unsigned), secret)));
  const blockers = [
    snapshot.schemaVersion !== "pass4656_provider_health_snapshot_v1" ? "schema_version_invalid" : null,
    snapshot.scopeKey !== "global" ? "scope_invalid" : null,
    payloadHash !== snapshot.payloadHash ? "payload_hash_mismatch" : null,
    snapshot.ledger.fingerprint !== snapshot.ledgerFingerprint ? "ledger_fingerprint_mismatch" : null,
    !signatureValid ? "signature_invalid" : null,
    !Number.isFinite(Date.parse(snapshot.generatedAt)) ? "generated_at_invalid" : null,
    !Number.isFinite(Date.parse(snapshot.expiresAt)) ? "expires_at_invalid" : null,
    Date.parse(snapshot.expiresAt) <= nowMs ? "snapshot_expired" : null,
    Date.parse(snapshot.generatedAt) > nowMs + 30_000 ? "snapshot_from_future" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    valid: blockers.length === 0,
    fresh: !blockers.includes("snapshot_expired"),
    blockers,
    keyId: snapshot.keyId,
  };
}

function memoryRoot() {
  return globalThis as HealthStoreRoot;
}

function supabaseConfig(env: EnvLike = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

function toRow(snapshot: Pass4656ProviderHealthSnapshot) {
  return {
    scope_key: snapshot.scopeKey,
    schema_version: snapshot.schemaVersion,
    generated_at: snapshot.generatedAt,
    expires_at: snapshot.expiresAt,
    key_id: snapshot.keyId,
    ledger_fingerprint: snapshot.ledgerFingerprint,
    payload_hash: snapshot.payloadHash,
    signature: snapshot.signature,
    payload: snapshot,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(value: unknown): Pass4656ProviderHealthSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  return payload as Pass4656ProviderHealthSnapshot;
}

function providerObservationKey(observation: Pass4656ProviderHealthObservation) {
  return sha256(stableSerialize({
    providerId: observation.verdict.providerId,
    providerFamily: observation.verdict.providerFamily,
    observedAt: observation.observedAt,
    elapsedMs: observation.elapsedMs,
    origin: observation.origin ?? "customer",
    failureKind: observation.verdict.failureKind,
    acceptedAsEvidence: observation.verdict.acceptedAsEvidence,
    payloadHash: observation.verdict.payloadHash,
    blockers: observation.verdict.blockers,
  }));
}

function toObservationRow(observation: Pass4656ProviderHealthObservation) {
  return {
    observation_key: providerObservationKey(observation),
    provider_id: observation.verdict.providerId,
    provider_family: observation.verdict.providerFamily,
    observed_at: observation.observedAt,
    elapsed_ms: observation.elapsedMs,
    origin: observation.origin ?? "customer",
    accepted_as_evidence: observation.verdict.acceptedAsEvidence,
    failure_kind: observation.verdict.failureKind,
    payload: observation,
  };
}

function observationFromRow(value: unknown): Pass4656ProviderHealthObservation | null {
  if (!value || typeof value !== "object") return null;
  const payload = (value as Record<string, unknown>).payload;
  if (!payload || typeof payload !== "object") return null;
  return payload as Pass4656ProviderHealthObservation;
}

async function appendDurableProviderHealthObservations(args: {
  observations: Pass4656ProviderHealthObservation[];
  env?: EnvLike;
  transport?: Pass4656ProviderHealthTransport;
}) {
  const config = supabaseConfig(args.env);
  if (!config || args.observations.length === 0) {
    return { configured: Boolean(config), submitted: 0, durable: false, blockers: config ? [] : ["provider_health_observation_store_not_configured"] };
  }
  try {
    const response = await durableTransport(args.transport)(`${config.url}/rest/v1/provider_health_observations?on_conflict=observation_key`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(args.observations.map(toObservationRow)),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    }, { configuredProfile: "supabase", environment: args.env, operation: "provider_health_observation_write", timeoutMs: 2_000 });
    return response.ok
      ? { configured: true, submitted: args.observations.length, durable: true, blockers: [] }
      : { configured: true, submitted: 0, durable: false, blockers: [`provider_health_observation_write_http_${response.status}`] };
  } catch (error) {
    return {
      configured: true,
      submitted: 0,
      durable: false,
      blockers: [`provider_health_observation_write_error:${error instanceof Error ? error.name : "unknown"}`],
    };
  }
}

async function readDurableProviderHealthObservations(args: { env?: EnvLike; transport?: Pass4656ProviderHealthTransport }) {
  const config = supabaseConfig(args.env);
  if (!config) return { observations: [] as Pass4656ProviderHealthObservation[], durable: false, blockers: ["provider_health_observation_store_not_configured"] };
  try {
    const response = await durableTransport(args.transport)(`${config.url}/rest/v1/provider_health_observations?select=payload&order=observed_at.desc&limit=400`, {
      headers: { apikey: config.key, authorization: `Bearer ${config.key}`, accept: "application/json" },
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    }, { configuredProfile: "supabase", environment: args.env, operation: "provider_health_observation_read", timeoutMs: 2_000, maxResponseBytes: 8_388_608 });
    if (!response.ok) return { observations: [], durable: false, blockers: [`provider_health_observation_read_http_${response.status}`] };
    const rows = await readJsonResponseBounded<unknown[]>(response, 8_388_608).catch(() => []);
    const observations = (Array.isArray(rows) ? rows : [])
      .map(observationFromRow)
      .filter((value): value is Pass4656ProviderHealthObservation => Boolean(value))
      .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    return { observations, durable: true, blockers: [] };
  } catch (error) {
    return {
      observations: [] as Pass4656ProviderHealthObservation[],
      durable: false,
      blockers: [`provider_health_observation_read_error:${error instanceof Error ? error.name : "unknown"}`],
    };
  }
}

export async function persistPass4656ProviderHealthSnapshot(args: {
  snapshot: Pass4656ProviderHealthSnapshot;
  env?: EnvLike;
  transport?: Pass4656ProviderHealthTransport;
}) {
  memoryRoot().__velmerePass4656ProviderHealthSnapshot = args.snapshot;
  const config = supabaseConfig(args.env);
  if (!config) {
    return { persisted: true, durable: false, mode: "memory" as const, blockers: ["provider_health_store_not_durable"] };
  }
  try {
    const response = await durableTransport(args.transport)(`${config.url}/rest/v1/provider_health_snapshots?on_conflict=scope_key`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(toRow(args.snapshot)),
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    }, { configuredProfile: "supabase", environment: args.env, operation: "provider_health_snapshot_write", timeoutMs: 2_000 });
    return response.ok
      ? { persisted: true, durable: true, mode: "supabase" as const, blockers: [] }
      : { persisted: true, durable: false, mode: "supabase" as const, blockers: [`provider_health_store_http_${response.status}`] };
  } catch (error) {
    return {
      persisted: true,
      durable: false,
      mode: "supabase" as const,
      blockers: [`provider_health_store_error:${error instanceof Error ? error.name : "unknown"}`],
    };
  }
}

export async function readPass4656ProviderHealthSnapshot(args: {
  now?: Date;
  env?: EnvLike;
  transport?: Pass4656ProviderHealthTransport;
} = {}) {
  const memory = memoryRoot().__velmerePass4656ProviderHealthSnapshot;
  const memoryVerification = memory
    ? verifyPass4656ProviderHealthSnapshot({ snapshot: memory, now: args.now, env: args.env })
    : null;
  const validMemory = memory && memoryVerification?.valid ? memory : null;
  const config = supabaseConfig(args.env);
  if (!config) {
    return validMemory
      ? { snapshot: validMemory, verification: memoryVerification, durable: false, mode: "memory" as const, blockers: ["provider_health_store_not_durable"] }
      : { snapshot: null, verification: memoryVerification, durable: false, mode: "not_configured" as const, blockers: ["provider_health_snapshot_unavailable"] };
  }

  const memoryFallback = (blockers: string[]) => validMemory
    ? { snapshot: validMemory, verification: memoryVerification, durable: false, mode: "memory_fallback" as const, blockers }
    : { snapshot: null, verification: memoryVerification, durable: false, mode: "supabase" as const, blockers };

  try {
    const response = await durableTransport(args.transport)(`${config.url}/rest/v1/provider_health_snapshots?scope_key=eq.global&select=payload&limit=1`, {
      headers: { apikey: config.key, authorization: `Bearer ${config.key}`, accept: "application/json" },
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    }, { configuredProfile: "supabase", environment: args.env, operation: "provider_health_snapshot_read", timeoutMs: 2_000 });
    if (!response.ok) return memoryFallback([`provider_health_read_http_${response.status}`]);
    const rows = await readJsonResponseBounded<unknown[]>(response, 2_097_152).catch(() => []);
    const durableSnapshot = fromRow(Array.isArray(rows) ? rows[0] : null);
    if (!durableSnapshot) return memoryFallback(["provider_health_snapshot_missing"]);
    const durableVerification = verifyPass4656ProviderHealthSnapshot({ snapshot: durableSnapshot, now: args.now, env: args.env });
    if (!durableVerification.valid) return memoryFallback(durableVerification.blockers);

    const memoryGeneratedAt = validMemory ? Date.parse(validMemory.generatedAt) : Number.NEGATIVE_INFINITY;
    const durableGeneratedAt = Date.parse(durableSnapshot.generatedAt);
    if (validMemory && memoryGeneratedAt > durableGeneratedAt) {
      // A local writer may be slightly ahead of Supabase read-after-write. It
      // can serve Basic as a disclosed fallback, but paid tiers may require the
      // durable snapshot before admitting customer evidence.
      return {
        snapshot: validMemory,
        verification: memoryVerification,
        durable: false,
        mode: "memory_ahead" as const,
        blockers: ["durable_snapshot_behind_memory"],
      };
    }
    memoryRoot().__velmerePass4656ProviderHealthSnapshot = durableSnapshot;
    return { snapshot: durableSnapshot, verification: durableVerification, durable: true, mode: "supabase" as const, blockers: [] };
  } catch (error) {
    return memoryFallback([`provider_health_read_error:${error instanceof Error ? error.name : "unknown"}`]);
  }
}

export async function recordPass4656ProviderHealthObservations(args: {
  observations: Pass4656ProviderHealthObservation[];
  now?: Date;
  ttlMs?: number;
  env?: EnvLike;
  transport?: Pass4656ProviderHealthTransport;
}) {
  // Persist append-only observations before rebuilding the signed snapshot.
  // This prevents concurrent read-modify-write requests from erasing each
  // other's provider failures or recovery probes.
  const append = await appendDurableProviderHealthObservations({ observations: args.observations, env: args.env, transport: args.transport });
  const [previous, durableRead] = await Promise.all([
    readPass4656ProviderHealthSnapshot({ now: args.now, env: args.env, transport: args.transport }),
    readDurableProviderHealthObservations({ env: args.env, transport: args.transport }),
  ]);
  const merged = [
    ...(previous.snapshot?.observations ?? []),
    ...durableRead.observations,
    ...args.observations,
  ];
  const deduplicated = new Map<string, Pass4656ProviderHealthObservation>();
  for (const observation of merged) deduplicated.set(providerObservationKey(observation), observation);
  const observations = Array.from(deduplicated.values())
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .slice(-400);
  const ledger = buildPass4656ProviderHealthLedger(observations, { now: args.now });
  const signed = buildPass4656ProviderHealthSnapshot({ ledger, observations, now: args.now, ttlMs: args.ttlMs, env: args.env });
  if (!signed.ok) return { ok: false as const, error: signed.error, ledger, append, durableRead };
  const persistence = await persistPass4656ProviderHealthSnapshot({ snapshot: signed.snapshot, env: args.env, transport: args.transport });
  return {
    ok: true as const,
    ledger,
    snapshot: signed.snapshot,
    persistence,
    observationPersistence: {
      durable: append.durable && durableRead.durable,
      submitted: append.submitted,
      blockers: Array.from(new Set([...append.blockers, ...durableRead.blockers])),
    },
  };
}

function providerHealthDurableRequired(env: EnvLike = process.env) {
  const explicit = env.VELMERE_PROVIDER_HEALTH_REQUIRE_DURABLE?.trim();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export async function resolvePass4656ProviderRuntimeDecision(args: {
  providerId: string;
  providerFamily: string;
  tier: AnalysisDepth;
  now?: Date;
  env?: EnvLike;
  transport?: Pass4656ProviderHealthTransport;
  snapshotRead?: Awaited<ReturnType<typeof readPass4656ProviderHealthSnapshot>>;
}): Promise<Pass4656ProviderRuntimeDecision> {
  const read = args.snapshotRead ?? await readPass4656ProviderHealthSnapshot({ now: args.now, env: args.env, transport: args.transport });
  if (!read.snapshot || !read.verification?.valid) {
    const basicBootstrap = args.tier === "basic";
    return {
      schemaVersion: "pass4656_provider_runtime_decision_v1",
      providerId: args.providerId,
      providerFamily: args.providerFamily,
      tier: args.tier,
      action: basicBootstrap ? "probe_only" : "block",
      customerEvidenceEligible: false,
      maximumConcurrentRequests: basicBootstrap ? 1 : 0,
      nextAttemptAt: basicBootstrap ? (args.now ?? new Date()).toISOString() : null,
      snapshotFresh: false,
      blockers: read.blockers.length ? read.blockers : ["provider_health_snapshot_unavailable"],
      ledgerFingerprint: null,
    };
  }
  if (args.tier !== "basic" && providerHealthDurableRequired(args.env) && !read.durable) {
    return {
      schemaVersion: "pass4656_provider_runtime_decision_v1",
      providerId: args.providerId,
      providerFamily: args.providerFamily,
      tier: args.tier,
      action: "block",
      customerEvidenceEligible: false,
      maximumConcurrentRequests: 0,
      nextAttemptAt: null,
      snapshotFresh: true,
      blockers: Array.from(new Set([...read.blockers, "provider_health_durable_snapshot_required"])),
      ledgerFingerprint: read.snapshot.ledgerFingerprint,
    };
  }
  const row = read.snapshot.ledger.providers.find((provider) => provider.providerId === args.providerId && provider.providerFamily === args.providerFamily);
  if (!row) {
    const basicBootstrap = args.tier === "basic";
    return {
      schemaVersion: "pass4656_provider_runtime_decision_v1",
      providerId: args.providerId,
      providerFamily: args.providerFamily,
      tier: args.tier,
      action: basicBootstrap ? "probe_only" : "block",
      customerEvidenceEligible: false,
      maximumConcurrentRequests: basicBootstrap ? 1 : 0,
      nextAttemptAt: basicBootstrap ? (args.now ?? new Date()).toISOString() : null,
      snapshotFresh: true,
      blockers: ["provider_not_present_in_health_snapshot"],
      ledgerFingerprint: read.snapshot.ledgerFingerprint,
    };
  }
  const now = args.now ?? new Date();
  const nowMs = now.getTime();
  const openUntilMs = row.openUntil ? Date.parse(row.openUntil) : Number.NaN;
  const cooldownElapsed = row.status === "open" && Number.isFinite(openUntilMs) && openUntilMs <= nowMs;
  let action = cooldownElapsed ? "probe_only" as const : row.requestMode;
  if (args.tier !== "basic" && action === "allow_degraded") action = "block";
  // Recovery probes are infrastructure work, never a paid customer's evidence
  // path. A Basic request may perform the one bounded probe; paid tiers remain
  // fail-closed until a signed success observation rebuilds healthy quorum.
  if (args.tier !== "basic" && action === "probe_only") action = "block";
  const tierGate = read.snapshot.ledger.tierAvailability[args.tier];
  if (!tierGate.ready && action !== "probe_only") action = "block";
  const blockers = [
    ...row.blockers,
    cooldownElapsed ? "provider_cooldown_elapsed_probe_required" : null,
    !tierGate.ready ? `tier_provider_health_not_ready:${args.tier}` : null,
    args.tier !== "basic" && row.status === "degraded" ? "paid_tier_rejects_degraded_provider" : null,
    args.tier !== "basic" && (row.status === "half_open" || cooldownElapsed) ? "paid_tier_cannot_run_recovery_probe" : null,
  ].filter((value): value is string => Boolean(value));
  return {
    schemaVersion: "pass4656_provider_runtime_decision_v1",
    providerId: args.providerId,
    providerFamily: args.providerFamily,
    tier: args.tier,
    action,
    customerEvidenceEligible: (action === "allow" || action === "allow_degraded") && row.evidenceEligibleNow,
    maximumConcurrentRequests: cooldownElapsed && action === "probe_only" ? 1 : action === "block" ? 0 : row.maximumConcurrentRequests,
    nextAttemptAt: cooldownElapsed && action === "probe_only" ? now.toISOString() : row.nextAttemptAt,
    snapshotFresh: true,
    blockers,
    ledgerFingerprint: read.snapshot.ledgerFingerprint,
  };
}

export function clearPass4656ProviderHealthMemoryStore() {
  delete memoryRoot().__velmerePass4656ProviderHealthSnapshot;
}
