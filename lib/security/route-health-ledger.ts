import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2374CustomerSafeRouteHealthSnapshot, Pass2374RouteHealthState } from "@/lib/security/customer-route-health";

export const PASS2375_ROUTE_HEALTH_LEDGER_ID = "pass2375-route-health-history-last-ping-stale-delivery-warning" as const;

export type Pass2375RouteHealthPingSource = "route_health_endpoint" | "linked_request_drawer" | "customer_delivery_guard" | "manual_admin_check";
export type Pass2375DeliveryWarningLevel = "ok" | "watch" | "stale" | "blocked";
export type Pass2375RouteHealthPingSourceKind = "supabase" | "memory";

export type Pass2375RouteHealthWarning = {
  key: string;
  level: Pass2375DeliveryWarningLevel;
  summary: string;
  nextAction: string;
};

export type Pass2375RouteHealthPingRecord = {
  id: string;
  passId: typeof PASS2375_ROUTE_HEALTH_LEDGER_ID;
  focusKey: string;
  locale: "pl" | "en" | "de";
  pingedAt: string;
  pingSource: Pass2375RouteHealthPingSource;
  routeHealthEndpoint: string;
  deliveryWarningLevel: Pass2375DeliveryWarningLevel;
  counts: Record<Pass2374RouteHealthState, number>;
  routeStates: Record<string, Pass2374RouteHealthState>;
  missingKeys: string[];
  readyKeys: string[];
  blockedKeys: string[];
  focus: {
    id?: string;
    requestId?: string;
    auditQueueId?: string;
    accountMessageId?: string;
    accountId?: string;
  };
  safeBoundary: string;
};

export type Pass2375RouteHealthLedgerSnapshot = {
  ok: boolean;
  passId: typeof PASS2375_ROUTE_HEALTH_LEDGER_ID;
  generatedAt: string;
  focusKey: string;
  source: Pass2375RouteHealthPingSourceKind;
  durableStorageReady: boolean;
  lastPing?: Pass2375RouteHealthPingRecord;
  lastEndpointPing?: Pass2375RouteHealthPingRecord;
  lastPingAgeMinutes?: number;
  lastEndpointPingAgeMinutes?: number;
  staleAfterMinutes: number;
  deliveryWarningLevel: Pass2375DeliveryWarningLevel;
  warnings: Pass2375RouteHealthWarning[];
  history: Pass2375RouteHealthPingRecord[];
  customerDeliveryAllowed: boolean;
  recommendedAction: string;
  safeBoundary: string;
};

const TABLE_NAME = "velmere_route_health_ping_ledger";
const routeHealthMemoryStore = new Map<string, Pass2375RouteHealthPingRecord>();
const MAX_MEMORY_RECORDS = 180;
const DELIVERY_READY_KEYS = ["customer_report", "safe_pdf_packet", "account_message"] as const;

function nowIso() {
  return new Date().toISOString();
}

function stableHash(value: string) {
  return sha256Token(value, 24);
}

