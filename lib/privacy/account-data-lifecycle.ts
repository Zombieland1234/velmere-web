export const ACCOUNT_PRIVACY_INVENTORY_SCHEMA = "velmere.account-privacy-inventory.v1" as const;
export const ACCOUNT_ERASURE_RECEIPT_SCHEMA = "velmere.account-erasure-execution-receipt.v1" as const;

export type PrivacyDataClass =
  | "identity"
  | "auth"
  | "customer_content"
  | "billing"
  | "security"
  | "analytics"
  | "cache"
  | "backup"
  | "audit";

export type PrivacyErasureAction =
  | "hard_delete"
  | "pseudonymize"
  | "provider_delete"
  | "bounded_ttl"
  | "retain_under_policy"
  | "not_user_specific";

export type PrivacyInventoryEntry = Readonly<{
  id: string;
  system: "postgres" | "supabase_auth" | "supabase_storage" | "redis" | "browser" | "analytics" | "logs" | "stripe" | "backups";
  location: string;
  dataClass: readonly PrivacyDataClass[];
  identityKeys: readonly string[];
  exportCoverage: "included" | "metadata_only" | "external" | "not_applicable";
  erasureAction: PrivacyErasureAction;
  sourceStatus: "live_observed" | "source_declared" | "runtime_observed" | "external_boundary";
  notes: string;
}>;

/**
 * Technical inventory only. Legal retention periods are deliberately not invented here.
 * "retain_under_policy" always requires an owner/legal decision before execution.
 */
