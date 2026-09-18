# C14: operand-bound origin analysis and exact-byte secret triage

Baseline source: 4cb45bbcf910f0517d4a5d265682cd2f7e4e41df, C13. No UI, CSS, public asset or customer data changes. No paid Stripe operations, no production promotion. NO_GO remains until all relevant release gates have evidence.

The origin detector now inspects the conditional operand consumed by JUMPI. POP, DUP, SWAP and arithmetic operand dependencies are tracked within each basic block. A nearby EQ using unrelated operands no longer impersonates origin authorization. The absence of this bounded signal is not safety: memory/storage/call results and cross-block state remain unmodelled. The output is an unconfirmed branch candidate, not confirmed authentication or an exploit.

44 focused runtime assertions include duplicates only as explicitly repeated work-bound/stability checks, not additional unique contracts. The six author-created Solidity templates are compiled in four optimizer/viaIR configurations each with the locked solc and Cancun target; unique decoded-runtime hashes are reported separately. They are development fixtures, not a blind holdout. The 2472-runtime external CGT collection is already seen and remains a regression replay. No aggregate improvement is claimed until the comparison is reviewed, including regressions.

Secret review pins each of the 22 C13 scanner hits by rule, path, exact position and entire-file SHA-256, with an explicit internal classification. New findings, changed bytes, mismatched scanner version, invalid exits, disappeared findings and duplicate entries fail closed. The raw redacted Gitleaks report is retained and the raw release gate is not removed. This is not a Git-history, deployment-environment or independent secret review.

References reviewed 2026-09-18:
- https://docs.soliditylang.org/en/latest/security-considerations.html#tx-origin
- Ethereum Cancun legacy EVM opcode semantics are the declared model, not an assertion of coverage for future forks/EOF.

Local observations use an installed TypeScript transpiler and are marked transpile-only, not a replacement for strict TypeScript/build/production runtime CI. Final qualification must run against the exact integrated Git SHA. CI jobs are automated tests, not independent auditors or AI subagents.
