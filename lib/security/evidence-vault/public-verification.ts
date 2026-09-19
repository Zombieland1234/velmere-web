import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { computeMerkleRoot } from "./merkle-tree";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/;
const HASH = /^[a-f0-9]{64}$/;
const MANIFEST_LIMIT = 512 * 1024;
const ARTIFACT_LIMIT = 8 * 1024 * 1024;
const TOTAL_LIMIT = 64 * 1024 * 1024;
const MAX_ARTIFACTS = 256;
const SCOPE = "LOCAL_ARTIFACT_BYTES_AND_MANIFEST_NOT_AUDIT_VALIDITY" as const;

type ObjectValue = Record<string, unknown>;
type Artifact = { category: string; filename: string; sha256: string; sizeBytes: number };
export type PublicAuditVerification = {
  ok: true; verified: true; status: "INTEGRITY_MATCH"; auditId: string;
  verificationScope: typeof SCOPE; authenticity: "NOT_VERIFIED";
  engineVersion: string; createdAt: string; evidenceRoot: string; recomputedMerkleRoot: string;
  merkleIntegrityMatch: true; artifactBytesMatch: true; reportDigestMatch: true;
  artifactsCount: number; leafHashesCount: number; reportSha256: string;
  target: { symbol?: string; name?: string; chain?: string; blockNumber?: number;
    contractAddress?: string; sourceHash?: string; commitHash?: string };
  sealType: "LOCAL CONTENT DIGEST COMPARISON";
  timestampNotice: string; timestampVerified: false; releaseApproved: false;
};
export type PublicAuditFailure = {
  ok: false; verified: false; status: "NOT_VERIFIED"; httpStatus: 400 | 404 | 409 | 422 | 503;
  error: "invalid_audit_id" | "not_found" | "manifest_invalid" | "integrity_mismatch" | "verification_unavailable";
  verificationScope: typeof SCOPE; releaseApproved: false;
};
const failure = (httpStatus: PublicAuditFailure["httpStatus"], error: PublicAuditFailure["error"]): PublicAuditFailure =>
  ({ ok: false, verified: false, status: "NOT_VERIFIED", httpStatus, error, verificationScope: SCOPE, releaseApproved: false });
const object = (value: unknown): ObjectValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !Array.from(value).some(c => c.charCodeAt(0) < 32);

/** No request-controlled root, double decoding, symlink traversal or raw private manifest output. */
async function checkedPath(root: string, segments: string[]) {
  const rootPath = path.resolve(root);
  let current = rootPath;
  for (const segment of ["", ...segments]) {
    if (segment) current = path.join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error("UNSAFE_FILE");
  }
  const resolved = await realpath(current);
  const realRoot = await realpath(rootPath);
  if (!resolved.startsWith(realRoot + path.sep)) throw new Error("UNSAFE_FILE");
  return resolved;
}
async function boundedFile(root: string, segments: string[], limit: number): Promise<Buffer> {
  const filename = await checkedPath(root, segments);
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error("UNSAFE_FILE");
    const bytes = Buffer.alloc(Math.min(stat.size, limit) + 1);
    let total = 0;
    while (total < bytes.length) {
      const read = await handle.read(bytes, total, bytes.length - total, total);
      if (read.bytesRead === 0) break;
      total += read.bytesRead;
    }
    const after = await handle.stat();
    if (total > limit || total !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error("UNSAFE_FILE");
    return bytes.subarray(0, total);
  } finally { await handle.close(); }
}
function sanitizedTarget(value: unknown): PublicAuditVerification["target"] | null {
  const source = object(value);
  if (!source) return null;
  const target: PublicAuditVerification["target"] = {};
  for (const key of ["symbol", "name", "chain", "contractAddress"] as const) {
    if (source[key] !== undefined) { if (!text(source[key])) return null; target[key] = source[key]; }
  }
  if (source.blockNumber !== undefined) {
    if (typeof source.blockNumber !== "number" || !Number.isSafeInteger(source.blockNumber) || source.blockNumber < 0) return null;
    target.blockNumber = source.blockNumber;
  }
  for (const key of ["sourceHash", "commitHash"] as const) {
    const value = source[key];
    if (value !== undefined) {
      if (typeof value !== "string" || !(key === "sourceHash" ? HASH : /^[a-f0-9]{40}$/).test(value)) return null;
      target[key] = value;
    }
  }
  return target;
}

/**
 * Only explicitly published records are eligible. A matching manifest is not
 * a signed origin, historical timestamp, external audit or proof of detection.
 * The bounded snapshot is not an atomic multi-file filesystem transaction.
 */
