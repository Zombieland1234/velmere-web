"""Actual concurrent PostgreSQL; explicit disposable interlock, never a production target."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, json, os, subprocess, sys
ROOT=Path(__file__).resolve().parents[2]
assert os.environ.get('Q6_DISPOSABLE_ACK')=='ISOLATED_TEST_ONLY'
assert os.environ.get('PGHOST') in ('localhost','127.0.0.1')
assert os.environ.get('PGDATABASE')=='q6_event_fixture'
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=False)
SQL=(ROOT/'scripts/c15-q6/event-store.sql').read_text();rows=[]
def run(query,ok=True,database=None):
    env=dict(os.environ,PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000')
    if database:env['PGDATABASE']=database
    p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True,env=env,timeout=30)
    if ok and p.returncode:raise AssertionError(p.stderr)
    return p
def val(query,role='service_role',database=None):
    text=run(f'SET ROLE {role}; '+query+'; RESET ROLE;',database=database).stdout.strip()
    if text=='t':return True
    if text=='f':return False
    try:return json.loads(text)
    except json.JSONDecodeError:return text
def q(value):return 'NULL' if value is None else "'"+str(value).replace("'","''")+"'"
def claim(id,seconds=300,event_type='charge.refunded',created=1770000000):
    return 'SELECT public.velmere_claim_stripe_webhook_event('+','.join(map(q,[id,event_type,created,seconds]))+')'
def complete(id,attempt=1,status='processed',event_type='charge.refunded'):
    return 'SELECT public.velmere_complete_stripe_webhook_event('+','.join(map(q,[id,event_type,attempt,status,None if status=='processed' else 'temporary_failure']))+')'
def state(id,database=None):return val('SELECT to_jsonb(t) FROM public.velmere_stripe_webhook_events t WHERE id='+q(id),role='postgres',database=database)
def expire(id):run("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id="+q(id)+';')
def test(name,fn):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:detail=fn();r={'name':name,'status':'PASS','detail':detail}
    except Exception as e:r={'name':name,'status':'FAIL','error':str(e)}
    r['startedAt']=start;rows.append(r)
    (OUT/'RESULTS.json').write_text(json.dumps({'sourceSha':os.environ.get('GITHUB_SHA'),'sqlSha256':hashlib.sha256(SQL.encode()).hexdigest(),'checks':rows},indent=2))
    print(name,r['status'],flush=True)
    if r['status']=='FAIL':raise SystemExit(r['error'])
run((ROOT/'scripts/c15-q4/bootstrap-roles.sql').read_text())
def interlock():
    p=run(SQL,False);assert p.returncode and 'DISPOSABLE_EVENT_STORE_ACK_REQUIRED' in p.stderr
    assert val("SELECT to_regclass('public.velmere_stripe_webhook_events') IS NULL",role='postgres')
    return 'No event relation created without disposable acknowledgement'
test('installation interlock',interlock)
run("SET velmere.disposable_event_store='ISOLATED_TEST_ONLY';\n"+SQL)
(OUT/'POSTGRES_VERSION.txt').write_text(run('SELECT version();').stdout);(OUT/'SCHEMA.sql').write_text(SQL)
def race():
    with ThreadPoolExecutor(max_workers=16) as pool:r=list(pool.map(lambda _:val(claim('evt_race')),range(16)))
    assert sum(x['claimed'] for x in r)==1 and all(x['attempt_count']==1 for x in r)
    with ThreadPoolExecutor(max_workers=16) as pool:d=list(pool.map(lambda _:val(complete('evt_race')),range(16)))
    assert all(x['applied'] for x in d) and sum(not x['idempotent'] for x in d)==1
    assert val(claim('evt_race'))['status']=='processed'
    return {'claimRequests':16,'claimed':1,'busy':15,'completionRequests':16,'writes':1,'replays':15}
test('concurrent deliveries and completion replay',race)
def reclaim():
    val(claim('evt_fence'));expire('evt_fence')
    with ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(lambda _:val(claim('evt_fence')),range(8)))
    assert sum(x['claimed'] for x in r)==1 and all(x['attempt_count']==2 for x in r)
    for status in ['processed','retryable_failed','dead_letter']:assert not val(complete('evt_fence',1,status))['applied']
    assert val(complete('evt_fence',2))['applied'];return {'reclaimRequests':8,'claimed':1,'staleWritesDenied':3}
test('reclaim serializes generation and fences all stale final states',reclaim)
def deadline():
    val(claim('evt_deadline'));first=state('evt_deadline');assert not val(claim('evt_deadline',seconds=1))['claimed'];assert state('evt_deadline')==first
    expire('evt_deadline');assert not val(complete('evt_deadline'))['applied'];return 'Stored deadline preserved; expired generation cannot settle even before reclaim'
test('stored deadline and expired completion',deadline)
def identity():
    val(claim('evt_identity'));val(complete('evt_identity'))
    for args in [dict(event_type='charge.dispute.created'),dict(created=1770000001)]:
        p=run(claim('evt_identity',**args)+';',False);assert p.returncode and 'EVENT_IDENTITY_CONFLICT' in p.stderr
    assert state('evt_identity')['status']=='processed';return 'Type and original creation time immutable after completion'
test('duplicate event metadata conflict',identity)
def conflicting_completion():
    val(claim('evt_conflict'))
    with ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(lambda s:val(complete('evt_conflict',status=s)),['processed','dead_letter']))
    assert sum(x['applied'] for x in r)==1;return {'completionRequests':2,'acceptedTransitions':1}
test('conflicting completions cannot overwrite a final state',conflicting_completion)
def retry():
    val(claim('evt_retry'));assert val(complete('evt_retry',status='retryable_failed'))['applied']
    assert val(claim('evt_retry'))['attempt_count']==2
    assert not val(complete('evt_retry',status='retryable_failed'))['applied']
    assert val(complete('evt_retry',2,'dead_letter'))['applied'];assert val(claim('evt_retry'))['status']=='dead_letter'
    return 'Retry increments generation; terminal errors stay terminal'
test('retryable and dead letter lifecycle',retry)
def overflow():
    val(claim('evt_overflow'));expire('evt_overflow');run("UPDATE public.velmere_stripe_webhook_events SET attempt_count=2147483647 WHERE id='evt_overflow';")
    p=run(claim('evt_overflow')+';',False);assert p.returncode and 'EVENT_ATTEMPT_EXHAUSTED' in p.stderr
    assert state('evt_overflow')['attempt_count']==2147483647;return 'Counter exhaustion refuses without reset'
test('attempt exhaustion',overflow)
def rollback():
    val(claim('evt_rollback'));first=state('evt_rollback')
    run('BEGIN; SET LOCAL ROLE service_role; '+complete('evt_rollback')+'; ROLLBACK;');assert state('evt_rollback')==first
    run("ALTER TABLE public.velmere_stripe_webhook_events ADD CONSTRAINT q6_injected CHECK(id <> 'evt_rollback' OR status <> 'processed');")
    p=run('SET ROLE service_role; '+complete('evt_rollback')+';',False);assert p.returncode and state('evt_rollback')==first
    run('ALTER TABLE public.velmere_stripe_webhook_events DROP CONSTRAINT q6_injected;');assert val(complete('evt_rollback'))['applied']
    return 'Rollback and injected write failure preserve original state; retry succeeds'
test('atomic rollback and failed completion',rollback)
def acl():
    for role in ['anon','authenticated']:
        for statement in ['SELECT * FROM public.velmere_stripe_webhook_events',claim('evt_denied'),complete('evt_race')]:
            p=run('SET ROLE '+role+'; '+statement+';',False);assert p.returncode and 'permission denied' in p.stderr
    assert not val("SELECT has_table_privilege('service_role','public.velmere_stripe_webhook_events','DELETE')",role='postgres')
    return 'Untrusted roles denied; service role remains trusted, no DELETE grant'
test('native ACL boundaries',acl)
def restore():
    p=subprocess.run(['pg_dump','--format=custom','--no-owner','--file',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60);assert p.returncode==0,p.stderr
    run('CREATE DATABASE q6_event_restore;')
    p=subprocess.run(['pg_restore','--exit-on-error','--no-owner','--dbname=q6_event_restore',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60);assert p.returncode==0,p.stderr
    query="SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.velmere_stripe_webhook_events t"
    assert val(query,role='postgres')==val(query,role='postgres',database='q6_event_restore')
    assert val(claim('evt_race'),database='q6_event_restore')['status']=='processed'
    assert val(claim('evt_retry'),database='q6_event_restore')['status']=='dead_letter'
    assert not val("SELECT has_table_privilege('authenticated','public.velmere_stripe_webhook_events','SELECT')",role='postgres',database='q6_event_restore')
    return 'Logical restore preserved all rows and duplicate protection; not managed Supabase DR'
test('logical backup restore',restore)
def reinstall():
    p=run("SET velmere.disposable_event_store='ISOLATED_TEST_ONLY';\n"+SQL,False)
    assert p.returncode and 'EXISTING_EVENT_OBJECTS_REQUIRE_REVIEW' in p.stderr
    assert state('evt_race')['status']=='processed';return 'Existing event records not replaced'
test('reinstallation interlock',reinstall)
(OUT/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.iterdir()) if p.is_file()],indent=2))
print(json.dumps({'passed':len(rows),'failed':0,'scope':'NATIVE_POSTGRES_EVENT_STORE_NOT_STRIPE_E2E'}))
