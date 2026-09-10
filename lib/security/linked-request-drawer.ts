import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import { listDurablePaymentRuntimeEvidence, type PaymentRuntimeEvidenceFilter } from "@/lib/security/durable-payment-evidence-store";
import {
  buildPass2370FocusSummary,
  hasPass2370AuditFocus,
  pass2370FocusMatchesMessage,
  type Pass2370AuditInboxFocus,
} from "@/lib/security/admin-replay-audit-link";
import type { PaymentRuntimeEvidenceRecord, PaymentRuntimeEvidenceStatus } from "@/lib/security/payment-runtime-evidence";
import { buildPass2374CustomerSafeRouteHealth, type Pass2374CustomerSafeRouteHealthSnapshot } from "@/lib/security/customer-route-health";
import { buildPass2375RouteHealthLedger, type Pass2375RouteHealthLedgerSnapshot } from "@/lib/security/route-health-ledger";
import { buildPass2376FinalDeliveryGate, type Pass2376FinalDeliveryGateSnapshot } from "@/lib/security/final-delivery-gate";
import { buildPass2377DeliveryReceiptLedger, type Pass2377DeliveryReceiptLedgerSnapshot } from "@/lib/security/delivery-receipt-ledger";
import { buildPass2379ReceiptRouteHealth, type Pass2379ReceiptRouteHealthSnapshot } from "@/lib/security/receipt-route-health";
import { buildPass2380CustomerSupportHandoffPacket } from "@/lib/security/customer-support-handoff-packet";
import { buildPass2381SupportHandoffEventLedger, type Pass2381SupportHandoffEventLedgerSnapshot } from "@/lib/security/support-handoff-event-ledger";

export const PASS2371_LINKED_REQUEST_DRAWER_ID = "linked-request-drawer-evidence-message-operator-report" as const;

const SAFE_LOCALES = new Set(["pl", "en", "de"]);
const SAFE_OPERATOR_ACTIONS = [
  "mark_analysis",
  "request_evidence",
  "attach_pdf",
  "mark_ready",
  "deliver_customer_safe_report",
  "block_redaction",
] as const;

export type Pass2371LinkedRequestDrawerSnapshot = {
  passId: typeof PASS2371_LINKED_REQUEST_DRAWER_ID;
  active: boolean;
  locale: "pl" | "en" | "de";
  focusSummary?: string;
  message?: AuditAccountMessageRecord;
  evidenceRows: PaymentRuntimeEvidenceRecord[];
  evidenceSource: "supabase" | "memory" | "mixed" | "none";
  evidenceStatusCounts: Record<PaymentRuntimeEvidenceStatus, number>;
  linked: {
    auditQueueId?: string;
    accountMessageId?: string;
    accountId?: string;
    requestId?: string;
    paymentEvidenceRefs: string[];
  };
  accountState: {
    messageStatus?: string;
    deliveryStatus?: string;
    operatorStatus?: string;
    reportStatus?: string;
    actionCount: number;
    paymentEvidenceCount: number;
  };
  routes: {
    adminReplayBoard: string;
    customerReport?: string;
    safePdfPacket?: string;
    exportRoute?: string;
  };
  routeHealth: Pass2374CustomerSafeRouteHealthSnapshot;
  routeHealthLedger: Pass2375RouteHealthLedgerSnapshot;
  finalDeliveryGate: Pass2376FinalDeliveryGateSnapshot;
  deliveryReceiptLedger: Pass2377DeliveryReceiptLedgerSnapshot;
  receiptRouteHealth?: Pass2379ReceiptRouteHealthSnapshot;
  supportHandoffEventLedger?: Pass2381SupportHandoffEventLedgerSnapshot;
  operatorActions: readonly string[];
  emptyReason?: string;
  safetyBoundary: string;
  nextSteps: string[];
};

function safeLocale(locale?: string): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(locale || "")) ? (String(locale) as "pl" | "en" | "de") : "en";
}

