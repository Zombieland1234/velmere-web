import fs from 'node:fs';
import path from 'node:path';
const root='lib/security/v2';
const files=fs.readdirSync(root).filter(x=>/\.(?:ts|mjs)$/.test(x)).map(x=>path.join(root,x));
const checks=[
  ['preclaimed_patch_success',/appliedSuccessfully\s*:\s*true|regressionPassed\s*:\s*true/],
  ['fake_sha256_buffer_hex',/sha256:\$\{Buffer\.from\([^\n]+\.toString\(["']hex["']\)/],
  ['invented_default_block',/\?\?\s*19000000/],
  ['invented_pdf_timing',/pdfMs\s*:\s*15\b/],
  ['old_exact_transfer_detector',/includes\(["']function transfer\(["']\)/],
  ['old_exact_returns_bool_detector',/includes\(["']returns \(bool\)["']\)/],
  ['derived_dataflow_timing',/Math\.round\(cfgMs\s*\*\s*0\.3\)/],
];
const failures=[];
const findingIds=new Map();
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const [id,re] of checks){if(re.test(text))failures.push({id,file});}
  for(const match of text.matchAll(/findingId\s*:\s*["']([^"']+)["']/g)){
    const id=match[1];
    const previous=findingIds.get(id);
    if(previous) failures.push({id:'duplicate_finding_id',findingId:id,file,previousFile:previous});
    else findingIds.set(id,file);
  }
}
if(failures.length){console.error(JSON.stringify({status:'FAIL',failures},null,2));process.exit(1);}
console.log(JSON.stringify({status:'PASS',filesScanned:files.length,checks:[...checks.map(x=>x[0]),'unique_finding_ids'],findingIdCount:findingIds.size},null,2));
