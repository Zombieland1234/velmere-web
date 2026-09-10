import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { safeBuildOutputPath } from "./build-profile.mjs";

const BUILD_MODES = new Set(["webpack", "turbopack"]);
const SAFE_BUILD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const MAX_BUILD_ID_BYTES = 256;
const MAX_LOCK_BYTES = 64 * 1024;
const EXTERNAL_LOCK_ROOT_NAME = "velmere-segmented-build-locks-v1";
const LOCK_NAMESPACE_DOMAIN = "velmere.segmented-build-lock.namespace.v1";
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const MINIMUM_ORPHAN_LOCK_AGE_MS = 15 * 60 * 1000;
const ORPHAN_RECOVERY_CONFIRMATION = "I_HAVE_DUAL_REVIEW_AND_OUTPUT_IS_ABSENT";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeErrorCode(error) {
  return error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "UNCLASSIFIED";
}

function lockPlatformBoundary() {
  const windows = process.platform === "win32";
  const linux = process.platform === "linux";
  return {
    platform: process.platform,
    linuxProcessIdentityAvailable: linux,
    posixOwnerAndModeVerified: linux && typeof process.getuid === "function",
    windowsAclOwnershipVerified: false,
    windowsAclStatus: windows
      ? "NOT_INDEPENDENTLY_VERIFIED_NO_EXTERNAL_SECURITY_CREDIT"
      : "NOT_APPLICABLE",
  };
}

function syncDirectoryAfterMutation(directory) {
  if (process.platform === "win32") {
    return {
      applied: false,
      status: "WINDOWS_DIRECTORY_FSYNC_UNAVAILABLE_NO_CRASH_DURABILITY_CREDIT",
    };
  }
  const directoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
  return { applied: true, status: "APPLIED" };
}

function samePhysicalFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function boundedDescriptorBytes(descriptor) {
  const before = fs.fstatSync(descriptor, { bigint: true });
  if (!before.isFile()) throw new Error("segmented_build_lock_descriptor_not_regular_file");
  if (before.size > BigInt(MAX_LOCK_BYTES)) throw new Error("segmented_build_lock_metadata_too_large");
  const bytes = Buffer.alloc(Number(before.size));
  let offset = 0;
  while (offset < bytes.length) {
    const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (read === 0) throw new Error("segmented_build_lock_descriptor_short_read");
    offset += read;
  }
  const after = fs.fstatSync(descriptor, { bigint: true });
  if (!samePhysicalFile(before, after) || before.size !== after.size) {
    throw new Error("segmented_build_lock_descriptor_changed_during_read");
  }
  return { bytes, stat: after };
}

function validatedCoordinates(root, mode, distDir) {
  if (!BUILD_MODES.has(mode)) throw new Error(`segmented_build_lock_invalid_mode:${mode}`);
  const expectedDistDir = `.next-pass25-${mode}`;
  if (distDir !== expectedDistDir) {
    throw new Error(`segmented_build_lock_dist_dir_mismatch:${distDir}:${expectedDistDir}`);
  }
  safeBuildOutputPath(root, distDir);
  return { root: fs.realpathSync(root), mode, distDir };
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function rejectSymlinkComponents(absolutePath, label) {
  const parsed = path.parse(absolutePath);
  let cursor = parsed.root;
  for (const component of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
      if (cursor !== absolutePath && !stat.isDirectory()) {
        throw new Error(`${label}_parent_not_directory`);
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
  }
}

function assertPrivateOwnedDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
  if (!stat.isDirectory()) throw new Error(`${label}_not_directory`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`${label}_owner_mismatch`);
  }
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error(`${label}_insecure_permissions`);
  }
}

function requestedExternalLockRoot(externalLockRoot) {
  if (process.platform !== "linux" && process.platform !== "win32") {
    throw new Error("segmented_build_lock_platform_unsupported");
  }
  if (externalLockRoot !== undefined && (typeof externalLockRoot !== "string" || externalLockRoot.length === 0)) {
    throw new Error("segmented_build_lock_root_invalid");
  }
  const requested = externalLockRoot
    ?? path.join(fs.realpathSync(os.tmpdir()), EXTERNAL_LOCK_ROOT_NAME);
  if (!path.isAbsolute(requested)) throw new Error("segmented_build_lock_root_must_be_absolute");
  return path.resolve(requested);
}

