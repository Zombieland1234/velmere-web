import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";

export const DURABLE_FILE_BOUNDARY_ID = "velmere.pass36.a68.durable-file-boundary.v1";

export type DurableFileBoundaryOptions = {
  rootDirectory: string;
  fileName: string;
  maximumBytes: number;
  label: string;
  fileMode?: number;
  productionLike?: boolean;
};

export type DurableFileWriteReceipt = {
  schemaVersion: "velmere.pass36.a68.durable-file-write.v1";
  boundaryId: typeof DURABLE_FILE_BOUNDARY_ID;
  filePath: string;
  byteLength: number;
  sha256: string;
  readBackVerified: boolean;
  isolatedRootVerified: boolean;
  symlinkFree: boolean;
  hardlinkFree: true;
  descriptorIdentityBound: true;
  atomicRename: true;
};

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/u;
const MINIMUM_MAXIMUM_BYTES = 1;
const MAXIMUM_MAXIMUM_BYTES = 64 * 1024 * 1024;

function productionLikeDefault() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function normalizeForComparison(value: string) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function assertSafeLabel(value: string) {
  if (!/^[a-z0-9][a-z0-9:_-]{0,95}$/u.test(value)) throw new Error("durable_file_label_invalid");
  return value;
}

function assertSafeFileName(value: string) {
  if (!SAFE_FILE_NAME.test(value) || value === "." || value === ".." || path.basename(value) !== value) {
    throw new Error("durable_file_name_invalid");
  }
  return value;
}

function assertByteBudget(value: number) {
  if (!Number.isInteger(value) || value < MINIMUM_MAXIMUM_BYTES || value > MAXIMUM_MAXIMUM_BYTES) {
    throw new Error("durable_file_maximum_bytes_invalid");
  }
  return value;
}

async function lstatOrNull(target: string) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") return null;
    throw error;
  }
}

type FileIdentity = {
  dev: string;
  ino: string;
  mode: string;
};

