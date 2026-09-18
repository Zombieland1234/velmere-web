-- C15-Q4 candidate: isolated contract qualification, NOT a production migration.
-- No checkout, public sale, payment evidence or provider permission is enabled here.
-- A production rollout needs separately reviewed migrations, existing-schema parity,
-- webhook/effect/hold stores, operator authorization and an end-to-end TEST payment.
BEGIN;
DO $guard$
BEGIN
  IF current_setting('velmere.disposable_entitlement_store', true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_STORE_ACK_REQUIRED';
  END IF;
  IF to_regclass('public.velmere_vlm_paid_entitlements') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'velmere_billing_private')
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN
       ('velmere_create_or_read_vlm_paid_entitlement', 'velmere_apply_vlm_paid_entitlement_lifecycle_event')) THEN
    RAISE EXCEPTION 'EXISTING_BILLING_OBJECTS_REQUIRE_REVIEW';
  END IF;
END;
$guard$;

CREATE SCHEMA velmere_billing_private;
REVOKE ALL ON SCHEMA velmere_billing_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA velmere_billing_private TO service_role;

CREATE TABLE public.velmere_vlm_paid_entitlements (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 180 AND id = btrim(id)),
  stripe_session_id text NOT NULL UNIQUE CHECK (length(stripe_session_id) BETWEEN 1 AND 180),
  stripe_customer_id text,
  product_id text NOT NULL CHECK (product_id IN ('vlm_pro_analysis_single','vlm_pro_pdf_single',
    'vlm_pro_audit_review','vlm_advanced_analysis_single','vlm_advanced_pdf_single','vlm_advanced_audit_human_review')),
  access_scope text NOT NULL,
  status text NOT NULL CHECK (status IN ('paid','active','expired','refunded','revoked','consumed')),
  context_hash text NOT NULL CHECK (context_hash ~ '^[a-f0-9]{64}$'),
  context jsonb NOT NULL CHECK (jsonb_typeof(context) = 'object' AND octet_length(context::text) <= 8192
    AND context ? 'accountIdHash' AND jsonb_typeof(context->'accountIdHash') = 'string'
    AND (context->>'accountIdHash') ~ '^[a-f0-9]{64}$'),
  locale text NOT NULL CHECK (locale IN ('pl','en','de') AND context ? 'locale' AND context->>'locale' = locale),
  amount_total bigint NOT NULL CHECK (amount_total BETWEEN 0 AND 9007199254740991),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  customer_email text CHECK (length(customer_email) <= 320),
  customer_name text CHECK (length(customer_name) <= 500),
  payment_status text NOT NULL,
  source text NOT NULL CHECK (source IN ('stripe_webhook','checkout_verify','manual_repair')),
  created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
  updated_at timestamptz NOT NULL CHECK (isfinite(updated_at)),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at > created_at),
  audit_queue_id text
);
CREATE INDEX velmere_vlm_paid_account_lookup ON public.velmere_vlm_paid_entitlements
  ((context->>'accountIdHash'), product_id, context_hash, status, expires_at);
ALTER TABLE public.velmere_vlm_paid_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.velmere_vlm_paid_entitlements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.velmere_vlm_paid_entitlements FROM PUBLIC, anon, authenticated;
-- Existing application reads this relation through a server-only service client.
-- SECURITY INVOKER RPCs share that trusted role; there is no user JWT write path.
GRANT SELECT, INSERT, UPDATE ON public.velmere_vlm_paid_entitlements TO service_role;

