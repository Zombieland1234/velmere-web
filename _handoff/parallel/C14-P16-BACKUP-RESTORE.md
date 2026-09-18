# C14-P16 — Backup / restore

**Base:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p16-backup-restore`  
**Starting score:** 2/10  
**Safety:** no managed customer rows were modified; destructive testing is isolated and synthetic.

## Baseline truth

C13/A99 had a useful fail-closed policy boundary, but its own denominators recorded `realBackups=0`, `realRestores=0`, `realRestoredRlsCasesPassed=0`, `realDeploymentRollbacks=0` and `realProviderOutages=0`. The package also names A51/A99 test commands whose referenced test files are not present at the C14 base SHA. C13 therefore did not provide a current reproducible disaster-recovery proof.

## Read-only platform findings — 2026-09-18

- Connected Supabase organization plan: **Free**; automatic platform database backups/PITR must not be assumed.
- Managed database observed read-only: PostgreSQL **17.6.1.155**.
- Supabase preview/development branches observed: **0**.
- Applied managed migrations observed: **117**.
- Base checkout has **1 SQL migration file** under `supabase/migrations/` plus README. Git migration history alone cannot currently reconstruct the observed managed schema.
- Supabase Storage object bytes require a separate backup; database backup covers Storage metadata, not object bytes.
- Existing schema contains account/subject bindings, customer artifact snapshots/PDF blobs, Audit Basic artifact/backup tables, entitlement/workspace event tables and backup/restore `SECURITY DEFINER` functions.
- Existing customer report/snapshot RLS policies bind reads to account/account-hash ownership.
- Supabase advisor reported a **critical `rls_disabled` warning on 17 tables**, including backup/evidence and paid-entitlement tables in `velmere_private`. P16 intentionally did not auto-enable RLS because doing so without the correct policies can break service paths; this belongs in the RLS/schema remediation track and must then be re-tested through restore.

## Implemented recovery set

| Layer | Backup | Restore validation |
|---|---|---|
| PostgreSQL | real `pg_dump -Fc`, encrypted before retention | fresh PostgreSQL 17 target; schema/data/RLS/grants/digests |
| Auth/ownership | synthetic account bindings + owner-scoped RLS | owner A sees own data; owner B cannot cross-read A |
| Entitlements | immutable synthetic GRANT events | tier/ownership visibility preserved |
| Limits | PostgreSQL limit row + Redis quota | exact used/hard-limit state preserved |
| Redis | password-protected isolated Redis RDB `SAVE`, encrypted | fresh process from RDB; quota/idempotency/TTL checked |
| Storage | separate object archive, SHA-256 + byte length | source deleted; restored bytes/digests checked |
| Configuration | tracked secret-free config, package/lockfile, A99 policy, migrations | restored byte-for-byte; secret values excluded |
| Reports | JSON + exact PDF bytes + Storage digest binding | JSON/PDF/record digests, semantic fields and owner binding |
| Critical metadata | source revision, report contract, cutoff event | restored and checked |

All backup payloads in the drill are encrypted with an ephemeral drill-only key. An encrypted-payload manifest is verified **before** decryption/restore. The key is never uploaded or committed.

## Failure/restore drill

The workflow performs the required sequence:

1. write synthetic owner A/B, entitlement, report, limit, object and metadata state;
2. create DB, Storage, config and Redis backups;
3. write explicit **post-cutoff** DB/Storage/Redis mutations;
4. kill Redis, drop the source database and delete source object/config copies;
5. verify ciphertext manifest;
6. decrypt and restore into fresh targets;
7. verify pre-cutoff state and prove post-cutoff mutations are absent;
8. verify RLS ownership A/B, entitlements, limits, Redis idempotency/TTL, report JSON/PDF/Storage consistency and source revision metadata.

## Automation/files

- `.github/workflows/c14-p16-backup-restore.yml`
- `scripts/c14/p16/run-isolated-restore.sh`
- `scripts/c14/p16/fixture.sql`
- `scripts/c14/p16/verify_restore.sql`
- `scripts/c14/p16/manifest.py`
- `config/c14/p16-backup-scope.json`
- `docs/operations/BACKUP_RESTORE_RUNBOOK.md`

CI evidence:
- `RESULT.json`
- `BACKUP_MANIFEST.json`
- `POSTGRES_VERIFY.log`
- source/PostgreSQL/Redis version receipts

## RPO / RTO boundary

The drill measures only isolated restore+validation durations and snapshot-cutoff semantics. These values are **not production RTO/RPO**. Production RPO/RTO remain **UNMEASURED** until a representative disposable managed Supabase + Storage + Redis restore is run with realistic data volume and provider configuration.

## Open blockers

1. No disposable managed Supabase branch/project is available for a destructive managed restore.
2. On the current Free plan, provider-managed daily backup/PITR cannot be the recovery strategy; an external scheduled encrypted/off-site destination is still required.
3. Supabase Storage/S3 remote restore is not yet proven against a disposable remote project.
4. Managed migration lineage is 117 applied migrations versus 1 SQL migration file in this repo revision.
5. Critical RLS advisory on 17 tables remains unresolved.
6. Runtime secrets/provider configuration need a secure inventory plus rebind/rotate procedure; values must not be placed in Git backup artifacts.
7. Production-scale restore duration, retention/off-site replication and operator restore access are unmeasured.

## Score

Target after a green isolated CI drill: **2/10 → 6/10**. The score is intentionally capped because managed Supabase/Storage disaster recovery and production-like RPO/RTO are not yet proven.
