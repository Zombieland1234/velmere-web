#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/c14-benchmark /tmp/c14-base /tmp/cgt
exec > >(tee /tmp/c14-benchmark/benchmark.log) 2>&1
printf 'candidate=%s\n' "$GITHUB_SHA"
npm ci --ignore-scripts --no-fund
# Offline comparison uses exact previously qualified C14 tree (C14B comparison), and never executes the corpus contracts.
git archive e680098a3915264576cdab6bb79ab1e1ca695b11 | tar -x -C /tmp/c14-base
ln -s "$PWD/node_modules" /tmp/c14-base/node_modules
git -C /tmp/cgt init -q
git -C /tmp/cgt remote add origin https://github.com/gsalzer/cgt.git
git -C /tmp/cgt config core.sparseCheckout true
printf '/runtime/\n/source/\n/consolidated.csv\n/README.md\n/LICENSE.txt\n' > /tmp/cgt/.git/info/sparse-checkout
git -C /tmp/cgt fetch --depth=1 --filter=blob:none origin f8cd72cf7fbbfebc809c454667eee271706a4b2b
git -C /tmp/cgt checkout --detach FETCH_HEAD
python3 scripts/c10/prepare-cgt.py /tmp/cgt /tmp/c14-benchmark
node scripts/c14-integration/run-corpus.mjs /tmp/c14-base "$PWD" /tmp/c14-benchmark
