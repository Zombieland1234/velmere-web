import { createHash } from "node:crypto";

const POLICY_SCHEMA = "velmere.pass35.a21-abstract-path-policy.v1";
const INPUT_SCHEMA = "velmere.pass35.a21-abstract-path-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a21-abstract-path-report.v1";
const BENCHMARK_SCHEMA = "velmere.pass35.a21-abstract-path-benchmark.v1";
const CASE_RE = /^AUD-[A-Z0-9-]{8,64}$/u;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/iu;
const HEX_RE = /^0x(?:[a-f0-9]{2})+$/iu;
const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/iu;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const MOD = 1n << 256n;

const OPCODES = new Map([
  [0x00,"STOP"],[0x01,"ADD"],[0x02,"MUL"],[0x03,"SUB"],[0x04,"DIV"],[0x06,"MOD"],
  [0x10,"LT"],[0x11,"GT"],[0x12,"SLT"],[0x13,"SGT"],[0x14,"EQ"],[0x15,"ISZERO"],
  [0x16,"AND"],[0x17,"OR"],[0x18,"XOR"],[0x1b,"SHL"],[0x1c,"SHR"],
  [0x30,"ADDRESS"],[0x32,"ORIGIN"],[0x33,"CALLER"],[0x34,"CALLVALUE"],[0x35,"CALLDATALOAD"],
  [0x42,"TIMESTAMP"],[0x43,"NUMBER"],[0x46,"CHAINID"],[0x50,"POP"],[0x51,"MLOAD"],[0x52,"MSTORE"],
  [0x54,"SLOAD"],[0x55,"SSTORE"],[0x56,"JUMP"],[0x57,"JUMPI"],[0x58,"PC"],[0x5b,"JUMPDEST"],[0x5f,"PUSH0"],
  [0xf0,"CREATE"],[0xf1,"CALL"],[0xf2,"CALLCODE"],[0xf3,"RETURN"],[0xf4,"DELEGATECALL"],
  [0xf5,"CREATE2"],[0xfa,"STATICCALL"],[0xfd,"REVERT"],[0xfe,"INVALID"],[0xff,"SELFDESTRUCT"],
]);
for(let op=0x60;op<=0x7f;op++)OPCODES.set(op,`PUSH${op-0x5f}`);
for(let op=0x80;op<=0x8f;op++)OPCODES.set(op,`DUP${op-0x7f}`);
for(let op=0x90;op<=0x9f;op++)OPCODES.set(op,`SWAP${op-0x8f}`);
const RISK_OPS = new Set(["SSTORE","CALL","CALLCODE","DELEGATECALL","CREATE","CREATE2","SELFDESTRUCT"]);
const TERMINALS = new Set(["STOP","RETURN","REVERT","INVALID","SELFDESTRUCT"]);

