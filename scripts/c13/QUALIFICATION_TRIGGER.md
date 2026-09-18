# C13 exact-source qualification

Integrated source parent: `588d88125ac9a8aa3d778e2adb1cc0a398d50fc0`.
Baseline: C12 `9a176fe2e844ccf7166bf1bd7552f1bec79584cb`.

This commit triggers separate exact-SHA checks of the integrated application, an isolated PostgreSQL fixture using captured live RPC definitions, and a repeated frozen CGT corpus comparison. Staging materialization is not a passing qualification. Worker jobs are automated checks, not independent AI agents or external auditors.

No UI modification, customer payment, live customer-row write, merge, protection bypass or production promotion is authorized by this test trigger. The SQL patch is a reviewed candidate until a separately recorded deployment succeeds. Source/runtime identity remains unverified; runtime-only observations cannot be erased by submitted source. Current product release status remains NO_GO.


## C14-P03 exact-SHA result note

- **CONFIRMED** — final audited source SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.
- **CONFIRMED** — GitHub Actions run: `35289099092`.
- **CONFIRMED** — overall workflow conclusion: `failure` because open gates remain red.
- **CONFIRMED** — `RELEASE_GATE` status: `NO_GO`.
- **CONFIRMED** — core qualification: 28 PASS / 1 FAIL; `eslint-zero-warning` failed with 343 warnings and 0 ESLint errors.
- **CONFIRMED** — production build and strict TypeScript passed.
- **CONFIRMED** — isolated PostgreSQL Shield fixture passed 28/28.
- **PARTIAL** — production-mode self-hosted E2E passed; it is not hosted Vercel, real Stripe TEST or real Auth A/B proof.
- **BLOCKED** — real Stripe TEST lifecycle, real Auth A/B, all-product hosted E2E, global provider enforcement, original R16 ledger and independent review remain open.

See `/docs/CURRENT_STATE.md` for the evidence boundary. This trigger file must not be cited as proof that C13 was fully green.
