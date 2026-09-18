# C14-P28 — Engine Effectiveness

## Status

- Branch: `parallel/c14-p28-engine-effectiveness`
- Base: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Engine-qualified SHA: `10d8f369e56600dfc35538a9af68d8574b8bab43`
- Qualification workflow: GitHub Actions run `35293227298`
- Evidence artifact: `c14-p28-engine-35293227298`, artifact ID `10526298570`
- Artifact digest: `sha256:c86d29dac75c711175a73db57cfdbb05df9c3e3f4d72f780c6dc865b5ed7ba90`
- Frozen corpus: CGT `f8cd72cf7fbbfebc809c454667eee271706a4b2b`
- Unique runtime bytecodes: 2472
- Contract-class assessment pairs: 11216
- Errors/timeouts: 0/0
- Stability rerun: 25/25 stable
- Merge performed: NO

C13's corpus is a regression replay, not an independent holdout. All 2472 runtimes had already been observed before C14-P28. Therefore the result below is evidence of improvement on the frozen historical corpus, not final evidence of generalization.

## Executive result

| Metric | C13 baseline | C14-P28 | Delta |
|---|---:|---:|---:|
| TP | 172 | 350 | **+178** |
| TN | 7538 | 7594 | **+56** |
| FP | 870 | 814 | **-56** |
| FN | 2636 | 2458 | **-178** |
| Precision | 16.51% | 30.07% | **+13.56 pp** |
| Recall | 6.13% | 12.46% | **+6.34 pp** |
| F1 | 8.94% | 17.62% | **+8.69 pp** |
| Specificity | 89.65% | 90.32% | **+0.67 pp** |
| Accuracy over assessment pairs | 68.74% | 70.83% | **+2.09 pp** |

Previously-seen development slice:
- C13: TP 88 / TN 3751 / FP 417 / FN 1284
- C14-P28: TP 171 / TN 3778 / FP 390 / FN 1201

Previously-seen validation slice:
- C13: TP 84 / TN 3787 / FP 453 / FN 1352
- C14-P28: TP 179 / TN 3816 / FP 424 / FN 1257

The direction of change is consistent on both historical slices, but neither slice is an unseen holdout.

## Root causes found

### 1. SWC-107 was structurally over-broad

The classic bytecode reentrancy detector promoted a represented `CALL -> reachable SSTORE` ordering to SWC-107 without proving:
- a shared state dependency,
- a controllable/re-entrant call target,
- sufficient forwarded gas,
- path feasibility,
- function boundary,
- or a runtime mutex.

This explains the very high C13 SWC-107 false-positive count. In particular, old Solidity contracts using `.send()`/stipend-style calls were being treated like unrestricted callbacks.

Change:
- fixed/bounded 2300-gas calls are no longer promoted to SWC-107,
- a represented pre-call storage read is required for the strong SWC-107 path,
- weak `CALL -> SSTORE` orderings are preserved as `VLM-SEC-EXTERNAL-CALL-POST-WRITE-REVIEW-01` review candidates rather than deleted,
- read-only and callback selector-only hypotheses no longer inherit SWC-107 merely from selector presence.

Effect on frozen benchmark:
- SWC-107 TP: 53 -> 53
- SWC-107 FP: 531 -> 431
- SWC-107 FN: 35 -> 35
- precision: 9.1% -> 11.0%
- recall: 60.2% -> 60.2%

So 100 benchmark FPs were removed without losing a benchmark TP in SWC-107.

### 2. SWC-104 mixed two different semantics

The ERC/non-standard-token detector mapped "transfer signature appears not to return bool" to SWC-104. That is an interface-compatibility observation, not evidence that the caller ignored a low-level call return value.

Change:
- ERC missing/non-standard return keeps its compatibility/CWE evidence but no longer claims SWC-104.
- Added a source-independent bytecode detector for the high-specificity pattern `CALL/CALLCODE/DELEGATECALL -> POP`, i.e. immediate discard of the EVM success word.
- Improved structured-source recognition of checked low-level calls and checked `.send()` patterns.

