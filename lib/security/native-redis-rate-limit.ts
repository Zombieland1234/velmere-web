import { createClient } from "@redis/client";
import type { DurableRateLimitDecision, DurableRateLimitOptions } from "./durable-rate-limit";
import {
  REDIS_FIXED_WINDOW_LUA,
  buildRedisFixedWindowStorageKey,
  parseRedisFixedWindowResult,
} from "./redis-fixed-window";

/** Server-owned URL only. No caller URL, redirects, remote plaintext or offline replay. */
export function inspectNativeRedisConfig(env: NodeJS.ProcessEnv = process.env) {
  const selected = env.VELMERE_RATE_LIMIT_BACKEND === "redis";
  let urlValid = false;
  try {
    const url = new URL(env.REDIS_URL ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    urlValid = (url.protocol === "rediss:" || (url.protocol === "redis:" && local)) && Boolean(url.hostname) &&
      !url.search && !url.hash && /^(?:\/|\/(?:[0-9]|1[0-5]))?$/.test(url.pathname) &&
      (!url.port || (Number(url.port) >= 1 && Number(url.port) <= 65535));
  } catch { /* configuration is unavailable, never memory fallback */ }
  return { selected, urlPresent: Boolean(env.REDIS_URL), urlValid, configured: selected && urlValid };
}
let inFlight = 0;
const MAX_IN_FLIGHT = 32;
export async function applyNativeRedisRateLimit(options: DurableRateLimitOptions): Promise<DurableRateLimitDecision> {
  const valid = Number.isSafeInteger(options.limit) && options.limit >= 1 && options.limit <= 1_000_000 &&
    Number.isSafeInteger(options.windowMs) && options.windowMs >= 1000 && options.windowMs <= 86_400_000 &&
    Number.isSafeInteger(options.cost ?? 1) && (options.cost ?? 1) >= 1 && (options.cost ?? 1) <= 100 &&
    typeof options.key === "string" && options.key.length > 0 && options.key.length <= 4096 && (options.namespace?.length ?? 0) <= 240;
  const key = buildRedisFixedWindowStorageKey(options);
  const denied = (): DurableRateLimitDecision => ({ ok: false, mode: "unavailable", provider: "redis", remaining: 0,
    resetAt: Date.now() + 10_000, limit: valid ? options.limit : 1, windowMs: valid ? options.windowMs : 1000,
    fixedWindowId: 0, boundaryKey: key, degraded: true, retryAfterSeconds: 10, reason: "rate_limit_store_unavailable", providerError: "native_redis_unavailable" });
  if (!valid || !inspectNativeRedisConfig().configured || inFlight >= MAX_IN_FLIGHT) return denied();
  inFlight++;
  const started = performance.now();
  let destroy = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = createClient({ url: process.env.REDIS_URL!, disableOfflineQueue: true, commandsQueueMaxLength: 16,
      socket: { connectTimeout: 1500, socketTimeout: 2200, reconnectStrategy: false } });
    client.on("error", () => { /* do not log connection URLs, credentials or raw errors */ });
    destroy = () => { try { if (client.isOpen) client.destroy(); } catch { /* already closed */ } };
    const result = await Promise.race([
      (async () => { await client.connect(); return client.eval(REDIS_FIXED_WINDOW_LUA, { keys: [key], arguments: [String(options.windowMs), String(options.cost ?? 1), String(options.limit)] }); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { destroy(); reject(new Error("limiter_deadline")); }, 2200); }),
    ]);
    if (performance.now() - started >= 2200) return denied();
    const parsed = parseRedisFixedWindowResult(result, options);
    if (!parsed) return denied();
    const { count, resetAt, fixedWindowId, serverNow } = parsed;
    return { ok: count <= options.limit, mode: "redis", provider: "redis", remaining: Math.max(0,options.limit-count), resetAt,
      limit: options.limit, windowMs: options.windowMs, fixedWindowId, boundaryKey: key, degraded: false,
      ...(count > options.limit ? { reason: "rate_limit_exceeded", retryAfterSeconds: Math.max(1,Math.ceil((resetAt-serverNow)/1000)) } : {}) };
  } catch { return denied(); }
  finally { if(timer)clearTimeout(timer); destroy(); inFlight--; }
}
