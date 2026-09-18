# C13 recovery qualification

Recovered parent: `6379f4d25f31c1e8413ebd27ae0ff2b8d0fe6319`.

The new preflight matrix exercises the original configuration CLI in 18 clean child processes. The unconfigured production case MUST exit 1 with all three missing prerequisites; only structurally configured test profiles may exit 0. Every result MUST continue to say `connectivityVerified=false`. No production secrets or deployment settings are created.

This replaces a mis-scoped CI prerequisite: running the production CLI in the deliberately unconfigured general-browser job and interpreting its expected fail-closed refusal as an application regression. The raw refusal is retained in CONFIG_PREFLIGHT_MATRIX.json. Hosted configuration, real auth and Stripe TEST remain open release gates.

The 18 cases are included once in the unique regression total even though the focused suite and combined suite both execute them. No UI or application runtime code changes. No merge, payment or promotion. No independent reviewer is implied by CI jobs.


## C14-P03 recovery pointer

The current recovery procedure is `/docs/RECOVERY.md`. It preserves the C13 Git source anchor, Actions artifact IDs/digests, the two font exclusions, the live-vs-repository migration split, the 13 missing authority artifact references and the rule that missing original C12/R16 evidence must not be reconstructed.
