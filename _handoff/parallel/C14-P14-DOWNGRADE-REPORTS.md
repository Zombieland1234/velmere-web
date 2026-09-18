# C14-P14 — Downgrade / historical report access

## Status

- Base SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Branch: `parallel/c14-p14-downgrade-reports`
- Tested implementation HEAD: `310ecb5ff6511fb15c4443481cd274c9641f0018`
- Final green CI run: `35293434188`
- Production mutation by C14-P14: **NONE**
- Initial C13 score: **5/10**
- C14-P14 branch/source qualification: **8/10**
- Currently deployed production score for this area: **still 5/10 until the branch and its DB privilege migration are deliberately deployed and the durable paid Audit entitlement ledger exists**

The branch closes concrete source-level bypasses and adds a complete conservative access policy for the surfaces that have enough authority evidence. It does **not** claim that the new archive boundary is already live.

## Executive result

C13 had two different classes of historical data but only one was substantially closed:

1. **Current paid monitoring workspaces** already had a stored-tier guard: an old Advanced workspace requires a current Advanced entitlement for READ/RESTORE.
2. **Immutable account report artifacts** were owner-bound, but ownership alone was treated as access authority. An authenticated owner could still read their own stored snapshot/PDF after downgrade directly through PostgREST/RPC, because current entitlement was not part of the table/RPC read boundary.

C14-P14 adds a current-rights boundary for immutable paid Audit artifacts, switches durable archive reads to a server-owned path after active account binding, and adds a source-only migration that removes the browser's direct SELECT/RPC capability for those artifact tables.

Basic immutable history remains owner-readable. Paid non-Audit immutable archive policy is not sufficiently specified by current product authority and is therefore **fail-closed / POLICY_UNDEFINED** rather than mapped to a guessed SKU.

## Existing authority / no invented product policy

### Confirmed current authority

- `config/report-access-policy.json`
  - paid JSON/PDF regeneration requires a **CURRENT** entitlement;
  - historical `entitlementVerified` is not current authority;
  - stored immutable artifacts are explicitly described as an area where **"full current-rights integration still required"**.
- `lib/security/current-audit-access.ts`
  - current Audit access resolves against present account entitlement, not historical case flags.
- `lib/security/customer-report-request.ts`
  - both JSON/PDF paths re-authorize delivery after render/serialization, closing revoke-during-render races.
- `scripts/c13/shield-workspace-guard.sql`
  - explicitly classifies Shield workspaces as **current paid monitoring workspaces, not immutable purchased audit archives**;
  - READ/RESTORE compares the stored workspace tier against current entitlement.

### Corroborating historical authority, not used as sole truth

- PASS2494 revocation/chargeback lock says refunded/chargeback/revoked/expired/superseded paid artifacts should not remain visible through account console, PDF download or browser preview.
- PASS2842 export/dispute/chargeback hold gate similarly expects download/API handoff to freeze on refund/chargeback collisions.

Those older contracts support the conservative C14 behavior, but `config/report-access-policy.json` is the stronger current source for the Archive gap.

## C14 policy

### Tier ordering

`basic < pro < advanced`

For an immutable paid Audit artifact, the immutable `deliveredTier` (fallback: `requestedTier`) is **only the minimum tier required**. It is never proof of current access.

### Matrix

| Transition | Stored paid Audit artifact — owner | Regenerated JSON/PDF — owner | Shield workspace READ/RESTORE — owner | Basic immutable history | Other account |
|---|---|---|---|---|---|
| Advanced → Pro | Advanced **DENY**; Pro **ALLOW only with current Pro** | Advanced **DENY**; Pro may run with current Pro | stored Advanced **DENY**; stored Pro allowed with current Pro | **ALLOW owner** | **DENY** |
| Advanced → Basic | Advanced/Pro **DENY** | paid regeneration **DENY**; Basic remains available | paid workspace **DENY** | **ALLOW owner** | **DENY** |
| Pro → Basic | Pro **DENY** | Pro regeneration **DENY**; Basic remains available | stored Pro **DENY** | **ALLOW owner** | **DENY** |
| paid → revoked | paid artifact **DENY** | paid regeneration **DENY** | **DENY** after REVOKE | **ALLOW owner** | **DENY** |
| paid → refunded | paid Audit artifact **DENY after refund lifecycle is applied** | paid regeneration **DENY** | **UNVERIFIED/BLOCKED** until refund is proven to create Shield REVOKE | **ALLOW owner** | **DENY** |
| subscription expired | paid artifact **DENY** | paid regeneration **DENY** | **DENY** after expiry | **ALLOW owner** | **DENY** |

### Undefined paid non-Audit immutable archive policy

Current source does not define a reliable historical artifact → current SKU mapping for every paid Lens / Shield / Real Markets immutable artifact. C14 therefore does not guess.

