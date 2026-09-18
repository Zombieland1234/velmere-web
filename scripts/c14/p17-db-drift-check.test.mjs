import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXPECTED_RECOVERED_C13,
  P17_HARDENING_VERSION,
  REQUIRED_AUTH_SECDEF_SIGNATURES,
  REQUIRED_VALIDATED_CONSTRAINTS,
  auditRepository,
  compareMigrationHistory,
  inspectHardeningSql,
  inspectMigrationSet,
  parseMigrationFilename,
} from './p17-db-drift-check.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

test('migration filenames require sortable 14-digit versions', () => {
  assert.deepEqual(parseMigrationFilename('20260918024500_c14_p17_rls_schema_hardening.sql')?.version, P17_HARDENING_VERSION);
  assert.equal(parseMigrationFilename('20260918_bad.sql'), null);
});

test('duplicate migration versions are detected', () => {
  const report = inspectMigrationSet(['20260918000000_a.sql','20260918000000_b.sql']);
  assert.equal(report.duplicateVersions.length, 1);
});

test('live migration history absent from repo is detected without inventing source', () => {
  const repo = inspectMigrationSet(['20260917043048_a.sql','20260917230935_b.sql']).migrations;
  const live = [
    { version: '20260824002402', name: 'r7_browser_basic_staging_foundation' },
    { version: '20260917043048', name: 'a' },
    { version: '20260917230935', name: 'b' },
  ];
  const drift = compareMigrationHistory(repo, live);
  assert.deepEqual(drift.liveMissingFromRepo.map(x => x.version), ['20260824002402']);
});

test('C14-P17 hardening covers all exposed SECURITY DEFINER RPCs and both validated constraints', () => {
  const migration = fs.readFileSync(path.join(repoRoot,'supabase','migrations',`${P17_HARDENING_VERSION}_c14_p17_rls_schema_hardening.sql`),'utf8');
  const audit = inspectHardeningSql(migration);
  assert.equal(audit.customerDml, false);
  assert.equal(audit.functions.length, REQUIRED_AUTH_SECDEF_SIGNATURES.length);
  assert.ok(audit.functions.every(x => x.searchPathPinned && x.anonRevoked && x.intendedGrant));
  assert.equal(audit.constraints.length, REQUIRED_VALIDATED_CONSTRAINTS.length);
  assert.ok(audit.constraints.every(x => x.validated));
});

test('recovered C13 migration is byte-identical to the retained C13 guard source in scripts/c13', () => {
  const migration = fs.readFileSync(path.join(repoRoot,'supabase','migrations',`${EXPECTED_RECOVERED_C13}_velmere_c13_shield_workspace_stored_tier_guard.sql`));
  const source = fs.readFileSync(path.join(repoRoot,'scripts','c13','shield-workspace-guard.sql'));
  assert.deepEqual(migration, source);
});

test('repository audit is UNVERIFIED without a live snapshot', () => {
  const report = auditRepository(repoRoot);
  assert.equal(report.hasLiveSnapshot, false);
  assert.equal(report.status, 'UNVERIFIED');
});

test('repository audit stays DRIFT while older live migration source is still missing', () => {
  const liveMigrations = [
    { version: '20260824002402', name: 'r7_browser_basic_staging_foundation' },
    { version: EXPECTED_RECOVERED_C13, name: 'velmere_c13_shield_workspace_stored_tier_guard' },
  ];
  const report = auditRepository(repoRoot,{liveMigrations});
  assert.equal(report.recoveredC13, true);
  assert.equal(report.hardeningComplete, true);
  assert.equal(report.status, 'DRIFT');
  assert.deepEqual(report.history.liveMissingFromRepo.map(x=>x.version), ['20260824002402']);
});

test('read-only catalog checker contains no schema/data mutation statements', () => {
  const sql = fs.readFileSync(path.join(repoRoot,'scripts','c14','p17-live-readonly-check.sql'),'utf8');
  const body = sql.replace(/^\s*--.*$/gm,'');
  assert.doesNotMatch(body, /\b(insert\s+into|update\s+|delete\s+from|merge\s+into|truncate\s+|alter\s+|drop\s+|create\s+)\b/i);
});
