import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const A19_RUNTIME_POLICY_SCHEMA = "velmere.pass35.a19-exact-runtime-bootstrap-policy.v1";
export const A19_RUNTIME_EVALUATION_SCHEMA = "velmere.pass35.a19-exact-runtime-evaluation.v1";
const HEX64 = /^[a-f0-9]{64}$/i;
const SRI_SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

export function loadA19RuntimePolicy(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function verifyA19RuntimePolicy(policy) {
  if (!policy || policy.schemaVersion !== A19_RUNTIME_POLICY_SCHEMA) return false;
  if (policy.passId !== "PASS35_A19") return false;
  if (policy.node?.version !== "24.18.0" || policy.node?.platform !== "linux" || policy.node?.arch !== "x64") return false;
  if (policy.node?.archiveFile !== "node-v24.18.0-linux-x64.tar.xz") return false;
  if (!HEX64.test(String(policy.node?.archiveSha256 ?? ""))) return false;
  if (policy.node.archiveSha256 !== "55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742") return false;
  if (policy.npm?.version !== "11.16.0" || policy.npm?.archiveFile !== "npm-11.16.0.tgz") return false;
  if (policy.npm?.requireRegistryIntegrity !== true || policy.npm?.requireRegistrySignatureVerification !== true) return false;
  const required = new Set(policy.requiredExecution ?? []);
  for (const id of ["npm_ci", "typecheck", "lint", "pass35_full_test_matrix", "webpack_build", "webpack_smoke", "turbopack_build", "turbopack_smoke", "source_hash_immutable_pre_post"]) {
    if (!required.has(id)) return false;
  }
  const hard = policy.hardStops ?? {};
  return Object.values(hard).every((value) => value === false);
}

export function evaluateA19ExactRuntime(policy, input) {
  if (!verifyA19RuntimePolicy(policy)) throw new Error("a19_runtime_policy_invalid");
  const commandMap = new Map((input.commands ?? []).map((row) => [row.id, row]));
  const requiredCommands = policy.requiredExecution.map((id) => {
    const row = commandMap.get(id);
    return {
      id,
      present: Boolean(row),
      exitCode: Number.isInteger(row?.exitCode) ? row.exitCode : null,
      outputSha256: HEX64.test(String(row?.outputSha256 ?? "")) ? row.outputSha256.toLowerCase() : null,
      passed: Boolean(row) && row.exitCode === 0 && HEX64.test(String(row.outputSha256 ?? "")),
    };
  });
  const gates = {
    nodeArchivePresent: input.nodeArchivePresent === true,
    nodeArchiveHash: String(input.nodeArchiveSha256 ?? "").toLowerCase() === policy.node.archiveSha256,
    nodeVersion: input.nodeVersion === `v${policy.node.version}`,
    npmArchivePresent: input.npmArchivePresent === true,
    npmArchiveVersion: input.npmArchiveVersion === policy.npm.version,
    npmRegistryIntegrity: SRI_SHA512.test(String(input.npmRegistryIntegrity ?? "")),
    npmRegistrySignatureVerified: input.npmRegistrySignatureVerified === true,
    npmVersion: input.npmVersion === policy.npm.version,
    commandMatrixComplete: requiredCommands.every((row) => row.present),
    commandMatrixPass: requiredCommands.every((row) => row.passed),
    sourceImmutable: HEX64.test(String(input.sourceHashBefore ?? ""))
      && input.sourceHashBefore === input.sourceHashAfter,
    finalSourceBound: HEX64.test(String(input.finalSourceManifestSha256 ?? "")),
  };
  const blockers = Object.entries(gates).filter(([, passed]) => !passed).map(([id]) => id);
  const exactRuntimeProven = blockers.length === 0;
  const core = {
    schemaVersion: A19_RUNTIME_EVALUATION_SCHEMA,
    passId: policy.passId,
    sourceRevisionId: policy.sourceRevisionId,
    node: {
      expectedVersion: `v${policy.node.version}`,
      observedVersion: input.nodeVersion ?? null,
      expectedArchiveSha256: policy.node.archiveSha256,
      observedArchiveSha256: input.nodeArchiveSha256 ?? null,
    },
    npm: {
      expectedVersion: policy.npm.version,
      observedVersion: input.npmVersion ?? null,
      archiveVersion: input.npmArchiveVersion ?? null,
      registryIntegrity: input.npmRegistryIntegrity ?? null,
      registrySignatureVerified: input.npmRegistrySignatureVerified === true,
    },
    requiredCommands,
    sourceHashBefore: input.sourceHashBefore ?? null,
    sourceHashAfter: input.sourceHashAfter ?? null,
    finalSourceManifestSha256: input.finalSourceManifestSha256 ?? null,
    gates,
    blockers,
    exactRuntimeProven,
    status: exactRuntimeProven ? "PASS_EXACT_RUNTIME_FINAL_BYTES" : "BLOCKED_EXACT_RUNTIME_NOT_EXECUTED",
    promotionAllowed: false,
    sellEnabled: false,
    truthBoundary: exactRuntimeProven
      ? "The exact pinned runtime and complete command matrix passed on immutable final source bytes. Release promotion still requires independent package verification and signatures."
      : "This evaluation proves only the fail-closed bootstrap contract and records missing evidence. It grants no exact-runtime, build, production, staging, LIVE or sales credit.",
  };
  return { ...core, evaluationSha256: sha256(stable(core)) };
}

export function verifyA19ExactRuntimeEvaluation(policy, evaluation) {
  if (!evaluation || evaluation.schemaVersion !== A19_RUNTIME_EVALUATION_SCHEMA) return false;
  const copy = { ...evaluation };
  delete copy.evaluationSha256;
  if (sha256(stable(copy)) !== evaluation.evaluationSha256) return false;
  if (evaluation.passId !== policy.passId || evaluation.sourceRevisionId !== policy.sourceRevisionId) return false;
  if (evaluation.exactRuntimeProven && evaluation.blockers.length) return false;
  if (!evaluation.exactRuntimeProven && evaluation.status !== "BLOCKED_EXACT_RUNTIME_NOT_EXECUTED") return false;
  if (evaluation.promotionAllowed !== false || evaluation.sellEnabled !== false) return false;
  return true;
}