CREATE TABLE velmere_billing_private.lifecycle_events (
  event_id_hash text PRIMARY KEY CHECK (event_id_hash ~ '^[a-f0-9]{64}$'),
  entitlement_id text NOT NULL REFERENCES public.velmere_vlm_paid_entitlements(id),
  event_type text NOT NULL CHECK (event_type IN ('expire','refund','chargeback','manual_revoke','restore')),
  source_event_hash text,
  operator_hash text,
  reason_hash text,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE velmere_billing_private.lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_billing_private.lifecycle_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON velmere_billing_private.lifecycle_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON velmere_billing_private.lifecycle_events TO service_role;

CREATE FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(
  p_id text, p_stripe_session_id text, p_stripe_customer_id text, p_product_id text,
  p_access_scope text, p_context_hash text, p_context jsonb, p_locale text,
  p_amount_total bigint, p_currency text, p_customer_email text, p_customer_name text,
  p_payment_status text, p_source text, p_audit_queue_id text,
  p_expires_at timestamptz, p_created_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE r public.velmere_vlm_paid_entitlements%ROWTYPE; expected_scope text;
BEGIN
  expected_scope := CASE p_product_id
    WHEN 'vlm_pro_analysis_single' THEN 'vlm_pro_analysis'
    WHEN 'vlm_pro_pdf_single' THEN 'vlm_pro_pdf'
    WHEN 'vlm_pro_audit_review' THEN 'audit_pro_review'
    WHEN 'vlm_advanced_analysis_single' THEN 'vlm_advanced_analysis'
    WHEN 'vlm_advanced_pdf_single' THEN 'vlm_advanced_pdf'
    WHEN 'vlm_advanced_audit_human_review' THEN 'audit_advanced_analysis' END;
  IF p_id IS NULL OR length(p_id) NOT BETWEEN 1 AND 180 OR p_id <> btrim(p_id)
    OR p_stripe_session_id IS NULL OR length(p_stripe_session_id) NOT BETWEEN 1 AND 180
    OR p_stripe_session_id <> btrim(p_stripe_session_id) OR expected_scope IS NULL
    OR p_access_scope IS DISTINCT FROM expected_scope OR p_payment_status IS DISTINCT FROM 'paid'
    OR p_source IS NULL OR p_source NOT IN ('stripe_webhook','checkout_verify','manual_repair')
    OR p_context_hash IS NULL OR p_context_hash !~ '^[a-f0-9]{64}$'
    OR p_context IS NULL OR jsonb_typeof(p_context) IS DISTINCT FROM 'object'
    OR octet_length(p_context::text) > 8192
    OR jsonb_typeof(p_context->'accountIdHash') IS DISTINCT FROM 'string'
    OR (p_context->>'accountIdHash') !~ '^[a-f0-9]{64}$'
    OR p_locale IS NULL OR p_locale NOT IN ('pl','en','de')
    OR (p_context->>'locale') IS DISTINCT FROM p_locale
    OR p_amount_total IS NULL OR p_amount_total NOT BETWEEN 0 AND 9007199254740991
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR length(p_customer_email) > 320 OR length(p_customer_name) > 500
    OR p_created_at IS NULL OR p_expires_at IS NULL
    OR NOT isfinite(p_created_at) OR NOT isfinite(p_expires_at) OR p_expires_at <= p_created_at THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_entitlement_record','retryable',false,'terminal',true);
  END IF;
  -- One server-authored Checkout Session is single-use evidence for one binding.
  -- Hash collisions only serialize extra work; they cannot conflate row identity.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_stripe_session_id, 414));
  SELECT * INTO r FROM public.velmere_vlm_paid_entitlements
    WHERE stripe_session_id = p_stripe_session_id FOR UPDATE;
  IF FOUND THEN
    IF r.id <> p_id OR r.product_id <> p_product_id OR r.context_hash <> p_context_hash
      OR r.context <> p_context OR r.access_scope <> p_access_scope OR r.locale <> p_locale
      OR r.amount_total <> p_amount_total OR r.currency <> p_currency
      OR r.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id THEN
      RETURN jsonb_build_object('ok',false,'error','entitlement_binding_conflict','retryable',false,'terminal',true);
    END IF;
    IF r.status NOT IN ('paid','active') OR r.expires_at <= clock_timestamp()
      OR r.payment_status IN ('refunded','revoked','disputed','chargeback','hold') THEN
      RETURN jsonb_build_object('ok',false,'error','entitlement_terminal_state','retryable',false,'terminal',true);
    END IF;
    -- Never refresh expiry, ownership, source, queue or status on re-verification.
    RETURN to_jsonb(r) || jsonb_build_object('ok',true,'idempotent',true,'created',false);
  END IF;
  IF p_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('ok',false,'error','entitlement_expired','retryable',false,'terminal',true);
  END IF;
  INSERT INTO public.velmere_vlm_paid_entitlements VALUES
    (p_id,p_stripe_session_id,p_stripe_customer_id,p_product_id,p_access_scope,'active',
     p_context_hash,p_context,p_locale,p_amount_total,p_currency,p_customer_email,p_customer_name,
     p_payment_status,p_source,p_created_at,p_created_at,p_expires_at,p_audit_queue_id) RETURNING * INTO r;
  RETURN to_jsonb(r) || jsonb_build_object('ok',true,'idempotent',false,'created',true);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'error','entitlement_identity_conflict','retryable',false,'terminal',true);
END;
$fn$;

