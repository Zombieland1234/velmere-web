"""Qualify a fixed GitHub checkout. Nothing in this script writes commits or deploys production."""
from pathlib import Path
import subprocess, os, json, datetime, hashlib, re
out = Path('/tmp/c9-evidence'); out.mkdir(parents=True, exist_ok=True)
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert sha == os.environ['GITHUB_SHA'], 'Trigger SHA and qualified source SHA must match'
os.environ['C6_SOURCE_SHA'] = sha
old_tests = ['scripts/c6/route-boundaries.test.ts','scripts/c6/provider-engine-boundaries.test.ts','scripts/c6c/actual-app-regressions.test.ts','scripts/c6d/rpc-pdf-boundaries.test.ts','scripts/c6e/pdf-evidence-boundary.test.ts','scripts/c7/engine-integrity.test.ts']
new_tests = ['scripts/c8/request-boundaries.test.ts','scripts/c8/webhook-ingress.test.ts','scripts/c8/edge-boundary.test.ts','scripts/c9/engine-boundaries.test.ts','scripts/c9/engine-claims.test.ts','scripts/c9/customer-report-regressions.test.ts']
checks = [
 ('clean-install', ['npm','ci','--ignore-scripts','--no-fund'],600),
 ('edge-live-negative-probe', ['node','scripts/c8/edge-live-probe.mjs',str(out)],100),
 ('c8-c9-engine-reproductions', ['node_modules/.bin/tsx','scripts/c9/baseline-replay.ts',str(out)],180),
 ('c9-test-typescript', ['node_modules/.bin/tsc','-p','tsconfig.c9-tests.json','--pretty','false'],480),
 ('c7-bug-reproductions', ['node_modules/.bin/tsx','scripts/c8/baseline-replay.ts',str(out)],180),
 ('c8-route-webhook-regressions', ['node_modules/.bin/tsx','--test',*new_tests],240),
 ('strict-typescript', ['node_modules/.bin/tsc','--noEmit','--strict','--pretty','false'],480),
 ('c8-tests-typescript', ['node_modules/.bin/tsc','-p','tsconfig.c8-tests.json','--pretty','false'],480),
 ('all-current-route-regressions', ['node_modules/.bin/tsx','--test',*old_tests,*new_tests],480),
 ('engine-route-map', ['python3','scripts/c9/engine-route-map.py',str(out)],30),
 ('source-truth-audit', ['node','scripts/c7/source-truth-audit.mjs'],120),
 ('eslint-zero-warning', ['node_modules/.bin/eslint','.','--max-warnings','0','--format','json','--output-file',str(out/'eslint.json')],480),
 ('dependency-audit', ['npm','audit','--json'],240),
 ('dependency-tree', ['npm','ls','--all','--json'],240),
 ('production-build', ['npm','run','build'],900),
 ('engine-observations', ['node_modules/.bin/tsx','scripts/c6/engine-observations.ts',str(out/'engine')],300),
]
rows = []; initial_lock = hashlib.sha256(Path('package-lock.json').read_bytes()).hexdigest()
for name,args,limit in checks:
    start = datetime.datetime.now(datetime.timezone.utc).isoformat(); log = out/(name+'.log')
    with log.open('wb') as f:
        try: code = subprocess.run(args, stdout=f, stderr=subprocess.STDOUT, timeout=limit).returncode
        except subprocess.TimeoutExpired: code = 124
        except OSError as e: f.write(str(e).encode()); code=127
    rows.append(dict(id=name,sourceSha=sha,runId=os.environ.get('GITHUB_RUN_ID'),startedAt=start,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=args,exitCode=code,result='PASS' if code==0 else 'TIMEOUT' if code==124 else 'FAIL',scope='SYNTHETIC_INPUTS_REAL_SOURCE_NOT_STRIPE_TEST_LIFECYCLE' if 'regressions' in name else 'TARGETED_OBSERVATIONS_NOT_EXTERNAL_BENCHMARK' if name=='engine-observations' else 'C7_FILES_WITH_CURRENT_DEPENDENCIES' if name=='c7-bug-reproductions' else 'ACTUAL_SOURCE_CHECK',log=log.name,logSha256=hashlib.sha256(log.read_bytes()).hexdigest()))
    (out/'QUALIFICATION.json').write_text(json.dumps(rows,indent=2)); print(name,code,flush=True)
current_lock = hashlib.sha256(Path('package-lock.json').read_bytes()).hexdigest()
(out/'LOCKFILE_PARITY.json').write_text(json.dumps(dict(sourceSha=sha,before=initial_lock,after=current_lock,unchanged=initial_lock==current_lock),indent=2))
files=[]
for name in subprocess.check_output(['git','ls-files','-z'],text=True).split('\0'):
    if not name: continue
    raw=subprocess.check_output(['git','show','HEAD:'+name]);files.append(dict(path=name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
refs={}; package=json.loads(Path('package.json').read_text())
for name,command in package.get('scripts',{}).items():
    missing=sorted({p for p in re.findall(r'scripts/[\w./-]+\.(?:mjs|cjs|js|ts|py|sh)',command) if not Path(p).exists()})
    if missing:refs[name]=missing
(out/'SOURCE_INVENTORY.json').write_text(json.dumps(dict(sourceSha=sha,files=files,trackedFileCount=len(files),scriptsWithMissingReferencedFiles=refs,scope='LITERAL_PATH_SCAN_NOT_SHELL_SEMANTIC_PROOF'),indent=2))
(out/'SOURCE_IDENTITY.json').write_text(json.dumps(dict(repository='Zombieland1234/velmere-web',sourceSha=sha,branch=os.environ.get('GITHUB_REF_NAME'),treeSha=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),runId=os.environ.get('GITHUB_RUN_ID'),originalUI2ZipIdentityConfirmed=False,recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2))
