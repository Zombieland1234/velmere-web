import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import type { VlmBrainOutput } from "./vlm-contract";
import { VLM_BRAIN_CALIBRATION_HASH, VLM_BRAIN_CALIBRATION_VERSION } from "./vlm-brain-calibration";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";

export type VlmAnalysisReceipt = {
  schemaVersion: "velmere.vlm.receipt.v3";
  receiptId: string;
  createdAt: string;
  expiresAt: string;
  traceId: string;
  assetId: string;
  mode: "gemini" | "rules";
  factsHash: string;
  sourcesHash: string;
  /** Canonical digest of the complete fact packet, including governors, caps and gaps. */
  packetHash: string;
  outputHash: string;
  policyHash: string;
  calibrationVersion: typeof VLM_BRAIN_CALIBRATION_VERSION;
  calibrationHash: typeof VLM_BRAIN_CALIBRATION_HASH;
  shadowStatus: "approved" | "revised" | "rejected" | "unavailable" | "not_run";
  shadowModel: string | null;
  signing: "ed25519" | "hmac-sha256" | "unsigned";
  keyId: string | null;
  signature: string | null;
};

export type VlmReceiptVerification = {
  valid: boolean;
  integrityValid: boolean;
  signatureValid: boolean | null;
  freshnessValid: boolean;
  signing: VlmAnalysisReceipt["signing"];
  keyId: string | null;
  reasons: string[];
};

export type VlmReceiptPublicKey = {
  keyId: string;
  algorithm: "Ed25519";
  publicKeyPem: string;
  publicKeyFingerprint: string;
  status: "active" | "previous";
};

type ReceiptInput = {
  traceId: string;
  mode: "gemini" | "rules";
  facts: VlmCanonicalFactPacket;
  output: VlmBrainOutput;
  shadowStatus?: VlmAnalysisReceipt["shadowStatus"];
  shadowModel?: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

export function canonicalVlmJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: unknown) {
  return createHash("sha256").update(canonicalVlmJson(value)).digest("hex");
}

function decodePem(value?: string) {
  if (!value?.trim()) return null;
  try {
    return Buffer.from(value.trim(), "base64").toString("utf8");
  } catch {
    return null;
  }
}

