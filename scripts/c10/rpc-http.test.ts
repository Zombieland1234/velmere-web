import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { acquireAuditRuntimeSnapshot, auditRuntimeAcquisitionDependencies } from '../../lib/security/audit-runtime-snapshot';
const target='0x9300700000000000000000000000000000000010';

test('actual HTTP gzip RPC is accepted using decoded-size cap rather than compressed Content-Length equality',async t=>{
  const calls: string[]=[];const hash='0x'+'ab'.repeat(32);
  const server=createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));calls.push(input.method);
    const results:Record<string,unknown>={eth_chainId:'0x1',eth_getBlockByNumber:{number:'0x123',hash,timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)},eth_getCode:'0x600060005500'};
    const payload=gzipSync(JSON.stringify({jsonrpc:'2.0',id:input.id,result:results[input.method]}));
    res.writeHead(200,{'content-type':'application/json','content-encoding':'gzip','content-length':payload.length});res.end(payload);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const address=server.address();assert.ok(address&&typeof address==='object');
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',(_url:Parameters<typeof fetch>[0],init?:RequestInit)=>fetch(`http://127.0.0.1:${address.port}`,init));
  const r=await acquireAuditRuntimeSnapshot(target,'1');assert.ok(r.ok);if(r.ok)assert.equal(r.snapshot.blockHash,hash);
  assert.deepEqual(calls,['eth_chainId','eth_getBlockByNumber','eth_getCode']);
});
test('compressed large decoded body cannot bypass the streaming response-size cap',async t=>{
  const payload=gzipSync('x'.repeat(200000));assert.ok(payload.length<128*1024);
  const server=createServer((_req,res)=>{res.writeHead(200,{'content-encoding':'gzip','content-length':payload.length});res.end(payload);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const address=server.address();assert.ok(address&&typeof address==='object');
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',(_url:Parameters<typeof fetch>[0],init?:RequestInit)=>fetch(`http://127.0.0.1:${address.port}`,init));
  const r=await acquireAuditRuntimeSnapshot(target,'1');assert.equal(r.ok,false);if(!r.ok)assert.equal(r.error,'rpc_response_too_large');
});
