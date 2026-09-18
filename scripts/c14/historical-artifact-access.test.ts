import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeHistoricalCustomerArtifactAccess,
  evaluateHistoricalArtifactAccess,
} from "@/lib/reporting/historical-customer-artifact-access";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import type { AccountCustomerArtifactSnapshot } from "@/lib/reporting/account-customer-artifact-snapshot";
import {
  applyVlmPaidEntitlementLifecycleEvent,
  evaluateVlmPaidEntitlementLifecycleTransition,
  isVlmPaidEntitlementPrivileged,
} from "@/lib/commerce/vlm-entitlement-lifecycle";
import {
  clearMemoryEntitlements,
  seedMemoryEntitlementRecord,
  verifyVlmPaidAccountEntitlement,
} from "@/lib/commerce/vlm-entitlement-ledger";
import { hashVlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access-server";
import { normalizePaidContext } from "@/lib/commerce/vlm-paid-access";

const access=(requiredTier:"basic"|"pro"|"advanced",currentTier:"basic"|"pro"|"advanced",ownerMatches=true)=>
  evaluateHistoricalArtifactAccess({ownerMatches,requiredTier,currentTier,paidPolicyDefined:true});

test("owner downgrade matrix",()=>{
  assert.equal(access("advanced","pro").allowed,false);
  assert.equal(access("pro","pro").allowed,true);
  assert.equal(access("advanced","basic").allowed,false);
  assert.equal(access("pro","basic").allowed,false);
  assert.equal(access("basic","basic").allowed,true);
});
test("higher current tier reads lower history",()=>{
  assert.equal(access("pro","advanced").allowed,true);
  assert.equal(access("basic","advanced").allowed,true);
});
test("other account denied regardless of tier",()=>{
  for(const tier of ["basic","pro","advanced"] as const){
    const d=access(tier,"advanced",false); assert.equal(d.allowed,false); assert.equal(d.reason,"owner_mismatch");
  }
});
test("undefined paid non-Audit policy fails closed",()=>{
  const d=evaluateHistoricalArtifactAccess({ownerMatches:true,requiredTier:"pro",currentTier:"advanced",paidPolicyDefined:false});
  assert.equal(d.allowed,false); assert.equal(d.policyState,"undefined"); assert.equal(d.reason,"paid_surface_policy_undefined");
});
test("invalid tier fails closed",()=>{
  const d=evaluateHistoricalArtifactAccess({ownerMatches:true,requiredTier:null,currentTier:"advanced",paidPolicyDefined:true});
  assert.equal(d.allowed,false); assert.equal(d.reason,"artifact_tier_invalid");
});
test("refund/revoke/expiry lifecycle transitions remain distinct",()=>{
  const refund=evaluateVlmPaidEntitlementLifecycleTransition({currentStatus:"active",event:"refund"});
  assert.equal(refund.ok,true); if(refund.ok) assert.equal(refund.nextStatus,"refunded");
  const revoke=evaluateVlmPaidEntitlementLifecycleTransition({currentStatus:"active",event:"manual_revoke"});
  assert.equal(revoke.ok,true); if(revoke.ok) assert.equal(revoke.nextStatus,"revoked");
  const expire=evaluateVlmPaidEntitlementLifecycleTransition({currentStatus:"active",event:"expire"});
  assert.equal(expire.ok,true); if(expire.ok) assert.equal(expire.nextStatus,"expired");
});
test("terminal or time-expired entitlement is never privileged",()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  for(const status of ["refunded","revoked","expired"] as const) assert.equal(isVlmPaidEntitlementPrivileged({status,expiresAt:future}),false);
  assert.equal(isVlmPaidEntitlementPrivileged({status:"active",expiresAt:new Date(Date.now()-1000).toISOString()}),false);
});


test("runtime authorizer binds the immutable snapshot to account A, not account B", async () => {
  const snapshot = {
    accountIdHash: hashVelmereAccountBinding("account-A"),
    surface: "audit",
    requestedTier: "advanced",
    deliveredTier: "advanced",
    payload: { caseRef: "AUD-OWNER-A" },
  } as unknown as AccountCustomerArtifactSnapshot;

  let resolverCalled = false;
  const otherAccount = await authorizeHistoricalCustomerArtifactAccess({
    snapshot,
    accountId: "account-B",
    resolveAuditTier: async () => {
      resolverCalled = true;
      return "advanced";
    },
  });
  assert.equal(otherAccount.allowed, false);
  assert.equal(otherAccount.reason, "owner_mismatch");
  assert.equal(resolverCalled, false, "cross-account request must stop before entitlement lookup");

  const downgradedOwner = await authorizeHistoricalCustomerArtifactAccess({
    snapshot,
    accountId: "account-A",
    resolveAuditTier: async () => "pro",
  });
  assert.equal(downgradedOwner.allowed, false);
  assert.equal(downgradedOwner.reason, "current_entitlement_required");

  const currentOwner = await authorizeHistoricalCustomerArtifactAccess({
    snapshot,
    accountId: "account-A",
    resolveAuditTier: async () => "advanced",
  });
  assert.equal(currentOwner.allowed, true);
  assert.equal(currentOwner.reason, "current_entitlement_sufficient");
});


test("real memory ledger stops authorizing the same paid grant after refund/revoke", async () => {
  const accountIdHash = hashVelmereAccountBinding("ledger-account");
  const context = normalizePaidContext({ accountIdHash, auditCaseRef: "AUD-LEDGER01" }, "en");
  const contextHash = hashVlmPaidAccessContext(context);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const now = new Date().toISOString();

  for (const event of ["refund", "manual_revoke"] as const) {
    clearMemoryEntitlements();
    const entitlementId = "ent-c14-" + event;
    seedMemoryEntitlementRecord({
      id: entitlementId,
      stripeSessionId: "cs_test_c14_" + event,
      stripeCustomerId: "cus_test_c14",
      productId: "vlm_advanced_audit_human_review",
      accessScope: "audit_advanced_analysis",
      status: "active",
      contextHash,
      context,
      locale: "en",
      amountTotal: 0,
      currency: "eur",
      paymentStatus: "paid",
      source: "local_demo_verify",
      createdAt: now,
      updatedAt: now,
      expiresAt: future,
      auditQueueId: null,
    });

    const before = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_advanced_audit_human_review",
      context,
    });
    assert.equal(before.ok, true, event + " precondition");

    const transition = await applyVlmPaidEntitlementLifecycleEvent({
      entitlementId,
      eventId: "evt-c14-" + event,
      event,
      now: new Date(),
    });
    assert.equal(transition.ok, true, event + " transition");

    const after = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_advanced_audit_human_review",
      context,
    });
    assert.equal(after.ok, false, event + " must remove current paid authority");
  }
  clearMemoryEntitlements();
});
