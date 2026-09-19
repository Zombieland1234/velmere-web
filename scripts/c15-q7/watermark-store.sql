-- Q7 isolated implementation of the existing ordering policy.
-- Not a production migration; one trusted Stripe-account/environment context per DB.
-- A watermark records admission priority, NEVER proof of completed side effects.
BEGIN;
DO $guard$ BEGIN
  IF current_setting('velmere.disposable_watermark_store',true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_WATERMARK_STORE_ACK_REQUIRED';
  END IF;
  IF to_regnamespace('velmere_payment_private') IS NOT NULL OR EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='velmere_apply_payment_event_watermark') THEN
    RAISE EXCEPTION 'EXISTING_WATERMARK_OBJECTS_REQUIRE_REVIEW';
  END IF;
END $guard$;
CREATE SCHEMA velmere_payment_private;
REVOKE ALL ON SCHEMA velmere_payment_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA velmere_payment_private TO service_role;
CREATE TABLE velmere_payment_private.event_identities (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 1 AND 180 AND event_id !~ '[^a-zA-Z0-9._:-]'),
  subject_key text NOT NULL CHECK (length(subject_key) BETWEEN 1 AND 512 AND subject_key !~ '[^a-zA-Z0-9._:-]'),
  event_created_at bigint NOT NULL CHECK (event_created_at BETWEEN 0 AND 253402300799),
  event_kind text NOT NULL CHECK (event_kind IN ('payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE velmere_payment_private.event_watermarks (
  subject_key text PRIMARY KEY CHECK (length(subject_key) BETWEEN 1 AND 512 AND subject_key !~ '[^a-zA-Z0-9._:-]'),
  event_id text NOT NULL REFERENCES velmere_payment_private.event_identities(event_id),
  event_created_at bigint NOT NULL CHECK (event_created_at BETWEEN 0 AND 253402300799),
  event_kind text NOT NULL CHECK (event_kind IN ('payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback')),
  event_priority integer NOT NULL CHECK (event_priority = CASE event_kind
    WHEN 'payment_pending' THEN 10 WHEN 'payment_failed' THEN 20 WHEN 'checkout_completed' THEN 40
    WHEN 'partial_refund' THEN 60 WHEN 'refund' THEN 80 WHEN 'chargeback' THEN 100 END),
  terminal boolean NOT NULL CHECK (terminal=(event_kind IN ('refund','chargeback'))),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE velmere_payment_private.event_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_payment_private.event_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE velmere_payment_private.event_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_payment_private.event_watermarks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA velmere_payment_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON velmere_payment_private.event_identities TO service_role;
GRANT SELECT,INSERT,UPDATE ON velmere_payment_private.event_watermarks TO service_role;
CREATE FUNCTION public.velmere_apply_payment_event_watermark(
  p_subject_key text,p_event_id text,p_event_created_at bigint,p_event_kind text,
  p_event_priority integer,p_terminal boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE
  r velmere_payment_private.event_watermarks%ROWTYPE;
  seen velmere_payment_private.event_identities%ROWTYPE;
  expected_priority integer; expected_terminal boolean; accepted boolean;
  reason text; request_mark jsonb; previous_mark jsonb; current_mark jsonb;
BEGIN
  expected_priority:=CASE p_event_kind
    WHEN 'payment_pending' THEN 10 WHEN 'payment_failed' THEN 20 WHEN 'checkout_completed' THEN 40
    WHEN 'partial_refund' THEN 60 WHEN 'refund' THEN 80 WHEN 'chargeback' THEN 100 END;
  expected_terminal:=p_event_kind IN ('refund','chargeback');
  IF p_subject_key IS NULL OR length(p_subject_key) NOT BETWEEN 1 AND 512 OR p_subject_key ~ '[^a-zA-Z0-9._:-]'
    OR p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 180 OR p_event_id ~ '[^a-zA-Z0-9._:-]'
    OR p_event_created_at IS NULL OR p_event_created_at NOT BETWEEN 0 AND 253402300799
    OR expected_priority IS NULL OR p_event_priority IS DISTINCT FROM expected_priority
    OR p_terminal IS DISTINCT FROM expected_terminal THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_WATERMARK';
  END IF;
  -- Global lock order: event first, then subject (separate integer namespaces).
  -- Hash collision only serializes unrelated keys; exact text still determines identity.
  PERFORM pg_advisory_xact_lock(617,hashtext(p_event_id));
  PERFORM pg_advisory_xact_lock(618,hashtext(p_subject_key));
  SELECT * INTO seen FROM velmere_payment_private.event_identities WHERE event_id=p_event_id;
  IF FOUND THEN
    IF seen.subject_key<>p_subject_key OR seen.event_created_at<>p_event_created_at OR seen.event_kind<>p_event_kind THEN
      RAISE EXCEPTION 'PAYMENT_EVENT_IDENTITY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO velmere_payment_private.event_identities(event_id,subject_key,event_created_at,event_kind)
      VALUES(p_event_id,p_subject_key,p_event_created_at,p_event_kind);
  END IF;
  request_mark:=jsonb_build_object('subjectKey',p_subject_key,'eventId',p_event_id,'eventCreatedAt',p_event_created_at,
    'kind',p_event_kind,'priority',expected_priority,'terminal',expected_terminal);
  SELECT * INTO r FROM velmere_payment_private.event_watermarks WHERE subject_key=p_subject_key FOR UPDATE;
  IF NOT FOUND THEN
    previous_mark:=NULL; accepted:=true; reason:='first_event';
  ELSE
    previous_mark:=jsonb_build_object('subjectKey',r.subject_key,'eventId',r.event_id,'eventCreatedAt',r.event_created_at,
      'kind',r.event_kind,'priority',r.event_priority,'terminal',r.terminal);
    IF r.event_id=p_event_id THEN accepted:=false; reason:='duplicate_event';
    ELSIF r.terminal AND expected_priority<r.event_priority THEN accepted:=false; reason:='terminal_state_dominates';
    ELSIF expected_priority>r.event_priority THEN accepted:=true; reason:='higher_priority';
    ELSIF expected_priority<r.event_priority THEN accepted:=false; reason:='lower_priority';
    ELSIF p_event_created_at>r.event_created_at THEN accepted:=true; reason:='same_priority_newer';
    ELSE accepted:=false; reason:='older_same_priority'; END IF;
  END IF;
  IF accepted THEN
    INSERT INTO velmere_payment_private.event_watermarks(subject_key,event_id,event_created_at,event_kind,event_priority,terminal)
      VALUES(p_subject_key,p_event_id,p_event_created_at,p_event_kind,expected_priority,expected_terminal)
      ON CONFLICT(subject_key) DO UPDATE SET event_id=EXCLUDED.event_id,event_created_at=EXCLUDED.event_created_at,
        event_kind=EXCLUDED.event_kind,event_priority=EXCLUDED.event_priority,terminal=EXCLUDED.terminal,updated_at=clock_timestamp();
    current_mark:=request_mark;
  ELSE current_mark:=previous_mark; END IF;
  RETURN jsonb_build_object('schema','velmere.payment-watermark.v1','ok',true,'accepted',accepted,'reason',reason,
    'request',request_mark,'previous',previous_mark,'current',current_mark);
END $fn$;
REVOKE ALL ON FUNCTION public.velmere_apply_payment_event_watermark(text,text,bigint,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_apply_payment_event_watermark(text,text,bigint,text,integer,boolean) TO service_role;
COMMIT;
