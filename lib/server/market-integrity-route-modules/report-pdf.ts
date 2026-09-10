import { NextResponse } from "next/server";
import { inflateRawSync } from "node:zlib";

import { resolveRequestAccount } from "@/lib/auth/account-session";
import { resolveVlmPaidSurfaceAccess } from "@/lib/commerce/vlm-paid-surface-guard";
import {
  CustomerOwnedWriteBoundaryError,
  customerOwnedDataErrorPayload,
  resolveCustomerOwnedDataBoundary,
} from "@/lib/db/customer-owned-write-boundary";
import {
  assertP87CustomerReportExactPdfBinding,
  isP87CustomerReportExactPdfToken,
  readP87CustomerReportDownloadContext,
  verifyP87CustomerReportExactPdfToken,
} from "@/lib/market-integrity/customer-report-exact-pdf-token";
import { verifyPass4818CustomerReportRenderToken } from "@/lib/market-integrity/customer-report-render-token";
import {
  getPass4822AccountCustomerArtifactSnapshot,
  getPass4824AccountCustomerArtifactPdfBlob,
} from "@/lib/reporting/account-customer-artifact-store";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";
import { assertSameOriginRequest, applyApiRateLimit, rejectLargeContentLength } from "@/lib/security/api-guard";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

type RequestBody = { renderToken?: string };

type ResolvedAccount = NonNullable<Awaited<ReturnType<typeof resolveRequestAccount>>>;
type OwnerClient = Awaited<ReturnType<typeof resolveCustomerOwnedDataBoundary>>["client"] | null;

function isRealMarketsFamily(value: string): boolean {
  return ["equity", "etf", "fx", "commodity", "real_estate", "exchange_health"].includes(value);
}

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function isPreviewAccountIdentity(account: ResolvedAccount) {
  return account.sessionSource === "preview"
    || account.accountId.startsWith("preview:")
    || (account.sessionSource === "cookie" && (account.provider === "preview" || account.provider === "google_preview"));
}

function isLocalPreviewAccount(account: ResolvedAccount) {
  return !productionLike() && isPreviewAccountIdentity(account);
}

async function resolveOwnerClient(request: Request, account: ResolvedAccount): Promise<OwnerClient> {
  if (isLocalPreviewAccount(account)) return null;
  const boundary = await resolveCustomerOwnedDataBoundary({ request, accountId: account.accountId });
  return boundary.client;
}

export type P87CustomerReportPdfRouteDependencies = {
  resolveAccount: typeof resolveRequestAccount;
  resolvePaidAccess: typeof resolveVlmPaidSurfaceAccess;
  resolveOwnerClient: (request: Request, account: ResolvedAccount) => Promise<OwnerClient>;
  getSnapshot: typeof getPass4822AccountCustomerArtifactSnapshot;
  getPdfBlob: typeof getPass4824AccountCustomerArtifactPdfBlob;
};

export const p87CustomerReportPdfRouteDependencies: P87CustomerReportPdfRouteDependencies = {
  resolveAccount: resolveRequestAccount,
  resolvePaidAccess: resolveVlmPaidSurfaceAccess,
  resolveOwnerClient,
  getSnapshot: getPass4822AccountCustomerArtifactSnapshot,
  getPdfBlob: getPass4824AccountCustomerArtifactPdfBlob,
};

function tokenErrorStatus(error: string) {
  if (error.includes("expired")) return 410;
  if (error.includes("account_mismatch") || error.includes("signature") || error.includes("key_unknown")) return 403;
  if (error.includes("binding_mismatch") || error.includes("artifact_mismatch") || error.includes("tier_mismatch")) return 409;
  return 400;
}

