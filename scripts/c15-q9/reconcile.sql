-- READ-ONLY consistency inspection across Q4--Q8; one statement, one snapshot.
-- This does NOT contact Stripe, prove payment authenticity, repair data, release
-- holds, grant access, delete anything, or certify release readiness.
-- Missing tables fail the query. No absent-store-as-empty fallback is allowed.
WITH clock AS (SELECT statement_timestamp() AS observed_at),
issues AS (
  SELECT 'ACTIVE_GRANT_UNDER_TERMINAL_HOLD'::text AS code, 'error'::text AS severity,
    'entitlement'::text AS entity, g.id::text AS identity
  FROM public.velmere_vlm_paid_entitlements g
  WHERE g.status IN ('active','paid') AND EXISTS (
    SELECT 1 FROM velmere_billing_private.session_terminal_holds h WHERE h.stripe_session_id=g.stripe_session_id)
  UNION ALL
  SELECT 'HOLD_GRANT_BINDING_MISMATCH','error','hold',h.event_id
  FROM velmere_billing_private.session_terminal_holds h JOIN public.velmere_vlm_paid_entitlements g
    ON g.stripe_session_id=h.stripe_session_id
  WHERE g.product_id<>h.product_id OR g.context_hash<>h.context_hash
  UNION ALL
  SELECT 'WATERMARK_IDENTITY_MISMATCH','error','watermark',w.subject_key
  FROM velmere_payment_private.event_watermarks w LEFT JOIN velmere_payment_private.event_identities i ON i.event_id=w.event_id
  WHERE i.event_id IS NULL OR i.subject_key<>w.subject_key OR i.event_kind<>w.event_kind OR i.event_created_at<>w.event_created_at
  UNION ALL
  SELECT 'EFFECT_EVENT_TYPE_MISMATCH','error','effect',jsonb_build_array(f.event_id,f.effect_key)::text
  FROM velmere_webhook_private.effects f JOIN public.velmere_stripe_webhook_events e ON e.id=f.event_id
  WHERE f.event_type<>e.event_type
  UNION ALL
  SELECT 'EVENT_LEASE_EXPIRED','warning','event',e.id
  FROM public.velmere_stripe_webhook_events e,clock WHERE e.status='processing' AND e.lease_expires_at<=clock.observed_at
  UNION ALL
  SELECT 'EFFECT_LEASE_EXPIRED','warning','effect',jsonb_build_array(f.event_id,f.effect_key)::text
  FROM velmere_webhook_private.effects f,clock WHERE f.status='processing' AND f.lease_expires_at<=clock.observed_at
  UNION ALL
  SELECT 'EVENT_RETRY_PENDING','warning','event',id FROM public.velmere_stripe_webhook_events WHERE status='retryable_failed'
  UNION ALL
  SELECT 'EFFECT_RETRY_PENDING','warning','effect',jsonb_build_array(event_id,effect_key)::text FROM velmere_webhook_private.effects WHERE status='retryable_failed'
  UNION ALL
  SELECT 'EVENT_DEAD_LETTER','warning','event',id FROM public.velmere_stripe_webhook_events WHERE status='dead_letter'
  UNION ALL
  SELECT 'EFFECT_DEAD_LETTER','warning','effect',jsonb_build_array(event_id,effect_key)::text FROM velmere_webhook_private.effects WHERE status='dead_letter'
  UNION ALL
  -- These are review warnings, not proven missing payments: older standalone
  -- effects and handler-specific termination policies may explain them.
  SELECT 'EFFECT_WITHOUT_INBOX','warning','effect',jsonb_build_array(f.event_id,f.effect_key)::text
  FROM velmere_webhook_private.effects f LEFT JOIN public.velmere_stripe_webhook_events e ON e.id=f.event_id WHERE e.id IS NULL
  UNION ALL
  SELECT 'PROCESSED_EVENT_WITH_UNFINISHED_EFFECT','warning','effect',jsonb_build_array(f.event_id,f.effect_key)::text
  FROM velmere_webhook_private.effects f JOIN public.velmere_stripe_webhook_events e ON e.id=f.event_id
  WHERE e.status='processed' AND f.status<>'completed'
  UNION ALL
  -- Limit this invariant to the exact VLM lifecycle effect, NOT every Stripe
  -- refund in an installation. A done effect must have its persisted event.
  SELECT 'COMPLETED_TERMINAL_EFFECT_WITHOUT_LIFECYCLE','error','effect',jsonb_build_array(f.event_id,f.effect_key)::text
  FROM velmere_webhook_private.effects f
  WHERE f.status='completed' AND f.effect_key='vlm_paid_access:entitlement_terminal_revoke'
    AND NOT EXISTS(SELECT 1 FROM velmere_billing_private.lifecycle_events l
      WHERE l.source_event_hash=encode(sha256(convert_to(f.event_id,'UTF8')),'hex'))
),
counts AS (
 SELECT jsonb_build_object(
  'entitlements',(SELECT count(*) FROM public.velmere_vlm_paid_entitlements),
  'lifecycleEvents',(SELECT count(*) FROM velmere_billing_private.lifecycle_events),
  'effects',(SELECT count(*) FROM velmere_webhook_private.effects),
  'events',(SELECT count(*) FROM public.velmere_stripe_webhook_events),
  'eventIdentities',(SELECT count(*) FROM velmere_payment_private.event_identities),
  'watermarks',(SELECT count(*) FROM velmere_payment_private.event_watermarks),
  'terminalHolds',(SELECT count(*) FROM velmere_billing_private.session_terminal_holds)) AS value
),
summary AS (SELECT count(*) AS total,count(*) FILTER(WHERE severity='error') AS errors,count(*) FILTER(WHERE severity='warning') AS warnings FROM issues),
sampled AS (
 SELECT code,severity,entity,encode(sha256(convert_to(jsonb_build_array(entity,identity)::text,'UTF8')),'hex') AS fingerprint
 FROM issues ORDER BY severity,code,entity,identity LIMIT 100
)
SELECT jsonb_build_object(
 'schema','velmere.billing-reconciliation.v1',
 'scope','INTERNAL_DATABASE_CONSISTENCY_NOT_STRIPE_TRUTH',
 'observedAt',to_char(clock.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'readOnly',true,'releaseApproved',false,'sampleLimit',100,
 'counts',counts.value,'issueCount',summary.total,'errorCount',summary.errors,'warningCount',summary.warnings,
 'truncated',summary.total>100,
 'verdict',CASE WHEN summary.total>0 THEN 'REVIEW_REQUIRED'
   WHEN NOT EXISTS(SELECT 1 FROM jsonb_each_text(counts.value) c WHERE c.value<>'0') THEN 'EMPTY'
   ELSE 'CONSISTENT_WITHIN_SCOPE' END,
 'issues',coalesce((SELECT jsonb_agg(jsonb_build_object('code',code,'severity',severity,'entity',entity,'fingerprint',fingerprint)
   ORDER BY severity,code,entity,fingerprint) FROM sampled),'[]'::jsonb)
) AS report FROM clock,counts,summary;
