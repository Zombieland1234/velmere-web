import { NextResponse } from "next/server";
import { getAuditAccountMessageByIdentifier } from "@/lib/account/audit-account-messages";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { buildPass2374CustomerSafeRouteHealth, PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID } from "@/lib/security/customer-route-health";
import { buildPass2375RouteHealthLedger, PASS2375_ROUTE_HEALTH_LEDGER_ID } from "@/lib/security/route-health-ledger";
import { buildPass2376FinalDeliveryGate, PASS2376_FINAL_DELIVERY_GATE_ID } from "@/lib/security/final-delivery-gate";
import { buildPass2377DeliveryReceiptLedger, PASS2377_DELIVERY_RECEIPT_LEDGER_ID } from "@/lib/security/delivery-receipt-ledger";
import { buildPass2379ReceiptRouteHealth, PASS2379_RECEIPT_ROUTE_HEALTH_ID } from "@/lib/security/receipt-route-health";
import { buildPass2380CustomerSupportHandoffPacket, PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID } from "@/lib/security/customer-support-handoff-packet";
import { buildPass2381SupportHandoffEventLedger, PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID } from "@/lib/security/support-handoff-event-ledger";

function cleanText(value: string | null, max = 180) {
  const trimmed = String(value ?? "")
    .replace(/[<>`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|sk_test|pk_test|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function normalizeLocale(value: string | null) {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

function privateHeaders() {
  return {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    vary: "Cookie, Authorization",
    "x-content-type-options": "nosniff",
  };
}

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export async function GET(request: Request) {
  const limited = await applyApiRateLimit(request, {
    keyPrefix: "pass32-account-route-health",
    limit: 45,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const account = await resolveRequestAccount(request);
  if (!account || (isProductionLike() && account.sessionSource === "preview")) {
    return securityJson({ ok: false, error: "account_session_required" }, { status: 401, headers: privateHeaders() });
  }

  const url = new URL(request.url);
  const id = cleanText(url.searchParams.get("id") ?? url.searchParams.get("messageId") ?? url.searchParams.get("requestId")) ?? "sample";
  const requestId = cleanText(url.searchParams.get("requestId"));
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const result = await getAuditAccountMessageByIdentifier({ id, requestId, locale, accountId: account.accountId });
  if (!result) {
    return securityJson({ ok: false, error: "audit_route_health_not_found_or_not_owned" }, { status: 404, headers: privateHeaders() });
  }
  const snapshot = buildPass2374CustomerSafeRouteHealth({ id, requestId, locale, record: result?.record ?? null });
  const routeHealthLedger = await buildPass2375RouteHealthLedger({
    routeHealth: snapshot,
    pingSource: "route_health_endpoint",
    recordPing: false,
    staleAfterMinutes: 15,
  });

  const finalDeliveryGate = await buildPass2376FinalDeliveryGate({
    locale,
    message: result?.record ?? null,
    routeHealth: snapshot,
    routeHealthLedger,
    staleAfterMinutes: 15,
  });

  const deliveryReceiptLedger = await buildPass2377DeliveryReceiptLedger({
    message: result?.record ?? null,
    finalDeliveryGate,
    limit: 4,
  });
  const receiptRouteHealth = deliveryReceiptLedger.latestReceipt ? buildPass2379ReceiptRouteHealth({
    locale,
    receiptId: deliveryReceiptLedger.latestReceipt.receiptId,
    receiptStatus: deliveryReceiptLedger.latestReceipt.status,
    accountMessageId: deliveryReceiptLedger.latestReceipt.accountMessageId ?? result?.record?.id,
    accountId: deliveryReceiptLedger.latestReceipt.accountId ?? result?.record?.accountId,
    accountRoute: deliveryReceiptLedger.latestReceipt.customerSafeLinks.accountRoute,
    deliveryReceiptRoute: `/${locale}/security/audits/delivery-receipt/${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}`,
    redactedPacketRoute: `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}&locale=${locale}&format=redacted-packet`,
    downloadablePacketRoute: `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}&locale=${locale}&format=download`,
    routeHealthEndpoint: snapshot.routeHealthEndpoint,
  }) : undefined;

  const supportHandoffEventLedger = deliveryReceiptLedger.latestReceipt ? await buildPass2381SupportHandoffEventLedger({
    packet: await buildPass2380CustomerSupportHandoffPacket({
      locale,
      receiptId: deliveryReceiptLedger.latestReceipt.receiptId,
      accountId: account.accountId,
    }),
    recordEvent: false,
    limit: 8,
  }) : undefined;

  const supportHandoffPacket = deliveryReceiptLedger.latestReceipt ? {
    passId: PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID,
    status: receiptRouteHealth?.freshnessBadge === "fresh" ? "ready" : "watch",
    supportHandoffRoute: `/${locale}/security/audits/support-handoff/${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}`,
    downloadableSupportHandoffRoute: `/api/security/audit-watch/support-handoff?receiptId=${encodeURIComponent(deliveryReceiptLedger.latestReceipt.receiptId)}&locale=${locale}&format=download`,
    boundary: "redacted support handoff only; raw payment payloads remain blocked",
  } : undefined;

  const customerSnapshot = {
    ...snapshot,
    focus: {
      id: snapshot.focus.id,
      accountMessageId: snapshot.focus.accountMessageId,
    },
    checks: snapshot.checks.map((check) => check.key === "admin_replay_board"
      ? { ...check, href: undefined, summary: "Operator replay controls stay private and are never exposed by the customer route-health API." }
      : check),
  };

  return NextResponse.json({ ...customerSnapshot, routeHealthLedger, finalDeliveryGate, deliveryReceiptLedger, receiptRouteHealth, supportHandoffPacket, supportHandoffEventLedger }, {
    headers: {
      ...privateHeaders(),
      "cache-control": "no-store",
      "x-velmere-pass2374-route-health": PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID,
      "x-velmere-route-health-ledger": PASS2375_ROUTE_HEALTH_LEDGER_ID,
      "x-velmere-final-delivery-gate": PASS2376_FINAL_DELIVERY_GATE_ID,
      "x-velmere-delivery-receipt-ledger": PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
      "x-velmere-receipt-route-health": PASS2379_RECEIPT_ROUTE_HEALTH_ID,
      "x-velmere-pass2380-support-handoff-packet": PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID,
      "x-velmere-support-handoff-event-ledger": PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID,
      "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      "x-velmere-pass32-account-owner-bound": "true",
      "x-velmere-pass32-get-side-effects": "none",
    },
  });
}
