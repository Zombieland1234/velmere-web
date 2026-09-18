import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";

import {
  hashVelmereAccountBinding,
  type VelmereResolvedAccount,
} from "../../lib/auth/account-session";
import {
  hashVlmPaidAccessContext,
} from "../../lib/commerce/vlm-paid-access-server";
import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  verifyVlmPaidEntitlementById,
  type VlmPaidEntitlementRecord,
} from "../../lib/commerce/vlm-entitlement-ledger";
import {
  normalizePaidContext,
  type VlmPaidAccessContext,
  type VlmPaidProductId,
} from "../../lib/commerce/vlm-paid-access";
import {
  resolveVlmAdvancedOnlyAccess,
} from "../../lib/commerce/vlm-advanced-only-access-policy";
import {
  applyVlmPaidEntitlementLifecycleEvent,
  evaluateVlmPaidEntitlementLifecycleTransition,
} from "../../lib/commerce/vlm-entitlement-lifecycle";
import { resolveCurrentAuditAccess } from "../../lib/security/current-audit-access";
import { buildPass2576AuditPermissionParserReport } from "../../lib/security/audit-permission-parser";
import { POST as restoreBasicAuditReport } from "../../app/api/audit/basic/report/restore/route";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const savedEnv = new Map<string, string | undefined>();

const accountA: VelmereResolvedAccount = {
  accountId: "server:c14-p11-user-a",
  displayName: "C14 P11 A",
  handle: "@c14.p11.a",
  provider: "server",
  sessionSource: "server",
};
const accountB: VelmereResolvedAccount = {
  accountId: "server:c14-p11-user-b",
  displayName: "C14 P11 B",
  handle: "@c14.p11.b",
  provider: "server",
  sessionSource: "server",
};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  clearMemoryEntitlements();
});

afterEach(() => {
  clearMemoryEntitlements();
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

function entitlement(args: {
  id: string;
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
  status?: VlmPaidEntitlementRecord["status"];
}): VlmPaidEntitlementRecord {
  const normalized = normalizePaidContext(args.context, args.context.locale ?? "en");
  return {
    id: args.id,
    stripeSessionId: `cs_test_${args.id}`,
    stripeCustomerId: null,
    productId: args.productId,
    accessScope: "c14-p11-test",
    status: args.status ?? "active",
    contextHash: hashVlmPaidAccessContext(normalized),
    context: normalized,
    locale: normalized.locale,
    amountTotal: 0,
    currency: "eur",
    customerEmail: null,
    customerName: null,
    paymentStatus: "paid",
    source: "local_demo_verify",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    expiresAt: "2027-09-18T00:00:00.000Z",
    auditQueueId: null,
  };
}

test("Pro remains available only through a matching current server entitlement", async () => {
  const accountIdHash = hashVelmereAccountBinding(accountA.accountId);
  const context = {
    surface: "shield" as const,
    locale: "en" as const,
    depth: "pro" as const,
    assetId: "asset-c14-pro",
    accountIdHash,
  };
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_pro",
    productId: "vlm_pro_analysis_single",
    context,
  }));

  const verdict = await resolveVlmAdvancedOnlyAccess({
    request: new Request("http://localhost/api/c14-p11"),
    purpose: "analysis",
    depth: "pro",
    surface: "shield",
    locale: "en",
    assetId: "asset-c14-pro",
    account: accountA,
  });

  assert.equal(verdict.ok, true);
  if (!verdict.ok) return;
  assert.equal(verdict.depth, "pro");
  assert.equal(verdict.entitlement.entitlement.id, "ent_c14_pro");
});

test("Advanced NOT_FOR_SALE cannot be resurrected by a stale stored entitlement", async () => {
  const accountIdHash = hashVelmereAccountBinding(accountA.accountId);
  const context = {
    surface: "shield" as const,
    locale: "en" as const,
    depth: "advanced" as const,
    assetId: "asset-c14-advanced",
    accountIdHash,
  };
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_advanced_legacy",
    productId: "vlm_advanced_analysis_single",
    context,
  }));

  const verdict = await resolveVlmAdvancedOnlyAccess({
    request: new Request("http://localhost/api/c14-p11"),
    purpose: "analysis",
    depth: "advanced",
    surface: "shield",
    locale: "en",
    assetId: "asset-c14-advanced",
    account: accountA,
  });

  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, "product_not_for_sale");
  assert.equal(verdict.headers["x-velmere-access-decision"], "NOT_FOR_SALE");
});

test("audit report regeneration ignores legacy Advanced entitlement while Advanced is NOT_FOR_SALE", async () => {
  const caseRef = "AUD-C14P11A001";
  const accountIdHash = hashVelmereAccountBinding(accountA.accountId);
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_audit_advanced_legacy",
    productId: "vlm_advanced_audit_human_review",
    context: { locale: "en", accountIdHash, auditCaseRef: caseRef },
  }));

  const access = await resolveCurrentAuditAccess(
    new NextRequest(`http://localhost/api/audit/report?caseRef=${caseRef}`),
    accountA.accountId,
    caseRef,
  );

  assert.equal(access.clientTier, "basic");
  assert.equal(access.entitlementId, undefined);
});

