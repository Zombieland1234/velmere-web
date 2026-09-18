import assert from "node:assert/strict";

import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  verifyVlmPaidAccountEntitlement,
  verifyVlmPaidAccessEntitlement,
  verifyVlmPaidEntitlementById,
  type VlmPaidEntitlementRecord,
} from "@/lib/commerce/vlm-entitlement-ledger";
import { createVlmPaidAccessToken, hashVlmPaidAccessContext, verifyVlmPaidAccessToken } from "@/lib/commerce/vlm-paid-access-server";
import type { VlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access";

async function main() {
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

  const guessed = await verifyVlmPaidEntitlementById({
    entitlementId: "ent-does-not-exist",
    allowedProductIds: ["vlm_pro_analysis_single"],
    accountIdHash: ACCOUNT_A,
    surface: "shield",
    depth: "pro",
    now: NOW,
  });
  assert.equal(guessed.ok, false, "guessed entitlement IDs must fail closed");

  process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO = "true";
  const tokenContext: VlmPaidAccessContext = {
    surface: "shield",
    locale: "en",
    depth: "pro",
    accountIdHash: ACCOUNT_A,
  };

  const staleToken = createVlmPaidAccessToken({
    productId: "vlm_pro_analysis_single",
    context: tokenContext,
    sessionId: "session-stale",
    ttlMs: 10 * 60 * 1000,
    now: new Date("2026-09-17T00:00:00.000Z"),
  });
  assert.equal(staleToken.ok, true);
  if (!staleToken.ok) throw new Error(staleToken.error);
  const staleTokenVerdict = verifyVlmPaidAccessToken({
    token: staleToken.token,
    productId: "vlm_pro_analysis_single",
    context: tokenContext,
    now: NOW,
  });
  assert.equal(staleTokenVerdict.ok, false, "stale signed paid token must fail temporal validation");

  clearMemoryEntitlements();
  const liveToken = createVlmPaidAccessToken({
    productId: "vlm_pro_analysis_single",
    context: tokenContext,
    sessionId: "session-revoked",
    ttlMs: 60 * 60 * 1000,
    now: NOW,
  });
  assert.equal(liveToken.ok, true);
  if (!liveToken.ok) throw new Error(liveToken.error);
  const revokedForToken = {
    ...record({ id: "ent-token-revoked", status: "revoked", context: tokenContext }),
    stripeSessionId: "session-revoked",
    contextHash: hashVlmPaidAccessContext(tokenContext),
  };
  seedMemoryEntitlementRecord(revokedForToken);
  const revokedTokenVerdict = await verifyVlmPaidAccessEntitlement({
    token: liveToken.token,
    productId: "vlm_pro_analysis_single",
    context: tokenContext,
    now: NOW,
  });
  assert.equal(revokedTokenVerdict.ok, false, "a still-valid signed token must not revive a revoked entitlement");

  const concurrentRevoked = await Promise.all(Array.from({ length: 64 }, () => verifyVlmPaidEntitlementById({
    entitlementId: revokedForToken.id,
    allowedProductIds: ["vlm_pro_analysis_single"],
    accountIdHash: ACCOUNT_A,
    surface: "shield",
    depth: "pro",
    now: NOW,
  })));
  assert.equal(concurrentRevoked.every((verdict) => verdict.ok === false), true, "concurrent revoked entitlement checks must all deny");

  clearMemoryEntitlements();
  delete process.env.VELMERE_LOCAL_PAID_ACCESS_DEMO;
  console.log("C14-P18 paid authorization scope/token/concurrency regression: PASS");

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
