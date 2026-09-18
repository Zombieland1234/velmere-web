-- C14-P12 CI-only fixture.  Apply only to a disposable local Supabase stack.
-- It intentionally starts with the pre-fix account resolver so the HTTP test
-- can reproduce the stale-token path before applying the P12 migration.
CREATE SCHEMA IF NOT EXISTS velmere_private;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.velmere_account_supabase_subject_bindings (
  account_id text PRIMARY KEY,
  supabase_subject uuid UNIQUE NOT NULL,
  request_id text NOT NULL,
  operator_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.velmere_account_supabase_subject_binding_requests (
  request_id text PRIMARY KEY,
  account_id text NOT NULL,
  supabase_subject uuid NOT NULL,
  operator_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.velmere_account_supabase_subject_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.velmere_account_supabase_subject_binding_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.velmere_account_supabase_subject_bindings, public.velmere_account_supabase_subject_binding_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.velmere_account_supabase_subject_bindings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.velmere_account_supabase_subject_bindings, public.velmere_account_supabase_subject_binding_requests TO service_role;

CREATE OR REPLACE FUNCTION public.velmere_bind_account_to_supabase_subject(
  p_account_id text,
  p_supabase_subject uuid,
  p_request_id text,
  p_operator_fingerprint text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
BEGIN
  IF p_account_id IS NULL OR p_account_id !~ '^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$'
     OR p_supabase_subject IS NULL
     OR p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,119}$'
     OR p_operator_fingerprint IS NULL OR p_operator_fingerprint !~ '^operator_[a-f0-9]{20}$' THEN
    RAISE EXCEPTION 'invalid_binding_input' USING errcode='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_supabase_subject AND u.deleted_at IS NULL) THEN
    RETURN 'not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.velmere_account_supabase_subject_bindings b WHERE b.account_id=p_account_id AND b.supabase_subject=p_supabase_subject) THEN
    RETURN 'already_bound';
  END IF;
  IF EXISTS (SELECT 1 FROM public.velmere_account_supabase_subject_bindings b WHERE b.account_id=p_account_id OR b.supabase_subject=p_supabase_subject) THEN
    RETURN 'conflict';
  END IF;
  INSERT INTO public.velmere_account_supabase_subject_binding_requests(request_id,account_id,supabase_subject,operator_fingerprint)
  VALUES(p_request_id,p_account_id,p_supabase_subject,p_operator_fingerprint)
  ON CONFLICT (request_id) DO NOTHING;
  INSERT INTO public.velmere_account_supabase_subject_bindings(account_id,supabase_subject,request_id,operator_fingerprint)
  VALUES(p_account_id,p_supabase_subject,p_request_id,p_operator_fingerprint);
  RETURN 'bound';
END
$function$;
REVOKE ALL ON FUNCTION public.velmere_bind_account_to_supabase_subject(text,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_bind_account_to_supabase_subject(text,uuid,text,text) TO service_role;

-- Vulnerable baseline by design: signed access JWT + auth.uid only, no auth.sessions check.
CREATE OR REPLACE FUNCTION public.velmere_current_account_id()
RETURNS text LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT b.account_id
  FROM public.velmere_account_supabase_subject_bindings b
  WHERE b.supabase_subject=auth.uid()
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.velmere_current_account_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velmere_current_account_id() TO authenticated, service_role;

DROP POLICY IF EXISTS r7_account_binding_owner_select ON public.velmere_account_supabase_subject_bindings;
CREATE POLICY r7_account_binding_owner_select ON public.velmere_account_supabase_subject_bindings
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND supabase_subject=auth.uid());

CREATE TABLE IF NOT EXISTS public.p12_owner_resources (
  resource_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('workspace','report','storage','product')),
  tier text NOT NULL CHECK (tier IN ('basic','pro','advanced')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.p12_owner_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.p12_owner_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.p12_owner_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.p12_owner_resources TO service_role;
DROP POLICY IF EXISTS p12_owner_select ON public.p12_owner_resources;
CREATE POLICY p12_owner_select ON public.p12_owner_resources
FOR SELECT TO authenticated USING (account_id=public.velmere_current_account_id());

CREATE OR REPLACE FUNCTION public.p12_owner_resource_get(p_resource_id uuid)
RETURNS SETOF public.p12_owner_resources
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,pg_temp
AS $function$
  SELECT * FROM public.p12_owner_resources WHERE resource_id=p_resource_id;
$function$;
REVOKE ALL ON FUNCTION public.p12_owner_resource_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p12_owner_resource_get(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.velmere_auth_session_families (
  family_id uuid PRIMARY KEY,
  subject_fingerprint text NOT NULL CHECK (subject_fingerprint ~ '^[a-f0-9]{32}$'),
  generation integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','compromised','expired')),
  expires_at timestamptz NOT NULL,
  last_rotated_at timestamptz NOT NULL DEFAULT now(),
  compromised_at timestamptz,
  revoke_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.velmere_auth_session_families ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.velmere_auth_session_families FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.velmere_auth_session_families TO service_role;

CREATE OR REPLACE FUNCTION public.velmere_issue_auth_session_family(p_family_id uuid,p_subject_fingerprint text,p_expires_at timestamptz)
RETURNS TABLE(status text,generation integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE g integer;
BEGIN
  INSERT INTO public.velmere_auth_session_families(family_id,subject_fingerprint,generation,status,expires_at)
  VALUES(p_family_id,p_subject_fingerprint,1,'active',p_expires_at)
  ON CONFLICT (family_id) DO NOTHING;
  SELECT f.generation INTO g FROM public.velmere_auth_session_families f
  WHERE f.family_id=p_family_id AND f.subject_fingerprint=p_subject_fingerprint AND f.expires_at=p_expires_at;
  IF g IS NULL THEN RAISE EXCEPTION 'auth_session_family_identity_conflict' USING errcode='23505'; END IF;
  RETURN QUERY SELECT 'issued'::text,g;
END $function$;

CREATE OR REPLACE FUNCTION public.velmere_rotate_auth_session_family(p_family_id uuid,p_expected_generation integer,p_expires_at timestamptz)
RETURNS TABLE(status text,generation integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE f public.velmere_auth_session_families%rowtype;
BEGIN
  SELECT * INTO f FROM public.velmere_auth_session_families x WHERE x.family_id=p_family_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'missing'::text,0; RETURN; END IF;
  IF f.expires_at<=now() THEN UPDATE public.velmere_auth_session_families SET status='expired' WHERE family_id=p_family_id; RETURN QUERY SELECT 'expired'::text,f.generation; RETURN; END IF;
  IF f.status<>'active' THEN RETURN QUERY SELECT f.status,f.generation; RETURN; END IF;
  IF f.generation=p_expected_generation THEN
    UPDATE public.velmere_auth_session_families SET generation=generation+1,last_rotated_at=now(),updated_at=now(),expires_at=greatest(expires_at,p_expires_at) WHERE family_id=p_family_id RETURNING velmere_auth_session_families.generation INTO f.generation;
    RETURN QUERY SELECT 'rotated'::text,f.generation; RETURN;
  END IF;
  IF p_expected_generation=f.generation-1 AND f.last_rotated_at>=now()-interval '30 seconds' THEN RETURN QUERY SELECT 'grace_replay'::text,f.generation; RETURN; END IF;
  UPDATE public.velmere_auth_session_families SET status='compromised',compromised_at=now(),updated_at=now(),revoke_reason_code='generation_reuse' WHERE family_id=p_family_id;
  RETURN QUERY SELECT 'reuse_detected'::text,f.generation;
END $function$;

CREATE OR REPLACE FUNCTION public.velmere_revoke_auth_session_family(p_family_id uuid,p_reason_code text)
RETURNS TABLE(status text,generation integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE g integer;
BEGIN
  UPDATE public.velmere_auth_session_families SET status='revoked',revoke_reason_code=left(coalesce(p_reason_code,''),40),updated_at=now()
  WHERE family_id=p_family_id AND status IN ('active','compromised') RETURNING velmere_auth_session_families.generation INTO g;
  IF g IS NULL THEN SELECT f.generation INTO g FROM public.velmere_auth_session_families f WHERE f.family_id=p_family_id; END IF;
  RETURN QUERY SELECT CASE WHEN g IS NULL THEN 'missing' ELSE 'revoked' END::text,coalesce(g,0);
END $function$;

CREATE OR REPLACE FUNCTION public.velmere_verify_auth_session_family(p_family_id uuid,p_subject_fingerprint text,p_expected_generation integer,p_expected_expires_at timestamptz)
RETURNS TABLE(status text,family_id uuid,subject_fingerprint text,generation integer,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
 SELECT CASE WHEN f.status<>'active' THEN f.status WHEN f.expires_at<=now() THEN 'expired' WHEN f.subject_fingerprint IS DISTINCT FROM p_subject_fingerprint THEN 'subject_mismatch' WHEN f.generation IS DISTINCT FROM p_expected_generation THEN 'generation_mismatch' WHEN f.expires_at IS DISTINCT FROM p_expected_expires_at THEN 'expiry_mismatch' ELSE 'active' END::text,
 f.family_id,f.subject_fingerprint,f.generation,f.expires_at
 FROM public.velmere_auth_session_families f WHERE f.family_id=p_family_id;
$function$;

CREATE OR REPLACE FUNCTION public.velmere_revoke_auth_session_subject(p_subject_fingerprint text,p_reason_code text)
RETURNS TABLE(status text,revoked_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE n integer; known boolean;
BEGIN
 UPDATE public.velmere_auth_session_families SET status='revoked',revoke_reason_code=left(coalesce(p_reason_code,''),40),updated_at=now()
 WHERE subject_fingerprint=p_subject_fingerprint AND status IN ('active','compromised'); GET DIAGNOSTICS n=ROW_COUNT;
 SELECT EXISTS(SELECT 1 FROM public.velmere_auth_session_families f WHERE f.subject_fingerprint=p_subject_fingerprint) INTO known;
 RETURN QUERY SELECT CASE WHEN known THEN 'revoked' ELSE 'missing' END::text,n;
END $function$;

REVOKE ALL ON FUNCTION public.velmere_issue_auth_session_family(uuid,text,timestamptz), public.velmere_rotate_auth_session_family(uuid,integer,timestamptz), public.velmere_revoke_auth_session_family(uuid,text), public.velmere_verify_auth_session_family(uuid,text,integer,timestamptz), public.velmere_revoke_auth_session_subject(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_issue_auth_session_family(uuid,text,timestamptz), public.velmere_rotate_auth_session_family(uuid,integer,timestamptz), public.velmere_revoke_auth_session_family(uuid,text), public.velmere_verify_auth_session_family(uuid,text,integer,timestamptz), public.velmere_revoke_auth_session_subject(text,text) TO service_role;

-- Current Shield fixture using actual C13 source is appended by the workflow.

CREATE OR REPLACE FUNCTION public.p12_seed_owner_resource(p_subject uuid,p_kind text,p_tier text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $function$
DECLARE rid uuid;
BEGIN
 INSERT INTO public.p12_owner_resources(account_id,kind,tier,payload)
 VALUES('supabase:'||p_subject::text,p_kind,p_tier,jsonb_build_object('owner',p_subject::text,'kind',p_kind,'tier',p_tier)) RETURNING resource_id INTO rid;
 RETURN rid;
END $function$;
REVOKE ALL ON FUNCTION public.p12_seed_owner_resource(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p12_seed_owner_resource(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.p12_grant_tier(p_subject uuid,p_tier text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,velmere_private,pg_temp AS $function$
DECLARE ref uuid:=gen_random_uuid();
BEGIN
 IF p_tier NOT IN ('pro','advanced') THEN RAISE EXCEPTION 'tier_invalid'; END IF;
 INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events(entitlement_ref,account_id,tier,event_kind,authority,evidence)
 VALUES(ref,p_subject,p_tier,'GRANT','C14_P12_LOCAL_HTTP',jsonb_build_object('githubRunId','C14-P12'));
 RETURN ref;
END $function$;
CREATE OR REPLACE FUNCTION public.p12_revoke_tier(p_entitlement uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,velmere_private,pg_temp AS $function$
DECLARE e velmere_private.r7_shield_pro_paid_entitlement_events%rowtype;
BEGIN
 SELECT * INTO e FROM velmere_private.r7_shield_pro_paid_entitlement_events WHERE entitlement_ref=p_entitlement AND event_kind='GRANT' ORDER BY event_id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'grant_not_found'; END IF;
 INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events(entitlement_ref,account_id,tier,event_kind,authority,evidence)
 VALUES(e.entitlement_ref,e.account_id,e.tier,'REVOKE','C14_P12_LOCAL_HTTP','{}'::jsonb);
END $function$;
CREATE OR REPLACE FUNCTION public.p12_expire_session(p_session uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,auth,pg_temp AS $function$
 UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id=p_session;
$function$;
CREATE OR REPLACE FUNCTION public.p12_session_exists(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,auth,pg_temp AS $function$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=p_session);
$function$;
REVOKE ALL ON FUNCTION public.p12_grant_tier(uuid,text),public.p12_revoke_tier(uuid),public.p12_expire_session(uuid),public.p12_session_exists(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p12_grant_tier(uuid,text),public.p12_revoke_tier(uuid),public.p12_expire_session(uuid),public.p12_session_exists(uuid) TO service_role;
