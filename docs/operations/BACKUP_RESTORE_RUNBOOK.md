# Velmère backup / restore runbook

Status: C14-P16. This runbook is deliberately fail-closed. A backup is not considered usable until it has been restored into a different isolated target and the post-restore checks pass.

## Scope and safety

The authoritative recovery set is **not just PostgreSQL**. It is the union of database state, object bytes, security-relevant Redis state (where retained), tracked configuration, external secret/config inventory, reports, and critical metadata. Never use a customer production database as the destructive restore target for a drill.

The automated C14 drill uses only synthetic data in an ephemeral PostgreSQL 17 database, an isolated loopback Redis instance and a temporary filesystem object store. It never connects to the managed Supabase project and never reads or writes customer rows.

## Backup set

1. **PostgreSQL / Supabase database** — create a portable logical backup of roles, schema and data. On Supabase use the supported `supabase db dump` flow rather than assuming a raw `pg_dump` of platform internals is portable. Record the source Git SHA, Postgres version, applied migration list and backup cutoff.
2. **Supabase Storage object bytes** — export the actual objects separately. A database backup contains Storage metadata, not the object bytes. Produce an object manifest containing bucket/path, byte length, owner binding when applicable and SHA-256.
3. **Redis** — classify keys first. Velmère rate-limit and idempotency state can be security-relevant because losing it may reopen quota or replay windows. Where the provider supports durable snapshots, retain a snapshot/RDB and test it. If snapshots are unavailable, document a fail-closed recovery mode rather than silently resetting security limits.
4. **Configuration** — Git is the authority for tracked configuration, source and lockfiles. Back up only secret *names/provider references* outside Git; do not place secret values in repository artifacts. Record required Vercel/Supabase/Stripe/provider variables and rotation/reissue procedure separately.
5. **Reports and metadata** — include report snapshots, exact PDF bytes or object references, account/subject bindings, entitlement event history, audit case status, immutable evidence ledgers, job/idempotency metadata and schema/migration lineage.

Every payload must be encrypted at rest and covered by a manifest that is verified **before** restore. Encryption keys must not live beside the backup.

## PostgreSQL / Supabase procedure

### Backup

For a managed Supabase project, use a supported portable dump sequence equivalent to:

```sh
supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f schema.sql
supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only
```

Do not log `DATABASE_URL`. Encrypt the three files immediately, hash the encrypted payloads, and store the manifest separately from the encryption key.

Provider-managed daily backups/PITR may be used as an additional recovery layer when the plan supports them, but they do not replace a separately verified portable restore or Storage backup.

### Restore

Restore into a **new disposable target** first. Match Postgres major version and extensions where possible. A compatible restore sequence is:

```sh
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$RESTORE_DATABASE_URL"
```

Do not cut traffic to the restored target yet.

### Database validation gate

Verify all of the following before any cutover:

- source/restore migration inventory and function definitions;
- RLS enabled/disabled state, policies, grants and `SECURITY DEFINER` `search_path` boundaries;
- account subject bindings and authenticated owner A/B isolation;
- entitlement grants/revocations and paid-tier resolution;
- audit case/report counts and immutable digests;
- report JSON digest, exact PDF digest/length and JSON ↔ PDF ↔ Storage object binding;
- job/lease/idempotency rows required to avoid duplicate work;
- rate-limit state stored in PostgreSQL;
- no post-cutoff synthetic record appears in a snapshot restore;
- Auth provider configuration and secret/key presence are rebuilt separately.

A database restore that passes row counts but fails ownership/RLS or report hashes is a failed restore.

## Storage procedure

1. Freeze or record a precise object cutoff.
2. Enumerate every bucket/object in scope.
3. Copy bytes to versioned encrypted backup storage using the provider's supported S3/Storage API path.
4. Record SHA-256 and byte length for every object.
5. Restore to a different bucket/project.
6. Re-enumerate and compare object count, path, size and digest.
7. Join restored object digests back to database report metadata and fail on any mismatch.
8. Only after verification, reconnect application reads.

Never treat `storage.objects` metadata in a database dump as proof that the actual object bytes were recovered.

## Redis procedure

The C14 drill starts a private password-protected Redis instance, writes a quota counter plus an idempotency key, issues an RDB `SAVE`, creates a post-cutoff key, destroys the source instance, then boots a fresh instance from the RDB. Acceptance requires:

- pre-cutoff limit counter restored exactly;
- hard limit restored exactly;
- idempotency marker restored;
- restored TTL still positive;
- post-cutoff key absent;
- no `FLUSHALL`/`FLUSHDB` is ever run against an external Redis.

For a managed Redis service, use its supported snapshot/export mechanism. If that service cannot restore snapshots, the production recovery design must explicitly define which keys are reconstructable and which security gates remain unavailable until their original TTL window expires.

## Configuration and secret recovery

Tracked files are recoverable from the exact Git SHA and lockfile. Runtime secret values are **not** part of repository backup. Maintain a secure inventory for required variables and ownership/rotation, including at minimum Supabase server keys, auth provider secrets, Redis credentials, Stripe webhook/payment secrets and provider API credentials.

On recovery, validate presence and provider/project binding without printing values. If a credential was potentially exposed by the incident, rotate it rather than restoring the old value.

## RPO / RTO

Do not copy provider marketing numbers into Velmère SLOs. The C14 evidence records only real timings measured in the isolated CI drill. Those values are not production RTO. The drill also verifies snapshot semantics by proving that pre-cutoff data is preserved and intentionally created post-cutoff data is absent.

Production RPO and RTO remain **UNMEASURED** until a controlled restore is performed against a representative disposable managed environment with realistic data volume, Storage size and provider configuration.

## Required recurring drills

Run the isolated restore workflow on every change to this runbook/test harness and after material database/report/storage changes. Before launch, add a periodic disposable managed-environment restore drill. Store only redacted evidence: source SHA, backup/restore IDs, counts, digests, timings and PASS/FAIL checks — never database credentials or customer payloads.

## Cutover gate

A restored environment may receive traffic only when database, Storage and report digests match; owner A/B checks pass; entitlement and limit state is correct; required secrets are rebound; critical health checks pass; and the operator has a rollback path back to the pre-cutover environment.
