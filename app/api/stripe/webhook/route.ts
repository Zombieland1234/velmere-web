import { handleStripeWebhookRequest } from "@/lib/payments/stripe-webhook/ingress";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
