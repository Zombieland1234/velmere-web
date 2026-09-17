import { createHash } from "node:crypto";
import { createClient } from "@redis/client";
import type { DurableRateLimitDecision, DurableRateLimitOptions } from "./durable-rate-limit";

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
const LUA = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local wid = math.floor(now / window)
local reset = (wid + 1) * window
local old = redis.call('HMGET', KEYS[1], 'window', 'count')
local count = 0
if old[1] or old[2] then
  if not tonumber(old[1]) or not tonumber(old[2]) or tonumber(old[2]) < 0 then
    return redis.error_reply('invalid_limiter_state')
  end
  if tonumber(old[1]) == wid then count = tonumber(old[2]) end
end
count = math.min(limit + 100, count + cost)
redis.call('HSET', KEYS[1], 'window', wid, 'count', count)
redis.call('PEXPIRE', KEYS[1], reset - now + 30000)
return {count, reset, wid, now}
`;
let inFlight = 0;
const MAX_IN_FLIGHT = 32;
export async function applyNativeRedisRateLimit(options: DurableRateLimitOptions): Promise<DurableRateLimitDecision> {
  const valid = Number.isSafeInteger(options.limit) && options.limit >= 1 && options.limit <= 1_000_000 &&
    Number.isSafeInteger(options.windowMs) && options.windowMs >= 1000 && options.windowMs <= 86_400_000 &&
    Number.isSafeInteger(options.cost ?? 1) && (options.cost ?? 1) >= 1 && (options.cost ?? 1) <= 100 &&
    typeof options.key === "string" && options.key.length > 0 && options.key.length <= 4096 && (options.namespace?.length ?? 0) <= 240;
  const key = `velmere:rl:v2:${createHash("sha256").update(JSON.stringify([options.namespace ?? "velmere",options.key,options.limit,options.windowMs])).digest("hex")}`;
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
      (async () => { await client.connect(); return client.eval(LUA, { keys: [key], arguments: [String(options.windowMs), String(options.cost ?? 1), String(options.limit)] }); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { destroy(); reject(new Error("limiter_deadline")); }, 2200); }),
    ]);
    if (performance.now() - started >= 2200 || !Array.isArray(result) || result.length !== 4 || !result.every(x => typeof x === "number" && Number.isSafeInteger(x) && x >= 0)) return denied();
    const [count, resetAt, wid, serverNow] = result as number[];
    if (count < (options.cost ?? 1) || resetAt <= serverNow || resetAt - serverNow > options.windowMs || wid !== Math.floor(serverNow/options.windowMs)) return denied();
    return { ok: count <= options.limit, mode: "redis", provider: "redis", remaining: Math.max(0,options.limit-count), resetAt,
      limit: options.limit, windowMs: options.windowMs, fixedWindowId: wid, boundaryKey: key, degraded: false,
      ...(count > options.limit ? { reason: "rate_limit_exceeded", retryAfterSeconds: Math.max(1,Math.ceil((resetAt-serverNow)/1000)) } : {}) };
  } catch { return denied(); }
  finally { if(timer)clearTimeout(timer); destroy(); inFlight--; }
}
