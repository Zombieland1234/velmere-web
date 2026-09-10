import { createHash } from "node:crypto";
import { resolveRequestAccount, PASS2363_ACCOUNT_AUTH_SPINE_ID } from "@/lib/auth/account-session";
import { applyApiRateLimit, securityJson } from "@/lib/security/api-guard";
import { validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { getAuditCaseCustomerHistory, PASS4615_AUDIT_CUSTOMER_HISTORY_ID } from "@/lib/security/audit-case-customer-history";
import { getAuditReviewCustomerProjection, PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID } from "@/lib/security/audit-review-orchestration";
import {
  auditCaseStatusPublicPayload,
  getAuditCaseForOwningAccount,
  PASS4613_AUDIT_CASE_STATUS_REVOCATION_ID,
  PASS4613_AUDIT_STATUS_BOUNDARY,
} from "@/lib/security/audit-intake-case-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanCaseRef(value: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

function statusHeaders(extra?: Record<string, string>) {
  return {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    vary: "Cookie, Authorization",
    "x-content-type-options": "nosniff",
    "x-velmere-pass4613-audit-status": PASS4613_AUDIT_CASE_STATUS_REVOCATION_ID,
    "x-velmere-pass4615-audit-history": PASS4615_AUDIT_CUSTOMER_HISTORY_ID,
    "x-velmere-pass4616-review-orchestration": PASS4616_AUDIT_REVIEW_ORCHESTRATION_ID,
    "x-velmere-pass2363-auth-spine": PASS2363_ACCOUNT_AUTH_SPINE_ID,
    ...extra,
  };
}

export async function GET(request: Request) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "pass4613-audit-case-status",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const account = await resolveRequestAccount(request);
  if (!account || ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") && account.sessionSource === "header")) {
    return securityJson(
      {
        ok: false,
        error: "account_session_required",
        boundary: PASS4613_AUDIT_STATUS_BOUNDARY,
      },
      { status: 401, headers: statusHeaders() },
    );
  }

  const url = new URL(request.url);
  const exactQuery = validateExactSearchParams(url, ["caseRef"]);
  if (!exactQuery.ok) return exactQuery.response;
  const caseRef = cleanCaseRef(exactQuery.values.caseRef);
  if (!/^AUD-[A-Z0-9]{8,16}$/.test(caseRef)) {
    return securityJson(
      { ok: false, error: "invalid_case_ref" },
      { status: 400, headers: statusHeaders() },
    );
  }

  const result = await getAuditCaseForOwningAccount({
    caseRef,
    accountId: account.accountId,
  });

  if (!result.ok || !result.record) {
    const unavailable = result.error === "durable_storage_required" || result.error === "durable_write_failed";
    return securityJson(
      {
        ok: false,
        error: unavailable ? "status_temporarily_unavailable" : "case_not_found",
        boundary: PASS4613_AUDIT_STATUS_BOUNDARY,
      },
      {
        status: unavailable ? 503 : 404,
        headers: statusHeaders(unavailable ? { "retry-after": "30" } : undefined),
      },
    );
  }

  const history = await getAuditCaseCustomerHistory({
    caseRef: result.record.caseRef,
    accountId: account.accountId,
    durable: result.record.durable,
    limit: 40,
  });
  const review = await getAuditReviewCustomerProjection(result.record);
  const payload = {
    ...auditCaseStatusPublicPayload(result.record),
    review,
    history,
    artifact: result.record.tier === "basic" && review.state === "completed"
      ? {
          ready: true,
          previewPath: `/api/security/audit-watch/basic-pdf?caseRef=${encodeURIComponent(result.record.caseRef)}&disposition=preview`,
          downloadPath: `/api/security/audit-watch/basic-pdf?caseRef=${encodeURIComponent(result.record.caseRef)}&disposition=download`,
          parity: "same_immutable_blob",
        }
      : null,
  };
  const etag = `W/"${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: statusHeaders({ etag }) });
  }

  return securityJson(
    {
      ok: true,
      case: payload,
      auth: {
        accountResolved: true,
        passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
      },
      boundary: PASS4613_AUDIT_STATUS_BOUNDARY,
    },
    { status: 200, headers: statusHeaders({ etag }) },
  );
}
