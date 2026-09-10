import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  externalCommandArgsSha256,
  PASS36_EXTERNAL_COMMAND_BOUNDARY_ID,
  runBoundExternalCommand,
} from "./external-command-boundary.ts";

export const PASS35_A4_SOLC_REPRODUCTION_ID = "pass35-a4-pinned-solc-reproduction" as const;

export type Pass35A4InputClass = "SYNTHETIC_OFFLINE" | "CUSTOMER_SUPPLIED_UNVERIFIED" | "CUSTOMER_SUPPLIED_VERIFIED";

export type Pass35A4SourceFile = { path: string; content: string };

export type Pass35A4SolcCase = {
  schemaVersion: "velmere.pass35.audit-a4-solc-case.v1";
  inputClass: Pass35A4InputClass;
  caseRef: string;
  observedAt: string;
  chainId: string;
  contractAddress: string;
  sourceFiles: Pass35A4SourceFile[];
  target: { sourcePath: string; contractName: string };
  compiler: {
    family: "solc";
    version: string;
    optimizerEnabled: boolean;
    optimizerRuns: number;
    evmVersion: string;
    viaIR: boolean;
    metadataBytecodeHash: "ipfs" | "bzzr1" | "none";
    libraries?: Record<string, Record<string, string>>;
    remappings?: string[];
  };
  deployedRuntimeBytecode: string;
  chainProviderReceiptSha256?: string | null;
};

export type Pass35A4ToolSpec = {
  schemaVersion: "velmere.pass35.audit-a4-tool-spec.v1";
  toolId: string;
  executionMode: "NATIVE_BINARY" | "NODE_SCRIPT_FIXTURE_ONLY";
  executablePath: string;
  entrypointPath?: string | null;
  expectedExecutableSha256?: string | null;
  expectedEntrypointSha256?: string | null;
  expectedVersion: string;
  timeoutMs: number;
  maxStdoutBytes: number;
  fixtureOnly: boolean;
};

type ImmutableBinding = {
  astId: string;
  start: number;
  length: number;
  deployedValueHex: string;
  deployedValueSha256: string;
};

type SolcDiagnostic = { severity?: string };
type SolcContractOutput = {
  evm?: {
    deployedBytecode?: {
      object?: unknown;
      linkReferences?: unknown;
      immutableReferences?: unknown;
    };
  };
};
type SolcOutput = {
  errors?: SolcDiagnostic[];
  contracts?: Record<string, Record<string, SolcContractOutput>>;
};

export type Pass35A4SolcReceipt = {
  schemaVersion: "velmere.pass35.audit-a4-solc-reproduction-receipt.v1";
  engineId: typeof PASS35_A4_SOLC_REPRODUCTION_ID;
  caseRef: string;
  inputClass: Pass35A4InputClass;
  tool: {
    toolId: string;
    executionMode: Pass35A4ToolSpec["executionMode"] | null;
    executableSha256: string | null;
    entrypointSha256: string | null;
    observedVersion: string | null;
    observedVersionOutputSha256: string | null;
    executionBoundaryId: typeof PASS36_EXTERNAL_COMMAND_BOUNDARY_ID;
    versionArgsSha256: string | null;
    compileArgsSha256: string | null;
    isolatedWorkingDirectory: true;
    inheritedEnvironment: false;
    fixtureOnly: boolean;
  };
  inputIdentity: {
    sourceBundleSha256: string;
    compilerSettingsSha256: string;
    standardJsonInputSha256: string;
    deployedRuntimeBytecodeSha256: string;
    chainProviderReceiptSha256: string | null;
  };
  target: { sourcePath: string; contractName: string; chainId: string; contractAddress: string };
  compilation: {
    status: "EXECUTED" | "BLOCKED" | "FAILED";
    exitCode: number | null;
    rawOutputSha256: string | null;
    compilerErrorCount: number;
    compilerWarningCount: number;
    unresolvedLinkReferenceCount: number;
    immutableReferenceCount: number;
  };
  comparison: {
    status:
      | "EXACT_MATCH"
      | "MATCH_AFTER_METADATA_STRIP"
      | "MATCH_AFTER_IMMUTABLE_BINDING"
      | "MATCH_AFTER_IMMUTABLE_BINDING_AND_METADATA_STRIP"
      | "MISMATCH"
      | "BLOCKED";
    compiledRuntimeBytecodeSha256: string | null;
    compiledCoreSha256: string | null;
    deployedCoreSha256: string | null;
    compiledMetadataBytes: number | null;
    deployedMetadataBytes: number | null;
    firstMismatchByte: number | null;
    immutableBindings: ImmutableBinding[];
  };
  blockers: string[];
  paidGateEligible: boolean;
  promotionAllowed: false;
  fullAuditClaimAllowed: false;
  receiptSha256: string;
  truthBoundary: string;
};

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const HEX = /^0x(?:[a-f0-9]{2})+$/i;
const ADDRESS = /^0x[a-f0-9]{40}$/i;
const CASE_REF = /^AUD-[A-Z0-9-]{8,64}$/;
const SOURCE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.@+\-/]{1,240}$/;
const VERSION = /^\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/i;
const MAX_SOURCE_FILES = 256;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const TOOL_SPEC_KEYS = new Set([
  "schemaVersion",
  "toolId",
  "executionMode",
  "executablePath",
  "entrypointPath",
  "expectedExecutableSha256",
  "expectedEntrypointSha256",
  "expectedVersion",
  "timeoutMs",
  "maxStdoutBytes",
  "fixtureOnly",
]);

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalDigest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!DIGEST.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function normalizeHex(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  return HEX.test(text) ? text : null;
}