Effect on frozen benchmark:
- SWC-104 TP: 79 -> 258 (**+179**)
- SWC-104 FP: 303 -> 347 (**+44**)
- SWC-104 FN: 225 -> 46 (**-179**)
- precision: 20.7% -> 42.6%
- recall: 26.0% -> 84.9%

The raw benchmark FP count increases for SWC-104, but precision more than doubles because the TP increase is much larger. CGT labels are per contributed property, so a direct bytecode `CALL -> POP` proof can also disagree with a dataset's narrower "unchecked send" label; these benchmark FPs must not automatically be interpreted as proven semantic false findings.

### 3. PUSH4 constants were treated as function selectors

The CFG engine comment described `PUSH4 -> EQ -> JUMPI` dispatcher recognition, but the implementation admitted every `PUSH4` constant as a selector.

Change:
- selector admission now requires actual local comparison/conditional-dispatch evidence (`EQ` followed by `JUMPI`).

This removes magic constants/hashes from selector-driven proxy/ERC/security rules.

Observed benchmark regression:
- SWC-112 TP: 2 -> 1; FP stays 0.

The lost case is CGT `KnowledgeProxy`, labeled by ContractFuzzer as `delegatecall_dangerous`. The old Velmère TP was produced by the unrelated finding `VLM-SEC-AUTH-UNINITIALIZED-LOGIC-04`: literal `0x8129fc1c` appears inside the upgrade path as calldata for `initialize()`, not as a dispatcher selector on `KnowledgeProxy`. The source contains an `initialize` function in another contract in the same file. Restoring this TP by again treating an arbitrary PUSH4 as a selector would knowingly reintroduce a semantic error, so C14-P28 leaves the benchmark regression visible.

### 4. Major classes have no effective detector coverage

The largest C13 FN pools remain structural coverage gaps, not threshold problems:

- SWC-101: 593 FN, 0 TP
- SWC-103: 461 FN, 0 TP
- SWC-114: 402 FN, 0 TP
- SWC-113: 256 FN, 0 TP
- SWC-120: 253 FN, 16 TP
- SWC-116: 121 FN, 0 TP

C14-P28 deliberately did not manufacture broad mappings to these classes from weak opcode correlations. For example, arithmetic opcodes occur in 100% of SWC-101 positives but also 87.4% of negatives, so "ADD/SUB/MUL exists" is not an acceptable overflow detector. SWC-103 also cannot be authenticated from an unverified pragma string alone.

## Opcode/control-flow diagnostics

On the frozen corpus:

- SWC-104 `CALL -> POP` presence: 70.4% positive vs 26.7% negative.
- SWC-107 CALL presence: 100.0% positive vs 83.4% negative.
- SWC-107 CALL-before-later-SSTORE: 84.1% positive vs 71.8% negative; therefore ordering alone has weak discrimination.
- SWC-107 nearby 2300 stipend: 10.2% positive vs 13.7% negative; stipend presence is not evidence of an unrestricted callback.
- SWC-113 nearby 2300 stipend: 38.7% positive vs 7.0% negative. This is a promising diagnostic signal, but C14-P28 does not turn it into an SWC-113 rule without failure/path semantics.
- SWC-120 BLOCKHASH: 27.5% positive vs 5.7% negative.
- SWC-120 NUMBER: 77.3% positive vs 9.2% negative.
- SWC-115 ORIGIN: 95.2% positive vs 6.8% negative.

These are analysis observations only; none are benchmark-name/address/hash hardcodes.

## Proxies, libraries, compiler/source observations

Source:
- source selected for 2322/2472 runtimes (93.9%),
- no selected source for 150/2472,
- every selected source/runtime relation is marked `CGT_ASSOCIATION_NOT_RECOMPILED_OR_VERIFIED`.

Therefore source is not allowed to suppress an independent runtime finding merely because the text appears safe.

