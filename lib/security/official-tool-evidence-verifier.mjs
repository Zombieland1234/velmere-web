import crypto from "node:crypto";
const HEX64=/^[0-9a-f]{64}$/u;
const stable=(v)=>v===null||typeof v!=="object"?(JSON.stringify(v)??"null"):Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
const hash=(v)=>crypto.createHash("sha256").update(Buffer.from(stable(v),"utf8")).digest("hex");
export function verifyR44P4OfficialToolEvidence(policy,index,corpus){
 const rows=[];const failures=[];const check=(id,passed,detail=null)=>{const r={id,passed:Boolean(passed),detail};rows.push(r);if(!r.passed)failures.push(r);};
 check("policy:schema",policy?.schemaVersion==="velmere.pass36.a102r44p4.official-toolchain-platform-policy.v1",policy?.schemaVersion);
 check("index:schema",index?.schemaVersion==="velmere.pass36.a102r44p4.official-tool-execution-index.v2",index?.schemaVersion);
 check("corpus:schema",corpus?.schemaVersion==="velmere.pass36.a102r44p4.official-tool-corpus-index.v1",corpus?.schemaVersion);
 check("revision:coherent",policy?.revisionId===index?.revisionId&&policy?.revisionId===corpus?.revisionId, {policy:policy?.revisionId,index:index?.revisionId,corpus:corpus?.revisionId});
 const tools=new Map((policy?.tools??[]).map(t=>[t.toolId,t]));
 check("tools:four",tools.size===4&&["solc","slither","semgrep","forge"].every(x=>tools.has(x)),[...tools.keys()]);
 for(const [id,t] of tools){
  const copy={...t};delete copy.identitySha256;
  check(`tool:${id}:identity-hash`,HEX64.test(String(t.identitySha256??""))&&hash(copy)===t.identitySha256,t);
  check(`tool:${id}:version-and-executable`,typeof t.requiredVersion==="string"&&t.versionMatched===true&&HEX64.test(String(t.executableSha256??"")),t);
  if(id==="slither"||id==="semgrep")check(`tool:${id}:interpreter`,HEX64.test(String(t.interpreterSha256??"")),t.interpreterSha256);
 }
 check("semgrep:migrated",tools.get("semgrep")?.requiredVersion==="1.130.0",tools.get("semgrep"));
 const cases=new Map((corpus?.cases??[]).map(c=>[c.caseId,c]));
 check("corpus:50",cases.size===50&&corpus.caseCount===50,cases.size);
 check("index:summary",index?.requiredExecutions===200&&index?.executed===200&&index?.uniqueExecutionKeys===200&&index?.completedOfficialExecutions===200&&index?.findingsExecutions===58&&index?.toolErrors===0,index);
 const keys=new Set();const counts={solc:0,slither:0,semgrep:0,forge:0};let completed=0;let findings=0;
 for(const row of index?.rows??[]){
  const key=`${row.tool}:${row.caseId}`;check(`row:${key}:unique`,!keys.has(key));keys.add(key);
  const t=tools.get(row.tool);const c=cases.get(row.caseId);check(`row:${key}:known`,Boolean(t&&c),{tool:row.tool,caseId:row.caseId});
  if(!t||!c)continue;counts[row.tool]+=1;
  check(`row:${key}:source`,row.sourceSha256===c.sourceSha256&&row.sourceFilename===c.filename,row);
  check(`row:${key}:digests`,[row.stdoutSha256,row.stderrSha256,row.receiptSha256].every(x=>HEX64.test(String(x))),row);
  check(`row:${key}:identity`,row.toolIdentitySha256===t.identitySha256,row.toolIdentitySha256);
  check(`row:${key}:credit-boundary`,row.officialExecutionCredit===true&&row.realAuditCredit===false&&row.customerCredit===false&&row.liveCredit===false,row);
  let valid;
  if(row.tool==="slither"&&row.terminalStatus==="EXECUTED_FINDINGS")valid=row.exitCode===255&&row.parsedResult?.jsonSuccess===true&&row.parsedResult?.detectorCount>0;
  else if(row.tool==="slither")valid=row.exitCode===0&&row.parsedResult?.jsonSuccess===true;
  else if(row.tool==="semgrep"&&row.terminalStatus==="EXECUTED_FINDINGS")valid=row.exitCode===0&&row.parsedResult?.errorCount===0&&row.parsedResult?.resultCount>0;
  else if(row.tool==="semgrep")valid=row.exitCode===0&&row.parsedResult?.errorCount===0;
  else valid=row.exitCode===0&&row.terminalStatus==="EXECUTED_SUCCESS";
  check(`row:${key}:completion-semantics`,valid,row);if(valid)completed+=1;if(row.terminalStatus==="EXECUTED_FINDINGS")findings+=1;
 }
 check("rows:200",(index?.rows??[]).length===200&&keys.size===200,{rows:index?.rows?.length,keys:keys.size});
 check("rows:50-each",Object.values(counts).every(x=>x===50),counts);
 check("rows:completed-200",completed===200,completed);check("rows:findings-58",findings===58,findings);
 check("global:fail-closed",index?.realAuditCredit===0&&index?.customerCredit===0&&index?.liveCredit===0&&index?.saleEnabled===false,index);
 return {schemaVersion:"velmere.pass36.a102r44p4.official-tool-evidence-verification.v1",status:failures.length?"FAIL":"PASS_200_OFFICIAL_TOOL_EXECUTIONS_LOCAL_CI_ONLY",checks:rows.length,passed:rows.length-failures.length,failed:failures.length,counts,completed,findings,failures,rows,realAuditCredit:0,customerCredit:0,liveCredit:0,saleEnabled:false};
}
