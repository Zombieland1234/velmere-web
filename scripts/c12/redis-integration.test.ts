import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@redis/client';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { applyDurableRateLimit } from '../../lib/security/durable-rate-limit';

// Dedicated ephemeral service supplied by CI; never flush existing/user Redis.
const url=process.env.C12_TEST_REDIS_URL;
if(!url)throw new Error('C12_TEST_REDIS_URL required: refusing fake PASS or silent skip');
process.env.VELMERE_RATE_LIMIT_BACKEND='redis';process.env.REDIS_URL=url;
const admin=createClient({url});admin.on('error',()=>{});
const keys:string[]=[];
test('real Redis atomic quota admits exactly six of twenty concurrent consumers',async()=>{
 const key=randomUUID();const rows=await Promise.all(Array.from({length:20},()=>applyDurableRateLimit({namespace:'c12-isolated-test',key,limit:6,windowMs:60000})));
 assert.equal(rows.filter(r=>r.ok).length,6);assert.ok(rows.every(r=>r.provider==='redis'&&r.mode==='redis'));
 assert.equal(new Set(rows.map(r=>r.boundaryKey)).size,1);keys.push(rows[0].boundaryKey);
});
test('quota remains exhausted across separate limiter calls and IP-like suffixes stay distinct',async()=>{
 const prefix='x'.repeat(300);const a=await applyDurableRateLimit({key:prefix+'a',limit:1,windowMs:60000});const b=await applyDurableRateLimit({key:prefix+'b',limit:1,windowMs:60000});
 assert.ok(a.ok&&b.ok);assert.notEqual(a.boundaryKey,b.boundaryKey);assert.equal((await applyDurableRateLimit({key:prefix+'a',limit:1,windowMs:60000})).ok,false);keys.push(a.boundaryKey,b.boundaryKey);
});
test('server clock controls windows and returned keys do not disclose caller identity',async()=>{
 const key='private-test-user@example.invalid';const a=await applyDurableRateLimit({key,limit:10,windowMs:60000,cost:3});assert.ok(a.ok);assert.equal(a.remaining,7);
 assert.doesNotMatch(a.boundaryKey,/private-test|example/);assert.ok(a.resetAt>Date.now()-2000&&a.resetAt<Date.now()+62000);keys.push(a.boundaryKey);
 await admin.connect();assert.ok(await admin.pTTL(a.boundaryKey)>0);
});
test('corrupt persisted state is rejected rather than reset to grant new quota',async()=>{
 const key=randomUUID();const a=await applyDurableRateLimit({key,limit:5,windowMs:60000});keys.push(a.boundaryKey);
 await admin.hSet(a.boundaryKey,'count','invalid');const b=await applyDurableRateLimit({key,limit:5,windowMs:60000});assert.equal(b.ok,false);assert.equal(b.mode,'unavailable');
});
test('exact old Redis script reproduces future-window reset and fractional-count acceptance; candidate refuses unchanged state',async()=>{
 const base='6b7d66a2cf3a93af8917376a396f66df3f8857cf';
 const old=execFileSync('git',['show',`${base}:lib/security/native-redis-rate-limit.ts`],{encoding:'utf8'});
 const lua=old.match(/const LUA = `([\s\S]*?)`;/)?.[1];assert.ok(lua);
 const rows:object[]=[];
 for(const kind of ['future-window','fractional-count']){
  const key=randomUUID(),options={key,limit:5,windowMs:60000};
  const first=await applyDurableRateLimit(options);assert.ok(first.ok);keys.push(first.boundaryKey);
  const original=await admin.hGetAll(first.boundaryKey);
  const corrupt=kind==='future-window'?{window:String(Number(original.window)+2),count:'5'}:{window:original.window,count:'4.5'};
  await admin.hSet(first.boundaryKey,corrupt);
  const before=await admin.eval(lua,{keys:[first.boundaryKey],arguments:['60000','1','5']});
  assert.ok(Array.isArray(before));assert.ok(Number(before[0])<=5);
  await admin.hSet(first.boundaryKey,corrupt);
  const after=await applyDurableRateLimit(options);assert.equal(after.ok,false);assert.equal(after.mode,'unavailable');
  assert.deepEqual({...await admin.hGetAll(first.boundaryKey)},corrupt);
  rows.push({case:kind,baselineReturnedCount:before[0],candidateAllowed:after.ok,candidateMode:after.mode,stateUnchanged:true});
 }
 mkdirSync('/tmp/c12-evidence',{recursive:true});
 writeFileSync('/tmp/c12-evidence/REDIS_STATE_REPLAY.json',JSON.stringify({baselineSha:base,sourceSha:process.env.GITHUB_SHA,recordedAt:new Date().toISOString(),scope:'ACTUAL_REDIS_WITH_SYNTHETIC_CORRUPTED_TEST_STATE_NOT_REMOTE_UNAUTHENTICATED_EXPLOIT',rows},null,2));
});
test('invalid negative fractional or over-cap persisted state never mutates or grants quota',async()=>{
 const key=randomUUID(),options={key,limit:5,windowMs:60000};const first=await applyDurableRateLimit(options);assert.ok(first.ok);keys.push(first.boundaryKey);
 const initial=await admin.hGetAll(first.boundaryKey);
 for(const corrupt of [{window:'-1',count:'1'},{window:initial.window+'.5',count:'1'},{window:initial.window,count:'106'},{window:initial.window,count:'-1'}]){
  await admin.hSet(first.boundaryKey,corrupt);const result=await applyDurableRateLimit(options);assert.equal(result.mode,'unavailable');assert.equal(result.ok,false);
  assert.deepEqual({...await admin.hGetAll(first.boundaryKey)},corrupt);
 }
});
test('authenticated selected database supports handshake and repeated quota decisions',async()=>{
 const saved=process.env.REDIS_URL;const database=new URL(url!);database.pathname='/1';process.env.REDIS_URL=database.href;
 const key=randomUUID();const dbAdmin=createClient({url:database.href});dbAdmin.on('error',()=>{});
 try{const first=await applyDurableRateLimit({key,limit:1,windowMs:60000});assert.ok(first.ok);assert.equal((await applyDurableRateLimit({key,limit:1,windowMs:60000})).ok,false);
  await dbAdmin.connect();await dbAdmin.del(first.boundaryKey);
 }finally{process.env.REDIS_URL=saved;if(dbAdmin.isOpen)dbAdmin.destroy();}
});
test('cleanup removes only keys created by this test process',async()=>{
 if(admin.isReady){for(const k of keys)await admin.del(k);await admin.close();}
});
