import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { inspectSignedProxyConfig, resolveSignedProxyAddress, SIGNED_PROXY_HEADERS as H } from '../../lib/security/signed-proxy-identity';
import { inspectNativeRedisConfig, applyNativeRedisRateLimit } from '../../lib/security/native-redis-rate-limit';
import { inspectDurableRateLimitRuntime, applyDurableRateLimit } from '../../lib/security/durable-rate-limit';
import { resolveTrustedClientAddress, requireTrustedRateLimitClient, applySoftRateLimit } from '../../lib/security/api-guard';

const secret = randomBytes(32).toString('hex');
const env = { NODE_ENV: 'production', VELMERE_TRUSTED_PROXY_PROFILE: 'signed_proxy', VELMERE_PROXY_HMAC_SECRET: secret, VELMERE_PROXY_HMAC_AUDIENCE: 'test-velmere' } as NodeJS.ProcessEnv;
function assertion(address='192.0.2.12', time=Date.now(), audience='test-velmere', key=secret) {
  const ts=String(time);return { [H.address]:address,[H.time]:ts,[H.signature]:createHmac('sha256',Buffer.from(key,'hex')).update(`velmere-proxy-address-v1\n${audience}\n${ts}\n${address}`).digest('hex') };
}
const req=(h:Record<string,string>)=>new Request('http://localhost:3000/api/audit/report',{headers:h});
function setEnv(t: TestContext, values: Record<string,string|undefined>) {
  const old={...process.env};for(const [k,v]of Object.entries(values)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  t.after(()=>{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);});
}
test('signed proxy accepts exact authenticated IPv4 and IPv6 assertions',()=>{
 for(const ip of ['192.0.2.12','2001:db8::2','::ffff:192.0.2.12'])assert.equal(resolveSignedProxyAddress(req(assertion(ip)),env),ip);
});
test('unsigned client XFF and Vercel-like headers cannot establish trust in signed profile',()=>{
 const r=resolveTrustedClientAddress(req({'x-forwarded-for':'192.0.2.1','x-vercel-forwarded-for':'192.0.2.1'}),env);assert.equal(r.trusted,false);assert.equal(r.address,null);
});
test('changing the asserted address invalidates its signature',()=>{
 const h=assertion();h[H.address]='192.0.2.13';assert.equal(resolveSignedProxyAddress(req(h),env),null);
});
test('wrong audience or signing key cannot cross deployments',()=>{
 assert.equal(resolveSignedProxyAddress(req(assertion('192.0.2.1',Date.now(),'other-velmere')),env),null);
 assert.equal(resolveSignedProxyAddress(req(assertion('192.0.2.1',Date.now(),'test-velmere',randomBytes(32).toString('hex'))),env),null);
});
test('stale and future proxy assertions are denied with boundary cases',()=>{
 const now=Date.now();for(const delta of [-30001,2001])assert.equal(resolveSignedProxyAddress(req(assertion('192.0.2.1',now+delta)),env,now),null);
 for(const delta of [-30000,2000])assert.equal(resolveSignedProxyAddress(req(assertion('192.0.2.1',now+delta)),env,now),'192.0.2.1');
});
test('malformed or ambiguous assertion fields do not throw',()=>{
 for(const change of [{[H.signature]:'a'}, {[H.time]:'1e12'}, {[H.address]:'192.0.2.1, 192.0.2.2'}, {[H.address]:'fe80::1%eth0'}])assert.equal(resolveSignedProxyAddress(req({...assertion(),...change}),env),null);
});
test('weak/missing signing configuration stays unavailable',()=>{
 for(const key of ['', 'a'.repeat(64), 'not-hex'.repeat(10)])assert.equal(inspectSignedProxyConfig({...env,VELMERE_PROXY_HMAC_SECRET:key}).configured,false);
});
test('valid proxy assertion does not replace dedicated privacy fingerprint secret',t=>{
 setEnv(t,{...env,VELMERE_SECURITY_FINGERPRINT_SECRET:undefined});const result=requireTrustedRateLimitClient(req(assertion()));assert.equal(result.ok,false);if(!result.ok)assert.equal(result.response.status,503);
});
test('production local memory cannot replace Redis or bypass durable storage',t=>{
 setEnv(t,{NODE_ENV:'production',UPSTASH_REDIS_REST_URL:undefined,UPSTASH_REDIS_REST_TOKEN:undefined,VELMERE_RATE_LIMIT_BACKEND:undefined,REDIS_URL:undefined});
 assert.equal(inspectDurableRateLimitRuntime().mode,'unavailable');assert.equal(applySoftRateLimit(req({})).ok,false);
});
test('native Redis must be explicitly selected and remote plaintext is prohibited',()=>{
 assert.equal(inspectNativeRedisConfig({REDIS_URL:'redis://localhost:6379'}).configured,false);
 for(const url of ['redis://remote.example:6379','https://localhost','rediss://remote.example/100','rediss://remote.example?x=1'])assert.equal(inspectNativeRedisConfig({VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:url}).configured,false);
 for(const url of ['redis://127.0.0.1:6379/0','redis://[::1]:6379','rediss://user:password@redis.example:6380/1'])assert.equal(inspectNativeRedisConfig({VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:url}).configured,true);
});
test('misconfigured selected Redis cannot silently fall back to available Upstash or memory',()=>{
 assert.equal(inspectDurableRateLimitRuntime({...env,VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:'redis://remote.invalid',UPSTASH_REDIS_REST_URL:'https://database.upstash.io',UPSTASH_REDIS_REST_TOKEN:'fixture'}).mode,'unavailable');
});
test('disabled limiter flag still fails closed in production with valid Redis configuration',()=>{
 assert.equal(inspectDurableRateLimitRuntime({...env,VELMERE_RATE_LIMIT_DISABLED:'1',VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:'redis://127.0.0.1:6379'}).mode,'unavailable');
});
test('invalid rate options refuse before any Redis connection',async()=>{
 for(const options of [{key:'x',limit:NaN,windowMs:1000},{key:'x',limit:3,windowMs:0},{key:'x',limit:3,windowMs:1000,cost:101}])assert.equal((await applyNativeRedisRateLimit(options)).ok,false);
});
test('unavailable real TCP socket returns bounded fail-closed, not memory success',async t=>{
 setEnv(t,{NODE_ENV:'production',VELMERE_RATE_LIMIT_BACKEND:'redis',REDIS_URL:'redis://127.0.0.1:1'});const start=performance.now();
 const r=await applyDurableRateLimit({key:'test',limit:6,windowMs:60000});assert.equal(r.ok,false);assert.equal(r.mode,'unavailable');assert.ok(performance.now()-start<3000);assert.equal(r.provider,'redis');
});
