"""Export exact committed bytes, excluding font resources. No worktree promotion."""
from pathlib import Path
import subprocess,json,zipfile,hashlib,os
out=Path('/tmp/c14-source');out.mkdir(exist_ok=True)
def git(*args):return subprocess.check_output(['git',*args])
sha=git('rev-parse','HEAD').decode().strip();assert sha==os.environ['GITHUB_SHA']
files=[];omitted=[];fonts={'.woff','.woff2','.ttf','.otf','.eot','.ttc','.pfb','.pfa'}
with zipfile.ZipFile(out/'SOURCE.zip','w',zipfile.ZIP_DEFLATED) as z:
 for rec in git('ls-tree','-rz',sha).split(b'\0'):
  if not rec:continue
  meta,name=rec.split(b'\t',1);mode,kind,blob=meta.decode().split();name=name.decode()
  if kind!='blob':continue
  raw=git('cat-file','blob',blob);row={'path':name,'mode':mode,'blobSha':blob,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
  if Path(name).suffix.lower() in fonts or name=='lib/security/pro-audit-pdf/embedded-font-data.ts':
   omitted.append({**row,'reason':'FONT_RESOURCE_NOT_DISTRIBUTED'});continue
  files.append(row);z.writestr(name,raw)
(out/'SOURCE_MANIFEST.json').write_text(json.dumps({'sourceSha':sha,'treeSha':git('rev-parse','HEAD^{tree}').decode().strip(),'runId':os.environ.get('GITHUB_RUN_ID'),'branch':os.environ.get('GITHUB_REF_NAME'),'files':files,'omitted':omitted,'sourceArchiveSha256':hashlib.sha256((out/'SOURCE.zip').read_bytes()).hexdigest()},indent=2))
print(json.dumps({'sourceSha':sha,'files':len(files),'omitted':len(omitted)}))
