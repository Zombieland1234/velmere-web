"""Utilities for isolated native PostgreSQL tests; no remote/customer connection."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
TABLES = [
    'public.velmere_vlm_paid_entitlements', 'velmere_billing_private.lifecycle_events',
    'velmere_webhook_private.effects', 'public.velmere_stripe_webhook_events',
    'velmere_payment_private.event_identities', 'velmere_payment_private.event_watermarks',
    'velmere_billing_private.session_terminal_holds',
]
SQL_FILES = [
    ('entitlement','scripts/c15-q4/entitlement-store.sql'),
    ('effect','scripts/c15-q5/effect-store.sql'),
    ('event','scripts/c15-q6/event-store.sql'),
    ('watermark','scripts/c15-q7/watermark-store.sql'),
    ('terminal_hold','scripts/c15-q8/terminal-hold-store.sql'),
]

def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def lit(value: object) -> str:
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, int): return str(value)
    if isinstance(value, (dict, list)): value = json.dumps(value, separators=(',',':'))
    return "'" + str(value).replace("'", "''") + "'"

def call(name: str, *args: object) -> str:
    assert re.fullmatch(r'[a-z_]+\.[a-z_]+', name)
    return 'SELECT ' + name + '(' + ','.join(lit(x) for x in args) + ')'

def create(name: str, *, session: str | None = None) -> str:
    return call('public.velmere_create_or_read_vlm_paid_entitlement', name,
        session or 'cs_test_'+name, None, 'vlm_pro_analysis_single', 'vlm_pro_analysis',
        digest(name), {'surface':'shield','locale':'en','depth':'pro','accountIdHash':digest('owner:'+name)},
        'en',1000,'EUR',None,None,'paid','stripe_webhook',None,'2099-01-01','2026-01-01')

def hold(name: str, event: str='refund', event_id: str | None=None) -> str:
    return call('public.velmere_record_vlm_terminal_payment_hold','cs_test_'+name,
        'vlm_pro_analysis_single',digest(name),event_id or 'evt_'+name+'_'+event,event,1700000000)

def lifecycle(name: str, event: str='refund', event_id: str | None=None) -> str:
    eid = event_id or 'evt_'+name+'_'+event
    return call('public.velmere_apply_vlm_paid_entitlement_lifecycle_event',name,
        digest('stripe:'+eid+':entitlement:'+name),event,digest(eid),None,
        digest('charge.refunded' if event=='refund' else 'charge.dispute.created'),'2026-09-19T00:00:00Z')

def claim(eid: str, lease: int=300, event_type: str='charge.refunded') -> str:
    return call('public.velmere_claim_stripe_webhook_event',eid,event_type,1700000000,lease)

def settle(eid: str, attempt: int, status: str='processed') -> str:
    return call('public.velmere_complete_stripe_webhook_event',eid,'charge.refunded',attempt,status,
                None if status=='processed' else 'TEST_RETRY')

def mark(subject: str, eid: str, kind: str, created: int=1700000000) -> str:
    priority={'payment_pending':10,'payment_failed':20,'checkout_completed':40,
              'partial_refund':60,'refund':80,'chargeback':100}[kind]
    return call('public.velmere_apply_payment_event_watermark',subject,eid,created,kind,
                priority,kind in ('refund','chargeback'))

class Harness:
    def __init__(self, out: Path):
        if os.environ.get('Q10_DISPOSABLE_ACK') != 'ISOLATED_TEST_ONLY':
            raise ValueError('Explicit Q10_DISPOSABLE_ACK required.')
        if os.environ.get('PGHOST') not in ('127.0.0.1','localhost'):
            raise ValueError('Disposable loopback only; no production tunnels.')
        if os.environ.get('PGDATABASE') != 'q10_payment_fixture' or os.environ.get('PGUSER') != 'postgres':
            raise ValueError('Dedicated q10_payment_fixture / postgres required.')
        self.out=out.resolve(); self.out.mkdir(parents=True,exist_ok=False)
        self.rows=[]; self.trace_lock=threading.Lock()
        self.env=dict(os.environ,PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000')
        self.sql_hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for _,p in SQL_FILES}
        self.save()
    def run(self, query: str, *, ok: bool=True, role: str | None='service_role',
            database: str | None=None, app: str='q10-native', timeout: int=25):
        if role is not None:
            assert role in ('service_role','postgres','anon','authenticated')
            query='SET ROLE '+role+';\n'+query.rstrip(';')+';\n'
        env=dict(self.env,PGAPPNAME=app)
        if database: env['PGDATABASE']=database
        start=datetime.now(timezone.utc).isoformat()
        p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=query,
                         text=True,capture_output=True,env=env,timeout=timeout)
        with self.trace_lock:
            with (self.out/'QUERIES.jsonl').open('a') as f:
                f.write(json.dumps({'startedAt':start,'app':app,'database':env['PGDATABASE'],
                    'sql':query,'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n')
        if ok and p.returncode: raise AssertionError(p.stderr)
        return p
    def val(self, query: str, **kwargs):
        s=self.run(query,**kwargs).stdout.strip()
        if s=='t': return True
        if s=='f': return False
        if not s: return None
        return json.loads(s)
    def admin(self, query: str, **kwargs): return self.val(query,role='postgres',**kwargs)
    def denied(self, query: str, code: str, **kwargs):
        p=self.run(query,ok=False,**kwargs)
        assert p.returncode!=0 and code in p.stderr,(p.returncode,p.stderr)
        return p
    def race(self, queries: list[str], *, allow_errors: bool=False):
        barrier=threading.Barrier(len(queries))
        def one(pair):
            i,q=pair; barrier.wait(timeout=10)
            return self.run(q,ok=not allow_errors,app='q10-race-'+str(i))
        with ThreadPoolExecutor(max_workers=len(queries)) as pool:
            ps=list(pool.map(one,enumerate(queries)))
        return ps if allow_errors else [json.loads(p.stdout) for p in ps]
    def count(self, table: str, where: str='true', **kwargs):
        assert table in TABLES
        return self.admin('SELECT count(*) FROM '+table+' WHERE '+where,**kwargs)
    def state(self,name: str,**kwargs):
        return self.val('SELECT to_jsonb(status) FROM public.velmere_vlm_paid_entitlements WHERE id='+lit(name),**kwargs)
    def fingerprint(self,database: str | None=None):
        result={}
        for table in TABLES:
            result[table]=self.admin("SELECT to_jsonb(encode(sha256(convert_to(coalesce(jsonb_agg(j ORDER BY j::text)::text,'[]'),'UTF8')),'hex')) FROM (SELECT to_jsonb(t) AS j FROM "+table+' t) s',database=database)
        return result
    def wait_lock(self, app: str, blocker_pid: int):
        until=time.monotonic()+6
        while time.monotonic()<until:
            row=self.admin("SELECT jsonb_build_object('pid',pid,'waitType',wait_event_type,'waitEvent',wait_event,'blockers',pg_blocking_pids(pid)) FROM pg_stat_activity WHERE application_name="+lit(app))
            if row and row['waitType']=='Lock' and blocker_pid in row['blockers']: return row
            time.sleep(.025)
        raise AssertionError('Required native lock wait was not observed: '+app)
    def test(self,name: str,fn):
        start=datetime.now(timezone.utc).isoformat()
        try: detail=fn(); row={'name':name,'status':'PASS','detail':detail}
        except Exception as e: row={'name':name,'status':'FAIL','error':str(e)}
        row['startedAt']=start; row['finishedAt']=datetime.now(timezone.utc).isoformat()
        self.rows.append(row); self.save(); print(name+': '+row['status'],flush=True)
        if row['status']=='FAIL': raise AssertionError(row['error'])
    def save(self):
        (self.out/'RESULTS.json').write_text(json.dumps({'scope':'NATIVE_POSTGRESQL_DISPOSABLE_Q4_Q9_NOT_STRIPE_AUTH_OR_PRODUCTION',
            'sourceCommit':os.environ.get('GITHUB_SHA'), 'candidateLabel':'C15-Q10',
            'sqlSha256':self.sql_hashes,'checks':self.rows,
            'passed':sum(x['status']=='PASS' for x in self.rows),'failed':sum(x['status']=='FAIL' for x in self.rows),
            'releaseApproved':False},indent=2))

class Session:
    """A long-lived actual psql connection. Markers delimit replies, not mocks."""
    def __init__(self,h: Harness,app: str,role: str='service_role'):
        self.h=h;self.app=app;self.lines=queue.Queue()
        self.err=(h.out/(app+'.stderr')).open('w')
        self.p=subprocess.Popen(['psql','-X','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,stderr=self.err,text=True,bufsize=1,env=dict(h.env,PGAPPNAME=app))
        def drain():
            for line in self.p.stdout: self.lines.put(line.rstrip('\n'))
            self.lines.put(None)
        self.thread=threading.Thread(target=drain,daemon=True); self.thread.start()
        self.pid=int(self.execute('SELECT pg_backend_pid();')[-1])
        self.execute('SET ROLE '+role+';')
    def execute(self,sql: str):
        marker='Q10_DONE_'+uuid.uuid4().hex
        self.p.stdin.write(sql.rstrip(';')+';\n\\echo '+marker+'\n');self.p.stdin.flush()
        result=[]
        while True:
            line=self.lines.get(timeout=20)
            if line is None: raise AssertionError('Persistent connection exited: '+self.app)
            if line==marker: return result
            result.append(line)
    def close(self):
        if self.p.poll() is None:
            try: self.p.stdin.write('ROLLBACK;\n\\q\n');self.p.stdin.flush();self.p.wait(timeout=3)
            except (OSError,subprocess.TimeoutExpired): self.p.kill();self.p.wait()
        self.err.close();self.p.stdout.close();self.p.stdin.close()
    def __enter__(self):return self
    def __exit__(self,*_):self.close()
