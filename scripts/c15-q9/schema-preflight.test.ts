import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {PGlite} from '@electric-sql/pglite';
import {database} from '../c15-q8/test-helpers';
const query=readFileSync(new URL('./schema-preflight.sql',import.meta.url),'utf8');
type Report={contractReady:boolean;expectedObjects:number;passedObjects:number;releaseApproved:boolean;unexpectedPublicOverloads:string[];checks:{object:string;present:boolean;structureOk:boolean;permissionsOk:boolean}[]};
let db:PGlite;before(async()=>{db=await database(true,true);});after(async()=>{await db.close();});
async function report(){return (await db.query<{report:Report}>(query)).rows[0].report;}
async function change(sql:string,check:(r:Report)=>void){await db.exec('BEGIN');try{await db.exec(sql);check(await report());}finally{await db.exec('ROLLBACK');}}
test('Q9 minimum billing contract matches all 19 explicit expectations',async()=>{const r=await report();assert.equal(r.expectedObjects,19);assert.equal(r.passedObjects,19);assert.equal(r.contractReady,true);assert.equal(r.releaseApproved,false);assert.deepEqual(r.unexpectedPublicOverloads,[]);});
for(const sql of [
 'ALTER TABLE velmere_billing_private.session_terminal_holds DISABLE ROW LEVEL SECURITY',
 'ALTER TABLE velmere_billing_private.session_terminal_holds NO FORCE ROW LEVEL SECURITY',
 'GRANT SELECT ON velmere_billing_private.session_terminal_holds TO anon',
 'GRANT UPDATE ON velmere_billing_private.lifecycle_events TO service_role',
 'GRANT DELETE ON public.velmere_vlm_paid_entitlements TO service_role',
 'ALTER FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) SECURITY DEFINER',
 'ALTER FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) SET search_path=public',
 'GRANT EXECUTE ON FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) TO PUBLIC',
 'REVOKE EXECUTE ON FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) FROM service_role',
])test(`Q9 preflight refuses drift: ${sql.split(' ').slice(0,4).join(' ')}`,async()=>change(sql,r=>{assert.equal(r.contractReady,false);assert.ok(r.passedObjects<19);}));
test('Q9 missing function cannot report contractReady',async()=>change('DROP FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint)',r=>{assert.equal(r.contractReady,false);assert.equal(r.checks.filter(c=>!c.present).length,1);}));
test('Q9 unexpected overload is not silently ignored',async()=>change("CREATE FUNCTION public.velmere_record_vlm_terminal_payment_hold() RETURNS boolean LANGUAGE sql AS 'SELECT true'",r=>{assert.equal(r.contractReady,false);assert.equal(r.unexpectedPublicOverloads.length,1);}));
test('Q9 schema inspection is read-only and does not fix drift',async()=>{
 await db.exec('BEGIN READ ONLY');try{assert.equal((await report()).contractReady,true);}finally{await db.exec('ROLLBACK');}
});
