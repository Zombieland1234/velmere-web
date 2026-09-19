# Isolated staging — creation pending

No hosted Supabase project was created or modified by Q17–Q20. Only the organization list and proposed project cost were read. Organization and quoted zero monthly cost await the user's confirmation. No existing project is an acceptable substitute.

Proposed new name: `velmere-staging-c15-20260919`; proposed region: `eu-central-1`. Project reference: **UNASSIGNED**. These are a plan, not a provisioning receipt.

After explicit organization/cost confirmation, create a NEW project through the authorized Supabase connector. Record its returned ID; never reuse a prior project's ID or keys. Use that same ID for all subsequent migrations, metadata reads and advice checks. Keep secret keys outside Git and handoff packages. Pin `VELMERE_DEPLOYMENT_ENV=staging`, `VELMERE_STAGING_SUPABASE_PROJECT_REF=<new returned ref>`, and both Supabase origins to the new project's URL. Do not enable production Vercel routing or real Stripe charges. Public and service credentials must come from the new project.

## Schema is NOT ready for blind installation

A fresh native PostgreSQL compilation of `lib/db/schema.sql`, inside one transaction, failed at the ALTER of the absent `public.velmere_audit_pdf_token_consumptions` table. The transaction rolled back. Test-only Auth SQL context functions were supplied to exercise parsing; no GoTrue login/JWT was simulated as real Auth.

The Q4–Q8 payment stores are a separate 19-object contract. Their disposable SQL is **not** a reviewed hosted migration. The 154-name application registry is broader; use `rpc-inventory.mjs` for an explicitly incomplete presence/ACL inventory, never for a 100% readiness claim. Account binding, session families, storage, retention, catalog products and migration dependencies need their own reviewed contracts. Do not invent historical tables solely to make the bootstrap green.

For a real migration, first recover/review its prerequisites and create a canonical migration with `supabase migration new <name>`. Test a clean database and replay/idempotency; use the newly created staging ID only. No CLI migration filename was invented in Q19.

## Local repeatable inventory

On the isolated Q10 payment fixture used by `native-qualification.py`:

```sh
PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres PGDATABASE=q10_payment_fixture \
Q19_DISPOSABLE_ACK=ISOLATED_TEST_ONLY \
node scripts/c15-q19/rpc-inventory.mjs /new/evidence/directory
```

Exit 2 means missing or unsuitable registered RPCs. Presence is not signature, body, RLS, Auth or deployed parity. The command never calls a business RPC or edits the database.

## Public verification change

Q18 intentionally does not publish existing private audit manifests. A valid record needs an explicit `publication: { visibility: "public", scope: "integrity-only" }` decision. Publication requires a separate ownership/privacy review; generation does not set it automatically. Matching locally read bytes do not prove issuer authenticity, historical immutability, an external timestamp, on-chain state or audit correctness.