function externalLockCoordinates(sourceRoot, externalLockRoot, { create = true } = {}) {
  const requested = requestedExternalLockRoot(externalLockRoot);
  rejectSymlinkComponents(requested, "segmented_build_lock_root");
  if (create) fs.mkdirSync(requested, { recursive: true, mode: 0o700 });
  const rootPresent = fs.existsSync(requested);
  if (rootPresent) {
    rejectSymlinkComponents(requested, "segmented_build_lock_root");
    assertPrivateOwnedDirectory(requested, "segmented_build_lock_root");
  }
  const canonicalExternalRoot = rootPresent ? fs.realpathSync(requested) : requested;
  if (inside(sourceRoot, canonicalExternalRoot) || inside(canonicalExternalRoot, sourceRoot)) {
    throw new Error("segmented_build_lock_root_not_disjoint_from_source");
  }
  const namespaceSha256 = sha256(`${LOCK_NAMESPACE_DOMAIN}\0${sourceRoot}`);
  const namespaceDirectory = path.join(canonicalExternalRoot, namespaceSha256);
  if (create) {
    try {
      fs.mkdirSync(namespaceDirectory, { recursive: false, mode: 0o700 });
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error;
    }
  }
  const namespacePresent = fs.existsSync(namespaceDirectory);
  if (namespacePresent) {
    rejectSymlinkComponents(namespaceDirectory, "segmented_build_lock_namespace");
    assertPrivateOwnedDirectory(namespaceDirectory, "segmented_build_lock_namespace");
  }
  return {
    canonicalExternalRoot,
    namespaceDirectory,
    namespacePresent,
    namespaceSha256,
  };
}

function lockPathFor(root, mode, distDir, externalLockRoot, { create = true } = {}) {
  const coordinates = validatedCoordinates(root, mode, distDir);
  const external = externalLockCoordinates(coordinates.root, externalLockRoot, { create });
  const fileName = `segmented-${mode}-${distDir.replaceAll(".", "_")}.lock`;
  return {
    ...coordinates,
    ...external,
    directory: external.namespaceDirectory,
    fileName,
    filePath: path.join(external.namespaceDirectory, fileName),
    reportedPath: `external-build-locks/${external.namespaceSha256}/${fileName}`,
  };
}


function linuxBootIdSha256() {
  if (process.platform !== "linux") return null;
  try {
    const value = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    return value ? sha256(value) : null;
  } catch {
    return null;
  }
}

function linuxProcessStartTicks(pid) {
  if (process.platform !== "linux" || !Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const fields = stat.slice(close + 2).trim().split(/\s+/u);
    const startTicks = fields[19];
    return /^[0-9]+$/u.test(startTicks ?? "") ? startTicks : null;
  } catch {
    return null;
  }
}

function currentProcessIdentity() {
  return {
    bootIdSha256: linuxBootIdSha256(),
    processStartTicks: linuxProcessStartTicks(process.pid),
  };
}

function processIdentityStatus(owner) {
  if (process.platform !== "linux") {
    return { status: "UNSUPPORTED_PLATFORM", active: null, pidPresent: null };
  }
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) {
    return { status: "INVALID_PID", active: null, pidPresent: null };
  }
  const currentBoot = linuxBootIdSha256();
  const currentStart = linuxProcessStartTicks(owner.pid);
  if (currentStart === null) return { status: "PID_ABSENT", active: false, pidPresent: false };
  const exact = typeof owner.bootIdSha256 === "string"
    && typeof owner.processStartTicks === "string"
    && owner.bootIdSha256 === currentBoot
    && owner.processStartTicks === currentStart;
  return {
    status: exact ? "ACTIVE_EXACT_PROCESS_IDENTITY" : "PID_REUSED_OR_IDENTITY_MISMATCH",
    active: exact,
    pidPresent: true,
  };
}

function readExistingLock(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      return {
        readable: false,
        safeRegularFile: false,
        reason: stat.isSymbolicLink() ? "symlink_rejected" : "non_regular_file_rejected",
      };
    }
    if (stat.size > MAX_LOCK_BYTES) {
      return { readable: false, safeRegularFile: true, reason: "lock_metadata_too_large", bytes: stat.size };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      readable: true,
      safeRegularFile: true,
      authority: "NON_AUTHORITATIVE_PATH_DIAGNOSTIC_ONLY",
      owner: {
        schemaVersion: parsed.schemaVersion ?? null,
        pid: Number.isSafeInteger(parsed.pid) ? parsed.pid : null,
        ppid: Number.isSafeInteger(parsed.ppid) ? parsed.ppid : null,
        hostnameSha256: typeof parsed.hostname === "string"
          ? sha256(parsed.hostname)
          : null,
        mode: typeof parsed.mode === "string" ? parsed.mode : null,
        distDir: typeof parsed.distDir === "string" ? parsed.distDir : null,
        buildId: typeof parsed.buildId === "string" && SAFE_BUILD_ID.test(parsed.buildId) ? parsed.buildId : null,
        acquiredAt: typeof parsed.acquiredAt === "string" ? parsed.acquiredAt : null,
        sourceFingerprintSha256: typeof parsed.sourceFingerprintSha256 === "string" && SHA256_HEX.test(parsed.sourceFingerprintSha256) ? parsed.sourceFingerprintSha256 : null,
        bootIdSha256: typeof parsed.bootIdSha256 === "string" && SHA256_HEX.test(parsed.bootIdSha256) ? parsed.bootIdSha256 : null,
        processStartTicks: typeof parsed.processStartTicks === "string" && /^[0-9]+$/u.test(parsed.processStartTicks) ? parsed.processStartTicks : null,
      },
    };
  } catch (error) {
    return {
      readable: false,
      safeRegularFile: false,
      reason: "lock_metadata_unreadable",
      errorCode: safeErrorCode(error),
    };
  }
}

