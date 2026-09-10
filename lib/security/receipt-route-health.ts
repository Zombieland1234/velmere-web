import type { Pass2378DeliveryReceiptPacket } from "@/lib/security/delivery-receipt-packet";

export const PASS2379_RECEIPT_ROUTE_HEALTH_ID = "receipt-route-health-account-badge-refresh" as const;

export type Pass2379ReceiptRouteHealthState = "fresh" | "ready" | "linked" | "missing" | "blocked" | "manual_review";

export type Pass2379ReceiptRouteHealthCheck = {
  key: "receipt_route" | "redacted_packet_api" | "download_packet" | "account_badge" | "route_health_endpoint" | "raw_payment_payload";
  label: string;
  state: Pass2379ReceiptRouteHealthState;
  href?: string;
  summary: string;
};

export type Pass2379ReceiptRouteHealthSnapshot = {
  ok: boolean;
  passId: typeof PASS2379_RECEIPT_ROUTE_HEALTH_ID;
  generatedAt: string;
  locale: "pl" | "en" | "de";
  receiptId?: string;
  status: "receipt_route_ready" | "receipt_route_watch" | "receipt_route_blocked";
  freshnessBadge: "fresh" | "watch" | "blocked";
  lastCheckedAt: string;
  refreshAfterSeconds: number;
  accountBadge: {
    label: string;
    tone: "ready" | "watch" | "blocked";
    summary: string;
  };
  counts: Record<Pass2379ReceiptRouteHealthState, number>;
  checks: Pass2379ReceiptRouteHealthCheck[];
  recommendedAction: string;
  safeBoundary: string;
};

const SAFE_LOCALES = new Set(["pl", "en", "de"]);
const BLOCKED_PREFIXES = ["javascript:", "data:", "file:", "blob:"];

function nowIso() {
  return new Date().toISOString();
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(value ?? "")) ? (String(value) as "pl" | "en" | "de") : "en";
}

