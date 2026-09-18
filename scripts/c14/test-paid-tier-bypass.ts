import assert from "node:assert/strict";

import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  verifyVlmPaidAccountEntitlement,
  verifyVlmPaidEntitlementById,
  type VlmPaidEntitlementRecord,
} from "@/lib/commerce/vlm-entitlement-ledger";
import { hashVlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access-server";
import type { VlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access";

const NOW = new Date("2026-09-18T00:00:00.000Z");
const ACCOUNT_A = "a".repeat(64);
const ACCOUNT_B = "b".repeat(64);

function record(args: {
  id: string;
  productId?: "vlm_pro_analysis_single" | "vlm_advanced_analysis_single";
  status?: VlmPaidEntitlementRecord["status"];
  context?: Partial<VlmPaidAccessContext>;
  expiresAt?: string;
}): VlmPaidEntitlementRecord {
  const context: VlmPaidAccessContext = {
    surface: "shield",
    locale: "en",
    depth: "pro",
    accountIdHash: ACCOUNT_A,
    ...args.context,
  };
  return {
    id: args.id,
    stripeSessionId: `cs_test_${args.id}`,
    stripeCustomerId: null,
    productId: args.productId ?? "vlm_pro_analysis_single",
    accessScope: args.productId === "vlm_advanced_analysis_single" ? "vlm_advanced_analysis" : "vlm_pro_analysis",
    status: args.status ?? "active",
    contextHash: hashVlmPaidAccessContext(context),
    context,
    locale: context.locale,
    amountTotal: 0,
    currency: "EUR",
    customerEmail: null,
    customerName: null,
    paymentStatus: "paid",
    source: "local_demo_verify",
    createdAt: "2026-09-17T23:00:00.000Z",
    updatedAt: "2026-09-17T23:00:00.000Z",
    expiresAt: args.expiresAt ?? "2026-09-19T00:00:00.000Z",
    auditQueueId: null,
  };
}

clearMemoryEntitlements();

const shieldPro = record({ id: "ent-shield-pro" });
seedMemoryEntitlementRecord(shieldPro);

const exact = await verifyVlmPaidAccountEntitlement({
  productId: "vlm_pro_analysis_single",
  context: { surface: "shield", locale: "en", depth: "pro", accountIdHash: ACCOUNT_A },
  now: NOW,
});
assert.equal(exact.ok, true, "matching paid authorization scope must remain accepted");

const crossSurface = await verifyVlmPaidAccountEntitlement({
  productId: "vlm_pro_analysis_single",
  context: { surface: "real-markets", locale: "en", depth: "pro", accountIdHash: ACCOUNT_A },
  now: NOW,
});
assert.equal(crossSurface.ok, false, "Shield Pro entitlement must not authorize Real Markets Pro");

const byIdCrossSurface = await verifyVlmPaidEntitlementById({
  entitlementId: shieldPro.id,
  allowedProductIds: ["vlm_pro_analysis_single"],
  accountIdHash: ACCOUNT_A,
  surface: "real-markets",
  depth: "pro",
  now: NOW,
} as Parameters<typeof verifyVlmPaidEntitlementById>[0] & { surface: "real-markets"; depth: "pro" });
assert.equal(byIdCrossSurface.ok, false, "direct entitlementId must remain bound to surface/depth");

const crossAccount = await verifyVlmPaidEntitlementById({
  entitlementId: shieldPro.id,
  allowedProductIds: ["vlm_pro_analysis_single"],
  accountIdHash: ACCOUNT_B,
  surface: "shield",
  depth: "pro",
  now: NOW,
} as Parameters<typeof verifyVlmPaidEntitlementById>[0] & { surface: "shield"; depth: "pro" });
assert.equal(crossAccount.ok, false, "guessed entitlement IDs must not cross accounts");

const wrongTier = await verifyVlmPaidEntitlementById({
  entitlementId: shieldPro.id,
  allowedProductIds: ["vlm_advanced_analysis_single"],
  accountIdHash: ACCOUNT_A,
  surface: "shield",
  depth: "advanced",
  now: NOW,
} as Parameters<typeof verifyVlmPaidEntitlementById>[0] & { surface: "shield"; depth: "advanced" });
assert.equal(wrongTier.ok, false, "Pro entitlement must not authorize Advanced");

clearMemoryEntitlements();
const revoked = record({ id: "ent-revoked", status: "revoked" });
seedMemoryEntitlementRecord(revoked);
const revokedVerdict = await verifyVlmPaidEntitlementById({
  entitlementId: revoked.id,
  allowedProductIds: ["vlm_pro_analysis_single"],
  accountIdHash: ACCOUNT_A,
  surface: "shield",
  depth: "pro",
  now: NOW,
} as Parameters<typeof verifyVlmPaidEntitlementById>[0] & { surface: "shield"; depth: "pro" });
assert.equal(revokedVerdict.ok, false, "revoked entitlement must fail closed");

clearMemoryEntitlements();
const expired = record({ id: "ent-expired", expiresAt: "2026-09-17T00:00:00.000Z" });
seedMemoryEntitlementRecord(expired);
const expiredVerdict = await verifyVlmPaidEntitlementById({
  entitlementId: expired.id,
  allowedProductIds: ["vlm_pro_analysis_single"],
  accountIdHash: ACCOUNT_A,
  surface: "shield",
  depth: "pro",
  now: NOW,
} as Parameters<typeof verifyVlmPaidEntitlementById>[0] & { surface: "shield"; depth: "pro" });
assert.equal(expiredVerdict.ok, false, "stale entitlement must fail closed");

clearMemoryEntitlements();
console.log("C14-P18 paid authorization scope regression: PASS");
