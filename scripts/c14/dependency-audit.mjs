import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages ?? {};
const rootLock = packages[''] ?? {};

const fail = [];
const notes = [];
const assert = (condition, message) => { if (!condition) fail.push(message); };
const sameObject = (a = {}, b = {}) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

assert(lock.lockfileVersion === 3, `lockfileVersion must be 3, got ${lock.lockfileVersion}`);
assert(sameObject(pkg.dependencies, rootLock.dependencies), 'package.json dependencies do not match lockfile root');
assert(sameObject(pkg.devDependencies, rootLock.devDependencies), 'package.json devDependencies do not match lockfile root');
assert(pkg.dependencies?.['@walletconnect/ethereum-provider'] === '2.23.10', 'WalletConnect security baseline must be 2.23.10');
assert(packages['node_modules/@walletconnect/ethereum-provider']?.version === '2.23.10', 'lockfile WalletConnect provider must be 2.23.10');

const rows = Object.entries(packages).filter(([p]) => p !== '').map(([p, meta]) => ({ path: p, ...meta }));
const remote = rows.filter((row) => typeof row.resolved === 'string');
const nonRegistry = remote.filter((row) => !row.resolved.startsWith('https://registry.npmjs.org/'));
const missingIntegrity = remote.filter((row) => !row.integrity);
assert(nonRegistry.length === 0, `non-registry resolved packages: ${nonRegistry.map((x) => x.path).join(', ')}`);
assert(missingIntegrity.length === 0, `remote packages without integrity: ${missingIntegrity.map((x) => x.path).join(', ')}`);

const installScripts = rows.filter((row) => row.hasInstallScript).map((row) => ({ path: row.path, version: row.version }));
const allowScripts = pkg.allowScripts ?? {};
for (const row of installScripts) {
  const name = row.path.slice(row.path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const exact = `${name}@${row.version}`;
  assert(allowScripts[exact] === false, `install-script package not explicitly denied: ${exact}`);
}
for (const [entry, allowed] of Object.entries(allowScripts)) {
  assert(allowed === false, `allowScripts must stay deny-only; ${entry}=${allowed}`);
}

const deprecated = rows.filter((row) => row.deprecated).map((row) => ({ path: row.path, version: row.version, message: row.deprecated }));
const knownDeprecated = new Set(['node_modules/@safe-global/safe-gateway-typescript-sdk@3.23.1']);
for (const row of deprecated) {
  const key = `${row.path}@${row.version}`;
  assert(knownDeprecated.has(key), `new deprecated package not baselined: ${key}`);
}
assert(deprecated.length <= knownDeprecated.size, `deprecated package count increased to ${deprecated.length}`);

const byName = new Map();
for (const row of rows) {
  const name = row.path.slice(row.path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  if (!byName.has(name)) byName.set(name, new Set());
  byName.get(name).add(row.version);
}
const duplicates = [...byName.entries()].filter(([, versions]) => versions.size > 1).map(([name, versions]) => ({ name, versions: [...versions].sort() }));
const licenses = {};
for (const row of rows) licenses[row.license ?? '<missing>'] = (licenses[row.license ?? '<missing>'] ?? 0) + 1;

const output = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  lockfileVersion: lock.lockfileVersion,
  directDependencies: Object.keys(pkg.dependencies ?? {}).length,
  directDevDependencies: Object.keys(pkg.devDependencies ?? {}).length,
  lockPackagePaths: rows.length,
  remoteRegistryPackages: remote.length,
  nonRegistryResolved: nonRegistry,
  missingIntegrity,
  installScripts,
  allowScripts,
  deprecated,
  duplicatePackageNames: duplicates.length,
  duplicates,
  licenses,
  notes,
  pass: fail.length === 0,
  failures: fail,
};

const outPath = process.env.C14_P08_AUDIT_OUTPUT || '/tmp/c14-p08-dependency-audit.json';
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (fail.length) process.exit(1);
