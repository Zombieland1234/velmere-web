import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalLogRecord,
} from "../../lib/security/operational-log-boundary";
import {
  normalizeRequestCorrelationId,
  resolveRequestCorrelationId,
} from "../../lib/observability/request-correlation";
import {
  buildRuntimeReadinessSnapshot,
  type RuntimeReadinessInput,
} from "../../lib/observability/runtime-readiness";
import {
  probeNativeRedisReadiness,
} from "../../lib/security/native-redis-rate-limit";
import {
  BoundedSupabaseRpcError,
  runBoundedSupabaseRpc,
} from "../../lib/db/bounded-supabase-rpc";

const correlationId = `req_${"a".repeat(32)}`;

function baseline(): RuntimeReadinessInput {
  return {
    correlationId,
    generatedAt: new Date("2026-09-18T00:00:00.000Z"),
    web: { reachable: true },
    redis: { ready: true, selected: true, latencyMs: 4, code: "redis_ready" },
    database: { configured: true, reachable: true, latencyMs: 7 },
    worker: {
      executable: true,
      severity: "none",
      processing: 0,
      retryWait: 0,
      deadLetter: 0,
      expiredLeases: 0,
      oldestReadyAgeSeconds: 0,
      oldestLeaseAgeSeconds: 0,
    },
    stripe: {
      webhookSecretConfigured: true,
      serverSecretConfigured: true,
      reconciliationReady: true,
      alertSinkConfigured: true,
    },
    providers: {
      snapshotPresent: true,
      snapshotValid: true,
      snapshotFresh: true,
      durable: true,
      failedProviders: 0,
      blockerCount: 0,
    },
    reports: {
      workerExecutable: true,
      processing: 0,
      retryWait: 0,
      deadLetter: 0,
      completedRetained: 3,
    },
    storage: { durableConfigured: true, reachable: true },
  };
}

test("request correlation accepts only bounded Velmere request IDs", () => {
  assert.equal(normalizeRequestCorrelationId(correlationId), correlationId);
  assert.equal(normalizeRequestCorrelationId("Bearer sk_live_secret"), null);
  const request = new Request("https://velmere.example/api/test", {
    headers: { "x-correlation-id": "Bearer sk_live_do_not_echo" },
  });
  const resolved = resolveRequestCorrelationId(request);
  assert.match(resolved, /^req_[a-f0-9]{32}$/);
  assert.notEqual(resolved, "Bearer sk_live_do_not_echo");
});

