"""Execute captured real RPC logic on isolated PostgreSQL, not live Auth/Stripe."""
from pathlib import Path
import subprocess,json,os,hashlib,datetime,sys,re
if os.environ.get('PGHOST') not in ('localhost','127.0.0.1') or os.environ.get('PGDATABASE') != 'c13_fixture':
    raise RuntimeError('Refuse non-isolated database: localhost/c13_fixture required')
out=Path('/tmp/c13-sql');out.mkdir(exist_ok=True)
rows=[]
def sql(query,ok=True):
    p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,timeout=30)
    if ok and p.returncode:raise AssertionError(p.stderr)
    return p

def check(name,query,expected=None,error=None):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat()
    p=sql(query,ok=False)
    passed=(p.returncode!=0 and error in p.stderr) if error else (p.returncode==0 and (expected is None or expected in p.stdout))
    rows.append(dict(id=name,result='PASS' if passed else 'FAIL',exitCode=p.returncode,expected=expected,error=error,stdout=p.stdout,stderr=p.stderr,startedAt=start))
    (out/'CHECKS.json').write_text(json.dumps(dict(sourceSha=os.environ['GITHUB_SHA'],scope='REAL_POSTGRESQL_CAPTURED_RPC_SYNTHETIC_SCHEMA_AUTH_CLAIMS_AND_ENTITLEMENTS_NOT_HTTP_AUTH_STRIPE_E2E',checks=rows),indent=2))
    print(name,'PASS' if passed else 'FAIL',flush=True)
    if not passed:raise AssertionError(name+': '+p.stdout+' '+p.stderr)

A='00000000-0000-4000-8000-00000000000a'; B='00000000-0000-4000-8000-00000000000b'
SA='00000000-0000-4000-8000-00000000001a'; SB='00000000-0000-4000-8000-00000000001b'
WP='00000000-0000-4000-8000-00000000002a'; WA='00000000-0000-4000-8000-00000000002b'; WD='00000000-0000-4000-8000-00000000002c'
GA='00000000-0000-4000-8000-00000000003a'; GB='00000000-0000-4000-8000-00000000003b'; GADV='00000000-0000-4000-8000-00000000003c'
def request(tier='pro',operation='READ',workspace=WP,user=A,session=SA,role='authenticated',prefix=''):
    claims=json.dumps(dict(sub=user,session_id=session)) if user else '{}'
    t='NULL' if tier is None else "'"+tier+"'"
    w='NULL' if workspace is None else "'"+workspace+"'::uuid"
    return f"BEGIN; {prefix} SET LOCAL ROLE {role}; SET LOCAL request.jwt.claims='{claims}'; SELECT public.velmere_r7_shield_pro_paid_workspace_v1({t},'en','{operation}',{w}); ROLLBACK;"

