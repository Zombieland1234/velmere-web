import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadVerifiedCorpus, ensureFreshOutputs } from './corpus-integrity.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velmere-corpus-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const inputRoot = path.join(dir, 'inputs'); fs.mkdirSync(inputRoot);
  const source = '// synthetic inert fixture; not a deployed contract\n';
  const rows = ['00', '5b00'].map((hex, i) => {
    const runtimeFile = path.join(inputRoot, `${i}.hex`); const sourceFile = path.join(inputRoot, `${i}.sol`);
    fs.writeFileSync(runtimeFile, `0x${hex}\n`);fs.writeFileSync(sourceFile, source);
    return { id: `local-${i}`, runtimeSha256: sha(Buffer.from(hex, 'hex')), runtimeBytes: hex.length / 2, sourceSha256: sha(source), sourceBinding: 'ASSOCIATION_ONLY', contractName: `Local${i}`, consensusLabels: [{swc:'104',expected:false,ambiguous:false}],runtimeFile,sourceFile };
  }).sort((a, b) => a.runtimeSha256.localeCompare(b.runtimeSha256));
  const manifest = { selectedUniqueRuntimeHashes: rows.length, selectionDigestSha256: sha(rows.map(row => row.runtimeSha256).join('\n') + '\n'), cases: rows.map(({ runtimeFile: _runtimeFile, sourceFile: _sourceFile, ...rest }) => structuredClone(rest)) };
  const f = { dir,inputRoot,rows,manifest,manifestPath:path.join(dir,'MANIFEST.json'),inputsPath:path.join(dir,'private-inputs.json') };
  f.save = () => { fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));fs.writeFileSync(f.inputsPath,JSON.stringify(f.rows));f.expectedManifestSha256=sha(fs.readFileSync(f.manifestPath)); };
  f.save(); f.read = () => loadVerifiedCorpus(f); return f;
}
function reject(t, change, message) { const f=fixture(t);change(f);f.save();assert.throws(f.read,message); }

