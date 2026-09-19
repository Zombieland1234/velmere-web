import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const raw=readFileSync(new URL('./fixtures/next-config-q10.mjs.txt',import.meta.url));
const baseline=path.join(root,`next-q14-baseline-${randomUUID()}.mjs`);
writeFileSync(baseline,raw);
const keys=['NODE_ENV','VELMERE_BUILD_PROFILE','VELMERE_RUNTIME_BUILD_SCOPE','VELMERE_RUNTIME_DIST_DIR','VELMERE_RUNTIME_BUILD_ID','VELMERE_BUILD_WEBPACK_PERSISTENT_CACHE'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const clear=()=>{for(const k of keys)delete process.env[k];};
after(()=>{unlinkSync(baseline);clear();for(const [k,v]of Object.entries(saved))if(v!==undefined)process.env[k]=v;});
const plain=value=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='function'?v.toString():v));
let iteration=0;
async function load(filename){return (await import(pathToFileURL(filename).href+`?q14=${iteration++}`)).default;}
for(const mode of ['development','production','test'])for(const profile of ['conservative','balanced','throughput']){
 test(`Q14 effective Next configuration parity: ${mode}/${profile}`,async()=>{
  clear();process.env.NODE_ENV=mode;process.env.VELMERE_BUILD_PROFILE=profile;
  const old=await load(baseline),current=await load(path.join(root,'next.config.mjs'));
  assert.deepEqual(plain(current),plain(old));
  assert.deepEqual(await current.headers(),await old.headers());
  assert.deepEqual(await current.redirects(),await old.redirects());
  const config=()=>({context:root,resolve:{alias:{}},module:{rules:[]}});
  const options={dev:mode!=='production',isServer:true,dir:root};
  assert.deepEqual(plain(current.webpack(config(),options)),plain(old.webpack(config(),options)));
 });
}
test('Q14 invalid build profile is still rejected rather than ignored',async()=>{
 clear();process.env.VELMERE_BUILD_PROFILE='invalid';
 await assert.rejects(load(baseline),/unsupported VELMERE_BUILD_PROFILE/);
 await assert.rejects(load(path.join(root,'next.config.mjs')),/unsupported VELMERE_BUILD_PROFILE/);
});
test('Q14 frozen baseline configuration bytes have recorded provenance',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/PROVENANCE.json',import.meta.url),'utf8'));
 assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
});
