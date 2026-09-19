"""Native multi-connection qualification of Q6/Q7/Q8; isolated fixture only.
No external API, customer database, Stripe payment or production migration.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, json, os, subprocess, sys

ROOT = Path(__file__).resolve().parents[2]
if os.environ.get('Q9_DISPOSABLE_ACK') != 'ISOLATED_TEST_ONLY' or os.environ.get('PGHOST') not in ('localhost', '127.0.0.1') or os.environ.get('PGDATABASE') != 'q9_platform_fixture':
    raise SystemExit('Dedicated disposable loopback database and acknowledgment required')
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=False)
rows = []

def run(query, expected=True, database=None):
    env = dict(os.environ, PGOPTIONS='-c statement_timeout=20000 -c lock_timeout=15000')
    if database: env['PGDATABASE'] = database
    p = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True, env=env, timeout=40)
    if expected and p.returncode: raise AssertionError(p.stderr)
    return p

def quote(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, dict): v = json.dumps(v)
    return "'" + str(v).replace("'", "''") + "'"

def sql(fn, *args): return 'SELECT public.' + fn + '(' + ','.join(map(quote, args)) + ')'
def val(query, role='service_role', database=None):
    text = run('SET ROLE ' + role + ';' + query + '; RESET ROLE;', database=database).stdout.strip()
    if text == 't': return True
    if text == 'f': return False
    try: return json.loads(text)
    except json.JSONDecodeError: return text

def h(s): return hashlib.sha256(s.encode()).hexdigest()
def create(name, session=None):
    return sql('velmere_create_or_read_vlm_paid_entitlement', name, session or 'cs_test_' + name, None,
        'vlm_pro_analysis_single', 'vlm_pro_analysis', h('ctx:' + name), {'accountIdHash': h(name), 'surface':'shield', 'locale':'en', 'depth':'pro'},
        'en',1000,'EUR',None,None,'paid','stripe_webhook',None,'2099-01-01','2026-01-01')
def hold(name, event=None, kind='refund', session=None):
    return sql('velmere_record_vlm_terminal_payment_hold',session or 'cs_test_' + name,'vlm_pro_analysis_single',h('ctx:'+name),event or 'evt_'+name,kind,1789750000)
def claim(event): return sql('velmere_claim_stripe_webhook_event',event,'charge.refunded',1789750000,300)
def mark(subject,event,kind,time=1789750000):
    priority={'payment_pending':10,'payment_failed':20,'checkout_completed':40,'partial_refund':60,'refund':80,'chargeback':100}[kind]
    return sql('velmere_apply_payment_event_watermark',subject,event,time,kind,priority,kind in ('refund','chargeback'))
def state(name): return val('SELECT status FROM public.velmere_vlm_paid_entitlements WHERE id='+quote(name))
def test(name, fn):
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    try: detail=fn(); row={'name':name,'status':'PASS','detail':detail}
    except Exception as e: row={'name':name,'status':'FAIL','error':str(e)}
    row['startedAt']=started; rows.append(row)
    (OUT/'RESULTS.json').write_text(json.dumps({'sourceSha':os.environ.get('GITHUB_SHA'),'scope':'DISPOSABLE_NATIVE_POSTGRES_NOT_GOTRUE_POSTGREST_OR_STRIPE','checks':rows},indent=2))
    print(name,row['status'],flush=True)
    if row['status']!='PASS': raise SystemExit(row['error'])

run((ROOT/'scripts/c15-q4/bootstrap-roles.sql').read_text())
inputs = [('c15-q4/entitlement-store.sql','entitlement'),('c15-q5/effect-store.sql','effect'),('c15-q6/event-store.sql','event'),('c15-q7/watermark-store.sql','watermark'),('c15-q8/terminal-hold-store.sql','terminal_hold')]
def install():
    manifest=[]
    for path,setting in inputs:
        body=(ROOT/'scripts'/path).read_text()
        run("SET velmere.disposable_"+setting+"_store='ISOLATED_TEST_ONLY';\n"+body)
        manifest.append({'path':path,'sha256':h(body)})
    (OUT/'SQL_INPUTS.json').write_text(json.dumps(manifest,indent=2))
    (OUT/'POSTGRES_VERSION.txt').write_text(run('SELECT version();').stdout)
    return 'All five original SQL stores installed without relaxing dependency hashes'
test('exact five-store installation and parity',install)

def inbox_parallel():
    with ThreadPoolExecutor(max_workers=16) as pool: result=list(pool.map(lambda _:val(claim('evt_inbox')),range(16)))
    assert sum(r['claimed'] for r in result)==1
    assert all(r['attempt_count']==1 for r in result)
    return {'requests':16,'claimed':1,'busy':15}
test('native inbox sixteen claimers produce one owner',inbox_parallel)
def inbox_reclaim():
    run("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='evt_inbox';")
    with ThreadPoolExecutor(max_workers=8) as pool: result=list(pool.map(lambda _:val(claim('evt_inbox')),range(8)))
    assert sum(r['claimed'] for r in result)==1 and all(r['attempt_count']==2 for r in result)
    bad=run('SET ROLE service_role;'+sql('velmere_complete_stripe_webhook_event','evt_inbox','charge.refunded',1,'processed',None)+';',False)
    assert bad.returncode and 'STALE_EVENT_SETTLEMENT' in bad.stderr
    assert val(sql('velmere_complete_stripe_webhook_event','evt_inbox','charge.refunded',2,'processed',None))['ok']
    return {'requests':8,'newOwners':1,'staleCompletion':'denied'}
test('native inbox reclaim fences older attempt',inbox_reclaim)
def ordering_parallel():
    kinds=['payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback']
    with ThreadPoolExecutor(max_workers=6) as pool:
        result=list(pool.map(lambda pair:val(mark('pi_q9_order','evt_order_'+pair[1],pair[1],1789750000+pair[0])),enumerate(kinds)))
    assert all(r['ok'] for r in result)
    assert val("SELECT event_kind FROM velmere_payment_private.event_watermarks WHERE subject_key='pi_q9_order'")=='chargeback'
    assert not val(mark('pi_q9_order','evt_order_later_checkout','checkout_completed',1789750099))['accepted']
    return 'Six concurrent kinds converge to chargeback; later lower priority refused'
test('native watermark concurrent priority ordering',ordering_parallel)
def identity_collision():
    with ThreadPoolExecutor(max_workers=2) as pool:
        result=list(pool.map(lambda s:run('SET ROLE service_role;'+mark(s,'evt_identity','refund')+';',False),['pi_id_a','pi_id_b']))
    assert sum(r.returncode==0 for r in result)==1
    assert any('PAYMENT_EVENT_IDENTITY_CONFLICT' in r.stderr for r in result)
    return 'Exactly one subject accepted the shared event identity'
test('native watermark event identity collision',identity_collision)
def early_hold():
    a=val(hold('early'));b=val(hold('early'));assert a==b and a['ok']
    r=val(create('early'));assert not r['ok'] and r['error']=='entitlement_release_hold'
    assert state('early')==''
    return 'Pre-grant hold and replay block public grant creation'
test('native terminal hold before first grant',early_hold)
def creation_race():
    commands=[create('racing')]*8+[hold('racing')]*8
    with ThreadPoolExecutor(max_workers=16) as pool: result=list(pool.map(val,commands))
    assert all(r['ok'] or r.get('error')=='entitlement_release_hold' for r in result)
    assert state('racing') in ('','refunded')
    assert val("SELECT count(*) FROM velmere_billing_private.session_terminal_holds WHERE stripe_session_id='cs_test_racing'")==1
    assert not val(create('racing'))['ok']
    return {'requests':16,'holdRows':1,'finalGrantState':state('racing') or 'not-created','activeGrant':False}
test('native first grant versus terminal hold race',creation_race)
def hold_collision():
    with ThreadPoolExecutor(max_workers=2) as pool:
        result=list(pool.map(lambda n:run('SET ROLE service_role;'+hold(n,'evt_hold_collision')+';',False),['hold_a','hold_b']))
    assert sum(r.returncode==0 for r in result)==1
    assert any('TERMINAL_HOLD_IDENTITY_CONFLICT' in r.stderr for r in result)
    return 'One event cannot hold two different sessions'
test('native terminal event session collision',hold_collision)
def hold_lifecycle_race():
    assert val(create('terminal_race'))['ok']
    lifecycle=sql('velmere_apply_vlm_paid_entitlement_lifecycle_event','terminal_race',h('other-chargeback'),'chargeback',h('source'),None,None,'2026-09-19T00:00:00Z')
    with ThreadPoolExecutor(max_workers=2) as pool: result=list(pool.map(val,[hold('terminal_race'),lifecycle]))
    assert all(r['ok'] for r in result) and state('terminal_race')=='revoked'
    return 'Concurrent hold-refund and direct chargeback finish revoked'
test('native hold and lifecycle lock ordering',hold_lifecycle_race)
def atomic_failure():
    assert val(create('atomic'))['ok']
    run("ALTER TABLE velmere_billing_private.session_terminal_holds ADD CONSTRAINT q9_failure CHECK (event_id<>'evt_atomic');")
    failed=run('SET ROLE service_role;'+hold('atomic')+';',False)
    assert failed.returncode and state('atomic')=='active'
    assert val("SELECT count(*) FROM velmere_billing_private.lifecycle_events WHERE entitlement_id='atomic'",role='postgres')==0
    run('ALTER TABLE velmere_billing_private.session_terminal_holds DROP CONSTRAINT q9_failure;')
    assert val(hold('atomic'))['ok'] and state('atomic')=='refunded'
    return 'Failed hold INSERT rolls back lifecycle and journal; retry succeeds'
test('native cross-store atomic rollback',atomic_failure)
def permissions():
    for role in ('anon','authenticated'):
        for command in (claim('denied'),mark('pi_denied','evt_denied','refund'),hold('denied'),create('denied')):
            r=run('SET ROLE '+role+';'+command+';',False)
            assert r.returncode and 'permission denied' in r.stderr
    return 'Both client roles denied across inbox, ordering, hold and grant RPC'
test('native five-store client role denial',permissions)
def restore():
    p=subprocess.run(['pg_dump','--format=custom','--no-owner','--file',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=120)
    assert not p.returncode,p.stderr
    run('CREATE DATABASE q9_platform_restore;')
    p=subprocess.run(['pg_restore','--exit-on-error','--no-owner','--dbname=q9_platform_restore',str(OUT/'fixture.dump')],capture_output=True,text=True,timeout=120)
    assert not p.returncode,p.stderr
    tables={'public.velmere_stripe_webhook_events':'id','public.velmere_vlm_paid_entitlements':'id','velmere_payment_private.event_watermarks':'subject_key','velmere_payment_private.event_identities':'event_id','velmere_billing_private.session_terminal_holds':'event_id','velmere_billing_private.lifecycle_events':'event_id_hash'}
    for table,key in tables.items():
        q=f"SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY {key})::text,'')) FROM {table} t"
        assert val(q,role='postgres')==val(q,role='postgres',database='q9_platform_restore')
    assert not val(create('early'),database='q9_platform_restore')['ok']
    assert val(claim('evt_inbox'),database='q9_platform_restore')['status']=='processed'
    return 'Six table digests match; terminal hold and inbox replay survive restore, not managed DR'
test('native logical restore of joined stores',restore)
(OUT/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='MANIFEST.json'],indent=2))
