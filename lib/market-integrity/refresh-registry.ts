import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { createHash } from "node:crypto";
import type { VlmDepth } from "@/lib/ai/vlm-brain";
import type { Pass4644ProviderSurface } from "./provider-evidence-receipt";
import type { VelmereMarketAssetClass } from "./risk-types";
import type { Pass4653RefreshRegistration } from "./refresh-contract";
export type { Pass4653RefreshRegistration } from "./refresh-contract";

export type Pass4653RefreshTarget = {
  schemaVersion: "pass4653_refresh_target_v1";
  targetKey: string;
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  assetClass: VelmereMarketAssetClass;
  highestRequestedTier: VlmDepth;
  demandCount: number;
  cadenceMs: number;
  priority: number;
  firstRequestedAt: string;
  lastRequestedAt: string;
  nextRefreshAt: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  leaseOwner: string | null;
  leaseUntil: string | null;
};

const GLOBAL_KEY = "__velmerePass4653RefreshTargets";
type Root = typeof globalThis & { [GLOBAL_KEY]?: Map<string, Pass4653RefreshTarget> };

function memoryTargets() {
  const root = globalThis as Root;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new Map();
  return root[GLOBAL_KEY]!;
}

function normalizedIdentity(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._\-/]+/g, "").replace(/-usd$/, "") || "unknown";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function targetKey(requestedIdentity: string, surface: Pass4644ProviderSurface) {
  return `${surface}:${sha256(normalizedIdentity(requestedIdentity)).slice(0, 32)}`;
}

const TIER_WEIGHT: Record<VlmDepth, number> = { basic: 1, pro: 5, advanced: 10 };
const TIER_RANK: Record<VlmDepth, number> = { basic: 0, pro: 1, advanced: 2 };

function cadenceFor(surface: Pass4644ProviderSurface, tier: VlmDepth, assetClass: VelmereMarketAssetClass) {
  if (surface === "contract_audit") return tier === "advanced" ? 3 * 60_000 : tier === "pro" ? 5 * 60_000 : 15 * 60_000;
  if (["fx", "commodity", "index"].includes(assetClass)) return tier === "advanced" ? 60_000 : tier === "pro" ? 90_000 : 5 * 60_000;
  return tier === "advanced" ? 45_000 : tier === "pro" ? 75_000 : 4 * 60_000;
}

function priorityFor(tier: VlmDepth, demandCount: number, failures: number) {
  return Math.max(1, TIER_WEIGHT[tier] * 100 + Math.min(99, Math.round(Math.log2(Math.max(1, demandCount)) * 10)) - Math.min(40, failures * 5));
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 1_500) {
  const config = supabaseConfig();
  if (!config) throw new Error("refresh_registry_supabase_not_configured");
  return brokeredConfiguredOriginFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }, {
    configuredProfile: "supabase",
    operation: "refresh_registry_store",
    timeoutMs,
  });
}

function toRow(target: Pass4653RefreshTarget) {
  return {
    target_key: target.targetKey,
    requested_identity: target.requestedIdentity,
    surface: target.surface,
    asset_class: target.assetClass,
    highest_requested_tier: target.highestRequestedTier,
    demand_count: target.demandCount,
    cadence_ms: target.cadenceMs,
    priority: target.priority,
    first_requested_at: target.firstRequestedAt,
    last_requested_at: target.lastRequestedAt,
    next_refresh_at: target.nextRefreshAt,
    last_attempt_at: target.lastAttemptAt,
    last_success_at: target.lastSuccessAt,
    last_failure_at: target.lastFailureAt,
    consecutive_failures: target.consecutiveFailures,
    last_error_code: target.lastErrorCode,
    lease_owner: target.leaseOwner,
    lease_until: target.leaseUntil,
  };
}

function fromRow(row: Record<string, unknown>): Pass4653RefreshTarget | null {
  const surface = String(row.surface ?? "") as Pass4644ProviderSurface;
  if (!['crypto','real_markets','contract_audit'].includes(surface)) return null;
  const tier = String(row.highest_requested_tier ?? "basic") as VlmDepth;
  if (!['basic','pro','advanced'].includes(tier)) return null;
  return {
    schemaVersion: "pass4653_refresh_target_v1",
    targetKey: String(row.target_key ?? ""),
    requestedIdentity: String(row.requested_identity ?? ""),
    surface,
    assetClass: String(row.asset_class ?? "unknown") as VelmereMarketAssetClass,
    highestRequestedTier: tier,
    demandCount: Number(row.demand_count ?? 0),
    cadenceMs: Number(row.cadence_ms ?? 60_000),
    priority: Number(row.priority ?? 1),
    firstRequestedAt: String(row.first_requested_at ?? new Date(0).toISOString()),
    lastRequestedAt: String(row.last_requested_at ?? new Date(0).toISOString()),
    nextRefreshAt: String(row.next_refresh_at ?? new Date(0).toISOString()),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : null,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
    leaseUntil: row.lease_until ? String(row.lease_until) : null,
  };
}

