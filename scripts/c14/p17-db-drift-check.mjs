import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_RECOVERED_C13 = '20260917230935';
export const P17_HARDENING_VERSION = '20260918024500';
export const REQUIRED_AUTH_SECDEF_SIGNATURES = [
  'public.velmere_claim_current_account_durable_computation(text,text,text,text,text,text,integer,integer,jsonb,text)',
  'public.velmere_complete_current_account_durable_computation(text,text,jsonb,text)',
  'public.velmere_current_active_session_account_id()',
  'public.velmere_fail_current_account_durable_computation(text,text,text,integer,text)',
  'public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)',
  'public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)',
  'public.velmere_store_current_account_customer_artifact_pdf_bundle_v1(jsonb,text,jsonb,text,text)',
];
export const REQUIRED_VALIDATED_CONSTRAINTS = [
  'velmere_audit_intake_contract_chain_identity',
  'velmere_audit_intake_contract_target_hash_identity',
];

export function parseMigrationFilename(name) {
  const match = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/i.exec(name);
  return match ? { version: match[1], name: match[2], filename: name } : null;
}

export function inspectMigrationSet(filenames) {
  const parsed = filenames.map(parseMigrationFilename);
  const malformed = filenames.filter((_, i) => !parsed[i]);
  const migrations = parsed.filter(Boolean).sort((a, b) => a.version.localeCompare(b.version) || a.filename.localeCompare(b.filename));
  const byVersion = new Map();
  for (const m of migrations) byVersion.set(m.version, [...(byVersion.get(m.version) ?? []), m.filename]);
  const duplicateVersions = [...byVersion.entries()].filter(([, files]) => files.length > 1).map(([version, files]) => ({ version, files }));
  return { migrations, malformed, duplicateVersions };
}

export function compareMigrationHistory(repoMigrations, liveMigrations) {
  const repoVersions = new Set(repoMigrations.map(x => x.version));
  const liveVersions = new Set(liveMigrations.map(x => x.version));
  return {
    liveMissingFromRepo: liveMigrations.filter(x => !repoVersions.has(x.version)),
    repoNotApplied: repoMigrations.filter(x => !liveVersions.has(x.version)),
  };
}

export function inspectHardeningSql(sql) {
  const normalized = sql.replace(/\s+/g, ' ').toLowerCase();
  const functions = REQUIRED_AUTH_SECDEF_SIGNATURES.map(signature => ({
    signature,
    searchPathPinned: normalized.includes(`alter function ${signature.toLowerCase()} set search_path to pg_catalog`),
    anonRevoked: normalized.includes(`revoke all on function ${signature.toLowerCase()} from public, anon`),
    intendedGrant: normalized.includes(`grant execute on function ${signature.toLowerCase()} to authenticated, service_role`),
  }));
  const constraints = REQUIRED_VALIDATED_CONSTRAINTS.map(name => ({
    name,
    validated: normalized.includes(`validate constraint ${name.toLowerCase()}`),
  }));
  const customerDml = /(^|[;\n]\s*)(insert\s+into|update\s+|delete\s+from|merge\s+into|truncate\s+)/im.test(sql);
  return { functions, constraints, customerDml };
}

export function classifyMigrationReplay(sql) {
  const compact = sql.toLowerCase();
  if (/pg_get_functiondef\s*\(/.test(compact) && /raise\s+exception/.test(compact)) return 'guarded_non_replayable';
  if (!/(^|[;\n]\s*)(insert\s+into|update\s+|delete\s+from|merge\s+into|truncate\s+)/im.test(sql) &&
      !/(^|[;\n]\s*)(create\s+table(?!\s+if\s+not\s+exists)|create\s+index(?!\s+if\s+not\s+exists)|drop\s+)/im.test(sql)) {
    return 'idempotent_or_metadata_only';
  }
  return 'review_required';
}

export function auditRepository(root, snapshot = null) {
  const migrationDir = path.join(root, 'supabase', 'migrations');
  const filenames = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter(x => x.endsWith('.sql')) : [];
  const migrationSet = inspectMigrationSet(filenames);
  const hasLiveSnapshot = Boolean(snapshot && Array.isArray(snapshot.liveMigrations) && snapshot.liveMigrations.length);
  const liveMigrations = hasLiveSnapshot ? snapshot.liveMigrations : [];
  const history = compareMigrationHistory(migrationSet.migrations, liveMigrations);
  const hardeningPath = migrationSet.migrations.find(x => x.version === P17_HARDENING_VERSION)?.filename;
  const hardening = hardeningPath ? inspectHardeningSql(fs.readFileSync(path.join(migrationDir, hardeningPath), 'utf8')) : null;
  const replay = migrationSet.migrations.map(m => ({
    ...m,
    replayClass: classifyMigrationReplay(fs.readFileSync(path.join(migrationDir, m.filename), 'utf8')),
  }));
  const recoveredC13 = migrationSet.migrations.some(x => x.version === EXPECTED_RECOVERED_C13);
  const hardeningComplete = Boolean(hardening && !hardening.customerDml && hardening.functions.every(x => x.searchPathPinned && x.anonRevoked && x.intendedGrant) && hardening.constraints.every(x => x.validated));
  const status = !hasLiveSnapshot ? 'UNVERIFIED' : migrationSet.malformed.length || migrationSet.duplicateVersions.length || !recoveredC13 || !hardeningComplete || history.liveMissingFromRepo.length ? 'DRIFT' : 'PASS';
  return { status, hasLiveSnapshot, recoveredC13, hardeningComplete, migrationSet, history, replay, hardening };
}

function parseArgs(argv) {
  const out = { root: process.cwd(), snapshot: null, reportOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = path.resolve(argv[++i]);
    else if (argv[i] === '--snapshot') out.snapshot = path.resolve(argv[++i]);
    else if (argv[i] === '--report-only') out.reportOnly = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaultSnapshot = path.join(args.root, 'config', 'c14', 'p17-live-readonly-snapshot.json');
  const snapshotPath = args.snapshot ?? (fs.existsSync(defaultSnapshot) ? defaultSnapshot : null);
  const snapshot = snapshotPath ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) : null;
  const report = auditRepository(args.root, snapshot);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!args.reportOnly && report.status !== 'PASS') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
