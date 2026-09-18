-- Q6 isolated candidate. No production install, Stripe signature check or exactly-once claim.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('velmere.disposable_event_store', true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_EVENT_STORE_ACK_REQUIRED';
  END IF;
  IF to_regclass('public.velmere_stripe_webhook_events') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('velmere_claim_stripe_webhook_event','velmere_complete_stripe_webhook_event')) THEN
    RAISE EXCEPTION 'EXISTING_EVENT_OBJECTS_REQUIRE_REVIEW';
  END IF;
END;
$guard$;
CREATE TABLE public.velmere_stripe_webhook_events (
  id text PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_.:-]{1,180}$'),
  event_type text NOT NULL CHECK (event_type ~ '^[a-zA-Z0-9_.:-]{1,180}$'),
  event_created_at bigint NOT NULL CHECK (event_created_at BETWEEN 0 AND 253402300799),
  status text NOT NULL CHECK (status IN ('processing','processed','retryable_failed','dead_letter')),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  lease_expires_at timestamptz NOT NULL CHECK (isfinite(lease_expires_at)),
  claimed_at timestamptz NOT NULL CHECK (isfinite(claimed_at)),
  processed_at timestamptz CHECK (processed_at IS NULL OR isfinite(processed_at)),
  last_error_code text CHECK (last_error_code ~ '^[a-zA-Z0-9:_-]{1,160}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status='processing') = (processed_at IS NULL)),
  CHECK ((status IN ('retryable_failed','dead_letter')) = (last_error_code IS NOT NULL))
);
ALTER TABLE public.velmere_stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.velmere_stripe_webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.velmere_stripe_webhook_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.velmere_stripe_webhook_events TO service_role;
-- The existing application is a trusted service-role backend. A generation is
-- a stale-writer fence, NOT a bearer secret and not protection from that backend.
CREATE FUNCTION public.velmere_claim_stripe_webhook_event(
  p_event_id text,p_event_type text,p_event_created_at bigint,p_stale_after_seconds integer DEFAULT 300
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE r public.velmere_stripe_webhook_events%ROWTYPE; now_at timestamptz; acquired boolean := false; delay integer := 0;
BEGIN
  IF p_event_id IS NULL OR p_event_id !~ '^[a-zA-Z0-9_.:-]{1,180}$'
    OR p_event_type IS NULL OR p_event_type !~ '^[a-zA-Z0-9_.:-]{1,180}$'
    OR p_event_created_at IS NULL OR p_event_created_at NOT BETWEEN 0 AND 253402300799
    OR p_stale_after_seconds IS NULL OR p_stale_after_seconds NOT BETWEEN 1 AND 3600 THEN
    RAISE EXCEPTION 'INVALID_EVENT_CLAIM';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id, 516));
  SELECT * INTO r FROM public.velmere_stripe_webhook_events WHERE id=p_event_id FOR UPDATE;
  now_at := clock_timestamp(); -- after lock wait, independent of the caller's clock
  IF FOUND THEN
    IF r.event_type <> p_event_type OR r.event_created_at <> p_event_created_at THEN
      RAISE EXCEPTION 'EVENT_IDENTITY_CONFLICT';
    END IF;
    IF r.status='processing' AND r.lease_expires_at > now_at THEN
      delay := greatest(1,ceil(extract(epoch FROM r.lease_expires_at-now_at))::integer);
    ELSIF r.status IN ('processing','retryable_failed') THEN
      IF r.attempt_count=2147483647 THEN RAISE EXCEPTION 'EVENT_ATTEMPT_EXHAUSTED'; END IF;
      UPDATE public.velmere_stripe_webhook_events SET status='processing',attempt_count=attempt_count+1,
        claimed_at=now_at,lease_expires_at=now_at+make_interval(secs=>p_stale_after_seconds),
        processed_at=NULL,last_error_code=NULL,updated_at=now_at WHERE id=p_event_id RETURNING * INTO r;
      acquired := true;
    END IF;
  ELSE
    INSERT INTO public.velmere_stripe_webhook_events(id,event_type,event_created_at,status,attempt_count,
      lease_expires_at,claimed_at,created_at,updated_at)
      VALUES(p_event_id,p_event_type,p_event_created_at,'processing',1,
        now_at+make_interval(secs=>p_stale_after_seconds),now_at,now_at,now_at) RETURNING * INTO r;
    acquired := true;
  END IF;
  RETURN jsonb_build_object('claimed',acquired,'status',r.status,'attempt_count',r.attempt_count,
    'event_id',r.id,'event_type',r.event_type,'event_created_at',r.event_created_at,'retry_after_seconds',delay);
END;
$fn$;
CREATE FUNCTION public.velmere_complete_stripe_webhook_event(
  p_event_id text,p_event_type text,p_expected_attempt integer,p_status text,p_error_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE r public.velmere_stripe_webhook_events%ROWTYPE; applied boolean := false; replay boolean := false; now_at timestamptz;
BEGIN
  IF p_event_id IS NULL OR p_event_id !~ '^[a-zA-Z0-9_.:-]{1,180}$'
    OR p_event_type IS NULL OR p_event_type !~ '^[a-zA-Z0-9_.:-]{1,180}$'
    OR p_expected_attempt IS NULL OR p_expected_attempt < 1
    OR p_status IS NULL OR p_status NOT IN ('processed','retryable_failed','dead_letter')
    OR (p_status='processed' AND p_error_code IS NOT NULL)
    OR (p_status<>'processed' AND (p_error_code IS NULL OR p_error_code !~ '^[a-zA-Z0-9:_-]{1,160}$')) THEN
    RAISE EXCEPTION 'INVALID_EVENT_COMPLETION';
  END IF;
  SELECT * INTO r FROM public.velmere_stripe_webhook_events WHERE id=p_event_id FOR UPDATE;
  now_at := clock_timestamp();
  IF FOUND AND r.event_type=p_event_type AND r.attempt_count=p_expected_attempt THEN
    IF r.status=p_status AND r.last_error_code IS NOT DISTINCT FROM p_error_code THEN
      applied := true; replay := true; -- lost response may repeat this exact completed transition
    ELSIF r.status='processing' AND r.lease_expires_at > now_at THEN
      UPDATE public.velmere_stripe_webhook_events SET status=p_status,processed_at=now_at,
        last_error_code=p_error_code,updated_at=now_at WHERE id=p_event_id;
      applied := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('applied',applied,'idempotent',replay,'event_id',p_event_id,
    'event_type',p_event_type,'attempt_count',p_expected_attempt,'status',p_status);
END;
$fn$;
REVOKE ALL ON FUNCTION public.velmere_claim_stripe_webhook_event(text,text,bigint,integer),
  public.velmere_complete_stripe_webhook_event(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_claim_stripe_webhook_event(text,text,bigint,integer),
  public.velmere_complete_stripe_webhook_event(text,text,integer,text,text) TO service_role;
COMMIT;
