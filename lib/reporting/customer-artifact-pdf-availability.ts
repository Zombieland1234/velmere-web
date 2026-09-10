import {
  isPass4824ExactPdfAccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  P86_EXACT_IMMUTABLE_PDF_AVAILABLE,
  P86_LEGACY_EXACT_PDF_UNAVAILABLE,
} from "@/lib/reporting/public-account-artifact-contract";

export {
  P86_EXACT_IMMUTABLE_PDF_AVAILABLE,
  P86_LEGACY_EXACT_PDF_UNAVAILABLE,
  P86_PUBLIC_ACCOUNT_ARTIFACT_ERROR_SCHEMA,
  P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA,
  P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
  type P86CustomerArtifactPdfAvailability,
} from "@/lib/reporting/public-account-artifact-contract";

/**
 * Customer-facing PDF availability is derived only from the immutable storage
 * marker covered by the snapshot digest. A deterministic renderer or retained
 * payload is never treated as permission to recreate a delivered artifact.
 */
export function resolveP86CustomerArtifactPdfAvailability(
  snapshot: AccountCustomerArtifactSnapshot,
) {
  const exactStoredPdf = isPass4824ExactPdfAccountCustomerArtifactSnapshot(snapshot);
  const encodedId = encodeURIComponent(snapshot.snapshotId);
  return Object.freeze({
    pdfAvailability: exactStoredPdf
      ? P86_EXACT_IMMUTABLE_PDF_AVAILABLE
      : P86_LEGACY_EXACT_PDF_UNAVAILABLE,
    exactStoredPdf,
    previewRoute: exactStoredPdf
      ? `/api/account/customer-artifact?id=${encodedId}&format=pdf&disposition=preview`
      : null,
    downloadRoute: exactStoredPdf
      ? `/api/account/customer-artifact?id=${encodedId}&format=pdf&disposition=download`
      : null,
  });
}