function cleanToken(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|sk_test|pk_test|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

function normalizePingSource(value: unknown): Pass2375RouteHealthPingSource {
  if (value === "route_health_endpoint" || value === "linked_request_drawer" || value === "customer_delivery_guard" || value === "manual_admin_check") return value;
  return "manual_admin_check";
}

function normalizeWarningLevel(value: unknown): Pass2375DeliveryWarningLevel {
  if (value === "ok" || value === "watch" || value === "stale" || value === "blocked") return value;
  return "watch";
}

function normalizeCounts(value: unknown): Record<Pass2374RouteHealthState, number> {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<Pass2374RouteHealthState, number>>;
  return {
    ready: Number(raw.ready ?? 0),
    linked: Number(raw.linked ?? 0),
    missing: Number(raw.missing ?? 0),
    admin_only: Number(raw.admin_only ?? 0),
    blocked: Number(raw.blocked ?? 0),
  };
}

function normalizeRouteStates(value: unknown): Record<string, Pass2374RouteHealthState> {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, string>;
  const out: Record<string, Pass2374RouteHealthState> = {};
  for (const [key, state] of Object.entries(raw)) {
    if (state === "ready" || state === "linked" || state === "missing" || state === "admin_only" || state === "blocked") {
      const safeKey = cleanToken(key, 90);
      if (safeKey) out[safeKey] = state;
    }
  }
  return out;
}

function focusKeyFor(snapshot: Pass2374CustomerSafeRouteHealthSnapshot) {
  const focus = snapshot.focus;
  const key = focus.accountMessageId ?? focus.requestId ?? focus.auditQueueId ?? focus.accountId ?? focus.id ?? snapshot.routeHealthEndpoint ?? "sample";
  return `route_${stableHash(String(key)).slice(0, 14)}`;
}

function arrayOfStrings(value: unknown, limit = 12) {
  return Array.isArray(value) ? value.map((item) => cleanToken(item, 120)).filter((item): item is string => Boolean(item)).slice(0, limit) : [];
}

function buildRouteStateIndex(snapshot: Pass2374CustomerSafeRouteHealthSnapshot) {
  const routeStates: Record<string, Pass2374RouteHealthState> = {};
  const readyKeys: string[] = [];
  const missingKeys: string[] = [];
  const blockedKeys: string[] = [];
  for (const check of snapshot.checks) {
    routeStates[check.key] = check.state;
    if (check.state === "ready" || check.state === "linked" || check.state === "admin_only") readyKeys.push(check.key);
    if (check.state === "missing") missingKeys.push(check.key);
    if (check.state === "blocked") blockedKeys.push(check.key);
  }
  return { routeStates, readyKeys, missingKeys, blockedKeys };
}

function deliveryMissingKeys(routeStates: Record<string, Pass2374RouteHealthState>) {
  return DELIVERY_READY_KEYS.filter((key) => routeStates[key] !== "ready" && routeStates[key] !== "linked");
}

function rawPayloadBlocked(routeStates: Record<string, Pass2374RouteHealthState>) {
  return routeStates.raw_payment_payload === "blocked";
}

function classifyWarningLevel(routeStates: Record<string, Pass2374RouteHealthState>): Pass2375DeliveryWarningLevel {
  const missingDelivery = deliveryMissingKeys(routeStates);
  if (missingDelivery.length || !rawPayloadBlocked(routeStates)) return "blocked";
  return "ok";
}

function buildPingRecord(snapshot: Pass2374CustomerSafeRouteHealthSnapshot, pingSource: Pass2375RouteHealthPingSource): Pass2375RouteHealthPingRecord {
  const pingedAt = nowIso();
  const { routeStates, readyKeys, missingKeys, blockedKeys } = buildRouteStateIndex(snapshot);
  const focusKey = focusKeyFor(snapshot);
  const deliveryWarningLevel = classifyWarningLevel(routeStates);
  return {
    id: `rh_${stableHash(`${focusKey}:${pingSource}:${pingedAt}:${snapshot.routeHealthEndpoint}`).slice(0, 16)}`,
    passId: PASS2375_ROUTE_HEALTH_LEDGER_ID,
    focusKey,
    locale: snapshot.locale,
    pingedAt,
    pingSource,
    routeHealthEndpoint: cleanToken(snapshot.routeHealthEndpoint, 360) ?? "/api/security/audit-watch/route-health",
    deliveryWarningLevel,
    counts: snapshot.counts,
    routeStates,
    missingKeys,
    readyKeys,
    blockedKeys,
    focus: {
      id: cleanToken(snapshot.focus.id),
      requestId: cleanToken(snapshot.focus.requestId),
      auditQueueId: cleanToken(snapshot.focus.auditQueueId),
      accountMessageId: cleanToken(snapshot.focus.accountMessageId),
      accountId: cleanToken(snapshot.focus.accountId),
    },
    safeBoundary:
      "PASS2375 route-health ledger stores only route states, redacted focus ids, counts, timestamps and customer-delivery warnings. It never stores raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
  };
}

function rowFromRecord(record: Pass2375RouteHealthPingRecord) {
  return {
    id: record.id,
    focus_key: record.focusKey,
    locale: record.locale,
    ping_source: record.pingSource,
    route_health_endpoint: record.routeHealthEndpoint,
    delivery_warning_level: record.deliveryWarningLevel,
    counts: record.counts,
    route_states: record.routeStates,
    missing_keys: record.missingKeys,
    ready_keys: record.readyKeys,
    blocked_keys: record.blockedKeys,
    focus: record.focus,
    safe_boundary: record.safeBoundary,
    record,
    pinged_at: record.pingedAt,
    created_at: record.pingedAt,
  };
}

function recordFromRow(row: Record<string, unknown>): Pass2375RouteHealthPingRecord {
  const raw = (row.record ?? {}) as Partial<Pass2375RouteHealthPingRecord>;
  const focus = (row.focus ?? raw.focus ?? {}) as Pass2375RouteHealthPingRecord["focus"];
  return {
    id: cleanToken(row.id ?? raw.id, 120) ?? `rh_${Date.now()}`,
    passId: PASS2375_ROUTE_HEALTH_LEDGER_ID,
    focusKey: cleanToken(row.focus_key ?? raw.focusKey, 120) ?? "route_unknown",
    locale: normalizeLocale(row.locale ?? raw.locale),
    pingedAt: cleanToken(row.pinged_at ?? raw.pingedAt, 90) ?? nowIso(),
    pingSource: normalizePingSource(row.ping_source ?? raw.pingSource),
    routeHealthEndpoint: cleanToken(row.route_health_endpoint ?? raw.routeHealthEndpoint, 360) ?? "/api/security/audit-watch/route-health",
    deliveryWarningLevel: normalizeWarningLevel(row.delivery_warning_level ?? raw.deliveryWarningLevel),
    counts: normalizeCounts(row.counts ?? raw.counts),
    routeStates: normalizeRouteStates(row.route_states ?? raw.routeStates),
    missingKeys: arrayOfStrings(row.missing_keys ?? raw.missingKeys),
    readyKeys: arrayOfStrings(row.ready_keys ?? raw.readyKeys),
    blockedKeys: arrayOfStrings(row.blocked_keys ?? raw.blockedKeys),
    focus: {
      id: cleanToken(focus.id),
      requestId: cleanToken(focus.requestId),
      auditQueueId: cleanToken(focus.auditQueueId),
      accountMessageId: cleanToken(focus.accountMessageId),
      accountId: cleanToken(focus.accountId),
    },
    safeBoundary: cleanToken(row.safe_boundary ?? raw.safeBoundary, 600) ?? "Route health ledger is redacted.",
  };
}

function remember(record: Pass2375RouteHealthPingRecord) {
  routeHealthMemoryStore.set(record.id, record);
  const sorted = Array.from(routeHealthMemoryStore.values()).sort((a, b) => Date.parse(b.pingedAt) - Date.parse(a.pingedAt));
  for (const stale of sorted.slice(MAX_MEMORY_RECORDS)) routeHealthMemoryStore.delete(stale.id);
}

function minutesSince(value?: string) {
  if (!value) return undefined;
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return undefined;
  return Math.max(0, Math.round(delta / 60000));
}

function filterMemory(focusKey: string, limit: number) {
  return Array.from(routeHealthMemoryStore.values())
    .filter((record) => record.focusKey === focusKey)
    .sort((a, b) => Date.parse(b.pingedAt) - Date.parse(a.pingedAt))
    .slice(0, limit);
}

export async function recordPass2375RouteHealthPing(snapshot: Pass2374CustomerSafeRouteHealthSnapshot, pingSource: Pass2375RouteHealthPingSource) {
  const record = buildPingRecord(snapshot, pingSource);
  const supabase = getSupabaseServiceRoleClient();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(rowFromRecord(record))
      .select("*")
      .maybeSingle();
    if (!error && data) return { record: recordFromRow(data), source: "supabase" as const, durableWrite: true };
  }
  remember(record);
  return { record, source: "memory" as const, durableWrite: false };
}

