/** Deterministic bundle of the engine used by the customer's Node worker. */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('.generated', { recursive: true });
const output = '.generated/audit-engine-worker.cjs';
const result = await build({
  entryPoints: ['lib/security/v2/audit-engine-worker.ts'], outfile: output,
  platform: 'node', target: 'node22', format: 'cjs', bundle: true, sourcemap: false,
  minify: false, metafile: true, legalComments: 'inline', logLevel: 'warning',
});
const files = [];
for (const name of Object.keys(result.metafile.inputs).sort()) {
  files.push({ path: name, sha256: createHash('sha256').update(await readFile(name)).digest('hex') });
}
await writeFile('.generated/audit-engine-worker-manifest.json', JSON.stringify({
  schema: 'velmere.audit-worker-build.v1', tool: 'esbuild', version: (await import('esbuild')).version,
  sourceInputs: files, output, sha256: createHash('sha256').update(await readFile(output)).digest('hex'),
}, null, 2));
console.log(`Audit worker bundled (${files.length} inputs).`);
