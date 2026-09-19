import { createHash } from "node:crypto";
import { hashVlmPaidAccessContext } from "../../lib/commerce/vlm-paid-access-server";
import type { VlmPaidAccessContext } from "../../lib/commerce/vlm-paid-access";

// Synthetic fixtures only. No customer identity, token or payment is used.
export const owner = createHash("sha256").update("q11-fixture-owner").digest("hex");
export const otherOwner = createHash("sha256").update("q11-other-owner").digest("hex");
export const now = new Date("2026-09-19T00:00:00.000Z");
export const context: VlmPaidAccessContext = {
  surface: "shield", locale: "en", depth: "pro", assetId: "fixture-asset", accountIdHash: owner,
};
export const productId = "vlm_pro_analysis_single" as const;
export const hash = hashVlmPaidAccessContext(context);
export const session = "cs_test_q11_fixture";
export function row(): Record<string, unknown> {
  return {
    id: "q11-fixture-grant", stripe_session_id: session, stripe_customer_id: null,
    product_id: productId, access_scope: "vlm_pro_analysis", status: "active",
    context_hash: hash, context: { ...context }, locale: "en", amount_total: 1000,
    currency: "EUR", customer_email: null, customer_name: null, payment_status: "paid",
    source: "stripe_webhook", created_at: "2026-09-18T00:00:00.000Z",
    updated_at: "2026-09-18T00:00:00.000Z", expires_at: "2026-10-18T00:00:00.000Z",
    audit_queue_id: null,
  };
}
export function receiptForArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) result[key.replace(/^p_/, "")] = value;
  return { ...result, status: "active", updated_at: args.p_created_at, ok: true, created: true, idempotent: false };
}