function normalizeSourcePath(value: unknown): string | null {
  const text = String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!SOURCE_PATH.test(text) || text.includes("//") || text.includes("\u0000")) return null;
  return text;
}

function stripSolidityMetadata(bytecode: string): { core: Buffer; metadataBytes: number; valid: boolean } {
  const bytes = Buffer.from(bytecode.slice(2), "hex");
  if (bytes.length < 2) return { core: bytes, metadataBytes: 0, valid: false };
  const metadataLength = bytes.readUInt16BE(bytes.length - 2);
  const tail = metadataLength + 2;
  if (metadataLength <= 0 || tail > bytes.length) return { core: bytes, metadataBytes: 0, valid: false };
  return { core: bytes.subarray(0, bytes.length - tail), metadataBytes: metadataLength, valid: true };
}

function firstMismatch(left: Buffer, right: Buffer): number | null {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? null : limit;
}

function flattenRefs(value: unknown): Array<{ astId: string; start: number; length: number }> {
  if (!value || typeof value !== "object") return [];
  const output: Array<{ astId: string; start: number; length: number }> = [];
  for (const [astId, rows] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const start = Number((row as { start?: unknown })?.start);
      const length = Number((row as { length?: unknown })?.length);
      if (Number.isInteger(start) && start >= 0 && Number.isInteger(length) && length > 0) output.push({ astId, start, length });
    }
  }
  return output.sort((a, b) => a.start - b.start || a.length - b.length || a.astId.localeCompare(b.astId));
}

function countNestedReferenceRows(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  let count = 0;
  for (const byLibrary of Object.values(value as Record<string, unknown>)) {
    if (!byLibrary || typeof byLibrary !== "object") continue;
    for (const rows of Object.values(byLibrary as Record<string, unknown>)) if (Array.isArray(rows)) count += rows.length;
  }
  return count;
}

function resolveToolPath(root: string, toolPath: string): string {
  const absolute = path.isAbsolute(toolPath) ? path.resolve(toolPath) : path.resolve(root, toolPath);
  if (!existsSync(absolute)) throw new Error(`a4_tool_file_missing:${toolPath}`);
  const metadata = lstatSync(absolute);
  if (metadata.isSymbolicLink()) throw new Error(`a4_tool_file_symlink_forbidden:${toolPath}`);
  if (!metadata.isFile()) throw new Error(`a4_tool_file_missing:${toolPath}`);
  return absolute;
}

