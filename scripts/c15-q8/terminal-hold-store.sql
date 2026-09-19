-- Q8 candidate for a DISPOSABLE database. Not an applied production migration.
-- One trusted Stripe account/environment. Only full refunds and chargebacks.
-- Install atomically with the application. This protects first-grant creation;
-- it is NOT a distributed lock on every external payment/fulfilment operation.
BEGIN;
DO $guard$
DECLARE c text; l text;
BEGIN
  IF current_setting('velmere.disposable_terminal_hold_store',true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_TERMINAL_HOLD_ACK_REQUIRED';
  END IF;
  SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') INTO c FROM pg_proc
    WHERE oid=to_regprocedure('public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone)');
  SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') INTO l FROM pg_proc
    WHERE oid=to_regprocedure('public.velmere_apply_vlm_paid_entitlement_lifecycle_event(text,text,text,text,text,text,timestamp with time zone)');
  IF c IS DISTINCT FROM 'e64ea6e7e373d51e8b6166fac1f18d26b4959967b5e4eb5760085b5ce4635cf1'
    OR l IS DISTINCT FROM '0fa76ff7fa816548e43ae1bc33634289632865e2db51bf5c4db9932e703378ee' THEN
    RAISE EXCEPTION 'Q4_FUNCTION_PARITY_REVIEW_REQUIRED';
  END IF;
  IF to_regclass('velmere_billing_private.session_terminal_holds') IS NOT NULL OR EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='velmere_record_vlm_terminal_payment_hold') OR
    to_regprocedure('velmere_billing_private.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone)') IS NOT NULL THEN
    RAISE EXCEPTION 'EXISTING_TERMINAL_HOLD_OBJECTS_REQUIRE_REVIEW';
  END IF;
END $guard$;
CREATE TABLE velmere_billing_private.session_terminal_holds (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 1 AND 180 AND event_id !~ '[^a-zA-Z0-9._:-]'),
  stripe_session_id text NOT NULL CHECK (length(stripe_session_id) BETWEEN 1 AND 180 AND stripe_session_id !~ '[^a-zA-Z0-9._:-]'),
  product_id text NOT NULL,
  context_hash text NOT NULL CHECK (context_hash ~ '^[a-f0-9]{64}$'),
  event_type text NOT NULL CHECK (event_type IN ('refund','chargeback')),
  event_created_at bigint NOT NULL CHECK (event_created_at BETWEEN 0 AND 253402300799),
  receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt)='object'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX session_terminal_holds_session_idx ON velmere_billing_private.session_terminal_holds(stripe_session_id);
ALTER TABLE velmere_billing_private.session_terminal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_billing_private.session_terminal_holds FORCE ROW LEVEL SECURITY;
REVOKE ALL ON velmere_billing_private.session_terminal_holds FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON velmere_billing_private.session_terminal_holds TO service_role;
-- Preserve the exact reviewed Q4 implementation as a private dependency rather
-- than silently duplicating or weakening its price/context/expiry checks.
ALTER FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz)
  SET SCHEMA velmere_billing_private;
CREATE FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(
  p_id text,p_stripe_session_id text,p_stripe_customer_id text,p_product_id text,
  p_access_scope text,p_context_hash text,p_context jsonb,p_locale text,
  p_amount_total bigint,p_currency text,p_customer_email text,p_customer_name text,
  p_payment_status text,p_source text,p_audit_queue_id text,p_expires_at timestamptz,p_created_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
  IF p_stripe_session_id IS NULL OR length(p_stripe_session_id) NOT BETWEEN 1 AND 180 OR p_stripe_session_id<>btrim(p_stripe_session_id) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_entitlement_record','retryable',false,'terminal',true);
  END IF;
  -- SAME lock as the original create RPC and hold writer. Check plus creation
  -- are one transaction; no unlocked read-then-create window is introduced.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_stripe_session_id,414));
  IF EXISTS (SELECT 1 FROM velmere_billing_private.session_terminal_holds WHERE stripe_session_id=p_stripe_session_id) THEN
    RETURN jsonb_build_object('ok',false,'error','entitlement_release_hold','retryable',false,'terminal',true);
  END IF;
  RETURN velmere_billing_private.velmere_create_or_read_vlm_paid_entitlement(
    p_id,p_stripe_session_id,p_stripe_customer_id,p_product_id,p_access_scope,p_context_hash,p_context,p_locale,
    p_amount_total,p_currency,p_customer_email,p_customer_name,p_payment_status,p_source,p_audit_queue_id,p_expires_at,p_created_at);
