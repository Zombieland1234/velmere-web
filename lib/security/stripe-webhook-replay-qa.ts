import { buildPaymentRuntimeEvidenceSnapshot, recordPaymentRuntimeEvidence } from "@/lib/security/payment-runtime-evidence";
import { storePaymentRuntimeEvidenceDurable } from "@/lib/security/durable-payment-evidence-store";

export type StripeWebhookReplayScenarioStatus = "pending" | "manual" | "pass" | "blocked";

export type StripeWebhookReplayScenario = {
  id: string;
  label: string;
  status: StripeWebhookReplayScenarioStatus;
  progress: number;
  commandHint: string;
  expected: string;
  evidenceNeeded: string[];
  blockerIfMissing: string;
};

export const stripeWebhookReplayScenarios: StripeWebhookReplayScenario[] = [
  {
    id: "missing-signature",
    label: "Missing signature rejection",
    status: "manual",
    progress: 72,
    commandHint: "POST /api/stripe/webhook without stripe-signature header on Vercel preview.",
    expected: "400 response before any order mutation.",
    evidenceNeeded: ["HTTP status", "response error", "no order event"],
    blockerIfMissing: "Webhook route must reject unsigned payloads before production checkout.",
  },
  {
    id: "oversized-webhook-payload",
    label: "Oversized webhook payload rejection",
    status: "manual",
    progress: 70,
    commandHint: "POST payload above configured webhook max bytes to staging endpoint.",
    expected: "413 response before signature processing and order mutation.",
    evidenceNeeded: ["HTTP status", "no mutation", "server log"],
    blockerIfMissing: "Large payloads could waste runtime resources.",
  },
  {
    id: "signed-checkout-completed",
    label: "Signed checkout.session.completed acceptance",
    status: "blocked",
    progress: 56,
    commandHint: "Use Stripe CLI/Vercel webhook forwarding with a signed checkout.session.completed test event.",
    expected: "200 received true; order persistence or safe fallback is visible.",
    evidenceNeeded: ["Stripe event id", "HTTP status", "persisted/order fallback", "operator state"],
    blockerIfMissing: "Paid order path is not proven on Vercel runtime.",
  },
  {
    id: "duplicate-replay",
    label: "Duplicate webhook replay",
    status: "blocked",
    progress: 48,
    commandHint: "Replay the same signed Stripe event id twice.",
    expected: "Second call returns duplicate true and does not duplicate order/fulfilment state.",
    evidenceNeeded: ["first response", "second response", "order count unchanged"],
    blockerIfMissing: "Duplicate provider events could create duplicate order side effects.",
  },
  {
    id: "unsupported-signed-event",
    label: "Unsupported signed event",
    status: "manual",
    progress: 68,
    commandHint: "Send signed Stripe event type not in supported allowlist.",
    expected: "200 received true unsupported true, no order mutation.",
    evidenceNeeded: ["HTTP status", "unsupported true", "no mutation"],
    blockerIfMissing: "Unsupported events must not mutate order state.",
  },
  {
    id: "printful-failure-path",
    label: "Fulfilment failure path",
    status: "blocked",
    progress: 44,
    commandHint: "Force provider draft creation failure in staging with safe test data.",
    expected: "Order enters failed/operator-review state without silent fulfilment loss.",
    evidenceNeeded: ["order state", "operator warning", "support path"],
    blockerIfMissing: "Provider failure could become invisible after payment.",
  },
  {
    id: "vlm-service-entitlement-ledger",
    label: "VLM service paid entitlement ledger",
    status: "blocked",
    progress: 64,
    commandHint: "Complete a test VLM service Checkout Session and confirm checkout.session.completed reaches /api/stripe/webhook.",
    expected: "Webhook response returns kind vlm_paid_access; entitlement becomes active; Advanced Audit creates an auditQueueId.",
    evidenceNeeded: ["Stripe event id", "session id", "entitlement id", "auditQueueId when product is Advanced Audit"],
    blockerIfMissing: "Advanced services could appear paid in Stripe without a server-side entitlement ledger.",
  },
  {
    id: "blik-pln-checkout-session",
    label: "BLIK PLN Checkout Session",
    status: "manual",
    progress: 42,
    commandHint: "Use paymentRail=stripe_checkout_blik in staging after VELMERE_STRIPE_BLIK_ENABLED=true and a PLN amount env is configured.",
    expected: "Stripe Checkout uses payment_method_types=['blik'] and PLN line item; webhook/verify creates the same entitlement ledger as card.",
    evidenceNeeded: ["paymentRail metadata", "stripeLineCurrency=pln", "signed webhook status", "entitlement ledger status"],
    blockerIfMissing: "BLIK must not be treated as EUR card checkout or client-only proof.",
  },
  {
    id: "vlm-service-duplicate-replay",
    label: "VLM service duplicate replay",
    status: "blocked",
    progress: 52,
    commandHint: "Replay the same signed VLM checkout.session.completed event id twice.",
    expected: "Second call returns duplicate true and does not create a second entitlement/audit queue side effect.",
    evidenceNeeded: ["first response", "second response", "entitlement count unchanged", "audit queue count unchanged"],
    blockerIfMissing: "Duplicate paid service webhooks could create duplicate manual QA tasks.",
  },
];

