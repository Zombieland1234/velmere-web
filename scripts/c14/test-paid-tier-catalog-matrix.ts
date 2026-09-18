import assert from "node:assert/strict";

import { hashVelmereAccountBinding, type VelmereResolvedAccount } from "@/lib/auth/account-session";
import { resolveVlmAdvancedOnlyAccess, type VlmAccessPurpose, type VlmAccessSurface } from "@/lib/commerce/vlm-advanced-only-access-policy";
import { hashVlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access-server";
import type { VlmPaidAccessContext, VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  type VlmPaidEntitlementRecord,
} from "@/lib/commerce/vlm-entitlement-ledger";
import { VLM_CANONICAL_CUSTOMER_PRODUCTS } from "@/lib/product/vlm-canonical-product-topology";

type TieredFamily = "audit" | "browser" | "shield" | "shield-pro" | "real-markets";
type Tier = "basic" | "pro" | "advanced";

const FAMILY_POLICY: Record<TieredFamily, {
  surface: VlmAccessSurface;
  purpose: VlmAccessPurpose;
  endpoint: string;
}> = {
  audit: { surface: "audit", purpose: "audit", endpoint: "/api/audit/report + /api/audit/report-pdf + audit-watch Pro PDF" },
  browser: { surface: "browser", purpose: "pdf", endpoint: "/api/search/lens-report + /api/market-integrity/report-pdf" },
  shield: { surface: "shield", purpose: "analysis", endpoint: "/api/market-integrity/brain + report + vlm" },
  "shield-pro": { surface: "shield-pro", purpose: "analysis", endpoint: "/api/market-integrity/vlm + Shield Pro paid workspace RPC" },
  "real-markets": { surface: "real-markets", purpose: "analysis", endpoint: "/api/market-integrity/real-markets + report/vlm" },
};

const STANDALONE_ENDPOINTS: Record<string, string> = {
  "shield-map": "/api/market-integrity/investigator",
  "market-impact": "shared market-integrity evidence/impact runtime (standalone free module)",
  "whale-watch": "/api/whale-watch",
  "angel": "/api/angel + /api/angel/stream",
  "risk-indicator": "shared market-integrity risk projection (standalone free module)",
};

function technicalProduct(tier: Exclude<Tier, "basic">, purpose: VlmAccessPurpose): VlmPaidProductId {
  if (tier === "pro") {
    if (purpose === "pdf") return "vlm_pro_pdf_single";
    if (purpose === "audit") return "vlm_pro_audit_review";
    return "vlm_pro_analysis_single";
  }
  if (purpose === "pdf") return "vlm_advanced_pdf_single";
  if (purpose === "audit") return "vlm_advanced_audit_human_review";
  return "vlm_advanced_analysis_single";
}

function entitlement(args: {
  id: string;
  accountIdHash: string;
  surface: VlmAccessSurface;
  depth: "pro" | "advanced";
  purpose: VlmAccessPurpose;
  status?: VlmPaidEntitlementRecord["status"];
  expiresAt?: string;
}): VlmPaidEntitlementRecord {
  const context: VlmPaidAccessContext = {
    surface: args.surface,
    locale: "en",
    depth: args.depth,
    accountIdHash: args.accountIdHash,
  };
  return {
    id: args.id,
    stripeSessionId: `cs_test_${args.id}`,
    stripeCustomerId: null,
    productId: technicalProduct(args.depth, args.purpose),
    accessScope: "c14-p18-test",
    status: args.status ?? "active",
    contextHash: hashVlmPaidAccessContext(context),
    context,
    locale: "en",
    amountTotal: 1,
    currency: "EUR",
    customerEmail: null,
    customerName: null,
    paymentStatus: "paid",
    source: "local_demo_verify",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    expiresAt: args.expiresAt ?? "2099-09-18T00:00:00.000Z",
    auditQueueId: null,
  };
}

async function gate(args: {
  surface: VlmAccessSurface;
  purpose: VlmAccessPurpose;
  depth: Tier;
  account?: VelmereResolvedAccount | null;
  entitlementId?: string;
}) {
  const headers = new Headers();
  if (args.entitlementId) headers.set("x-velmere-entitlement-id", args.entitlementId);
  return resolveVlmAdvancedOnlyAccess({
    request: new Request("https://velmere.invalid/api/c14", { headers }),
    purpose: args.purpose,
    depth: args.depth,
    surface: args.surface,
    locale: "en",
    account: args.account,
  });
}

async function main() {
  assert.equal(VLM_CANONICAL_CUSTOMER_PRODUCTS.length, 20, "canonical paid-tier matrix denominator changed");
  assert.equal(new Set(VLM_CANONICAL_CUSTOMER_PRODUCTS.map((row) => row.productId)).size, 20, "product IDs must be unique");

  const tiered = VLM_CANONICAL_CUSTOMER_PRODUCTS.filter((row) => row.tier !== null);
  const standalone = VLM_CANONICAL_CUSTOMER_PRODUCTS.filter((row) => row.tier === null);
  assert.equal(tiered.length, 15);
  assert.equal(standalone.length, 5);

  for (const product of standalone) {
    assert.ok(product.productId in STANDALONE_ENDPOINTS, `missing standalone endpoint mapping for ${product.productId}`);
    assert.match(product.commercialRole, /FREE/, `${product.productId} must not secretly become a paid tier`);
  }

  const accountA: VelmereResolvedAccount = {
    accountId: "c14-account-a",
    displayName: "C14 A",
    handle: "@c14a",
    provider: "preview",
    sessionSource: "server",
  };
  const accountB: VelmereResolvedAccount = {
    accountId: "c14-account-b",
    displayName: "C14 B",
    handle: "@c14b",
    provider: "preview",
    sessionSource: "server",
  };
  const accountAHash = hashVelmereAccountBinding(accountA.accountId);

  const matrix: Array<Record<string, string>> = [];

  for (const family of Object.keys(FAMILY_POLICY) as TieredFamily[]) {
    const policy = FAMILY_POLICY[family];

    clearMemoryEntitlements();
    const basic = await gate({ ...policy, depth: "basic", account: null });
    assert.equal(basic.ok, true, `${family} Basic must stay free`);

    const proNoAuth = await gate({ ...policy, depth: "pro", account: null });
    assert.equal(proNoAuth.ok, false, `${family} Pro must deny no-auth`);

    const proNoEntitlement = await gate({ ...policy, depth: "pro", account: accountA });
    assert.equal(proNoEntitlement.ok, false, `${family} Pro must deny authenticated Basic/no-entitlement account`);

    const proRecord = entitlement({
      id: `ent-${family}-pro`,
      accountIdHash: accountAHash,
      surface: policy.surface,
      depth: "pro",
      purpose: policy.purpose,
    });
    seedMemoryEntitlementRecord(proRecord);

    const proExact = await gate({ ...policy, depth: "pro", account: accountA });
    assert.equal(proExact.ok, true, `${family} Pro exact active entitlement must work`);

    const proCrossAccount = await gate({ ...policy, depth: "pro", account: accountB, entitlementId: proRecord.id });
    assert.equal(proCrossAccount.ok, false, `${family} Pro must deny cross-account entitlement ID`);

    const advancedWithOnlyPro = await gate({ ...policy, depth: "advanced", account: accountA, entitlementId: proRecord.id });
    assert.equal(advancedWithOnlyPro.ok, false, `${family} Pro entitlement must not promote to Advanced`);

    clearMemoryEntitlements();
    const advancedRecord = entitlement({
      id: `ent-${family}-advanced`,
      accountIdHash: accountAHash,
      surface: policy.surface,
      depth: "advanced",
      purpose: policy.purpose,
    });
    seedMemoryEntitlementRecord(advancedRecord);
    const advancedExact = await gate({ ...policy, depth: "advanced", account: accountA });
    assert.equal(advancedExact.ok, true, `${family} exact server-owned Advanced entitlement must remain technically verifiable`);

    clearMemoryEntitlements();
    const revoked = entitlement({
      id: `ent-${family}-revoked`,
      accountIdHash: accountAHash,
      surface: policy.surface,
      depth: "pro",
      purpose: policy.purpose,
      status: "revoked",
    });
    seedMemoryEntitlementRecord(revoked);
    const revokedVerdict = await gate({ ...policy, depth: "pro", account: accountA, entitlementId: revoked.id });
    assert.equal(revokedVerdict.ok, false, `${family} revoked entitlement must deny`);

    const familyProducts = tiered.filter((row) => row.family === family);
    assert.deepEqual(familyProducts.map((row) => row.tier), ["basic", "pro", "advanced"], `${family} canonical tier rows changed`);
    for (const row of familyProducts) {
      matrix.push({
        product: row.productId,
        tier: row.tier ?? "none",
        endpoint: policy.endpoint,
        noAuth: row.tier === "basic" ? "ALLOW_FREE" : "DENY",
        Basic: row.tier === "basic" ? "ALLOW_FREE" : "DENY",
        Pro: row.tier === "pro" ? "ALLOW_EXACT_SCOPE" : row.tier === "basic" ? "ALLOW_FREE" : "DENY",
        Advanced: row.tier === "advanced" ? "ALLOW_EXACT_SERVER_ENTITLEMENT" : row.tier === "basic" ? "ALLOW_FREE" : "NO_IMPLICIT_PROMOTION",
        revoked: row.tier === "basic" ? "REVOCATION_NA_FREE" : "DENY",
      });
    }
  }

  for (const row of standalone) {
    matrix.push({
      product: row.productId,
      tier: "none",
      endpoint: STANDALONE_ENDPOINTS[row.productId],
      noAuth: "NO_PAID_ENTITLEMENT_REQUIRED",
      Basic: "NO_PAID_ENTITLEMENT_REQUIRED",
      Pro: "NO_PAID_ENTITLEMENT_REQUIRED",
      Advanced: "NO_PAID_ENTITLEMENT_REQUIRED",
      revoked: "REVOCATION_NA_FREE",
    });
  }

  assert.equal(matrix.length, 20);
  console.log(JSON.stringify({ schema: "c14-p18-product-matrix-v1", rows: matrix }, null, 2));
  console.log("C14-P18 canonical 20-product paid-tier matrix: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
