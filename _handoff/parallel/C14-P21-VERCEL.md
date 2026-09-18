# C14-P21 — GitHub → Vercel deployment qualification

Date: 2026-09-18
Repository: Zombieland1234/velmere-web
Base SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`
Branch: `parallel/c14-p21-vercel-deployment`
Qualified application/config SHA: `05e4efe33b92495491b8926b95dd23aa2402d3f0`
Baseline deployment-chain score: 7/10
C14-P21 score: **8/10**
Merge/promotion: **NOT PERFORMED**

## Executive result

The C13 Vercel preview was proven to contain the exact requested base SHA. Its build completed successfully, including the generated audit worker and strict TypeScript, but all tested preview paths were intercepted by Vercel Authentication/SSO before application runtime. The 302 is therefore a platform access boundary, not evidence that the application health handler failed.

C14-P21 adds a real `/api/health` route, restores the previously dangling `npm run deployment:preflight` script, adds a non-secret environment/configuration matrix, and adds a focused GitHub Actions deployment-contract test. No Vercel protection was disabled and no secret value was read or emitted.

The final C14-P21 Vercel preview is correctly associated with the final application/config SHA, but at handoff time it remains **QUEUED** behind concurrent C14 preview builds. Because no build log exists yet for that exact deployment, hosted execution of the new health route and hosted env-presence results remain BLOCKED rather than inferred.

## Evidence matrix

| Area | Evidence | Result |
|---|---|---|
| Git base | GitHub commit exists in `velmere-web`; branch created exactly from `4cb45bbc...` | CONFIRMED |
| Branch ancestry | Compare base → `05e4efe3...`: ahead 5, behind 0 | CONFIRMED |
| GitHub CI | Actions run `35292658909`, head SHA `05e4efe3...`, conclusion `success` | CONFIRMED |
| Focused preflight tests | 4/4 pass: ready fixture, missing Supabase fail-closed, live Stripe rejected for TEST, malformed Upstash rejected | CONFIRMED |
| C13 Vercel deployment identity | `dpl_GL2y4xb78mKqgYfAij3kddbEScvQ` metadata contains exact SHA `4cb45bbc...`, correct repo/ref, source=git | CONFIRMED |
| C13 Vercel build | READY; exact commit cloned; worker bundled; Next 16.3.5 compiled; TypeScript passed; 186 static pages generated | CONFIRMED |
| Final P21 deployment identity | `dpl_BqfCo4PWLuTQ13hDE4UXwnnsr1w3` metadata contains exact SHA `05e4efe3...` and requested branch | CONFIRMED |
| Final P21 build | Deployment state still QUEUED; no build events yet | BLOCKED — Vercel queue |
| Preview target | Inspected deployments use `target: null`; no production promotion made | CONFIRMED preview-only |
| Production state | Project API returned `live: false`; no production deployment was created or promoted by P21 | NOT QUALIFIED |
| C13 /api/health | 302 to `vercel.com/sso-api` before app; build route list showed no app `/api/health` handler | CONFIRMED defect/boundary |
| C13 /api/ops/readiness | 302 to Vercel SSO before app | CONFIRMED SSO boundary |
| C13 /pl | 302 to Vercel SSO before app | CONFIRMED SSO boundary |
| Runtime logs after SSO probes | No application runtime logs for exact C13 deployment | CONSISTENT WITH pre-runtime SSO interception |
| New /api/health source | Added Node, force-dynamic liveness/readiness route; no secret values returned | CONFIRMED in source |
| Worker | C13 build bundled `.generated/audit-engine-worker.cjs`; new health route checks packaged artifact presence | PACKAGING CONFIRMED; final hosted invocation BLOCKED |
| Redis | Existing runtime supports native Redis / Upstash fail-closed; P21 preflight checks valid configured mode without values | SOURCE/TEST CONFIRMED; hosted presence/connectivity BLOCKED |
| Supabase | P21 preflight checks HTTPS URL + anon/service-role presence only, never values | SOURCE/TEST CONFIRMED; hosted presence/connectivity BLOCKED |
| Stripe TEST | P21 requires `pk_test_`, `sk_test_`, `whsec_`; live-mode fixture is rejected | SOURCE/TEST CONFIRMED; hosted presence/API connectivity BLOCKED |
| Secrets | CI regression verifies serialized preflight result does not contain fixture secrets | CONFIRMED |
| Vercel protection | Not disabled or weakened | CONFIRMED by behavior/config actions |

## C13 deployment evidence

Vercel deployment:
- ID: `dpl_GL2y4xb78mKqgYfAij3kddbEScvQ`
- URL: `velmere-2d0fdas2d-velmere1.vercel.app`
- state: `READY`
- target: preview (`null`)
- source: `git`
- region: `iad1`
- Git ref: `c13/authority-source-boundaries-20260918`
- Git SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`

Build log independently states:
- cloning `github.com/Zombieland1234/velmere-web`
- branch `c13/authority-source-boundaries-20260918`
- commit `4cb45bb`
- Vercel CLI 59.16.0
- Next.js 16.3.5
- `node scripts/c11/build-audit-worker.mjs && next build`
- audit worker bundled
- production compile PASS
- TypeScript PASS
- deployment completed

