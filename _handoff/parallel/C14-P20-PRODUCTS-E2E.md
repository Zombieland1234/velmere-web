# C14-P20 — Products / E2E reality matrix

**Status:** COMPLETE for the requested C14-P20 scope  
**Repository:** `Zombieland1234/velmere-web`  
**Base SHA:** `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`  
**Branch:** `parallel/c14-p20-products-e2e`  
**Qualified executable SHA:** `e1d73dc4db985a7f06f7ccba4b78dd4f6ecbc778`  
**Final green workflow:** GitHub Actions run `35293041423`  
**Evidence artifact:** `c14-p20-evidence-35293041423`, artifact id `10527217978`  
**Evidence ZIP digest:** `sha256:5bf44347a7a3ab3d4facc64217df75082018c659f37e4b1509bc9e73f74fd4c0`  
**Qualification scope:** production Next.js build, ephemeral real Redis, signed loopback proxy boundary, public RPC for Basic audit runtime, Playwright browser. It is **not** hosted-Vercel proof and **not** a real Stripe TEST paid checkout.

## Executive result

The current authoritative customer-product denominator is **20 rows**, not a rounded catalog count and not 17:

- 15 explicitly tiered rows across five families: Audit, Browser, Shield, Shield Pro, Real Markets.
- 5 standalone products: Shield Map, Market Impact, Whale Watch, Angel, Risk Indicator.
- PDF is an **output artifact**, not a separate product family.
- The separate merchandise/product catalog under `lib/products/*` is not part of this security-product denominator.

C14-P20 does **not** mark a catalog row ready just because the UI or topology names it. Positive customer E2E is currently proven for:

1. **Audit Basic** — JSON + runtime worker/public RPC + PDF.
2. **Browser Basic** — production SSR on desktop and mobile using the same completed runtime analysis.
3. **Angel** — limited positive deterministic small-talk path over JSON and SSE; this is not proof of a provider-grounded security/market answer.

There are **zero positive paid Pro/Advanced customer E2Es** in this qualification. Several products are correctly fail-closed because provider rights/publication authority are not currently proven. Risk Indicator has an internal engine/projection but no standalone customer API/page.

### C13 6/10 → C14-P20 7/10

This score is for **product/E2E qualification quality and enforced truth boundaries**, not “14 of 20 products are ready”. It increased because the denominator is now exact, Basic was re-proven after patches, cross-product production probes are reproducible, multiple client-controlled bypasses were removed, and blocked products are tested as blocked rather than counted as successes.

It is not 8–10 because:
- no paid Pro/Advanced positive E2E exists;
- Shield / Shield Map / Real Markets / Market Impact / Whale Watch are currently rights/publication blocked or withheld in production;
- Shield Pro has UI/server paths but no positive paid-value E2E;
- Risk Indicator lacks a standalone customer entrypoint;
- hosted Vercel + real auth/entitlement + Stripe TEST lifecycle are outside this proof.

## Evidence taxonomy

- **POSITIVE_E2E** — a customer request crosses the real production build and returns the intended usable result.
- **POSITIVE_LIMITED** — a real usable sub-path is proven, but not the whole product claim.
- **FAIL_CLOSED** — the route exists and correctly refuses customer data/result because required authority/evidence is missing.
- **AUTH_GATED** — implementation exists, but only denial was proven; no valid paid entitlement was exercised.
- **UI_SHELL_ONLY** — page renders, but that is not product E2E.
- **NO_ENTRYPOINT** — internal engine/projection exists but no standalone customer surface is implemented.

## 20-row product reality matrix

