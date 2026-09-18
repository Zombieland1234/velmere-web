# C14-P03 — Documentation audit handoff

Branch: `parallel/c14-p03-documentation`  
Audited source base: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
Audited source tree: `a5268de961923bf0982506167396cda14c0a1381`  
Documentation branch HEAD: updated at finalization  
Merge performed: **NO**

## Scope

C14-P03 audited all 18 human-readable `.md/.txt` files in the base checkout, the environment examples that act as operational documentation, and the current authority/product/provider JSONs needed to resolve conflicts. It also inspected exact C13 GitHub Actions evidence and performed read-only Supabase checks for the migration/function claims already recorded by C13.

No UI or product logic was changed.

## Rating

Documentation baseline: **7/10**.  
C14-P03 result: **9/10**.

Why not 10/10:
- original R16 ledger remains unavailable;
- original missing C12/R16 material was not fabricated;
- original UI2 ZIP identity remains unconfirmed;
- 13 authority-referenced artifacts are absent from the checkout;
- 892 package scripts reference missing historical files;
- provider-rights evidence is empty/stale for current commercial approval;
- C13 migration is live and its SQL is tracked, but not under `supabase/migrations`;
- public PactVerity Git lineage to the current repo is unresolved.

These remaining issues are evidence/recovery gaps, not claims that documentation can truthfully paper over.

## Exact C13 facts recovered

- Workflow run `35289099092` at exact source SHA concluded `failure` because open technical/release gates remain.
- `RELEASE_GATE=NO_GO`.
- `QUALIFICATION.json`: 28 PASS / 1 FAIL; failing gate is `eslint-zero-warning`.
- `eslint.json`: 0 errors, 343 warnings.
- Gitleaks: 22 redacted candidate findings; scanner exit 1. The candidates were not promoted to confirmed-secret claims.
- Production build and strict TypeScript passed.
- Self-hosted production-mode E2E passed, but is explicitly not hosted Vercel or Stripe TEST.
- C13 isolated PostgreSQL fixture: 28/28 PASS.
- Benchmark: 2472/2472 completed, 0 timeouts/errors, 0 new unique cases versus C9 observation history, 176 changed outputs versus C12, 25-case stability replay with 0 unstable.
- Source: 3975 tracked files; 3973 in C13 ZIP; exactly two tracked font resources excluded.
- `originalUI2ZipIdentityConfirmed=false`.
- `package.json`: 925 scripts; 892 reference one or more absent historical script files.
- C13 product manifest: 20 customer rows; active/sellable count `NOT_ASSUMED`.

## Supabase verification

Read-only checks against project `yljjyowcvjgjcamffnvd` confirmed:
- migration `20260917043048 velmere_c6d_shield_session_and_null_validation`;
- migration `20260917230935 velmere_c13_shield_workspace_stored_tier_guard`;
- helper function hash `233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92`;
- workspace function hash `b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6`.

This confirms the narrow C13 deployment record. It does not prove real HTTP Auth or Stripe E2E.

## Main inconsistencies found

1. C13 trigger documentation had no final exact-SHA run result and could be misread as a successful release qualification.
2. Older PASS36 product material uses a 17-row model, while current P66/source topology and C13 product manifest use 20 rows / 10 families.
3. PDF is historical as a separate family in older topology, but P66 defines it as an Audit/Browser output artifact.
4. Current-release authority retains valid NO_GO truth but also historical product counters and 13 references to absent artifacts.
5. No root README/current-state/runbook/recovery/product-limit/provider-rights documentation existed.
6. `ENV_PRODUCTION_READY.example` contained a commercial-ready example flag set true despite the current NO_GO state.
7. 892 package scripts point to missing historical files, so `package.json` cannot be treated as a runnable command catalog.
8. Provider technical integration and rights were not reconciled in one current document; PASS22 evidence is empty and P90 reverify dates are stale.
9. ECB R7 review expired on 2026-08-31.
10. The source ZIP omits two font resources and is not a byte-complete Git replacement.
11. Current renderer source imports embedded Nimbus CFF data while older font-boundary material describes an external runtime font policy; scope needed clarification.
12. C13 live migration is not present under `supabase/migrations` even though its guarded SQL exists under `scripts/c13`.
13. C12 deployment documentation contained a session-specific Vercel connector statement that was not durable product truth.
14. The C13 2472-case corpus is a replay of cases already observed in C9, not 2472 new independent audits.
15. Public PactVerity evidence cites three SHAs that do not resolve as commits in the current velmere-web repository; current lineage is unverified.
16. Historical C10-C12 files were not clearly labelled as historical relative to C13.

## Corrections

C14-P03 adds a current documentation index, exact C13 status, bounded runbook, recovery procedure, current product/limitation model, provider-rights boundary and classified claim ledger. Historical C10-C12 documents are retained as historical evidence rather than rewritten into new facts. C13 qualification/recovery notes are tied to the exact final run. Operational examples are prevented from implying production/commercial readiness.

Missing C12 originals, R16 ledger and missing authority artifacts are not invented.

## Remaining work

- Recover and hash-bind the 13 missing authority artifacts if they still exist.
- Decide whether historical package scripts should be removed, quarantined into a historical manifest, or restored from proven source.
- Adjudicate the 22 redacted Gitleaks candidates without exposing secrets.
- Bring ESLint to zero warnings if zero-warning is a release requirement.
- Re-capture provider terms/rights with current dates and exact commercial use cases.
- Canonicalize the C13 migration into the repository migration lineage without pretending it was historically present there.
- Recover original R16 only from authentic evidence.
- Resolve source lineage to any earlier UI2/PactVerity artifacts using hashes/commit ancestry, not naming similarity.
- Run and record real Stripe TEST, real Auth A/B, hosted all-product E2E, global provider enforcement and independent review before changing NO_GO.

## Classification rule

Every material current claim introduced by C14-P03 is classified in `docs/CLAIM_LEDGER.md` as CONFIRMED, PARTIAL, UNVERIFIED or BLOCKED. Historical records are preserved rather than silently rewritten into stronger claims.
