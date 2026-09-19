# C15-Q9 internal integration scope — NOT a production approval

Base is remote Q5 57a29cfccb9b5e3718ae89c8426e7155a0c086ee plus the exact previously delivered Q8 delta. The Q8 archive checksum was independently checked before modification. Local work is not an external audit. NO_GO persists.

## Product and evidence changes
- The classic post-CALL SSTORE reentrancy hypothesis uses the existing bytecode-only MAY-reach and possible-successful-exit analysis. Inert code after entry halts and paths whose continuation can only abort do not support this particular persistent-state hypothesis. Unknown jumps and budget exhaustion conservatively retain candidates. Shared CFG, PUSH4 map, other detectors, severity and source/runtime trust boundaries are not relaxed.
- The classic finding no longer invents an executed withdrawal/draining sequence. Its proof sequence is empty and its impact is explicitly conditional. The runtime engine and snapshot identity become Velmère-V2.5.3.
- Sixteen new direct observation tests: original source 8/16 expected decisions; candidate 16/16. The focused new-plus-existing engine group passed 62/62 locally. These are static author-written fixtures, not 16 independent vulnerabilities or a blind corpus.
- Unused non-UI imports were removed only where TypeScript emitted exactly the same JavaScript. Candidates with a changed emitted result were rejected. No eslint rule, severity, TypeScript strictness, UI, provider-rights grant or payment policy was changed. First measured local lint after cleanup: 0 errors / 317 warnings (was 336).
- Native multi-connection Q6/Q7/Q8 qualification is added for actual claims, ordering, event/session identity conflicts, create-versus-hold contention, lifecycle locking, rollback, client ACL and logical restore. Until its exact-SHA CI job completes, these are prepared checks, not claimed results.

## Integration
Q6/Q7/Q8 come from the exact supplied local Q8 source, not an unreviewed merge. All previously accepted tests stay registered. The controlled integration patch must match its pinned digest and exact Git tree before publication. A publication failure is not a pass. No main/C13 merge, force push, production migration, real/test Stripe payment or customer data change is authorized by this workflow.

## Qualification boundaries
Full regression target: 981 cases across 58 files; local and CI outcomes must be read rather than assumed. New native checks, full seen-corpus benchmark and old runtime/restore checks retain independent scopes. The prior benchmark is seen data; GENERALIZATION UNVERIFIED. No TP/FP change is asserted until measured. CI does not confer external validation or commercial/provider rights.