test("operational logs keep timestamp/correlation but hash identifiers and omit raw error text", () => {
  const record = buildOperationalLogRecord({
    level: "error",
    system: "stripe",
    event: "webhook_retry_scheduled",
    code: "webhook_processing_retryable",
    correlationId,
    occurredAt: "2026-09-18T00:00:00.000Z",
    metrics: { attempt: 2 },
    identifiers: { eventId: "evt_customer_sensitive_123" },
    error: Object.assign(new Error("postgres://user:secret@example.invalid/db"), { code: "rpc_failed" }),
  });
  const encoded = JSON.stringify(record);
  assert.equal(record.occurredAt, "2026-09-18T00:00:00.000Z");
  assert.equal(record.correlationId, correlationId);
  assert.match(record.identifierHashes.eventIdSha256, /^[a-f0-9]{64}$/);
  assert.equal(record.rawIdentifiersIncluded, false);
  assert.equal(record.rawErrorMessageIncluded, false);
  assert.equal(record.stackIncluded, false);
  assert.doesNotMatch(encoded, /evt_customer_sensitive_123/);
  assert.doesNotMatch(encoded, /postgres:\/\//);
  assert.doesNotMatch(encoded, /user:secret/);
});

test("Redis readiness refuses invalid config without echoing Redis URL", async () => {
  const secretUrl = "redis://default:super-secret@remote.example:6379/0";
  const result = await probeNativeRedisReadiness({
    env: {
      VELMERE_RATE_LIMIT_BACKEND: "redis",
      REDIS_URL: secretUrl,
    } as NodeJS.ProcessEnv,
  });
  assert.equal(result.ready, false);
  assert.equal(result.state, "not_configured");
  assert.equal(result.code, "redis_configuration_invalid");
  assert.doesNotMatch(JSON.stringify(result), /super-secret|remote\.example/);
});

test("Redis readiness exposes safe failure code and never raw driver error", async () => {
  const captured: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { captured.push(args.map(String).join(" ")); };
  try {
    const result = await probeNativeRedisReadiness({
      env: {
        VELMERE_RATE_LIMIT_BACKEND: "redis",
        REDIS_URL: "redis://127.0.0.1:6379/0",
      } as NodeJS.ProcessEnv,
      correlationId,
      clientFactory: () => ({
        isOpen: false,
        on: () => undefined,
        connect: async () => { throw new Error("redis://:do-not-log@127.0.0.1:6379/0"); },
        ping: async () => "PONG",
        destroy: () => undefined,
      }),
    });
    assert.equal(result.ready, false);
    assert.equal(result.state, "unavailable");
    assert.equal(result.code, "redis_unavailable");
    const log = captured.join("\n");
    assert.match(log, /redis_unavailable/);
    assert.match(log, /readiness_probe_failed/);
    assert.doesNotMatch(log, /do-not-log/);
    assert.doesNotMatch(log, /redis:\/\/:/);
  } finally {
    console.error = original;
  }
});

test("Redis readiness accepts a bounded PONG probe", async () => {
  let destroyed = false;
  const result = await probeNativeRedisReadiness({
    env: {
      VELMERE_RATE_LIMIT_BACKEND: "redis",
      REDIS_URL: "redis://127.0.0.1:6379/0",
    } as NodeJS.ProcessEnv,
    clientFactory: () => ({
      isOpen: true,
      on: () => undefined,
      connect: async () => undefined,
      ping: async () => "PONG",
      destroy: () => { destroyed = true; },
    }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.state, "ready");
  assert.equal(result.code, "redis_ready");
  assert.equal(typeof result.latencyMs, "number");
  assert.equal(destroyed, true);
});

test("bounded Supabase RPC emits a redacted structured failure", async () => {
  const captured: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { captured.push(args.map(String).join(" ")); };
  try {
    await assert.rejects(
      runBoundedSupabaseRpc({
        operation: "test_monitoring_rpc",
        rpcName: "private_rpc_name",
        capability: "service_role_write",
        correlationId,
        clientOverride: {
          rpc: () => Promise.resolve({
            data: null,
            error: {
              code: "PGRST_SECRET_PROVIDER_CODE",
              message: "postgres://user:password@example.invalid/private",
            },
          }),
        },
      }),
      (error: unknown) => error instanceof BoundedSupabaseRpcError && error.code === "rpc_failed",
    );
    const log = captured.join("\n");
    assert.match(log, /rpc_failed/);
    assert.match(log, new RegExp(correlationId));
    assert.doesNotMatch(log, /PGRST_SECRET_PROVIDER_CODE/);
    assert.doesNotMatch(log, /private_rpc_name/);
    assert.doesNotMatch(log, /postgres:\/\//);
    assert.doesNotMatch(log, /password/);
  } finally {
    console.error = original;
  }
});

test("unified runtime snapshot is ready only when all critical components are ready", () => {
  const snapshot = buildRuntimeReadinessSnapshot(baseline());
  assert.equal(snapshot.state, "ready");
  assert.deepEqual(snapshot.counts, { ready: 8, degraded: 0, blocked: 0 });
  assert.deepEqual(snapshot.alertKeys, []);
});

test("Redis outage is immediately diagnosable and blocks readiness", () => {
  const input = baseline();
  input.redis = { ready: false, selected: true, latencyMs: 2000, code: "redis_unavailable" };
  const snapshot = buildRuntimeReadinessSnapshot(input);
  assert.equal(snapshot.state, "blocked");
  const redis = snapshot.components.find((row) => row.id === "redis");
  assert.equal(redis?.state, "blocked");
  assert.deepEqual(redis?.reasonCodes, ["redis_unavailable"]);
  assert.ok(snapshot.alertKeys.includes("redis:redis_unavailable"));
});

test("worker retry backlog is visible without exposing job identifiers", () => {
  const input = baseline();
  input.worker.retryWait = 7;
  input.worker.severity = "warning";
  const snapshot = buildRuntimeReadinessSnapshot(input);
  const worker = snapshot.components.find((row) => row.id === "worker");
  assert.equal(snapshot.state, "degraded");
  assert.equal(worker?.state, "degraded");
  assert.equal(worker?.metrics.retryWait, 7);
  assert.equal(worker?.retryVisible, true);
  assert.doesNotMatch(JSON.stringify(snapshot), /jobId|eventId|customerId/);
});

test("report dead-letter backlog blocks report readiness and remains aggregate-only", () => {
  const input = baseline();
  input.reports.deadLetter = 2;
  const snapshot = buildRuntimeReadinessSnapshot(input);
  const reports = snapshot.components.find((row) => row.id === "report_generation");
  assert.equal(snapshot.state, "blocked");
  assert.equal(reports?.state, "blocked");
  assert.equal(reports?.metrics.deadLetter, 2);
  assert.ok(reports?.reasonCodes.includes("report_dead_letter_nonzero"));
});

test("database outage explains cascading durable recovery impact", () => {
  const input = baseline();
  input.database = { configured: true, reachable: false, latencyMs: 5000, code: "rpc_deadline_exceeded" };
  input.storage.reachable = false;
  const snapshot = buildRuntimeReadinessSnapshot(input);
  const states = Object.fromEntries(snapshot.components.map((row) => [row.id, row.state]));
  assert.equal(states.postgresql_supabase, "blocked");
  assert.equal(states.worker, "blocked");
  assert.equal(states.stripe_webhooks, "blocked");
  assert.equal(states.report_generation, "blocked");
  assert.equal(states.storage, "blocked");
  assert.ok(snapshot.alertKeys.some((key) => key.includes("rpc_deadline_exceeded")));
});
