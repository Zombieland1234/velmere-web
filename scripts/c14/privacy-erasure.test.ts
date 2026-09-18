import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_PRIVACY_DATA_INVENTORY,
  parseAccountErasureExecutionReceipt,
  summarizeAccountPrivacyInventory,
  type AccountErasureExecutionReceipt,
} from "../../lib/privacy/account-data-lifecycle.ts";
import {
  orchestrateApprovedAccountErasure,
  type AccountErasurePreparation,
} from "../../lib/privacy/account-erasure-orchestrator.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const subject = "22222222-2222-4222-8222-222222222222";
const accountIdHash = "a".repeat(64);
const approvalIdHash = "b".repeat(64);
const receiptSha = `sha256:${"c".repeat(64)}`;

function receipt(overrides: Partial<AccountErasureExecutionReceipt> = {}): AccountErasureExecutionReceipt {
  return {
    schemaVersion: "velmere.account-erasure-execution-receipt.v1",
    requestId,
    accountIdHash,
    approvalIdHash,
    applicationDataState: "DELETED_OR_PSEUDONYMIZED",
    storageState: "REMOVED",
    authState: "DELETED",
    storageObjectsRemoved: 0,
    deletedScopes: ["customer_artifacts"],
    pseudonymizedScopes: ["billing_identity"],
    retainedScopes: ["billing_references"],
    residualBlockers: ["platform_backups"],
    fullErasureClaimed: false,
    receiptSha256: receiptSha,
    completedAt: "2026-09-18T02:00:00.000Z",
    ...overrides,
  };
}

function preparation(storageObjects: Array<{ bucketId: string; name: string }> = []): AccountErasurePreparation {
  return {
    schemaVersion: "velmere.account-erasure-preparation.v1",
    requestId,
    accountIdHash,
    approvalIdHash,
    supabaseSubject: subject,
    storageObjects,
    applicationDataState: "DELETED_OR_PSEUDONYMIZED",
  };
}

test("inventory covers every requested privacy surface and never enables a full-erasure claim", () => {
  const systems = new Set(ACCOUNT_PRIVACY_DATA_INVENTORY.map((row) => row.system));
  for (const required of ["postgres","supabase_auth","supabase_storage","redis","browser","analytics","logs","stripe","backups"]) {
    assert.ok(systems.has(required as never), `missing inventory system ${required}`);
  }
  const summary = summarizeAccountPrivacyInventory();
  assert.equal(summary.fullErasureClaimAllowed, false);
  assert.ok(summary.liveObserved >= 4);
  assert.ok(summary.externalBoundaries >= 4);
});

test("execution receipt parser refuses a full-erasure claim", () => {
  const valid = parseAccountErasureExecutionReceipt(receipt());
  assert.equal(valid.fullErasureClaimed, false);
  assert.throws(
    () => parseAccountErasureExecutionReceipt({ ...receipt(), fullErasureClaimed: true }),
    /account_erasure_receipt_integrity_invalid/,
  );
});

test("orchestrator deletes Storage in provider-safe batches before Auth", async () => {
  const order: string[] = [];
  const storageObjects = Array.from({ length: 1001 }, (_, index) => ({
    bucketId: "customer-reports",
    name: `account/report-${index}.pdf`,
  }));
  let removed = 0;
  const result = await orchestrateApprovedAccountErasure({ requestId, approvalIdHash }, {
    async prepareApplicationErasure() {
      order.push("prepare");
      return preparation(storageObjects);
    },
    async removeStorageObjects(bucketId, names) {
      order.push(`storage:${bucketId}:${names.length}`);
      assert.ok(names.length <= 1000);
      removed += names.length;
    },
    async deleteAuthUser(id) {
      order.push("auth");
      assert.equal(id, subject);
      assert.equal(removed, 1001);
    },
    async finalizeErasure(input) {
      order.push("finalize");
      assert.equal(input.storageState, "REMOVED");
      assert.equal(input.authState, "DELETED");
      assert.equal(input.storageObjectsRemoved, 1001);
      return receipt({ storageObjectsRemoved: 1001 });
    },
  });
  assert.equal(result.status, "COMPLETED_WITH_RESIDUAL_RETENTION");
  assert.deepEqual(order, ["prepare","storage:customer-reports:1000","storage:customer-reports:1","auth","finalize"]);
});

test("Storage failure is fail-closed and Auth deletion is not attempted", async () => {
  let authCalls = 0;
  const result = await orchestrateApprovedAccountErasure({ requestId, approvalIdHash }, {
    async prepareApplicationErasure() {
      return preparation([{ bucketId: "reports", name: "one.pdf" }]);
    },
    async removeStorageObjects() {
      throw new Error("provider down");
    },
    async deleteAuthUser() {
      authCalls += 1;
    },
    async finalizeErasure(input) {
      assert.equal(input.storageState, "BLOCKED");
      assert.equal(input.authState, "PENDING");
      assert.match(input.failureCode ?? "", /^storage_/);
      return receipt({
        storageState: "BLOCKED",
        authState: "PENDING",
        completedAt: null,
      });
    },
  });
  assert.equal(authCalls, 0);
  assert.equal(result.status, "BLOCKED_STORAGE");
});

test("Auth failure preserves a retryable partial receipt without claiming completion", async () => {
  const result = await orchestrateApprovedAccountErasure({ requestId, approvalIdHash }, {
    async prepareApplicationErasure() {
      return preparation([]);
    },
    async removeStorageObjects() {
      assert.fail("no storage call expected");
    },
    async deleteAuthUser() {
      throw new Error("auth unavailable");
    },
    async finalizeErasure(input) {
      assert.equal(input.storageState, "NOT_PRESENT");
      assert.equal(input.authState, "BLOCKED");
      return receipt({
        storageState: "NOT_PRESENT",
        authState: "BLOCKED",
        completedAt: null,
      });
    },
  });
  assert.equal(result.status, "BLOCKED_AUTH");
  assert.equal(result.receipt.fullErasureClaimed, false);
});
