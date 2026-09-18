import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('base source and fresh evidence directory required');
fs.mkdirSync(out, { recursive: true });
const before = createRequire(path.resolve('package.json'))(path.resolve(base, 'lib/security/v2/master-audit-orchestrator.ts')) as { executeFullAuditV2: typeof executeFullAuditV2 };
const core = '6000'.repeat(5) + '60015af1';
const call = core + '5000';
const jump = (pc: number) => '61' + pc.toString(16).padStart(4, '0') + '56';
const cases = Array.from({length:16}, (_, seed) => {
 const prefix = '60' + seed.toString(16).padStart(2, '0') + '50';
 const shift = prefix.length / 2;
 const checkDest = shift + core.length / 2 + 6;
 return [
  {family:'live-discard', expected:true, body:call},
  {family:'dead-after-stop', expected:false, body:'00'+call},
  {family:'dead-unreferenced-jumpdest', expected:false, body:'005b'+call},
  {family:'dead-static-skipped', expected:false, body:jump(shift+4+call.length/2)+call+'5b00'},
  {family:'live-dynamic-destination', expected:true, body:'5f3556005b'+call},
  {family:'live-static-destination', expected:true, body:jump(shift+5)+'005b'+call},
  {family:'live-successful-stop', expected:true, body:core+'00'},
  {family:'checked-status', expected:false, body:core+'1561'+checkDest.toString(16).padStart(4,'0')+'57005b5f5ffd'},
 ].map(f => ({family:f.family,variant:seed,expected:f.expected,runtimeHex:prefix+f.body}));
}).flat();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
assert.equal(new Set(cases.map(x=>x.runtimeHex)).size, cases.length);
const file=path.join(out,'INPUTS.json'); assert.equal(fs.existsSync(file), false);
fs.writeFileSync(file, JSON.stringify({scope:'AUTHOR_CREATED_8_FAMILY_DEVELOPMENT_MATRIX_NOT_EXTERNAL_BENCHMARK',cases},null,2));
const rows = cases.map(f=>{
 const input={contractAddress:'0x0000000000000000000000000000000000000015',chainId:'1',bytecode:'0x'+f.runtimeHex,fuzzIterations:0};
 const pick=(r:ReturnType<typeof executeFullAuditV2>)=>r.findings.some(x=>x.findingId==='VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01');
 return {...f,runtimeSha256:createHash('sha256').update(Buffer.from(f.runtimeHex,'hex')).digest('hex'),before:pick(before.executeFullAuditV2(input)),after:pick(executeFullAuditV2(input))};
});
const matrix=(lane:'before'|'after')=>rows.reduce((m,r)=>{m[r.expected?(r[lane]?'tp':'fn'):(r[lane]?'fp':'tn')]++;return m;},{tp:0,tn:0,fp:0,fn:0});
const result={baselineSourceSha:'e718df06d20a8129ffe261eef9c6c74cc5c91729',candidateSourceSha:process.env.GITHUB_SHA??null,scope:'INTERNAL_DEVELOPMENT_FIXTURES_ONLY_NO_EVM_EXECUTION_OR_GENERALIZATION_CLAIM',inputSha256:sha(fs.readFileSync(file,'utf8')),families:8,variantsPerFamily:16,uniqueBytecodes:cases.length,before:matrix('before'),after:matrix('after'),rows};
fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:undefined},null,2));
if(rows.some(r=>r.after!==r.expected))process.exitCode=1;
