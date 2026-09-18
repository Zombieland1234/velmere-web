import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@redis/client";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server, type Socket } from "node:net";
import { promisify } from "node:util";
import { applyDurableRateLimit } from "../../lib/security/durable-rate-limit";

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const port = 16425;
const blackholePort = 16426;
const work = mkdtempSync(join(tmpdir(), "velmere-c14-redis-"));
const password = randomBytes(32).toString("hex");
const redisUrl = `redis://:${password}@127.0.0.1:${port}/0`;
const config = join(work, "redis.conf");
writeFileSync(config, [
  "bind 127.0.0.1",
  `port ${port}`,
  "protected-mode yes",
  `requirepass ${password}`,
  `dir ${work}`,
  "appendonly yes",
  "appendfsync always",
  'save ""',
  "loglevel warning",
  "",
].join("\n"), { mode: 0o600 });

let redis: ReturnType<typeof spawn> | null = null;

async function waitForRedis(url = redisUrl) {
  for (let i = 0; i < 80; i += 1) {
    const client = createClient({ url, socket: { connectTimeout: 300, reconnectStrategy: false } });
    client.on("error", () => {});
    try {
      await client.connect();
      const pong = await client.ping();
      client.destroy();
      if (pong === "PONG") return;
    } catch {
      try { client.destroy(); } catch { /* already closed */ }
      await sleep(50);
    }
  }
  throw new Error("private_redis_not_ready");
}

async function startRedis() {
  redis = spawn("redis-server", [config], { stdio: "ignore" });
  await waitForRedis();
}

async function stopRedis(signal: NodeJS.Signals = "SIGTERM") {
  const child = redis;
  if (!child || child.exitCode !== null) { redis = null; return; }
  child.kill(signal);
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    sleep(2_000).then(() => { if (child.exitCode === null) child.kill("SIGKILL"); }),
  ]);
  redis = null;
}

function withRedisEnv(url = redisUrl) {
  process.env.VELMERE_RATE_LIMIT_BACKEND = "redis";
  process.env.REDIS_URL = url;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.VELMERE_RATE_LIMIT_DISABLED;
}

async function privateAdmin() {
  const client = createClient({ url: redisUrl });
  client.on("error", () => {});
  await client.connect();
  return client;
}

