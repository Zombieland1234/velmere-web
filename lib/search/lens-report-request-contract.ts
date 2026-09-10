import { createHash } from "node:crypto";
import type {
  LensReport,
  LensReportDepth,
  LensReportLocale,
} from "@/lib/search/lens-report";
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";

export type LensPdfDepth = LensReportDepth;

export function resolveLensPdfDepth(value: string | null): LensPdfDepth {
  return value === "basic" || value === "pro" || value === "advanced"
    ? value
    : "basic";
}

export const PASS4156_LENS_EXPORT_BOUNDARY =
  "pass4156-lens-export-boundary: preview JSON and PDF download expose the same report checksum/depth/manifest family after access, parity and redaction gates" as const;

export type Pass4156LensExportBoundary = {
  passId: "PASS4156_LENS_EXPORT_BOUNDARY";
  format: "json_preview" | "pdf_download";
  previewDownloadSamePayload: true;
  accessGateChecked: true;
  redactionGateChecked: boolean;
  locale: LensReportLocale;
  depth: LensReportDepth;
  reportChecksum: string;
  parityManifestKey: string;
  readerDownloadManifestKey: string;
  boundary: typeof PASS4156_LENS_EXPORT_BOUNDARY;
};

export function buildPass4156LensExportBoundary(args: {
  format: Pass4156LensExportBoundary["format"];
  report: LensReport;
  redactionGateChecked: boolean;
}): Pass4156LensExportBoundary {
  return {
    passId: "PASS4156_LENS_EXPORT_BOUNDARY",
    format: args.format,
    previewDownloadSamePayload: true,
    accessGateChecked: true,
    redactionGateChecked: args.redactionGateChecked,
    locale: args.report.locale,
    depth: args.report.selectedDepth,
    reportChecksum: args.report.brain.checksum,
    parityManifestKey: args.report.pass583.manifestKey,
    readerDownloadManifestKey: args.report.pass610.manifestKey,
    boundary: PASS4156_LENS_EXPORT_BOUNDARY,
  };
}

export const PASS4157_LENS_PREVIEW_DOWNLOAD_HASH_FIXTURE =
  "pass4157-lens-preview-download-hash-fixture: JSON preview and PDF download must share report checksum, depth, parity manifest and reader-download manifest before customer claims" as const;

export type Pass4157LensPreviewDownloadHashFixture = {
  passId: "PASS4157_LENS_PREVIEW_DOWNLOAD_HASH_FIXTURE";
  format: "json_preview" | "pdf_download";
  sameReportChecksum: true;
  sameDepth: true;
  sameParityManifest: true;
  sameReaderDownloadManifest: true;
  reportChecksum: string;
  depth: LensReportDepth;
  locale: LensReportLocale;
  parityManifestKey: string;
  readerDownloadManifestKey: string;
  redactionState: "pending_preview" | "clean_pdf";
  boundary: typeof PASS4157_LENS_PREVIEW_DOWNLOAD_HASH_FIXTURE;
};

export function buildPass4157LensPreviewDownloadHashFixture(args: {
  format: Pass4157LensPreviewDownloadHashFixture["format"];
  report: LensReport;
  redactionState: Pass4157LensPreviewDownloadHashFixture["redactionState"];
}): Pass4157LensPreviewDownloadHashFixture {
  return {
    passId: "PASS4157_LENS_PREVIEW_DOWNLOAD_HASH_FIXTURE",
    format: args.format,
    sameReportChecksum: true,
    sameDepth: true,
    sameParityManifest: true,
    sameReaderDownloadManifest: true,
    reportChecksum: args.report.brain.checksum,
    depth: args.report.selectedDepth,
    locale: args.report.locale,
    parityManifestKey: args.report.pass583.manifestKey,
    readerDownloadManifestKey: args.report.pass610.manifestKey,
    redactionState: args.redactionState,
    boundary: PASS4157_LENS_PREVIEW_DOWNLOAD_HASH_FIXTURE,
  };
}