Compiler observations are pragma-text only, NOT authenticated compiler versions:
- pre-0.5 pragma family: 1679 sources
- 0.5.x: 31
- 0.6.x: 129
- unknown/no parseable pragma: 483
- floating/ranged pragma: 1577

The corpus is therefore dominated by older Solidity patterns, but exact deployed compiler identity is not proven by this benchmark package.

Proxy/runtime observations:
- DELEGATECALL present in 148 runtimes,
- simple ERC-1167 minimal-proxy pattern: 0,
- EIP-1967 implementation-slot literal: 0.

Library/source observations:
- 614 selected sources declare at least one `library`,
- 572 use a `using ... for ...` form.

These are structural counts only. Linked/inlined library semantics are not reconstructed into a complete interprocedural model in C14-P28.

## Tests added

`scripts/c14/p28-engine-effectiveness.test.ts` contains minimal positive/negative/cross-class checks for:
- unrestricted-call reentrancy candidate positive,
- 2300-gas call negative for SWC-107,
- post-call write with no represented pre-call state read negative for SWC-107,
- `CALL -> POP` positive for SWC-104,
- checked CALL result negative for SWC-104,
- real `PUSH4/EQ/JUMPI` selector positive,
- arbitrary PUSH4 negative,
- ERC no-bool compatibility finding negative for SWC-104 taxonomy,
- checked send source negative,
- discarded low-level source call positive,
- cross-class check that a runtime SWC-104 proof does not manufacture SWC-107.

Qualification additionally ran:
- existing C9 engine boundaries,
- existing C11 local-stack tests,
- strict TypeScript,
- the unchanged C13 frozen external benchmark,
- structural corpus diagnostics.

All passed on engine SHA `10d8f369e56600dfc35538a9af68d8574b8bab43`.

## Precision / recall per benchmark class

Format: TP/TN/FP/FN, then precision / recall.

| SWC | C13 matrix | C13 P/R | C14-P28 matrix | C14-P28 P/R |
|---:|---:|---:|---:|---:|
| 100 | 0/1/0/1 | — / 0.0% | 0/1/0/1 | — / 0.0% |
| 101 | 0/215/0/593 | — / 0.0% | 0/215/0/593 | — / 0.0% |
| 102 | 0/0/0/1 | — / 0.0% | 0/0/0/1 | — / 0.0% |
| 103 | 0/39/0/461 | — / 0.0% | 0/39/0/461 | — / 0.0% |
| 104 | 79/753/303/225 | 20.7% / 26.0% | 258/709/347/46 | **42.6% / 84.9%** |
| 105 | 0/5/0/8 | — / 0.0% | 0/5/0/8 | — / 0.0% |
| 106 | 5/0/3/0 | 62.5% / 100.0% | 5/0/3/0 | 62.5% / 100.0% |
| 107 | 53/579/531/35 | 9.1% / 60.2% | 53/679/431/35 | **11.0% / 60.2%** |
| 108 | 0/1/0/3 | — / 0.0% | 0/1/0/3 | — / 0.0% |
| 109 | 0/1/0/3 | — / 0.0% | 0/1/0/3 | — / 0.0% |
| 110 | 0/8/0/14 | — / 0.0% | 0/8/0/14 | — / 0.0% |
| 111 | 0/2/0/2 | — / 0.0% | 0/2/0/2 | — / 0.0% |
| 112 | 2/6/0/25 | 100.0% / 7.4% | 1/6/0/26 | 100.0% / 3.7% |
| 113 | 0/1046/0/256 | — / 0.0% | 0/1046/0/256 | — / 0.0% |
| 114 | 0/518/0/402 | — / 0.0% | 0/518/0/402 | — / 0.0% |
| 115 | 14/1265/22/7 | 38.9% / 66.7% | 14/1265/22/7 | 38.9% / 66.7% |
| 116 | 0/1/0/121 | — / 0.0% | 0/1/0/121 | — / 0.0% |
| 117 | 3/0/2/0 | 60.0% / 100.0% | 3/0/2/0 | 60.0% / 100.0% |
| 118 | 0/3/0/4 | — / 0.0% | 0/3/0/4 | — / 0.0% |
| 119 | 0/2/0/2 | — / 0.0% | 0/2/0/2 | — / 0.0% |
| 120 | 16/1088/9/253 | 64.0% / 5.9% | 16/1088/9/253 | 64.0% / 5.9% |
| 123 | 0/1/0/1 | — / 0.0% | 0/1/0/1 | — / 0.0% |
| 124 | 0/3/0/4 | — / 0.0% | 0/3/0/4 | — / 0.0% |
| 125 | 0/1/0/1 | — / 0.0% | 0/1/0/1 | — / 0.0% |
| 127 | 0/1/0/2 | — / 0.0% | 0/1/0/2 | — / 0.0% |
| 128 | 0/487/0/20 | — / 0.0% | 0/487/0/20 | — / 0.0% |
| 129 | 0/1/0/4 | — / 0.0% | 0/1/0/4 | — / 0.0% |
| 130 | 0/1/0/2 | — / 0.0% | 0/1/0/2 | — / 0.0% |
| 131 | 0/2/0/2 | — / 0.0% | 0/2/0/2 | — / 0.0% |
| 132 | 0/520/0/14 | — / 0.0% | 0/520/0/14 | — / 0.0% |
| 133 | 0/3/0/2 | — / 0.0% | 0/3/0/2 | — / 0.0% |
| 134 | 0/0/0/18 | — / 0.0% | 0/0/0/18 | — / 0.0% |
| 135 | 0/485/0/12 | — / 0.0% | 0/485/0/12 | — / 0.0% |
| 136 | 0/3/0/3 | — / 0.0% | 0/3/0/3 | — / 0.0% |
| 995 | 0/1/0/1 | — / 0.0% | 0/1/0/1 | — / 0.0% |
| 996 | 0/1/0/50 | — / 0.0% | 0/1/0/50 | — / 0.0% |
| 997 | 0/488/0/81 | — / 0.0% | 0/488/0/81 | — / 0.0% |
| 999 | 0/7/0/3 | — / 0.0% | 0/7/0/3 | — / 0.0% |

