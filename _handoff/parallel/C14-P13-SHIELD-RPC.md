# C14-P13 — Shield RPC / Edge qualification

Date: 2026-09-18  
Base: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
Branch: `parallel/c14-p13-shield-rpc`  
Qualification source SHA: `1229a1f9bbcb9d81e0bed78db054a0f9614e254d`  
GitHub Actions: run `35292885388` — PASS  
Scope rule: no production customer rows were inserted, updated, deleted, restored, or inspected.

## Result

C13 starting score: **8/10**.

C14-P13 branch candidate: **9/10**.

The live deployment remains at the C13 behavior until the reviewed SQL hardening and Edge bundle/config are deployed. Therefore this report does **not** claim that live production already has the C14 fixes.

Why not 10/10:
1. no real-user HTTP Auth/Edge E2E was run against production;
2. the C14 SQL/Edge changes are intentionally not deployed by this branch audit;
3. an exact grant/revoke-vs-workspace-operation TOCTOU race is not proven atomic across every entitlement writer and remains a residual item for integration testing.

## Live parity readback

Connected Supabase project: `yljjyowcvjgjcamffnvd`.

### RPC

Current live function:

`public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)`

Live SHA-256:
`b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6`

Helper:

`public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)`

Live SHA-256:
`233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92`

Both match the C13 deployment evidence and the isolated captured C13 state before the C14 patch.

ACL readback:
- `anon`: no EXECUTE
- `authenticated`: EXECUTE
- `service_role`: EXECUTE
- both functions are `SECURITY DEFINER` with explicit `search_path`.

Live migrations include:
- `20260917043048_velmere_c6d_shield_session_and_null_validation`
- `20260917230935_velmere_c13_shield_workspace_stored_tier_guard`

### Edge

Live function `r7-shield-pro-paid-workspace-v1`:
- status: ACTIVE
- live version: 3
- live bundle SHA-256: `56ed3a70982cd1a25120aeeefb0a68a94eca63992e95eb591fd9b7777d80d47e`
- `verify_jwt=false`
- live `index.ts` and `request-boundary.ts` were exact matches to the base repository files at `4cb45bb...`.

The handler still performs `auth.getUser(token)`, and the RPC separately validates `auth.uid()`, `session_id`, `auth.sessions`, and entitlement state, so no unauthenticated bypass was established. C14 adds an explicit repo deployment policy `verify_jwt=true` for defense in depth.

## Findings and fixes

### P13-01 — request tier could relabel stored workspace output — CONFIRMED / FIXED ON BRANCH

C13 correctly made the database return and authorize the **stored** tier for READ/RESTORE, but Edge still used caller-supplied `tier` when building:
- `productSlug`
- product ordinals
- Advanced-only cards
- priority matrix
- automation queue
- material-paid-value label.

Example before C14: an Advanced-entitled caller could request a stored Pro workspace with `tier=advanced`; RPC returned stored `tier=pro`, but Edge could render/label the Pro payload as Advanced.

Fix:
- added `response-authority.ts`;
- Edge uses RPC-returned stored `tier` and `locale`;
- payload `tier`/`locale` must match stored columns or response fails closed with `workspace_authority_invalid`.

This is the closest sibling of the C13 READ/RESTORE authority bug.

### P13-02 — request locale could relabel historical workspace — CONFIRMED / FIXED ON BRANCH

Same class as P13-01. READ/RESTORE returned stored locale, but Edge selected copy from request locale.

Fix: response locale now comes from the resolved stored workspace and payload identity must agree.

### P13-03 — CREATE accepted a meaningless workspaceId — CONFIRMED / FIXED ON BRANCH

Before C14, `CREATE` accepted a non-null `workspaceId`; the RPC ignored it and generated a new UUID. This was ambiguous request behavior.

Fix: Edge rejects non-null `workspaceId` for CREATE as `request_invalid`.

### P13-04 — DELETE / RESTORE transition race — CONFIRMED / FIXED IN SQL CANDIDATE

The event table is append-only but had no uniqueness/state-transition serialization for workspace mutation. The live table has only:
- PK `event_id`
- index `(account_id, workspace_id, event_id DESC)`

There is no uniqueness constraint that makes DELETE/RESTORE transitions atomic.

Fix in `scripts/c14/p13/shield-rpc-hardening.sql`:
- transactional advisory lock scoped to `account_id + workspace_id` for DELETE/RESTORE;
- after waiting for the lock, the function re-reads the latest event;
- concurrent DELETE becomes one transition + idempotent followers;
- concurrent RESTORE becomes one transition + conflict followers.

Isolated PostgreSQL result:
- 8 concurrent DELETE callers: 8 successful responses, exactly 1 `idempotent=false`, 7 `idempotent=true`, exactly 1 DELETE row;
- 8 concurrent RESTORE callers: exactly 1 success, 7 `shield_pro_paid_restore_requires_deleted_workspace` conflicts, exactly 1 RESTORE row.

Candidate post-patch RPC SHA-256:
`9361d747fd078e45c20426a3f341731a5ea76ae38a1a27fd44892ea120fb4a18`

