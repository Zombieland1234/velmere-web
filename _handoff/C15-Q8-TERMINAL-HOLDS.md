# C15-Q8 — early terminal-payment holds (internal local candidate)

Base: local Q7 content tree `af39bbbf95d2562c59d40ee5bfd79ecf074d103d`, ultimately remote Q5 `57a29cfccb9b5e3718ae89c8426e7155a0c086ee`. No new Git commit, migration, production changes or Stripe payment is implied. NO_GO.

## Scope

A full-refund or chargeback notification can precede the entitlement row. The previous handler requested retry, but the create/read SQL could meanwhile create a fresh active grant for that session. The new missing-grant path persists terminal evidence before acknowledging the event. It does not pretend that a nonexistent grant was revoked. Nonterminal, partial-refund and audit-case policies are unchanged.

The public Q4 create/read function is wrapped with a session-held check under its original session advisory lock. The exact reviewed original function is retained in a private schema, not reimplemented. A hash guard refuses changed Q4 dependencies. The hold writer handles a grant which appears after the earlier not-found lookup by applying the existing lifecycle within the same transaction as its hold. Failure of either journal insertion rolls back the whole call. Request identity and original receipt are immutable to normal service-role UPDATE/DELETE. The receipt is an observation at commit time, not a current-state query on replay.

Only the verified durable-not-found VLM path uses this new RPC. An earlier audit-case transition may fail before that path; audit-case persistence and partial refunds are not claimed complete. The pure releaseHoldBlocked helper now denies first creation as well as replay, but that optional argument is not falsely presented as the deployed SQL enforcement.

## Trust and rollout

Five SQL components are exercised in isolated PGlite tests: entitlement, effect, inbox, ordering and terminal hold. Stripe and Supabase transports are controlled. Grant creation is fixture setup through the real public SQL function, not an actual paid Checkout. One test executes the hold SQL and then drops its response, preserving proof that the next grant remains blocked. Tests for a grant appearing in the lookup/write interval are deliberately sequenced interleavings, not native concurrent-connection tests.

The SQL remains SECURITY INVOKER with pinned search_path and forced RLS. anon/authenticated cannot read or call it. The service role and database owner remain trusted: direct table writes or private function calls can bypass the public wrapper. This is not an administrator-proof ledger or an exactly-once external-effect guarantee.

Installation requires an explicit disposable acknowledgement, exact Q4 function-definition hashes and no existing hold objects. PostgreSQL function formatting/version parity must be reviewed on staging; do not relax a mismatch to force installation. This is not an applied Supabase migration. SQL and the application must be rolled out together. Missing/malformed storage confirmation remains retryable, not acknowledged.

No automatic clearing of terminal holds is invented. Retention, dispute resolution, reconciliation, multiple Stripe accounts/environments, real Auth/PostgREST/Stripe TEST, native locking/restore and all-product E2E remain open.
