import { buildDurableRateLimitReadiness } from "@/lib/security/durable-rate-limit";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";
import { buildSecurityOperationsChecklistSnapshot } from "@/lib/security/security-operations-checklist";
import { buildPaymentWebhookSecuritySnapshot } from "@/lib/security/payment-webhook-security";
import { buildPaymentRuntimeEvidenceSnapshot } from "@/lib/security/payment-runtime-evidence";
import { buildStripeWebhookReplayQaSnapshot } from "@/lib/security/stripe-webhook-replay-qa";

export type RuntimeQaStatus = "pass" | "manual" | "blocked";
export type RuntimeQaArea =
  | "public_pages"
  | "admin_gate"
  | "security_api"
  | "abuse_shield"
  | "export_safety"
  | "waf"
  | "release";

export type RuntimeQaCheck = {
  id: string;
  area: RuntimeQaArea;
  status: RuntimeQaStatus;
  progress: number;
  label: string;
  test: string;
  expected: string;
  evidence: string[];
  blockerIfFailing: string;
};

export const runtimeQaChecks: RuntimeQaCheck[] = [
  {
    id: "security-page-locales",
    area: "public_pages",
    status: "manual",
    progress: 74,
    label: "Security page locales",
    test: "Open `/pl/security`, `/en/security`, `/de/security` on Vercel preview.",
    expected: "All routes render the security-first copy, pillars, roadmap and operations checklist without layout overflow.",
    evidence: ["browser screenshot", "no console runtime error", "nav/footer link works"],
    blockerIfFailing: "Do not link Security in launch nav until route renders correctly in every locale.",
  },
  {
    id: "admin-console-locked",
    area: "admin_gate",
    status: "manual",
    progress: 78,
    label: "Admin console locked state",
    test: "Open `/pl/admin/security` without security admin env configured.",
    expected: "Locked panel renders; no event ledger, export payload or sensitive operational detail is exposed.",
    evidence: ["locked panel screenshot", "no sensitive JSON exposed"],
    blockerIfFailing: "Admin console must stay hidden until server auth and console visibility are configured.",
  },
  {
    id: "admin-api-deny-by-default",
    area: "security_api",
    status: "manual",
    progress: 80,
    label: "Security API deny-by-default",
    test: "Call `/api/security/events`, `/api/security/export`, `/api/security/admin-audit` without token.",
    expected: "Routes return 401 or 503; no raw event/export data is returned.",
    evidence: ["HTTP status", "response mode", "no raw IP/query/secrets"],
    blockerIfFailing: "Sensitive security APIs must not be publicly readable.",
  },
  {
    id: "admin-api-token-success",
    area: "security_api",
    status: "manual",
    progress: 64,
    label: "Security API token success",
    test: "Call scoped security APIs with `Authorization: Bearer <token>` after env setup.",
    expected: "Valid token returns scoped safe JSON; invalid token returns 401.",
    evidence: ["HTTP status", "operator scope", "admin audit event"],
    blockerIfFailing: "Security operations cannot be managed safely until token flow is verified.",
  },
  {
    id: "public-trust-api",
    area: "security_api",
    status: "manual",
    progress: 0,
    label: "Public security trust API",
    test: "Call `/api/security/trust` and `/api/security/operations-checklist` without admin token.",
    expected: "Public-safe JSON only; no secrets, raw IP, raw query, admin event data or guaranteed-security claims.",
    evidence: ["behavioral response test pending on final frozen source", "negative seeded-data disclosure test pending"],
    blockerIfFailing: "Public security copy/API must stay safe and non-sensitive.",
  },
  {
    id: "abuse-shield-patterns",
    area: "abuse_shield",
    status: "manual",
    progress: 70,
    label: "Abuse Shield scanner patterns",
    test: "Send harmless scanner-like request to a staging endpoint with test user-agent.",
    expected: "API Abuse Shield blocks or scores it; event ledger records only redacted metadata.",
    evidence: ["403/abuse_shield_blocked", "security event kind", "no raw IP/query"],
    blockerIfFailing: "Scanner pressure must be visible before live adapters are promoted.",
  },
  {
    id: "export-redaction",
    area: "export_safety",
    status: "manual",
    progress: 76,
    label: "Security export redaction",
    test: "Call `/api/security/export` with admin token and inspect payload.",
    expected: "No raw IP addresses, raw query payloads, authorization headers, tokens or secrets.",
    evidence: ["payload inspection", "content-disposition JSON export"],
    blockerIfFailing: "Export must not ship until redaction is verified.",
  },
  {
    id: "upstash-provider-mode",
    area: "release",
    status: "manual",
    progress: 62,
    label: "Upstash provider mode",
    test: "After Vercel env setup, call `/api/security/readiness`.",
    expected: "Rate-limit and append adapters report configured provider/fallback states; fallback count is monitored.",
    evidence: ["durableRateLimit.mode", "eventAppendAdapter.mode", "fallback count"],
    blockerIfFailing: "Production traffic should not rely only on memory fallback.",
  },
  {
    id: "waf-rules-applied",
    area: "waf",
    status: "blocked",
    progress: 42,
    label: "Vercel WAF rules applied",
    test: "Apply scanner path/user-agent/API/admin rules from `docs/security/VERCEL_WAF_RULES_DRAFT.md`.",
    expected: "Vercel logs show challenge/block at edge for known scanner patterns.",
    evidence: ["Vercel firewall logs", "rule IDs", "no false positives in normal flow"],
    blockerIfFailing: "App-level guards remain the only active protection against scanner traffic.",
  },
  {
    id: "payment-webhook-review-api",
    area: "release",
    status: "manual",
    progress: 66,
    label: "Payment/webhook review API",
    test: "Call `/api/security/payment-webhook-review` with admin token and inspect controls.",
    expected: "Snapshot reports checkout readiness, signed webhook status, idempotency, order persistence, fulfilment and refund/support blockers.",
    evidence: ["HTTP status", "blocked controls", "paymentWebhookSecurity.averageProgress"],
    blockerIfFailing: "Payment/webhook review must be visible before commerce release gate can move.",
  },
  {
    id: "stripe-webhook-guard",
    area: "security_api",
    status: "manual",
    progress: 72,
    label: "Stripe webhook guard",
    test: "Send missing/oversized/unsigned webhook attempts in staging.",
    expected: "Route rejects missing signature or oversized payload before processing order mutation.",
    evidence: ["400 missing signature", "413 oversized payload", "no order mutation"],
    blockerIfFailing: "Webhook route must reject unsafe payloads before checkout can launch.",
  },
  {
    id: "payment-runtime-evidence-api",
    area: "release",
    status: "manual",
    progress: 68,
    label: "Payment runtime evidence capture",
    test: "POST safe evidence to `/api/security/payment-runtime-evidence` with admin token.",
    expected: "Evidence is stored as a redacted operator-safe summary without raw Stripe payloads or customer PII.",
    evidence: ["record id", "safe summary", "no raw payload/header fields"],
    blockerIfFailing: "Payment QA evidence must be captured before checkout launch sign-off.",
  },
  {
    id: "stripe-webhook-replay-qa-ledger",
    area: "release",
    status: "manual",
    progress: 66,
    label: "Stripe webhook replay QA ledger",
    test: "Open `/api/security/stripe-webhook-replay-qa` and record replay evidence for signed, duplicate and unsupported events.",
    expected: "Replay scenarios and evidence records are visible to the operator.",
    evidence: ["scenario list", "recorded evidence", "duplicate replay outcome"],
    blockerIfFailing: "Webhook replay QA must be tracked before production payment launch.",
  },
  {
    id: "release-gate-signoff",
    area: "release",
    status: "blocked",
    progress: 45,
    label: "Security release sign-off",
    test: "Complete env, WAF, runtime QA, export redaction and payment/webhook security review.",
    expected: "Release gate moves from blocked to manual/ready after all external checks are complete.",
    evidence: ["QA report", "WAF logs", "env snapshot", "webhook review"],
    blockerIfFailing: "Do not describe the full launch as security-complete.",
  },
];