Temporary source policy:

- owner + Basic artifact: ALLOW;
- owner + paid Audit artifact: current entitlement must cover delivered tier;
- owner + paid non-Audit immutable artifact: **FAIL CLOSED / POLICY_UNDEFINED**;
- non-owner: DENY before entitlement lookup.

Product-safe variants that still require an explicit later decision:

1. **Strict current-rights** — current tier must cover historical delivered tier. This is the C14 Audit implementation.
2. **Purchased-snapshot retention** — ordinary downgrade/expiry may retain immutable bytes, while refund/revoke/chargeback locks them. This is more permissive and must be explicitly authorized before use.
3. **Metadata-only after downgrade** — keep a tombstone/index entry visible to owner but hide payload/PDF bytes until current rights cover it.

C14 does not silently choose variants 2 or 3.

## Surface-by-surface result

| Surface | Result | Evidence / behavior |
|---|---|---|
| Workspaces | **CONFIRMED** | live Shield RPC has stored-tier READ/RESTORE guard; C14 reruns isolated C13 regression |
| Reports / regeneration | **CONFIRMED** | current entitlement resolver + post-render `authorizeDelivery()` |
| JSON | **CONFIRMED** | paid regeneration re-authorizes current access |
| PDF | **CONFIRMED** | same current-rights delivery gate; stored exact PDF now additionally archive-gated |
| Immutable archive | **PATCHED IN SOURCE** | new historical access authorizer applied before JSON preview/metadata/PDF bytes |
| DB/blob storage | **PATCHED IN SOURCE** | browser direct SELECT + owner-visible RPC execution revoked by migration; service-role read retained |
| Supabase Storage bucket | **N/A for report bytes** | live only reported bucket is private `r7-execution-transport`; no public report bucket found |
| Restore — Basic report | **CONFIRMED BASIC-ONLY** | live customer bridge binds bearer → active account → owned case → backup account hash → restored report/case |
| Restore — paid workspace | **CONFIRMED except refund mapping** | stored-tier guard blocks lower tier, revoked, expired |
| Download | **PATCHED/CONFIRMED** | account artifact PDF bytes require historical access; responses `private, no-store` |
| Share links | **NO CURRENT PRODUCTION SHARE ROUTE FOUND** | recursive `app/api` route inventory has no share/signed-report route |
| Cache | **CONFIRMED at response boundary** | archive and Basic report routes use `private/no-store`; no report-byte Redis cache path found in audited route |
| API | **PATCHED IN SOURCE** | direct Data API/RPC bypass is removed by privilege migration; application API remains account-bound |

The public fashion route `app/[locale]/archive/page.tsx` is unrelated to customer report history and is not treated as a report archive authority.

## Confirmed bypasses and fixes

### F1 — Historical account route checked owner, not current paid rights

**Before:** `/api/account/customer-artifact` used owner-visible RLS/RPC projections and could return historical paid metadata/preview/PDF to the owner without rechecking current tier.

**Impact:** downgrade/revoke/refund/expiry could leave historical paid bytes reachable through the owner archive.

**Fix:**

- added `lib/reporting/historical-customer-artifact-access.ts`;
- paid Audit artifact access compares immutable required tier with **current server-side entitlement**;
- Basic owner history remains readable;
- unknown paid non-Audit policy fails closed;
- list filters inaccessible artifacts;
- direct single-artifact JSON/PDF request returns a locked response before payload/PDF retrieval.

### F2 — Direct PostgREST / owner RPC bypass

Live readback before C14 showed:

- `authenticated` SELECT on `public.velmere_customer_artifact_snapshots`: **true**
- `authenticated` SELECT on `public.velmere_customer_artifact_pdf_blobs`: **true**
- authenticated EXECUTE on `velmere_get_owner_visible_customer_artifact_v1(text)`: **true**
- authenticated EXECUTE on `velmere_list_owner_visible_customer_artifacts_v1(integer)`: **true**
- RLS enabled on both artifact tables.

RLS correctly isolates owner A from account B, but its policy is ownership-based and has no current-entitlement predicate. Therefore the owner could bypass the application current-rights check.

**Fix:** source-only migration
`supabase/migrations/20260918024500_velmere_c14_historical_artifact_direct_read_boundary.sql`

It:

- revokes direct artifact snapshot/PDF SELECT from `PUBLIC`, `anon`, `authenticated`;
- revokes old owner-visible artifact RPC EXECUTE from those roles;
- retains service-role read capability;
- does not update/delete customer rows.

**Rollout constraint:** do not apply the DB revocation before the server route version is deployed.

### F3 — Live durable paid Audit entitlement ledger is missing