END $fn$;
CREATE FUNCTION public.velmere_record_vlm_terminal_payment_hold(
  p_stripe_session_id text,p_product_id text,p_context_hash text,p_event_id text,p_event_type text,p_event_created_at bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE r public.velmere_vlm_paid_entitlements%ROWTYPE;
  h velmere_billing_private.session_terminal_holds%ROWTYPE;
  result jsonb; lifecycle jsonb; disposition text; observed text; entitlement text;
BEGIN
  IF p_stripe_session_id IS NULL OR length(p_stripe_session_id) NOT BETWEEN 1 AND 180 OR p_stripe_session_id ~ '[^a-zA-Z0-9._:-]'
    OR p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 180 OR p_event_id ~ '[^a-zA-Z0-9._:-]'
    OR p_context_hash IS NULL OR p_context_hash !~ '^[a-f0-9]{64}$'
    OR p_product_id IS NULL OR p_product_id NOT IN ('vlm_pro_analysis_single','vlm_pro_pdf_single','vlm_pro_audit_review','vlm_advanced_analysis_single','vlm_advanced_pdf_single','vlm_advanced_audit_human_review')
    OR p_event_type IS NULL OR p_event_type NOT IN ('refund','chargeback')
    OR p_event_created_at IS NULL OR p_event_created_at NOT BETWEEN 0 AND 253402300799 THEN
    RAISE EXCEPTION 'INVALID_TERMINAL_HOLD_INPUT';
  END IF;
  PERFORM pg_advisory_xact_lock(628,hashtext(p_event_id));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_stripe_session_id,414));
  SELECT * INTO h FROM velmere_billing_private.session_terminal_holds WHERE event_id=p_event_id;
  IF FOUND THEN
    IF h.stripe_session_id<>p_stripe_session_id OR h.product_id<>p_product_id OR h.context_hash<>p_context_hash
       OR h.event_type<>p_event_type OR h.event_created_at<>p_event_created_at THEN
      RAISE EXCEPTION 'TERMINAL_HOLD_IDENTITY_CONFLICT';
    END IF;
    RETURN h.receipt; -- Original observation, NOT a current-state snapshot.
  END IF;
  -- Resolve the immutable ID under the session lock, then use the SAME event ->
  -- row ordering as Q4 lifecycle. Locking the row first would invert that order
  -- against a concurrent ordinary lifecycle call for this exact event.
  SELECT * INTO r FROM public.velmere_vlm_paid_entitlements WHERE stripe_session_id=p_stripe_session_id;
  IF FOUND THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      encode(sha256(convert_to('stripe:'||p_event_id||':entitlement:'||r.id,'UTF8')),'hex'),415));
    SELECT * INTO r FROM public.velmere_vlm_paid_entitlements WHERE stripe_session_id=p_stripe_session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TERMINAL_HOLD_BINDING_CHANGED'; END IF;
    IF r.product_id<>p_product_id OR r.context_hash<>p_context_hash THEN RAISE EXCEPTION 'TERMINAL_HOLD_BINDING_CONFLICT'; END IF;
    entitlement:=r.id;
    IF r.status IN ('revoked','consumed') OR (r.status='refunded' AND p_event_type='refund') THEN
      disposition:='already_terminal';observed:=r.status;
    ELSE
      lifecycle:=public.velmere_apply_vlm_paid_entitlement_lifecycle_event(
        r.id,encode(sha256(convert_to('stripe:'||p_event_id||':entitlement:'||r.id,'UTF8')),'hex'),p_event_type,
        encode(sha256(convert_to(p_event_id,'UTF8')),'hex'),NULL,
        encode(sha256(convert_to(CASE p_event_type WHEN 'refund' THEN 'charge.refunded' ELSE 'charge.dispute.created' END,'UTF8')),'hex'),
        to_timestamp(p_event_created_at));
      IF (lifecycle->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'TERMINAL_HOLD_LIFECYCLE_FAILED'; END IF;
      disposition:='lifecycle_applied';observed:=lifecycle->>'next_status';
    END IF;
  ELSE
    disposition:='held_before_grant';observed:=NULL;entitlement:=NULL;
  END IF;
  result:=jsonb_build_object('schema','velmere.vlm-terminal-hold.v1','ok',true,
    'request',jsonb_build_object('stripeSessionId',p_stripe_session_id,'productId',p_product_id,'contextHash',p_context_hash,
      'eventId',p_event_id,'event',p_event_type,'eventCreatedAt',p_event_created_at),
    'disposition',disposition,'entitlementId',entitlement,'observedStatus',observed);
  INSERT INTO velmere_billing_private.session_terminal_holds(event_id,stripe_session_id,product_id,context_hash,event_type,event_created_at,receipt)
    VALUES(p_event_id,p_stripe_session_id,p_product_id,p_context_hash,p_event_type,p_event_created_at,result);
  RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_create_or_read_vlm_paid_entitlement(text,text,text,text,text,text,jsonb,text,bigint,text,text,text,text,text,text,timestamptz,timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_record_vlm_terminal_payment_hold(text,text,text,text,text,bigint) TO service_role;
COMMIT;
