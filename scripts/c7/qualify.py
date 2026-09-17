"""C7 qualification of the exact checked-out application SHA. No self-modifying commit."""
from pathlib import Path
import subprocess,os,json,datetime,hashlib,re
out=Path('/tmp/c7-evidence');out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();os.environ['C7_SOURCE_SHA']=sha
checks=[
 ('clean-install',['npm','ci','--ignore-scripts','--no-fund'],600),
 ('strict-typescript',['node_modules/.bin/tsc','--noEmit','--strict','--pretty','false'],480),
 ('eslint-zero-warning',['node_modules/.bin/eslint','.','--max-warnings','0','--format','json','--output-file',str(out/'eslint.json')],480),
 ('dependency-audit',['npm','audit','--json'],240),
 ('dependency-tree',['npm','ls','--all','--json'],240),
 ('actual-route-and-regression-tests',['node_modules/.bin/tsx','--test','scripts/c6/route-boundaries.test.ts','scripts/c6/provider-engine-boundaries.test.ts','scripts/c6c/actual-app-regressions.test.ts','scripts/c6d/rpc-pdf-boundaries.test.ts','scripts/c6e/pdf-evidence-boundary.test.ts','scripts/c7/engine-integrity.test.ts'],420),
 ('source-truth-audit',['node','scripts/c7/source-truth-audit.mjs'],120),
 ('production-build',['npm','run','build'],900),
 ('engine-observations',['node_modules/.bin/tsx','scripts/c6/engine-observations.ts',str(out/'engine')],300),
]
rows=[];lock0=hashlib.sha256(Path('package-lock.json').read_bytes()).hexdigest()
for name,args,limit in checks:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();log=out/(name+'.log')
 with log.open('wb') as f:
  try: code=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,timeout=limit).returncode
  except subprocess.TimeoutExpired: code=124
  except OSError as e: f.write(str(e).encode());code=127
 scope='OBSERVATION_COLLECTION_NOT_PUBLIC_BENCHMARK' if name=='engine-observations' else 'ACTUAL_SOURCE_CHECK'
 rows.append(dict(id=name,sourceSha=sha,startedAt=start,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=args,exitCode=code,result='PASS' if code==0 else 'TIMEOUT' if code==124 else 'FAIL',scope=scope,log=log.name,logSha256=hashlib.sha256(log.read_bytes()).hexdigest()))
 (out/'QUALIFICATION.json').write_text(json.dumps(rows,indent=2));print(name,code,flush=True)
lock1=hashlib.sha256(Path('package-lock.json').read_bytes()).hexdigest();(out/'LOCKFILE_PARITY.json').write_text(json.dumps(dict(before=lock0,after=lock1,unchanged=lock0==lock1,sourceSha=sha),indent=2))
paths=[p for p in subprocess.check_output(['git','ls-files','-z'],text=True).split('\0') if p];manifest=[];hits=[]
patterns={'private_key':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),'stripe_live_secret':re.compile(r'sk_live_[A-Za-z0-9]{24,}')}
for name in paths:
 p=Path(name)
 if not p.is_file():continue
 raw=p.read_bytes();manifest.append(dict(path=name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw)))
 if p.suffix in {'.ts','.tsx','.js','.mjs','.json','.md','.txt','.yml','.yaml','.sql','.env'} and len(raw)<5000000:
  text=raw.decode('utf8',errors='replace')
  for kind,pattern in patterns.items():
   for m in pattern.finditer(text):hits.append(dict(path=name,line=text[:m.start()].count('\n')+1,kind=kind,fingerprint=hashlib.sha256(m.group().encode()).hexdigest()))
package=json.loads(Path('package.json').read_text());refs={}
for k,v in package.get('scripts',{}).items():
 missing=[p for p in re.findall(r'scripts/[\w./-]+\.(?:mjs|cjs|js|ts|py|sh)',v) if not Path(p).exists()]
 if missing:refs[k]=sorted(set(missing))
(out/'SOURCE_INVENTORY.json').write_text(json.dumps(dict(sourceSha=sha,trackedFileCount=len(paths),scriptCount=len(package.get('scripts',{})),scriptsWithMissingReferencedFiles=refs,scanScope='DIRECT_LITERAL_SCRIPT_PATHS_NOT_SHELL_SEMANTIC_PROOF',credentialCandidates=hits,secretScanScope='LIMITED_PATTERN_SCAN_NOT_COMPLETE_SECRET_AUDIT',files=manifest),indent=2))
(out/'SOURCE_IDENTITY.json').write_text(json.dumps(dict(repository='Zombieland1234/velmere-web',branch=os.environ.get('GITHUB_REF_NAME'),sourceSha=sha,treeSha=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),originalUI2ZipIdentityConfirmed=False,runId=os.environ.get('GITHUB_RUN_ID'),recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2))
