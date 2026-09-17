/** Prove that the built deployment file traces include the exact engine bundle. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const out = process.argv[2];
if (!out) throw new Error('evidence directory required');
fs.mkdirSync(out, { recursive: true });
const root = process.cwd();
const worker = path.resolve('.generated/audit-engine-worker.cjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync('.generated/audit-engine-worker-manifest.json', 'utf8'));
const bundleSha256 = sha256(fs.readFileSync(worker));
const inputParity = manifest.sourceInputs.every(input => sha256(fs.readFileSync(input.path)) === input.sha256);
const paths = [
  '.next/server/app/api/audit/report/route.js.nft.json',
  '.next/server/app/api/audit/report-pdf/route.js.nft.json',
  '.next/server/app/[locale]/security/audits/report/[id]/page.js.nft.json',
];
const rows = paths.map(file => {
  const row = { file, exists: fs.existsSync(file), includesWorker: false };
  if (row.exists) {
    const bytes = fs.readFileSync(file);
    row.traceSha256 = sha256(bytes);
    const trace = JSON.parse(bytes);
    row.includesWorker = Array.isArray(trace.files) && trace.files.some(p => path.resolve(path.dirname(file), p) === worker);
    row.tracedFileCount = trace.files?.length ?? 0;
  }
  return row;
});
const result = { sourceSha: process.env.GITHUB_SHA ?? null, recordedAt: new Date().toISOString(),
  scope: 'BUILT_NEXT_FILE_TRACES_NOT_HOSTED_WORKER_EXECUTION', rootIsWorkingDirectory: Boolean(root),
  bundleSha256, manifestSha256: manifest.sha256, bundleMatchesManifest: bundleSha256 === manifest.sha256,
  inputParity, sourceInputCount: manifest.sourceInputs.length, rows };
fs.writeFileSync(path.join(out, 'WORKER_TRACE_QUALIFICATION.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.bundleMatchesManifest || !inputParity || rows.some(row => !row.includesWorker)) process.exitCode = 1;
