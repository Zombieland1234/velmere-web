export type ReceiptDigestKind =
  | "sha256_full"
  | "sha256_metadata"
  | "sha256_token"
  | "legacy_fnv32"
  | "unknown";

export type ReceiptDigestClassification = {
  raw: string;
  kind: ReceiptDigestKind;
  cryptographic: boolean;
  legacy: boolean;
  hexBits: number | null;
};

const FULL_SHA256 = /^sha256:([a-f0-9]{64})$/i;
const METADATA_SHA256 = /^sha256-metadata:([a-f0-9]{64})$/i;
const TOKEN_SHA256 = /^(?:vlm[-_]|p\d+-|pass\d+-|audit_|trace_|vpd_|vpb_|vpar_|vpps_)?([a-f0-9]{24,64})$/i;
const LEGACY_FNV = /^(?:fnv1a-|sha-lite:|vlm[-_]|p\d+-|pass\d+(?:-fnv1a32)?-)?([a-f0-9]{7,16})$/i;

export function classifyReceiptDigest(value: unknown): ReceiptDigestClassification {
  const raw = String(value ?? "").trim();
  let match = raw.match(FULL_SHA256);
  if (match) return { raw, kind: "sha256_full", cryptographic: true, legacy: false, hexBits: 256 };
  match = raw.match(METADATA_SHA256);
  if (match) return { raw, kind: "sha256_metadata", cryptographic: true, legacy: false, hexBits: 256 };
  match = raw.match(TOKEN_SHA256);
  if (match) return { raw, kind: "sha256_token", cryptographic: true, legacy: false, hexBits: match[1].length * 4 };
  match = raw.match(LEGACY_FNV);
  if (match) return { raw, kind: "legacy_fnv32", cryptographic: false, legacy: true, hexBits: Math.min(64, match[1].length * 4) };
  return { raw, kind: "unknown", cryptographic: false, legacy: false, hexBits: null };
}

export function isCryptographicReceiptDigest(value: unknown): boolean {
  return classifyReceiptDigest(value).cryptographic;
}

export function requireCryptographicReceiptDigest(value: unknown): ReceiptDigestClassification {
  const classification = classifyReceiptDigest(value);
  if (!classification.cryptographic) throw new Error(classification.legacy ? "legacy_receipt_digest_reissue_required" : "receipt_digest_invalid");
  return classification;
}
