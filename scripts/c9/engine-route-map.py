"""Static identifier/import map: findings are NOT runtime route coverage or proof no dynamic linkage exists."""
from pathlib import Path
import json,hashlib,os,datetime,sys
out=Path(sys.argv[1]);out.mkdir(exist_ok=True)
names=['executeFullAuditV2','buildCanonicalAuditReport','runPass35AuditA01A05Engine','analyzeSolidityStructuredSignals']
rows=[]
for root in ['app','lib','components']:
 for p in sorted(Path(root).rglob('*')):
  if p.suffix not in ('.ts','.tsx','.mjs','.js'):continue
  text=p.read_text(errors='replace')
  for name in names:
   lines=[i+1 for i,line in enumerate(text.splitlines()) if name in line]
   if lines:rows.append(dict(path=str(p),identifier=name,lines=lines,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(out/'ENGINE_ROUTE_MAP.json').write_text(json.dumps(dict(sourceSha=os.environ.get('GITHUB_SHA'),recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),scope='LEXICAL_REFERENCE_MAP_NOT_FULL_CALLGRAPH_OR_RUNTIME_E2E',fullV2DirectApplicationReferences=[r for r in rows if r['identifier']=='executeFullAuditV2' and r['path'].startswith(('app/','components/'))],references=rows,limits=['FullV2 benchmark is not customer PDF/JSON pipeline qualification','Dynamic call paths may be missed; inspect build/runtime before claiming non-reachability']),indent=2))
print(json.dumps(rows,indent=2))
