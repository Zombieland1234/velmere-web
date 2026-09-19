import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { computeMerkleRoot } from "../../lib/security/evidence-vault/merkle-tree";
import { verifyLocalPublishedAudit } from "../../lib/security/evidence-vault/public-verification";
import { GET } from "../../app/api/audit/verify/[id]/route";
const id = "AUD-Q18-SYNTHETIC";
const pdf = Buffer.from("%PDF-1.4\nsynthetic digest fixture, not a PDF format qualification\n");
const source = Buffer.from("synthetic source observation");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function manifest() { return {
  schemaVersion:"velmere.v3.reproducibility-manifest", auditId:id,
  publication:{visibility:"public",scope:"integrity-only"},
  engineVersion:"fixture-1", createdAt:"2026-09-19T00:00:00.000Z",
  target:{symbol:"SYN",name:"Synthetic",chain:"TEST",blockNumber:0},
  artifacts:[{category:"report",filename:"report.pdf",sha256:sha(pdf),sizeBytes:pdf.length},
    {category:"source",filename:"source.txt",sha256:sha(source),sizeBytes:source.length}],
  leafHashes:[sha(pdf),sha(source)],evidenceRoot:computeMerkleRoot([sha(pdf),sha(source)]),reportSha256:sha(pdf),
}; }
type Manifest = ReturnType<typeof manifest>;
async function fixture(fn: (root: string, value: Manifest, save: () => Promise<void>, work: string) => Promise<void>) {
  const work = await mkdtemp(path.join(os.tmpdir(),"velmere-q18-"));
  const root = path.join(work,"evidence");const dir=path.join(root,id);
  const value=manifest();const save=()=>writeFile(path.join(dir,"manifest/manifest.json"),JSON.stringify(value));
  try {
    for (const category of ["manifest","source","report"]) await mkdir(path.join(dir,category),{recursive:true});
    await writeFile(path.join(dir,"report/report.pdf"),pdf);await writeFile(path.join(dir,"source/source.txt"),source);await save();
    await fn(root,value,save,work);
  } finally { await rm(work,{recursive:true,force:true}); }
}
test("published manifest verifies actual bytes, not issuer, TSA, audit or release",()=>fixture(async(root)=>{
  const result=await verifyLocalPublishedAudit(id,root);assert.equal(result.ok,true);
  if (!result.ok) throw new Error("expected successful fixture");
  assert.equal(result.verified,true);assert.equal(result.artifactBytesMatch,true);assert.equal(result.reportDigestMatch,true);
  assert.equal(result.authenticity,"NOT_VERIFIED");assert.equal(result.timestampVerified,false);assert.equal(result.releaseApproved,false);
  assert.equal(result.target.blockNumber,0);assert.equal(result.artifactsCount,2);
}));
test("missing ID is never a fabricated success",()=>fixture(async(root)=>{
  const result=await verifyLocalPublishedAudit("AUD-Q18-NOT-FOUND",root);assert.equal(result.ok,false);
  if(result.ok)throw new Error("unexpected success");assert.equal(result.httpStatus,404);assert.equal(result.verified,false);
}));
for (const bad of ["", "../private", "a/b", "a\\b", "%2e%2e", "a%252fb", "a".repeat(129), ".hidden"]) {
  test(`invalid bounded audit id ${JSON.stringify(bad)}`,async()=>{
    const result=await verifyLocalPublishedAudit(bad,"/nonexistent-fixture");assert.equal(result.ok,false);
    if(result.ok)throw new Error("unexpected success");assert.equal(result.httpStatus,400);
  });
}
for (const [name,change,code] of [
  ["unpublished manifest",(m:Manifest)=>{m.publication.visibility="private";},404],
  ["wrong publication scope",(m:Manifest)=>{m.publication.scope="all-private-artifacts";},404],
  ["foreign audit ID",(m:Manifest)=>{m.auditId="AUD-OTHER";},422],
  ["wrong schema",(m:Manifest)=>{m.schemaVersion="unknown";},422],
  ["invalid date",(m:Manifest)=>{m.createdAt="NOT-A-DATE";},422],
  ["empty engine version",(m:Manifest)=>{m.engineVersion="";},422],
  ["empty artifacts",(m:Manifest)=>{m.artifacts=[];m.leafHashes=[];},422],
  ["artifact and leaf cardinality differ",(m:Manifest)=>{m.leafHashes=[];},422],
  ["foreign leaf not in artifacts",(m:Manifest)=>{m.leafHashes[0]="a".repeat(64);},409],
  ["root mismatch",(m:Manifest)=>{m.evidenceRoot="b".repeat(64);},409],
  ["report digest mismatch",(m:Manifest)=>{m.reportSha256="c".repeat(64);},409],
  ["zero report digest",(m:Manifest)=>{m.reportSha256="0".repeat(64);},422],
  ["unsafe category",(m:Manifest)=>{m.artifacts[0].category="../report";},422],
  ["unsafe filename",(m:Manifest)=>{m.artifacts[0].filename="../report.pdf";},422],
  ["manifest cannot include itself",(m:Manifest)=>{m.artifacts[0].category="manifest";},422],
  ["duplicate artifact identity",(m:Manifest)=>{m.artifacts[1]={...m.artifacts[0]};},422],
  ["negative file size",(m:Manifest)=>{m.artifacts[0].sizeBytes=-1;},422],
  ["fractional file size",(m:Manifest)=>{m.artifacts[0].sizeBytes=1.5;},422],
  ["per artifact bound",(m:Manifest)=>{m.artifacts[0].sizeBytes=8*1024*1024+1;},422],
  ["noncanonical hash",(m:Manifest)=>{m.artifacts[0].sha256=m.artifacts[0].sha256.toUpperCase();},422],
  ["not actually a PDF-named report",(m:Manifest)=>{m.artifacts[0].filename="report.txt";},409],
  ["negative target block",(m:Manifest)=>{m.target.blockNumber=-1;},422],
  ["too long public name",(m:Manifest)=>{m.target.name="a".repeat(201);},422],
] as const) test(name,()=>fixture(async(root,m,save)=>{
  change(m);await save();const result=await verifyLocalPublishedAudit(id,root);assert.equal(result.ok,false);
  if(result.ok)throw new Error("unexpected success");assert.equal(result.httpStatus,code);
}));
test("matching root cannot conceal modified source bytes",()=>fixture(async(root)=>{
  await writeFile(path.join(root,id,"source/source.txt"),Buffer.alloc(source.length,88));
  const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);if(!r.ok)assert.equal(r.httpStatus,409);
}));
test("file growth is refused despite original hash and root",()=>fixture(async(root)=>{
  await writeFile(path.join(root,id,"report/report.pdf"),Buffer.concat([pdf,Buffer.from("extra")]));
  const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);
}));
test("missing declared file is a mismatch, not a partial pass",()=>fixture(async(root)=>{
  await rm(path.join(root,id,"report/report.pdf"));const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);
}));
test("symlinked artifact is refused",()=>fixture(async(root,_m,_s,work)=>{
  const p=path.join(root,id,"report/report.pdf");await rm(p);await writeFile(path.join(work,"external.pdf"),pdf);
  await symlink(path.join(work,"external.pdf"),p);const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);
}));
test("symlinked manifest directory is refused",()=>fixture(async(root,_m,_s,work)=>{
  const p=path.join(root,id,"manifest");const data=await readFile(path.join(p,"manifest.json"));await rm(p,{recursive:true});
  await mkdir(path.join(work,"elsewhere"));await writeFile(path.join(work,"elsewhere/manifest.json"),data);
  await symlink(path.join(work,"elsewhere"),p);const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);
}));
test("oversized manifest is bounded before JSON parse",()=>fixture(async(root)=>{
  await writeFile(path.join(root,id,"manifest/manifest.json"),Buffer.alloc(512*1024+1,32));const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,false);
}));
test("untrusted timestamps and extra metadata never become public proof",()=>fixture(async(root,m,save)=>{
  Object.assign(m,{timestamping:{notice:"PRIVATE_SECRET",tsaTokenPresent:true},operatorEmail:"PRIVATE_SECRET"});
  Object.assign(m.target,{repositoryUrl:"https://internal.invalid/PRIVATE_SECRET"});await save();
  const r=await verifyLocalPublishedAudit(id,root);assert.equal(r.ok,true);assert.equal(JSON.stringify(r).includes("PRIVATE_SECRET"),false);
}));
test("actual GET shares the same truthful published result and disables caching",()=>fixture(async(root,_m,_s,work)=>{
  const old=process.cwd();try { process.chdir(work);
    const response=await GET(new NextRequest("http://localhost/api/audit/verify/"+id),{params:Promise.resolve({id})});
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    assert.deepEqual(await response.json(),await verifyLocalPublishedAudit(id,root));
  }finally{process.chdir(old);}
}));
test("actual GET unknown id returns 404 with verified false",()=>fixture(async(_root,_m,_s,work)=>{
  const old=process.cwd();try {process.chdir(work);
    const response=await GET(new NextRequest("http://localhost/api/audit/verify/AUD-NONE"),{params:Promise.resolve({id:"AUD-NONE"})});
    assert.equal(response.status,404);const body=await response.json();assert.equal(body.verified,false);assert.equal(body.error,"not_found");
  }finally{process.chdir(old);}
}));
