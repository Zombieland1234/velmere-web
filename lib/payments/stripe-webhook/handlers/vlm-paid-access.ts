import type Stripe from "stripe";
import { markStripeWebhookEventProcessed } from "@/lib/db/order-service";
import { upsertVlmPaidEntitlementFromStripeSession } from "@/lib/commerce/vlm-entitlement-ledger";
import {
  isPaidAuditProduct,
  promoteAuditCaseFromPaidEntitlement,
} from "@/lib/security/audit-intake-case-vault";
import { recordPaymentRuntimeEvidence } from "@/lib/security/payment-runtime-evidence";
import { storePaymentRuntimeEvidenceDurable } from "@/lib/security/durable-payment-evidence-store";
import {
  runStripeWebhookEffect,
  StripeWebhookTerminalEffectError,
} from "@/lib/payments/stripe-webhook-effect-ledger";
import { verifyVlmPaidStripeReceipt } from "@/lib/payments/vlm-paid-stripe-receipt-verifier";
import {
  customerWebhookHeaders,
  orderEventJson,
  type StripeWebhookContext,
} from "../shared";

export type VlmPaidAccessDependencies = {
  runStripeWebhookEffect: typeof runStripeWebhookEffect;
  verifyVlmPaidStripeReceipt: typeof verifyVlmPaidStripeReceipt;
  upsertVlmPaidEntitlementFromStripeSession: typeof upsertVlmPaidEntitlementFromStripeSession;
  isPaidAuditProduct: typeof isPaidAuditProduct;
  promoteAuditCaseFromPaidEntitlement: typeof promoteAuditCaseFromPaidEntitlement;
  recordPaymentRuntimeEvidence: typeof recordPaymentRuntimeEvidence;
  storePaymentRuntimeEvidenceDurable: typeof storePaymentRuntimeEvidenceDurable;
  markStripeWebhookEventProcessed: typeof markStripeWebhookEventProcessed;
  orderEventJson: typeof orderEventJson;
  customerWebhookHeaders: typeof customerWebhookHeaders;
};

export const vlmPaidAccessDependencies: VlmPaidAccessDependencies = {
  runStripeWebhookEffect,
  verifyVlmPaidStripeReceipt,
  upsertVlmPaidEntitlementFromStripeSession,
  isPaidAuditProduct,
  promoteAuditCaseFromPaidEntitlement,
  recordPaymentRuntimeEvidence,
  storePaymentRuntimeEvidenceDurable,
  markStripeWebhookEventProcessed,
  orderEventJson,
  customerWebhookHeaders,
};

export async function handleVlmPaidAccess(
  context: StripeWebhookContext,
  session: Stripe.Checkout.Session,
  dependencies: VlmPaidAccessDependencies = vlmPaidAccessDependencies,
) {
  const { event, stripe, attempt } = context;
  const receiptVerification = await dependencies.verifyVlmPaidStripeReceipt({
    stripe,
    session,
    event,
  });
  if (!receiptVerification.ok) {
    if (receiptVerification.terminal || !receiptVerification.retryable) {
      throw new StripeWebhookTerminalEffectError(receiptVerification.error);
    }
    throw new Error(receiptVerification.error);
  }

  const entitlementEffect = await dependencies.runStripeWebhookEffect({
    eventId: event.id,
    eventType: event.type,
    effectKey: "vlm_paid_access:entitlement",
    execute: async () => {
      const result =
        await dependencies.upsertVlmPaidEntitlementFromStripeSession(
          session,
          "stripe_webhook",
        );
      if (!result.ok) {
        return {
          ok: false as const,
          error: result.error,
          retryable: result.retryable,
          terminal: result.terminal,
        };
      }
      return {
        ok: true as const,
        persisted: result.persisted,
        mode: result.mode,
        record: {
          id: result.record.id,
          productId: result.record.productId,
          contextHash: result.record.contextHash,
          auditQueueId: result.record.auditQueueId ?? null,
        },
      };
    },
  });
  const entitlement = entitlementEffect.receipt;
  const record = entitlement.ok ? entitlement.record : null;
  let auditCaseTransition: { record?: { caseRef: string } } | null = null;

  if (record && session.metadata?.auditCaseRef) {
    const auditProductId = record.productId;
    if (dependencies.isPaidAuditProduct(auditProductId)) {
      const auditEffect = await dependencies.runStripeWebhookEffect({
        eventId: event.id,
        eventType: event.type,
        effectKey: "vlm_paid_access:audit_case_promotion",
        execute: async () => {
          const transition =
            await dependencies.promoteAuditCaseFromPaidEntitlement({
              caseRef: session.metadata?.auditCaseRef ?? "",
              stripeSessionId: session.id,
              productId: auditProductId,
              contextHash: record.contextHash,
              entitlementId: record.id,
              paymentEventId: event.id,
            });
          if (!transition.ok || !transition.record) {
            throw new Error(
              transition.error ?? "audit_case_transition_failed",
            );
          }
          return {
            ok: true as const,
            record: {
              caseRef: transition.record.caseRef,
              status: transition.record.status,
              entitlementVerified: transition.record.entitlementVerified,
              analysisStarted: transition.record.analysisStarted,
            },
          };
        },
      });
      auditCaseTransition = auditEffect.receipt;
    }
  }

  const paymentEvidence = dependencies.recordPaymentRuntimeEvidence({
    area: "stripe_webhook",
    status: entitlement.ok ? "pass" : "blocked",
    label: "Stripe webhook VLM service paid access",
    summary: entitlement.ok
      ? "Signed checkout.session.completed created/updated VLM service entitlement and optional auditQueueId."
      : "Signed VLM service webhook reached entitlement ledger but did not persist successfully.",
    evidenceRef: event.id,
    operator: "stripe-webhook",
    scenarioId: "vlm-service-entitlement-ledger",
    auditQueueId: record?.auditQueueId,
    stripeEventId: event.id,
    stripeSessionId: session.id,
    entitlementId: record?.id,
    safeNotes: `pass2366=webhook_signed_vlm_service; paymentRail=${session.metadata?.paymentRail ?? "stripe_checkout_auto"}`,
  });
  const durablePaymentEvidence =
    await dependencies.storePaymentRuntimeEvidenceDurable(paymentEvidence);

  await dependencies.markStripeWebhookEventProcessed(
    event.id,
    event.type,
    attempt,
  );
  return dependencies.orderEventJson(
    {
      received: true,
      kind: "vlm_paid_access",
      entitlementPersisted: Boolean(
        entitlement.ok && entitlement.persisted,
      ),
      auditPromoted: Boolean(auditCaseTransition?.record),
      evidencePersisted: durablePaymentEvidence.durableWrite,
      effectSource: entitlementEffect.source,
    },
    {
      headers: dependencies.customerWebhookHeaders(
        "vlm-entitlement-webhook-signed",
      ),
    },
  );
}
