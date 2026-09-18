# C15-Q3 — selective measurement-gate review

Internal review, not external audit. NO_GO. This record supplements C15-Q3-INTEGRATION.md; its first-run measurements remain historical and are not relabelled as the final commit.

## Candidate and decision

Candidate `c15/qualification-q2-20260918` at `3230256cce4b0408138f4fdabf32fdb49eef1ff8` contains a measurement-completeness gate. Its source ancestry imports the earlier local Q1, not the local payment-Q2 admitted on the Q3 branch. Therefore the candidate branch was NOT used as a base or blindly merged.

Decision: ACCEPT_WITH_CHANGES, selective integration only. The gate helper (blob 7f24ceb07e6f0a514381ce992ca7da45701a9c32), 14 unit tests (blob d86c23bc0714a72bd7354561eaed57bcd65f6c35) and matching run-corpus glue (blob 500843e3a800504f6fec1fedb93dce515f4d119e) are accepted unchanged after review. The accepted-test manifest preserves all current Q2 receipt, binding and handler tests and adds the candidate tests plus three new integrator actual-runner controls. No engine, auth, billing, RLS, provider policy, UI or accuracy thresholds changed.

## Independent internal reproduction

The integrator invoked the real current run-corpus CLI, its actual worker script and input-integrity loader with two inert authored byte sequences and explicitly controlled analyzers. A stable control returned exit 0, a baseline throwing twice incorrectly returned exit 0, and a deliberately unstable repeat incorrectly returned exit 0. Result before: 1/3 expected outcomes; two mismatches. Original logs are retained in the owner evidence pack, not overwritten.

After integrating the gate, the same CLI controls returned 0, 1 and 1 respectively. The failing-baseline receipt reports BASELINE_INCOMPLETE and BASELINE_ASSESSMENTS_INCOMPLETE; the unstable receipt reports STABILITY_MISMATCH. All three controls pass and the 14 candidate unit tests pass: 17/17. Focused ESLint passed with zero errors/warnings. These are synthetic instrument controls, NOT three product benchmarks or contract exploits. Baseline/candidate source identifiers within these controls are fixture identifiers, not new project commits.

The defect is one measurement-gate family with two demonstrated failure modes, not 17 vulnerabilities. A complete but inaccurate measurement can still pass this gate; detectorQualityQualified, generalizationVerified and releaseApproved remain false. Existing release requirements are unchanged.

## Final qualification required

Registered expected count is now 653 (636 existing Q2 + 14 candidate + 3 integrator), across 45 test files. This is an expectation until the exact final SHA's TAP confirms it. Focused repeats are not added twice. All CI jobs must re-run on the final source, including the complete pinned CGT corpus, the 25-case stability repeat, production Basic, Redis, isolated PostgreSQL/restore and redacted secret scans.

The final CGT artifact must contain MEASUREMENT_GATE.json. A PASS attests complete baseline/candidate and the declared stable subset only; previously seen labels and source/runtime association remain limitations. No change to the R16 denominator or any claim of external independence is made.
