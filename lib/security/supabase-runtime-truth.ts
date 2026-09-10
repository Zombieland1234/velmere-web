import { createHash, randomUUID } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";

export type Pass2179SupabaseRuntimeTruthStatus = "PASS" | "BLOCKED_ENV" | "FAIL";

export type Pass2179SupabaseRuntimeTruthProof = {
  schemaVersion: "velmere.pass2179.supabase-runtime-truth.v1";
  generatedAt: string;
  status: Pass2179SupabaseRuntimeTruthStatus;
  env: {
    nextPublicSupabaseUrl: boolean;
    supabaseUrl: boolean;
    serviceRoleKey: boolean;
    anonKey: boolean;
    serviceRoleRequiredForProductionTruth: true;
  };
  receiptId?: string;
  durableWrite: boolean;
  readBackVerified: boolean;
  payloadHashMatched: boolean;
  routeMatched: boolean;
  methodMatched: boolean;
  blockers: string[];
  productionBoundary: string;
  providerError?: string;
};

function sha256(value: unknown) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 32)}`;
}

export function buildPass2179SupabaseRuntimeReadiness() {
  return {
    schemaVersion: "velmere.pass2179.supabase-runtime-readiness.v1" as const,
    generatedAt: new Date().toISOString(),
    supabaseConfigured: hasSupabaseServiceRoleConfig(),
    env: {
      nextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleRequiredForProductionTruth: true as const,
    },
    productionBoundary: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "Ready to run a server-side Supabase mutation receipt write/read proof."
      : "BLOCKED: production truth requires SUPABASE_SERVICE_ROLE_KEY; anon-only config is not accepted as durable server truth.",
  };
}

export async function runPass2179SupabaseRuntimeTruthProof(input: {
  request?: Request;
  actorId?: string;
  actorMode?: "admin" | "system";
} = {}): Promise<Pass2179SupabaseRuntimeTruthProof> {
  const generatedAt = new Date().toISOString();
  const readiness = buildPass2179SupabaseRuntimeReadiness();
  const blockers: string[] = [];

  if (!readiness.env.nextPublicSupabaseUrl && !readiness.env.supabaseUrl) blockers.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL missing");
  if (!readiness.env.serviceRoleKey) blockers.push("SUPABASE_SERVICE_ROLE_KEY missing");

  if (blockers.length) {
    return {
      schemaVersion: "velmere.pass2179.supabase-runtime-truth.v1",
      generatedAt,
      status: "BLOCKED_ENV",
      env: readiness.env,
      durableWrite: false,
      readBackVerified: false,
      payloadHashMatched: false,
      routeMatched: false,
      methodMatched: false,
      blockers,
      productionBoundary:
        "Supabase runtime truth is blocked by missing server env. Do not claim durable mutation proof until insert/select succeeds with service-role storage.",
    };
  }

  const proofNonce = randomUUID();
  const proofPayload = {
    proofNonce,
    proofType: "supabase-runtime-truth",
    generatedAt,
    rawPayloadStored: false,
  };
  const expectedPayloadHash = sha256(proofPayload);

  try {
    const receipt = await appendPass2178MutationReceipt({
      request: input.request,
      route: "/api/security/supabase-runtime-truth",
      method: "POST",
      action: "pass2179_supabase_runtime_truth_probe",
      targetType: "supabase_mutation_receipt_runtime_proof",
      targetId: proofNonce,
      actorId: input.actorId ?? "system:pass2179-runtime-truth",
      actorMode: input.actorMode ?? "system",
      payload: proofPayload,
      safeSummary:
        "PASS2179 inserted a redacted mutation receipt and will verify it by reading back receipt_id, route, method and payload_hash from Supabase.",
    });

    if (!receipt.durableWrite) blockers.push("PASS2178 vault did not return durableWrite=true");
    if (receipt.redaction.payloadHash !== expectedPayloadHash) blockers.push("local payload hash mismatch before read-back");

    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) throw new Error("supabase_client_unavailable_after_env_check");

    const { data, error } = await supabase
      .from("velmere_mutation_receipts")
      .select("receipt_id, route, method, action, target_type, target_id, payload_hash, redacted_payload, created_at")
      .eq("receipt_id", receipt.receiptId)
      .maybeSingle();

    if (error) throw error;
    if (!data) blockers.push("inserted receipt not found during read-back");

    const payloadHashMatched = Boolean(data && data.payload_hash === receipt.redaction.payloadHash && data.payload_hash === expectedPayloadHash);
    const routeMatched = Boolean(data && data.route === "/api/security/supabase-runtime-truth");
    const methodMatched = Boolean(data && data.method === "POST");
    if (!payloadHashMatched) blockers.push("read-back payload_hash mismatch");
    if (!routeMatched) blockers.push("read-back route mismatch");
    if (!methodMatched) blockers.push("read-back method mismatch");

    return {
      schemaVersion: "velmere.pass2179.supabase-runtime-truth.v1",
      generatedAt,
      status: blockers.length ? "FAIL" : "PASS",
      env: readiness.env,
      receiptId: receipt.receiptId,
      durableWrite: receipt.durableWrite,
      readBackVerified: Boolean(data) && payloadHashMatched && routeMatched && methodMatched,
      payloadHashMatched,
      routeMatched,
      methodMatched,
      blockers,
      productionBoundary: blockers.length
        ? "BLOCKED: Supabase mutation receipt write/read proof did not fully verify."
        : "Supabase mutation receipt truth verified: redacted insert succeeded and read-back matched receipt_id/route/method/payload_hash.",
    };
  } catch {
    return {
      schemaVersion: "velmere.pass2179.supabase-runtime-truth.v1",
      generatedAt,
      status: "FAIL",
      env: readiness.env,
      durableWrite: false,
      readBackVerified: false,
      payloadHashMatched: false,
      routeMatched: false,
      methodMatched: false,
      blockers: ["supabase runtime proof threw before successful write/read-back"],
      providerError: "supabase_runtime_truth_failed",
      productionBoundary:
        "BLOCKED: Supabase write/read proof failed. Check migration, service-role key, RLS/policies and table grants before launch.",
    };
  }
}
