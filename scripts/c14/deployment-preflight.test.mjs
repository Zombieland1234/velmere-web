import test from "node:test";
import assert from "node:assert/strict";
import { inspectDeploymentEnvironment } from "../deployment/preflight.mjs";

const complete = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  VELMERE_TRUSTED_PROXY_PROFILE: "vercel",
  VELMERE_SECURITY_FINGERPRINT_SECRET: "fp-" + "a".repeat(40),
  UPSTASH_REDIS_REST_URL: "https://example-upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "redis-" + "b".repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-" + "c".repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: "service-" + "d".repeat(40),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_" + "e".repeat(32),
  STRIPE_SECRET_KEY: "sk_test_" + "f".repeat(32),
  STRIPE_WEBHOOK_SECRET: "whsec_" + "1".repeat(32),
};

test("complete preview configuration reports ready without exposing values", () => {
  const result = inspectDeploymentEnvironment({ ...complete });
  assert.equal(result.configurationReady, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.connectivityVerified, false);
  const serialized = JSON.stringify(result);
  for (const secret of [
    complete.VELMERE_SECURITY_FINGERPRINT_SECRET,
    complete.UPSTASH_REDIS_REST_TOKEN,
    complete.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    complete.SUPABASE_SERVICE_ROLE_KEY,
    complete.STRIPE_SECRET_KEY,
    complete.STRIPE_WEBHOOK_SECRET,
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("missing Supabase configuration fails closed", () => {
  const result = inspectDeploymentEnvironment({ ...complete, SUPABASE_SERVICE_ROLE_KEY: "" });
  assert.equal(result.configurationReady, false);
  assert.ok(result.blockers.includes("SUPABASE_CONFIGURATION_MISSING"));
});

test("live Stripe credentials do not satisfy TEST dependency validation", () => {
  const result = inspectDeploymentEnvironment({
    ...complete,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_" + "2".repeat(32),
    STRIPE_SECRET_KEY: "sk_live_" + "3".repeat(32),
  });
  assert.equal(result.checks.stripeTestConfigured, false);
  assert.ok(result.blockers.includes("STRIPE_TEST_CONFIGURATION_MISSING"));
});

test("malformed Upstash URL fails durable storage validation", () => {
  const result = inspectDeploymentEnvironment({ ...complete, UPSTASH_REDIS_REST_URL: "http://example.invalid" });
  assert.equal(result.checks.durableStorageConfigured, false);
  assert.ok(result.blockers.includes("DURABLE_STORAGE_CONFIGURATION_MISSING"));
});