function stable(value){
  if(typeof value === "bigint") return JSON.stringify(value.toString());
  if(value===null||typeof value!=="object")return JSON.stringify(value)??"null";
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const sha256=(value)=>`sha256:${createHash("sha256").update(typeof value==="string"||Buffer.isBuffer(value)?value:stable(value)).digest("hex")}`;
const normDigest=(value)=>{const text=String(value??"").toLowerCase();if(!DIGEST_RE.test(text))return null;return text.startsWith("sha256:")?text:`sha256:${text}`;};
const u256=(value)=>((value%MOD)+MOD)%MOD;
const c=(value)=>({kind:"CONST",value:u256(BigInt(value))});
const variable=(id)=>({kind:"VAR",id});
const unknown=(reason)=>({kind:"UNKNOWN",reason});
const pred=(op,id,value,negated=false)=>({kind:"PRED",op,id,value:u256(BigInt(value)),negated});
const cloneValue=(value)=>value?.kind==="CONST"?c(value.value):value?structuredClone(value):unknown("missing");
const valueJson=(value)=>value?.kind==="CONST"?{kind:"CONST",value:`0x${value.value.toString(16)}`}:value?.kind==="PRED"?{kind:"PRED",op:value.op,variable:value.id,constant:`0x${value.value.toString(16)}`,negated:Boolean(value.negated)}:value?.kind==="VAR"?{kind:"VAR",id:value.id}:{kind:"UNKNOWN",reason:value?.reason??"unknown"};

function decode(hex){
  const bytes=Buffer.from(hex.slice(2),"hex");const rows=[];let truncatedPush=0;
  for(let pc=0;pc<bytes.length;){
    const opcode=bytes[pc];const pushBytes=opcode>=0x60&&opcode<=0x7f?opcode-0x5f:0;const available=Math.min(pushBytes,bytes.length-pc-1);
    if(available!==pushBytes)truncatedPush++;
    const data=bytes.subarray(pc+1,pc+1+available);
    rows.push({pc,opcode,name:OPCODES.get(opcode)??`UNKNOWN_0x${opcode.toString(16).padStart(2,"0")}`,size:1+available,pushBytes,pushHex:pushBytes?`0x${data.toString("hex")}`:null,pushValue:pushBytes&&available===pushBytes?BigInt(`0x${data.toString("hex")||"0"}`):null});
    pc+=1+available;
  }
  return {bytes,rows,truncatedPush};
}

function initialConstraint(){return {eq:null,neq:new Set(),min:0n,max:MOD-1n};}
function cloneConstraints(constraints){const next=new Map();for(const [id,row] of constraints)next.set(id,{eq:row.eq,neq:new Set(row.neq),min:row.min,max:row.max});return next;}
function constraintJson(constraints){return [...constraints.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,row])=>({variable:id,equal:row.eq===null?null:`0x${row.eq.toString(16)}`,notEqual:[...row.neq].sort((a,b)=>a<b?-1:a>b?1:0).map((v)=>`0x${v.toString(16)}`),minInclusive:`0x${row.min.toString(16)}`,maxInclusive:`0x${row.max.toString(16)}`}));}
function contradiction(row){if(row.min>row.max)return true;if(row.eq!==null&&(row.eq<row.min||row.eq>row.max||row.neq.has(row.eq)))return true;if(row.min===row.max&&row.neq.has(row.min))return true;return false;}
function invertPredicate(value){if(value.kind!=="PRED")return value;return {...value,negated:!value.negated};}
function applyPredicate(constraints,value,wantTrue){
  if(value.kind==="CONST")return {status:(value.value!==0n)===wantTrue?"FEASIBLE":"INFEASIBLE",constraints,reason:(value.value!==0n)===wantTrue?"CONSTANT_BRANCH":"CONSTANT_CONTRADICTION",variable:null};
  if(value.kind==="UNKNOWN")return {status:"UNKNOWN",constraints,reason:"UNSUPPORTED_EXPRESSION",variable:null};
  let condition=value;
  if(value.kind==="VAR")condition=pred("NEQ",value.id,0n,false);
  if(condition.kind!=="PRED")return {status:"UNKNOWN",constraints,reason:"UNSUPPORTED_EXPRESSION",variable:null};
  const effective = condition.negated ? !wantTrue : wantTrue;
  const next=cloneConstraints(constraints);const row=next.get(condition.id)??initialConstraint();next.set(condition.id,row);
  const valueConst=condition.value;
  if(condition.op==="EQ"){
    if(effective){if(row.eq!==null&&row.eq!==valueConst){row.min=1n;row.max=0n;}else row.eq=valueConst;}else row.neq.add(valueConst);
  }else if(condition.op==="NEQ"){
    if(effective)row.neq.add(valueConst);else row.eq=valueConst;
  }else if(condition.op==="LT"){
    if(effective)row.max=valueConst===0n?-1n:(valueConst-1n);else row.min=valueConst;
  }else if(condition.op==="GT"){
    if(effective)row.min=valueConst===MOD-1n?MOD:(valueConst+1n);else row.max=valueConst;
  }else return {status:"UNKNOWN",constraints,reason:"UNSUPPORTED_PREDICATE",variable:condition.id};
  return contradiction(row)?{status:"INFEASIBLE",constraints:next,reason:"CONSTRAINT_CONTRADICTION",variable:condition.id}:{status:"FEASIBLE",constraints:next,reason:"SUPPORTED_CONSTRAINT",variable:condition.id};
}
function binary(op,left,right){
  if(left.kind==="CONST"&&right.kind==="CONST"){
    const a=left.value,b=right.value;
    if(op==="ADD")return c(a+b);if(op==="SUB")return c(a-b);if(op==="MUL")return c(a*b);if(op==="DIV")return c(b===0n?0n:a/b);if(op==="MOD")return c(b===0n?0n:a%b);
    if(op==="AND")return c(a&b);if(op==="OR")return c(a|b);if(op==="XOR")return c(a^b);if(op==="SHL")return c(b>=256n?0n:a<<b);if(op==="SHR")return c(b>=256n?0n:a>>b);
    if(op==="EQ")return c(a===b?1n:0n);if(op==="LT"||op==="SLT")return c(a<b?1n:0n);if(op==="GT"||op==="SGT")return c(a>b?1n:0n);
  }
  const varSide=left.kind==="VAR"&&right.kind==="CONST"?{id:left.id,value:right.value,flip:false}:right.kind==="VAR"&&left.kind==="CONST"?{id:right.id,value:left.value,flip:true}:null;
  if(varSide&&["EQ","LT","GT","SLT","SGT"].includes(op)){
    if(op==="EQ")return pred("EQ",varSide.id,varSide.value);
    let normalized=op==="LT"||op==="SLT"?"LT":"GT";
    if(varSide.flip)normalized=normalized==="LT"?"GT":"LT";
    return pred(normalized,varSide.id,varSide.value);
  }
  return unknown(`${op}_unsupported_operands`);
}
function riskSeverity(op){return op==="SELFDESTRUCT"?"high":op==="DELEGATECALL"||op==="CALLCODE"?"medium":op==="CALL"||op==="SSTORE"||op==="CREATE"||op==="CREATE2"?"low":"informational";}
function validateInput(input,policy){
  const errors=[];const add=(ok,code)=>{if(!ok)errors.push(code);};
  add(input?.schemaVersion===INPUT_SCHEMA,"a21_schema_invalid");add(["SYNTHETIC_OFFLINE","CUSTOMER_SUPPLIED_UNVERIFIED","CUSTOMER_SUPPLIED_VERIFIED"].includes(input?.inputClass),"a21_input_class_invalid");
  add(CASE_RE.test(String(input?.caseRef??"")),"a21_case_ref_invalid");add(ISO_RE.test(String(input?.observedAt??"")),"a21_observed_at_invalid");add(/^\d+$/u.test(String(input?.chainId??"")),"a21_chain_id_invalid");add(ADDRESS_RE.test(String(input?.contractAddress??"")),"a21_contract_address_invalid");add(HEX_RE.test(String(input?.deployedRuntimeBytecode??"")),"a21_bytecode_invalid");
  const bytes=HEX_RE.test(String(input?.deployedRuntimeBytecode??""))?Buffer.byteLength(String(input.deployedRuntimeBytecode).slice(2),"hex"):0;add(bytes>0&&bytes<=policy.limits.maxBytecodeBytes,"a21_bytecode_size_invalid");
  if(input?.chainProviderReceiptSha256!=null)add(normDigest(input.chainProviderReceiptSha256)!==null,"a21_provider_digest_invalid");
  const limits={maxStates:Number(input?.limits?.maxStates??policy.limits.maxStates),maxSteps:Number(input?.limits?.maxSteps??policy.limits.maxSteps),maxVisitsPerPc:Number(input?.limits?.maxVisitsPerPc??policy.limits.maxVisitsPerPc),maxStackDepth:Number(input?.limits?.maxStackDepth??policy.limits.maxStackDepth)};
  add(Number.isInteger(limits.maxStates)&&limits.maxStates>=1&&limits.maxStates<=policy.limits.maxStates,"a21_max_states_invalid");add(Number.isInteger(limits.maxSteps)&&limits.maxSteps>=1&&limits.maxSteps<=policy.limits.maxSteps,"a21_max_steps_invalid");add(Number.isInteger(limits.maxVisitsPerPc)&&limits.maxVisitsPerPc>=1&&limits.maxVisitsPerPc<=policy.limits.maxVisitsPerPc,"a21_max_visits_invalid");add(Number.isInteger(limits.maxStackDepth)&&limits.maxStackDepth>=8&&limits.maxStackDepth<=policy.limits.maxStackDepth,"a21_stack_limit_invalid");
  return {errors:[...new Set(errors)].sort(),limits};
}

