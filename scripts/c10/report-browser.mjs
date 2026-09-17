import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const out=process.argv[2];if(!out)throw new Error('output directory required');fs.mkdirSync(out,{recursive:true});
const origin='http://localhost:3000',address='0xdac17f958d2ee523a2206206994597c13d831ec7',rows=[];
const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce'});
  for(const locale of ['en','pl','de'])for(const tier of ['basic','pro','advanced']){
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const url=`${origin}/${locale}/security/audits/report/${address}?chainId=1&tier=${tier}`;
   const row={sourceSha:process.env.GITHUB_SHA,scope:'ACTUAL_NEXT_SSR_ANONYMOUS_REFERENCE_NOT_PAID_USER_E2E',url,locale,tier,viewport:viewport.name,startedAt:new Date().toISOString(),errors};
   try{
    const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});row.status=res?.status();await page.waitForTimeout(400);
    row.reportViews=await page.locator('.audit-canonical-view').count();
    const text=await page.locator('body').innerText();row.bodySha256=createHash('sha256').update(text).digest('hex');
    if(tier==='basic'){
      assert.equal(row.reportViews,1);assert.doesNotMatch(text,/CANONICAL AUDIT CERTIFICATE|KANONICZNY CERTYFIKAT AUDYTU|KANONISCHES AUDIT-ZERTIFIKAT|Verified & Cryptographically Sealed/);
      row.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(row.horizontalOverflow,false);
      const file=`SSR-${locale}-${viewport.name}.png`;await page.screenshot({path:path.join(out,file)});row.screenshot=file;
    }else assert.equal(row.reportViews,0,'query tier must not grant paid report SSR access');
    assert.equal(errors.length,0);row.result='PASS';
   }catch(e){row.result='FAIL';row.error=String(e.message).slice(0,700);process.exitCode=1;}
   rows.push(row);await page.close();
  }
  await context.close();
 }
 // One low-rate read-only live acquisition attempt through the built public endpoint.
 const context=await browser.newContext();const url=`${origin}/api/audit/report?address=${address}&chainId=1&analysisMode=runtime&tier=basic`;
 const live={sourceSha:process.env.GITHUB_SHA,scope:'ACTUAL_HTTP_ONE_PUBLIC_RPC_READ_ATTEMPT_NOT_PAYMENT',url,at:new Date().toISOString()};
 try{const res=await context.request.get(url,{timeout:20000});const body=await res.json();live.http=res.status();live.analysis=body.report?.runtimeAnalysis??null;live.verdict=body.report?.verdict??null;live.result=live.analysis?.status==='STATIC_ANALYSIS_COMPLETED'?'OBSERVED_STATIC_ANALYSIS':'ACQUISITION_NOT_CONFIRMED';}
 catch(e){live.result='ERROR';live.error=String(e.message).slice(0,400);}
 fs.writeFileSync(path.join(out,'LIVE_RUNTIME_REPORT.json'),JSON.stringify(live,null,2));await context.close();
}finally{await browser.close();fs.writeFileSync(path.join(out,'SSR_REPORT_OBSERVATIONS.json'),JSON.stringify({rows},null,2));console.log(JSON.stringify({visits:rows.length,failures:rows.filter(r=>r.result!=='PASS').length}));}
