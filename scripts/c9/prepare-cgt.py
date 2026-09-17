"""Freeze byte-distinct external inputs before observing engine results; no third-party code execution."""
from pathlib import Path
import csv, json, hashlib, re, sys, datetime, subprocess
root, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
PIN='f8cd72cf7fbbfebc809c454667eee271706a4b2b'
assert subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()==PIN
csv_path=root/'consolidated.csv'; raw=csv_path.read_bytes(); assert len(raw)>1000
expected=['dataset','id','property','property_holds','chain','addr','contractname','fp_sol','fp_sol2','fp_bytecode','fp_runtime','swc','dasp']
with csv_path.open(encoding='utf-8-sig',newline='') as f:
    reader=csv.reader(f,delimiter=';'); first=next(reader)
    if first==expected: rows=[dict(zip(expected,row)) for row in reader if row]
    else:
        assert len(first)==len(expected), ('unsupported_csv_shape',first)
        rows=[dict(zip(expected,row)) for row in [first,*reader] if row]
assert rows and all(row['property_holds'] in ('t','f') for row in rows)
groups={}; excluded=[]; invalid=0
for r in rows:
    fp=r['fp_runtime']
    if not re.fullmatch(r'[a-f0-9]{32,64}',fp or ''): continue
    groups.setdefault(fp,[]).append(r)
unique={}
for fp,assessments in sorted(groups.items()):
    path=root/'runtime'/f'{fp}.rt.hex'
    if not path.is_file(): excluded.append({'fp':fp,'reason':'RUNTIME_MISSING'}); continue
    text=''.join(path.read_text().split()); text=text[2:] if text[:2].lower()=='0x' else text
    if not text or len(text)%2 or not re.fullmatch('[0-9a-fA-F]+',text): excluded.append({'fp':fp,'reason':'INVALID_RUNTIME_HEX'}); continue
    if len(text)>2_000_000: excluded.append({'fp':fp,'reason':'RUNTIME_INPUT_LIMIT'}); continue
    digest=hashlib.sha256(bytes.fromhex(text)).hexdigest()
    if digest not in unique: unique[digest]={'runtimeSha256':digest,'runtimeFile':str(path),'runtimeBytes':len(text)//2,'runtimeAliases':[], 'assessments':[]}
    unique[digest]['runtimeAliases'].append(fp); unique[digest]['assessments'].extend(assessments)
selected=[unique[h] for h in sorted(unique)]
assert len(selected)>=1000, f'Only {len(selected)} distinct eligible runtime bytes'
private=[];public=[]
for item in selected:
    mapped={}; contracts=sorted(set(a['contractname'] for a in item['assessments'] if a['contractname']))
    for row in item['assessments']:
        if not re.fullmatch(r'\d+',row['swc'] or ''):continue
        mapped.setdefault(row['swc'],set()).add(row['property_holds'])
    labels=[{'swc':k,'expected':None if len(v)>1 else next(iter(v))=='t','ambiguous':len(v)>1} for k,v in sorted(mapped.items(),key=lambda kv:int(kv[0]))]
    sfp=None;source_path=None;source_hash=None
    for possible in sorted({a['fp_sol'] for a in item['assessments'] if re.fullmatch(r'[a-f0-9]{32,64}',a['fp_sol'] or '')}):
        p=root/'source'/f'{possible}.sol'
        if p.is_file() and p.stat().st_size<=500_000:
            sfp=possible;source_path=p;source_hash=hashlib.sha256(p.read_bytes()).hexdigest();break
    entry={**item,'id':'CGT-'+item['runtimeSha256'][:24],'sourceFp':sfp,'sourceFile':str(source_path) if source_path else None,'sourceSha256':source_hash,'sourceBinding':'CGT_ASSOCIATION_NOT_RECOMPILED_OR_VERIFIED','contractName':contracts[0] if len(contracts)==1 else 'CGT_MultiOrUnknown','consensusLabels':labels}
    private.append(entry)
    public.append({k:v for k,v in entry.items() if k not in ('runtimeFile','sourceFile')})
manifest={'schema':'velmere.c9.external-runtime-corpus.v1','recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'datasetRepository':'gsalzer/cgt','datasetSha':PIN,'csvSha256':hashlib.sha256(raw).hexdigest(),'selectionRule':'ALL eligible unique decoded-runtime SHA256 in ascending order; first 1200 were examined in C9 round1, remaining inputs are the not-previously-observed holdout' ,'sourceSelectionRule':'First existing mapped source fingerprint in ascending order, <=500000 bytes; no compiler identity proof','csvRows':len(rows),'eligibleUniqueRuntimeHashes':len(unique),'selectedUniqueRuntimeHashes':len(public),'selectionDigestSha256':hashlib.sha256(('\n'.join(e['runtimeSha256'] for e in public)+'\n').encode()).hexdigest(),'developmentCases':min(1200,len(public)),'holdoutCases':max(0,len(public)-1200),'countingRule':'one contract runtime per SHA256, not assessment rows, reruns, names or mutations','excluded':excluded,'cases':public,'limitations':['Not the unavailable original R16 ledger','Not 1200 vulnerability classes or independently audited results','Weakness labels apply only to the specified SWC/property; absent labels do not mean safe','Conflicting consolidated labels excluded from confusion matrices','Historical external corpus; no live target or transaction is executed','Third-party source files are not redistributed; licensing remains with original sources']}
(out/'MANIFEST.json').write_text(json.dumps(manifest,indent=2))
(out/'private-inputs.json').write_text(json.dumps(private))
(out/'MANIFEST_SHA256.txt').write_text(hashlib.sha256((out/'MANIFEST.json').read_bytes()).hexdigest()+'  MANIFEST.json\n')
print(json.dumps({k:v for k,v in manifest.items() if k not in ('cases','excluded')},indent=2))
