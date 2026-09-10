import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import {
  buildProAuditPdfRenderPlan,
  validateProAuditPdfSnapshot,
  type ProAuditPdfSnapshot,
} from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";

export const PASS4808_AUDIT_CANONICAL_PREVIEW_ID = "pass4808-audit-canonical-preview-v1" as const;

export type AuditCanonicalPreview = {
  schemaVersion: typeof PASS4808_AUDIT_CANONICAL_PREVIEW_ID;
  snapshotDigest: string;
  modelVersion: ProAuditPdfSnapshot["modelVersion"];
  locale: ProAuditPdfSnapshot["locale"];
  tier: ProAuditPdfSnapshot["tier"];
  layout: ProAuditPdfSnapshot["layout"];
  renderContract: NonNullable<ProAuditPdfSnapshot["renderContract"]> | null;
  parityMode: "exact_render_bound" | "legacy_layout_only";
  expectedPdf: {
    digest: string | null;
    byteLength: number | null;
  };
  pagination: {
    pageCount: number;
    renderedRowCount: number;
    planDigest: string;
    pages: Array<{
      pageNumber: number;
      usedHeight: number;
      firstSourceLine: number;
      lastSourceLine: number;
      rows: Array<{ text: string; sourceLine: number; wrapIndex: number; heading: boolean; blank: boolean }>;
    }>;
  } | null;
  previewDigest: string;
};

export function buildAuditCanonicalPreview(value: ProAuditPdfSnapshot): AuditCanonicalPreview {
  const snapshot = validateProAuditPdfSnapshot(value);
  const renderPlan = snapshot.renderContract ? buildProAuditPdfRenderPlan(snapshot) : null;
  const unsigned = {
    schemaVersion: PASS4808_AUDIT_CANONICAL_PREVIEW_ID,
    snapshotDigest: snapshot.digest,
    modelVersion: snapshot.modelVersion,
    locale: snapshot.locale,
    tier: snapshot.tier,
    layout: snapshot.layout,
    renderContract: snapshot.renderContract ?? null,
    parityMode: renderPlan ? "exact_render_bound" as const : "legacy_layout_only" as const,
    expectedPdf: {
      digest: snapshot.renderContract?.pdfDigest ?? null,
      byteLength: snapshot.renderContract?.pdfByteLength ?? null,
    },
    pagination: renderPlan ? {
      pageCount: renderPlan.pages.length,
      renderedRowCount: renderPlan.renderedRowCount,
      planDigest: renderPlan.planDigest,
      pages: renderPlan.pages.map((page) => ({
        pageNumber: page.pageNumber,
        usedHeight: page.usedHeight,
        firstSourceLine: page.rows[0]?.sourceLine ?? 0,
        lastSourceLine: page.rows.at(-1)?.sourceLine ?? 0,
        rows: page.rows.map((row) => ({
          text: row.text,
          sourceLine: row.sourceLine,
          wrapIndex: row.wrapIndex,
          heading: row.heading,
          blank: row.blank,
        })),
      })),
    } : null,
  };
  return { ...unsigned, previewDigest: sha256Digest(canonicalJson(unsigned)) };
}