Current code `verifyVlmPaidAccountEntitlement()` expects durable `public.velmere_vlm_paid_entitlements` when Supabase service-role configuration is present.

Live schema readback did **not** contain that relation.

Consequence:

- new paid Audit archive guard is safely fail-closed on live today;
- C14 cannot prove a durable live paid Archive **allow** path;
- this is a blocker for claiming 9/10 or production-complete current-rights history.

This overlaps the Stripe/lifecycle work and should be reconciled with C14-P19 rather than creating a second entitlement authority in P14.

### F4 — Shield refund → revoke mapping unverified

Live `velmere_private.r7_shield_pro_paid_entitlement_events` currently showed:

- `GRANT`: 36
- `REVOKE`: 10

No separate REFUND event kind is present.

The workspace helper correctly denies after REVOKE/expiry, but C14-P14 has no evidence that a Stripe refund is always transformed into a Shield REVOKE event. Therefore `paid → refunded` for Shield is **BLOCKED/UNVERIFIED**, not PASS.

### F5 — paid non-Audit immutable archive semantics are undefined

No reliable source establishes the current SKU mapping and retention semantics for every historical paid Lens/Shield/Real-Markets immutable artifact.

C14 behavior is deliberately fail-closed and marked `POLICY_UNDEFINED`.

### F6 — no current report share-link surface found

Recursive API route inventory found report/artifact routes but no production report-share or signed report-link endpoint. No share-link revocation code was invented.

If a share surface is added later, it must route through the same current-rights decision or carry short-lived revocable authority; a public static PDF URL is incompatible with the strict current-rights variant.

## Owner vs other-account

C14 has both policy and runtime-binding evidence:

- policy matrix test denies other account regardless of tier;
- runtime authorizer test constructs an account-A-bound immutable snapshot and requests it as account B;
- result is `owner_mismatch`;
- the injected entitlement resolver is asserted **not to run**, so cross-account lookup stops before paid authority is considered;
- same owner after Advanced → Pro is denied the Advanced artifact;
- same owner with current Advanced is allowed.
- Shield regression independently confirms `cross-account-is-not-found`.

Live owner RLS remains defense-in-depth, but the new source route no longer treats owner RLS as sufficient paid authority.

## Refund / revoke / expiry lifecycle evidence

The C14 test suite verifies:

- `active → refunded`;
- `active → revoked`;
- `active → expired`;
- refunded/revoked/expired are not privileged;
- active-but-time-expired is not privileged;
- a real in-memory paid entitlement is accepted before lifecycle event;
- after `refund` or `manual_revoke`, the same account/product/context is rejected by `verifyVlmPaidAccountEntitlement()`.

This is stronger than a table-only matrix: the runtime entitlement verifier is exercised.

## Basic backup/restore

Live function `r7-audit-basic-customer-bridge` v4 was read back without mutation.

For restore it requires:

1. valid user Bearer;
2. server capability;
3. valid Supabase user;
4. active account binding;
5. owned Basic case;
6. account-hash-bound backup restore RPC;
7. post-restore `reportId → accountIdHash → caseRef` recheck.

Basic is intentionally not converted into a paid downgrade surface.

## Cache behavior

Historical artifact API:

- dynamic route;
- `cache-control: private, no-store` on successful list/JSON/PDF;
- error paths use `no-store`;
- exact PDF is loaded only after current historical access decision.

Basic report/restore bridge and API:

- `no-store, max-age=0`;
- `pragma: no-cache`.

No customer-report Redis payload cache was found in the audited access path. Redis in this route is used for request limiting, not historical report authority.

## Storage observations

Live Storage bucket inventory:

- `r7-execution-transport`
- public: **false**
- no public report/PDF bucket found.

The historical account artifact PDF path audited here stores exact PDF bytes in the database artifact blob table, so the primary bypass was database/RPC access, not a public Storage object URL.

## Tests

Final green run: GitHub Actions `35293434188`.

### policy-and-types

- strict `tsc -p tsconfig.c14-tests.json`: **PASS**
- C14 historical/lifecycle tests: **9/9 PASS**
  - downgrade matrix
  - higher/lower tier behavior
  - other-account denial
  - undefined paid surface fail-closed
  - invalid tier fail-closed
  - refund/revoke/expiry transitions
  - terminal/expired privilege denial
  - runtime account-A vs account-B binding
  - real memory ledger invalidation after refund/revoke
- static downgrade/report surface check: **PASS**

### direct-read-database

Isolated PostgreSQL 17 fixture: **7/7 PASS**

- authenticated snapshot SELECT revoked
- authenticated PDF SELECT revoked
- anon snapshot SELECT revoked
- authenticated get RPC revoked
- authenticated list RPC revoked
- service-role snapshot SELECT retained
- service-role PDF SELECT retained

