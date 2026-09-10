import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit, rejectLargeContentLength } from "@/lib/security/api-guard";
import {
  getPass4822AccountCustomerArtifactSnapshot,
  getPass4824AccountCustomerArtifactPdfBlob,
  getPass4824AccountCustomerArtifactPdfMetadata,
  listPass4822AccountCustomerArtifactSnapshots,
} from "@/lib/reporting/account-customer-artifact-store";
import {
  getP85OwnerVisibleCustomerArtifact,
  listP85OwnerVisibleCustomerArtifacts,
} from "@/lib/reporting/account-customer-artifact-owner-visible-read";
import {
  verifyPass4822AccountCustomerArtifactSnapshot,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  assertPass4824PdfBlobMatchesSnapshot,
  assertPass4824PdfBlobMetadataMatchesSnapshot,
} from "@/lib/reporting/account-customer-artifact-pdf-blob";
import type { CustomerReportPayload } from "@/lib/market-integrity/customer-tier-pdf-renderer";
import { buildCustomerReportLayoutModel } from "@/lib/market-integrity/customer-report-layout-model";
import { isLensReport, type LensReportDepth } from "@/lib/search/lens-report";
import { buildPass4655CompactLensPreview } from "@/lib/search/lens-report-request-contract";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";
import {
  P86_PUBLIC_ACCOUNT_ARTIFACT_ERROR_SCHEMA,
  P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA,
  P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
  resolveP86CustomerArtifactPdfAvailability,
} from "@/lib/reporting/customer-artifact-pdf-availability";
import { hasAuditAccountMessageExactArtifactLink } from "@/lib/account/audit-account-messages";
import { validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import {
  CustomerOwnedWriteBoundaryError,
  customerOwnedDataErrorPayload,
  resolveCustomerOwnedDataBoundary,
} from "@/lib/db/customer-owned-write-boundary";

export async function GET(request: Request) {
  const lengthGuard = rejectLargeContentLength(request, 16_384);
  if (lengthGuard) return lengthGuard;
  const limiter = await applyApiRateLimit(request, { keyPrefix: "pass4822-account-customer-artifact", limit: 60, windowMs: 60_000 });
  if (!limiter.ok) return limiter.response;
  const account = await resolveRequestAccount(request);
  const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (!account || (productionLike && (account.sessionSource === "preview" || account.accountId.startsWith("preview:")))) {
    return NextResponse.json({ ok: false, error: "account_session_required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  // Preview-only local sessions may use the in-memory store. The account
  // resolver classifies a valid signed local preview cookie as `cookie`, so the
  // provider must also be checked here; otherwise this branch is unreachable.
  // Production-like runtimes already reject family-less preview cookies above.
  const localPreviewSession =
    (account.sessionSource === "preview" && !productionLike)
    || (
      !productionLike
      && account.sessionSource === "cookie"
      && (account.provider === "preview" || account.provider === "google_preview")
    );

  // Every real account read is rebound to an active Supabase user token and
  // the database account binding before the route can touch durable artifacts.
  let ownerClient: Awaited<ReturnType<typeof resolveCustomerOwnedDataBoundary>>["client"] | null = null;
  if (!localPreviewSession) {
    try {
      const boundary = await resolveCustomerOwnedDataBoundary({ request, accountId: account.accountId });
      ownerClient = boundary.client;
    } catch (error) {
      if (error instanceof CustomerOwnedWriteBoundaryError) {
        return NextResponse.json(customerOwnedDataErrorPayload(error, "read"), {
          status: error.httpStatus,
          headers: { "cache-control": "no-store" },
        });
      }
      return NextResponse.json({ ok: false, error: "customer_data_boundary_unavailable", retryable: true }, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }
  }
  const url = new URL(request.url);
  const exactQuery = validateExactSearchParams(url, ["id", "format", "limit", "disposition"]);
  if (!exactQuery.ok) return exactQuery.response;
  const snapshotId = String(exactQuery.values.id ?? "").trim();
  if (snapshotId && !/^[A-Za-z0-9._:-]{8,160}$/u.test(snapshotId)) return NextResponse.json({ ok: false, error: "invalid_snapshot_id" }, { status: 400, headers: { "cache-control": "no-store" } });
  const formatRaw = exactQuery.values.format ?? "json";
  if (formatRaw !== "json" && formatRaw !== "pdf") return NextResponse.json({ ok: false, error: "invalid_artifact_format" }, { status: 400, headers: { "cache-control": "no-store" } });
  const format = formatRaw;
  const dispositionRaw = exactQuery.values.disposition ?? "download";
  if (dispositionRaw !== "preview" && dispositionRaw !== "download") return NextResponse.json({ ok: false, error: "invalid_artifact_disposition" }, { status: 400, headers: { "cache-control": "no-store" } });
  const disposition = dispositionRaw;
  const limitRaw = exactQuery.values.limit ?? "24";
  if (!/^\d{1,2}$/u.test(limitRaw)) return NextResponse.json({ ok: false, error: "invalid_limit" }, { status: 400, headers: { "cache-control": "no-store" } });
  const limit = Number(limitRaw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return NextResponse.json({ ok: false, error: "invalid_limit" }, { status: 400, headers: { "cache-control": "no-store" } });
  if (!snapshotId) {
    if (format !== "json") return NextResponse.json({ ok: false, error: "artifact_id_required_for_pdf" }, { status: 400, headers: { "cache-control": "no-store" } });
    let visibleSnapshots: AccountCustomerArtifactSnapshot[];
    if (ownerClient) {
      // Real-account reads require the P85 SECURITY INVOKER projection. The
      // database applies owner RLS and the immutable Audit publication boundary
      // before LIMIT, so hidden/orphan rows cannot starve valid older artifacts
      // and this route performs exactly one owner-token RPC instead of N+1 reads.
      try {
        const listed = await listP85OwnerVisibleCustomerArtifacts({
          accountId: account.accountId,
          limit,
          client: ownerClient,
        });
        visibleSnapshots = listed.artifacts.map((artifact) => artifact.snapshot);
      } catch {
        return NextResponse.json({ ok: false, error: "artifact_visibility_boundary_unavailable", retryable: true }, {
          status: 503,
          headers: { "cache-control": "no-store" },
        });
      }
    } else {
      // Preview-only memory fixtures retain the bounded legacy lookup. They are
      // never customer-final and cannot reach durable owner data.
      const listed = await listPass4822AccountCustomerArtifactSnapshots({ accountId: account.accountId, limit: 50, client: null });
      visibleSnapshots = [];
      for (const snapshot of listed.snapshots) {
        if (snapshot.surface !== "audit") {
          visibleSnapshots.push(snapshot);
          continue;
        }
        try {
          if (await hasAuditAccountMessageExactArtifactLink({
            accountId: account.accountId,
            snapshotId: snapshot.snapshotId,
            client: null,
          })) visibleSnapshots.push(snapshot);
        } catch {
          return NextResponse.json({ ok: false, error: "artifact_delivery_link_storage_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
        }
      }
    }
    return NextResponse.json({
      ok: true,
      schemaVersion: P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA,
      artifacts: visibleSnapshots.slice(0, limit).map((snapshot) => {
        const pdfDelivery = resolveP86CustomerArtifactPdfAvailability(snapshot);
        return {
          artifactId: snapshot.snapshotId,
          surface: snapshot.surface,
          reportId: snapshot.reportId,
          requestedTier: snapshot.requestedTier,
          deliveredTier: snapshot.deliveredTier,
          locale: snapshot.locale,
          title: snapshot.title,
          subject: snapshot.subject,
          generatedAt: snapshot.generatedAt,
          integrityToken: snapshot.canonicalArtifact.artifactDigest,
          pdfSha256: snapshot.canonicalArtifact.pdfDigest,
          pageCount: snapshot.canonicalArtifact.pageCount,
          pdfAvailability: pdfDelivery.pdfAvailability,
          exactStoredPdf: pdfDelivery.exactStoredPdf,
          previewRoute: pdfDelivery.previewRoute,
          downloadRoute: pdfDelivery.downloadRoute,
        };
      }),
    }, { headers: { "cache-control": "private, no-store", "x-velmere-contract": P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA } });
  }

  let found: Awaited<ReturnType<typeof getPass4822AccountCustomerArtifactSnapshot>>;
  if (ownerClient) {
    try {
      const visible = await getP85OwnerVisibleCustomerArtifact({
        accountId: account.accountId,
        snapshotId,
        client: ownerClient,
      });
      found = visible ? { snapshot: visible.artifact.snapshot, source: "supabase" as const } : null;
    } catch {
      return NextResponse.json({ ok: false, error: "artifact_visibility_boundary_unavailable", retryable: true }, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }
  } else {
    found = await getPass4822AccountCustomerArtifactSnapshot({ accountId: account.accountId, snapshotId, client: null });
  }
  if (!found) return NextResponse.json({ ok: false, error: "artifact_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  const snapshot = found.snapshot;
  if (!verifyPass4822AccountCustomerArtifactSnapshot(snapshot)) {
    return NextResponse.json({ ok: false, error: "artifact_snapshot_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (snapshot.surface === "audit" && !ownerClient) {
    try {
      const linked = await hasAuditAccountMessageExactArtifactLink({
        accountId: account.accountId,
        snapshotId: snapshot.snapshotId,
        client: null,
      });
      if (!linked) return NextResponse.json({ ok: false, error: "artifact_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
    } catch {
      return NextResponse.json({ ok: false, error: "artifact_delivery_link_storage_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
  }

  let preview: unknown;
  if (snapshot.payloadKind === "market_customer_report_v1" || snapshot.payloadKind === "audit_customer_report_v1") {
    try { preview = buildCustomerReportLayoutModel(snapshot.payload as CustomerReportPayload); }
    catch { preview = null; }
  } else if (snapshot.payloadKind === "lens_report_v1") {
    if (!isLensReport(snapshot.payload)) return NextResponse.json({ ok: false, error: "artifact_lens_payload_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
    const lensDepth = (snapshot.deliveredTier ?? snapshot.requestedTier) as LensReportDepth;
    if (lensDepth !== "basic" && lensDepth !== "pro" && lensDepth !== "advanced") return NextResponse.json({ ok: false, error: "artifact_lens_depth_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
    preview = buildPass4655CompactLensPreview(snapshot.payload);
  } else {
    return NextResponse.json({ ok: false, error: "artifact_payload_kind_unsupported" }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const pdfDelivery = resolveP86CustomerArtifactPdfAvailability(snapshot);
  const exactRequired = pdfDelivery.exactStoredPdf;
  if (format === "json") {
    let exactMetadata: Awaited<ReturnType<typeof getPass4824AccountCustomerArtifactPdfMetadata>>;
    try {
      exactMetadata = await getPass4824AccountCustomerArtifactPdfMetadata({ accountId: account.accountId, snapshotId, client: ownerClient });
    } catch {
      return NextResponse.json({ ok: false, error: "artifact_exact_pdf_storage_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    if (exactRequired && !exactMetadata) {
      return NextResponse.json({ ok: false, error: "artifact_exact_pdf_missing" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    if (!exactRequired && exactMetadata) {
      return NextResponse.json({ ok: false, error: "artifact_legacy_pdf_blob_conflict" }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    if (exactMetadata) {
      try {
        assertPass4824PdfBlobMetadataMatchesSnapshot({ blob: exactMetadata.blob, snapshot, accountId: account.accountId });
      } catch {
        return NextResponse.json({ ok: false, error: "artifact_exact_pdf_binding_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
      }
    }
    return NextResponse.json({
      ok: true,
      schemaVersion: P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
      artifact: {
        artifactId: snapshot.snapshotId,
        surface: snapshot.surface,
        reportId: snapshot.reportId,
        requestedTier: snapshot.requestedTier,
        deliveredTier: snapshot.deliveredTier,
        locale: snapshot.locale,
        title: snapshot.title,
        subject: snapshot.subject,
        generatedAt: snapshot.generatedAt,
        integrityToken: snapshot.canonicalArtifact.artifactDigest,
        pdfSha256: snapshot.canonicalArtifact.pdfDigest,
        pageCount: snapshot.canonicalArtifact.pageCount,
        pdfAvailability: pdfDelivery.pdfAvailability,
        exactStoredPdf: exactRequired,
        previewDownloadByteIdentical: exactRequired && Boolean(exactMetadata),
        preview,
        previewRoute: pdfDelivery.previewRoute,
        downloadRoute: pdfDelivery.downloadRoute,
      },
    }, { headers: { "cache-control": "private, no-store", "x-velmere-contract": P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA } });
  }

  let exactPdf: Awaited<ReturnType<typeof getPass4824AccountCustomerArtifactPdfBlob>>;
  try {
    exactPdf = await getPass4824AccountCustomerArtifactPdfBlob({ accountId: account.accountId, snapshotId, client: ownerClient });
  } catch {
    return NextResponse.json({ ok: false, error: "artifact_exact_pdf_storage_invalid" }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (exactRequired && !exactPdf) {
    return NextResponse.json({ ok: false, error: "artifact_exact_pdf_missing" }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!exactRequired && exactPdf) {
    return NextResponse.json({ ok: false, error: "artifact_legacy_pdf_blob_conflict" }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!exactPdf) {
    return NextResponse.json({
      ok: false,
      error: "artifact_pdf_exact_bytes_unavailable",
      pdfAvailability: pdfDelivery.pdfAvailability,
      retryable: false,
    }, {
      status: 409,
      headers: {
        "cache-control": "no-store",
        "x-velmere-contract": P86_PUBLIC_ACCOUNT_ARTIFACT_ERROR_SCHEMA,
      },
    });
  }

  try {
    assertPass4824PdfBlobMatchesSnapshot({ blob: exactPdf.blob, snapshot, accountId: account.accountId });
  } catch {
    return NextResponse.json({ ok: false, error: "artifact_exact_pdf_binding_mismatch" }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const pdf = exactPdf.blob.pdfBytes;
  const delivery = buildExactCustomerPdfDelivery({
    pdfBytes: pdf,
    expectedPdfSha256: snapshot.canonicalArtifact.pdfDigest,
    disposition: disposition === "preview" ? "inline" : "attachment",
    filenameStem: `${snapshot.subject}-${snapshot.deliveredTier ?? snapshot.requestedTier}-Velmere-report`,
    fallbackStem: "Velmere-report",
  });
  return new NextResponse(delivery.bytes as BodyInit, {
    status: 200,
    headers: {
      ...delivery.headers,
      "x-velmere-artifact-snapshot-id": snapshot.snapshotId,
      "x-velmere-artifact-digest": snapshot.canonicalArtifact.artifactDigest,
      "x-velmere-preview-download-parity": "byte-identical",
      "x-velmere-pdf-storage": "exact_immutable_blob",
    },
  });
}
