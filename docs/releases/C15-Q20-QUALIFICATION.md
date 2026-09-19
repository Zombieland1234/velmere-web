# C15-Q20 — qualification and staging handoff

Date: 2026-09-19. Verdict: **NO_GO**. This is internal qualification, not an independent external audit or production deployment.

## Exact source identity

Repository: `Zombieland1234/velmere-web`.
Branch: `c15/qualification-q20-20260919`.
Qualified source commit: `d1126a5bd955c66922154ed4f535ea7ddea13eb5`.
Qualified source tree: `2296314730a171eebec2949b242d3008d47e904b`.
Base commit: `5690d7d6ffe75236b03833f47f00cc018f43a083`.
Admission trigger commit: `ac9929177b304979b3b1c3ac8d325750513e0aec`.
Workflow run: `35420960766`. Admission succeeded. Qualification failed only the zero-warning lint gate.

The workflow trigger SHA is not the tested source SHA: the qualification job explicitly checked out the admitted source commit recorded above. This documentation-only commit is newer than the qualified source; it is not a second execution of CI.

Source before the admission workflow had virtual tree `af00f4526ac1d3a66fe7f73ce57ef7ec523757d7`. Adding the actual admission workflow reproduces the qualified Git tree exactly. The source patch SHA-256 is `c45096a30d2c67c59738de5bb22cfedb9cc3a4482e1753ec0fc3aec0b29ed7b5`; its base and resulting tree were checked locally and in the admission job. The transient split patch files were removed by the admission commit. No existing branch was force-pushed, no PR was merged, and no production configuration was changed.

## Passes

**Q17 — staging configuration boundary.** Staging requires an explicitly pinned project reference. Public and service URLs must resolve to that exact Supabase origin. Ambiguous deployment mode, missing configuration, mismatched URLs and production/staging conflicts fail closed. Public, authenticated and service client factories revalidate before returning cached clients and rebind on configuration changes. This is configuration validation, not proof of project ownership or key validity. Previously returned SDK instances held elsewhere are not retroactively invalidated. New tests: 44. The same actual-client comparison passed 2/11 on Q16 and 11/11 on Q20.

**Q18 — public report verification.** Removed fabricated verification success and placeholder hashes from the missing-manifest API/page path. Verification now requires an explicit public integrity-only publication marker, validates bounded local manifest/artifact paths, rejects symlinks, reads actual bytes and compares digests. Private or missing manifests are not published. A successful match means local artifact/manifest consistency only: issuer authenticity, independent timestamp, audit validity and release approval remain unverified. New tests: 42. No automatic publication of old reports.

**Q19 — clean database qualification.** A transactional attempt to install the complete existing schema into a new local disposable database failed because `public.velmere_audit_pdf_token_consumptions` has no preceding table definition in the attempted input. The transaction was rolled back. No invented table or cloud migration was substituted. A new read-only registry inventory extracts 154 RPC names from the actual TypeScript registry; the limited payment fixture contains 10 of those names. This is name-presence inventory, not function signature or semantic equivalence. New tests: 10.

**Q20 — full qualification and source admission.** Froze the 67-file accepted regression registry, reran local checks and staged build, performed fresh native PostgreSQL and production-process HTTP checks, exported the exact technical source to this branch, and repeated qualification from a clean GitHub checkout with locked dependencies and a monolithic build.

## Fresh results

| Check | Local | GitHub CI |
|---|---|---|
| Accepted regressions | 1279/1279, no fail/skip/cancel/todo | 1279/1279, no fail/skip/cancel/todo |
| Strict application TypeScript | PASS, including final restored next-env retest | PASS |
| Extended TypeScript configurations | 20/20 | 20/20 |
| Worker build | PASS | PASS |
| Next build | Staged compile/check/generate PASS | Monolithic PASS |
| ESLint | 0 errors / 131 warnings | 0 errors / 131 warnings |
| Install | Exact recovered locked tools; not a fresh local install | `npm ci --ignore-scripts` PASS |
| Native PostgreSQL 17.11 | 28 existing + 12 response/parser scenarios PASS | Not claimed by this workflow |
| Reference HTTP | 6/6 PASS | Not claimed by this workflow |
| Public verification HTTP/HTML semantics | 8/8 final PASS | Not claimed by this workflow |
| Handoff guard / secret classifier | 36/36 and 15/15 PASS | Not claimed by this workflow |