export function acquireSegmentedBuildLock({
  root,
  mode,
  distDir,
  buildId,
  acquiredAt = new Date().toISOString(),
  sourceFingerprintSha256 = null,
  externalLockRoot = process.env.VELMERE_BUILD_LOCK_ROOT,
}) {
  if (typeof buildId !== "string" || !SAFE_BUILD_ID.test(buildId)) {
    throw new Error("segmented_build_lock_invalid_build_id");
  }
  const coordinates = lockPathFor(root, mode, distDir, externalLockRoot);

  if (sourceFingerprintSha256 !== null && (typeof sourceFingerprintSha256 !== "string" || !SHA256_HEX.test(sourceFingerprintSha256))) {
    throw new Error("segmented_build_lock_invalid_source_fingerprint");
  }
  const token = randomBytes(32).toString("hex");
  const processIdentity = currentProcessIdentity();
  const metadata = {
    schemaVersion: sourceFingerprintSha256 ? "velmere.segmented-build-lock.v2" : "velmere.segmented-build-lock.v1",
    pid: process.pid,
    ppid: process.ppid,
    hostname: os.hostname(),
    mode,
    distDir,
    buildId,
    acquiredAt,
    token,
    ...(sourceFingerprintSha256 ? { sourceFingerprintSha256 } : {}),
    ...(processIdentity.bootIdSha256 ? { bootIdSha256: processIdentity.bootIdSha256 } : {}),
    ...(processIdentity.processStartTicks ? { processStartTicks: processIdentity.processStartTicks } : {}),
  };

  let descriptor;
  let createdStat;
  try {
    descriptor = fs.openSync(
      coordinates.filePath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR,
      0o600,
    );
    createdStat = fs.fstatSync(descriptor, { bigint: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      return {
        acquired: false,
        status: "BLOCKED_BUILD_LOCK",
        storage: "EXTERNAL_RUNTIME_STATE",
        namespaceSha256: coordinates.namespaceSha256,
        path: coordinates.reportedPath,
        reason: "existing_lock_requires_operator_review",
        observed: readExistingLock(coordinates.filePath),
      };
    }
    throw error;
  }

  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    const stat = fs.fstatSync(descriptor, { bigint: true });
    const pathStat = fs.lstatSync(coordinates.filePath, { bigint: true });
    if (!stat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile() || !samePhysicalFile(stat, pathStat)) {
      throw new Error("segmented_build_lock_path_descriptor_binding_failed");
    }
    const directorySync = syncDirectoryAfterMutation(coordinates.directory);
    const platformBoundary = lockPlatformBoundary();
    const receipt = {
      acquired: true,
      status: "ACQUIRED",
      storage: "EXTERNAL_RUNTIME_STATE",
      namespaceSha256: coordinates.namespaceSha256,
      path: coordinates.reportedPath,
      owner: {
        pid: metadata.pid,
        ppid: metadata.ppid,
        hostnameSha256: sha256(metadata.hostname),
        mode,
        distDir,
        buildId,
        acquiredAt,
        sourceFingerprintSha256,
        processIdentityBound: Boolean(processIdentity.bootIdSha256 && processIdentity.processStartTicks),
        processIdentityStatus: processIdentity.bootIdSha256 && processIdentity.processStartTicks
          ? "BOUND_LINUX_BOOT_AND_START_TICKS"
          : "UNAVAILABLE_NOT_CREDITED",
        lockFileDataFsyncApplied: true,
        directoryFsyncApplied: directorySync.applied,
        directoryEntryFsyncApplied: directorySync.applied,
        directoryFsyncStatus: directorySync.status,
        crashDurabilityCredit: directorySync.applied,
        crashDurabilityProven: directorySync.applied,
        orphanRecoverySupported: process.platform === "linux",
        ...platformBoundary,
      },
    };
    Object.defineProperties(receipt, {
      descriptor: { value: descriptor },
      token: { value: token },
      absolutePath: { value: coordinates.filePath },
      device: { value: stat.dev },
      inode: { value: stat.ino },
      directory: { value: coordinates.directory },
    });
    return receipt;
  } catch (error) {
    try {
      const heldStat = Number.isInteger(descriptor)
        ? fs.fstatSync(descriptor, { bigint: true })
        : createdStat;
      const pathStat = fs.lstatSync(coordinates.filePath, { bigint: true });
      if (heldStat?.isFile() && pathStat.isFile() && !pathStat.isSymbolicLink() && samePhysicalFile(heldStat, pathStat)) {
        fs.unlinkSync(coordinates.filePath);
      }
    } catch {
      // A missing or identity-mismatched path is retained fail-closed.
    }
    try {
      fs.closeSync(descriptor);
    } catch {
      // Preserve the original acquisition failure.
    }
    throw error;
  }
}