test('corpus: valid original bytes, source hashes and selection are verified', t=>{ const f=fixture(t),r=f.read();assert.equal(r.rows.length,2);assert.equal(r.receipt.verifiedSourceCount,2);assert.equal(r.receipt.sourceRuntimeCompilationVerified,false);assert.equal(r.receipt.labelCorrectnessVerified,false);assert.equal(r.receipt.generalization,'UNVERIFIED'); });
test('corpus: runtime bytes cannot inherit a different manifest hash', t=>reject(t,f=>fs.writeFileSync(f.rows[0].runtimeFile,'fe'),/RUNTIME_HASH_OR_SIZE/));
test('corpus: source bytes cannot inherit a different manifest hash', t=>reject(t,f=>fs.writeFileSync(f.rows[0].sourceFile,'// changed'),/SOURCE_HASH/));
test('corpus: altered labels in private rows are rejected', t=>reject(t,f=>{f.rows[0].consensusLabels[0].expected=true;},/PUBLIC_PRIVATE/));
test('corpus: altered contract name is rejected', t=>reject(t,f=>{f.rows[0].contractName='Different';},/PUBLIC_PRIVATE/));
test('corpus: missing case is not silently excluded', t=>reject(t,f=>f.rows.pop(),/CASE_COUNT/));
test('corpus: wrong declared count is rejected', t=>reject(t,f=>{f.manifest.selectedUniqueRuntimeHashes=1;},/CASE_COUNT/));
test('corpus: duplicate case IDs are rejected', t=>reject(t,f=>{f.rows[1].id=f.rows[0].id;f.manifest.cases[1].id=f.rows[0].id;},/DUPLICATE_OR_INVALID_ID/));
test('corpus: duplicate runtime hashes are rejected', t=>reject(t,f=>{f.rows[1].runtimeSha256=f.rows[0].runtimeSha256;f.manifest.cases[1].runtimeSha256=f.rows[0].runtimeSha256;},/DUPLICATE_OR_INVALID_RUNTIME_HASH/));
test('corpus: silent case reordering is rejected', t=>reject(t,f=>{f.rows.reverse();f.manifest.cases.reverse();},/RUNTIME_ORDER/));
test('corpus: malformed odd runtime hex is rejected', t=>reject(t,f=>fs.writeFileSync(f.rows[0].runtimeFile,'0x123'),/RUNTIME_HEX/));
test('corpus: nonhex runtime is rejected', t=>reject(t,f=>fs.writeFileSync(f.rows[0].runtimeFile,'0xGG'),/RUNTIME_HEX/));
test('corpus: runtime size is bound separately', t=>reject(t,f=>{f.rows[0].runtimeBytes++;f.manifest.cases[0].runtimeBytes++;},/RUNTIME_HASH_OR_SIZE/));
test('corpus: null-source cannot import undeclared source', t=>reject(t,f=>{f.rows[0].sourceSha256=null;f.manifest.cases[0].sourceSha256=null;},/UNDECLARED_SOURCE/));
test('corpus: explicit absent source remains absent', t=>{const f=fixture(t);f.rows[0].sourceSha256=null;f.rows[0].sourceFile=null;f.manifest.cases[0].sourceSha256=null;f.save();assert.equal(f.read().rows[0].sourceCode,undefined);});
test('corpus: invalid expected truth label rejected', t=>reject(t,f=>{f.rows[0].consensusLabels[0].expected='false';f.manifest.cases[0].consensusLabels[0].expected='false';},/LABEL_TRUTH/));
test('corpus: conflicting labels remain ambiguous, not negative', t=>{const f=fixture(t);for(const r of [f.rows[0],f.manifest.cases[0]])r.consensusLabels=[{swc:'104',expected:null,ambiguous:true}];f.save();assert.equal(f.read().rows[0].consensusLabels[0].expected,null);});
test('corpus: duplicate class label cannot inflate metrics', t=>reject(t,f=>{for(const r of [f.rows[0],f.manifest.cases[0]])r.consensusLabels.push({...r.consensusLabels[0]});},/LABEL_CLASS/));
test('corpus: wrong selection digest is rejected', t=>reject(t,f=>{f.manifest.selectionDigestSha256='0'.repeat(64);},/SELECTION_DIGEST/));
test('corpus: absent external hash is rejected', t=>{const f=fixture(t);delete f.expectedManifestSha256;assert.throws(f.read,/EXPECTED_MANIFEST_HASH/);});
test('corpus: manifest changed after its pin is rejected', t=>{const f=fixture(t);fs.appendFileSync(f.manifestPath,' ');assert.throws(f.read,/MANIFEST_HASH_MISMATCH/);});
test('corpus: source symlink outside explicit input root is rejected', t=>reject(t,f=>{const outside=path.join(f.dir,'outside.sol');fs.copyFileSync(f.rows[0].sourceFile,outside);fs.unlinkSync(f.rows[0].sourceFile);fs.symlinkSync(outside,f.rows[0].sourceFile);},/OUTSIDE_INPUT_ROOT/));
test('corpus: encoded input memory budget fails closed', t=>{const f=fixture(t);f.maxSnapshotBytes=1;assert.throws(f.read,/SNAPSHOT_BUDGET_EXCEEDED/);});
test('corpus: checked snapshot does not reread modified files', t=>{const f=fixture(t);const r=f.read();const original=r.rows[0].bytecode;fs.writeFileSync(f.rows[0].runtimeFile,'fe');assert.equal(r.rows[0].bytecode,original);assert.ok(Object.isFrozen(r.rows));assert.ok(Object.isFrozen(r.rows[0].consensusLabels));});
test('corpus: fresh output is allowed',t=>{const f=fixture(t);assert.doesNotThrow(()=>ensureFreshOutputs(f.dir,['new.json']));});
test('corpus: existing evidence is never overwritten',t=>{const f=fixture(t);const p=path.join(f.dir,'results.json');fs.writeFileSync(p,'old');assert.throws(()=>ensureFreshOutputs(f.dir,['results.json']),/OUTPUT_ALREADY_EXISTS/);assert.equal(fs.readFileSync(p,'utf8'),'old');});
test('corpus: dangling output symlink is not considered fresh',t=>{const f=fixture(t);fs.symlinkSync(path.join(f.dir,'missing'),path.join(f.dir,'results.json'));assert.throws(()=>ensureFreshOutputs(f.dir,['results.json']),/OUTPUT_ALREADY_EXISTS/);});
test('corpus: output traversal is rejected',t=>{const f=fixture(t);assert.throws(()=>ensureFreshOutputs(f.dir,['../results.json']),/OUTPUT_NAME/);});