export async function listPass2375RouteHealthPings(input: { focusKey: string; limit?: number }) {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 8), 24));
  const focusKey = cleanToken(input.focusKey, 120) ?? "route_unknown";
  const supabase = getSupabaseServiceRoleClient();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("focus_key", focusKey)
      .order("pinged_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) return { source: "supabase" as const, records: data.map(recordFromRow) };
  }
  return { source: "memory" as const, records: filterMemory(focusKey, limit) };
}

function buildWarnings(input: {
  routeStates: Record<string, Pass2374RouteHealthState>;
  lastEndpointPing?: Pass2375RouteHealthPingRecord;
  lastEndpointPingAgeMinutes?: number;
  staleAfterMinutes: number;
}) {
  const warnings: Pass2375RouteHealthWarning[] = [];
  const missingDelivery = deliveryMissingKeys(input.routeStates);
  if (missingDelivery.length) {
    warnings.push({
      key: "missing_customer_delivery_route",
      level: "blocked",
      summary: `Customer delivery is blocked until these route checks are ready: ${missingDelivery.join(", ")}.`,
      nextAction: "Open the linked request drawer, attach/mark-ready the report and re-run route-health ping.",
    });
  }
  if (!rawPayloadBlocked(input.routeStates)) {
    warnings.push({
      key: "raw_payload_boundary_not_blocked",
      level: "blocked",
      summary: "Raw payment payload boundary is not marked blocked.",
      nextAction: "Keep raw Stripe/webhook/BLIK/card payloads out of customer and admin summary routes before delivery.",
    });
  }
  if (!input.lastEndpointPing) {
    warnings.push({
      key: "missing_endpoint_ping",
      level: "stale",
      summary: "No route-health endpoint ping is recorded yet for this request.",
      nextAction: "Open the route health endpoint from the drawer before customer handoff.",
    });
  } else if (typeof input.lastEndpointPingAgeMinutes === "number" && input.lastEndpointPingAgeMinutes > input.staleAfterMinutes) {
    warnings.push({
      key: "stale_endpoint_ping",
      level: "stale",
      summary: `Last endpoint ping is ${input.lastEndpointPingAgeMinutes} minutes old; threshold is ${input.staleAfterMinutes} minutes.`,
      nextAction: "Re-run route-health ping before marking customer delivery as final.",
    });
  }
  if (!warnings.length) {
    warnings.push({
      key: "delivery_route_health_ok",
      level: "ok",
      summary: "Customer-safe report, PDF packet, account message and raw-payload boundary are ready for handoff review.",
      nextAction: "Proceed with operator copy review, then deliver the customer-safe report.",
    });
  }
  return warnings;
}

