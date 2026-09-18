# C15-Q3 — internal integration and qualification

Internal release engineering, not an external independent audit. **NO_GO**. No main/C13 merge, production promotion, customer-data mutation, provider-rights activation or real payment.

## Source admission

Canonical parent for this continuation: C14B `e718df06d20a8129ffe261eef9c6c74cc5c91729`, tree `73fa0bd905b2504e39c824f286424992affbd712`. Branch: `c15/qualification-q3-20260918`.

The reviewed local Q2 patch has SHA-256 `4cda99eff0433ec9f6ff5a6b703e97041aaa0d06c1cf63df52eac5d614d1f406` and 82,829 bytes. CI applied it to the canonical parent plus the new qualification workflow. Removing only the declared bootstrap files from a temporary index reproduced exact Q2 tree `b98417b5c52d6cc198ec2013bd40b814bda9b3c8`. Only then was the source committed as `23d3da2132a44cdbe486f6b79bf364685525fb4c` (tree `47051d657cc1e6b38138127286d764164d70aee3`). Transfer fragments were removed from active source, not from Git history. The receipt is `_handoff/c15-q3/INTEGRATED_SOURCE.json`.

No blanket parallel-branch merge was performed. This admits the existing Q2 source, including the CALL/STOP detector correction, benchmark input-integrity/no-overwrite checks and terminal-payment receipt/binding corrections. Those are previously reviewed local changes, not newly discovered Q3 bugs. Engine identity remains `Velmère-V2.5.2`. App UI, CSS, public assets, lockfile and production policies were not redesigned or relaxed.

## Qualification identity and reproducibility

Workflow: `.github/workflows/c15-q3-qualification.yml`. Only the admission job has contents-write permission; it publishes solely to this continuation branch with a non-forced push. Other jobs use read-only checkout credentials and the exact source SHA returned by admission. A first workflow trigger may therefore differ from the newly committed source SHA. Evidence records `sourceSha` explicitly; never relabel the trigger as the tested source.

Initial admission run `35377389607` failed after the reviewed source tree had matched: removing the transfer files also removed their empty directory before receipt creation. No source commit was pushed by that failed attempt. The workflow now recreates that directory; the failed run and original artifact remain available. A transfer-character correction was also made before admission; patch identity checks were not bypassed.

Successful admission and first qualification run: `35377655308`. The first source-qualified commit is `23d3da2132a44cdbe486f6b79bf364685525fb4c`. This document is a subsequent documentation-only change; the same workflow will qualify its exact commit again. The final machine receipts for that run, not an inferred test count, define its results.

Reproduction from a full owned checkout:

```bash
npm ci --foreground-scripts --no-fund
export GITHUB_SHA="$(git rev-parse HEAD)"
export GITHUB_REF_NAME=c15/qualification-q3-20260918
export C6_SOURCE_SHA="$GITHUB_SHA"
python3 scripts/c14-integration/qualify-core.py
# Independent job / clean output directory, with network access:
export VELMERE_BENCHMARK_BASELINE_SHA=e718df06d20a8129ffe261eef9c6c74cc5c91729
bash scripts/c14-integration/benchmark.sh
```

Core collects the entire registered test list, including `.test.mjs`. Expected scope inherited from Q2 is 636 cases (484 C14B + 70 C15 + 28 Q1 + 54 Q2); only the actual TAP result qualifies them. Focused repeats, Python triage, SQL, Redis, compiler matrices and E2E checkpoints are reported separately, never summed into that number. Node is pinned to 24.18.0. The unchanged zero-warning gate remains mandatory.

## First fresh full-corpus measurement on committed C15

The first qualified source ran the complete previously seen CGT selection: 2,472 unique runtime bytecodes and 11,216 unambiguous contract-class pairs; 207 ambiguous pairs were excluded by the unchanged existing rule. Both baseline e718 and candidate completed all 2,472 inputs without errors or timeouts. Raw JSONL matrices were independently recomputed locally and match all 38 per-class summaries.

