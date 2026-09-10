import type { buildCustomerReportPayload } from "@/lib/market-integrity/customer-report-payload";
import {
  buildCustomerReportLayoutModel,
  flattenCustomerReportLayoutModel,
} from "@/lib/market-integrity/customer-report-layout-model";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { assertPass4824PayloadFieldPacket } from "@/lib/reporting/canonical-field-registry";
import {
  buildCustomerSafeMinimalPdf,
  planCustomerSafePdf,
  type CustomerSafePdfRenderPlan,
} from "@/lib/security/pro-audit-pdf/customer-safe-renderer";

export const PASS4819_CUSTOMER_TIER_PDF_RENDERER_ID = "pass4819-customer-tier-pdf-shared-layout-v1" as const;
export const PASS4818_CUSTOMER_TIER_PDF_RENDERER_ID = PASS4819_CUSTOMER_TIER_PDF_RENDERER_ID;

export type CustomerReportPayload = ReturnType<typeof buildCustomerReportPayload>;

function documentCopy(locale: CustomerReportPayload["locale"]) {
  if (locale === "pl") return {
    subtitle: "Raport oparty na zweryfikowanych źródłach i jawnych granicach dowodowych",
    footer: "Velmère | Analiza dowodowa | Nie jest poradą inwestycyjną ani gwarancją bezpieczeństwa",
  };
  if (locale === "de") return {
    subtitle: "Bericht auf Basis verifizierter Quellen und sichtbarer Evidenzgrenzen",
    footer: "Velmère | Evidenzgebundene Analyse | Keine Anlageberatung oder Sicherheitsgarantie",
  };
  return {
    subtitle: "Report built from verified sources and explicit evidence boundaries",
    footer: "Velmère | Evidence-bound analysis | Not investment advice or a safety guarantee",
  };
}

function renderOptions(payload: CustomerReportPayload) {
  const copy = documentCopy(payload.locale);
  return {
    title: payload.commercialEnvelope.productName,
    subtitle: copy.subtitle,
    footer: copy.footer,
    maxLines: 720,
    documentId: payload.reportId,
    generatedAt: payload.generatedAt,
    locale: payload.locale,
    classification: payload.tier === "Basic" ? "customer_safe" as const : "customer_private" as const,
  };
}

export function buildCustomerTierPdfRenderPlan(payload: CustomerReportPayload): {
  payloadDigest: string;
  layoutModelDigest: string;
  lines: string[];
  plan: CustomerSafePdfRenderPlan;
} {
  if (payload.deliveryPolicy.visibleTier === null || payload.deliveryPolicy.status === "unavailable") {
    throw new Error("customer_tier_pdf_delivery_unavailable");
  }
  const fieldModule = payload.commercialEnvelope.surface === "security"
    ? "audit"
    : payload.commercialEnvelope.surface;
  assertPass4824PayloadFieldPacket(payload, {
    module: fieldModule,
    tier: payload.deliveryPolicy.visibleTier,
    requirePresent: true,
  });
  const payloadDigest = sha256Digest(canonicalJson(payload));
  const layoutModel = buildCustomerReportLayoutModel(payload);
  const lines = flattenCustomerReportLayoutModel(layoutModel);
  const plan = planCustomerSafePdf(lines, renderOptions(payload));
  return { payloadDigest, layoutModelDigest: layoutModel.layoutDigest, lines, plan };
}

export function renderCustomerTierPdf(payload: CustomerReportPayload): {
  schemaVersion: typeof PASS4819_CUSTOMER_TIER_PDF_RENDERER_ID;
  bytes: Uint8Array;
  pdfHash: string;
  payloadDigest: string;
  layoutModelDigest: string;
  renderPlanDigest: string;
  lineCount: number;
  pageCount: number;
  renderedRowCount: number;
  unsupportedGlyphReplacements: number;
} {
  const { payloadDigest, layoutModelDigest, lines, plan } = buildCustomerTierPdfRenderPlan(payload);
  const bytes = new Uint8Array(buildCustomerSafeMinimalPdf(lines, renderOptions(payload)));
  const pdfHash = sha256BytesDigest(bytes);
  if (plan.unsupportedGlyphReplacements !== 0) throw new Error("customer_tier_pdf_unsupported_glyphs_present");
  return {
    schemaVersion: PASS4819_CUSTOMER_TIER_PDF_RENDERER_ID,
    bytes,
    pdfHash,
    payloadDigest,
    layoutModelDigest,
    renderPlanDigest: plan.planDigest,
    lineCount: lines.length,
    pageCount: plan.pages.length,
    renderedRowCount: plan.renderedRowCount,
    unsupportedGlyphReplacements: plan.unsupportedGlyphReplacements,
  };
}