function cleanToken(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

function uniqById(rows: PaymentRuntimeEvidenceRecord[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = row.id || `${row.scenarioId}:${row.evidenceRef}:${row.createdAt}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function countStatuses(rows: PaymentRuntimeEvidenceRecord[]) {
  return rows.reduce<Record<PaymentRuntimeEvidenceStatus, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, { pass: 0, fail: 0, manual: 0, blocked: 0 });
}

function routeForReplayBoard(locale: "pl" | "en" | "de", snapshot: Pick<Pass2371LinkedRequestDrawerSnapshot, "linked">) {
  const params = new URLSearchParams();
  if (snapshot.linked.auditQueueId) params.set("auditQueueId", snapshot.linked.auditQueueId);
  if (snapshot.linked.accountMessageId) params.set("accountMessageId", snapshot.linked.accountMessageId);
  if (snapshot.linked.accountId) params.set("accountId", snapshot.linked.accountId);
  const query = params.toString();
  return `/${locale}/admin/security${query ? `?${query}` : ""}#pass2367-live-payment-evidence-rows`;
}

function firstMessage(messages: AuditAccountMessageRecord[], focus?: Pass2370AuditInboxFocus | null) {
  if (!hasPass2370AuditFocus(focus)) return messages[0];
  return messages.find((message) => pass2370FocusMatchesMessage(message, focus)) ?? messages[0];
}

async function loadEvidenceRows(message: AuditAccountMessageRecord | undefined, focus: Pass2370AuditInboxFocus | undefined | null) {
  const filters: PaymentRuntimeEvidenceFilter[] = [];
  const auditQueueId = cleanToken(focus?.auditQueueId) ?? cleanToken(message?.auditQueueId);
  const accountMessageId = cleanToken(focus?.accountMessageId) ?? cleanToken(message?.id);
  const accountId = cleanToken(focus?.accountId) ?? cleanToken(message?.accountId);
  const evidenceId = cleanToken(focus?.evidenceId);
  const scenarioId = cleanToken(focus?.scenarioId);
  const q = cleanToken(focus?.q);

  if (auditQueueId) filters.push({ auditQueueId, limit: 12 });
  if (accountMessageId) filters.push({ accountMessageId, limit: 12 });
  if (accountId) filters.push({ accountId, limit: 12 });
  if (evidenceId) filters.push({ q: evidenceId, limit: 12 });
  if (scenarioId) filters.push({ scenarioId, limit: 12 });
  if (q) filters.push({ q, limit: 12 });

  if (message?.paymentEvidenceRefs?.length) {
    for (const ref of message.paymentEvidenceRefs.slice(0, 5)) filters.push({ q: ref, limit: 8 });
  }

  if (!filters.length) return { rows: [] as PaymentRuntimeEvidenceRecord[], source: "none" as const };

  const results = await Promise.all(filters.map((filter) => listDurablePaymentRuntimeEvidence(filter)));
  const rows = uniqById(results.flatMap((result) => result.records))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 18);
  const sources = Array.from(new Set(results.map((result) => result.source)));
  return { rows, source: sources.length === 1 ? sources[0] : "mixed" as const };
}

export async function buildPass2371LinkedRequestDrawerSnapshot(input: {
  locale?: string;
  focus?: Pass2370AuditInboxFocus | null;
  messages: AuditAccountMessageRecord[];
}): Promise<Pass2371LinkedRequestDrawerSnapshot> {
  const locale = safeLocale(input.locale);
  const active = hasPass2370AuditFocus(input.focus);
  const message = firstMessage(input.messages, input.focus);
  const evidence = active ? await loadEvidenceRows(message, input.focus) : { rows: [] as PaymentRuntimeEvidenceRecord[], source: "none" as const };
  const linked = {
    auditQueueId: cleanToken(input.focus?.auditQueueId) ?? cleanToken(message?.auditQueueId),
    accountMessageId: cleanToken(input.focus?.accountMessageId) ?? cleanToken(message?.id),
    accountId: cleanToken(input.focus?.accountId) ?? cleanToken(message?.accountId),
    requestId: cleanToken(message?.requestId),
    paymentEvidenceRefs: (message?.paymentEvidenceRefs ?? []).map((item) => cleanToken(item)).filter((item): item is string => Boolean(item)).slice(0, 8),
  };
  const baseRoutes = {
    adminReplayBoard: routeForReplayBoard(locale, { linked }),
    customerReport: cleanToken(message?.customerSafeReport?.publicReportRoute, 300) ?? cleanToken(message?.publicReportRoute, 300),
    safePdfPacket: cleanToken(message?.customerSafeReport?.pdfRoute, 300) ?? cleanToken(message?.pdfRoute, 300) ?? cleanToken(message?.exportRoute, 300),
    exportRoute: cleanToken(message?.exportRoute, 300),
  };
  const routeHealth = buildPass2374CustomerSafeRouteHealth({
    locale,
    id: linked.accountMessageId ?? linked.requestId ?? linked.auditQueueId,
    requestId: linked.requestId,
    record: message ?? null,
    adminReplayBoardRoute: baseRoutes.adminReplayBoard,
  });
  const routeHealthLedger = await buildPass2375RouteHealthLedger({
    routeHealth,
    pingSource: "linked_request_drawer",
    recordPing: active,
    staleAfterMinutes: 15,
  });
  const finalDeliveryGate = await buildPass2376FinalDeliveryGate({
    locale,
    message,
    routeHealth,
    routeHealthLedger,
    staleAfterMinutes: 15,
  });
  const deliveryReceiptLedger = await buildPass2377DeliveryReceiptLedger({
    message,
    finalDeliveryGate,
    limit: 6,
  });
  const receiptRouteHealth = deliveryReceiptLedger.latestReceipt ? buildPass2379ReceiptRouteHealth({
    locale,
    receiptId: deliveryReceiptLedger.latestReceipt.receiptId,
    receiptStatus: deliveryReceiptLedger.latestReceipt.status,
    accountMessageId: deliveryReceiptLedger.latestReceipt.accountMessageId ?? message?.id,
    accountId: deliveryReceiptLedger.latestReceipt.accountId ?? message?.accountId,
    accountRoute: deliveryReceiptLedger.latestReceipt.customerSafeLinks.accountRoute,
    deliveryReceiptRoute: `/${locale}/security/audits/delivery-receipt/${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}`,
    redactedPacketRoute: `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}&locale=${locale}&format=redacted-packet`,
    downloadablePacketRoute: `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}&locale=${locale}&format=download`,
    routeHealthEndpoint: routeHealth.routeHealthEndpoint,
  }) : undefined;
  const supportHandoffEventLedger = deliveryReceiptLedger.latestReceipt ? await buildPass2381SupportHandoffEventLedger({
    packet: await buildPass2380CustomerSupportHandoffPacket({ locale, receiptId: deliveryReceiptLedger.latestReceipt.receiptId }),
    recordEvent: false,
    limit: 8,
  }) : undefined;

  const accountState = {
    messageStatus: cleanToken(message?.status, 80),
    deliveryStatus: cleanToken(message?.deliveryStatus, 80),
    operatorStatus: cleanToken(message?.operatorStatus, 80),
    reportStatus: cleanToken(message?.customerSafeReport?.status, 80),
    actionCount: message?.actionLog?.length ?? 0,
    paymentEvidenceCount: evidence.rows.length || linked.paymentEvidenceRefs.length,
  };
  const nextSteps = [
    accountState.paymentEvidenceCount ? "Payment evidence is linked; review only redacted evidence rows while deterministic delivery gates remain authoritative." : "No linked payment evidence found yet; record or link safe evidence before customer delivery.",
    accountState.reportStatus ? "Customer-safe report route exists; verify PDF packet and customer card auto-sync." : "Move the request through deterministic analysis, snapshot/redaction and PDF gates; optional mark_ready is only an internal annotation.",
    accountState.reportStatus ? "Customer-safe report object exists; keep exploit steps, raw webhook data and payment secrets outside the customer view." : "Customer-safe report object is created by the delivery path after deterministic gates pass; mark_ready does not authorize delivery.",
  ];

  return {
    passId: PASS2371_LINKED_REQUEST_DRAWER_ID,
    active,
    locale,
    focusSummary: buildPass2370FocusSummary(input.focus),
    message,
    evidenceRows: evidence.rows,
    evidenceSource: evidence.source,
    evidenceStatusCounts: countStatuses(evidence.rows),
    linked,
    accountState,
    routes: baseRoutes,
    routeHealth,
    routeHealthLedger,
    finalDeliveryGate,
    deliveryReceiptLedger,
    receiptRouteHealth,
    supportHandoffEventLedger,
    operatorActions: SAFE_OPERATOR_ACTIONS,
    emptyReason: active && !message ? "Replay focus is active, but no matching account message exists yet." : active && !evidence.rows.length ? "Matching account message found, but no linked payment evidence rows are stored yet." : undefined,
    safetyBoundary:
      "PASS2371 drawer is admin-safe but still redacted: it may show request ids, account ids, safe payment evidence summaries, operator status, delivery receipt ids and customer-safe report routes; it must never show raw payment payloads, raw Stripe payloads, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
    nextSteps,
  };
}
