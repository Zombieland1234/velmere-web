import { createHash } from "node:crypto";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { buildDurableComputationDeploymentContract } from "@/lib/jobs/durable-computation-deployment";

export const DURABLE_COMPUTATION_SCHEMA_VERSION = "velmere.durable-computation.schema.4777" as const;
export const DURABLE_COMPUTATION_REQUIRED_TABLES = 26 as const;
export const DURABLE_COMPUTATION_REQUIRED_FUNCTIONS = 87 as const;

export type DurableComputationStagingProbe = {
  schemaVersion: "velmere.durable-computation-staging-probe.v1";
  state: "ready" | "mismatch" | "unavailable";
  expectedSchema: typeof DURABLE_COMPUTATION_SCHEMA_VERSION;
  reportedSchema: string | null;
  requiredTables: number;
  presentTables: number;
  rlsTables: number;
  serviceRoleTableGrants: number;
  requiredFunctions: number;
  presentFunctions: number;
  serviceRoleFunctionGrants: number;
  deploymentFingerprint: string;
  capabilityDigest: string | null;
  stagingConfigured: boolean;
  stagingProven: boolean;
  blockers: string[];
  privacyBoundary: string;
};

type ProbeDependencies = {
  rpc: typeof runRegisteredServiceRoleRpc;
};

const defaultDependencies: ProbeDependencies = { rpc: runRegisteredServiceRoleRpc };

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function row(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) ?? null;
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

function safeDigest(value: string | null) {
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

export async function probeDurableComputationStaging(input: {
  env?: Record<string, string | undefined>;
  dependencies?: ProbeDependencies;
} = {}): Promise<DurableComputationStagingProbe> {
  const env = input.env ?? process.env;
  const dependencies = input.dependencies ?? defaultDependencies;
  const deployment = buildDurableComputationDeploymentContract(env);
  const base = {
    schemaVersion: "velmere.durable-computation-staging-probe.v1" as const,
    expectedSchema: DURABLE_COMPUTATION_SCHEMA_VERSION,
    deploymentFingerprint: deployment.deploymentFingerprint,
    stagingConfigured: deployment.stagingConfigured,
    privacyBoundary: "Aggregate database capabilities only. No table rows, job IDs, account IDs, subjects, payloads, results, secrets or raw errors are returned.",
  };

  if (!deployment.stagingConfigured) {
    return {
      ...base,
      state: "unavailable",
      reportedSchema: null,
      requiredTables: 0,
      presentTables: 0,
      rlsTables: 0,
      serviceRoleTableGrants: 0,
      requiredFunctions: 0,
      presentFunctions: 0,
      serviceRoleFunctionGrants: 0,
      capabilityDigest: null,
      stagingProven: false,
      blockers: [...deployment.blockers.staging],
    };
  }

  try {
    const { data } = await dependencies.rpc({
      operation: "durable_computation_staging_probe",
      args: {
        p_expected_schema: DURABLE_COMPUTATION_SCHEMA_VERSION,
        p_deployment_fingerprint: deployment.deploymentFingerprint,
      },
    });
    const value = row(data);
    if (!value) throw new Error("staging_probe_empty");
    const requiredTables = number(value.required_tables);
    const presentTables = number(value.present_tables);
    const rlsTables = number(value.rls_tables);
    const serviceRoleTableGrants = number(value.service_role_table_grants);
    const requiredFunctions = number(value.required_functions);
    const presentFunctions = number(value.present_functions);
    const serviceRoleFunctionGrants = number(value.service_role_function_grants);
    const reportedSchema = String(value.schema_version ?? "");
    const state = String(value.state ?? "") === "ready" ? "ready" : "mismatch";
    const capabilityDigest = safeDigest(String(value.capability_digest ?? ""));
    const blockers: string[] = [];
    if (reportedSchema !== DURABLE_COMPUTATION_SCHEMA_VERSION) blockers.push("schema_version_mismatch");
    if (requiredTables !== DURABLE_COMPUTATION_REQUIRED_TABLES) blockers.push("required_table_contract_mismatch");
    if (requiredFunctions !== DURABLE_COMPUTATION_REQUIRED_FUNCTIONS) blockers.push("required_function_contract_mismatch");
    if (presentTables !== requiredTables) blockers.push("required_tables_missing");
    if (rlsTables !== requiredTables) blockers.push("rls_not_enabled_everywhere");
    if (serviceRoleTableGrants !== requiredTables) blockers.push("service_role_table_grants_incomplete");
    if (presentFunctions !== requiredFunctions) blockers.push("required_functions_missing");
    if (serviceRoleFunctionGrants !== requiredFunctions) blockers.push("service_role_function_grants_incomplete");
    if (!capabilityDigest) blockers.push("capability_digest_invalid");
    const stagingProven = state === "ready" && blockers.length === 0;
    return {
      ...base,
      state,
      reportedSchema,
      requiredTables,
      presentTables,
      rlsTables,
      serviceRoleTableGrants,
      requiredFunctions,
      presentFunctions,
      serviceRoleFunctionGrants,
      capabilityDigest,
      stagingProven,
      blockers,
    };
  } catch (error) {
    const code = createHash("sha256").update(error instanceof Error ? error.message : "staging_probe_failed").digest("hex").slice(0, 16);
    return {
      ...base,
      state: "unavailable",
      reportedSchema: null,
      requiredTables: 0,
      presentTables: 0,
      rlsTables: 0,
      serviceRoleTableGrants: 0,
      requiredFunctions: 0,
      presentFunctions: 0,
      serviceRoleFunctionGrants: 0,
      capabilityDigest: null,
      stagingProven: false,
      blockers: [`staging_probe_unavailable_${code}`],
    };
  }
}
