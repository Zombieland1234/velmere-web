# C14-P29 — RELEASE VALIDATION

## Werdykt

- Repo: `Zombieland1234/velmere-web`
- Baza: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
- Tree: `a5268de961923bf0982506167396cda14c0a1381`
- Branch: `parallel/c14-p29-release-validation`
- Status: **NO_GO**
- Zewnętrzny audyt: **NIE — nie przyznaję takiego statusu**
- Ocena tej pozycji: **0/10 -> 4/10**

Ocena 4/10 dotyczy jakości i odtwarzalności wewnętrznej kwalifikacji release, nie bezpieczeństwa produktu ani certyfikacji.

## Metoda

Wyniki odtworzono z exact SHA, source, komend, GitHub Actions, logów i artefaktów. Wnioski poprzednich agentów nie były używane jako dowód PASS.

Uruchomiłem ponownie workflow C13 dla tego samego SHA: run `35289099092`, attempt 2. Application ponownie zakończył się FAIL z identycznymi blockerami:
- `eslint-zero-warning`
- `gitleaks-source`
- `missing-historical-scripts`

Fresh rerun odtworzył te same release-relevant wyniki: 343 warningi ESLint, 22 findingi gitleaks, 892 skrypty z brakującymi literalnymi ścieżkami / 977 unikalnych braków, 340/340 bieżących regresji oraz 17/17 self-hosted production-mode E2E. To wyklucza prostą interpretację pierwszego FAIL jako jednorazowego flake'a CI.

## Wyniki odtworzone niezależnie

| Gate | Wynik | Status |
|---|---:|---|
| Exact source SHA/tree | zgodne | PASS |
| Evidence manifest | 122/122 plików, 0 mismatch | PASS |
| Lockfile parity | unchanged | PASS |
| Config preflight | 18/18 | PASS |
| Combined regressions | 340/340 | PASS |
| C13 focused | 41/41 | PASS |
| Strict TypeScript | exit 0 | PASS |
| Production build | exit 0 | PASS |
| npm audit | 0 known vulnerabilities | PASS |
| Real Redis | 8/8 | PASS |
| Production-mode self-hosted E2E | 17/17 | PASS (ograniczony scope) |
| Browser readiness | 8/8 | PASS (synthetic HTML + real Chromium) |
| Shield PostgreSQL fixture | 28/28 | PASS (ograniczony scope) |
| Frozen benchmark execution | 2472/2472, 0 timeout/error | PASS execution |
| Stability subset | 25/25 stabilne | PASS execution |
| ESLint zero-warning | 343 warnings | **FAIL** |
| Gitleaks | 22 unresolved | **FAIL** |
| package scripts | 892 scripts / 977 unique missing paths | **FAIL** |
| Novel holdout | 0 nowych; wszystkie 2472 widziane w C9 | **FAIL** |
| Oryginalne UI2 ZIP identity | niepotwierdzone | **FAIL** |
| Oryginalny ledger R16 | brak | **FAIL** |
| Real Stripe TEST lifecycle | brak | **FAIL** |
| Real Auth A/B tenant isolation | brak | **FAIL** |
| Hosted all-product E2E | brak | **FAIL** |
| Global provider rights/enforcement | niezamknięte | **FAIL** |
| Independent external review | brak | **FAIL** |

### Zakres pozytywnych E2E

17/17 ma scope:
`ACTUAL_PRODUCTION_NEXT_SELFHOSTED_EPHEMERAL_REDIS_HMAC_PROXY_PUBLIC_RPC_NOT_VERCEL_OR_STRIPE`

To potwierdza production build + Next runtime + worker + public RPC + JSON/PDF/SSR + real ephemeral Redis. Nie potwierdza Vercela, Stripe TEST, realnego paid entitlement ani wszystkich produktów.

Shield 28/28 ma scope:
`REAL_POSTGRESQL_CAPTURED_RPC_SYNTHETIC_SCHEMA_AUTH_CLAIMS_AND_ENTITLEMENTS_NOT_HTTP_AUTH_STRIPE_E2E`

To potwierdza semantics stored-tier/ACL/cross-account w izolowanym PostgreSQL 17, ale nie realne hosted Auth A/B ani Stripe E2E.

## Benchmark

Pinned corpus:
- `gsalzer/cgt`
- dataset SHA `f8cd72cf7fbbfebc809c454667eee271706a4b2b`
- CSV SHA-256 `306f91a45c783494cbc9b6010c3e044ffcfcd9a67e80165f6d896528fa1d94ba`
- selection digest `95537126cc85c376a2f3809ca5c7434b559a1024201744efa2c8f352daa11811`
- 2472 unikalne runtime hashes.

C13 assessment-pair matrix:
- TP 172
- TN 7538
- FP 870
- FN 2636
- precision ~16.51%
- recall ~6.13%
- specificity ~89.65%
- simple pair accuracy ~68.74%

To nie jest safety score. Wszystkie 2472 przypadki były wcześniej widziane w C9, więc jest to regression replay, nie nowy holdout. C12 i C13 mają identyczną macierz agregatową, ale **176 case outputs się zmieniło**. Stabilność 25-case repeat: 0 unstable.

