import type Stripe from "stripe";

export type StripePaymentIdentity = {
  subjectKey: string;
  paymentIntentId: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function invalid(): never {
  // Only a symbolic code; no provider payload, metadata or customer identifier.
  throw new Error("stripe_payment_identity_unverified");
}

function id(value: unknown, prefix: "pi_" | "ch_" | "cs_"): string {
  if (typeof value !== "string" || value.length > 180 ||
      !value.startsWith(prefix) || value.length <= prefix.length ||
      !/^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*$/.test(value)) invalid();
  // Never trim, lowercase or truncate an identifier into a different object.
  return value;
}

function checkMode(value: Record<string, unknown>, expected: boolean, required = false): void {
  if ((required || value.livemode !== undefined) && value.livemode !== expected) invalid();
}

function intentReference(value: unknown, live: boolean): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return id(value, "pi_");
  const expanded = record(value);
  if (!expanded || expanded.object !== "payment_intent") invalid();
  checkMode(expanded, live);
  return id(expanded.id, "pi_");
}

function fromIntent(paymentIntentId: string): StripePaymentIdentity {
  return { subjectKey: `stripe:payment_intent:${paymentIntentId}`, paymentIntentId };
}

function fromCharge(charge: Record<string, unknown>, expectedId: string, live: boolean): StripePaymentIdentity {
  if (charge.object !== "charge" || id(charge.id, "ch_") !== expectedId ||
      !Object.hasOwn(charge, "payment_intent") || charge.payment_intent === undefined) invalid();
  checkMode(charge, live, true);
  const paymentIntentId = intentReference(charge.payment_intent, live);
  return paymentIntentId ? fromIntent(paymentIntentId)
    : { subjectKey: `stripe:charge:${expectedId}`, paymentIntentId: null };
}

/** One payment identity shared by ordering and terminal entitlement resolution.
 * Expects an already SDK-verified event in one trusted Stripe account/environment.
 * Network failures are NOT proof that the PaymentIntent is absent. Never create
 * an order/audit/object fallback on a failed lookup: Q7 remembers event identity.
 * This does not add multi-account support or re-verify the webhook signature.
 */
export async function resolveStripePaymentIdentity(event: Stripe.Event, stripe: Stripe): Promise<StripePaymentIdentity> {
  const object = record(event.data.object);
  if (!object || typeof event.livemode !== "boolean") invalid();
  checkMode(object, event.livemode);
  const direct = intentReference(object.payment_intent, event.livemode);

  // A PaymentIntent event carries its own ID, not a nested payment_intent field.
  if (event.type === "payment_intent.payment_failed") {
    if (object.object !== "payment_intent") invalid();
    const self = id(object.id, "pi_");
    if (direct && direct !== self) invalid();
    return fromIntent(self);
  }

  if (event.type === "charge.dispute.created") {
    if (object.object !== "dispute") invalid();
    const expandedCharge = record(object.charge);
    if (expandedCharge && Object.hasOwn(expandedCharge, "payment_intent")) {
      const linked = fromCharge(expandedCharge, id(expandedCharge.id, "ch_"), event.livemode);
      if (direct && linked.paymentIntentId !== direct) invalid();
      return linked;
    }
    if (direct) return fromIntent(direct); // signed event already carries the link
    const chargeId = id(expandedCharge?.id ?? object.charge, "ch_");
    if (expandedCharge && expandedCharge.object !== "charge") invalid();
    let charge: unknown;
    try { charge = await stripe.charges.retrieve(chargeId); }
    catch { throw new Error("stripe_payment_identity_lookup_failed"); }
    const verified = record(charge);
    if (!verified) invalid();
    return fromCharge(verified, chargeId, event.livemode);
  }

  if (event.type === "charge.refunded") {
    if (object.object !== "charge") invalid();
    if (direct) return fromIntent(direct);
    // Historical non-PaymentIntent charges are explicitly null, not failed reads.
    if (object.payment_intent !== null) invalid();
    return { subjectKey: `stripe:charge:${id(object.id, "ch_")}`, paymentIntentId: null };
  }

  if (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired") {
    if (object.object !== "checkout.session") invalid();
    if (direct) return fromIntent(direct);
    // No-PaymentIntent Checkout cannot authorize a paid VLM operation. Pending,
    // failed and expired sessions remain scoped to their exact session, NOT an
    // order shared with a subsequent payment attempt.
    if (event.type === "checkout.session.async_payment_succeeded" ||
        (event.type === "checkout.session.completed" && object.payment_status !== "unpaid") ||
        object.payment_intent !== null) invalid();
    return { subjectKey: `stripe:checkout_session:${id(object.id, "cs_")}`, paymentIntentId: null };
  }
  throw new Error("stripe_payment_identity_event_unsupported");
}