| # | Product id | Family / tier | Implementation + entrypoint | Inputs / engine path | Outputs | Auth / limits | Final E2E status | Evidence / blocker |
|---:|---|---|---|---|---|---|---|---|
| 1 | `audit-basic` | audit / Basic | Implemented. `GET/POST /api/audit/report`, `GET /api/audit/report-pdf`, SSR report route. | address/assetId, chainId, analysisMode, tier, locale, optional target metadata → `prepareCustomerReport` → `buildCustomerAuditReport` → audit worker/public RPC. | JSON **yes**; PDF **yes**; browser report **yes**. | Anonymous Basic. Shared runtime quota is durable: in E2E request 6 still passed and request 7 across instances/representations returned 429; Redis outage returns 503. | **POSITIVE_E2E** | `production-basic-json-worker-public-rpc` 200; `production-basic-pdf-worker-public-rpc` 200. Runtime status `STATIC_ANALYSIS_COMPLETED`. |
| 2 | `audit-pro` | audit / Pro | Same real API/engine path as Basic with tier projection. | Same target input; requested tier Pro. | JSON/PDF/browser code paths exist. | Current account-bound entitlement required. | **AUTH_GATED / no positive E2E** | Anonymous Pro JSON = 401. No valid Pro entitlement exercised. |
| 3 | `audit-advanced` | audit / Advanced | Same report pipeline; canonical topology marks Advanced not for sale. | Same target input; Advanced tier. | JSON/PDF/browser code paths exist. | Current account-bound entitlement required; catalog role `NOT_FOR_SALE`. | **AUTH_GATED / NOT_FOR_SALE** | Anonymous Advanced PDF = 401. No positive Advanced E2E. |
| 4 | `browser-basic` | browser / Basic | Implemented SSR `/[locale]/security/audits/report/[id]`. | URL target + report query → same `prepareCustomerReport` / audit runtime result. | Browser report **yes**; linked report PDF artifact path exists; JSON is the underlying audit API, not a separate Browser JSON product. | Anonymous Basic; same runtime quota boundary as Audit. | **POSITIVE_E2E** | Desktop and 390×844 mobile SSR both 200, one canonical report, `STATIC_ANALYSIS_COMPLETED`, no page exception. |
| 5 | `browser-pro` | browser / Pro | SSR route implemented. | Same report target with `tier=pro`. | Browser route exists; no paid report rendered without access. | Current account entitlement required. Next App Router can stream transport HTTP 200 for `notFound()`; content is authoritative. | **AUTH_GATED / no positive E2E** | Anonymous probe returned streamed 200 but **no `audit-canonical-view` and no `STATIC_ANALYSIS_COMPLETED`**. |
| 6 | `browser-advanced` | browser / Advanced | SSR route implemented. | Same report target with `tier=advanced`. | Browser route exists; no paid report rendered without access. | Entitlement required; topology role `NOT_FOR_SALE`. | **AUTH_GATED / no positive E2E** | Same safe streamed-not-found behavior: no canonical report/result leaked. |
| 7 | `shield-basic` | shield / Basic | Page `/en/shield`; batch API `/api/market-integrity/markets`; single-asset analysis through VLM/market-intelligence paths. | page/perPage/tier for batch; query/asset for analysis → market providers → risk engine → delivery gate. | JSON + browser UI; no product PDF. | Basic has no paid entitlement, but provider/customer rights gate is authoritative. Markets: 120/min; VLM GET 36/min, POST 24/min; market-intelligence prod 60/min, body ≤900 KiB. | **IMPLEMENTED, CURRENTLY FAIL_CLOSED** | Production dev/live flags cannot bypass rights: batch = 503 withheld; market-intelligence x-pro attempt = 424 `NO_USABLE_ORDER_BOOK`. |
| 8 | `shield-pro` | shield / Pro | Shield family Pro tier exists; batch route explicitly rejects paid batch delivery and points to single-asset paid analysis. | Single asset via VLM/market-intelligence. | JSON/browser path exists; no PDF. | Paid account-bound entitlement required. | **AUTH_GATED / no positive E2E** | Batch Pro = 402: paid analysis is not delivered by batch sweep. |
| 9 | `shield-advanced` | shield / Advanced | Same Shield family architecture. | Single asset paid VLM path. | JSON/browser path exists; no PDF. | Paid entitlement; topology role `NOT_FOR_SALE`. | **AUTH_GATED / no positive E2E** | Batch Advanced = 402; no valid Advanced entitlement exercised. |
| 10 | `shield-pro-basic` | shield-pro / Basic | Separate Shield Pro family. Page `/en/shield-pro`; market catalog/reference path and strict server analysis client exist. | market/catalog lookup; paid analysis client ultimately POSTs `/api/market-integrity/vlm`. | Browser UI + JSON-backed analysis; no PDF. | Basic/reference surface exists. VLM limits apply to server analysis. | **UI + SERVER PATH PRESENT, no positive product-value E2E** | Page shell = 200 only. Shell success is not counted as product E2E. |
| 11 | `shield-pro-pro` | shield-pro / Pro | Strict server analysis client implemented. | asset + locale + requestId → VLM POST → strict public evidence/commercial boundary validation. | JSON-backed browser analysis; no PDF. | 401/402/403 treated as entitlement required; server entitlement + commercial delivery readiness + evidence quorum required. | **AUTH_GATED / no positive E2E** | No valid paid entitlement/evidence packet was available to prove a positive result. |
| 12 | `shield-pro-advanced` | shield-pro / Advanced | Same strict server path with Advanced depth. | Same as Pro, Advanced tier. | JSON-backed browser analysis; no PDF. | Entitlement + stricter evidence readiness; topology role `NOT_FOR_SALE`. | **AUTH_GATED / no positive E2E** | No positive Advanced customer path proven. |
| 13 | `real-markets-basic` | real-markets / Basic | Page `/en/real-markets`; `GET /api/market-integrity/real-markets`. | symbols/tier/detail/reference options → Real Markets orchestrator → Yahoo/Stooq and official-reference lanes → quorum/history/delivery policy. | JSON + browser UI; no PDF product. | Basic reference path, but current provider/customer delivery rights preflight blocks generic customer quotes. Server symbol budget = 12; expensive-route budget also applies. | **IMPLEMENTED, PROVIDER/RIGHTS DEPENDENT** | Current Basic = 503 withheld. ECB reference-only probe also 503 because reference provider unavailable in this run. |
| 14 | `real-markets-pro` | real-markets / Pro | Paid single-instrument code path implemented. | one symbol required → provider quorum/history → paid surface access. | JSON + browser UI. | Paid entitlement after rights preflight. | **RIGHTS_BLOCKED BEFORE ENTITLEMENT / no positive E2E** | Anonymous current-state request = 503 `real_markets_customer_delivery_unavailable`. |
| 15 | `real-markets-advanced` | real-markets / Advanced | Advanced paid path implemented in orchestrator. | one symbol + Advanced → durable history/quorum requirements. | JSON + browser UI. | Paid entitlement + stronger evidence/history; topology role `NOT_FOR_SALE`. | **RIGHTS_BLOCKED BEFORE ENTITLEMENT / no positive E2E** | Current request = 503 before paid gate can become a positive path. |
| 16 | `shield-map` | standalone | Page `/en/shield-map`; `GET /api/market-integrity/investigator?query=…&locale=…`. | symbol/address → provider resolution → risk engine → Shield Investigator → evidence report/snapshot. | JSON + browser UI; no PDF. | Free standalone, but rights gate applies. Investigator limit 120 / 10 min. | **IMPLEMENTED, CURRENTLY FAIL_CLOSED** | Page shell 200; production request with forged dev header still = 503 `shield_customer_data_delivery_unavailable`. Synthetic “live provider” fallback was removed in C14. |
| 17 | `market-impact` | standalone | Engine exists; customer routes include `/api/market-integrity/orderbook`, `/api/market-integrity/liquidity-intelligence`, and integrated market-intelligence. | symbol/query or normalized venue snapshots → `buildMarketImpactAnalysis` → delivery policy. | JSON/integrated UI data; no standalone PDF; no separately proven dedicated browser product page. | Free standalone semantics, but rights/publication gate applies. Market-intelligence: 60/min prod, ≤900 KiB; legacy orderbook/liquidity bypasses removed. | **ENGINE PRESENT, CUSTOMER DELIVERY BLOCKED** | Both `authorized=true` + `x-velmere-pro` bypass attempts now return 424 `NO_USABLE_ORDER_BOOK`. |
| 18 | `whale-watch` | standalone | `GET /api/whale-watch?assetKey=…&locale=…` exists. | assetKey + locale → Whale Watch truth/delivery boundary. | JSON; no standalone PDF/browser report proven. | Free; rate 20/min; URL/input validation. | **ENDPOINT PRESENT, WITHHELD** | 424, `WITHHELD`, `numbersPublished=false`, `liveClaimed=false`. Blockers: live evidence authorization, verified wallet-label registry, operational continuous monitoring. |
| 19 | `angel` | standalone | `POST /api/angel` and `POST /api/angel/stream`. | message/history/locale/sessionId/evidenceContext → safety inspection → deterministic lane or provider registry/prompt contract. | JSON and SSE; no PDF/browser report artifact. | Direct Angel is free Basic truth; body ≤48 KiB; 30/min; same-origin guard; account optional for basic chat. | **POSITIVE_LIMITED** | JSON small-talk 200 `deterministic_smalltalk`; SSE 200 `angel-sse-v1`. Does **not** prove provider-grounded audit/market answers. |
| 20 | `risk-indicator` | standalone | Internal customer-truth/projection engine exists and is embedded in market-intelligence. **No standalone API or page.** | validated risk result/evidence → risk-indicator projection/customer truth. | Embedded JSON projection only; standalone JSON/PDF/browser surface absent. | No standalone customer auth/limit boundary because no standalone entrypoint exists. | **NO_ENTRYPOINT** | `app/api/risk-indicator/route.ts` absent; `app/[locale]/risk-indicator/page.tsx` absent. |

