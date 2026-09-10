import { sha256BytesHex } from "@/lib/security/cryptographic-digest";

const encoder = new TextEncoder();

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function hexBytes(hex: string): Uint8Array {
  if (!/^[a-f0-9]*$/i.test(hex) || hex.length % 2 !== 0) throw new Error("hex_bytes_invalid");
  const result = new Uint8Array(hex.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

/** Portable synchronous HMAC-SHA256 for server/browser-shared proof helpers. */
export function hmacSha256Digest(secret: string, message: string): string {
  let key: Uint8Array<ArrayBufferLike> = encoder.encode(String(secret ?? ""));
  if (key.length > 64) key = hexBytes(sha256BytesHex(key));
  const block = new Uint8Array(64);
  block.set(key);
  const innerPad = block.map((value) => value ^ 0x36);
  const outerPad = block.map((value) => value ^ 0x5c);
  const inner = hexBytes(sha256BytesHex(concatBytes(innerPad, encoder.encode(String(message ?? "")))));
  return `sha256:${sha256BytesHex(concatBytes(outerPad, inner))}`;
}

export function constantTimeTextEqual(left: string, right: string): boolean {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
