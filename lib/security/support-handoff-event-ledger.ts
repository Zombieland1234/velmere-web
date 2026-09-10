import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2380CustomerSupportHandoffPacket, Pass2380SupportHandoffStatus } from "@/lib/security/customer-support-handoff-packet";

export const PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID = "pass2381-support-handoff-open-download-event-ledger" as const;

export type Pass2381SupportHandoffEventType = "support_route_open" | "support_api_packet_view" | "support_packet_download";
export type Pass2381SupportHandoffEventSource = "supabase" | "memory";

export type Pass2381SupportHandoffEventRecord = {
  eventId: string;
  passId: typeof PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID;
  eventType: Pass2381SupportHandoffEventType;
  eventAt: string;
  locale: "pl" | "en" | "de";
  receiptId?: string;
  receiptChecksum?: string;
  supportHandoffId?: string;
  supportHandoffStatus: Pass2380SupportHandoffStatus;
  supportHandoffRoute?: string;
  downloadableSupportHandoffRoute?: string;
  actor: {
    kind: "customer" | "support" | "operator" | "unknown";
    label: string;
  };
  project: {
    name?: string;
    accountMessageId?: string;
    accountId?: string;
  };
  routeHealth: {
    freshnessBadge: string;
    warningCount: number;
    rawPaymentPayloadBlocked: boolean;
  };
  eventSummary: string;
  checksum: string;
  safeBoundary: string;
  source: Pass2381SupportHandoffEventSource;
};

export type Pass2381SupportHandoffEventLedgerSnapshot = {
  ok: boolean;
  passId: typeof PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID;
  generatedAt: string;
  source: Pass2381SupportHandoffEventSource;
  durableStorageReady: boolean;
  receiptId?: string;
  supportHandoffId?: string;
  eventCount: number;
  openCount: number;
  downloadCount: number;
  lastOpenAt?: string;
  lastDownloadAt?: string;
  latestEvent?: Pass2381SupportHandoffEventRecord;
  history: Pass2381SupportHandoffEventRecord[];
  auditTrailReady: boolean;
  recommendedAction: string;
  safeBoundary: string;
};

const TABLE_NAME = "velmere_support_handoff_event_ledger";
const memoryStore = new Map<string, Pass2381SupportHandoffEventRecord>();
const MAX_MEMORY_EVENTS = 220;

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

function normalizeEventType(value: unknown): Pass2381SupportHandoffEventType {
  if (value === "support_route_open" || value === "support_api_packet_view" || value === "support_packet_download") return value;
  return "support_api_packet_view";
}

function normalizeStatus(value: unknown): Pass2380SupportHandoffStatus {
  if (value === "ready" || value === "watch" || value === "blocked") return value;
  return "watch";
}

function boundary() {
  return "PASS2381 support handoff event ledger stores only redacted open/download event metadata, receipt/support ids, route freshness badge, warning counts, checksums and safe route refs. It never stores raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.";
}

function rawPaymentBoundaryBlocked(packet: Pass2380CustomerSupportHandoffPacket) {
  return packet.items.some((item) => item.key === "raw_payment_payload" && item.state === "blocked");
}

function eventSummaryFor(eventType: Pass2381SupportHandoffEventType) {
  if (eventType === "support_packet_download") return "A redacted customer support handoff JSON packet was downloaded; raw payment payloads stayed blocked.";
  if (eventType === "support_route_open") return "The customer support handoff page was opened with a redacted support packet view.";
  return "The customer support handoff API returned a redacted packet view.";
}

function checksumFor(record: Omit<Pass2381SupportHandoffEventRecord, "checksum" | "source">) {
  return `vlmsh_${stableHash(JSON.stringify({
    eventId: record.eventId,
    eventType: record.eventType,
    eventAt: record.eventAt,
    receiptId: record.receiptId,
    supportHandoffId: record.supportHandoffId,
    supportHandoffStatus: record.supportHandoffStatus,
    routeHealth: record.routeHealth,
  })).slice(0, 18)}`;
}

function buildEvent(
  packet: Pass2380CustomerSupportHandoffPacket,
  eventType: Pass2381SupportHandoffEventType,
  actor: Pass2381SupportHandoffEventRecord["actor"],
): Omit<Pass2381SupportHandoffEventRecord, "checksum" | "source"> {
  const eventAt = nowIso();
  const receiptId = cleanToken(packet.receiptId, 160);
  const supportHandoffId = cleanToken(packet.supportHandoffId, 160);
  const eventId = `vlm_support_event_${stableHash(`${receiptId ?? "missing"}:${supportHandoffId ?? "support"}:${eventType}:${eventAt}`).slice(0, 18)}`;
  const routeWarningCount = Number(packet.routeHealthWarnings?.length ?? 0);

  return {
    eventId,
    passId: PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID,
    eventType,
    eventAt,
    locale: normalizeLocale(packet.locale),
    receiptId,
    receiptChecksum: cleanToken(packet.receiptChecksum, 120),
    supportHandoffId,
    supportHandoffStatus: normalizeStatus(packet.status),
    supportHandoffRoute: cleanToken(packet.links.supportHandoffRoute, 360),
    downloadableSupportHandoffRoute: cleanToken(packet.links.downloadableSupportHandoffRoute, 360),
    actor,
    project: {
      name: cleanToken(packet.project.name, 140),
      accountMessageId: cleanToken(packet.project.accountMessageId, 160),
      accountId: cleanToken(packet.project.accountId, 160),
    },
    routeHealth: {
      freshnessBadge: cleanToken(packet.receiptRouteHealth.freshnessBadge, 60) ?? "unknown",
      warningCount: routeWarningCount,
      rawPaymentPayloadBlocked: rawPaymentBoundaryBlocked(packet),
    },
    eventSummary: eventSummaryFor(eventType),
    safeBoundary: boundary(),
  };
}

