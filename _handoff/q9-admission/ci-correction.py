"""Sequential exact-commit Q9 qualification; no production resources or payments.
A failed gate is recorded, not converted to GO by a successful subsequent group.
"""
from pathlib import Path
import datetime, hashlib, json, os, signal, subprocess, sys
ROOT=Path.cwd(); OUT=Path('/tmp/q9-final'); OUT.mkdir(exist_ok=False)
SHA=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
if SHA != os.environ.get('GITHUB_SHA'): raise SystemExit('Trigger/source mismatch')
rows=[]
def run(name,cmd,timeout=1200,extra=None):
    env=dict(os.environ);env.update(extra or {})
    log=OUT/(name+'.log');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with log.open('xb') as stream:
        p=subprocess.Popen(cmd,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
        try:code=p.wait(timeout)
        except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
    row={'id':name,'sourceSha':SHA,'command':cmd,'exitCode':code,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
    rows.append(row);(OUT/'QUALIFICATION.json').write_text(json.dumps(rows,indent=2));print(name,code,flush=True)
    return code
(OUT/'IDENTITY.json').write_text(json.dumps({'sha':SHA,'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'runId':os.environ.get('GITHUB_RUN_ID'),'branch':os.environ.get('GITHUB_REF_NAME'),'review':'INTERNAL_NOT_EXTERNAL_AUDIT'},indent=2))
run('core',['python3','scripts/c14-integration/qualify-core.py'],1800,{'C14_EVIDENCE_DIR':str(OUT/'core')})
# Core must finish recording, even when lint fails. Counts are separate hard checks.
try:
    core=json.loads((OUT/'core/QUALIFICATION.json').read_text());reg=next(r for r in core if r['id']=='combined-regressions')
    assert reg['exitCode']==0 and reg['counts']=={'tests':981,'pass':981,'fail':0,'cancelled':0,'skipped':0,'todo':0}
    files=json.loads((OUT/'core/TEST_FILES.json').read_text())['uniqueFiles'];assert len(files)==len(set(files))==58
    registration={'status':'PASS','tests':981,'files':58}
except Exception as e:registration={'status':'FAIL','error':str(e)}
(OUT/'REGISTRATION_GATE.json').write_text(json.dumps(registration,indent=2))
run('export-source',['python3','scripts/c14-integration/export-source.py'],300)
run('benchmark',['bash','scripts/c14-integration/benchmark.sh'],1200,{'C14_BENCHMARK_DIR':str(OUT/'benchmark'),'VELMERE_BENCHMARK_BASELINE_SHA':'e718df06d20a8129ffe261eef9c6c74cc5c91729'})
run('redis',['bash','scripts/c12/redis-tests.sh'],180)
run('basic-e2e',['node','scripts/c12/production-e2e.mjs',str(OUT/'runtime')],600)
# Native PostgreSQL scopes run as distinct workflow jobs, each with a fresh
# cluster. Their role bootstrap is intentionally not shared or rewritten.
run('secrets',['python3','scripts/c14-integration/scan-secrets.py'],300)
failed=[r['id'] for r in rows if r['exitCode']]
if registration['status']!='PASS':failed.append('REGISTRATION_GATE')
(OUT/'RELEASE_GATE.json').write_text(json.dumps({'status':'NO_GO','sourceSha':SHA,'failedChecks':failed,'notQualified':['actual_Auth_Stripe_lifecycle','production_migrations','all_paid_products','provider_rights','privacy_erasure','managed_disaster_recovery','generalization','external_review']},indent=2))
(OUT/'MANIFEST.json').write_text(json.dumps([{'path':str(p.relative_to(OUT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.rglob('*')) if p.is_file() and p!=OUT/'MANIFEST.json'],indent=2))
raise SystemExit(1 if failed else 0)
