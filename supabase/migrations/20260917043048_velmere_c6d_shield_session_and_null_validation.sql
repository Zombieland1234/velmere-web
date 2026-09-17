SET LOCAL statement_timeout='10000ms';
SET LOCAL lock_timeout='2000ms';
DO $precondition$
DECLARE actual_entitlement text; actual_workspace text;
BEGIN
 SELECT encode(extensions.digest(pg_get_functiondef('public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)'::regprocedure),'sha256'),'hex') INTO actual_entitlement;
 SELECT encode(extensions.digest(pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure),'sha256'),'hex') INTO actual_workspace;
 IF actual_entitlement IS DISTINCT FROM '1f8e4e3ae03a552e14f4e35699ee013d79eb920fdd002851594c2c95a09d40d6' OR actual_workspace IS DISTINCT FROM '985de63c3df63d19ae3550af9d2f57408ae4ccb49d0bdddd5abfcf24b42a65a2' THEN RAISE EXCEPTION 'C6D migration aborted: live RPC definitions differ from reviewed baseline'; END IF;
END $precondition$;
CREATE OR REPLACE FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1(p_tier text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $function$
DECLARE v_subject uuid:=auth.uid(); v_session_text text:=auth.jwt()->>'session_id'; v_session uuid;
BEGIN
 IF p_tier IS NULL OR p_tier NOT IN ('pro','advanced') OR v_subject IS NULL OR v_session_text IS NULL OR v_session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 v_session:=v_session_text::uuid;
 IF NOT EXISTS (SELECT 1 FROM auth.sessions AS s WHERE s.id=v_session AND s.user_id=v_subject AND (s.not_after IS NULL OR s.not_after>statement_timestamp())) THEN RETURN false; END IF;
 RETURN EXISTS (SELECT 1 FROM velmere_private.r7_shield_pro_paid_entitlement_events AS g WHERE g.account_id=v_subject AND g.event_kind='GRANT' AND (g.expires_at IS NULL OR g.expires_at>statement_timestamp()) AND (g.tier=p_tier OR (g.tier='advanced' AND p_tier='pro')) AND NOT EXISTS (SELECT 1 FROM velmere_private.r7_shield_pro_paid_entitlement_events AS r WHERE r.entitlement_ref=g.entitlement_ref AND r.event_kind='REVOKE'));
END $function$;
DO $workspace_patch$
DECLARE original text:=pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure);
 old_validation text:=$anchor$if p_tier not in('pro','advanced') or p_locale not in('pl','en','de') or p_operation not in('CREATE','READ','DELETE','RESTORE') then$anchor$;
 new_validation text:=$anchor$if p_tier is null or p_locale is null or p_operation is null or p_tier not in('pro','advanced') or p_locale not in('pl','en','de') or p_operation not in('CREATE','READ','DELETE','RESTORE') then$anchor$;
BEGIN
 IF (length(original)-length(replace(original,old_validation,'')))/length(old_validation)<>1 THEN RAISE EXCEPTION 'C6D migration aborted: expected unique validation anchor missing'; END IF;
 EXECUTE replace(original,old_validation,new_validation);
END $workspace_patch$;
