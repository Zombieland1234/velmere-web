import type { CustomerReportPayload } from "@/lib/market-integrity/customer-tier-pdf-renderer";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import {
  buildPass4818CustomerReportAccountArtifactSnapshot,
  buildPass4818CustomerReportArtifact,
} from "@/lib/market-integrity/customer-report-render-token";
import { issueP87CustomerReportExactPdfToken } from "@/lib/market-integrity/customer-report-exact-pdf-token";
import { storePass4824AccountCustomerArtifactPdfBundle } from "@/lib/reporting/account-customer-artifact-store";

export const PASS4823_REAL_MARKETS_PAID_ACCOUNT_ARTIFACT_ID = "pass4823-real-markets-paid-account-artifact-v1" as const;

export async function createPass4823RealMarketsPaidAccountArtifact(args: {
  payload: CustomerReportPayload;
  accountId: string;
  requestedTier: Exclude<VelmereTier, "Basic">;
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}) {
  const accountId = String(args.accountId ?? "").trim();
  if (!accountId) throw new Error("real_markets_paid_artifact_account_required");
  if (args.payload.commercialEnvelope.surface !== "real_markets") {
    throw new Error("real_markets_paid_artifact_surface_mismatch");
  }
  if (args.payload.deliveryPolicy.status !== "ready_paid"
    || args.payload.deliveryPolicy.paidEvidenceAllowed !== true
    || args.payload.deliveryPolicy.visibleTier !== args.requestedTier) {
    throw new Error("real_markets_paid_artifact_delivery_not_ready");
  }

  // Render once. The same canonical artifact is used by the account snapshot and token.
  const preparedArtifact = buildPass4818CustomerReportArtifact({
    payload: args.payload,
    requestedTier: args.requestedTier,
  });
  if (preparedArtifact.canonicalArtifact.surface !== "real_markets") {
    throw new Error("real_markets_paid_artifact_canonical_surface_mismatch");
  }
  const snapshot = buildPass4818CustomerReportAccountArtifactSnapshot({
    accountId,
    payload: args.payload,
    requestedTier: args.requestedTier,
    canonicalArtifact: preparedArtifact.canonicalArtifact,
  });
  // Persist the render-once bytes before issuing any customer download authority.
  // The token contains only immutable identifiers and can never recreate the PDF.
  const stored = await storePass4824AccountCustomerArtifactPdfBundle({
    accountId,
    snapshot,
    pdfBytes: preparedArtifact.rendered.bytes,
  });
  if (stored.snapshot.snapshotId !== snapshot.snapshotId
    || stored.snapshot.snapshotDigest !== snapshot.snapshotDigest
    || stored.snapshot.canonicalArtifact.artifactDigest !== preparedArtifact.canonicalArtifact.artifactDigest) {
    throw new Error("real_markets_paid_artifact_persistence_mismatch");
  }
  const pdfToken = issueP87CustomerReportExactPdfToken({
    accountId,
    snapshot: stored.snapshot,
    blob: stored.blob,
    env: args.env,
    nowMs: args.nowMs,
    ttlSeconds: args.ttlSeconds,
  });
  if (!pdfToken.ok) throw new Error(`real_markets_paid_artifact_token_failed:${pdfToken.error}`);
  if (pdfToken.accountArtifactBinding.snapshotId !== stored.snapshot.snapshotId
    || pdfToken.accountArtifactBinding.snapshotDigest !== stored.snapshot.snapshotDigest
    || pdfToken.accountArtifactBinding.artifactDigest !== stored.snapshot.canonicalArtifact.artifactDigest
    || pdfToken.artifact.pdfBlobId !== stored.blob.blobId
    || pdfToken.artifact.pdfBlobRecordDigest !== stored.blob.recordDigest) {
    throw new Error("real_markets_paid_artifact_token_binding_mismatch");
  }

  return {
    schemaVersion: PASS4823_REAL_MARKETS_PAID_ACCOUNT_ARTIFACT_ID,
    pdfToken,
    accountArtifact: {
      snapshotId: stored.snapshot.snapshotId,
      snapshotDigest: stored.snapshot.snapshotDigest,
      artifactDigest: stored.snapshot.canonicalArtifact.artifactDigest,
      payloadDigest: stored.snapshot.payloadDigest,
      surface: stored.snapshot.surface,
      rendererId: stored.snapshot.canonicalArtifact.rendererId,
      requestedTier: stored.snapshot.requestedTier,
      deliveredTier: stored.snapshot.deliveredTier,
      route: `/api/account/customer-artifact?id=${encodeURIComponent(stored.snapshot.snapshotId)}`,
      source: stored.source,
      created: stored.created,
    },
  } as const;
}