export async function handleP87ExactPaidPdf(
  request: Request,
  renderToken: string,
  dependencies: P87CustomerReportPdfRouteDependencies,
) {
  const account = await dependencies.resolveAccount(request);
  if (!account || (productionLike() && isPreviewAccountIdentity(account))) {
    return NextResponse.json(
      { ok: false, error: "account_session_required_for_exact_paid_artifact" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  const verifiedToken = verifyP87CustomerReportExactPdfToken({
    token: renderToken,
    accountId: account.accountId,
  });
  if (!verifiedToken.ok) {
    return NextResponse.json(
      { ok: false, error: verifiedToken.error },
      { status: tokenErrorStatus(verifiedToken.error), headers: { "cache-control": "no-store" } },
    );
  }

  let ownerClient: OwnerClient;
  try {
    ownerClient = await dependencies.resolveOwnerClient(request, account);
  } catch (error) {
    if (error instanceof CustomerOwnedWriteBoundaryError) {
      return NextResponse.json(customerOwnedDataErrorPayload(error, "read"), {
        status: error.httpStatus,
        headers: { "cache-control": "no-store" },
      });
    }
    return NextResponse.json(
      { ok: false, error: "customer_report_exact_pdf_owner_boundary_unavailable", retryable: true },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "15" } },
    );
  }

  let foundSnapshot: Awaited<ReturnType<typeof getPass4822AccountCustomerArtifactSnapshot>>;
  let foundBlob: Awaited<ReturnType<typeof getPass4824AccountCustomerArtifactPdfBlob>>;
  try {
    [foundSnapshot, foundBlob] = await Promise.all([
      dependencies.getSnapshot({
        accountId: account.accountId,
        snapshotId: verifiedToken.envelope.snapshotId,
        client: ownerClient,
      }),
      dependencies.getPdfBlob({
        accountId: account.accountId,
        snapshotId: verifiedToken.envelope.snapshotId,
        client: ownerClient,
      }),
    ]);
  } catch {
    return NextResponse.json(
      { ok: false, error: "customer_report_exact_pdf_storage_invalid" },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
  if (!foundSnapshot || !foundBlob) {
    return NextResponse.json(
      { ok: false, error: "customer_report_exact_pdf_not_found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  let context: ReturnType<typeof readP87CustomerReportDownloadContext>;
  try {
    assertP87CustomerReportExactPdfBinding({
      accountId: account.accountId,
      envelope: verifiedToken.envelope,
      snapshot: foundSnapshot.snapshot,
      blob: foundBlob.blob,
    });
    context = readP87CustomerReportDownloadContext(foundSnapshot.snapshot);
  } catch {
    return NextResponse.json(
      { ok: false, error: "customer_report_exact_pdf_binding_mismatch" },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  const depth = context.requestedTier === "Advanced" ? "advanced" : "pro";
  const paid = await dependencies.resolvePaidAccess({
    policyId: isRealMarketsFamily(context.family) ? "real_markets_analysis" : "market_report",
    request,
    depth,
    locale: context.locale,
    assetId: context.symbol,
    symbol: context.symbol,
  });
  if (!paid.ok) {
    return NextResponse.json(
      { ok: false, error: "paid_entitlement_required" },
      { status: 402, headers: { ...paid.headers, "cache-control": "no-store" } },
    );
  }

  if (context.requestedTier === "Advanced"
    && context.deliveredTier === "Advanced"
    && context.advancedDeliveryMode === "manual_review"
    && !context.manualReviewAppendixAllowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "advanced_manual_review_pending",
        deliveredTier: context.deliveredTier,
        proFallbackAvailable: false,
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  let delivery: ReturnType<typeof buildExactCustomerPdfDelivery>;
  try {
    delivery = buildExactCustomerPdfDelivery({
      pdfBytes: foundBlob.blob.pdfBytes,
      expectedPdfSha256: foundSnapshot.snapshot.canonicalArtifact.pdfDigest,
      disposition: "attachment",
      filenameStem: `${context.symbol}-${context.deliveredTier}-Velmere-report`,
      fallbackStem: "Velmere-report",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "customer_report_exact_pdf_delivery_invalid" },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  return new NextResponse(delivery.bytes as BodyInit, {
    status: 200,
    headers: {
      ...delivery.headers,
      "x-velmere-payload-sha256": foundSnapshot.snapshot.payloadDigest,
      "x-velmere-render-plan-sha256": foundSnapshot.snapshot.canonicalArtifact.renderPlanDigest,
      "x-velmere-pdf-pages": String(foundSnapshot.snapshot.canonicalArtifact.pageCount),
      "x-velmere-artifact-snapshot-id": foundSnapshot.snapshot.snapshotId,
      "x-velmere-artifact-digest": foundSnapshot.snapshot.canonicalArtifact.artifactDigest,
      "x-velmere-pdf-blob-id": foundBlob.blob.blobId,
      "x-velmere-pdf-storage": "exact_immutable_blob",
      "x-velmere-preview-download-parity": "byte-identical-account-blob",
      "x-velmere-token-contract": "p87-customer-report-exact-pdf-token-v2",
    },
  });
}

const LEGACY_TOKEN_MAX_COMPRESSED_BYTES = 600_000;
const LEGACY_TOKEN_MAX_ENVELOPE_BYTES = 2_000_000;

function readLegacyRequestedTierWithoutRendering(renderToken: string): "Basic" | "Pro" | "Advanced" | null {
  try {
    const [encoded, signature, ...extra] = String(renderToken ?? "").trim().split(".");
    if (!encoded || !signature || extra.length) return null;
    const compressed = Buffer.from(encoded, "base64url");
    if (!compressed.byteLength || compressed.byteLength > LEGACY_TOKEN_MAX_COMPRESSED_BYTES) return null;
    const serialized = inflateRawSync(compressed, { maxOutputLength: LEGACY_TOKEN_MAX_ENVELOPE_BYTES });
    const value = JSON.parse(serialized.toString("utf8")) as { v?: unknown; purpose?: unknown; requestedTier?: unknown };
    if (value.v !== 1 || value.purpose !== "customer_market_report_pdf") return null;
    return value.requestedTier === "Basic" || value.requestedTier === "Pro" || value.requestedTier === "Advanced"
      ? value.requestedTier
      : null;
  } catch {
    return null;
  }
}

async function handleLegacyBasicPdf(request: Request, renderToken: string) {
  // Read only the bounded, unsigned tier discriminator before invoking the v1 verifier.
  // This grants no authority: it exists solely to reject paid v1 envelopes before the
  // legacy verifier can recreate their PDF bytes. Only Basic compatibility reaches rerender.
  const legacyRequestedTier = readLegacyRequestedTierWithoutRendering(renderToken);
  if (!legacyRequestedTier) {
    return NextResponse.json(
      { ok: false, error: "invalid_customer_report_render_token" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (legacyRequestedTier !== "Basic") {
    return NextResponse.json(
      {
        ok: false,
        error: "customer_report_paid_exact_artifact_token_required",
        retryable: false,
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
  const account = await resolveRequestAccount(request);
  const verified = verifyPass4818CustomerReportRenderToken({
    token: renderToken,
    accountId: account?.accountId ?? null,
    expectedRequestedTier: "Basic",
  });
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: verified.error },
      { status: tokenErrorStatus(verified.error), headers: { "cache-control": "no-store" } },
    );
  }
  const bytes = verified.artifact.bytes;
  const download = buildSafeDownloadDisposition({
    disposition: "attachment",
    filenameStem: `${verified.payload.target.symbol}-Basic-Velmere-report`,
    mediaKind: "pdf",
    fallbackStem: "Velmere-report",
  });
  return new NextResponse(bytes as BodyInit, {
    status: 200,
    headers: {
      "content-type": download.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": download.contentDisposition,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "x-velmere-pdf-sha256": verified.artifact.pdfHash,
      "x-velmere-payload-sha256": verified.artifact.payloadDigest,
      "x-velmere-render-plan-sha256": verified.artifact.renderPlanDigest,
      "x-velmere-pdf-pages": String(verified.artifact.pageCount),
      "x-velmere-pdf-storage": "dynamic_unstored_basic_not_final",
      "x-velmere-preview-download-parity": "single-response-only-not-final",
      "x-velmere-token-contract": "pass4818-customer-report-render-token-v1-basic-compatibility",
    },
  });
}

export async function handleP87CustomerReportPdfPost(
  request: Request,
  dependencies: P87CustomerReportPdfRouteDependencies = p87CustomerReportPdfRouteDependencies,
) {
  const lengthGuard = rejectLargeContentLength(request, 1_500_000);
  if (lengthGuard) return lengthGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const limiter = await applyApiRateLimit(request, {
    keyPrefix: "p87-customer-report-exact-pdf",
    limit: 24,
    windowMs: 60_000,
  });
  if (!limiter.ok) return limiter.response;

  const body = await readBoundedJsonBody<RequestBody>(request, 1_500_000, { maxDepth: 4 });
  if (!body.ok) return body.response;
  const renderToken = String(body.value.renderToken ?? "").trim();
  if (!renderToken) {
    return NextResponse.json(
      { ok: false, error: "signed_render_token_required" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return isP87CustomerReportExactPdfToken(renderToken)
    ? handleP87ExactPaidPdf(request, renderToken, dependencies)
    : handleLegacyBasicPdf(request, renderToken);
}

export async function POST(request: Request) {
  return handleP87CustomerReportPdfPost(request);
}
