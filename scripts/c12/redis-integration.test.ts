import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@redis/client';
import { randomUUID } from 'node:crypto';
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
test('cleanup removes only keys created by this test process',async()=>{
 if(admin.isReady){for(const k of keys)await admin.del(k);await admin.close();}
});
