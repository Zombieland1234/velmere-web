import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { inspectApiEdgeRequest } from '../../lib/security/api-edge-boundary';

// Exercise the installed NextRequest implementation, not a substitute URL parser.
const env = { NODE_ENV: 'production', VERCEL: '0', VELMERE_CANONICAL_ORIGIN: 'http://localhost:3200', VELMERE_ALLOWED_ORIGINS: 'http://localhost:3100,http://localhost:3101' } as NodeJS.ProcessEnv;
test('Next loopback normalization reproduces the rejected IP-host test setup', () => {
 const request = new NextRequest('http://127.0.0.1:3100/api/audit/report', { headers: { host: '127.0.0.1:3100' } });
 assert.equal(request.nextUrl.hostname, 'localhost');
 const verdict = inspectApiEdgeRequest(request, { ...env, VELMERE_CANONICAL_ORIGIN: 'http://127.0.0.1:3200', VELMERE_ALLOWED_ORIGINS: 'http://127.0.0.1:3100' });
 assert.equal(verdict.ok, false);
});
test('exact configured localhost backend passes without weakening host allowlists', () => {
 for (const port of [3100, 3101]) {
  const verdict = inspectApiEdgeRequest(new NextRequest(`http://localhost:${port}/api/audit/report`, { headers: {host:`localhost:${port}`} }), env);
  assert.equal(verdict.ok, true);
 }
});
test('foreign host, conflicting host and forged forwarded origin remain rejected', () => {
 for (const [url, headers] of [
  ['https://attacker.invalid/api/audit/report', {host:'attacker.invalid'}],
  ['http://localhost:3100/api/audit/report', {host:'attacker.invalid'}],
  ['http://localhost:3100/api/audit/report', {host:'localhost:3100','x-forwarded-host':'attacker.invalid'}],
 ] as [string,Record<string,string>][]) assert.equal(inspectApiEdgeRequest(new NextRequest(url, {headers}), env).ok, false);
});
