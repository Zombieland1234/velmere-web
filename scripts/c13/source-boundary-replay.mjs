// Execute exact C12 and current FullV2 engines on identical synthetic inputs.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {execFileSync}from'node:child_process';import {createRequire}from'node:module';import{createHash}from'node:crypto';
const require=createRequire(import.meta.url),esbuild=require('esbuild');
const baseSha='9a176fe2e844ccf7166bf1bd7552f1bec79584cb';
const output=process.argv[2];if(!output)throw new Error('Output directory required');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'c13-replay-'));
try{
 execFileSync('bash',['-c','git archive "$1" | tar -x -C "$2"','bash',baseSha,tmp]);
 const lanes=[];
 for(const [name,root]of[['C12',tmp],['C13',process.cwd()]]){
  const bundle=path.join(tmp,name+'.cjs');esbuild.buildSync({entryPoints:[path.join(root,'lib/security/v2/master-audit-orchestrator.ts')],bundle:true,platform:'node',format:'cjs',outfile:bundle,logLevel:'silent'});
  const {executeFullAuditV2}=require(bundle);
  const cases=[['chainlink-string','0x63feaf968c00','contract Other { string constant note="HEARTBEAT answeredInRound"; }'],['spot-string','0x630902f1ac00','contract Other { string constant note="consult( observe("; }']];
  lanes.push({label:name,sourceSha:name==='C12'?baseSha:process.env.GITHUB_SHA,cases:cases.map(([id,bytecode,sourceCode])=>{
   const input={contractAddress:'0x0000000000000000000000000000000000000013',chainId:'1',bytecode,fuzzIterations:0};
   return{id,bytecode,sourceCode,inputSha256:createHash('sha256').update(JSON.stringify({input,sourceCode})).digest('hex'),withoutSource:executeFullAuditV2(input).findings,withUnboundSource:executeFullAuditV2({...input,sourceCode}).findings};
  })});
 }
 fs.writeFileSync(path.join(output,'C13_SOURCE_BOUNDARY_REPLAY.json'),JSON.stringify({scope:'SYNTHETIC_BYTES_ACTUAL_BASE_AND_CURRENT_ENGINE_NOT_DEPLOYED_CONTRACT_EXPLOIT',lanes},null,2));
 for(const c of lanes[0].cases)if(c.withUnboundSource.length>=c.withoutSource.length)throw new Error('Expected historical suppression not reproduced: '+c.id);
 for(const c of lanes[1].cases)for(const f of c.withoutSource)if(!c.withUnboundSource.some(g=>g.findingId===f.findingId))throw new Error('Suppression persists: '+c.id);
 console.log('Two historical suppressions reproduced; both absent in current source.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
