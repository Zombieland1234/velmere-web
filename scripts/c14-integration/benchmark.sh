#!/usr/bin/env bash
set -euo pipefail
# A new evidence directory is mandatory; never relabel or overwrite older runs.
OUT="${C14_BENCHMARK_DIR:-/tmp/c14-benchmark}"
if [[ -e "$OUT" ]] && { [[ ! -d "$OUT" ]] || [[ -n "$(find "$OUT" -mindepth 1 -maxdepth 1 -print -quit)" ]]; }; then
  echo 'Benchmark output directory already exists and is not empty.' >&2
  exit 2
fi
BASELINE_SHA="${VELMERE_BENCHMARK_BASELINE_SHA:-e718df06d20a8129ffe261eef9c6c74cc5c91729}"
[[ "$BASELINE_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Exact baseline commit SHA required.' >&2; exit 2; }
[[ "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Exact candidate commit SHA required for this CI entrypoint.' >&2; exit 2; }
[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]] || { echo 'Candidate SHA differs from checkout.' >&2; exit 2; }
git cat-file -e "${BASELINE_SHA}^{commit}"
mkdir -p "$OUT"
exec > >(tee "$OUT/benchmark.log") 2>&1
printf 'candidate=%s\nbaseline=%s\n' "$GITHUB_SHA" "$BASELINE_SHA"
BASE_ROOT="$(mktemp -d /tmp/c14-base.XXXXXX)"
CORPUS_ROOT="$(mktemp -d /tmp/cgt.XXXXXX)"
# Temporary source downloads are not evidence. Keep all logs/manifests in OUT.
trap 'rm -rf "$BASE_ROOT" "$CORPUS_ROOT"' EXIT
npm ci --ignore-scripts --no-fund
git archive "$BASELINE_SHA" | tar -x -C "$BASE_ROOT"
ln -s "$PWD/node_modules" "$BASE_ROOT/node_modules"
git -C "$CORPUS_ROOT" init -q
git -C "$CORPUS_ROOT" remote add origin https://github.com/gsalzer/cgt.git
git -C "$CORPUS_ROOT" config core.sparseCheckout true
printf '/runtime/\n/source/\n/consolidated.csv\n/README.md\n/LICENSE.txt\n' > "$CORPUS_ROOT/.git/info/sparse-checkout"
git -C "$CORPUS_ROOT" fetch --depth=1 --filter=blob:none origin f8cd72cf7fbbfebc809c454667eee271706a4b2b
git -C "$CORPUS_ROOT" checkout --detach FETCH_HEAD
python3 scripts/c10/prepare-cgt.py "$CORPUS_ROOT" "$OUT"
node scripts/c14-integration/run-corpus.mjs "$BASE_ROOT" "$PWD" "$OUT" "$CORPUS_ROOT" "$BASELINE_SHA"
