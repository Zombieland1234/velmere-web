-- C14-P17: RLS/schema hardening only. No customer-row DML.
-- Source patch only at audit time: do not apply to production without the normal migration review/deploy gate.
SET LOCAL statement_timeout = '30000ms';
SET LOCAL lock_timeout = '3000ms';

-- Authenticated callers may execute these SECURITY DEFINER RPCs by design, but none
-- needs caller-controlled schemas in search_path. Keep only pg_catalog implicit builtins;
-- every application/auth/extensions object used by their bodies is schema-qualified.
ALTER FUNCTION public.velmere_claim_current_account_durable_computation(text,text,text,text,text,text,integer,integer,jsonb,text)
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_complete_current_account_durable_computation(text,text,jsonb,text)
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_current_active_session_account_id()
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_fail_current_account_durable_computation(text,text,text,integer,text)
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)
  SET search_path TO pg_catalog;
ALTER FUNCTION public.velmere_store_current_account_customer_artifact_pdf_bundle_v1(jsonb,text,jsonb,text,text)
  SET search_path TO pg_catalog;

-- Make the RPC boundary explicit and replay-safe. Legacy overloads remain postgres-only.
REVOKE ALL ON FUNCTION public.velmere_claim_current_account_durable_computation(text,text,text,text,text,text,integer,integer,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_complete_current_account_durable_computation(text,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_current_active_session_account_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_fail_current_account_durable_computation(text,text,text,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.velmere_store_current_account_customer_artifact_pdf_bundle_v1(jsonb,text,jsonb,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.velmere_claim_current_account_durable_computation(text,text,text,text,text,text,integer,integer,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_complete_current_account_durable_computation(text,text,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_current_active_session_account_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_fail_current_account_durable_computation(text,text,text,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.velmere_store_current_account_customer_artifact_pdf_bundle_v1(jsonb,text,jsonb,text,text) TO authenticated, service_role;

-- Read-only preflight on C14-P17 found 67 rows and zero violations for both constraints.
-- VALIDATE scans existing rows and does not rewrite customer data.
ALTER TABLE public.velmere_audit_intake_cases
  VALIDATE CONSTRAINT velmere_audit_intake_contract_chain_identity;
ALTER TABLE public.velmere_audit_intake_cases
  VALIDATE CONSTRAINT velmere_audit_intake_contract_target_hash_identity;