## Regressions and remaining risks

Confirmed benchmark regression:
- SWC-112 loses one TP. This is intentionally not restored because the old hit used the wrong detector semantics (initializer claim for a `delegatecall_dangerous` label).

Remaining technical risks:
1. Overall recall is still only 12.46%; the engine is not broad enough.
2. Several high-volume SWC classes have zero recall.
3. CFG analysis is bounded/static; unresolved dynamic jumps and full path feasibility remain limitations.
4. Runtime/source identity is not compiler-reproduced in CGT, so source must remain advisory unless independently verified.
5. Historical corpus labels are heterogeneous mappings from multiple source datasets; some benchmark FP/FN outcomes are taxonomy mismatches rather than pure detector correctness.
6. No independent unseen holdout was available in this qualification.
7. No executed-EVM exploit confirmation is produced by this benchmark; it is offline static analysis.

## Overfitting controls used

C14-P28 did NOT:
- hardcode contract addresses,
- hardcode runtime/source hashes,
- inspect benchmark case IDs/names in detector logic,
- change labels or the frozen corpus,
- disable a detector solely to reduce FP,
- use unverified source to suppress independent bytecode evidence.

The main new positive detector is an EVM-semantic rule (`CALL-family -> POP`), and the main precision change narrows an over-broad semantic claim while preserving the weaker review signal.

## Internal score

**C13: 2/10 -> C14-P28: 4/10 confirmed internal engine effectiveness.**

Why not higher:
- micro precision and recall roughly doubled, and net matrix movement is strongly positive,
- but recall remains only 12.46% overall,
- major classes remain entirely uncovered,
- no unseen holdout has validated generalization,
- and one benchmark-class regression remains visible rather than being benchmark-tuned away.

The next effectiveness work should prioritize semantically grounded detectors for SWC-101, SWC-103, SWC-113, SWC-114 and SWC-120, plus an independently frozen holdout created before further detector changes.