The SQL refuses to apply when the reviewed C13 function/helper hashes drift and refuses re-application after the function changes.

### P13-05 — DELETE response lacked stored tier/locale — CONFIRMED / FIXED IN SQL CANDIDATE

C13 intentionally allows an owner downgraded from Advanced to Pro to delete an old Advanced workspace without reading its payload. That policy is preserved.

The DELETE response now includes stored `tier` and `locale` so Edge cannot label the deletion from request-controlled values.

### P13-06 — RESTORE state conflict surfaced as generic 503 — CONFIRMED / FIXED ON BRANCH

`23514 shield_pro_paid_restore_requires_deleted_workspace` previously fell through to `workspace_unavailable` / HTTP 503.

Edge now maps that specific state conflict to HTTP 409 `workspace_not_deleted`.

### P13-07 — platform JWT gate disabled — CONFIRMED / HARDENED IN REPO CONFIG

Live Edge metadata reports `verify_jwt=false`.

No bypass was found because the handler validates the bearer token with `auth.getUser()` and the RPC validates the live auth session and entitlement again.

C14 adds:

`supabase/config.toml` → `[functions.r7-shield-pro-paid-workspace-v1] verify_jwt = true`.

This is defense in depth and must be verified again after deployment.

## Lifecycle matrix

| Case | Result |
|---|---|
| CREATE Pro | PASS |
| CREATE Advanced | PASS |
| READ own Pro | PASS |
| READ other account | NOT_FOUND / PASS |
| READ stored Advanced with only Pro | DENIED / PASS |
| READ stored Pro using Advanced request | stored Pro identity returned / PASS |
| READ stored Advanced using Pro request + valid Advanced grant | stored Advanced identity returned / PASS |
| RESTORE deleted Advanced with valid Advanced entitlement | PASS |
| RESTORE stored Advanced after downgrade/revoke | DENIED / PASS |
| DELETE old Advanced after downgrade to Pro | allowed cleanup, no payload read / PASS |
| repeated DELETE | idempotent / PASS |
| UPDATE | not implemented; invalid operation / PASS |
| missing subject | DENIED / PASS |
| wrong session owner | DENIED / PASS |
| missing session | DENIED / PASS |
| malformed session id | DENIED / PASS |
| expired session | DENIED / PASS |
| deleted session | DENIED / PASS |
| revoked grant | DENIED / PASS |
| expired grant | DENIED / PASS |
| null tier/locale/operation | DENIED / PASS |
| missing workspace id for non-CREATE | DENIED / PASS |
| anon direct RPC execute | DENIED / PASS |
| concurrent DELETE | serialized / PASS |
| concurrent RESTORE | serialized / PASS |

## Automated evidence

GitHub Actions run: `35292885388`

Jobs:
- `shield-rpc`: PASS
- `shield-edge`: PASS

SQL/RPC:
- **38/38 PASS**
- PostgreSQL 17 real engine in isolated CI
- synthetic users, sessions, grants and workspace rows only
- customer writes: **0**

Edge:
- **8/8 PASS**
- stored tier/locale authority
- payload identity mismatch fail-closed
- DELETE identity
- malformed transport
- bounded valid body preservation
- CREATE workspaceId rejection source assertion
- conflict mapping assertion
- `verify_jwt=true` config assertion

Evidence artifact:
- artifact id: `10526628554`
- artifact digest: `sha256:e4a3335b4549d6550dea0372aa3064ad6fa73b65261e334509450f5662a5990c`

## Files changed

- `supabase/functions/r7-shield-pro-paid-workspace-v1/index.ts`
- `supabase/functions/r7-shield-pro-paid-workspace-v1/response-authority.ts`
- `supabase/config.toml`
- `scripts/c14/p13/shield-rpc-hardening.sql`
- `scripts/c14/p13/shield-rpc-test.py`
- `scripts/c14/p13/edge-authority.test.ts`
- `.github/workflows/c14-p13-shield-rpc.yml`
- `_handoff/parallel/C14-P13-SHIELD-RPC.md`

## Residual / integration gates

1. **C14 patch not deployed live.** Live remains on RPC hash `b739...`, Edge v3, `verify_jwt=false`.
2. **Real Auth HTTP E2E not executed.** The CI exercises captured RPC logic plus Edge transport/authority helpers, not a real customer token.
3. **Grant/revoke exact race remains a residual.** Current checks are correct for normal ordering, expiry, revoke and downgrade, but every entitlement writer was not converted to a shared atomic lock protocol in this P13 branch. Do not claim perfect revoke linearizability until an integration test coordinates the actual writer and workspace operation.
4. **UPDATE is not a product operation.** It remains rejected rather than invented.
5. Before deployment, generate the integration migration through the normal Supabase migration workflow from the reviewed SQL candidate; deploy SQL before the Edge response-authority change, then read back the RPC hash and Edge bundle/config.

## Score

**8/10 → 9/10 on the C14-P13 branch candidate.**

A 10/10 claim requires live deployment parity plus real test-account HTTP E2E and a proven atomic entitlement revoke race across the actual entitlement writers.