export function releaseSegmentedBuildLock(lock) {
  if (!lock?.acquired || !Number.isInteger(lock.descriptor) || typeof lock.absolutePath !== "string") {
    return { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "invalid_lock_handle" };
  }

  let result;
  try {
    const descriptorRead = boundedDescriptorBytes(lock.descriptor);
    const pathStat = fs.lstatSync(lock.absolutePath, { bigint: true });
    if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
      result = {
        released: false,
        status: "FAIL_BUILD_LOCK_RELEASE",
        reason: pathStat.isSymbolicLink() ? "lock_replaced_by_symlink" : "lock_replaced_by_non_file",
      };
    } else if (pathStat.dev !== lock.device || pathStat.ino !== lock.inode
      || descriptorRead.stat.dev !== lock.device || descriptorRead.stat.ino !== lock.inode) {
      result = { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "lock_inode_changed" };
    } else if (pathStat.size > BigInt(MAX_LOCK_BYTES)) {
      result = { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "lock_metadata_too_large" };
    } else {
      const metadata = JSON.parse(descriptorRead.bytes.toString("utf8"));
      if (metadata.token !== lock.token) {
        result = { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "lock_owner_token_changed" };
      } else {
        const beforeUnlink = fs.lstatSync(lock.absolutePath, { bigint: true });
        if (beforeUnlink.dev !== lock.device || beforeUnlink.ino !== lock.inode || beforeUnlink.isSymbolicLink()) {
          result = { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "lock_changed_before_release" };
        } else {
          fs.unlinkSync(lock.absolutePath);
          try {
            fs.lstatSync(lock.absolutePath);
            result = { released: false, status: "FAIL_BUILD_LOCK_RELEASE", reason: "lock_present_after_unlink" };
          } catch (error) {
            if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
            const directorySync = syncDirectoryAfterMutation(lock.directory);
            result = {
              released: true,
              status: "RELEASED",
              storage: "EXTERNAL_RUNTIME_STATE",
              namespaceSha256: lock.namespaceSha256,
              path: lock.path,
              absentAtRelease: true,
              releaseVisibilityVerified: true,
              directoryFsyncApplied: directorySync.applied,
              directoryEntryFsyncApplied: directorySync.applied,
              directoryFsyncStatus: directorySync.status,
              crashDurabilityCredit: directorySync.applied,
              crashDurabilityProven: directorySync.applied,
              orphanRecoverySupported: process.platform === "linux",
              ...lockPlatformBoundary(),
            };
          }
        }
      }
    }
  } catch (error) {
    result = {
      released: false,
      status: "FAIL_BUILD_LOCK_RELEASE",
      reason: "lock_release_error",
      errorCode: safeErrorCode(error),
    };
  } finally {
    try {
      fs.closeSync(lock.descriptor);
    } catch (error) {
      if (result?.released) {
        result = {
          released: false,
          status: "FAIL_BUILD_LOCK_RELEASE",
          reason: "lock_descriptor_close_error",
          errorCode: safeErrorCode(error),
        };
      }
    }
  }
  return result;
}


