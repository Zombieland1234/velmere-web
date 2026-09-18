# Velmère current state — C14-P03 documentation baseline

Audit date: 2026-09-18.  
Audited product-source SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.  
Audited tree SHA: `a5268de961923bf0982506167396cda14c0a1381`.

This file records evidence, not a release promotion.

## Exact C13 qualification

| Claim | Status | Evidence / boundary |
| --- | --- | --- |
| C13 exact-SHA workflow run was 35289099092 | CONFIRMED | GitHub Actions run for `4cb45bb...` |
| Overall workflow conclusion was failure | CONFIRMED | The application job intentionally failed the final open-gates step |
| RELEASE_GATE status is NO_GO | CONFIRMED | C13 evidence `RELEASE_GATE.json` |
| Main qualification checks: 28 PASS, 1 FAIL | CONFIRMED | `QUALIFICATION.json`; the failing check is `eslint-zero-warning` |
| Strict TypeScript passed | CONFIRMED | `QUALIFICATION.json` |
| Production build passed | CONFIRMED | `QUALIFICATION.json` |
| Dependency audit and dependency tree checks passed | CONFIRMED | `QUALIFICATION.json` |
| ESLint had 0 errors and 343 warnings; max-warnings=0 therefore failed | CONFIRMED | `eslint.json` |
| Gitleaks execution returned 22 redacted candidate findings | CONFIRMED | `GITLEAKS_REDACTED.json` |
| Those 22 findings are confirmed live secrets | UNVERIFIED | Scanner matches require adjudication; C14-P03 does not expose or validate secret values |
| Self-hosted production-mode E2E passed | PARTIAL | Real production Next build + local Redis + signed loopback proxy + public RPC; explicitly not hosted Vercel or Stripe TEST |
| Hosted Vercel end-to-end is proven | BLOCKED | C13 open gate `all_product_hosted_E2E` |
| Real Stripe TEST payment lifecycle is proven | BLOCKED | C13 open gate `real_Stripe_TEST_lifecycle` |
| Real Auth A/B lifecycle is proven | BLOCKED | C13 open gate `real_Auth_A_B` |
| Independent review is complete | BLOCKED | C13 open gate `independent_review` |

C13 technical blockers recorded by the release gate are `eslint-zero-warning`, `gitleaks-source` and `missing-historical-scripts`.

## Source and provenance

| Claim | Status | Evidence / boundary |
| --- | --- | --- |
| Tracked file count is 3975 | CONFIRMED | C13 `SOURCE_INVENTORY.json` and Git tree |
| C13 exported source ZIP contains 3973 tracked files | CONFIRMED | `SOURCE_IDENTITY_EXPORT.json` |
| Exactly two tracked resources were omitted from that ZIP | CONFIRMED | `embedded-font-data.ts` and `manrope-pdf-latin-plus-ext.ttf`, both `FONT_RESOURCE_NOT_REDISTRIBUTED` |
| C13 ZIP SHA-256 is `766e739094325d5824f76cfdb03c3ecec9712825e9fd102f5b2f738065ab7ea9` | CONFIRMED | `SOURCE_IDENTITY_EXPORT.json` |
| Original UI2 ZIP identity is confirmed | BLOCKED | `originalUI2ZipIdentityConfirmed=false` |
| Lockfile remained byte-identical during qualification | CONFIRMED | `LOCKFILE_PARITY.json` |
| Qualification working tree stayed fully clean | PARTIAL | `final-working-tree-status.txt` shows `next-env.d.ts` modified by build tooling; source ZIP was still generated from Git HEAD bytes |
| package.json is a reliable inventory of runnable historical commands | BLOCKED | 892 package scripts reference files absent from this checkout |

## Database

| Claim | Status | Evidence / boundary |
| --- | --- | --- |
| C13 isolated PostgreSQL stored-tier fixture passed 28/28 checks | CONFIRMED | C13 SQL artifact `CHECKS.json` |
| Fixture used real PostgreSQL but synthetic schema/auth claims/entitlements | CONFIRMED | `CHECKS.json` scope |
| C13 live Supabase migration 20260917230935 exists in migration history | CONFIRMED | Read-only C14-P03 query to project `yljjyowcvjgjcamffnvd` |
| Live helper function SHA-256 is `233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92` | CONFIRMED | Read-only function-definition hash query |
| Live workspace function SHA-256 is `b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6` | CONFIRMED | Read-only function-definition hash query |
| C13 migration is represented in supabase/migrations in this checkout | BLOCKED | Only the C6D migration SQL is tracked there; C13 SQL is `scripts/c13/shield-workspace-guard.sql` |
| Real HTTP auth + Stripe E2E for this database path is proven | BLOCKED | Explicitly outside C13 SQL fixture and release gate |

## Benchmark

| Claim | Status | Evidence / boundary |
| --- | --- | --- |
| C13 replayed 2472 unique runtime hashes | CONFIRMED | C13 benchmark `MANIFEST.json` |
| All 2472 completed with 0 timeouts and 0 errors | CONFIRMED | `C13-summary.json` |
| These were 2472 new C13 cases | BLOCKED | `COMPARISON.json` says all were previously observed in C9; `newUniqueCases=0` |
| Split is 1200 previously seen development + 1272 previously seen validation cases | CONFIRMED | `MANIFEST.json` |
| C13 outputs changed for 176 cases versus C12 | CONFIRMED | `COMPARISON.json` |
| A 25-case repeated stability subset had 0 unstable cases | CONFIRMED | `COMPARISON.json` |
| Benchmark results prove exploit findings or production accuracy | BLOCKED | Artifact interpretation states heuristic signal comparison; source/runtime association was not independently compiled |

## Product and release authority

The executable product topology used by C13 is `lib/product/vlm-canonical-product-topology.ts` and contains 20 rows across 10 families. The older PASS36 R44P34/R44P35 17-row topology remains historical compatibility material.

The current release-authority JSON still correctly expresses NO_GO / no LIVE / no sale approval, but it also contains older product-count metrics and 13 path-like references to artifacts missing from this checkout. Treat those missing paths as BLOCKED, not as present evidence.

See `PRODUCTS_AND_LIMITATIONS.md` and `CLAIM_LEDGER.md` for the reconciled interpretation.