export async function registerPass4653RefreshTarget(args: {
  requestedIdentity: string;
  surface: Pass4644ProviderSurface;
  assetClass?: VelmereMarketAssetClass;
  requestedTier: VlmDepth;
  now?: Date | string;
}): Promise<Pass4653RefreshRegistration> {
  const now = args.now instanceof Date ? args.now : args.now ? new Date(args.now) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const requestedIdentity = normalizedIdentity(args.requestedIdentity);
  const key = targetKey(requestedIdentity, args.surface);
  const existing = memoryTargets().get(key);
  const highestRequestedTier = existing && TIER_RANK[existing.highestRequestedTier] > TIER_RANK[args.requestedTier]
    ? existing.highestRequestedTier
    : args.requestedTier;
  const demandCount = (existing?.demandCount ?? 0) + 1;
  const cadenceMs = Math.min(existing?.cadenceMs ?? Number.POSITIVE_INFINITY, cadenceFor(args.surface, highestRequestedTier, args.assetClass ?? existing?.assetClass ?? "unknown"));
  const nextRefreshAt = existing && Date.parse(existing.nextRefreshAt) <= safeNow.getTime()
    ? existing.nextRefreshAt
    : new Date(safeNow.getTime() + Math.min(10_000, Math.max(1_000, Math.floor(cadenceMs / 4)))).toISOString();
  const target: Pass4653RefreshTarget = {
    schemaVersion: "pass4653_refresh_target_v1",
    targetKey: key,
    requestedIdentity,
    surface: args.surface,
    assetClass: args.assetClass ?? existing?.assetClass ?? "unknown",
    highestRequestedTier,
    demandCount,
    cadenceMs,
    priority: priorityFor(highestRequestedTier, demandCount, existing?.consecutiveFailures ?? 0),
    firstRequestedAt: existing?.firstRequestedAt ?? safeNow.toISOString(),
    lastRequestedAt: safeNow.toISOString(),
    nextRefreshAt,
    lastAttemptAt: existing?.lastAttemptAt ?? null,
    lastSuccessAt: existing?.lastSuccessAt ?? null,
    lastFailureAt: existing?.lastFailureAt ?? null,
    consecutiveFailures: existing?.consecutiveFailures ?? 0,
    lastErrorCode: existing?.lastErrorCode ?? null,
    leaseOwner: existing?.leaseOwner ?? null,
    leaseUntil: existing?.leaseUntil ?? null,
  };
  memoryTargets().set(key, target);

  const config = supabaseConfig();
  if (!config) return { schemaVersion: "pass4653_refresh_registration_v1", registered: true, durable: false, mode: "memory", targetKey: key, nextRefreshAt, blockers: ["refresh_registry_not_durable"] };
  try {
    const response = await fetchWithTimeout(`${config.url}/rest/v1/provider_evidence_refresh_targets?on_conflict=target_key`, {
      method: "POST",
      headers: { apikey: config.key, authorization: `Bearer ${config.key}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(toRow(target)),
    });
    if (!response.ok) return { schemaVersion: "pass4653_refresh_registration_v1", registered: true, durable: false, mode: "supabase", targetKey: key, nextRefreshAt, blockers: [`refresh_registry_http_${response.status}`] };
    return { schemaVersion: "pass4653_refresh_registration_v1", registered: true, durable: true, mode: "supabase", targetKey: key, nextRefreshAt, blockers: [] };
  } catch (error) {
    return { schemaVersion: "pass4653_refresh_registration_v1", registered: true, durable: false, mode: "supabase", targetKey: key, nextRefreshAt, blockers: [`refresh_registry_error:${error instanceof Error ? error.name : "unknown"}`] };
  }
}

export async function listDuePass4653RefreshTargets(args: {
  now?: Date | string;
  limit?: number;
  leaseOwner?: string;
  leaseMs?: number;
} = {}) {
  const now = args.now instanceof Date ? args.now : args.now ? new Date(args.now) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const limit = Math.min(250, Math.max(1, args.limit ?? 100));
  const leaseOwner = (args.leaseOwner ?? `pass4654:${process.pid}`).slice(0, 160);
  const leaseMs = Math.min(10 * 60_000, Math.max(15_000, args.leaseMs ?? 2 * 60_000));
  const leaseUntil = new Date(safeNow.getTime() + leaseMs).toISOString();
  const merged = new Map<string, Pass4653RefreshTarget>();

  for (const target of memoryTargets().values()) {
    const leaseExpired = !target.leaseUntil || Date.parse(target.leaseUntil) <= safeNow.getTime();
    const ownedByCaller = target.leaseOwner === leaseOwner;
    if (Date.parse(target.nextRefreshAt) <= safeNow.getTime() && (leaseExpired || ownedByCaller)) {
      const claimed = { ...target, leaseOwner, leaseUntil };
      memoryTargets().set(claimed.targetKey, claimed);
      merged.set(claimed.targetKey, claimed);
    }
  }

  const config = supabaseConfig();
  if (config) {
    try {
      const response = await fetchWithTimeout(`${config.url}/rest/v1/rpc/claim_provider_evidence_refresh_targets`, {
        method: "POST",
        headers: {
          apikey: config.key,
          authorization: `Bearer ${config.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_now: safeNow.toISOString(),
          p_limit: limit,
          p_lease_owner: leaseOwner,
          p_lease_seconds: Math.ceil(leaseMs / 1000),
        }),
      });
      if (response.ok) {
        const rows = await readJsonResponseBounded<Record<string, unknown>[]>(response, 256 * 1024).catch(() => []);
        for (const row of Array.isArray(rows) ? rows : []) {
          const target = fromRow(row);
          if (target) {
            memoryTargets().set(target.targetKey, target);
            merged.set(target.targetKey, target);
          }
        }
      }
    } catch { /* memory lease remains valid for this process */ }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.priority - a.priority || Date.parse(a.nextRefreshAt) - Date.parse(b.nextRefreshAt))
    .slice(0, limit);
}

