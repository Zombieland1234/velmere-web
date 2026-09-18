import type { AccountErasureExecutionReceipt } from "./account-data-lifecycle.ts";

export type AccountStorageObject = Readonly<{
  bucketId: string;
  name: string;
}>;

export type AccountErasurePreparation = Readonly<{
  schemaVersion: "velmere.account-erasure-preparation.v1";
  requestId: string;
  accountIdHash: string;
  approvalIdHash: string;
  supabaseSubject: string;
  storageObjects: readonly AccountStorageObject[];
  applicationDataState: "DELETED_OR_PSEUDONYMIZED";
}>;

export type AccountErasureFinalizationInput = Readonly<{
  requestId: string;
  accountIdHash: string;
  approvalIdHash: string;
  storageState: "NOT_PRESENT" | "REMOVED" | "BLOCKED";
  authState: "PENDING" | "DELETED" | "BLOCKED";
  storageObjectsRemoved: number;
  failureCode?: string;
}>;

export type AccountErasureOrchestratorDependencies = Readonly<{
  prepareApplicationErasure: (input: { requestId: string; approvalIdHash: string }) => Promise<AccountErasurePreparation>;
  removeStorageObjects: (bucketId: string, names: readonly string[]) => Promise<void>;
  deleteAuthUser: (supabaseSubject: string) => Promise<void>;
  finalizeErasure: (input: AccountErasureFinalizationInput) => Promise<AccountErasureExecutionReceipt>;
}>;

export type AccountErasureOrchestrationResult = Readonly<{
  status: "COMPLETED_WITH_RESIDUAL_RETENTION" | "BLOCKED_STORAGE" | "BLOCKED_AUTH";
  receipt: AccountErasureExecutionReceipt;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64 = /^[a-f0-9]{64}$/;
const STORAGE_BUCKET = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function assertPreparation(value: AccountErasurePreparation, requestId: string, approvalIdHash: string) {
  if (value.schemaVersion !== "velmere.account-erasure-preparation.v1"
      || value.requestId !== requestId
      || !UUID.test(value.requestId)
      || !HEX_64.test(value.accountIdHash)
      || value.approvalIdHash !== approvalIdHash
      || !HEX_64.test(value.approvalIdHash)
      || !UUID.test(value.supabaseSubject)
      || value.applicationDataState !== "DELETED_OR_PSEUDONYMIZED"
      || value.storageObjects.length > 100_000) {
    throw new Error("account_erasure_preparation_invalid");
  }
  for (const item of value.storageObjects) {
    if (!STORAGE_BUCKET.test(item.bucketId)
        || !item.name
        || item.name.length > 1024
        || item.name.includes("\0")) {
      throw new Error("account_erasure_storage_manifest_invalid");
    }
  }
}

function batches<T>(items: readonly T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size) as T[]);
  }
  return out;
}

function storageByBucket(items: readonly AccountStorageObject[]) {
  const grouped = new Map<string, string[]>();
  for (const item of items) {
    const bucket = grouped.get(item.bucketId) ?? [];
    bucket.push(item.name);
    grouped.set(item.bucketId, bucket);
  }
  return grouped;
}

function safeFailureCode(error: unknown, prefix: string) {
  const name = error instanceof Error ? error.name : "unknown";
  return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40)}`;
}

/**
 * Executes only after an owner/legal approval has already been durably recorded.
 * It intentionally cannot claim "full erasure": the receipt always retains residual scopes
 * such as legally retained billing/audit references and provider/platform backup boundaries.
 */
export async function orchestrateApprovedAccountErasure(input: {
  requestId: string;
  approvalIdHash: string;
}, dependencies: AccountErasureOrchestratorDependencies): Promise<AccountErasureOrchestrationResult> {
  if (!UUID.test(input.requestId) || !HEX_64.test(input.approvalIdHash)) {
    throw new Error("account_erasure_execution_input_invalid");
  }

  const prepared = await dependencies.prepareApplicationErasure(input);
  assertPreparation(prepared, input.requestId, input.approvalIdHash);

  let removed = 0;
  const grouped = storageByBucket(prepared.storageObjects);
  try {
    for (const [bucketId, names] of grouped) {
      for (const chunk of batches(names, 1_000)) {
        await dependencies.removeStorageObjects(bucketId, chunk);
        removed += chunk.length;
      }
    }
  } catch (error) {
    const receipt = await dependencies.finalizeErasure({
      requestId: prepared.requestId,
      accountIdHash: prepared.accountIdHash,
      approvalIdHash: prepared.approvalIdHash,
      storageState: "BLOCKED",
      authState: "PENDING",
      storageObjectsRemoved: removed,
      failureCode: safeFailureCode(error, "storage"),
    });
    return { status: "BLOCKED_STORAGE", receipt };
  }

  const storageState = prepared.storageObjects.length === 0 ? "NOT_PRESENT" as const : "REMOVED" as const;
  try {
    await dependencies.deleteAuthUser(prepared.supabaseSubject);
  } catch (error) {
    const receipt = await dependencies.finalizeErasure({
      requestId: prepared.requestId,
      accountIdHash: prepared.accountIdHash,
      approvalIdHash: prepared.approvalIdHash,
      storageState,
      authState: "BLOCKED",
      storageObjectsRemoved: removed,
      failureCode: safeFailureCode(error, "auth"),
    });
    return { status: "BLOCKED_AUTH", receipt };
  }

  const receipt = await dependencies.finalizeErasure({
    requestId: prepared.requestId,
    accountIdHash: prepared.accountIdHash,
    approvalIdHash: prepared.approvalIdHash,
    storageState,
    authState: "DELETED",
    storageObjectsRemoved: removed,
  });
  return { status: "COMPLETED_WITH_RESIDUAL_RETENTION", receipt };
}