Wniosek P29: benchmark dostaje credit za reprodukowalne wykonanie, ale **nie dostaje release-quality/coverage credit**. Nie ma podstaw do twierdzeń o kompletności ani równoważności z niezależnym ręcznym audytem.

## Różnice / nowe ustalenia P29

1. **Fresh rerun reprodukuje NO_GO.** Te same trzy techniczne blockery.
2. **ZIP source nie jest byte-deterministic.** Dwa exporty tego samego tree mają identyczne per-file manifests, lecz różne SHA ZIP:
   - attempt 1 `766e739094325d5824f76cfdb03c3ecec9712825e9fd102f5b2f738065ab7ea9`
   - attempt 2 `f769e009ab679dae05683b4920ef99294b14ff7f625a4384fe1252b6897ba8ce`
   Canonical identity powinno opierać się na Git tree + sorted per-file hashes.
3. Source export zawiera 3973 tracked files i jawnie pomija 2 tracked font resources; pełny inventory ma 3975.
4. `originalUI2ZipIdentityConfirmed=false`.
5. Gitleaks: 22 redacted findings w 18 plikach (21 `generic-api-key`, 1 `stripe-access-token`). Część wygląda jak fixtures/identifiers/test strings, ale bez bezpiecznego triage/allowlist gate pozostaje FAIL.
6. package.json ma 925 scripts; 892 wskazuje co najmniej jedną brakującą literalną ścieżkę, 977 unikalnych braków. To literal scan, nie shell-semantic proof, ale skala wymaga cleanup/retirement.
7. `scripts/c13/shield-live-deployment.json` nie dostaje independent credit: sam opisuje evidence jako normalized observation z wcześniejszych connector calls i odnosi się do SHA `a16c71ac...`, a nie subject SHA P29.

## Release checklist

Release = GO dopiero, gdy wszystkie wymagane pozycje są PASS; UNKNOWN/PARTIAL = FAIL.

- [x] Exact subject SHA i Git tree.
- [x] Per-file evidence manifest.
- [x] Lockfile parity.
- [x] Strict TypeScript.
- [x] Production build.
- [x] Current regressions 340/340.
- [x] Real Redis 8/8.
- [x] Self-hosted production-mode E2E 17/17.
- [x] Shield PostgreSQL fixture 28/28.
- [x] Frozen benchmark wykonuje 2472/2472 bez timeout/error.
- [ ] ESLint 0 warnings.
- [ ] Gitleaks 0 unresolved lub indywidualny udokumentowany safe allowlist.
- [ ] Broken/historical npm scripts usunięte albo formalnie retired.
- [ ] Canonical source chain/UI2 identity zamknięte.
- [ ] Deterministic source package albo formalne Git-tree/per-file identity.
- [ ] Nowy, precommitted holdout z niezależnie wystarczającym ground truth.
- [ ] 176 changed benchmark outputs sklasyfikowane.
- [ ] Original R16 ledger odzyskany albo formalnie zastąpiony traceable ledgerem bez wymyślania ID.
- [ ] Real Stripe TEST: payment -> webhook -> entitlement -> report -> refund/revoke.
- [ ] Real Auth account A/B tenant isolation.
- [ ] Hosted exact-SHA E2E wszystkich sellable products.
- [ ] Provider failures/rights/attribution/enforcement zamknięte.
- [ ] Prawdziwy niezależny zewnętrzny security review exact release candidate.

## FAIL gates

1. 343 ESLint warnings przy polityce max=0.
2. 22 unresolved gitleaks findings.
3. 892 scripts / 977 unique missing literal paths.
4. Brak nowego holdoutu i brak niezależnie kwalifikowanego ground truth.
5. Słabe obserwowane benchmark metrics nie dają release-grade coverage evidence.
6. UI2 identity niepotwierdzone.
7. R16 ledger brak; procent napraw pozostaje N/D.
8. Brak real Stripe TEST E2E.
9. Brak real Auth A/B E2E.
10. Brak hosted all-product E2E.
11. Provider-rights/enforcement niezamknięte.
12. Brak external independent review.
13. Raw ZIP source nie jest deterministyczny między exact-SHA reruns.

## Threat model

Assets: identity/sessions, tenant boundaries, payment + webhook + entitlement state, audit target/source/bytecode/block binding, report JSON/PDF/browser artifacts, Shield workspaces/stored tier, Redis quota identity/state, provider inputs/rights, source/build/evidence provenance, admin controls.

Trust boundaries:
1. browser -> Next routes;
2. Stripe -> webhook;
3. app -> Supabase/Auth/PostgreSQL;
4. app -> Redis;
5. app -> RPC/providers;
6. app -> audit worker;
7. engine -> report normalization -> JSON/PDF/SSR;
8. Git source -> build -> deployed runtime -> evidence;
9. admin/operator -> control plane.

