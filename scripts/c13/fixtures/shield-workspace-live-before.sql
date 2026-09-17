CREATE OR REPLACE FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(p_tier text, p_locale text, p_operation text, p_workspace_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'velmere_private', 'auth', 'extensions'
AS $function$
declare
 v_account uuid:=auth.uid(); v_limit integer; v_assets jsonb:='[]'::jsonb; v_history jsonb; v_asset record; v_count integer:=0;
 v_workspace uuid; v_payload jsonb; v_digest text; v_latest velmere_private.r7_shield_pro_paid_workspace_events%rowtype; v_run_id text;
begin
 if v_account is null then raise exception 'shield_pro_paid_auth_required' using errcode='28000'; end if;
 if p_tier is null or p_locale is null or p_operation is null or p_tier not in('pro','advanced') or p_locale not in('pl','en','de') or p_operation not in('CREATE','READ','DELETE','RESTORE') then raise exception 'shield_pro_paid_request_invalid' using errcode='22023'; end if;
 if not public.velmere_r7_shield_pro_has_paid_entitlement_v1(p_tier) then raise exception 'shield_pro_paid_entitlement_required' using errcode='42501'; end if;
 select g.evidence->>'githubRunId' into v_run_id from velmere_private.r7_shield_pro_paid_entitlement_events g
 where g.account_id=v_account and g.event_kind='GRANT' and (g.expires_at is null or g.expires_at>clock_timestamp()) and (g.tier=p_tier or(g.tier='advanced' and p_tier='pro'))
 and not exists(select 1 from velmere_private.r7_shield_pro_paid_entitlement_events r where r.entitlement_ref=g.entitlement_ref and r.event_kind='REVOKE')
 order by g.event_id desc limit 1;
 if p_operation<>'CREATE' then
  if p_workspace_id is null then raise exception 'shield_pro_paid_workspace_id_required' using errcode='22023'; end if;
  select * into v_latest from velmere_private.r7_shield_pro_paid_workspace_events w where w.workspace_id=p_workspace_id and w.account_id=v_account order by w.event_id desc limit 1;
  if not found then return jsonb_build_object('resolution','NOT_FOUND'); end if;
  if p_operation='READ' then
   if v_latest.event_kind='DELETE' then return jsonb_build_object('resolution','NOT_FOUND'); end if;
   return jsonb_build_object('resolution','RESOLVED','operation','READ','workspaceId',v_latest.workspace_id,'tier',v_latest.tier,'locale',v_latest.locale,'payload',v_latest.payload,'payloadDigestSha256',v_latest.payload_digest_sha256,'providerNetworkCalls',0);
  elsif p_operation='DELETE' then
   if v_latest.event_kind='DELETE' then return jsonb_build_object('resolution','DELETED','idempotent',true,'workspaceId',v_latest.workspace_id,'payloadDigestSha256',v_latest.payload_digest_sha256); end if;
   insert into velmere_private.r7_shield_pro_paid_workspace_events(workspace_id,account_id,tier,locale,event_kind,e2e_run_id,payload,payload_digest_sha256)
   values(v_latest.workspace_id,v_account,v_latest.tier,v_latest.locale,'DELETE',v_run_id,v_latest.payload,v_latest.payload_digest_sha256);
   return jsonb_build_object('resolution','DELETED','idempotent',false,'workspaceId',v_latest.workspace_id,'payloadDigestSha256',v_latest.payload_digest_sha256);
  else
   if v_latest.event_kind<>'DELETE' then raise exception 'shield_pro_paid_restore_requires_deleted_workspace' using errcode='23514'; end if;
   insert into velmere_private.r7_shield_pro_paid_workspace_events(workspace_id,account_id,tier,locale,event_kind,e2e_run_id,payload,payload_digest_sha256)
   values(v_latest.workspace_id,v_account,v_latest.tier,v_latest.locale,'RESTORE',v_run_id,v_latest.payload,v_latest.payload_digest_sha256);
   return jsonb_build_object('resolution','RESTORED','workspaceId',v_latest.workspace_id,'tier',v_latest.tier,'locale',v_latest.locale,'payload',v_latest.payload,'payloadDigestSha256',v_latest.payload_digest_sha256,'providerNetworkCalls',0);
  end if;
 end if;
 v_limit:=case when p_tier='pro' then 3 else 6 end;
 for v_asset in
  select e.asset_id,max(e.observed_at) as latest from public.velmere_risk_history_events e
  where e.publication_state='PUBLIC' and e.customer_publishable=true and e.observed_at>=clock_timestamp()-interval '7 days'
  group by e.asset_id having count(*)>=2 order by latest desc,e.asset_id limit v_limit
 loop
  v_history:=public.velmere_read_public_risk_history_by_asset_v1(v_asset.asset_id,2,null);
  if coalesce(v_history->>'resolution','')='RESOLVED' and jsonb_array_length(coalesce(v_history->'events','[]'::jsonb))=2 then
   v_assets:=v_assets||jsonb_build_array(jsonb_build_object('assetId',v_asset.asset_id,'canonicalAssetId',v_history->>'canonicalAssetId','events',v_history->'events'));
   v_count:=v_count+1;
  end if;
 end loop;
 if v_count<>v_limit then raise exception 'shield_pro_paid_current_asset_denominator_not_satisfied' using errcode='23514'; end if;
 v_workspace:=gen_random_uuid();
 v_payload:=jsonb_build_object('schemaVersion','velmere.r7.shield-pro-paid-workspace-payload.v1','tier',p_tier,'locale',p_locale,'coverageAssets',v_limit,'historyEventsPerAsset',2,'assets',v_assets,'generatedAt',clock_timestamp(),'sourceClass','VELMERE_GENERATED_PUBLIC_EVIDENCE_FROM_DIRECT_CHAIN_BOUND_SOURCE','customerDisplayRightsBasis','FIRST_PARTY_DERIVED_CUSTOMER_PUBLISHABLE_EVIDENCE_NO_EXTERNAL_PROVIDER_PAYLOAD','providerNetworkCalls',0,'rawProviderPayloadReturned',false,'materialDelta',case when p_tier='pro' then 'THREE_TARGET_PERSISTENT_MONITORING_HISTORY' else 'SIX_TARGET_PRIORITY_CORRELATION_TEAM_AUTOMATION_WORKFLOW' end);
 v_digest:=encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
 insert into velmere_private.r7_shield_pro_paid_workspace_events(workspace_id,account_id,tier,locale,event_kind,e2e_run_id,payload,payload_digest_sha256)
 values(v_workspace,v_account,p_tier,p_locale,'CREATE',v_run_id,v_payload,v_digest);
 return jsonb_build_object('resolution','CREATED','operation','CREATE','workspaceId',v_workspace,'tier',p_tier,'locale',p_locale,'payload',v_payload,'payloadDigestSha256',v_digest,'providerNetworkCalls',0);
end $function$
