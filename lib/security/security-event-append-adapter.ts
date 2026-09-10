import { appendTrimmedUpstashList } from "@/lib/security/upstash-rest-atomic";
import { applyPass635ExportRedaction } from "@/lib/security/export-redaction-policy";
import type { SecurityEventRecord } from "@/lib/security/security-event-contract";

export type SecurityEventAppendMode = "disabled" | "memory_only" | "upstash_list" | "upstash_fallback_memory";

export type SecurityEventAppendDecision = {
  ok: boolean;
  mode: SecurityEventAppendMode;
  provider: "none" | "memory" | "upstash";
  attempted: boolean;
  eventId?: string;
  providerError?: string;
};

const appendAttempts: SecurityEventAppendDecision[] = [];
const MAX_APPEND_ATTEMPTS = 120;

function getMode(): SecurityEventAppendMode {
  if (process.env.VELMERE_SECURITY_EVENT_APPEND_DISABLED === "1") return "disabled";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash_list";
  return "memory_only";
}

function pushAttempt(decision: SecurityEventAppendDecision) {
  appendAttempts.unshift(decision);
  if (appendAttempts.length > MAX_APPEND_ATTEMPTS) appendAttempts.length = MAX_APPEND_ATTEMPTS;
  return decision;
}

function safeRecord(record: SecurityEventRecord) {
  const redacted = applyPass635ExportRedaction({
    surface: "log",
    generatedAt: record.createdAt,
    payload: {
      id: record.id,
      kind: record.kind,
      severity: record.severity,
      profile: record.profile,
      route: record.route,
      method: record.method,
      clientFingerprint: record.clientFingerprint,
      userAgentFamily: record.userAgentFamily,
      abuseScore: record.abuseScore,
      notes: record.notes.slice(0, 8),
      rateLimitMode: record.rateLimitMode,
      provider: record.provider,
      createdAt: record.createdAt,
      safeSummary: record.safeSummary,
    },
  });
  return {
    payload: redacted.payload,
    redactionReceipt: redacted.receipt,
  };
}

function normalizeUpstashKey(value: string | undefined) {
  return (value ?? "velmere:security:events")
    .replace(/[^a-zA-Z0-9:_@.-]/g, "_")
    .slice(0, 160);
}

async function appendToUpstash(record: SecurityEventRecord): Promise<SecurityEventAppendDecision> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return pushAttempt({
      ok: true,
      mode: "memory_only",
      provider: "memory",
      attempted: false,
      eventId: record.id,
      providerError: "upstash_env_missing",
    });
  }

  const key = normalizeUpstashKey(process.env.VELMERE_SECURITY_EVENT_UPSTASH_KEY);
  const maxLength = Math.max(50, Math.min(Number(process.env.VELMERE_SECURITY_EVENT_UPSTASH_MAX ?? 500) || 500, 2000));
  const timeoutMs = Math.max(250, Math.min(Number(process.env.VELMERE_SECURITY_EVENT_APPEND_TIMEOUT_MS ?? 950) || 950, 2500));
  try {
    await appendTrimmedUpstashList({
      key,
      value: JSON.stringify(safeRecord(record)),
      maxLength,
      config: { url: url.replace(/\/$/, ""), token, provider: "upstash" },
      timeoutMs,
      operation: "security_event_append",
    });
    return pushAttempt({
      ok: true,
      mode: "upstash_list",
      provider: "upstash",
      attempted: true,
      eventId: record.id,
    });
  } catch (error) {
    return pushAttempt({
      ok: false,
      mode: "upstash_fallback_memory",
      provider: "upstash",
      attempted: true,
      eventId: record.id,
      providerError: error instanceof Error ? error.message.slice(0, 120) : "upstash_unknown_error",
    });
  }
}

export async function appendSecurityEventBestEffort(record: SecurityEventRecord): Promise<SecurityEventAppendDecision> {
  const mode = getMode();

  if (mode === "disabled") {
    return pushAttempt({
      ok: true,
      mode,
      provider: "none",
      attempted: false,
      eventId: record.id,
    });
  }

  if (mode === "memory_only") {
    return pushAttempt({
      ok: true,
      mode,
      provider: "memory",
      attempted: false,
      eventId: record.id,
    });
  }

  return appendToUpstash(record);
}

export function listSecurityEventAppendAttempts(limit = 30) {
  return appendAttempts.slice(0, Math.max(1, Math.min(limit, 100)));
}

export function buildSecurityEventAppendReadiness() {
  const mode = getMode();
  const recent = listSecurityEventAppendAttempts(20);
  const failures = recent.filter((attempt) => !attempt.ok).length;
  return {
    schemaVersion: "velmere-security-event-append-readiness-v1",
    mode,
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    keyConfigured: Boolean(process.env.VELMERE_SECURITY_EVENT_UPSTASH_KEY),
    recentAttempts: recent,
    recentFailureCount: failures,
    storageWritePerformed: mode === "upstash_list",
    productionBoundary:
      "Security event append adapter writes only redacted event records; no raw IP / no raw query / no secrets. It never stores raw IP, raw query payloads, authorization headers or secrets.",
  };
}
