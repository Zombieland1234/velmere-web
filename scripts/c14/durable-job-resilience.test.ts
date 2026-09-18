import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DurableComputationError,
  resetDurableComputationMemoryForTests,
  runDurableJsonComputation,
} from "../../lib/jobs/durable-computation-replay";
import { runDurableComputationWorkerDrain } from "../../lib/jobs/durable-computation-worker";
import { sealDurableComputationPayload } from "../../lib/jobs/durable-computation-payload";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const request = () => new Request("http://localhost/api/c14/jobs", { headers: { "accept-language": "en" } });

function assertDurableCode(code: DurableComputationError["code"]) {
  return (error: unknown) => error instanceof DurableComputationError && error.code === code;
}

function runJson(input: {
  requestId: string;
  execute: () => Promise<unknown> | unknown;
  nowMs?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  env?: Record<string, string | undefined>;
  requireDurableStore?: boolean;
}) {
  return runDurableJsonComputation({
    kind: "vlm_analysis",
    request: request(),
    requestId: input.requestId,
    input: { query: "c14-resilience" },
    execute: input.execute,
    nowMs: input.nowMs,
    maxAttempts: input.maxAttempts,
    leaseSeconds: input.leaseSeconds,
    env: input.env ?? { NODE_ENV: "test" },
    requireDurableStore: input.requireDurableStore ?? true,
  });
}

test("duplicate in-progress computation is blocked and completed result replays", async () => {
  resetDurableComputationMemoryForTests();
  let executions = 0;
  let unblock!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { unblock = resolve; });
  const first = runJson({
    requestId: "c14-duplicate",
    execute: async () => { executions += 1; started(); await gate; return { value: 1 }; },
  });
  await startedPromise;
  await assert.rejects(
    runJson({ requestId: "c14-duplicate", execute: async () => { executions += 1; return { value: 2 }; } }),
    assertDurableCode("durable_computation_in_progress"),
  );
  assert.equal(executions, 1);
  unblock();
  const completed = await first;
  assert.equal(completed.replayed, false);
  const replay = await runJson({ requestId: "c14-duplicate", execute: async () => { executions += 1; return { value: 3 }; } });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, { value: 1 });
  assert.equal(executions, 1);
});

test("retry_wait and dead_letter never bypass the durable store", async () => {
  resetDurableComputationMemoryForTests();
  let retryExecutions = 0;
  await assert.rejects(
    runJson({ requestId: "c14-retry", execute: async () => { retryExecutions += 1; throw new Error("synthetic_provider_timeout"); } }),
    /synthetic_provider_timeout/,
  );
  await assert.rejects(
    runJson({ requestId: "c14-retry", execute: async () => { retryExecutions += 1; return { bypass: true }; } }),
    assertDurableCode("durable_computation_retry_wait"),
  );
  assert.equal(retryExecutions, 1);

  resetDurableComputationMemoryForTests();
  let deadExecutions = 0;
  await assert.rejects(
    runJson({ requestId: "c14-dead", maxAttempts: 1, execute: async () => { deadExecutions += 1; throw new Error("synthetic_permanent_failure"); } }),
    /synthetic_permanent_failure/,
  );
  await assert.rejects(
    runJson({ requestId: "c14-dead", maxAttempts: 1, execute: async () => { deadExecutions += 1; return { bypass: true }; } }),
    assertDurableCode("durable_computation_dead_letter"),
  );
  assert.equal(deadExecutions, 1);
});