export const ACCOUNT_PRIVACY_DATA_INVENTORY: readonly PrivacyInventoryEntry[] = [
  {
    id: "auth-user",
    system: "supabase_auth",
    location: "auth.users + auth.identities + sessions/refresh/MFA/OAuth/WebAuthn children",
    dataClass: ["identity", "auth", "security"],
    identityKeys: ["auth.users.id", "email", "phone"],
    exportCoverage: "metadata_only",
    erasureAction: "provider_delete",
    sourceStatus: "live_observed",
    notes: "Revoke sessions first; delete owned Storage objects before Auth user deletion.",
  },
  {
    id: "account-subject-binding",
    system: "postgres",
    location: "public.velmere_account_supabase_subject_bindings + binding_requests",
    dataClass: ["identity", "auth"],
    identityKeys: ["account_id", "supabase_subject"],
    exportCoverage: "included",
    erasureAction: "hard_delete",
    sourceStatus: "live_observed",
    notes: "Binding is required until Storage/Auth cleanup resolves; Auth deletion cascades the durable binding.",
  },
  {
    id: "customer-artifacts",
    system: "postgres",
    location: "public.velmere_customer_artifact_snapshots + velmere_customer_artifact_pdf_blobs",
    dataClass: ["customer_content"],
    identityKeys: ["account_id", "account_id_hash", "report_id"],
    exportCoverage: "metadata_only",
    erasureAction: "hard_delete",
    sourceStatus: "live_observed",
    notes: "Immutable guards expose an explicit authorized-erasure path; report bytes are not duplicated into the bounded JSON export.",
  },
  {
    id: "audit-basic-artifacts",
    system: "postgres",
    location: "public.velmere_audit_basic_report_artifacts + velmere_audit_basic_report_backups",
    dataClass: ["customer_content", "backup"],
    identityKeys: ["account_id_hash", "case_ref", "report_id"],
    exportCoverage: "metadata_only",
    erasureAction: "hard_delete",
    sourceStatus: "live_observed",
    notes: "Application erasure removes both active artifact and application-level backup only after legal-hold clearance.",
  },
  {
    id: "audit-intake",
    system: "postgres",
    location: "public.velmere_audit_intake_cases",
    dataClass: ["identity", "customer_content", "billing", "audit"],
    identityKeys: ["account_id", "account_email", "checkout_session_id", "payment_event_id"],
    exportCoverage: "included",
    erasureAction: "pseudonymize",
    sourceStatus: "live_observed",
    notes: "Direct account/email fields are pseudonymized; payment/audit references and opaque evidence remain retained pending legal policy.",
  },
  {
    id: "source-commerce-records",
    system: "postgres",
    location: "velmere_orders / paid_entitlements / audit_human_queue and related source-declared commerce tables",
    dataClass: ["identity", "billing", "audit"],
    identityKeys: ["customer_email", "customer_phone", "stripe_session_id", "stripe_customer_id"],
    exportCoverage: "external",
    erasureAction: "pseudonymize",
    sourceStatus: "source_declared",
    notes: "These tables are declared in the repository monolith but were not present in the observed live schema during C14-P15.",
  },
  {
    id: "supabase-storage",
    system: "supabase_storage",
    location: "storage.objects",
    dataClass: ["customer_content", "identity"],
    identityKeys: ["owner", "owner_id", "bucket_id", "name"],
    exportCoverage: "metadata_only",
    erasureAction: "provider_delete",
    sourceStatus: "live_observed",
    notes: "Object bytes must be removed via Storage API, never by SQL deletion of storage.objects.",
  },
  {
    id: "redis-rate-limit",
    system: "redis",
    location: "velmere:rl:v2:<sha256>",
    dataClass: ["security", "cache"],
    identityKeys: ["one-way hashed rate-limit boundary input"],
    exportCoverage: "not_applicable",
    erasureAction: "bounded_ttl",
    sourceStatus: "runtime_observed",
    notes: "Keys are not reversibly account-addressable and expire no later than the configured window plus 30 seconds; current maximum window is 24h.",
  },
  {
    id: "browser-private-account",
    system: "browser",
    location: "private-account-ephemeral-store + legacy velmere:pass45xx localStorage keys",
    dataClass: ["customer_content", "cache"],
    identityKeys: ["per-tab private account buckets"],
    exportCoverage: "not_applicable",
    erasureAction: "hard_delete",
    sourceStatus: "runtime_observed",
    notes: "In-memory buckets and legacy localStorage keys are purged client-side after a deletion request is accepted.",
  },
  {
    id: "market-caches",
    system: "postgres",
    location: "instrument/market/kline provider caches",
    dataClass: ["cache"],
    identityKeys: [],
    exportCoverage: "not_applicable",
    erasureAction: "not_user_specific",
    sourceStatus: "runtime_observed",
    notes: "Current cache keys are market/provider identities rather than account identities.",
  },
  {
    id: "vercel-analytics",
    system: "analytics",
    location: "window.va / hosting analytics provider",
    dataClass: ["analytics"],
    identityKeys: ["provider-defined request/device metadata"],
    exportCoverage: "external",
    erasureAction: "retain_under_policy",
    sourceStatus: "external_boundary",
    notes: "Repository code does not expose a provider DSAR/delete API; provider retention and deletion require infrastructure policy.",
  },
  {
    id: "hosting-logs",
    system: "logs",
    location: "hosting/runtime/operator logs",
    dataClass: ["security", "audit"],
    identityKeys: ["request metadata; redacted payloads where the safe logger is used"],
    exportCoverage: "external",
    erasureAction: "retain_under_policy",
    sourceStatus: "external_boundary",
    notes: "Safe formatting exists, but the repository does not control all platform log retention or provider-side erasure.",
  },
  {
    id: "stripe",
    system: "stripe",
    location: "Stripe customer/payment/subscription/dispute records + local billing references",
    dataClass: ["billing", "identity", "audit"],
    identityKeys: ["stripe customer/session/payment/subscription ids"],
    exportCoverage: "external",
    erasureAction: "retain_under_policy",
    sourceStatus: "external_boundary",
    notes: "Do not destroy accounting, tax, refund or dispute evidence without an approved retention policy; external Stripe erasure is not automated by this patch.",
  },
  {
    id: "platform-backups",
    system: "backups",
    location: "Supabase/PostgreSQL platform backups and restore snapshots",
    dataClass: ["backup"],
    identityKeys: ["historical database state"],
    exportCoverage: "external",
    erasureAction: "retain_under_policy",
    sourceStatus: "external_boundary",
    notes: "Application code cannot surgically erase historical provider backups; restore runbooks must replay deletion tombstones/receipts where available.",
  },
] as const;

