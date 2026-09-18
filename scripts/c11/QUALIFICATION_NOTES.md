> C14-P03 documentation note (2026-09-18): this is a historical stage record, not current release truth. The audited C13 source baseline is `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df` and remains `NO_GO`. See `/docs/CURRENT_STATE.md` and `/docs/CLAIM_LEDGER.md`. Historical SHAs and bounded observations below are preserved rather than rewritten.

# C11 candidate — not a release approval

Base: C10 8841c625ede6452de55bd57c1024759d6dc53845. UI is not redesigned.

The local stack analysis remains block-local and an overapproximation: no cross-block value propagation, no memory analysis, no SMT path feasibility, no complete opcode/fork certification. The engine is not claimed better than any independent auditor.

The customer pipeline uses a Node worker with a total 3s budget, termination on abort/deadline and limited V8 heap. It is not an untrusted-code sandbox or a whole-process memory/global concurrency guarantee. Build the worker before running the app. No in-process fallback is allowed when the bundle cannot load.

New microprogram cases are synthetic, byte-distinct parameterized EVM semantics tests against EthereumJS Cancun. They are not thousands of independently discovered security flaws. The existing CGT corpus is repeated, not fresh holdout. R16 original ledger remains required to calculate closure percentage; R17 is historical only.
