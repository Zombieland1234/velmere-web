import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCustomerReportInput,CustomerReportRequestError} from '../../lib/security/customer-report-request';
import {BENCHMARK_20_CONTRACTS} from '../../lib/security/contract-audit-profiles';
const [address,profile]=Object.entries(BENCHMARK_20_CONTRACTS).find(([key,p])=>/^0x[a-f0-9]{40}$/i.test(key)&&['1','56'].includes(p.chainId))!;
const otherChain=profile.chainId==='1'?'56':'1';
test('C11 actual report input permits explicit runtime at the same address on another chain',()=>{
 const target=normalizeCustomerReportInput({address,chainId:otherChain,analysisMode:'runtime'});
 assert.equal(target.target.chainId,otherChain);assert.equal(target.analysisMode,'runtime');assert.equal(target.target.contractAddress,address);
});
test('C11 reference mode cannot mislabel another-chain address using an old profile',()=>{
 assert.throws(()=>normalizeCustomerReportInput({address,chainId:otherChain,analysisMode:'reference'}),e=>e instanceof CustomerReportRequestError&&e.code==='reference_profile_chain_mismatch');
});
test('C11 unsupported runtime chain remains rejected rather than coerced',()=>{
 assert.throws(()=>normalizeCustomerReportInput({address,chainId:'999999',analysisMode:'runtime'}),e=>e instanceof CustomerReportRequestError&&e.code==='unsupported_chain_id');
});
test('C11 absent chain still uses an exact reference identity',()=>{
 const result=normalizeCustomerReportInput({address});assert.equal(result.target.chainId,profile.chainId);assert.equal(result.analysisMode,'reference');
});
