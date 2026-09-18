# C15 exact-source qualification handoff

Internal integrator review, not an external independent audit. Release verdict remains NO_GO until every required gate has admissible evidence.

## Frozen base and reviewed import

Canonical ancestor: C13 `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.
Immediate qualified base: C14B `e718df06d20a8129ffe261eef9c6c74cc5c91729`.
Branch: `c15/call-status-qualification-20260918`, created from that exact base. No main/C13/C14 update.
Reviewed C15 import tree: `7dfc452e84bb77a73ecf55f3de27b60720dc0cf1`, byte-identical to the previous local C15 source identity including the declared original font blob IDs. Engine version 2.5.2.

The detector recognizes unused CALL-family status before STOP or code falloff in addition to immediate POP. It preserves C14B conservative control-flow qualification, shared CFG/PUSH4, severity, auth, provider policy and UI. No network target is attacked or executed by the synthetic instruction fixtures or corpus classification.

## Local review and preserved failures

The original local export lacked font resources: 422 registered cases passed, 10 test files failed to load, and 132 baseline cases did not register. Those results are not 554/554. In this resumed review, the first focused attempt was 107/110 because the production worker bundle had not yet been built; after the actual worker build the unchanged tests passed 110/110. Logs remain in the delivery history; this was a build-order precondition, not three product vulnerabilities.

There are 70 new C15 test cases. The expected full registered suite is 484 inherited cases plus 70 new cases, 554 total. Only the fresh full-checkout TAP may establish the achieved count. Focused repetitions, 32 compiler cases, 128 authored development variants, SQL checks and E2E checkpoints must not be summed as unique regression cases or vulnerabilities.

## Fresh CI contract

Core: npm ci with install scripts; worker bundle; all registered tests; compiler ORIGIN matrix; Python triage tests; strict application and extended test configurations; lint coverage; zero-warning ESLint; production build. No test or warning threshold is relaxed.

Runtime: real temporary Redis; production Next.js Basic HTTP/JSON/PDF/browser flow; PostgreSQL synthetic identity tests; interlocked isolated restore. TEST identities only; no production mutation or real charge.

Benchmark: unchanged frozen CGT selection at `f8cd72cf7fbbfebc809c454667eee271706a4b2b`, exact C14B baseline and exact CI candidate. Corpus contracts are statically analyzed, not executed. The known corpus is not a blind holdout: GENERALIZATION UNVERIFIED. Baseline and candidate metadata must not be rewritten after execution.

Compiler CALL and development matrices run separately against archived exact C14B. They carry the candidate GITHUB_SHA, and are development evidence, not blind validation.

## Remaining release gates

Real Auth A/B lifecycle, Stripe TEST checkout/webhook/grant/refund/revoke, all paid products, global provider enforcement, privacy/erasure, production disaster recovery, warning-free lint, full secret-history/environment review, engine generalization and independent external validation remain open. Running this workflow does not imply these gates passed.

The export excludes the two declared font resources. A reduced downloadable ZIP is not the complete checkout used for build, and does not include Git history. No font bytes, secrets, private correspondence or production credentials are added by this handoff.
