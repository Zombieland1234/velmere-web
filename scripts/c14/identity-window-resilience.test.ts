import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REDIS_FIXED_WINDOW_LUA,
  buildRedisFixedWindowStorageKey,
  parseRedisFixedWindowResult,
} from "../../lib/security/redis-fixed-window";
import { buildPass632FixedWindow } from "../../lib/security/production-rate-limit-adapter";
import { rateLimitAddressKey, resolveTrustedClientAddress } from "../../lib/security/api-guard";
import { createHmac } from "node:crypto";
import { reserveCustomerRuntimeRequest, customerRuntimeResourceDependencies } from "../../lib/security/customer-runtime-resource-guard";
import { inspectDurableRateLimitRuntime } from "../../lib/security/durable-rate-limit";

test("server-time Redis primitive removes application clock from distributed bucket selection", () => {
  const options = { namespace: "c14", key: "same-client", limit: 6, windowMs: 60_000 };
  const stable = buildRedisFixedWindowStorageKey(options);
  assert.equal(stable, buildRedisFixedWindowStorageKey(options));
  assert.doesNotMatch(stable, /same-client/);
  const localA = buildPass632FixedWindow({ key: "legacy", windowMs: 60_000, nowMs: 59_999 });
  const localB = buildPass632FixedWindow({ key: "legacy", windowMs: 60_000, nowMs: 60_001 });
  assert.notEqual(localA.bucketKey, localB.bucketKey, "old application-clock bucketing splits around boundary");
  assert.match(REDIS_FIXED_WINDOW_LUA, /redis\.call\('TIME'\)/);
  assert.match(REDIS_FIXED_WINDOW_LUA, /math\.floor\(now \/ window\)/);
  const parsed = parseRedisFixedWindowResult([4, 120_000, 1, 60_001], { ...options, cost: 1 });
  assert.deepEqual(parsed, { count: 4, resetAt: 120_000, fixedWindowId: 1, serverNow: 60_001 });
});

test("Redis fixed-window parser rejects malformed or impossible provider responses", () => {
  const options = { key: "x", limit: 5, windowMs: 60_000, cost: 1 };
  assert.equal(parseRedisFixedWindowResult([1, 60_000, 0, 60_000], options), null);
  assert.equal(parseRedisFixedWindowResult([1.5, 120_000, 1, 60_001], options), null);
  assert.equal(parseRedisFixedWindowResult([106, 120_000, 1, 60_001], options), null);
  assert.equal(parseRedisFixedWindowResult([1, 180_001, 1, 60_001], options), null);
});

test("equivalent IPv6 spellings aggregate to the same /64 rate-limit identity", () => {
  assert.equal(rateLimitAddressKey("2001:db8:abcd:12::1"), "2001:db8:abcd:12::/64");
  assert.equal(rateLimitAddressKey("2001:0db8:abcd:0012:ffff::2"), "2001:db8:abcd:12::/64");
});

test("signed proxy alternate IPv6 spellings resolve to the same rate-limit /64", () => {
  const secret = "0123456789abcdef".repeat(4);
  const audience = "c14-test-ingress";
  const now = Date.now();
  const env = {
    NODE_ENV: "production",
    VELMERE_TRUSTED_PROXY_PROFILE: "signed_proxy",
    VELMERE_PROXY_HMAC_SECRET: secret,
    VELMERE_PROXY_HMAC_AUDIENCE: audience,
  } as NodeJS.ProcessEnv;
  const build = (address: string) => {
    const timestamp = String(now);
    const signature = createHmac("sha256", Buffer.from(secret, "hex"))
      .update(`velmere-proxy-address-v1\n${audience}\n${timestamp}\n${address}`).digest("hex");
    return new Request("https://velmere.invalid/api/audit/report", { headers: {
      "x-velmere-proxy-address": address,
      "x-velmere-proxy-time": timestamp,
      "x-velmere-proxy-signature": signature,
    } });
  };
  const a = resolveTrustedClientAddress(build("2001:db8:abcd:12::1"), env);
  const b = resolveTrustedClientAddress(build("2001:0db8:abcd:0012:ffff::2"), env);
  assert.equal(a.trusted, true);
  assert.equal(b.trusted, true);
  assert.equal(rateLimitAddressKey(a.address!), rateLimitAddressKey(b.address!));
});

test("JSON/PDF/alternate endpoint formats reserve the same customer runtime quotaPath", async () => {
  const dependencies = customerRuntimeResourceDependencies as unknown as {
    rateLimit: (request: Request, options: { quotaPath?: string }) => Promise<{ ok: true; remaining: number; resetAt: number }>;
  };
  const original = dependencies.rateLimit;
  const seen: Array<{ path: string; quotaPath?: string }> = [];
  dependencies.rateLimit = async (request: Request, options) => {
    seen.push({ path: new URL(request.url).pathname, quotaPath: options.quotaPath });
    return { ok: true as const, remaining: 5, resetAt: Date.now() + 60_000 };
  };
  try {
    for (const path of ["/api/audit/report", "/api/audit/report-pdf", "/en/security/audits/report/0xabc"]) {
      const reserved = await reserveCustomerRuntimeRequest(new Request(`http://localhost${path}`));
      assert.equal(reserved.ok, true);
      if (reserved.ok) reserved.release();
    }
  } finally {
    dependencies.rateLimit = original;
  }
  assert.deepEqual(new Set(seen.map((item) => item.quotaPath)), new Set(["/customer-runtime-analysis"]));
});

test("Upstash readiness advertises the same server-time fixed-window primitive", () => {
  const runtime = inspectDurableRateLimitRuntime({
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://example-upstash.invalid",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  } as NodeJS.ProcessEnv);
  assert.equal(runtime.mode, "upstash_rest");
  assert.equal(runtime.exactRuntimeAdapter, "upstash_rest_eval_server_time_fixed_window");
});
