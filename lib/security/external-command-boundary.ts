import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export const PASS36_EXTERNAL_COMMAND_BOUNDARY_ID = "velmere.pass36.external-command-boundary.v4" as const;
export const PASS36_POSIX_PROCESS_GROUP_BROKER_ID = "velmere.pass36.posix-process-group-broker.v1" as const;

const POSIX_PROCESS_GROUP_BROKER_RELATIVE_PATH = "scripts/pass36/posix-process-group-broker.mjs";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ERROR_PREFIX = /^[a-z][a-z0-9_]{0,63}$/;
const SENSITIVE_ENV = /(?:SECRET|TOKEN|PASSWORD|PASSWD|COOKIE|SESSION|PRIVATE|CREDENTIAL|DATABASE|SUPABASE|STRIPE|RESEND|AWS|GCP|AZURE|KEY(?:_|$)|SIGNER|APPROVER|AUTH|OAUTH|JWT)/i;
const DANGEROUS_ENV = /^(?:PATH|NODE_OPTIONS|NODE_PATH|PYTHONPATH|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.*|BASH_ENV|ENV|PATHEXT)$/i;
const NODE_INTERPRETER = /(?:^|[\\/])node(?:\.exe)?$/i;
const PYTHON_INTERPRETER = /(?:^|[\\/])python(?:3)?(?:\.exe)?$/i;
const POWERSHELL_INTERPRETER = /(?:^|[\\/])(?:pwsh|powershell)(?:\.exe)?$/i;
const POSIX_SHELL_INTERPRETER = /(?:^|[\\/])(?:bash|sh)$/i;
const SCRIPT_INTERPRETER = /(?:^|[\\/])(?:node(?:\.exe)?|python(?:3)?(?:\.exe)?|pwsh(?:\.exe)?|powershell(?:\.exe)?|bash|sh)$/i;
const SCRIPT_EXTENSION = /\.(?:bat|cmd|cjs|js|mjs|ps1|py|sh)$/i;
const MAX_EXECUTABLE_BYTES = 256 * 1024 * 1024;
const MAX_BOUND_FILE_BYTES = 128 * 1024 * 1024;
const MAX_ARGS = 64;
const MAX_ARG_BYTES = 4096;

export type ExternalCommandFileBinding = {
  index: number;
  expectedSha256: string;
};

export type ExternalCommandExecutionProfile =
  | { kind: "native"; toolFamily: "solc" }
  | { kind: "node-script" | "python-script" | "posix-shell-script"; entrypointIndex: 0 }
  | { kind: "powershell-file"; entrypointIndex: 1 };

export type ExternalCommandBoundary = {
  command: string;
  args?: string[];
  expectedExecutableSha256: string;
  expectedArgsSha256: string;
  executionProfile: ExternalCommandExecutionProfile;
  fileArgumentBindings?: ExternalCommandFileBinding[];
  environmentAllowlist?: string[];
  containmentBroker?: "POSIX_PROCESS_GROUP_V1";
};

export type ExternalCommandRunResult = SpawnSyncReturns<string> & {
  executionBoundaryId: typeof PASS36_EXTERNAL_COMMAND_BOUNDARY_ID;
  executableSha256: string;
  argsSha256: string;
  boundFileSha256: Record<string, string>;
  executionImageSha256: string;
  executionImageFiles: number;
};

export function inspectExternalCommandPlatformContainment() {
  return process.platform === "win32"
    ? {
        executable: false as const,
        status: "BLOCKED_WINDOWS_JOB_OBJECT_BROKER_REQUIRED" as const,
        broker: null,
        reason: "Uncontained Windows process trees can survive parent timeout; a pinned CREATE_SUSPENDED Job Object broker with KILL_ON_JOB_CLOSE is required.",
      }
    : {
        executable: false as const,
        status: "BLOCKED_POSIX_PROCESS_GROUP_BROKER_REQUIRED" as const,
        broker: null,
        reason: "A pinned process-group broker with bounded descendant termination and zero-orphan verification is required.",
      };
}

type FileIdentity = {
  dev: number;
  ino: number;
  size: number;
  mode: number;
  mtimeMs: number;
  ctimeMs: number;
};

type VerifiedSourceFile = {
  path: string;
  bytes: Buffer;
  sha256: string;
  identity: FileIdentity;
};

