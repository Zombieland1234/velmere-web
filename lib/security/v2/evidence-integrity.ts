import { createHash } from "node:crypto";

/** Return a real SHA-256 digest for evidence identity. */
export function evidenceSha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
