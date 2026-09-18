/** Capture only effective install-script policy; never infer execution from command flags. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function classifyInstallScriptPolicy(ignoreScripts) {
  if (typeof ignoreScripts !== 'boolean') throw new TypeError('Expected an effective npm boolean, not an assumed default');
  return {
    effectiveIgnoreScripts: ignoreScripts,
    dependencyLifecycle: ignoreScripts ? 'SUPPRESSED_BY_EFFECTIVE_IGNORE_SCRIPTS' : 'EXECUTION_NOT_PROVEN_BY_CONFIGURATION',
    allInstallScriptsExecuted: false,
    executionAttested: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const effective = JSON.parse(execFileSync('npm', ['config', 'get', 'ignore-scripts', '--json'], { encoding: 'utf8', timeout: 15000 }));
  const policy = classifyInstallScriptPolicy(effective);
  const rawPackage = fs.readFileSync('package.json');
  const rawLock = fs.readFileSync('package-lock.json');
  const pkg = JSON.parse(rawPackage);
  const lock = JSON.parse(rawLock);
  const installScriptPackages = Object.entries(lock.packages ?? {})
    .filter(([, value]) => value.hasInstallScript === true)
    .map(([packagePath, value]) => ({ packagePath, version: value.version }));
  const rootLifecycleNames = ['preinstall', 'install', 'postinstall', 'prepublish', 'prepare']
    .filter(name => Object.hasOwn(pkg.scripts ?? {}, name));
  const hash = raw => createHash('sha256').update(raw).digest('hex');
  console.log(JSON.stringify({
    schemaVersion: 'velmere.install-policy-observation.v1',
    sourceSha: process.env.GITHUB_SHA ?? null,
    observedAt: new Date().toISOString(),
    scope: 'EFFECTIVE_NPM_POLICY_NOT_LIFECYCLE_EXECUTION_ATTESTATION',
    ...policy,
    foregroundScriptsOverridesIgnoreScripts: false,
    packageSha256: hash(rawPackage), lockfileSha256: hash(rawLock),
    npmrcSha256: fs.existsSync('.npmrc') ? hash(fs.readFileSync('.npmrc')) : null,
    installScriptPackages, rootLifecycleNames,
    allowScriptsDeclarations: pkg.allowScripts ?? null,
    note: 'The completed npm ci proves installation under this effective policy. A successful build does not prove that dependency lifecycle scripts executed.',
  }, null, 2));
}