type ExecutionRoot = {
  root: string;
  image: string;
  work: string;
  rootObjectIdentity: Pick<FileIdentity, "dev" | "ino">;
};

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function externalCommandArgsSha256(args: readonly string[]): string {
  return sha256Bytes(Buffer.from(JSON.stringify(args), "utf8"));
}

function requireDigest(value: unknown, code: string): string {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!SHA256.test(text)) throw new Error(code);
  return text;
}

function fileIdentity(metadata: ReturnType<typeof fstatSync>): FileIdentity {
  return {
    dev: Number(metadata.dev),
    ino: Number(metadata.ino),
    size: Number(metadata.size),
    mode: Number(metadata.mode),
    mtimeMs: Number(metadata.mtimeMs),
    ctimeMs: Number(metadata.ctimeMs),
  };
}

function sameFileObject(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return sameFileObject(left, right)
    && left.size === right.size
    && left.mode === right.mode
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function readVerifiedSourceFile(input: string, maxBytes: number, code: string): VerifiedSourceFile {
  if (!path.isAbsolute(input)) throw new Error(`${code}_path_not_absolute`);
  let descriptor: number | null = null;
  try {
    const entry = lstatSync(input);
    if (entry.isSymbolicLink()) throw new Error(`${code}_symlink_forbidden`);
    if (!entry.isFile()) throw new Error(`${code}_not_regular_file`);
    const resolved = realpathSync(input);
    const expected = path.resolve(input);
    const samePath = process.platform === "win32" ? resolved.toLowerCase() === expected.toLowerCase() : resolved === expected;
    if (!samePath) throw new Error(`${code}_realpath_mismatch`);
    const flags = constants.O_RDONLY | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW);
    descriptor = openSync(resolved, flags);
    const before = fileIdentity(fstatSync(descriptor));
    const entryIdentity = fileIdentity(entry);
    if (!sameFileObject(entryIdentity, before)) throw new Error(`${code}_identity_race`);
    if (before.size <= 0 || before.size > maxBytes) throw new Error(`${code}_size_invalid`);
    if (process.platform !== "win32" && (before.mode & 0o022) !== 0) throw new Error(`${code}_writable_by_group_or_world`);
    const bytes = readFileSync(descriptor);
    const after = fileIdentity(fstatSync(descriptor));
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) throw new Error(`${code}_changed_during_read`);
    return { path: resolved, bytes, sha256: sha256Bytes(bytes), identity: before };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${code}_`)) throw error;
    throw new Error(`${code}_unavailable`, { cause: error });
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function validateArgs(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ARGS) throw new Error("external_command_args_invalid");
  return value.map((entry) => {
    if (typeof entry !== "string" || Buffer.byteLength(entry, "utf8") > MAX_ARG_BYTES || entry.includes("\0") || /[\r\n]/.test(entry)) {
      throw new Error("external_command_arg_invalid");
    }
    return entry;
  });
}

function sanitizedEnvironment(allowlist: readonly string[], isolatedHome: string, isolatedExecutableDirectory: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV || "production",
    PATH: isolatedExecutableDirectory,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    TMPDIR: isolatedHome,
    TMP: isolatedHome,
    TEMP: isolatedHome,
  };
  if (process.platform === "win32") env.PATHEXT = ".EXE";
  for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "LANG", "LC_ALL"]) {
    const value = process.env[name];
    if (typeof value === "string" && value.length <= 16_384 && !value.includes("\0")) env[name] = value;
  }
  for (const name of new Set(allowlist)) {
    if (!ENV_NAME.test(name)) throw new Error("external_command_environment_name_invalid");
    if (SENSITIVE_ENV.test(name)) throw new Error("external_command_sensitive_environment_forbidden");
    if (DANGEROUS_ENV.test(name)) throw new Error("external_command_dangerous_environment_forbidden");
    const value = process.env[name];
    if (typeof value === "string" && value.length <= 16_384 && !value.includes("\0")) env[name] = value;
  }
  return env;
}

function exactProfileKeys(profile: ExternalCommandExecutionProfile, expected: string[]): boolean {
  return JSON.stringify(Object.keys(profile).sort()) === JSON.stringify([...expected].sort());
}

function validateExecutionProfile(
  command: string,
  commandArgs: readonly string[],
  boundIndexes: ReadonlySet<number>,
  value: unknown,
): ExternalCommandExecutionProfile {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { kind?: unknown }).kind !== "string") {
    throw new Error("external_command_execution_profile_invalid");
  }
  const profile = structuredClone(value) as ExternalCommandExecutionProfile;
  if (profile.kind === "native") {
    if (
      !exactProfileKeys(profile, ["kind", "toolFamily"])
      || profile.toolFamily !== "solc"
      || SCRIPT_INTERPRETER.test(command)
      || SCRIPT_EXTENSION.test(command)
    ) {
      throw new Error("external_command_native_profile_invalid");
    }
    const exactArgs = JSON.stringify(commandArgs);
    if (exactArgs !== JSON.stringify(["--version"]) && exactArgs !== JSON.stringify(["--standard-json"])) {
      throw new Error("external_command_native_argument_policy_invalid");
    }
    return profile;
  }
  if (!exactProfileKeys(profile, ["kind", "entrypointIndex"])) throw new Error("external_command_execution_profile_invalid");
  if (profile.kind === "node-script") {
    if (!NODE_INTERPRETER.test(command) || profile.entrypointIndex !== 0) throw new Error("external_command_node_profile_invalid");
  } else if (profile.kind === "python-script") {
    if (!PYTHON_INTERPRETER.test(command) || profile.entrypointIndex !== 0) throw new Error("external_command_python_profile_invalid");
  } else if (profile.kind === "posix-shell-script") {
    if (!POSIX_SHELL_INTERPRETER.test(command) || profile.entrypointIndex !== 0) throw new Error("external_command_shell_profile_invalid");
  } else if (profile.kind === "powershell-file") {
    if (!POWERSHELL_INTERPRETER.test(command) || profile.entrypointIndex !== 1 || commandArgs[0]?.toLowerCase() !== "-file") {
      throw new Error("external_command_powershell_profile_invalid");
    }
  } else {
    throw new Error("external_command_execution_profile_invalid");
  }
  if (profile.entrypointIndex >= commandArgs.length || !boundIndexes.has(profile.entrypointIndex)) {
    throw new Error("external_command_interpreter_entrypoint_unbound");
  }
  return profile;
}

function validateBindings(
  command: string,
  commandArgs: string[],
  bindings: readonly ExternalCommandFileBinding[],
  profile: unknown,
): { sources: Map<number, VerifiedSourceFile>; digests: Record<string, string>; profile: ExternalCommandExecutionProfile } {
  const seen = new Set<number>();
  const sources = new Map<number, VerifiedSourceFile>();
  const digests: Record<string, string> = {};
  for (const binding of bindings) {
    if (!Number.isInteger(binding.index) || binding.index < 0 || binding.index >= commandArgs.length || seen.has(binding.index)) {
      throw new Error("external_command_file_binding_index_invalid");
    }
    seen.add(binding.index);
    const file = readVerifiedSourceFile(commandArgs[binding.index], MAX_BOUND_FILE_BYTES, "external_command_bound_file");
    const expected = requireDigest(binding.expectedSha256, "external_command_bound_file_digest_invalid");
    if (file.sha256 !== expected) throw new Error("external_command_bound_file_digest_mismatch");
    sources.set(binding.index, file);
    digests[String(binding.index)] = file.sha256;
  }
  const validatedProfile = validateExecutionProfile(command, commandArgs, seen, profile);
  for (let index = 0; index < commandArgs.length; index += 1) {
    if (path.isAbsolute(commandArgs[index]) && !seen.has(index)) throw new Error("external_command_absolute_file_argument_unbound");
  }
  return { sources, digests, profile: validatedProfile };
}

function createExecutionRoot(): ExecutionRoot {
  const temporaryRoot = realpathSync(tmpdir());
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const root = path.join(temporaryRoot, `velmere-external-command-${randomBytes(16).toString("hex")}`);
    try {
      mkdirSync(root, { mode: 0o700 });
      const image = path.join(root, "image");
      const work = path.join(root, "work");
      mkdirSync(image, { mode: 0o700 });
      mkdirSync(work, { mode: 0o700 });
      const metadata = fileIdentity(lstatSync(root));
      return { root, image, work, rootObjectIdentity: { dev: metadata.dev, ino: metadata.ino } };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("external_command_execution_root_collision");
}

function safeExtension(sourcePath: string): string {
  const extension = path.extname(sourcePath);
  return /^\.[A-Za-z0-9]{1,12}$/u.test(extension) ? extension.toLowerCase() : ".bin";
}

function writeExecutionImageFile(target: string, source: VerifiedSourceFile, executable: boolean): VerifiedSourceFile {
  const descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, executable ? 0o700 : 0o600);
  try {
    writeFileSync(descriptor, source.bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  chmodSync(target, executable ? 0o700 : 0o600);
  const verified = readVerifiedSourceFile(target, executable ? MAX_EXECUTABLE_BYTES : MAX_BOUND_FILE_BYTES, "external_command_execution_image");
  if (verified.sha256 !== source.sha256) throw new Error("external_command_execution_image_digest_mismatch");
  return verified;
}

function verifyOriginUnchanged(source: VerifiedSourceFile): void {
  const current = readVerifiedSourceFile(source.path, Math.max(source.bytes.length, 1), "external_command_origin_recheck");
  if (current.sha256 !== source.sha256 || !sameFileIdentity(current.identity, source.identity)) {
    throw new Error("external_command_source_changed_before_spawn");
  }
}

function verifyImageUnchanged(image: VerifiedSourceFile): void {
  const current = readVerifiedSourceFile(image.path, Math.max(image.bytes.length, 1), "external_command_execution_image_recheck");
  if (current.sha256 !== image.sha256 || !sameFileObject(current.identity, image.identity)
      || current.identity.size !== image.identity.size || current.identity.mode !== image.identity.mode) {
    throw new Error("external_command_execution_image_changed");
  }
}


function writeGeneratedExecutionImageFile(target: string, bytes: Buffer, executable: boolean): VerifiedSourceFile {
  const descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, executable ? 0o700 : 0o600);
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  chmodSync(target, executable ? 0o700 : 0o600);
  const verified = readVerifiedSourceFile(target, executable ? MAX_EXECUTABLE_BYTES : MAX_BOUND_FILE_BYTES, "external_command_generated_image");
  if (verified.sha256 !== sha256Bytes(bytes)) throw new Error("external_command_generated_image_digest_mismatch");
  return verified;
}

type PosixBrokerResult = {
  schemaVersion: "velmere.pass36.posix-process-group-result.v1";
  brokerId: typeof PASS36_POSIX_PROCESS_GROUP_BROKER_ID;
  reason: "COMPLETED" | "SPAWN_FAILED" | "OUTPUT_LIMIT_EXCEEDED" | "TIMEOUT" | "STDIN_FAILED" | "ORPHAN_DESCENDANT" | "PROCESS_GROUP_NOT_CLEAN";
  status: number | null;
  signal: NodeJS.Signals | null;
  stdoutBytes: number;
  stderrBytes: number;
  processGroupClean: boolean;
};

function parsePosixBrokerResult(value: Buffer, maxOutputBytes: number, code: string): PosixBrokerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error(`${code}_broker_result_json_invalid`);
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  const exactKeys = ["schemaVersion", "brokerId", "reason", "status", "signal", "stdoutBytes", "stderrBytes", "processGroupClean"];
  if (!record || JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(exactKeys.sort())
      || record.schemaVersion !== "velmere.pass36.posix-process-group-result.v1"
      || record.brokerId !== PASS36_POSIX_PROCESS_GROUP_BROKER_ID
      || !["COMPLETED", "SPAWN_FAILED", "OUTPUT_LIMIT_EXCEEDED", "TIMEOUT", "STDIN_FAILED", "ORPHAN_DESCENDANT", "PROCESS_GROUP_NOT_CLEAN"].includes(String(record.reason))
      || !(record.status === null || (Number.isInteger(record.status) && Number(record.status) >= 0 && Number(record.status) <= 255))
      || !(record.signal === null || (typeof record.signal === "string" && /^SIG[A-Z0-9]+$/u.test(record.signal)))
      || !Number.isInteger(record.stdoutBytes) || Number(record.stdoutBytes) < 0 || Number(record.stdoutBytes) > maxOutputBytes + 65_536
      || !Number.isInteger(record.stderrBytes) || Number(record.stderrBytes) < 0 || Number(record.stderrBytes) > maxOutputBytes + 65_536
      || typeof record.processGroupClean !== "boolean") {
    throw new Error(`${code}_broker_result_schema_invalid`);
  }
  return record as unknown as PosixBrokerResult;
}

function resolvePinnedPosixBrokerSource(): VerifiedSourceFile {
  const sourceRoot = realpathSync(process.cwd());
  const brokerPath = path.resolve(sourceRoot, POSIX_PROCESS_GROUP_BROKER_RELATIVE_PATH);
  const prefix = `${sourceRoot}${path.sep}`;
  if (brokerPath !== sourceRoot && !brokerPath.startsWith(prefix)) throw new Error("external_command_broker_path_outside_source_root");
  return readVerifiedSourceFile(brokerPath, 1024 * 1024, "external_command_broker_source");
}


function sleepSync(milliseconds: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function cleanupPosixProcessGroupFromPidFile(pidFilePath: string): void {
  if (process.platform === "win32") return;
  try {
    const file = readVerifiedSourceFile(pidFilePath, 4096, "external_command_broker_pid");
    const parsed = JSON.parse(file.bytes.toString("utf8")) as Record<string, unknown>;
    const exact = ["schemaVersion", "brokerId", "pid"];
    if (JSON.stringify(Object.keys(parsed).sort()) !== JSON.stringify(exact.sort())
        || parsed.schemaVersion !== "velmere.pass36.posix-process-group-pid.v1"
        || parsed.brokerId !== PASS36_POSIX_PROCESS_GROUP_BROKER_ID
        || !Number.isInteger(parsed.pid) || Number(parsed.pid) <= 1) return;
    const pgid = Number(parsed.pid);
    try { process.kill(-pgid, "SIGTERM"); } catch { /* Process group may already be gone. */ }
    sleepSync(100);
    try { process.kill(-pgid, "SIGKILL"); } catch { /* Process group may already be gone. */ }
    sleepSync(50);
  } catch { /* Invalid or stale broker PID evidence is ignored fail-closed. */ }
}

function removeExecutionRoot(executionRoot: ExecutionRoot): void {
  const temporaryRoot = realpathSync(tmpdir());
  const expectedPrefix = `${temporaryRoot}${path.sep}`;
  const resolved = realpathSync(executionRoot.root);
  const samePrefix = process.platform === "win32"
    ? resolved.toLowerCase().startsWith(expectedPrefix.toLowerCase())
    : resolved.startsWith(expectedPrefix);
  const metadata = fileIdentity(lstatSync(resolved));
  if (!samePrefix || !path.basename(resolved).startsWith("velmere-external-command-")
      || metadata.dev !== executionRoot.rootObjectIdentity.dev || metadata.ino !== executionRoot.rootObjectIdentity.ino) {
    throw new Error("external_command_cleanup_identity_mismatch");
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export function runBoundExternalCommand(args: {
  boundary: ExternalCommandBoundary;
  input: string;
  timeoutMs: number;
  maxInputBytes?: number;
  maxOutputBytes: number;
  errorPrefix: string;
  beforeSpawnTestHook?: () => void;
}): ExternalCommandRunResult {
  const errorPrefix = typeof args.errorPrefix === "string" && ERROR_PREFIX.test(args.errorPrefix) ? args.errorPrefix : "";
  if (!errorPrefix) throw new Error("external_command_error_prefix_invalid");
  const containment = inspectExternalCommandPlatformContainment();
  const requestedBroker = args.boundary.containmentBroker;
  if (requestedBroker !== undefined && requestedBroker !== "POSIX_PROCESS_GROUP_V1") {
    throw new Error(`${errorPrefix}_containment_broker_invalid`);
  }
  const posixBrokerEnabled = process.platform !== "win32" && requestedBroker === "POSIX_PROCESS_GROUP_V1";
  if (!containment.executable && !posixBrokerEnabled) {
    throw new Error(
      `${errorPrefix}_${process.platform === "win32" ? "windows_job_object_broker_required" : "posix_process_group_broker_required"}`,
    );
  }
  if (process.platform === "win32" && requestedBroker !== undefined) {
    throw new Error(`${errorPrefix}_windows_job_object_broker_required`);
  }
  const commandText = typeof args.boundary.command === "string" ? args.boundary.command.trim() : "";
  if (!commandText) throw new Error(`${errorPrefix}_command_missing`);
  const executable = readVerifiedSourceFile(commandText, MAX_EXECUTABLE_BYTES, `${errorPrefix}_executable`);
  if (process.platform !== "win32" && (executable.identity.mode & 0o111) === 0) throw new Error(`${errorPrefix}_executable_not_executable`);
  const expectedExecutable = requireDigest(args.boundary.expectedExecutableSha256, `${errorPrefix}_executable_digest_invalid`);
  if (executable.sha256 !== expectedExecutable) throw new Error(`${errorPrefix}_executable_digest_mismatch`);
  const commandArgs = validateArgs(args.boundary.args);
  const argsSha256 = externalCommandArgsSha256(commandArgs);
  if (argsSha256 !== requireDigest(args.boundary.expectedArgsSha256, `${errorPrefix}_args_digest_invalid`)) {
    throw new Error(`${errorPrefix}_args_digest_mismatch`);
  }
  const bindings = validateBindings(executable.path, commandArgs, args.boundary.fileArgumentBindings ?? [], args.boundary.executionProfile);
  const timeout = Number(args.timeoutMs);
  if (!Number.isFinite(timeout) || timeout < 1_000 || timeout > 120_000) throw new Error(`${errorPrefix}_timeout_invalid`);
  const maxOutputBytes = Number(args.maxOutputBytes);
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024 || maxOutputBytes > 4 * 1024 * 1024) throw new Error(`${errorPrefix}_output_limit_invalid`);
  const maxInputBytes = args.maxInputBytes === undefined ? 2 * 1024 * 1024 : Number(args.maxInputBytes);
  if (!Number.isInteger(maxInputBytes) || maxInputBytes < 1024 || maxInputBytes > 8 * 1024 * 1024) throw new Error(`${errorPrefix}_input_limit_invalid`);
  const input = args.input;
  if (typeof input !== "string" || Buffer.byteLength(input, "utf8") > maxInputBytes) throw new Error(`${errorPrefix}_input_invalid`);

  let executionRoot: ExecutionRoot | null = null;
  try {
    executionRoot = createExecutionRoot();
    const commandImagePath = path.join(executionRoot.image, `command${safeExtension(executable.path)}`);
    const commandImage = writeExecutionImageFile(commandImagePath, executable, true);
    const frozenEnvironment = sanitizedEnvironment(args.boundary.environmentAllowlist ?? [], executionRoot.work, executionRoot.image);
    const executionArgs = [...commandArgs];
    const imageFiles: Array<{ role: string; sourceSha256: string; image: VerifiedSourceFile; executable: boolean }> = [
      { role: "command", sourceSha256: executable.sha256, image: commandImage, executable: true },
    ];
    for (const [index, source] of [...bindings.sources.entries()].sort((left, right) => left[0] - right[0])) {
      const target = path.join(executionRoot.image, `argument-${String(index).padStart(2, "0")}${safeExtension(source.path)}`);
      const image = writeExecutionImageFile(target, source, false);
      executionArgs[index] = target;
      imageFiles.push({ role: `argument:${index}`, sourceSha256: source.sha256, image, executable: false });
    }

    let spawnCommand = commandImage.path;
    let spawnArgs = executionArgs;
    let spawnTimeout = timeout;
    let spawnMaxBuffer = maxOutputBytes;
    let brokerResultPath: string | null = null;
    let brokerPidPath: string | null = null;
    if (posixBrokerEnabled) {
      const brokerRuntimeSource = bindings.profile.kind === "node-script"
        ? executable
        : readVerifiedSourceFile(process.execPath, MAX_EXECUTABLE_BYTES, `${errorPrefix}_broker_runtime`);
      if ((brokerRuntimeSource.identity.mode & 0o111) === 0) throw new Error(`${errorPrefix}_broker_runtime_not_executable`);
      const brokerSource = resolvePinnedPosixBrokerSource();
      const brokerRuntimeImage = writeExecutionImageFile(path.join(executionRoot.image, "broker-runtime"), brokerRuntimeSource, true);
      const brokerSourceImage = writeExecutionImageFile(path.join(executionRoot.image, "posix-process-group-broker.mjs"), brokerSource, false);
      brokerResultPath = path.join(executionRoot.work, "broker-result.json");
      brokerPidPath = path.join(executionRoot.work, "broker-pid.json");
      const plan = {
        schemaVersion: "velmere.pass36.posix-process-group-plan.v1",
        brokerId: PASS36_POSIX_PROCESS_GROUP_BROKER_ID,
        root: executionRoot.root,
        command: commandImage.path,
        args: executionArgs,
        cwd: executionRoot.work,
        environment: frozenEnvironment,
        timeoutMs: timeout,
        maxInputBytes,
        maxOutputBytes,
        resultPath: brokerResultPath,
        pidPath: brokerPidPath,
        files: imageFiles.map((row) => ({ path: row.image.path, sha256: row.image.sha256, executable: row.executable })),
      };
      const planBytes = Buffer.from(`${JSON.stringify(plan)}\n`, "utf8");
      const brokerPlanImage = writeGeneratedExecutionImageFile(path.join(executionRoot.image, "broker-plan.json"), planBytes, false);
      imageFiles.push(
        { role: "broker-runtime", sourceSha256: brokerRuntimeSource.sha256, image: brokerRuntimeImage, executable: true },
        { role: "broker-source", sourceSha256: brokerSource.sha256, image: brokerSourceImage, executable: false },
        { role: "broker-plan", sourceSha256: sha256Bytes(planBytes), image: brokerPlanImage, executable: false },
      );
      spawnCommand = brokerRuntimeImage.path;
      spawnArgs = [brokerSourceImage.path, brokerPlanImage.path];
      spawnTimeout = timeout + 10_000;
      spawnMaxBuffer = maxOutputBytes + 65_536;
    }

    const executionImageSha256 = sha256Bytes(Buffer.from(JSON.stringify(imageFiles.map((row) => ({
      role: row.role,
      byteLength: row.image.bytes.length,
      sha256: row.image.sha256,
      sourceSha256: row.sourceSha256,
      mode: row.executable ? 0o100700 : 0o100600,
    }))), "utf8"));

    if (args.beforeSpawnTestHook !== undefined) {
      if (typeof args.beforeSpawnTestHook !== "function") throw new Error("external_command_test_hook_invalid");
      args.beforeSpawnTestHook();
    }
    verifyOriginUnchanged(executable);
    for (const source of bindings.sources.values()) verifyOriginUnchanged(source);
    for (const row of imageFiles) verifyImageUnchanged(row.image);

    const rawResult = spawnSync(spawnCommand, spawnArgs, {
      cwd: executionRoot.work,
      input,
      encoding: "utf8",
      timeout: spawnTimeout,
      maxBuffer: spawnMaxBuffer,
      shell: false,
      windowsHide: true,
      env: frozenEnvironment,
    });
    for (const row of imageFiles) verifyImageUnchanged(row.image);
    if (rawResult.error) {
      if (brokerPidPath) cleanupPosixProcessGroupFromPidFile(brokerPidPath);
      const code = typeof (rawResult.error as NodeJS.ErrnoException).code === "string" ? (rawResult.error as NodeJS.ErrnoException).code : "spawn_failed";
      throw new Error(`${errorPrefix}_command_failed:${code}`);
    }

    let result = rawResult;
    if (posixBrokerEnabled) {
      if (!brokerResultPath) throw new Error(`${errorPrefix}_broker_result_path_missing`);
      const brokerResultFile = readVerifiedSourceFile(brokerResultPath, 65_536, `${errorPrefix}_broker_result`);
      const brokerResult = parsePosixBrokerResult(brokerResultFile.bytes, maxOutputBytes, errorPrefix);
      if (!brokerResult.processGroupClean) throw new Error(`${errorPrefix}_command_failed:process_group_not_clean`);
      if (brokerResult.reason !== "COMPLETED") {
        throw new Error(`${errorPrefix}_command_failed:${brokerResult.reason.toLowerCase()}`);
      }
      if (brokerResult.stdoutBytes !== Buffer.byteLength(String(rawResult.stdout ?? ""), "utf8")
          || brokerResult.stderrBytes !== Buffer.byteLength(String(rawResult.stderr ?? ""), "utf8")) {
        throw new Error(`${errorPrefix}_broker_output_length_mismatch`);
      }
      result = Object.assign(rawResult, {
        status: brokerResult.status,
        signal: brokerResult.signal,
        output: [null, String(rawResult.stdout ?? ""), String(rawResult.stderr ?? "")],
      }) as SpawnSyncReturns<string>;
    }
    if (result.status !== 0) {
      const stderrDigest = sha256Bytes(Buffer.from(String(result.stderr ?? ""), "utf8"));
      throw new Error(`${errorPrefix}_command_exit:${String(result.status)}:${stderrDigest}`);
    }
    return Object.assign(result, {
      executionBoundaryId: PASS36_EXTERNAL_COMMAND_BOUNDARY_ID,
      executableSha256: executable.sha256,
      argsSha256,
      boundFileSha256: bindings.digests,
      executionImageSha256,
      executionImageFiles: imageFiles.length,
    });
  } finally {
    if (executionRoot) removeExecutionRoot(executionRoot);
  }
}