## C14 fixes

### 1. Shield Map synthetic provider-live fallback removed

Before C14, provider failure could fall back to hardcoded BTC/ETH/SOL/etc. values, construct a receipt labeled as CoinGecko/provider-timestamped data and set `dataQuality="live"`. That made an unavailable provider capable of becoming customer-visible “live” evidence.

C14 removed `CANONICAL_FALLBACK_ASSETS` / `resolveFallbackMarketRow` from the customer resolution path. Provider absence now remains absence and must fail closed.

Regression: `C14-P20 Shield Map has no synthetic provider-live fallback`.

### 2. Production dev/pro client flags no longer bypass product truth gates

The following client-controlled flags were constrained so they cannot grant production delivery authority:

- Markets: `x-velmere-dev`, `x-velmere-live`, `dev=true`, `live=true`.
- Investigator / Shield Map: `x-velmere-dev` / dev test mode.
- Market Intelligence: `x-velmere-dev`, `x-velmere-live`, `x-velmere-pro`.

They can only serve development/test behavior when `NODE_ENV !== "production"`.

Production probes confirm the flags do not turn blocked rights into 200 customer data.

### 3. Market Impact legacy `authorized=true` / `x-velmere-pro` bypass removed

Both Order Book and Liquidity Intelligence previously allowed a public query/header flag to skip a negative delivery preflight and return derived analytics with HTTP 200.