export function inspectSegmentedBuildLockForRecovery({
  root,
  mode,
  distDir,
  expectedSourceFingerprintSha256,
  externalLockRoot = process.env.VELMERE_BUILD_LOCK_ROOT,
  nowMs = Date.now(),
  minimumAgeMs = MINIMUM_ORPHAN_LOCK_AGE_MS,
}) {
  if (typeof expectedSourceFingerprintSha256 !== "string" || !SHA256_HEX.test(expectedSourceFingerprintSha256)) {
    throw new Error("segmented_build_orphan_recovery_expected_source_fingerprint_invalid");
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error("segmented_build_orphan_recovery_now_invalid");
  if (!Number.isSafeInteger(minimumAgeMs) || minimumAgeMs < MINIMUM_ORPHAN_LOCK_AGE_MS) {
    throw new Error("segmented_build_orphan_recovery_minimum_age_too_low");
  }
  const coordinates = lockPathFor(root, mode, distDir, externalLockRoot, { create: false });
  const publicBase = {
    schemaVersion: "velmere.segmented-build-orphan-lock-inspection.v1",
    storage: "EXTERNAL_RUNTIME_STATE",
    namespaceSha256: coordinates.namespaceSha256,
    path: coordinates.reportedPath,
    rawExternalPathDisclosed: false,
    mode,
    distDir,
    expectedSourceFingerprintSha256,
    minimumAgeMs,
  };
  let descriptor;
  try {
    const pathStat = fs.lstatSync(coordinates.filePath);
    if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
      return { ...publicBase, status: pathStat.isSymbolicLink() ? "REJECTED_SYMLINK" : "REJECTED_NON_REGULAR", recoverable: false };
    }
    if (typeof process.getuid === "function" && pathStat.uid !== process.getuid()) {
      return { ...publicBase, status: "REJECTED_OWNER_MISMATCH", recoverable: false };
    }
    if (process.platform !== "win32" && (pathStat.mode & 0o077) !== 0) {
      return { ...publicBase, status: "REJECTED_INSECURE_MODE", recoverable: false };
    }
    if (pathStat.size > MAX_LOCK_BYTES) {
      return { ...publicBase, status: "REJECTED_OVERSIZED_METADATA", recoverable: false, byteLength: pathStat.size };
    }
    descriptor = fs.openSync(coordinates.filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile() || openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      return { ...publicBase, status: "REJECTED_CHANGED_DURING_OPEN", recoverable: false };
    }
    const bytes = fs.readFileSync(descriptor);
    const afterRead = fs.fstatSync(descriptor);
    if (afterRead.dev !== openedStat.dev || afterRead.ino !== openedStat.ino || afterRead.size !== openedStat.size) {
      return { ...publicBase, status: "REJECTED_CHANGED_DURING_READ", recoverable: false };
    }
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch {
      return { ...publicBase, status: "REJECTED_INVALID_JSON", recoverable: false, lockSha256: sha256(bytes) };
    }
    const owner = {
      schemaVersion: parsed.schemaVersion ?? null,
      pid: Number.isSafeInteger(parsed.pid) ? parsed.pid : null,
      ppid: Number.isSafeInteger(parsed.ppid) ? parsed.ppid : null,
      hostnameSha256: typeof parsed.hostname === "string" ? sha256(parsed.hostname) : null,
      mode: typeof parsed.mode === "string" ? parsed.mode : null,
      distDir: typeof parsed.distDir === "string" ? parsed.distDir : null,
      buildId: typeof parsed.buildId === "string" && SAFE_BUILD_ID.test(parsed.buildId) ? parsed.buildId : null,
      acquiredAt: typeof parsed.acquiredAt === "string" ? parsed.acquiredAt : null,
      sourceFingerprintSha256: typeof parsed.sourceFingerprintSha256 === "string" && SHA256_HEX.test(parsed.sourceFingerprintSha256) ? parsed.sourceFingerprintSha256 : null,
      bootIdSha256: typeof parsed.bootIdSha256 === "string" && SHA256_HEX.test(parsed.bootIdSha256) ? parsed.bootIdSha256 : null,
      processStartTicks: typeof parsed.processStartTicks === "string" && /^[0-9]+$/u.test(parsed.processStartTicks) ? parsed.processStartTicks : null,
    };
    const acquiredMs = Date.parse(owner.acquiredAt ?? "");
    const ageMs = Number.isFinite(acquiredMs) ? nowMs - acquiredMs : null;
    const processIdentity = processIdentityStatus(owner);
    const outputPath = safeBuildOutputPath(coordinates.root, distDir);
    let outputState;
    try {
      const outputStat = fs.lstatSync(outputPath);
      outputState = {
        status: outputStat.isSymbolicLink() ? "SYMLINK_PRESENT" : outputStat.isDirectory() ? "DIRECTORY_PRESENT" : "NON_DIRECTORY_PRESENT",
        absent: false,
      };
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") outputState = { status: "ABSENT", absent: true };
      else outputState = { status: "INSPECTION_ERROR", absent: false, errorCode: safeErrorCode(error) };
    }
    const structuralValid = owner.schemaVersion === "velmere.segmented-build-lock.v2"
      && owner.mode === mode
      && owner.distDir === distDir
      && owner.buildId !== null
      && owner.sourceFingerprintSha256 === expectedSourceFingerprintSha256
      && owner.bootIdSha256 !== null
      && owner.processStartTicks !== null
      && ageMs !== null
      && ageMs >= 0;
    const oldEnough = ageMs !== null && ageMs >= minimumAgeMs;
    const recoverable = structuralValid
      && oldEnough
      && processIdentity.active === false
      && outputState.absent === true;
    const core = {
      ...publicBase,
      status: recoverable
        ? "STALE_LOCK_ELIGIBLE_FOR_DUAL_REVIEW_QUARANTINE"
        : processIdentity.status === "UNSUPPORTED_PLATFORM"
          ? "BLOCKED_PLATFORM_PROCESS_IDENTITY_UNAVAILABLE"
        : processIdentity.active === true
          ? "BLOCKED_ACTIVE_PROCESS"
          : !structuralValid
            ? "BLOCKED_STRUCTURAL_OR_SOURCE_BINDING"
            : !oldEnough
              ? "BLOCKED_MINIMUM_AGE"
              : !outputState.absent
                ? "BLOCKED_OUTPUT_REQUIRES_OPERATOR_QUARANTINE"
                : "BLOCKED_NOT_RECOVERABLE",
      recoverable,
      lockSha256: sha256(bytes),
      lockByteLength: bytes.length,
      owner,
      processIdentity,
      ageMs,
      oldEnough,
      outputState,
      inodeBinding: { device: openedStat.dev, inode: openedStat.ino, size: openedStat.size },
      truthBoundary: "Read-only orphan-lock inspection. It never deletes, steals or rewrites a lock. Recovery requires a fresh identical inspection, output absence, exact source binding and two distinct operator reviews.",
    };
    const inspectionDigestSha256 = sha256(JSON.stringify(core));
    const result = { ...core, inspectionDigestSha256 };
    Object.defineProperties(result, {
      absolutePath: { value: coordinates.filePath },
      absoluteDirectory: { value: coordinates.directory },
      absoluteOutputPath: { value: outputPath },
    });
    return result;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { ...publicBase, status: "LOCK_ABSENT", recoverable: false };
    }
    return { ...publicBase, status: "INSPECTION_ERROR", recoverable: false, errorCode: safeErrorCode(error) };
  } finally {
    if (Number.isInteger(descriptor)) fs.closeSync(descriptor);
  }
}

