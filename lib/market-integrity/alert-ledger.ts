import { readJsonResponseBounded, readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import type { ShieldSentinelAlert } from "./risk-alerts";

export type AlertLedgerMode = "supabase" | "memory";

export type ShieldCaseTimelineEvent = {
  id: string;
  timestamp: string;
  label: string;
  body: string;
  score: number;
  tone: "neutral" | "watch" | "warning" | "critical";
};

export type PersistedShieldAlert = ShieldSentinelAlert & {
  caseId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observations: number;
  caseStatus: "open" | "watch" | "cooling";
  timeline: ShieldCaseTimelineEvent[];
};

type AlertStore = {
  alerts: Map<string, PersistedShieldAlert>;
  lastPersistAt?: string;
  lastError?: string;
};

const globalKey = "__velmereMarketIntegrityAlertLedger";

type GlobalWithAlertLedger = typeof globalThis & {
  [globalKey]?: AlertStore;
};

function getStore(): AlertStore {
  const g = globalThis as GlobalWithAlertLedger;
  if (!g[globalKey]) g[globalKey] = { alerts: new Map() };
  return g[globalKey]!;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function nowIso() {
  return new Date().toISOString();
}

function caseIdFor(alert: ShieldSentinelAlert) {
  return `${alert.type}:${alert.symbol}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "-");
}

function statusFor(alert: ShieldSentinelAlert, previous?: PersistedShieldAlert): PersistedShieldAlert["caseStatus"] {
  const delta = alert.riskDelta ?? previous?.riskDelta ?? 0;
  if (delta <= -8) return "cooling";
  if (alert.score >= 65 || delta >= 8 || alert.type === "critical_cluster") return "open";
  return "watch";
}

function toneFor(score: number): ShieldCaseTimelineEvent["tone"] {
  if (score >= 85) return "critical";
  if (score >= 65) return "warning";
  if (score >= 35) return "watch";
  return "neutral";
}

function buildTimeline(alert: ShieldSentinelAlert, firstSeenAt: string, lastSeenAt: string, observations: number): ShieldCaseTimelineEvent[] {
  const timeline: ShieldCaseTimelineEvent[] = [
    {
      id: "case-opened",
      timestamp: firstSeenAt,
      label: "Case opened",
      body: `${alert.symbol} entered the Sentinel inbox as ${alert.type.replaceAll("_", " ")}.`,
      score: alert.score,
      tone: toneFor(alert.score),
    },
  ];

  if (alert.riskDelta !== undefined) {
    timeline.push({
      id: "risk-delta",
      timestamp: lastSeenAt,
      label: alert.riskDelta >= 0 ? "Risk rising" : "Risk cooling",
      body: `Latest sweep changed the risk score by ${alert.riskDelta >= 0 ? "+" : ""}${alert.riskDelta} points.`,
      score: Math.max(0, Math.min(100, alert.score + Math.max(0, alert.riskDelta))),
      tone: alert.riskDelta >= 8 ? "warning" : alert.riskDelta <= -8 ? "neutral" : "watch",
    });
  }

  if (alert.priceDeltaPercent !== undefined || alert.volumeDeltaPercent !== undefined) {
    const price = alert.priceDeltaPercent !== undefined ? `price ${alert.priceDeltaPercent >= 0 ? "+" : ""}${alert.priceDeltaPercent}%` : undefined;
    const volume = alert.volumeDeltaPercent !== undefined ? `volume ${alert.volumeDeltaPercent >= 0 ? "+" : ""}${alert.volumeDeltaPercent}%` : undefined;
    timeline.push({
      id: "market-delta",
      timestamp: lastSeenAt,
      label: "Market delta captured",
      body: [price, volume].filter(Boolean).join(" · "),
      score: alert.score,
      tone: Math.abs(alert.priceDeltaPercent ?? 0) >= 12 || Math.abs(alert.volumeDeltaPercent ?? 0) >= 60 ? "warning" : "watch",
    });
  }

  timeline.push({
    id: "review-action",
    timestamp: lastSeenAt,
    label: observations > 1 ? `Review updated (${observations} observations)` : "Review required",
    body: alert.action,
    score: alert.score,
    tone: alert.score >= 65 ? "warning" : "watch",
  });

  return timeline.slice(-5);
}

function mergeAlert(alert: ShieldSentinelAlert, previous?: PersistedShieldAlert): PersistedShieldAlert {
  const timestamp = alert.timestamp ?? nowIso();
  const firstSeenAt = previous?.firstSeenAt ?? timestamp;
  const lastSeenAt = timestamp;
  const observations = (previous?.observations ?? 0) + 1;
  const merged: PersistedShieldAlert = {
    ...previous,
    ...alert,
    caseId: previous?.caseId ?? caseIdFor(alert),
    firstSeenAt,
    lastSeenAt,
    observations,
    caseStatus: statusFor(alert, previous),
    timeline: [],
  };
  merged.timeline = buildTimeline(merged, firstSeenAt, lastSeenAt, observations);
  return merged;
}

function persistToMemory(alerts: ShieldSentinelAlert[]) {
  const store = getStore();
  let stored = 0;
  for (const alert of alerts) {
    const caseId = caseIdFor(alert);
    const previous = store.alerts.get(caseId);
    store.alerts.set(caseId, mergeAlert(alert, previous));
    stored += 1;
  }
  store.lastPersistAt = nowIso();
  store.lastError = undefined;
  return { mode: "memory" as const, attempted: alerts.length, stored, skipped: 0 };
}

async function persistToSupabase(alerts: ShieldSentinelAlert[]) {
  const config = getSupabaseConfig();
  const memory = persistToMemory(alerts);
  if (!config || alerts.length === 0) return memory;

  const payload = alerts.map((alert) => {
    const persisted = getStore().alerts.get(caseIdFor(alert)) ?? mergeAlert(alert);
    return {
      case_id: persisted.caseId,
      alert_type: persisted.type,
      symbol: persisted.symbol,
      name: persisted.name,
      score: persisted.score,
      risk_level: persisted.level,
      first_seen_at: persisted.firstSeenAt,
      last_seen_at: persisted.lastSeenAt,
      observations: persisted.observations,
      case_status: persisted.caseStatus,
      risk_delta: persisted.riskDelta ?? null,
      dominant_agent: persisted.dominantAgent ?? null,
      confidence: persisted.confidence ?? null,
      raw_alert: persisted,
    };
  });

  try {
    const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/market_integrity_alerts?on_conflict=case_id`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    }, { configuredProfile: "supabase", operation: "alert_ledger_write", timeoutMs: 5_000 });

    if (!response.ok) {
      const text = new TextDecoder().decode(await readResponseBytesBounded(response, 64_000)).slice(0, 64_000);
      const store = getStore();
      store.lastError = `Supabase alerts ${response.status}: ${text.slice(0, 180)}`;
      return { ...memory, mode: "memory" as const, error: store.lastError };
    }

    return { mode: "supabase" as const, attempted: alerts.length, stored: alerts.length, skipped: 0 };
  } catch (error) {
    const store = getStore();
    store.lastError = error instanceof Error ? error.message : "Supabase alert write failed";
    return { ...memory, mode: "memory" as const, error: store.lastError };
  }
}

