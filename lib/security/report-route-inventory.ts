export const PASS4820_REPORT_ROUTE_INVENTORY_ID = "pass4820-report-route-inventory-v1" as const;

export type ReportRouteStatus = "canonical" | "adapter" | "deprecated" | "internal";
export type ReportRouteEntry = {
  id: string;
  route: string;
  surface: "audit" | "shield" | "real_markets" | "lens";
  artifact: "analysis_json" | "preview_json" | "customer_safe_pdf" | "paid_pdf" | "status_json" | "token";
  status: ReportRouteStatus;
  successor?: string;
  customerExposure: "public" | "account" | "operator";
  notes: string;
};

export const REPORT_ROUTE_INVENTORY: readonly ReportRouteEntry[] = Object.freeze([
  {
    id: "audit-canonical-assembler",
    route: "/api/security/audit-report-assembler",
    surface: "audit",
    artifact: "analysis_json",
    status: "canonical",
    customerExposure: "account",
    notes: "Canonical evidence-bound Audit Basic/Pro/Advanced analysis and customer projection.",
  },
  {
    id: "audit-customer-safe-report",
    route: "/api/security/audit-watch/customer-safe-report",
    surface: "audit",
    artifact: "customer_safe_pdf",
    status: "canonical",
    customerExposure: "account",
    notes: "Account-bound sanitized status JSON and customer-safe PDF generated from the exact immutable account snapshot.",
  },
  {
    id: "audit-paid-pdf-token",
    route: "/api/security/audit-watch/pro-pdf/token",
    surface: "audit",
    artifact: "token",
    status: "canonical",
    customerExposure: "account",
    notes: "Issues the one-time account-bound token for immutable paid Audit PDF delivery.",
  },
  {
    id: "audit-paid-pdf",
    route: "/api/security/audit-watch/pro-pdf",
    surface: "audit",
    artifact: "paid_pdf",
    status: "canonical",
    customerExposure: "account",
    notes: "Downloads the immutable Pro/Advanced snapshot after evidence and release gates.",
  },
  {
    id: "market-canonical-report",
    route: "/api/market-integrity/report",
    surface: "shield",
    artifact: "preview_json",
    status: "canonical",
    customerExposure: "account",
    notes: "Canonical Shield customer report payload and shared preview layout.",
  },
  {
    id: "market-canonical-pdf",
    route: "/api/market-integrity/report-pdf",
    surface: "shield",
    artifact: "paid_pdf",
    status: "canonical",
    customerExposure: "account",
    notes: "Canonical Shield and Real Markets shared-layout PDF endpoint.",
  },
  {
    id: "audit-watch-status-legacy",
    route: "/api/security/audit-watch/report",
    surface: "audit",
    artifact: "status_json",
    status: "deprecated",
    successor: "/api/security/audit-report-assembler",
    customerExposure: "public",
    notes: "Retired with HTTP 410. The static queue/status payload was not evidence-bound and is no longer returned.",
  },
  {
    id: "lens-report",
    route: "/api/search/lens-report",
    surface: "lens",
    artifact: "paid_pdf",
    status: "canonical",
    customerExposure: "account",
    notes: "Canonical Lens request, preview and PDF route; separate report family from Audit/Shield.",
  },
]);

export function validateReportRouteInventory(entries: readonly ReportRouteEntry[] = REPORT_ROUTE_INVENTORY) {
  const errors: string[] = [];
  const routes = new Set<string>();
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) errors.push(`duplicate_or_missing_id:${entry.id || "missing"}`);
    ids.add(entry.id);
    if (!entry.route.startsWith("/api/")) errors.push(`route_not_api:${entry.id}`);
    if (routes.has(entry.route)) errors.push(`duplicate_route:${entry.route}`);
    routes.add(entry.route);
    if (entry.status === "deprecated" && (!entry.successor || entry.successor === entry.route)) errors.push(`deprecated_successor_invalid:${entry.id}`);
    if (entry.status !== "deprecated" && entry.successor) errors.push(`successor_on_non_deprecated:${entry.id}`);
  }
  return {
    schemaVersion: PASS4820_REPORT_ROUTE_INVENTORY_ID,
    valid: errors.length === 0,
    errors,
    canonicalRoutes: entries.filter((entry) => entry.status === "canonical").map((entry) => entry.route),
    deprecatedRoutes: entries.filter((entry) => entry.status === "deprecated").map((entry) => ({ route: entry.route, successor: entry.successor })),
  };
}

export function reportRouteHeaders(route: string): Record<string, string> {
  const entry = REPORT_ROUTE_INVENTORY.find((candidate) => candidate.route === route);
  if (!entry) return { "x-velmere-report-route-status": "unregistered" };
  const base: Record<string, string> = {
    "x-velmere-report-route-inventory": PASS4820_REPORT_ROUTE_INVENTORY_ID,
    "x-velmere-report-route-id": entry.id,
    "x-velmere-report-route-status": entry.status,
  };
  if (entry.status === "deprecated" && entry.successor) {
    base.deprecation = "true";
    base.sunset = "Wed, 30 Sep 2026 00:00:00 GMT";
    base.link = `<${entry.successor}>; rel="successor-version"`;
    base.warning = `299 Velmere "Deprecated report route; use ${entry.successor}"`;
  }
  return base;
}