function validReview(review, inspectionDigestSha256) {
  return review
    && typeof review === "object"
    && new Set(["BUILD_OPERATOR", "RELEASE_REVIEWER"]).has(review.role)
    && typeof review.reviewerIdHash === "string"
    && SHA256_HEX.test(review.reviewerIdHash)
    && review.inspectionDigestSha256 === inspectionDigestSha256
    && review.decision === "APPROVE_ORPHAN_LOCK_QUARANTINE"
    && review.conflictOfInterest === false
    && Number.isFinite(Date.parse(review.reviewedAt ?? ""));
}

export function recoverSegmentedBuildLockFromInspection({
  inspection,
  reviews,
  confirmationToken,
}) {
  if (confirmationToken !== ORPHAN_RECOVERY_CONFIRMATION) {
    return { status: "REJECTED_CONFIRMATION_TOKEN", recovered: false };
  }
  if (process.platform !== "linux") {
    return {
      status: "REJECTED_PLATFORM_PROCESS_IDENTITY_UNAVAILABLE",
      recovered: false,
      automaticLockStealing: false,
    };
  }
  if (!inspection?.recoverable || typeof inspection.absolutePath !== "string" || typeof inspection.absoluteDirectory !== "string") {
    return { status: "REJECTED_INSPECTION_NOT_RECOVERABLE", recovered: false };
  }
  if (!Array.isArray(reviews) || reviews.length !== 2 || !reviews.every((review) => validReview(review, inspection.inspectionDigestSha256))) {
    return { status: "REJECTED_DUAL_REVIEW", recovered: false };
  }
  const roles = new Set(reviews.map((review) => review.role));
  const reviewers = new Set(reviews.map((review) => review.reviewerIdHash));
  if (roles.size !== 2 || reviewers.size !== 2) {
    return { status: "REJECTED_REVIEW_INDEPENDENCE", recovered: false };
  }
  try {
    const lockStat = fs.lstatSync(inspection.absolutePath);
    if (lockStat.isSymbolicLink() || !lockStat.isFile()
      || lockStat.dev !== inspection.inodeBinding.device
      || lockStat.ino !== inspection.inodeBinding.inode
      || lockStat.size !== inspection.inodeBinding.size) {
      return { status: "REJECTED_LOCK_CHANGED_AFTER_REVIEW", recovered: false };
    }
    const lockBytes = fs.readFileSync(inspection.absolutePath);
    if (sha256(lockBytes) !== inspection.lockSha256) {
      return { status: "REJECTED_LOCK_BYTES_CHANGED_AFTER_REVIEW", recovered: false };
    }
    if (processIdentityStatus(inspection.owner).active !== false) {
      return { status: "REJECTED_PROCESS_BECAME_ACTIVE", recovered: false };
    }
    try {
      fs.lstatSync(inspection.absoluteOutputPath);
      return { status: "REJECTED_OUTPUT_PRESENT_AFTER_REVIEW", recovered: false };
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    }
    const quarantineDirectory = path.join(inspection.absoluteDirectory, "quarantine");
    rejectSymlinkComponents(quarantineDirectory, "segmented_build_lock_quarantine");
    fs.mkdirSync(quarantineDirectory, { recursive: true, mode: 0o700 });
    assertPrivateOwnedDirectory(quarantineDirectory, "segmented_build_lock_quarantine");
    const quarantineName = `${inspection.inspectionDigestSha256}.lock`;
    const quarantinePath = path.join(quarantineDirectory, quarantineName);
    fs.renameSync(inspection.absolutePath, quarantinePath);
    const quarantineStat = fs.lstatSync(quarantinePath);
    if (!quarantineStat.isFile() || quarantineStat.isSymbolicLink()) {
      return { status: "FAIL_QUARANTINE_POSTCONDITION", recovered: false };
    }
    const directorySync = syncDirectoryAfterMutation(inspection.absoluteDirectory);
    return {
      schemaVersion: "velmere.segmented-build-orphan-lock-recovery.v1",
      status: "QUARANTINED_AFTER_DUAL_REVIEW",
      recovered: true,
      storage: "EXTERNAL_RUNTIME_STATE",
      namespaceSha256: inspection.namespaceSha256,
      originalPath: inspection.path,
      quarantinePath: `external-build-locks/${inspection.namespaceSha256}/quarantine/${quarantineName}`,
      inspectionDigestSha256: inspection.inspectionDigestSha256,
      lockSha256: inspection.lockSha256,
      reviewDigests: reviews.map((review) => sha256(JSON.stringify(review))).sort(),
      rawExternalPathDisclosed: false,
      automaticLockStealing: false,
      lockDeleted: false,
      directoryFsyncApplied: directorySync.applied,
      directoryFsyncStatus: directorySync.status,
      crashDurabilityCredit: directorySync.applied,
      truthBoundary: "The stale lock was atomically quarantined after exact source/output/process checks and two distinct operator reviews. This is not build, browser, release, staging, LIVE or sale evidence.",
    };
  } catch (error) {
    return { status: "RECOVERY_ERROR", recovered: false, errorCode: safeErrorCode(error) };
  }
}

