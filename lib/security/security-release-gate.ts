import { buildDurableRateLimitReadiness } from "@/lib/security/durable-rate-limit";
import { buildSecurityAdminGateReadiness } from "@/lib/security/security-admin-auth";
import { buildSecurityEventAppendReadiness } from "@/lib/security/security-event-append-adapter";
import { buildSecurityOperationsChecklistSnapshot } from "@/lib/security/security-operations-checklist";
import { buildSecurityRuntimeQaSnapshot } from "@/lib/security/security-runtime-qa";
import { buildPaymentWebhookSecuritySnapshot } from "@/lib/security/payment-webhook-security";
import { buildPaymentRuntimeEvidenceSnapshot } from "@/lib/security/payment-runtime-evidence";
import { buildStripeWebhookReplayQaSnapshot } from "@/lib/security/stripe-webhook-replay-qa";

export type SecurityReleaseGateStatus = "blocked" | "manual_review" | "ready_for_preview" | "ready";
export type SecurityReleaseGateItem = {
  id: string;
  label: string;
  status: SecurityReleaseGateStatus;
  progress: number;
  blocker: string;
  nextAction: string;
};

function statusFromProgress(progress: number, hasExternalBlocker = true): SecurityReleaseGateStatus {
  if (progress >= 90 && !hasExternalBlocker) return "ready";
  if (progress >= 78) return "ready_for_preview";
  if (progress >= 58) return "manual_review";
  return "blocked";
}

export function buildSecurityReleaseGateSnapshot() {
  const durable = buildDurableRateLimitReadiness();
  const adminGate = buildSecurityAdminGateReadiness();
  const append = buildSecurityEventAppendReadiness();
  const operations = buildSecurityOperationsChecklistSnapshot();
  const runtimeQa = buildSecurityRuntimeQaSnapshot();
  const paymentWebhook = buildPaymentWebhookSecuritySnapshot();
  const paymentEvidence = buildPaymentRuntimeEvidenceSnapshot();
  const replayQa = buildStripeWebhookReplayQaSnapshot();
  const paymentEvidenceProgress = Math.round((paymentWebhook.averageProgress + paymentEvidence.averageEvidenceProgress + replayQa.averageProgress) / 3);

  const items: SecurityReleaseGateItem[] = [
    {
      id: "vercel-envs",
      label: "Vercel security envs",
      status: statusFromProgress(operations.items.filter((item) => item.phase === "vercel_env").reduce((sum, item) => sum + item.progress, 0) / 3),
      progress: Math.round(operations.items.filter((item) => item.phase === "vercel_env").reduce((sum, item) => sum + item.progress, 0) / 3),
      blocker: "Production envs must be configured in Vercel, not only documented in code.",
      nextAction: "Set Upstash/admin/event append envs and verify `/api/security/readiness`.",
    },
    {
      id: "admin-gate",
      label: "Security admin gate",
      status: adminGate.status === "ready" ? "ready_for_preview" : "manual_review",
      progress: adminGate.status === "ready" ? 88 : 72,
      blocker: "Admin console/export needs a server-side token gate and later real session identity.",
      nextAction: "Configure token hash, scopes and console visibility only after browser QA.",
    },
    {
      id: "event-storage",
      label: "Security event storage",
      status: append.mode === "upstash_list" ? "ready_for_preview" : "manual_review",
      progress: append.mode === "upstash_list" ? 84 : 68,
      blocker: "Append adapter exists, but production needs Upstash env, retention and fallback alerts.",
      nextAction: "Configure `VELMERE_SECURITY_EVENT_UPSTASH_KEY` and inspect append readiness.",
    },
    {
      id: "waf",
      label: "Vercel WAF / bot layer",
      status: "blocked",
      progress: 45,
      blocker: "WAF rules cannot be applied from code; they require Vercel dashboard/platform configuration.",
      nextAction: "Apply scanner path/user-agent/API/admin rules from docs/security/VERCEL_WAF_RULES_DRAFT.md.",
    },
    {
      id: "runtime-qa",
      label: "Runtime QA on Vercel",
      status: runtimeQa.blocked > 0 ? "blocked" : "manual_review",
      progress: runtimeQa.averageProgress,
      blocker: "Browser/runtime checks are not proven until executed on Vercel preview/production.",
      nextAction: "Run the QA checklist and capture status for every security route.",
    },
    {
      id: "payment-webhook-review",
      label: "Payment/webhook security review",
      status: paymentWebhook.blocked > 0 || replayQa.scenarios.some((scenario) => scenario.status === "blocked") ? "blocked" : paymentEvidenceProgress >= 84 ? "ready_for_preview" : "manual_review",
      progress: paymentEvidenceProgress,
      blocker: "Payment/webhook security requires signed webhooks, idempotency, order persistence, fulfilment, refunds and support evidence.",
      nextAction: paymentWebhook.blocked > 0
        ? "Open `/api/security/payment-webhook-review` with admin token and resolve blocked controls."
        : "Run a Vercel payment/webhook smoke test before public checkout.",
    },
  ];

  const averageProgress = Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length);
  const blocked = items.filter((item) => item.status === "blocked").length;
  const readyForPreview = items.filter((item) => item.status === "ready_for_preview").length;
  const status: SecurityReleaseGateStatus = blocked > 0 ? "blocked" : averageProgress >= 90 ? "ready" : "manual_review";

  return {
    schemaVersion: "velmere-security-release-gate-v1",
    mode: "security_release_gate_dashboard",
    generatedAt: new Date().toISOString(),
    status,
    averageProgress,
    blocked,
    readyForPreview,
    items,
    providerModes: {
      durableRateLimit: durable.mode,
      securityAdminGate: adminGate.status,
      eventAppendAdapter: append.mode,
      paymentWebhookSecurity: paymentWebhook.averageProgress,
    },
    paymentWebhookSecurity: paymentWebhook,
    paymentRuntimeEvidence: paymentEvidence,
    stripeWebhookReplayQa: replayQa,
    runtimeQa,
    productionBoundary:
      "Release gate is an operational dashboard. It is blocked until Vercel envs, WAF rules, runtime QA and payment/webhook review are actually completed.",
  };
}