No production database was modified.

### Shield workspace regression

Isolated PostgreSQL 17 fixture: **28/28 PASS**, including:

- before-patch Pro can read/restore stored Advanced reproduction;
- guarded patch application;
- after-patch Pro cannot read stored Advanced;
- after-patch Pro cannot restore stored Advanced;
- current Pro can read own Pro;
- cross-account NOT_FOUND;
- anonymous/no-subject/wrong/missing/malformed/expired/deleted session denial;
- revoked grant denial;
- expired grant denial;
- Advanced read/restore Advanced;
- caller cannot lower stored authority by sending `tier=pro`;
- owner delete behavior preserved;
- fixture writes rolled back.

### Intermediate CI note

An early C14 commit `cf60b9f...` had an automated block-replacement syntax defect in the route. Run `35293128034` failed TypeScript parsing. It was immediately fixed in `652867a...`. The final implementation and final run above are green; the failed intermediate run is retained here for audit trace rather than hidden.

## Files changed

- `lib/reporting/historical-customer-artifact-access.ts`
- `lib/server/lazy-route-modules/account--customer-artifact.ts`
- `supabase/migrations/20260918024500_velmere_c14_historical_artifact_direct_read_boundary.sql`
- `config/c14-historical-artifact-access-policy.json`
- `scripts/c14/historical-artifact-access.test.ts`
- `scripts/c14/downgrade-report-surface.test.mjs`
- `scripts/c14/direct-read-boundary-db-test.py`
- `tsconfig.c14-tests.json`
- `.github/workflows/c14-p14-downgrade-reports.yml`

Implementation commits before this documentation-only report commit:

- `cf60b9fd46acd404d4a9ea54b73a757d578b8c34` — initial boundary/tests
- `652867a4c98c2cb3e0cf3ca37169d2cdb28a9cdf` — repaired list block
- `9741a1df4194595fc7c62c1660e14fec0692481e` — explicit owner A/B runtime test
- `310ecb5ff6511fb15c4443481cd274c9641f0018` — refund/revoke ledger integration test; final tested implementation

## Live / cross-area security advisories

These were observed during P14 and were **not** auto-fixed because they belong primarily to the parallel RLS/schema/security work:

1. Supabase table introspection emitted a critical warning that RLS is disabled on multiple `velmere_private` tables. Do not blindly enable RLS without policy design; hand off to C14-P17.
2. Current Supabase security advisor reports:
   - 25 tables with RLS enabled but no policy;
   - 7 authenticated-callable SECURITY DEFINER functions, including the Shield paid-entitlement helper/workspace RPC;
   - leaked-password protection disabled.

Relevant Supabase remediation references:
- RLS enabled/no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- authenticated SECURITY DEFINER executable: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

These advisories are not automatically equivalent to exploitable P14 bypasses; they require P17/P01-style review.

## Safe deployment order

1. Ensure C14-P19 (or the chosen authority owner) provides the durable paid Audit entitlement relation/RPC expected by `verifyVlmPaidAccountEntitlement()`.
2. Deploy the application version containing the historical server-side archive guard.
3. Verify with test accounts:
   - Advanced current → Advanced artifact allowed;
   - Advanced → Pro → Advanced artifact denied / Pro artifact allowed;
   - Pro → Basic → Pro artifact denied;
   - account B denied;
   - refund/revoke/expiry denied.
4. Only then apply `20260918024500_velmere_c14_historical_artifact_direct_read_boundary.sql` to remove direct browser table/RPC reads.
5. Re-test Data API directly with authenticated user JWT and verify SELECT/RPC denial.
6. Confirm Stripe refund/chargeback lifecycle maps into every downstream authority, especially Shield REVOKE.

## Score

### C13: 5/10

Owner isolation and regeneration controls existed, but immutable paid archive access still trusted ownership and direct DB/RPC owner reads could bypass current tier.

### C14-P14 branch: 8/10

Raised because:

- complete requested downgrade/revoke/expiry matrix is encoded;
- owner and other-account behavior is tested;
- current-rights guard is implemented for paid Audit archive;
- direct DB/RPC owner bypass has a tested source migration;
- JSON/PDF/download/cache/storage/restore/workspace surfaces are mapped;
- refund/revoke lifecycle behavior is exercised against the real in-memory verifier;
- Shield regression remains fully green.

Not 9/10 or 10/10 because:

- durable paid Audit entitlement storage expected by the code is absent live;
- new direct-read revocation migration is not deployed live;
- Shield refund → REVOKE mapping is unverified;
- paid non-Audit immutable archive policy is not finalized;
- no real production share-link surface exists to test/revoke.

**Conclusion: C14-P14 source/test qualification = 8/10; production remains at the prior effective state until the deployment blockers above are resolved.**
