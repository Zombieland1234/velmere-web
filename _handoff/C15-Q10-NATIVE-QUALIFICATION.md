# C15-Q10 — exact Q9 admission and native PostgreSQL qualification

Internal integration only. NO_GO. No production migration, customer mutation, real Stripe charge/refund, provider communication, sale enablement or independent-audit claim.

## Source custody
Remote base is Q5 `57a29cfccb9b5e3718ae89c8426e7155a0c086ee`. The accumulated local Q6–Q9 patch is admitted only after SHA-256 `2d8a41171aef4ab915d1b2a326522141fff19dd3016e4b97f607927ea535ecf0` and exact Git tree `993dcc671e94ce1e8e1f2f3bb1b03e00462b3074` match. The workflow verifies a separate index from authentic Q5 before applying the patch. Q10 tooling/workflows are additional explicit files, not part of the earlier Q9 tree. Payload fragments are removed from the active tree, not from history.

## New tests, not a new SQL rewrite
The five Q4–Q8 SQL files and the Q9 diagnostic queries are unchanged. The new native harness requires a disposable loopback PostgreSQL 17 server, the exact database name q10_payment_fixture, a fresh evidence directory, and explicit ISOLATED_TEST_ONLY acknowledgement. That host must never be a production tunnel. It uses separate real connections and records observed pg_blocking_pids waits where an overlap is required.

28 native scenarios cover inbox claims/generations/deadlines, event identity, ordering convergence and blocked-state re-evaluation, terminal holds before/after first grant, shared lifecycle lock order, rollback on failed hold/lifecycle INSERT, outer transaction rollback, replay after a discarded committed reply, read-only reconciliation and its actual shell wrapper, timeout refusal, consistent snapshots, client-role ACLs, matched-client logical backup/restore across seven tables and installer overwrite refusal.

The 16/12/8 simultaneous requests inside scenarios are not additional tests. Native client-role ACL checks are not real user-JWT Auth tests. A discarded successful reply is not packet loss or process death. Logical restore uses roles already present in the isolated cluster and does not qualify Supabase Auth, Storage, PITR or production RPO/RTO. A lease or watermark cannot guarantee exactly-once external effects.

## Prepublication evidence and preserved failures
Local PostgreSQL 17.11 execution finished 28/28. First harness attempt failed when it parsed a bare hexadecimal digest as JSON; the fingerprint query was corrected to return JSON. The next attempt expected a warning without preparing the associated fixture; the retry-pending fixture was added. Neither fix changed product SQL or weakened an assertion. All attempts have distinct evidence directories.

An initially mistyped final payload fragment had a different blob hash and was never referenced by an admission tree. The corrected fragment matches its expected identity. No force push or history rewrite.

The current CI must be read on its own final SHA before claiming a fresh 1023-case regression suite, full build, benchmark or runtime. Successful admission is source identity, not release qualification. Raw lint/secret gates remain unchanged. The full payment Auth/Stripe TEST journey, migration staging/parity, global provider enforcement, privacy/managed recovery, secret-history review and engine quality/generalization remain open.

## Reproduction
Run the Q10 qualification workflow. The new native job bootstraps roles in an empty PostgreSQL 17 service, installs the unchanged five stores with their explicit interlocks and uses backup clients from the exact pulled service image. Operator command:

```bash
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=q10_payment_fixture
export Q10_DISPOSABLE_ACK=ISOLATED_TEST_ONLY
# Supply disposable credentials through environment or a protected pgpass, never CLI logs.
psql -X -v ON_ERROR_STOP=1 -f scripts/c15-q4/bootstrap-roles.sql
python3 scripts/c15-q10/native-qualification.py --install --out /absolute/new/evidence-directory
```

Source export omits two declared font resources; build uses the complete owned Git checkout. No new UI integration or font substitution.
