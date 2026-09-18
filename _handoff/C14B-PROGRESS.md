# C14B: immediate-discard control-flow qualification

Base: e680098a3915264576cdab6bb79ab1e1ca695b11 on c14/integration-final-20260918.
Internal continuation, not an external audit. NO_GO remains in effect.

## Changes

The SWC-104 immediate-CALL-status-discard detector now limits candidates to blocks that may be reached from entry and may reach a successful legacy termination. A discarded result in unreachable code or an exclusively aborting continuation cannot support that specific successful-bookkeeping hypothesis. Unknown JUMP/JUMPI destinations conservatively connect to every legal JUMPDEST through one virtual node. Block-entry stack values and path feasibility remain unknown; resource-budget exhaustion retains all original candidates. No source, address, runtime hash, corpus name or corpus label participates in this decision.

The scope is deliberately limited to this detector. Shared CFG, PUSH4 observations, other detectors, severity and entitlement policy are not changed. A heuristic candidate is not a proved exploit. Instructions are interpreted in the declared legacy Cancun control-flow model, not EOF or delegated code. Engine snapshot identity changes to Velmère-V2.5.1 so different analysis versions do not share a content snapshot.

## Local history before CI

New behavior-only fixtures on the original detector: 7/17 pass, 10/17 mismatches. These are structural negative-classification examples, not ten remotely exploitable vulnerabilities. Candidate focused run: 40/40, consisting of 30 new tests and 10 existing P28 tests. Strict semantic TypeScript of the changed engine/test dependency graph passed locally with TypeScript 5.8.3, Node 22.16.0. Local execution used an explicit TypeScript loader; that is not a production build. An initial additional test-harness failure serialized a BigInt; fixed by structuredClone/deep comparison. Original failed logs are retained in the private handoff, not relabelled as product bugs.

## Required fresh qualification

The existing CI runs all admitted regressions, install scripts, strict checks, lint, production build, isolated Basic, PostgreSQL and Redis/restore checks. Their results must be read for this exact new SHA before claiming them. The benchmark is now pinned to prior C14 e680 as BASELINE; the frozen external corpus and labels are unchanged. This is an already-seen regression corpus. GENERALIZATION UNVERIFIED. No claims about improved aggregate metrics are made before measurement.

No main/C13 merge, production mutation, customer data, real payments, provider grants or outbound partner messages. The prior C14 source and evidence remain historical records.

References: EIP-140 (REVERT rollback); Solidity control-structures documentation (low-level call result semantics). No chain transactions are executed by these fixtures or the offline corpus benchmark.
