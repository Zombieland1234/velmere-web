# C15-Q6 local event inbox candidate

Base: `57a29cfccb9b5e3718ae89c8426e7155a0c086ee` (Q5). No Q6 commit, remote branch, CI or production migration is implied. Internal engineering qualification, not an external audit. NO_GO remains.

The event-claim boundary now requires one explicitly typed and identity-bound reply rather than guessed states, coerced counters or the first member of an arbitrary result array. Completion requires an integer attempt, matching event type and a symbolic error code. The existing application registry includes a new `stripe_webhook_event_complete` RPC operation; this is a coordinated application/schema contract change, not backwards-compatible production rollout.

The new isolated SQL implements the event inbox with database-clock leases, advisory/row locking, increasing attempts, type/created-at identity checks and fenced completion. Both functions use SECURITY INVOKER with a pinned search_path. Client roles have no table access or function execution. The service backend remains trusted. The table does not bind or store the complete Stripe payload, signature, account context or customer session; these remain upstream responsibilities. This candidate does not prove multi-account/Connect routing.

Runtime confirmation requires installing the reviewed schema before switching the application contract. The supplied SQL refuses existing objects and requires an isolated-test acknowledgment; it is not an applied migration. There is no silent fallback to the previous, weaker completion write.

Three test files add 58 cases: 35 boundary cases, 15 actual-SQL cases in PGlite, eight joined signed-event persistence cases. The joined suite uses actual application/Stripe-SDK/Supabase-client code with a parameterized in-process PGlite transport. It does not run a PostgREST server or real Stripe network requests. Payment ordering is explicitly accepted by a controlled adapter; fixture grants are setup, not checkout. The completed path is refund notification -> event claim -> effect -> lifecycle -> completion. Signup, checkout, hold/watermark, reconciliation and real user isolation remain open.

Lease fencing is not exactly-once execution of external callbacks. Existing Q4 idempotency and Q5 effect receipts are retained. Native multiprocess PostgreSQL, production workload and managed recovery are not established by PGlite tests. The engine, UI, sale switches, pricing, RLS of existing objects, dependencies and provider rights are unchanged.

Fresh detailed results belong in the separately hashed private delivery evidence. The local runner rejects existing output directories and enforces registration/counts and nonzero checks, including the unchanged zero-warning lint threshold. Previous failures are retained separately. No broad secret allowlist or ignored test is introduced.
