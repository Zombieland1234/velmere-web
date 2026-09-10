import { NextResponse } from "next/server";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import { timingSafeEqual } from "node:crypto";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { buildPass2380CustomerSupportHandoffPacket, PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID } from "@/lib/security/customer-support-handoff-packet";
import { buildPass2381SupportHandoffEventLedger, PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID } from "@/lib/security/support-handoff-event-ledger";

function cleanParam(value: string | null, fallback = "") {
  const cleaned = String(value ?? fallback)
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|sk_test|pk_test|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
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

function exactChecksum(left: string, right: string | undefined) {
  if (!right) return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const limited = await applyApiRateLimit(request, {
    keyPrefix: "pass32-account-support-handoff",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const account = await resolveRequestAccount(request);
  if (!account || (isProductionLike() && account.sessionSource === "preview")) {
    return securityJson({ ok: false, error: "account_session_required" }, { status: 401, headers: privateHeaders() });
  }

  const url = new URL(request.url);
  const receiptId = cleanParam(url.searchParams.get("receiptId") ?? url.searchParams.get("id"), "missing");
  const locale = cleanParam(url.searchParams.get("locale"), "en");
  const format = cleanParam(url.searchParams.get("format"), "redacted-packet");
  const gate = cleanParam(url.searchParams.get("gate"), "pass2380-redacted-support-handoff");
  const mode = cleanParam(url.searchParams.get("mode"), "account");
  const receiptHash = cleanParam(url.searchParams.get("receiptHash"), "missing-receipt-hash");
  const shouldDownload = format === "download" || url.searchParams.get("download") === "1";
  const forbiddenRawOrPrivateRoute = format === "raw" || mode === "private" || gate.includes("operator") || gate.includes("raw") || gate.includes("private");
  const pass2659Gate = gate === "pass2659-public-route-download-receipt";
  const pass2660Gate = gate === "pass2660-public-route-download-final-receipt";
  const pass2661Gate = gate === "pass2661-account-timeline-revocation-regression";
  const pass2662Gate = gate === "pass2662-deployed-revocation-state-smoke";
  const packet = await buildPass2380CustomerSupportHandoffPacket({ receiptId, locale, accountId: account.accountId });
  if (!packet.receiptId || packet.project.accountId !== account.accountId) {
    return securityJson({ ok: false, error: "support_handoff_not_found_or_not_owned" }, { status: 404, headers: privateHeaders() });
  }
  // Access state is derived from the server-owned receipt. Query parameters
  // can no longer promote a pending/revoked packet to verified.
  const accessState = packet.ok && packet.status === "ready" ? "verified" : "pending";
  // PASS2661 denied-state marker: support_packet_download_locked_chargeback.
  const pass2661DownloadLocked = pass2661Gate && shouldDownload && accessState !== "verified";
  const pass2662DownloadLocked = pass2662Gate && shouldDownload && accessState !== "verified";
  const receiptHashReady = exactChecksum(receiptHash, packet.receiptChecksum);

  if (forbiddenRawOrPrivateRoute) {
    return NextResponse.json({
      ok: false,
      status: "blocked",
      reason: "raw_private_support_packet_route_denied",
      customerSafeBoundary: "public support handoff route only exposes redacted packet fields",
      nextSafeAction: "Use the customer-safe guarded support packet route with receiptId, receiptHash and gate=pass2659-public-route-download-receipt or gate=pass2660-public-route-download-final-receipt.",
    }, {
      status: 403,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2659-raw-private-support-packet-route-denied": "true",
        "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      },
    });
  }

  if ((pass2659Gate || pass2660Gate || pass2661Gate || pass2662Gate) && !receiptHashReady) {
    return NextResponse.json({
      ok: false,
      status: "locked",
      reason: "missing_customer_safe_receipt_hash",
      customerSafeBoundary: "public support handoff download requires receipt hash binding",
      nextSafeAction: "Provide a customer-safe receiptHash from PASS2658/PASS2659/PASS2660 before downloading the support packet.",
    }, {
      status: 423,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2659-public-route-download-receipt-required": "true",
        "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      },
    });
  }

  if (pass2661DownloadLocked) {
    return NextResponse.json({
      ok: false,
      status: "locked",
      reason: `support_packet_download_locked_${accessState}`,
      customerSafeBoundary: "PASS2661 account timeline locks support packet download unless accessState=verified",
      customerAccessState: accessState,
      nextSafeAction: accessState === "pending"
        ? "Wait for the final receipt and account timeline verification before downloading the support packet."
        : "Resolve the refund, chargeback or revoked entitlement state with support before downloading the support packet.",
    }, {
      status: 423,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2661-account-timeline-revocation-state": accessState,
        "x-velmere-pass2661-support-download-locked": "true",
        "x-velmere-pass2661-support-download-lock-reason": `support_packet_download_locked_${accessState}`,
        "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      },
    });
  }

  if (pass2662DownloadLocked) {
    return NextResponse.json({
      ok: false,
      status: "locked",
      reason: `support_packet_download_locked_${accessState}`,
      customerSafeBoundary: "PASS2662 deployed revocation-state smoke locks support packet download unless accessState=verified",
      customerAccessState: accessState,
      nextSafeAction: accessState === "pending"
        ? "Wait for deployed PASS2662 timeline packet proof before downloading the support packet."
        : "Resolve the refund, chargeback or revoked entitlement state with support before downloading the support packet.",
    }, {
      status: 423,
      headers: {
        "cache-control": "no-store",
        "x-velmere-pass2662-deployed-revocation-state-smoke": "true",
        "x-velmere-pass2662-account-timeline-access-state": accessState,
        "x-velmere-pass2662-support-download-locked": "true",
        "x-velmere-pass2662-support-download-lock-reason": `support_packet_download_locked_${accessState}`,
        "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      },
    });
  }

  const supportHandoffEventLedger = await buildPass2381SupportHandoffEventLedger({
    packet,
    eventType: shouldDownload ? "support_packet_download" : "support_api_packet_view",
    recordEvent: false,
    limit: 12,
  });
  const download = shouldDownload
    ? buildSafeDownloadDisposition({
        disposition: "attachment",
        filenameStem: `velmere-${packet.receiptId ?? receiptId}-support-handoff-redacted`,
        mediaKind: "json",
        fallbackStem: "velmere-support-handoff-redacted",
      })
    : null;

  return NextResponse.json({ ...packet, supportHandoffEventLedger }, {
    status: packet.ok || packet.status === "watch" ? 200 : 404,
    headers: {
      ...privateHeaders(),
      "x-velmere-pass2380-support-handoff-packet": PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID,
      "x-velmere-support-handoff-event-ledger": PASS2381_SUPPORT_HANDOFF_EVENT_LEDGER_ID,
      "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      "x-velmere-pass2659-public-route-download-receipt": pass2659Gate ? "required-and-present" : "not-requested",
      "x-velmere-pass2659-public-route-receipt-hash-bound": pass2659Gate && receiptHashReady ? "true" : "false",
      "x-velmere-pass2660-public-route-final-receipt": pass2660Gate ? "required-and-present" : "not-requested",
      "x-velmere-pass2660-public-route-final-receipt-hash-bound": pass2660Gate && receiptHashReady ? "true" : "false",
      "x-velmere-pass2661-account-timeline-revocation-state": pass2661Gate ? accessState : "not-requested",
      "x-velmere-pass2661-support-download-locked": pass2661Gate && shouldDownload && accessState !== "verified" ? "true" : "false",
      "x-velmere-pass2661-support-download-lock-reason": pass2661Gate && shouldDownload && accessState !== "verified" ? `support_packet_download_locked_${accessState}` : "none",
      "x-velmere-pass2662-deployed-revocation-state-smoke": pass2662Gate ? "true" : "not-requested",
      "x-velmere-pass2662-account-timeline-access-state": pass2662Gate ? accessState : "not-requested",
      "x-velmere-pass2662-support-download-locked": pass2662Gate && shouldDownload && accessState !== "verified" ? "true" : "false",
      "x-velmere-pass2662-support-download-lock-reason": pass2662Gate && shouldDownload && accessState !== "verified" ? `support_packet_download_locked_${accessState}` : "none",
      "x-velmere-pass2659-raw-private-support-packet-route-denied": "true",
      "x-velmere-pass32-account-owner-bound": "true",
      "x-velmere-pass32-server-access-state": accessState,
      "x-velmere-pass32-get-side-effects": "none",
      ...(download ? { "content-disposition": download.contentDisposition } : {}),
    },
  });
}