export const SEGMENTED_BUILD_ORPHAN_RECOVERY_CONFIRMATION = ORPHAN_RECOVERY_CONFIRMATION;

function absenceRecord(filePath, reportedPath) {
  try {
    const stat = fs.lstatSync(filePath);
    return {
      path: reportedPath,
      absent: false,
      symlink: stat.isSymbolicLink(),
      regularFile: stat.isFile(),
    };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { path: reportedPath, absent: true, symlink: false, regularFile: false };
    }
    return {
      path: reportedPath,
      absent: false,
      symlink: false,
      regularFile: false,
      errorCode: safeErrorCode(error),
    };
  }
}

export function inspectSegmentedBuildLockBoundary({
  root,
  externalLockRoot = process.env.VELMERE_BUILD_LOCK_ROOT,
}) {
  const canonicalRoot = fs.realpathSync(root);
  const external = [];
  const legacySource = [];
  let namespaceSha256 = null;
  for (const mode of BUILD_MODES) {
    const distDir = `.next-pass25-${mode}`;
    const coordinates = lockPathFor(canonicalRoot, mode, distDir, externalLockRoot, { create: false });
    namespaceSha256 ??= coordinates.namespaceSha256;
    external.push(absenceRecord(coordinates.filePath, coordinates.reportedPath));
    const legacyFileName = `segmented-${mode}-${distDir.replaceAll(".", "_")}.lock`;
    legacySource.push(absenceRecord(
      path.join(canonicalRoot, ".velmere", "deployment-builds", "locks", legacyFileName),
      `.velmere/deployment-builds/locks/${legacyFileName}`,
    ));
  }
  const ok = external.every((row) => row.absent) && legacySource.every((row) => row.absent);
  return {
    schemaVersion: "velmere.segmented-build-lock-boundary.v1",
    ok,
    status: ok ? "ABSENT" : "LOCK_PRESENT",
    storage: "EXTERNAL_RUNTIME_STATE",
    namespaceSha256,
    rawExternalPathDisclosed: false,
    external,
    legacySource,
  };
}

