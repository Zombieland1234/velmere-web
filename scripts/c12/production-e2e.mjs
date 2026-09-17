/** Production Next.js + actual local Redis + HMAC ingress + external public RPC.
 * No replacement of application/Auth/RPC/worker modules. No Vercel identity spoof.
 * This is ephemeral CI self-hosting, not hosted Vercel or Stripe TEST checkout.
 */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn} from 'node:child_process';import http from 'node:http';
import {createHmac,randomBytes,createHash} from 'node:crypto';
import {chromium} from 'playwright';
const out=process.argv[2]||'/tmp/c12-evidence/production-e2e';fs.mkdirSync(out,{recursive:true});
const work=fs.mkdtempSync(path.join(os.tmpdir(),'velmere-c12-'));const rows=[];const children=[];
const redisPassword=randomBytes(32).toString('hex'),proxySecret=randomBytes(32).toString('hex'),fingerprintSecret=randomBytes(32).toString('hex');
const redisConfig=path.join(work,'redis.conf');fs.writeFileSync(redisConfig,`bind 127.0.0.1\nport 16379\nprotected-mode yes\nrequirepass ${redisPassword}\ndir ${work}\nappendonly yes\nappendfsync always\nsave ""\n`,{mode:0o600});
let upstreamPort=3100;let redis;let proxy;let browser;
const env={...process.env,NODE_ENV:'production',VERCEL:'0',VERCEL_ENV:'',NEXT_TELEMETRY_DISABLED:'1',VELMERE_TRUSTED_PROXY_PROFILE:'signed_proxy',VELMERE_PROXY_HMAC_SECRET:proxySecret,VELMERE_PROXY_HMAC_AUDIENCE:'c12-loopback',VELMERE_SECURITY_FINGERPRINT_SECRET:fingerprintSecret,VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:`redis://:${redisPassword}@127.0.0.1:16379/0`,VELMERE_CANONICAL_ORIGIN:'http://127.0.0.1:3200',VELMERE_ALLOWED_ORIGINS:'http://127.0.0.1:3100,http://127.0.0.1:3101',VELMERE_LOOPBACK_HTTP_BROWSER_PROOF:'true'};
delete env.VELMERE_RATE_LIMIT_DISABLED;delete env.UPSTASH_REDIS_REST_URL;delete env.UPSTASH_REDIS_REST_TOKEN;
function launch(name,cmd,args,procEnv=env){const fd=fs.openSync(path.join(out,name+'.log'),'w');const p=spawn(cmd,args,{env:procEnv,stdio:['ignore',fd,fd]});fs.closeSync(fd);children.push(p);return p;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(p){if(!p||p.exitCode!==null)return;p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),sleep(3000)]);if(p.exitCode===null)p.kill('SIGKILL');}
async function ready(port){for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/en`,{signal:AbortSignal.timeout(1500)});await r.body?.cancel();return;}catch{await sleep(300);}}throw new Error(`server_not_ready_${port}`);}
async function record(id,fn){const r={id,sourceSha:process.env.GITHUB_SHA,startedAt:new Date().toISOString()};try{Object.assign(r,await fn());r.result='PASS';}catch(e){r.result='FAIL';r.error=String(e.message).slice(0,600);}r.finishedAt=new Date().toISOString();rows.push(r);fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify({sourceSha:process.env.GITHUB_SHA,scope:'ACTUAL_PRODUCTION_NEXT_SELFHOSTED_EPHEMERAL_REDIS_HMAC_PROXY_PUBLIC_RPC_NOT_VERCEL_OR_STRIPE',rows},null,2));console.log(id,r.result);}
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const target='0xdac17f958d2ee523a2206206994597c13d831ec7';
const query=`address=${target}&chainId=1&analysisMode=runtime&tier=basic`;
async function getJson(origin='http://127.0.0.1:3200',extra={}){const r=await fetch(`${origin}/api/audit/report?${query}`,{headers:extra,signal:AbortSignal.timeout(18000)});const body=await r.json();return{status:r.status,body};}
try{
 redis=launch('redis','redis-server',[redisConfig]);await sleep(600);
 await record('production-config-preflight',async()=>{const p=launch('configured-preflight','node_modules/.bin/tsx',['scripts/c12/config-preflight.ts']);const code=await new Promise(r=>p.once('exit',r));assert(code===0,'production_config_unready');const diagnostic=JSON.parse(fs.readFileSync(path.join(out,'configured-preflight.log'),'utf8'));return{configuration:diagnostic};});
 const app=launch('next-a','node',['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100']);await ready(3100);
 await record('missing-trusted-proxy-is-503',async()=>{const {status,body}=await getJson('http://127.0.0.1:3100',{'x-forwarded-for':'203.0.113.11','x-vercel-forwarded-for':'203.0.113.11'});assert(status===503,`unexpected_unsigned_status_${status}_${body.mode??body.error}`);return{http:status,error:body.mode??body.error};});
 await record('forged-hmac-is-503',async()=>{const {status}=await getJson('http://127.0.0.1:3100',{'x-velmere-proxy-address':'203.0.113.11','x-velmere-proxy-time':String(Date.now()),'x-velmere-proxy-signature':'0'.repeat(64)});assert(status===503,`unexpected_forged_assertion_status_${status}`);return{http:status};});
 proxy=http.createServer((request,response)=>{
  const headers={...request.headers};for(const k of Object.keys(headers))if(k.startsWith('x-velmere-proxy-')||['x-forwarded-for','x-real-ip','x-vercel-forwarded-for','x-forwarded-host','x-forwarded-proto'].includes(k))delete headers[k];
  const address=request.socket.remoteAddress??'',timestamp=String(Date.now());
  headers['x-velmere-proxy-address']=address;headers['x-velmere-proxy-time']=timestamp;
  headers['x-velmere-proxy-signature']=createHmac('sha256',Buffer.from(proxySecret,'hex')).update(`velmere-proxy-address-v1\nc12-loopback\n${timestamp}\n${address}`).digest('hex');
  // Next's request URL uses its own listener port. Both backend origins are explicitly
  // allowed in this isolated profile; never accept the caller's forwarded host.
  headers.host=`127.0.0.1:${upstreamPort}`;
  const next=http.request({hostname:'127.0.0.1',port:upstreamPort,path:request.url,method:request.method,headers},res=>{response.writeHead(res.statusCode??502,res.headers);res.pipe(response);});
  next.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'content-type':'application/json'});response.end('{"error":"test_proxy_upstream_unavailable"}');});request.pipe(next);response.on('close',()=>next.destroy());
 });await new Promise(r=>proxy.listen(3200,'127.0.0.1',r));
 // Begin a fixed window with enough budget for actual RPC and browser navigation.
 const remaining=60000-Date.now()%60000;if(remaining<48000)await sleep(remaining+100);
 await record('production-basic-json-worker-public-rpc',async()=>{const {status,body}=await getJson();fs.writeFileSync(path.join(out,'RUNTIME_JSON.json'),JSON.stringify(body,null,2));assert(status===200&&body.ok&&body.report?.runtimeAnalysis?.status==='STATIC_ANALYSIS_COMPLETED',`runtime_not_completed_http_${status}_${body.error??body.report?.runtimeAnalysis?.errorCode??body.mode}`);return{http:status,receipt:body.report.runtimeAnalysis};});
 await record('production-basic-pdf-worker-public-rpc',async()=>{const r=await fetch(`http://127.0.0.1:3200/api/audit/report-pdf?${query}`,{signal:AbortSignal.timeout(18000)});const b=Buffer.from(await r.arrayBuffer());assert(r.status===200&&b.subarray(0,5).toString()==='%PDF-',`pdf_http_${r.status}`);const hash=createHash('sha256').update(b).digest('hex');assert(r.headers.get('x-velmere-audit-pdf-digest')==='sha256:'+hash,'pdf_digest');fs.writeFileSync(path.join(out,'RUNTIME_PDF.pdf'),b);return{http:r.status,bytes:b.length,sha256:hash,analysisStatus:r.headers.get('x-velmere-analysis-status')};});
 browser=await chromium.launch({headless:true});
 for(const [name,width,height]of[['desktop',1440,1000],['mobile',390,844]])await record(`production-runtime-ssr-${name}`,async()=>{
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{const r=await page.goto(`http://127.0.0.1:3200/en/security/audits/report/${target}?chainId=1&analysisMode=runtime&tier=basic`,{waitUntil:'domcontentloaded',timeout:25000});
   const text=await page.locator('body').innerText();fs.writeFileSync(path.join(out,`RUNTIME_${name}.txt`),text);await page.screenshot({path:path.join(out,`RUNTIME_${name}.png`)});assert(r?.status()===200,`ssr_http_${r?.status()}`);assert(await page.locator('.audit-canonical-view').count()===1,'ssr_report_missing');assert(!/ANALYSIS_UNAVAILABLE/.test(text),'ssr_unavailable');assert(errors.length===0,'page_exception');return{http:r.status(),screenshot:`RUNTIME_${name}.png`,pageErrors:errors,bodySha256:createHash('sha256').update(text).digest('hex')};}finally{await page.close();}
 });
 await record('production-anonymous-pro-json-still-denied',async()=>{const r=await fetch(`http://127.0.0.1:3200/api/audit/report?${query.replace('tier=basic','tier=pro')}`,{signal:AbortSignal.timeout(10000)});await r.body?.cancel();assert(r.status===401,`unexpected_pro_status_${r.status}`);return{http:r.status};});
 await record('production-anonymous-advanced-pdf-still-denied',async()=>{const r=await fetch(`http://127.0.0.1:3200/api/audit/report-pdf?${query.replace('tier=basic','tier=advanced')}`,{signal:AbortSignal.timeout(10000)});await r.body?.cancel();assert(r.status===401,`unexpected_advanced_status_${r.status}`);return{http:r.status};});
 await record('production-post-json-shares-runtime',async()=>{const r=await fetch('http://127.0.0.1:3200/api/audit/report',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:3200'},body:JSON.stringify({address:target,chainId:'1',analysisMode:'runtime',tier:'basic'}),signal:AbortSignal.timeout(18000)});const body=await r.json();assert(r.status===200&&body.report?.runtimeAnalysis?.status==='STATIC_ANALYSIS_COMPLETED',`post_http_${r.status}_${body.mode??body.error}`);return{http:r.status};});
 const appB=launch('next-b','node',['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101']);await ready(3101);upstreamPort=3101;
 await record('sixth-request-on-second-instance-still-allowed',async()=>{const {status,body}=await getJson();assert(status===200&&body.report?.runtimeAnalysis?.status==='STATIC_ANALYSIS_COMPLETED',`sixth_http_${status}`);return{http:status};});
 await record('seventh-request-across-representations-and-instances-is-429',async()=>{const {status}=await getJson();assert(status===429,`seventh_http_${status}`);return{http:status};});
 await record('forged-forwarded-ip-cannot-reset-proxy-quota',async()=>{const {status}=await getJson(undefined,{'x-forwarded-for':'192.0.2.99','x-vercel-forwarded-for':'192.0.2.98','x-velmere-proxy-address':'192.0.2.97'});assert(status===429,`spoof_http_${status}`);return{http:status};});
 await record('pdf-cannot-reset-exhausted-shared-quota',async()=>{const r=await fetch(`http://127.0.0.1:3200/api/audit/report-pdf?${query}`,{signal:AbortSignal.timeout(10000)});await r.body?.cancel();assert(r.status===429,`format_http_${r.status}`);return{http:r.status};});
 await stop(appB);upstreamPort=3100;
 await record('quota-survives-application-instance-switch',async()=>{const {status}=await getJson();assert(status===429,`switch_http_${status}`);return{http:status};});
 await stop(redis);
 await record('storage-failure-returns-503-without-memory-fallback',async()=>{const {status,body}=await getJson();assert(status===503&&body.mode==='rate_limit_storage_unavailable',`redis_failure_${status}`);return{http:status,mode:body.mode};});
 redis=launch('redis-recovery','redis-server',[redisConfig]);await sleep(800);
 await record('redis-recovery-restores-persisted-quota',async()=>{const {status}=await getJson();assert(status===429,`redis_recovery_${status}`);return{http:status};});
 await stop(app);
}finally{
 if(browser)await browser.close();if(proxy)await new Promise(r=>proxy.close(r));for(const p of children)await stop(p);fs.rmSync(work,{recursive:true,force:true});
 fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify({sourceSha:process.env.GITHUB_SHA,scope:'ACTUAL_PRODUCTION_NEXT_SELFHOSTED_EPHEMERAL_REDIS_HMAC_PROXY_PUBLIC_RPC_NOT_VERCEL_OR_STRIPE',rows},null,2));
}
if(rows.some(r=>r.result!=='PASS'))process.exitCode=1;