export function verifyA21Policy(policy){return Boolean(policy&&policy.schemaVersion===POLICY_SCHEMA&&policy.passId==="PASS35_A21"&&Array.isArray(policy.benchmark?.families)&&policy.benchmark.families.length===12&&policy.benchmark.expectedCases===192&&policy.benchmark.expectedMutations===2304&&policy.thresholds.minimumFrozenRecall===1&&policy.thresholds.minimumFrozenSpecificity===1&&policy.thresholds.minimumMutationMatchRate===1);}

export function analyzeA21PathCase(input,policy){
  if(!verifyA21Policy(policy))throw new Error("a21_policy_invalid");const validated=validateInput(input,policy);const blockers=[...validated.errors];
  const runtimeHex=HEX_RE.test(String(input?.deployedRuntimeBytecode??""))?String(input.deployedRuntimeBytecode).toLowerCase():null;const decoded=runtimeHex?decode(runtimeHex):{bytes:null,rows:[],truncatedPush:0};if(decoded.truncatedPush>0)blockers.push("a21_truncated_push_data");
  const byPc=new Map(decoded.rows.map((row)=>[row.pc,row]));const jumpDests=new Set(decoded.rows.filter((row)=>row.name==="JUMPDEST").map((row)=>row.pc));
  const staticRiskOpcodeCounts={};for(const row of decoded.rows)if(RISK_OPS.has(row.name))staticRiskOpcodeCounts[row.name]=(staticRiskOpcodeCounts[row.name]??0)+1;
  const limits=validated.limits;const queue=[];if(!blockers.length&&decoded.rows.length)queue.push({pc:decoded.rows[0].pc,stack:[],constraints:new Map(),visits:new Map(),steps:0,unknownFeasibility:false,pathId:"P000001"});
  const terminals=[];const prunedBranches=[];const riskSignals=[];const unresolvedDynamicJumps=[];let statesCreated=queue.length;let maxObservedStack=0;let maxObservedSteps=0;let truncatedByStateLimit=false,truncatedByStepLimit=false,truncatedByVisitLimit=false,truncatedByStackLimit=false;let nextPath=2;
  const enqueue=(state)=>{if(statesCreated>=limits.maxStates){truncatedByStateLimit=true;return;}state.pathId=`P${String(nextPath++).padStart(6,"0")}`;queue.push(state);statesCreated++;};
  const terminate=(state,kind,pc,details={})=>{terminals.push({pathId:state.pathId,terminalKind:kind,programCounter:pc,steps:state.steps,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),...details});};
  while(queue.length){
    const state=queue.pop();maxObservedStack=Math.max(maxObservedStack,state.stack.length);maxObservedSteps=Math.max(maxObservedSteps,state.steps);
    if(state.steps>=limits.maxSteps){truncatedByStepLimit=true;terminate(state,"STEP_LIMIT",state.pc);continue;}
    const seen=(state.visits.get(state.pc)??0)+1;if(seen>limits.maxVisitsPerPc){truncatedByVisitLimit=true;terminate(state,"VISIT_LIMIT",state.pc);continue;}state.visits.set(state.pc,seen);
    const ins=byPc.get(state.pc);if(!ins){terminate(state,"INVALID_PC",state.pc);continue;}state.steps++;
    const nextPc=ins.pc+ins.size;const pop=()=>state.stack.length?state.stack.pop():unknown("stack_underflow");const push=(value)=>{if(state.stack.length>=limits.maxStackDepth){truncatedByStackLimit=true;return false;}state.stack.push(value);return true;};
    if(ins.name==="PUSH0")push(c(0));else if(ins.pushBytes>0)push(ins.pushValue===null?unknown("truncated_push"):c(ins.pushValue));
    else if(ins.name.startsWith("DUP")){const n=Number(ins.name.slice(3));push(cloneValue(state.stack.at(-n)??unknown("dup_underflow")));}
    else if(ins.name.startsWith("SWAP")){const n=Number(ins.name.slice(4));const a=state.stack.length-1,b=state.stack.length-1-n;if(b<0)state.stack.push(unknown("swap_underflow"));else [state.stack[a],state.stack[b]]=[state.stack[b],state.stack[a]];}
    else if(ins.name==="POP")pop();
    else if(ins.name==="CALLDATALOAD"){const offset=pop();push(offset.kind==="CONST"?variable(`CALLDATA:${offset.value}`):unknown("calldata_dynamic_offset"));}
    else if(ins.name==="CALLER")push(variable("CALLER"));else if(ins.name==="ORIGIN")push(variable("ORIGIN"));else if(ins.name==="CALLVALUE")push(variable("CALLVALUE"));else if(ins.name==="TIMESTAMP")push(variable("TIMESTAMP"));else if(ins.name==="NUMBER")push(variable("NUMBER"));else if(ins.name==="CHAINID")push(variable("CHAINID"));else if(ins.name==="ADDRESS")push(variable("ADDRESS"));else if(ins.name==="PC")push(c(ins.pc));
    else if(ins.name==="SLOAD"){const slot=pop();push(slot.kind==="CONST"?variable(`STORAGE:${slot.value}`):unknown("storage_dynamic_slot"));}
    else if(["ADD","SUB","MUL","DIV","MOD","AND","OR","XOR","SHL","SHR","EQ","LT","GT","SLT","SGT"].includes(ins.name)){const right=pop(),left=pop();push(binary(ins.name,left,right));}
    else if(ins.name==="ISZERO"){const value=pop();if(value.kind==="CONST")push(c(value.value===0n?1n:0n));else if(value.kind==="PRED")push(invertPredicate(value));else if(value.kind==="VAR")push(pred("EQ",value.id,0n));else push(unknown("iszero_unknown"));}
    else if(ins.name==="MLOAD"){pop();push(unknown("memory_value"));}else if(ins.name==="MSTORE"){pop();pop();}
    else if(ins.name==="SSTORE"){const slot=pop(),value=pop();riskSignals.push({signalId:`A21-SSTORE-${state.pathId}-${ins.pc}`,opcode:"SSTORE",severity:riskSeverity("SSTORE"),programCounter:ins.pc,pathId:state.pathId,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),prerequisites:[`storage slot ${stable(valueJson(slot))} is written with ${stable(valueJson(value))}`],evidence:"SSTORE is executed on an explored non-pruned path; authorization and exploitability are not inferred."});}
    else if(["CALL","CALLCODE"].includes(ins.name)){for(let i=0;i<7;i++)pop();riskSignals.push({signalId:`A21-${ins.name}-${state.pathId}-${ins.pc}`,opcode:ins.name,severity:riskSeverity(ins.name),programCounter:ins.pc,pathId:state.pathId,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),prerequisites:["external call arguments are abstracted"],evidence:`${ins.name} is executed on an explored non-pruned path; reentrancy or exploitability is not inferred.`});push(unknown(`${ins.name}_result`));}
    else if(["DELEGATECALL","STATICCALL"].includes(ins.name)){for(let i=0;i<6;i++)pop();if(ins.name==="DELEGATECALL")riskSignals.push({signalId:`A21-DELEGATECALL-${state.pathId}-${ins.pc}`,opcode:"DELEGATECALL",severity:riskSeverity("DELEGATECALL"),programCounter:ins.pc,pathId:state.pathId,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),prerequisites:["delegate target and calldata remain abstract"],evidence:"DELEGATECALL is executed on an explored non-pruned path; target safety and exploitability are not inferred."});push(unknown(`${ins.name}_result`));}
    else if(["CREATE","CREATE2"].includes(ins.name)){for(let i=0;i<(ins.name==="CREATE2"?4:3);i++)pop();riskSignals.push({signalId:`A21-${ins.name}-${state.pathId}-${ins.pc}`,opcode:ins.name,severity:riskSeverity(ins.name),programCounter:ins.pc,pathId:state.pathId,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),prerequisites:["creation bytecode is not modeled"],evidence:`${ins.name} is executed on an explored non-pruned path; deployment safety is not inferred.`});push(unknown(`${ins.name}_address`));}
    if(truncatedByStackLimit){terminate(state,"STACK_LIMIT",ins.pc);continue;}
    if(ins.name==="JUMP"){
      const dest=pop();if(dest.kind==="CONST"&&jumpDests.has(Number(dest.value))){state.pc=Number(dest.value);queue.push(state);}else{unresolvedDynamicJumps.push({pathId:state.pathId,programCounter:ins.pc,destination:valueJson(dest),constraints:constraintJson(state.constraints)});terminate(state,"UNRESOLVED_DYNAMIC_JUMP",ins.pc);}continue;
    }
    if(ins.name==="JUMPI"){
      const dest=pop(),condition=pop();const staticTarget=dest.kind==="CONST"&&jumpDests.has(Number(dest.value))?Number(dest.value):null;
      if(staticTarget===null){unresolvedDynamicJumps.push({pathId:state.pathId,programCounter:ins.pc,destination:valueJson(dest),condition:valueJson(condition),constraints:constraintJson(state.constraints)});terminate(state,"UNRESOLVED_DYNAMIC_JUMPI",ins.pc);continue;}
      const trueResult=applyPredicate(state.constraints,condition,true);const falseResult=applyPredicate(state.constraints,condition,false);
      const branch=(kind,target,result)=>{if(result.status==="INFEASIBLE"){prunedBranches.push({pathId:state.pathId,programCounter:ins.pc,branch:kind,targetPc:target,reason:result.reason,variable:result.variable,condition:valueJson(condition),constraints:constraintJson(result.constraints)});return;}const child={pc:target,stack:state.stack.map(cloneValue),constraints:result.constraints,visits:new Map(state.visits),steps:state.steps,unknownFeasibility:state.unknownFeasibility||result.status==="UNKNOWN",pathId:state.pathId};enqueue(child);};
      branch("TRUE",staticTarget,trueResult);branch("FALSE",nextPc,falseResult);continue;
    }
    if(TERMINALS.has(ins.name)){
      if(ins.name==="SELFDESTRUCT"){pop();riskSignals.push({signalId:`A21-SELFDESTRUCT-${state.pathId}-${ins.pc}`,opcode:"SELFDESTRUCT",severity:"high",programCounter:ins.pc,pathId:state.pathId,feasibility:state.unknownFeasibility?"UNKNOWN_UNSUPPORTED_EXPRESSION":"SUPPORTED_CONSTRAINT_FEASIBLE",constraints:constraintJson(state.constraints),prerequisites:["beneficiary and authorization are not modeled"],evidence:"SELFDESTRUCT is executed on an explored non-pruned path; exploitability is not inferred."});}
      terminate(state,ins.name,ins.pc);continue;
    }
    if(ins.name.startsWith("UNKNOWN_"))state.unknownFeasibility=true;
    state.pc=nextPc;queue.push(state);
  }
  riskSignals.sort((a,b)=>`${a.opcode}|${a.programCounter}|${a.pathId}`.localeCompare(`${b.opcode}|${b.programCounter}|${b.pathId}`));prunedBranches.sort((a,b)=>`${a.programCounter}|${a.branch}|${a.targetPc}|${a.pathId}`.localeCompare(`${b.programCounter}|${b.branch}|${b.targetPc}|${b.pathId}`));terminals.sort((a,b)=>`${a.terminalKind}|${a.programCounter}|${a.pathId}`.localeCompare(`${b.terminalKind}|${b.programCounter}|${b.pathId}`));
  const unsupportedOpcodeCount=decoded.rows.filter((row)=>row.name.startsWith("UNKNOWN_")).length;const realCaseExecution=blockers.length===0&&input.inputClass!=="SYNTHETIC_OFFLINE"&&normDigest(input.chainProviderReceiptSha256)!==null;
  const findingFamilies=[];const addFamily=(id,ok)=>{if(ok)findingFamilies.push(id);};
  addFamily("CONSTANT_FALSE_BRANCH_PRUNED",prunedBranches.some((row)=>row.reason==="CONSTANT_CONTRADICTION"&&row.branch==="TRUE"));
  addFamily("CONSTANT_TRUE_FALLTHROUGH_PRUNED",prunedBranches.some((row)=>row.reason==="CONSTANT_CONTRADICTION"&&row.branch==="FALSE"));
  addFamily("CONTRADICTORY_CALLDATA_BRANCH_PRUNED",prunedBranches.some((row)=>row.reason==="CONSTRAINT_CONTRADICTION"&&String(row.variable).startsWith("CALLDATA:")&&row.branch==="TRUE"));
  addFamily("CONTRADICTORY_CALLER_BRANCH_PRUNED",prunedBranches.some((row)=>row.reason==="CONSTRAINT_CONTRADICTION"&&row.variable==="CALLER"&&row.branch==="TRUE"));
  addFamily("CONTRADICTORY_CALLVALUE_RANGE_PRUNED",prunedBranches.some((row)=>row.reason==="CONSTRAINT_CONTRADICTION"&&row.variable==="CALLVALUE"&&row.branch==="TRUE"));
  for(const op of ["SELFDESTRUCT","DELEGATECALL","CALL","SSTORE"])addFamily(`REACHABLE_${op}`,riskSignals.some((row)=>row.opcode===op));
  addFamily("UNREACHABLE_SELFDESTRUCT_SUPPRESSED",Boolean(staticRiskOpcodeCounts.SELFDESTRUCT)&&!riskSignals.some((row)=>row.opcode==="SELFDESTRUCT")&&prunedBranches.length>0);
  addFamily("DYNAMIC_JUMP_UNRESOLVED",unresolvedDynamicJumps.length>0);
  addFamily("VISIT_LIMIT_TRUNCATION",truncatedByVisitLimit);
  addFamily("STEP_LIMIT_TRUNCATION",truncatedByStepLimit);
  const core={schemaVersion:REPORT_SCHEMA,passId:"PASS35_A21",sourceRevisionId:policy.sourceRevisionId,caseRef:String(input?.caseRef??""),inputClass:input?.inputClass,target:{chainId:String(input?.chainId??""),contractAddress:String(input?.contractAddress??"").toLowerCase(),runtimeBytecodeSha256:decoded.bytes?sha256(decoded.bytes):null,runtimeByteLength:decoded.bytes?.length??null,chainProviderReceiptSha256:normDigest(input?.chainProviderReceiptSha256)},execution:{status:blockers.length?"BLOCKED":"VERIFIED_LOCAL_BOUNDED_ABSTRACT_PATH",assuranceClass:"LOCAL_BOUNDED_ABSTRACT_INTERPRETATION_NOT_FULL_SMT",realCaseExecution,paidGateEligible:false,fullAuditClaimAllowed:false,promotionAllowed:false},decoder:{instructionCount:decoded.rows.length,pushInstructionCount:decoded.rows.filter((row)=>row.pushBytes>0).length,unsupportedOpcodeCount,truncatedPushCount:decoded.truncatedPush},analysis:{statesCreated,terminalPathCount:terminals.length,prunedBranchCount:prunedBranches.length,unresolvedDynamicJumpCount:unresolvedDynamicJumps.length,maxObservedStack,maxObservedSteps,truncatedByStateLimit,truncatedByStepLimit,truncatedByVisitLimit,truncatedByStackLimit,limits,staticRiskOpcodeCounts},terminalPaths:terminals,prunedBranches,unresolvedDynamicJumps,riskSignals,findingFamilies:[...new Set(findingFamilies)].sort(),blockers:[...new Set(blockers)].sort(),limitations:["The engine performs bounded abstract interpretation over a deliberately limited EVM opcode and predicate domain.","Constraint reasoning supports constants and simple equality/range predicates over calldata words, caller, call value, block context and constant storage slots.","Memory, keccak-derived storage, dynamic arrays, gas, balances, call return semantics, aliases and full inter-contract state are not modeled.","No SMT solver, path-complete symbolic execution, exploit proof, economic replay or manual business-logic adjudication is claimed.","Reachable risk opcodes are review signals with path prerequisites, not vulnerability findings.","Generated benchmark performance cannot be generalized to real protocols without a frozen external corpus and independent review."],truthBoundary:policy.truthBoundary};
  return {...core,reportSha256:sha256(core)};
}