function foldLevel(warnings: Pass2375RouteHealthWarning[]): Pass2375DeliveryWarningLevel {
  if (warnings.some((warning) => warning.level === "blocked")) return "blocked";
  if (warnings.some((warning) => warning.level === "stale")) return "stale";
  if (warnings.some((warning) => warning.level === "watch")) return "watch";
  return "ok";
}

export async function buildPass2375RouteHealthLedger(input: {
  routeHealth: Pass2374CustomerSafeRouteHealthSnapshot;
  pingSource?: Pass2375RouteHealthPingSource;
  recordPing?: boolean;
  staleAfterMinutes?: number;
}): Promise<Pass2375RouteHealthLedgerSnapshot> {
  const staleAfterMinutes = Math.max(1, Math.min(Number(input.staleAfterMinutes ?? 15), 240));
  const focusKey = focusKeyFor(input.routeHealth);
  let writeSource: Pass2375RouteHealthPingSourceKind | undefined;
  // Reads must stay side-effect free. A caller has to opt in explicitly from
  // an authenticated operator/worker mutation path before a ping is written.
  if (input.recordPing === true) {
    const write = await recordPass2375RouteHealthPing(input.routeHealth, input.pingSource ?? "manual_admin_check");
    writeSource = write.source;
  }
  const historyResult = await listPass2375RouteHealthPings({ focusKey, limit: 10 });
  const history = historyResult.records;
  const lastPing = history[0];
  const lastEndpointPing = history.find((record) => record.pingSource === "route_health_endpoint" || record.pingSource === "customer_delivery_guard");
  const routeStates = buildRouteStateIndex(input.routeHealth).routeStates;
  const lastPingAgeMinutes = minutesSince(lastPing?.pingedAt);
  const lastEndpointPingAgeMinutes = minutesSince(lastEndpointPing?.pingedAt);
  const warnings = buildWarnings({ routeStates, lastEndpointPing, lastEndpointPingAgeMinutes, staleAfterMinutes });
  const deliveryWarningLevel = foldLevel(warnings);
  const customerDeliveryAllowed = deliveryWarningLevel === "ok";
  return {
    ok: customerDeliveryAllowed,
    passId: PASS2375_ROUTE_HEALTH_LEDGER_ID,
    generatedAt: nowIso(),
    focusKey,
    source: writeSource ?? historyResult.source,
    durableStorageReady: hasSupabaseServiceRoleConfig(),
    lastPing,
    lastEndpointPing,
    lastPingAgeMinutes,
    lastEndpointPingAgeMinutes,
    staleAfterMinutes,
    deliveryWarningLevel,
    warnings,
    history,
    customerDeliveryAllowed,
    recommendedAction: customerDeliveryAllowed
      ? "Route health is current; review customer-safe copy and deliver."
      : "Do not finalize customer delivery until blocked/stale route-health warnings are cleared.",
    safeBoundary:
      "PASS2375 route-health ledger exposes route ping timestamps, redacted ids, route states, stale warnings and delivery gating only. It never exposes raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
  };
}
