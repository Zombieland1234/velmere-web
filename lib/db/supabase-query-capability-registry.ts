export type SupabaseQueryCapability =
  | "public_read"
  | "user_rls"
  | "service_role_write"
  | "central_boundary";

export type SupabaseQueryRegistryEntry = {
  file: string;
  capability: SupabaseQueryCapability;
  family: "account" | "admin" | "ai" | "audit" | "commerce" | "community" | "core" | "fulfilment" | "market" | "payments" | "products";
  access: "read" | "write" | "read_write" | "factory";
  customerOwned: boolean;
  status: "approved" | "migration_required" | "central_only";
  rationale: string;
};

export const SUPABASE_QUERY_CAPABILITY_REGISTRY = {
  account_audit_messages: {
    file: "lib/account/audit-account-messages.ts", capability: "service_role_write", family: "account", access: "read_write", customerOwned: false, status: "approved", rationale: "Operator-controlled audit message ledger.",
  },
  admin_audit_log: {
    file: "lib/admin/audit-log.ts", capability: "service_role_write", family: "admin", access: "write", customerOwned: false, status: "approved", rationale: "Append-only admin audit events.",
  },
  angel_durable_memory: {
    file: "lib/ai/angel-durable-memory.ts", capability: "service_role_write", family: "ai", access: "read_write", customerOwned: false, status: "approved", rationale: "Server-side hashed conversation memory.",
  },
  vlm_entitlement_ledger: {
    file: "lib/commerce/vlm-entitlement-ledger.ts", capability: "service_role_write", family: "commerce", access: "read_write", customerOwned: false, status: "approved", rationale: "Legacy entitlement identifiers and the current automated-analysis queue compatibility layer; no human-review or public-sale claim.",
  },
  order_service: {
    file: "lib/db/order-service.ts", capability: "service_role_write", family: "payments", access: "read_write", customerOwned: false, status: "approved", rationale: "Signed webhook persistence and order side effects.",
  },
  supabase_auth_session: {
    file: "lib/auth/supabase-auth-session.ts", capability: "central_boundary", family: "account", access: "read_write", customerOwned: true, status: "central_only", rationale: "Server-only Supabase Auth sign-in, refresh, revoke and durable subject binding. Tokens stay in HttpOnly cookies.",
  },
  supabase_auth_cookies: {
    file: "lib/auth/supabase-auth-cookies.ts", capability: "central_boundary", family: "account", access: "factory", customerOwned: true, status: "central_only", rationale: "Only module allowed to serialize or parse Supabase access/refresh cookies.",
  },
  profile_service: {
    file: "lib/db/profile-service.ts", capability: "user_rls", family: "account", access: "read_write", customerOwned: true, status: "approved", rationale: "Profile reads and writes require per-request caller identity, durable account-subject binding and user-RLS.",
  },
  square_service: {
    file: "lib/db/square-service.ts", capability: "user_rls", family: "community", access: "read_write", customerOwned: true, status: "approved", rationale: "Public feed exposes approved rows only; owner reads and post/comment writes use caller identity, durable account binding and database-enforced author_account_id.",
  },
  supabase_factory: {
    file: "lib/db/supabase.ts", capability: "central_boundary", family: "core", access: "factory", customerOwned: false, status: "central_only", rationale: "Only module allowed to construct public, user-RLS and service-role clients.",
  },
  customer_owned_write_boundary: {
    file: "lib/db/customer-owned-write-boundary.ts", capability: "central_boundary", family: "core", access: "factory", customerOwned: true, status: "central_only", rationale: "Only boundary allowed to resolve caller JWT to a user-RLS client and compare auth.uid binding with the Velmère account."
  },
  bounded_rpc_boundary: {
    file: "lib/db/bounded-supabase-rpc.ts", capability: "central_boundary", family: "core", access: "factory", customerOwned: false, status: "central_only", rationale: "Central capability resolver for registered RPC operations.",
  },
  liquidation_replay_store: {
    file: "lib/market-integrity/liquidation-replay-store.ts", capability: "service_role_write", family: "market", access: "read_write", customerOwned: false, status: "approved", rationale: "Server-generated market replay evidence.",
  },
  verify_publication_registry: {
    file: "lib/market-integrity/public-proof-publication-resolver.ts", capability: "service_role_write", family: "audit", access: "read_write", customerOwned: false, status: "approved", rationale: "Server-owned append-only Verify publication, continuous-monitoring, public-search and history projections.",
  },
  durable_order_state: {
    file: "lib/orders/durable-order-state.ts", capability: "service_role_write", family: "fulfilment", access: "read_write", customerOwned: false, status: "approved", rationale: "Durable order state machine and events.",
  },
  fulfilment_incident_store: {
    file: "lib/orders/fulfilment-incident-case-store.ts", capability: "service_role_write", family: "fulfilment", access: "write", customerOwned: false, status: "approved", rationale: "Sanitized provider incident persistence.",
  },
  fulfilment_incident_resolution: {
    file: "lib/orders/fulfilment-incident-resolution.ts", capability: "service_role_write", family: "fulfilment", access: "write", customerOwned: false, status: "approved", rationale: "Evidence-gated operator resolution boundary.",
  },
  product_readthrough: {
    file: "lib/products/product-db-readthrough.ts", capability: "public_read", family: "products", access: "read", customerOwned: false, status: "approved", rationale: "Published product and variant catalog readthrough.",
  },
  audit_intake_vault: {
    file: "lib/security/audit-intake-case-vault.ts", capability: "service_role_write", family: "audit", access: "read_write", customerOwned: false, status: "approved", rationale: "Paid audit intake and case lifecycle.",
  },
  audit_review_orchestration: {
    file: "lib/security/audit-review-orchestration.ts", capability: "service_role_write", family: "audit", access: "read_write", customerOwned: false, status: "approved", rationale: "Reviewer leases and audit workflow state.",
  },
  mutation_receipt_vault: {
    file: "lib/security/mutation-receipt-vault.ts", capability: "service_role_write", family: "audit", access: "write", customerOwned: false, status: "approved", rationale: "Redacted mutation audit receipts.",
  },
  supabase_runtime_truth: {
    file: "lib/security/supabase-runtime-truth.ts", capability: "service_role_write", family: "core", access: "read", customerOwned: false, status: "approved", rationale: "Server-only durable storage health proof.",
  },
  durable_payment_evidence: {
    file: "lib/security/durable-payment-evidence-store.ts", capability: "service_role_write", family: "payments", access: "read_write", customerOwned: false, status: "approved", rationale: "Redacted payment evidence ledger.",
  },
  route_health_ledger: {
    file: "lib/security/route-health-ledger.ts", capability: "service_role_write", family: "core", access: "read_write", customerOwned: false, status: "approved", rationale: "Operator route health evidence.",
  },
  delivery_receipt_ledger: {
    file: "lib/security/delivery-receipt-ledger.ts", capability: "service_role_write", family: "core", access: "read_write", customerOwned: false, status: "approved", rationale: "Server delivery receipts and reconciliation.",
  },
  support_handoff_ledger: {
    file: "lib/security/support-handoff-event-ledger.ts", capability: "service_role_write", family: "account", access: "read_write", customerOwned: false, status: "approved", rationale: "Operator support handoff evidence.",
  },
  durable_idempotency: {
    file: "lib/security/durable-idempotency-store.ts", capability: "service_role_write", family: "core", access: "write", customerOwned: false, status: "approved", rationale: "Server-side mutation idempotency reservation.",
  },
} as const satisfies Record<string, SupabaseQueryRegistryEntry>;

export type SupabaseQueryOperation = keyof typeof SUPABASE_QUERY_CAPABILITY_REGISTRY;

export function getSupabaseQueryCapability(operation: SupabaseQueryOperation): SupabaseQueryRegistryEntry {
  return SUPABASE_QUERY_CAPABILITY_REGISTRY[operation];
}

export function getSupabaseQueryCapabilitySummary() {
  const entries: SupabaseQueryRegistryEntry[] = Object.values(SUPABASE_QUERY_CAPABILITY_REGISTRY);
  return {
    schemaVersion: "velmere.supabase-query-capability-summary.v1" as const,
    total: entries.length,
    approved: entries.filter((entry) => entry.status === "approved").length,
    migrationRequired: entries.filter((entry) => entry.status === "migration_required").length,
    centralOnly: entries.filter((entry) => entry.status === "central_only").length,
    customerOwnedMigrationFiles: entries
      .filter((entry) => entry.customerOwned && entry.status === "migration_required")
      .map((entry) => entry.file)
      .sort(),
  };
}
