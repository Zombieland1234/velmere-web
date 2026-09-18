#!/usr/bin/env bash
set -euo pipefail
umask 077

BASE_SHA='4cb45bbcf910f0517d4a5d265682cd2f7e4e41df'
EVIDENCE=${C14_P16_EVIDENCE_DIR:-/tmp/c14-p16-evidence}
WORK=$(mktemp -d)
PORT=16386
REDIS_PID=''
restore_rto_ms=0
redis_rto_ms=0
storage_rto_ms=0
cleanup() {
  if [[ -n "$REDIS_PID" ]]; then kill "$REDIS_PID" 2>/dev/null || true; wait "$REDIS_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT
mkdir -p "$EVIDENCE" "$WORK/source-storage/reports/owner-a" "$WORK/source-storage/reports/owner-b" "$WORK/source-config" "$WORK/backup" "$WORK/restore"

for cmd in psql createdb dropdb pg_dump pg_restore redis-server redis-cli openssl tar python3 sha256sum git; do
  command -v "$cmd" >/dev/null || { echo "missing command: $cmd" >&2; exit 2; }
done

git merge-base --is-ancestor "$BASE_SHA" HEAD
printf '%s\n' "$(git rev-parse HEAD)" > "$EVIDENCE/SOURCE_SHA.txt"
printf '%s\n' "$(psql -X -At -d postgres -c 'show server_version')" > "$EVIDENCE/POSTGRES_VERSION.txt"
server_major=$(psql -X -At -d postgres -c "select current_setting('server_version_num')::int / 10000")
PG_DUMP_BIN=$(command -v pg_dump)
PG_RESTORE_BIN=$(command -v pg_restore)
client_major=$("$PG_DUMP_BIN" --version | sed -nE 's/.*PostgreSQL\\) ([0-9]+).*/\\1/p')
if (( client_major < server_major )); then
  candidate="/usr/lib/postgresql/$server_major/bin"
  if [[ -x "$candidate/pg_dump" && -x "$candidate/pg_restore" ]]; then
    PG_DUMP_BIN="$candidate/pg_dump"
    PG_RESTORE_BIN="$candidate/pg_restore"
    client_major=$("$PG_DUMP_BIN" --version | sed -nE 's/.*PostgreSQL\\) ([0-9]+).*/\\1/p')
  fi
fi
if (( client_major < server_major )); then
  echo "refusing incompatible PostgreSQL backup client: server_major=$server_major pg_dump=$($PG_DUMP_BIN --version)" >&2
  exit 2
fi
printf '%s\n' "$($PG_DUMP_BIN --version)" > "$EVIDENCE/PG_DUMP_VERSION.txt"
printf '%s\n' "$($PG_RESTORE_BIN --version)" > "$EVIDENCE/PG_RESTORE_VERSION.txt"
redis-server --version > "$EVIDENCE/REDIS_VERSION.txt"

# Safe, synthetic object bytes. No customer data is read or copied.
printf '%s' $'%PDF-1.4\nC14-P16 synthetic restore drill only\n%%EOF\n' > "$WORK/source-storage/reports/owner-a/report-a.pdf"
printf '{"owner":"B","kind":"synthetic-storage-control"}\n' > "$WORK/source-storage/reports/owner-b/report-b.json"
storage_a_sha=$(sha256sum "$WORK/source-storage/reports/owner-a/report-a.pdf" | awk '{print $1}')
storage_b_sha=$(sha256sum "$WORK/source-storage/reports/owner-b/report-b.json" | awk '{print $1}')
storage_a_size=$(stat -c %s "$WORK/source-storage/reports/owner-a/report-a.pdf")
storage_b_size=$(stat -c %s "$WORK/source-storage/reports/owner-b/report-b.json")

# Configuration backup is deliberately secret-free: tracked config + migration source only.
cp .env.example "$WORK/source-config/env.example"
cp vercel.json "$WORK/source-config/vercel.json"
cp package.json "$WORK/source-config/package.json"
cp package-lock.json "$WORK/source-config/package-lock.json"
cp config/pass36/a99-backup-restore-rollback-provider-loss-policy.json "$WORK/source-config/a99-policy.json"
mkdir -p "$WORK/source-config/supabase-migrations"
find supabase/migrations -maxdepth 1 -type f -print0 | sort -z | xargs -0 -r -I{} cp '{}' "$WORK/source-config/supabase-migrations/"
repo_migration_sql_count=$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')

# Cluster roles are isolated CI roles. The production runbook treats credentials/secrets out-of-band.
psql -X -v ON_ERROR_STOP=1 -d postgres <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='c14_p16_authenticated') THEN CREATE ROLE c14_p16_authenticated NOLOGIN; END IF;
END $$;
SQL

dropdb --if-exists c14_p16_source
dropdb --if-exists c14_p16_restore
createdb c14_p16_source
psql -X -v ON_ERROR_STOP=1 -d c14_p16_source \
  -v storage_a_sha="$storage_a_sha" -v storage_a_size="$storage_a_size" \
  -v storage_b_sha="$storage_b_sha" -v storage_b_size="$storage_b_size" \
  -f scripts/c14/p16/fixture.sql

