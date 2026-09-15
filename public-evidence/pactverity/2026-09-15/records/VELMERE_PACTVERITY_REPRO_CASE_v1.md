# PactVerity × Velmère — proposed reproducible case

**Candidate:** public `output-integrity-mismatch` benchmark fixture.

## Frozen source

Repository: `PactVerityHQ/pactverity`  
Observed public main commit: `b34f4f346eb51e88e172616411d8074cf5832cc8`  
Fixture: `benchmark/scenarios.json` → `output-integrity-mismatch`

Published fixture states:
- latency: pass
- uptime: pass
- freshness: pass
- output-integrity: fail
- expected overall outcome: fail

The expected output SHA-256 is `aaaa...aaaa`; the observed SHA-256 is `bbbb...bbbb`.

## Velmère pre-scope result

Velmère independently recomputed the declared mismatch from the pinned public fixture and produced:
- `SUPPORTED`: the pinned fixture contains an output-hash mismatch and declares that check as fail;
- `UNKNOWN`: current live Receipt API behavior for this exact case (not executed in the restricted sandbox);
- `UNKNOWN`: current live receipt verification for this exact case;
- `NOT_COVERED`: independent real-world truth of the underlying latency/uptime/freshness/output measurements.

This deliberately preserves PactVerity's own boundary: digest consistency is not independent truth of the original measurement.

## Proposed final reproduction

Once we agree the exact source revision, run the public benchmark/receipt recipe in an environment with network access, store complete stdout/stderr and receipt bytes, independently recompute digests, then feed those verified evidence items into Velmère Claim Sufficiency.

## Stale / invalidation triggers

- source tree changes;
- `benchmark/scenarios.json` changes;
- benchmark runner changes;
- Receipt API behavior/version changes;
- receipt schema/canonicalization/signature verification rules change.

**Scope boundary:** public, non-sensitive data only; no wallet connection, payment, token purchase or private infrastructure access.