export const PASS4158_LENS_RENDERED_PDF_BYTE_HASH_HARNESS =
  "pass4158-lens-rendered-pdf-byte-hash-harness: PDF export computes a redacted rendered-byte SHA-256 hash after the same preview/download payload, depth and redaction gates" as const;

export const PASS4159_LENS_PDF_BYTE_PARITY_REPLAY_RUNNER =
  "pass4159-lens-pdf-byte-parity-replay-runner: deterministic local fixture confirms JSON preview stays raw-byte free while PDF download exposes rendered-byte sha256 and byte length bound to the same report checksum" as const;

export const PASS4160_LENS_PDF_SIGNED_FIXTURE_BINDER =
  "pass4160-lens-pdf-signed-fixture-binder: PASS4159 preview/download parity fixtures are digest-bound into a signed local manifest while true rendered byte parity E2E remains fail-closed until runtime proof exists" as const;

export const PASS4161_LENS_PDF_FINAL_RUNNER_INTAKE_GATE =
  "pass4161-lens-pdf-final-runner-intake-gate: PASS4160 PDF fixture binder is admitted into final-runner intake while true rendered preview/download byte parity E2E remains TESTED_GREEN-gated" as const;

export const PASS4162_LENS_PDF_NODE20_PREFLIGHT_EVIDENCE_BUCKET =
  "pass4162-lens-pdf-node20-preflight-evidence-bucket: PDF preview/download proof is now admitted only through a Node20 preflight evidence bucket with npm-ci dry-run, typecheck diagnostics and live parity still fail-closed" as const;

export const PASS4163_LENS_PDF_TYPECHECK_DIAGNOSTIC_REDUCER =
  "pass4163-lens-pdf-typecheck-diagnostic-reducer: Lens/PDF route typecheck diagnostics are reduced with a paths-aware probe, separating dependency/type-install blockers from true route code regressions before any rendered byte-parity live claim" as const;

export const PASS4164_LENS_PDF_DEPENDENCY_TYPE_SURFACE_CLOSURE =
  "pass4164-lens-pdf-dependency-type-surface-closure: Lens/PDF missing-module diagnostics are mapped to declared package surfaces and Node20 type policy before rendered byte-parity live proof can be promoted" as const;

export const PASS4165_LENS_PDF_NODE20_TYPE_PACKAGE_ALIGNMENT =
  "pass4165-lens-pdf-node20-type-package-alignment: PDF/Lens route type evidence now pins Node20-compatible @types/node package/lock policy while rendered byte parity remains gated on clean Node20 install and E2E receipt" as const;

export const PASS4166_LENS_PDF_CLEAN_ROOM_INSTALL_READINESS_LOCK =
  "pass4166-lens-pdf-clean-room-install-readiness-lock: PDF/Lens proof chain now binds Node20 engine-strict install readiness, lockfile/package drift checks and fail-closed clean-room queue before rendered byte-parity E2E can be promoted" as const;

export const PASS4167_LENS_PDF_FINAL_CLEANROOM_EXECUTION_DAG =
  "pass4167-lens-pdf-final-cleanroom-execution-dag: rendered PDF byte parity is now scheduled in a strict Node20 final clean-room DAG after install/typecheck/build/lint, with preview/download E2E still fail-closed until TESTED_GREEN receipt" as const;

export const PASS4168_LENS_PDF_ZERO_SKIP_FINAL_RUNNER_BRIDGE =
  "pass4168-lens-pdf-zero-skip-final-runner-bridge: PDF byte parity stays locked behind a zero-skip final-runner bridge; preview/download parity cannot be promoted unless every DAG gate has explicit receipt evidence" as const;

export const PASS4169_LENS_PDF_RECEIPT_FRESHNESS_EXPIRY_GATE =
  "pass4169-lens-pdf-receipt-freshness-expiry-gate: PDF preview/download byte parity can only promote from fresh Node20-bound receipts; stale local bridge receipts, missing E2E artifacts and expired parity evidence remain blocked" as const;