| Metric | C13 historical | C14B baseline | C15 first committed qualification |
|---|---:|---:|---:|
| TP | 172 | 356 | 356 |
| TN | 7538 | 7390 | 7390 |
| FP | 870 | 1018 | 1018 |
| FN | 2636 | 2452 | 2452 |
| Precision | 16.51% | 25.91% | 25.91% |
| Recall | 6.13% | 12.68% | 12.68% |
| F1 | 8.94% | 17.03% | 17.03% |

One findings digest changed: an additional SWC-104 candidate was emitted on a case assessed only for SWC-996. It is neither a scored TP nor a scored FP for SWC-104. No class aggregate improved or regressed. Twenty-five repeated stability cases had no changed finding digests; they are not 25 new unique inputs. **GENERALIZATION UNVERIFIED.** No blind holdout, chain execution or external safety certification is implied. The earlier 28/32 to 32/32 compiler matrix is not a substitute for this corpus result.

## Runtime, persistence and deployment observations

The first committed source completed 17/17 checkpoints of one actual production Next.js / public RPC / worker / private Redis / signed-proxy Basic scenario. JSON GET/POST, PDF and visible browser reports completed; paid anonymous requests were refused, shared quota held across processes, Redis outage failed closed and AOF recovery retained exhausted quota. This is isolated CI, not hosted Vercel or a paying customer.

28/28 controlled-identity PostgreSQL checks and one isolated PostgreSQL/Redis/object-file restore drill passed. Managed Supabase Auth/Storage/PITR, production RPO/RTO and the paid lifecycle remain unqualified. Raw current Gitleaks still reports 22 findings, with exact current-source triage passing; the full Git scan reports 28 findings. History and environment review remain open, and raw scanner gates remain red.

A read-only catalog query on the connected Supabase database at `2026-09-18 18:01:32.071394+00` established that no function named `velmere_apply_vlm_paid_entitlement_lifecycle_event` exists in any cataloged schema, and no relation named `velmere_vlm_paid_entitlements` exists (including the public table expected by application code). This strengthens the earlier observation based only on generated public types. It is a blocker for that configured database, not proof that no other deployment exists. No replacement schema was invented or applied.

Read-only reproduction (catalogs only, no customer rows):

```sql
select statement_timestamp() as observed_at,
 exists(select 1 from pg_proc where proname='velmere_apply_vlm_paid_entitlement_lifecycle_event') as lifecycle_function_exists_any_schema,
 to_regclass('public.velmere_vlm_paid_entitlements') is not null as public_entitlement_table_exists,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p','v','m') and c.relname='velmere_vlm_paid_entitlements') as entitlement_relations_any_schema;
```

The current Shield workspace function hash still matches `b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6`, with anon execute false and authenticated execute true. This is metadata parity, not an additional paid HTTP flow.

## Release gates and handoff

Run core, benchmark, runtime, database-restore and secrets on the exact final commit. Keep every failed/blocked step and original run ID. `READY`, a valid receipt hash, a generated schema type or a green unit suite does not prove paid product availability. Full auth A/B, actual Stripe TEST checkout/webhook/grant/refund/revoke, all product paths, privacy/erasure, provider enforcement, managed recovery, history-secret review and external validation remain open.

Overall readiness is not raised from the last 4/10 baseline solely because source is now committed or CI is green in a subset. The release verdict remains **NO_GO**. Original R16's 381 IDs and earlier P01-P30 decisions are preserved in the private delivery history; they are not newly replayed or re-reviewed here. R16 repair percentage remains N/D.

Source delivery is exported from the qualified Git commit, with declared font-resource omissions. A reduced ZIP is not a self-contained full checkout or a standalone build attestation. Private provider correspondence and raw third-party corpus inputs are not published in this repository. Six owner-facing documents and the full evidence index are assembled separately after final result verification.
