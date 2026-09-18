import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { runBoundedServiceRoleRpc } from "@/lib/db/bounded-supabase-rpc";
import { parseAccountErasureExecutionReceipt } from "@/lib/privacy/account-data-lifecycle";
import {
  orchestrateApprovedAccountErasure,
  type AccountErasurePreparation,
  type AccountStorageObject,
} from "@/lib/privacy/account-erasure-orchestrator";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseStorageObjects(value: unknown): AccountStorageObject[] {
  if (!Array.isArray(value)) throw new Error("account_erasure_storage_manifest_invalid");
  return value.map((item) => {
    const row = record(item);
    const bucketId = String(row?.bucketId ?? row?.bucket_id ?? "");
    const name = String(row?.name ?? "");
    return { bucketId, name };
  });
}

function parsePreparation(value: unknown): AccountErasurePreparation {
  const row = record(value);
  if (!row) throw new Error("account_erasure_preparation_invalid");
  return {
    schemaVersion: String(row.schemaVersion ?? row.schema_version) as AccountErasurePreparation["schemaVersion"],
    requestId: String(row.requestId ?? row.request_id ?? ""),
    accountIdHash: String(row.accountIdHash ?? row.account_id_hash ?? ""),
    approvalIdHash: String(row.approvalIdHash ?? row.approval_id_hash ?? ""),
    supabaseSubject: String(row.supabaseSubject ?? row.supabase_subject ?? ""),
    storageObjects: parseStorageObjects(row.storageObjects ?? row.storage_objects ?? []),
    applicationDataState: String(row.applicationDataState ?? row.application_data_state) as AccountErasurePreparation["applicationDataState"],
  };
}

function requireServiceRoleClient() {
  const client = getSupabaseServiceRoleClient();
  if (!client) throw new Error("account_erasure_service_role_unavailable");
  return client;
}

/**
 * Internal/operator-only executor. User-facing erasure request routes do not call this
 * until an owner/legal approval row has been created by a controlled process.
 */
export async function executeApprovedAccountErasure(input: {
  requestId: string;
  approvalIdHash: string;
}) {
  const client = requireServiceRoleClient();
  return orchestrateApprovedAccountErasure(input, {
    async prepareApplicationErasure(args) {
      const { data } = await runBoundedServiceRoleRpc({
        operation: "account_erasure_prepare",
        rpcName: "velmere_execute_account_erasure_application_v1",
        args: {
          p_request_id: args.requestId,
          p_approval_id_hash: args.approvalIdHash,
        },
        deadlineMs: 12_000,
        clientOverride: client,
      });
      return parsePreparation(data);
    },
    async removeStorageObjects(bucketId, names) {
      const { error } = await client.storage.from(bucketId).remove([...names]);
      if (error) throw new Error("account_erasure_storage_remove_failed");
    },
    async deleteAuthUser(supabaseSubject) {
      const { error } = await client.auth.admin.deleteUser(supabaseSubject);
      if (error) throw new Error("account_erasure_auth_delete_failed");
    },
    async finalizeErasure(args) {
      const { data } = await runBoundedServiceRoleRpc({
        operation: "account_erasure_finalize",
        rpcName: "velmere_finalize_account_erasure_v1",
        args: {
          p_request_id: args.requestId,
          p_account_id_hash: args.accountIdHash,
          p_approval_id_hash: args.approvalIdHash,
          p_storage_state: args.storageState,
          p_auth_state: args.authState,
          p_storage_objects_removed: args.storageObjectsRemoved,
          p_failure_code: args.failureCode ?? null,
        },
        deadlineMs: 8_000,
        clientOverride: client,
      });
      return parseAccountErasureExecutionReceipt(data);
    },
  });
}