This closes the C13 ambiguity “READY but was it the requested source?”: yes, the deployment metadata and build clone line both bind to the exact base commit.

## SSO / accessibility finding

Three independent requests against the exact C13 preview:
- `/api/health`
- `/api/ops/readiness`
- `/pl`

all returned HTTP 302 with a Vercel `sso-api` Location and Vercel SSO nonce cookie. The application was not reached. A temporary Vercel share/access attempt from the connector did not cross the current SSO boundary either.

Therefore:
- do **not** label the 302 as an application health failure;
- do **not** label Redis/Supabase/worker as down based on it;
- do **not** disable project protection merely to make a monitoring probe green;
- public unauthenticated preview accessibility remains intentionally unavailable under the current protection.

## Defects found and patches

### 1. Missing real /api/health
C13 had no application `/api/health` route. The Vercel build route inventory confirmed its absence.

Patch:
- added `app/api/health/route.ts`
- separates liveness from readiness
- default liveness response remains 200 while reporting `ready/degraded`
- `?readiness=1` returns 503 when configuration/package readiness is false
- includes only source SHA, Vercel environment, boolean checks and explicit `connectivityVerified: false`
- no secret values or provider error payloads are exposed

### 2. Dangling deployment:preflight package script
`package.json` already declared:
`deployment:preflight = node scripts/deployment/preflight.mjs`

but that file did not exist.

Patch:
- added `scripts/deployment/preflight.mjs`
- validates Vercel runtime metadata, trusted-proxy shape, privacy secret strength, Redis/Upstash configuration shape, Supabase presence, and Stripe TEST-mode prefixes
- outputs only non-secret booleans/blocker codes
- strict invocation fails closed
- `--report` records state without breaking preview build
- never claims network connectivity

### 3. No focused deployment-contract CI
Patch:
- added `.github/workflows/c14-p21-deployment.yml`
- push-scoped to this branch
- read-only contents permission
- pinned checkout/setup-node actions
- Node 24.18.0
- 4/4 focused tests PASS on exact SHA `05e4efe3...`

Actions run:
- `35292658909`
- conclusion: `success`
- exact checkout SHA confirmed in logs

### 4. Vercel build did not surface safe config state
Patch to `vercel.json`:
`node scripts/deployment/preflight.mjs --report && npm run build`

The report mode is intentionally non-blocking because preview environments may legitimately be incomplete. It emits no values. A separate strict invocation remains available for promotion/release gating.

## Files changed from base

Exactly 5 files through qualified application/config SHA `05e4efe3...`:
1. `.github/workflows/c14-p21-deployment.yml` — added
2. `app/api/health/route.ts` — added
3. `scripts/c14/deployment-preflight.test.mjs` — added
4. `scripts/deployment/preflight.mjs` — added
5. `vercel.json` — modified

Git compare: ahead 5, behind 0.

## Final P21 deployment

Deployment:
- ID: `dpl_BqfCo4PWLuTQ13hDE4UXwnnsr1w3`
- URL: `velmere-kipopen5e-velmere1.vercel.app`
- Git ref: `parallel/c14-p21-vercel-deployment`
- Git SHA: `05e4efe33b92495491b8926b95dd23aa2402d3f0`
- source: `git`
- target: preview
- state at handoff: **QUEUED**
- build logs at handoff: none yet

Multiple other C14 branches were concurrently queued/building in the same Vercel project. This is a platform scheduling/parallelism blocker, not evidence of a source/build failure. P21 does not cancel other agents' deployments.

## What remains BLOCKED / UNVERIFIED

1. Final P21 Vercel build completion for `05e4efe3...`.
2. Hosted response body/status of the newly added `/api/health`.
3. Hosted env-presence matrix from the final P21 Vercel build.
4. Real Redis/Upstash connectivity from the final hosted runtime.
5. Real Supabase connectivity/auth round-trip from the final hosted runtime.
6. Real Stripe TEST API/webhook lifecycle from the final hosted runtime.
7. Actual worker invocation in the final hosted runtime.
8. Unauthenticated preview access while Vercel SSO remains enabled.
9. Production promotion/configuration and production health; intentionally not performed.

Configuration presence and provider connectivity are deliberately separate claims. P21 never upgrades presence-only evidence to connectivity evidence.

## Score: 7/10 → 8/10

Why it improves:
- exact Git SHA → Vercel deployment identity is independently confirmed;
- exact SHA → focused GitHub CI is confirmed;
- missing `/api/health` is repaired;
- dangling deployment preflight is repaired;
- non-secret env validation is now executable and tested;
- worker artifact packaging has a runtime-presence check;
- SSO is correctly classified as a pre-runtime platform boundary instead of an app failure.

Why it is not 9/10 or 10/10:
- final exact P21 preview is still queued, so its build/preflight output is not yet observed;
- SSO prevents unauthenticated runtime probes and the connector did not obtain authenticated app execution;
- Redis, Supabase, Stripe TEST and worker hosted connectivity are not proven;
- production was neither promoted nor qualified.

This score is only for the GitHub → Vercel deployment chain. It is not an overall Velmère release-readiness score.
