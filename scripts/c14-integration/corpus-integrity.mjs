/** Validate and snapshot benchmark inputs BEFORE workers see any bytes.
 * This binds local evidence to a pinned manifest; it does not validate its labels
 * or prove that a supplied Solidity source compiled to the runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/u;
function requireValue(condition, code) {
  if (!condition) throw new Error(`CORPUS_INTEGRITY:${code}`);
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function boundedFile(filename, limit, root) {
  requireValue(typeof filename === 'string' && filename.length > 0, 'FILE_PATH');
  const real = fs.realpathSync(filename);
  if (root) {
    const rel = path.relative(root, real);
    requireValue(rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), 'OUTSIDE_INPUT_ROOT');
  }
  const fd = fs.openSync(real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    requireValue(stat.isFile() && stat.size <= limit, 'FILE_SIZE_OR_KIND');
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const size = fs.readSync(fd, bytes, count, bytes.length - count, null);
      if (!size) break;
      count += size;
    }
    requireValue(count === stat.size, 'FILE_CHANGED_WHILE_READING');
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
function utf8(bytes) {
  const text = bytes.toString('utf8');
  requireValue(Buffer.from(text, 'utf8').equals(bytes), 'INVALID_UTF8');
  return text;
}

export function ensureFreshOutputs(directory, names) {
  for (const name of names) {
    requireValue(path.basename(name) === name, 'OUTPUT_NAME');
    // lstat also refuses a dangling symlink, which existsSync would miss.
    try { fs.lstatSync(path.join(directory, name)); }
    catch (error) { if (error?.code === 'ENOENT') continue; throw error; }
    throw new Error('CORPUS_INTEGRITY:OUTPUT_ALREADY_EXISTS');
  }
}

export function loadVerifiedCorpus({ manifestPath, inputsPath, expectedManifestSha256, inputRoot, maxSnapshotBytes = 512 * 1024 * 1024 }) {
  requireValue(hashPattern.test(expectedManifestSha256 ?? ''), 'EXPECTED_MANIFEST_HASH_REQUIRED');
  requireValue(Number.isSafeInteger(maxSnapshotBytes) && maxSnapshotBytes > 0, 'SNAPSHOT_BUDGET');
  requireValue(typeof inputRoot === 'string' && inputRoot.length > 0, 'INPUT_ROOT_REQUIRED');
  const root = fs.realpathSync(inputRoot);
  requireValue(fs.statSync(root).isDirectory(), 'INPUT_ROOT_REQUIRED');
  const manifestBytes = boundedFile(manifestPath, 128 * 1024 * 1024);
  const manifestSha256 = digest(manifestBytes);
  requireValue(manifestSha256 === expectedManifestSha256, 'MANIFEST_HASH_MISMATCH');
  const manifest = JSON.parse(utf8(manifestBytes));
  const inputs = JSON.parse(utf8(boundedFile(inputsPath, 128 * 1024 * 1024)));
  requireValue(object(manifest) && Array.isArray(manifest.cases) && Array.isArray(inputs), 'MANIFEST_OR_INPUT_SHAPE');
  requireValue(inputs.length > 0 && inputs.length === manifest.cases.length && inputs.length === manifest.selectedUniqueRuntimeHashes, 'CASE_COUNT_MISMATCH');
  const ids = new Set(); const hashes = new Set(); const rows = []; let snapshotBytes = 0; let sources = 0;
  for (let i = 0; i < inputs.length; i++) {
    const entry = inputs[i]; const expected = manifest.cases[i];
    requireValue(object(entry) && object(expected), 'CASE_SHAPE');
    const { runtimeFile, sourceFile, ...publicFields } = entry;
    requireValue(isDeepStrictEqual(publicFields, expected), 'PUBLIC_PRIVATE_CASE_MISMATCH');
    requireValue(typeof entry.id === 'string' && entry.id.length > 0 && !ids.has(entry.id), 'DUPLICATE_OR_INVALID_ID');
    requireValue(hashPattern.test(entry.runtimeSha256 ?? '') && !hashes.has(entry.runtimeSha256), 'DUPLICATE_OR_INVALID_RUNTIME_HASH');
    if (i) requireValue(inputs[i - 1].runtimeSha256 < entry.runtimeSha256, 'RUNTIME_ORDER');
    ids.add(entry.id); hashes.add(entry.runtimeSha256);
    requireValue(Array.isArray(entry.consensusLabels), 'LABEL_SHAPE');
    const classes = new Set();
    for (const label of entry.consensusLabels) {
      requireValue(object(label) && /^\d+$/u.test(label.swc ?? '') && typeof label.swc === 'string' && !classes.has(label.swc), 'LABEL_CLASS');
      requireValue(typeof label.ambiguous === 'boolean' && (label.ambiguous ? label.expected === null : typeof label.expected === 'boolean'), 'LABEL_TRUTH_VALUE');
      classes.add(label.swc);
    }
    const runtimeText = utf8(boundedFile(runtimeFile, 4_000_000, root));
    const hex = runtimeText.replace(/\s+/gu, '').replace(/^0x/iu, '');
    requireValue(hex.length > 0 && hex.length % 2 === 0 && /^[a-fA-F0-9]+$/u.test(hex) && hex.length <= 2_000_000, 'RUNTIME_HEX');
    const runtime = Buffer.from(hex, 'hex');
    requireValue(runtime.length === entry.runtimeBytes && digest(runtime) === entry.runtimeSha256, 'RUNTIME_HASH_OR_SIZE_MISMATCH');
    let sourceCode;
    if (entry.sourceSha256 === null) requireValue(sourceFile === null, 'UNDECLARED_SOURCE');
    else {
      requireValue(hashPattern.test(entry.sourceSha256 ?? '') && typeof sourceFile === 'string', 'SOURCE_IDENTITY');
      const source = boundedFile(sourceFile, 500_000, root);
      requireValue(digest(source) === entry.sourceSha256, 'SOURCE_HASH_MISMATCH');
      sourceCode = utf8(source); snapshotBytes += source.length; sources++;
    }
    snapshotBytes += runtimeText.length;
    requireValue(snapshotBytes <= maxSnapshotBytes, 'SNAPSHOT_BUDGET_EXCEEDED');
    // Workers receive this checked in-memory snapshot, never a second file read.
    rows.push(Object.freeze({ ...expected, consensusLabels: Object.freeze(entry.consensusLabels.map(label => Object.freeze({ ...label }))), bytecode: `0x${hex}`, sourceCode }));
  }
  const selectionDigestSha256 = digest(`${[...hashes].join('\n')}\n`);
  requireValue(selectionDigestSha256 === manifest.selectionDigestSha256, 'SELECTION_DIGEST_MISMATCH');
  return { manifest, rows: Object.freeze(rows), receipt: Object.freeze({ schema: 'velmere.c15q.corpus-integrity.v1', manifestSha256, selectionDigestSha256, verifiedRuntimeCount: rows.length, verifiedSourceCount: sources, snapshotBytes, sourceRuntimeCompilationVerified: false, labelCorrectnessVerified: false, generalization: 'UNVERIFIED' }) };
}
