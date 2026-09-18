#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, sys

p=argparse.ArgumentParser()
p.add_argument('mode',choices=['write','verify'])
p.add_argument('--root',required=True)
p.add_argument('--manifest',required=True)
p.add_argument('paths',nargs='*')
a=p.parse_args()
root=pathlib.Path(a.root).resolve(); mf=pathlib.Path(a.manifest).resolve()

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

if a.mode=='write':
    rows=[]
    for rel in sorted(a.paths):
        path=(root/rel).resolve()
        if root not in path.parents and path != root: raise SystemExit(f'path_escape:{rel}')
        if not path.is_file(): raise SystemExit(f'missing:{rel}')
        rows.append({'path':rel,'bytes':path.stat().st_size,'sha256':digest(path)})
    payload={'schemaVersion':'velmere.c14-p16.backup-manifest.v1','files':rows}
    mf.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
else:
    payload=json.loads(mf.read_text())
    if payload.get('schemaVersion')!='velmere.c14-p16.backup-manifest.v1': raise SystemExit('manifest_schema_invalid')
    for row in payload.get('files',[]):
        path=(root/row['path']).resolve()
        if root not in path.parents and path != root: raise SystemExit(f'path_escape:{row["path"]}')
        if not path.is_file(): raise SystemExit(f'missing:{row["path"]}')
        if path.stat().st_size!=row['bytes'] or digest(path)!=row['sha256']:
            raise SystemExit(f'integrity_mismatch:{row["path"]}')
print('PASS')
