import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT_NAME = "velmere-release-transaction-locks-v1";
const SAFE_SHA = /^[a-f0-9]{64}$/u;
const MAX_BYTES = 64 * 1024;

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function assertPrivateDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
  if (!stat.isDirectory()) throw new Error(`${label}_not_directory`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`${label}_owner_mismatch`);
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) throw new Error(`${label}_insecure_permissions`);
}
function rejectSymlinkComponents(absolutePath, label) {
  const parsed = path.parse(absolutePath);
  let cursor = parsed.root;
  for (const component of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
  }
}
function coordinates(root, externalRoot) {
  if (process.platform !== "linux" && process.platform !== "win32") throw new Error("release_transaction_platform_unsupported");
  const sourceRoot = fs.realpathSync(root);
  const requested = path.resolve(externalRoot ?? path.join(fs.realpathSync(os.tmpdir()), ROOT_NAME));
  if (!path.isAbsolute(requested)) throw new Error("release_transaction_root_absolute_required");
  rejectSymlinkComponents(requested, "release_transaction_root");
  fs.mkdirSync(requested, { recursive: true, mode: 0o700 });
  fs.chmodSync(requested, 0o700);
  assertPrivateDirectory(requested, "release_transaction_root");
  const relativeA = path.relative(sourceRoot, requested);
  const relativeB = path.relative(requested, sourceRoot);
  if ((!relativeA.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeA)) || (!relativeB.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeB))) {
    throw new Error("release_transaction_root_not_disjoint_from_source");
  }
  const namespace = path.join(requested, sha256(`velmere.release.transaction.v1\0${sourceRoot}`));
  fs.mkdirSync(namespace, { recursive: true, mode: 0o700 });
  fs.chmodSync(namespace, 0o700);
  assertPrivateDirectory(namespace, "release_transaction_namespace");
  return { sourceRoot, externalRoot: requested, namespace, filePath: path.join(namespace, "release.lock") };
}
export function acquireReleaseTransactionLock({ root, sourceSha256, externalRoot, purpose = "frozen-release" }) {
  if (!SAFE_SHA.test(String(sourceSha256 ?? ""))) throw new Error("release_transaction_source_sha256_invalid");
  const c = coordinates(root, externalRoot);
  const token = crypto.randomBytes(32).toString("hex");
  const metadata = { schemaVersion: "velmere.release-transaction-lock.v1", pid: process.pid, ppid: process.ppid, sourceRootSha256: sha256(c.sourceRoot), sourceSha256, purpose, token, acquiredAt: new Date().toISOString() };
  let fd;
  try { fd = fs.openSync(c.filePath, "wx", 0o600); }
  catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") return { acquired: false, status: "BLOCKED_EXISTING_LOCK", ...c };
    throw error;
  }
  const bytes = Buffer.from(`${JSON.stringify(metadata)}\n`, "utf8");
  fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
  const stat = fs.fstatSync(fd);
  return { acquired: true, status: "ACQUIRED", token, fd, dev: stat.dev, ino: stat.ino, metadata, ...c };
}
export function inspectReleaseTransactionLock(lock) {
  if (!lock?.acquired) return { ok: false, status: "NOT_ACQUIRED" };
  let stat;
  try { stat = fs.lstatSync(lock.filePath); } catch { return { ok: false, status: "MISSING" }; }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) return { ok: false, status: "UNSAFE_LOCK_FILE" };
  if (stat.dev !== lock.dev || stat.ino !== lock.ino) return { ok: false, status: "PHYSICAL_FILE_CHANGED" };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(lock.filePath, "utf8")); } catch { return { ok: false, status: "INVALID_JSON" }; }
  const ok = parsed.token === lock.token && parsed.sourceSha256 === lock.metadata.sourceSha256 && parsed.pid === process.pid;
  return { ok, status: ok ? "ACTIVE_EXACT_OWNER" : "OWNER_OR_TOKEN_MISMATCH", metadata: ok ? { ...parsed, token: "<redacted>" } : null };
}
export function releaseReleaseTransactionLock(lock) {
  const inspected = inspectReleaseTransactionLock(lock);
  if (!inspected.ok) throw new Error(`release_transaction_release_denied:${inspected.status}`);
  fs.closeSync(lock.fd);
  fs.unlinkSync(lock.filePath);
  return { released: !fs.existsSync(lock.filePath), status: "RELEASED" };
}