export function buildSecurityRuntimeQaSnapshot() {
  const averageProgress = Math.round(runtimeQaChecks.reduce((sum, check) => sum + check.progress, 0) / runtimeQaChecks.length);
  const blocked = runtimeQaChecks.filter((check) => check.status === "blocked").length;
  const manual = runtimeQaChecks.filter((check) => check.status === "manual").length;
  const pass = runtimeQaChecks.filter((check) => check.status === "pass").length;
  return {
    schemaVersion: "velmere-security-runtime-qa-v1",
    mode: "runtime_qa_result_capture_contract",
    generatedAt: new Date().toISOString(),
    averageProgress,
    blocked,
    manual,
    pass,
    checks: runtimeQaChecks,
    operationsChecklist: buildSecurityOperationsChecklistSnapshot(),
    paymentWebhookSecurity: buildPaymentWebhookSecuritySnapshot(),
    paymentRuntimeEvidence: buildPaymentRuntimeEvidenceSnapshot(),
    stripeWebhookReplayQa: buildStripeWebhookReplayQaSnapshot(),
    providerReadiness: {
      durableRateLimit: buildDurableRateLimitReadiness(),
      securityAdminGate: buildSecurityAdminGateReadiness(),
      eventAppendAdapter: buildSecurityEventAppendReadiness(),
    },
    productionBoundary:
      "Runtime QA is a result-capture contract. It records what must be checked on Vercel; it does not prove production safety until the operator executes and signs off the checks.",
  };
}
