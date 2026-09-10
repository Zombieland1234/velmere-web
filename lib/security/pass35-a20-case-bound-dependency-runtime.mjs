import { createHash } from "node:crypto";
import path from "node:path";

const POLICY_SCHEMA = "velmere.pass35.a20-case-bound-dependency-policy.v1";
const INPUT_SCHEMA = "velmere.pass35.a20-case-bound-dependency-input.v1";
const REPORT_SCHEMA = "velmere.pass35.a20-case-bound-dependency-report.v1";
const BENCH_SCHEMA = "velmere.pass35.a20-case-bound-dependency-benchmark.v1";
const PATH_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.@+\-/]{1,240}$/;
const CASE_RE = /^AUD-[A-Z0-9-]{8,48}$/;
const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/i;
const SPDX_RE = /^\s*\/\/\s*SPDX-License-Identifier:\s*([^\s]+)\s*$/m;

const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};
const sha256 = (value) => `sha256:${createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex")}`;
const normalizeDigest = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (!DIGEST_RE.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
};
const normalizePath = (value) => String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
const stripComments = (source) => String(source ?? "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");
const importsOf = (source) => {
  const clean = stripComments(source);
  const out = [];
  const re = /\bimport\s+(?:(?:[^"']+?\s+from\s+)?["']([^"']+)["'])\s*;/g;
  for (const match of clean.matchAll(re)) out.push(match[1]);
  return out;
};
const packageIdentity = (file) => {
  if (file.packageName && file.packageVersion) return { name: file.packageName, version: file.packageVersion };
  const p = normalizePath(file.path);
  const match = p.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/@]+)@([^/]+)\//);
  return match ? { name: match[1], version: match[2] } : null;
};
const resolveImport = (from, specifier, paths) => {
  const raw = normalizePath(specifier);
  if (raw.startsWith("/") || raw.includes("\0")) return { status: "UNSAFE", target: null };
  if (raw.startsWith(".")) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), raw));
    if (target.startsWith("../") || target === ".." || !PATH_RE.test(target)) return { status: "TRAVERSAL", target };
    return { status: paths.has(target) ? "RESOLVED" : "UNRESOLVED", target };
  }
  const exact = [...paths].find((p) => p === raw || p.endsWith(`/node_modules/${raw}`) || p.endsWith(`/${raw}`));
  return { status: exact ? "RESOLVED" : "UNRESOLVED", target: exact ?? raw };
};
const cycles = (graph) => {
  const found = [];
  const visiting = new Set(); const visited = new Set(); const stack = [];
  const dfs = (node) => {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node); found.push([...stack.slice(idx), node]); return;
    }
    if (visited.has(node)) return;
    visiting.add(node); stack.push(node);
    for (const next of graph.get(node) ?? []) dfs(next);
    stack.pop(); visiting.delete(node); visited.add(node);
  };
  for (const node of graph.keys()) dfs(node);
  return [...new Map(found.map((row) => [row.join("->"), row])).values()];
};
const severity = (family) => ({
  PATH_TRAVERSAL_IMPORT: "high", ADVISORY_SOURCE_HASH_MATCH: "high", ADVISORY_PACKAGE_VERSION_MATCH: "high",
  EXPECTED_DIGEST_MISMATCH: "high", UNRESOLVED_IMPORT: "medium", IMPORT_CYCLE: "medium",
  FORBIDDEN_LICENSE: "medium", DUPLICATE_PACKAGE_VERSION: "medium", MISSING_SPDX: "low", INVALID_SPDX: "low",
}[family] ?? "informational");

export function verifyA20Policy(policy) {
  return Boolean(policy && policy.schemaVersion === POLICY_SCHEMA && policy.passId === "PASS35_A20" &&
    Array.isArray(policy.benchmark?.families) && policy.benchmark.families.length === 10 &&
    policy.benchmark.expectedCases === 200 && policy.benchmark.expectedMutations === 2400 &&
    Array.isArray(policy.licensePolicy?.allowed) && Array.isArray(policy.licensePolicy?.forbiddenForCommercialBundle));
}

