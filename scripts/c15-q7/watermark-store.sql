-- Isolated Q7 candidate. Not an applied production migration. One trusted Stripe
-- account/mode per database scope; no signatures, prices, auth, or effect completion here.
BEGIN;
DO $guard$ BEGIN
  IF current_setting('velmere.disposable_watermark_store',true) IS DISTINCT FROM 'ISOLATED_TEST_ONLY' THEN
    RAISE EXCEPTION 'DISPOSABLE_WATERMARK_STORE_ACK_REQUIRED';
  END IF;
  IF to_regclass('public.velmere_payment_event_watermarks') IS NOT NULL
    OR to_regclass('velmere_billing_private.payment_event_identities') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_proc WHERE proname='velmere_apply_payment_event_watermark') THEN
    RAISE EXCEPTION 'EXISTING_WATERMARK_OBJECTS_REQUIRE_REVIEW';
  END IF;
END $guard$;
CREATE SCHEMA IF NOT EXISTS velmere_billing_private;
REVOKE ALL ON SCHEMA velmere_billing_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA velmere_billing_private TO service_role;
CREATE TABLE public.velmere_payment_event_watermarks (
  subject_key text PRIMARY KEY CHECK(subject_key ~ '^[A-Za-z0-9._:-]{1,240}$'),
  event_id text NOT NULL CHECK(event_id ~ '^[A-Za-z0-9._:-]{1,180}$'),
  event_created_at bigint NOT NULL CHECK(event_created_at BETWEEN 0 AND 253402300799),
  kind text NOT NULL CHECK(kind IN ('payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback')),
  priority integer NOT NULL,
  terminal boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(priority=CASE kind WHEN 'payment_pending' THEN 10 WHEN 'payment_failed' THEN 20 WHEN 'checkout_completed' THEN 40
    WHEN 'partial_refund' THEN 60 WHEN 'refund' THEN 80 WHEN 'chargeback' THEN 100 END),
  CHECK(terminal=(kind IN ('refund','chargeback')))
);
CREATE TABLE velmere_billing_private.payment_event_identities (
  event_id text PRIMARY KEY CHECK(event_id ~ '^[A-Za-z0-9._:-]{1,180}$'),
  subject_key text NOT NULL CHECK(subject_key ~ '^[A-Za-z0-9._:-]{1,240}$'),
  event_created_at bigint NOT NULL CHECK(event_created_at BETWEEN 0 AND 253402300799),
  kind text NOT NULL CHECK(kind IN ('payment_pending','payment_failed','checkout_completed','partial_refund','refund','chargeback')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.velmere_payment_event_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.velmere_payment_event_watermarks FORCE ROW LEVEL SECURITY;
ALTER TABLE velmere_billing_private.payment_event_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_billing_private.payment_event_identities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.velmere_payment_event_watermarks,velmere_billing_private.payment_event_identities FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.velmere_payment_event_watermarks TO service_role;
GRANT SELECT,INSERT ON velmere_billing_private.payment_event_identities TO service_role;
CREATE FUNCTION public.velmere_apply_payment_event_watermark(
 p_subject_key text,p_event_id text,p_event_created_at bigint,p_event_kind text,p_event_priority integer,p_terminal boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE r public.velmere_payment_event_watermarks%ROWTYPE;
 identity_row velmere_billing_private.payment_event_identities%ROWTYPE;
 expected_priority integer; allowed boolean; why text; old_state jsonb:=NULL; next_state jsonb;
BEGIN
 expected_priority:=CASE p_event_kind WHEN 'payment_pending' THEN 10 WHEN 'payment_failed' THEN 20 WHEN 'checkout_completed' THEN 40
   WHEN 'partial_refund' THEN 60 WHEN 'refund' THEN 80 WHEN 'chargeback' THEN 100 END;
 IF p_subject_key IS NULL OR p_subject_key !~ '^[A-Za-z0-9._:-]{1,240}$'
   OR p_event_id IS NULL OR p_event_id !~ '^[A-Za-z0-9._:-]{1,180}$'
   OR p_event_created_at IS NULL OR p_event_created_at NOT BETWEEN 0 AND 253402300799
   OR expected_priority IS NULL OR p_event_priority IS DISTINCT FROM expected_priority
   OR p_terminal IS DISTINCT FROM (p_event_kind IN ('refund','chargeback')) THEN
   RAISE EXCEPTION 'INVALID_PAYMENT_WATERMARK_INPUT';
 END IF;
 -- Fixed lock order: event identity, then payment subject. Collisions serialize,
 -- but do not merge identities. Locks end at the transaction, not after an API call.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id,717));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject_key,718));
 SELECT * INTO identity_row FROM velmere_billing_private.payment_event_identities WHERE event_id=p_event_id;
 IF FOUND THEN
   IF identity_row.subject_key<>p_subject_key OR identity_row.kind<>p_event_kind OR identity_row.event_created_at<>p_event_created_at THEN
     RAISE EXCEPTION 'PAYMENT_EVENT_IDENTITY_CONFLICT';
   END IF;
 ELSE
   INSERT INTO velmere_billing_private.payment_event_identities(event_id,subject_key,event_created_at,kind)
     VALUES(p_event_id,p_subject_key,p_event_created_at,p_event_kind);
 END IF;
 SELECT * INTO r FROM public.velmere_payment_event_watermarks WHERE subject_key=p_subject_key FOR UPDATE;
 IF NOT FOUND THEN
   allowed:=true;why:='first_event';
 ELSE
   old_state:=jsonb_build_object('subjectKey',r.subject_key,'eventId',r.event_id,'eventCreatedAt',r.event_created_at,
     'kind',r.kind,'priority',r.priority,'terminal',r.terminal);
   IF r.event_id=p_event_id THEN allowed:=false;why:='duplicate_event';
   ELSIF r.terminal AND p_event_priority<r.priority THEN allowed:=false;why:='terminal_state_dominates';
   ELSIF p_event_priority>r.priority THEN allowed:=true;why:='higher_priority';
   ELSIF p_event_priority<r.priority THEN allowed:=false;why:='lower_priority';
   ELSIF p_event_created_at>r.event_created_at THEN allowed:=true;why:='same_priority_newer';
   ELSE allowed:=false;why:='older_same_priority';
   END IF;
 END IF;
 IF allowed THEN
   INSERT INTO public.velmere_payment_event_watermarks(subject_key,event_id,event_created_at,kind,priority,terminal)
   VALUES(p_subject_key,p_event_id,p_event_created_at,p_event_kind,p_event_priority,p_terminal)
   ON CONFLICT(subject_key) DO UPDATE SET event_id=excluded.event_id,event_created_at=excluded.event_created_at,
     kind=excluded.kind,priority=excluded.priority,terminal=excluded.terminal,updated_at=clock_timestamp()
   RETURNING * INTO r;
 END IF;
 next_state:=jsonb_build_object('subjectKey',r.subject_key,'eventId',r.event_id,'eventCreatedAt',r.event_created_at,
   'kind',r.kind,'priority',r.priority,'terminal',r.terminal);
 -- This decision records observed ordering only. It does not assert a refund,
 -- grant, external side effect or terminal handler has completed successfully.
 RETURN jsonb_build_object('schema_version','velmere.payment-watermark.v1','ok',true,'accepted',allowed,'reason',why,
   'subject_key',p_subject_key,'event_id',p_event_id,'event_kind',p_event_kind,'event_created_at',p_event_created_at,
   'previous',old_state,'current',next_state);
END $fn$;
REVOKE ALL ON FUNCTION public.velmere_apply_payment_event_watermark(text,text,bigint,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velmere_apply_payment_event_watermark(text,text,bigint,text,integer,boolean) TO service_role;
COMMIT;
