import type Stripe from "stripe";
import { normalizeVlmPaidProductId, type VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import { stripeObjectPaymentIntentId } from "@/lib/payments/stripe-webhook-state";

export const PASS4803_STRIPE_ENTITLEMENT_REVOCATION_BINDING_ID =
  "pass4803-stripe-entitlement-revocation-binding-v1" as const;

export type VlmPaidTerminalBinding = {
  productId: VlmPaidProductId;
  contextHash: string;
  stripeSessionId: string;
  auditCaseRef: string | null;
  auditTier: "pro" | "advanced" | null;
};

export type VlmPaidTerminalBindingResult =
  | { ok: true; binding: VlmPaidTerminalBinding }
  | { ok: false; error: string; retryable: boolean; notVlmPaidAccess?: boolean };

function metadataBinding(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata || metadata.kind !== "vlm_paid_access") return null;
  const productId = normalizeVlmPaidProductId(metadata.productId);
  const contextHash = typeof metadata.contextHash === "string"
    ? metadata.contextHash.trim().toLowerCase()
    : "";
  if (!productId || !/^[a-f0-9]{64}$/.test(contextHash)) return null;
  const auditTier: "pro" | "advanced" | null = metadata.auditTier === "advanced" || metadata.auditTier === "pro"
    ? metadata.auditTier
    : null;
  return {
    productId,
    contextHash,
    auditCaseRef: typeof metadata.auditCaseRef === "string" && metadata.auditCaseRef.trim()
      ? metadata.auditCaseRef.trim().toUpperCase().slice(0, 48)
      : null,
    auditTier,
  };
}

function paymentIntentIdFromObject(object: unknown) {
  const direct = stripeObjectPaymentIntentId(object);
  if (direct) return direct;
  if (object && typeof object === "object") {
    const id = (object as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }
  return null;
}

async function resolvePaymentIntentId(event: Stripe.Event, stripe: Stripe) {
  const direct = paymentIntentIdFromObject(event.data.object);
  if (direct) return direct;
  if (event.type !== "charge.dispute.created") return null;
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;
  const charge = await stripe.charges.retrieve(chargeId);
  return paymentIntentIdFromObject(charge);
}

export async function resolveVlmPaidTerminalBindingFromEvent(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<VlmPaidTerminalBindingResult> {
  const object = event.data.object as { metadata?: Stripe.Metadata };
  let bindingMetadata = metadataBinding(object.metadata);
  let paymentIntentId: string | null;

  try {
    paymentIntentId = await resolvePaymentIntentId(event, stripe);
    if (!bindingMetadata && paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      bindingMetadata = metadataBinding(paymentIntent.metadata);
    }
  } catch {
    return { ok: false, error: "stripe_terminal_binding_lookup_failed", retryable: true };
  }

  const directSessionId = typeof object.metadata?.stripeSessionId === "string"
    ? object.metadata.stripeSessionId.trim()
    : "";
  if (bindingMetadata && directSessionId.startsWith("cs_")) {
    return { ok: true, binding: { ...bindingMetadata, stripeSessionId: directSessionId.slice(0, 180) } };
  }
  if (!paymentIntentId) {
    if (!bindingMetadata) {
      return { ok: false, error: "not_vlm_paid_access", retryable: false, notVlmPaidAccess: true };
    }
    return { ok: false, error: "vlm_paid_payment_intent_missing", retryable: true };
  }

  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 10 });
    if (!bindingMetadata) {
      const candidates = sessions.data
        .map((candidate) => ({ candidate, metadata: metadataBinding(candidate.metadata) }))
        .filter((entry) => entry.metadata !== null);
      if (candidates.length === 0) {
        return { ok: false, error: "not_vlm_paid_access", retryable: false, notVlmPaidAccess: true };
      }
      if (candidates.length !== 1) {
        return { ok: false, error: "vlm_paid_checkout_session_ambiguous", retryable: true };
      }
      bindingMetadata = candidates[0].metadata!;
    }
    const resolvedBindingMetadata = bindingMetadata;
    if (!resolvedBindingMetadata) {
      return { ok: false, error: "not_vlm_paid_access", retryable: false, notVlmPaidAccess: true };
    }
    const matchingSessions = sessions.data.filter((candidate) => {
      const candidateMetadata = metadataBinding(candidate.metadata);
      return candidateMetadata?.productId === resolvedBindingMetadata.productId
        && candidateMetadata.contextHash === resolvedBindingMetadata.contextHash;
    });
    if (matchingSessions.length !== 1 || !matchingSessions[0]?.id) {
      return { ok: false, error: "vlm_paid_checkout_session_not_found", retryable: true };
    }
    return {
      ok: true,
      binding: {
        ...resolvedBindingMetadata,
        stripeSessionId: matchingSessions[0].id.slice(0, 180),
      },
    };
  } catch {
    return { ok: false, error: "stripe_checkout_session_lookup_failed", retryable: true };
  }
}