try:
    sql(Path('scripts/c13/fixtures/isolated-schema.sql').read_text())
    s=Path('supabase/migrations/20260917043048_velmere_c6d_shield_session_and_null_validation.sql').read_text()
    helper=s[s.index('CREATE OR REPLACE FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1'):s.index('DO $workspace_patch$')]
    sql(helper)
    baseline=Path('scripts/c13/fixtures/shield-workspace-live-before.sql').read_text()
    assert hashlib.sha256(baseline.encode()).hexdigest()=='102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a'
    sql(baseline+';')
    sql("REVOKE ALL ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) TO authenticated; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated;")
    sql(f"INSERT INTO auth.sessions VALUES ('{SA}','{A}',null),('{SB}','{B}',null); INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events(entitlement_ref,account_id,tier,event_kind) VALUES ('{GA}','{A}','pro','GRANT'),('{GB}','{B}','pro','GRANT');")
    for w,t,e in [(WP,'pro','CREATE'),(WA,'advanced','CREATE'),(WD,'advanced','DELETE')]:
        sql(f"INSERT INTO velmere_private.r7_shield_pro_paid_workspace_events(workspace_id,account_id,tier,locale,event_kind,payload,payload_digest_sha256) VALUES ('{w}','{A}','{t}','en','{e}',jsonb_build_object('scope','SYNTHETIC_CI_FIXTURE','tier','{t}'),repeat('a',64));")
    check('baseline-live-function-hash',"SELECT encode(sha256(convert_to(pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure),'UTF8')),'hex');",'102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a')
    check('before-pro-can-read-stored-advanced',request(workspace=WA),'"resolution": "RESOLVED"')
    check('before-pro-can-restore-stored-advanced',request(operation='RESTORE',workspace=WD),'"resolution": "RESTORED"')
    before=sql("SELECT pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure);").stdout
    (out/'BEFORE.sql').write_text(before)
    patch=Path('scripts/c13/shield-workspace-guard.sql').read_text()
    check('guarded-patch-applies', 'BEGIN;'+patch+'COMMIT;')
    check('same-patch-refuses-drift-or-reapply','BEGIN;'+patch+'COMMIT;',error='C13 aborted: reviewed live RPC definitions changed')
    check('after-pro-cannot-read-stored-advanced',request(workspace=WA),error='shield_pro_stored_workspace_entitlement_required')
    check('after-pro-cannot-restore-stored-advanced',request(operation='RESTORE',workspace=WD),error='shield_pro_stored_workspace_entitlement_required')
    check('pro-can-read-own-pro',request(),'"resolution": "RESOLVED"')
    check('cross-account-is-not-found',request(user=B,session=SB),'"resolution": "NOT_FOUND"')
    check('anonymous-role-denied',request(role='anon',user=None),error='permission denied for function')
    check('authenticated-without-subject-denied',request(user=None),error='shield_pro_paid_auth_required')
    check('wrong-session-owner-denied',request(session=SB),error='shield_pro_paid_entitlement_required')
    check('missing-session-denied',request(session='00000000-0000-4000-8000-000000000099'),error='shield_pro_paid_entitlement_required')
    check('malformed-session-denied',request(session='not-a-session'),error='shield_pro_paid_entitlement_required')
    check('expired-session-denied',request(prefix=f"UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id='{SA}';"),error='shield_pro_paid_entitlement_required')
    check('deleted-session-denied',request(prefix=f"DELETE FROM auth.sessions WHERE id='{SA}';"),error='shield_pro_paid_entitlement_required')
    check('revoked-grant-denied',request(prefix=f"INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events(entitlement_ref,account_id,tier,event_kind) VALUES ('{GA}','{A}','pro','REVOKE');"),error='shield_pro_paid_entitlement_required')
    check('expired-grant-denied',request(prefix=f"UPDATE velmere_private.r7_shield_pro_paid_entitlement_events SET expires_at=now()-interval '1 minute' WHERE entitlement_ref='{GA}';"),error='shield_pro_paid_entitlement_required')
    check('null-tier-denied',request(tier=None),error='shield_pro_paid_request_invalid')
    check('missing-workspace-denied',request(workspace=None),error='shield_pro_paid_workspace_id_required')
    advanced=f"INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events(entitlement_ref,account_id,tier,event_kind) VALUES ('{GADV}','{A}','advanced','GRANT');"
    check('advanced-can-read-stored-advanced',request(tier='advanced',workspace=WA,prefix=advanced),'"resolution": "RESOLVED"')
    check('actual-advanced-grant-authorizes-stored-tier-even-with-pro-parameter',request(workspace=WA,prefix=advanced),'"resolution": "RESOLVED"')
    check('advanced-can-restore-stored-advanced',request(operation='RESTORE',workspace=WD,prefix=advanced),'"resolution": "RESTORED"')
    check('pro-owner-can-delete-own-old-advanced-without-reading-payload',request(operation='DELETE',workspace=WA),'"resolution": "DELETED"')
    check('synthetic-fixture-create-pro',request(operation='CREATE',workspace=None),'"resolution": "CREATED"')
    check('synthetic-fixture-create-advanced',request(tier='advanced',operation='CREATE',workspace=None,prefix=advanced),'"resolution": "CREATED"')
    check('acl-unchanged',"SELECT has_function_privilege('anon','public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)','execute')::text||'/'||has_function_privilege('authenticated','public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)','execute')::text;",'false/true')
    after=sql("SELECT pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure);").stdout
    (out/'AFTER.sql').write_text(after)
    check('isolated-test-writes-rolled-back',"SELECT count(*)::text FROM velmere_private.r7_shield_pro_paid_workspace_events;",'3')
finally:
    files=[dict(path=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in out.iterdir() if p.is_file() and p.name not in ('EVIDENCE_MANIFEST.json','execution.log')]
    (out/'EVIDENCE_MANIFEST.json').write_text(json.dumps(dict(sourceSha=os.environ.get('GITHUB_SHA'),files=files,liveCustomerWrites=0,realAuthHttpTest=False),indent=2))
