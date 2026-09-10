import { JSON_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildCustomerSafeMinimalPdf,
  planCustomerSafePdf,
  type CustomerSafePdfRenderPlan,
} from "@/lib/security/pro-audit-pdf/customer-safe-renderer";

export const PASS4820_CUSTOMER_SAFE_AUDIT_LAYOUT_ID = "pass4820-customer-safe-audit-layout-v1" as const;
export const PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID = "pass4820-customer-safe-audit-pdf-v1" as const;

export type CustomerSafeAuditLayoutInput = {
  reportId: string;
  requestId: string;
  locale: "pl" | "en" | "de";
  title: string;
  summary: string;
  status: string;
  projectName: string;
  reviewLevel: string;
  sections: string[];
  nextSteps: string[];
  forbidden: string[];
  customerBoundary: string;
  refreshedAt: string;
};

export type CustomerSafeAuditLayoutSection = {
  id: string;
  title: string;
  lines: string[];
};

export type CustomerSafeAuditLayoutModel = {
  schemaVersion: typeof PASS4820_CUSTOMER_SAFE_AUDIT_LAYOUT_ID;
  reportId: string;
  requestId: string;
  locale: CustomerSafeAuditLayoutInput["locale"];
  title: string;
  status: string;
  customerSections: string[];
  nextSteps: string[];
  forbidden: string[];
  sections: CustomerSafeAuditLayoutSection[];
  normalizedTextDigest: string;
  layoutDigest: string;
};

const UNSAFE = /\b(seed phrase|private key|api key|raw webhook|card number|cvv|exploit instructions?|guaranteed secure|certified safe)\b/i;

function clean(value: unknown, max = 1_200) {
  const text = typeof value === "string"
    ? value.replace(JSON_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim()
    : "";
  if (!text) return "";
  return (UNSAFE.test(text) ? "[customer-safe redaction]" : text).slice(0, max);
}

function uniqueLines(values: string[], maxItems: number, maxLength = 900) {
  return Array.from(new Set(values.map((item) => clean(item, maxLength)).filter(Boolean))).slice(0, maxItems);
}

function copy(locale: CustomerSafeAuditLayoutInput["locale"]) {
  if (locale === "pl") return {
    summary: "Podsumowanie customer-safe",
    status: "Status i zakres",
    sections: "Sekcje raportu",
    next: "Następne kroki",
    boundary: "Granice i zabronione claimy",
    footer: "Velmère Audit | Raport customer-safe | Bez gwarancji bezpieczeństwa i bez instrukcji exploita",
  };
  if (locale === "de") return {
    summary: "Customer-safe Zusammenfassung",
    status: "Status und Scope",
    sections: "Berichtssektionen",
    next: "Nächste Schritte",
    boundary: "Grenzen und verbotene Claims",
    footer: "Velmère Audit | Customer-safe Bericht | Keine Sicherheitsgarantie und keine Exploit-Anleitung",
  };
  return {
    summary: "Customer-safe summary",
    status: "Status and scope",
    sections: "Report sections",
    next: "Next steps",
    boundary: "Boundary and forbidden claims",
    footer: "Velmère Audit | Customer-safe report | No safety guarantee and no exploit instructions",
  };
}

export function buildCustomerSafeAuditLayoutModel(input: CustomerSafeAuditLayoutInput): CustomerSafeAuditLayoutModel {
  const labels = copy(input.locale);
  const customerSections = uniqueLines(input.sections, 12);
  const nextSteps = uniqueLines(input.nextSteps, 12);
  const forbidden = uniqueLines(input.forbidden, 12, 240);
  const sections: CustomerSafeAuditLayoutSection[] = [
    {
      id: "summary",
      title: labels.summary,
      lines: [clean(input.title, 180), clean(input.summary), `Report ID: ${clean(input.reportId, 160)}`, `Request ID: ${clean(input.requestId, 160)}`],
    },
    {
      id: "status",
      title: labels.status,
      lines: [`Status: ${clean(input.status, 80)}`, `Project: ${clean(input.projectName, 180)}`, `Review level: ${clean(input.reviewLevel, 100)}`, `Updated: ${clean(input.refreshedAt, 80)}`],
    },
    {
      id: "customer-sections",
      title: labels.sections,
      lines: customerSections.map((item, index) => `${index + 1}. ${item}`),
    },
    {
      id: "next-steps",
      title: labels.next,
      lines: nextSteps.map((item, index) => `${index + 1}. ${item}`),
    },
    {
      id: "boundary",
      title: labels.boundary,
      lines: [clean(input.customerBoundary), ...forbidden.map((item) => `Blocked: ${item}`)],
    },
  ].filter((section) => section.lines.some(Boolean));
  const normalizedText = sections.flatMap((section) => [section.title, ...section.lines]);
  const unsigned = {
    schemaVersion: PASS4820_CUSTOMER_SAFE_AUDIT_LAYOUT_ID,
    reportId: clean(input.reportId, 160),
    requestId: clean(input.requestId, 160),
    locale: input.locale,
    title: clean(input.title, 180),
    status: clean(input.status, 80),
    customerSections,
    nextSteps,
    forbidden,
    sections,
    normalizedTextDigest: sha256Digest(canonicalJson(normalizedText)),
  } as const;
  return { ...unsigned, layoutDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function flattenCustomerSafeAuditLayout(model: CustomerSafeAuditLayoutModel) {
  return model.sections.flatMap((section) => [`${section.title}:`, ...section.lines, ""]);
}

function renderOptions(input: CustomerSafeAuditLayoutInput) {
  const labels = copy(input.locale);
  return {
    title: clean(input.title, 180) || "Velmère Audit",
    subtitle: clean(input.summary, 260),
    footer: labels.footer,
    maxLines: 520,
    documentId: clean(input.reportId, 160),
    generatedAt: input.refreshedAt,
    locale: input.locale,
    classification: "customer_safe" as const,
  };
}

export function buildCustomerSafeAuditPdfPlan(input: CustomerSafeAuditLayoutInput): {
  layout: CustomerSafeAuditLayoutModel;
  lines: string[];
  plan: CustomerSafePdfRenderPlan;
} {
  const layout = buildCustomerSafeAuditLayoutModel(input);
  const lines = flattenCustomerSafeAuditLayout(layout);
  const plan = planCustomerSafePdf(lines, renderOptions(input));
  return { layout, lines, plan };
}

export function renderCustomerSafeAuditPdf(input: CustomerSafeAuditLayoutInput) {
  const { layout, lines, plan } = buildCustomerSafeAuditPdfPlan(input);
  const bytes = new Uint8Array(buildCustomerSafeMinimalPdf(lines, renderOptions(input)));
  if (plan.unsupportedGlyphReplacements !== 0) throw new Error("customer_safe_audit_pdf_unsupported_glyphs_present");
  return {
    schemaVersion: PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID,
    bytes,
    pdfDigest: sha256BytesDigest(bytes),
    pdfByteLength: bytes.byteLength,
    layoutDigest: layout.layoutDigest,
    normalizedTextDigest: layout.normalizedTextDigest,
    renderPlanDigest: plan.planDigest,
    pageCount: plan.pages.length,
    renderedRowCount: plan.renderedRowCount,
    unsupportedGlyphReplacements: plan.unsupportedGlyphReplacements,
  };
}