export async function recordStripeWebhookReplayEvidence(input: {
  scenarioId?: unknown;
  status?: unknown;
  evidenceRef?: unknown;
  summary?: unknown;
  operator?: unknown;
  auditQueueId?: unknown;
  accountMessageId?: unknown;
  accountId?: unknown;
  stripeEventId?: unknown;
  stripeSessionId?: unknown;
  entitlementId?: unknown;
}) {
  const scenarioId = typeof input.scenarioId === "string" ? input.scenarioId : "manual-replay";
  const scenario = stripeWebhookReplayScenarios.find((item) => item.id === scenarioId);
  const record = recordPaymentRuntimeEvidence({
    area: "stripe_webhook",
    status: input.status,
    label: scenario ? `Stripe replay QA · ${scenario.label}` : "Stripe replay QA",
    summary: input.summary ?? "Stripe webhook replay evidence captured.",
    evidenceRef: input.evidenceRef,
    operator: input.operator,
    safeNotes: scenario ? `scenario=${scenario.id}; pass2366=durable-safe-linking` : "scenario=manual; pass2366=durable-safe-linking",
    scenarioId: scenario ? scenario.id : scenarioId,
    auditQueueId: input.auditQueueId,
    accountMessageId: input.accountMessageId,
    accountId: input.accountId,
    stripeEventId: input.stripeEventId,
    stripeSessionId: input.stripeSessionId,
    entitlementId: input.entitlementId,
  });
  const durable = await storePaymentRuntimeEvidenceDurable(record);
  return { ...record, durableSource: durable.source, durableWrite: durable.durableWrite, linkedAuditQueue: durable.linkedAuditQueue, linkedAccountMessage: durable.linkedAccountMessage };
}

export function buildStripeWebhookReplayQaSnapshot() {
  const evidence = buildPaymentRuntimeEvidenceSnapshot();
  const scenarioEvidenceCount = evidence.recent.filter((record) => record.area === "stripe_webhook").length;
  const averageProgress = Math.round(
    stripeWebhookReplayScenarios.reduce((sum, scenario) => sum + scenario.progress, 0) / stripeWebhookReplayScenarios.length,
  );
  return {
    schemaVersion: "velmere-stripe-webhook-replay-qa-v2-pass2366",
    mode: "stripe_webhook_replay_qa_ledger_with_pass2366_durable_linking",
    generatedAt: new Date().toISOString(),
    averageProgress: scenarioEvidenceCount > 0 ? Math.max(averageProgress, evidence.averageEvidenceProgress) : averageProgress,
    scenarioEvidenceCount,
    linkedEvidenceCount: evidence.linkedEvidenceCount ?? 0,
    scenarios: stripeWebhookReplayScenarios,
    evidence,
    pass2364: {
      passId: "pass2364-stripe-test-blik-webhook-replay-readiness",
      requiredBeforeLive: [
        "card test Checkout Session completed",
        "BLIK PLN test Checkout Session completed where available",
        "signed webhook accepted",
        "duplicate replay idempotent",
        "Advanced Audit entitlement creates exactly one analysis QA queue id",
      ],
    },
    productionBoundary:
      "Replay QA ledger is operator evidence capture. It does not contain raw Stripe payloads, raw headers, secrets, card data, BLIK codes or raw customer PII.",
  };
}
