#!/usr/bin/env bash
set -euo pipefail
# Existing isolated PostgreSQL cluster required; never bootstrap cloud/customer data.
: "${Q12_DISPOSABLE_ACK:?Set ISOLATED_TEST_ONLY only for a disposable loopback cluster}"
[[ "$Q12_DISPOSABLE_ACK" == ISOLATED_TEST_ONLY && "${PGHOST:-}" == 127.0.0.1 && "${PGUSER:-}" == postgres && "${PGDATABASE:-}" == q12_response_fixture ]]
[[ $# == 1 ]] || { echo 'usage: run-native.sh NEW_EVIDENCE_DIRECTORY' >&2; exit 2; }
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
mkdir "$1"
# createdb fails instead of overwriting any existing fixture.
createdb "$PGDATABASE"
for spec in 'entitlement:c15-q4/entitlement-store.sql' 'effect:c15-q5/effect-store.sql' 'event:c15-q6/event-store.sql' 'watermark:c15-q7/watermark-store.sql' 'terminal_hold:c15-q8/terminal-hold-store.sql'; do
  key=${spec%%:*}; path=${spec#*:}
  { printf "SET velmere.disposable_%s_store='ISOLATED_TEST_ONLY';\n" "$key"; cat "scripts/$path"; } | psql -X -v ON_ERROR_STOP=1 >> "$1/install.log" 2>&1
done
node node_modules/tsx/dist/cli.mjs --test --test-reporter=tap scripts/c15-q12/native-response.test.ts > "$1/tests.log" 2>&1
