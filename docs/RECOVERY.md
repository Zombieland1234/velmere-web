# Velmère recovery procedure — C13 evidence boundary

## Source anchor

- **CONFIRMED** — repository: `Zombieland1234/velmere-web`.
- **CONFIRMED** — source SHA: `4cb45bbcf910f0517d4a5d265682cd2f7e4e41df`.
- **CONFIRMED** — tree SHA: `a5268de961923bf0982506167396cda14c0a1381`.
- **CONFIRMED** — C13 Actions run: `35289099092`.

Recovery starts from the Git commit. Do not silently replace it with an older R13F/UI2 ZIP.

## C13 Actions artifacts

The exact run produced:
- `c13-evidence-35289099092` — artifact id `10526031537`, digest `2091e7cdf61d83c068c9f916d6060d2cddc706ec82f5667613e0b222fc25cb93`.
- `c13-benchmark-35289099092` — artifact id `10525736579`, digest `d58a25492e3a5143315af8306bfe3c28dc8bd5be36920b6c3ddf27c467cdc85e`.
- `c13-sql-35289099092` — artifact id `10525476960`, digest `9b6fc175e657cb9e8089ebbe5c21a2d27e579f861a7431fcf8250f9f11b2ac9d`.
- `c13-source-35289099092` — artifact id `10525382939`, digest `a6648114f681f483476990a3ccb04b1c3fabef11f66554cebe7c2f48a5f3c7dc`.

These Actions artifacts were configured for 14-day retention. A durable recovery process must preserve their digests and metadata before GitHub retention removes the payloads.

## Source ZIP boundary

C13 `SOURCE_IDENTITY_EXPORT` records:
- 3975 tracked files in Git;
- 3973 included in `VELMERE_SOURCE_C13.zip`;
- `lib/security/pro-audit-pdf/embedded-font-data.ts` excluded;
- `r7-runtime/external-assets/manrope-pdf-latin-plus-ext.ttf` excluded;
- ZIP SHA-256 `766e739094325d5824f76cfdb03c3ecec9712825e9fd102f5b2f738065ab7ea9`;
- `originalUI2ZipIdentityConfirmed=false`.

Therefore the source ZIP is a controlled export, not a byte-complete replacement for the Git tree.

## Database recovery boundary

Two migrations were confirmed in the connected Supabase migration history on 2026-09-18:
- `20260917043048 velmere_c6d_shield_session_and_null_validation`;
- `20260917230935 velmere_c13_shield_workspace_stored_tier_guard`.

The C6D SQL is tracked under `supabase/migrations`. The C13 SQL is present as `scripts/c13/shield-workspace-guard.sql` and a normalized deployment observation is stored in `scripts/c13/shield-live-deployment.json`, but no matching C13 file exists under `supabase/migrations` in this checkout.

Before any recovery or re-application:
1. read migration history;
2. compare live function definitions/hashes;
3. compare the guarded SQL precondition;
4. do not blindly reapply an already-applied or drifted patch;
5. do not treat migration presence as real Auth/Stripe E2E proof.

## Missing historical material

- **BLOCKED** — original R16 defect ledger: unavailable. Do not create a replacement and call it the original.
- **BLOCKED** — missing original C12/R16 documents: do not reconstruct them from later summaries.
- **BLOCKED** — 13 path-like references in `config/pass36/current-release-authority.json` point to files absent from this checkout, including the R44P46 source-only manifest and final PDF RC receipt.
- **BLOCKED** — 892 package scripts reference missing historical files. Names in `package.json` are not enough to reconstruct their contents.
- **UNVERIFIED** — three Git SHAs cited by `public-evidence/pactverity/2026-09-15` do not resolve as commits in the current `velmere-web` repository. Preserve that evidence package as historical material without claiming current-repo lineage.

## Recovery acceptance

A recovered environment is not production-approved merely because it builds. Recovery acceptance must preserve the release gate: NO_GO remains NO_GO until the missing external gates are independently satisfied and recorded.
