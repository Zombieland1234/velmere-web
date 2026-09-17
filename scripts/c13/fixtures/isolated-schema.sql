-- CI ONLY. Minimal database fixture, not a clone of production schema or real Auth.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA velmere_private;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
CREATE TABLE velmere_private.r7_shield_pro_paid_entitlement_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entitlement_ref uuid NOT NULL,
 account_id uuid NOT NULL,tier text NOT NULL,event_kind text NOT NULL,
 authority text NOT NULL DEFAULT 'C13_SYNTHETIC_CI_ONLY',expires_at timestamptz,
 evidence jsonb NOT NULL DEFAULT '{}',recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE velmere_private.r7_shield_pro_paid_workspace_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,workspace_id uuid NOT NULL,
 account_id uuid NOT NULL,tier text NOT NULL,locale text NOT NULL,event_kind text NOT NULL,
 e2e_run_id text,payload jsonb NOT NULL,payload_digest_sha256 text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.velmere_risk_history_events(asset_id text,observed_at timestamptz,publication_state text,customer_publishable boolean);
-- Synthetic adapter only for CREATE. No provider observations or rights are asserted.
CREATE FUNCTION public.velmere_read_public_risk_history_by_asset_v1(text,integer,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('resolution','RESOLVED','canonicalAssetId',$1,'events',jsonb_build_array(jsonb_build_object('fixture',1),jsonb_build_object('fixture',2))) $$;
INSERT INTO public.velmere_risk_history_events SELECT 'fixture-'||a,now(),'PUBLIC',true FROM generate_series(1,6)a CROSS JOIN generate_series(1,2)b;
