"""Preserve raw redacted scanner results and exact source triage separately."""
from pathlib import Path
import subprocess,json,hashlib,os,sys
out=Path('/tmp/c14-secrets');out.mkdir(exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();assert sha==os.environ['GITHUB_SHA']
setup='''set -euo pipefail
mkdir -p /tmp/c14-scan /tmp/c14-scan-tools
git archive HEAD | tar -x -C /tmp/c14-scan
cd /tmp/c14-scan-tools
curl --fail --silent --show-error --location --max-time 60 https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt -o checksums.txt
curl --fail --silent --show-error --location --max-time 90 https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz -o gitleaks_8.30.1_linux_x64.tar.gz
grep ' gitleaks_8.30.1_linux_x64.tar.gz$' checksums.txt | sha256sum -c -
tar -xzf gitleaks_8.30.1_linux_x64.tar.gz gitleaks
'''
rows=[]
def run(name,args,timeout=180):
 log=out/(name+'.log');assert not log.exists()
 with log.open('w') as f:
  try:code=subprocess.run(args,stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
  except subprocess.TimeoutExpired:code=124
 rows.append({'id':name,'sourceSha':sha,'command':args,'exitCode':code,'log':log.name,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()})
 (out/'CHECKS.json').write_text(json.dumps(rows,indent=2));return code
if run('setup',['bash','-c',setup])!=0:raise SystemExit(1)
policy=json.loads(Path('scripts/c14/secret-triage-policy.json').read_text())
updates=json.loads(Path('scripts/c14-integration/secret-triage-updates.json').read_text())
for entry in updates:
 indices=[i for i,old in enumerate(policy['entries']) if old['path']==entry['path'] and old['ruleId']==entry['ruleId'] and old['startColumn']==entry['startColumn']]
 assert len(indices)==1,'An exact reviewed update must match exactly one prior entry'
 policy['entries'][indices[0]]=entry
(out/'EXACT_POLICY.json').write_text(json.dumps(policy,indent=2))
exe='/tmp/c14-scan-tools/gitleaks'
code=run('source',[exe,'dir','/tmp/c14-scan','--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow','--max-archive-depth','2','--max-decode-depth','2','--report-format','json','--report-path',str(out/'SOURCE_REDACTED.json')])
triage=run('exact-source-triage',['python3','scripts/c14/secret_triage.py','/tmp/c14-scan',str(out/'EXACT_POLICY.json'),str(out/'SOURCE_REDACTED.json'),'--scanner-exit',str(code),'--scanner-version','8.30.1'])
history=run('git-history',[exe,'git','.','--log-opts=--all','--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow','--report-format','json','--report-path',str(out/'HISTORY_REDACTED.json')],180)
(out/'GATE.json').write_text(json.dumps({'sourceSha':sha,'sourceScannerExit':code,'sourceTriageExit':triage,'historyScannerExit':history,'historyIndividuallyReviewed':False,'environmentReviewed':False,'status':'NO_GO','rawFindingsAreNotAutomaticallyLiveCredentials':True},indent=2))
# Raw gates are deliberately not waived by a positive internal source classification.
sys.exit(0 if code==0 and triage==0 and history==0 else 1)
