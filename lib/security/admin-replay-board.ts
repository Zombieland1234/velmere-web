import { listVlmPaidProducts, type VlmPaidProduct } from "@/lib/commerce/vlm-paid-access";
import {
  buildVlmServicePaymentRailReadiness,
  type VlmServicePaymentRail,
  type VlmServicePaymentRailReadiness,
} from "@/lib/checkout/stripe-blik-readiness";
import {
  buildStripeWebhookReplayQaSnapshot,
  type StripeWebhookReplayScenario,
  type StripeWebhookReplayScenarioStatus,
} from "@/lib/security/stripe-webhook-replay-qa";

export const PASS2365_ADMIN_REPLAY_BOARD_ID = "admin-replay-board-operator-evidence-ui" as const;

export type Pass2365ReplayRail = "stripe_checkout_card" | "stripe_checkout_blik";

export type Pass2365RailReadinessSummary = {
  rail: Pass2365ReplayRail;
  label: string;
  readyProducts: number;
  totalProducts: number;
  averageProgress: number;
  blockers: string[];
  products: Array<{
    productId: VlmPaidProduct["id"];
    label: string;
    priceLabel: string;
    readiness: VlmServicePaymentRailReadiness;
  }>;
};

export type Pass2365AdminReplayBoard = {
  passId: typeof PASS2365_ADMIN_REPLAY_BOARD_ID;
  dependsOn: "pass2364-stripe-test-blik-webhook-replay-readiness";
  generatedAt: string;
  locale: string;
  status: "operator_replay_needed" | "ready_for_staging_evidence" | "blocked";
  replayAverageProgress: number;
  replayEvidenceCount: number;
  linkedEvidenceCount: number;
  stripeLinkedCount: number;
  evidenceFilters: Array<{ label: string; href: string; description: string }>;
  scenarioStats: Record<StripeWebhookReplayScenarioStatus, number>;
  scenarioFocus: StripeWebhookReplayScenario[];
  rails: Pass2365RailReadinessSummary[];
  operatorActions: string[];
  runbook: string[];
  safeEvidenceBoundary: string;
};

const replayFocusIds = new Set([
  "signed-checkout-completed",
  "duplicate-replay",
  "vlm-service-entitlement-ledger",
  "blik-pln-checkout-session",
  "vlm-service-duplicate-replay",
]);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarizeRail(products: VlmPaidProduct[], rail: Pass2365ReplayRail): Pass2365RailReadinessSummary {
  const productRows = products.map((product) => ({
    productId: product.id,
    label: product.label,
    priceLabel: product.priceLabel,
    readiness: buildVlmServicePaymentRailReadiness({ product, paymentRail: rail as VlmServicePaymentRail }),
  }));
  const blockers = unique(productRows.flatMap((row) => row.readiness.blockers));
  return {
    rail,
    label: rail === "stripe_checkout_blik" ? "BLIK PLN rail" : "Card / Stripe Checkout rail",
    readyProducts: productRows.filter((row) => row.readiness.enabledForStripeSession).length,
    totalProducts: productRows.length,
    averageProgress: average(productRows.flatMap((row) => row.readiness.checklist.map((item) => item.progress))),
    blockers,
    products: productRows,
  };
}

export function buildPass2365AdminReplayBoard(locale = "en"): Pass2365AdminReplayBoard {
  const products = listVlmPaidProducts(locale);
  const replay = buildStripeWebhookReplayQaSnapshot();
  const scenarioStats = replay.scenarios.reduce<Record<StripeWebhookReplayScenarioStatus, number>>(
    (stats, scenario) => {
      stats[scenario.status] += 1;
      return stats;
    },
    { pending: 0, manual: 0, pass: 0, blocked: 0 },
  );
  const rails = [summarizeRail(products, "stripe_checkout_card"), summarizeRail(products, "stripe_checkout_blik")];
  const scenarioFocus = replay.scenarios.filter((scenario) => replayFocusIds.has(scenario.id));
  const hardBlockers = rails.flatMap((rail) => rail.blockers).filter((blocker) => /secret|amount|enabled|webhook|commercial/i.test(blocker));
  const status = hardBlockers.length
    ? "blocked"
    : replay.scenarioEvidenceCount > 0
      ? "ready_for_staging_evidence"
      : "operator_replay_needed";

  return {
    passId: PASS2365_ADMIN_REPLAY_BOARD_ID,
    dependsOn: "pass2364-stripe-test-blik-webhook-replay-readiness",
    generatedAt: new Date().toISOString(),
    locale,
    status,
    replayAverageProgress: replay.averageProgress,
    replayEvidenceCount: replay.scenarioEvidenceCount,
    linkedEvidenceCount: replay.evidence.linkedEvidenceCount ?? 0,
    stripeLinkedCount: replay.evidence.stripeLinkedCount ?? 0,
    evidenceFilters: [
      { label: "Pass evidence", href: "/api/security/payment-runtime-evidence?area=stripe_webhook&status=pass", description: "Only signed/replayed rows marked pass." },
      { label: "Blocked evidence", href: "/api/security/payment-runtime-evidence?area=stripe_webhook&status=blocked", description: "Rows still blocking launch or staging proof." },
      { label: "VLM entitlement lane", href: "/api/security/payment-runtime-evidence?scenarioId=vlm-service-entitlement-ledger", description: "Proof rows tied to paid service entitlement and auditQueueId." },
      { label: "BLIK PLN lane", href: "/api/security/payment-runtime-evidence?scenarioId=blik-pln-checkout-session", description: "BLIK-specific evidence, kept separate from EUR/card checkout." },
      { label: "Linked account messages", href: "/api/security/payment-runtime-evidence?accountMessageId=", description: "Append a message/request id to inspect customer delivery linkage." },
    ],
    scenarioStats,
    scenarioFocus,
    rails,
    operatorActions: [
      "run card test Checkout Session and capture signed webhook status",
      "run BLIK PLN Checkout Session only when BLIK env + PLN amount are configured",
      "record duplicate replay evidence before launch",
      "confirm Advanced Audit creates exactly one auditQueueId",
      "attach operator evidence without raw Stripe payloads or customer payment data",
      "filter evidence by scenario/status/auditQueueId/accountMessageId before launch sign-off",
    ],
    runbook: [
      "Open /api/checkout/vlm-service/readiness?paymentRail=stripe_checkout_card to inspect card blockers.",
      "Open /api/checkout/vlm-service/readiness?paymentRail=stripe_checkout_blik to inspect BLIK PLN blockers.",
      "Use Stripe CLI or Vercel webhook forwarding to send signed checkout.session.completed events.",
      "Replay the same event id twice and verify duplicate=true with no duplicate entitlement or audit queue.",
      "Record only event id, status, entitlement id, accountMessageId and auditQueueId in operator evidence; never paste raw headers or secrets.",
      "Use /api/security/payment-runtime-evidence filters for status, scenarioId, auditQueueId, accountMessageId and accountId.",
    ],
    safeEvidenceBoundary:
      "PASS2365 records operator-safe replay summaries only: no raw Stripe payloads, raw Stripe-Signature headers, card data, BLIK codes, secrets, raw IPs or unredacted customer PII.",
  };
}
