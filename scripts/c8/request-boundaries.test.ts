import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedBodyBytes, readBoundedJsonBody } from '../../lib/security/payment-webhook-guard';
import { POST as recover, PUT as resetPassword } from '../../app/api/auth/recovery/route';
import { POST as emailChange } from '../../app/api/auth/email-change/route';
import { POST as session } from '../../app/api/auth/session/route';
import { POST as google } from '../../app/api/auth/oauth/google/route';

const encoder = new TextEncoder();
let ip = 10;
function json(raw: string, method = 'POST') {
  return new Request('http://localhost:3000/api/auth/session', {
    method, headers: { 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${ip++}` }, body: raw,
  });
}
function streamed(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream,
    duplex: 'half', signal,
  } as RequestInit & { duplex: 'half' });
}
async function status(promise: ReturnType<typeof readBoundedBodyBytes>) {
  const result = await promise;
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected refusal');
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
  return result.response.status;
}
async function within<T>(promise: Promise<T>, ms = 1200): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('response exceeded test watchdog')), ms);
  })]); } finally { if (timer) clearTimeout(timer); }
}

test('shared body reader preserves exact UTF-8 bytes and declared length', async () => {
  const raw = '{"text":"Zażółć gęślą jaźń","n":-0.25e2}';
  const bytes = encoder.encode(raw);
  const request = new Request('http://localhost:3000/api/test', { method: 'POST', body: bytes,
    headers: { 'content-type': 'application/json', 'content-length': String(bytes.length) } });
  const result = await readBoundedBodyBytes(request, bytes.length);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.bytes, bytes);
});
test('stream above cap refuses without waiting for a never-settling producer cancellation', async () => {
  let cancelled = 0;
  const request = streamed(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(33)); },
    cancel() { cancelled++; return new Promise<void>(() => {}); } }));
  assert.equal(await within(status(readBoundedBodyBytes(request, 32))), 413);
  assert.equal(cancelled, 1);
});
test('stalled body gets total deadline even if cancellation never resolves', async () => {
  let cancelled = 0;
  const request = streamed(new ReadableStream({ cancel() { cancelled++; return new Promise<void>(() => {}); } }));
  assert.equal(await within(status(readBoundedBodyBytes(request, 32, { maxDurationMs: 30 }))), 408);
  assert.equal(cancelled, 1);
});
test('aborted request is rejected before reading queued bytes', async () => {
  const abort = new AbortController(); abort.abort();
  assert.equal(await status(readBoundedBodyBytes(streamed(new ReadableStream({ start(c) { c.enqueue(encoder.encode('{}')); c.close(); } }), abort.signal), 32)), 400);
});
test('abort during stalled body releases the caller before default timeout', async () => {
  const abort = new AbortController();
  const request = streamed(new ReadableStream({ cancel() { return new Promise<void>(() => {}); } }), abort.signal);
  const result = readBoundedBodyBytes(request, 32);
  setTimeout(() => abort.abort(), 15);
  assert.equal(await within(status(result)), 400);
});
test('synchronous empty-chunk producer cannot starve the body-read deadline', async () => {
  let chunks = 0;
  const request = streamed(new ReadableStream({ pull(c) {
    const stop = performance.now() + 3;
    while (performance.now() < stop) { /* controlled event-loop starvation */ }
    chunks++; c.enqueue(new Uint8Array(0));
  } }));
  assert.equal(await within(status(readBoundedBodyBytes(request, 32, { maxDurationMs: 25 }))), 408);
  assert.ok(chunks > 0);
});
test('snapshot prevents later mutation of a delivered chunk from changing signed bytes', async () => {
  const chunk = new Uint8Array([65]); let step = 0;
  const request = streamed(new ReadableStream({ pull(c) {
    if (step++ === 0) c.enqueue(chunk);
    else { chunk[0] = 66; c.close(); }
  } }, { highWaterMark: 0 }));
  const result = await readBoundedBodyBytes(request, 32);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual([...result.bytes], [65]);
});
test('one-byte chunks remain byte-exact across buffer growth', async () => {
  let remaining = 17000;
  const request = streamed(new ReadableStream({ pull(c) { if (remaining--) c.enqueue(new Uint8Array([90])); else c.close(); } }, { highWaterMark: 0 }));
  const result = await readBoundedBodyBytes(request, 17000);
  assert.ok(result.ok);
  if (result.ok) { assert.equal(result.byteLength, 17000); assert.ok(result.bytes.every(x => x === 90)); }
});
test('locked input stream returns controlled bad request', async () => {
  const request = json('{}'); const held = request.body!.getReader();
  try { assert.equal(await status(readBoundedBodyBytes(request, 32)), 400); } finally { held.releaseLock(); }
});
test('declared length mismatch remains rejected', async () => {
  const request = new Request('http://localhost:3000/api/test', { method: 'POST', body: '{}', headers: { 'content-length': '3' } });
  assert.equal(await status(readBoundedBodyBytes(request, 32)), 400);
});
test('overflowing numeric JSON never reaches callers as Infinity', async () => {
  for (const raw of ['{"n":1e999}', '{"n":-1e999}', '{"nested":[1,{"n":1e999}]}']) {
    const result = await readBoundedJsonBody(json(raw), 1024);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 400);
  }
});
test('finite exponent numbers remain accepted', async () => {
  const result = await readBoundedJsonBody<{ n: number }>(json('{"n":1e3}'), 1024);
  assert.ok(result.ok); if (result.ok) assert.equal(result.value.n, 1000);
});
test('duplicate, prototype and excessive-depth keys still fail closed', async () => {
  for (const raw of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"__proto__":{}}', '{"a":{"b":{"c":1}}}']) {
    const result = await readBoundedJsonBody(json(raw), 1024, { maxDepth: 2 });
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.response.status, 400);
  }
});
test('invalid UTF-8 still fails closed rather than replacement-character parsing', async () => {
  const req = streamed(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([123,34,120,34,58,34,255,34,125])); c.close(); } }));
  const result = await readBoundedJsonBody(req, 1024); assert.equal(result.ok, false);
});
test('invalid server-side read budgets are rejected rather than disabling bounds', async () => {
  await assert.rejects(() => readBoundedBodyBytes(json('{}'), NaN), RangeError);
  await assert.rejects(() => readBoundedBodyBytes(json('{}'), 32, { maxDurationMs: Infinity }), RangeError);
});

const invalidAuthCases: [string, (r: Request) => Promise<Response>, object, string][] = [
  ['session numeric email', session, { email: 42, password: 'Not-A-Real-Password' }, 'POST'],
  ['session object password', session, { email: 'nobody@example.invalid', password: {} }, 'POST'],
  ['session boolean displayName', session, { displayName: false }, 'POST'],
  ['recovery numeric email', recover, { email: 42 }, 'POST'],
  ['recovery array locale', recover, { email: 'nobody@example.invalid', locale: [] }, 'POST'],
  ['password reset array credential', resetPassword, { password: ['0123456789'] }, 'PUT'],
  ['password reset object credential', resetPassword, { password: {} }, 'PUT'],
  ['email change numeric email', emailChange, { email: 42 }, 'POST'],
  ['email change null locale', emailChange, { email: 'nobody@example.invalid', locale: null }, 'POST'],
  ['Google OAuth object return path', google, { returnPath: {} }, 'POST'],
  ['Google OAuth numeric locale', google, { locale: 42 }, 'POST'],
];
for (const [name, route, payload, method] of invalidAuthCases) test(`actual ${name}: 400 before external Auth/cookie side effects`, async () => {
  const response = await route(json(JSON.stringify(payload), method));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_body_field_type');
  assert.equal(response.headers.get('set-cookie'), null);
});
test('actual recovery still validates empty optional email without throwing', async () => {
  const response = await recover(json('{}')); assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_RECOVERY_INPUT');
});