export const PASS4170_LENS_PDF_RECEIPT_PROVENANCE_ENVIRONMENT_BINDING =
  "pass4170-lens-pdf-receipt-provenance-environment-binding: PDF byte parity receipts must bind provenance to Node20 runtime, npm version, package-lock digest, command digest and rendered artifact digest before preview/download parity can promote" as const;

export const PASS4171_LENS_PDF_TAMPER_EVIDENT_RECEIPT_CHAIN =
  "pass4171-lens-pdf-tamper-evident-receipt-chain: PDF preview/download parity receipts must be chained to prior proof digests so stale or swapped render evidence cannot promote as final green" as const;

export const PASS4172_LENS_PDF_RELEASE_FREEZE_DIGEST_SOURCE_MANIFEST_SEAL =
  "pass4172-lens-pdf-release-freeze-digest-source-manifest-seal: PDF byte-parity receipts must bind to the frozen source manifest, route digest, package-lock digest and release-freeze chain head before rendered PDF proof can promote" as const;

export const PASS4173_LENS_PDF_POST_FREEZE_DIFF_FIREWALL_MUTATION_WATCH =
  "pass4173-lens-pdf-post-freeze-diff-firewall-mutation-watch: PDF parity receipts must match the approved post-freeze source delta; any unapproved Lens/PDF route, package or rendering-source mutation blocks final PDF proof promotion" as const;

export const PASS4174_LENS_PDF_RELEASE_PROMOTION_ESCROW_OPERATOR_SIGNOFF_GATE =
  "pass4174-lens-pdf-release-promotion-escrow-operator-signoff-gate: PDF parity cannot promote to final proof until the post-freeze head, PDF byte-parity receipt and dual-operator QA approval packet are accepted for the same release candidate" as const;

export const PASS4175_LENS_PDF_PUBLIC_CLAIM_DEGRADATION_STATUS_BOARD_GATE =
  "pass4175-lens-pdf-public-claim-degradation-status-board-gate: PDF proof that lacks byte-parity, Node20 final green receipt or operator QA approval must render public status as BLOCKED_EVIDENCE_MISSING, never READY or VERIFIED" as const;
export const PASS4176_LENS_PDF_CLAIM_EXPIRY_AUTO_DOWNGRADE_RENEWAL_GATE =
  "pass4176-lens-pdf-claim-expiry-auto-downgrade-renewal-gate: PDF public verification must expire unless fresh byte-parity Node20 final-green evidence and renewal signoff are present; stale PDF proof auto-downgrades to NEEDS_REVALIDATION" as const;


export type Pass4158LensProviderRow = LensReport["pass622"]["providers"][number];
export type Pass4158LensSourceRow = LensReport["pass607"]["sources"][number];
export type Pass4158LensAtomicClaim = LensReport["pass623"]["atoms"][number];
export type Pass4158LensMissingEntry = LensReport["pass608"]["entries"][number];
export type Pass4158LensNextCheckTask = LensReport["pass626"]["tasks"][number];
export type Pass4158LensSourceAnchor = LensReport["pass594"]["sources"][number];
export type Pass4158LensTierRow = LensReport["pass455"]["tiers"][number];
export type Pass4158LensProviderFact = { label: string; value: string; source: string };
export type Pass4158LensReportSection = LensReport["sections"][number];
export type Pass4158LensReportSource = LensReport["sources"][number];
export type Pass4158LensPass609Block = LensReport["pass609"]["blocks"][number];
export type Pass4158LensPass450Field = LensReport["pass450"]["tiers"][number]["fields"][number];
export type Pass4158LensPass455Metric = LensReport["pass455"]["tiers"][number]["metrics"][number];
export type Pass4158LensPass594Claim = LensReport["pass594"]["claims"][number];
export type Pass4158LensCitation = LensReport["pass582"]["citations"][number];
export type Pass4158LensWaterfallStage = LensReport["pass466"]["stages"][number];

