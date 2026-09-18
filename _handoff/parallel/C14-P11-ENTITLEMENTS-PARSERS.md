# C14-P11 — Entitlements & Parsers

## Scope and result

- Base: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Branch: `parallel/c14-p11-entitlements-parsers`
- Tested implementation SHA: `2417fec8baf7f811140e55ad08d1b86f197e0fd4`
- Starting C13 score: **8/10**
- C14-P11 effective score: **8.5/10**
- Code-level boundary score after patches: **9/10**
- UI changes: **none**
- Customer data mutations: **none**

The code-level score improved materially, but the effective score is capped because the connected Supabase environment does not currently expose the durable VLM entitlement table or the two RPCs expected by the application. That deployment gap is fail-closed, but it prevents end-to-end proof of the durable grant/revoke/restore path.

## Evidence

### Before patches

GitHub Actions run `35292878814` reproduced the confirmed problems with a clean test harness:

- C14-P11: **4 PASS / 6 FAIL**
- Shield PostgreSQL replay: **PASS**
- The six failures were the intended reproductions, not harness failures.

Confirmed reproductions:

1. stale/legacy Advanced entitlement could resurrect a tier whose current SKU truth is `NOT_FOR_SALE`;
2. report regeneration could select that stale Advanced entitlement;
3. durable lifecycle response parser accepted an impossible `revoked -> active` restore;
4. caller-supplied `verifiedStaticEvidence` could create permission detections;
5. Basic report restore parsed an oversized JSON body instead of rejecting it at a byte boundary;
6. Basic report restore silently accepted duplicate JSON keys at JSON parsing level.

### After patches

GitHub Actions run `35293282284`:

- C14-P11 entitlement/parser tests: **14/14 PASS**
- C13 source/bytecode boundary tests: **23/23 PASS**
- C14-P11 TypeScript check: **PASS**
- Shield synthetic PostgreSQL A/B/stored-tier replay: **PASS**

The Shield replay covers, among other checks:

- stored Advanced workspace cannot be read/restored with only Pro entitlement;
- own Pro workspace read succeeds;
- cross-account workspace resolves `NOT_FOUND`;
- anonymous/missing/wrong/expired/deleted session is denied;
- revoked/expired grant is denied;
- null tier and missing workspace id are denied;
- stored tier, not caller-request tier, is authoritative for READ/RESTORE;
- test writes are rolled back.

No production/customer rows were modified.

## Confirmed findings and fixes

### P11-F01 — current SKU truth could be bypassed by a stale Advanced entitlement

**Severity:** High  
**Status:** FIXED

The current commercial authority states Advanced is `NOT_FOR_SALE`, but `resolveVlmAdvancedOnlyAccess` previously read the SKU truth and then ignored it. A matching stored Advanced entitlement therefore returned an authorized verdict.

A second path, `resolveCurrentAuditAccess`, searched Advanced entitlements before Pro and could grant Advanced report regeneration from a stale record.

**Patch**

- `lib/commerce/vlm-advanced-only-access-policy.ts`
  - current SKU truth now gates before any account entitlement, entitlement id, token, or fallback lookup;
  - `NOT_FOR_SALE` returns fail-closed `product_not_for_sale`.
- `lib/security/current-audit-access.ts`
  - unavailable Advanced is excluded from account and direct-id lookups;
  - an active Pro grant still resolves Pro;
  - legacy Advanced + current Pro resolves Pro rather than Advanced.

**Regression**

- Basic ignores caller entitlement decoration and remains free.
- Pro matching current entitlement succeeds.
- Advanced stale entitlement is rejected.
- Advanced stale + Pro current downgrades to Pro.
- stale Advanced-only report access downgrades to Basic.

### P11-F02 — durable lifecycle RPC results were format-checked but not semantically/request bound

**Severity:** High  
**Status:** FIXED in application parser; live durable RPC deployment remains BLOCKED

The parser previously accepted any allowed event/status strings plus 64-hex hashes. It did not prove that:

- the returned event was the event requested;
- `previous_status -> next_status` was a legal transition;
- `idempotent` agreed with the transition;
- returned entitlement/event hashes belonged to the current request.

An impossible `restore: revoked -> active` therefore parsed as success.

**Patch**

`lib/commerce/vlm-entitlement-lifecycle.ts` now:

- recomputes the legal state transition;
- rejects impossible transitions;
- binds response event to requested event;
- binds response entitlement hash and event hash to the submitted identifiers;
- verifies the returned idempotency flag;
- retains the existing fail-closed store error behavior.

**Regression**

- revoked entitlement cannot be restored;
- expired -> active restore remains valid;
- a valid, correctly bound durable response passes;
- a valid-looking response for another event/hash fails;
- impossible revoked -> active restore fails.

### P11-F03 — caller-controlled “verifiedStaticEvidence” could influence confirmed permission findings

**Severity:** High  
**Status:** FIXED

`audit-permission-parser.ts` accepted `input.verifiedStaticEvidence` before private provider evidence. It validated target/chain/time and only the *shape* of `responseDigest`; the supplied source/ABI/bytecode was not cryptographically bound to that digest.

Because detected elevated/critical permission signals can feed report top findings, a caller able to reach this internal input shape could inject unverified source strings such as mint/upgrade patterns into trusted permission output.

**Patch**

The permission parser now treats only receipt-keyed private evidence returned by `readPass2572AuditProviderPrivateStaticEvidence(providerRuntime)` as authoritative. Caller-supplied `verifiedStaticEvidence` is retained in the public input type for compatibility but is deliberately ignored as trusted corpus.

