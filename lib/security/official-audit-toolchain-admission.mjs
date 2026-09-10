import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const HEX64 = /^[0-9a-f]{64}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const VERSION_RECEIPT_SCHEMA = "velmere.pass36.official-tool-version-receipt.v1";
const EXECUTION_BOUNDARY_ID = "velmere.pass36.external-command-boundary.v4";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Prefixed(buffer) {
  return `sha256:${sha256(buffer)}`;
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function normalizePath(value) {
  const resolved = path.resolve(String(value));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function officialToolVersionArgsSha256(args) {
  return sha256Prefixed(Buffer.from(JSON.stringify(Array.isArray(args) ? args : ["--version"]), "utf8"));
}

export function classifyOfficialExecutable(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2) return "unknown";
  if (bytes[0] === 0x7f && bytes.subarray(1, 4).toString("ascii") === "ELF") return "elf";
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return "pe";
  const magic = bytes.length >= 4 ? bytes.readUInt32BE(0) : 0;
  if ([0xfeedface, 0xfeedfacf, 0xcafebabe, 0xcefaedfe, 0xcffaedfe].includes(magic)) return "mach_o";
  const firstLine = bytes.subarray(0, Math.min(bytes.length, 256)).toString("utf8").split(/\r?\n/u, 1)[0] ?? "";
  if (/^#!.*(?:python|python3)(?:\s|$)/u.test(firstLine)) return "python_entrypoint";
  if (/^#!/u.test(firstLine)) return "script_entrypoint";
  return "unknown";
}

function validateVersionReceipt(tool, executableSha256, receipt, blockers) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    blockers.push("version_execution_receipt_missing");
    return null;
  }
  const expectedKeys = [
    "schemaVersion", "revisionId", "toolId", "executionBoundaryId", "executableSha256",
    "argsSha256", "exitCode", "signal", "observedVersion", "stdoutSha256", "stderrSha256",
    "processTreeContained", "receiptSha256",
  ];
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys.sort())) {
    blockers.push("version_execution_receipt_schema_invalid");
    return null;
  }
  const withoutDigest = { ...receipt };
  delete withoutDigest.receiptSha256;
  const expectedReceiptSha256 = sha256Prefixed(Buffer.from(stable(withoutDigest), "utf8"));
  if (receipt.schemaVersion !== VERSION_RECEIPT_SCHEMA) blockers.push("version_execution_receipt_schema_invalid");
  if (receipt.toolId !== tool.toolId) blockers.push("version_execution_receipt_tool_mismatch");
  if (receipt.revisionId !== tool.revisionId) blockers.push("version_execution_receipt_revision_mismatch");
  if (receipt.executionBoundaryId !== EXECUTION_BOUNDARY_ID) blockers.push("version_execution_boundary_mismatch");
  if (receipt.executableSha256 !== `sha256:${executableSha256}`) blockers.push("version_execution_executable_mismatch");
  if (receipt.argsSha256 !== officialToolVersionArgsSha256(tool.versionArgs)) blockers.push("version_execution_args_mismatch");
  if (receipt.exitCode !== 0 || receipt.signal !== null) blockers.push("version_command_failed");
  if (receipt.observedVersion !== tool.expectedVersion) blockers.push("version_mismatch");
  if (!SHA256.test(String(receipt.stdoutSha256 ?? "")) || !SHA256.test(String(receipt.stderrSha256 ?? ""))) {
    blockers.push("version_execution_output_digest_invalid");
  }
  if (receipt.processTreeContained !== true) blockers.push("version_execution_process_tree_uncontained");
  if (receipt.receiptSha256 !== expectedReceiptSha256) blockers.push("version_execution_receipt_digest_mismatch");
  return receipt;
}

export function buildOfficialToolVersionReceipt(input) {
  const receipt = {
    schemaVersion: VERSION_RECEIPT_SCHEMA,
    revisionId: input.revisionId,
    toolId: input.toolId,
    executionBoundaryId: EXECUTION_BOUNDARY_ID,
    executableSha256: input.executableSha256,
    argsSha256: input.argsSha256,
    exitCode: input.exitCode,
    signal: input.signal,
    observedVersion: input.observedVersion,
    stdoutSha256: input.stdoutSha256,
    stderrSha256: input.stderrSha256,
    processTreeContained: input.processTreeContained,
  };
  return { ...receipt, receiptSha256: sha256Prefixed(Buffer.from(stable(receipt), "utf8")) };
}

