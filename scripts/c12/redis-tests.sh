#!/usr/bin/env bash
set -euo pipefail
# This process starts a private test instance, not the user's Redis service.
dir=$(mktemp -d)
cleanup() { if [ -n "${server:-}" ]; then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi; rm -rf "$dir"; }
trap cleanup EXIT
password=$(openssl rand -hex 32)
printf 'bind 127.0.0.1\nport 16380\nprotected-mode yes\nrequirepass %s\ndir %s\nsave ""\n' "$password" "$dir" > "$dir/redis.conf"
chmod 600 "$dir/redis.conf"
redis-server "$dir/redis.conf" > "$dir/redis.log" 2>&1 & server=$!
for i in $(seq 1 30); do if REDISCLI_AUTH="$password" redis-cli -p 16380 ping >/dev/null 2>&1; then break; fi; sleep 0.1; done
C12_TEST_REDIS_URL="redis://:$password@127.0.0.1:16380" node_modules/.bin/tsx --test scripts/c12/redis-integration.test.ts
