import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import { buildPass2369CustomerSafeReportPayload } from "@/lib/security/customer-safe-report-route";

export const PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID = "pass2374-customer-safe-route-health-endpoint-ping" as const;

export type Pass2374RouteHealthState = "ready" | "linked" | "missing" | "admin_only" | "blocked";

export type Pass2374RouteHealthCheck = {
  key: "customer_report" | "safe_pdf_packet" | "admin_replay_board" | "account_message" | "raw_payment_payload";
  label: string;
  state: Pass2374RouteHealthState;
  href?: string;
  method: "GET" | "admin_get" | "blocked" | "internal";
  summary: string;
  lastCheckedAt: string;
};

export type Pass2374CustomerSafeRouteHealthSnapshot = {
  ok: true;
  passId: typeof PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID;
  locale: "pl" | "en" | "de";
  generatedAt: string;
  routeHealthEndpoint: string;
  focus: {
    id?: string;
    requestId?: string;
    auditQueueId?: string;
    accountMessageId?: string;
    accountId?: string;
  };
  counts: Record<Pass2374RouteHealthState, number>;
  checks: Pass2374RouteHealthCheck[];
  recommendedAction: string;
  safeBoundary: string;
};

const SAFE_LOCALES = new Set(["pl", "en", "de"]);
const FORBIDDEN_ROUTE_PREFIXES = ["javascript:", "data:", "file:", "blob:"];

function normalizeLocale(locale?: string | null): "pl" | "en" | "de" {
  return SAFE_LOCALES.has(String(locale || "")) ? (String(locale) as "pl" | "en" | "de") : "en";
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

function cleanRoute(value: unknown, fallback?: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const route = raw || fallback || "";
  const safe = route.replace(/[<>`$\\]/g, "").trim().slice(0, 360);
  if (!safe) return undefined;
  const lowered = safe.toLowerCase();
  if (FORBIDDEN_ROUTE_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return fallback;
  return safe;
}

function countStates(checks: Pass2374RouteHealthCheck[]) {
  return checks.reduce<Record<Pass2374RouteHealthState, number>>((counts, check) => {
    counts[check.state] = (counts[check.state] ?? 0) + 1;
    return counts;
  }, { ready: 0, linked: 0, missing: 0, admin_only: 0, blocked: 0 });
}

function focusId(input: {
  id?: string;
  requestId?: string;
  record?: AuditAccountMessageRecord | null;
}) {
  return cleanToken(input.id) ?? cleanToken(input.record?.id) ?? cleanToken(input.record?.requestId) ?? cleanToken(input.requestId) ?? "sample";
}

export function buildPass2374CustomerSafeRouteHealth(input: {
  locale?: string | null;
  id?: string;
  requestId?: string;
  record?: AuditAccountMessageRecord | null;
  adminReplayBoardRoute?: string;
}): Pass2374CustomerSafeRouteHealthSnapshot {
  const locale = normalizeLocale(input.locale);
  const id = focusId(input);
  const requestId = cleanToken(input.requestId) ?? cleanToken(input.record?.requestId);
  const reportPayload = input.record?.canonicalCustomerSnapshot
    ? buildPass2369CustomerSafeReportPayload({ id, locale, record: input.record })
    : null;
  const reportRoute = reportPayload ? cleanRoute(reportPayload.links.publicReportRoute) : undefined;
  const pdfRoute = reportPayload ? cleanRoute(reportPayload.links.pdfRoute) : undefined;
  const adminRoute = cleanRoute(input.adminReplayBoardRoute, `/${locale}/admin/security?accountMessageId=${encodeURIComponent(cleanToken(input.record?.id) ?? id)}#pass2367-live-payment-evidence-rows`);
  const accountMessageId = cleanToken(input.record?.id);
  const auditQueueId = cleanToken(input.record?.auditQueueId);
  const accountId = cleanToken(input.record?.accountId);
  const generatedAt = new Date().toISOString();
  const customerReportReady = Boolean(reportPayload && (reportPayload.status === "ready" || reportPayload.status === "delivered"));
  const pdfReady = Boolean(reportPayload?.pdfReady && pdfRoute);
  const checks: Pass2374RouteHealthCheck[] = [
    {
      key: "customer_report",
      label: "Customer report route",
      state: customerReportReady ? "ready" : "missing",
      href: customerReportReady ? reportRoute : undefined,
      method: "GET",
      summary: customerReportReady
        ? "Customer-safe report route is available with redacted status, scope and next steps."
        : input.record?.canonicalCustomerSnapshot
          ? "Immutable report snapshot exists, but operator readiness is still pending."
          : "No immutable customer-report snapshot exists; no customer route is exposed.",
      lastCheckedAt: generatedAt,
    },
    {
      key: "safe_pdf_packet",
      label: "Safe PDF packet route",
      state: pdfReady ? "ready" : "missing",
      href: pdfReady ? pdfRoute : undefined,
      method: "GET",
      summary: pdfReady
        ? "Safe PDF/export packet route is available without raw payment or exploit-level data."
        : input.record?.canonicalCustomerSnapshot
          ? "Immutable PDF bytes are bound to the snapshot, but mark-ready/delivery approval is still pending."
          : "No immutable PDF artifact exists; placeholder downloads are forbidden.",
      lastCheckedAt: generatedAt,
    },
    {
      key: "admin_replay_board",
      label: "Admin Replay Board",
      state: adminRoute ? "admin_only" : "missing",
      href: adminRoute,
      method: "admin_get",
      summary: adminRoute
        ? "Replay board route is linked for operators and remains admin-gated."
        : "Replay board link is missing; use evidence filters before release sign-off.",
      lastCheckedAt: generatedAt,
    },
    {
      key: "account_message",
      label: "Account message linkage",
      state: input.record ? "linked" : "missing",
      method: "internal",
      summary: input.record
        ? "Account message/request is linked to this route health snapshot."
        : "No account message record is loaded for this route health snapshot.",
      lastCheckedAt: generatedAt,
    },
    {
      key: "raw_payment_payload",
      label: "Raw payment payload",
      state: "blocked",
      method: "blocked",
      summary: "Raw Stripe/webhook/BLIK/card payloads are intentionally blocked from route health responses.",
      lastCheckedAt: generatedAt,
    },
  ];
  const counts = countStates(checks);
  const recommendedAction = counts.missing > 0
    ? "Complete missing customer-safe routes before final delivery."
    : "Routes are linked; verify copy and evidence stay redacted before customer handoff.";

  return {
    ok: true,
    passId: PASS2374_CUSTOMER_SAFE_ROUTE_HEALTH_ID,
    locale,
    generatedAt,
    routeHealthEndpoint: `/api/security/audit-watch/route-health?id=${encodeURIComponent(id)}&locale=${locale}`,
    focus: {
      id: cleanToken(id),
      requestId,
      auditQueueId,
      accountMessageId,
      accountId,
    },
    counts,
    checks,
    recommendedAction,
    safeBoundary:
      "PASS2374 route health exposes route availability, redacted ids and operator-safe summaries only. It never returns raw Stripe payloads, webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
  };
}