export type AccountErasureExecutionReceipt = Readonly<{
  schemaVersion: typeof ACCOUNT_ERASURE_RECEIPT_SCHEMA;
  requestId: string;
  accountIdHash: string;
  approvalIdHash: string;
  applicationDataState: "DELETED_OR_PSEUDONYMIZED";
  storageState: "NOT_PRESENT" | "REMOVED" | "BLOCKED";
  authState: "PENDING" | "DELETED" | "BLOCKED";
  storageObjectsRemoved: number;
  deletedScopes: readonly string[];
  pseudonymizedScopes: readonly string[];
  retainedScopes: readonly string[];
  residualBlockers: readonly string[];
  fullErasureClaimed: false;
  receiptSha256: string;
  completedAt: string | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_64 = /^[a-f0-9]{64}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown, maximum = 64) {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== "string" || item.length > 160)) {
    throw new Error("account_erasure_receipt_array_invalid");
  }
  return value as string[];
}

export function parseAccountErasureExecutionReceipt(value: unknown): AccountErasureExecutionReceipt {
  const row = asRecord(value);
  if (!row) throw new Error("account_erasure_receipt_invalid");
  const completedAt = row.completedAt ?? row.completed_at;
  const storageRemoved = Number(row.storageObjectsRemoved ?? row.storage_objects_removed);
  const fullErasureClaimed = row.fullErasureClaimed ?? row.full_erasure_claimed;
  const receipt: AccountErasureExecutionReceipt = {
    schemaVersion: String(row.schemaVersion ?? row.schema_version) as typeof ACCOUNT_ERASURE_RECEIPT_SCHEMA,
    requestId: String(row.requestId ?? row.request_id ?? ""),
    accountIdHash: String(row.accountIdHash ?? row.account_id_hash ?? ""),
    approvalIdHash: String(row.approvalIdHash ?? row.approval_id_hash ?? ""),
    applicationDataState: String(row.applicationDataState ?? row.application_data_state) as AccountErasureExecutionReceipt["applicationDataState"],
    storageState: String(row.storageState ?? row.storage_state) as AccountErasureExecutionReceipt["storageState"],
    authState: String(row.authState ?? row.auth_state) as AccountErasureExecutionReceipt["authState"],
    storageObjectsRemoved: storageRemoved,
    deletedScopes: stringArray(row.deletedScopes ?? row.deleted_scopes ?? []),
    pseudonymizedScopes: stringArray(row.pseudonymizedScopes ?? row.pseudonymized_scopes ?? []),
    retainedScopes: stringArray(row.retainedScopes ?? row.retained_scopes ?? []),
    residualBlockers: stringArray(row.residualBlockers ?? row.residual_blockers ?? []),
    fullErasureClaimed: false,
    receiptSha256: String(row.receiptSha256 ?? row.receipt_sha256 ?? ""),
    completedAt: completedAt === null || completedAt === undefined ? null : String(completedAt),
  };
  if (receipt.schemaVersion !== ACCOUNT_ERASURE_RECEIPT_SCHEMA
      || !UUID.test(receipt.requestId)
      || !HEX_64.test(receipt.accountIdHash)
      || !HEX_64.test(receipt.approvalIdHash)
      || receipt.applicationDataState !== "DELETED_OR_PSEUDONYMIZED"
      || !["NOT_PRESENT", "REMOVED", "BLOCKED"].includes(receipt.storageState)
      || !["PENDING", "DELETED", "BLOCKED"].includes(receipt.authState)
      || !Number.isSafeInteger(receipt.storageObjectsRemoved)
      || receipt.storageObjectsRemoved < 0
      || fullErasureClaimed !== false
      || !SHA256.test(receipt.receiptSha256)
      || (receipt.completedAt !== null && !Number.isFinite(Date.parse(receipt.completedAt)))) {
    throw new Error("account_erasure_receipt_integrity_invalid");
  }
  return receipt;
}

export function summarizeAccountPrivacyInventory(entries = ACCOUNT_PRIVACY_DATA_INVENTORY) {
  return {
    schemaVersion: ACCOUNT_PRIVACY_INVENTORY_SCHEMA,
    total: entries.length,
    liveObserved: entries.filter((entry) => entry.sourceStatus === "live_observed").length,
    externalBoundaries: entries.filter((entry) => entry.sourceStatus === "external_boundary").length,
    hardDeleteOrProviderDelete: entries.filter((entry) => entry.erasureAction === "hard_delete" || entry.erasureAction === "provider_delete").length,
    pseudonymized: entries.filter((entry) => entry.erasureAction === "pseudonymize").length,
    retainedUnderPolicy: entries.filter((entry) => entry.erasureAction === "retain_under_policy").length,
    fullErasureClaimAllowed: false as const,
  };
}
