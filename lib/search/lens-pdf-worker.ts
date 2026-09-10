import { isLensReport, type LensReport } from "@/lib/search/lens-report";
import { buildPdf } from "@/lib/search/lens-pdf-renderer";
import type { LensPdfDepth } from "@/lib/search/lens-report-request-contract";

export type LensPdfWorkerPayload = {
  schemaVersion: "velmere.lens-pdf-worker-payload.v1";
  depth: LensPdfDepth;
  report: LensReport;
};

export function validateLensPdfWorkerPayload(value: unknown): LensPdfWorkerPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("lens_pdf_worker_payload_invalid");
  const payload = value as Record<string, unknown>;
  if (payload.schemaVersion !== "velmere.lens-pdf-worker-payload.v1") throw new Error("lens_pdf_worker_payload_schema_invalid");
  if (payload.depth !== "basic" && payload.depth !== "pro" && payload.depth !== "advanced") throw new Error("lens_pdf_worker_depth_invalid");
  if (!isLensReport(payload.report)) throw new Error("lens_pdf_worker_report_invalid");
  if (payload.report.selectedDepth !== payload.depth || payload.report.pass477.selectedDepth !== payload.depth) {
    throw new Error("lens_pdf_worker_depth_mismatch");
  }
  return { schemaVersion: "velmere.lens-pdf-worker-payload.v1", depth: payload.depth, report: payload.report };
}

export function renderLensPdfWorkerPayload(value: unknown): Uint8Array {
  const payload = validateLensPdfWorkerPayload(value);
  return new Uint8Array(buildPdf(payload.report, payload.depth));
}