C14 removed that branch. A blocked delivery decision is now authoritative:

- Order Book bypass attempt → 424 `NO_USABLE_ORDER_BOOK`.
- Liquidity Intelligence bypass attempt → 424 `NO_USABLE_ORDER_BOOK`.

### 4. Runtime product metadata aligned with current P66 topology

Market Intelligence still described `pdf` as a tiered product and mixed tiered Shield / Shield Pro / Real Markets families into the standalone list.

C14 now sources runtime metadata from:
- `VLM_CANONICAL_TIERED_FAMILIES`
- `VLM_CANONICAL_STANDALONE_PRODUCTS`

and explicitly emits:
- `reportArtifacts: ["pdf"]`
- `pdfIsProductFamily: false`

Regression prevents return to the retired PDF-as-product-family model.

### 5. Browser paid authorization E2E checks customer content, not only transport status

Next.js App Router can begin a streamed response before `notFound()`, so an unauthorized paid Browser request may have transport HTTP 200. The corrected E2E requires that such a response contain neither the canonical report view nor `STATIC_ANALYSIS_COMPLETED`.

Final result:
- Browser Pro anonymous: transport 200, canonical report **not rendered**.
- Browser Advanced anonymous: transport 200, canonical report **not rendered**.

This is an auth-safe streamed not-found result, not a paid-product positive E2E.

