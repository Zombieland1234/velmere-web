#!/usr/bin/env bash
# Run against a reviewed operator connection only. No secrets in CLI arguments.
# Output is a pseudonymous internal diagnostic, not a public release certificate.
set -euo pipefail
umask 077
: "${VELMERE_READONLY_RECONCILIATION_ACK:?set to INTERNAL_READONLY_REVIEW}"
[[ "$VELMERE_READONLY_RECONCILIATION_ACK" == INTERNAL_READONLY_REVIEW ]] || exit 2
command -v psql >/dev/null || { echo 'psql unavailable' >&2; exit 2; }
[[ $# == 1 ]] || { echo 'usage: read-reconciliation.sh new-output.json' >&2; exit 2; }
# noclobber also rejects existing output; errors never masquerade as an empty DB.
set -o noclobber
sql="$(cd "$(dirname "$0")" && pwd)/reconcile.sql"
{ printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout=\x275s\x27;\nSET LOCAL lock_timeout=\x271s\x27;\n';
  cat "$sql"; printf '\nROLLBACK;\n'; } |
  PGAPPNAME=velmere-readonly-reconciliation PGCONNECT_TIMEOUT=5 psql -w -X -q -A -t -v ON_ERROR_STOP=1 > "$1"
# No automatic repair. A partial or empty file after an error is NOT a result.
