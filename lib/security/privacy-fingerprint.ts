import { createHmac, randomBytes } from "node:crypto";

const EPHEMERAL_PROCESS_SECRET = randomBytes(32);
const SAFE_PREFIX = /^[a-z][a-z0-9_-]{0,15}$/i;
const MIN_SECRET_BYTES = 32;

function configuredSecret(): Buffer | null {
  const value = process.env.VELMERE_SECURITY_FINGERPRINT_SECRET?.trim();
  if (!value || Buffer.byteLength(value, "utf8") < MIN_SECRET_BYTES) return null;
  return Buffer.from(value, "utf8");
}

export function createPrivacyFingerprint(value: string, prefix = "fp"): string {
  if (!SAFE_PREFIX.test(prefix)) throw new Error("Fingerprint prefix is invalid.");
  const key = configuredSecret() ?? EPHEMERAL_PROCESS_SECRET;
  const digest = createHmac("sha256", key).update(value, "utf8").digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

export function buildPrivacyFingerprintReadiness() {
  const configured = Boolean(configuredSecret());
  return {
    schemaVersion: "velmere.security.privacy-fingerprint.v1",
    mode: configured ? "configured_hmac_sha256" : "ephemeral_process_hmac_sha256",
    configured,
    productionReady: configured,
    minimumSecretBytes: MIN_SECRET_BYTES,
    digestBitsExposed: 96,
    rawClientDataStored: false,
    crossProcessStable: configured,
    boundary: configured
      ? "Client fingerprints use a dedicated configured HMAC-SHA-256 key."
      : "Client fingerprints use an ephemeral process key. Configure VELMERE_SECURITY_FINGERPRINT_SECRET with at least 32 bytes before production.",
  } as const;
}
