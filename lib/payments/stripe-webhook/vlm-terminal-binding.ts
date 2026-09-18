import type Stripe from "stripe";
import { resolveStripePaymentIdentity } from "@/lib/payments/stripe-payment-identity";
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
  return (await resolveStripePaymentIdentity(event, stripe)).paymentIntentId;
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
  // Metadata is a hint, not proof of the Session -> PaymentIntent relationship.
  // In particular, never shorten an identifier and revoke the shortened target.
  if (directSessionId && (!directSessionId.startsWith("cs_") || directSessionId.length > 180)) {
    return { ok: false, error: "vlm_paid_checkout_session_hint_invalid", retryable: true };
  }
  if (!paymentIntentId) {
    if (!bindingMetadata) {
      return { ok: false, error: "not_vlm_paid_access", retryable: false, notVlmPaidAccess: true };
    }
    return { ok: false, error: "vlm_paid_payment_intent_missing", retryable: true };
  }

  try {
    // A first page cannot prove absence or uniqueness. Retrieve a bounded,
    // complete list or ask for retry/review without authorizing a mutation.
    const sessionRows: Stripe.Checkout.Session[] = [];
    const seenIds = new Set<string>();
    let startingAfter: string | undefined;
    let complete = false;
    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const page = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId, limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      if (!page || page.object !== "list" || !Array.isArray(page.data) ||
          typeof page.has_more !== "boolean" || page.data.length > 100) {
        return { ok: false, error: "stripe_checkout_session_list_invalid", retryable: true };
      }
      for (const candidate of page.data) {
        if (!candidate || typeof candidate.id !== "string" || !candidate.id.startsWith("cs_") ||
            candidate.id.length > 180 || seenIds.has(candidate.id) ||
            paymentIntentIdFromObject(candidate) !== paymentIntentId ||
            candidate.livemode !== event.livemode) {
          return { ok: false, error: "stripe_checkout_session_binding_inconsistent", retryable: true };
        }
        seenIds.add(candidate.id);
        sessionRows.push(candidate);
      }
      if (!page.has_more) { complete = true; break; }
      const lastId = page.data.at(-1)?.id;
      if (!lastId || lastId === startingAfter) {
        return { ok: false, error: "stripe_checkout_session_pagination_stalled", retryable: true };
      }
      startingAfter = lastId;
    }
    if (!complete) {
      return { ok: false, error: "stripe_checkout_session_list_incomplete", retryable: true };
    }
    if (!bindingMetadata) {
      const candidates = sessionRows
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
    const matchingSessions = sessionRows.filter((candidate) => {
      const candidateMetadata = metadataBinding(candidate.metadata);
      return candidateMetadata?.productId === resolvedBindingMetadata.productId
        && candidateMetadata.contextHash === resolvedBindingMetadata.contextHash;
    });
    if (matchingSessions.length !== 1 || !matchingSessions[0]?.id) {
      return { ok: false, error: "vlm_paid_checkout_session_not_found", retryable: true };
    }
    if (directSessionId && directSessionId !== matchingSessions[0].id) {
      return { ok: false, error: "vlm_paid_checkout_session_hint_mismatch", retryable: true };
    }
    return {
      ok: true,
      binding: {
        ...resolvedBindingMetadata,
        stripeSessionId: matchingSessions[0].id,
      },
    };
  } catch {
    return { ok: false, error: "stripe_checkout_session_lookup_failed", retryable: true };
  }
}
