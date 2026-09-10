import { sha256Token } from "@/lib/security/cryptographic-digest";
import { buildPass2378DeliveryReceiptPacket, type Pass2378DeliveryReceiptPacket } from "@/lib/security/delivery-receipt-packet";
import { buildPass2379ReceiptRouteHealthFromPacket, type Pass2379ReceiptRouteHealthCheck, type Pass2379ReceiptRouteHealthSnapshot } from "@/lib/security/receipt-route-health";

export const PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID = "pass2380-customer-support-handoff-redacted-packet" as const;

export type Pass2380SupportHandoffStatus = "ready" | "watch" | "blocked";

export type Pass2380SupportHandoffItem = {
  key: "customer_report" | "safe_pdf_packet" | "delivery_receipt" | "receipt_freshness" | "route_health_warnings" | "raw_payment_payload";
  label: string;
  state: "ready" | "linked" | "watch" | "blocked" | "missing";
  href?: string;
  summary: string;
};

export type Pass2380CustomerSupportHandoffPacket = {
  ok: boolean;
  passId: typeof PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID;
  generatedAt: string;
  locale: "pl" | "en" | "de";
  status: Pass2380SupportHandoffStatus;
  supportHandoffId: string;
  title: string;
  summary: string;
  receiptId?: string;
  receiptChecksum?: string;
  project: Pass2378DeliveryReceiptPacket["project"];
  links: {
    accountRoute: string;
    customerReportRoute?: string;
    safePdfPacketRoute?: string;
    deliveryReceiptRoute?: string;
    receiptPacketRoute?: string;
    downloadableReceiptPacketRoute?: string;
    supportHandoffRoute: string;
    downloadableSupportHandoffRoute: string;
  };
  items: Pass2380SupportHandoffItem[];
  receiptRouteHealth: Pass2379ReceiptRouteHealthSnapshot;
  routeHealthWarnings: Array<{
    key: string;
    state: string;
    label: string;
    summary: string;
  }>;
  supportChecklist: string[];
  forbidden: string[];
  customerBoundary: string;
  recommendedAction: string;
};

const SAFE_LOCALES = new Set(["pl", "en", "de"]);
const BLOCKED_PREFIXES = ["javascript:", "data:", "file:", "blob:"];

function nowIso() {
  return new Date().toISOString();
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(value ?? "")) ? (String(value) as "pl" | "en" | "de") : "en";
}

function stableHash(value: string) {
  return sha256Token(value, 24);
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
  const route = cleanToken(value, 500);
  if (!route) return undefined;
  if (BLOCKED_PREFIXES.some((prefix) => route.toLowerCase().startsWith(prefix))) return undefined;
  return route;
}

function forbiddenClaims() {
  return [
    "raw Stripe or webhook payloads",
    "BLIK codes or card data",
    "API secrets or bearer tokens",
    "seed phrase or wallet secrets",
    "exploit instructions",
    "Certified Safe claims",
    "investment advice",
  ];
}

function boundary() {
  return "PASS2380 customer support handoff packet exposes only redacted support-safe artifacts: customer report route, safe PDF packet route, immutable delivery receipt id/checksum, receipt route freshness and route-health warnings. It never returns raw payment payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.";
}

function buildSupportId(receiptId: string | undefined, generatedAt: string) {
  return `vlm_support_${stableHash(`${receiptId ?? "missing"}:${generatedAt}`).slice(0, 18)}`;
}

function warningFromCheck(check: Pass2379ReceiptRouteHealthCheck) {
  return {
    key: check.key,
    state: check.state,
    label: check.label,
    summary: check.summary,
  };
}

function isExpectedBlockedBoundary(check: Pass2379ReceiptRouteHealthCheck) {
  return check.key === "raw_payment_payload" && check.state === "blocked";
}

function buildWarnings(receiptRouteHealth: Pass2379ReceiptRouteHealthSnapshot) {
  return receiptRouteHealth.checks
    .filter((check) => !isExpectedBlockedBoundary(check))
    .filter((check) => ["missing", "blocked", "manual_review"].includes(check.state))
    .map(warningFromCheck);
}

function itemStateForHref(href: string | undefined) {
  return href ? "linked" as const : "missing" as const;
}

