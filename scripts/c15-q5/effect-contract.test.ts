import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEffectClaim, validateEffectAttempt, validateEffectLease } from '../../lib/payments/stripe-webhook-effect-contract';
const token = '01234567-89ab-4cde-8fab-0123456789ab'; // inert token shape, not an account credential
const claimed = { claimed: true, status: 'processing', attempt_count: 1, lease_token: token };
const completed = { claimed: false, status: 'completed', attempt_count: 1, lease_token: null, result_json: { ok: true } };
for (const [name, data, kind] of [
  ['claimed', claimed, 'claimed'], ['singleton row', [claimed], 'claimed'],
  ['completed', completed, 'completed'], ['null JSON receipt', {...completed,result_json:null},'completed'],
  ['busy', {claimed:false,status:'processing',attempt_count:2,lease_token:null,retry_after_seconds:300},'busy'],
  ['dead letter', {claimed:false,status:'dead_letter',attempt_count:2,lease_token:null},'dead_letter'],
] as const) test(`Q5 valid claim: ${name}`, () => assert.equal(parseEffectClaim(data, token).kind, kind));
for (const [name, data] of [
  ['empty',null], ['empty rows',[]], ['multiple rows',[claimed,claimed]], ['primitive','claimed'],
  ['string flag',{...claimed,claimed:'false'}], ['missing flag',{status:'processing',attempt_count:1,lease_token:token}],
  ['missing status',{claimed:true,attempt_count:1,lease_token:token}], ['unknown status',{...claimed,status:'maybe'}],
  ['fractional attempt',{...claimed,attempt_count:1.5}], ['string attempt',{...claimed,attempt_count:'1'}],
  ['negative attempt',{...claimed,attempt_count:-1}], ['too large attempt',{...claimed,attempt_count:2147483648}],
  ['missing lease',{claimed:true,status:'processing',attempt_count:1}],
  ['wrong lease',{...claimed,lease_token:'11111111-1111-4111-8111-111111111111'}],
  ['completed claimed true',{...completed,claimed:true}], ['missing receipt',{claimed:false,status:'completed',attempt_count:1,lease_token:null}],
  ['oversized receipt',{...completed,result_json:'x'.repeat(16384)}],
  ['busy leaks token',{...claimed,claimed:false,retry_after_seconds:2}],
  ['busy missing retry',{claimed:false,status:'processing',attempt_count:1,lease_token:null}],
  ['busy infinite retry',{claimed:false,status:'processing',attempt_count:1,lease_token:null,retry_after_seconds:Infinity}],
  ['busy negative retry',{claimed:false,status:'processing',attempt_count:1,lease_token:null,retry_after_seconds:-1}],
  ['busy excessive retry',{claimed:false,status:'processing',attempt_count:1,lease_token:null,retry_after_seconds:3601}],
  ['retryable state not a claim',{claimed:false,status:'retryable_failed',attempt_count:1,lease_token:null}],
] as const) test(`Q5 rejects malformed claim: ${name}`, () => assert.throws(() => parseEffectClaim(data, token)));
test('Q5 settlement identities reject rounded attempts and non-UUID tokens',()=>{
  for(const value of [NaN,Infinity,0,-1,1.5,2147483648])assert.throws(()=>validateEffectAttempt(value));
  for(const value of ['',token+' ','not-a-lease'])assert.throws(()=>validateEffectLease(value));
  assert.equal(validateEffectAttempt(1),1);assert.equal(validateEffectLease(token),token);
});