1279 = 1183 Q16 + 44 Q17 + 42 Q18 + 10 Q19. Repeated local/CI executions do not double the number of unique regression cases. Native SQL, HTTP and tool tests are separate populations. Warnings decreased from 133 to 131 (2/133 = 1.5% reduction); the zero-warning gate remains enforced. There was no new npm audit, Gitleaks history/environment review, engine benchmark or external pentest.

The native SQL run used disposable loopback databases and synthetic roles/context, not hosted Supabase Auth or PostgREST. Twelve concurrent clients produced one grant and eleven replays. Logical backup/restore covered seven payment tables, not complete Auth/Storage/Redis disaster recovery.

## Preserved failures and limitations

Initial Q17 typing errors were fixed before full qualification. Initial native bootstrap tool configuration errors were retained in evidence. The clean full-schema failure remains open. An initial export candidate would have pruned active `lib/security/evidence` files; that candidate was rejected before publication, and the actual source remained intact. The admitted patch preserves those files.

The first public-verification HTTP harness passed 6/8 because it expected an HTTP 404 for two streamed Next not-found pages. The final harness retained strict API status checks and separately verified the streamed not-found marker, noindex and absence of success content. Its fresh rerun passed 8/8. Those two HTML responses were HTTP 200; this does not establish a strict HTML HTTP-404 contract. See the official Next not-found documentation: https://nextjs.org/docs/app/api-reference/file-conventions/not-found .

One verification page changed data loading and truthfulness text without a CSS/layout redesign. Other app/components/public files stayed unchanged. A one-page reference PDF was rendered and visually inspected. It displays NOT_VERIFIED, REFERENCE_ONLY and Engine: NOT_RUN. No new desktop/mobile screenshot-diff qualification is claimed. The separate latest Codex UI is not integrated.

## Staging status — NOT CREATED

A brand-new isolated hosted project was requested. Creation is pending the required organization selection and cost confirmation. No existing Supabase project was read or modified during these passes. No hosted project reference has been assigned. `.env.staging.example` is deliberately unresolved. Do not copy production secrets or point the staging variables to any existing project.

The safe order is: confirm the new project organization/cost; create the new project; record the newly returned reference; restore an authoritative and reviewed schema/migration baseline; qualify it on an empty disposable database; apply only to that new project; then test actual A/B Auth and a separately selected Stripe TEST account. Do not run `lib/db/schema.sql` blindly: the clean-bootstrap failure above is a release blocker. No real payment, hosted user creation, cloud DDL, Vercel deployment or external provider test was performed here.

## Reproduce technical qualification

Use a complete authorized checkout at the qualified source SHA, not a source ZIP that omits original font resources and Git history.

```sh
git switch --detach d1126a5bd955c66922154ed4f535ea7ddea13eb5
npm ci --ignore-scripts
python3 scripts/c15-q20/qualify.py --out /tmp/c15-q20 --candidate C15-Q20 --build-strategy monolithic
```

The runner is expected to return nonzero while the 131 lint warnings remain. Do not lower severity, raise max-warnings, disable the TypeScript checker or treat a green build as release approval. On memory-constrained local systems, the existing explicit staged strategy is available; report it as staged, not monolithic. Native runners only belong on disposable local databases. The RPC inventory is read-only and is not a migration installer.

Public verification tests create and remove their own synthetic files. Publishing a real report requires an explicit product/privacy decision and the publication marker; do not blanket-enable publication for historical manifests. Matching bytes can still contain an incorrect audit.

## Open release gates

Hosted project provisioning and clean full-schema bootstrap; real Auth A/B; complete Stripe TEST lifecycle; all SKU E2E and downgrade/archive policy; privacy/export/erasure; managed backup/recovery; zero-warning lint and current secret/dependency review; provider rights; actual deployment parity; engine effectiveness and blind holdout; external validation; original R16 mapping.

The last available historical engine measurement is precision 25.91%, recall 12.68%, F1 17.03%; it is not a Q20 rerun. The original 381-ID R16 ledger was not recovered. No R16 closure percentage is asserted. No private partner correspondence or credential material is included in this public handoff.
