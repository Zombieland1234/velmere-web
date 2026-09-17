import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** An authenticated address assertion, NOT a session or request authorization.
 * The private ingress must overwrite all three headers using its socket peer.
 * Replay within 30 seconds keeps the SAME limiter identity and consumes quota.
 */
export const SIGNED_PROXY_HEADERS = {
  address: "x-velmere-proxy-address", time: "x-velmere-proxy-time", signature: "x-velmere-proxy-signature",
} as const;
export function inspectSignedProxyConfig(env: NodeJS.ProcessEnv = process.env) {
  const key = env.VELMERE_PROXY_HMAC_SECRET ?? "";
  const audience = env.VELMERE_PROXY_HMAC_AUDIENCE ?? "";
  return { configured: /^[a-f0-9]{64}$/i.test(key) && new Set(key.toLowerCase()).size >= 8 &&
    /^[a-z0-9][a-z0-9._-]{2,95}$/.test(audience), audience };
}
export function resolveSignedProxyAddress(request: Request, env: NodeJS.ProcessEnv = process.env, now = Date.now()): string | null {
  const config = inspectSignedProxyConfig(env);
  if (!config.configured || !Number.isSafeInteger(now)) return null;
  const address = request.headers.get(SIGNED_PROXY_HEADERS.address) ?? "";
  const timestamp = request.headers.get(SIGNED_PROXY_HEADERS.time) ?? "";
  const signature = request.headers.get(SIGNED_PROXY_HEADERS.signature) ?? "";
  if (!isIP(address) || address.includes("%") || address.length > 45 || !/^[1-9][0-9]{12}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const issued = Number(timestamp);
  if (issued > now + 2000 || now - issued > 30_000) return null;
  const expected = createHmac("sha256", Buffer.from(env.VELMERE_PROXY_HMAC_SECRET!, "hex"))
    .update(`velmere-proxy-address-v1\n${config.audience}\n${timestamp}\n${address}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? address : null;
}
