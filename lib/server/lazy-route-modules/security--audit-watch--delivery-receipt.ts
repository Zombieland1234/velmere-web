import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { buildPass2378DeliveryReceiptPacket, PASS2378_DELIVERY_RECEIPT_PACKET_ID } from "@/lib/security/delivery-receipt-packet";
import { buildPass2379ReceiptRouteHealthFromPacket, PASS2379_RECEIPT_ROUTE_HEALTH_ID } from "@/lib/security/receipt-route-health";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";

function cleanText(value: string | null, max = 180) {
  const trimmed = String(value ?? "").replace(/[<>`$\\]/g, " ").trim();
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
    keyPrefix: "pass32-account-delivery-receipt",
    limit: 45,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const account = await resolveRequestAccount(request);
  if (!account || (isProductionLike() && account.sessionSource === "preview")) {
    return securityJson({ ok: false, error: "account_session_required" }, { status: 401, headers: privateHeaders() });
  }

  const url = new URL(request.url);
  const receiptId = cleanText(url.searchParams.get("receiptId") ?? url.searchParams.get("id")) ?? "missing";
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const packet = await buildPass2378DeliveryReceiptPacket({ receiptId, locale, accountId: account.accountId });
  if (!packet.receipt || packet.project.accountId !== account.accountId) {
    return securityJson({ ok: false, error: "delivery_receipt_not_found_or_not_owned" }, { status: 404, headers: privateHeaders() });
  }
  const receiptRouteHealth = buildPass2379ReceiptRouteHealthFromPacket(packet);
  const { operatorId: _operatorId, ...customerReceipt } = packet.receipt;
  const { focusKey: _focusKey, ...customerGateSnapshot } = packet.gateSnapshot ?? {
    canDeliver: false,
    endpointPingFresh: false,
    routeHealthAllowed: false,
    zeroBlockedWarnings: false,
    zeroStaleWarnings: false,
    blockedWarningCount: 0,
    staleWarningCount: 0,
  };
  const responsePacket = {
    ...packet,
    receipt: customerReceipt,
    project: {
      name: packet.project.name,
      accountMessageId: packet.project.accountMessageId,
      reportId: packet.project.reportId,
    },
    gateSnapshot: customerGateSnapshot,
    receiptRouteHealth,
  };
  const shouldDownload = url.searchParams.get("download") === "1" || url.searchParams.get("format") === "download";
  const download = shouldDownload
    ? buildSafeDownloadDisposition({
        disposition: "attachment",
        filenameStem: `velmere-${receiptId}-redacted-receipt`,
        mediaKind: "json",
        fallbackStem: "velmere-delivery-receipt",
      })
    : null;
  return NextResponse.json(responsePacket, {
    headers: {
      ...privateHeaders(),
      "x-velmere-delivery-receipt-packet": PASS2378_DELIVERY_RECEIPT_PACKET_ID,
      "x-velmere-receipt-route-health": PASS2379_RECEIPT_ROUTE_HEALTH_ID,
      "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      "x-velmere-pass32-account-owner-bound": "true",
      "x-velmere-pass32-private-identifiers-redacted": "true",
      "x-velmere-pass32-get-side-effects": "none",
      ...(download ? { "content-disposition": download.contentDisposition } : {}),
    },
  });
}
