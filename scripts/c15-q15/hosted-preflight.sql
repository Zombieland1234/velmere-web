BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
-- Read-only minimum deployment-contract preflight. Not function-body attestation,
-- not a migration, user-JWT test or permission to enable sales.
WITH expected_tables(object_name,allow_update) AS (VALUES
 ('public.velmere_vlm_paid_entitlements',true),
 ('velmere_billing_private.lifecycle_events',false),
 ('velmere_webhook_private.effects',true),
 ('public.velmere_stripe_webhook_events',true),
 ('velmere_payment_private.event_identities',false),
 ('velmere_payment_private.event_watermarks',true),
 ('velmere_billing_private.session_terminal_holds',false)
), expected_functions(signature) AS (VALUES
 ('public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz)'),
 ('velmere_billing_private.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz)'),
 ('public.velmere_apply_vlm_paid_entitlement_lifecycle_event(text,text,text,text,text,text,timestamptz)'),
 ('public.velmere_claim_stripe_webhook_effect(text,text,text,uuid,integer)'),
 ('public.velmere_complete_stripe_webhook_effect(text,text,integer,uuid,jsonb)'),
 ('public.velmere_fail_stripe_webhook_effect(text,text,integer,uuid,text)'),
 ('public.velmere_dead_letter_stripe_webhook_effect(text,text,integer,uuid,text)'),
 ('velmere_webhook_private.settle_effect(text,text,integer,uuid,text,jsonb,text)'),
 ('public.velmere_claim_stripe_webhook_event(text,text,bigint,integer)'),
 ('public.velmere_complete_stripe_webhook_event(text,text,integer,text,text)'),
 ('public.velmere_apply_payment_event_watermark(text,text,bigint,text,integer,boolean)'),
 ('public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint)')
), table_checks AS (
 SELECT t.object_name,'table'::text AS kind,c.oid IS NOT NULL AS present,
   coalesce(c.relrowsecurity AND c.relforcerowsecurity,false) AS structure_ok,
   coalesce(NOT has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     AND NOT has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     AND has_table_privilege('service_role',c.oid,'SELECT') AND has_table_privilege('service_role',c.oid,'INSERT')
     AND has_table_privilege('service_role',c.oid,'UPDATE')=t.allow_update
     AND NOT has_table_privilege('service_role',c.oid,'DELETE,TRUNCATE'),false) AS permissions_ok
 FROM expected_tables t LEFT JOIN pg_class c ON c.oid=to_regclass(t.object_name)
), function_checks AS (
 SELECT f.signature AS object_name,'function'::text AS kind,p.oid IS NOT NULL AS present,
   coalesce(NOT p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog'],false) AS structure_ok,
   coalesce(NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND has_function_privilege('service_role',p.oid,'EXECUTE'),false) AS permissions_ok
 FROM expected_functions f LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.signature)
), checks AS (SELECT * FROM table_checks UNION ALL SELECT * FROM function_checks),
extra_public_overloads AS (
 SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
   SELECT split_part(split_part(signature,'(',1),'.',2) FROM expected_functions WHERE signature LIKE 'public.%')
 AND NOT EXISTS (SELECT 1 FROM expected_functions f WHERE p.oid=to_regprocedure(f.signature))
)
SELECT jsonb_build_object(
 'schema','velmere.billing-schema-preflight.v1',
 'scope','Q4_Q8_SIGNATURE_RLS_ACL_ONLY_NOT_BODY_OR_AUTH_ATTESTATION',
 'readOnly',true,'releaseApproved',false,
 'expectedObjects',19,
 'passedObjects',count(*) FILTER(WHERE present AND structure_ok AND permissions_ok),
 'unexpectedPublicOverloads',coalesce((SELECT jsonb_agg(signature ORDER BY signature) FROM extra_public_overloads),'[]'::jsonb),
 'contractReady',bool_and(present AND structure_ok AND permissions_ok) AND NOT EXISTS(SELECT 1 FROM extra_public_overloads),
 'checks',jsonb_agg(jsonb_build_object('object',object_name,'kind',kind,'present',present,'structureOk',structure_ok,'permissionsOk',permissions_ok) ORDER BY kind,object_name)
) AS report FROM checks;

COMMIT;