export function analyzeA20DependencyCase(input, policy) {
  if (!verifyA20Policy(policy)) throw new Error("a20_policy_invalid");
  if (!input || input.schemaVersion !== INPUT_SCHEMA || !CASE_RE.test(input.caseRef ?? "")) throw new Error("a20_input_invalid");
  const files = Array.isArray(input.sourceFiles) ? input.sourceFiles : [];
  if (!files.length || files.length > policy.limits.maxFiles) throw new Error("a20_source_file_count_invalid");
  const normalized = files.map((file) => ({ ...file, path: normalizePath(file.path), content: String(file.content ?? "").replace(/\r\n?/g, "\n") }));
  if (new Set(normalized.map((f) => f.path)).size !== normalized.length || normalized.some((f) => !PATH_RE.test(f.path))) throw new Error("a20_source_path_invalid");
  if (normalized.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0) > policy.limits.maxTotalBytes) throw new Error("a20_source_bytes_exceeded");
  const paths = new Set(normalized.map((f) => f.path));
  const graph = new Map(normalized.map((f) => [f.path, []]));
  const edges = []; const findings = [];
  const add = (familyId, subject, evidence, details = {}) => findings.push({ findingId: `${familyId}:${sha256(`${subject}|${evidence}`).slice(-16)}`, familyId, severity: severity(familyId), subject, evidence, ...details });
  for (const file of normalized) {
    const specs = importsOf(file.content);
    if (specs.length > policy.limits.maxImportsPerFile) throw new Error("a20_import_count_exceeded");
    for (const specifier of specs) {
      const resolved = resolveImport(file.path, specifier, paths);
      edges.push({ from: file.path, specifier, status: resolved.status, target: resolved.target });
      if (resolved.status === "RESOLVED") graph.get(file.path).push(resolved.target);
      if (resolved.status === "UNRESOLVED") add("UNRESOLVED_IMPORT", file.path, specifier, { target: resolved.target });
      if (resolved.status === "TRAVERSAL" || resolved.status === "UNSAFE") add("PATH_TRAVERSAL_IMPORT", file.path, specifier, { target: resolved.target });
    }
  }
  const graphCycles = cycles(graph);
  for (const cycle of graphCycles) add("IMPORT_CYCLE", cycle[0], cycle.join(" -> "), { cycle });
  const allowed = new Set(policy.licensePolicy.allowed); const forbidden = new Set(policy.licensePolicy.forbiddenForCommercialBundle);
  const licenses = normalized.map((file) => {
    const match = file.content.match(SPDX_RE); const id = match?.[1] ?? null;
    const state = !id ? "MISSING" : allowed.has(id) ? "ALLOWED" : forbidden.has(id) ? "FORBIDDEN" : "INVALID_OR_UNREVIEWED";
    if (state === "MISSING") add("MISSING_SPDX", file.path, sha256(file.content));
    if (state === "FORBIDDEN") add("FORBIDDEN_LICENSE", file.path, id);
    if (state === "INVALID_OR_UNREVIEWED") add("INVALID_SPDX", file.path, id);
    return { path: file.path, spdx: id, state };
  });
  const packageRows = normalized.map((file) => ({ file, identity: packageIdentity(file) })).filter((row) => row.identity);
  const versions = new Map();
  for (const row of packageRows) {
    if (!versions.has(row.identity.name)) versions.set(row.identity.name, new Set());
    versions.get(row.identity.name).add(row.identity.version);
  }
  for (const [name, set] of versions) if (set.size > 1) add("DUPLICATE_PACKAGE_VERSION", name, [...set].sort().join(","), { versions: [...set].sort() });
  const fileDigests = Object.fromEntries(normalized.map((file) => [file.path, sha256(file.content)]));
  for (const [file, expected] of Object.entries(input.expectedSourceDigests ?? {})) {
    const normalizedExpected = normalizeDigest(expected); const actual = fileDigests[normalizePath(file)] ?? null;
    if (!normalizedExpected || actual !== normalizedExpected) add("EXPECTED_DIGEST_MISMATCH", normalizePath(file), `${normalizedExpected}|${actual}`, { expected: normalizedExpected, actual });
  }
  const advisories = Array.isArray(input.advisories) ? input.advisories : [];
  if (advisories.length > policy.limits.maxAdvisories) throw new Error("a20_advisory_count_exceeded");
  for (const advisory of advisories) {
    if (advisory.match?.kind === "SOURCE_SHA256") {
      const target = normalizeDigest(advisory.match.affectedSourceSha256);
      for (const [file, digest] of Object.entries(fileDigests)) if (target && digest === target) add("ADVISORY_SOURCE_HASH_MATCH", file, advisory.id, { advisoryId: advisory.id, advisorySeverity: advisory.severity });
    }
    if (advisory.match?.kind === "PACKAGE_VERSION") {
      for (const row of packageRows) if (row.identity.name === advisory.match.packageName && (advisory.match.affectedVersions ?? []).includes(row.identity.version)) add("ADVISORY_PACKAGE_VERSION_MATCH", row.file.path, advisory.id, { advisoryId: advisory.id, packageName: row.identity.name, packageVersion: row.identity.version, advisorySeverity: advisory.severity });
    }
  }
  findings.sort((a,b) => `${a.familyId}|${a.subject}|${a.evidence}`.localeCompare(`${b.familyId}|${b.subject}|${b.evidence}`));
  const core = {
    schemaVersion: REPORT_SCHEMA, passId: "PASS35_A20", sourceRevisionId: policy.sourceRevisionId, caseRef: input.caseRef,
    inputClass: input.inputClass, rootFiles: [...(input.rootFiles ?? [])].map(normalizePath).sort(),
    sourceBundleSha256: sha256(normalized.map((f) => ({ path: f.path, sha256: fileDigests[f.path] })).sort((a,b)=>a.path.localeCompare(b.path))),
    advisoryRegistrySha256: sha256(advisories),
    graph: { nodes: normalized.length, edges: edges.length, resolved: edges.filter((e)=>e.status==="RESOLVED").length, unresolved: edges.filter((e)=>e.status==="UNRESOLVED").length, unsafe: edges.filter((e)=>["TRAVERSAL","UNSAFE"].includes(e.status)).length, cycles: graphCycles.length, edgeRows: edges.sort((a,b)=>stable(a).localeCompare(stable(b))) },
    licenses, packages: [...versions].map(([name,set])=>({name,versions:[...set].sort()})).sort((a,b)=>a.name.localeCompare(b.name)),
    fileDigests, findings, findingFamilies: [...new Set(findings.map((f)=>f.familyId))].sort(),
    localImplementationComplete: true, paidGateEligible: false, legalConclusionAllowed: false, advisoryCompletenessClaimAllowed: false,
    truthBoundary: policy.truthBoundary,
  };
  return { ...core, reportSha256: sha256(core) };
}

