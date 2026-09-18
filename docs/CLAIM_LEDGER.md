# Velmère documentation claim ledger — C14-P03

Status meanings:
- **CONFIRMED** — directly supported by current source, Git, exact C13 artifacts or a read-only live check explicitly named here.
- **PARTIAL** — part of the claim is supported, but scope is narrower than the wording could imply.
- **UNVERIFIED** — no sufficient evidence was found in the audited material.
- **BLOCKED** — evidence is missing, stale, contradictory, or an explicit release gate prevents the stronger claim.

## Current-source claims

| Material claim | Status | Source / reason |
| --- | --- | --- |
| Current audited source is `4cb45bb...` | CONFIRMED | Git commit and C13 source identity |
| Tree is `a5268de...` | CONFIRMED | Git commit tree and C13 source identity |
| C13 is fully green | BLOCKED | Actions run 35289099092 conclusion failure; `RELEASE_GATE=NO_GO` |
| C13 production build passes | CONFIRMED | `QUALIFICATION.json` |
| C13 strict TypeScript passes | CONFIRMED | `QUALIFICATION.json` |
| C13 zero-warning ESLint passes | BLOCKED | 343 warnings, exit 1 |
| C13 Gitleaks is clean | BLOCKED | 22 redacted candidate findings, exit 1 |
| The 22 scanner hits are real exposed credentials | UNVERIFIED | Not adjudicated in C14-P03 |
| Source ZIP is identical to Git checkout | BLOCKED | Two tracked font resources excluded |
| Source ZIP identity with original UI2 ZIP is proven | BLOCKED | Explicit false in source identity |
| package.json commands are all runnable | BLOCKED | 892 scripts reference missing files |
| Current topology has 20 customer rows / 10 families | CONFIRMED | C13 `PRODUCT_MANIFEST` + P66 topology |
| Older 17-row topology is current | BLOCKED | Superseded for current customer topology by P66/source manifest |
| Current release is sale-ready | BLOCKED | NO_GO, `saleEnabled=false` |
| Original R16 fixed percentage is known | BLOCKED | Original ledger unavailable; `r16FixedPercent=null` |

## Historical C10-C13 files

| File / claim | Status | C14-P03 interpretation |
| --- | --- | --- |
| C10 trigger SHAs `80385a0...` and `3cfc40d...` exist | CONFIRMED | Both resolve in current Git history |
| C10 2472-runtime corpus was new independent audit work | BLOCKED | Later C13 manifest says all 2472 were already observed in C9; replay only |
| C10 R16 original ledger unavailable | CONFIRMED | C13 gate still records `R16_original_ledger` open |
| C10 receipt SHA `2d85faf...` exists | CONFIRMED | Git commit resolves |
| C11 qualification base `8841c625...` exists | CONFIRMED | Git commit resolves |
| C11 worker time budget proves global sandbox/isolation | BLOCKED | C11 note itself limits the claim |
| C11 trigger source `3566b3b...` exists | CONFIRMED | Git commit resolves |
| C12 trigger parent `5e93f367...` exists | CONFIRMED | Git commit resolves |
| C12 self-hosted E2E proves Vercel | BLOCKED | C12/C13 explicitly say it does not |
| C13 trigger parent `588d881...` and C12 baseline `9a176fe...` exist | CONFIRMED | Both Git commits resolve |
| C13 trigger file by itself proves the final run passed | BLOCKED | Trigger predates final exact-SHA run result |
| C13 recovery parent `6379f4d...` exists | CONFIRMED | Git commit resolves |

## Supabase claims

| Claim | Status | Evidence |
| --- | --- | --- |
| C6D migration 20260917043048 is present live | CONFIRMED | Read-only migration-history query, 2026-09-18 |
| C13 migration 20260917230935 is present live | CONFIRMED | Read-only migration-history query, 2026-09-18 |
| C13 helper/workspace live function hashes match `shield-live-deployment.json` | CONFIRMED | Read-only `pg_get_functiondef` SHA-256 queries |
| C13 SQL fixture passed 28/28 | CONFIRMED | Exact-run SQL artifact |
| Historical C6D README 14/14 count is independently re-proven by C14-P03 | UNVERIFIED | Original C6D raw run was not reconstructed; current C13 has a different 28-check fixture |
| Historical prior 6/13 count is independently re-proven | UNVERIFIED | Retained only as historical text |
| `supabase/migrations` contains complete C13 migration history | BLOCKED | C13 SQL is outside that directory |

## Product/provider claims

| Claim | Status | Evidence |
| --- | --- | --- |
| PDF is a separate current product family | BLOCKED | P66 says PDF is an output artifact |
| Angel, Whale Watch, Market Impact and Risk Indicator have Basic/Pro/Advanced customer tiers | BLOCKED | P66 says standalone/no-tier |
| Shield and Shield Pro are separate tiered families | CONFIRMED | P66/source topology |
| Technical provider code means commercial rights | BLOCKED | Provider registry separates `technicalState` from `rightsState` |
| Current provider-rights evidence is globally complete | BLOCKED | PASS22 evidence array empty; P90 currentness dates stale |
| ECB review is current | BLOCKED | `validUntil=2026-08-31` |
| Chainlink response proves commercial data license | BLOCKED | Registry explicitly keeps rights unverified despite brand response |

## Public PactVerity evidence package

| Claim | Status | Evidence |
| --- | --- | --- |
| The package is intentionally scoped as a historical reproduction record | CONFIRMED | Its README/REPRODUCE language |
| Cited SHAs `b34f4f3...`, `596633a...`, `2ed0bfb...` resolve in current velmere-web Git | UNVERIFIED | GitHub API returns no commit for those SHAs in this repository |
| Therefore the package is current C13 release evidence | BLOCKED | No current-repo lineage proven; package predates C13 |

## Current authority pointers

`config/pass36/current-release-authority.json` remains useful for its NO_GO / no-live / no-sale boundary, but C14-P03 found 13 path-like references whose target files are absent from this checkout. Claims requiring those missing target artifacts are BLOCKED until the artifacts are recovered and hash-bound.

This ledger intentionally does not invent missing C12 originals, an R16 ledger, or missing PASS36 artifacts.
