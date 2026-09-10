import { independentLiveProviderFamilies } from "@/lib/ai/evidence-normalization";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { buildCanonicalCustomerArtifact } from "@/lib/reporting/canonical-customer-artifact";
import { inspectPass4649PdfBinary } from "@/lib/market-integrity/commercial-staging-proof";
import type { LensReport, LensReportDepth } from "@/lib/search/lens-report";
import { PASS4823_LENS_PDF_RENDERER_ID } from "@/lib/search/lens-pdf-renderer-identity";

export const PASS4822_LENS_CANONICAL_ARTIFACT_ID = "pass4822-lens-canonical-customer-artifact-v1" as const;

export function buildPass4822LensCanonicalCustomerArtifact(args: {
  report: LensReport;
  depth: LensReportDepth;
  pdf: Uint8Array;
  reportId: string;
}) {
  const inspection = inspectPass4649PdfBinary(Buffer.from(args.pdf));
  if (!inspection.valid || inspection.pageCount <= 0) throw new Error("lens_canonical_artifact_pdf_invalid");
  const payloadDigest = sha256Digest(canonicalJson(args.report));
  const layoutDigest = sha256Digest(canonicalJson({
    schemaVersion: PASS4822_LENS_CANONICAL_ARTIFACT_ID,
    reportChecksum: args.report.brain.checksum,
    depth: args.depth,
    sectionOrder: args.report.sections.map((section) => section.id),
    sections: args.report.sections,
    parityManifest: args.report.pass583.manifestKey,
    readerDownloadManifest: args.report.pass610.manifestKey,
  }));
  const renderPlanDigest = sha256Digest(canonicalJson({
    schemaVersion: PASS4822_LENS_CANONICAL_ARTIFACT_ID,
    depth: args.depth,
    pageCount: inspection.pageCount,
    expectedPageCount: args.report.pass610.pageCount,
    sourceCount: independentLiveProviderFamilies(args.report.sources).length,
    claimCount: args.report.pass623.atoms.length,
    reportChecksum: args.report.brain.checksum,
  }));
  const renderedRowCount = Math.max(1,
    args.report.sections.length
    + args.report.sources.length
    + args.report.pass623.atoms.length
    + args.report.pass626.tasks.length,
  );
  return buildCanonicalCustomerArtifact({
    surface: "lens",
    rendererId: PASS4823_LENS_PDF_RENDERER_ID,
    reportId: args.reportId,
    requestedTier: args.depth,
    deliveredTier: args.depth,
    payloadDigest,
    layoutDigest,
    renderPlanDigest,
    pdfDigest: sha256BytesDigest(args.pdf),
    pdfByteLength: args.pdf.byteLength,
    pageCount: inspection.pageCount,
    renderedRowCount,
  });
}
