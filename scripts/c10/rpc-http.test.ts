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

// Regression from the rendered C10 PDF: 64-hex block hashes were mistaken for
// private addresses and silently filtered out, despite being in the model.
import { isCustomerSafeProAuditPdfLine, planCustomerSafePdf } from '../../lib/security/pro-audit-pdf/customer-safe-renderer';
import { canonicalReportToPdfLines } from '../../lib/security/audit-canonical-report';
import { buildCustomerAuditReport } from '../../lib/security/customer-audit-pipeline';

test('typed public block receipt survives the actual PDF sanitizer and render plan', async t => {
  const blockHash='0x'+'ab'.repeat(32);
  t.mock.method(auditRuntimeAcquisitionDependencies,'fetch',async (_url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    const r=JSON.parse(String(init?.body));
    const results:Record<string,unknown>={eth_chainId:'0x1',eth_getBlockByNumber:{number:'0x123',hash:blockHash,timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)},eth_getCode:'0x600060005500'};
    return Response.json({jsonrpc:'2.0',id:r.id,result:results[r.method]});
  });
  const report=await buildCustomerAuditReport({reportId:'c10-pdf-receipt',contractAddress:target,contractName:'C10 receipt fixture',chainId:'1',analysisMode:'runtime'},'basic');
  assert.equal(report.runtimeAnalysis?.status,'STATIC_ANALYSIS_COMPLETED');
  const line=`RPC-asserted block: 0x123 | ${blockHash}; independentlyVerified=false`;
  const lines=canonicalReportToPdfLines(report);assert.ok(lines.includes(line));
  assert.equal(isCustomerSafeProAuditPdfLine(line),true);
  const plan=planCustomerSafePdf(lines,{});
  const rendered=plan.pages.flatMap(p=>p.rows.map(r=>r.text)).join(' ');
  assert.ok(rendered.includes(blockHash));assert.ok(rendered.includes('independentlyVerified=false'));
});
test('public block exception does not authorize private addresses, tokens or appended text',()=>{
  const hash='0x'+'ab'.repeat(32);
  for(const line of [`RPC-asserted block: 0x123 | ${hash}; independentlyVerified=true`,
    `RPC-asserted block: 0x123 | ${hash}; independentlyVerified=false api key: secret`,
    `RPC-asserted block: 0x01 | ${hash}; independentlyVerified=false`,
    `RPC-asserted block: 0x123 | 0x${'a'.repeat(40)}; independentlyVerified=false`,
    `Unapproved destination: 0x${'a'.repeat(40)}`,`Block: 0x123 | ${hash}`]) {
    assert.equal(isCustomerSafeProAuditPdfLine(line),false,line);
  }
});
