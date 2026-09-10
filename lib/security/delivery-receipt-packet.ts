import { getAuditAccountMessageByIdentifier, type AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import { listPass2377DeliveryReceipts, type Pass2377DeliveryReceiptRecord } from "@/lib/security/delivery-receipt-ledger";

export const PASS2378_DELIVERY_RECEIPT_PACKET_ID = "pass2378-customer-delivery-receipt-route-redacted-packet" as const;

export type Pass2378DeliveryReceiptPacketStatus = "ready" | "not_found" | "manual_review";

export type Pass2378DeliveryReceiptPacket = {
  ok: boolean;
  passId: typeof PASS2378_DELIVERY_RECEIPT_PACKET_ID;
  generatedAt: string;
  status: Pass2378DeliveryReceiptPacketStatus;
  locale: "pl" | "en" | "de";
  title: string;
  summary: string;
  receipt?: {
    receiptId: string;
    checksum: string;
    status: string;
    deliveredAt: string;
    operatorId: string;
    source: string;
  };
  project: {
    name: string;
    requestId?: string;
    auditQueueId?: string;
    accountMessageId?: string;
    accountId?: string;
    reportId?: string;
  };
  gateSnapshot?: {
    canDeliver: boolean;
    endpointPingFresh: boolean;
    routeHealthAllowed: boolean;
    zeroBlockedWarnings: boolean;
    zeroStaleWarnings: boolean;
    blockedWarningCount: number;
    staleWarningCount: number;
    lastEndpointPingAt?: string;
    lastEndpointPingAgeMinutes?: number;
    focusKey: string;
  };
  links: {
    accountRoute: string;
    customerReportRoute?: string;
    safePdfPacketRoute?: string;
    redactedReceiptPacketRoute: string;
    downloadableReceiptPacketRoute: string;
  };
  receiptSections: string[];
  forbidden: string[];
  customerBoundary: string;
  recommendedAction: string;
  source: "receipt_ledger" | "fallback";
};

const SAFE_LOCALES = new Set(["pl", "en", "de"]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(value ?? "")) ? (String(value) as "pl" | "en" | "de") : "en";
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

function cleanRoute(value: unknown, fallback: string) {
  const route = cleanToken(value, 420) ?? fallback;
  if (/^(javascript|data|file|blob):/i.test(route)) return fallback;
  return route;
}

function pickReceiptMessageId(receipt?: Pass2377DeliveryReceiptRecord | null) {
  return receipt?.accountMessageId ?? receipt?.messageId ?? receipt?.requestId;
}

function projectNameFromMessage(message?: AuditAccountMessageRecord | null) {
  const optional = message as (AuditAccountMessageRecord & { contractName?: string; symbol?: string }) | null | undefined;
  return cleanToken(message?.projectName, 140)
    ?? cleanToken(optional?.contractName, 140)
    ?? cleanToken(optional?.symbol, 80)
    ?? "Velmère Audit Request";
}

function receiptStatus(receipt?: Pass2377DeliveryReceiptRecord | null): Pass2378DeliveryReceiptPacketStatus {
  if (!receipt?.receiptId) return "not_found";
  return receipt.status === "delivered" ? "ready" : "manual_review";
}

function forbiddenClaims() {
  return [
    "raw Stripe/webhook payloads",
    "BLIK codes or card data",
    "API secrets or bearer tokens",
    "seed phrase or wallet secrets",
    "exploit instructions",
    "Certified Safe claims",
    "investment advice",
  ];
}

function boundary() {
  return "PASS2378 delivery receipt route exposes only a redacted receipt packet: immutable receipt id, checksum, deliveredAt, operator id, customer-safe route links and final-delivery gate snapshot. It never returns raw payment payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.";
}

function buildNotFoundPacket(input: { receiptId: string; locale: "pl" | "en" | "de" }): Pass2378DeliveryReceiptPacket {
  const safeReceiptId = cleanToken(input.receiptId, 160) ?? "missing";
  const packetRoute = `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(safeReceiptId)}&locale=${input.locale}&format=redacted-packet`;
  return {
    ok: false,
    passId: PASS2378_DELIVERY_RECEIPT_PACKET_ID,
    generatedAt: nowIso(),
    status: "not_found",
    locale: input.locale,
    title: "Delivery receipt not found",
    summary: "No immutable delivery receipt was found for this redacted receipt id. The customer report can still exist, but the delivery receipt packet must be generated only after final delivery passes the gate.",
    project: { name: "Velmère Audit Request" },
    links: {
      accountRoute: `/${input.locale}/account?tab=messages`,
      redactedReceiptPacketRoute: packetRoute,
      downloadableReceiptPacketRoute: `${packetRoute}&download=1`,
    },
    receiptSections: [
      "Receipt ledger has no matching immutable delivery receipt for this id.",
      "Customer-safe delivery should not be presented as final without a receipt id and checksum.",
      "Operator should reopen the linked request and run final delivery only after route health is fresh and warnings are clear.",
    ],
    forbidden: forbiddenClaims(),
    customerBoundary: boundary(),
    recommendedAction: "Open the account message or Audit Inbox linked request and regenerate final delivery after the gate passes.",
    source: "fallback",
  };
}

export async function buildPass2378DeliveryReceiptPacket(input: {
  receiptId?: string | null;
  locale?: string | null;
  accountId?: string | null;
}): Promise<Pass2378DeliveryReceiptPacket> {
  const locale = normalizeLocale(input.locale);
  const receiptId = cleanToken(input.receiptId, 160) ?? "missing";
  const accountId = cleanToken(input.accountId, 160);
  const receipts = await listPass2377DeliveryReceipts({ receiptId, accountId, limit: 1 });
  const receipt = receipts.records[0];
  if (!receipt) return buildNotFoundPacket({ receiptId, locale });

  const messageId = pickReceiptMessageId(receipt);
  const messageResult = await getAuditAccountMessageByIdentifier({
    id: messageId,
    requestId: receipt.requestId,
    locale: receipt.locale ?? locale,
    accountId: accountId ?? receipt.accountId,
  });
  const message = messageResult?.record ?? null;
  const resolvedLocale = normalizeLocale(receipt.locale ?? locale);
  const safeReceiptId = cleanToken(receipt.receiptId, 160) ?? receiptId;
  const packetRoute = `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(safeReceiptId)}&locale=${resolvedLocale}&format=redacted-packet`;
  const accountRoute = cleanRoute(receipt.customerSafeLinks.accountRoute, `/${resolvedLocale}/account?tab=messages`);
  const customerReportRoute = cleanRoute(receipt.customerSafeLinks.customerReportRoute, `/${resolvedLocale}/security/audits/customer-report/${encodeURIComponent(receipt.accountMessageId ?? receipt.messageId ?? receipt.requestId ?? "sample")}`);
  const safePdfPacketRoute = cleanRoute(receipt.customerSafeLinks.safePdfPacketRoute, `/api/security/audit-watch/customer-safe-report?id=${encodeURIComponent(receipt.accountMessageId ?? receipt.messageId ?? receipt.requestId ?? "sample")}&locale=${resolvedLocale}&format=pdf-safe`);
  const status = receiptStatus(receipt);

  return {
    ok: status === "ready",
    passId: PASS2378_DELIVERY_RECEIPT_PACKET_ID,
    generatedAt: nowIso(),
    status,
    locale: resolvedLocale,
    title: status === "ready" ? "Velmère delivery receipt" : "Velmère delivery receipt pending review",
    summary: status === "ready"
      ? "This customer-safe receipt confirms that a Velmère operator delivered a redacted report packet after the final delivery gate snapshot was recorded."
      : "This receipt exists, but it is not marked delivered yet. Treat the packet as an operator review artifact, not a final customer receipt.",
    receipt: {
      receiptId: safeReceiptId,
      checksum: cleanToken(receipt.checksum, 90) ?? "vlmrcpt_missing",
      status: cleanToken(receipt.status, 80) ?? "manual_review",
      deliveredAt: cleanToken(receipt.deliveredAt, 90) ?? "pending",
      operatorId: cleanToken(receipt.operatorId, 120) ?? "security-admin",
      source: receipts.source,
    },
    project: {
      name: projectNameFromMessage(message),
      requestId: cleanToken(receipt.requestId ?? message?.requestId, 160),
      auditQueueId: cleanToken(receipt.auditQueueId ?? message?.auditQueueId, 160),
      accountMessageId: cleanToken(receipt.accountMessageId ?? receipt.messageId ?? message?.id, 160),
      accountId: cleanToken(receipt.accountId ?? message?.accountId, 160),
      reportId: cleanToken(receipt.reportId ?? message?.customerSafeReport?.reportId, 160),
    },
    gateSnapshot: receipt.gateSnapshot ? {
      canDeliver: Boolean(receipt.gateSnapshot.canDeliver),
      endpointPingFresh: Boolean(receipt.gateSnapshot.endpointPingFresh),
      routeHealthAllowed: Boolean(receipt.gateSnapshot.routeHealthAllowed),
      zeroBlockedWarnings: Boolean(receipt.gateSnapshot.zeroBlockedWarnings),
      zeroStaleWarnings: Boolean(receipt.gateSnapshot.zeroStaleWarnings),
      blockedWarningCount: Number(receipt.gateSnapshot.blockedWarningCount ?? 0),
      staleWarningCount: Number(receipt.gateSnapshot.staleWarningCount ?? 0),
      lastEndpointPingAt: cleanToken(receipt.gateSnapshot.lastEndpointPingAt, 90),
      lastEndpointPingAgeMinutes: receipt.gateSnapshot.lastEndpointPingAgeMinutes,
      focusKey: cleanToken(receipt.gateSnapshot.focusKey, 120) ?? "route_unknown",
    } : undefined,
    links: {
      accountRoute,
      customerReportRoute,
      safePdfPacketRoute,
      redactedReceiptPacketRoute: packetRoute,
      downloadableReceiptPacketRoute: `${packetRoute}&download=1`,
    },
    receiptSections: [
      `Receipt id: ${safeReceiptId}`,
      `Checksum: ${cleanToken(receipt.checksum, 90) ?? "vlmrcpt_missing"}`,
      `Delivered at: ${cleanToken(receipt.deliveredAt, 90) ?? "pending"}`,
      `Operator: ${cleanToken(receipt.operatorId, 120) ?? "security-admin"}`,
      `Gate snapshot: ${receipt.gateSnapshot?.canDeliver ? "delivery gate passed" : "manual review required"}`,
      "Packet links route only to customer-safe Account, Report and PDF views.",
    ],
    forbidden: forbiddenClaims(),
    customerBoundary: boundary(),
    recommendedAction: status === "ready"
      ? "Keep this receipt with the customer-safe report and safe PDF packet. Use the checksum for support/debug without exposing raw payment data."
      : "Do not present this as final delivery until the linked request is delivered and the receipt status is delivered.",
    source: "receipt_ledger",
  };
}