export function evaluateOfficialAuditTool(tool, env = process.env, options = {}) {
  const blockers = [];
  const configuredPath = String(env?.[tool.environmentVariable] ?? "").trim();
  let observed = {
    configuredPath: configuredPath || null,
    realPath: null,
    executableSha256: null,
    executableKind: null,
    observedVersion: null,
    versionExitCode: null,
    versionStdoutSha256: null,
    versionStderrSha256: null,
    executionBoundaryId: null,
    versionReceiptSha256: null,
  };

  if (!configuredPath) blockers.push("tool_path_not_configured");
  if (tool.fixtureMayGrantCredit !== false) blockers.push("fixture_credit_policy_invalid");
  if (!HEX64.test(String(tool.expectedExecutableSha256 ?? ""))) blockers.push("exact_executable_sha256_not_pinned");
  if (typeof tool.revisionId !== "string" || !tool.revisionId.startsWith("VELMERE_PASS36_A102R44P2_")) {
    blockers.push("tool_revision_binding_invalid");
  }

  if (configuredPath) {
    try {
      const absolute = path.resolve(configuredPath);
      const linkStat = lstatSync(absolute);
      if (linkStat.isSymbolicLink()) blockers.push("executable_symlink_forbidden");
      const real = realpathSync.native ? realpathSync.native(absolute) : realpathSync(absolute);
      if (normalizePath(real) !== normalizePath(absolute)) blockers.push("executable_path_alias_or_symlink_forbidden");
      const regular = statSync(real);
      if (!regular.isFile()) blockers.push("executable_not_regular_file");
      const bytes = readFileSync(real);
      const executableSha256 = sha256(bytes);
      const executableKind = classifyOfficialExecutable(bytes);
      observed = { ...observed, realPath: real, executableSha256, executableKind };
      if (!tool.allowedExecutableKinds.includes(executableKind)) blockers.push(`executable_kind_not_allowed:${executableKind}`);
      if (HEX64.test(String(tool.expectedExecutableSha256 ?? "")) && executableSha256 !== tool.expectedExecutableSha256) blockers.push("executable_sha256_mismatch");

      const identityBlocked = blockers.some((value) => value.startsWith("executable_") || value === "exact_executable_sha256_not_pinned");
      if (!identityBlocked) {
        const receipt = validateVersionReceipt(tool, executableSha256, options.versionReceipts?.[tool.toolId], blockers);
        if (receipt) {
          observed = {
            ...observed,
            observedVersion: receipt.observedVersion,
            versionExitCode: receipt.exitCode,
            versionStdoutSha256: receipt.stdoutSha256,
            versionStderrSha256: receipt.stderrSha256,
            executionBoundaryId: receipt.executionBoundaryId,
            versionReceiptSha256: receipt.receiptSha256,
          };
        }
      }
    } catch (error) {
      blockers.push(`execution_admission_exception:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    toolId: tool.toolId,
    admitted: blockers.length === 0,
    officialExecutionCredit: 0,
    blockers: Array.from(new Set(blockers)),
    expected: {
      version: tool.expectedVersion,
      executableSha256: tool.expectedExecutableSha256,
      allowedExecutableKinds: tool.allowedExecutableKinds,
      revisionId: tool.revisionId,
    },
    observed,
  };
}

export function evaluateOfficialAuditToolchain(policy, env = process.env, options = {}) {
  const tools = policy.tools.map((tool) => evaluateOfficialAuditTool({ ...tool, revisionId: policy.revisionId }, env, options));
  const admitted = tools.filter((tool) => tool.admitted).length;
  return {
    schemaVersion: "velmere.pass36.a102r44p2.official-audit-toolchain-admission-receipt.v2",
    policySchemaVersion: policy.schemaVersion,
    revisionId: policy.revisionId,
    status: admitted === tools.length ? "PASS_ALL_TOOLS_ADMITTED_NO_EXECUTION_CREDIT" : "PASS_FAIL_CLOSED_TOOLCHAIN_NOT_ADMITTED",
    requiredTools: tools.length,
    admittedTools: admitted,
    officialToolExecutions: 0,
    officialExecutionTarget: policy.officialExecutionTarget,
    allToolsAdmitted: admitted === tools.length,
    tools,
    creditBoundary: policy.creditBoundary,
  };
}
