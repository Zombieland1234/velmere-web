import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,159}$/u;
const CLASS = "REAL_REDACTED_EXTERNAL";
const TRUST_SCHEMA = "velmere.pass36.real-evidence-trust-policy.v1";
const RECEIPT_SCHEMA = "velmere.pass36.real-evidence-receipt.v1";

const lexical = (a, b) => a.localeCompare(b, "en", { sensitivity: "variant" });
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort(lexical).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function inside(candidate, root) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const fold = (value) => process.platform === "win32" ? value.toLocaleLowerCase("en-US") : value;
  return fold(resolvedCandidate).startsWith(`${fold(resolvedRoot)}${path.sep}`);
}

function resolveRegular(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || relativePath !== relativePath.normalize("NFC") || relativePath.includes("\\") || path.isAbsolute(relativePath)) return null;
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  const absolute = path.resolve(root, ...segments);
  if (!inside(absolute, root) || !fs.existsSync(absolute)) return null;
  const metadata = fs.lstatSync(absolute);
  if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
  const real = fs.realpathSync.native(absolute);
  const realRoot = fs.realpathSync.native(root);
  if (!inside(real, realRoot)) return null;
  return { absolute: real, bytes: metadata.size };
}

function loadJsonFile(file) {
  try {
    const bytes = fs.readFileSync(file);
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch {
    return null;
  }
}

export function loadRealEvidenceContext(sourceRoot = process.cwd(), env = process.env) {
  try {
    const evidenceRoot = String(env.VELMERE_REAL_EVIDENCE_ROOT ?? "").trim();
    const trustPolicyPath = String(env.VELMERE_REAL_EVIDENCE_TRUST_POLICY ?? "").trim();
    const trustPolicySha256 = String(env.VELMERE_REAL_EVIDENCE_TRUST_POLICY_SHA256 ?? "").trim().toLowerCase();
    if (!path.isAbsolute(evidenceRoot) || !path.isAbsolute(trustPolicyPath) || !HASH.test(trustPolicySha256)) return null;
    if (!fs.existsSync(evidenceRoot) || !fs.statSync(evidenceRoot).isDirectory() || !fs.existsSync(trustPolicyPath)) return null;
    const sourceReal = fs.realpathSync.native(sourceRoot);
    const evidenceReal = fs.realpathSync.native(evidenceRoot);
    const trustReal = fs.realpathSync.native(trustPolicyPath);
    if (inside(evidenceReal, sourceReal) || inside(trustReal, sourceReal) || evidenceReal === sourceReal || trustReal === sourceReal) return null;
    const trustBytes = fs.readFileSync(trustReal);
    if (sha256(trustBytes) !== trustPolicySha256) return null;
    const trust = JSON.parse(trustBytes.toString("utf8"));
    const authority = JSON.parse(fs.readFileSync(path.join(sourceRoot, "config/pass36/current-release-authority.json"), "utf8"));
    const sourceRevisionId = authority?.currentSource?.revisionId;
    if (trust?.schemaVersion !== TRUST_SCHEMA || trust?.sourceRevisionId !== sourceRevisionId || !Array.isArray(trust?.verifiers) || trust.verifiers.length === 0) return null;
    const verifiers = new Map();
    for (const row of trust.verifiers) {
      if (!ID.test(String(row?.organizationId ?? "")) || row?.algorithm !== "Ed25519" || typeof row?.publicKeySpkiDerBase64 !== "string" || !Array.isArray(row?.allowedFamilies)) return null;
      if (verifiers.has(row.organizationId) || new Set(row.allowedFamilies).size !== row.allowedFamilies.length || row.allowedFamilies.some((family) => !ID.test(String(family)))) return null;
      const der = Buffer.from(row.publicKeySpkiDerBase64, "base64");
      const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
      if (key.asymmetricKeyType !== "ed25519") return null;
      verifiers.set(row.organizationId, { key, allowedFamilies: new Set(row.allowedFamilies) });
    }
    return { evidenceRoot: evidenceReal, sourceRevisionId, trustPolicyPath: trustReal, trustPolicySha256, verifiers };
  } catch {
    return null;
  }
}

function verifyReceipt(ref, expectedSubjectId, family, context) {
  if (!ref || typeof ref !== "object" || !ID.test(String(ref.evidenceId ?? "")) || ref.subjectId !== expectedSubjectId || ref.evidenceFamily !== family || !HASH.test(String(ref.sha256 ?? "")) || !Number.isSafeInteger(ref.bytes) || ref.bytes <= 0) return null;
  const receiptFile = resolveRegular(context.evidenceRoot, ref.receiptPath);
  if (!receiptFile || receiptFile.bytes !== ref.bytes) return null;
  const loaded = loadJsonFile(receiptFile.absolute);
  if (!loaded || sha256(loaded.bytes) !== ref.sha256) return null;
  const receipt = loaded.value;
  if (receipt?.schemaVersion !== RECEIPT_SCHEMA || receipt?.evidenceId !== ref.evidenceId || receipt?.subjectId !== expectedSubjectId || receipt?.evidenceFamily !== family || receipt?.evidenceClass !== CLASS || receipt?.sourceRevisionId !== context.sourceRevisionId || receipt?.fixtureOnly !== false || receipt?.synthetic !== false || receipt?.status !== "VERIFIED") return null;
  const payload = receipt.payload;
  if (!payload || !HASH.test(String(payload.sha256 ?? "")) || !Number.isSafeInteger(payload.bytes) || payload.bytes <= 0) return null;
  const payloadFile = resolveRegular(context.evidenceRoot, payload.path);
  if (!payloadFile || payloadFile.bytes !== payload.bytes || sha256(fs.readFileSync(payloadFile.absolute)) !== payload.sha256) return null;
  const verifier = receipt.verifier;
  const trusted = context.verifiers.get(verifier?.organizationId);
  if (!trusted || verifier?.algorithm !== "Ed25519" || !trusted.allowedFamilies.has(family) || typeof verifier?.signedAt !== "string" || !Number.isFinite(Date.parse(verifier.signedAt)) || typeof verifier?.signatureBase64 !== "string") return null;
  const unsignedVerifier = { ...verifier };
  delete unsignedVerifier.signatureBase64;
  const signedCore = { ...receipt, verifier: unsignedVerifier };
  const signature = Buffer.from(verifier.signatureBase64, "base64");
  if (signature.length !== 64 || !crypto.verify(null, Buffer.from(canonicalJson(signedCore)), trusted.key, signature)) return null;
  return { evidenceId: ref.evidenceId, family, organizationId: verifier.organizationId, receiptPath: receiptFile.absolute, payloadPath: payloadFile.absolute, payloadSha256: payload.sha256 };
}

export function verifyPhysicalEvidenceFamilies(row, options) {
  const context = options?.context ?? loadRealEvidenceContext(options?.sourceRoot ?? process.cwd(), options?.env ?? process.env);
  const expectedSubjectId = String(options?.expectedSubjectId ?? "");
  const requiredFamilies = Array.isArray(options?.requiredFamilies) ? options.requiredFamilies : [];
  const minimumIndependentOrganizations = Number(options?.minimumIndependentOrganizations ?? 1);
  if (!context || !ID.test(expectedSubjectId) || requiredFamilies.length === 0 || new Set(requiredFamilies).size !== requiredFamilies.length || requiredFamilies.some((family) => !ID.test(String(family)))) return { verified: false, verifiedFamilies: 0, organizations: 0 };
  const refs = Array.isArray(row?.evidenceRefs) ? row.evidenceRefs : [];
  const byFamily = new Map();
  for (const ref of refs) {
    if (byFamily.has(ref?.evidenceFamily)) return { verified: false, verifiedFamilies: 0, organizations: 0 };
    byFamily.set(ref?.evidenceFamily, ref);
  }
  const verified = [];
  for (const family of requiredFamilies) {
    const result = verifyReceipt(byFamily.get(family), expectedSubjectId, family, context);
    if (!result) return { verified: false, verifiedFamilies: verified.length, organizations: new Set(verified.map((item) => item.organizationId)).size };
    verified.push(result);
  }
  if (new Set(verified.map((item) => item.evidenceId)).size !== verified.length || new Set(verified.map((item) => item.receiptPath)).size !== verified.length || new Set(verified.map((item) => item.payloadPath)).size !== verified.length || new Set(verified.map((item) => item.payloadSha256)).size !== verified.length) return { verified: false, verifiedFamilies: verified.length, organizations: 0 };
  const organizations = new Set(verified.map((item) => item.organizationId)).size;
  return { verified: organizations >= minimumIndependentOrganizations, verifiedFamilies: verified.length, organizations };
}

export const REAL_EVIDENCE_CLASS = CLASS;
export const REAL_EVIDENCE_RECEIPT_SCHEMA = RECEIPT_SCHEMA;
export const REAL_EVIDENCE_TRUST_SCHEMA = TRUST_SCHEMA;