function runTool(root: string, tool: Pass35A4ToolSpec, args: string[], stdin: string) {
  const configuredExecutable = tool.executablePath === "__CURRENT_NODE__" ? process.execPath : resolveToolPath(root, tool.executablePath);
  let executable = configuredExecutable;
  let fixtureRuntimeDir: string | null = null;
  if (tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY" && tool.executablePath === "__CURRENT_NODE__" && process.platform !== "win32" && (statSync(configuredExecutable).mode & 0o022) !== 0) {
    fixtureRuntimeDir = mkdtempSync(path.join(tmpdir(), "velmere-a4-fixture-runtime-"));
    executable = path.join(fixtureRuntimeDir, "node");
    copyFileSync(configuredExecutable, executable);
    chmodSync(executable, 0o700);
  }
  const executableSha256 = sha256(readFileSync(executable));
  if (tool.executionMode === "NATIVE_BINARY") {
    if (canonicalDigest(tool.expectedExecutableSha256) !== executableSha256) throw new Error("a4_tool_executable_digest_mismatch");
  }
  let commandArgs = args;
  let entrypointSha256: string | null = null;
  const fileArgumentBindings: Array<{ index: number; expectedSha256: string }> = [];
  if (tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY") {
    if (!tool.fixtureOnly) throw new Error("a4_fixture_execution_mode_without_fixture_flag");
    const entrypoint = resolveToolPath(root, String(tool.entrypointPath ?? ""));
    entrypointSha256 = sha256(readFileSync(entrypoint));
    if (canonicalDigest(tool.expectedEntrypointSha256) !== entrypointSha256) throw new Error("a4_tool_entrypoint_digest_mismatch");
    commandArgs = [entrypoint, ...args];
    fileArgumentBindings.push({ index: 0, expectedSha256: entrypointSha256 });
  }
  try {
    try {
      const result = runBoundExternalCommand({
      boundary: {
        command: executable,
        args: commandArgs,
        expectedExecutableSha256: executableSha256,
        expectedArgsSha256: externalCommandArgsSha256(commandArgs),
        executionProfile: tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY"
          ? { kind: "node-script", entrypointIndex: 0 }
          : { kind: "native", toolFamily: "solc" },
        fileArgumentBindings,
        environmentAllowlist: [],
        containmentBroker: process.platform === "win32" ? undefined : "POSIX_PROCESS_GROUP_V1",
      },
      input: stdin,
      timeoutMs: Math.min(Math.max(tool.timeoutMs, 1000), 120000),
      maxInputBytes: 8 * 1024 * 1024,
      maxOutputBytes: Math.min(Math.max(tool.maxStdoutBytes, 1024), 4 * 1024 * 1024),
      errorPrefix: "a4_solc",
    });
    return {
      exitCode: typeof result.status === "number" ? result.status : null,
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      signal: result.signal,
      error: result.error,
      errorCode: null,
      executableSha256: result.executableSha256,
      entrypointSha256,
      argsSha256: result.argsSha256,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitMatch = message.match(/a4_solc_command_exit:(-?\d+):sha256:[a-f0-9]{64}/i);
    const errorCode = (message.match(/^(?:a4_solc|external_command)_[a-z0-9_]+(?::(?:[a-z0-9_]+|[-0-9]+:sha256:[a-f0-9]{64}))?/i) ?? ["a4_solc_execution_failed"])[0];
      return {
        exitCode: exitMatch ? Number(exitMatch[1]) : null,
        stdout: "",
        stderr: "",
        signal: null,
        error: error instanceof Error ? error : new Error(message),
        errorCode,
        executableSha256,
        entrypointSha256,
        argsSha256: externalCommandArgsSha256(commandArgs),
      };
    }
  } finally {
    if (fixtureRuntimeDir) rmSync(fixtureRuntimeDir, { recursive: true, force: true });
  }
}

function buildStandardJson(caseInput: Pass35A4SolcCase) {
  const sources: Record<string, { content: string }> = {};
  for (const source of caseInput.sourceFiles) sources[source.path] = { content: source.content.replace(/\r\n?/g, "\n") };
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: caseInput.compiler.optimizerEnabled, runs: caseInput.compiler.optimizerRuns },
      evmVersion: caseInput.compiler.evmVersion,
      viaIR: caseInput.compiler.viaIR,
      metadata: { bytecodeHash: caseInput.compiler.metadataBytecodeHash },
      libraries: caseInput.compiler.libraries ?? {},
      remappings: caseInput.compiler.remappings ?? [],
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "metadata",
            "evm.bytecode.object",
            "evm.bytecode.linkReferences",
            "evm.deployedBytecode.object",
            "evm.deployedBytecode.linkReferences",
            "evm.deployedBytecode.immutableReferences"
          ]
        }
      }
    }
  };
}

