import {test} from 'node:test';
import assert from 'node:assert/strict';
import {disassembleBytecode, buildControlFlowGraph} from '../../lib/security/v2/evm-cfg-dataflow-engine';
import {applyLocalStackInstruction, foldEvmConstant, isLegacyHalt} from '../../lib/security/v2/evm-local-stack';
const cfg=(code:string)=>buildControlFlowGraph(disassembleBytecode(code).instructions);
const edges=(code:string)=>cfg(code).cfg.blocks.get('block_0')!.successors;

test('C11-CFG resolves a computed ADD target rather than requiring adjacent PUSH',()=>{
 assert.deepEqual(edges('6009600001560000005b00'),['block_9']);
});
test('C11-CFG resolves exact DUP and SWAP top-of-stack targets',()=>{
 assert.deepEqual(edges('60058056005b00'),['block_5']);
 assert.deepEqual(edges('600760ff9056005b00'),['block_7']);
});
test('C11-CFG PC is the instruction position, not an unknown environment value',()=>{
 assert.deepEqual(edges('586007015600005b00'),['block_7']);
});
test('C11-CFG constant false JUMPI never evaluates even an invalid target',()=>{
 assert.deepEqual(edges('5f60065700005b00'),['block_4']);
 assert.equal(cfg('5f60ff5700').cfg.unresolvedDynamicJumps,0);
});
test('C11-CFG constant true JUMPI has no fallthrough edge',()=>{
 assert.deepEqual(edges('600160075700005b00'),['block_7']);
});
test('C11-CFG unknown condition preserves both possible branches',()=>{
 assert.deepEqual(edges('3360065700005b00'),['block_6','block_4']);
});
test('C11-CFG identical taken and fallthrough destination is one edge',()=>{
 const r=cfg('336004575b00');assert.deepEqual(r.cfg.blocks.get('block_0')!.successors,['block_4']);
 assert.deepEqual(r.cfg.blocks.get('block_4')!.predecessors,['block_0']);
});
test('C11-CFG never resolves a destination inside PUSH data or a non-JUMPDEST',()=>{
 for(const code of ['600156','605b600156','7f'+'ff'.repeat(32)+'56']) assert.equal(cfg(code).cfg.unresolvedDynamicJumps,1);
});
test('C11-CFG storage key arithmetic is preserved; SLOAD output remains unknown',()=>{
 assert.deepEqual([...cfg('60016002015400').storageSlotsRead],['0x3']);
 assert.deepEqual([...cfg('6001546001015400').storageSlotsRead],['0x1','unknown']);
});
test('C11-CFG CALL consumes seven inputs and preserves a deeper constant return target',()=>{
 const code='6016'+'5f'.repeat(7)+'f15056'+'00'.repeat(10)+'5b00';
 // Compute actual instruction marker rather than relying on a hand-counted PC.
 const inst=disassembleBytecode(code).instructions;const target=inst.find(i=>i.name==='JUMPDEST')!.pc;
 const fixed='60'+target.toString(16).padStart(2,'0')+code.slice(4);
 assert.deepEqual(edges(fixed),[`block_${target}`]);
});
test('C11-CFG unsupported legacy opcode terminates its block with no fallthrough',()=>{
 const r=cfg('0c600556005b00');assert.deepEqual(r.cfg.blocks.get('block_0')!.successors,[]);
 assert.equal(r.cfg.blocks.get('block_0')!.instructions.length,1);assert.ok(isLegacyHalt(0x0c));
});
test('C11 constant evaluator observes unsigned wraparound and signed EVM division',()=>{
 const mod=1n<<256n,mask=mod-1n;
 assert.equal(foldEvmConstant(1,mask,1n),0n);assert.equal(foldEvmConstant(3,0n,1n),mask);
 assert.equal(foldEvmConstant(5,1n<<255n,mask),1n<<255n);assert.equal(foldEvmConstant(5,mask,0n),0n);
 assert.equal(foldEvmConstant(7,mod-5n,3n),mod-2n);
});
test('C11 constant evaluator does not truncate ADDMOD/MULMOD before the modulus',()=>{
 const mask=(1n<<256n)-1n;
 assert.equal(foldEvmConstant(8,mask,mask,7n),(mask+mask)%7n);
 assert.equal(foldEvmConstant(9,mask,mask,7n),(mask*mask)%7n);
});
test('C11 big-exponent folding is bounded modular exponentiation',()=>{
 assert.equal(foldEvmConstant(0x0a,0n,0n),1n);
 assert.equal(foldEvmConstant(0x0a,2n,(1n<<256n)-1n),0n);
});
test('C11 unknown operands cannot resurrect stale nearby PUSH constants',()=>{
 assert.deepEqual([...cfg('602a350160005400').storageSlotsRead],['0x0']);
 assert.deepEqual([...cfg('602a355400').storageSlotsRead],['unknown']);
});
test('C11 SWAP missing block-entry items remain unknown, without erasing a known top',()=>{
 const stack:Array<bigint|null>=[7n];
 applyLocalStackInstruction(stack,{pc:0,opcode:0x90,name:'SWAP1',size:1});assert.deepEqual(stack,[7n,null]);
});
test('C11 stack folding remains explicitly local, without guessing cross-block inputs',()=>{
 const r=cfg('60055b56005b00');assert.equal(r.cfg.unresolvedDynamicJumps,1);
});
