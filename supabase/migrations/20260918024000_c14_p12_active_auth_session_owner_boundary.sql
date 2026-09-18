-- C14-P12: central active-session requirement for every account-id RLS lookup.
-- No customer rows are changed by this migration.
SET LOCAL statement_timeout = '10000ms';
SET LOCAL lock_timeout = '2000ms';

DO $precondition$
BEGIN
  IF to_regclass('auth.sessions') IS NULL
     OR to_regclass('public.velmere_account_supabase_subject_bindings') IS NULL
     OR to_regprocedure('public.velmere_current_account_id()') IS NULL THEN
    RAISE EXCEPTION 'C14-P12 aborted: auth/account binding prerequisites are missing';
  END IF;
END
$precondition$;

CREATE OR REPLACE FUNCTION public.velmere_current_auth_session_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth, public, pg_temp
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'session_id', '') <> ''
    AND EXISTS (
      SELECT 1
      FROM auth.sessions AS sessions
      WHERE sessions.id::text = auth.jwt() ->> 'session_id'
        AND sessions.user_id = auth.uid()
        AND (sessions.not_after IS NULL OR sessions.not_after > statement_timestamp())
    );
$function$;

REVOKE ALL ON FUNCTION public.velmere_current_auth_session_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velmere_current_auth_session_active() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.velmere_current_account_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth, public, pg_temp
AS $function$
  SELECT bindings.account_id
  FROM public.velmere_account_supabase_subject_bindings AS bindings
  WHERE public.velmere_current_auth_session_active()
    AND bindings.supabase_subject = auth.uid()
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.velmere_current_account_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velmere_current_account_id() TO authenticated, service_role;

-- The binding row itself previously depended on auth.uid() only.  Make the
-- active-session requirement explicit there as well, so a signed but logged-out
-- access token cannot enumerate even its own durable account binding.
DROP POLICY IF EXISTS r7_account_binding_owner_select
  ON public.velmere_account_supabase_subject_bindings;
CREATE POLICY r7_account_binding_owner_select
ON public.velmere_account_supabase_subject_bindings
FOR SELECT TO authenticated
USING (
  public.velmere_current_auth_session_active()
  AND supabase_subject = auth.uid()
);

-- Defense in depth: these current owner-readable artifact tables must never
-- become readable through a future permissive policy when the provider session
-- has already been revoked or expired.  RESTRICTIVE policies compose with all
-- permissive owner policies.
DO $artifact_gate$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'velmere_customer_artifact_snapshots',
    'velmere_customer_artifact_pdf_blobs'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS c14_p12_active_auth_session_select ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE POLICY c14_p12_active_auth_session_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.velmere_current_auth_session_active())',
        table_name
      );
    END IF;
  END LOOP;
END
$artifact_gate$;