export async function buildPass2380CustomerSupportHandoffPacket(input: {
  receiptId?: string | null;
  locale?: string | null;
  accountId?: string | null;
}): Promise<Pass2380CustomerSupportHandoffPacket> {
  const locale = normalizeLocale(input.locale);
  const receiptPacket = await buildPass2378DeliveryReceiptPacket({ receiptId: input.receiptId, locale, accountId: input.accountId });
  const receiptRouteHealth = buildPass2379ReceiptRouteHealthFromPacket(receiptPacket);
  const generatedAt = nowIso();
  const receiptId = cleanToken(receiptPacket.receipt?.receiptId ?? input.receiptId, 160);
  const receiptChecksum = cleanToken(receiptPacket.receipt?.checksum, 120);
  const deliveryReceiptRoute = receiptId ? `/${receiptPacket.locale}/security/audits/delivery-receipt/${encodeURIComponent(receiptId)}` : undefined;
  const supportHandoffRoute = receiptId ? `/${receiptPacket.locale}/security/audits/support-handoff/${encodeURIComponent(receiptId)}` : `/${receiptPacket.locale}/security/audits/support-handoff/missing`;
  const downloadableSupportHandoffRoute = `/api/security/audit-watch/support-handoff?receiptId=${encodeURIComponent(receiptId ?? "missing")}&locale=${receiptPacket.locale}&format=download`;
  const customerReportRoute = cleanRoute(receiptPacket.links.customerReportRoute);
  const safePdfPacketRoute = cleanRoute(receiptPacket.links.safePdfPacketRoute);
  const receiptPacketRoute = cleanRoute(receiptPacket.links.redactedReceiptPacketRoute);
  const downloadableReceiptPacketRoute = cleanRoute(receiptPacket.links.downloadableReceiptPacketRoute);
  const routeHealthWarnings = buildWarnings(receiptRouteHealth);
  const status: Pass2380SupportHandoffStatus = !receiptPacket.ok || !receiptId
    ? "blocked"
    : routeHealthWarnings.length > 0 || receiptRouteHealth.freshnessBadge !== "fresh"
      ? "watch"
      : "ready";

  const items: Pass2380SupportHandoffItem[] = [
    {
      key: "customer_report",
      label: "Customer-safe report",
      state: itemStateForHref(customerReportRoute),
      href: customerReportRoute,
      summary: customerReportRoute
        ? "Customer report route is linked for support without raw payment data or exploit-level content."
        : "Customer report route is missing; support handoff should stay blocked until the report route exists.",
    },
    {
      key: "safe_pdf_packet",
      label: "Safe PDF packet",
      state: itemStateForHref(safePdfPacketRoute),
      href: safePdfPacketRoute,
      summary: safePdfPacketRoute
        ? "Safe PDF packet route is linked as a customer-safe artifact."
        : "Safe PDF packet route is missing; attach or regenerate the customer-safe packet.",
    },
    {
      key: "delivery_receipt",
      label: "Delivery receipt",
      state: receiptId && receiptPacket.status === "ready" ? "ready" : receiptId ? "watch" : "missing",
      href: deliveryReceiptRoute,
      summary: receiptId
        ? "Immutable delivery receipt id and checksum are present in redacted form."
        : "Delivery receipt id is missing; final support handoff cannot be completed.",
    },
    {
      key: "receipt_freshness",
      label: "Receipt freshness",
      state: receiptRouteHealth.freshnessBadge === "fresh" ? "ready" : receiptRouteHealth.freshnessBadge === "watch" ? "watch" : "blocked",
      href: deliveryReceiptRoute,
      summary: receiptRouteHealth.accountBadge.summary,
    },
    {
      key: "route_health_warnings",
      label: "Route-health warnings",
      state: routeHealthWarnings.length === 0 ? "ready" : "watch",
      summary: routeHealthWarnings.length === 0
        ? "No missing/manual route-health warnings besides the expected blocked raw-payment boundary."
        : `${routeHealthWarnings.length} route-health warning(s) should be resolved or acknowledged before support handoff.`,
    },
    {
      key: "raw_payment_payload",
      label: "Raw payment payload",
      state: "blocked",
      summary: "Raw Stripe/webhook/BLIK/card payloads remain blocked and are not part of the support packet.",
    },
  ];

  return {
    ok: status === "ready",
    passId: PASS2380_CUSTOMER_SUPPORT_HANDOFF_PACKET_ID,
    generatedAt,
    locale: receiptPacket.locale,
    status,
    supportHandoffId: buildSupportId(receiptId, generatedAt),
    title: status === "ready" ? "Customer support handoff packet" : status === "watch" ? "Support handoff needs review" : "Support handoff blocked",
    summary: status === "ready"
      ? "This redacted packet bundles the customer-safe report route, safe PDF packet, delivery receipt, receipt freshness and route-health state for support handoff."
      : status === "watch"
        ? "This packet can be reviewed by support, but the route-health warnings or freshness badge should be checked before handoff."
        : "This packet is missing delivery receipt or customer-safe route requirements and should not be used as final support handoff.",
    receiptId,
    receiptChecksum,
    project: receiptPacket.project,
    links: {
      accountRoute: receiptPacket.links.accountRoute,
      customerReportRoute,
      safePdfPacketRoute,
      deliveryReceiptRoute,
      receiptPacketRoute,
      downloadableReceiptPacketRoute,
      supportHandoffRoute,
      downloadableSupportHandoffRoute,
    },
    items,
    receiptRouteHealth,
    routeHealthWarnings,
    supportChecklist: [
      "Confirm the customer-safe report route opens without raw payment or exploit-level data.",
      "Confirm the safe PDF packet route is linked and redacted.",
      "Confirm delivery receipt id, checksum and deliveredAt are present.",
      "Confirm receipt freshness is fresh or explicitly reviewed before handoff.",
      "Do not paste raw Stripe, webhook, BLIK, card, secret, seed phrase or exploit data into support messages.",
    ],
    forbidden: forbiddenClaims(),
    customerBoundary: boundary(),
    recommendedAction: status === "ready"
      ? "Support may use this redacted packet as the customer handoff artifact."
      : status === "watch"
        ? "Refresh receipt route health and resolve or acknowledge warnings before customer support handoff."
        : "Reopen Audit Inbox, restore customer-safe report/PDF/receipt linkage and regenerate the packet after final delivery is ready.",
  };
}
