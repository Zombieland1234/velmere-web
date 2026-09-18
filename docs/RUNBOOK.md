# Velmère runbook — source and qualification

This runbook is intentionally narrower than `package.json`. The audited source contains 925 package scripts, and 892 of them reference at least one historical script file that is absent from the C13 checkout. Do not assume every package script is runnable.

## 1. Reproduce the audited source

Use the Git commit, not a reconstructed ZIP, as the source of truth:

~~~sh
git checkout 4cb45bbcf910f0517d4a5d265682cd2f7e4e41df
git rev-parse HEAD
git rev-parse HEAD^{tree}
~~~

Expected tree: `a5268de961923bf0982506167396cda14c0a1381`.

Node policy from `package.json`:
- engines: Node >=20
- Volta: Node 24.18.0
- Volta npm: 11.16.0

Install exactly from the lockfile:

~~~sh
npm ci --ignore-scripts --no-fund
~~~

## 2. Supported baseline checks

These commands exist in the audited source and were part of C13 qualification:

~~~sh
npm run build:audit-worker
node_modules/.bin/tsc --noEmit --strict --pretty false
node_modules/.bin/tsx --test scripts/c13/source-boundary.test.ts scripts/c13/config-preflight.test.ts
npm run build
node_modules/.bin/eslint . --max-warnings 0
npm audit --json
npm ls --all --json
~~~

Expected C13 result: all above except zero-warning ESLint passed. ESLint produced 343 warnings and therefore returned non-zero under `max-warnings=0`.

## 3. Exact C13 qualification harness

`scripts/c13/qualify.py` is a CI harness for a fixed GitHub checkout. It asserts `GITHUB_SHA` equals the checked-out commit and writes evidence under `/tmp/c13-evidence`. It also expects supporting services such as Redis for the real-integration checks.

The canonical workflow is `.github/workflows/c13-qualification.yml`. It was designed for branch `c13/authority-source-boundaries-20260918` and exact-SHA qualification. Re-running it on a different commit is a new qualification, not evidence for `4cb45bb...`.

## 4. Production-mode self-hosted E2E

`scripts/c12/production-e2e.mjs` exercises:
- the production Next build;
- local real Redis with AOF;
- a private loopback HMAC proxy;
- public RPC;
- Basic JSON/PDF/SSR;
- anonymous paid-tier denial;
- shared quota across two app instances;
- Redis outage and recovery.

It explicitly does **not** prove hosted Vercel, real Stripe TEST checkout, real customer auth, or production provider rights.

## 5. C13 isolated PostgreSQL fixture

The GitHub Actions shield-database job runs PostgreSQL 17 with an isolated localhost database named `c13_fixture` and then:

~~~sh
python3 scripts/c13/shield-db-test.py
~~~

The exact C13 artifact recorded 28/28 passing checks. Do not point this harness at a customer or production database; the script refuses non-local/non-`c13_fixture` targets.

## 6. Frozen external-runtime regression replay

~~~sh
bash scripts/c13/benchmark.sh
~~~

The script fetches pinned `gsalzer/cgt` commit `f8cd72cf7fbbfebc809c454667eee271706a4b2b` and compares C12 against the current checkout.

Interpretation constraints:
- 2472 unique runtime hashes;
- all 2472 were already observed in C9;
- zero new holdout cases in C13;
- source/runtime associations were not independently recompiled;
- heuristic signals are not confirmed exploits.

## 7. Environment files

`.env.example` and `ENV_PRODUCTION_READY.example` are configuration inventories, not proof that a hosted environment is configured. Secrets belong in platform secret storage.

C13 release status remains NO_GO even if a local preflight succeeds. Never infer payment, provider-rights, hosted-runtime or independent-review completion from an environment template.

## 8. Hosted-release gates still requiring external proof

- real Stripe TEST lifecycle;
- real Auth A/B lifecycle;
- all-product hosted E2E;
- global provider enforcement;
- independent review;
- recovery of the original R16 ledger if a fixed percentage is to be claimed.

No command in this runbook is allowed to convert those missing proofs into PASS by assertion.
