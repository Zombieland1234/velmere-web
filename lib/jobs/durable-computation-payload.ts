import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { canonicalDurableJson, sha256Hex } from "@/lib/jobs/durable-computation-canonical";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const DURABLE_COMPUTATION_PAYLOAD_ID = "velmere-durable-computation-payload-v1" as const;

export type DurableComputationSealedPayload = {
  schemaVersion: "velmere.durable-computation.sealed-payload.v1";
  algorithm: "A256GCM";
  keyId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  plaintextSha256: string;
  plaintextBytes: number;
};

type Keyring = { activeKeyId: string; keys: Map<string, Buffer> };

function base64urlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function readKeyring(env: Record<string, string | undefined>): Keyring | null {
  const raw = env.VELMERE_DURABLE_PAYLOAD_KEYS_JSON?.trim();
  const activeKeyId = env.VELMERE_DURABLE_PAYLOAD_ACTIVE_KEY_ID?.trim();
  if (!raw || !activeKeyId) return null;
  let parsed: unknown;
  try {
    parsed = parseStrictJsonText(raw, { maxBytes: 64 * 1024, maxDepth: 8, maxNodes: 512, requireObject: true });
  } catch {
    throw new Error("durable_payload_keyring_invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("durable_payload_keyring_invalid");
  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof encoded !== "string") continue;
    const key = base64urlDecode(encoded.trim());
    if (key.byteLength !== 32) throw new Error(`durable_payload_key_invalid:${keyId}`);
    keys.set(keyId, key);
  }
  if (!keys.has(activeKeyId)) throw new Error("durable_payload_active_key_missing");
  return { activeKeyId, keys };
}

function aad(args: { jobId: string; kind: string; inputHash: string; subjectHash: string; keyId: string }) {
  return Buffer.from(canonicalDurableJson({
    schemaVersion: "velmere.durable-computation.payload-aad.v1",
    jobId: args.jobId,
    kind: args.kind,
    inputHash: args.inputHash,
    subjectHash: args.subjectHash,
    keyId: args.keyId,
  }), "utf8");
}

export function getDurablePayloadKeyringReadiness(env: Record<string, string | undefined> = process.env) {
  try {
    const keyring = readKeyring(env);
    return {
      configured: Boolean(keyring),
      activeKeyId: keyring?.activeKeyId ?? null,
      keyCount: keyring?.keys.size ?? 0,
      valid: true,
    };
  } catch {
    return { configured: true, activeKeyId: null, keyCount: 0, valid: false };
  }
}

export function sealDurableComputationPayload(args: {
  jobId: string;
  kind: string;
  inputHash: string;
  subjectHash: string;
  payload: unknown;
  maxPlaintextBytes?: number;
  env?: Record<string, string | undefined>;
}): DurableComputationSealedPayload | null {
  const keyring = readKeyring(args.env ?? process.env);
  if (!keyring) return null;
  const plaintext = Buffer.from(canonicalDurableJson(args.payload, "$workerPayload"), "utf8");
  const maxBytes = Math.max(1024, Math.min(512 * 1024, args.maxPlaintextBytes ?? 128 * 1024));
  if (plaintext.byteLength > maxBytes) throw new Error("durable_payload_too_large");
  const keyId = keyring.activeKeyId;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyring.keys.get(keyId)!, iv);
  cipher.setAAD(aad({ ...args, keyId }));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    schemaVersion: "velmere.durable-computation.sealed-payload.v1",
    algorithm: "A256GCM",
    keyId,
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    plaintextSha256: sha256Hex(plaintext),
    plaintextBytes: plaintext.byteLength,
  };
}

export function openDurableComputationPayload<T>(args: {
  jobId: string;
  kind: string;
  inputHash: string;
  subjectHash: string;
  sealedPayload: DurableComputationSealedPayload;
  env?: Record<string, string | undefined>;
}): T {
  const envelope = args.sealedPayload;
  if (envelope.schemaVersion !== "velmere.durable-computation.sealed-payload.v1" || envelope.algorithm !== "A256GCM") {
    throw new Error("durable_payload_envelope_invalid");
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(envelope.keyId)) throw new Error("durable_payload_key_id_invalid");
  if (!/^[0-9a-f]{64}$/.test(envelope.plaintextSha256)) throw new Error("durable_payload_hash_invalid");
  if (!Number.isInteger(envelope.plaintextBytes) || envelope.plaintextBytes < 0 || envelope.plaintextBytes > 512 * 1024) {
    throw new Error("durable_payload_size_invalid");
  }
  const keyring = readKeyring(args.env ?? process.env);
  const key = keyring?.keys.get(envelope.keyId);
  if (!key) throw new Error("durable_payload_key_unavailable");
  const iv = base64urlDecode(envelope.iv);
  const authTag = base64urlDecode(envelope.authTag);
  const ciphertext = base64urlDecode(envelope.ciphertext);
  if (iv.byteLength !== 12 || authTag.byteLength !== 16) throw new Error("durable_payload_encoding_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad({ ...args, keyId: envelope.keyId }));
  decipher.setAuthTag(authTag);
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("durable_payload_authentication_failed");
  }
  if (plaintext.byteLength !== envelope.plaintextBytes || sha256Hex(plaintext) !== envelope.plaintextSha256) {
    throw new Error("durable_payload_integrity_failed");
  }
  return parseStrictJsonText<T>(plaintext.toString("utf8"), { maxBytes: 512 * 1024, maxDepth: 48, maxNodes: 75_000, requireObject: false });
}
