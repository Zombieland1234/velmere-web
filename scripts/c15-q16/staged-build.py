#!/usr/bin/env python3
"""Version-bound staged Next build for constrained memory; never a release approval.

Records each phase separately. An earlier monolithic build failure is not erased.
No networking, deployment, paid services or production database access.
"""
from __future__ import annotations
import argparse,datetime,hashlib,json,os,re,signal,subprocess,time
from pathlib import Path

def sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()
def now()->str:return datetime.datetime.now(datetime.timezone.utc).isoformat()
def snapshot(root:Path)->dict[str,str]:
    paths=[]
    for directory in ('app','components','lib','config','types','scripts','public'):
        paths.extend(p for p in (root/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    paths.extend(p for p in root.iterdir() if p.is_file() and p.suffix in ('.json','.mjs','.ts','.tsx') and p.name!='next-env.d.ts')
    return {str(p.relative_to(root)):sha(p) for p in sorted(set(paths))}

def main()->int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--candidate',default='C15-Q16-local')
    args=parser.parse_args()
    if not re.fullmatch(r'C15-Q[1-9][0-9]*-local',args.candidate):parser.error('Expected an explicit local candidate label.')
    root=Path(__file__).resolve().parents[2]
    if json.loads((root/'node_modules/next/package.json').read_text())['version']!='16.3.5':
        raise SystemExit('Unsupported Next version; requalification required.')
    if not (root/'lib/security/pro-audit-pdf/embedded-font-data.ts').is_file():
        raise SystemExit('Exact original PDF resource is required; no fallback stub is supported.')
    out=args.out.resolve();out.mkdir(parents=True,exist_ok=False)
    frozen=snapshot(root);(out/'INPUT_SNAPSHOT.json').write_text(json.dumps(frozen,indent=2)+'\n')
    env=dict(os.environ,CI='1',NEXT_TELEMETRY_DISABLED='1',VELMERE_CANONICAL_ORIGIN='http://localhost:3000',
             VELMERE_LOOPBACK_HTTP_BROWSER_PROOF='true',NODE_OPTIONS='--max-old-space-size=2560',RAYON_NUM_THREADS='1')
    for key in ('GITHUB_SHA','C6_SOURCE_SHA','GIT_DIR','GIT_WORK_TREE','PGHOST','PGDATABASE','PGUSER',
                'Q12_DISPOSABLE_ACK','VELMERE_RUNTIME_BUILD_SCOPE','VELMERE_RUNTIME_DIST_DIR','VELMERE_RUNTIME_BUILD_ID'):
        env.pop(key,None)
    steps=[('worker',['node','scripts/c11/build-audit-worker.mjs']),
           ('compile',['node','node_modules/next/dist/bin/next','build','--experimental-build-mode','compile']),
           ('next-typecheck',['node','scripts/c15-q16/isolated-next-typecheck.mjs']),
           ('generate',['node','node_modules/next/dist/bin/next','build','--experimental-build-mode','generate'])]
    result={'candidate':args.candidate,'scope':'STAGED_TURBOPACK_EXACT_NEXT_CHECKER_GENERATION_NOT_MONOLITHIC_BUILD',
            'nextVersion':'16.3.5','sourceCommit':None,'baseSha':'5690d7d6ffe75236b03833f47f00cc018f43a083',
            'startedAt':now(),'releaseApproved':False,'monolithicBuildQualified':False,'checks':[],
            'inputSnapshotSha256':sha(out/'INPUT_SNAPSHOT.json')}
    def save():(out/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
    save()
    for name,command in steps:
        if snapshot(root)!=frozen:raise SystemExit('Source drift between stages; qualification refused.')
        log=out/(name+'.log');start=now();samples=[];event_path=Path('/sys/fs/cgroup/memory.events')
        before=event_path.read_text() if event_path.exists() else None
        with log.open('xb') as stream:
            proc=subprocess.Popen(command,cwd=root,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
            started=time.monotonic()
            while proc.poll() is None:
                memory=Path('/sys/fs/cgroup/memory.current')
                if memory.exists():samples.append(int(memory.read_text()))
                if time.monotonic()-started>900:
                    os.killpg(proc.pid,signal.SIGKILL);proc.wait();break
                time.sleep(1)
            code=proc.wait()
            if code:
                try:os.killpg(proc.pid,signal.SIGTERM)
                except ProcessLookupError:pass
        row={'name':name,'command':command,'exitCode':code,'startedAt':start,'finishedAt':now(),
             'log':log.name,'logSha256':sha(log),'peakObservedCgroupBytes':max(samples) if samples else None,
             'cgroupBefore':before,'cgroupAfter':event_path.read_text() if event_path.exists() else None}
        result['checks'].append(row);save();print(name,code,flush=True)
        if code:
            result.update(status='FAIL',finishedAt=now());save();return 1
    result.update(status='PASS' if snapshot(root)==frozen else 'SOURCE_DRIFT',finishedAt=now(),
                  generatedBuildId=(root/'.next/BUILD_ID').read_text().strip(),sourceUnchanged=snapshot(root)==frozen)
    save();return int(result['status']!='PASS')
if __name__=='__main__':raise SystemExit(main())