Pentest themes: auth bypass/IDOR, session replay, tier manipulation, webhook spoof/replay/out-of-order/refund drift, quota bypass/proxy spoof/multi-instance races, SSRF/provider fail-open, source/runtime mismatch, stale/cross-chain target, worker timeout/OOM/error leak, report auth/cache/tampering/XSS/PDF injection, SQL ACL/cross-account, secret leakage, dependency/build drift i overclaiming heuristic findings.

## Pakiet dla przyszłego zewnętrznego audytora

Auditor powinien dostać read-only package związany z exact release SHA:
1. repo/commit/tree + sorted per-file SHA-256 manifest + omissions;
2. lockfile, Node/Redis/PostgreSQL versions i reproducible commands;
3. C14-P29 machine verdict + criteria;
4. test/build/runtime logs;
5. self-hosted E2E + hosted staging evidence, gdy będzie;
6. Shield SQL before/after + fixture results;
7. benchmark manifest, pinned dataset SHA, raw JSONL, comparison i limitations;
8. threat model, open gates, product/entitlement/sellability matrix;
9. known limitations/unsupported claims;
10. credentials przekazane osobnym bezpiecznym kanałem, nigdy w Git.

P29 nie może być przedstawiany temu audytorowi jako "independent audit"; jest setup/evidence handoff.

## Test credentials procedure

- Utworzyć disposable users A i B z osobnymi tenant/workspace.
- Dla obu osobne Stripe **TEST** customers; tylko test payment methods.
- Dedykowany TEST webhook; secret tylko w deployment secret store, rotacja po teście.
- Izolowany Supabase/staging project/schema; service-role secret nigdy w Git/logach/screenshots.
- Izolowany Redis.
- Provider keys tylko read-only/least-privilege/engagement-scoped.
- Fixtures: basic/pro/advanced, revoked/expired, wrong owner, deleted session, cross-account.
- W evidence zapisywać tylko credential identifiers/timestamps, nigdy secret values.
- Po teście revocation/rotation wszystkich sekretów.

## Reproducible commands

Environment: Ubuntu runner, Node 24.18.0, real Redis, PostgreSQL 17.

    git clone https://github.com/Zombieland1234/velmere-web.git
    cd velmere-web
    git checkout 4cb45bbcf910f0517d4a5d265682cd2f7e4e41df
    export GITHUB_SHA=4cb45bbcf910f0517d4a5d265682cd2f7e4e41df
    export CI=1 NEXT_TELEMETRY_DISABLED=1
    export VELMERE_CANONICAL_ORIGIN=http://localhost:3000
    export VELMERE_LOOPBACK_HTTP_BROWSER_PROOF=true
    python3 scripts/c13/qualify.py
    python3 scripts/c13/ci-extra.py
    python3 scripts/c13/shield-db-test.py
    bash scripts/c13/benchmark.sh

P29 verifier z validator branch:

    python3 scripts/c14-p29/verify_release_evidence.py       --evidence /tmp/c13-evidence       --sql /tmp/c13-sql       --benchmark /tmp/c13-benchmark       --base-sha 4cb45bbcf910f0517d4a5d265682cd2f7e4e41df       --output /tmp/c14-p29/VERDICT.json

`.github/workflows/c14-p29-release-validation.yml` automatyzuje exact-SHA replay, manifest i conservative gate. Ma pozostać czerwony, dopóki wymagane gates faktycznie nie zostaną zamknięte.

## Evidence index

GitHub Actions run `35289099092`.
Attempt 1 artifacts:
- source `10525382939`
- SQL `10525476960`
- benchmark `10525736579`
- evidence `10526031537`

Attempt 2 fresh application reproduction:
- source `10526987113`
- evidence `10527012071`

Integrity:
- attempt 2 evidence manifest: 122 files, 0 hash/size mismatch;
- source: 3973 included + 2 jawnie excluded tracked font resources;
- full tracked inventory: 3975;
- per-file manifests attempt 1 vs attempt 2: identical;
- raw source ZIP digest: różny, patrz różnica #2.

## Known limitations

- Internal validation, nie external auditor.
- P29 ponownie używa source test harnesses jako executable evidence; nie czyni ich independent ground truth.
- Brak live production payment i real hosted paid A/B E2E.
- Brak external manual exploit verification/formal proof.
- Benchmark jest historyczny, nie holdout.
- R16 ledger brak.
- Provider rights nie są globalnie attested.
- Benchmark source/runtime equivalence nie jest independently compiled/verified.
- Original UI2 identity niepotwierdzone.
- Gitleaks findings pozostają unresolved.
- Missing-path scan jest literalny i może nadliczać shell constructs.
- ZIP source jest nondeterministic; Git tree/per-file hashes są silniejszą tożsamością.

## Ocena 0/10 -> 4/10

Wzrost z 0 wynika z exact-SHA hash-checked evidence, świeżego rerun, jawnych criteria, verifiera, threat model, commands i auditor handoff.

Nie wyżej, bo trzy techniczne blockery nadal są czerwone, benchmark nie jest holdoutem, brakuje Stripe/Auth/hosted product E2E, R16/UI2/provider rights są otwarte, a prawdziwego zewnętrznego audytu nie ma.

**Final C14-P29 decision: NO_GO.**