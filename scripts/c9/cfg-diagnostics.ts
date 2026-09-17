/** Reproduce lost-signal paths without executing contracts or publishing their source. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [baseRoot,candidateRoot,dir]=process.argv.slice(2);
const lost=new Set(['CGT-0a7ddfb2bbe955f5fa6d1399','CGT-292684e92833cbb631d7d088','CGT-480b698c743f521189bf166b','CGT-77124fa965bbe09b1ee90187']);
async function main(){
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'private-inputs.json'),'utf8')).filter((r:{id:string})=>lost.has(r.id));
 const result=[];
 for(const row of rows){
  const hex='0x'+fs.readFileSync(row.runtimeFile,'utf8').replace(/\s/g,'').replace(/^0x/,'');
  const lanes=[];
  for(const [label,root]of [['C8',baseRoot],['C9',candidateRoot]]){
   const decoder=await import(pathToFileURL(path.join(root,'lib/security/v2/evm-cfg-dataflow-engine.ts')).href);
   const reentry=await import(pathToFileURL(path.join(root,'lib/security/v2/contextual-reentrancy-engine.ts')).href);
   const {instructions}=decoder.disassembleBytecode(hex),g=decoder.buildControlFlowGraph(instructions);
   const proof=reentry.analyzeContextualReentrancy('0x00000000000000000000000000000000000000c9',g,row.sourceFile?fs.readFileSync(row.sourceFile,'utf8'):undefined);
   const finding=proof.findings.find((f:{findingId:string})=>f.findingId==='VLM-SEC-REENTRANCY-01');
   const badTargets=[];const edges=[];
   for(const b of g.cfg.blocks.values()){
    const last=b.instructions.at(-1);
    for(const id of b.successors){
     const to=g.cfg.blocks.get(id);
     const sequential=last.pc+last.size===to.startPc;
     const edge={from:b.id,to:id,fromPc:last.pc,toPc:to.startPc,terminal:last.name,targetOpcode:to.instructions[0].name,sequential};edges.push(edge);
     if((last.name==='JUMP'||last.name==='JUMPI')&&!sequential&&to.instructions[0].name!=='JUMPDEST')badTargets.push(edge);
    }
   }
   lanes.push({label,instructionCount:instructions.length,blockCount:g.cfg.blocks.size,unresolved:g.cfg.unresolvedDynamicJumps,classicSignal:Boolean(finding),representedPath:finding?.executionPath??[],invalidStaticEdges:badTargets,edges});
  }
  const before=lanes[0],after=lanes[1];
  const afterEdges=new Set(after.edges.map(e=>`${e.from}>${e.to}`));
  const removed=before.edges.filter(e=>!afterEdges.has(`${e.from}>${e.to}`));
  result.push({id:row.id,runtimeSha256:row.runtimeSha256,baseline:{...before,edges:undefined},candidate:{...after,edges:undefined},removedEdges:removed,interpretation:'Static CFG edge comparison; not a target exploit reproduction, path feasibility proof or reassessment of external ground-truth labels'});
 }
 fs.writeFileSync(path.join(dir,'LOST_SIGNAL_CFG_DIAGNOSTICS.json'),JSON.stringify({sourceSha:process.env.GITHUB_SHA,at:new Date().toISOString(),cases:result},null,2));
 console.log(JSON.stringify(result.map(r=>({id:r.id,before:r.baseline.classicSignal,after:r.candidate.classicSignal,removedEdges:r.removedEdges.length,invalidBefore:r.baseline.invalidStaticEdges.length})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
