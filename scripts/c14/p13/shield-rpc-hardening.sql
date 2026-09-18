-- C14-P13: Shield paid workspace concurrency + response-authority hardening.
-- Apply only after the C13 stored-tier guard. This file is intentionally a
-- reviewed candidate/runbook input, not an automatically applied production migration.
SET LOCAL statement_timeout = '10000ms';
SET LOCAL lock_timeout = '2000ms';

DO $c14_p13_hardening$
DECLARE
  original text := pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure);
  helper text := pg_get_functiondef('public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)'::regprocedure);
  mutation_anchor text := $anchor$  if p_workspace_id is null then raise exception 'shield_pro_paid_workspace_id_required' using errcode='22023'; end if;
  select * into v_latest from velmere_private.r7_shield_pro_paid_workspace_events w where w.workspace_id=p_workspace_id and w.account_id=v_account order by w.event_id desc limit 1;$anchor$;
  mutation_replacement text := $replacement$  if p_workspace_id is null then raise exception 'shield_pro_paid_workspace_id_required' using errcode='22023'; end if;
  -- Serialize state-changing transitions for one account/workspace. Reads remain
  -- snapshot operations; DELETE/RESTORE cannot both transition the same state.
  if p_operation in ('DELETE','RESTORE') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_account::text || ':' || p_workspace_id::text, 0)
    );
  end if;
  select * into v_latest from velmere_private.r7_shield_pro_paid_workspace_events w where w.workspace_id=p_workspace_id and w.account_id=v_account order by w.event_id desc limit 1;$replacement$;
  delete_idempotent_anchor text := $anchor$if v_latest.event_kind='DELETE' then return jsonb_build_object('resolution','DELETED','idempotent',true,'workspaceId',v_latest.workspace_id,'payloadDigestSha256',v_latest.payload_digest_sha256); end if;$anchor$;
  delete_idempotent_replacement text := $replacement$if v_latest.event_kind='DELETE' then return jsonb_build_object('resolution','DELETED','idempotent',true,'workspaceId',v_latest.workspace_id,'tier',v_latest.tier,'locale',v_latest.locale,'payloadDigestSha256',v_latest.payload_digest_sha256); end if;$replacement$;
  delete_changed_anchor text := $anchor$return jsonb_build_object('resolution','DELETED','idempotent',false,'workspaceId',v_latest.workspace_id,'payloadDigestSha256',v_latest.payload_digest_sha256);$anchor$;
  delete_changed_replacement text := $replacement$return jsonb_build_object('resolution','DELETED','idempotent',false,'workspaceId',v_latest.workspace_id,'tier',v_latest.tier,'locale',v_latest.locale,'payloadDigestSha256',v_latest.payload_digest_sha256);$replacement$;
BEGIN
  IF encode(extensions.digest(original,'sha256'),'hex') <> 'b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6'
     OR encode(extensions.digest(helper,'sha256'),'hex') <> '233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92'
  THEN
    RAISE EXCEPTION 'C14-P13 aborted: reviewed live RPC definitions changed';
  END IF;

  IF (length(original)-length(replace(original,mutation_anchor,'')))/length(mutation_anchor) <> 1
     OR (length(original)-length(replace(original,delete_idempotent_anchor,'')))/length(delete_idempotent_anchor) <> 1
     OR (length(original)-length(replace(original,delete_changed_anchor,'')))/length(delete_changed_anchor) <> 1
  THEN
    RAISE EXCEPTION 'C14-P13 aborted: expected unique workspace anchors missing';
  END IF;

  original := replace(original, mutation_anchor, mutation_replacement);
  original := replace(original, delete_idempotent_anchor, delete_idempotent_replacement);
  original := replace(original, delete_changed_anchor, delete_changed_replacement);
  EXECUTE original;
END $c14_p13_hardening$;
