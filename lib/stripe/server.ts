import Stripe from "stripe";
import { createHash } from "node:crypto";

let cachedStripe: Stripe | null = null;
let cachedSecretDigest: string | null = null;

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY on server.");
  }

  const secretDigest = createHash("sha256").update(secretKey).digest("hex");
  if (!cachedStripe || cachedSecretDigest !== secretDigest) {
    cachedStripe = new Stripe(secretKey);
    cachedSecretDigest = secretDigest;
  }
  return cachedStripe;
}