function rowFromRecord(record: Pass2381SupportHandoffEventRecord) {
  return {
    id: record.eventId,
    event_id: record.eventId,
    event_type: record.eventType,
    event_at: record.eventAt,
    locale: record.locale,
    receipt_id: record.receiptId,
    receipt_checksum: record.receiptChecksum,
    support_handoff_id: record.supportHandoffId,
    support_handoff_status: record.supportHandoffStatus,
    support_handoff_route: record.supportHandoffRoute,
    downloadable_support_handoff_route: record.downloadableSupportHandoffRoute,
    actor: record.actor,
    project: record.project,
    route_health: record.routeHealth,
    event_summary: record.eventSummary,
    checksum: record.checksum,
    safe_boundary: record.safeBoundary,
    record: { ...record, source: undefined },
    created_at: record.eventAt,
  };
}

function recordFromRow(row: Record<string, unknown>, source: Pass2381SupportHandoffEventSource): Pass2381SupportHandoffEventRecord {
  const raw = (row.record ?? {}) as Partial<Pass2381SupportHandoffEventRecord>;
  const actor = (row.actor ?? raw.actor ?? {}) as Partial<Pass2381SupportHandoffEventRecord["actor"]>;
  const project = (row.project ?? raw.project ?? {}) as Partial<Pass2381SupportHandoffEventRecord["project"]>;
  const routeHealth = (row.route_health ?? raw.routeHealth ?? {}) as Partial<Pass2381SupportHandoffEventRecord["routeHealth"]>;
  return {
    eventId: cleanToken(row.event_id ?? row.id ?? raw.eventId, 160) ?? `vlm_support_event_${Date.now()}`,
    passId: PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID,
    eventType: normalizeEventType(row.event_type ?? raw.eventType),
    eventAt: cleanToken(row.event_at ?? row.created_at ?? raw.eventAt, 90) ?? nowIso(),
    locale: normalizeLocale(row.locale ?? raw.locale),
    receiptId: cleanToken(row.receipt_id ?? raw.receiptId, 160),
    receiptChecksum: cleanToken(row.receipt_checksum ?? raw.receiptChecksum, 120),
    supportHandoffId: cleanToken(row.support_handoff_id ?? raw.supportHandoffId, 160),
    supportHandoffStatus: normalizeStatus(row.support_handoff_status ?? raw.supportHandoffStatus),
    supportHandoffRoute: cleanToken(row.support_handoff_route ?? raw.supportHandoffRoute, 360),
    downloadableSupportHandoffRoute: cleanToken(row.downloadable_support_handoff_route ?? raw.downloadableSupportHandoffRoute, 360),
    actor: {
      kind: actor.kind === "customer" || actor.kind === "support" || actor.kind === "operator" || actor.kind === "unknown" ? actor.kind : "unknown",
      label: cleanToken(actor.label, 120) ?? "redacted-support-event",
    },
    project: {
      name: cleanToken(project.name, 140),
      accountMessageId: cleanToken(project.accountMessageId, 160),
      accountId: cleanToken(project.accountId, 160),
    },
    routeHealth: {
      freshnessBadge: cleanToken(routeHealth.freshnessBadge, 60) ?? "unknown",
      warningCount: Number(routeHealth.warningCount ?? 0),
      rawPaymentPayloadBlocked: Boolean(routeHealth.rawPaymentPayloadBlocked),
    },
    eventSummary: cleanToken(row.event_summary ?? raw.eventSummary, 360) ?? "Redacted support handoff event.",
    checksum: cleanToken(row.checksum ?? raw.checksum, 80) ?? "vlmsh_missing",
    safeBoundary: cleanToken(row.safe_boundary ?? raw.safeBoundary, 700) ?? boundary(),
    source,
  };
}

function remember(record: Pass2381SupportHandoffEventRecord) {
  memoryStore.set(record.eventId, record);
  const sorted = Array.from(memoryStore.values()).sort((a, b) => Date.parse(b.eventAt) - Date.parse(a.eventAt));
  for (const stale of sorted.slice(MAX_MEMORY_EVENTS)) memoryStore.delete(stale.eventId);
}