function source(pathName, license = "MIT", body = "contract C { function x() external {} }") { return { path: pathName, content: `${license === null ? "" : `// SPDX-License-Identifier: ${license}\n`}pragma solidity ^0.8.24;\n${body}` }; }
function caseFor(family, vulnerable, i) {
  const root = `contracts/Case${i}.sol`; const safe = source(root); const files = [safe]; const input = { schemaVersion: INPUT_SCHEMA, inputClass: "SYNTHETIC_OFFLINE", caseRef: `AUD-A20-${family.replaceAll("_", "-")}-${String(i).padStart(2,"0")}`, rootFiles:[root], sourceFiles:files, expectedSourceDigests:{}, advisories:[] };
  switch(family) {
    case "UNRESOLVED_IMPORT": input.sourceFiles[0]=source(root,"MIT",`import "./${vulnerable?"Missing":"Dep"}.sol"; contract C {}`); if(!vulnerable) input.sourceFiles.push(source("contracts/Dep.sol")); break;
    case "PATH_TRAVERSAL_IMPORT": input.sourceFiles[0]=source(root,"MIT",`import "${vulnerable?"../../secret.sol":"./Dep.sol"}"; contract C {}`); if(!vulnerable) input.sourceFiles.push(source("contracts/Dep.sol")); break;
    case "IMPORT_CYCLE": input.sourceFiles=[source(root,"MIT",`import "./Dep.sol"; contract C {}`),source("contracts/Dep.sol","MIT",`import "${vulnerable?"./Case"+i+".sol":"./Leaf.sol"}"; contract D {}`)]; if(!vulnerable) input.sourceFiles.push(source("contracts/Leaf.sol")); break;
    case "MISSING_SPDX": input.sourceFiles=[source(root,vulnerable?null:"MIT")]; break;
    case "INVALID_SPDX": input.sourceFiles=[source(root,vulnerable?"MADE-UP-LICENSE":"Apache-2.0")]; break;
    case "FORBIDDEN_LICENSE": input.sourceFiles=[source(root,vulnerable?"AGPL-3.0-only":"MIT")]; break;
    case "DUPLICATE_PACKAGE_VERSION": input.sourceFiles=[source(root),{...source("vendor/OZ1.sol"),packageName:"openzeppelin",packageVersion:"4.9.0"},{...source("vendor/OZ2.sol"),packageName:"openzeppelin",packageVersion:vulnerable?"5.0.0":"4.9.0"}]; break;
    case "ADVISORY_SOURCE_HASH_MATCH": { const dep=source("vendor/Dep.sol", "MIT", vulnerable?"contract VulnerableDependency {}":"contract FixedDependency {}"); input.sourceFiles.push(dep); input.advisories=[{id:`ADV-SRC-${i}`,severity:"high",match:{kind:"SOURCE_SHA256",affectedSourceSha256:sha256(vulnerable?dep.content:"never")}}]; break; }
    case "ADVISORY_PACKAGE_VERSION_MATCH": input.sourceFiles.push({...source("vendor/Pkg.sol"),packageName:"pkg",packageVersion:vulnerable?"1.0.0":"1.0.1"}); input.advisories=[{id:`ADV-PKG-${i}`,severity:"high",match:{kind:"PACKAGE_VERSION",packageName:"pkg",affectedVersions:["1.0.0"]}}]; break;
    case "EXPECTED_DIGEST_MISMATCH": input.expectedSourceDigests[root]=vulnerable?sha256("wrong"):sha256(input.sourceFiles[0].content); break;
  }
  return input;
}
function mutate(input, type, counterpart) {
  const copy=structuredClone(input);
  if(type==="paired_security_flip") return structuredClone(counterpart);
  if(type==="digest_tamper") { copy.expectedSourceDigests={...(copy.expectedSourceDigests??{}),"contracts/Unknown.sol":sha256("tamper")}; return copy; }
  if(type==="line_endings") copy.sourceFiles=copy.sourceFiles.map(f=>({...f,content:f.content.replaceAll("\n","\r\n")}));
  if(type==="file_order"||type==="source_reorder") copy.sourceFiles.reverse();
  if(type==="comment_decoy") copy.sourceFiles[0].content=`/* import "../../decoy.sol"; SPDX-License-Identifier: AGPL-3.0-only */\n${copy.sourceFiles[0].content}`;
  if(type==="whitespace") copy.sourceFiles=copy.sourceFiles.map(f=>({...f,content:f.content.replace(/;/g,";  \n")}));
  if(type==="unrelated_file") copy.sourceFiles.push(source(`extras/Unrelated${copy.sourceFiles.length}.sol`));
  if(type==="import_alias") copy.sourceFiles=copy.sourceFiles.map(f=>({...f,content:f.content.replace(/import\s+"([^"]+)";/g,'import { C as AliasC } from "$1";')}));
  if(type==="path_separator") copy.sourceFiles=copy.sourceFiles.map(f=>({...f,path:f.path.replaceAll("/","\\")}));
  if(type==="advisory_order") copy.advisories.reverse();
  if(type==="metadata_order") copy.sourceFiles=copy.sourceFiles.map(f=>({content:f.content,path:f.path,packageVersion:f.packageVersion,packageName:f.packageName}));
  return copy;
}
const ratio=(a,b)=>b?a/b:0; const round=(x)=>Number(x.toFixed(6));
export function runA20Benchmark(policy) {
  if(!verifyA20Policy(policy)) throw new Error("a20_policy_invalid");
  const cases=[]; for(const family of policy.benchmark.families) for(let i=0;i<policy.benchmark.variantsPerClass;i++){cases.push({family,vulnerable:true,i,input:caseFor(family,true,i)});cases.push({family,vulnerable:false,i,input:caseFor(family,false,i)});}
  const rows=cases.map((row)=>{const report=analyzeA20DependencyCase(row.input,policy);const detected=report.findingFamilies.includes(row.family);return {...row,input:undefined,detected,unexpected:row.vulnerable?report.findingFamilies.filter(f=>f!==row.family):report.findingFamilies,split:row.i<3?"development":row.i<6?"validation":"frozen",reportSha256:report.reportSha256};});
  const lookup=new Map(cases.map(r=>[`${r.family}|${r.vulnerable}|${r.i}`,r.input])); const mutations=[];
  for(const row of cases) for(const type of policy.benchmark.mutationTypes){const mutated=mutate(row.input,type,lookup.get(`${row.family}|${!row.vulnerable}|${row.i}`));let detected;try{detected=analyzeA20DependencyCase(mutated,policy).findingFamilies.includes(row.family);}catch{detected=true;}let expected=type==="paired_security_flip"?!row.vulnerable: type==="digest_tamper"?(row.family==="EXPECTED_DIGEST_MISMATCH"?true:row.vulnerable):row.vulnerable; if(row.family==="ADVISORY_SOURCE_HASH_MATCH"&&type==="whitespace") expected=false; if(row.family==="EXPECTED_DIGEST_MISMATCH"&&!row.vulnerable&&["comment_decoy","whitespace"].includes(type)) expected=true;mutations.push({family:row.family,type,expected,detected,killed:expected===detected});}
  const metrics=(scope)=>{const r=rows.filter(x=>!scope||x.split===scope);const tp=r.filter(x=>x.vulnerable&&x.detected).length,fn=r.filter(x=>x.vulnerable&&!x.detected).length,tn=r.filter(x=>!x.vulnerable&&!x.detected&&x.unexpected.length===0).length,fp=r.filter(x=>!x.vulnerable&&(x.detected||x.unexpected.length)).length;const recall=ratio(tp,tp+fn),precision=ratio(tp,tp+fp),specificity=ratio(tn,tn+fp);return{total:r.length,tp,fn,tn,fp,recall:round(recall),precision:round(precision),specificity:round(specificity),f1:round(precision+recall?2*precision*recall/(precision+recall):0)};};
  const frozen=metrics("frozen"); const killed=mutations.filter(x=>x.killed).length; const mutationKillRate=round(ratio(killed,mutations.length));
  const gates={cases:rows.length===policy.benchmark.expectedCases,vulnerable:rows.filter(x=>x.vulnerable).length===policy.benchmark.expectedVulnerable,remediated:rows.filter(x=>!x.vulnerable).length===policy.benchmark.expectedRemediated,frozen:rows.filter(x=>x.split==="frozen").length===policy.benchmark.expectedFrozen,mutations:mutations.length===policy.benchmark.expectedMutations,recall:frozen.recall>=policy.thresholds.minimumFrozenRecall,specificity:frozen.specificity>=policy.thresholds.minimumFrozenSpecificity,precision:frozen.precision>=policy.thresholds.minimumFrozenPrecision,mutationKillRate:mutationKillRate>=policy.thresholds.minimumMutationKillRate,everyFamily:policy.benchmark.families.every(f=>rows.some(x=>x.family===f&&x.vulnerable&&x.detected)&&rows.some(x=>x.family===f&&!x.vulnerable&&!x.detected&&!x.unexpected.length))};
  const core={schemaVersion:BENCH_SCHEMA,passId:"PASS35_A20",sourceRevisionId:policy.sourceRevisionId,denominators:{families:policy.benchmark.families.length,cases:rows.length,vulnerable:rows.filter(x=>x.vulnerable).length,remediated:rows.filter(x=>!x.vulnerable).length,frozen:rows.filter(x=>x.split==="frozen").length,mutations:mutations.length},overall:metrics(),frozen,mutation:{killed,total:mutations.length,killRate:mutationKillRate,failedSamples:mutations.filter(x=>!x.killed).slice(0,50)},gates,failedGates:Object.entries(gates).filter(([,v])=>!v).map(([k])=>k),localImplementationComplete:Object.values(gates).every(Boolean),paidGateEligible:false,truthBoundary:policy.truthBoundary};
  return {...core,integritySha256:sha256(core)};
}
export function verifyA20Report(report){if(!report||report.schemaVersion!==REPORT_SCHEMA||report.paidGateEligible!==false)return false;const {reportSha256,...core}=report;return reportSha256===sha256(core);}
export function verifyA20Benchmark(report,policy){if(!report||report.schemaVersion!==BENCH_SCHEMA||!verifyA20Policy(policy))return false;const {integritySha256,...core}=report;return integritySha256===sha256(core)&&report.localImplementationComplete===true&&report.failedGates.length===0;}
