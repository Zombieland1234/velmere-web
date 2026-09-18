# Velmère source documentation

This branch documents the product source audited at C13 source SHA `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`. Documentation commits on this branch do not promote the release and do not change UI or product logic.

## Current truth

- **CONFIRMED** — repository: `Zombieland1234/velmere-web`.
- **CONFIRMED** — audited C13 source commit: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.
- **CONFIRMED** — audited Git tree: `a5268de961923bf0982506167396cda14c0a1381`.
- **CONFIRMED** — exact-SHA C13 GitHub Actions run `35289099092` completed with overall conclusion `failure` because release gates remained red.
- **CONFIRMED** — C13 `RELEASE_GATE` status is `NO_GO`. It is not a production or sale approval.
- **CONFIRMED** — the C13 product manifest contains 20 customer-facing rows from `lib/product/vlm-canonical-product-topology.ts`. Active or sellable count is explicitly `NOT_ASSUMED`.
- **CONFIRMED** — the exact source has 3975 tracked files. The C13 source ZIP contains 3973 and excludes two tracked font resources by policy.
- **BLOCKED** — identity with the earlier `VELMERE_SOURCE_R13F-UI2.zip` is not proven.
- **BLOCKED** — the original R16 defect ledger is unavailable; no R16 fixed percentage is claimed.

## Documentation map

- `docs/CURRENT_STATE.md` — exact C13 source, test, build and release-gate status.
- `docs/RUNBOOK.md` — supported reproduction and qualification paths.
- `docs/RECOVERY.md` — source, CI artifact and database recovery boundaries.
- `docs/PRODUCTS_AND_LIMITATIONS.md` — current P66 product topology and release limitations.
- `docs/PROVIDERS_AND_RIGHTS.md` — technical integration versus commercial-rights truth.
- `docs/CLAIM_LEDGER.md` — material documentation claims classified as CONFIRMED, PARTIAL, UNVERIFIED or BLOCKED.
- `_handoff/parallel/C14-P03-DOCUMENTATION.md` — C14-P03 audit handoff.

Historical files under `scripts/c10` through `scripts/c13`, public evidence, pass registries and migration notes remain useful evidence, but they do not override the current-source documents above.

## Non-negotiable interpretation rules

1. A passing local or CI check does not imply LIVE, sale-ready, hosted-Vercel, real-Stripe or independently reviewed status.
2. Technical provider code does not imply commercial display, redistribution or data-use rights.
3. Historical PASS/R/A/C-stage numbers are not current product counts unless the current topology explicitly adopts them.
4. Missing original evidence is marked BLOCKED or UNVERIFIED; it is never reconstructed from memory.
5. The source ZIP is not a byte-complete substitute for the full Git checkout because two tracked font resources were intentionally excluded.