function validateCase(caseInput: Pass35A4SolcCase): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  add(caseInput?.schemaVersion === "velmere.pass35.audit-a4-solc-case.v1", "a4_case_schema_invalid");
  add(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"].includes(caseInput?.inputClass), "a4_case_input_class_invalid");
  add(CASE_REF.test(String(caseInput?.caseRef ?? "")), "a4_case_ref_invalid");
  add(/^\d+$/.test(String(caseInput?.chainId ?? "")), "a4_chain_id_invalid");
  add(ADDRESS.test(String(caseInput?.contractAddress ?? "")), "a4_contract_address_invalid");
  add(VERSION.test(String(caseInput?.compiler?.version ?? "")), "a4_compiler_version_invalid");
  add(Number.isInteger(caseInput?.compiler?.optimizerRuns) && caseInput.compiler.optimizerRuns >= 0, "a4_optimizer_runs_invalid");
  add(typeof caseInput?.compiler?.evmVersion === "string" && caseInput.compiler.evmVersion.length > 0, "a4_evm_version_invalid");
  add(normalizeHex(caseInput?.deployedRuntimeBytecode) !== null, "a4_deployed_bytecode_invalid");
  add(normalizeSourcePath(caseInput?.target?.sourcePath) !== null, "a4_target_source_path_invalid");
  add(/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(String(caseInput?.target?.contractName ?? "")), "a4_target_contract_name_invalid");
  add(Array.isArray(caseInput?.sourceFiles) && caseInput.sourceFiles.length > 0 && caseInput.sourceFiles.length <= MAX_SOURCE_FILES, "a4_source_count_invalid");
  const seen = new Set<string>();
  let bytes = 0;
  for (const [index, source] of (caseInput?.sourceFiles ?? []).entries()) {
    const sourcePath = normalizeSourcePath(source?.path);
    add(sourcePath !== null, `a4_source_path_invalid:${index}`);
    if (sourcePath) {
      add(!seen.has(sourcePath), `a4_source_path_duplicate:${sourcePath}`);
      seen.add(sourcePath);
    }
    add(typeof source?.content === "string" && source.content.trim().length > 0, `a4_source_content_invalid:${index}`);
    bytes += Buffer.byteLength(String(source?.content ?? ""));
  }
  add(bytes <= MAX_SOURCE_BYTES, "a4_source_bytes_exceeded");
  add(seen.has(String(caseInput?.target?.sourcePath ?? "")), "a4_target_source_missing");
  if (caseInput?.chainProviderReceiptSha256 != null) add(canonicalDigest(caseInput.chainProviderReceiptSha256) !== null, "a4_chain_receipt_digest_invalid");
  return [...new Set(blockers)].sort();
}