export async function verifyLocalPublishedAudit(
  auditId: string, root = path.resolve(process.cwd(), "evidence"),
): Promise<PublicAuditVerification | PublicAuditFailure> {
  if (!ID.test(auditId)) return failure(400, "invalid_audit_id");
  let raw: Buffer;
  try { raw = await boundedFile(root, [auditId, "manifest", "manifest.json"], MANIFEST_LIMIT); }
  catch (error) {
    const code = object(error)?.code;
    return code === "ENOENT" ? failure(404, "not_found") : failure(503, "verification_unavailable");
  }
  let manifest: ObjectValue | null;
  try { manifest = object(JSON.parse(raw.toString("utf8"))); }
  catch { return failure(422, "manifest_invalid"); }
  const publication = object(manifest?.publication);
  if (publication?.visibility !== "public" || publication.scope !== "integrity-only") return failure(404, "not_found");
  if (!manifest || manifest.schemaVersion !== "velmere.v3.reproducibility-manifest" || manifest.auditId !== auditId ||
      !text(manifest.engineVersion, 100) || !text(manifest.createdAt, 40) || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      typeof manifest.evidenceRoot !== "string" || !HASH.test(manifest.evidenceRoot) ||
      typeof manifest.reportSha256 !== "string" || !HASH.test(manifest.reportSha256) || /^0{64}$/.test(manifest.reportSha256) ||
      !Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0 || manifest.artifacts.length > MAX_ARTIFACTS ||
      !Array.isArray(manifest.leafHashes) || manifest.leafHashes.length !== manifest.artifacts.length) return failure(422, "manifest_invalid");
  const target = sanitizedTarget(manifest.target);
  if (!target) return failure(422, "manifest_invalid");
  const artifacts: Artifact[] = []; const names = new Set<string>(); let total = 0;
  for (const item of manifest.artifacts) {
    const a = object(item);
    if (!a || typeof a.category !== "string" || !SEGMENT.test(a.category) || a.category === "manifest" ||
        typeof a.filename !== "string" || !SEGMENT.test(a.filename) ||
        typeof a.sha256 !== "string" || !HASH.test(a.sha256) || typeof a.sizeBytes !== "number" ||
        !Number.isSafeInteger(a.sizeBytes) || a.sizeBytes < 0 || a.sizeBytes > ARTIFACT_LIMIT) return failure(422, "manifest_invalid");
    const name = a.category + "/" + a.filename;
    if (names.has(name)) return failure(422, "manifest_invalid");
    names.add(name); total += a.sizeBytes;
    if (total > TOTAL_LIMIT) return failure(422, "manifest_invalid");
    artifacts.push({ category: a.category, filename: a.filename, sha256: a.sha256, sizeBytes: a.sizeBytes });
  }
  if (!manifest.leafHashes.every((h: unknown): h is string => typeof h === "string" && HASH.test(h))) return failure(422, "manifest_invalid");
  const leaves = manifest.leafHashes as string[];
  if (JSON.stringify([...leaves].sort()) !== JSON.stringify(artifacts.map(a => a.sha256).sort())) return failure(409, "integrity_mismatch");
  const rootHash = computeMerkleRoot(leaves);
  if (rootHash !== manifest.evidenceRoot || !artifacts.some(a => a.category === "report" && a.filename.endsWith(".pdf") && a.sha256 === manifest.reportSha256)) return failure(409, "integrity_mismatch");
  for (const a of artifacts) {
    try {
      const bytes = await boundedFile(root, [auditId, a.category, a.filename], a.sizeBytes);
      if (bytes.length !== a.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== a.sha256) return failure(409, "integrity_mismatch");
      if (a.category === "report" && a.sha256 === manifest.reportSha256 && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) return failure(409, "integrity_mismatch");
    } catch { return failure(409, "integrity_mismatch"); }
  }
  return {
    ok: true, verified: true, status: "INTEGRITY_MATCH", auditId, verificationScope: SCOPE, authenticity: "NOT_VERIFIED",
    engineVersion: manifest.engineVersion, createdAt: manifest.createdAt, evidenceRoot: manifest.evidenceRoot,
    recomputedMerkleRoot: rootHash, merkleIntegrityMatch: true, artifactBytesMatch: true, reportDigestMatch: true,
    artifactsCount: artifacts.length, leafHashesCount: leaves.length, reportSha256: manifest.reportSha256, target,
    sealType: "LOCAL CONTENT DIGEST COMPARISON", timestampVerified: false,
    timestampNotice: "The manifest date is unverified. No RFC 3161 signature, external timestamp or historical immutability was verified.",
    releaseApproved: false,
  };
}