function filterMemory(receiptId: string | undefined, supportHandoffId: string | undefined, limit: number) {
  return Array.from(memoryStore.values())
    .filter((record) => {
      if (receiptId && record.receiptId === receiptId) return true;
      if (supportHandoffId && record.supportHandoffId === supportHandoffId) return true;
      return !receiptId && !supportHandoffId;
    })
    .sort((a, b) => Date.parse(b.eventAt) - Date.parse(a.eventAt))
    .slice(0, limit);
}

async function persist(record: Pass2381SupportHandoffEventRecord) {
  remember(record);
  if (!hasSupabaseServiceRoleConfig()) return { source: "memory" as const };
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { source: "memory" as const };
  try {
    const { error } = await supabase.from(TABLE_NAME).upsert(rowFromRecord(record), { onConflict: "event_id" });
    if (error) return { source: "memory" as const };
    return { source: "supabase" as const };
  } catch {
    return { source: "memory" as const };
  }
}

async function loadHistory(input: { receiptId?: string; supportHandoffId?: string; limit: number }): Promise<{ source: Pass2381SupportHandoffEventSource; history: Pass2381SupportHandoffEventRecord[] }> {
  const memory = filterMemory(input.receiptId, input.supportHandoffId, input.limit);
  if (!hasSupabaseServiceRoleConfig()) return { source: "memory", history: memory };
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return { source: "memory", history: memory };
  try {
    let query = supabase.from(TABLE_NAME).select("*").order("event_at", { ascending: false }).limit(input.limit);
    if (input.receiptId) query = query.eq("receipt_id", input.receiptId);
    else if (input.supportHandoffId) query = query.eq("support_handoff_id", input.supportHandoffId);
    const { data, error } = await query;
    if (error || !data) return { source: "memory", history: memory };
    return { source: "supabase", history: data.map((row: Record<string, unknown>) => recordFromRow(row, "supabase")) };
  } catch {
    return { source: "memory", history: memory };
  }
}

function summarize(input: {
  packet: Pass2380CustomerSupportHandoffPacket;
  source: Pass2381SupportHandoffEventSource;
  history: Pass2381SupportHandoffEventRecord[];
}): Pass2381SupportHandoffEventLedgerSnapshot {
  const events = input.history.sort((a, b) => Date.parse(b.eventAt) - Date.parse(a.eventAt));
  const openEvents = events.filter((event) => event.eventType === "support_route_open" || event.eventType === "support_api_packet_view");
  const downloadEvents = events.filter((event) => event.eventType === "support_packet_download");
  const latestEvent = events[0];
  const lastOpenAt = openEvents[0]?.eventAt;
  const lastDownloadAt = downloadEvents[0]?.eventAt;
  const auditTrailReady = Boolean(latestEvent && input.packet.receiptId && input.packet.supportHandoffId);
  return {
    ok: auditTrailReady,
    passId: PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID,
    generatedAt: nowIso(),
    source: input.source,
    durableStorageReady: hasSupabaseServiceRoleConfig(),
    receiptId: cleanToken(input.packet.receiptId, 160),
    supportHandoffId: cleanToken(input.packet.supportHandoffId, 160),
    eventCount: events.length,
    openCount: openEvents.length,
    downloadCount: downloadEvents.length,
    lastOpenAt,
    lastDownloadAt,
    latestEvent,
    history: events.slice(0, 12),
    auditTrailReady,
    recommendedAction: auditTrailReady
      ? "Support handoff open/download activity is captured in a redacted event ledger. Use this for support auditability without exposing raw payment data."
      : "Open or download the support handoff packet once to create the first redacted support event before support handoff audit review.",
    safeBoundary: boundary(),
  };
}

export async function buildPass2381SupportHandoffEventLedger(input: {
  packet: Pass2380CustomerSupportHandoffPacket;
  eventType?: Pass2381SupportHandoffEventType;
  recordEvent?: boolean;
  actor?: Pass2381SupportHandoffEventRecord["actor"];
  limit?: number;
}): Promise<Pass2381SupportHandoffEventLedgerSnapshot> {
  const limit = Math.max(1, Math.min(30, Number(input.limit ?? 12)));
  const source: Pass2381SupportHandoffEventSource = hasSupabaseServiceRoleConfig() ? "supabase" : "memory";
  if (input.recordEvent) {
    if (!input.actor || input.actor.kind === "unknown" || !cleanToken(input.actor.label, 120)) {
      throw new Error("support_handoff_authenticated_actor_required");
    }
    const pending = buildEvent(input.packet, normalizeEventType(input.eventType), {
      kind: input.actor.kind,
      label: cleanToken(input.actor.label, 120)!,
    });
    const record = { ...pending, checksum: checksumFor(pending), source };
    await persist(record);
  }
  const loaded = await loadHistory({ receiptId: cleanToken(input.packet.receiptId, 160), supportHandoffId: cleanToken(input.packet.supportHandoffId, 160), limit });
  return summarize({ packet: input.packet, source: loaded.source, history: loaded.history });
}