function cleanToken(value: unknown, max = 220): string | undefined {
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

function cleanRoute(value: unknown): string | undefined {
  const route = cleanToken(value, 460);
  if (!route) return undefined;
  if (BLOCKED_PREFIXES.some((prefix) => route.toLowerCase().startsWith(prefix))) return undefined;
  return route;
}

function countStates(checks: Pass2379ReceiptRouteHealthCheck[]) {
  return checks.reduce<Record<Pass2379ReceiptRouteHealthState, number>>((acc, check) => {
    acc[check.state] = (acc[check.state] ?? 0) + 1;
    return acc;
  }, { fresh: 0, ready: 0, linked: 0, missing: 0, blocked: 0, manual_review: 0 });
}

function boundary() {
  return "PASS2379 receipt route health exposes only receipt-route freshness, redacted receipt id, safe route links, account badge state and blocked raw-payload status. It never exposes raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.";
}

export function buildPass2379ReceiptRouteHealth(input: {
  locale?: string | null;
  receiptId?: string | null;
  receiptStatus?: string | null;
  accountMessageId?: string | null;
  accountId?: string | null;
  accountRoute?: string | null;
  deliveryReceiptRoute?: string | null;
  redactedPacketRoute?: string | null;
  downloadablePacketRoute?: string | null;
  routeHealthEndpoint?: string | null;
  generatedAt?: string | null;
}): Pass2379ReceiptRouteHealthSnapshot {
  const locale = normalizeLocale(input.locale);
  const generatedAt = cleanToken(input.generatedAt, 90) ?? nowIso();
  const receiptId = cleanToken(input.receiptId, 160);
  const receiptStatus = cleanToken(input.receiptStatus, 90);
  const accountMessageId = cleanToken(input.accountMessageId, 160);
  const accountId = cleanToken(input.accountId, 160);
  const receiptRoute = cleanRoute(input.deliveryReceiptRoute) ?? (receiptId ? `/${locale}/security/audits/delivery-receipt/${encodeURIComponent(receiptId)}` : undefined);
  const redactedPacketRoute = cleanRoute(input.redactedPacketRoute) ?? (receiptId ? `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(receiptId)}&locale=${locale}&format=redacted-packet` : undefined);
  const downloadablePacketRoute = cleanRoute(input.downloadablePacketRoute) ?? (receiptId ? `/api/security/audit-watch/delivery-receipt?receiptId=${encodeURIComponent(receiptId)}&locale=${locale}&format=download` : undefined);
  const routeHealthEndpoint = cleanRoute(input.routeHealthEndpoint) ?? (accountMessageId ? `/api/security/audit-watch/route-health?id=${encodeURIComponent(accountMessageId)}&locale=${locale}` : undefined);
  const accountRoute = cleanRoute(input.accountRoute) ?? `/${locale}/account?tab=messages`;
  const readyReceipt = Boolean(receiptId && (receiptStatus === "delivered" || receiptStatus === "ready" || !receiptStatus));
  const manualReceipt = Boolean(receiptId && receiptStatus && receiptStatus !== "delivered" && receiptStatus !== "ready");

  const checks: Pass2379ReceiptRouteHealthCheck[] = [
    {
      key: "receipt_route",
      label: "Delivery receipt route",
      state: readyReceipt ? "fresh" : manualReceipt ? "manual_review" : "missing",
      href: receiptRoute,
      summary: readyReceipt
        ? "Customer delivery receipt route is available with redacted receipt id, checksum and gate snapshot."
        : manualReceipt
          ? "Receipt route exists, but the receipt is still an operator review artifact."
          : "No receipt id exists yet; create the delivery receipt after the final delivery gate passes.",
    },
    {
      key: "redacted_packet_api",
      label: "Redacted receipt packet API",
      state: redactedPacketRoute ? "ready" : "missing",
      href: redactedPacketRoute,
      summary: redactedPacketRoute
        ? "API packet can be fetched without raw payment payloads or secrets."
        : "Packet route is missing until an immutable receipt id exists.",
    },
    {
      key: "download_packet",
      label: "Downloadable packet",
      state: downloadablePacketRoute ? "ready" : "missing",
      href: downloadablePacketRoute,
      summary: downloadablePacketRoute
        ? "Downloadable JSON packet is available as a redacted support handoff artifact."
        : "Download route is missing until the receipt id exists.",
    },
    {
      key: "account_badge",
      label: "Account receipt badge",
      state: accountMessageId || accountId ? "linked" : "missing",
      href: accountRoute,
      summary: accountMessageId || accountId
        ? "Account card can refresh and show receipt freshness without exposing payment payloads."
        : "Receipt is not linked back to an account message yet.",
    },
    {
      key: "route_health_endpoint",
      label: "Route health endpoint",
      state: routeHealthEndpoint ? "linked" : "missing",
      href: routeHealthEndpoint,
      summary: routeHealthEndpoint
        ? "Route health endpoint is linked so support can confirm account/report/PDF freshness."
        : "Route health endpoint needs an account message id before support handoff.",
    },
    {
      key: "raw_payment_payload",
      label: "Raw payment payload",
      state: "blocked",
      summary: "Raw Stripe/webhook/BLIK/card payloads are intentionally blocked from receipt route health.",
    },
  ];
  const counts = countStates(checks);
  const blockedForCustomer = counts.missing > 0 || counts.manual_review > 0 || counts.blocked !== 1;
  const status = blockedForCustomer ? (counts.missing > 0 ? "receipt_route_blocked" : "receipt_route_watch") : "receipt_route_ready";
  const freshnessBadge = status === "receipt_route_ready" ? "fresh" : status === "receipt_route_watch" ? "watch" : "blocked";
  return {
    ok: status === "receipt_route_ready",
    passId: PASS2379_RECEIPT_ROUTE_HEALTH_ID,
    generatedAt,
    locale,
    receiptId,
    status,
    freshnessBadge,
    lastCheckedAt: generatedAt,
    refreshAfterSeconds: 15,
    accountBadge: {
      label: freshnessBadge === "fresh" ? "receipt route fresh" : freshnessBadge === "watch" ? "receipt route watch" : "receipt route blocked",
      tone: freshnessBadge === "fresh" ? "ready" : freshnessBadge === "watch" ? "watch" : "blocked",
      summary: freshnessBadge === "fresh"
        ? "Account badge can show this receipt as fresh for support handoff."
        : freshnessBadge === "watch"
          ? "Receipt exists, but operator should confirm status before support handoff."
          : "Do not present this receipt as final until missing route links are resolved.",
    },
    counts,
    checks,
    recommendedAction: freshnessBadge === "fresh"
      ? "Account and drawer may show fresh delivery receipt route status before customer support handoff."
      : "Refresh route health, confirm account/report/PDF links and avoid customer support handoff until the badge is fresh.",
    safeBoundary: boundary(),
  };
}

export function buildPass2379ReceiptRouteHealthFromPacket(packet: Pass2378DeliveryReceiptPacket): Pass2379ReceiptRouteHealthSnapshot {
  return buildPass2379ReceiptRouteHealth({
    locale: packet.locale,
    receiptId: packet.receipt?.receiptId,
    receiptStatus: packet.receipt?.status,
    accountMessageId: packet.project.accountMessageId,
    accountId: packet.project.accountId,
    accountRoute: packet.links.accountRoute,
    deliveryReceiptRoute: packet.receipt?.receiptId ? `/${packet.locale}/security/audits/delivery-receipt/${encodeURIComponent(packet.receipt.receiptId)}` : undefined,
    redactedPacketRoute: packet.links.redactedReceiptPacketRoute,
    downloadablePacketRoute: packet.links.downloadableReceiptPacketRoute,
    routeHealthEndpoint: packet.project.accountMessageId ? `/api/security/audit-watch/route-health?id=${encodeURIComponent(packet.project.accountMessageId)}&locale=${packet.locale}` : undefined,
    generatedAt: packet.generatedAt,
  });
}
