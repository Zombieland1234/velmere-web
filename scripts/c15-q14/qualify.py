#!/usr/bin/env python3
"""Run a frozen local qualification, retaining failures, hashes and exact scope."""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--candidate', default='C15-Q14-local')
    parser.add_argument('--build-strategy', choices=('monolithic','staged'), default='monolithic')
    args = parser.parse_args()
    if not re.fullmatch(r'C15-Q[1-9][0-9]*-local', args.candidate):
        parser.error('Candidate must be a local C15 pass label, never a fabricated commit.')
    root = Path(__file__).resolve().parents[2]
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    files = json.loads((root/'scripts/c15-q14/TEST_FILES.json').read_text())
    if len(files) != 63 or len(files) != len(set(files)):
        raise ValueError('Expected the reviewed, unique 63-file scope.')
    for name in files:
        path = (root/name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('Missing or unsafe test file: '+name)
    expected = 1023 + 149 + 11
    env = dict(os.environ, CI='1', NEXT_TELEMETRY_DISABLED='1',
               VELMERE_CANONICAL_ORIGIN='http://localhost:3000',
               VELMERE_LOOPBACK_HTTP_BROWSER_PROOF='true',
               NODE_OPTIONS='--max-old-space-size=2560', RAYON_NUM_THREADS='2')
    for name in ('GITHUB_SHA', 'C6_SOURCE_SHA', 'GIT_DIR', 'GIT_WORK_TREE',
                 'PGDATABASE', 'PGHOST', 'PGUSER', 'Q12_DISPOSABLE_ACK'):
        env.pop(name, None)
    checks = [
        ('worker', ['node','scripts/c11/build-audit-worker.mjs'], 180),
        ('regressions', ['node','node_modules/tsx/dist/cli.mjs','--test','--test-reporter=tap',*files], 900),
        ('strict', ['node','node_modules/typescript/bin/tsc','--noEmit','--strict','--pretty','false'], 300),
    ]
    configs = sorted(root.glob('tsconfig.c*-tests.json'))
    checks += [(p.stem, ['node','node_modules/typescript/bin/tsc','-p',str(p),'--pretty','false'], 240) for p in configs]
    checks += [
        ('lint', ['node','node_modules/eslint/bin/eslint.js','.','--max-warnings','0','--format','json','--output-file',str(out/'eslint.json')], 300),
        (('build-monolithic', ['npm','run','build'], 900) if args.build_strategy=='monolithic'
         else ('build-staged', ['python','scripts/c15-q16/staged-build.py','--out',str(out/'staged-build')], 2700)),
    ]
    result = {'candidate':args.candidate,'candidateCommitSha':None,
              'buildStrategy':args.build_strategy,'monolithicBuildQualified':False, 'nodeHeapMegabytes':2560,
              'baseSha':'5690d7d6ffe75236b03833f47f00cc018f43a083',
              'scope':'LOCAL_ONLY_NOT_HOSTED_AUTH_OR_STRIPE_TEST',
              'expectedRegressionCases':expected,'files':files,'testConfigs':len(configs),
              'nativeScope':'Separate evidence; not added to regression count','checks':[],'releaseApproved':False}
    def save():
        (out/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
    save()
    for name,command,timeout in checks:
        log=out/(name+'.log');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
        with log.open('xb') as stream:
            try:
                proc=subprocess.Popen(command,cwd=root,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
                try: code=proc.wait(timeout)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid,signal.SIGKILL);proc.wait();code=124
            except OSError as exc:stream.write(str(exc).encode());code=127
        counts={}
        for key in ('tests','pass','fail','skipped','cancelled','todo'):
            matches=re.findall(r'^# '+key+r' (\d+)\s*$',log.read_text(errors='replace'),re.M)
            if matches:counts[key]=int(matches[-1])
        row={'name':name,'command':command,'exitCode':code,'counts':counts,'log':log.name,
             'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
        result['checks'].append(row);save();print(name,code,counts,flush=True)
    regression=next(x for x in result['checks'] if x['name']=='regressions')
    result['regressionCountsMatch']=regression['counts']=={'tests':expected,'pass':expected,'fail':0,'skipped':0,'cancelled':0,'todo':0}
    result['failedChecks']=[x['name'] for x in result['checks'] if x['exitCode']!=0]
    # This runner never grants GO or a deployment approval. Positive internal
    # checks do not establish hosted credentials, rights or engine generalization.
    result['verdict']='NO_GO';save()
    return int(bool(result['failedChecks']) or not result['regressionCountsMatch'])

if __name__=='__main__':raise SystemExit(main())
