"""Internal exact-SHA qualification. Does not write to providers or production."""
from pathlib import Path
import datetime, hashlib, json, os, re, shutil, signal, subprocess
ROOT=Path.cwd(); OUT=Path(os.environ.get('C14_EVIDENCE_DIR','/tmp/c14-integration'));OUT.mkdir(parents=True,exist_ok=True)
SHA=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert SHA==os.environ['GITHUB_SHA']
BASE='4cb45bbcf910f0517d4a5d265682cd2f7e4e41df'
subprocess.run(['git','merge-base','--is-ancestor',BASE,SHA],check=True)
rows=[]
def run(name,args,timeout=600,cwd=ROOT,scope='INTERNAL_SOURCE_QUALIFICATION'):
    log=OUT/(name+'.log');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    assert not log.exists(), 'Do not overwrite evidence from an earlier attempt'
    with log.open('wb') as stream:
        try:
            p=subprocess.Popen(args,cwd=cwd,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
            try:code=p.wait(timeout)
            except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
        except OSError as error:stream.write(str(error).encode());code=127
    text=log.read_text(errors='replace');counts={}
    for key in ['tests','pass','fail','cancelled','skipped','todo']:
        found=re.findall(r'^# '+key+r' (\d+)\s*$',text,re.M)
        if found:counts[key]=int(found[-1])
    row={'id':name,'sourceSha':SHA,'command':args,'cwd':str(cwd),'scope':scope,'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'counts':counts,'log':log.name,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
    rows.append(row);(OUT/'QUALIFICATION.json').write_text(json.dumps(rows,indent=2));print(name,code,counts,flush=True)
    return code
(OUT/'IDENTITY.json').write_text(json.dumps({'sourceSha':SHA,'tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),'branch':os.environ['GITHUB_REF_NAME'],'runId':os.environ['GITHUB_RUN_ID'],'attempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'base':BASE,'node':subprocess.check_output(['node','--version'],text=True).strip()},indent=2))
run('initial-status',['git','status','--porcelain'],30)
if run('install',['npm','ci','--foreground-scripts','--no-fund'],600)!=0:raise SystemExit('Dependency installation failed; remaining checks are BLOCKED')
run('dependency-structure',['node','scripts/c14/dependency-audit.mjs'],60)
run('npm-audit',['npm','audit','--json'],180)
run('dependency-tree',['npm','ls','--all','--json'],180)
run('worker-build',['npm','run','build:audit-worker'],180)
old=['scripts/c6/route-boundaries.test.ts','scripts/c6/provider-engine-boundaries.test.ts','scripts/c6c/actual-app-regressions.test.ts','scripts/c6d/rpc-pdf-boundaries.test.ts','scripts/c6e/pdf-evidence-boundary.test.ts','scripts/c7/engine-integrity.test.ts','scripts/c8/request-boundaries.test.ts','scripts/c8/webhook-ingress.test.ts','scripts/c8/edge-boundary.test.ts','scripts/c9/engine-boundaries.test.ts','scripts/c9/engine-claims.test.ts','scripts/c9/customer-report-regressions.test.ts',*[str(p) for p in sorted(Path('scripts/c10').glob('*.test.ts'))],'scripts/c12/production-boundaries.test.ts','scripts/c12/unavailable-report.test.ts','scripts/c12/host-normalization.test.ts','scripts/c13/source-boundary.test.ts','scripts/c13/config-preflight.test.ts','scripts/c11/local-stack.test.ts','scripts/c11/isolated-engine.test.ts','scripts/c11/customer-target.test.ts']
new=[str(p) for p in sorted(Path('scripts/c14-p01').glob('*.test.ts'))]+['scripts/c14/unsafe-json-boundary.test.ts']+[str(p) for p in sorted(Path('scripts/c14-integration').glob('*.test.ts'))]
if Path('scripts/c14-integration/accepted-tests.json').exists():new+=json.loads(Path('scripts/c14-integration/accepted-tests.json').read_text())
tests=list(dict.fromkeys(old+new));(OUT/'TEST_FILES.json').write_text(json.dumps({'baseFiles':old,'newFiles':sorted(set(new)-set(old)),'uniqueFiles':tests,'countsFrom': 'combined-regressions TAP only; focused and repeated runs never added'},indent=2))
run('combined-regressions',['node_modules/.bin/tsx','--test','--test-reporter=tap',*tests],900,scope='REAL_SOURCE_SYNTHETIC_FIXTURES_NOT_STRIPE_OR_HOSTED_E2E')
run('compiler-origin-matrix',['node_modules/.bin/tsx','scripts/c14/compiler-origin-matrix.ts',str(OUT/'compiler')],240)
run('secret-triage-tests',['python3','scripts/c14/test_secret_triage.py'],60)
run('strict-typescript',['node_modules/.bin/tsc','--noEmit','--strict','--pretty','false'],600)
for config in sorted(Path('.').glob('tsconfig.c*-tests.json')):
    run('types-'+config.stem,['node_modules/.bin/tsc','-p',str(config),'--pretty','false'],600)
if Path('tsconfig.c14-all.json').exists():run('all-typescript',['node_modules/.bin/tsc','-p','tsconfig.c14-all.json','--pretty','false'],600)
run('lint-coverage',['node','scripts/c14/check-eslint-coverage.mjs'],600)
run('eslint-zero-warning',['node_modules/.bin/eslint','.','--max-warnings','0','--format','json','--output-file',str(OUT/'eslint.json')],600)
run('production-build',['npm','run','build'],1200)
run('final-status',['git','status','--porcelain'],30)
# Capture exact changed inputs. Generated-file changes are disclosed, never silently reset.
run('worktree-diff',['git','diff','--stat'],30)
blockers=[r['id'] for r in rows if r['exitCode'] and r['id'] not in []]
(OUT/'CORE_GATE.json').write_text(json.dumps({'sourceSha':SHA,'status':'NO_GO','failedChecks':blockers,'notClaimed':['hosted_paid_E2E','external_independent_audit','all_products_qualified','generalization','production_configuration']},indent=2))
(OUT/'EVIDENCE_MANIFEST.json').write_text(json.dumps([{'path':str(p.relative_to(OUT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='EVIDENCE_MANIFEST.json'],indent=2))
raise SystemExit(1 if blockers else 0)
