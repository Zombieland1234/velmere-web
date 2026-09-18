-- Q5 candidate for isolated review. NOT an applied Supabase migration.
-- Trusted backend only. Does not verify Stripe signatures or make external effects exactly-once.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('velmere.disposable_effect_store', true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_EFFECT_STORE_ACK_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'velmere_webhook_private')
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('velmere_claim_stripe_webhook_effect',
       'velmere_complete_stripe_webhook_effect','velmere_fail_stripe_webhook_effect',
       'velmere_dead_letter_stripe_webhook_effect')) THEN
    RAISE EXCEPTION 'EXISTING_EFFECT_OBJECTS_REQUIRE_REVIEW';
  END IF;
END;
$guard$;
CREATE SCHEMA velmere_webhook_private;
REVOKE ALL ON SCHEMA velmere_webhook_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA velmere_webhook_private TO service_role;
CREATE TABLE velmere_webhook_private.effects (
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 180 AND event_id = btrim(event_id)),
  effect_key text NOT NULL CHECK (effect_key ~ '^[a-z0-9][a-z0-9:_-]{0,119}$'),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 180 AND event_type = btrim(event_type)),
  status text NOT NULL CHECK (status IN ('processing','completed','retryable_failed','dead_letter')),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  lease_token uuid,
  lease_expires_at timestamptz NOT NULL CHECK (isfinite(lease_expires_at)),
  result_json jsonb CHECK (result_json IS NULL OR octet_length(result_json::text) <= 16384),
  last_error_code text CHECK (last_error_code ~ '^[a-zA-Z0-9:_-]{1,160}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(event_id, effect_key),
  CHECK ((status = 'processing') = (lease_token IS NOT NULL)),
  CHECK ((status = 'completed') = (result_json IS NOT NULL)),
  CHECK (status <> 'completed' OR (result_json->'ok') IS DISTINCT FROM 'false'::jsonb)
);
ALTER TABLE velmere_webhook_private.effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_webhook_private.effects FORCE ROW LEVEL SECURITY;
REVOKE ALL ON velmere_webhook_private.effects FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON velmere_webhook_private.effects TO service_role;
-- service_role has BYPASSRLS in Supabase and the isolated bootstrap; it is trusted.
-- Backend compromise and direct service-role updates are outside this RPC fence.
CREATE FUNCTION public.velmere_claim_stripe_webhook_effect(
  p_event_id text, p_event_type text, p_effect_key text,
  p_requested_lease_token uuid, p_stale_after_seconds integer DEFAULT 300
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE r velmere_webhook_private.effects%ROWTYPE; now_at timestamptz;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 180 OR p_event_id <> btrim(p_event_id)
    OR p_event_type IS NULL OR length(p_event_type) NOT BETWEEN 1 AND 180 OR p_event_type <> btrim(p_event_type)
    OR p_effect_key IS NULL OR p_effect_key !~ '^[a-z0-9][a-z0-9:_-]{0,119}$'
    OR p_requested_lease_token IS NULL
    OR p_requested_lease_token::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR p_stale_after_seconds IS NULL OR p_stale_after_seconds NOT BETWEEN 1 AND 3600 THEN
    RAISE EXCEPTION 'INVALID_EFFECT_CLAIM';
  END IF;
  -- The tuple, not string concatenation, defines identity. Hash collision only serializes extra work.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_event_id,p_effect_key)::text, 515));
  SELECT * INTO r FROM velmere_webhook_private.effects
    WHERE event_id=p_event_id AND effect_key=p_effect_key FOR UPDATE;
  now_at := clock_timestamp(); -- after any lock wait; caller clocks cannot expire a lease
  IF FOUND THEN
    IF r.event_type <> p_event_type THEN RAISE EXCEPTION 'EFFECT_EVENT_TYPE_CONFLICT'; END IF;
    IF r.status IN ('completed','dead_letter') THEN
      RETURN jsonb_build_object('claimed',false,'status',r.status,'attempt_count',r.attempt_count,
        'lease_token',NULL,'result_json',r.result_json,'retry_after_seconds',0);
    END IF;
    IF r.status='processing' AND r.lease_expires_at > now_at THEN
      RETURN jsonb_build_object('claimed',false,'status','processing','attempt_count',r.attempt_count,
        'lease_token',NULL,'retry_after_seconds',greatest(1,ceil(extract(epoch FROM r.lease_expires_at-now_at))::integer));
    END IF;
    IF r.attempt_count = 2147483647 THEN RAISE EXCEPTION 'EFFECT_ATTEMPT_EXHAUSTED'; END IF;
    UPDATE velmere_webhook_private.effects SET status='processing',attempt_count=attempt_count+1,
      lease_token=p_requested_lease_token,lease_expires_at=now_at+make_interval(secs=>p_stale_after_seconds),
      result_json=NULL,last_error_code=NULL,updated_at=now_at
      WHERE event_id=p_event_id AND effect_key=p_effect_key RETURNING * INTO r;
  ELSE
    INSERT INTO velmere_webhook_private.effects(event_id,effect_key,event_type,status,attempt_count,
      lease_token,lease_expires_at,created_at,updated_at)
      VALUES(p_event_id,p_effect_key,p_event_type,'processing',1,p_requested_lease_token,
        now_at+make_interval(secs=>p_stale_after_seconds),now_at,now_at) RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('claimed',true,'status','processing','attempt_count',r.attempt_count,
    'lease_token',r.lease_token,'retry_after_seconds',0);
