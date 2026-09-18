# C14-P16 — Backup / Restore

**Base SHA:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p16-backup-restore`  
**Validated implementation SHA:** `dd1224f6a7e5cb69d5ab5a31e553f620262d1a5f`  
**Qualification run:** GitHub Actions `35294137853` — **PASS**  
**Starting score:** 2/10  
**C14-P16 score:** **6/10**  
**Safety:** destructive operations were limited to synthetic, disposable PostgreSQL/Redis/filesystem state. No managed customer rows or Storage objects were modified.

## 1. Baseline

C13/A99 had a useful fail-closed policy boundary, but its own denominator declared:

- `realBackups = 0`
- `realRestores = 0`
- `realRestoredRlsCasesPassed = 0`
- `realDeploymentRollbacks = 0`
- `realProviderOutages = 0`

At the C14 base SHA, package scripts also referenced A51/A99 acceptance test files that were not present. C13 therefore did not contain reproducible evidence of a real backup → destructive failure → fresh restore cycle.

## 2. Managed Supabase read-only findings

Observed on 2026-09-18 without writes:

- connected organization plan: **Free**;
- managed PostgreSQL: **17.6.1.155**;
- disposable Supabase preview/development branches available: **0**;
- applied managed migrations observed: **117**;
- repository SQL migration files under `supabase/migrations/`: **1** at the tested base/branch;
- existing managed schema contains account/subject bindings, report snapshots/PDF blobs, audit report backup tables, entitlement/workspace ledgers, limits and backup/restore RPCs;
- owner-scoped report/snapshot policies exist for important customer-report paths;
- current Supabase security linter also reports **25** `RLS enabled, no policy` findings (INFO), **7** authenticated-executable `SECURITY DEFINER` findings (WARN), plus leaked-password protection disabled. These are not automatically changed by P16; permission remediation belongs to the RLS/security tracks and must be included in a future managed restore qualification.

The 117-applied-vs-1-repo migration mismatch is a recovery blocker: a new environment cannot currently be proven reconstructible from repository migration history alone.

## 3. Recovery set

A valid Velmère recovery set is treated as more than a database dump.

| Layer | Backup strategy implemented/tested | Restore acceptance |
|---|---|---|
| PostgreSQL | real custom-format `pg_dump`, encrypted | fresh PostgreSQL 17 DB; records, RLS, grants, ownership, entitlements, limits, hashes |
| Redis | real password-protected Redis RDB snapshot, encrypted | fresh process from RDB; quota, hard limit, idempotency, TTL |
| Storage | separate encrypted object archive | object path, byte length, SHA-256 and DB-object digest parity |
| Configuration | tracked secret-free config + lockfile + policy + repo migrations | byte-for-byte tracked config restore |
| Reports | JSON + exact PDF bytes + Storage binding | JSON/PDF/record digests and semantic/owner consistency |
| Critical metadata | source revision + report contract + cutoff event | exact source SHA and pre/post-cutoff semantics |
| Secrets/provider config | inventory/rebind/rotate procedure only | values deliberately excluded from Git/artifacts |

All backup payloads in the drill are encrypted using an ephemeral CI-only key. The retained artifact contains no encryption key and no customer payload.

## 4. Automated destructive restore drill

Added:

- `.github/workflows/c14-p16-backup-restore.yml`
- `scripts/c14/p16/run-isolated-restore.sh`
- `scripts/c14/p16/fixture.sql`
- `scripts/c14/p16/verify_restore.sql`
- `scripts/c14/p16/manifest.py`
- `config/c14/p16-backup-scope.json`
- `docs/operations/BACKUP_RESTORE_RUNBOOK.md`

The workflow executes the requested sequence:

1. writes synthetic owner A/B, entitlement, report, quota, object and metadata state;
2. creates PostgreSQL, Redis, Storage and configuration backups;
3. records an explicit backup cutoff;
4. creates post-cutoff mutations in PostgreSQL, Redis and Storage;
5. destroys the source DB, source Redis process and source object/config copies;
6. verifies the encrypted backup manifest before decryption;
7. restores to fresh targets;
8. validates integrity, RLS/ownership A/B, entitlements, limits, Redis TTL/idempotency and report JSON↔PDF↔Storage consistency;
9. proves post-cutoff mutations were not incorrectly restored.

### PostgreSQL client correctness

The first qualification exposed a real operational problem: GitHub's host `pg_dump` was PostgreSQL 16.15 while the restore target was PostgreSQL 17.11. The backup correctly failed rather than producing false evidence. The harness now refuses an older client and falls back to a PostgreSQL 17 Docker client when a compatible native client is unavailable.

## 5. Final PASS evidence

GitHub Actions run `35294137853` on tested SHA `dd1224f6a7e5cb69d5ab5a31e553f620262d1a5f` completed successfully.

Evidence artifact:

- artifact: `c14-p16-backup-restore-35294137853`
- artifact id: `10526534253`
- artifact SHA-256: `023ddae6edb252b9ae08f56f4e770e7ef760eb6e80fb5c0eb16aa34a79d0501e`
- expiry: 2026-10-02

`RESULT.json`:

| Check | Result |
|---|---|
| scope | `ISOLATED_SYNTHETIC_CI_ONLY_NO_CUSTOMER_DATA` |
| status | **PASS** |
| PostgreSQL pre-cutoff records lost | **0** |
| PostgreSQL post-cutoff records restored | **0** |
| RLS ownership A/B | **PASS** |
| entitlement ownership | **PASS** |
| PostgreSQL limit state | **PASS** |
| report digest + semantic consistency | **PASS** |
| Storage pre-cutoff objects lost | **0** |
| Storage post-cutoff objects restored | **0** |
| DB ↔ Storage digest parity | **PASS** |
| Redis pre-cutoff keys lost | **0** |
| Redis post-cutoff keys restored | **0** |
| Redis security limit state | **PASS** |
| Redis idempotency state | **PASS** |
| restored Redis limit PTTL | **3,598,150 ms** |
| tracked config restore | **PASS** |
| secrets included in backup artifact | **false** |

Measured isolated restore/validation durations:

- PostgreSQL: **363 ms**
- Storage: **48 ms**
- Redis: **137 ms**

These are CI component validation durations only. They are **not** production RTO values.

## 6. Qualification history

The red runs are retained as useful negative evidence rather than hidden:

- run `35293451756`: rejected PostgreSQL 16 `pg_dump` against PostgreSQL 17 server;
- runs `35293567764`, `35293710328`, `35293819446`: hardened version-parser/guard behavior;
- run `35293896475`: correctly fail-closed when no compatible native client was present;
- run `35293995704`: PostgreSQL 17 Docker backup, Redis snapshot and encrypted payloads succeeded; manifest CLI ordering exposed and fixed;
- run `35294137853`: **full PASS**.

## 7. RPO / RTO

**Production RPO: UNMEASURED.**  
**Production RTO: UNMEASURED.**

What was measured:

- exact snapshot-cutoff semantics in isolated CI;
- 0 pre-cutoff synthetic records/objects/keys lost;
- 0 post-cutoff synthetic records/objects/keys incorrectly restored;
- component restore+validation durations listed above.

A production RPO/RTO claim requires a representative disposable managed Supabase + Storage + Redis environment with realistic data volume, network/provider configuration and operator workflow. P16 intentionally does not convert CI milliseconds or provider marketing intervals into Velmère SLOs.

## 8. Runbook / operational procedure

`docs/operations/BACKUP_RESTORE_RUNBOOK.md` now requires:

1. portable database export plus migration/function/grant/RLS inventory;
2. separate Storage object-byte backup with path/size/SHA-256 manifest;
3. classification and preservation of security-relevant Redis state;
4. tracked config recovery from exact Git SHA;
5. separate secret-name/provider-binding inventory with rotate/reissue procedure;
6. encrypted payloads and manifest verification before restore;
7. first restore into a disposable target;
8. account A/B ownership, entitlements, limits, report/hash and Storage parity gates before cutover;
9. no production traffic until all gates pass;
10. recurring managed-environment restore drills before launch.

## 9. Remaining blockers / why not >6/10

1. **No destructive managed Supabase restore was performed.** There is no disposable branch/project available.
2. **Free-plan recovery gap.** Velmère must maintain its own regular portable/off-site exports rather than assume downloadable managed backups/PITR.
3. **Supabase Storage remote restore is unproven.** CI proves separate byte backup/restore semantics, not the managed Storage API/S3 path.
4. **Migration lineage is incomplete in Git:** 117 managed applied migrations vs 1 repo SQL migration file.
5. **Managed RLS/security advisories remain.** Current linter findings must be reconciled and then re-tested after managed restore.
6. **Secrets/provider rebind is documented, not drilled.** Runtime credentials must never be bundled with repository backups.
7. **Off-site destination, retention, rotation and scheduled backup job are not yet provisioned.**
8. **Production-scale RPO/RTO are unmeasured.**

## 10. Score

**2/10 → 6/10.**

Why 6/10 is justified:

- real PostgreSQL backup + destructive loss + fresh restore: **PASS**;
- real Redis RDB loss/restore: **PASS**;
- separate Storage object-byte loss/restore: **PASS**;
- RLS/ownership, entitlement, limit and report consistency: **PASS**;
- encryption + manifest integrity: **PASS**;
- automated repeatable CI qualification + runbook: **PASS**.

The score is capped at 6/10 until managed Supabase/Storage recovery, migration provenance, off-site scheduling/retention and representative RPO/RTO are actually proven.
