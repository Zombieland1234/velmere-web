import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit, assertSameOriginRequest } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATION_LOADERS = {
  "account-vault-timeline-export-capsule-rebalance": () => import("@/lib/server/account-operations/account-vault-timeline-export-capsule-rebalance"),
  "consumed-ledger-download-history-rebalance": () => import("@/lib/server/account-operations/consumed-ledger-download-history-rebalance"),
  "customer-export-recall-attestation-rebalance": () => import("@/lib/server/account-operations/customer-export-recall-attestation-rebalance"),
  "customer-export-snapshot-parity-rebalance": () => import("@/lib/server/account-operations/customer-export-snapshot-parity-rebalance"),
  "customer-export-zero-leak-replay-rebalance": () => import("@/lib/server/account-operations/customer-export-zero-leak-replay-rebalance"),
  "customer-notice-delivery-appeal-window-rebalance": () => import("@/lib/server/account-operations/customer-notice-delivery-appeal-window-rebalance"),
  "download-consumption-replay-abuse-rebalance": () => import("@/lib/server/account-operations/download-consumption-replay-abuse-rebalance"),
  "entitlement-account-vault-retrieval-contract": () => import("@/lib/server/account-operations/entitlement-account-vault-retrieval-contract"),
  "entitlement-admin-override-dual-control-lock": () => import("@/lib/server/account-operations/entitlement-admin-override-dual-control-lock"),
  "entitlement-artifact-watermark-share-lock": () => import("@/lib/server/account-operations/entitlement-artifact-watermark-share-lock"),
  "entitlement-evidence-export-dispute-lock": () => import("@/lib/server/account-operations/entitlement-evidence-export-dispute-lock"),
  "entitlement-incident-response-disclosure-lock": () => import("@/lib/server/account-operations/entitlement-incident-response-disclosure-lock"),
  "entitlement-retention-erasure-lock": () => import("@/lib/server/account-operations/entitlement-retention-erasure-lock"),
  "entitlement-revocation-chargeback-lock": () => import("@/lib/server/account-operations/entitlement-revocation-chargeback-lock"),
  "entitlement-session-device-anomaly-lock": () => import("@/lib/server/account-operations/entitlement-session-device-anomaly-lock"),
  "evidence-retention-expiry-support-boundary-rebalance": () => import("@/lib/server/account-operations/evidence-retention-expiry-support-boundary-rebalance"),
  "mobile-account-vault-resend-review-panel-rebalance": () => import("@/lib/server/account-operations/mobile-account-vault-resend-review-panel-rebalance"),
  "one-time-stream-token-inbox-delivery-rebalance": () => import("@/lib/server/account-operations/one-time-stream-token-inbox-delivery-rebalance"),
  "operator-dual-control-replacement-publish-rebalance": () => import("@/lib/server/account-operations/operator-dual-control-replacement-publish-rebalance"),
  "purge-job-receipt-appeal-reopen-rebalance": () => import("@/lib/server/account-operations/purge-job-receipt-appeal-reopen-rebalance"),
  "recall-resolution-support-replay-rebalance": () => import("@/lib/server/account-operations/recall-resolution-support-replay-rebalance"),
  "refund-dispute-evidence-dual-control-rebalance": () => import("@/lib/server/account-operations/refund-dispute-evidence-dual-control-rebalance"),
  "rls-support-dashboard-erasure-reconciliation-rebalance": () => import("@/lib/server/account-operations/rls-support-dashboard-erasure-reconciliation-rebalance"),
  "scheduled-purge-worker-legal-hold-dsar-erasure-rebalance": () => import("@/lib/server/account-operations/scheduled-purge-worker-legal-hold-dsar-erasure-rebalance"),
  "snapshot-receipt-persistence-gate-rebalance": () => import("@/lib/server/account-operations/snapshot-receipt-persistence-gate-rebalance"),
  "stream-close-resend-persistence-rebalance": () => import("@/lib/server/account-operations/stream-close-resend-persistence-rebalance"),
  "support-dashboard-action-rls-policy-test-rebalance": () => import("@/lib/server/account-operations/support-dashboard-action-rls-policy-test-rebalance"),
  "support-replay-persistence-stream-gate-rebalance": () => import("@/lib/server/account-operations/support-replay-persistence-stream-gate-rebalance"),
  "support-resend-rotation-ack-rebalance": () => import("@/lib/server/account-operations/support-resend-rotation-ack-rebalance"),
} as const;

type OperationKey = keyof typeof OPERATION_LOADERS;
type OperationModule = { GET?: (request: Request) => Response | Promise<Response> };

const SERVER_OWNED_EVIDENCE_OPERATIONS = new Set<OperationKey>([
  "entitlement-account-vault-retrieval-contract",
  "entitlement-admin-override-dual-control-lock",
  "entitlement-artifact-watermark-share-lock",
  "entitlement-evidence-export-dispute-lock",
  "entitlement-incident-response-disclosure-lock",
  "entitlement-retention-erasure-lock",
  "entitlement-revocation-chargeback-lock",
  "entitlement-session-device-anomaly-lock",
]);

function serverOwnedEvidenceRequired() {
  return Response.json(
    {
      ok: false,
      error: "server_owned_account_evidence_workflow_required",
      authorityCredit: false,
      paidAccessAllowed: false,
    },
    {
      status: 405,
      headers: {
        allow: "POST",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function isOperationKey(value: string): value is OperationKey {
  return value.length <= 96 && /^[a-z0-9-]+$/.test(value) && Object.prototype.hasOwnProperty.call(OPERATION_LOADERS, value);
}

export async function GET(request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  if (!isOperationKey(operation)) {
    return Response.json({ ok: false, error: "unknown_account_operation" }, {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  // PASS2493-PASS2500 previously accepted account/session/receipt/operator
  // evidence from a public GET query and could forward a customer request id
  // to market providers. A GET must fail before the dynamic provider module is
  // imported. A future POST may be added only after it loads durable evidence
  // for the authenticated account; client-supplied proof fields remain invalid.
  if (SERVER_OWNED_EVIDENCE_OPERATIONS.has(operation)) {
    return serverOwnedEvidenceRequired();
  }

  let handler: OperationModule;
  try {
    handler = await OPERATION_LOADERS[operation]();
  } catch {
    return Response.json({ ok: false, error: "account_operation_temporarily_unavailable" }, {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "retry-after": "30",
      },
    });
  }

  if (typeof handler.GET !== "function") {
    return Response.json({ ok: false, error: "account_operation_not_available" }, {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "retry-after": "30",
      },
    });
  }

  return handler.GET(request);
}

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  if (!isOperationKey(operation)) {
    return Response.json({ ok: false, error: "unknown_account_operation" }, {
      status: 404,
      headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  }
  if (!SERVER_OWNED_EVIDENCE_OPERATIONS.has(operation)) {
    return Response.json({ ok: false, error: "account_operation_post_not_available" }, {
      status: 405,
      headers: { allow: "GET", "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  }
  const originGuard = assertSameOriginRequest(request, {
    allowMissingOrigin: process.env.NODE_ENV !== "production",
  });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "server-owned-account-evidence-workflow",
    limit: 12,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;
  const account = await resolveRequestAccount(request);
  if (!account) {
    return Response.json({ ok: false, error: "account_session_required" }, {
      status: 401,
      headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  }
  return Response.json(
    {
      ok: false,
      error: "durable_server_owned_account_evidence_workflow_not_implemented",
      authorityCredit: false,
      paidAccessAllowed: false,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "retry-after": "3600",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