test("production required durable store fails closed while explicit non-durable mode remains explicit", async () => {
  resetDurableComputationMemoryForTests();
  const savedUrl = process.env.SUPABASE_URL;
  const savedPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    let executions = 0;
    await assert.rejects(
      runJson({
        requestId: "c14-store-required",
        env: { NODE_ENV: "production" },
        requireDurableStore: true,
        execute: async () => { executions += 1; return { bypass: true }; },
      }),
      assertDurableCode("durable_computation_store_required"),
    );
    assert.equal(executions, 0);
    const direct = await runJson({
      requestId: "c14-explicit-direct",
      env: { NODE_ENV: "production" },
      requireDurableStore: false,
      execute: async () => { executions += 1; return { explicit: true }; },
    });
    assert.equal(direct.mode, "direct_non_durable");
    assert.equal(executions, 1);
  } finally {
    if (savedUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = savedUrl;
    if (savedPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = savedPublicUrl;
    if (savedRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedRole;
  }
});

test("expired lease can be reclaimed after a crashed executor and stale owner cannot commit", async () => {
  resetDurableComputationMemoryForTests();
  let unblock!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { unblock = resolve; });
  let executions = 0;
  const first = runJson({
    requestId: "c14-expired-lease",
    nowMs: 1_000,
    leaseSeconds: 15,
    execute: async () => { executions += 1; started(); await gate; return { owner: "stale" }; },
  });
  await startedPromise;
  const recovered = await runJson({
    requestId: "c14-expired-lease",
    nowMs: 17_000,
    leaseSeconds: 15,
    execute: async () => { executions += 1; return { owner: "recovered" }; },
  });
  assert.deepEqual(recovered.value, { owner: "recovered" });
  assert.equal(recovered.attemptCount, 2);
  unblock();
  await assert.rejects(first, assertDurableCode("durable_computation_store_failed"));
  assert.equal(executions, 2);
});

const workerEnv = {
  NODE_ENV: "test",
  VELMERE_DURABLE_PAYLOAD_ACTIVE_KEY_ID: "c14-test",
  VELMERE_DURABLE_PAYLOAD_KEYS_JSON: JSON.stringify({
    "c14-test": Buffer.alloc(32, 7).toString("base64url"),
  }),
};

function makeWorkerJob(leaseToken: string, suffix: string, subject = "c".repeat(64)) {
  const jobId = `dcj_${suffix.repeat(48).slice(0, 48)}`;
  const inputHash = suffix.repeat(64).slice(0, 64);
  const sealedPayload = sealDurableComputationPayload({
    jobId,
    kind: "vlm_analysis",
    inputHash,
    subjectHash: subject,
    payload: { id: suffix },
    env: workerEnv,
  });
  assert.ok(sealedPayload);
  return { jobId, kind: "vlm_analysis" as const, inputHash, subjectHash: subject, attemptCount: 1, leaseToken, sealedPayload, costUnits: 4 };
}

test("worker deduplicates duplicate claims and isolates per-job partial failures", async () => {
  let executions = 0;
  const summary = await runDurableComputationWorkerDrain({
    env: workerEnv,
    concurrency: 2,
    dependencies: {
      claimBatch: async ({ leaseToken }) => {
        const a = makeWorkerJob(leaseToken, "a");
        const b = makeWorkerJob(leaseToken, "b", "d".repeat(64));
        return [a, a, b];
      },
      heartbeat: async ({ jobIds }) => jobIds,
      releaseClaims: async ({ jobIds }) => jobIds,
      complete: async () => true,
      fail: async () => "retry_wait",
      execute: async (_kind, payload) => {
        executions += 1;
        if ((payload as { id: string }).id === "b") throw new Error("synthetic_partial_failure");
        return { encoding: "json", value: { ok: true }, maxResultBytes: 1024 };
      },
    },
  });
  assert.equal(executions, 2);
  assert.equal(summary.duplicateClaims, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.retryWait, 1);
  assert.equal(summary.conflicts, 1);
});

test("slow worker heartbeat is single-flight to prevent heartbeat thundering herd", async () => {
  let heartbeatCalls = 0;
  let concurrentHeartbeats = 0;
  let maxConcurrentHeartbeats = 0;
  const summary = await runDurableComputationWorkerDrain({
    env: workerEnv,
    concurrency: 1,
    heartbeatIntervalMs: 100,
    dependencies: {
      claimBatch: async ({ leaseToken }) => [makeWorkerJob(leaseToken, "e")],
      heartbeat: async ({ jobIds }) => {
        heartbeatCalls += 1;
        if (heartbeatCalls === 1) return jobIds;
        concurrentHeartbeats += 1;
        maxConcurrentHeartbeats = Math.max(maxConcurrentHeartbeats, concurrentHeartbeats);
        await sleep(260);
        concurrentHeartbeats -= 1;
        return jobIds;
      },
      releaseClaims: async ({ jobIds }) => jobIds,
      complete: async () => true,
      fail: async () => "retry_wait",
      execute: async () => {
        await sleep(650);
        return { encoding: "json", value: { ok: true }, maxResultBytes: 1024 };
      },
    },
  });
  assert.equal(summary.completed, 1);
  assert.equal(maxConcurrentHeartbeats, 1);
  assert.ok(summary.heartbeatSkippedInFlight >= 1);
});

test("worker drops ownership on heartbeat loss and never commits stale work", async () => {
  let heartbeatCalls = 0;
  let completions = 0;
  const summary = await runDurableComputationWorkerDrain({
    env: workerEnv,
    concurrency: 1,
    heartbeatIntervalMs: 100,
    dependencies: {
      claimBatch: async ({ leaseToken }) => [makeWorkerJob(leaseToken, "f")],
      heartbeat: async ({ jobIds }) => {
        heartbeatCalls += 1;
        return heartbeatCalls === 1 ? jobIds : [];
      },
      releaseClaims: async ({ jobIds }) => jobIds,
      complete: async () => { completions += 1; return true; },
      fail: async () => "retry_wait",
      execute: async () => {
        await sleep(240);
        return { encoding: "json", value: { stale: true }, maxResultBytes: 1024 };
      },
    },
  });
  assert.equal(summary.lostDuringExecution, 1);
  assert.equal(completions, 0);
});