export type Pass4158LensRenderedPdfByteHashHarness = {
  passId: "PASS4158_LENS_RENDERED_PDF_BYTE_HASH_HARNESS";
  format: "json_preview" | "pdf_download";
  renderedPdfBytesHashed: boolean;
  rawPdfBytesReturnedInJson: false;
  reportChecksum: string;
  pdfByteSha256?: string;
  pdfByteLength?: number;
  hashInput: "post_redaction_rendered_pdf_bytes" | "deferred_until_pdf_render";
  previewDownloadSamePayload: true;
  boundary: typeof PASS4158_LENS_RENDERED_PDF_BYTE_HASH_HARNESS;
};

export function buildPass4158LensRenderedPdfByteHashHarness(args: {
  format: Pass4158LensRenderedPdfByteHashHarness["format"];
  report: LensReport;
  pdf?: Uint8Array;
}): Pass4158LensRenderedPdfByteHashHarness {
  return {
    passId: "PASS4158_LENS_RENDERED_PDF_BYTE_HASH_HARNESS",
    format: args.format,
    renderedPdfBytesHashed: Boolean(args.pdf),
    rawPdfBytesReturnedInJson: false,
    reportChecksum: args.report.brain.checksum,
    pdfByteSha256: args.pdf
      ? createHash("sha256").update(args.pdf).digest("hex")
      : undefined,
    pdfByteLength: args.pdf?.byteLength,
    hashInput: args.pdf
      ? "post_redaction_rendered_pdf_bytes"
      : "deferred_until_pdf_render",
    previewDownloadSamePayload: true,
    boundary: PASS4158_LENS_RENDERED_PDF_BYTE_HASH_HARNESS,
  };
}

export type CanonicalLensRequest = {
  result: VelmereSearchResult;
  locale: LensReportLocale;
  depth: LensReportDepth;
};

export type Pass4655RenderTokenRequest = { renderToken: string };
export type Pass4822LensSourceTokenRequest = { sourceToken: string };

export function isPass4655RenderTokenRequest(value: unknown): value is Pass4655RenderTokenRequest {
  return Boolean(value && typeof value === "object" && typeof (value as Partial<Pass4655RenderTokenRequest>).renderToken === "string");
}

export function isPass4822LensSourceTokenRequest(value: unknown): value is Pass4822LensSourceTokenRequest {
  return Boolean(value && typeof value === "object" && typeof (value as Partial<Pass4822LensSourceTokenRequest>).sourceToken === "string");
}

export function buildPass4655CompactLensPreview(report: LensReport) {
  return {
    version: report.version,
    locale: report.locale,
    generatedAt: report.generatedAt,
    title: report.title,
    symbol: report.symbol,
    summary: report.summary,
    whyItMatters: report.whyItMatters,
    sourceMode: report.sourceMode,
    sourceConfidence: report.sourceConfidence,
    sourceConfidenceCalibrated: report.sourceConfidenceCalibrated,
    sourceCoverage: report.sourceCoverage,
    ...(report.deliveryAuthority ? { deliveryAuthority: report.deliveryAuthority } : {}),
    missingData: report.missingData.slice(0, 16),
    nextOperatorStep: report.nextOperatorStep,
    sources: report.sources.slice(0, 12),
    selectedDepth: report.selectedDepth,
    reportChecksum: report.brain.checksum,
    parityManifestKey: report.pass583.manifestKey,
    readerDownloadManifestKey: report.pass610.manifestKey,
  };
}

export function isCanonicalLensRequest(value: unknown): value is CanonicalLensRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CanonicalLensRequest>;
  const result = candidate.result as Partial<VelmereSearchResult> | undefined;
  return Boolean(
    result &&
    typeof result.id === "string" &&
    typeof result.title === "string" &&
    typeof result.summary === "string" &&
    typeof result.whyItMatters === "string" &&
    typeof result.nextOperatorStep === "string" &&
    Array.isArray(result.sources) &&
    Array.isArray(result.missingData) &&
    (candidate.locale === "pl" ||
      candidate.locale === "de" ||
      candidate.locale === "en") &&
    (candidate.depth === "basic" ||
      candidate.depth === "pro" ||
      candidate.depth === "advanced"),
  );
}
