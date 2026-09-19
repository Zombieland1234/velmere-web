/** Exact Next.js checker, isolated from the compiler to bound peak memory.
 * Version-bound internal API: fail closed on any other framework version.
 * This is not a replacement type checker or ignoreBuildErrors workaround.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../../',import.meta.url));
assert.equal(path.resolve(process.cwd()),path.resolve(root),'Run at the candidate source root.');
assert.equal(require('next/package.json').version,'16.3.5','Requalify internal API before changing Next version.');
const loadConfig=require('next/dist/server/config').default;
const { PHASE_PRODUCTION_BUILD }=require('next/constants');
const { trace }=require('next/dist/trace');
const { Telemetry }=require('next/dist/telemetry/storage');
const { startTypeChecking }=require('next/dist/build/type-check');
const config=await loadConfig(PHASE_PRODUCTION_BUILD,root);
assert.equal(config.typescript.ignoreBuildErrors,false,'Type checking must remain enabled.');
assert.equal(config.distDir,'.next','Only the reviewed default output directory is supported.');
const span=trace('velmere-q16-isolated-next-typecheck');
const telemetry=new Telemetry({distDir:path.join(root,config.distDir)});
await startTypeChecking({dir:root,config,cacheDir:path.join(root,config.distDir,'cache'),
  nextBuildSpan:span,telemetry,appDir:path.join(root,'app'),pagesDir:undefined});
span.stop();
await telemetry.flush();
console.log('Q16 exact Next checker completed; no type-check suppression.');
