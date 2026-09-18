"""Disposable native PostgreSQL checks. No production, Stripe, or customer data."""
import os,sys,json,subprocess,tempfile,pathlib,concurrent.futures,hashlib,datetime
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
if os.environ.get('Q7_DISPOSABLE_ACK')!='ISOLATED_TEST_ONLY' or os.environ.get('PGHOST') not in ('localhost','127.0.0.1') or os.environ.get('PGDATABASE')!='q7_order_fixture':
    raise SystemExit('DISPOSABLE_LOCAL_Q7_DATABASE_REQUIRED')
def cmd(args,**kw): return subprocess.run(args,check=True,capture_output=True,text=True,**kw)
def sql(text,ok=True):
    p=subprocess.run(['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-c',text],capture_output=True,text=True)
    if ok and p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip() if ok else p.returncode
for file in ['scripts/c15-q4/bootstrap-roles.sql']:
    cmd(['psql','-X','-v','ON_ERROR_STOP=1','-f',file])
for name,file in [('event','scripts/c15-q6/event-store.sql'),('watermark','scripts/c15-q7/watermark-store.sql')]:
    sql(f"SET velmere.disposable_{name}_store='ISOLATED_TEST_ONLY';"+pathlib.Path(file).read_text())
priority={'payment_pending':10,'payment_failed':20,'checkout_completed':40,'partial_refund':60,'refund':80,'chargeback':100}
def call(subject,event,kind='refund',created=1700000000):
    return f"SELECT public.velmere_apply_payment_event_watermark('{subject}','{event}',{created},'{kind}',{priority[kind]},{str(kind in ('refund','chargeback')).lower()});"
def parsed(query):return json.loads(sql('SET ROLE service_role;'+query).splitlines()[-1])
rows=[]
def case(name,fn):
    try: fn();r={'name':name,'status':'PASS'}
    except Exception as exc:r={'name':name,'status':'FAIL','error':str(exc)}
    rows.append(r);(out/'RESULTS.json').write_text(json.dumps({'sourceSha':os.environ.get('GITHUB_SHA'),'cases':rows},indent=2));print(name,r['status'],flush=True)
def claims():
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool: result=list(pool.map(lambda _:parsed(call('parallel:one','evt_parallel')),range(16)))
    assert sum(r['accepted'] for r in result)==1
    assert sum(r['reason']=='duplicate_event' for r in result)==15
case('16 concurrent deliveries yield one accepted observation and 15 duplicates',claims)
def priorities():
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(lambda k:parsed(call('parallel:priority','evt_priority_'+k,k)),priority))
    assert sql("SELECT kind FROM public.velmere_payment_event_watermarks WHERE subject_key='parallel:priority'")=='chargeback'
case('six unordered event kinds converge to chargeback for one subject',priorities)
def conflict():
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(lambda s:sql('SET ROLE service_role;'+call(s,'evt_conflict'),ok=False),['identity:a','identity:b']))
    assert sum(code==0 for code in r)==1 and sum(code!=0 for code in r)==1
    assert sql("SELECT count(*) FROM public.velmere_payment_event_watermarks WHERE subject_key LIKE 'identity:%'")=='1'
case('one event cannot bind two payment subjects concurrently',conflict)
def old():
    parsed(call('same:priority','evt_new','refund',1700000002));r=parsed(call('same:priority','evt_old','refund',1700000000));assert not r['accepted'] and r['reason']=='older_same_priority'
case('same-priority older event preserves the current watermark',old)
def rollback():
    sql('BEGIN; SET ROLE service_role;'+call('rollback:native','evt_rollback')+'ROLLBACK;')
    assert sql("SELECT count(*) FROM velmere_billing_private.payment_event_identities WHERE event_id='evt_rollback'")=='0'
