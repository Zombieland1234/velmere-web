#!/usr/bin/env bash
set -euo pipefail
mkdir -p /tmp/c9-benchmark /tmp/c9-base /tmp/cgt
exec > >(tee /tmp/c9-benchmark/benchmark.log) 2>&1
printf 'candidate=%s\n' "$GITHUB_SHA"
npm ci --ignore-scripts --no-fund
# Offline comparison uses exact C8 tree, and never executes the corpus contracts.
git archive 0609ef1c5aeecfab6de3ada8144efaa089064c71 | tar -x -C /tmp/c9-base
ln -s "$PWD/node_modules" /tmp/c9-base/node_modules
git -C /tmp/cgt init -q
git -C /tmp/cgt remote add origin https://github.com/gsalzer/cgt.git
git -C /tmp/cgt config core.sparseCheckout true
printf '/runtime/\n/source/\n/consolidated.csv\n/README.md\n/LICENSE.txt\n' > /tmp/cgt/.git/info/sparse-checkout
git -C /tmp/cgt fetch --depth=1 --filter=blob:none origin f8cd72cf7fbbfebc809c454667eee271706a4b2b
git -C /tmp/cgt checkout --detach FETCH_HEAD
python3 scripts/c9/prepare-cgt.py /tmp/cgt /tmp/c9-benchmark
node scripts/c9/run-corpus.mjs /tmp/c9-base "$PWD" /tmp/c9-benchmark
