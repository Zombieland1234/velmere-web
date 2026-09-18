# C15-Q2 internal integration and measurement record

This is an internal release record, NOT an independent external audit. Release verdict remains NO_GO. The commit containing this file is a newly qualified candidate; final CI results are stored in immutable artifacts keyed by its exact sourceSha and runId, and are summarized in the owner's six-file delivery after completion.

## Integration identity and decisions

Canonical upstream C14B: e718df06d20a8129ffe261eef9c6c74cc5c91729. Its parent e680098a3915264576cdab6bb79ab1e1ca695b11 is the prior C14 integration. New branch: c15/qualification-q2-20260918. No main/C13/C14 branch is advanced by this work.

The Q1 local source was imported as commit 994987a7f2a64d711fe56215c61b0abb7e7500e8; its Git tree exactly equals df345f6309ec1e915b1c3b3f46f8e041152542cf from the prior delivery. This is exact byte parity, not a guessed recreation. Commit b2d9d58636111e1d31b248c8c97928f8f6d2d4df adds the isolated CI branch filters and ref-scoped concurrency. The current commit adds a reviewed measurement-completeness gate and its tests. Engine, auth, billing, RLS, UI and provider policies are unchanged by this final gate patch.

No blind merge of parallel candidates occurred. Previous P01-P30 decisions are historical, preserved in the owner's archive; this iteration does not claim a fresh review of all thirty branches. Private provider correspondence is not uploaded to this public repository.

## Fresh first C15 benchmark

Run 35371762616, artifact 10558613708, candidate b2d9d58636111e1d31b248c8c97928f8f6d2d4df: baseline e718 and C15 each completed 2472 unique runtime inputs, with zero errors and timeouts. Both report TP356/TN7390/FP1018/FN2452 over 11216 consensus pairs. Twenty-five repeat samples were stable; these are not new unique cases. One finding-output digest differs, not one newly confirmed vulnerability. The corpus was previously seen. GENERALIZATION UNVERIFIED. The final gate patch requires a NEW exact-SHA run; this first run is retained, not relabelled.

## New finding Q2-M01: incomplete comparison could exit successfully

The previous runner exited nonzero only for candidate errors/timeouts. In a real local runner invocation with two inert author-created inputs and explicitly controlled analyzers, a baseline that threw twice still yielded exit 0; a candidate with two unstable repeat outputs also yielded exit 0. These are instrument controls, not target-contract exploitation or a production-engine benchmark. The normal, stable control passed before and after.

The new gate requires complete baseline and candidate executions, exactly the expected assessment counts, no unassessed labels, and a complete stable repeat. Fourteen unit tests pass. Actual-runner controls now produce exit 1 for the failing baseline and unstable repeat, and exit 0 for the stable control. Original failed decisions and corrected results are retained separately in the owner handoff. A transfer typo was caught in an unreferenced tree and corrected before committing; that intermediate tree was not pushed or qualified.

PASS here means measurement completeness ONLY. It does not enforce an accuracy threshold, certify detector quality, verify generalization or authorize release. Existing zero-warning, secrets, paid lifecycle and other release requirements are not weakened.

## Final qualification requirements and remaining gates

Core: fresh install including lifecycle scripts, all admitted regression files, strict app and extended configurations, lint coverage and exact warnings, full Next/worker build. Runtime: real isolated Redis, one full Basic HTTP/RPC/worker/JSON/PDF/browser scenario, isolated PostgreSQL and restore drill. Benchmark: pinned CGT f8cd72cf7fbbfebc809c454667eee271706a4b2b, exact e718 baseline, original input/label selection, byte validation and non-overwriting output, new MEASUREMENT_GATE.json. Secrets: preserve redacted source/history scans and exact individual source classifications.

Outstanding: real Auth A/B session lifecycle; Stripe TEST checkout/webhook/grant/refund/revoke; all hosted paid products; global provider operation rights; full privacy/erasure; managed Supabase disaster recovery; historical-secret/environment review; zero-warning ESLint; independent external review. R16 has 381 recovered original IDs, but repair percentage remains N/D without original-case replay and a supported defect denominator. Last complete release assessment is 4/10, NO_GO; test volume is not a readiness percentage.

No production data, real payments, paid-service purchases, outbound partner messages, production deployment promotion or design changes are part of this work. The delivery excludes font resources; complete Git checkout is the reproduction source for full builds. Generated worktree changes and immutable manifests must be disclosed in the final delivery rather than silently described as a clean tree.
