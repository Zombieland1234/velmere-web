"""Collect real source/build browser observations and exact exports, without release promotion."""
from pathlib import Path
import os, subprocess, json, hashlib, datetime, zipfile, signal
out=Path('/tmp/c13-evidence');out.mkdir(exist_ok=True);sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();assert sha==os.environ['GITHUB_SHA']
rows=[]
def run(name,args,timeout=240):
    log=out/(name+'.log');started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with log.open('wb') as f:
        p=subprocess.Popen(args,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
        try:code=p.wait(timeout)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
    rows.append(dict(id=name,sourceSha=sha,command=args,startedAt=started,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),exitCode=code,log=log.name,logSha256=hashlib.sha256(log.read_bytes()).hexdigest()))
    (out/'ADDITIONAL_CHECKS.json').write_text(json.dumps(rows,indent=2));return code
run('product-manifest',['node_modules/.bin/tsx','-e',"import{VLM_CANONICAL_CUSTOMER_PRODUCTS as products}from'./lib/product/vlm-canonical-product-topology';import fs from'node:fs';import{createHash}from'node:crypto';const p='lib/product/vlm-canonical-product-topology.ts';fs.writeFileSync('/tmp/c13-evidence/PRODUCT_MANIFEST.json',JSON.stringify({sourceSha:process.env.GITHUB_SHA,at:new Date().toISOString(),path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex'),catalogCount:products.length,activeOrSellableCount:'NOT_ASSUMED',products},null,2));"])
setup='''set -euo pipefail
mkdir -p /tmp/c13-scan /tmp/c13-tools
git archive HEAD | tar -x -C /tmp/c13-scan
curl --fail --silent --show-error --location --max-time 60 https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt -o /tmp/c13-tools/checksums.txt
curl --fail --silent --show-error --location --max-time 90 https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz -o /tmp/c13-tools/gitleaks_8.30.1_linux_x64.tar.gz
cd /tmp/c13-tools
grep ' gitleaks_8.30.1_linux_x64.tar.gz$' checksums.txt | sha256sum -c -
tar -xzf gitleaks_8.30.1_linux_x64.tar.gz gitleaks
'''
if run('scanner-setup',['bash','-c',setup])==0:run('gitleaks-source',['/tmp/c13-tools/gitleaks','dir','/tmp/c13-scan','--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow','--max-archive-depth','2','--max-decode-depth','2','--report-format','json','--report-path',str(out/'GITLEAKS_REDACTED.json')])
run('dependency-outdated',['npm','outdated','--json']);run('sbom',['npm','sbom','--sbom-format','cyclonedx'])
checks=json.loads((out/'QUALIFICATION.json').read_text())
if any(r['id']=='production-build' and r['result']=='PASS' for r in checks):
    run('built-worker-file-traces',['node','scripts/c11/verify-worker-traces.mjs',str(out)],60)
    browser='''set -euo pipefail
node_modules/.bin/playwright install --with-deps chromium > /tmp/c13-evidence/browser-install.log 2>&1
node_modules/.bin/next start --hostname localhost > /tmp/c13-evidence/next-runtime.log 2>&1 &
server=$!; trap 'kill "$server" || true' EXIT
for i in $(seq 1 30); do if curl -s -o /dev/null http://localhost:3000/en; then break; fi; sleep 1; done
timeout 300 node scripts/c6/browser-observations.mjs http://localhost:3000 /tmp/c13-evidence/browser > /tmp/c13-evidence/browser.log 2>&1
timeout 90 node scripts/c6c/provider-outage-browser.mjs /tmp/c13-evidence/failures > /tmp/c13-evidence/controlled-failures.log 2>&1
timeout 90 node scripts/c6d/reference-pdf-browser.mjs /tmp/c13-evidence/pdf > /tmp/c13-evidence/pdf-browser.log 2>&1
timeout 180 node scripts/c10/report-browser.mjs /tmp/c13-evidence/customer-browser > /tmp/c13-evidence/customer-browser.log 2>&1
'''
    run('actual-built-browser-observations',['bash','-c',browser],700)
