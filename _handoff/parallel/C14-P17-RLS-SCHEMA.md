# C14-P17 — RLS / schema / migrations audit

**Base SHA:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p17-rls-schema`  
**Scope:** database drift, migration lineage/order/replay, grants, SECURITY DEFINER/search_path, RLS, role boundaries, RPC permissions, indexes, constraints, unmapped objects.  
**Production safety boundary:** no persistent production data or schema mutation was performed during this audit.

## Verdict

**C13 score: 7/10 → C14-P17 score: 8/10.**

The live client boundary is materially stronger than the recovered repository suggested: all 19 public tables have RLS enabled; no public table with anon/authenticated privileges was found without an effective RLS boundary; anon execution of public SECURITY DEFINER functions is zero; and read-only live A/B probes fail closed.

The release is **not** a 9/10 or 10/10 database qualification because the recovered repository still cannot reconstruct the live database from migrations. Live has 117 applied migrations. The base repository had one migration; this branch recovers the known C13 migration, leaving **115 applied live migration sources absent from the repository**. There is also no disposable Supabase development branch on which to run positive owner-A versus owner-B fixture writes using real active Auth sessions.

## Truth status matrix

| Area | Status | Result |
|---|---|---|
| Live migration history | CONFIRMED | 117 applied versions; first `20260824002402`, last `20260917230935` |
| Base repo migration history | CONFIRMED | 1 SQL migration |
| Recovered C13 migration | CONFIRMED SOURCE RECOVERY | `20260917230935_velmere_c13_shield_workspace_stored_tier_guard.sql` copied byte-for-byte from retained `scripts/c13/shield-workspace-guard.sql`; live history confirms matching version/name, but Supabase history does not expose historical SQL bytes |
| Remaining migration-source gap | CONFIRMED | 115 live applied versions still missing from repo |
| New P17 migration | CONFIRMED SOURCE-ONLY | present in repo, intentionally not applied to live |
| Public RLS | CONFIRMED | 19/19 public tables have RLS enabled |
| Client exposure anomalies | CONFIRMED | 0 tables with anon/auth DML/SELECT privilege and missing required RLS/policy boundary |
| SECURITY DEFINER | CONFIRMED | 121 public SECDEF functions; 7 executable by authenticated; 0 by anon; 0 by PUBLIC |
| SECDEF search_path | PARTIAL / HARDENING GAP | all have a configured path, but 6/7 authenticated SECDEF RPCs use broader paths than necessary; P17 pins all seven to `pg_catalog` |
| Anonymous table access | CONFIRMED DENY | `42501 permission denied` on customer snapshot table |
| Anonymous paid-entitlement RPC | CONFIRMED DENY | `42501 permission denied` |
| Authenticated synthetic A | CONFIRMED FAIL-CLOSED | 0 binding/report/snapshot/PDF rows; Pro=false; Advanced=false |
| Authenticated synthetic B | CONFIRMED FAIL-CLOSED | same as A |
| service_role | CONFIRMED | sees expected full service-side row counts |
| Positive real A/B owner fixture | BLOCKED | no disposable Supabase branch; no production fixture writes were made |
| Invalid indexes | CONFIRMED | 0 |
| FK without candidate index | CONFIRMED | 0 |
| Unvalidated constraints | CONFIRMED | 2 on `velmere_audit_intake_cases` |
| Existing-row violations of those constraints | CONFIRMED | 0 violations across 67 existing rows |
| Orphan deletion candidates | UNVERIFIED / NONE APPROVED | name-level drift is large; no object is declared safe to delete without provenance/dependency proof |

## Migration drift

At the base SHA the repository had only:

- `20260917043048_velmere_c6d_shield_session_and_null_validation.sql`

Live contained **117** applied migrations. The live history is uniquely ordered by 14-digit versions in the observed list.

This branch recovers:

- `20260917230935_velmere_c13_shield_workspace_stored_tier_guard.sql`

and adds a pending source-only migration:

- `20260918024500_c14_p17_rls_schema_hardening.sql`

Against the captured live snapshot, the branch therefore has:

- 3 migration files in repo,
- 117 migrations live,
- **115 live versions missing from repo**,
- 1 repo migration intentionally not yet applied: C14-P17 hardening.

The checker deliberately returns **DRIFT**, not PASS, with the live snapshot.

### Replay / idempotency classification

- C6D: **guarded non-replayable by design** — exact function-definition hashes are preconditions and reapply/drift aborts.
- Recovered C13: **guarded non-replayable by design** — exact reviewed function-definition hashes and insertion anchor are preconditions.
- C14-P17 hardening: **metadata-repeat-safe when target signatures/constraints exist** — ALTER FUNCTION search_path, REVOKE/GRANT and VALIDATE CONSTRAINT; no customer-row DML.

No missing historical migration body was fabricated.

## Schema/object drift

`lib/db/schema.sql` is not a canonical representation of the current live project.

Name-level comparison:

| Object class | Repo | Live | Common | Live-only | Repo-only |
|---|---:|---:|---:|---:|---:|
| Tables | 48 | 54 | 5 | 49 | 43 |
| Function names | 43 | 161 | 14 | 147 | 29 |

Full lists are recorded in `config/c14/p17-object-drift.json`.

**Important:** live-only/repo-only means **UNMAPPED**, not automatically orphaned. No table/function was marked as a deletion candidate. The 115-file migration provenance gap must be reconciled before destructive cleanup can be justified.

## RLS, grants and roles

### Public tables

- 19 public tables.
- 19/19 have RLS enabled.
- Four public tables expose authenticated owner SELECT policies:
  - `velmere_account_supabase_subject_bindings`
  - `velmere_audit_basic_report_artifacts`
  - `velmere_customer_artifact_snapshots`
  - `velmere_customer_artifact_pdf_blobs`
- Other RLS-enabled public tables with zero policies do not have anon/authenticated table privileges in the audited catalog; they fail closed rather than becoming exposed.
- No public view/materialized view accessible to anon/authenticated was found bypassing an invoker boundary.

### Live role probes

Admin/service-side reference counts on non-empty tables:

- bindings: 14
- Audit Basic report artifacts: 28
- customer artifact snapshots: 54
- customer PDF blobs: 54

Synthetic `authenticated` account A and B, each with distinct fake subject/session claims and no valid live binding/session, independently observed:

- bindings: 0
- reports: 0
- snapshots: 0
- PDF blobs: 0
- Pro entitlement: false
- Advanced entitlement: false

`anon` observed:

- customer snapshot SELECT: `42501 permission denied`
- paid-entitlement RPC execute: `42501 permission denied`

`service_role` observed the full reference counts, which is expected for the server/service boundary.

These probes used catalog SELECTs plus transaction/session-local role/JWT settings and temporary `ON COMMIT DROP` result tables only. No persistent customer row was created, changed or deleted.

## SECURITY DEFINER / RPC permissions

Catalog result:

- public functions: 135
- public SECURITY DEFINER: 121
- authenticated-executable SECURITY DEFINER: 7
- anon-executable SECURITY DEFINER: 0
- PUBLIC-executable SECURITY DEFINER: 0
- SECURITY DEFINER with no configured search_path: 0

The seven authenticated RPCs were inspected individually. Their custom relation/function references are schema-qualified and their authorization/capability checks remain in the body.

Six of the seven still carried broader search paths such as `public`, `velmere_private`, `auth`, `extensions` and/or `pg_temp`. Because authenticated has database TEMP privilege, retaining `pg_temp` in a SECDEF path is unnecessary attack surface even though current custom references are qualified.

The P17 migration pins all seven to:

`SET search_path TO pg_catalog`

and reasserts:

- no EXECUTE for `PUBLIC` or `anon`,
- EXECUTE for `authenticated` and `service_role`.

Legacy overloads without the server-capability parameter were checked separately: they are postgres-only and not executable by anon/authenticated/service_role.

## Constraints and indexes

Two constraints were still `NOT VALID`:

- `velmere_audit_intake_contract_chain_identity`
- `velmere_audit_intake_contract_target_hash_identity`

A read-only predicate check across all 67 existing intake rows found **0 violations** for each. P17 therefore adds `VALIDATE CONSTRAINT` for both. It was **not applied to live** in this task.

Index checks:

- invalid/unready/dead indexes: 0
- foreign keys without a candidate supporting index: 0

Unused-index advisor output was not treated as permission to remove indexes; usage is workload-dependent and this task does not have enough evidence to classify those indexes as orphaned.

## Fixes added

1. **Recovered C13 migration source**
   - `supabase/migrations/20260917230935_velmere_c13_shield_workspace_stored_tier_guard.sql`

2. **C14-P17 hardening migration**
   - `supabase/migrations/20260918024500_c14_p17_rls_schema_hardening.sql`
   - pins seven authenticated SECDEF RPCs to `pg_catalog`
   - reasserts EXECUTE grants/revokes
   - validates the two safe-to-validate intake constraints
   - contains no customer-row DML
   - source-only; not deployed

3. **Migration/schema drift checker**
   - `scripts/c14/p17-db-drift-check.mjs`
   - rejects malformed/duplicate migration versions
   - compares repo/live migration history
   - requires the recovered C13 source
   - verifies P17 hardening coverage
   - fails safe as `UNVERIFIED` when no live snapshot exists
   - remains `DRIFT` while live migration bodies are missing

4. **Checker tests**
   - `scripts/c14/p17-db-drift-check.test.mjs`

5. **Read-only live catalog checker**
   - `scripts/c14/p17-live-readonly-check.sql`

6. **Evidence**
   - `config/c14/p17-live-readonly-snapshot.json`
   - `config/c14/p17-object-drift.json`
   - `config/c14/p17-test-receipt.json`

## Tests

### Local unit suite

`node --test scripts/c14/p17-db-drift-check.test.mjs`

**8/8 PASS**

Covered:

1. sortable 14-digit migration versions,
2. duplicate migration version detection,
3. live history missing from repo detection,
4. seven SECDEF hardening targets + two constraints,
5. recovered C13 guard byte equality to retained source,
6. fail-safe `UNVERIFIED` without live snapshot,
7. `DRIFT` while historical live migrations remain absent,
8. read-only checker contains no DDL/DML.

### Live read-only checker

`scripts/c14/p17-live-readonly-check.sql` executed successfully against the live Supabase project.

Observed at `2026-09-18T00:59:39.743631Z`:

- 19 public tables / 19 RLS,
- 35 private tables / 18 RLS,
- 0 client exposure anomalies,
- 7 authenticated SECDEF RPCs,
- 0 anon SECDEF,
- 0 PUBLIC SECDEF,
- 0 SECDEF with missing configured search_path,
- 2 unvalidated constraints,
- 0 invalid indexes.

### Exact branch drift evaluation

At branch state after checker/evidence commits:

- repo migrations: 3
- live migrations: 117
- live missing from repo: 115
- repo-only pending migration: P17 hardening
- recovered C13 source equals retained C13 guard source
- all seven P17 function hardening checks present
- both constraint validations present
- result: **DRIFT** (expected fail-closed result)

## Remaining blockers

1. **115 live applied migration sources are still missing.** This blocks clean-room database reconstruction, exact schema provenance and a trustworthy fresh bootstrap.
2. **No disposable Supabase development branch exists.** Full positive owner A / negative owner B tests using valid active Auth sessions and fixture rows were not run; production was intentionally not used for fixture writes.
3. **P17 hardening is not deployed.** Live still has six authenticated SECDEF RPCs with broader-than-needed search paths and two constraints remain `NOT VALID` until the reviewed migration is applied.
4. **Large object-map divergence remains UNMAPPED.** No destructive orphan cleanup is justified yet.

## Score

**7/10 → 8/10**

Why it improved:

- real live RLS/grant behavior was tested on non-empty production tables without modifying data,
- anon/authenticated/service_role boundaries were explicitly checked,
- the C13 applied migration source was recovered into the migration directory,
- SECDEF/search_path hardening and constraint validation were prepared,
- reproducible drift tooling and machine-readable evidence were added,
- the checker fails closed when live evidence is absent.

Why it is not higher:

- incomplete migration provenance (115 missing live sources),
- no disposable staging branch for full active-session A/B positive/negative fixtures,
- hardening migration intentionally remains unapplied to production.