function privateSigningKey() {
  const pem = decodePem(process.env.VELMERE_VLM_RECEIPT_ED25519_PRIVATE_KEY_B64);
  if (!pem) return null;
  try {
    const key = createPrivateKey(pem);
    return key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

function activePublicKey(privateKey?: KeyObject | null) {
  const pem = decodePem(process.env.VELMERE_VLM_RECEIPT_ED25519_PUBLIC_KEY_B64);
  try {
    const key = privateKey ? createPublicKey(privateKey) : pem ? createPublicKey(pem) : null;
    return key?.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

function keyFingerprint(key: KeyObject) {
  const der = key.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex");
}

function configuredKeyId(key: KeyObject) {
  return process.env.VELMERE_VLM_RECEIPT_ACTIVE_KEY_ID?.trim() ||
    `vlmed_${keyFingerprint(key).slice(0, 16)}`;
}

function previousPublicKeys() {
  const raw = process.env.VELMERE_VLM_RECEIPT_PREVIOUS_PUBLIC_KEYS_JSON?.trim();
  if (!raw) return new Map<string, KeyObject>();
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const keys = new Map<string, KeyObject>();
    for (const [keyId, encodedPem] of Object.entries(parsed)) {
      const pem = decodePem(encodedPem);
      if (!pem || !/^[A-Za-z0-9:_-]{4,80}$/.test(keyId)) continue;
      const key = createPublicKey(pem);
      if (key.asymmetricKeyType === "ed25519") keys.set(keyId, key);
    }
    return keys;
  } catch {
    return new Map<string, KeyObject>();
  }
}

function receiptSecret() {
  const value = process.env.VELMERE_VLM_RECEIPT_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function receiptTtlMs() {
  const configured = Number(process.env.VELMERE_VLM_RECEIPT_TTL_MS || 15 * 60_000);
  return Math.min(24 * 60 * 60_000, Math.max(60_000, Number.isFinite(configured) ? configured : 15 * 60_000));
}

function expectedPolicyHash() {
  return sha256({
    brainVersion: "velmere-vlm-brain-v3",
    receiptVersion: "velmere.vlm.receipt.v3",
    calibrationVersion: VLM_BRAIN_CALIBRATION_VERSION,
    calibrationHash: VLM_BRAIN_CALIBRATION_HASH,
    claimFirewall: true,
    epistemicGovernor: true,
    shadowRequiredForLive: true,
    sourceIntegritySentinel: true,
    temporalConsistencySentinel: true,
    narrativeDriftLock: true,
    decisionReversibilitySentinel: true,
  });
}

function unsignedPayload(receipt: VlmAnalysisReceipt) {
  const { signature: _signature, ...payload } = receipt;
  return Buffer.from(canonicalVlmJson(payload), "utf8");
}

function signHmac(receipt: VlmAnalysisReceipt, secret: string) {
  return createHmac("sha256", secret).update(unsignedPayload(receipt)).digest("hex");
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verificationPublicKey(receipt: VlmAnalysisReceipt) {
  if (!receipt.keyId) return null;
  const active = activePublicKey(privateSigningKey());
  if (active && configuredKeyId(active) === receipt.keyId) return active;
  return previousPublicKeys().get(receipt.keyId) ?? null;
}

export function listVlmReceiptPublicKeys(): VlmReceiptPublicKey[] {
  const keys: VlmReceiptPublicKey[] = [];
  const active = activePublicKey(privateSigningKey());
  if (active) {
    keys.push({
      keyId: configuredKeyId(active),
      algorithm: "Ed25519",
      publicKeyPem: active.export({ type: "spki", format: "pem" }).toString(),
      publicKeyFingerprint: keyFingerprint(active),
      status: "active",
    });
  }
  for (const [keyId, key] of previousPublicKeys()) {
    if (keys.some((item) => item.keyId === keyId)) continue;
    keys.push({
      keyId,
      algorithm: "Ed25519",
      publicKeyPem: key.export({ type: "spki", format: "pem" }).toString(),
      publicKeyFingerprint: keyFingerprint(key),
      status: "previous",
    });
  }
  return keys;
}

export function createVlmAnalysisReceipt(input: ReceiptInput): VlmAnalysisReceipt {
  const createdAt = new Date();
  const privateKey = privateSigningKey();
  const publicKey = activePublicKey(privateKey);
  const secret = receiptSecret();
  const signing: VlmAnalysisReceipt["signing"] = privateKey && publicKey
    ? "ed25519"
    : secret
      ? "hmac-sha256"
      : "unsigned";
  const keyId = signing === "ed25519" && publicKey
    ? configuredKeyId(publicKey)
    : signing === "hmac-sha256" && secret
      ? `vlmk_${createHash("sha256").update(secret).digest("hex").slice(0, 12)}`
      : null;
  const receipt: VlmAnalysisReceipt = {
    schemaVersion: "velmere.vlm.receipt.v3",
    receiptId: `vlmr_${sha256({
      traceId: input.traceId,
      assetId: input.facts.asset.id,
      createdAt: createdAt.toISOString(),
    }).slice(0, 24)}`,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + receiptTtlMs()).toISOString(),
    traceId: input.traceId,
    assetId: input.facts.asset.id,
    mode: input.mode,
    factsHash: sha256(input.facts.facts),
    sourcesHash: sha256(input.facts.sources),
    packetHash: sha256(input.facts),
    outputHash: sha256(input.output),
    policyHash: expectedPolicyHash(),
    calibrationVersion: VLM_BRAIN_CALIBRATION_VERSION,
    calibrationHash: VLM_BRAIN_CALIBRATION_HASH,
    shadowStatus: input.shadowStatus ?? "not_run",
    shadowModel: input.shadowModel ?? null,
    signing,
    keyId,
    signature: null,
  };
  if (signing === "ed25519" && privateKey) {
    receipt.signature = sign(null, unsignedPayload(receipt), privateKey).toString("base64url");
  } else if (signing === "hmac-sha256" && secret) {
    receipt.signature = signHmac(receipt, secret);
  }
  return receipt;
}

export function verifyVlmAnalysisReceipt(input: {
  receipt: VlmAnalysisReceipt;
  facts: VlmCanonicalFactPacket;
  output: VlmBrainOutput;
  now?: Date;
}): VlmReceiptVerification {
  const reasons: string[] = [];
  if (input.receipt.schemaVersion !== "velmere.vlm.receipt.v3") reasons.push("unsupported_schema");
  if (input.receipt.calibrationVersion !== VLM_BRAIN_CALIBRATION_VERSION) reasons.push("calibration_version_mismatch");
  if (!safeHexEqual(input.receipt.calibrationHash, VLM_BRAIN_CALIBRATION_HASH)) reasons.push("calibration_hash_mismatch");
  if (input.receipt.assetId !== input.facts.asset.id) reasons.push("asset_mismatch");
  if (input.receipt.assetId !== input.output.asset.id) reasons.push("output_asset_mismatch");
  if (input.receipt.traceId !== input.output.traceId) reasons.push("trace_mismatch");
  if (!safeHexEqual(input.receipt.factsHash, sha256(input.facts.facts))) reasons.push("facts_modified");
  if (!safeHexEqual(input.receipt.sourcesHash, sha256(input.facts.sources))) reasons.push("sources_modified");
  if (!safeHexEqual(input.receipt.packetHash, sha256(input.facts))) reasons.push("packet_modified");
  if (!safeHexEqual(input.receipt.outputHash, sha256(input.output))) reasons.push("output_modified");
  if (!safeHexEqual(input.receipt.policyHash, expectedPolicyHash())) reasons.push("policy_modified");
  const integrityValid = reasons.length === 0;

  const now = input.now?.getTime() ?? Date.now();
  const createdAt = Date.parse(input.receipt.createdAt);
  const expiresAt = Date.parse(input.receipt.expiresAt);
  let freshnessValid = true;
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    reasons.push("invalid_receipt_time");
    freshnessValid = false;
  } else if (createdAt > now + 60_000) {
    reasons.push("receipt_from_future");
    freshnessValid = false;
  } else if (expiresAt < now) {
    reasons.push("receipt_expired");
    freshnessValid = false;
  }

  let signatureValid: boolean | null = null;
  if (input.receipt.signing === "ed25519") {
    const publicKey = verificationPublicKey(input.receipt);
    if (!publicKey) {
      reasons.push("public_key_unavailable");
      signatureValid = false;
    } else if (!input.receipt.signature) {
      reasons.push("signature_missing");
      signatureValid = false;
    } else {
      try {
        signatureValid = verify(
          null,
          unsignedPayload(input.receipt),
          publicKey,
          Buffer.from(input.receipt.signature, "base64url"),
        );
      } catch {
        signatureValid = false;
      }
      if (!signatureValid) reasons.push("signature_invalid");
    }
  } else if (input.receipt.signing === "hmac-sha256") {
    const secret = receiptSecret();
    if (!secret) {
      reasons.push("verification_key_unavailable");
      signatureValid = false;
    } else if (!input.receipt.signature) {
      reasons.push("signature_missing");
      signatureValid = false;
    } else {
      signatureValid = safeHexEqual(input.receipt.signature, signHmac(input.receipt, secret));
      if (!signatureValid) reasons.push("signature_invalid");
    }
  } else {
    reasons.push("receipt_unsigned");
  }

  return {
    valid: integrityValid && freshnessValid && signatureValid === true,
    integrityValid,
    signatureValid,
    freshnessValid,
    signing: input.receipt.signing,
    keyId: input.receipt.keyId,
    reasons,
  };
}