CREATE FUNCTION public.velmere_apply_vlm_paid_entitlement_lifecycle_event(
  p_entitlement_id text, p_event_id_hash text, p_event_type text,
  p_source_event_hash text, p_operator_hash text, p_reason_hash text, p_event_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE r public.velmere_vlm_paid_entitlements%ROWTYPE;
  e velmere_billing_private.lifecycle_events%ROWTYPE; n text;
BEGIN
  IF p_entitlement_id IS NULL OR length(p_entitlement_id) NOT BETWEEN 1 AND 180
    OR p_entitlement_id <> btrim(p_entitlement_id)
    OR p_event_id_hash IS NULL OR p_event_id_hash !~ '^[a-f0-9]{64}$'
    OR p_event_type IS NULL OR p_event_type NOT IN ('expire','refund','chargeback','manual_revoke','restore')
    OR (p_source_event_hash IS NOT NULL AND p_source_event_hash !~ '^[a-f0-9]{64}$')
    OR (p_operator_hash IS NOT NULL AND p_operator_hash !~ '^[a-f0-9]{64}$')
    OR (p_reason_hash IS NOT NULL AND p_reason_hash !~ '^[a-f0-9]{64}$')
    OR p_event_at IS NULL OR NOT isfinite(p_event_at) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_entitlement_lifecycle_request','retryable',false);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id_hash, 415));
  SELECT * INTO e FROM velmere_billing_private.lifecycle_events WHERE event_id_hash = p_event_id_hash;
  IF FOUND THEN
    IF e.entitlement_id <> p_entitlement_id OR e.event_type <> p_event_type
      OR e.source_event_hash IS DISTINCT FROM p_source_event_hash
      OR e.operator_hash IS DISTINCT FROM p_operator_hash OR e.reason_hash IS DISTINCT FROM p_reason_hash THEN
      RETURN jsonb_build_object('ok',false,'error','lifecycle_event_identity_conflict','retryable',false);
    END IF;
    -- Replay returns the original transition; it never replays the UPDATE.
    RETURN jsonb_build_object('ok',true,'idempotent',true,'event_type',e.event_type,
      'previous_status',e.previous_status,'next_status',e.next_status,
      'entitlement_id_hash',encode(sha256(convert_to(p_entitlement_id,'UTF8')),'hex'),
      'event_id_hash',e.event_id_hash);
  END IF;
  SELECT * INTO r FROM public.velmere_vlm_paid_entitlements WHERE id = p_entitlement_id FOR UPDATE;
  IF NOT FOUND THEN
    -- A refund arriving before its grant must not be acknowledged as applied.
    RETURN jsonb_build_object('ok',false,'error','entitlement_not_found','retryable',true);
  END IF;
  n := CASE
    WHEN p_event_type = 'expire' AND r.status IN ('paid','active','expired') THEN 'expired'
    WHEN p_event_type = 'refund' AND r.status IN ('paid','active','expired','refunded') THEN 'refunded'
    WHEN p_event_type IN ('chargeback','manual_revoke') AND r.status IN ('paid','active','expired','refunded','revoked') THEN 'revoked'
    WHEN p_event_type = 'restore' AND r.status IN ('expired','active') THEN 'active' END;
  IF n IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_entitlement_state_transition','retryable',false);
  END IF;
  IF n <> r.status THEN
    UPDATE public.velmere_vlm_paid_entitlements SET status = n, updated_at = clock_timestamp(),
      payment_status = CASE WHEN n IN ('refunded','revoked') THEN n ELSE payment_status END
      WHERE id = p_entitlement_id;
  END IF;
  INSERT INTO velmere_billing_private.lifecycle_events
    (event_id_hash,entitlement_id,event_type,source_event_hash,operator_hash,reason_hash,previous_status,next_status,occurred_at)
    VALUES (p_event_id_hash,p_entitlement_id,p_event_type,p_source_event_hash,p_operator_hash,p_reason_hash,r.status,n,p_event_at);
  RETURN jsonb_build_object('ok',true,'idempotent',n = r.status,'event_type',p_event_type,
    'previous_status',r.status,'next_status',n,
    'entitlement_id_hash',encode(sha256(convert_to(p_entitlement_id,'UTF8')),'hex'),'event_id_hash',p_event_id_hash);
END;
$fn$;

REVOKE ALL ON FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.velmere_apply_vlm_paid_entitlement_lifecycle_event(text,text,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_apply_vlm_paid_entitlement_lifecycle_event(text,text,text,text,text,text,timestamptz) TO service_role;
COMMIT;