test("audit report regeneration still accepts a matching Pro beta entitlement", async () => {
  const caseRef = "AUD-C14P11P001";
  const accountIdHash = hashVelmereAccountBinding(accountA.accountId);
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_audit_pro",
    productId: "vlm_pro_audit_review",
    context: { locale: "en", accountIdHash, auditCaseRef: caseRef },
  }));

  const access = await resolveCurrentAuditAccess(
    new NextRequest(`http://localhost/api/audit/report?caseRef=${caseRef}`),
    accountA.accountId,
    caseRef,
  );

  assert.equal(access.clientTier, "pro");
  assert.equal(access.entitlementId, "ent_c14_audit_pro");
});

test("entitlement by id is account and case bound", async () => {
  const caseRef = "AUD-C14P11OWN1";
  const accountAHash = hashVelmereAccountBinding(accountA.accountId);
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_owner_bound",
    productId: "vlm_pro_audit_review",
    context: { locale: "en", accountIdHash: accountAHash, auditCaseRef: caseRef },
  }));

  const otherAccount = await verifyVlmPaidEntitlementById({
    entitlementId: "ent_c14_owner_bound",
    allowedProductIds: ["vlm_pro_audit_review"],
    accountIdHash: hashVelmereAccountBinding(accountB.accountId),
    auditCaseRef: caseRef,
  });
  assert.equal(otherAccount.ok, false);
  if (!otherAccount.ok) assert.equal(otherAccount.error, "entitlement_account_mismatch");

  const otherCase = await verifyVlmPaidEntitlementById({
    entitlementId: "ent_c14_owner_bound",
    allowedProductIds: ["vlm_pro_audit_review"],
    accountIdHash: accountAHash,
    auditCaseRef: "AUD-C14P11OWN2",
  });
  assert.equal(otherCase.ok, false);
  if (!otherCase.ok) assert.equal(otherCase.error, "entitlement_audit_case_mismatch");
});

test("revoke is terminal for access and restore cannot revive a revoked entitlement", async () => {
  const accountIdHash = hashVelmereAccountBinding(accountA.accountId);
  seedMemoryEntitlementRecord(entitlement({
    id: "ent_c14_revoke",
    productId: "vlm_pro_analysis_single",
    context: { surface: "shield", locale: "en", depth: "pro", accountIdHash },
  }));

  const revoked = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14_revoke",
    eventId: "evt-c14-revoke",
    event: "manual_revoke",
    now: new Date("2026-09-18T01:00:00.000Z"),
  });
  assert.equal(revoked.ok, true);
  if (revoked.ok) assert.equal(revoked.nextStatus, "revoked");

  const restore = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14_revoke",
    eventId: "evt-c14-restore",
    event: "restore",
    now: new Date("2026-09-18T01:01:00.000Z"),
  });
  assert.equal(restore.ok, false);
  if (!restore.ok) assert.equal(restore.error, "invalid_entitlement_state_transition");

  assert.deepEqual(
    evaluateVlmPaidEntitlementLifecycleTransition({ currentStatus: "expired", event: "restore" }),
    { ok: true, previousStatus: "expired", nextStatus: "active", idempotent: false },
  );
});

test("durable lifecycle response parser rejects an impossible restore transition", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://c14-p11.invalid.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "c14-p11-test-service-role-key-not-used";
  const fakeRpc = async () => ({
    data: {
      ok: true,
      event_type: "restore",
      previous_status: "revoked",
      next_status: "active",
      idempotent: false,
      entitlement_id_hash: "a".repeat(64),
      event_id_hash: "b".repeat(64),
    },
    error: null,
  });

  const result = await applyVlmPaidEntitlementLifecycleEvent({
    entitlementId: "ent_c14_impossible_restore",
    eventId: "evt-c14-impossible-restore",
    event: "restore",
    dependencies: { rpc: fakeRpc as never },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "invalid_lifecycle_rpc_result");
});

test("caller-forged verifiedStaticEvidence cannot create permission findings", () => {
  const contractAddress = "0x000000000000000000000000000000000000c141";
  const report = buildPass2576AuditPermissionParserReport({
    locale: "en",
    chain: "ethereum",
    contractAddress,
    verifiedStaticEvidence: {
      contractAddress,
      chain: "ethereum",
      provider: "caller-forged",
      observedAt: "2026-09-18T00:00:00.000Z",
      responseDigest: "a".repeat(64),
      sourceText: "pragma solidity ^0.8.20; contract Forged { function mint(address,uint256) external {} function upgradeTo(address) external {} }",
    },
  });

  const mint = report.signals.find((signal) => signal.id === "mint-supply");
  const upgrade = report.signals.find((signal) => signal.id === "upgrade-proxy");
  assert.ok(mint);
  assert.ok(upgrade);
  assert.notEqual(mint.state, "detected");
  assert.notEqual(upgrade.state, "detected");
  assert.equal(report.summary.detected, 0);
});

test("basic report restore rejects an oversized JSON body before parsing or bridge access", async () => {
  const request = new NextRequest("http://localhost/api/audit/basic/report/restore?caseRef=AUD-ABCDEF1234", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ backupId: "x".repeat(20_000) }),
  });
  const response = await restoreBasicAuditReport(request);
  assert.equal(response.status, 413);
});

test("basic report restore rejects duplicate JSON keys at the strict parser boundary", async () => {
  const good = `abk_${"a".repeat(64)}`;
  const request = new NextRequest("http://localhost/api/audit/basic/report/restore?caseRef=AUD-ABCDEF1234", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: `{"backupId":"${good}","backupId":"bad"}`,
  });
  const response = await restoreBasicAuditReport(request);
  const body = await response.json() as { error?: string };
  assert.equal(response.status, 400);
  assert.equal(body.error, "Duplicate JSON object key.");
});
