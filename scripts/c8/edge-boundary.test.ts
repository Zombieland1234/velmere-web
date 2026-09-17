import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { guardWorkspaceRequest } from '../../supabase/functions/r7-shield-pro-paid-workspace-v1/request-boundary';

// Actual recovered handler with only Deno.serve and external SDK substituted.
// This is not a real signed-user Auth or database E2E.
const candidate = readFileSync('supabase/functions/r7-shield-pro-paid-workspace-v1/index.ts', 'utf8');
const baseline = candidate
  .replace('import { guardWorkspaceRequest } from "./request-boundary.ts";\n', '')
  .replace('const handleWorkspaceRequest = async(req:Request)=>{', 'Deno.serve(async(req:Request)=>{')
  .replace('};\nDeno.serve((req: Request) => guardWorkspaceRequest(req, handleWorkspaceRequest));\n', '});\n');
const captureMeta = JSON.parse(readFileSync('supabase/functions/r7-shield-pro-paid-workspace-v1/SOURCE_CAPTURE.json', 'utf8'));
assert.equal(createHash('sha256').update(baseline).digest('hex'), captureMeta.originalFileSha256);
type Handler = (r: Request) => Promise<Response>;
function capture(source: string, rpcData?: object, rejectUser = false) {
  let handler: Handler | undefined; let calls = 0;
  const runtime = { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.invalid' : 'publishable_fixture' }, serve: (callback: Handler) => { handler = callback; } };
  const createClient = () => ({ auth: { getUser: async () => { calls++; return { error: rejectUser ? {} : null, data: { user: rejectUser ? null : { id: 'synthetic-A' } } }; } }, rpc: async () => { calls++; return { error: null, data: rpcData ?? { resolution: 'NOT_FOUND' } }; } });
  const script = ts.transpileModule(source.replace(/^import .*;\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('Deno', 'createClient', 'guardWorkspaceRequest', script)(runtime, createClient, guardWorkspaceRequest);
  assert.ok(handler);
  return { handler, calls: () => calls };
}
const valid = { schemaVersion: 'velmere.r7.shield-pro-paid-workspace-request.v1', tier: 'pro', locale: 'en', operation: 'READ', workspaceId: '10000000-0000-4000-8000-000000000001' };
function req(body: string, extra: HeadersInit = {}) {
  return new Request('https://example.invalid/functions/v1/r7-shield-pro-paid-workspace-v1', { method: 'POST', body, headers: { 'content-type': 'application/json', ...extra } });
}
function stream(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request('https://example.invalid/functions/v1/r7-shield-pro-paid-workspace-v1', { method: 'POST', body, signal, headers: { 'content-type': 'application/json' }, duplex: 'half' } as RequestInit & { duplex: 'half' });
}
async function bounded(p: Promise<Response>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('watchdog')), 1500); })]); }
  finally { if (timeout) clearTimeout(timeout); }
}
test('live-handler source reproduces original null crash and candidate returns controlled 400', async () => {
  const old = capture(baseline); await assert.rejects(() => old.handler(req('null')), TypeError); assert.equal(old.calls(), 0);
  const fixed = capture(candidate); const r = await fixed.handler(req('null'));
  assert.equal(r.status, 400); assert.equal(fixed.calls(), 0); assert.equal((await r.json()).error, 'request_shape_invalid');
});
test('wrong credential-independent field types never call Auth or RPC', async () => {
  for (const change of [{ tier: ['pro'] }, { locale: 42 }, { operation: {} }, { workspaceId: [] }]) {
    const h = capture(candidate); const r = await h.handler(req(JSON.stringify({ ...valid, ...change })));
    assert.equal(r.status, 400); assert.equal(h.calls(), 0);
  }
});
test('valid request without bearer remains 401 and does not query database', async () => {
  const h = capture(candidate); const r = await h.handler(req(JSON.stringify(valid)));
  assert.equal(r.status, 401); assert.equal(h.calls(), 0);
});
test('rejected Auth user never reaches workspace RPC', async () => {
  const h = capture(candidate, undefined, true);
  assert.equal((await h.handler(req(JSON.stringify(valid), { authorization: 'Bearer noncredential-fixture' }))).status, 401);
  assert.equal(h.calls(), 1);
});
test('existing schema, unsupported tier, unknown key and workspace UUID rules remain enforced', async () => {
  for (const input of [{ ...valid, tier: 'basic' }, { ...valid, operation: 'GRANT' }, { ...valid, locale: 'xx' }, { ...valid, schemaVersion: 'wrong' }, { ...valid, workspaceId: 'not-uuid' }, { ...valid, owner: 'someone-else' }]) {
    const h = capture(candidate); assert.equal((await h.handler(req(JSON.stringify(input)))).status, 400); assert.equal(h.calls(), 0);
  }
});
test('transport wrapper preserves actual READ/CREATE/RESTORE response and UI content for both tiers and three locales', async () => {
  const rpc = { resolution: 'READY', workspaceId: valid.workspaceId, payloadDigestSha256: 'sha256:' + 'a'.repeat(64), payload: { sourceClass: 'synthetic', assets: [{ assetId: 'fixture', canonicalAssetId: 'fixture', events: [{ observedAt: '2026-09-17T00:00:00Z', sourceAsOf: '2026-09-17T00:00:00Z', score: 40, confidence: 10, signalCount: 1, level: 'REVIEW', eventDigest: 'sha256:'+'b'.repeat(64), evidenceDigest:'sha256:'+'c'.repeat(64), changeReasons:[] }] }] } };
  for (const tier of ['pro', 'advanced']) for (const locale of ['pl', 'en', 'de']) for (const operation of ['READ', 'CREATE', 'RESTORE']) {
    const raw = JSON.stringify({ ...valid, tier, locale, operation });
    const before = capture(baseline, rpc), after = capture(candidate, rpc);
    const a = await before.handler(req(raw, { authorization: 'Bearer noncredential-fixture' }));
    const b = await after.handler(req(raw, { authorization: 'Bearer noncredential-fixture' }));
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(await b.json(), await a.json()); assert.equal(after.calls(), 2);
  }
});
test('existing delete and not-found responses remain unchanged with controlled adapters', async () => {
  for (const data of [{ resolution: 'DELETED', workspaceId: valid.workspaceId }, { resolution: 'NOT_FOUND' }]) {
    const raw=JSON.stringify({ ...valid, operation: 'DELETE' });
    const a=await capture(baseline,data).handler(req(raw,{authorization:'Bearer fixture'}));
    const b=await capture(candidate,data).handler(req(raw,{authorization:'Bearer fixture'}));
    assert.equal(b.status,a.status);assert.deepEqual(await b.json(),await a.json());
  }
});
test('oversized streaming body refuses without awaiting producer cancellation', async () => {
  let calls=0;
  const r=await bounded(guardWorkspaceRequest(stream(new ReadableStream({start(c){c.enqueue(new Uint8Array(4097));},cancel(){return new Promise<void>(()=>{});}})),async()=>{calls++;return Response.json({});}));
  assert.equal(r.status,413);assert.equal(calls,0);
});
test('stalled Edge body receives deadline, without downstream invocation', async () => {
  let calls=0;
  const r=await bounded(guardWorkspaceRequest(stream(new ReadableStream({cancel(){return new Promise<void>(()=>{});}})),async()=>{calls++;return Response.json({});},{maxDurationMs:30}));
  assert.equal(r.status,408);assert.equal(calls,0);
});
test('abort during an Edge read releases the caller', async () => {
  const ctrl=new AbortController();let calls=0;
  const pending=guardWorkspaceRequest(stream(new ReadableStream({}),ctrl.signal),async()=>{calls++;return Response.json({});});
  setTimeout(()=>ctrl.abort(),15);assert.equal((await bounded(pending)).status,400);assert.equal(calls,0);
});
test('invalid JSON, nonfinite numeric and non-object JSON are rejected safely', async () => {
  for (const raw of ['[]','42','"text"','{"tier":','{"x":1e999}']) {
    let calls=0;const r=await guardWorkspaceRequest(req(raw),async()=>{calls++;return Response.json({});});assert.equal(r.status,400);assert.equal(calls,0);
  }
});
test('invalid UTF8 is rejected before replacement characters can reach handler', async () => {
  let calls=0;const r=await guardWorkspaceRequest(stream(new ReadableStream({start(c){c.enqueue(new Uint8Array([123,34,120,34,58,34,255,34,125]));c.close();}})),async()=>{calls++;return Response.json({});});
  assert.equal(r.status,400);assert.equal(calls,0);
});
test('framing conflicts and wrong content type stay outside Auth', async () => {
  const cases: Record<string,string>[] = [{'content-length':'not-a-length'},{'content-length':'1'},{'content-length':'2','transfer-encoding':'chunked'},{'content-encoding':'gzip'}];
  for(const extra of cases){
    let calls=0;const r=await guardWorkspaceRequest(req('{}',extra),async()=>{calls++;return Response.json({});});assert.equal(r.status,400);assert.equal(calls,0);
  }
  assert.equal((await guardWorkspaceRequest(req('{}',{'content-type':'text/plain'}),async()=>Response.json({}))).status,415);
});
test('sole chunked framing with no declared length remains accepted and byte-exact', async () => {
  const raw=' {"locale":"pl"} ';
  const r=await guardWorkspaceRequest(req(raw,{'transfer-encoding':'chunked'}),async r=>Response.json({text:await r.text()}));
  assert.equal(r.status,200);assert.equal((await r.json()).text,raw);
});
test('downstream exception is contained without disclosing error details', async () => {
  const r=await guardWorkspaceRequest(req('{}'),async()=>{throw new Error('PRIVATE_FAILURE');});
  assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE_FAILURE/);
});
