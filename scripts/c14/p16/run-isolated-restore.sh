#!/usr/bin/env bash
set -euo pipefail
if [[ "${C14_DISPOSABLE_RESTORE_ACK:-}" != "ISOLATED_CI_ONLY" || "${PGHOST:-}" != "localhost" || "${PGDATABASE:-}" != "c14_fixture" ]]; then
  echo "REFUSED: requires acknowledged localhost c14_fixture disposable cluster" >&2
  exit 2
fi
exec bash scripts/c14/p16/run-isolated-restore.internal.sh