# Baseline ownership checks before backup.
psql -X -v ON_ERROR_STOP=1 -d c14_p16_source -f scripts/c14/p16/verify_restore.sql >/dev/null

# Real logical DB backup. This snapshot cutoff is explicit.
backup_cutoff_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"$PG_DUMP_BIN" -Fc --no-owner -d c14_p16_source -f "$WORK/db.dump"

# Separate Storage and configuration backups. Supabase DB backups do not contain Storage object bytes.
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$WORK/source-storage" -czf "$WORK/storage.tar.gz" .
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$WORK/source-config" -czf "$WORK/config.tar.gz" .

# Real isolated Redis with RDB snapshot. Preserve security-relevant limit state across restore.
redis_src="$WORK/redis-source"; redis_dst="$WORK/redis-restore"; mkdir -p "$redis_src" "$redis_dst"
redis_password=$(openssl rand -hex 32)
cat > "$redis_src/redis.conf" <<EOF
bind 127.0.0.1
port $PORT
protected-mode yes
requirepass $redis_password
dir $redis_src
dbfilename dump.rdb
appendonly no
save ""
EOF
redis-server "$redis_src/redis.conf" > "$WORK/redis-source.log" 2>&1 & REDIS_PID=$!
for _ in $(seq 1 80); do REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" ping >/dev/null 2>&1 && break; sleep 0.1; done
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" ping | grep -qx PONG
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" HSET 'c14:p16:limit:owner-a' used 7 limit 10 >/dev/null
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" PEXPIRE 'c14:p16:limit:owner-a' 3600000 >/dev/null
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" SET 'c14:p16:idempotency:report-a' committed PX 3600000 >/dev/null
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" SAVE | grep -qx OK
cp "$redis_src/dump.rdb" "$WORK/redis.rdb"

# Encrypt all backup payloads. The drill key remains ephemeral and is never uploaded or committed.
openssl rand 48 > "$WORK/backup.key"
for name in db.dump storage.tar.gz config.tar.gz redis.rdb; do
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$WORK/$name" -out "$WORK/backup/$name.enc" -pass file:"$WORK/backup.key"
  rm -f "$WORK/$name"
done
python3 scripts/c14/p16/manifest.py write --root "$WORK/backup" --manifest "$WORK/backup/manifest.json" \
  db.dump.enc storage.tar.gz.enc config.tar.gz.enc redis.rdb.enc
cp "$WORK/backup/manifest.json" "$EVIDENCE/BACKUP_MANIFEST.json"

# Post-cutoff writes prove the recovery boundary: these MUST NOT appear after restore.
psql -X -v ON_ERROR_STOP=1 -d c14_p16_source -c "insert into velmere_c14_p16.event_log values (2,'post_backup_must_not_restore',statement_timestamp())"
printf 'POST-CUTOFF STORAGE OBJECT - MUST NOT RESTORE\n' > "$WORK/source-storage/post-cutoff.txt"
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" SET 'c14:p16:post-cutoff' must-not-restore >/dev/null

# Simulated failure/deletion in the disposable environment.
kill "$REDIS_PID"; wait "$REDIS_PID" 2>/dev/null || true; REDIS_PID=''
dropdb c14_p16_source
rm -rf "$WORK/source-storage" "$WORK/source-config" "$redis_src"

# Manifest check must happen before decryption/restore.
python3 scripts/c14/p16/manifest.py verify --root "$WORK/backup" --manifest "$WORK/backup/manifest.json" >/dev/null
for name in db.dump storage.tar.gz config.tar.gz redis.rdb; do
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$WORK/backup/$name.enc" -out "$WORK/restore/$name" -pass file:"$WORK/backup.key"
done

# PostgreSQL restore + integrity/RLS/ownership/limits/report consistency.
restore_start=$(date +%s%3N)
createdb c14_p16_restore
"$PG_RESTORE_BIN" --exit-on-error --no-owner -d c14_p16_restore "$WORK/restore/db.dump"
psql -X -v ON_ERROR_STOP=1 -d c14_p16_restore -f scripts/c14/p16/verify_restore.sql > "$EVIDENCE/POSTGRES_VERIFY.log"
restore_end=$(date +%s%3N); restore_rto_ms=$((restore_end-restore_start))

# Storage restore + object/database digest parity.
storage_start=$(date +%s%3N)
mkdir -p "$WORK/restored-storage"
tar -xzf "$WORK/restore/storage.tar.gz" -C "$WORK/restored-storage"
test ! -e "$WORK/restored-storage/post-cutoff.txt"
test "$(sha256sum "$WORK/restored-storage/reports/owner-a/report-a.pdf" | awk '{print $1}')" = "$storage_a_sha"
test "$(sha256sum "$WORK/restored-storage/reports/owner-b/report-b.json" | awk '{print $1}')" = "$storage_b_sha"
db_storage_sha=$(psql -X -At -d c14_p16_restore -c "select sha256 from velmere_c14_p16.storage_objects where object_path='reports/owner-a/report-a.pdf'")
test "$db_storage_sha" = "$storage_a_sha"
storage_end=$(date +%s%3N); storage_rto_ms=$((storage_end-storage_start))

