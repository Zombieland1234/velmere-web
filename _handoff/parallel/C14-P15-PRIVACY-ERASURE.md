# C14-P15 — Privacy / Export / Deletion / Erasure

**Status:** branch implementation complete for the scoped technical foundation; production/live rollout is **not** performed by C14-P15.

**Base:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p15-privacy-erasure`  
**Latest implementation SHA before this report:** `700434fabfb160b3391aae3409fea686c71419d1`  
**C13 score:** 2/10  
**C14-P15 branch score:** **7/10**  
**Current live-system score:** **2/10 until the migration/application changes are deliberately deployed and provider-side flows are verified.**

## Executive summary

C13 had user-facing account export and erasure code, but its durable database contract was not present in the repository schema and, critically, the required export/erasure tables and RPCs were also absent from the live Supabase schema observed during this audit. The public UI therefore described a privacy lifecycle whose durable foundation did not exist.

C14-P15 adds a fail-closed technical foundation without calling a normal SQL delete “full erasure”:

1. explicit cross-system privacy data inventory;
2. bounded private account export with owner binding, idempotency, expiry and SHA-256 integrity;
3. durable deletion request with session-revocation prerequisite;
4. separate service-role approval record carrying retention-policy fingerprint and legal-hold state;
5. application-data deletion/pseudonymization only after a valid approval and clear legal hold;
6. Storage deletion through the Supabase Storage API, never SQL deletion of `storage.objects`;
7. Auth deletion only after Storage cleanup succeeds;
8. a residual-aware execution receipt which is structurally unable to claim full erasure;
9. browser private-cache cleanup after the deletion request is accepted;
10. tombstone/receipt metadata for restore/recovery workflows;
11. automated Node tests plus an isolated PostgreSQL 17 A/B/no-auth lifecycle proof.

This does **not** solve provider/platform retention for Stripe, hosting logs, analytics or historical database backups. Those remain explicit residual blockers.

---

## 1. Confirmed C13/source/live defects

### P0 — application RPCs referenced nonexistent durable objects

Source application code already called:

- `velmere_create_account_data_export_v1`
- `velmere_request_account_erasure_v1`
- `velmere_cancel_account_erasure_v1`
- `velmere_confirm_account_erasure_session_revocation_v1`
- table `velmere_account_data_exports`
- table `velmere_account_erasure_requests`

At the C14-P15 base SHA, those objects were absent from `lib/db/schema.sql`.

Live Supabase inspection also confirmed that these tables did not exist:

- `public.velmere_account_data_exports`
- `public.velmere_account_erasure_requests`
- `public.velmere_account_erasure_receipts`

This is not merely documentation drift. It means the C13 API path did not have the durable DB contract it expected.

### Repo ↔ live migration authority drift

The repository contained only a very small `supabase/migrations` history at the base SHA, while live Supabase reported a substantially richer migration history including older R7 erasure/backup work and C13 migrations. Examples observed live include:

- `r7_durable_erasure_and_staging_summary`
- `r7_audit_basic_backup_erase_restore_lifecycle`
- `r7_audit_basic_exact_pdf_backup_erase_restore`
- `velmere_c13_shield_workspace_stored_tier_guard`

Therefore the new migration is a branch artifact, not proof that repository migration history is currently authoritative for production.

---

## 2. Data inventory

The canonical technical inventory added by this branch is:

`lib/privacy/account-data-lifecycle.ts`

| System / surface | Observed / declared data | Identity keys | Export status | Erasure treatment | C14-P15 status |
|---|---|---|---|---|---|
| Supabase Auth | `auth.users`, identities, sessions, refresh/MFA/OAuth/WebAuthn children | auth UUID, email, phone | safe metadata subset | provider delete after session + Storage cleanup | implemented orchestration; not live-executed |
| Account ↔ Auth binding | subject bindings + binding requests | account_id, Supabase subject | included | delete/cascade | implemented |
| Customer reports | snapshot rows + PDF blobs | account_id, account hash, report_id | metadata only; bytes not duplicated | hard delete after approval | implemented |
| Audit Basic active artifacts | report JSON/PDF | account hash, case/report IDs | metadata only | hard delete after approval | implemented |
| Audit Basic app backup rows | backup JSON/PDF | account hash | metadata only | hard delete after approval | implemented for app-level backup table |
| Audit intake | direct identity + customer target + payment/audit refs + opaque receipt | account_id/email, checkout/payment refs | bounded safe fields | direct identity pseudonymized; payment/audit evidence retained pending policy | implemented |
| Source-declared commerce | orders, entitlements, human-review queue | customer PII, Stripe refs | external/partial | policy-driven pseudonymization required | not safely broad-deleted; source/live mismatch |
| Supabase Storage | object metadata + bytes | owner/owner_id, bucket/name | metadata only | **Storage API remove**, max 1000 per call | implemented server orchestration |
| Browser private account cache | in-memory buckets + legacy localStorage keys | per-tab/local browser state | n/a | local hard purge | implemented |
| Redis rate-limit keys | hashed fixed-window counters | one-way SHA-256 boundary key | n/a | bounded TTL | existing TTL verified; no targeted reverse lookup |
| Market/provider caches | market identity snapshots, klines, market snapshots | market/provider identity | n/a | not user-specific under inspected design | no user-erasure action |
| Vercel/hosting analytics | provider-defined event/request metadata | provider-defined | external | provider retention/delete policy | blocker |
| Hosting/operator logs | request/operational metadata; redacted where safe logger is used | platform-defined | external | provider retention/delete policy | blocker |
| Stripe | customer/payment/subscription/refund/dispute data + local refs | Stripe IDs + customer identity | external | retain/pseudonymize per legal accounting/dispute policy | blocker; no blind delete |
| Platform DB backups | historical DB states | historical copies of prior rows | external | provider retention + deletion replay after restore | blocker |

### Additional observed live facts

The live schema showed direct user/account-bearing columns in:

- `velmere_account_supabase_subject_bindings`
- `velmere_account_supabase_subject_binding_requests`
- `velmere_audit_intake_cases`
- `velmere_customer_artifact_snapshots`
- `velmere_customer_artifact_pdf_blobs`
- `velmere_audit_basic_report_artifacts`
- `velmere_audit_basic_report_backups`
- `velmere_auth_session_families`
- `velmere_durable_computation_jobs`

The ownership semantics of some opaque hashes, especially `velmere_durable_computation_jobs.subject_hash`, were not proven strongly enough to justify destructive deletion. They remain review items rather than guessed joins.

---

## 3. Export flow

Migration:

`supabase/migrations/20260918030000_c14_p15_privacy_export_erasure_foundation.sql`

creates:

- `public.velmere_account_data_exports`
- RLS owner policy
- `public.velmere_create_account_data_export_v1(uuid,text)`
- `public.velmere_purge_expired_account_data_exports_v1()`

### Export contract

Authenticated user only:

`auth.uid() → velmere_current_account_id() → velmere_current_account_binding_hash()`

The RPC binds the export to the current account and persists:

- export UUID;
- account ID and salted/account binding hash;
- idempotency-key hash;
- canonical JSON payload text;
- payload SHA-256;
- payload byte length;
- generated/expires timestamps.

### Included

The bounded payload includes:

- safe Auth profile fields:
  - subject UUID,
  - email,
  - phone,
  - user metadata,
  - account timestamps;
- safe identity-provider metadata;
- account binding metadata;
- audit-intake metadata;
- customer-artifact metadata;
- Storage object metadata.

### Deliberately not duplicated

The export does not create another uncontrolled copy of:

- report PDF bytes;
- complete report snapshot bytes.

The payload explicitly says:

- `legalDsrCompleteness: false`
- external boundaries include Stripe, logs, analytics and platform backups.

That distinction is intentional. This is a real technical customer export, not a false claim that every legal DSAR source has been collected.

### Retention

Account exports expire after 24 hours.

- expired exports for the current account are purged during new export creation;
- a service-role purge RPC exists for scheduled global cleanup;
- **no cron/scheduler was wired in C14-P15**, so this remains an operational rollout item.

Maximum serialized export payload: 8 MiB.

---

## 4. Deletion / erasure flow

### Phase A — customer request

User-facing request remains non-destructive.

1. User creates a current export.
2. User confirms deletion request.
3. Durable request is written.
4. application revokes current Supabase/local session families.
5. service-role confirmation binds the revocation receipt.
6. request transitions to `POLICY_BLOCKED`.

The UI does not claim deletion at this stage.

Public metadata remains equivalent to:

- `executionEligible: false`
- `dataDeleted: false`
- `legalDeletionClaimed: false`

After an accepted request, the browser additionally clears:

- private in-memory account buckets;
- legacy private-account localStorage keys.

### Phase B — owner/legal approval

C14-P15 introduces:

`public.velmere_account_erasure_approvals`

An approval carries:

- request ID;
- approval ID hash;
- account hash;
- approver hash;
- retention-policy SHA-256;
- legal-hold state;
- approval expiry.

Only service role can create or read this control-plane record.

Execution is rejected unless:

- session revocation is confirmed;
- approval exists and is unexpired;
- legal hold is `CLEAR`.

`ACTIVE` legal hold is a hard stop.

**No legal retention duration is invented by the code.**

### Phase C — application data mutation

Internal service-role RPC:

`velmere_execute_account_erasure_application_v1`

performs only approved application-level actions.

Hard-deleted where ownership was proven and an authorized erasure path exists:

- customer PDF blobs;
- customer artifact snapshots;
- Audit Basic active report artifacts;
- Audit Basic application backup rows;
- account export copies;
- binding-request rows;
- selected optional account/session/access-token tables when present.

Direct identity pseudonymized in Audit intake:

- `account_id → erased:<bounded account hash>`
- `account_email → NULL`

The non-null tombstone value is required because paid Audit intake rows have a database constraint requiring an account identifier.

Deliberately retained pending approved policy:

- checkout/payment references;
- audit evidence;
- opaque intake receipt fields;
- security aggregate evidence.

That is why the result is **not full erasure**.

### Phase D — Storage cleanup

The SQL migration intentionally does **not** issue:

`DELETE FROM storage.objects`

Supabase documentation requires Storage object bytes to be removed via the Storage API; deleting metadata directly in SQL can orphan actual objects.

The server orchestrator:

`lib/privacy/account-erasure-service.ts`

uses:

`client.storage.from(bucketId).remove(names)`

with batches of at most 1000 object names.

If any Storage batch fails:

- Auth deletion is not attempted;
- finalization writes a partial `BLOCKED_STORAGE` state;
- the operation remains retryable;
- no completion claim is made.

### Phase E — Auth deletion

Only after Storage cleanup succeeds:

`client.auth.admin.deleteUser(supabaseSubject)`

is executed.

The account-subject binding has an observed `ON DELETE CASCADE` FK to `auth.users`, so the durable binding is removed when the Auth user is deleted.

If Auth deletion fails:

- receipt becomes `BLOCKED_AUTH`;
- application/Storage work is preserved as partial state;
- no completion claim is made.

### Phase F — residual-aware receipt

`public.velmere_account_erasure_execution_receipts`

records:

- application-data state;
- Storage state;
- Auth state;
- number of Storage objects removed;
- deleted scopes;
- pseudonymized scopes;
- retained scopes;
- residual blockers;
- failure code;
- receipt SHA-256;
- completion timestamp.

The DB enforces:

`full_erasure_claimed = false`

The TypeScript parser also rejects any receipt that tries to set the field to `true`.

On successful Storage + Auth completion, an intentionally minimal tombstone is recorded:

`public.velmere_account_erasure_tombstones`

with:

- account hash;
- final receipt hash;
- completion timestamp;
- `restore_replay_required=true`.

The raw deletion request is then removed. The tombstone is for recovery/replay control, not evidence that historical provider backups were surgically erased.

---

## 5. Redis, cache and retention behavior

### Redis

The inspected Redis limiter uses a one-way hashed key:

`velmere:rl:v2:<sha256(...)>`

It does not retain a reversibly addressable raw account identifier in the key.

Maximum configured window accepted by code: 24 hours.

Each key receives expiry at approximately:

`window reset + 30 seconds`.

Therefore C14-P15 classifies Redis rate-limit state as **bounded residual TTL**, not immediate account erasure. There is no honest way to target the one-way key from an account ID without retaining an additional reverse index.

### Browser

Implemented immediate cleanup after accepted deletion request:

- private tab memory cleared;
- legacy private-account localStorage keys removed.

### Market/provider caches

Inspected market metadata/kline/snapshot caches are keyed by market/provider identity, not user/account identity, so they are classified as non-user-specific under the current implementation.

---

## 6. Reports and application backup semantics

Existing R7 functions showed why “SQL DELETE” is insufficient terminology.

Observed patterns include:

- export of customer artifacts only;
- deletion of customer artifact tables through an authorized guard;
- Audit Basic flows that first copy report/PDF into an application backup table and then delete the active row;
- later purge functions for backup rows.

Moving bytes from an active table into a backup table is retention/relocation, not full erasure.

C14-P15 therefore:

- removes the active customer report rows for an approved request;
- removes the application-level Audit Basic backup row for that account hash once legal hold is clear;
- still lists **platform backups** as a residual blocker.

---

## 7. Security boundaries

### RLS

User-readable export and request tables:

- RLS enabled;
- no anon table access;
- authenticated reads only where both account ID and account hash match the current account binding.

### Operator-only actions

The following are service-role only:

- session-revocation confirmation;
- approval recording;
- application-erasure execution;
- erasure finalization;
- global expired-export purge;
- approval table;
- receipt table;
- tombstone table.

The isolated PG17 test explicitly verifies that `authenticated` cannot execute the destructive application-erasure RPC.

### SECURITY DEFINER

New functions use fixed search paths and narrow grants. Destructive RPCs are not granted to anon/authenticated.

---

## 8. Automated tests

### Unit / orchestration test

`scripts/c14/privacy-erasure.test.ts`

Covers:

- requested inventory surfaces;
- full-erasure claim always false;
- parser rejects a forged `fullErasureClaimed:true`;
- Storage batching <= 1000;
- Storage deletion precedes Auth deletion;
- Storage failure prevents Auth delete;
- Auth failure records a partial state.

### Real PostgreSQL 17 A/B/no-auth test

`scripts/c14/privacy-erasure-db-test.py`

Uses an isolated PostgreSQL 17 service and synthetic identities only. It does not mutate production data.

The test covers:

- user A export;
- user B isolation;
- missing-auth denial;
- export secret exclusion;
- idempotency;
- request lifecycle;
- session-revocation prerequisite;
- approved execution;
- sanctioned immutability-erasure guard path;
- hard deletion of owned report/application-backup rows;
- direct-identity pseudonymization;
- preservation of user B;
- proof that SQL phase leaves Storage objects for the provider API;
- simulated Storage API/Auth ordering;
- legal-hold hard stop;
- authenticated-role denial on operator RPC;
- receipt refusing full-erasure semantics.

Latest implementation SHA DB output:

```json
{
  "schemaVersion": "velmere.c14-p15.db-test.v1",
  "status": "PASS",
  "checks": {
    "export_owner_isolation": true,
    "export_secret_exclusion": true,
    "no_auth_denied": true,
    "idempotency": true,
    "artifact_erasure_guard_path": true,
    "storage_api_boundary": true,
    "auth_delete_order": true,
    "cross_account_preserved": true,
    "legal_hold_blocks_execution": true,
    "operator_rpc_not_authenticated": true,
    "full_erasure_claim_false": true
  }
}
```

### CI

Workflow:

`.github/workflows/c14-p15-privacy-erasure.yml`

A complete green qualification exists on SHA:

`b355edba6dd70b7f4da1a54d7f77ab679d808aba`

Run:

`35293301943`

Results:

- `unit-contract` — PASS
- `postgres-ab-noauth` — PASS
- `typecheck` — PASS

The final implementation SHA before the handoff-only commit:

`700434fabfb160b3391aae3409fea686c71419d1`

also has a complete green qualification in run:

`35293346992`

Results:

- `unit-contract` — PASS
- `postgres-ab-noauth` — PASS
- `typecheck` — PASS

This run includes the final blocker-label correction and is the exact code SHA used as the C14-P15 tested implementation reference.

---

## 9. Files changed

- `lib/privacy/account-data-lifecycle.ts`
- `lib/privacy/account-erasure-orchestrator.ts`
- `lib/privacy/account-erasure-service.ts`
- `supabase/migrations/20260918030000_c14_p15_privacy_export_erasure_foundation.sql`
- `components/account/AccountErasurePanel.tsx`
- `lib/account/account-erasure.ts`
- `scripts/c14/privacy-erasure.test.ts`
- `scripts/c14/privacy-erasure-db-test.py`
- `.github/workflows/c14-p15-privacy-erasure.yml`
- `_handoff/parallel/C14-P15-PRIVACY-ERASURE.md`

---

## 10. Legal / infrastructure blockers

These are intentionally **not** converted into fake technical claims.

### BLOCKED — approved retention schedule

There is no verified signed owner/legal policy in this branch specifying exact retention periods for:

- accounting/tax evidence;
- payment/refund/dispute evidence;
- security/audit evidence;
- legal hold;
- provider-side data.

The code records a policy fingerprint and legal-hold state but does not invent durations.

### BLOCKED — Stripe provider data

C14-P15 does not delete Stripe customers, payments, subscriptions, refunds or dispute records.

Reasons:

- payment/accounting/dispute retention requires legal review;
- provider-side lifecycle is not wired;
- deleting provider evidence blindly could destroy required records.

### BLOCKED — hosting logs

A redaction formatter exists, but repository code does not control every hosting/runtime log store or retention schedule. No per-user platform-log DSAR/delete integration is proven.

### BLOCKED — analytics provider

The app can call `window.va`, but no provider-side per-user export/delete interface is wired or proven.

### BLOCKED — historical platform backups

The application cannot surgically mutate historical Supabase/PostgreSQL backups.

The tombstone provides a control signal for future restore procedures, but:

- no automatic post-restore erasure replayer was added;
- a backup older than the deletion tombstone may restore historical personal data;
- operator/provider restore runbooks must reapply completed erasures.

### PARTIAL — Redis

Current inspected rate-limit state expires automatically and uses one-way keys. It cannot be immediately account-targeted without a reverse index. Residual lifetime is bounded by the rate-limit window plus the safety margin.

### PARTIAL — source-declared future commerce tables

The repository monolith declares user/payment tables not observed in the live schema queried during P15. Because migration authority is already drifted, C14-P15 does not blindly execute destructive SQL against guessed future/legacy layouts.

### PARTIAL — opaque hash ownership

Some tables use `subject_hash`/fingerprint-style identifiers without a fully proven reversible ownership mapping. They are not deleted based on guesswork.

---

## 11. Production rollout gates

Do not treat this branch as live erasure until all of the following are completed deliberately:

1. reconcile repository migration authority with live Supabase migration history;
2. review the C14-P15 migration against the exact target schema;
3. approve retention/legal-hold policy and operational authority;
4. deploy migration in a controlled non-production environment first;
5. run real Supabase Auth A/B/no-auth tests;
6. run real Storage object removal tests;
7. prove session revocation followed by Storage then Auth deletion;
8. verify browser cache cleanup in the deployed application;
9. wire and verify the expired-export scheduler;
10. add restore runbook automation that replays deletion tombstones;
11. define Stripe/log/analytics/provider retention and DSAR procedures;
12. only then enable operator execution in production.

**C14-P15 did not apply the migration to live Supabase and did not delete production customer data.**

---

## 12. Score: 2/10 → 7/10

### Why the branch earns 7/10

Confirmed improvements:

- real data inventory across requested technical surfaces;
- export storage/RLS/RPC implemented;
- owner binding and A/B isolation tested;
- deletion request lifecycle implemented;
- session revocation prerequisite preserved;
- approval + legal-hold gate implemented;
- controlled application hard-delete paths implemented;
- pseudonymization where blind deletion is inappropriate;
- Storage API boundary implemented;
- Auth deletion ordered after Storage;
- browser private-cache cleanup;
- bounded Redis residual documented;
- auditable receipt + tombstone;
- structural prohibition on `fullErasureClaimed=true`;
- real PostgreSQL 17 A/B/no-auth test;
- unit/orchestration tests;
- strict TypeScript green on a complete qualification run.

### Why it is not 8–10/10

Still missing/blocked:

- migration is not deployed;
- no real live/test Supabase provider E2E for Storage + Auth deletion;
- no approved legal retention matrix;
- Stripe provider lifecycle unresolved;
- hosting-log lifecycle unresolved;
- analytics provider lifecycle unresolved;
- historical platform backups unresolved;
- expired-export cron not wired;
- post-restore erasure replay not automated;
- repo/live migration authority remains drifted;
- some future/source-declared commerce and opaque-hash ownership mappings are not sufficiently proven for destructive cleanup.

### Critical distinction

**Branch technical readiness: 7/10.**  
**Current live privacy/erasure capability: remains approximately 2/10 until this work is reviewed, deployed and provider-side behavior is proven.**

That distinction is intentional and should be preserved in C14 integration.
