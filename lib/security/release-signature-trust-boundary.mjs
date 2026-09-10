import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";

export const PASS36_A71_RELEASE_SIGNATURE_BOUNDARY_ID = "velmere.pass36.a71.release-signature-trust-boundary.v1";
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9._:-]{2,128}$/u;

export class ReleaseSignatureBoundaryError extends Error {
  constructor(code, detail = "") {
    super(detail ? `${code}:${detail}` : code);
    this.name = "ReleaseSignatureBoundaryError";
    this.code = code;
  }
}
const fail = (code, detail = "") => { throw new ReleaseSignatureBoundaryError(code, detail); };
const record = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
export function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) fail("non_finite_number");
  if (!["string", "number", "boolean"].includes(typeof value)) fail("unsupported_json_value");
  return JSON.stringify(value);
}
export function readBoundedRegularFile(filePath, maximumBytes = 1_048_576) {
  const metadata = lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail("input_not_regular_file", filePath);
  if (metadata.size <= 0 || metadata.size > maximumBytes) fail("input_size_invalid", filePath);
  return readFileSync(filePath);
}
export function parseTrustedFingerprints(values) {
  const rows = Array.isArray(values) ? values : [values];
  const out = new Set();
  for (const row of rows) {
    for (const item of String(row ?? "").split(",")) {
      const value = item.trim().toLowerCase();
      if (!value) continue;
      if (!SHA256.test(value)) fail("trusted_fingerprint_invalid");
      out.add(value);
    }
  }
  return out;
}
export function strictEd25519PublicKey(pem) {
  const normalized = String(pem ?? "").trim().replace(/\\n/g, "\n");
  if (normalized.length < 64 || normalized.length > 8192 || /PRIVATE KEY/u.test(normalized)) fail("public_key_pem_invalid");
  let key;
  try { key = createPublicKey(normalized); } catch { fail("public_key_parse_failed"); }
  if (key.asymmetricKeyType !== "ed25519") fail("public_key_not_ed25519");
  return key;
}
export function publicKeyFingerprint(pem) {
  return sha256Hex(strictEd25519PublicKey(pem).export({ type: "spki", format: "der" }));
}
export function strictEd25519Signature(value) {
  const input = String(value ?? "");
  if (!/^[A-Za-z0-9_-]{86}$/u.test(input)) fail("signature_encoding_invalid");
  let bytes;
  try { bytes = Buffer.from(input, "base64url"); } catch { fail("signature_encoding_invalid"); }
  if (bytes.length !== 64 || bytes.toString("base64url") !== input) fail("signature_encoding_invalid");
  return bytes;
}
function epoch(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  fail("key_window_invalid", field);
}
export function validateKeyRegistry(keys, options = {}) {
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > (options.maximumKeys ?? 32)) fail("key_registry_size_invalid");
  const nowSeconds = Number.isInteger(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  const ids = new Set();
  const fingerprints = new Set();
  const normalized = [];
  for (const item of keys) {
    if (!record(item)) fail("key_record_invalid");
    const keyId = String(item.keyId ?? "").trim();
    if (!SAFE_ID.test(keyId) || ids.has(keyId)) fail("key_id_invalid_or_duplicate", keyId);
    ids.add(keyId);
    const computed = publicKeyFingerprint(item.publicKeyPem);
    if (fingerprints.has(computed)) fail("key_fingerprint_duplicate", computed);
    fingerprints.add(computed);
    if (item.fingerprint !== undefined && String(item.fingerprint).toLowerCase() !== computed) fail("key_fingerprint_mismatch", keyId);
    const status = String(item.status ?? "");
    if (!new Set(["active", "retiring", "retired", "revoked"]).has(status)) fail("key_status_invalid", keyId);
    const notBefore = epoch(item.notBefore ?? item.validFrom, "notBefore");
    const notAfter = epoch(item.notAfter ?? item.validUntil, "notAfter");
    if (notBefore !== null && notAfter !== null && notAfter <= notBefore) fail("key_window_invalid", keyId);
    const currentlyValid = (notBefore === null || nowSeconds >= notBefore) && (notAfter === null || nowSeconds <= notAfter);
    const roles = item.roles === undefined ? [] : Array.isArray(item.roles) ? item.roles.map((value) => String(value)) : fail("key_roles_invalid", keyId);
    if (new Set(roles).size !== roles.length || roles.some((role) => !SAFE_ID.test(role))) fail("key_roles_invalid", keyId);
    normalized.push({
      keyId,
      publicKeyPem: String(item.publicKeyPem).trim().replace(/\\n/g, "\n"),
      fingerprint: computed,
      status,
      ...(notBefore === null ? {} : { notBefore }),
      ...(notAfter === null ? {} : { notAfter }),
      ...(item.revokedAt === undefined ? {} : { revokedAt: item.revokedAt }),
      ...(item.replacementFingerprint === undefined ? {} : { replacementFingerprint: String(item.replacementFingerprint).toLowerCase() }),
      ...(item.revocationCode === undefined ? {} : { revocationCode: String(item.revocationCode) }),
      ...((roles ?? []).length ? { roles } : {}),
      currentlyValid,
    });
  }
  return normalized.sort((left, right) => left.keyId.localeCompare(right.keyId));
}
export function registryDigest(keys) {
  const normalized = validateKeyRegistry(keys, { nowSeconds: 0 });
  return sha256Hex(canonicalJson(normalized.map(({ publicKeyPem, currentlyValid, roles, ...rest }) => ({
    ...rest,
    ...((roles ?? []).length ? { roles } : {}),
    publicKeySpki: Buffer.from(strictEd25519PublicKey(publicKeyPem).export({ type: "spki", format: "der" })).toString("base64"),
  }))));
}
export function verifyThresholdSignatures({ payload, signatures, keys, threshold, nowSeconds, requiredRole = null, domain = "signature" }) {
  if (!Number.isInteger(threshold) || threshold < 1) fail(`${domain}_threshold_invalid`);
  if (!Array.isArray(signatures) || signatures.length < threshold || signatures.length > 32) fail(`${domain}_threshold_not_met`);
  const registry = validateKeyRegistry(keys, { nowSeconds });
  const byId = new Map(registry.map((key) => [key.keyId, key]));
  const activeEligible = registry.filter((key) => key.status === "active" && key.currentlyValid && (!requiredRole || (key.roles ?? []).length === 0 || (key.roles ?? []).includes(requiredRole)));
  if (threshold > activeEligible.length) fail(`${domain}_threshold_exceeds_eligible_keys`);
  const seen = new Set();
  let qualified = 0;
  const message = Buffer.from(canonicalJson(payload), "utf8");
  for (const signature of signatures) {
    if (!record(signature)) fail(`${domain}_signature_record_invalid`);
    const keyId = String(signature.keyId ?? "").trim();
    if (seen.has(keyId)) fail(`${domain}_duplicate_signer`, keyId);
    seen.add(keyId);
    const key = byId.get(keyId);
    if (!key) fail(`${domain}_unknown_signer`, keyId);
    if (key.status !== "active") fail(`${domain}_signer_not_active`, keyId);
    if (!key.currentlyValid) fail(`${domain}_signer_outside_validity`, keyId);
    if (requiredRole && (key.roles ?? []).length > 0 && !(key.roles ?? []).includes(requiredRole)) fail(`${domain}_signer_role_invalid`, keyId);
    if (!cryptoVerify(null, message, strictEd25519PublicKey(key.publicKeyPem), strictEd25519Signature(signature.signature))) fail(`${domain}_signature_invalid`, keyId);
    qualified += 1;
  }
  if (qualified < threshold) fail(`${domain}_qualified_threshold_not_met`);
  return { registry, qualified };
}
export function verifyTrustCheckpointArtifact(checkpoint, options = {}) {
  if (!record(checkpoint) || checkpoint.schemaVersion !== "velmere.release-trust-checkpoint.v1" || !record(checkpoint.payload)) fail("checkpoint_schema_invalid");
  const payload = checkpoint.payload;
  if (options.expectedEnvironment && payload.environment !== options.expectedEnvironment) fail("checkpoint_environment_mismatch");
  if (options.expectedAudience && payload.audience !== options.expectedAudience) fail("checkpoint_audience_mismatch");
  if (payload.audienceHash !== sha256Hex(String(payload.audience ?? ""))) fail("checkpoint_audience_hash_invalid");
  if (!Number.isInteger(payload.sequence) || payload.sequence < 1 || !Number.isInteger(payload.trustEpoch) || payload.trustEpoch < 1) fail("checkpoint_sequence_invalid");
  const nowSeconds = Number.isInteger(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  const registry = validateKeyRegistry(payload.keys, { nowSeconds });
  if (registryDigest(payload.keys) !== payload.keyRegistryDigest) fail("checkpoint_registry_digest_invalid");
  const revoked = registry.filter((key) => key.status === "revoked").map((key) => key.fingerprint).sort();
  if (canonicalJson(revoked) !== canonicalJson(payload.revokedKeyFingerprints ?? [])) fail("checkpoint_revocation_set_invalid");
  verifyThresholdSignatures({ payload, signatures: checkpoint.signatures, keys: payload.keys, threshold: payload.signatureThreshold, nowSeconds: payload.issuedAt ?? nowSeconds, requiredRole: "trust_checkpoint", domain: "checkpoint" });
  const digest = sha256Hex(canonicalJson({ payload, signatures: [...checkpoint.signatures].sort((a, b) => String(a.keyId).localeCompare(String(b.keyId))) }));
  if (digest !== checkpoint.checkpointDigest) fail("checkpoint_digest_invalid");
  const previous = options.previousCheckpoint ?? null;
  if (payload.sequence === 1) {
    if (payload.previousCheckpointDigest !== null) fail("checkpoint_genesis_previous_forbidden");
    const trustedFingerprints = parseTrustedFingerprints(options.trustedFingerprints ?? []);
    const trustedDigests = new Set((options.trustedCheckpointDigests ?? []).map((value) => String(value).toLowerCase()));
    const fingerprintMatch = registry.some((key) => key.status === "active" && trustedFingerprints.has(key.fingerprint));
    if (!fingerprintMatch && !trustedDigests.has(checkpoint.checkpointDigest)) fail("checkpoint_external_anchor_required");
  } else {
    if (!previous) fail("checkpoint_previous_required");
    if (previous.checkpointDigest !== payload.previousCheckpointDigest || previous.payload.sequence + 1 !== payload.sequence || previous.payload.environment !== payload.environment || previous.payload.audienceHash !== payload.audienceHash) fail("checkpoint_chain_mismatch");
    for (const value of previous.payload.revokedKeyFingerprints ?? []) if (!(payload.revokedKeyFingerprints ?? []).includes(value)) fail("checkpoint_revocation_regression");
    for (const value of previous.payload.supersededPackageDigests ?? []) if (!(payload.supersededPackageDigests ?? []).includes(value)) fail("checkpoint_supersession_regression");
    const changed = previous.payload.keyRegistryDigest !== payload.keyRegistryDigest;
    if (payload.trustEpoch !== previous.payload.trustEpoch + (changed ? 1 : 0)) fail("checkpoint_trust_epoch_invalid");
  }
  return { checkpoint, registry, digest };
}
