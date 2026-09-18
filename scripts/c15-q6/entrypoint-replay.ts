import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
// Actual application entrypoint; only the HTTP transport is controlled. No network/Stripe.
async function main(){
const originalFetch = globalThis.fetch;
const saved = {url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
process.env.SUPABASE_URL='https://q6-offline.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY=randomBytes(24).toString('hex');
const request={eventId:'evt_q6_replay',eventType:'charge.refunded',eventCreatedAt:1770000000};
const correct={claimed:true,status:'processing',attempt_count:1,event_id:request.eventId,event_type:request.eventType,event_created_at:request.eventCreatedAt,retry_after_seconds:0};
let response:unknown=correct;
globalThis.fetch=async (input)=>{
  if(new URL(String(input)).hostname!=='q6-offline.invalid')throw new Error('UNPLANNED_NETWORK');
  return new Response(JSON.stringify(response),{status:200,headers:{'content-type':'application/json'}});
};
const changes: [string,unknown,boolean][]=[
 ['valid claim',correct,true],
 ['missing claim flag',{status:'processing',attempt_count:1},false],
 ['truthy string flag',{...correct,claimed:'false'},false],
 ['missing attempt',{...correct,attempt_count:undefined},false],
 ['fractional attempt',{...correct,attempt_count:1.5},false],
 ['string attempt',{...correct,attempt_count:'1'},false],
 ['ambiguous rows',[correct,correct],false],
 ['different event',{...correct,event_id:'evt_other'},false],
 ['different event type',{...correct,event_type:'charge.dispute.created'},false],
 ['different timestamp',{...correct,event_created_at:0},false],
 ['claim with processed status',{...correct,status:'processed'},false],
 ['negative retry',{...correct,claimed:false,retry_after_seconds:-1},false],
 ['unknown status',{...correct,claimed:false,status:'unknown'},false],
];
const rows=[];
try{
 const app=await import('../../lib/db/order-service');
 for(const [name,data,expected] of changes){
  response=data; let accepted=false;
  try{await app.claimStripeWebhookEvent(request);accepted=true;}catch{accepted=false;}
  rows.push({name,expectedAccepted:expected,accepted,pass:accepted===expected});
 }
} finally {
 globalThis.fetch=originalFetch;
 if(saved.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=saved.url;
 if(saved.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=saved.key;
}
const out=resolve(process.argv[2]??'q6-replay.json');mkdirSync(resolve(out,'..'),{recursive:true});
writeFileSync(out,JSON.stringify({scope:'ACTUAL_ENTRYPOINT_CONTROLLED_HTTP_NO_NETWORK',cases:rows,pass:rows.filter(r=>r.pass).length,total:rows.length},null,2),{flag:'wx'});
console.log(JSON.stringify({pass:rows.filter(r=>r.pass).length,total:rows.length}));

}
main().catch(()=>{console.error("REPLAY_FAILED");process.exitCode=1;});
