import { hasApiErrorCodePrefix, publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listAuditAccountMessages, storeAuditAccountMessage, type AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import type { VlmAuditAccountMessage } from "@/lib/security/vlm-audit-product";
import type { AuditAccountCustomerSnapshot } from "@/lib/security/audit-account-customer-snapshot";
import { assertSameOriginRequest, rejectLargeContentLength, applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { attachPass2377DeliveryReceiptSummaries, type Pass2377DeliveryReceiptRecord } from "@/lib/security/delivery-receipt-ledger";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { isProductionLikeEnvironment, validateExactObjectKeys, validateExactSearchParams } from "@/lib/security/exact-request-boundary";

function valueFromUrl(url: URL, key: string) {
  return url.searchParams.get(key)?.trim() || undefined;
}

function safeEqualSecret(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function auditMessageWriterAuthorized(request: Request) {
  const expected = process.env.VELMERE_AUDIT_MESSAGE_WRITE_SECRET?.trim() || "";
  const provided = request.headers.get("x-velmere-audit-message-auth")?.trim() || "";
  return expected.length >= 32 && safeEqualSecret(expected, provided);
}

export const PUBLIC_AUDIT_ACCOUNT_MESSAGES_SCHEMA =
  "velmere.public-audit-account-messages.v2" as const;
export const PUBLIC_AUDIT_ACCOUNT_MESSAGES_ERROR_SCHEMA =
  "velmere.public-audit-account-messages-error.v1" as const;

function privateHeaders() {
  return {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    vary: "Cookie, Authorization",
    "x-content-type-options": "nosniff",
    "x-velmere-contract": PUBLIC_AUDIT_ACCOUNT_MESSAGES_SCHEMA,
  };
}

function deliveryModeFor(source: "supabase" | "memory") {
  return source === "supabase" ? "durable" : "ephemeral";
}

type AuditAccountMessageWithReceipt = AuditAccountMessageRecord & {
  deliveryReceipt?: Pass2377DeliveryReceiptRecord;
};

function customerSafeReportProjection(
  report: AuditAccountMessageRecord["customerSafeReport"],
) {
  if (!report) return undefined;
  return {
    schemaVersion: report.schemaVersion,
    reportId: report.reportId,
    requestId: report.requestId,
    title: report.title,
    summary: report.summary,
    status: report.status,
    pdfRoute: report.pdfRoute,
    publicReportRoute: report.publicReportRoute,
    sections: [...report.sections],
    deliveredAt: report.deliveredAt,
  };
}

function canonicalSnapshotProjection(
  snapshot: AuditAccountMessageRecord["canonicalCustomerSnapshot"],
) {
  if (!snapshot) return undefined;
  return {
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    reportId: snapshot.reportId,
    requestId: snapshot.requestId,
    requestedTier: snapshot.requestedTier,
    deliveredTier: snapshot.deliveredTier,
    locale: snapshot.locale,
    projectName: snapshot.projectName,
    targetLabel: snapshot.targetLabel,
    riskScore: snapshot.riskScore,
    releaseState: snapshot.releaseState,
    generatedAt: snapshot.generatedAt,
    snapshotDigest: snapshot.snapshotDigest,
    pdfArtifact: {
      schemaVersion: snapshot.pdfArtifact.schemaVersion,
      pdfDigest: snapshot.pdfArtifact.pdfDigest,
      pdfByteLength: snapshot.pdfArtifact.pdfByteLength,
      renderPlanDigest: snapshot.pdfArtifact.renderPlanDigest,
      pageCount: snapshot.pdfArtifact.pageCount,
    },
  };
}

function deliveryReceiptProjection(
  receipt: Pass2377DeliveryReceiptRecord | undefined,
) {
  if (!receipt) return undefined;
  return {
    receiptId: receipt.receiptId,
    status: receipt.status,
    locale: receipt.locale,
    deliveredAt: receipt.deliveredAt,
    createdAt: receipt.createdAt,
    integrityToken: receipt.checksum,
    customerSafeReportStatus: receipt.customerSafeReportStatus,
    customerSafeLinks: {
      accountRoute: receipt.customerSafeLinks.accountRoute,
      customerReportRoute: receipt.customerSafeLinks.customerReportRoute,
      safePdfPacketRoute: receipt.customerSafeLinks.safePdfPacketRoute,
    },
  };
}

export function projectAuditAccountMessageForCustomer(
  message: AuditAccountMessageWithReceipt,
) {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    status: message.status,
    packageLabel: message.packageLabel,
    requestId: message.requestId,
    createdAt: message.createdAt,
    eta: message.eta,
    accountRoute: message.accountRoute,
    nextSteps: [...message.nextSteps],
    locale: message.locale,
    reviewLevel: message.reviewLevel,
    auditReference: message.auditCaseRef,
    projectName: message.projectName,
    contractAddress: message.contractAddress,
    publicReportRoute: message.publicReportRoute,
    pdfRoute: message.pdfRoute,
    deliveryStatus: message.deliveryStatus,
    customerStatus:
      message.customerSafeReport?.status ??
      (message.deliveryStatus === "ready_for_download"
        ? "ready"
        : message.deliveryStatus),
    customerSafeReport: customerSafeReportProjection(message.customerSafeReport),
    canonicalCustomerSnapshot: canonicalSnapshotProjection(
      message.canonicalCustomerSnapshot,
    ),
    deliveryReceipt: deliveryReceiptProjection(message.deliveryReceipt),
    updatedAt: message.updatedAt,
    deliveredAt: message.deliveredAt,
  };
}

const defaultAccountAuditMessagesGetDependencies = {
  resolveRequestAccount,
  listAuditAccountMessages,
  attachPass2377DeliveryReceiptSummaries,
};

export type AccountAuditMessagesGetDependencies =
  typeof defaultAccountAuditMessagesGetDependencies;

export async function handleAccountAuditMessagesGet(
  request: Request,
  dependencies: AccountAuditMessagesGetDependencies =
    defaultAccountAuditMessagesGetDependencies,
) {
  const url = new URL(request.url);
  const exactQuery = validateExactSearchParams(url, ["accountId", "email", "limit", "locale"]);
  if (!exactQuery.ok) return exactQuery.response;
  const account = await dependencies.resolveRequestAccount(request);
  if (!account || ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && account.sessionSource === "preview")) {
    return securityJson({ ok: false, error: "account_session_required" }, { status: 401, headers: privateHeaders() });
  }

  const requestedAccountId = valueFromUrl(url, "accountId");
  const requestedEmail = valueFromUrl(url, "email")?.toLowerCase();
  if ((requestedAccountId && requestedAccountId !== account.accountId) || (requestedEmail && requestedEmail !== account.email?.toLowerCase())) {
    return securityJson({ ok: false, error: "account_scope_mismatch" }, { status: 403, headers: privateHeaders() });
  }

  const rawLimitText = valueFromUrl(url, "limit") ?? "24";
  if (!/^\d{1,2}$/u.test(rawLimitText)) return securityJson({ ok: false, error: "invalid_limit" }, { status: 400, headers: privateHeaders() });
  const limit = Number(rawLimitText);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return securityJson({ ok: false, error: "invalid_limit" }, { status: 400, headers: privateHeaders() });
  const locale = valueFromUrl(url, "locale");
  if (locale && locale !== "pl" && locale !== "en" && locale !== "de") return securityJson({ ok: false, error: "invalid_locale" }, { status: 400, headers: privateHeaders() });
  let result: Awaited<ReturnType<typeof listAuditAccountMessages>>;
  try {
    result = await dependencies.listAuditAccountMessages({
      locale,
      accountId: account.accountId,
      contactEmail: account.email,
      limit,
    });
  } catch {
    return securityJson({ ok: false, error: "audit_message_storage_unavailable" }, { status: 503, headers: privateHeaders() });
  }

  const messagesWithPrivateStorageFields =
    await dependencies.attachPass2377DeliveryReceiptSummaries(
      result.messages,
    );
  const messages = messagesWithPrivateStorageFields.map(
    projectAuditAccountMessageForCustomer,
  );

  return NextResponse.json({
    schemaVersion: PUBLIC_AUDIT_ACCOUNT_MESSAGES_SCHEMA,
    ok: true,
    deliveryMode: deliveryModeFor(result.source),
    messages,
    count: messages.length,
    capabilities: {
      autoSync: true,
      customerReportReady: messagesWithPrivateStorageFields.some((message) =>
        Boolean(
          message.canonicalCustomerSnapshot
          && (message.deliveryStatus === "ready_for_download"
            || message.operatorStatus === "customer_safe_ready"
            || message.operatorStatus === "delivered"),
        ),
      ),
      deliveryReceiptReady: messagesWithPrivateStorageFields.some((message) =>
        Boolean(message.deliveryReceipt?.receiptId),
      ),
    },
  }, {
    headers: privateHeaders(),
  });
}

export function GET(request: Request) {
  return handleAccountAuditMessagesGet(request);
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 128 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: !isProductionLikeEnvironment() });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass2360-account-audit-messages", limit: 40, windowMs: 60_000 });
  if (!rate.ok) return rate.response;

  if (!auditMessageWriterAuthorized(request)) {
    const configured = (process.env.VELMERE_AUDIT_MESSAGE_WRITE_SECRET?.trim() || "").length >= 32;
    return securityJson(
      { ok: false, error: configured ? "audit_message_writer_unauthorized" : "audit_message_writer_not_configured" },
      { status: configured ? 401 : 503, headers: privateHeaders() },
    );
  }

  const parsed = await readBoundedJsonBody<Partial<{
    message: VlmAuditAccountMessage;
    accountId: string;
    contactEmail: string;
    locale: string;
    reviewLevel: string;
    projectName: string;
    contractAddress: string;
    publicReportRoute: string;
    adminRoute: string;
    exportRoute: string;
    auditQueueId: string;
    auditCaseRef: string;
    paymentEvidenceRefs: string[];
    canonicalCustomerSnapshot: AuditAccountCustomerSnapshot;
  }>>(request, 128 * 1024, { maxDepth: 12 });
  if (!parsed.ok) return parsed.response;
  const exactBody = validateExactObjectKeys(parsed.value, ["message", "accountId", "contactEmail", "locale", "reviewLevel", "projectName", "contractAddress", "publicReportRoute", "adminRoute", "exportRoute", "auditQueueId", "auditCaseRef", "paymentEvidenceRefs", "canonicalCustomerSnapshot"]);
  if (!exactBody.ok) return exactBody.response;
  const payload = parsed.value;

  if (!payload.message?.id || !payload.message?.requestId || !payload.accountId?.trim()) {
    return securityJson({ ok: false, error: "invalid_audit_message" }, { status: 400, headers: privateHeaders() });
  }

  let stored: Awaited<ReturnType<typeof storeAuditAccountMessage>>;
  try {
    stored = await storeAuditAccountMessage({
      message: payload.message,
      accountId: payload.accountId,
      contactEmail: payload.contactEmail,
      locale: payload.locale,
      reviewLevel: payload.reviewLevel,
      projectName: payload.projectName,
      contractAddress: payload.contractAddress,
      publicReportRoute: payload.publicReportRoute,
      adminRoute: payload.adminRoute,
      exportRoute: payload.exportRoute,
      auditQueueId: payload.auditQueueId,
      auditCaseRef: payload.auditCaseRef,
      paymentEvidenceRefs: payload.paymentEvidenceRefs,
      canonicalCustomerSnapshot: payload.canonicalCustomerSnapshot,
    });
  } catch (error) {
    const conflict = hasApiErrorCodePrefix(error, [
      "audit_account_message_owner_immutable_",
      "audit_account_customer_snapshot_immutable_",
      "audit_account_customer_snapshot_invalid_",
    ]);
    return publicApiError(error, {
      route: "/api/account/audit-messages",
      code: conflict ? "audit_message_snapshot_conflict" : "audit_message_storage_unavailable",
      status: conflict ? 409 : 503,
      headers: privateHeaders(),
    });
  }

  return NextResponse.json({
    schemaVersion: PUBLIC_AUDIT_ACCOUNT_MESSAGES_SCHEMA,
    ok: true,
    deliveryMode: deliveryModeFor(stored.source),
    message: projectAuditAccountMessageForCustomer(stored.record),
    capabilities: {
      autoSync: true,
      customerReportReady: Boolean(
        stored.record.canonicalCustomerSnapshot
        && (stored.record.deliveryStatus === "ready_for_download"
          || stored.record.operatorStatus === "customer_safe_ready"
          || stored.record.operatorStatus === "delivered"),
      ),
      deliveryReceiptReady: false,
    },
  }, {
    headers: privateHeaders(),
  });
}
