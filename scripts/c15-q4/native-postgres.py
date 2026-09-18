"""Native PostgreSQL qualification. Only an explicitly disposable loopback DB.
No Supabase project, customer records, provider calls, or actual payments.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, json, os, subprocess, sys
ROOT=Path(__file__).resolve().parents[2]
assert os.environ.get('Q4_DISPOSABLE_ACK')=='ISOLATED_TEST_ONLY', 'Explicit isolation required'
assert os.environ.get('PGHOST') in ('localhost','127.0.0.1'), 'Loopback only'
assert os.environ.get('PGDATABASE')=='q4_entitlement_fixture', 'Dedicated empty fixture database required'
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=False)
SQL=(ROOT/'scripts/c15-q4/entitlement-store.sql').read_text()
rows=[]
def run(query,ok=True,database=None):
    env=dict(os.environ,PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000')
    if database:env['PGDATABASE']=database
    p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,env=env,timeout=30)
    if ok and p.returncode:raise AssertionError(p.stderr)
    return p

def val(query,role='service_role',database=None):
    text=run(f'SET ROLE {role}; '+query+'; RESET ROLE;',database=database).stdout.strip()
    if text == "t": return True
    if text == "f": return False
    try: return json.loads(text)
    except json.JSONDecodeError: return text

def quote(value):
    if value is None:return 'NULL'
    if isinstance(value,dict):value=json.dumps(value)
    return "'"+str(value).replace("'","''")+"'"

def h(value):return hashlib.sha256(value.encode()).hexdigest()
def create_sql(id,session=None,account=None,expires='2099-01-01',created='2026-01-01'):
    args=[id,session or 'cs_test_'+id,None,'vlm_pro_analysis_single','vlm_pro_analysis',h('ctx:'+id),
          {'surface':'shield','locale':'en','depth':'pro','accountIdHash':h(account or id)},'en',1000,'EUR',
          None,None,'paid','stripe_webhook',None,expires,created]
    return 'SELECT public.velmere_create_or_read_vlm_paid_entitlement('+','.join(map(quote,args))+')'
def apply_sql(id,event='refund',event_id=None,source='source'):
    args=[id,h(event_id or id+':'+event),event,h(source),None,None,'2026-09-18T12:00:00Z']
    return 'SELECT public.velmere_apply_vlm_paid_entitlement_lifecycle_event('+','.join(map(quote,args))+')'
def state(id,database=None):
    return val('SELECT row_to_json(t) FROM (SELECT status,expires_at FROM public.velmere_vlm_paid_entitlements WHERE id='+quote(id)+') t',database=database)
def events(id):return val('SELECT count(*) FROM velmere_billing_private.lifecycle_events WHERE entitlement_id='+quote(id),role='postgres')
def test(name,fn):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:detail=fn();row={'name':name,'status':'PASS','detail':detail}
    except Exception as e:row={'name':name,'status':'FAIL','error':str(e)}
    row['startedAt']=started;rows.append(row)
    (OUT/'RESULTS.json').write_text(json.dumps({'sourceSha':os.environ.get('GITHUB_SHA'),
      'sqlSha256':hashlib.sha256(SQL.encode()).hexdigest(),'checks':rows},indent=2))
    print(name,row['status'],flush=True)
    if row['status']=='FAIL':raise SystemExit(row['error'])

run((ROOT/'scripts/c15-q4/bootstrap-roles.sql').read_text())
def no_ack():
    p=run(SQL,False);assert p.returncode and 'DISPOSABLE_STORE_ACK_REQUIRED' in p.stderr
    assert val("SELECT to_regclass('public.velmere_vlm_paid_entitlements') IS NULL",role='postgres')
    return 'Installation refused before any table was created'
test('installation interlock',no_ack)
run("SET velmere.disposable_entitlement_store='ISOLATED_TEST_ONLY';\n"+SQL)
(OUT/'POSTGRES_VERSION.txt').write_text(run('SELECT version();').stdout)
(OUT/'SCHEMA.sql').write_text(SQL)

def same_session():
    with ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(lambda _:val(create_sql('race_create')),range(8)))
    assert all(r['ok'] for r in results);assert sum(r['created'] for r in results)==1
    assert sum(r['idempotent'] for r in results)==7
    return {'requests':8,'created':1,'idempotent':7}
test('eight concurrent create requests create one grant',same_session)
def same_event():
    with ThreadPoolExecutor(max_workers=16) as pool:results=list(pool.map(lambda _:val(apply_sql('race_create')),range(16)))
    assert all(r['ok'] for r in results);assert sum(not r['idempotent'] for r in results)==1
    assert events('race_create')==1;assert state('race_create')['status']=='refunded'
    return {'requests':16,'transitions':1,'replays':15,'events':1}
test('sixteen concurrent refunds produce one transition and receipt',same_event)
def competing_bindings():
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda id:val(create_sql(id,'cs_test_shared')),['binding_a','binding_b']))
    assert sum(r['ok'] for r in results)==1
    assert val("SELECT count(*) FROM public.velmere_vlm_paid_entitlements WHERE stripe_session_id='cs_test_shared'")==1
    return {'requests':2,'acceptedBindings':1}
test('one Checkout session cannot acquire two account bindings',competing_bindings)
def competing_events():
    for id in ['event_a','event_b']:assert val(create_sql(id))['ok']
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda id:val(apply_sql(id,event_id='same_event')),['event_a','event_b']))
    assert sum(r['ok'] for r in results)==1
    assert sorted(state(id)['status'] for id in ['event_a','event_b'])==['active','refunded']
    return {'requests':2,'acceptedEvents':1}
test('one event identity cannot be applied to two entitlements',competing_events)
def refund_revoke():
    assert val(create_sql('ordered'))['ok']
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda e:val(apply_sql('ordered',e)),['refund','chargeback']))
    assert any(r['ok'] for r in results);assert state('ordered')['status']=='revoked'
    before=state('ordered');r=val(create_sql('ordered',expires='2100-01-01'))
    assert not r['ok'];assert state('ordered')==before
    return {'finalStatus':'revoked','checkoutReplay':'rejected'}
test('concurrent refund and chargeback never reactivate a grant',refund_revoke)
def rollback():
    assert val(create_sql('rollback'))['ok']
    run("ALTER TABLE velmere_billing_private.lifecycle_events ADD CONSTRAINT q4_failure CHECK (entitlement_id <> 'rollback');")
    failed=run('SET ROLE service_role; '+apply_sql('rollback')+';',False)
    assert failed.returncode;assert state('rollback')['status']=='active';assert events('rollback')==0
    run('ALTER TABLE velmere_billing_private.lifecycle_events DROP CONSTRAINT q4_failure;')
    assert val(apply_sql('rollback'))['ok'];assert events('rollback')==1
    return 'Status and journal rolled back together, then retry succeeded'
test('failed journal insertion rolls back the status UPDATE',rollback)
def early():
    first=val(apply_sql('early'));assert not first['ok'] and first['retryable']
    assert val(create_sql('early'))['ok'];assert val(apply_sql('early'))['ok']
    return 'Out-of-order refund retried after durable grant'
test('refund before grant remains retryable',early)
def rollback_transaction():
    assert val(create_sql('transaction'))['ok']
    run('BEGIN; SET LOCAL ROLE service_role; '+apply_sql('transaction')+'; ROLLBACK;')
    assert state('transaction')['status']=='active';assert events('transaction')==0
    return 'Outer rollback left no applied status or event'
test('caller transaction rollback preserves atomicity',rollback_transaction)
def privileges():
    for role in ['anon','authenticated']:
        for q in ['SELECT * FROM public.velmere_vlm_paid_entitlements',apply_sql('transaction'),create_sql('forbidden_'+role)]:
            failed=run('SET ROLE '+role+'; '+q+';',False)
            assert failed.returncode and 'permission denied' in failed.stderr
    for q in ['DELETE FROM velmere_billing_private.lifecycle_events',"UPDATE velmere_billing_private.lifecycle_events SET next_status='active'"]:
        failed=run('SET ROLE service_role; '+q+';',False);assert failed.returncode and 'permission denied' in failed.stderr
    return 'Anonymous/authenticated callers denied; service event journal denies UPDATE/DELETE'
test('native ACL boundaries',privileges)
def restore():
    dump=subprocess.run(['pg_dump','--format=custom','--no-owner','--file',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60)
    assert dump.returncode==0,dump.stderr
    run('CREATE DATABASE q4_entitlement_restore;')
    result=subprocess.run(['pg_restore','--exit-on-error','--no-owner','--dbname=q4_entitlement_restore',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60)
    assert result.returncode==0,result.stderr
    query="SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.velmere_vlm_paid_entitlements t"
    assert val(query)==val(query,database='q4_entitlement_restore')
    query="SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY event_id_hash)::text,'')) FROM velmere_billing_private.lifecycle_events t"
    assert val(query,role='postgres')==val(query,role='postgres',database='q4_entitlement_restore')
    assert state('ordered','q4_entitlement_restore')['status']=='revoked'
    assert val(apply_sql('race_create'),database='q4_entitlement_restore')['idempotent']
    assert not val(create_sql('ordered'),database='q4_entitlement_restore')['ok']
    assert val("SELECT NOT has_table_privilege('authenticated','public.velmere_vlm_paid_entitlements','SELECT')",role='postgres',database='q4_entitlement_restore')
    return 'Logical restore preserved rows, terminal states, replay and ACL; not managed Supabase DR'
test('logical backup/restore retains ownership states and receipts',restore)

def no_overwrite():
    failed=run("SET velmere.disposable_entitlement_store='ISOLATED_TEST_ONLY';\n"+SQL,False)
    assert failed.returncode and 'EXISTING_BILLING_OBJECTS_REQUIRE_REVIEW' in failed.stderr
    assert state('ordered')['status']=='revoked'
    return 'Existing store was not replaced'
test('reinstallation refuses to overwrite existing objects',no_overwrite)
(OUT/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.iterdir()) if p.is_file()],indent=2))
print(json.dumps({'passed':len(rows),'failed':0,'scope':'NATIVE_POSTGRES_DISPOSABLE_SQL_NOT_STRIPE_OR_GOTRUE_E2E'}))
