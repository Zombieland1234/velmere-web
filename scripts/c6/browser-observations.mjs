import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const base=process.argv[2],out=process.argv[3];
if(!base||!out)throw new Error('Usage: browser-observations.mjs origin output-dir');
const origin=new URL(base).origin;
if(!['https://velmere-web.vercel.app','http://127.0.0.1:3000','http://localhost:3000'].includes(origin))throw new Error('Unapproved browser target');
fs.mkdirSync(out,{recursive:true});
const safeUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return '[invalid-url]';}};
const rows=[];const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
 for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'en-US',reducedMotion:'reduce'});
  for(const route of ['/en','/en/login','/en/security','/en/security/audits','/en/browser','/en/shield-map','/en/shield','/en/shield-pro','/en/real-markets','/en/search','/en/account']){
   const page=await context.newPage();const consoleErrors=[],runtimeErrors=[],requestFailures=[],httpErrors=[];
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,300));});
   page.on('pageerror',e=>runtimeErrors.push(e.message.slice(0,300)));
   page.on('requestfailed',r=>requestFailures.push({url:safeUrl(r.url()),error:r.failure()?.errorText}));
   page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:safeUrl(r.url()),status:r.status()});});
   const entry={sourceSha:process.env.C6_SOURCE_SHA||null,environment:origin,route,viewport:viewport.name,startedAt:new Date().toISOString(),consoleErrors,runtimeErrors,requestFailures,httpErrors};
   try{
    const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:25000});entry.status=response?.status();
    await page.waitForTimeout(900);entry.title=await page.title();entry.url=safeUrl(page.url());
    entry.layout=await page.evaluate(()=>({viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyText:document.body.innerText.slice(0,1600),hasMain:!!document.querySelector('main'),interactiveCount:document.querySelectorAll('button,a,input,select,textarea').length}));
    const file=viewport.name+'-'+route.replaceAll('/','_')+'.png';await page.screenshot({path:path.join(out,file),fullPage:false});
    entry.screenshot=file;entry.screenshotSha256=createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex');
   }catch(e){entry.navigationError=String(e.message).slice(0,400);}
   entry.finishedAt=new Date().toISOString();rows.push(entry);await page.close();
   fs.writeFileSync(path.join(out,'BROWSER_OBSERVATIONS.json'),JSON.stringify({scope:'REAL_ANONYMOUS_PAGES_NOT_PAID_PRODUCT_E2E',rows},null,2));
  }
  await context.close();
 }
 const context=await browser.newContext();const api=[];
 for(const route of ['/api/auth/session','/api/products/catalog','/api/ops/readiness','/api/audit/report-pdf','/api/account/customer-artifact','/api/checkout/stripe-analysis']){
  const e={route,at:new Date().toISOString(),origin,sourceSha:process.env.C6_SOURCE_SHA||null};
  try{const r=await context.request.get(origin+route,{timeout:15000,maxRedirects:0});e.status=r.status();e.contentType=r.headers()['content-type'];e.cacheControl=r.headers()['cache-control'];const text=await r.text();e.bodyDigest=createHash('sha256').update(text).digest('hex');if(e.status>=400)e.errorBody=text.slice(0,1200);}catch(x){e.error=String(x.message).slice(0,300);}api.push(e);
 }
 fs.writeFileSync(path.join(out,'HTTP_OBSERVATIONS.json'),JSON.stringify({scope:'ACTUAL_HTTP_READ_ONLY',rows:api},null,2));await context.close();
 console.log(JSON.stringify({origin,pageVisits:rows.length,navigationFailures:rows.filter(x=>x.navigationError).length,runtimeErrorPages:rows.filter(x=>x.runtimeErrors.length).length,horizontalOverflowPages:rows.filter(x=>x.layout&&x.layout.documentWidth>x.layout.viewportWidth+1).length,http:api.map(x=>({route:x.route,status:x.status}))}));
}finally{await browser.close();}