function validateToolSpec(tool: Pass35A4ToolSpec): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  const record = tool && typeof tool === "object" && !Array.isArray(tool)
    ? tool as unknown as Record<string, unknown>
    : null;
  add(record !== null, "a4_tool_spec_not_object");
  if (!record) return blockers;
  add(
    Object.keys(record).every((key) => TOOL_SPEC_KEYS.has(key)),
    "a4_tool_spec_unknown_key",
  );
  for (const key of ["schemaVersion", "toolId", "executionMode", "executablePath", "expectedVersion", "timeoutMs", "maxStdoutBytes", "fixtureOnly"]) {
    add(Object.prototype.hasOwnProperty.call(record, key), `a4_tool_spec_missing_key:${key}`);
  }
  add(tool.schemaVersion === "velmere.pass35.audit-a4-tool-spec.v1", "a4_tool_spec_schema_invalid");
  add(typeof tool.toolId === "string" && /^[A-Za-z0-9._:-]{1,120}$/u.test(tool.toolId), "a4_tool_id_invalid");
  add(tool.executionMode === "NATIVE_BINARY" || tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY", "a4_tool_execution_mode_invalid");
  add(typeof tool.executablePath === "string" && tool.executablePath.length > 0 && tool.executablePath.length <= 1024 && !tool.executablePath.includes("\u0000") && !/[\r\n]/u.test(tool.executablePath), "a4_tool_executable_path_invalid");
  add(VERSION.test(String(tool.expectedVersion ?? "")), "a4_tool_expected_version_invalid");
  add(Number.isInteger(tool.timeoutMs) && tool.timeoutMs >= 1_000 && tool.timeoutMs <= 120_000, "a4_tool_timeout_invalid");
  add(Number.isInteger(tool.maxStdoutBytes) && tool.maxStdoutBytes >= 1_024 && tool.maxStdoutBytes <= 4 * 1024 * 1024, "a4_tool_stdout_budget_invalid");
  add(typeof tool.fixtureOnly === "boolean", "a4_tool_fixture_flag_invalid");
  if (tool.executionMode === "NATIVE_BINARY") {
    add(tool.fixtureOnly === false, "a4_native_tool_fixture_flag_invalid");
    add(tool.executablePath !== "__CURRENT_NODE__", "a4_native_tool_current_node_forbidden");
    add(path.isAbsolute(tool.executablePath), "a4_native_tool_absolute_path_required");
    add(canonicalDigest(tool.expectedExecutableSha256) !== null, "a4_native_tool_executable_digest_invalid");
    add(tool.entrypointPath == null, "a4_native_tool_entrypoint_forbidden");
    add(tool.expectedEntrypointSha256 == null, "a4_native_tool_entrypoint_digest_forbidden");
  } else if (tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY") {
    add(tool.fixtureOnly === true, "a4_fixture_tool_flag_required");
    add(tool.executablePath === "__CURRENT_NODE__", "a4_fixture_tool_current_node_required");
    add(typeof tool.entrypointPath === "string" && tool.entrypointPath.length > 0 && tool.entrypointPath.length <= 1024, "a4_fixture_tool_entrypoint_invalid");
    add(canonicalDigest(tool.expectedEntrypointSha256) !== null, "a4_fixture_tool_entrypoint_digest_invalid");
    add(tool.expectedExecutableSha256 == null, "a4_fixture_tool_executable_digest_must_be_null");
  }
  return [...new Set(blockers)].sort();
}

