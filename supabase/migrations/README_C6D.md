> C14-P03 historical boundary (2026-09-18): this file records C6D. Read-only live verification confirms migration `20260917043048` is still present. C13 additionally applied migration `20260917230935`, whose SQL is tracked at `scripts/c13/shield-workspace-guard.sql` but is not present as a file under `supabase/migrations` in this checkout. The historical 14/14 and prior 6/13 counts below were not reconstructed or re-labelled as C13 results; current C13 isolated PostgreSQL evidence is 28/28. See `/docs/CURRENT_STATE.md` and `/docs/RECOVERY.md`.

# C6D migration boundary

The migration 20260917043048 was applied through the authorized Supabase migration tool to project yljjyowcvjgjcamffnvd on 2026-09-17. It changes session and NULL validation only, preserves function signatures and ACLs, and does not change archival tier policy or customer records. The exact baseline definition hashes are guarded.

This recovered repository does NOT contain the complete prior database migration history. Do not treat this directory as a fresh-database bootstrap or run an unreviewed db reset/db push. Reconcile the remote history first. Do not replay this already-applied migration manually; its baseline guards intentionally reject newer definitions.

Post-application SQL fixture checks: 14/14 on actual database RPCs using synthetic SQL claims. Prior baseline: 6/13; the extra NULL-operation test was intentionally run only after validation was fixed. Test data rolled back; zero fixture users, sessions and grants remained. This is not signed JWT/browser/Stripe E2E.

Expected post-state SHA-256 of pg_get_functiondef:
- velmere_r7_shield_pro_has_paid_entitlement_v1(text): 233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92
- velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid): 102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a

Anonymous execution remained denied; authenticated execution remained allowed through internal checks. Do not reopen missing-session access as a shortcut to a green test.
