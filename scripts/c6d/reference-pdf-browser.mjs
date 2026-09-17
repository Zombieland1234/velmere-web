import{chromium}from'playwright';import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const base='http://localhost:3000',out=process.argv[2];if(!out)throw new Error('output directory required');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();const rows=[];
try{
 const route='/api/audit/report-pdf?assetId=ast_evm_01_usdt&tier=basic&locale=en';const startedAt=new Date().toISOString();
 await page.goto(base+'/en/security/audits',{waitUntil:'domcontentloaded',timeout:25000});
 // Explicit direct endpoint access in the real browser. This is NOT a paid UI checkout.
 const pending=page.waitForEvent('download',{timeout:25000});await page.evaluate(url=>{window.location.assign(url);},base+route);const download=await pending;await download.saveAs(path.join(out,'REFERENCE_PROFILE_BASIC.pdf'));
 const bytes=fs.readFileSync(path.join(out,'REFERENCE_PROFILE_BASIC.pdf'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 rows.push({id:'browser-basic-reference-download',sourceSha:process.env.C6_SOURCE_SHA,origin:base,route,startedAt,finishedAt:new Date().toISOString(),scope:'ACTUAL_BROWSER_ENDPOINT_DOWNLOAD_REFERENCE_PROFILE_NOT_CURRENT_CHAIN_AUDIT',result:'PASS',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 for(const tier of['basic','pro','advanced']){
  const route=`/api/audit/report-pdf?assetId=ast_evm_01_usdt&tier=${tier}&locale=en`,r=await context.request.get(base+route,{timeout:20000}),b=await r.body();
  const row={id:`http-${tier}-reference-export`,sourceSha:process.env.C6_SOURCE_SHA,origin:base,route,status:r.status(),at:new Date().toISOString(),sha256:createHash('sha256').update(b).digest('hex'),sourceMode:r.headers()['x-velmere-audit-source-mode'],scope:'ACTUAL_HTTP_ANONYMOUS_REFERENCE_PROFILE_NOT_STRIPE_E2E'};
  assert.equal(r.status(),tier==='basic'?200:401);
  if(tier==='basic'){assert.equal(r.headers()['x-velmere-audit-pdf-digest']?.replace(/^sha256:/,''),row.sha256);assert.match(r.headers()['cache-control'],/no-store/);assert.equal(row.sourceMode,'reference-profile');}else assert.equal((await r.json()).error,'current_audit_entitlement_required');
  row.result='PASS';rows.push(row);
 }
}catch(e){rows.push({id:'reference-pdf-browser-failure',sourceSha:process.env.C6_SOURCE_SHA,result:'FAIL',error:String(e.message).slice(0,1000)});process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'REFERENCE_PDF_BROWSER.json'),JSON.stringify({rows},null,2));console.log(JSON.stringify(rows));}
