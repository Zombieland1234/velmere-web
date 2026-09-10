const SAFE_PREFIX = /^[a-z][a-z0-9_-]{0,31}$/i;

function secureUuidHex(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) {
    throw new Error("Web Crypto is required to create secure runtime IDs.");
  }
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function createSecureRuntimeId(prefix: string): string {
  if (!SAFE_PREFIX.test(prefix)) {
    throw new Error("Runtime ID prefix must be 1-32 safe ASCII characters and start with a letter.");
  }
  return `${prefix}_${secureUuidHex()}`;
}
