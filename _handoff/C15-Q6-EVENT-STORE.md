# C15-Q6 — whole-event persistence and strict acknowledgments

Base Q5: `57a29cfccb9b5e3718ae89c8426e7155a0c086ee`.
Internal technical qualification. NO_GO remains. No external-audit claim.

## Scope
Adds the previously missing whole-webhook event table and claim/completion RPCs under `scripts/c15-q6/`. These are disposable database candidates, not applied production migrations. Preserves Q4 entitlement and Q5 effect stores. No sales enablement, prices, user accounts, provider permissions, engine, UI, real payments or production data changes.

The event identity consists of ID, event type and Stripe creation time. One stored database-clock deadline cannot be shortened by a later caller. Row/advisory locks serialize claims. Each reclaimed attempt has an incremented generation; completion is conditional on that generation, event type, processing state and unexpired stored lease. A repeated identical acknowledgment for an already settled generation returns success without another write. Contradictory completion, expired writers and previous generations are refused. Exhausted generation counters fail closed instead of resetting.

`order-service.ts` now validates exact claim responses (including identity), refuses guessed status/attempt values, and replaces a direct completion UPDATE with the registered bounded completion RPC. Required identifiers and generations are validated before transport, with no truncation or rounding. Transport errors are sanitized. The legacy processed lookup fails closed without durable storage in production. Development memory follows the same identity/deadline/generation rules; it is not production storage.

Functions use SECURITY INVOKER with search_path pg_catalog; RLS is enabled/forced. anon/authenticated cannot read tables or call RPCs. service_role remains trusted with SELECT/INSERT/UPDATE and no DELETE grant. Generation is a stale-writer fence, not a secret authorization token. SQL does not verify Stripe signatures, payload hashes, tenant/account/mode, price or operator authority. Those are verified upstream or remain separate qualification work. No GoTrue/PostgREST user isolation claim.

A lease does not stop a running callback and is not exactly-once external execution. The joined application test installs Q4+Q5+Q6 real SQL: refund effect completes, event acknowledgment is lost, event is reclaimed, completed effect replays, and the lifecycle has one refund entry. Inert controlled fixtures replace transport, not SQL; no real Stripe calls.

## Local evidence before publication
41 new tests passed (23 contract and 18 actual SQL/application cases), including positive execution as service_role. Strict changed app/test graph passed. Actual original/current claim entrypoint with controlled RPC responses: 1/13 versus 13/13 expected decisions. These are one parser-boundary family, not twelve remotely exploited vulnerabilities. A replay-harness top-level-await failure and four test-typing errors are preserved separately; they were fixed without weakening strict or assertions.

New tests are registered once alongside the previous 758. The expected combined count is 799, but this document does not assert that full CI has passed. Native PostgreSQL, full build/runtime, benchmark and raw gates require fresh exact-SHA results. The private final handoff records those results after execution rather than relabelling local logs as CI.

## Remaining boundaries
The event store is not deployed to the connected production Supabase. Payment holds, watermarks, reconciliation, real Auth/Stripe TEST lifecycle, all paid products, rollout/migration parity, privacy/retention, operator alerts, managed recovery, secret-history review, engine effectiveness/generalization and independent external validation remain open. No hidden queue worker or heartbeat was added. Receipt/lease limits do not establish a complete data-retention policy.
