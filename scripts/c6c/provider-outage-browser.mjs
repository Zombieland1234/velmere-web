import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const origin='http://localhost:3000',out=process.argv[2];if(!out)throw new Error('output directory required');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});const rows=[];
try{
 for(const scenario of ['provider-outage','unbound-live-payload']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'});
  await context.addInitScript(()=>sessionStorage.setItem('velmere_shield_rows_cache',JSON.stringify([{id:'C6C_POISON',symbol:'C6C_POISON',name:'C6C_POISON',price:123456789,sparkline7d:[1,2],result:{score:1,confidence:.99,dataQuality:'live'}}])));
  await context.route('**/api/market-integrity/markets?*',route=>route.fulfill({status:scenario==='provider-outage'?503:200,contentType:'application/json',body:JSON.stringify(scenario==='provider-outage'?{mode:'error',rows:[],error:'CONTROLLED_PROVIDER_OUTAGE'}:{mode:'live',source:'UNTRUSTED_TEST_PAYLOAD',rows:[{id:'c6c-unbound',symbol:'C6C_UNBOUND',name:'C6C_UNBOUND',price:123456789,sparkline7d:[1,2],result:{score:1,confidence:.99,dataQuality:'live'}}]})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const r={id:scenario,sourceSha:process.env.C6_SOURCE_SHA,origin,scope:'ACTUAL_UI_WITH_EXPLICIT_FAULT_INJECTION_NOT_PROVIDER_E2E',startedAt:new Date().toISOString(),errors};
  try{
   await page.goto(origin+'/en/shield',{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>document.querySelector('[data-velmere-critical-loading]')?.getAttribute('data-velmere-critical-loading')==='false',null,{timeout:12000});
   const text=await page.locator('body').innerText();r.feedMode=await page.locator('[data-pass4597-market-feed]').getAttribute('data-pass4597-market-feed');
   assert.equal(text.includes('C6C_POISON'),false);assert.equal(text.includes('C6C_UNBOUND'),false);assert.equal(text.includes('LIVE · VERIFIED'),false);assert.equal(errors.length,0);
   r.screenshot=scenario+'.png';await page.screenshot({path:path.join(out,r.screenshot),fullPage:false});r.screenshotSha256=createHash('sha256').update(fs.readFileSync(path.join(out,r.screenshot))).digest('hex');r.result='PASS';
  }catch(e){r.result='FAIL';r.error=String(e.message).slice(0,800);}
  r.finishedAt=new Date().toISOString();rows.push(r);await context.close();
 }
}finally{await browser.close();fs.writeFileSync(path.join(out,'CONTROLLED_FAILURES.json'),JSON.stringify({rows},null,2));}
console.log(JSON.stringify(rows.map(r=>({id:r.id,result:r.result,feedMode:r.feedMode}))));if(rows.some(r=>r.result!=='PASS'))process.exitCode=1;
