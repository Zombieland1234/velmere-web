"""Separate connections against an explicitly disposable PostgreSQL. No production/Stripe."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, json, os, subprocess, sys, uuid
ROOT=Path(__file__).resolve().parents[2]
assert os.environ.get('Q5_DISPOSABLE_ACK')=='ISOLATED_TEST_ONLY'
assert os.environ.get('PGHOST') in ('localhost','127.0.0.1')
assert os.environ.get('PGDATABASE')=='q5_effect_fixture'
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=False)
SQL=(ROOT/'scripts/c15-q5/effect-store.sql').read_text(); rows=[]
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

def q(value):
    if value is None:return 'NULL'
    if isinstance(value,dict):value=json.dumps(value)
    return "'"+str(value).replace("'","''")+"'"

def claim(id,token=None,seconds=300,event_type='charge.refunded'):
    args=[id,event_type,'refund',token or str(uuid.uuid4()),seconds]
    return 'SELECT public.velmere_claim_stripe_webhook_effect('+','.join(map(q,args))+')'

def settle(id,c,kind='complete'):
    value={'ok':True} if kind=='complete' else 'retry_failure'
    args=[id,'refund',c['attempt_count'],c['lease_token'],value]
    return f'SELECT public.velmere_{kind}_stripe_webhook_effect('+','.join(map(q,args))+')'

def state(id,database=None):
    return val('SELECT to_jsonb(t) FROM velmere_webhook_private.effects t WHERE event_id='+q(id),role='postgres',database=database)

def expire(id):run("UPDATE velmere_webhook_private.effects SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE event_id="+q(id)+';')

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
    p=run(SQL,False);assert p.returncode and 'DISPOSABLE_EFFECT_STORE_ACK_REQUIRED' in p.stderr
    assert val("SELECT NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='velmere_webhook_private')",role='postgres')
    return 'No objects created without explicit acknowledgment'
test('installation interlock',interlock)
run("SET velmere.disposable_effect_store='ISOLATED_TEST_ONLY';\n"+SQL)
(OUT/'POSTGRES_VERSION.txt').write_text(run('SELECT version();').stdout)
(OUT/'SCHEMA.sql').write_text(SQL)
def race():
    with ThreadPoolExecutor(max_workers=16) as pool:r=list(pool.map(lambda _:val(claim('race')),range(16)))
    assert sum(x['claimed'] for x in r)==1
    assert all(x['attempt_count']==1 for x in r)
    assert all(x['lease_token'] is None for x in r if not x['claimed'])
    winner=next(x for x in r if x['claimed']);assert val(settle('race',winner))
    replay=val(claim('race'));assert not replay['claimed'] and replay['status']=='completed'
    return {'requests':16,'claims':1,'busy':15,'replay':'completed'}
test('sixteen claimers acquire one lease without revealing the winner token',race)
def reclaim():
    old=val(claim('fence'));expire('fence')
    with ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(lambda _:val(claim('fence')),range(8)))
    assert sum(x['claimed'] for x in r)==1;new=next(x for x in r if x['claimed']);assert new['attempt_count']==2
    for kind in ['complete','fail','dead_letter']:assert not val(settle('fence',old,kind))
    assert val(settle('fence',new))
    return {'reclaimers':8,'newClaims':1,'oldWritesDenied':3}
test('reclaim fences all writes from the expired generation',reclaim)
def fixed_deadline():
    c=val(claim('duration'));before=state('duration');b=val(claim('duration',seconds=1))
    assert not b['claimed'];assert state('duration')==before
    expire('duration');assert not val(settle('duration',c));return 'A second caller cannot shorten the stored lease; expired completion refused'
test('stored deadline cannot be shortened by another caller',fixed_deadline)
def retry():
    c=val(claim('retry'));assert val(settle('retry',c,'fail'));d=val(claim('retry'));assert d['attempt_count']==2
    assert val(settle('retry',d,'dead_letter'));r=val(claim('retry'));assert r['status']=='dead_letter' and not r['claimed']
    return 'Retry increments generation; terminal state blocks new automatic executions'
test('retry and dead-letter state survive independent connections',retry)
def type_conflict():
    val(claim('type'));p=run(claim('type',event_type='checkout.session.completed')+';',False)
    assert p.returncode and 'EFFECT_EVENT_TYPE_CONFLICT' in p.stderr
    return 'Same event/effect cannot change its event type'
test('event type conflict',type_conflict)
def rollback():
    c=val(claim('rollback'));before=state('rollback')
    run('BEGIN; SET LOCAL ROLE service_role; '+settle('rollback',c)+'; ROLLBACK;')
    assert state('rollback')==before
    run("ALTER TABLE velmere_webhook_private.effects ADD CONSTRAINT q5_injected CHECK (event_id <> 'rollback' OR status <> 'completed');")
    p=run('SET ROLE service_role; '+settle('rollback',c)+';',False);assert p.returncode
    assert state('rollback')==before
    run('ALTER TABLE velmere_webhook_private.effects DROP CONSTRAINT q5_injected;')
    assert val(settle('rollback',c));return 'Caller rollback and injected write failure preserve original state; retry succeeds'
test('rollback and failed writes preserve the lease and receipt atomically',rollback)
def acl():
    for role in ['anon','authenticated']:
        for statement in ['SELECT * FROM velmere_webhook_private.effects',claim('denied'),settle('race',{'attempt_count':1,'lease_token':str(uuid.uuid4())})]:
            p=run('SET ROLE '+role+'; '+statement+';',False);assert p.returncode and 'permission denied' in p.stderr
    assert not val("SELECT has_table_privilege('service_role','velmere_webhook_private.effects','DELETE')",role='postgres')
    return 'Untrusted roles denied; service role is trusted but has no DELETE grant'
test('native ACL boundaries',acl)
def restore():
    p=subprocess.run(['pg_dump','--format=custom','--no-owner','--file',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60)
    assert p.returncode==0,p.stderr
    run('CREATE DATABASE q5_effect_restore;')
    p=subprocess.run(['pg_restore','--exit-on-error','--no-owner','--dbname=q5_effect_restore',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=60)
    assert p.returncode==0,p.stderr
    query="SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY event_id,effect_key)::text,'')) FROM velmere_webhook_private.effects t"
    assert val(query,role='postgres')==val(query,role='postgres',database='q5_effect_restore')
    assert val(claim('race'),database='q5_effect_restore')['status']=='completed'
    assert val(claim('retry'),database='q5_effect_restore')['status']=='dead_letter'
    assert not val("SELECT has_table_privilege('authenticated','velmere_webhook_private.effects','SELECT')",role='postgres',database='q5_effect_restore')
    return 'Logical restore preserved receipts, terminal state and permissions; not Supabase DR'
test('logical backup restore',restore)
def reinstall():
    p=run("SET velmere.disposable_effect_store='ISOLATED_TEST_ONLY';\n"+SQL,False)
    assert p.returncode and 'EXISTING_EFFECT_OBJECTS_REQUIRE_REVIEW' in p.stderr
    assert state('race')['status']=='completed';return 'Existing data not overwritten'
test('reinstallation interlock',reinstall)
(OUT/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.iterdir()) if p.is_file()],indent=2))
print(json.dumps({'passed':len(rows),'failed':0,'scope':'NATIVE_POSTGRES_EFFECT_STORE_NOT_STRIPE_E2E'}))
