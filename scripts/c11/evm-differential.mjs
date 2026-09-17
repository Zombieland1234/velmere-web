/** New synthetic BYTE-DISTINCT microprograms checked against EthereumJS EVM.
 * This is an independent interpreter oracle, not an independent audit service.
 * Pure local arithmetic/storage READS only; no target/network transactions.
 */
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),esbuild=require('esbuild');
const [baseRoot,candidateRoot,out,oracleRoot]=process.argv.slice(2);
if(!oracleRoot)throw new Error('base candidate out oracleRoot required');fs.mkdirSync(out,{recursive:true});
const oracleRequire=createRequire(path.join(oracleRoot,'package.json'));
const {createEVM}=oracleRequire('@ethereumjs/evm');const{Common,Mainnet,Hardfork}=oracleRequire('@ethereumjs/common');
const common=new Common({chain:Mainnet,hardfork:Hardfork.Cancun});const evm=await createEVM({common});
const mods={};for(const[label,root]of[['C10',baseRoot],['C11',candidateRoot]]){
 const bundle=path.join(out,label+'-cfg.cjs');esbuild.buildSync({entryPoints:[path.join(root,'lib/security/v2/evm-cfg-dataflow-engine.ts')],bundle:true,format:'cjs',platform:'node',outfile:bundle,logLevel:'silent'});mods[label]=require(bundle);
}
const mask=(1n<<256n)-1n;
const values=[0n,1n,2n,31n,32n,255n,256n,(1n<<255n)-1n,1n<<255n,mask];
const binary=[1,2,3,4,5,6,7,0x0a,0x0b,0x10,0x11,0x12,0x13,0x14,0x16,0x17,0x18,0x1a,0x1b,0x1c,0x1d];
const push=n=>'7f'+n.toString(16).padStart(64,'0');const cases=new Map();
function add(family,hex){const sha=createHash('sha256').update(Buffer.from(hex,'hex')).digest('hex');if(!cases.has(sha))cases.set(sha,{id:sha,family,hex});}
for(const op of binary)for(const a of values)for(const b of values)add('binary-'+op.toString(16),push(b)+push(a)+op.toString(16).padStart(2,'0')+'545000');
for(const op of[0x15,0x19])for(const a of values)add('unary-'+op.toString(16),push(a)+op.toString(16)+'545000');
for(const op of[8,9])for(const a of values)for(const b of values)for(const c of[0n,7n,mask])add('ternary-'+op,push(c)+push(b)+push(a)+op.toString(16).padStart(2,'0')+'545000');
for(let depth=1;depth<=16;depth++){
 const initial=Array.from({length:depth+1},(_,i)=>push(BigInt(i+1))).join('');
 add('DUP'+depth,initial+(0x7f+depth).toString(16)+'545000');
 add('SWAP'+depth,initial+(0x8f+depth).toString(16)+'545000');
}
// Finite branch inputs with distinct code, including computed targets and both
// condition outcomes; oracle step transitions are compared with represented CFG.
for(const condition of[0,1]){
 const h='60'+condition.toString(16).padStart(2,'0')+'600e5f0157'+'00'.repeat(7)+'5b00';
 add('conditional-computed',h);
}
const frozen=[...cases.values()];const sourceSha=process.env.GITHUB_SHA||null;
fs.writeFileSync(path.join(out,'MICROPROGRAM_MANIFEST.json'),JSON.stringify({sourceSha,oracle:'@ethereumjs/evm@10.1.3',hardfork:'Cancun',selection:'Deterministic edge-value Cartesian inputs across arithmetic, bit, DUP/SWAP and computed conditional branches. No renamed-code duplicates.',uniqueBytecodeCount:frozen.length,newMicroprogramsNotIndependentDefectFamilies:true,cases:frozen},null,2));
const rows=[];let trace=[];evm.events.on('step',s=>trace.push({pc:s.pc,opcode:s.opcode.name,stack:s.stack.map(String)}));
for(const item of frozen){
 trace=[];let exception=null;
 try{const result=await evm.runCode({code:Buffer.from(item.hex,'hex'),gasLimit:10_000_000n});exception=result.exceptionError?.error??null;}catch(e){exception=String(e.message);}
 const key=trace.find(s=>s.opcode==='SLOAD')?.stack.at(-1);const expected=key===undefined?null:'0x'+BigInt(key).toString(16);
 const row={id:item.id,family:item.family,exception,expectedStorageKey:expected,oracleExecutedInstructions:trace.length,versions:{}};
 for(const[label,mod]of Object.entries(mods)){
  try{const r=mod.buildControlFlowGraph(mod.disassembleBytecode(item.hex).instructions);const predicted=[...r.storageSlotsRead];const missingEdges=[];
   for(let i=0;i<trace.length-1;i++){
    if(!['JUMP','JUMPI'].includes(trace[i].opcode))continue;
    const block=[...r.cfg.blocks.values()].find(b=>b.instructions.some(ins=>ins.pc===trace[i].pc));
    const next=[...r.cfg.blocks.values()].find(b=>b.startPc===trace[i+1].pc);
    if(block&&next&&!block.successors.includes(next.id))missingEdges.push({pc:trace[i].pc,expectedNextPc:trace[i+1].pc});
   }
   row.versions[label]={predictedStorageKeys:predicted,missingObservedEdges:missingEdges,result:exception?'ORACLE_EXCEPTION':expected!==null&&!predicted.includes(expected)||missingEdges.length?'MISMATCH':'MATCH'};
  }catch(e){row.versions[label]={result:'ERROR',error:String(e.message)};}
 }
 rows.push(row);
}
const summary={sourceSha,oracleVersion:JSON.parse(fs.readFileSync(path.join(oracleRoot,'node_modules/@ethereumjs/evm/package.json'),'utf8')).version,hardfork:'Cancun',uniqueCases:rows.length,oracleExceptions:rows.filter(r=>r.exception).length,results:Object.fromEntries(['C10','C11'].map(v=>[v,{matched:rows.filter(r=>r.versions[v].result==='MATCH').length,mismatches:rows.filter(r=>r.versions[v].result==='MISMATCH').length,errors:rows.filter(r=>r.versions[v].result==='ERROR').length}]))};
fs.writeFileSync(path.join(out,'MICROPROGRAM_RESULTS.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');fs.writeFileSync(path.join(out,'MICROPROGRAM_SUMMARY.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
for(const v of['C10','C11'])fs.unlinkSync(path.join(out,v+'-cfg.cjs'));
if(summary.results.C11.mismatches||summary.results.C11.errors||summary.oracleExceptions)process.exitCode=1;