**Regression**

A forged source object with a syntactically valid target, timestamp and 64-hex digest can no longer create mint/upgrade detections.

### P11-F04 — Basic report restore used unbounded/non-strict JSON parsing

**Severity:** Medium  
**Status:** FIXED

`app/api/audit/basic/report/restore/route.ts` used `request.json()` directly. This allowed oversized request parsing and normal JSON last-key-wins behavior.

**Patch**

Restore now uses:

- actual streamed byte cap: **4 KiB**;
- strict UTF-8/JSON body reader;
- duplicate/dangerous key rejection;
- maximum nesting depth;
- exact body key allowlist (`backupId`);
- exact query allowlist (`caseRef`);
- existing case/backup format checks and authenticated bridge call remain intact.

**Regression**

- oversized restore -> 413 before bridge access;
- duplicate `backupId` -> 400 strict parser rejection.

## Reviewed boundaries without a new patch

### Request tier vs stored/current tier

- Customer report request tier is normalized to Basic/Pro/Advanced and cannot exceed `resolveCurrentAuditAccess`.
- Delivery reauthorizes after report generation and requires the same entitlement id/current sufficient tier.
- Shield READ/RESTORE uses the stored workspace tier and current entitlement for that stored tier; a lower caller-supplied request tier cannot downgrade authority.

### Ownership

- Direct entitlement lookup requires exact account hash and, when supplied, case/asset/symbol binding.
- C14 regression proves account A cannot use account B's entitlement.
- Shield RPC selects workspace by both `workspace_id` and `auth.uid()`; cross-account access returns `NOT_FOUND`.

### Grant/revoke/expiry/restore

- Local lifecycle state machine treats revoke as terminal and does not restore revoked/refunded entitlements.
- Shield replay proves revoked and expired grants fail.
- The application parser now rejects forged/inconsistent durable lifecycle responses.

### Source / bytecode binding

C13 source-boundary suite remains green (**23/23**):

- submitted/unbound source cannot erase or rewrite bytecode observations;
- source-only hints are explicitly marked unbound/heuristic;
- adding source changes the receipt but does not assert verified coverage;
- source metadata does not mutate detector objects.

## Live read-only Supabase verification

A read-only system-catalog check was executed against the connected Supabase project on 2026-09-18. No customer rows were read or mutated.

**Confirmed live:**

- `public.velmere_r7_shield_pro_paid_workspace_v1` exists;
- `public.velmere_r7_shield_pro_has_paid_entitlement_v1` exists;
- the live workspace RPC includes the stored-tier READ/RESTORE guard.

**BLOCKED / missing live:**

- `public.velmere_vlm_paid_entitlements`: **absent**;
- `public.velmere_create_or_read_vlm_paid_entitlement`: **absent**;
- `public.velmere_apply_vlm_paid_entitlement_lifecycle_event`: **absent**.

The repository checkout also contains no authoritative migration defining these durable VLM entitlement objects. C14-P11 therefore does **not** invent or deploy a replacement schema. A read-only preflight is provided at:

`scripts/c14-p11/durable-entitlement-preflight.sql`

This deployment gap should be resolved together with the database/Stripe lifecycle work (C14-P17/C14-P19) using the authoritative intended schema and then re-qualified end to end.

## Open risks

### R1 — durable paid entitlement stack missing from connected Supabase — BLOCKED / High

Production-like code is designed to fail closed when a durable ledger is required, which avoids an authorization bypass. However, paid Pro grant creation/read/lifecycle cannot be considered end-to-end operational until the expected table and RPCs exist and are tested in an isolated/staging environment.

### R2 — Advanced naming/policy divergence between central VLM SKU truth and Shield grant system — UNVERIFIED / Medium

Central VLM SKU truth marks Advanced `NOT_FOR_SALE`. The Shield R7 grant/RPC contract explicitly supports `pro` and `advanced`, and the existing C13 replay intentionally proves an actual Advanced grant authorizes stored Advanced workspaces.

C14-P11 does not collapse these two authorities without a product-policy decision. If “Shield Advanced” is intended to be the same commercial Advanced tier, this needs one authoritative policy and follow-up patch. If it is a separate controlled validation tier, the naming/contract should say so.

### R3 — memory fallback and durable lookup semantics are not identical — PARTIAL / Low-Medium

Non-production memory account lookup can accept a broader account-bound entitlement when asset/case are absent, while durable lookup is context-hash exact. Production-like mode fails closed and requires durable storage, so this is not currently a production privilege escalation, but it can make local tests more permissive than durable behavior.

## Files changed

Runtime/security:

- `lib/commerce/vlm-advanced-only-access-policy.ts`
- `lib/security/current-audit-access.ts`
- `lib/commerce/vlm-entitlement-lifecycle.ts`
- `lib/security/audit-permission-parser.ts`
- `app/api/audit/basic/report/restore/route.ts`

Qualification only:

- `scripts/c14-p11/entitlements-parsers.test.ts`
- `scripts/c14-p11/durable-entitlement-preflight.sql`
- `tsconfig.c14-p11-tests.json`
- `.github/workflows/c14-p11-qualification.yml`

No UI files changed.

## Score

**C13 8/10 -> C14-P11 8.5/10 effective, 9/10 code-level.**

Why not 10/10:

1. durable VLM entitlement table/RPCs are absent from the connected live Supabase and from the checked-out migration set;
2. there is no end-to-end live/staging proof for durable grant/revoke/restore;
3. Shield Advanced vs central Advanced policy remains ambiguous;
4. non-production memory fallback is slightly more permissive than durable context matching.