# Configuration restore: exact files only; secrets are intentionally not part of this archive.
mkdir -p "$WORK/restored-config"
tar -xzf "$WORK/restore/config.tar.gz" -C "$WORK/restored-config"
cmp -s .env.example "$WORK/restored-config/env.example"
cmp -s vercel.json "$WORK/restored-config/vercel.json"
cmp -s package.json "$WORK/restored-config/package.json"
cmp -s package-lock.json "$WORK/restored-config/package-lock.json"
cmp -s config/pass36/a99-backup-restore-rollback-provider-loss-policy.json "$WORK/restored-config/a99-policy.json"

# Redis RDB restore to a fresh process/dir; post-cutoff key must be absent.
cp "$WORK/restore/redis.rdb" "$redis_dst/dump.rdb"
cat > "$redis_dst/redis.conf" <<EOF
bind 127.0.0.1
port $PORT
protected-mode yes
requirepass $redis_password
dir $redis_dst
dbfilename dump.rdb
appendonly no
save ""
EOF
redis_start=$(date +%s%3N)
redis-server "$redis_dst/redis.conf" > "$WORK/redis-restore.log" 2>&1 & REDIS_PID=$!
for _ in $(seq 1 80); do REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" ping >/dev/null 2>&1 && break; sleep 0.1; done
REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" ping | grep -qx PONG
test "$(REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" HGET 'c14:p16:limit:owner-a' used)" = 7
test "$(REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" HGET 'c14:p16:limit:owner-a' limit)" = 10
test "$(REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" GET 'c14:p16:idempotency:report-a')" = committed
test "$(REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" EXISTS 'c14:p16:post-cutoff')" = 0
redis_pttl=$(REDISCLI_AUTH="$redis_password" redis-cli -p "$PORT" PTTL 'c14:p16:limit:owner-a')
test "$redis_pttl" -gt 0
redis_end=$(date +%s%3N); redis_rto_ms=$((redis_end-redis_start))

# Evidence contains measurements from this CI drill only, never claims production RPO/RTO.
python3 - "$EVIDENCE/RESULT.json" "$backup_cutoff_utc" "$restore_rto_ms" "$storage_rto_ms" "$redis_rto_ms" "$redis_pttl" "$repo_migration_sql_count" "$(git rev-parse HEAD)" <<'PY'
import json, pathlib, sys, datetime
out,cutoff,pg_rto,storage_rto,redis_rto,redis_pttl,mig_count,sha=sys.argv[1:]
payload={
  'schemaVersion':'velmere.c14-p16.isolated-restore-drill.v1',
  'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'scope':'ISOLATED_SYNTHETIC_CI_ONLY_NO_CUSTOMER_DATA',
  'baseSha':'4cb45bbcf910f0517d4a5d265682cd2f7e4e41df',
  'testedSha':sha,
  'status':'PASS',
  'backupCutoffUtc':cutoff,
  'postgres':{
    'backup':'pg_dump custom format encrypted with ephemeral drill key',
    'restoreTarget':'fresh database',
    'preCutoffRecordsLost':0,
    'postCutoffRecordsRestored':0,
    'rlsOwnershipVerified':True,
    'entitlementOwnershipVerified':True,
    'limitStateVerified':True,
    'reportDigestAndSemanticConsistencyVerified':True,
    'restoreValidationMs':int(pg_rto),
  },
  'storage':{
    'backup':'separate encrypted object archive',
    'databaseBackupIncludesObjectBytes':False,
    'preCutoffObjectsLost':0,
    'postCutoffObjectsRestored':0,
    'databaseObjectDigestParityVerified':True,
    'restoreValidationMs':int(storage_rto),
  },
  'redis':{
    'backup':'RDB snapshot encrypted with ephemeral drill key',
    'preCutoffKeysLost':0,
    'postCutoffKeysRestored':0,
    'securityLimitStateVerified':True,
    'idempotencyStateVerified':True,
    'restoredLimitPttlMs':int(redis_pttl),
    'restoreValidationMs':int(redis_rto),
  },
  'configuration':{
    'trackedConfigRestored':True,
    'secretsIncluded':False,
    'repoMigrationSqlFiles':int(mig_count),
  },
  'rpoRtoBoundary':{
    'productionRpoMeasured':False,
    'productionRtoMeasured':False,
    'note':'Only isolated CI restore/validation durations and snapshot cutoff semantics are measured. Do not use them as production SLOs.'
  }
}
pathlib.Path(out).write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n')
PY
cat "$EVIDENCE/RESULT.json"
