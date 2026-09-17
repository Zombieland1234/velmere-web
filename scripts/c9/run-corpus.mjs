/** Real FullV2 calls on frozen external bytes. Worker processes are NOT AI subagents/auditors. */
import fs from 'node:fs';import path from 'node:path';import{Worker}from'node:worker_threads';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const require=createRequire(import.meta.url);const esbuild=require('esbuild');
const [baseRoot,candidateRoot,corpusDir]=process.argv.slice(2);if(!corpusDir)throw new Error('baseRoot candidateRoot corpusDir required');
const manifestPath=path.join(corpusDir,'MANIFEST.json'), manifest=JSON.parse(fs.readFileSync(manifestPath)),inputs=JSON.parse(fs.readFileSync(path.join(corpusDir,'private-inputs.json')));
const manifestSha256=createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
const workerScript=new URL('./corpus-worker.cjs',import.meta.url);
async function lane(label,root,sourceSha,rows){
 const bundle=path.join(corpusDir,`${label}-engine.cjs`);esbuild.buildSync({entryPoints:[path.join(root,'lib/security/v2/master-audit-orchestrator.ts')],bundle:true,platform:'node',format:'cjs',outfile:bundle,logLevel:'silent'});
 const bundleSha256=createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
 const log=path.join(corpusDir,`${label}-results.jsonl`);fs.writeFileSync(log,'');
 let index=0,done=0;const results=[];
 async function runWorker(){
  let w;const spawn=()=>new Worker(workerScript,{workerData:{bundle},resourceLimits:{maxOldGenerationSizeMb:192,stackSizeMb:4}});
  w=spawn();
  try{while(index<rows.length){
   const item=rows[index++];let hex=fs.readFileSync(item.runtimeFile,'utf8').replace(/\s+/g,'').replace(/^0x/i,'');const sourceCode=item.sourceFile?fs.readFileSync(item.sourceFile,'utf8'):undefined;
   const startedAt=new Date().toISOString();let timedOut=false;
   const observed=await new Promise(resolve=>{
    const finish=(r)=>{clearTimeout(timer);w.off('message',onMessage);w.off('error',onError);w.off('exit',onExit);resolve(r);};
    const onMessage=r=>finish(r),onError=e=>finish({id:item.id,execution:'WORKER_ERROR',error:String(e.message).slice(0,200)}),onExit=code=>finish({id:item.id,execution:'WORKER_EXIT',exitCode:code});
    const timer=setTimeout(()=>{timedOut=true;finish({id:item.id,execution:'TIMEOUT',budgetMs:5000});void w.terminate();},5000);
    w.once('message',onMessage);w.once('error',onError);w.once('exit',onExit);w.postMessage({id:item.id,bytecode:'0x'+hex,sourceCode,contractName:item.contractName});
   });
   const result={...observed,sourceSha,manifestSha256,runtimeSha256:item.runtimeSha256,sourceSha256:item.sourceSha256,startedAt,finishedAt:new Date().toISOString(),scope:'EXTERNAL_MAPPED_INPUT_OFFLINE_STATIC_ANALYSIS_NOT_EXECUTED_EVM'};
   results.push(result);fs.appendFileSync(log,JSON.stringify(result)+'\n');done++;if(done%100===0)console.log(label,done,'/',rows.length);
   if(timedOut||['WORKER_ERROR','WORKER_EXIT'].includes(observed.execution)){await w.terminate();w=spawn();}
  }}finally{await w.terminate();}
 }
 await Promise.all([runWorker(),runWorker()]);
 const matrices={};const byId=new Map(results.map(r=>[r.id,r]));let ambiguous=0;
 for(const item of rows){const r=byId.get(item.id);for(const l of item.consensusLabels){if(l.ambiguous){ambiguous++;continue;}
  const m=matrices[l.swc]??={tp:0,tn:0,fp:0,fn:0,unassessed:0};
  if(!r||r.execution!=='COMPLETED'){m.unassessed++;continue;}
  const found=r.findings.some(f=>String(f.swc).replace(/^SWC-/i,'')===l.swc);
  m[l.expected?(found?'tp':'fn'):(found?'fp':'tn')]++;
 }}
 const total=Object.values(matrices).reduce((a,b)=>{for(const k of Object.keys(a))a[k]+=b[k];return a;},{tp:0,tn:0,fp:0,fn:0,unassessed:0});
 const sliceMatrix=(selected)=>{const totals={tp:0,tn:0,fp:0,fn:0,unassessed:0};for(const item of selected){const r=byId.get(item.id);for(const l of item.consensusLabels){if(l.ambiguous)continue;if(!r||r.execution!=='COMPLETED'){totals.unassessed++;continue;}const found=r.findings.some(f=>String(f.swc).replace(/^SWC-/i,'')===l.swc);totals[l.expected?(found?'tp':'fn'):(found?'fp':'tn')]++;}}return totals;};
 const split={development:{uniqueCases:Math.min(1200,rows.length),matrix:sliceMatrix(rows.slice(0,1200))},holdout:{uniqueCases:Math.max(0,rows.length-1200),matrix:sliceMatrix(rows.slice(1200))}};
 const summary={label,sourceSha,manifestSha256,selectionDigestSha256:manifest.selectionDigestSha256,split,bundleSha256,uniqueInputCount:rows.length,completed:results.filter(r=>r.execution==='COMPLETED').length,timeouts:results.filter(r=>r.execution==='TIMEOUT').length,errors:results.filter(r=>!['COMPLETED','TIMEOUT'].includes(r.execution)).length,ambiguousAssessmentPairs:ambiguous,totalAssessmentPairs:total,bySwc:matrices,resultsSha256:createHash('sha256').update(fs.readFileSync(log)).digest('hex'),interpretation:'Strict taxonomy-mapped signal comparison against CGT SWC consensus; signals are heuristic candidates, not confirmed exploits. Multiple assessments per runtime are not extra unique tests. Missing taxonomy may cause misses. Source/runtime association not independently compiled.'};
 fs.writeFileSync(path.join(corpusDir,`${label}-summary.json`),JSON.stringify(summary,null,2));return {summary,results};
}
const baselineSha='0609ef1c5aeecfab6de3ada8144efaa089064c71';
const baseline=await lane('C8',baseRoot,baselineSha,inputs);
const candidate=await lane('C9',candidateRoot,process.env.GITHUB_SHA??'LOCAL_UNCOMMITTED',inputs);
const bm=new Map(baseline.results.map(r=>[r.id,r]));const changes=candidate.results.filter(r=>r.findingsSha256!==bm.get(r.id)?.findingsSha256).map(r=>({id:r.id,before:bm.get(r.id)?.findingsSha256??null,after:r.findingsSha256??null,execution:r.execution}));
const repeat=await lane('C9-stability',candidateRoot,process.env.GITHUB_SHA??'LOCAL_UNCOMMITTED',inputs.slice(0,25));
const cm=new Map(candidate.results.map(r=>[r.id,r]));const unstable=repeat.results.filter(r=>r.execution!=='COMPLETED'||r.findingsSha256!==cm.get(r.id)?.findingsSha256).map(r=>r.id);
fs.writeFileSync(path.join(corpusDir,'COMPARISON.json'),JSON.stringify({manifestSha256,uniqueCases:inputs.length,repeatedExecutionsNotNewCases:25,baseline:baseline.summary,candidate:candidate.summary,changedOutputs:changes,stabilitySubset:{count:25,unstable}},null,2));
// Do not redistribute the downloaded third-party sources or compiled engine bundles.
fs.unlinkSync(path.join(corpusDir,'private-inputs.json'));
for(const name of ['C8','C9','C9-stability'])fs.unlinkSync(path.join(corpusDir,`${name}-engine.cjs`));
console.log(JSON.stringify({uniqueCases:inputs.length,baseline:baseline.summary.totalAssessmentPairs,candidate:candidate.summary.totalAssessmentPairs,changes:changes.length,unstable},null,2));
if(candidate.summary.errors||candidate.summary.timeouts)process.exitCode=1;
