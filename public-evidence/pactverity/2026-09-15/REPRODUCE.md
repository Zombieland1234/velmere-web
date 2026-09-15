# PactVerity predicate reproduction — exact command and capture

This is the transparent reproduction record requested by PactVerity for the four source-fixture comparisons. It does **not** execute the live Receipt API and does not claim live receipt creation or verification.

## Pinned upstream source

- Repository: `PactVerityHQ/pactverity`
- Commit: `b34f4f346eb51e88e172616411d8074cf5832cc8`
- Fixture: `benchmark/scenarios.json`
- Fixture Git blob: `596633aeb0eb46b327b007836939b1a582dd935f`
- Fixture SHA-256: `00511eb9ac8283550489e120036a1ce24d23b2a049da183df06cc425d9d19e9d`
- Upstream runner: `benchmark/run.mjs`
- Upstream runner Git blob: `2ed0bfbfab6a3e8e83b9bd60a2064da8ee2284ef`

## Exact command

```bash
node verify_predicates.mjs
```

The script is published alongside this file as `verify_predicates.mjs`. It reads the byte-identical pinned fixture copy in `source/scenarios.json`.

## Four comparisons

```text
latency:          measuredLatencyMs <= maxLatencyMs          410 <= 1000       => pass
uptime:           uptimeBps >= minUptimeBps                  9990 >= 9900       => pass
freshness:        freshnessSeconds <= maxFreshnessSeconds    14 <= 300          => pass
output_integrity: observedOutputSha256 === expectedOutputSha256
                  bbbb...bbbb === aaaa...aaaa                                   => fail
```

Actual statuses: `pass/pass/pass/fail`  
Expected statuses: `pass/pass/pass/fail`  
Actual overall: `fail`  
Expected overall: `fail`

## Environment

- Node: `v22.16.0`
- npm: `10.9.2`
- Platform: Linux x64
- Kernel capture: `Linux localhost 6.18.44 #1 SMP Sat Sep 12 15:35:21 UTC 2026 x86_64 GNU/Linux`

## Complete stdout

```json
{
  "schema": "velmere.pactverity.predicate-reproduction.v1",
  "source": {
    "repository": "PactVerityHQ/pactverity",
    "commit": "b34f4f346eb51e88e172616411d8074cf5832cc8",
    "file": "benchmark/scenarios.json",
    "gitBlobSha": "596633aeb0eb46b327b007836939b1a582dd935f",
    "sha256": "00511eb9ac8283550489e120036a1ce24d23b2a049da183df06cc425d9d19e9d"
  },
  "scenario": "output-integrity-mismatch",
  "environment": {
    "node": "v22.16.0",
    "platform": "linux",
    "arch": "x64",
    "osRelease": "6.18.44"
  },
  "comparisons": {
    "latency": {
      "expression": "measuredLatencyMs <= maxLatencyMs",
      "values": [410, 1000],
      "result": true
    },
    "uptime": {
      "expression": "uptimeBps >= minUptimeBps",
      "values": [9990, 9900],
      "result": true
    },
    "freshness": {
      "expression": "freshnessSeconds <= maxFreshnessSeconds",
      "values": [14, 300],
      "result": true
    },
    "output_integrity": {
      "expression": "observedOutputSha256 === expectedOutputSha256",
      "values": [
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      ],
      "result": false
    }
  },
  "actualStatuses": ["pass", "pass", "pass", "fail"],
  "expectedStatuses": ["pass", "pass", "pass", "fail"],
  "overall": "fail",
  "expectedOutcome": "fail",
  "matchedExpectedStatuses": true,
  "matchedExpectedOutcome": true,
  "scope": {
    "liveReceiptApiExecuted": false,
    "liveReceiptCreated": false,
    "liveReceiptVerified": false,
    "originalMeasurementsIndependentlyValidated": false
  }
}
```

## Complete stderr

Empty (`0` bytes).

## Exit code

`0`

## Scope exclusions / historical status

- No live PactVerity Receipt API call is represented here.
- No live receipt was created or verified.
- Caller-supplied latency, uptime, freshness and output observations were not independently established as real-world truth.
- `PACTVERITY_PRE_SCOPE_VELMERE_RESULT.json` is a **historical R12A recorded output**. This reproduction does not claim a fresh R12A rerun.
- The old `tree` field in that historical record denotes the pinned source reference and must not be interpreted as proof of a source-to-deployment binding.
- No wallet connection, PVTY purchase, private infrastructure access, partnership, integration, certification, endorsement, audit or commercial commitment is implied.
