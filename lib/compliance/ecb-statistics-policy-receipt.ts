import policyReview from "../../artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesHex } from "@/lib/security/cryptographic-digest";
import {
  R7_ECB_POLICY_REVIEW_BYTE_LENGTH,
  R7_ECB_POLICY_REVIEW_BYTES_BASE64,
} from "@/lib/compliance/ecb-statistics-policy-receipt-bytes";

export const R7_ECB_POLICY_REVIEW_PATH =
  "artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json" as const;
export const R7_ECB_POLICY_REVIEW_SHA256 =
  "375ade75dc6c6a0a12860aed16b3bc079ab182ca713b3192d691e1381895a761" as const;

/**
 * Verifies the exact receipt bytes embedded in the build against both their
 * pinned digest and the JSON module used by runtime policy code. This is kept
 * in a neutral compliance module so network and customer-delivery boundaries
 * can share one physical authority without importing each other.
 */
export function inspectR7EcbStatisticsPolicyReceiptBytes() {
  const bytes = new Uint8Array(Buffer.from(R7_ECB_POLICY_REVIEW_BYTES_BASE64, "base64"));
  const sha256 = sha256BytesHex(bytes);
  let importedJsonMatches: boolean;
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    importedJsonMatches = canonicalJson(parsed) === canonicalJson(policyReview);
  } catch {
    importedJsonMatches = false;
  }
  return Object.freeze({
    valid: bytes.byteLength === R7_ECB_POLICY_REVIEW_BYTE_LENGTH
      && sha256 === R7_ECB_POLICY_REVIEW_SHA256
      && importedJsonMatches,
    path: R7_ECB_POLICY_REVIEW_PATH,
    byteLength: bytes.byteLength,
    sha256,
    importedJsonMatches,
  });
}
