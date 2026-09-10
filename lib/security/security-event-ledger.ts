import type {
  SecurityEventKind as NeutralSecurityEventKind,
  SecurityEventRecord as NeutralSecurityEventRecord,
  SecurityEventSeverity as NeutralSecurityEventSeverity,
} from "@/lib/security/security-event-contract";
import {
  appendSecurityEventBestEffort,
  buildSecurityEventAppendReadiness,
} from "@/lib/security/security-event-append-adapter";
import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";
import {
  buildPrivacyFingerprintReadiness,
  createPrivacyFingerprint,
} from "@/lib/security/privacy-fingerprint";
import { resolveTrustedRequestClientIdentity } from "@/lib/security/api-guard";
export type SecurityEventKind = NeutralSecurityEventKind;
export type SecurityEventSeverity = NeutralSecurityEventSeverity;
export type SecurityEventRecord = NeutralSecurityEventRecord;

const securityEvents: SecurityEventRecord[] = [];
const MAX_EVENTS = 220;
const severityRank: Record<SecurityEventSeverity, number> = {
  info: 0,
  review: 1,
  elevated: 2,
  blocked: 3,
};

function familyFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (!value) return "missing";
  if (
    /(sqlmap|nikto|nmap|masscan|acunetix|wpscan|dirbuster|gobuster)/i.test(
      value,
    )
  )
    return "scanner";
  if (/(curl|wget|python-requests|httpclient|bot|spider|crawler)/i.test(value))
    return "automation";
  if (/(chrome|safari|firefox|edg|opera)/i.test(value)) return "browser";
  return "unknown";
}

function eventId(kind: SecurityEventKind) {
  return createSecureRuntimeId(kind);
}

export function createClientFingerprint(request: Request) {
  const client = resolveTrustedRequestClientIdentity(request);
  return createPrivacyFingerprint(client.privacyMaterial);
}

export function recordSecurityEvent(input: {
  request?: Request;
  route?: string;
  method?: string;
  clientFingerprint?: string;
  kind: SecurityEventKind;
  severity: SecurityEventSeverity;
  profile: string;
  abuseScore: number;
  notes?: string[];
  rateLimitMode?: string;
  provider?: string;
  attackFingerprint?: string;
  safeSummary?: string;
}) {
  const createdAt = new Date().toISOString();
  const route = input.request
    ? new URL(input.request.url).pathname
    : (input.route ?? "/internal/vlm");
  const userAgent = input.request?.headers.get("user-agent") ?? "";
  const duplicate = input.attackFingerprint
    ? securityEvents.find(
        (event) =>
          event.kind === input.kind &&
          event.route === route &&
          event.attackFingerprint === input.attackFingerprint &&
          Date.now() - Date.parse(event.lastSeenAt ?? event.createdAt) <=
            10 * 60_000,
      )
    : undefined;
  if (duplicate) {
    duplicate.count = (duplicate.count ?? 1) + 1;
    duplicate.lastSeenAt = createdAt;
    duplicate.abuseScore = Math.max(duplicate.abuseScore, input.abuseScore);
    if (severityRank[input.severity] > severityRank[duplicate.severity])
      duplicate.severity = input.severity;
    void appendSecurityEventBestEffort(duplicate);
    return duplicate;
  }
  const record: SecurityEventRecord = {
    id: eventId(input.kind),
    kind: input.kind,
    severity: input.severity,
    profile: input.profile,
    route,
    method: input.request?.method ?? input.method ?? "INTERNAL",
    clientFingerprint: input.request
      ? createClientFingerprint(input.request)
      : (input.clientFingerprint ??
        createPrivacyFingerprint(`internal:${input.profile}:${route}`)),
    userAgentFamily: familyFromUserAgent(userAgent),
    abuseScore: input.abuseScore,
    notes: (input.notes ?? []).slice(0, 8),
    rateLimitMode: input.rateLimitMode,
    provider: input.provider,
    attackFingerprint: input.attackFingerprint,
    count: 1,
    lastSeenAt: createdAt,
    createdAt,
    safeSummary:
      input.safeSummary ??
      `${input.kind} on ${route}. Stored with fingerprint only; raw IP/query is not persisted in this in-memory preview ledger.`,
  };

  securityEvents.unshift(record);
  if (securityEvents.length > MAX_EVENTS) securityEvents.length = MAX_EVENTS;
  void appendSecurityEventBestEffort(record);
  return record;
}

export function listSecurityEvents(
  options: { limit?: number; severity?: SecurityEventSeverity | "all" } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
  const severity = options.severity ?? "all";
  const events =
    severity === "all"
      ? securityEvents
      : securityEvents.filter((event) => event.severity === severity);
  return events.slice(0, limit);
}

export function buildSecurityEventLedgerSnapshot() {
  const blocked = securityEvents.filter(
    (event) => event.severity === "blocked",
  ).length;
  const elevated = securityEvents.filter(
    (event) => event.severity === "elevated",
  ).length;
  const review = securityEvents.filter(
    (event) => event.severity === "review",
  ).length;

  return {
    schemaVersion: "velmere-security-event-ledger-v1",
    mode: "in_memory_security_event_ledger",
    generatedAt: new Date().toISOString(),
    total: securityEvents.length,
    blocked,
    elevated,
    review,
    recent: listSecurityEvents({ limit: 20 }),
    appendAdapter: buildSecurityEventAppendReadiness(),
    fingerprintPrivacy: buildPrivacyFingerprintReadiness(),
    storageWritePerformed:
      buildSecurityEventAppendReadiness().storageWritePerformed,
    durableStorageReady:
      buildSecurityEventAppendReadiness().mode === "upstash_list",
    productionBoundary:
      "Security Event Ledger is currently in-memory preview only. Production needs durable storage, retention policy, alerting and access controls.",
  };
}

// PASS184 compatibility marker: storageWritePerformed: false · durableStorageReady: false was the preview baseline before PASS187 append adapter.