## Final test evidence

Green workflow run: `35293041423`, qualified SHA `e1d73dc4db985a7f06f7ccba4b78dd4f6ecbc778`.

Passed stages:

1. Focused C14-P20 regressions — PASS.
2. Strict TypeScript — PASS.
3. Audit worker build + full production application build — PASS.
4. Basic production E2E — PASS:
   - config preflight;
   - unsigned/forged proxy rejection;
   - Basic JSON worker + public RPC;
   - Basic PDF + digest;
   - Browser desktop;
   - Browser mobile;
   - Pro/Advanced anonymous denial;
   - POST runtime parity;
   - shared quota across two app instances and JSON/PDF;
   - spoofed client IP cannot reset quota;
   - Redis failure fail-closed;
   - Redis recovery preserves quota.
5. Cross-product production probes — PASS:
   - four UI shells observed without treating them as product success;
   - Shield rights bypass attempts fail closed;
   - Market Intelligence x-pro attempt fails closed;
   - Market Impact legacy bypass attempts fail closed;
   - Shield Map dev-header attempt fails closed;
   - Whale Watch correctly withheld;
   - Angel JSON + SSE deterministic limited positive paths;
   - Real Markets Basic/paid paths correctly reflect rights state;
   - paid Browser requests do not render paid content;
   - Risk Indicator standalone entrypoint absence detected.

## What is actually ready versus merely implemented

**Positive full E2E:** Audit Basic, Browser Basic.

**Positive but intentionally limited:** Angel deterministic small-talk JSON/SSE.

**Implemented but currently not deliverable because authority/evidence is missing:** Shield Basic, Shield Map, Real Markets Basic, Market Impact, Whale Watch.

**Implemented/gated but no positive paid customer proof:** Audit Pro, Audit Advanced, Browser Pro, Browser Advanced, Shield Pro/Advanced, Shield Pro-family Pro/Advanced, Real Markets Pro/Advanced.

**UI/server pieces present without positive value E2E:** Shield Pro Basic.

**Internal engine only; standalone product surface missing:** Risk Indicator.

## Remaining blockers required for a materially higher score

1. Real account-bound positive Pro entitlement E2E for every paid family intended for sale.
2. Provider rights/publication authority sufficient to change fail-closed Shield / Real Markets / Market Impact / Whale Watch paths into lawful positive customer delivery.
3. Positive Shield Pro evidence-bound server response with valid commercial delivery state and source quorum.
4. Standalone Risk Indicator customer endpoint/page if it is to remain a standalone product in the canonical 20-row topology.
5. Hosted deployment E2E through the real Vercel boundary.
6. Real Stripe TEST lifecycle tied to account entitlement and the same product routes.
7. For Angel, provider-grounded security/market-answer E2E beyond deterministic small talk.
8. For every product promoted from blocked to ready, preserve the negative/bypass regressions added here.

## Conclusion

C14-P20 substantially improves confidence in **what the product surface really is** and in the system's ability to refuse unsupported customer claims. It does not convert blocked catalog rows into ready products.

**Products & E2E: 6/10 → 7/10.**

The next score increase should require new **positive** E2E evidence, especially paid entitlements and legally authorized provider-backed product data, rather than additional catalog assertions or more fail-closed-only tests.
