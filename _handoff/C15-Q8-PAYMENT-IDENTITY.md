# C15-Q8: shared canonical payment identity

Internal continuation of local Q7; not an independent external audit. NO_GO remains. Remote base Q5 is `57a29cfccb9b5e3718ae89c8426e7155a0c086ee`. The admission job applied a hash-pinned patch on an authentic checkout and verified the entire reviewed source tree `6dc956ed4df8c004031ed9ae8a048493a5db4de6` before committing. The final continuation removes one unused import and records this scope. No main/C13 merge or production migration.

## Reviewed defects

1. `payment_intent.payment_failed` carries its identity in its own object ID. The previous ordering resolver inspected only a nested `payment_intent`, so the same payment could have different ordering subjects across failure, Checkout, refund and dispute events.
2. A failed Charge lookup in dispute handling was swallowed and could fall back to metadata/object identity. Q7 persists immutable event identity. The joined old-source test demonstrates that the provisional subject was persisted, then a healthy retry collided with that identity and could not finish processing.
3. The old terminal resolver did not verify the requested Charge identity and mode before following its PaymentIntent. This is a controlled API-response binding failure, not a claim of a live provider exploit.

`resolveStripePaymentIdentity` is now shared by ordering and terminal resolution. Signed direct references, expanded objects and verified Charge lookups converge on the same PaymentIntent key. API errors are not evidence that a relation is absent. Lookup failure rejects before watermark persistence, permits retry and never substitutes order/audit metadata as a payment key. Only an explicitly null relation permits the separately named legacy-charge key. Pending/expired unpaid Checkout without a PaymentIntent is scoped to its exact session; a paid Checkout without a required payment identity is rejected.

## Local evidence before remote qualification

32 behavior cases on the unchanged Q7 modules: 9 PASS / 23 FAIL. The same cases on the new resolver: 32/32 PASS. Six joined handler cases with real Stripe signature verification, Supabase client code and SQL Q4-Q7 in PGlite: old modules 3/6, final fixtures and new source 6/6. These are 38 new regression cases, not 26 vulnerabilities. One identity design family has multiple observable failure modes.

First joined execution had two fixture errors: an orderDraftId inadvertently entered an unrelated commerce-order persistence path. The fixture was corrected to shared audit metadata, retaining the identity assertions and production code. A test type fixture and duplicate-property declaration were corrected without weakening strict. Full local scope then passed 938/938 cases, application strict and 15 test configurations, and full Next/worker build. The initial local lint had 337 warnings; the one new unused import is removed in this commit. Full exact-SHA CI must be inspected before reporting final remote results. Historical logs are preserved in the private evidence packet.

## Remaining boundaries

The resolver expects an already SDK-verified event in one trusted Stripe account/environment. It does not implement Stripe Connect namespacing, refresh authentication, a real Checkout payment or all business metadata resolvers. Provider payloads and identifiers are not included in error strings. Native multi-connection PostgreSQL and API/Auth deployment remain separate qualifications; PGlite adapters are not PostgREST/GoTrue.

Changing a subject namespace does NOT migrate previously persisted wrong identities. Staging rollout needs inventory, reviewed reconciliation and coordinated Q6/Q7 SQL plus application deployment. Existing bad rows are not silently rewritten, and transaction-level ordering does not guarantee cancellation of in-flight external operations or exactly-once callbacks. Payment holds/reconciliation, all paid products, provider rights, erasure, managed recovery, secret-history review, engine effectiveness/generalization and external validation remain open. UI, app routes, CSS/public, package/lockfile and all 24 engine files are unchanged from Q7. No customer writes, live charges/refunds, provider grants or outbound messages.
