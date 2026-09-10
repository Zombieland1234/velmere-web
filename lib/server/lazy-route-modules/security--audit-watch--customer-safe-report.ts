import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { getAuditAccountMessageByIdentifier } from "@/lib/account/audit-account-messages";
import { buildPass2369CustomerSafeReportPayload, PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID } from "@/lib/security/customer-safe-report-route";
import { PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID } from "@/lib/security/customer-safe-audit-layout";
import { hasExactAuditAccountArtifactBinding } from "@/lib/security/audit-account-customer-snapshot";
import {
  getPass4822AccountCustomerArtifactSnapshot,
  getPass4824AccountCustomerArtifactPdfBlob,
} from "@/lib/reporting/account-customer-artifact-store";
import { assertPass4824PdfBlobMatchesSnapshot } from "@/lib/reporting/account-customer-artifact-pdf-blob";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";

function cleanText(value: string | null, max = 180) {
  const trimmed = String(value ?? "").replace(/[<>]/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function normalizeLocale(value: string | null) {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

export async function GET(request: Request) {
  const account = await resolveRequestAccount(request);
  if (!account || ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && account.sessionSource === "preview")) {
    return NextResponse.json({ ok: false, error: "account_session_required" }, { status: 401, headers: { "cache-control": "private, no-store, max-age=0" } });
  }
  const url = new URL(request.url);
  const id = cleanText(url.searchParams.get("id") ?? url.searchParams.get("messageId") ?? url.searchParams.get("requestId")) ?? "sample";
  const requestId = cleanText(url.searchParams.get("requestId"));
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const format = cleanText(url.searchParams.get("format"), 80) ?? "json";
  const disposition = cleanText(url.searchParams.get("disposition"), 24) ?? "download";
  if (disposition !== "preview" && disposition !== "download") {
    return NextResponse.json({ ok: false, error: "invalid_pdf_disposition" }, { status: 400, headers: { "cache-control": "private, no-store, max-age=0" } });
  }
  let result: Awaited<ReturnType<typeof getAuditAccountMessageByIdentifier>>;
  try {
    result = await getAuditAccountMessageByIdentifier({ id, requestId, locale, accountId: account.accountId });
  } catch {
    return NextResponse.json({ ok: false, error: "audit_report_snapshot_integrity_failed" }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
  }
  if (!result) {
    return NextResponse.json({ ok: false, error: "audit_report_not_found_or_not_owned" }, { status: 404, headers: { "cache-control": "private, no-store, max-age=0" } });
  }
  let payload: ReturnType<typeof buildPass2369CustomerSafeReportPayload>;
  try {
    payload = buildPass2369CustomerSafeReportPayload({ id, locale, record: result.record });
  } catch {
    return NextResponse.json({ ok: false, error: "canonical_customer_snapshot_required_or_invalid" }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
  }

  if (format === "pdf-safe") {
    if (!payload.pdfReady) {
      return NextResponse.json({
        ok: false,
        error: "customer_safe_pdf_not_ready",
        status: payload.status,
        reportId: payload.reportId,
        layoutDigest: payload.layoutDigest,
        message: "The customer-safe PDF is generated only after the report is marked ready or delivered.",
      }, {
        status: 409,
        headers: {
          "cache-control": "private, no-store, max-age=0",
          "x-content-type-options": "nosniff",
          "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
          "x-velmere-customer-safe-layout-digest": payload.layoutDigest,
        },
      });
    }
    const snapshot = result.record.canonicalCustomerSnapshot;
    if (!snapshot || snapshot.snapshotDigest !== payload.snapshotDigest || snapshot.canonicalLayout.layoutDigest !== payload.layoutDigest) {
      return NextResponse.json({ ok: false, error: "canonical_customer_snapshot_required", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    if (!hasExactAuditAccountArtifactBinding(snapshot)) {
      return NextResponse.json({ ok: false, error: "audit_exact_pdf_artifact_required", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    let storedSnapshot: Awaited<ReturnType<typeof getPass4822AccountCustomerArtifactSnapshot>>;
    let storedPdf: Awaited<ReturnType<typeof getPass4824AccountCustomerArtifactPdfBlob>>;
    try {
      [storedSnapshot, storedPdf] = await Promise.all([
        getPass4822AccountCustomerArtifactSnapshot({
          accountId: account.accountId,
          snapshotId: snapshot.exactAccountArtifact.snapshotId,
        }),
        getPass4824AccountCustomerArtifactPdfBlob({
          accountId: account.accountId,
          snapshotId: snapshot.exactAccountArtifact.snapshotId,
        }),
      ]);
    } catch {
      return NextResponse.json({ ok: false, error: "audit_exact_pdf_storage_invalid", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    if (!storedSnapshot || !storedPdf) {
      return NextResponse.json({ ok: false, error: "audit_exact_pdf_missing", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    const accountArtifact = storedSnapshot.snapshot;
    const exactPdf = storedPdf.blob;
    try {
      assertPass4824PdfBlobMatchesSnapshot({ blob: exactPdf, snapshot: accountArtifact, accountId: account.accountId });
    } catch {
      return NextResponse.json({ ok: false, error: "audit_exact_pdf_binding_mismatch", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    if (accountArtifact.surface !== "audit"
      || accountArtifact.payloadKind !== "audit_customer_report_v1"
      || accountArtifact.snapshotDigest !== snapshot.exactAccountArtifact.snapshotDigest
      || accountArtifact.canonicalArtifact.artifactDigest !== snapshot.exactAccountArtifact.artifactDigest
      || accountArtifact.canonicalArtifact.artifactDigest !== snapshot.canonicalArtifact.artifactDigest
      || exactPdf.blobId !== snapshot.exactAccountArtifact.pdfBlobId
      || exactPdf.recordDigest !== snapshot.exactAccountArtifact.pdfBlobRecordDigest
      || exactPdf.pdfDigest !== snapshot.exactAccountArtifact.pdfDigest
      || exactPdf.pdfByteLength !== snapshot.exactAccountArtifact.pdfByteLength) {
      return NextResponse.json({ ok: false, error: "audit_exact_pdf_cross_binding_mismatch", reportId: payload.reportId }, { status: 409, headers: { "cache-control": "private, no-store, max-age=0" } });
    }
    const delivery = buildExactCustomerPdfDelivery({
      pdfBytes: exactPdf.pdfBytes,
      expectedPdfSha256: snapshot.exactAccountArtifact.pdfDigest,
      disposition: disposition === "preview" ? "inline" : "attachment",
      filenameStem: `${payload.projectName}-${payload.reportId}`,
      fallbackStem: "velmere-audit-report",
    });
    return new NextResponse(delivery.bytes as BodyInit, {
      status: 200,
      headers: {
        ...delivery.headers,
        "x-frame-options": "DENY",
        "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
        "x-velmere-customer-safe-pdf": PASS4820_CUSTOMER_SAFE_AUDIT_PDF_ID,
        "x-velmere-customer-safe-layout-digest": snapshot.canonicalLayout.layoutDigest,
        "x-velmere-customer-safe-snapshot-digest": snapshot.snapshotDigest,
        "x-velmere-customer-safe-pdf-digest": exactPdf.pdfDigest,
        "x-velmere-customer-safe-render-plan": snapshot.pdfArtifact.renderPlanDigest,
        "x-velmere-audit-account-artifact-id": accountArtifact.snapshotId,
        "x-velmere-preview-download-parity": "byte-identical",
        "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
      },
    });
  }

  return NextResponse.json({
    ...payload,
    format: "json",
    pdfPacket: {
      ready: payload.pdfReady,
      endpoint: payload.links.pdfRoute,
      previewEndpoint: `${payload.links.pdfRoute}&disposition=preview`,
      layoutDigest: payload.layoutDigest,
      snapshotDigest: payload.snapshotDigest,
      snapshotReady: payload.snapshotReady,
      artifact: payload.pdfArtifact,
      rule: "Preview and download consume the same exact immutable account-owned PDF bytes. No audit/provider/AI work is re-run during delivery.",
    },
  }, {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
      "x-velmere-customer-safe-layout-digest": payload.layoutDigest,
      "x-velmere-customer-safe-boundary": "no-raw-payment-no-exploit-instructions",
    },
  });
}
