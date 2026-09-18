# C14 revised candidate; supersedes block-local scope in SCOPE.md

First qualified SHA 1272e26e37d38773c69eb6bac5a850e6032d2efc: 384/384 regressions, 21/24 compiled fixtures, frozen benchmark TP172 TN7537 FP871 FN2636. Preserve these failures. Net +1 FP masks individual gains/losses; unchanged aggregate TP is not unchanged classifications.

Revision: follow constant-resolved legacy jumps and fallthrough while retaining compiler helper return addresses. Unresolved jumps, memory/storage/call-result provenance remain unsupported. Bounds: 512 states, 100000 instructions, 64 branch observations, 1024 stack words. Starts at entry and ORIGIN-block seeds: no entry reachability proof.

Pure ORIGIN/CALLER equality or boolean inversion, with address-preserving masks, remains a separate informational contextual observation, not SWC-115 owner-auth evidence. No corpus IDs, source names or ground-truth labels select the rule. Compound conditions retain candidates. No contract is declared safe; no target exploit is asserted.

55 local targeted tests replace 44 (not added twice). The 32 compiler invocations retain all original 24 settings/cases plus direct-caller and compound-authorization controls. Authored development fixtures, not independent holdout. Freeze settings before execution; runtime hex of our authored fixtures is exported to reproduce remaining failures. Fresh full CI and frozen benchmark must be reviewed before any final claim.

No UI, main merge, payment, grant or production promotion. No new hosted Auth/Stripe E2E. Original R16 remains unavailable.
