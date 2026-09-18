import { createHash } from "node:crypto";

export type RedisFixedWindowInput = {
  namespace?: string;
  key: string;
  limit: number;
  windowMs: number;
  cost?: number;
};

/**
 * One atomic fixed-window primitive for every Redis-compatible durable limiter.
 * TIME is intentionally read inside Redis so application instances with skewed
 * clocks cannot select different buckets around a reset boundary.
 */
export const REDIS_FIXED_WINDOW_LUA = `
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
  local oldWindow = tonumber(old[1])
  local oldCount = tonumber(old[2])
  if not oldWindow or not oldCount or oldWindow ~= math.floor(oldWindow) or
      oldCount ~= math.floor(oldCount) or oldWindow < 0 or oldWindow > wid or
      oldCount < 0 or oldCount > limit + 100 then
    return redis.error_reply('invalid_limiter_state')
  end
  if oldWindow == wid then count = oldCount end
end
count = math.min(limit + 100, count + cost)
redis.call('HSET', KEYS[1], 'window', wid, 'count', count)
redis.call('PEXPIRE', KEYS[1], reset - now + 30000)
return {count, reset, wid, now}
`;

/** Keep the existing v2 native-Redis key derivation while making Upstash use
 * the same opaque, configuration-bound storage identity. */
export function buildRedisFixedWindowStorageKey(input: RedisFixedWindowInput) {
  return `velmere:rl:v2:${createHash("sha256")
    .update(JSON.stringify([input.namespace ?? "velmere", input.key, input.limit, input.windowMs]))
    .digest("hex")}`;
}

export function parseRedisFixedWindowResult(result: unknown, input: RedisFixedWindowInput) {
  const cost = input.cost ?? 1;
  if (!Array.isArray(result) || result.length !== 4) return null;
  const values = result.map((value) => Number(value));
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) return null;
  const [count, resetAt, fixedWindowId, serverNow] = values;
  if (
    count < cost ||
    count > input.limit + 100 ||
    resetAt <= serverNow ||
    resetAt - serverNow > input.windowMs ||
    fixedWindowId !== Math.floor(serverNow / input.windowMs)
  ) return null;
  return { count, resetAt, fixedWindowId, serverNow } as const;
}