function fileIdentity(stat: Awaited<ReturnType<typeof fs.lstat>>): FileIdentity {
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    mode: String(stat.mode),
  };
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function containsAsciiControl(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

function assertSingleLink(
  stat: { nlink: number },
  missingLinkError = "durable_file_hardlink_forbidden",
) {
  if (stat.nlink > 1) throw new Error("durable_file_hardlink_forbidden");
  if (stat.nlink !== 1) throw new Error(missingLinkError);
}

async function assertPathComponentsSymlinkFree(absolutePath: string) {
  const parsed = path.parse(absolutePath);
  const remainder = absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let cursor = parsed.root;
  for (const segment of remainder) {
    cursor = path.join(cursor, segment);
    const stat = await lstatOrNull(cursor);
    if (!stat) break;
    if (stat.isSymbolicLink()) throw new Error("durable_file_path_symlink_forbidden");
  }
}

async function resolveAndVerifyRoot(options: DurableFileBoundaryOptions) {
  assertSafeLabel(options.label);
  const raw = String(options.rootDirectory ?? "").trim();
  if (!raw || containsAsciiControl(raw)) throw new Error("durable_file_root_invalid");
  const productionLike = options.productionLike ?? productionLikeDefault();
  if (productionLike && !path.isAbsolute(raw)) throw new Error("durable_file_root_absolute_required");
  const resolved = path.resolve(raw);
  if (normalizeForComparison(resolved) === normalizeForComparison(path.parse(resolved).root)) {
    throw new Error("durable_file_root_filesystem_root_forbidden");
  }
  await assertPathComponentsSymlinkFree(resolved);
  await fs.mkdir(resolved, { recursive: true, mode: 0o700 });
  await assertPathComponentsSymlinkFree(resolved);
  const rootLstat = await fs.lstat(resolved);
  if (rootLstat.isSymbolicLink() || !rootLstat.isDirectory()) throw new Error("durable_file_root_not_directory");
  const real = await fs.realpath(resolved);
  if (normalizeForComparison(real) !== normalizeForComparison(resolved)) throw new Error("durable_file_root_realpath_mismatch");
  if (productionLike && process.platform !== "win32" && (rootLstat.mode & 0o022) !== 0) {
    throw new Error("durable_file_root_writable_by_group_or_world");
  }
  return { root: resolved, productionLike };
}

function targetFor(root: string, fileName: string) {
  const safeName = assertSafeFileName(fileName);
  const target = path.join(root, safeName);
  if (normalizeForComparison(path.dirname(target)) !== normalizeForComparison(root)) {
    throw new Error("durable_file_target_outside_root");
  }
  return target;
}

async function openReadNoFollow(target: string) {
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  try {
    return await fs.open(target, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (noFollow && ["EINVAL", "ENOTSUP", "EOPNOTSUPP", "UNKNOWN"].includes(code)) {
      const metadata = await fs.lstat(target);
      if (metadata.isSymbolicLink()) {
        throw new Error("durable_file_target_symlink_forbidden", { cause: error });
      }
      return fs.open(target, fsConstants.O_RDONLY);
    }
    throw error;
  }
}

async function syncDirectoryBestEffort(directory: string) {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(directory, fsConstants.O_RDONLY);
    await handle.sync();
  } catch {
    // Some platforms do not allow directory fsync. Atomic rename remains mandatory.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readDurableFileBounded(options: DurableFileBoundaryOptions): Promise<Buffer> {
  const maximumBytes = assertByteBudget(options.maximumBytes);
  const { root } = await resolveAndVerifyRoot(options);
  const target = targetFor(root, options.fileName);
  const metadata = await fs.lstat(target);
  if (metadata.isSymbolicLink()) throw new Error("durable_file_target_symlink_forbidden");
  if (!metadata.isFile()) throw new Error("durable_file_target_not_regular");
  assertSingleLink(metadata);
  if (metadata.size > maximumBytes) throw new Error("durable_file_too_large");
  const pathIdentity = fileIdentity(metadata);
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await openReadNoFollow(target);
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("durable_file_target_not_regular");
    assertSingleLink(before);
    if (!sameFileIdentity(pathIdentity, fileIdentity(before))) {
      throw new Error("durable_file_descriptor_identity_mismatch");
    }
    if (before.size > maximumBytes) throw new Error("durable_file_too_large");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    assertSingleLink(after, "durable_file_path_changed_during_read");
    if (
      !sameFileIdentity(fileIdentity(before), fileIdentity(after))
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs
      || bytes.length !== before.size
    ) {
      throw new Error("durable_file_changed_during_read");
    }
    const pathAfter = await lstatOrNull(target);
    if (
      !pathAfter
      || pathAfter.isSymbolicLink()
      || !pathAfter.isFile()
      || pathAfter.nlink !== 1
      || !sameFileIdentity(fileIdentity(after), fileIdentity(pathAfter))
    ) {
      throw new Error("durable_file_path_changed_during_read");
    }
    return bytes;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function writeDurableFileAtomic(
  options: DurableFileBoundaryOptions,
  value: string | Uint8Array,
): Promise<DurableFileWriteReceipt> {
  const maximumBytes = assertByteBudget(options.maximumBytes);
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  if (bytes.length > maximumBytes) throw new Error("durable_file_too_large");
  const { root } = await resolveAndVerifyRoot(options);
  const target = targetFor(root, options.fileName);
  const existing = await lstatOrNull(target);
  if (existing?.isSymbolicLink()) throw new Error("durable_file_target_symlink_forbidden");
  if (existing && !existing.isFile()) throw new Error("durable_file_target_not_regular");
  if (existing) assertSingleLink(existing);
  const temporaryName = `tmp-${createHash("sha256").update(options.fileName).digest("hex").slice(0, 16)}-${process.pid}-${randomUUID()}.tmp`;
  const temporary = targetFor(root, temporaryName);
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  const flags = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | noFollow;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let temporaryIdentity: FileIdentity | undefined;
  try {
    handle = await fs.open(temporary, flags, options.fileMode ?? 0o600);
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error("durable_file_target_not_regular");
    assertSingleLink(opened);
    temporaryIdentity = fileIdentity(opened);
    await handle.writeFile(bytes);
    await handle.sync();
    const written = await handle.stat();
    assertSingleLink(written);
    if (!sameFileIdentity(temporaryIdentity, fileIdentity(written))) {
      throw new Error("durable_file_descriptor_identity_mismatch");
    }
    temporaryIdentity = fileIdentity(written);
    await handle.close();
    handle = undefined;
    await resolveAndVerifyRoot(options);
    const beforeRename = await lstatOrNull(target);
    if (beforeRename?.isSymbolicLink()) throw new Error("durable_file_target_symlink_forbidden");
    if (beforeRename && !beforeRename.isFile()) throw new Error("durable_file_target_not_regular");
    if (beforeRename) assertSingleLink(beforeRename);
    const temporaryBeforeRename = await fs.lstat(temporary);
    if (
      temporaryBeforeRename.isSymbolicLink()
      || !temporaryBeforeRename.isFile()
      || temporaryBeforeRename.nlink !== 1
      || !temporaryIdentity
      || !sameFileIdentity(temporaryIdentity, fileIdentity(temporaryBeforeRename))
    ) {
      throw new Error("durable_file_temporary_identity_mismatch");
    }
    await fs.rename(temporary, target);
    await syncDirectoryBestEffort(root);
    const readBack = await readDurableFileBounded(options);
    const expectedHash = sha256(bytes);
    if (readBack.length !== bytes.length || sha256(readBack) !== expectedHash) {
      throw new Error("durable_file_readback_mismatch");
    }
    return {
      schemaVersion: "velmere.pass36.a68.durable-file-write.v1",
      boundaryId: DURABLE_FILE_BOUNDARY_ID,
      filePath: target,
      byteLength: bytes.length,
      sha256: expectedHash,
      readBackVerified: true,
      isolatedRootVerified: true,
      symlinkFree: true,
      hardlinkFree: true,
      descriptorIdentityBound: true,
      atomicRename: true,
    };
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}

export async function readDurableJsonBounded<T>(options: DurableFileBoundaryOptions): Promise<T> {
  const bytes = await readDurableFileBounded(options);
  try {
    return JSON.parse(bytes.toString("utf8")) as T;
  } catch {
    throw new Error("durable_file_json_invalid");
  }
}

export async function writeDurableJsonAtomic(
  options: DurableFileBoundaryOptions,
  value: unknown,
  pretty = false,
): Promise<DurableFileWriteReceipt> {
  const payload = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
  return writeDurableFileAtomic(options, payload);
}
