import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

export const PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA = "velmere.audit-customer-safe-report.v2" as const;

export type Pass4820MigratedAuditCustomerSafeReport = {
  schemaVersion: typeof PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA;
  migratedFrom: "legacy-pass2361" | "pass4820-native";
  reportId: string;
  requestId: string;
  title: string;
  summary: string;
  status: "draft" | "ready" | "delivered";
  pdfRoute?: string;
  publicReportRoute?: string;
  sections: string[];
  forbidden: string[];
  deliveredAt?: string;
  operatorNote?: string;
};

function clean(value: unknown, max = 1_200) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function cleanRoute(value: unknown) {
  const route = clean(value, 320);
  if (!route || route.startsWith("javascript:") || route.startsWith("data:")) return undefined;
  return route;
}

function list(value: unknown, max: number, maxLength = 900) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))).slice(0, max);
}

export function migratePass4820AuditCustomerSafeReport(value: unknown, defaults: {
  reportId: string;
  requestId: string;
  title: string;
  summary: string;
}): Pass4820MigratedAuditCustomerSafeReport | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const native = raw.schemaVersion === PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA;
  const status = raw.status === "delivered" ? "delivered" : raw.status === "ready" ? "ready" : "draft";
  return {
    schemaVersion: PASS4820_AUDIT_CUSTOMER_SAFE_REPORT_SCHEMA,
    migratedFrom: native ? "pass4820-native" : "legacy-pass2361",
    reportId: clean(raw.reportId, 160) || defaults.reportId,
    requestId: clean(raw.requestId, 160) || defaults.requestId,
    title: clean(raw.title, 180) || defaults.title,
    summary: clean(raw.summary) || defaults.summary,
    status,
    pdfRoute: cleanRoute(raw.pdfRoute),
    publicReportRoute: cleanRoute(raw.publicReportRoute),
    sections: list(raw.sections, 12),
    forbidden: list(raw.forbidden, 12, 240),
    deliveredAt: clean(raw.deliveredAt, 80) || undefined,
    operatorNote: clean(raw.operatorNote, 600) || undefined,
  };
}
