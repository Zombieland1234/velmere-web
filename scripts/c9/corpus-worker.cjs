const {parentPort,workerData}=require('node:worker_threads');
const {createHash}=require('node:crypto');
const {executeFullAuditV2}=require(workerData.bundle);
parentPort.on('message',({id,bytecode,sourceCode,contractName})=>{
 const start=performance.now();
 try{
  const r=executeFullAuditV2({contractAddress:'0x00000000000000000000000000000000000000c9',chainId:'1',bytecode,sourceCode,contractName,tier:'ADVANCED',fuzzIterations:16});
  const findings=r.findings.map(f=>({id:f.findingId,severity:f.severity,swc:f.taxonomy?.swcId??null,claimState:f.claimState??null,method:f.analysisMethod??null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  parentPort.postMessage({id,execution:'COMPLETED',elapsedMs:Math.round(performance.now()-start),findings,findingsSha256:createHash('sha256').update(JSON.stringify(findings)).digest('hex')});
 }catch(e){parentPort.postMessage({id,execution:'ERROR',elapsedMs:Math.round(performance.now()-start),error:String(e?.message??e).slice(0,400)});}
});
