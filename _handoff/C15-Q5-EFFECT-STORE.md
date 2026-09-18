# C15-Q5: effect persistence and strict claim boundary

Base: `ef677f5dc56b33da982f2863b1dd3533fe812c6d` (C15-Q4). Internal review, not an external audit. NO_GO.

## Admitted scope

New `scripts/c15-q5/effect-store.sql` implements the four already registered effect RPCs. It is a reviewable isolated candidate, not a production migration. The composite event/effect identity has a single durable row; lease duration is stored by the first claim using the database clock. A second caller cannot shorten it. Row/advisory locks serialize claims. Retry increments a bounded generation; completion/failure/dead-letter require the matching generation and token and a lease that has not expired. Completed receipts replay; terminal effects do not automatically restart. All functions remain SECURITY INVOKER with search_path pg_catalog; the private table has forced RLS and no anon/authenticated privileges. The service role remains trusted and can mutate rows; this is not administrator-proof storage.

The application validates the actual claim shape instead of defaulting status/attempt/token, rejects ambiguous rows and malformed retry intervals, validates settlement identities before RPC, and preserves sanitized error codes. Memory-only development keys now encode an unambiguous tuple; production still refuses missing durable storage. A typed optional RPC dependency makes real SQL tests possible without network access and does not bypass production configuration checks.

## Limits, deliberately demonstrated

The effect lease is NOT an exactly-once guarantee for an external call. A worker can finish its external operation and die before saving a receipt. Its replacement may call the operation again; a lost-response test explicitly confirms this window. The downstream operation must be idempotent. The Q4 lifecycle journal is such a downstream operation: a test commits the refund, loses completion, expires the effect lease, then retries. Two callbacks produce one lifecycle transition and one stored effect receipt. Later chargeback is not reversed by old refund receipt replay.

This does not implement ingress event-claim storage, payment watermark, payment holds, reconciliation, real GoTrue/PostgREST, Stripe checkout, provider rights, or public-sale enablement. Identical event/effect assumes a fixed, signature-verified Stripe event payload; SQL does not verify that signature or arbitrate operator authority. JSONB and JavaScript receipt byte sizes have different serialization overhead; either layer may conservatively reject a near-limit receipt. Rollout needs a separately reviewed migration and parity checks, not direct execution against customers.

## Local qualification before publication

53 new tests, real PostgreSQL SQL via PGlite and the real application effect/lifecycle parsers. Initial 48/50 exposed SQL NULL versus JSON null at the wrapper; fixed with explicit JSON null canonicalization, without changing assertions. Final 53/53 and focused strict PASS. Full admitted local suite 758/758 (705 Q4 + 53 new), historical fixture objects and exact font resource used only in the private runtime; no font assets redistributed. Native multi-connection scenarios are separately defined and must be executed on the final SHA before claiming them.

No changes to engine, UI, auth, product pricing/policy, package.json or lockfile. No production database modifications, payments, provider messages, purchases, or merge into main/C13/Q4. Existing failed logs are retained in the private handoff.
