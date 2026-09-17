import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Exercise the actual CLI in fresh processes: no shared process.env or module cache.
// These are configuration-shape tests. They do not open a Redis connection,
// authenticate a Vercel deployment, or provision production credentials.
const proxyKey = randomBytes(32).toString('hex');
const fingerprintKey = randomBytes(32).toString('hex');
const storeToken = randomBytes(32).toString('hex');
const signed: NodeJS.ProcessEnv = {
  VELMERE_TRUSTED_PROXY_PROFILE: 'signed_proxy',
  VELMERE_PROXY_HMAC_SECRET: proxyKey,
  VELMERE_PROXY_HMAC_AUDIENCE: 'c13-isolated-fixture',
  VELMERE_SECURITY_FINGERPRINT_SECRET: fingerprintKey,
  VELMERE_RATE_LIMIT_BACKEND: 'redis',
  REDIS_URL: `redis://:${storeToken}@127.0.0.1:6379/0`,
};
const vercel: NodeJS.ProcessEnv = {
  VELMERE_TRUSTED_PROXY_PROFILE: 'vercel', VERCEL: '1', VERCEL_ENV: 'preview',
  VELMERE_SECURITY_FINGERPRINT_SECRET: fingerprintKey,
  UPSTASH_REDIS_REST_URL: 'https://c13-fixture.invalid',
  UPSTASH_REDIS_REST_TOKEN: storeToken,
};
const proxy = 'TRUSTED_PROXY_CONFIGURATION_MISSING';
const privacy = 'FINGERPRINT_SECRET_MISSING_OR_WEAK';
const storage = 'DURABLE_STORAGE_CONFIGURATION_MISSING';
type Case = { id: string; env: NodeJS.ProcessEnv; blockers: string[]; mode: string };
const cases: Case[] = [
  { id: 'unconfigured-production-refuses', env: {}, blockers: [proxy, privacy, storage], mode: 'unavailable' },
  { id: 'signed-loopback-configuration-only', env: signed, blockers: [], mode: 'redis' },
  { id: 'signed-tls-configuration-only', env: { ...signed, REDIS_URL: `rediss://:${storeToken}@c13-fixture.invalid:6380/1` }, blockers: [], mode: 'redis' },
  { id: 'missing-proxy-key-refuses', env: { ...signed, VELMERE_PROXY_HMAC_SECRET: '' }, blockers: [proxy], mode: 'redis' },
  { id: 'repeated-proxy-key-refuses', env: { ...signed, VELMERE_PROXY_HMAC_SECRET: '1'.repeat(64) }, blockers: [proxy], mode: 'redis' },
  { id: 'missing-proxy-audience-refuses', env: { ...signed, VELMERE_PROXY_HMAC_AUDIENCE: '' }, blockers: [proxy], mode: 'redis' },
  { id: 'short-fingerprint-key-refuses', env: { ...signed, VELMERE_SECURITY_FINGERPRINT_SECRET: 'fixture' }, blockers: [privacy], mode: 'redis' },
  { id: 'missing-fingerprint-key-refuses', env: { ...signed, VELMERE_SECURITY_FINGERPRINT_SECRET: '' }, blockers: [privacy], mode: 'redis' },
  { id: 'missing-durable-url-refuses', env: { ...signed, REDIS_URL: '' }, blockers: [storage], mode: 'unavailable' },
  { id: 'unselected-redis-backend-refuses', env: { ...signed, VELMERE_RATE_LIMIT_BACKEND: '' }, blockers: [storage], mode: 'unavailable' },
  { id: 'remote-plaintext-redis-refuses', env: { ...signed, REDIS_URL: 'redis://c13-fixture.invalid:6379' }, blockers: [storage], mode: 'unavailable' },
  { id: 'redis-query-parameters-refuse', env: { ...signed, REDIS_URL: 'redis://127.0.0.1:6379?fixture=1' }, blockers: [storage], mode: 'unavailable' },
  { id: 'disabled-production-limiter-refuses', env: { ...signed, VELMERE_RATE_LIMIT_DISABLED: '1' }, blockers: [storage], mode: 'unavailable' },
  { id: 'vercel-upstash-configuration-only', env: vercel, blockers: [], mode: 'upstash_rest' },
  { id: 'missing-vercel-runtime-marker-refuses', env: { ...vercel, VERCEL: '' }, blockers: [proxy], mode: 'upstash_rest' },
  { id: 'unknown-vercel-environment-refuses', env: { ...vercel, VERCEL_ENV: 'not-a-deployment' }, blockers: [proxy], mode: 'upstash_rest' },
  { id: 'plaintext-upstash-refuses', env: { ...vercel, UPSTASH_REDIS_REST_URL: 'http://c13-fixture.invalid' }, blockers: [storage], mode: 'unavailable' },
  { id: 'missing-upstash-token-refuses', env: { ...vercel, UPSTASH_REDIS_REST_TOKEN: '' }, blockers: [storage], mode: 'unavailable' },
];
const results: { id: string; passed: boolean; exitCode: number | null; expectedExitCode: number; diagnostic: unknown }[] = [];
for (const fixture of cases) {
  test(`production preflight: ${fixture.id}`, () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...fixture.env };
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'CI', 'GITHUB_SHA']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const child = spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts/c12/config-preflight.ts')], {
      cwd: process.cwd(), env, encoding: 'utf8', timeout: 15_000, maxBuffer: 128 * 1024,
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null, 'CLI must exit normally, not be killed');
    const output = child.stdout + child.stderr;
    for (const secret of [proxyKey, fingerprintKey, storeToken]) assert.equal(output.includes(secret), false, 'CLI leaked a test credential');
    const diagnostic: unknown = JSON.parse(child.stdout);
    assert.ok(diagnostic && typeof diagnostic === 'object' && !Array.isArray(diagnostic));
    const d = diagnostic as Record<string, unknown>;
    const expectedExitCode = fixture.blockers.length ? 1 : 0;
    const row = { id: fixture.id, passed: false, exitCode: child.status, expectedExitCode, diagnostic };
    results.push(row);
    assert.equal(child.status, expectedExitCode);
    assert.deepEqual(d.blockers, fixture.blockers);
    assert.equal(d.configurationReady, fixture.blockers.length === 0);
    assert.equal(d.storageMode, fixture.mode);
    assert.equal(d.productionLike, true);
    assert.equal(d.connectivityVerified, false, 'Configuration shape must never assert real connectivity');
    assert.equal(d.sourceSha, process.env.GITHUB_SHA ?? null);
    assert.equal(d.trustedProxyConfigured, !fixture.blockers.includes(proxy));
    assert.equal(d.privacySecretConfigured, !fixture.blockers.includes(privacy));
    row.passed = true;
  });
}
after(() => {
  const out = process.env.C13_CONFIG_EVIDENCE_DIR;
  if (!out) return;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'CONFIG_PREFLIGHT_MATRIX.json'), JSON.stringify({
    sourceSha: process.env.GITHUB_SHA ?? null,
    scope: 'ACTUAL_CLI_SYNTHETIC_ENV_NO_NETWORK_NO_HOSTED_CONFIGURATION_CLAIM',
    expectedCases: cases.length, recordedCases: results.length, cases: results,
  }, null, 2));
});