export async function persistSentinelAlerts(alerts: ShieldSentinelAlert[]) {
  return persistToSupabase(alerts);
}

export async function getPersistentAlertInbox(limit = 20): Promise<PersistedShieldAlert[]> {
  const config = getSupabaseConfig();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);

  if (config) {
    try {
      const params = new URLSearchParams({
        order: "last_seen_at.desc",
        limit: String(boundedLimit),
      });
      const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/market_integrity_alerts?${params.toString()}`, {
        headers: {
          apikey: config.key,
          authorization: `Bearer ${config.key}`,
          accept: "application/json",
        },
        next: { revalidate: 15 },
      } as RequestInit & { next: { revalidate: number } }, { configuredProfile: "supabase", operation: "alert_ledger_read", timeoutMs: 5_000 });
      if (response.ok) {
        const rows = await readJsonResponseBounded<Array<{ raw_alert?: PersistedShieldAlert | null }>>(response, 2_000_000);
        const alerts = rows.map((row) => row.raw_alert).filter((item): item is PersistedShieldAlert => Boolean(item));
        if (alerts.length) return alerts.slice(0, boundedLimit);
      }
    } catch {
      // Memory fallback below.
    }
  }

  return Array.from(getStore().alerts.values())
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || b.score - a.score)
    .slice(0, boundedLimit);
}

export async function getAlertLedgerStatus() {
  const store = getStore();
  const alerts = Array.from(store.alerts.values());
  return {
    mode: getSupabaseConfig() ? "supabase" as const : "memory" as const,
    lastPersistAt: store.lastPersistAt,
    lastError: store.lastError,
    openCases: alerts.filter((alert) => alert.caseStatus === "open").length,
    watchCases: alerts.filter((alert) => alert.caseStatus === "watch").length,
    coolingCases: alerts.filter((alert) => alert.caseStatus === "cooling").length,
    storedAlerts: alerts.length,
  };
}
