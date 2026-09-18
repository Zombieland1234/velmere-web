import fs from 'node:fs';
import crypto from 'node:crypto';

const mode = process.argv[2];
if (!['prepatch','postpatch'].includes(mode)) throw new Error('usage: auth-http-e2e.mjs prepatch|postpatch');
const supabaseUrl = process.env.P12_SUPABASE_URL;
const anonKey = process.env.P12_ANON_KEY;
const serviceKey = process.env.P12_SERVICE_ROLE_KEY;
const appUrl = process.env.P12_APP_URL ?? 'http://127.0.0.1:3000';
const outDir = process.env.P12_EVIDENCE_DIR ?? '/tmp/c14-p12-evidence';
for (const [name,value] of Object.entries({P12_SUPABASE_URL:supabaseUrl,P12_ANON_KEY:anonKey,P12_SERVICE_ROLE_KEY:serviceKey})) {
  if (!value) throw new Error(`${name} missing`);
}
fs.mkdirSync(outDir,{recursive:true});
const checks=[];
function record(id, ok, detail={}) {
  const row={id,result:ok?'PASS':'FAIL',...detail}; checks.push(row); console.log(id,row.result,detail);
  if (!ok) throw new Error(`${id} failed: ${JSON.stringify(detail)}`);
}
async function jsonResponse(response) {
  const text=await response.text(); let body=null;
  try { body=text?JSON.parse(text):null; } catch { body={raw:text}; }
  return {status:response.status,headers:response.headers,body};
}
function serviceHeaders(){return {apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'};}
function userHeaders(token){return {apikey:anonKey,authorization:`Bearer ${token}`,'content-type':'application/json'};}
async function adminCreate(label){
  const suffix=crypto.randomUUID().replaceAll('-','').slice(0,16);
  const email=`c14-p12-${label}-${suffix}@example.test`; const password=`P12!${suffix}Aa9#`;
  const r=await fetch(`${supabaseUrl}/auth/v1/admin/users`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify({email,password,email_confirm:true})});
  const x=await jsonResponse(r); record(`${label}-controlled-user-created`,x.status===200 && /^[0-9a-f-]{36}$/i.test(x.body?.id??''),{status:x.status});
  return {id:x.body.id,email,password};
}
function updateJar(jar,headers){
  const rows=typeof headers.getSetCookie==='function'?headers.getSetCookie():[];
  if (!rows.length) throw new Error('runtime lacks Headers.getSetCookie or response emitted no cookies');
  for(const row of rows){
    const first=row.split(';',1)[0]; const eq=first.indexOf('='); if(eq<1) continue;
    const name=first.slice(0,eq); const value=first.slice(eq+1);
    const clear=/(?:^|;)\s*max-age=0(?:;|$)/i.test(row);
    const path=(row.match(/(?:^|;)\s*path=([^;]+)/i)?.[1]??'/').trim();
    // Browsers key cookies by name+domain+path. During a transition Velmere
    // sets the active auth-family cookie on "/" and clears only the legacy
    // same-name cookie scoped to "/api/auth/session".
    if(clear){
      if(name==='velmere_auth_family' && path==='/api/auth/session') continue;
      jar.delete(name);
    } else jar.set(name,value);
  }
}
function cookieHeader(jar){return [...jar].map(([k,v])=>`${k}=${v}`).join('; ');}
async function app(method,path,{jar,body}={}){
  const headers={origin:appUrl,accept:'application/json'};
  if(jar) headers.cookie=cookieHeader(jar);
  if(body!==undefined) headers['content-type']='application/json';
  const r=await fetch(`${appUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  const setCookies=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():[];
  const x=await jsonResponse(r); if(jar && setCookies.length) updateJar(jar,{getSetCookie:()=>setCookies});
  return x;
}
async function login(label,user){
  const jar=new Map();
  const x=await app('POST','/api/auth/session',{jar,body:{provider:'email',mode:'signin',email:user.email,password:user.password}});
  record(`${label}-app-password-login`,x.status===200 && x.body?.authenticated===true && x.body?.session?.accountId===`supabase:${user.id}`,{status:x.status,auth:x.body?.authenticated,accountId:x.body?.session?.accountId});
  record(`${label}-httponly-cookie-set`,jar.has('velmere_supabase_access')&&jar.has('velmere_supabase_refresh')&&jar.has('velmere_auth_family')&&jar.has('velmere_account_session'),{cookieNames:[...jar.keys()].sort()});
  return jar;
}
function tokenSessionId(token){
  const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
  return payload.session_id;
}
async function serviceRpc(name,args){
  const r=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(args)});
  return jsonResponse(r);
}
async function userRpc(token,name,args){
  const r=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:userHeaders(token),body:JSON.stringify(args)});
  return jsonResponse(r);
}
async function resources(token,query='select=resource_id,account_id,kind,tier,payload&order=kind.asc'){
  const r=await fetch(`${supabaseUrl}/rest/v1/p12_owner_resources?${query}`,{headers:userHeaders(token)}); return jsonResponse(r);
}
async function seedResource(subject,kind,tier){
  const x=await serviceRpc('p12_seed_owner_resource',{p_subject:subject,p_kind:kind,p_tier:tier});
  record(`seed-${subject.slice(0,8)}-${kind}`,x.status===200 && typeof x.body==='string',{status:x.status}); return x.body;
}
async function grant(subject,tier){
  const x=await serviceRpc('p12_grant_tier',{p_subject:subject,p_tier:tier}); record(`grant-${subject.slice(0,8)}-${tier}`,x.status===200&&typeof x.body==='string',{status:x.status}); return x.body;
}
async function revoke(entitlement){const x=await serviceRpc('p12_revoke_tier',{p_entitlement:entitlement});record(`revoke-${entitlement.slice(0,8)}`,x.status===204||x.status===200,{status:x.status});}

if(mode==='prepatch'){
  const user=await adminCreate('pre'); const jar=await login('pre',user); const token=jar.get('velmere_supabase_access'); const sessionId=tokenSessionId(token);
  const resource=await seedResource(user.id,'report','pro');
  let x=await resources(token,`resource_id=eq.${resource}&select=resource_id,account_id`);
  record('prepatch-active-token-owner-read',x.status===200&&x.body?.length===1,{status:x.status,count:x.body?.length});
  const oldJar=new Map(jar); const logout=await app('DELETE','/api/auth/session',{jar});
  record('prepatch-app-logout',logout.status===200&&logout.body?.cleared===true,{status:logout.status,cleared:logout.body?.cleared,providerRevoked:logout.body?.providerRevoked});
  const existsAfter=await serviceRpc('p12_session_exists',{p_session:sessionId}); record('prepatch-provider-session-revoked',existsAfter.status===200&&existsAfter.body===false,{status:existsAfter.status,exists:existsAfter.body});
  x=await resources(token,`resource_id=eq.${resource}&select=resource_id,account_id`);
  record('prepatch-vulnerability-reproduced-stale-jwt-reads-owner-data',x.status===200&&x.body?.length===1,{status:x.status,count:x.body?.length,expectedVulnerable:true});
  const replay=await app('GET','/api/auth/session',{jar:oldJar});
  record('prepatch-app-family-already-blocks-replay',replay.status===200&&replay.body?.authenticated===false,{status:replay.status,authenticated:replay.body?.authenticated});
} else {
  const A=await adminCreate('a'); const B=await adminCreate('b');
  const jarA=await login('a',A); const jarB=await login('b',B);
  const tokenA=jarA.get('velmere_supabase_access'); const tokenB=jarB.get('velmere_supabase_access');
  const idsA={}, idsB={};
  for(const kind of ['workspace','report','storage','product']){idsA[kind]=await seedResource(A.id,kind,kind==='product'?'advanced':'pro');idsB[kind]=await seedResource(B.id,kind,'pro');}
  let x=await resources(tokenA); record('A-direct-rest-sees-only-A',x.status===200&&x.body?.length===4&&x.body.every(r=>r.account_id===`supabase:${A.id}`),{status:x.status,count:x.body?.length});
  x=await resources(tokenB); record('B-direct-rest-sees-only-B',x.status===200&&x.body?.length===4&&x.body.every(r=>r.account_id===`supabase:${B.id}`),{status:x.status,count:x.body?.length});
  x=await resources(tokenA,`resource_id=eq.${idsB.report}&select=resource_id,account_id`); record('A-cannot-read-B-report-rest',x.status===200&&x.body?.length===0,{status:x.status,count:x.body?.length});
  x=await userRpc(tokenA,'p12_owner_resource_get',{p_resource_id:idsB.storage}); record('A-cannot-read-B-storage-rpc',x.status===200&&Array.isArray(x.body)&&x.body.length===0,{status:x.status,count:x.body?.length});
  x=await userRpc(tokenB,'p12_owner_resource_get',{p_resource_id:idsA.product}); record('B-cannot-read-A-product-rpc',x.status===200&&Array.isArray(x.body)&&x.body.length===0,{status:x.status,count:x.body?.length});
  const aGet=await app('GET','/api/auth/session',{jar:jarA}); const bGet=await app('GET','/api/auth/session',{jar:jarB});
  record('A-app-session-resolves-A',aGet.status===200&&aGet.body?.authenticated===true&&aGet.body?.session?.accountId===`supabase:${A.id}`,{status:aGet.status});
  record('B-app-session-resolves-B',bGet.status===200&&bGet.body?.authenticated===true&&bGet.body?.session?.accountId===`supabase:${B.id}`,{status:bGet.status});
  const mixed=new Map(jarA); mixed.set('velmere_supabase_access',tokenB); mixed.set('velmere_supabase_refresh',jarB.get('velmere_supabase_refresh'));
  const mixedGet=await app('GET','/api/auth/session',{jar:mixed}); record('mixed-A-account-B-token-denied',mixedGet.status===200&&mixedGet.body?.authenticated===false,{status:mixedGet.status,authenticated:mixedGet.body?.authenticated,bindingState:mixedGet.body?.bindingState});

  const advGrant=await grant(A.id,'advanced'); const proGrantB=await grant(B.id,'pro');
  let wsA=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'CREATE',p_workspace_id:null});
  record('A-advanced-workspace-create',wsA.status===200&&wsA.body?.resolution==='CREATED'&&wsA.body?.tier==='advanced',{status:wsA.status,resolution:wsA.body?.resolution}); const wsAId=wsA.body.workspaceId;
  let wsB=await userRpc(tokenB,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'pro',p_locale:'en',p_operation:'CREATE',p_workspace_id:null});
  record('B-pro-workspace-create',wsB.status===200&&wsB.body?.resolution==='CREATED'&&wsB.body?.tier==='pro',{status:wsB.status,resolution:wsB.body?.resolution}); const wsBId=wsB.body.workspaceId;
  x=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'READ',p_workspace_id:wsBId}); record('A-cannot-read-B-workspace',x.status===200&&x.body?.resolution==='NOT_FOUND',{status:x.status,resolution:x.body?.resolution});
  x=await userRpc(tokenB,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'pro',p_locale:'en',p_operation:'READ',p_workspace_id:wsAId}); record('B-cannot-read-A-workspace',x.status===200&&x.body?.resolution==='NOT_FOUND',{status:x.status,resolution:x.body?.resolution});
  x=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'DELETE',p_workspace_id:wsAId}); record('A-delete-own-workspace',x.status===200&&x.body?.resolution==='DELETED',{status:x.status,resolution:x.body?.resolution});
  x=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'RESTORE',p_workspace_id:wsAId}); record('A-restore-own-workspace',x.status===200&&x.body?.resolution==='RESTORED',{status:x.status,resolution:x.body?.resolution});
  const wsA2=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'CREATE',p_workspace_id:null}); const wsA2Id=wsA2.body?.workspaceId; record('A-second-advanced-workspace-create',wsA2.status===200&&!!wsA2Id,{status:wsA2.status});
  await revoke(advGrant); const proGrantA=await grant(A.id,'pro');
  x=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'pro',p_locale:'en',p_operation:'READ',p_workspace_id:wsA2Id}); record('A-downgrade-cannot-read-stored-advanced',x.status===403&&String(x.body?.message??'').includes('stored_workspace_entitlement_required'),{status:x.status,message:x.body?.message});
  x=await userRpc(tokenA,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'advanced',p_locale:'en',p_operation:'CREATE',p_workspace_id:null}); record('A-request-tier-forgery-denied',x.status===403,{status:x.status,message:x.body?.message});
  await revoke(proGrantB); x=await userRpc(tokenB,'velmere_r7_shield_pro_paid_workspace_v1',{p_tier:'pro',p_locale:'en',p_operation:'READ',p_workspace_id:wsBId}); record('B-revoked-tier-denied',x.status===403,{status:x.status,message:x.body?.message});

  const oldA=new Map(jarA); const refreshed=await app('PUT','/api/auth/session',{jar:jarA});
  record('A-refresh-success',refreshed.status===200&&refreshed.body?.authenticated===true,{status:refreshed.status,authStatus:refreshed.body?.status});
  const oldReplay=await app('GET','/api/auth/session',{jar:oldA}); record('A-pre-refresh-family-replay-denied',oldReplay.status===200&&oldReplay.body?.authenticated===false,{status:oldReplay.status,authenticated:oldReplay.body?.authenticated});
  const newGet=await app('GET','/api/auth/session',{jar:jarA}); record('A-refreshed-session-active',newGet.status===200&&newGet.body?.authenticated===true,{status:newGet.status});

  const sessionB=tokenSessionId(tokenB); x=await serviceRpc('p12_expire_session',{p_session:sessionB}); record('B-session-expired-in-isolated-auth',x.status===204||x.status===200,{status:x.status});
  x=await resources(tokenB,`resource_id=eq.${idsB.report}&select=resource_id`); record('expired-B-token-direct-rest-denied',x.status===200&&x.body?.length===0,{status:x.status,count:x.body?.length});
  const bExpired=await app('GET','/api/auth/session',{jar:jarB}); record('expired-B-app-session-denied',bExpired.status===200&&bExpired.body?.authenticated===false,{status:bExpired.status,authenticated:bExpired.body?.authenticated,bindingState:bExpired.body?.bindingState});

  const logoutToken=jarA.get('velmere_supabase_access'); const replayJar=new Map(jarA); const logout=await app('DELETE','/api/auth/session',{jar:jarA});
  record('A-app-global-logout',logout.status===200&&logout.body?.cleared===true,{status:logout.status,cleared:logout.body?.cleared,providerRevoked:logout.body?.providerRevoked});
  const replayApp=await app('GET','/api/auth/session',{jar:replayJar}); record('A-logged-out-cookie-replay-denied',replayApp.status===200&&replayApp.body?.authenticated===false,{status:replayApp.status,authenticated:replayApp.body?.authenticated});
  x=await resources(logoutToken,`resource_id=eq.${idsA.report}&select=resource_id`); record('A-logged-out-JWT-direct-rest-denied',x.status===200&&x.body?.length===0,{status:x.status,count:x.body?.length});
  x=await userRpc(logoutToken,'p12_owner_resource_get',{p_resource_id:idsA.storage}); record('A-logged-out-JWT-direct-rpc-denied',x.status===200&&Array.isArray(x.body)&&x.body.length===0,{status:x.status,count:x.body?.length});

  const bad=await fetch(`${supabaseUrl}/rest/v1/p12_owner_resources?select=resource_id`,{headers:{apikey:anonKey,authorization:'Bearer not.a.jwt'}}); record('malformed-bearer-denied',bad.status===401,{status:bad.status});
  void proGrantA;
}

const output={schemaVersion:'velmere.c14-p12-auth-http-e2e.v1',mode,at:new Date().toISOString(),scope:'DISPOSABLE_LOCAL_SUPABASE_REAL_GOTRUE_POSTGREST_NEXT_HTTP_NO_CUSTOMER_DATA',checks};
fs.writeFileSync(`${outDir}/${mode}.json`,JSON.stringify(output,null,2));
console.log(`C14-P12 ${mode}: ${checks.length}/${checks.length} checks passed`);