case('outer rollback removes both watermark and identity',rollback)
def injected():
    parsed(call('failure:native','evt_failure_before','checkout_completed'))
    sql("CREATE FUNCTION public.q7_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'controlled_failure';END$$;CREATE TRIGGER q7_fail BEFORE UPDATE ON public.velmere_payment_event_watermarks FOR EACH ROW EXECUTE FUNCTION public.q7_fail();")
    try:
        assert sql('SET ROLE service_role;'+call('failure:native','evt_failure_after'),ok=False)!=0
        assert sql("SELECT count(*) FROM velmere_billing_private.payment_event_identities WHERE event_id='evt_failure_after'")=='0'
        assert sql("SELECT kind FROM public.velmere_payment_event_watermarks WHERE subject_key='failure:native'")=='checkout_completed'
    finally:sql('DROP TRIGGER q7_fail ON public.velmere_payment_event_watermarks; DROP FUNCTION public.q7_fail();')
    assert parsed(call('failure:native','evt_failure_after'))['accepted']
case('failed watermark write rolls back identity insertion; retry works',injected)
def inbox():
    query="SELECT public.velmere_claim_stripe_webhook_event('evt_inbox','charge.refunded',1700000000,300);"
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:r=list(pool.map(lambda _:parsed(query),range(16)))
    assert sum(x['claimed'] for x in r)==1
    sql("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='evt_inbox'")
    assert parsed(query)['attempt_count']==2
    assert sql("SET ROLE service_role;SELECT public.velmere_complete_stripe_webhook_event('evt_inbox','charge.refunded',1,'processed',NULL)",ok=False)!=0
    parsed("SELECT public.velmere_complete_stripe_webhook_event('evt_inbox','charge.refunded',2,'processed',NULL)")
    assert parsed(query)['status']=='processed'
case('Q6 inbox native contention and old-attempt settlement fencing',inbox)
def acl():
    for role in ['anon','authenticated']:
        assert sql(f'SET ROLE {role};'+call('acl:q7','evt_acl'),ok=False)!=0
        assert sql(f'SET ROLE {role};SELECT * FROM public.velmere_payment_event_watermarks',ok=False)!=0
    assert sql('SET ROLE service_role;DELETE FROM velmere_billing_private.payment_event_identities',ok=False)!=0
case('untrusted roles cannot read or call; service journal cannot be deleted',acl)
def restore():
    dump=str(out/'fixture.dump');cmd(['pg_dump','-Fc','-f',dump]);cmd(['createdb','q7_order_restore']);cmd(['pg_restore','--exit-on-error','-d','q7_order_restore',dump])
    before=sql("SELECT json_agg(t ORDER BY t.subject_key)::text FROM public.velmere_payment_event_watermarks t")
    old=os.environ['PGDATABASE'];os.environ['PGDATABASE']='q7_order_restore'
    try:
        assert sql("SELECT json_agg(t ORDER BY t.subject_key)::text FROM public.velmere_payment_event_watermarks t")==before
        assert not parsed(call('parallel:one','evt_parallel'))['accepted']
        assert sql("SELECT status FROM public.velmere_stripe_webhook_events WHERE id='evt_inbox'")=='processed'
        assert sql('SET ROLE anon;SELECT * FROM public.velmere_payment_event_watermarks',ok=False)!=0
    finally:os.environ['PGDATABASE']=old
case('logical restore preserves observed state identity dedupe inbox and ACL',restore)
def reinstall():
    assert sql("SET velmere.disposable_watermark_store='ISOLATED_TEST_ONLY';"+pathlib.Path('scripts/c15-q7/watermark-store.sql').read_text(),ok=False)!=0
case('reinstallation refuses to overwrite observed states',reinstall)
(out/'POSTGRES_VERSION.txt').write_text(sql('select version()'))
(out/'SOURCE_SHA.txt').write_text(os.environ.get('GITHUB_SHA','LOCAL_UNCOMMITTED')+'\n')
(out/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir()) if p.is_file()],indent=2))
if len(rows)!=10 or any(r['status']!='PASS' for r in rows):sys.exit(1)
