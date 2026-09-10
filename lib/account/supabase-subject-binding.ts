import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { runBoundedServiceRoleRpc, type SupabaseRpcClient } from "@/lib/db/bounded-supabase-rpc";

export type SupabaseSubjectBindingResult = {
  schemaVersion: "velmere.account-supabase-subject-binding.v1";
  status: "bound" | "already_bound" | "conflict" | "not_found";
  durable: true;
};


export type SupabaseSubjectBindingDependencies = {
  hasDurableStorage: () => boolean;
  getClient?: () => SupabaseRpcClient | null;
};

export const supabaseSubjectBindingDependencies: SupabaseSubjectBindingDependencies = {
  hasDurableStorage: hasSupabaseServiceRoleConfig,
};

const SAFE_ACCOUNT = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{5,119}$/;
const SAFE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_REQUEST = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,119}$/;
const SAFE_OPERATOR = /^operator_[a-f0-9]{20}$/;

function assertMatch(value: string, pattern: RegExp, code: string) {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(code);
  return normalized;
}

export async function bindVelmereAccountToSupabaseSubject(
  input: {
    accountId: string;
    supabaseSubject: string;
    requestId: string;
    operatorFingerprint: string;
  },
  dependencies: SupabaseSubjectBindingDependencies = supabaseSubjectBindingDependencies,
): Promise<SupabaseSubjectBindingResult> {
  if (!dependencies.hasDurableStorage()) throw new Error("supabase_subject_binding_storage_unavailable");
  const accountId = assertMatch(input.accountId, SAFE_ACCOUNT, "supabase_subject_binding_invalid_account_id");
  const supabaseSubject = assertMatch(
    input.supabaseSubject.toLowerCase(),
    SAFE_UUID,
    "supabase_subject_binding_invalid_subject",
  );
  const requestId = assertMatch(input.requestId, SAFE_REQUEST, "supabase_subject_binding_invalid_request_id");
  const operatorFingerprint = assertMatch(
    input.operatorFingerprint,
    SAFE_OPERATOR,
    "supabase_subject_binding_invalid_operator",
  );
  const { data } = await runBoundedServiceRoleRpc({
    operation: "account_subject_bind",
    rpcName: "velmere_bind_account_to_supabase_subject",
    args: {
      p_account_id: accountId,
      p_supabase_subject: supabaseSubject,
      p_request_id: requestId,
      p_operator_fingerprint: operatorFingerprint,
    },
    clientOverride: dependencies.getClient?.(),
  });
  const status = String(data ?? "not_found") as SupabaseSubjectBindingResult["status"];
  if (!["bound", "already_bound", "conflict", "not_found"].includes(status)) {
    throw new Error("supabase_subject_binding_invalid_result");
  }
  return {
    schemaVersion: "velmere.account-supabase-subject-binding.v1",
    status,
    durable: true,
  };
}