export async function completePass4653RefreshTarget(args: {
  target: Pass4653RefreshTarget;
  success: boolean;
  errorCode?: string | null;
  now?: Date | string;
}) {
  const now = args.now instanceof Date ? args.now : args.now ? new Date(args.now) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const failures = args.success ? 0 : args.target.consecutiveFailures + 1;
  const backoffMs = args.success
    ? args.target.cadenceMs
    : Math.min(args.target.cadenceMs * 4, Math.max(15_000, 15_000 * 2 ** Math.min(6, failures - 1)));
  const updated: Pass4653RefreshTarget = {
    ...args.target,
    lastAttemptAt: safeNow.toISOString(),
    lastSuccessAt: args.success ? safeNow.toISOString() : args.target.lastSuccessAt,
    lastFailureAt: args.success ? args.target.lastFailureAt : safeNow.toISOString(),
    consecutiveFailures: failures,
    lastErrorCode: args.success ? null : (args.errorCode ?? "refresh_failed"),
    nextRefreshAt: new Date(safeNow.getTime() + backoffMs).toISOString(),
    priority: priorityFor(args.target.highestRequestedTier, args.target.demandCount, failures),
    leaseOwner: null,
    leaseUntil: null,
  };
  memoryTargets().set(updated.targetKey, updated);
  const config = supabaseConfig();
  if (config) {
    try {
      await fetchWithTimeout(`${config.url}/rest/v1/provider_evidence_refresh_targets?target_key=eq.${encodeURIComponent(updated.targetKey)}`, {
        method: "PATCH",
        headers: { apikey: config.key, authorization: `Bearer ${config.key}`, "content-type": "application/json", prefer: "return=minimal" },
        body: JSON.stringify(toRow(updated)),
      });
    } catch { /* future cron run can retry from memory or DB */ }
  }
  return updated;
}

export function getPass4653RefreshRegistrySummary(now: Date = new Date()) {
  const rows = Array.from(memoryTargets().values());
  return {
    schemaVersion: "pass4653_refresh_registry_summary_v1",
    targetCount: rows.length,
    dueCount: rows.filter((row) => Date.parse(row.nextRefreshAt) <= now.getTime()).length,
    advancedTargets: rows.filter((row) => row.highestRequestedTier === "advanced").length,
    proTargets: rows.filter((row) => row.highestRequestedTier === "pro").length,
    failingTargets: rows.filter((row) => row.consecutiveFailures > 0).length,
  } as const;
}
