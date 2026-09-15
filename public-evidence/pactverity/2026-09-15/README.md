# Velmère × PactVerity — bounded public reproducibility pack

This directory contains a **public, non-sensitive, no-charge methodology reproduction** for one PactVerity source fixture. It is not an integration, partnership, certification, security audit, endorsement, or commercial commitment.

## Exact claim

At PactVerity source commit `b34f4f346eb51e88e172616411d8074cf5832cc8`, the public fixture `benchmark/scenarios.json` case `output-integrity-mismatch` evaluates the four source-level predicates as:

1. latency: `410 <= 1000` → pass
2. uptime: `9990 >= 9900` → pass
3. freshness: `14 <= 300` → pass
4. output integrity: `bbbb...bbbb === aaaa...aaaa` → fail

Therefore the source-fixture outcome is `fail`, matching the fixture's declared expected statuses `pass/pass/pass/fail` and expected outcome `fail`.

## What this does NOT establish

- No live PactVerity Receipt API request was made in this reproduction.
- No current live receipt was created or verified.
- The real-world truth of caller-supplied latency, uptime, freshness, or output observations was not independently validated.
- The historical R12A record remains historical recorded output and is not represented as a fresh R12A rerun.

## Pinned upstream source

Repository: `PactVerityHQ/pactverity`  
Commit: `b34f4f346eb51e88e172616411d8074cf5832cc8`  
Fixture Git blob: `596633aeb0eb46b327b007836939b1a582dd935f`  
Upstream runner Git blob: `2ed0bfbfab6a3e8e83b9bd60a2064da8ee2284ef`

The `source/` copies are byte-checked against those Git blob IDs.

## Reproduce the four comparisons

```bash
node verify_predicates.mjs
```

Expected exit code: `0`.

Complete capture is under `run/`: `stdout.json`, `stderr.txt`, `exit-code.txt`, plus the combined `reproduction.json`.

## Three records requested for review

- `records/PACTVERITY_PREDICATE_RECOMPUTATION_v2.json`
- `records/PACTVERITY_PRE_SCOPE_VELMERE_RESULT.json`
- `records/VELMERE_PACTVERITY_REPRO_CASE_v1.md`

Their exact SHA-256 digests are listed in `SHA256SUMS.txt` and `manifest.json`.

## Stale / re-verification triggers

Current applicability should be re-evaluated if any material dependency changes, including the pinned source revision, fixture, runner, Receipt API behavior/version, receipt schema, canonicalization/signature verification rules, or relevant identity/signing basis.