async function runInstance(key: string, limit: number, count: number) {
  const { stdout } = await execFileAsync("node_modules/.bin/tsx", ["scripts/c14/redis-instance-client.ts", key, String(limit), String(count)], {
    cwd: process.cwd(),
    env: { ...process.env, VELMERE_RATE_LIMIT_BACKEND: "redis", REDIS_URL: redisUrl },
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout.toString()) as { allowed: number; denied: number; unavailable: number; boundaryKeys: string[] };
}

test("C14 private Redis resilience matrix", async (t) => {
  withRedisEnv();
  await startRedis();
  try {
    await t.test("rapid concurrency stays atomic", async () => {
      const key = randomUUID();
      const rows = await Promise.all(Array.from({ length: 24 }, () => applyDurableRateLimit({
        namespace: "c14-rapid",
        key,
        limit: 8,
        windowMs: 60_000,
      })));
      assert.equal(rows.filter((row) => row.ok).length, 8);
      assert.equal(rows.filter((row) => row.reason === "rate_limit_exceeded").length, 16);
      assert.ok(rows.every((row) => row.mode === "redis" && row.provider === "redis"));
      assert.equal(new Set(rows.map((row) => row.boundaryKey)).size, 1);
    });

    await t.test("three independent application processes share one quota", async () => {
      const key = randomUUID();
      const rows = await Promise.all([
        runInstance(key, 7, 6),
        runInstance(key, 7, 6),
        runInstance(key, 7, 6),
      ]);
      assert.equal(rows.reduce((sum, row) => sum + row.allowed, 0), 7);
      assert.equal(rows.reduce((sum, row) => sum + row.denied, 0), 11);
      assert.equal(rows.reduce((sum, row) => sum + row.unavailable, 0), 0);
      assert.equal(new Set(rows.flatMap((row) => row.boundaryKeys)).size, 1);
    });

    await t.test("fixed-window boundary resets after Redis server-time boundary", async () => {
      const key = randomUUID();
      const first = await applyDurableRateLimit({ namespace: "c14-boundary", key, limit: 1, windowMs: 1_000 });
      assert.equal(first.ok, true);
      assert.equal((await applyDurableRateLimit({ namespace: "c14-boundary", key, limit: 1, windowMs: 1_000 })).ok, false);
      const wait = Math.max(0, Math.min(1_300, first.resetAt - Date.now() + 90));
      await sleep(wait);
      const after = await applyDurableRateLimit({ namespace: "c14-boundary", key, limit: 1, windowMs: 1_000 });
      assert.equal(after.ok, true);
      assert.ok(after.fixedWindowId > first.fixedWindowId);
    });

    await t.test("AOF crash restore preserves exhausted quota and reconnects", async () => {
      const key = randomUUID();
      assert.equal((await applyDurableRateLimit({ namespace: "c14-aof", key, limit: 2, windowMs: 60_000 })).ok, true);
      assert.equal((await applyDurableRateLimit({ namespace: "c14-aof", key, limit: 2, windowMs: 60_000 })).ok, true);
      assert.equal((await applyDurableRateLimit({ namespace: "c14-aof", key, limit: 2, windowMs: 60_000 })).ok, false);
      await stopRedis("SIGKILL");
      const started = performance.now();
      const unavailable = await applyDurableRateLimit({ namespace: "c14-aof", key, limit: 2, windowMs: 60_000 });
      assert.equal(unavailable.mode, "unavailable");
      assert.equal(unavailable.provider, "redis");
      assert.ok(performance.now() - started < 3_500);
      await startRedis();
      const restored = await applyDurableRateLimit({ namespace: "c14-aof", key, limit: 2, windowMs: 60_000 });
      assert.equal(restored.ok, false);
      assert.equal(restored.mode, "redis");
      assert.equal(restored.reason, "rate_limit_exceeded");
    });

    await t.test("invalid selected Redis configuration fails closed without remote access", async () => {
      const saved = process.env.REDIS_URL;
      process.env.REDIS_URL = "redis://remote.example.invalid:6379/0";
      try {
        const result = await applyDurableRateLimit({ key: randomUUID(), limit: 1, windowMs: 60_000 });
        assert.equal(result.mode, "unavailable");
        assert.equal(result.provider, "redis");
        assert.equal(result.providerError, "redis_configuration_invalid");
      } finally {
        process.env.REDIS_URL = saved;
      }
    });

    await t.test("network blackhole fails closed and caps thundering-herd connections", async () => {
      const sockets = new Set<Socket>();
      let accepted = 0;
      const server: Server = createServer((socket) => {
        accepted += 1;
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(blackholePort, "127.0.0.1", () => resolve());
      });
      const saved = process.env.REDIS_URL;
      process.env.REDIS_URL = `redis://127.0.0.1:${blackholePort}/0`;
      try {
        const started = performance.now();
        const rows = await Promise.all(Array.from({ length: 80 }, () => applyDurableRateLimit({
          namespace: "c14-blackhole",
          key: randomUUID(),
          limit: 10,
          windowMs: 60_000,
        })));
        const elapsed = performance.now() - started;
        assert.ok(rows.every((row) => !row.ok && row.mode === "unavailable"));
        assert.ok(accepted <= 32, `native Redis in-flight cap exceeded: ${accepted}`);
        assert.ok(elapsed < 4_500, `blackhole deadline exceeded: ${elapsed}ms`);
      } finally {
        process.env.REDIS_URL = saved;
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    await t.test("AOF state contains only opaque limiter keys and no caller identifier", async () => {
      const privateMarker = `customer-${randomUUID()}@example.invalid`;
      const result = await applyDurableRateLimit({ namespace: "c14-privacy", key: privateMarker, limit: 2, windowMs: 60_000 });
      assert.equal(result.ok, true);
      assert.doesNotMatch(result.boundaryKey, /customer-|example\.invalid/);
      const admin = await privateAdmin();
      try {
        const keys = await admin.keys("velmere:rl:v2:*");
        assert.ok(keys.includes(result.boundaryKey));
        assert.ok(keys.every((key) => !key.includes(privateMarker)));
      } finally {
        admin.destroy();
      }
    });
  } finally {
    await stopRedis();
    rmSync(work, { recursive: true, force: true });
  }
});
