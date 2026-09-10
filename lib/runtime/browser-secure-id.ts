const SAFE_BROWSER_ID_PREFIX = /^[a-z][a-z0-9:_-]{0,79}$/i;

function secureRandomHex(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID().replaceAll("-", "").toLowerCase();
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("secure_browser_random_unavailable");
}

export function createBrowserSecureId(prefix: string): string {
  if (!SAFE_BROWSER_ID_PREFIX.test(prefix)) throw new Error("Browser secure ID prefix is invalid.");
  return `${prefix}_${secureRandomHex()}`;
}