END;
$fn$;

-- One shared state transition; wrappers expose only the registered application RPCs.
CREATE FUNCTION velmere_webhook_private.settle_effect(
  p_event_id text, p_effect_key text, p_expected_attempt integer, p_lease_token uuid,
  p_status text, p_result_json jsonb, p_error_code text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE r velmere_webhook_private.effects%ROWTYPE;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 180 OR p_event_id <> btrim(p_event_id)
    OR p_effect_key IS NULL OR p_effect_key !~ '^[a-z0-9][a-z0-9:_-]{0,119}$'
    OR p_expected_attempt IS NULL OR p_expected_attempt < 1 OR p_lease_token IS NULL
    OR p_status IS NULL OR p_status NOT IN ('completed','retryable_failed','dead_letter') THEN
    RAISE EXCEPTION 'INVALID_EFFECT_SETTLEMENT';
  END IF;
  IF p_status='completed' THEN
    IF p_result_json IS NULL OR octet_length(p_result_json::text)>16384
      OR (p_result_json->'ok') = 'false'::jsonb OR p_error_code IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_EFFECT_RECEIPT';
    END IF;
  ELSIF p_result_json IS NOT NULL OR p_error_code IS NULL OR p_error_code !~ '^[a-zA-Z0-9:_-]{1,160}$' THEN
    RAISE EXCEPTION 'INVALID_EFFECT_ERROR';
  END IF;
  SELECT * INTO r FROM velmere_webhook_private.effects WHERE event_id=p_event_id AND effect_key=p_effect_key FOR UPDATE;
  IF NOT FOUND OR r.status <> 'processing' OR r.attempt_count <> p_expected_attempt
     OR r.lease_token IS DISTINCT FROM p_lease_token OR r.lease_expires_at <= clock_timestamp() THEN
    RETURN false;
  END IF;
  UPDATE velmere_webhook_private.effects SET status=p_status,lease_token=NULL,
    result_json=p_result_json,last_error_code=p_error_code,updated_at=clock_timestamp()
    WHERE event_id=p_event_id AND effect_key=p_effect_key;
  RETURN true;
END;
$fn$;
CREATE FUNCTION public.velmere_complete_stripe_webhook_effect(
  p_event_id text,p_effect_key text,p_expected_attempt integer,p_lease_token uuid,p_result_json jsonb
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT velmere_webhook_private.settle_effect(p_event_id,p_effect_key,p_expected_attempt,p_lease_token,'completed',coalesce(p_result_json,'null'::jsonb),NULL);
$fn$;
CREATE FUNCTION public.velmere_fail_stripe_webhook_effect(
  p_event_id text,p_effect_key text,p_expected_attempt integer,p_lease_token uuid,p_error_code text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT velmere_webhook_private.settle_effect(p_event_id,p_effect_key,p_expected_attempt,p_lease_token,'retryable_failed',NULL,p_error_code);
$fn$;
CREATE FUNCTION public.velmere_dead_letter_stripe_webhook_effect(
  p_event_id text,p_effect_key text,p_expected_attempt integer,p_lease_token uuid,p_error_code text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
  SELECT velmere_webhook_private.settle_effect(p_event_id,p_effect_key,p_expected_attempt,p_lease_token,'dead_letter',NULL,p_error_code);
$fn$;
REVOKE ALL ON FUNCTION public.velmere_claim_stripe_webhook_effect(text,text,text,uuid,integer),
  public.velmere_complete_stripe_webhook_effect(text,text,integer,uuid,jsonb),
  public.velmere_fail_stripe_webhook_effect(text,text,integer,uuid,text),
  public.velmere_dead_letter_stripe_webhook_effect(text,text,integer,uuid,text),
  velmere_webhook_private.settle_effect(text,text,integer,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_claim_stripe_webhook_effect(text,text,text,uuid,integer),
  public.velmere_complete_stripe_webhook_effect(text,text,integer,uuid,jsonb),
  public.velmere_fail_stripe_webhook_effect(text,text,integer,uuid,text),
  public.velmere_dead_letter_stripe_webhook_effect(text,text,integer,uuid,text),
  velmere_webhook_private.settle_effect(text,text,integer,uuid,text,jsonb,text) TO service_role;
COMMIT;
