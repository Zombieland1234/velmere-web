#!/usr/bin/env python3
"""Qualify Q6-Q9 on a real disposable PostgreSQL server, not PGlite.

The guarded test database must be empty. Bootstrap roles separately in a new
cluster. Each failed attempt preserves its own evidence directory. No Stripe,
Supabase production connection, release approval or exactly-once assertion.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import time

spec=importlib.util.spec_from_file_location('q10_native_support',Path(__file__).with_name('native-support.py'))
support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
Harness,Session,ROOT,TABLES,SQL_FILES=(support.Harness,support.Session,support.ROOT,support.TABLES,support.SQL_FILES)
create,hold,lifecycle,claim,settle,mark,lit,digest=(support.create,support.hold,support.lifecycle,
    support.claim,support.settle,support.mark,support.lit,support.digest)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--install',action='store_true',help='Install into an empty dedicated fixture; roles must already exist.')
    args=parser.parse_args();h=Harness(args.out)
    version=h.admin('SELECT to_jsonb(version())');assert version.startswith('PostgreSQL 17.'),version
    (h.out/'POSTGRES_VERSION.txt').write_text(version+'\n')
    if args.install:
        assert h.admin("SELECT to_regclass('public.velmere_vlm_paid_entitlements') IS NULL")
        for ack,file in SQL_FILES:
            h.run("SET velmere.disposable_"+ack+"_store='ISOLATED_TEST_ONLY';\n"+(ROOT/file).read_text(),role='postgres')
    assert all(h.count(t)==0 for t in TABLES),'Fixture not empty; do not reuse a prior test database.'
    preflight=(ROOT/'scripts/c15-q9/schema-preflight.sql').read_text()
    reconciliation=(ROOT/'scripts/c15-q9/reconcile.sql').read_text()
    def schema():
        r=h.admin('BEGIN READ ONLY; '+preflight+' ROLLBACK;')
        (h.out/'SCHEMA_PREFLIGHT_INITIAL.json').write_text(json.dumps(r,indent=2))
        assert r['contractReady'] and not r['releaseApproved'] and len(r['checks'])==19
        return {'objects':19,'contractReady':True,'releaseApproved':False}
    h.test('native schema and permission preflight',schema)
    def empty():
        r=h.admin('BEGIN READ ONLY; '+reconciliation+' ROLLBACK;')
        assert r['verdict']=='EMPTY' and not r['releaseApproved'];return r
    h.test('empty installed database is not a release approval',empty)
    def event_race():
        rs=h.race([claim('evt_native_claim')]*16)
        assert sum(r['claimed'] for r in rs)==1 and all(r['attempt_count']==1 for r in rs)
        assert h.count(TABLES[3],"id='evt_native_claim'")==1
        return {'requests':16,'claimed':1,'busy':15,'attempt':1}
    h.test('sixteen real connections claim one event',event_race)
    def event_deadline():
        q="SELECT to_jsonb(lease_expires_at) FROM public.velmere_stripe_webhook_events WHERE id='evt_native_claim'"
        before=h.admin(q);r=h.val(claim('evt_native_claim',1));assert not r['claimed'] and before==h.admin(q)
        return {'storedDeadlineUnchanged':True}
    h.test('busy caller cannot shorten the persisted event lease',event_deadline)
    def event_reclaim():
        h.run("UPDATE public.velmere_stripe_webhook_events SET lease_expires_at=clock_timestamp()-interval '1s' WHERE id='evt_native_claim'",role='postgres')
        rs=h.race([claim('evt_native_claim')]*8)
        assert sum(r['claimed'] for r in rs)==1 and all(r['attempt_count']==2 for r in rs)
        for status in ('processed','retryable_failed','dead_letter'):h.denied(settle('evt_native_claim',1,status),'STALE_EVENT_SETTLEMENT')
        assert h.val(settle('evt_native_claim',2))['ok'] and not h.val(claim('evt_native_claim'))['claimed']
        return {'requests':8,'newGenerationOwners':1,'staleSettlementKindsRejected':3,'final':'processed'}
    h.test('expired event has one new generation and fences old settlements',event_reclaim)
    def event_clock():
        eid='evt_wait_clock'
        with Session(h,'q10-clock-blocker',role='postgres') as s,ThreadPoolExecutor(max_workers=1) as pool:
            s.execute('BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('+lit(eid)+',616));')
            future=pool.submit(h.val,claim(eid,1),app='q10-clock-waiter')
            wait=h.wait_lock('q10-clock-waiter',s.pid);time.sleep(1.15);s.execute('COMMIT;')
            r=future.result();assert r['claimed']
        remaining=h.admin("SELECT extract(epoch FROM lease_expires_at-clock_timestamp()) FROM public.velmere_stripe_webhook_events WHERE id="+lit(eid))
        assert remaining>.50,remaining
        assert h.val(settle(eid,1))['ok']
        return {'observedWait':wait,'remainingSecondsAfterLockRelease':remaining}
    h.test('event lease clock starts after actual advisory lock wait',event_clock)
    def event_identity():
        ps=h.race([claim('evt_identity_collision',event_type=t) for t in ('charge.refunded','charge.dispute.created')],allow_errors=True)
        assert sum(p.returncode==0 for p in ps)==1 and any('EVENT_IDENTITY_CONFLICT' in p.stderr for p in ps)
        return {'competingIdentities':2,'accepted':1}
    h.test('same event ID cannot acquire competing event types',event_identity)
    def priorities():
        kinds=['payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback']
        rs=h.race([mark('pi_priority','evt_priority_'+str(i),kind,1700000000+i) for i,kind in enumerate(kinds*2)])
        r=h.val("SELECT to_jsonb(t) FROM velmere_payment_private.event_watermarks t WHERE subject_key='pi_priority'")
        assert r['event_kind']=='chargeback' and r['event_created_at']==1700000011
        assert h.count(TABLES[4],"subject_key='pi_priority'")==12
        return {'requests':12,'finalKind':'chargeback','finalCreatedAt':r['event_created_at'],'admissions':sum(x['accepted'] for x in rs)}
    h.test('parallel mixed priorities converge to the dominant watermark',priorities)
    def same_priority():
        h.race([mark('pi_same_priority','evt_same_'+str(i),'refund',1700000000+i) for i in reversed(range(12))])
        r=h.val("SELECT to_jsonb(t) FROM velmere_payment_private.event_watermarks t WHERE subject_key='pi_same_priority'")
        assert r['event_created_at']==1700000011;return {'requests':12,'finalCreatedAt':r['event_created_at']}
    h.test('parallel equal priorities retain the newest timestamp',same_priority)
    def event_subject_collision():
        ps=h.race([mark(p,'evt_global_identity','refund') for p in ('pi_identity_a','pi_identity_b')],allow_errors=True)
        assert sum(p.returncode==0 for p in ps)==1 and any('PAYMENT_EVENT_IDENTITY_CONFLICT' in p.stderr for p in ps)
        assert h.count(TABLES[4],"event_id='evt_global_identity'")==1
        return {'payments':2,'acceptedBindings':1}
    h.test('global ordering event identity cannot move between payments',event_subject_collision)
    def ordering_lock():
        with Session(h,'q10-order-blocker') as s,ThreadPoolExecutor(max_workers=1) as pool:
            s.execute('BEGIN; '+mark('pi_blocked_order','evt_dominant','chargeback'))
            future=pool.submit(h.val,mark('pi_blocked_order','evt_late_low','checkout_completed',1800000000),app='q10-order-waiter')
            wait=h.wait_lock('q10-order-waiter',s.pid);s.execute('COMMIT;')
            r=future.result();assert not r['accepted'] and r['current']['kind']=='chargeback'
        return {'observedWait':wait,'reason':r['reason']}
    h.test('blocked ordering request re-evaluates committed terminal state',ordering_lock)
    def hold_race():
        rs=h.race([hold('native_hold_once')]*16)
        assert all(r['ok'] and r['disposition']=='held_before_grant' for r in rs)
        assert h.count(TABLES[6],"stripe_session_id='cs_test_native_hold_once'")==1
        r=h.val(create('native_hold_once'));assert not r['ok'] and r['error']=='entitlement_release_hold'
        return {'requests':16,'holds':1,'laterGrant':'denied'}
    h.test('sixteen early refunds persist one terminal hold',hold_race)
    def hold_first():
        with Session(h,'q10-hold-first') as s,ThreadPoolExecutor(max_workers=1) as pool:
            s.execute('BEGIN; '+hold('hold_first'))
            future=pool.submit(h.val,create('hold_first'),app='q10-create-waiter')
            wait=h.wait_lock('q10-create-waiter',s.pid);s.execute('COMMIT;')
            r=future.result();assert not r['ok'] and r['error']=='entitlement_release_hold'
        assert h.state('hold_first') is None;return {'observedWait':wait,'grantCreated':False}
    h.test('committed hold wins against a concurrently waiting first grant',hold_first)
    def create_first():
        with Session(h,'q10-create-first') as s,ThreadPoolExecutor(max_workers=1) as pool:
            r=json.loads(s.execute('BEGIN; '+create('create_first'))[-1]);assert r['ok']
            future=pool.submit(h.val,hold('create_first'),app='q10-hold-waiter')
            wait=h.wait_lock('q10-hold-waiter',s.pid);s.execute('COMMIT;')
            r=future.result();assert r['ok'] and r['disposition']=='lifecycle_applied'
        assert h.state('create_first')=='refunded'
        return {'observedWait':wait,'finalStatus':'refunded','lifecycleEvents':h.count(TABLES[1],"entitlement_id='create_first'")}
    h.test('committed grant is refunded by a concurrently waiting hold',create_first)
    def opposing_holds():
        assert h.val(create('opposing_holds'))['ok']
        rs=h.race([hold('opposing_holds',kind) for kind in ('refund','chargeback')])
        assert all(r['ok'] for r in rs) and h.state('opposing_holds')=='revoked'
        assert h.count(TABLES[6],"stripe_session_id='cs_test_opposing_holds'")==2
        assert not h.val(create('opposing_holds'))['ok']
        return {'requests':2,'finalStatus':'revoked','holds':2}
    h.test('concurrent refund and chargeback holds never reactivate a grant',opposing_holds)
    def hold_identity():
        for name in ('collision_a','collision_b'):assert h.val(create(name))['ok']
        ps=h.race([hold(name,event_id='evt_hold_collision') for name in ('collision_a','collision_b')],allow_errors=True)
        assert sum(p.returncode==0 for p in ps)==1 and any('TERMINAL_HOLD_IDENTITY_CONFLICT' in p.stderr for p in ps)
        assert sorted(h.state(n) for n in ('collision_a','collision_b'))==['active','refunded']
        return {'conflictingSessions':2,'holds':1,'unchangedOtherGrant':True}
    h.test('same hold event cannot mutate two different payment sessions',hold_identity)
    def common_event_lock():
        name='ordinary_vs_hold';assert h.val(create(name))['ok']
        key=digest('stripe:evt_'+name+'_refund:entitlement:'+name)
        with Session(h,'q10-lifecycle-owner') as s,ThreadPoolExecutor(max_workers=1) as pool:
            s.execute('BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('+lit(key)+',415))')
            future=pool.submit(h.val,hold(name),app='q10-shared-event-waiter')
            wait=h.wait_lock('q10-shared-event-waiter',s.pid)
            # A row-before-event implementation would deadlock here. Require
            # an observed blocked connection, not just simultaneous scheduling.
            assert json.loads(s.execute(lifecycle(name))[-1])['ok'];s.execute('COMMIT;')
            assert future.result()['disposition']=='already_terminal'
        assert h.state(name)=='refunded' and h.count(TABLES[1],"entitlement_id='ordinary_vs_hold'")==1
        return {'observedWait':wait,'lifecycleEvents':1,'deadlock':False}
    h.test('ordinary lifecycle and hold use compatible observed lock order',common_event_lock)
    def failed_insert(table: str,name: str,constraint: str):
        assert h.val(create(name))['ok'];predicate='entitlement_id' if table==TABLES[1] else 'stripe_session_id'
        value=name if table==TABLES[1] else 'cs_test_'+name
        h.run('ALTER TABLE '+table+' ADD CONSTRAINT '+constraint+' CHECK ('+predicate+' <> '+lit(value)+')',role='postgres')
        try:
            h.denied(hold(name),constraint);assert h.state(name)=='active'
            assert h.count(TABLES[1],'entitlement_id='+lit(name))==0
            assert h.count(TABLES[6],'stripe_session_id='+lit('cs_test_'+name))==0
        finally:h.run('ALTER TABLE '+table+' DROP CONSTRAINT '+constraint,role='postgres')
        assert h.val(hold(name))['ok'] and h.state(name)=='refunded'
        return {'failedInsert':table,'allChangesRolledBack':True,'retrySucceeded':True}
    h.test('failed hold insertion atomically rolls back status and lifecycle',lambda:failed_insert(TABLES[6],'fail_hold','q10_reject_hold'))
    h.test('failed lifecycle insertion atomically rolls back status and hold',lambda:failed_insert(TABLES[1],'fail_lifecycle','q10_reject_lifecycle'))
    def outer_rollback():
        before=h.fingerprint()
        h.run('BEGIN; '+claim('evt_rollback_all')+'; '+mark('pi_rollback_all','evt_rollback_all','refund')+'; '+hold('rollback_all',event_id='evt_rollback_all')+'; ROLLBACK;')
        assert h.fingerprint()==before;return {'tablesCompared':7,'unchanged':True}
    h.test('caller rollback across inbox ordering and hold leaves no persisted changes',outer_rollback)
    def acknowledgement():
        # Discard a successfully committed reply. Not process death/packet loss.
        h.run(hold('ack_lost'));before=h.fingerprint();assert not h.val(create('ack_lost'))['ok']
        assert h.val(hold('ack_lost'))['ok'] and h.fingerprint()==before
        return {'replyDiscardedAfterCommit':True,'retryAddedRows':0,'laterGrant':'denied'}
    h.test('discarded committed hold reply can be retried without a second mutation',acknowledgement)
    def read_only():
        assert h.val(claim('evt_diagnostic_retry'))['claimed']
        assert h.val(settle('evt_diagnostic_retry',1,'retryable_failed'))['ok']
        before=h.fingerprint();r=h.admin('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '+reconciliation+' ROLLBACK;')
        assert h.fingerprint()==before and not r['releaseApproved']
        assert r['verdict']=='REVIEW_REQUIRED' and r['issueCount']>0
        (h.out/'RECONCILIATION.json').write_text(json.dumps(r,indent=2))
        return {'tablesUnchanged':7,'verdict':r['verdict'],'knownTestIssues':r['issueCount']}
    h.test('native reconciliation sees seeded states without changing seven tables',read_only)
    def operator_wrapper():
        out=h.out/'operator-result.json';env=dict(h.env,VELMERE_READONLY_RECONCILIATION_ACK='INTERNAL_READONLY_REVIEW')
        before=h.fingerprint()
        p=subprocess.run(['bash',str(ROOT/'scripts/c15-q9/read-reconciliation.sh'),str(out)],env=env,capture_output=True,text=True,timeout=15)
        assert p.returncode==0,p.stderr;assert out.stat().st_mode & 0o077 == 0
        r=json.loads(out.read_text());assert not r['releaseApproved'];raw=out.read_bytes()
        p=subprocess.run(['bash',str(ROOT/'scripts/c15-q9/read-reconciliation.sh'),str(out)],env=env,capture_output=True,text=True,timeout=15)
        assert p.returncode!=0 and out.read_bytes()==raw and h.fingerprint()==before
        return {'nativeWrapper':True,'exclusiveOutput':True,'permissions':'0600','unchangedTables':7}
    h.test('actual operator wrapper produces private output and refuses overwrite',operator_wrapper)
    def wrapper_timeout():
        out=h.out/'operator-timeout.json';env=dict(h.env,VELMERE_READONLY_RECONCILIATION_ACK='INTERNAL_READONLY_REVIEW')
        with Session(h,'q10-scan-blocker',role='postgres') as s:
            s.execute('BEGIN; LOCK TABLE public.velmere_vlm_paid_entitlements IN ACCESS EXCLUSIVE MODE')
            p=subprocess.run(['bash',str(ROOT/'scripts/c15-q9/read-reconciliation.sh'),str(out)],env=env,capture_output=True,text=True,timeout=15)
            assert p.returncode!=0 and 'lock timeout' in p.stderr,p.stderr
            assert not out.read_text().strip(),'Timeout must never yield healthy JSON.';s.execute('ROLLBACK;')
        (h.out/'operator-timeout.stderr').write_text(p.stderr)
        return {'nonzeroExit':p.returncode,'healthyResultWritten':False}
    h.test('native lock timeout is an error rather than a healthy empty scan',wrapper_timeout)
    def snapshot():
        with Session(h,'q10-snapshot-reader',role='postgres') as s:
            s.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            before=json.loads(s.execute(reconciliation)[-1]);assert h.val(hold('snapshot_external_writer'))['ok']
            during=json.loads(s.execute(reconciliation)[-1]);assert before['counts']==during['counts'];s.execute('COMMIT;')
        after=h.admin(reconciliation);assert after['counts']['terminalHolds']==before['counts']['terminalHolds']+1
        return {'snapshotCountsStable':True,'newSnapshotSeesWriter':True}
    h.test('read-only repeatable-read scan holds a consistent snapshot across a writer',snapshot)
    def acl():
        attempts=0
        for role in ('anon','authenticated'):
            for q in (claim('evt_acl'),mark('pi_acl','evt_acl','refund'),hold('acl'),create('acl'),*['SELECT * FROM '+t for t in TABLES]):
                h.denied(q,'permission denied',role=role);attempts+=1
        return {'roles':2,'deniedStatements':attempts,'noUserJwtClaim':True}
    h.test('native client-role ACL boundaries across all five stores',acl)
    def backup_restore():
        target='q10_payment_restore';before=h.fingerprint();h.run('CREATE DATABASE '+target,role='postgres')
        try:
            p=subprocess.run(['pg_dump','--format=custom','--no-owner','--file',str(h.out/'fixture.dump')],env=h.env,capture_output=True,text=True,timeout=60)
            assert p.returncode==0,p.stderr
            p=subprocess.run(['pg_restore','--exit-on-error','--no-owner','--dbname='+target,str(h.out/'fixture.dump')],env=h.env,capture_output=True,text=True,timeout=60)
            assert p.returncode==0,p.stderr
            after=h.fingerprint(target);assert before==after;r=h.admin(preflight,database=target);assert r['contractReady']
            assert not h.val(create('native_hold_once'),database=target)['ok']
            assert not h.val(claim('evt_native_claim'),database=target)['claimed']
            assert h.val(hold('ack_lost'),database=target)['ok'] and h.state('opposing_holds',database=target)=='revoked'
            assert h.fingerprint(target)==before
            (h.out/'RESTORE_COMPARISON.json').write_text(json.dumps({'before':before,'after':after,'schema':r},indent=2))
            return {'tables':7,'hashesMatch':True,'terminalHoldsAndClaimsPreserved':True,
                    'scope':'logical database restore; roles already exist in fixture; not Supabase Auth/Storage/PITR'}
        finally:h.run('DROP DATABASE '+target,role='postgres')
    h.test('matched backup clients preserve data ACL and terminal replay after restore',backup_restore)
    def no_overwrite():
        before=h.fingerprint()
        for ack,path in SQL_FILES[2:]:
            p=h.run("SET velmere.disposable_"+ack+"_store='ISOLATED_TEST_ONLY';\n"+(ROOT/path).read_text(),ok=False,role='postgres')
            assert p.returncode!=0 and ('REQUIRE_REVIEW' in p.stderr or 'PARITY_REVIEW_REQUIRED' in p.stderr)
        assert h.fingerprint()==before;return {'installersRefused':3,'dataUnchanged':True}
    h.test('existing native schema cannot be silently overwritten by candidates',no_overwrite)
    h.save()
    (h.out/'MANIFEST.json').write_text(json.dumps([{'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in sorted(h.out.iterdir()) if p.is_file() and p.name!='MANIFEST.json'],indent=2))
    print(json.dumps({'passed':len(h.rows),'failed':0,'releaseApproved':False}),flush=True)

if __name__=='__main__':main()