function pushBytes(value,bytes=2){const v=BigInt(value);const out=[];for(let i=bytes-1;i>=0;i--)out.push(Number((v>>BigInt(i*8))&0xffn));return [0x5f+bytes,...out];}
function assembler(items){
  const labels=new Map();let pc=0;for(const item of items){if(item.label){labels.set(item.label,pc);continue;}if(item.pushLabel){pc+=3;continue;}if(item.push!==undefined){pc+=1+(item.bytes??1);continue;}pc+=1;}
  const bytes=[];for(const item of items){if(item.label)continue;if(item.pushLabel){bytes.push(...pushBytes(labels.get(item.pushLabel)??0,2));continue;}if(item.push!==undefined){bytes.push(...pushBytes(item.push,item.bytes??1));continue;}const opcode=[...OPCODES.entries()].find(([,name])=>name===item.op)?.[0];if(opcode===undefined)throw new Error(`a21_assembler_opcode:${item.op}`);bytes.push(opcode);}return `0x${Buffer.from(bytes).toString("hex")}`;
}
const branch=(condition,riskOp)=>assembler([...condition,{pushLabel:"risk"},{op:"JUMPI"},{op:"STOP"},{label:"risk"},{op:"JUMPDEST"},...(riskOp==="SELFDESTRUCT"?[{push:0},{op:"SELFDESTRUCT"}]:riskOp==="SSTORE"?[{push:1},{push:0},{op:"SSTORE"},{op:"STOP"}]:riskOp==="DELEGATECALL"?[{push:0},{push:0},{push:0},{push:0},{push:0},{push:0},{op:"DELEGATECALL"},{op:"STOP"}]:riskOp==="CALL"?[{push:0},{push:0},{push:0},{push:0},{push:0},{push:0},{push:0},{op:"CALL"},{op:"STOP"}]:[{op:"STOP"}])]);
const calldataEq=(value)=>[{push:0},{op:"CALLDATALOAD"},{push:value,bytes:2},{op:"EQ"}];
const callerEq=(value)=>[{op:"CALLER"},{push:value,bytes:20},{op:"EQ"}];
function nestedContradiction(variableKind,a,b,risk="SELFDESTRUCT"){
  const first=variableKind==="CALLDATA"?calldataEq(a):variableKind==="CALLER"?callerEq(a):[{op:"CALLVALUE"},{push:a},{op:"LT"}];
  const second=variableKind==="CALLDATA"?calldataEq(b):variableKind==="CALLER"?callerEq(b):[{op:"CALLVALUE"},{push:b},{op:"GT"}];
  return assembler([...first,{pushLabel:"inner"},{op:"JUMPI"},{op:"STOP"},{label:"inner"},{op:"JUMPDEST"},...second,{pushLabel:"risk"},{op:"JUMPI"},{op:"STOP"},{label:"risk"},{op:"JUMPDEST"},{push:0},{op:risk}]);
}
export function buildA21BenchmarkCase(family,enabled,index){
  const common={schemaVersion:INPUT_SCHEMA,inputClass:"SYNTHETIC_OFFLINE",caseRef:`AUD-A21-${family.replaceAll("_","").slice(0,28)}-${String(index).padStart(3,"0")}-${enabled?"V":"R"}`,observedAt:"2026-07-23T08:00:00.000Z",chainId:"1",contractAddress:`0x${(index+1).toString(16).padStart(40,"0")}`,chainProviderReceiptSha256:`sha256:${"a".repeat(64)}`};
  let bytecode;let limits={maxStates:256,maxSteps:512,maxVisitsPerPc:3,maxStackDepth:128};
  if(family==="CONSTANT_FALSE_BRANCH_PRUNED")bytecode=enabled?branch([{push:0}],"SELFDESTRUCT"):branch([{push:1}],"SELFDESTRUCT");
  else if(family==="CONSTANT_TRUE_FALLTHROUGH_PRUNED")bytecode=enabled?assembler([{push:1},{pushLabel:"safe"},{op:"JUMPI"},{push:0},{op:"SELFDESTRUCT"},{label:"safe"},{op:"JUMPDEST"},{op:"STOP"}]):assembler([{push:0},{pushLabel:"safe"},{op:"JUMPI"},{push:0},{op:"SELFDESTRUCT"},{label:"safe"},{op:"JUMPDEST"},{op:"STOP"}]);
  else if(family==="CONTRADICTORY_CALLDATA_BRANCH_PRUNED")bytecode=nestedContradiction("CALLDATA",10+index,enabled?20+index:10+index);
  else if(family==="CONTRADICTORY_CALLER_BRANCH_PRUNED")bytecode=nestedContradiction("CALLER",0x100+index,enabled?0x200+index:0x100+index);
  else if(family==="CONTRADICTORY_CALLVALUE_RANGE_PRUNED")bytecode=nestedContradiction("CALLVALUE",10,enabled?20:5);
  else if(family==="REACHABLE_SELFDESTRUCT")bytecode=enabled?branch(calldataEq(index+1),"SELFDESTRUCT"):branch([{push:0}],"SELFDESTRUCT");
  else if(family==="REACHABLE_DELEGATECALL")bytecode=enabled?branch(calldataEq(index+1),"DELEGATECALL"):branch([{push:0}],"DELEGATECALL");
  else if(family==="REACHABLE_CALL")bytecode=enabled?branch(calldataEq(index+1),"CALL"):branch([{push:0}],"CALL");
  else if(family==="REACHABLE_SSTORE")bytecode=enabled?branch(calldataEq(index+1),"SSTORE"):branch([{push:0}],"SSTORE");
  else if(family==="UNREACHABLE_SELFDESTRUCT_SUPPRESSED")bytecode=enabled?branch([{push:0}],"SELFDESTRUCT"):branch(calldataEq(index+1),"SELFDESTRUCT");
  else if(family==="DYNAMIC_JUMP_UNRESOLVED")bytecode=enabled?assembler([{push:0},{op:"CALLDATALOAD"},{op:"JUMP"}]):assembler([{pushLabel:"end"},{op:"JUMP"},{label:"end"},{op:"JUMPDEST"},{op:"STOP"}]);
  else if(family==="VISIT_LIMIT_TRUNCATION"){bytecode=enabled?assembler([{label:"loop"},{op:"JUMPDEST"},{pushLabel:"loop"},{op:"JUMP"}]):assembler([{op:"STOP"}]);limits.maxVisitsPerPc=2;}
  else if(family==="STEP_LIMIT_TRUNCATION"){const items=[];for(let i=0;i<24;i++)items.push({push:0},{op:"POP"});items.push({op:"STOP"});bytecode=assembler(items);limits.maxSteps=enabled?12:128;}
  else throw new Error(`a21_family_unknown:${family}`);
  return {...common,deployedRuntimeBytecode:bytecode,limits};
}
function detectFamily(report,family){return report.findingFamilies.includes(family);}
function mutateInput(input,type,counterpart){
  const copy=structuredClone(input);
  if(type==="paired_feature_flip")return structuredClone(counterpart);
  if(type==="uppercase_hex")copy.deployedRuntimeBytecode=copy.deployedRuntimeBytecode.toUpperCase().replace("0X","0x");
  else if(type==="raw_provider_digest")copy.chainProviderReceiptSha256=String(copy.chainProviderReceiptSha256).replace("sha256:","");
  else if(type==="case_ref_change")copy.caseRef=copy.caseRef.replace(/-[VR]$/u,"-M");
  else if(type==="chain_change")copy.chainId=String(Number(copy.chainId)+1);
  else if(type==="address_change")copy.contractAddress=`0x${"f".repeat(40)}`;
  else if(type==="time_change")copy.observedAt="2026-07-23T08:01:00.000Z";
  else if(type==="limits_expand")copy.limits={maxStates:512,maxSteps:1024,maxVisitsPerPc:6,maxStackDepth:256};
  else if(type==="append_unreachable_stop")copy.deployedRuntimeBytecode+= "00";
  else if(type==="append_unreachable_push")copy.deployedRuntimeBytecode+= "6000";
  else if(type==="provider_drop")copy.chainProviderReceiptSha256=null;
  else if(type==="bytecode_truncate")copy.deployedRuntimeBytecode=copy.deployedRuntimeBytecode.slice(0,-2);
  else if(type==="invalid_address")copy.contractAddress="0x1234";
  return copy;
}
const ratio=(a,b)=>b?a/b:0;const round=(value)=>Number(value.toFixed(6));
export function runA21Benchmark(policy){
  if(!verifyA21Policy(policy))throw new Error("a21_policy_invalid");const cases=[];for(const family of policy.benchmark.families)for(let i=0;i<policy.benchmark.variantsPerClass;i++){cases.push({family,enabled:true,index:i,input:buildA21BenchmarkCase(family,true,i)});cases.push({family,enabled:false,index:i,input:buildA21BenchmarkCase(family,false,i)});}
  const rows=cases.map((row)=>{const report=analyzeA21PathCase(row.input,policy);return {family:row.family,enabled:row.enabled,index:row.index,split:row.index<3?"development":row.index<5?"validation":"frozen",detected:detectFamily(report,row.family),reportSha256:report.reportSha256,paidGateEligible:report.execution.paidGateEligible};});
  const lookup=new Map(cases.map((row)=>[`${row.family}|${row.enabled}|${row.index}`,row.input]));const mutations=[];
  for(const row of cases)for(const type of policy.benchmark.mutationTypes){const mutated=mutateInput(row.input,type,lookup.get(`${row.family}|${!row.enabled}|${row.index}`));let detected;let blocked;try{const report=analyzeA21PathCase(mutated,policy);blocked=report.execution.status==="BLOCKED";detected=detectFamily(report,row.family);}catch{blocked=true;detected=false;}let expected=type==="paired_feature_flip"?!row.enabled:row.enabled;if(type==="bytecode_truncate"||type==="invalid_address"){mutations.push({family:row.family,type,expected:"BLOCKED",actual:blocked?"BLOCKED":detected,killed:blocked});continue;}mutations.push({family:row.family,type,expected,actual:detected,killed:expected===detected});}
  const metrics=(scope)=>{const selected=rows.filter((row)=>!scope||row.split===scope);const tp=selected.filter((row)=>row.enabled&&row.detected).length,fn=selected.filter((row)=>row.enabled&&!row.detected).length,tn=selected.filter((row)=>!row.enabled&&!row.detected).length,fp=selected.filter((row)=>!row.enabled&&row.detected).length;const recall=ratio(tp,tp+fn),precision=ratio(tp,tp+fp),specificity=ratio(tn,tn+fp);return {total:selected.length,tp,fn,tn,fp,recall:round(recall),precision:round(precision),specificity:round(specificity),f1:round(precision+recall?2*precision*recall/(precision+recall):0)};};
  const frozen=metrics("frozen"),killed=mutations.filter((row)=>row.killed).length,mutationMatchRate=round(ratio(killed,mutations.length));const gates={cases:rows.length===policy.benchmark.expectedCases,enabled:rows.filter((row)=>row.enabled).length===policy.benchmark.expectedEnabled,remediated:rows.filter((row)=>!row.enabled).length===policy.benchmark.expectedRemediated,frozen:rows.filter((row)=>row.split==="frozen").length===policy.benchmark.expectedFrozen,mutations:mutations.length===policy.benchmark.expectedMutations,recall:frozen.recall>=policy.thresholds.minimumFrozenRecall,precision:frozen.precision>=policy.thresholds.minimumFrozenPrecision,specificity:frozen.specificity>=policy.thresholds.minimumFrozenSpecificity,mutationMatchRate:mutationMatchRate>=policy.thresholds.minimumMutationMatchRate,everyFamily:policy.benchmark.families.every((family)=>rows.some((row)=>row.family===family&&row.enabled&&row.detected)&&rows.some((row)=>row.family===family&&!row.enabled&&!row.detected)),noPaidUnlock:rows.every((row)=>row.paidGateEligible===false)};
  const core={schemaVersion:BENCHMARK_SCHEMA,passId:"PASS35_A21",sourceRevisionId:policy.sourceRevisionId,denominators:{families:policy.benchmark.families.length,cases:rows.length,enabled:rows.filter((row)=>row.enabled).length,remediated:rows.filter((row)=>!row.enabled).length,frozen:rows.filter((row)=>row.split==="frozen").length,mutations:mutations.length},overall:metrics(),frozen,mutation:{killed,total:mutations.length,matchRate:mutationMatchRate,failedSamples:mutations.filter((row)=>!row.killed).slice(0,50)},gates,failedGates:Object.entries(gates).filter(([,value])=>!value).map(([key])=>key),localImplementationComplete:Object.values(gates).every(Boolean),paidGateEligible:false,truthBoundary:policy.truthBoundary};return {...core,integritySha256:sha256(core)};
}
export function verifyA21Report(report){if(!report||report.schemaVersion!==REPORT_SCHEMA||report.execution?.paidGateEligible!==false)return false;const {reportSha256,...core}=report;return reportSha256===sha256(core);}
export function verifyA21Benchmark(report,policy){if(!report||report.schemaVersion!==BENCHMARK_SCHEMA||!verifyA21Policy(policy))return false;const {integritySha256,...core}=report;return integritySha256===sha256(core)&&report.localImplementationComplete===true&&report.failedGates.length===0&&report.paidGateEligible===false;}
