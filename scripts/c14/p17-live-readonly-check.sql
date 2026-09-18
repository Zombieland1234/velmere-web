-- C14-P17 read-only live catalog checker. No DDL/DML and no customer-row payloads.
WITH relations AS (
  SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind,
         c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
         (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
         has_table_privilege('anon', c.oid, 'select,insert,update,delete') AS anon_any,
         has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') AS auth_any
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','velmere_private') AND c.relkind IN ('r','p','v','m')
), functions AS (
  SELECT n.nspname AS schema_name, p.proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef AS security_definer, p.proconfig,
         has_function_privilege('anon', p.oid, 'execute') AS anon_execute,
         has_function_privilege('authenticated', p.oid, 'execute') AS auth_execute,
         has_function_privilege('public', p.oid, 'execute') AS public_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public','velmere_private')
), constraints AS (
  SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
         con.contype, con.convalidated, pg_get_constraintdef(con.oid, true) AS definition
  FROM pg_constraint con
  JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','velmere_private')
), indexes AS (
  SELECT n.nspname AS schema_name,c.relname AS table_name,i.relname AS index_name,
         ix.indisvalid,ix.indisready,ix.indislive
  FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid
  JOIN pg_class c ON c.oid=ix.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','velmere_private')
)
SELECT jsonb_build_object(
  'capturedAt', clock_timestamp(),
  'serverVersion', current_setting('server_version'),
  'objectCounts', jsonb_build_object(
    'publicTables', (SELECT count(*) FROM relations WHERE schema_name='public' AND relkind IN ('r','p')),
    'publicRlsTables', (SELECT count(*) FROM relations WHERE schema_name='public' AND relkind IN ('r','p') AND rls_enabled),
    'privateTables', (SELECT count(*) FROM relations WHERE schema_name='velmere_private' AND relkind IN ('r','p')),
    'privateRlsTables', (SELECT count(*) FROM relations WHERE schema_name='velmere_private' AND relkind IN ('r','p') AND rls_enabled)
  ),
  'clientExposureAnomalies', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM relations r
    WHERE r.schema_name='public' AND r.relkind IN ('r','p') AND
      ((NOT r.rls_enabled AND (r.anon_any OR r.auth_any)) OR
       (r.rls_enabled AND r.policy_count=0 AND (r.anon_any OR r.auth_any)))), '[]'::jsonb),
  'authenticatedSecurityDefiner', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM functions f
    WHERE f.schema_name='public' AND f.security_definer AND f.auth_execute), '[]'::jsonb),
  'anonSecurityDefiner', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM functions f
    WHERE f.schema_name='public' AND f.security_definer AND f.anon_execute), '[]'::jsonb),
  'publicSecurityDefiner', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM functions f
    WHERE f.schema_name='public' AND f.security_definer AND f.public_execute), '[]'::jsonb),
  'missingSecurityDefinerSearchPath', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM functions f
    WHERE f.security_definer AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(f.proconfig,'{}'::text[])) x WHERE x LIKE 'search_path=%'
    )), '[]'::jsonb),
  'unvalidatedConstraints', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM constraints c WHERE NOT c.convalidated), '[]'::jsonb),
  'invalidIndexes', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM indexes i WHERE NOT i.indisvalid OR NOT i.indisready OR NOT i.indislive), '[]'::jsonb)
) AS c14_p17_catalog;
