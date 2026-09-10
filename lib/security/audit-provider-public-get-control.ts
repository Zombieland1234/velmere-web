import { NextResponse } from "next/server";
import { resolveRequestAccount, hashVelmereAccountBinding } from "@/lib/auth/account-session";
import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
  type DurableRateLimitDecision,
  type DurableRateLimitOptions,
} from "@/lib/security/durable-rate-limit";
import { Pass4824AuditProviderBudgetError } from "@/lib/security/audit-provider-budget";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";

export const PASS4824_AUDIT_PROVIDER_PUBLIC_GET_CONTROL_ID =
  "pass4824-audit-provider-public-get-control-v1" as const;

export const PASS4824_AUDIT_PROVIDER_PUBLIC_GET_ROUTES = Object.freeze([
  "/api/security/audit-claim-ledger",
  "/api/security/audit-contract-source-abi-extraction",
  "/api/security/audit-customer-safe-delivery-decision",
  "/api/security/audit-holder-liquidity-depth-evidence",
  "/api/security/audit-liquidity-holder-risk",
  "/api/security/audit-permission-parser",
  "/api/security/audit-provider-conflict-arbitration-matrix",
  "/api/security/audit-provider-runtime",
  "/api/security/audit-real-provider-adapter-hardening",
  "/api/security/audit-report-assembler",
  "/api/security/audit-risk-formula-evidence-weighting-contract",
  "/api/security/audit-runtime-confidence",
  "/api/security/audit-source-freshness-recheck-orchestrator",
  "/api/security/audit-source-freshness",
] as const);

type ResolvedAccount = Awaited<ReturnType<typeof resolveRequestAccount>>;

export const pass4824AuditProviderPublicGetDependencies: {
  resolveAccount: (request: Request) => Promise<ResolvedAccount>;
  rateLimit: (options: DurableRateLimitOptions) => Promise<DurableRateLimitDecision>;
} = {
  resolveAccount: resolveRequestAccount,
  rateLimit: applyDurableRateLimit,
};

function blockedResponse(args: {
  code: string;
  status: 401 | 414 | 429 | 503;
  retryAfterSeconds?: number;
  decision?: DurableRateLimitDecision;
  providerId?: string;
}) {
  const headers = new Headers(args.decision
    ? buildDurableRateLimitHeaders(args.decision)
    : { "cache-control": "no-store", "x-content-type-options": "nosniff" });
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-velmere-audit-provider-get-control", PASS4824_AUDIT_PROVIDER_PUBLIC_GET_CONTROL_ID);
  if (args.retryAfterSeconds) headers.set("retry-after", String(args.retryAfterSeconds));
  return NextResponse.json({
    ok: false,
    error: args.code,
    ...(args.retryAfterSeconds ? { retryAfterSeconds: args.retryAfterSeconds } : {}),
    ...(args.providerId ? { providerId: args.providerId } : {}),
  }, { status: args.status, headers });
}

export async function withPass4824AuditProviderPublicGet(
  request: Request,
  routeId: typeof PASS4824_AUDIT_PROVIDER_PUBLIC_GET_ROUTES[number],
  handler: () => Promise<Response>,
) {
  if (request.url.length > 2_048) {
    return blockedResponse({ code: "audit_provider_query_too_large", status: 414 });
  }
  const account = await pass4824AuditProviderPublicGetDependencies.resolveAccount(request);
  if (!account) return blockedResponse({ code: "account_session_required", status: 401 });

  const decision = await pass4824AuditProviderPublicGetDependencies.rateLimit({
    namespace: "pass4824:audit-provider-public-get-account-quota",
    key: `${routeId}:${hashVelmereAccountBinding(account.accountId)}`,
    limit: 12,
    windowMs: 60_000,
  });
  if (!decision.ok) {
    const unavailable = decision.reason === "rate_limit_store_unavailable" || decision.mode === "unavailable";
    return blockedResponse({
      code: unavailable ? "rate_limit_store_unavailable" : "audit_provider_request_quota_exceeded",
      status: unavailable ? 503 : 429,
      retryAfterSeconds: Math.max(1, decision.retryAfterSeconds ?? 60),
      decision,
    });
  }

  try {
    const response = await withExpensiveRouteBudget(request, "audit_provider_get", handler);
    response.headers.set("x-velmere-audit-provider-get-control", PASS4824_AUDIT_PROVIDER_PUBLIC_GET_CONTROL_ID);
    response.headers.set("x-velmere-rate-limit-mode", decision.mode);
    return response;
  } catch (error) {
    if (!(error instanceof Pass4824AuditProviderBudgetError)) throw error;
    return blockedResponse({
      code: error.status === 503 ? "audit_provider_budget_store_unavailable" : "audit_provider_budget_exceeded",
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      decision: error.decision,
      providerId: error.providerId,
    });
  }
}
