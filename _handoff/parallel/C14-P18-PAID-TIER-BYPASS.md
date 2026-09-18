# C14-P18 — Paid-tier bypass qualification

**Date:** 2026-09-18  
**Repository:** `Zombieland1234/velmere-web`  
**Base:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p18-paid-tier-bypass`  
**Tested implementation SHA:** `5f226882674e4017027f25245e3f0b5a90050c1e`  
**Merge:** not performed  
**C13 paid-tier score:** 8/10  
**C14-P18 result:** **9/10**

## Executive result

C14-P18 tested the canonical 20-product customer catalog plus the shared paid authorization boundaries used by the relevant API, report, PDF, export and Shield Pro workspace paths.

One real authorization-scope defect was confirmed and fixed:

- **C14-P18-01 — same-account cross-surface paid entitlement reuse.**
- A technical Pro analysis SKU is intentionally shared by several customer product families.
- The memory/account lookup and direct `entitlementId` verification did not previously bind the entitlement to the requested `surface` / `depth`.
- This allowed a valid entitlement from one paid analysis surface to be considered for a different paid analysis surface on the same account.
- Cross-account access was not required for this bypass.
- The direct-ID variant was especially important because it used the durable entitlement lookup path as well.

The fix binds paid authorization to account + technical product + surface + depth (plus existing case/asset/symbol bindings where present), and forces the audit wrappers to preserve the audit surface.

No public checkout was enabled. No real charge was made. Advanced remains `NOT_FOR_SALE` in the current commercial policy.

## Reproduction → patch → retest

### C14-P18-01 — cross-surface entitlement reuse

**Pre-patch reproduction**

Run: **35292797416**  
SHA: `ee8722eed71855dc72fe86e99643b5e295dd7b2e`

The regression reached the security assertion and failed with:

`Shield Pro entitlement must not authorize Real Markets Pro`

Observed value: `true !== false`.

Two earlier red runs (**35292553542**, **35292636161**) were harness failures and are explicitly **not** counted as vulnerability evidence.

**Root cause**

1. `verifyVlmPaidAccountEntitlement` accepted a broad memory fallback for the same technical product/account without requiring the explicitly requested surface/depth.
2. `verifyVlmPaidEntitlementById` checked product, account, status, expiry and optional case/asset/symbol, but had no surface/depth comparison.
3. `resolveVlmAdvancedOnlyAccess` passed direct entitlement IDs to the by-ID verifier without a surface/depth binding.

Because `vlm_pro_analysis_single` is reused by multiple product families, technical SKU equality alone was not a sufficient authorization boundary.

**Patch**

- `lib/commerce/vlm-entitlement-ledger.ts`
  - account lookup now honors explicitly requested `surface` and `depth`;
  - by-ID verification accepts and checks `surface` / `depth`;
  - new fail-closed errors: `entitlement_surface_mismatch`, `entitlement_depth_mismatch`.
- `lib/commerce/vlm-advanced-only-access-policy.ts`
  - direct header/query entitlement IDs are verified against the request context surface/depth.
- `lib/commerce/vlm-paid-surface-guard.ts`
  - audit wrappers force the policy-owned `audit` surface when verifying paid records.

**Retest**

- run **35292860135** — PASS after ledger scope binding;
- run **35292867717** — PASS after direct-ID scope binding;
- run **35293323299** — full C14-P18 matrix + attack surfaces + TypeScript — **PASS**.

The pre-patch run stops on the first cross-surface assertion; therefore the direct-ID manifestation is proven pre-patch by the reviewed verifier logic and covered explicitly by the post-patch regression rather than by a second pre-patch failing line.

## Canonical product matrix

Legend:

- **FREE** — no paid entitlement required (ordinary auth/rate limits may still apply to a specific operation).
- **DENY** — no correct paid entitlement; fail closed.
- **ALLOW exact Pro** — active Pro server entitlement for the exact product/surface context.
- **ALLOW exact Advanced*** — active exact Advanced server entitlement is technically verifiable; current commercial policy remains `NOT_FOR_SALE`.
- **NO implicit promotion** — a different/higher technical entitlement is not silently substituted for the requested web SKU.
- **N/A free** — revocation of a paid entitlement is irrelevant to the free standalone product.

| Product | Required tier | Primary paid/product endpoint(s) | No auth | Basic/no entitlement | Pro entitlement | Advanced entitlement | Revoked |
|---|---|---|---|---|---|---|---|
| audit-basic | Basic | `/api/audit/report`, `/api/audit/report-pdf` | FREE | FREE | FREE | FREE | N/A free |
| audit-pro | Pro | above + audit-watch secure PDF issue/download | DENY | DENY | ALLOW exact Pro | NO implicit promotion | DENY |
| audit-advanced | Advanced | above + exact paid audit artifact path | DENY | DENY | DENY | ALLOW exact Advanced* | DENY |
| browser-basic | Basic | `/api/search/lens-report`, market `report-pdf` | FREE | FREE | FREE | FREE | N/A free |
| browser-pro | Pro | same guarded Browser/Lens path | DENY | DENY | ALLOW exact Pro | NO implicit promotion | DENY |
| browser-advanced | Advanced | same guarded Browser/Lens path | DENY | DENY | DENY | ALLOW exact Advanced* | DENY |
| shield-basic | Basic | market `brain`, `report`, `vlm` | FREE | FREE | FREE | FREE | N/A free |
| shield-pro | Pro | same central Shield paid guard | DENY | DENY | ALLOW exact Pro | NO implicit promotion | DENY |
| shield-advanced | Advanced | same central Shield paid guard | DENY | DENY | DENY | ALLOW exact Advanced* | DENY |
| shield-pro-basic | Basic | market `vlm` / Shield Pro surface | FREE | FREE | FREE | FREE | N/A free |
| shield-pro-pro | Pro | market `vlm` + Shield Pro paid workspace RPC | DENY | DENY | ALLOW exact Pro | NO implicit promotion† | DENY |
| shield-pro-advanced | Advanced | same Shield Pro paths | DENY | DENY | DENY | ALLOW exact Advanced* | DENY |
| real-markets-basic | Basic | `/api/market-integrity/real-markets/[operation]`, report/vlm | FREE | FREE | FREE | FREE | N/A free |
| real-markets-pro | Pro | same Real Markets paid guard | DENY | DENY | ALLOW exact Pro | NO implicit promotion | DENY |
| real-markets-advanced | Advanced | same Real Markets paid guard | DENY | DENY | DENY | ALLOW exact Advanced* | DENY |
| shield-map | none | market investigator / Shield Map | FREE | FREE | FREE | FREE | N/A free |
| market-impact | none | shared Market Impact runtime | FREE | FREE | FREE | FREE | N/A free |
| whale-watch | none | `/api/whale-watch` | FREE | FREE | FREE | FREE | N/A free |
| angel | none | `/api/angel`, `/api/angel/stream` | FREE | FREE | FREE | FREE | N/A free |
| risk-indicator | none | shared risk projection runtime | FREE | FREE | FREE | FREE | N/A free |

† The deployed Shield Pro SQL helper explicitly treats an Advanced grant as sufficient for a Pro workspace request. That is a database-specific documented inheritance rule; the generic web paid-SKU guard does not invent cross-SKU inheritance.

The automated matrix in `scripts/c14/test-paid-tier-catalog-matrix.ts` asserts the canonical denominator is exactly **20**, with **15 tiered** rows and **5 standalone** rows, and executes the five tiered families through Basic / unauthenticated Pro / authenticated-no-entitlement Pro / exact Pro / cross-account / Pro→Advanced / exact Advanced / revoked scenarios.

## Endpoint / boundary coverage

### Server-side paid gates

Reviewed and regression-covered:

- central `resolveVlmPaidSurfaceAccess` policies:
  - `real_markets_analysis`
  - `vlm_analysis`
  - `market_report`
  - `lens_pdf`
  - `advanced_click`
  - `brain_analysis`
  - `audit_review`
  - `audit_pdf_issue`
  - `audit_pdf_download`
- Audit report JSON/PDF:
  - current entitlement checked before producing a paid tier;
  - current account + exact entitlement rechecked at delivery time.
- Exact paid PDF:
  - account;
  - owned audit case;
  - exact entitlement/case tier;
  - exact report ID + report version hash;
  - stored snapshot;
  - signed download token;
  - reserve/finalize replay lifecycle.
- Market paid report / PDF / Lens:
  - central paid guard;
  - `no-store`;
  - exact-tier delivery policy.
- Generic client-composed market export:
  - fails closed with `verified_stored_report_required` / HTTP 409.
- Public evidence JSON/Markdown export:
  - explicitly remains `mode: "draft"`;
  - `exportInfrastructureReady: false`;
  - does not import paid tier projection; treated as free/standalone evidence, not a paid report export.

### Live Supabase direct-RPC checks

Project inspected read-only: `yljjyowcvjgjcamffnvd`.

- `velmere_r7_shield_pro_has_paid_entitlement_v1`
  - anon EXECUTE: **false**
  - authenticated EXECUTE: true
  - SECURITY DEFINER: true
  - validates live auth subject/session and current non-revoked grant.
- `velmere_r7_shield_pro_paid_workspace_v1`
  - anon EXECUTE: **false**
  - authenticated EXECUTE: true
  - requires current paid entitlement before operation.
- owner-visible customer artifact functions:
  - anon EXECUTE: **false**
  - SECURITY INVOKER;
  - underlying artifact tables have owner RLS.

Synthetic negative live checks (no customer data selected):

- forged authenticated subject/session → Pro entitlement: **false**
- forged authenticated subject/session → Advanced entitlement: **false**
- same forged identity → owner-visible artifact count: **0**

Live workspace definition also confirms:

- `workspace_id = p_workspace_id` **and** `account_id = v_account`;
- READ/RESTORE re-check the **stored** workspace tier;
- current entitlement is required for `v_latest.tier`;
- a caller-supplied lower tier cannot restore/read a higher-tier stored workspace.

## Attack matrix

| Attack | Result | Evidence / behavior |
|---|---|---|
| change tier in body/query/header | PASS after patch | shared guard owns tier decision; paid execution uses the same normalized tier; invalid tier falls to Basic rather than unlocking paid output |
| direct `x-velmere-entitlement-id` | **BYPASS FOUND → FIXED** | now account + product + surface + depth (+ target bindings) |
| query `entitlementId` | **BYPASS FOUND → FIXED** | same central direct-ID fix |
| old workspace | PASS | live owner binding + stored-tier current-entitlement check |
| restore | PASS | stored tier is authoritative for READ/RESTORE |
| old report | PASS | current audit access is re-resolved at delivery |
| guessed entitlement/report/workspace IDs | PASS | nonexistent ID fails; account/case/report/workspace owner bindings present |
| API without UI | PASS | authorization is server-side; no UI-only tier trust found in tested paid paths |
| direct RPC | PASS negative | anon cannot EXECUTE; forged auth session receives no paid entitlement; RLS hides owner artifacts |
| stale signed paid token | PASS | temporal validation rejects expired token |
| valid signed token + revoked entitlement | PASS | revoked ledger state wins; token cannot resurrect entitlement |
| cross-account entitlement | PASS | account hash mismatch denies; fake Supabase subject sees zero owner artifacts |
| cache | PASS | paid report/PDF/Lens/audit delivery paths use `no-store` |
| report URL replay / guessed URL | PASS | exact bindings + signed token; audit PDF reserve/finalize rejects in-progress/replayed token |
| concurrency | PASS | 64 concurrent checks against revoked entitlement all deny; secure PDF lifecycle has atomic reserve/finalize replay gate |
| alternative export formats | PASS | generic unverified export 409; public JSON/Markdown is draft/free; exact paid PDF stays token/account/entitlement-bound |
| Pro used as Advanced | PASS | technical product mismatch / depth mismatch denies |
| cross-surface same-account entitlement | **BYPASS FOUND → FIXED** | regression FAIL before patch, PASS after patch |

## Regression files

- `scripts/c14/test-paid-tier-bypass.ts`
  - cross-surface
  - direct entitlement ID
  - cross-account
  - wrong tier
  - revoked
  - expired
  - guessed ID
  - stale signed token
  - valid token + revoked entitlement
  - 64-way concurrent revoked checks
- `scripts/c14/test-paid-tier-catalog-matrix.ts`
  - canonical 20-product matrix
  - all 5 tiered product families
  - all 5 standalone products
- `scripts/c14/test-paid-tier-attack-surfaces.mjs`
  - report/PDF guards
  - post-render entitlement recheck
  - cache
  - stored-tier restore
  - generic export fail-closed
  - draft JSON/Markdown classification
  - paid PDF exact binding and replay lifecycle
- `.github/workflows/c14-p18-paid-tier-bypass.yml`
  - runs all three test suites
  - runs `tsc --noEmit`

## CI evidence

### Confirmed failing reproduction
- **35292797416** — expected security regression failure on cross-surface entitlement reuse.

### Post-patch
- **35292860135** — PASS
- **35292867717** — PASS
- **35293135112** — expanded stale/revoked/guessed/concurrency test PASS
- **35293002986** — canonical 20-product matrix PASS
- **35293065263** — attack-surface regression PASS
- **35293323299** — **full combined qualification PASS**
  - entitlement scope/token/concurrency: PASS
  - canonical 20-product matrix: PASS
  - report/restore/cache/export attack surfaces: PASS
  - TypeScript `--noEmit`: PASS

Intermediate red runs caused by the C14 test harness/static assertion formatting are not counted as product security failures and are documented in the Git history.

## Changed implementation files

Security patch only:

- `lib/commerce/vlm-entitlement-ledger.ts`
- `lib/commerce/vlm-advanced-only-access-policy.ts`
- `lib/commerce/vlm-paid-surface-guard.ts`

C14 evidence/test files:

- `scripts/c14/test-paid-tier-bypass.ts`
- `scripts/c14/test-paid-tier-catalog-matrix.ts`
- `scripts/c14/test-paid-tier-attack-surfaces.mjs`
- `.github/workflows/c14-p18-paid-tier-bypass.yml`
- this report

No merge performed.

## Why 9/10, not 10/10

The source/CI/live-negative evidence is strong enough to raise C13 **8/10 → 9/10**, and one real bypass was removed.

I am not assigning 10/10 because this branch did **not** use real customer data or a real live paid customer credential to perform destructive/positive hosted tests. In particular:

- no production paid entitlement was consumed;
- no destructive live workspace concurrency/replay test was run;
- no hosted positive Pro/Advanced customer-flow test was run through Vercel;
- Advanced is commercially `NOT_FOR_SALE`, so its positive case is synthetic/server-entitlement validation rather than a public purchase lifecycle.

Those limits are intentional and safer than manufacturing production grants or touching customer artifacts. They are residual qualification gaps, not known remaining bypasses.