export function executePinnedSolcReproduction(caseInput: Pass35A4SolcCase, tool: Pass35A4ToolSpec, options: { rootPath?: string } = {}): Pass35A4SolcReceipt {
  const root = path.resolve(options.rootPath ?? process.cwd());
  const blockers = [...validateCase(caseInput), ...validateToolSpec(tool)];
  let executableSha256: string | null = null;
  let entrypointSha256: string | null = null;
  let observedVersion: string | null = null;
  let observedVersionOutputSha256: string | null = null;
  let versionArgsSha256: string | null = null;
  let compileArgsSha256: string | null = null;
  let exitCode: number | null = null;
  let rawOutputSha256: string | null = null;
  let compilerErrorCount = 0;
  let compilerWarningCount = 0;
  let unresolvedLinkReferenceCount = 0;
  let immutableReferenceCount = 0;
  let compilationStatus: "EXECUTED" | "BLOCKED" | "FAILED" = blockers.length ? "BLOCKED" : "EXECUTED";
  let comparison: Pass35A4SolcReceipt["comparison"] = {
    status: "BLOCKED",
    compiledRuntimeBytecodeSha256: null,
    compiledCoreSha256: null,
    deployedCoreSha256: null,
    compiledMetadataBytes: null,
    deployedMetadataBytes: null,
    firstMismatchByte: null,
    immutableBindings: [],
  };

  const standardJson = buildStandardJson(caseInput);
  const standardJsonText = stable(standardJson);
  if (!blockers.length) {
    try {
      const versionRun = runTool(root, tool, ["--version"], "");
      executableSha256 = versionRun.executableSha256;
      entrypointSha256 = versionRun.entrypointSha256;
      versionArgsSha256 = versionRun.argsSha256;
      observedVersionOutputSha256 = sha256(`${versionRun.stdout}\n${versionRun.stderr}`);
      observedVersion = (versionRun.stdout.match(/\b\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}\b/i) ?? [null])[0];
      if (versionRun.errorCode) blockers.push(`a4_compiler_boundary_failure:${versionRun.errorCode}`);
      if (versionRun.exitCode !== 0) blockers.push("a4_compiler_version_command_failed");
      if (observedVersion !== tool.expectedVersion || observedVersion !== caseInput.compiler.version) blockers.push("a4_compiler_version_mismatch");
      const compileRun = runTool(root, tool, ["--standard-json"], standardJsonText);
      compileArgsSha256 = compileRun.argsSha256;
      exitCode = compileRun.exitCode;
      rawOutputSha256 = sha256(`${compileRun.stdout}\n${compileRun.stderr}`);
      if (compileRun.errorCode) blockers.push(`a4_compiler_boundary_failure:${compileRun.errorCode}`);
      if (compileRun.error || compileRun.signal || compileRun.exitCode !== 0) blockers.push("a4_compiler_process_failed");
      let output: SolcOutput | null = null;
      try { output = JSON.parse(compileRun.stdout); } catch { blockers.push("a4_compiler_output_not_json"); }
      const diagnostics = Array.isArray(output?.errors) ? output.errors : [];
      compilerErrorCount = diagnostics.filter((row) => row?.severity === "error").length;
      compilerWarningCount = diagnostics.filter((row) => row?.severity === "warning").length;
      if (compilerErrorCount > 0) blockers.push("a4_compiler_reported_errors");
      const contract = output?.contracts?.[caseInput.target.sourcePath]?.[caseInput.target.contractName];
      if (!contract) blockers.push("a4_compiler_target_missing");
      const compiledHex = normalizeHex(contract?.evm?.deployedBytecode?.object ? `0x${String(contract.evm.deployedBytecode.object).replace(/^0x/, "")}` : null);
      const deployedHex = normalizeHex(caseInput.deployedRuntimeBytecode);
      const linkReferences = contract?.evm?.deployedBytecode?.linkReferences;
      unresolvedLinkReferenceCount = countNestedReferenceRows(linkReferences);
      if (unresolvedLinkReferenceCount > 0) blockers.push("a4_unresolved_link_references");
      const immutableRefs = flattenRefs(contract?.evm?.deployedBytecode?.immutableReferences);
      immutableReferenceCount = immutableRefs.length;
      if (compiledHex && deployedHex) {
        const compiledBytes = Buffer.from(compiledHex.slice(2), "hex");
        const deployedBytes = Buffer.from(deployedHex.slice(2), "hex");
        const compiledStripped = stripSolidityMetadata(compiledHex);
        const deployedStripped = stripSolidityMetadata(deployedHex);
        const compiledCore = Buffer.from(compiledStripped.core);
        const deployedCore = Buffer.from(deployedStripped.core);
        const bindings: ImmutableBinding[] = [];
        let immutableInvalid = false;
        for (const ref of immutableRefs) {
          if (ref.start + ref.length > compiledCore.length || ref.start + ref.length > deployedCore.length) {
            blockers.push(`a4_immutable_reference_out_of_range:${ref.astId}:${ref.start}:${ref.length}`);
            immutableInvalid = true;
            continue;
          }
          const value = deployedCore.subarray(ref.start, ref.start + ref.length);
          bindings.push({ astId: ref.astId, start: ref.start, length: ref.length, deployedValueHex: `0x${value.toString("hex")}`, deployedValueSha256: sha256(value) });
          compiledCore.fill(0, ref.start, ref.start + ref.length);
          deployedCore.fill(0, ref.start, ref.start + ref.length);
        }
        const exact = compiledBytes.equals(deployedBytes);
        const strippedEqual = compiledStripped.core.equals(deployedStripped.core);
        const maskedEqual = !immutableInvalid && compiledCore.equals(deployedCore);
        let status: Pass35A4SolcReceipt["comparison"]["status"] = "MISMATCH";
        if (exact) status = "EXACT_MATCH";
        else if (strippedEqual && (compiledStripped.valid || deployedStripped.valid)) status = "MATCH_AFTER_METADATA_STRIP";
        else if (maskedEqual && immutableRefs.length > 0 && !compiledStripped.valid && !deployedStripped.valid) status = "MATCH_AFTER_IMMUTABLE_BINDING";
        else if (maskedEqual && immutableRefs.length > 0) status = "MATCH_AFTER_IMMUTABLE_BINDING_AND_METADATA_STRIP";
        comparison = {
          status,
          compiledRuntimeBytecodeSha256: sha256(compiledBytes),
          compiledCoreSha256: sha256(compiledCore),
          deployedCoreSha256: sha256(deployedCore),
          compiledMetadataBytes: compiledStripped.metadataBytes,
          deployedMetadataBytes: deployedStripped.metadataBytes,
          firstMismatchByte: status === "MISMATCH" ? firstMismatch(compiledCore, deployedCore) : null,
          immutableBindings: bindings,
        };
        if (status === "MISMATCH") blockers.push("a4_source_to_deployed_bytecode_mismatch");
      } else blockers.push("a4_compiled_runtime_bytecode_missing");
      compilationStatus = blockers.some((code) => code.includes("process_failed") || code.includes("not_json") || code.includes("reported_errors")) ? "FAILED" : blockers.length ? "BLOCKED" : "EXECUTED";
    } catch (error) {
      blockers.push(`a4_tool_execution_exception:${error instanceof Error ? error.message : String(error)}`);
      compilationStatus = "FAILED";
    }
  }

  const sourceBundle = caseInput.sourceFiles
    .map((source) => ({ path: source.path.replaceAll("\\", "/"), content: source.content.replace(/\r\n?/g, "\n") }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const normalizedBlockers = [...new Set(blockers)].sort();
  const observedExecutionMode = tool.executionMode === "NATIVE_BINARY" || tool.executionMode === "NODE_SCRIPT_FIXTURE_ONLY"
    ? tool.executionMode
    : null;
  const paidGateEligible = normalizedBlockers.length === 0
    && caseInput.inputClass === "CUSTOMER_SUPPLIED_VERIFIED"
    && tool.executionMode === "NATIVE_BINARY"
    && tool.fixtureOnly === false
    && canonicalDigest(caseInput.chainProviderReceiptSha256) !== null
    && comparison.status !== "MISMATCH"
    && comparison.status !== "BLOCKED";
  const core = {
    schemaVersion: "velmere.pass35.audit-a4-solc-reproduction-receipt.v1" as const,
    engineId: PASS35_A4_SOLC_REPRODUCTION_ID,
    caseRef: caseInput.caseRef,
    inputClass: caseInput.inputClass,
    tool: {
      toolId: tool.toolId,
      executionMode: observedExecutionMode,
      executableSha256,
      entrypointSha256,
      observedVersion,
      observedVersionOutputSha256,
      executionBoundaryId: PASS36_EXTERNAL_COMMAND_BOUNDARY_ID,
      versionArgsSha256,
      compileArgsSha256,
      isolatedWorkingDirectory: true as const,
      inheritedEnvironment: false as const,
      fixtureOnly: tool.fixtureOnly,
    },
    inputIdentity: {
      sourceBundleSha256: sha256(stable(sourceBundle)),
      compilerSettingsSha256: sha256(stable(caseInput.compiler)),
      standardJsonInputSha256: sha256(standardJsonText),
      deployedRuntimeBytecodeSha256: normalizeHex(caseInput.deployedRuntimeBytecode) ? sha256(Buffer.from(caseInput.deployedRuntimeBytecode.slice(2), "hex")) : sha256("invalid"),
      chainProviderReceiptSha256: canonicalDigest(caseInput.chainProviderReceiptSha256),
    },
    target: { sourcePath: caseInput.target.sourcePath, contractName: caseInput.target.contractName, chainId: caseInput.chainId, contractAddress: caseInput.contractAddress.toLowerCase() },
    compilation: { status: compilationStatus, exitCode, rawOutputSha256, compilerErrorCount, compilerWarningCount, unresolvedLinkReferenceCount, immutableReferenceCount },
    comparison,
    blockers: normalizedBlockers,
    paidGateEligible,
    promotionAllowed: false as const,
    fullAuditClaimAllowed: false as const,
    truthBoundary: tool.fixtureOnly
      ? "This receipt proves the pinned compiler adapter, standard-json binding, immutable masking and fail-closed comparison against a synthetic fixture tool only. It does not prove that an official solc binary or real chain case was executed."
      : "This receipt can prove one exact compiler execution and source-to-runtime structural binding. It does not prove exploitability, complete audit coverage, independent assurance or permission to sell the report.",
  };
  return { ...core, receiptSha256: sha256(stable(core)) };
}
