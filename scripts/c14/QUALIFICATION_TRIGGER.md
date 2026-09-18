# C14 exact-source qualification

Integrated parent: `ef3866b0834203be29ab3ed746fd53cd3d7c6167`.
Baseline C13: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.

This connector-authored commit triggers full qualification AFTER integration. The transient compressed transport has been removed. No application source is rewritten during qualification; every evidence record uses the trigger SHA.

Local development observations: 44 origin tests and 15 secret-triage contract tests passed under local transpilation/Python. These are not a production build, full E2E, a compiler run or a blind benchmark. CI results must be reviewed separately before any final summary.

Current release status: NO_GO. No merge, deployment promotion, payment or live entitlement changes. No UI changes. The raw secret scan, lint and missing-history gates remain visible even when narrower checks pass.