# Full production-mode pipeline through authenticated ingress and real ephemeral Redis.
if any(r['id']=='production-build' and r['result']=='PASS' for r in checks):
    run('production-mode-runtime-e2e',['node','scripts/c12/production-e2e.mjs',str(out/'production-e2e')],300)
# Preserve the reproducible engine bundle manifest (not host credentials).
if Path('.generated/audit-engine-worker-manifest.json').exists():
    (out/'WORKER_BUILD_MANIFEST.json').write_bytes(Path('.generated/audit-engine-worker-manifest.json').read_bytes())
# Source ZIP is always the actual commit, even if a tool changed generated working files.
src=Path('/tmp/c13-source');src.mkdir(exist_ok=True);files=[];excluded=[]
omit={'lib/security/pro-audit-pdf/embedded-font-data.ts','r7-runtime/external-assets/manrope-pdf-latin-plus-ext.ttf'}
with zipfile.ZipFile(src/'VELMERE_SOURCE_C13.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in subprocess.check_output(['git','ls-files','-z'],text=True).split('\0'):
        if not name:continue
        raw=subprocess.check_output(['git','show','HEAD:'+name]);item=dict(path=name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        if name in omit or Path(name).suffix.lower() in ('.ttf','.otf','.woff','.woff2','.eot','.pfb','.pfa'):
            excluded.append({**item,'reason':'FONT_RESOURCE_NOT_REDISTRIBUTED'});continue
        files.append(item);z.writestr(name,raw)
identity=dict(sourceSha=sha,treeSha=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),repository='Zombieland1234/velmere-web',branch=os.environ.get('GITHUB_REF_NAME'),runId=os.environ.get('GITHUB_RUN_ID'),originalUI2ZipIdentityConfirmed=False,trackedFilesIncluded=len(files),excludedTrackedFiles=excluded,files=files,zipSha256=hashlib.sha256((src/'VELMERE_SOURCE_C13.zip').read_bytes()).hexdigest())
(src/'SOURCE_IDENTITY.json').write_text(json.dumps(identity,indent=2));(out/'SOURCE_IDENTITY_EXPORT.json').write_text(json.dumps({k:v for k,v in identity.items() if k!='files'},indent=2))
subprocess.run(['git','status','--porcelain'],stdout=(out/'final-working-tree-status.txt').open('w'),check=True)
subprocess.run(['git','diff','9a176fe2e844ccf7166bf1bd7552f1bec79584cb','HEAD','--','components','public','app/**/*.css'],stdout=(out/'ui-source-diff.txt').open('w'),check=True)
blockers=[r['id'] for r in checks if r['result']!='PASS']
# Collection failures and non-green security scans must remain visible release gates.
# npm outdated exit 1 only inventories newer versions; it is not an execution error.
blockers.extend(r['id'] for r in rows if r['exitCode']!=0 and r['id']!='dependency-outdated')
if json.loads((out/'SOURCE_INVENTORY.json').read_text()).get('scriptsWithMissingReferencedFiles'):blockers.append('missing-historical-scripts')
(out/'RELEASE_GATE.json').write_text(json.dumps(dict(status='NO_GO',sourceSha=sha,technicalBlockers=blockers,benchmarkMustBeReviewedSeparately=True,r16FixedPercent=None,openGates=['R16_original_ledger','real_Stripe_TEST_lifecycle','real_Auth_A_B','all_product_hosted_E2E','global_provider_enforcement','independent_review']),indent=2))
items=[dict(path=str(p.relative_to(out)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(out.rglob('*')) if p.is_file() and p.name!='EVIDENCE_MANIFEST.json']
(out/'EVIDENCE_MANIFEST.json').write_text(json.dumps(dict(sourceSha=sha,recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),files=items),indent=2))
