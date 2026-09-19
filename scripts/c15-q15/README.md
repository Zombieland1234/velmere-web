# C15-Q15 — minimum hosted readiness

This is a read-only Q4–Q8 signature/RLS/ACL preflight, not a migration, function-body hash attestation, Auth/JWT test or release approval. Run only against an explicitly selected project. Never apply the disposable SQL installers from Q4–Q8 directly to a hosted production project.

The connector read on 2026-09-19 found 0/19 expected objects in the sole accessible project. This does not establish that this project is the intended production target. See the dated handoff observation for identity and limits. Two Stripe TEST contexts were accessible but no account was selected and no payment operation was performed.
