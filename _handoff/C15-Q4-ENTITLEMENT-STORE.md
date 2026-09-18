# C15-Q4 — isolated entitlement persistence candidate

Base: `8fa402530444103a9b3840f25a0e1f6d9498d422`, Q3. Internal qualification only. **NO_GO**.

## Purpose and scope

The Q3 code expects a durable entitlement relation and create/read and lifecycle RPCs. Read-only catalog inspection again found neither function nor the relation on the connected project. This change adds a candidate SQL implementation under `scripts/c15-q4/`, **not an automatically applied Supabase migration**. It refuses installation without an explicit isolated-test acknowledgement and refuses existing billing objects rather than overwriting them. No production SQL, customer changes, Stripe payment, credential changes, provider permission or public sale is performed.

The application contract is taken from `vlm-entitlement-ledger.ts`, `vlm-entitlement-lifecycle.ts` and the registered RPC names. The transition table is unchanged: all 30 combinations of six statuses and five events are compared with a fixed expected table and the actual TypeScript evaluator/parser. Creation supports a single server-authored product/context per Checkout Session. RPC callers are a trusted server service role, not user JWTs. No SECURITY DEFINER elevation is introduced; search_path is pinned, RLS is enabled and forced, and anon/authenticated have neither table access nor function execution. Service-role SQL authority is explicitly trusted and can mutate rows; the event journal is append-only for that role, not tamper-proof against the owner.

## Invariants implemented

- Create/read preserves the original identity, owner context, expiry, queue and timestamps on replay. A conflicting session binding is refused; terminal/expired/held records cannot be recreated as active.
- Lifecycle locks event identity and the target row. Changed status and its receipt are one transaction; receipt failure rolls the status back. Replay checks entitlement/event/source/operator/reason identity and returns the original transition without updating current status.
- Refund before an existing entitlement returns a retryable failure, not a success acknowledgement. This is not an end-to-end guarantee for out-of-order Stripe events: upstream lookup, watermark, effect and release-hold stores remain separate open dependencies.
- Restore never extends expiry and cannot resurrect refunded/revoked/consumed states. Restoring an expired record with a past expiry does not give usable access under the existing application expiry guard.
- SQL trusts already verified server payment/context evidence. It does not independently verify Stripe signatures, compute the application's canonical context hash, authorize a manual repair, or establish a price/license. Deployment requires these surrounding authorities.

## Local evidence before native CI

52 PGlite tests passed through real PostgreSQL SQL and the existing lifecycle parser. PGlite is not a multi-connection PostgreSQL server or full Supabase stack. Initial strict TypeScript failed on an incomplete synthetic Stripe Session fixture; it was replaced with a complete SDK-typed fixture without changing the production function or weakening the test. Retest strict and the same 52 cases passed. These are 52 new cases, not 52 new vulnerabilities.

The native PostgreSQL runner is restricted to a named disposable loopback database. It tests concurrent create/refund/event collisions, refund/revoke ordering, transaction and statement rollback, ACLs, and logical backup/restore. Its claims require a completed result artifact, not merely the presence of the runner.

## Remaining release gates

Public Pro/Advanced checkout stays disabled by the existing SKU truth; the test explicitly verifies this. No new application flags are enabled. This is a persistence component candidate, not completed checkout/Auth/billing. A reviewed production migration, isolation on the intended PostgREST/GoTrue stack, all other Stripe state/effect/hold/reconciliation RPCs, real TEST checkout to refund, global provider rights, privacy, managed disaster recovery and external review remain open. Engine files are unchanged from Q3; no new effectiveness improvement is claimed.

## Reproduce safely

Run the accepted TypeScript suite with the pinned lockfile and `tsconfig.c15-q4-tests.json`. The dedicated workflow runs native PostgreSQL 17, the full existing qualification groups and the frozen corpus at the new commit. Each run gets a fresh output directory. Never point `native-postgres.py` or the candidate SQL at a customer database. Convert to a production migration only in a separately reviewed rollout; this file is not that authorization.

References: PostgreSQL 17 row security and explicit locking docs; Supabase database-function privileges; Stripe webhook duplicate/order semantics. Sources are supporting platform contracts, not external certification of this implementation.