export function inspectExactBuildId({ filePath, expectedBuildId, label, reportedPath = filePath }) {
  if (typeof expectedBuildId !== "string" || !SAFE_BUILD_ID.test(expectedBuildId)) {
    throw new Error("segmented_build_id_invalid_expected_value");
  }
  const base = {
    label,
    path: reportedPath,
    expected: expectedBuildId,
    expectedSha256: sha256(Buffer.from(expectedBuildId, "utf8")),
  };
  let descriptor;
  try {
    const pathStat = fs.lstatSync(filePath);
    if (pathStat.isSymbolicLink()) {
      return { ...base, ok: false, status: "SYMLINK_REJECTED", present: true, regularFile: false };
    }
    if (!pathStat.isFile()) {
      return { ...base, ok: false, status: "NON_REGULAR_FILE", present: true, regularFile: false };
    }
    if (pathStat.size > MAX_BUILD_ID_BYTES) {
      return {
        ...base,
        ok: false,
        status: "TOO_LARGE",
        present: true,
        regularFile: true,
        byteLength: pathStat.size,
      };
    }
    const noFollow = fs.constants.O_NOFOLLOW ?? 0;
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile() || openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      return { ...base, ok: false, status: "FILE_CHANGED_DURING_INSPECTION", present: true, regularFile: false };
    }
    const bytes = fs.readFileSync(descriptor);
    const expectedBytes = Buffer.from(expectedBuildId, "utf8");
    const decoded = bytes.toString("utf8");
    const canonicalUtf8 = Buffer.from(decoded, "utf8").equals(bytes);
    const safeObservedToken = canonicalUtf8 && SAFE_BUILD_ID.test(decoded) ? decoded : null;
    const exact = bytes.equals(expectedBytes);
    return {
      ...base,
      ok: exact,
      status: exact ? "EXACT" : bytes.length === 0 ? "EMPTY" : "MISMATCH",
      present: true,
      regularFile: true,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      canonicalUtf8,
      observedSafeToken: safeObservedToken,
    };
  } catch (error) {
    const missing = error && typeof error === "object" && error.code === "ENOENT";
    return {
      ...base,
      ok: false,
      status: missing ? "MISSING" : "READ_ERROR",
      present: false,
      regularFile: false,
      error: missing ? null : error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (Number.isInteger(descriptor)) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The inspection result remains fail-closed if closing a read descriptor fails.
      }
    }
  }
}

export function inspectBuildIdPair({
  rootBuildIdPath,
  standaloneBuildIdPath,
  expectedBuildId,
  rootReportedPath = rootBuildIdPath,
  standaloneReportedPath = standaloneBuildIdPath,
}) {
  const root = inspectExactBuildId({
    filePath: rootBuildIdPath,
    expectedBuildId,
    label: "buildId",
    reportedPath: rootReportedPath,
  });
  const standalone = inspectExactBuildId({
    filePath: standaloneBuildIdPath,
    expectedBuildId,
    label: "standaloneBuildId",
    reportedPath: standaloneReportedPath,
  });
  const rootStandaloneEqual = root.ok
    && standalone.ok
    && root.byteLength === standalone.byteLength
    && root.sha256 === standalone.sha256;
  return {
    ok: root.ok && standalone.ok && rootStandaloneEqual,
    rootStandaloneEqual,
    root,
    standalone,
  };
}

export function classifySegmentedBuildStatus({
  lockAcquired = true,
  lockReleased = true,
  sourceImmutable = true,
  compileStatus = null,
  generateStatus = null,
  buildIdBoundaryFailed = false,
  outputContractOk = false,
  managedNextEnvOk = true,
  fatal = null,
}) {
  if (!lockAcquired) return "BLOCKED_BUILD_LOCK";
  if (!lockReleased) return "FAIL_BUILD_LOCK_RELEASE";
  if (!sourceImmutable) return "FAIL_SOURCE_MUTATION";
  if (compileStatus && compileStatus !== "PASS") return compileStatus;
  if (compileStatus !== "PASS") return fatal ? "FAIL_CONTRACT" : "FAIL";
  if (buildIdBoundaryFailed) return "FAIL_OUTPUT_CONTRACT";
  if (generateStatus && generateStatus !== "PASS") return generateStatus;
  if (generateStatus !== "PASS") return fatal ? "FAIL_CONTRACT" : "FAIL";
  if (!outputContractOk) return "FAIL_OUTPUT_CONTRACT";
  if (!managedNextEnvOk || fatal) return "FAIL_CONTRACT";
  return "PASS";
}
