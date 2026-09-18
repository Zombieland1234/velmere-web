begin;

create schema if not exists velmere_private;
revoke all on schema velmere_private from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.velmere_current_account_id()') is null
     or to_regprocedure('public.velmere_current_account_binding_hash()') is null then
    raise exception 'c14_p15_requires_account_subject_binding_helpers';
  end if;
end
$$;

create table if not exists public.velmere_account_data_exports (
  schema_version text not null default 'velmere.account-data-export-record.v1',
  export_id uuid primary key,
  account_id text not null,
  account_id_hash text not null,
  idempotency_key_hash text not null,
  payload_schema_version text not null default 'velmere.account-data-export-payload.v1',
  payload_text text not null,
  payload_sha256 text not null,
  payload_byte_length integer not null,
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (account_id_hash, idempotency_key_hash),
  check (schema_version = 'velmere.account-data-export-record.v1'),
  check (payload_schema_version = 'velmere.account-data-export-payload.v1'),
  check (account_id ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$' and account_id !~ '^preview:'),
  check (account_id_hash ~ '^[a-f0-9]{64}$'),
  check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  check (payload_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  check (payload_byte_length between 2 and 8388608),
  check (generated_at < expires_at),
  check (expires_at <= generated_at + interval '24 hours 1 second')
);

create index if not exists velmere_account_data_exports_account_generated_idx
  on public.velmere_account_data_exports(account_id_hash, generated_at desc);
create index if not exists velmere_account_data_exports_expiry_idx
  on public.velmere_account_data_exports(expires_at);

alter table public.velmere_account_data_exports enable row level security;
revoke all on table public.velmere_account_data_exports from public, anon, authenticated;
grant select on table public.velmere_account_data_exports to authenticated;
grant select, insert, update, delete on table public.velmere_account_data_exports to service_role;

drop policy if exists c14_p15_account_data_export_owner_select on public.velmere_account_data_exports;
create policy c14_p15_account_data_export_owner_select
on public.velmere_account_data_exports
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

create table if not exists public.velmere_account_erasure_requests (
  schema_version text not null default 'velmere.account-erasure-record.v1',
  request_id uuid primary key,
  account_id text not null,
  account_id_hash text not null,
  idempotency_key_hash text not null,
  export_id uuid not null,
  export_payload_sha256 text not null,
  export_generated_at timestamptz not null,
  export_expires_at timestamptz not null,
  state text not null default 'SESSION_REVOCATION_PENDING',
  session_revocation_state text not null default 'PENDING',
  session_revocation_receipt_sha256 text,
  execution_policy_state text not null default 'OWNER_LEGAL_POLICY_REQUIRED',
  requested_at timestamptz not null default now(),
  session_revocation_confirmed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (account_id_hash, idempotency_key_hash),
  check (schema_version = 'velmere.account-erasure-record.v1'),
  check (account_id ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$' and account_id !~ '^preview:'),
  check (account_id_hash ~ '^[a-f0-9]{64}$'),
  check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  check (export_payload_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  check (export_generated_at < export_expires_at),
  check (state in ('SESSION_REVOCATION_PENDING','POLICY_BLOCKED','CANCELLED')),
  check (session_revocation_state in ('PENDING','CONFIRMED')),
  check (execution_policy_state = 'OWNER_LEGAL_POLICY_REQUIRED'),
  check ((session_revocation_state='PENDING' and session_revocation_receipt_sha256 is null and session_revocation_confirmed_at is null)
      or (session_revocation_state='CONFIRMED' and session_revocation_receipt_sha256 ~ '^sha256:[a-f0-9]{64}$' and session_revocation_confirmed_at is not null)),
  check ((state='CANCELLED') = (cancelled_at is not null))
);

create unique index if not exists velmere_account_erasure_one_active_idx
  on public.velmere_account_erasure_requests(account_id_hash)
  where state <> 'CANCELLED';
create index if not exists velmere_account_erasure_requested_idx
  on public.velmere_account_erasure_requests(account_id_hash, requested_at desc);

alter table public.velmere_account_erasure_requests enable row level security;
revoke all on table public.velmere_account_erasure_requests from public, anon, authenticated;
grant select on table public.velmere_account_erasure_requests to authenticated;
grant select, insert, update, delete on table public.velmere_account_erasure_requests to service_role;

drop policy if exists c14_p15_account_erasure_owner_select on public.velmere_account_erasure_requests;
create policy c14_p15_account_erasure_owner_select
on public.velmere_account_erasure_requests
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

create table if not exists public.velmere_account_erasure_approvals (
  request_id uuid primary key references public.velmere_account_erasure_requests(request_id) on delete cascade,
  approval_id_hash text not null unique,
  account_id_hash text not null,
  approved_by_hash text not null,
  retention_policy_sha256 text not null,
  legal_hold_state text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (approval_id_hash ~ '^[a-f0-9]{64}$'),
  check (account_id_hash ~ '^[a-f0-9]{64}$'),
  check (approved_by_hash ~ '^[a-f0-9]{64}$'),
  check (retention_policy_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  check (legal_hold_state in ('CLEAR','ACTIVE')),
  check (approved_at < expires_at)
);

alter table public.velmere_account_erasure_approvals enable row level security;
revoke all on table public.velmere_account_erasure_approvals from public, anon, authenticated;
grant select, insert, update, delete on table public.velmere_account_erasure_approvals to service_role;

create table if not exists public.velmere_account_erasure_execution_receipts (
  schema_version text not null default 'velmere.account-erasure-execution-receipt.v1',
  request_id uuid primary key,
  account_id_hash text not null,
  approval_id_hash text not null,
  application_data_state text not null,
  storage_state text not null,
  auth_state text not null,
  storage_objects_removed integer not null default 0,
  deleted_scopes jsonb not null default '[]'::jsonb,
  pseudonymized_scopes jsonb not null default '[]'::jsonb,
  retained_scopes jsonb not null default '[]'::jsonb,
  residual_blockers jsonb not null default '[]'::jsonb,
  failure_code text,
  full_erasure_claimed boolean not null default false,
  receipt_sha256 text not null,
  prepared_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (schema_version = 'velmere.account-erasure-execution-receipt.v1'),
  check (account_id_hash ~ '^[a-f0-9]{64}$'),
  check (approval_id_hash ~ '^[a-f0-9]{64}$'),
  check (application_data_state = 'DELETED_OR_PSEUDONYMIZED'),
  check (storage_state in ('PENDING','NOT_PRESENT','REMOVED','BLOCKED')),
  check (auth_state in ('PENDING','DELETED','BLOCKED')),
  check (storage_objects_removed >= 0),
  check (jsonb_typeof(deleted_scopes)='array'),
  check (jsonb_typeof(pseudonymized_scopes)='array'),
  check (jsonb_typeof(retained_scopes)='array'),
  check (jsonb_typeof(residual_blockers)='array'),
  check (full_erasure_claimed = false),
  check (receipt_sha256 ~ '^sha256:[a-f0-9]{64}$')
);

alter table public.velmere_account_erasure_execution_receipts enable row level security;
revoke all on table public.velmere_account_erasure_execution_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.velmere_account_erasure_execution_receipts to service_role;

create table if not exists public.velmere_account_erasure_tombstones (
  account_id_hash text primary key,
  receipt_sha256 text not null,
  completed_at timestamptz not null,
  restore_replay_required boolean not null default true,
  check (account_id_hash ~ '^[a-f0-9]{64}$'),
  check (receipt_sha256 ~ '^sha256:[a-f0-9]{64}$')
);

alter table public.velmere_account_erasure_tombstones enable row level security;
revoke all on table public.velmere_account_erasure_tombstones from public, anon, authenticated;
grant select, insert, update, delete on table public.velmere_account_erasure_tombstones to service_role;

create or replace function public.velmere_create_account_data_export_v1(
  p_export_id uuid,
  p_idempotency_key_hash text
) returns public.velmere_account_data_exports
language plpgsql
security definer
set search_path = pg_catalog, public, auth, storage, extensions, pg_temp
as $$
declare
  v_account_id text;
  v_account_hash text;
  v_subject uuid;
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
  v_payload jsonb;
  v_payload_text text;
  v_auth jsonb := '{}'::jsonb;
  v_identities jsonb := '[]'::jsonb;
  v_cases jsonb := '[]'::jsonb;
  v_artifacts jsonb := '[]'::jsonb;
  v_storage jsonb := '[]'::jsonb;
  v_row public.velmere_account_data_exports%rowtype;
begin
  if p_export_id is null or p_idempotency_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'account_data_export_request_invalid' using errcode='22023';
  end if;

  v_account_id := public.velmere_current_account_id();
  v_account_hash := public.velmere_current_account_binding_hash();
  if v_account_id is null or v_account_hash is null then
    raise exception 'account_data_export_auth_required' using errcode='28000';
  end if;

  select b.supabase_subject into v_subject
  from public.velmere_account_supabase_subject_bindings b
  where b.account_id=v_account_id
    and b.supabase_subject=auth.uid()
  limit 1;
  if v_subject is null then
    raise exception 'account_data_export_binding_missing' using errcode='28000';
  end if;

  delete from public.velmere_account_data_exports
  where account_id_hash=v_account_hash and expires_at <= v_now;

  select * into v_row
  from public.velmere_account_data_exports
  where account_id_hash=v_account_hash and idempotency_key_hash=p_idempotency_key_hash
  limit 1;
  if found then return v_row; end if;

  select jsonb_build_object(
    'subject', u.id,
    'email', u.email,
    'phone', u.phone,
    'userMetadata', coalesce(u.raw_user_meta_data,'{}'::jsonb),
    'createdAt', u.created_at,
    'updatedAt', u.updated_at,
    'lastSignInAt', u.last_sign_in_at
  ) into v_auth
  from auth.users u
  where u.id=v_subject;

  select coalesce(jsonb_agg(jsonb_build_object(
    'provider', i.provider,
    'providerId', i.provider_id,
    'email', i.email,
    'createdAt', i.created_at,
    'updatedAt', i.updated_at,
    'lastSignInAt', i.last_sign_in_at
  ) order by i.created_at), '[]'::jsonb)
  into v_identities
  from auth.identities i
  where i.user_id=v_subject;

  if to_regclass('public.velmere_audit_intake_cases') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'caseId',c.case_id,
        'caseRef',c.case_ref,
        'requestId',c.request_id,
        'targetKind',c.target_kind,
        'targetPrivate',c.target_private,
        'targetHash',c.target_hash,
        'displayLabel',c.display_label,
        'tier',c.tier,
        'locale',c.locale,
        'status',c.status,
        'accountId',c.account_id,
        'accountEmail',c.account_email,
        'checkoutSessionId',c.checkout_session_id,
        'checkoutProductId',c.checkout_product_id,
        'entitlementId',c.entitlement_id,
        'paymentEventId',c.payment_event_id,
        'createdAt',c.created_at,
        'updatedAt',c.updated_at
      ) order by c.created_at), '[]'::jsonb)
      from public.velmere_audit_intake_cases c
      where c.account_id=$1
    $q$ into v_cases using v_account_id;
  end if;

  if to_regclass('public.velmere_customer_artifact_snapshots') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'snapshotId',s.snapshot_id,
        'surface',s.surface,
        'payloadKind',s.payload_kind,
        'reportId',s.report_id,
        'artifactDigest',s.artifact_digest,
        'snapshotDigest',s.snapshot_digest,
        'generatedAt',s.generated_at,
        'createdAt',s.created_at,
        'contentOmittedFromBoundedExport',true
      ) order by s.created_at), '[]'::jsonb)
      from public.velmere_customer_artifact_snapshots s
      where s.account_id=$1 and s.account_id_hash=$2
    $q$ into v_artifacts using v_account_id, v_account_hash;
  end if;

  if to_regclass('storage.objects') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'bucketId',o.bucket_id,
      'name',o.name,
      'createdAt',o.created_at,
      'updatedAt',o.updated_at,
      'lastAccessedAt',o.last_accessed_at
    ) order by o.bucket_id,o.name), '[]'::jsonb)
    into v_storage
    from storage.objects o
    where o.owner=v_subject or o.owner_id=v_subject::text;
  end if;

  v_expires := v_now + interval '24 hours';
  v_payload := jsonb_build_object(
    'schemaVersion','velmere.account-data-export-payload.v1',
    'exportId',p_export_id,
    'generatedAt',v_now,
    'availableUntil',v_expires,
    'classification','CUSTOMER_PRIVATE',
    'scope',jsonb_build_object(
      'legalDsrCompleteness',false,
      'included',jsonb_build_array(
        'account_binding',
        'auth_profile_safe_fields',
        'auth_identity_safe_fields',
        'audit_intake_metadata',
        'customer_artifact_metadata',
        'storage_object_metadata'
      ),
      'notDuplicated',jsonb_build_array('report_pdf_bytes','full_report_snapshot_bytes'),
      'externalBoundaries',jsonb_build_array('stripe_provider','hosting_logs','analytics_provider','platform_backups')
    ),
    'account',jsonb_build_object(
      'accountId',v_account_id,
      'accountIdHash',v_account_hash,
      'auth',coalesce(v_auth,'{}'::jsonb),
      'identities',v_identities
    ),
    'application',jsonb_build_object(
      'auditIntakeCases',v_cases,
      'customerArtifactMetadata',v_artifacts,
      'storageObjectMetadata',v_storage
    ),
    'retention',jsonb_build_object(
      'exportExpiresAt',v_expires,
      'erasureRequiresOwnerLegalApproval',true,
      'fullErasureClaimed',false
    )
  );
  v_payload_text := v_payload::text;
  if octet_length(v_payload_text) > 8388608 then
    raise exception 'account_data_export_too_large' using errcode='54000';
  end if;

  insert into public.velmere_account_data_exports(
    export_id,account_id,account_id_hash,idempotency_key_hash,payload_text,payload_sha256,
    payload_byte_length,generated_at,expires_at
  ) values (
    p_export_id,v_account_id,v_account_hash,p_idempotency_key_hash,v_payload_text,
    'sha256:'||encode(extensions.digest(convert_to(v_payload_text,'UTF8'),'sha256'),'hex'),
    octet_length(v_payload_text),v_now,v_expires
  )
  returning * into v_row;
  return v_row;
end
$$;

revoke all on function public.velmere_create_account_data_export_v1(uuid,text) from public, anon;
grant execute on function public.velmere_create_account_data_export_v1(uuid,text) to authenticated;

create or replace function public.velmere_request_account_erasure_v1(
  p_request_id uuid,
  p_idempotency_key_hash text
) returns public.velmere_account_erasure_requests
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions, pg_temp
as $$
declare
  v_account_id text;
  v_account_hash text;
  v_export public.velmere_account_data_exports%rowtype;
  v_row public.velmere_account_erasure_requests%rowtype;
begin
  if p_request_id is null or p_idempotency_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'account_erasure_request_invalid' using errcode='22023';
  end if;
  v_account_id := public.velmere_current_account_id();
  v_account_hash := public.velmere_current_account_binding_hash();
  if v_account_id is null or v_account_hash is null then
    raise exception 'account_erasure_auth_required' using errcode='28000';
  end if;

  select * into v_row
  from public.velmere_account_erasure_requests
  where account_id_hash=v_account_hash and idempotency_key_hash=p_idempotency_key_hash
  limit 1;
  if found then return v_row; end if;

  if exists (
    select 1 from public.velmere_account_erasure_requests
    where account_id_hash=v_account_hash and state <> 'CANCELLED'
  ) then
    raise exception 'account_erasure_request_already_active' using errcode='23505';
  end if;

  select * into v_export
  from public.velmere_account_data_exports
  where account_id=v_account_id
    and account_id_hash=v_account_hash
    and expires_at > clock_timestamp()
  order by generated_at desc
  limit 1;
  if not found then
    raise exception 'account_erasure_current_export_required' using errcode='55000';
  end if;

  insert into public.velmere_account_erasure_requests(
    request_id,account_id,account_id_hash,idempotency_key_hash,
    export_id,export_payload_sha256,export_generated_at,export_expires_at
  ) values (
    p_request_id,v_account_id,v_account_hash,p_idempotency_key_hash,
    v_export.export_id,v_export.payload_sha256,v_export.generated_at,v_export.expires_at
  )
  returning * into v_row;
  return v_row;
end
$$;

revoke all on function public.velmere_request_account_erasure_v1(uuid,text) from public, anon;
grant execute on function public.velmere_request_account_erasure_v1(uuid,text) to authenticated;

create or replace function public.velmere_cancel_account_erasure_v1(
  p_request_id uuid
) returns public.velmere_account_erasure_requests
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_account_id text;
  v_account_hash text;
  v_row public.velmere_account_erasure_requests%rowtype;
begin
  v_account_id := public.velmere_current_account_id();
  v_account_hash := public.velmere_current_account_binding_hash();
  if v_account_id is null or v_account_hash is null then
    raise exception 'account_erasure_auth_required' using errcode='28000';
  end if;
  if exists(select 1 from public.velmere_account_erasure_approvals a where a.request_id=p_request_id) then
    raise exception 'account_erasure_execution_already_approved' using errcode='55000';
  end if;
  update public.velmere_account_erasure_requests
  set state='CANCELLED',cancelled_at=coalesce(cancelled_at,clock_timestamp()),updated_at=clock_timestamp()
  where request_id=p_request_id and account_id=v_account_id and account_id_hash=v_account_hash
  returning * into v_row;
  if not found then raise exception 'account_erasure_request_not_found' using errcode='P0002'; end if;
  return v_row;
end
$$;

revoke all on function public.velmere_cancel_account_erasure_v1(uuid) from public, anon;
grant execute on function public.velmere_cancel_account_erasure_v1(uuid) to authenticated;

create or replace function public.velmere_confirm_account_erasure_session_revocation_v1(
  p_request_id uuid,
  p_account_id_hash text,
  p_revocation_receipt_sha256 text
) returns public.velmere_account_erasure_requests
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row public.velmere_account_erasure_requests%rowtype;
begin
  if p_account_id_hash !~ '^[a-f0-9]{64}$'
     or p_revocation_receipt_sha256 !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'account_erasure_revocation_confirmation_invalid' using errcode='22023';
  end if;
  update public.velmere_account_erasure_requests
  set session_revocation_state='CONFIRMED',
      session_revocation_receipt_sha256=p_revocation_receipt_sha256,
      session_revocation_confirmed_at=coalesce(session_revocation_confirmed_at,clock_timestamp()),
      state=case when state='CANCELLED' then 'CANCELLED' else 'POLICY_BLOCKED' end,
      updated_at=clock_timestamp()
  where request_id=p_request_id and account_id_hash=p_account_id_hash
  returning * into v_row;
  if not found then raise exception 'account_erasure_request_not_found' using errcode='P0002'; end if;
  return v_row;
end
$$;

revoke all on function public.velmere_confirm_account_erasure_session_revocation_v1(uuid,text,text) from public, anon, authenticated;
grant execute on function public.velmere_confirm_account_erasure_session_revocation_v1(uuid,text,text) to service_role;

create or replace function public.velmere_record_account_erasure_approval_v1(
  p_request_id uuid,
  p_approval_id_hash text,
  p_approved_by_hash text,
  p_retention_policy_sha256 text,
  p_legal_hold_state text,
  p_expires_at timestamptz
) returns public.velmere_account_erasure_approvals
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_request public.velmere_account_erasure_requests%rowtype;
  v_row public.velmere_account_erasure_approvals%rowtype;
begin
  if p_approval_id_hash !~ '^[a-f0-9]{64}$'
     or p_approved_by_hash !~ '^[a-f0-9]{64}$'
     or p_retention_policy_sha256 !~ '^sha256:[a-f0-9]{64}$'
     or p_legal_hold_state not in ('CLEAR','ACTIVE')
     or p_expires_at <= clock_timestamp() then
    raise exception 'account_erasure_approval_invalid' using errcode='22023';
  end if;

  select * into v_request
  from public.velmere_account_erasure_requests
  where request_id=p_request_id
  for update;
  if not found then raise exception 'account_erasure_request_not_found' using errcode='P0002'; end if;
  if v_request.state <> 'POLICY_BLOCKED' or v_request.session_revocation_state <> 'CONFIRMED' then
    raise exception 'account_erasure_session_revocation_required' using errcode='55000';
  end if;

  insert into public.velmere_account_erasure_approvals(
    request_id,approval_id_hash,account_id_hash,approved_by_hash,retention_policy_sha256,legal_hold_state,expires_at
  ) values (
    p_request_id,p_approval_id_hash,v_request.account_id_hash,p_approved_by_hash,p_retention_policy_sha256,p_legal_hold_state,p_expires_at
  )
  on conflict(request_id) do update
    set approval_id_hash=excluded.approval_id_hash,
        account_id_hash=excluded.account_id_hash,
        approved_by_hash=excluded.approved_by_hash,
        retention_policy_sha256=excluded.retention_policy_sha256,
        legal_hold_state=excluded.legal_hold_state,
        approved_at=clock_timestamp(),
        expires_at=excluded.expires_at
  returning * into v_row;
  return v_row;
end
$$;

revoke all on function public.velmere_record_account_erasure_approval_v1(uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.velmere_record_account_erasure_approval_v1(uuid,text,text,text,text,timestamptz) to service_role;

create or replace function public.velmere_execute_account_erasure_application_v1(
  p_request_id uuid,
  p_approval_id_hash text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, storage, extensions, pg_temp
as $$
declare
  v_request public.velmere_account_erasure_requests%rowtype;
  v_approval public.velmere_account_erasure_approvals%rowtype;
  v_subject uuid;
  v_email text;
  v_tombstone text;
  v_storage jsonb := '[]'::jsonb;
  v_deleted_artifact_blobs integer := 0;
  v_deleted_artifact_snapshots integer := 0;
  v_deleted_audit_artifacts integer := 0;
  v_deleted_audit_backups integer := 0;
  v_pseudonymized_cases integer := 0;
  v_count integer := 0;
  v_initial_receipt_sha text;
begin
  if p_approval_id_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'account_erasure_approval_invalid' using errcode='22023';
  end if;

  select * into v_request
  from public.velmere_account_erasure_requests
  where request_id=p_request_id
  for update;
  if not found then raise exception 'account_erasure_request_not_found' using errcode='P0002'; end if;
  if v_request.state <> 'POLICY_BLOCKED' or v_request.session_revocation_state <> 'CONFIRMED' then
    raise exception 'account_erasure_not_execution_eligible' using errcode='55000';
  end if;

  select * into v_approval
  from public.velmere_account_erasure_approvals
  where request_id=p_request_id and approval_id_hash=p_approval_id_hash
  for update;
  if not found or v_approval.expires_at <= clock_timestamp() then
    raise exception 'account_erasure_approval_missing_or_expired' using errcode='55000';
  end if;
  if v_approval.legal_hold_state <> 'CLEAR' then
    raise exception 'account_erasure_legal_hold_active' using errcode='55000';
  end if;

  select b.supabase_subject into v_subject
  from public.velmere_account_supabase_subject_bindings b
  where b.account_id=v_request.account_id
  limit 1;
  if v_subject is null then
    raise exception 'account_erasure_subject_binding_missing' using errcode='55000';
  end if;
  select u.email into v_email from auth.users u where u.id=v_subject;
  v_tombstone := 'erased:'||substr(v_request.account_id_hash,1,32);

  if not exists (
    select 1 from public.velmere_account_erasure_execution_receipts r
    where r.request_id=p_request_id and r.application_data_state='DELETED_OR_PSEUDONYMIZED'
  ) then
    if to_regclass('public.velmere_customer_artifact_pdf_blobs') is not null then
      perform set_config('velmere.r7_authorized_erasure','on',true);
      execute 'delete from public.velmere_customer_artifact_pdf_blobs where account_id=$1 and account_id_hash=$2'
        using v_request.account_id,v_request.account_id_hash;
      get diagnostics v_deleted_artifact_blobs=row_count;
    end if;

    if to_regclass('public.velmere_customer_artifact_snapshots') is not null then
      perform set_config('velmere.r7_authorized_erasure','on',true);
      execute 'delete from public.velmere_customer_artifact_snapshots where account_id=$1 and account_id_hash=$2'
        using v_request.account_id,v_request.account_id_hash;
      get diagnostics v_deleted_artifact_snapshots=row_count;
    end if;

    if to_regclass('public.velmere_audit_basic_report_artifacts') is not null then
      perform set_config('velmere.audit_basic_erasure_authorized','v1',true);
      execute 'delete from public.velmere_audit_basic_report_artifacts where account_id_hash=$1'
        using v_request.account_id_hash;
      get diagnostics v_deleted_audit_artifacts=row_count;
    end if;

    if to_regclass('public.velmere_audit_basic_report_backups') is not null then
      execute 'delete from public.velmere_audit_basic_report_backups where account_id_hash=$1'
        using v_request.account_id_hash;
      get diagnostics v_deleted_audit_backups=row_count;
    end if;

    if to_regclass('public.velmere_audit_intake_cases') is not null then
      execute 'update public.velmere_audit_intake_cases
               set account_id=$1,account_email=null,updated_at=clock_timestamp()
               where account_id=$2'
        using v_tombstone,v_request.account_id;
      get diagnostics v_pseudonymized_cases=row_count;
    end if;

    if to_regclass('public.velmere_profiles') is not null then
      execute 'delete from public.velmere_profiles where id=$1' using v_request.account_id;
    end if;
    if to_regclass('public.velmere_account_sessions') is not null then
      execute 'delete from public.velmere_account_sessions where account_id=$1' using v_request.account_id;
    end if;
    if to_regclass('public.velmere_audit_report_access_tokens') is not null then
      execute 'delete from public.velmere_audit_report_access_tokens where account_id=$1' using v_request.account_id;
    end if;

    delete from public.velmere_account_supabase_subject_binding_requests
    where account_id=v_request.account_id and supabase_subject=v_subject;

    delete from public.velmere_account_data_exports
    where account_id_hash=v_request.account_id_hash;

    v_initial_receipt_sha := 'sha256:'||encode(extensions.digest(convert_to(
      p_request_id::text||':'||v_request.account_id_hash||':'||p_approval_id_hash||':prepared','UTF8'
    ),'sha256'),'hex');

    insert into public.velmere_account_erasure_execution_receipts(
      request_id,account_id_hash,approval_id_hash,application_data_state,storage_state,auth_state,
      deleted_scopes,pseudonymized_scopes,retained_scopes,residual_blockers,receipt_sha256
    ) values (
      p_request_id,v_request.account_id_hash,p_approval_id_hash,'DELETED_OR_PSEUDONYMIZED','PENDING','PENDING',
      jsonb_build_array(
        'customer_artifact_pdf_blobs:'||v_deleted_artifact_blobs::text,
        'customer_artifact_snapshots:'||v_deleted_artifact_snapshots::text,
        'audit_basic_report_artifacts:'||v_deleted_audit_artifacts::text,
        'audit_basic_report_backups:'||v_deleted_audit_backups::text,
        'account_data_exports'
      ),
      jsonb_build_array('audit_intake_direct_identity:'||v_pseudonymized_cases::text),
      jsonb_build_array('billing_references','audit_intake_opaque_evidence','security_event_aggregates'),
      jsonb_build_array('stripe_provider','hosting_logs','analytics_provider','platform_backups','redis_bounded_ttl'),
      v_initial_receipt_sha
    );
  end if;

  if to_regclass('storage.objects') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('bucketId',o.bucket_id,'name',o.name) order by o.bucket_id,o.name),'[]'::jsonb)
    into v_storage
    from storage.objects o
    where o.owner=v_subject or o.owner_id=v_subject::text;
  end if;

  return jsonb_build_object(
    'schemaVersion','velmere.account-erasure-preparation.v1',
    'requestId',p_request_id,
    'accountIdHash',v_request.account_id_hash,
    'approvalIdHash',p_approval_id_hash,
    'supabaseSubject',v_subject,
    'storageObjects',v_storage,
    'applicationDataState','DELETED_OR_PSEUDONYMIZED'
  );
end
$$;

revoke all on function public.velmere_execute_account_erasure_application_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.velmere_execute_account_erasure_application_v1(uuid,text) to service_role;

create or replace function public.velmere_finalize_account_erasure_v1(
  p_request_id uuid,
  p_account_id_hash text,
  p_approval_id_hash text,
  p_storage_state text,
  p_auth_state text,
  p_storage_objects_removed integer,
  p_failure_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  v_receipt public.velmere_account_erasure_execution_receipts%rowtype;
  v_completed timestamptz;
  v_receipt_sha text;
begin
  if p_account_id_hash !~ '^[a-f0-9]{64}$'
     or p_approval_id_hash !~ '^[a-f0-9]{64}$'
     or p_storage_state not in ('NOT_PRESENT','REMOVED','BLOCKED')
     or p_auth_state not in ('PENDING','DELETED','BLOCKED')
     or p_storage_objects_removed < 0
     or (p_failure_code is not null and (length(p_failure_code)>100 or p_failure_code !~ '^[a-z0-9_-]+$')) then
    raise exception 'account_erasure_finalization_invalid' using errcode='22023';
  end if;

  select * into v_receipt
  from public.velmere_account_erasure_execution_receipts
  where request_id=p_request_id and account_id_hash=p_account_id_hash and approval_id_hash=p_approval_id_hash
  for update;
  if not found then raise exception 'account_erasure_execution_receipt_missing' using errcode='P0002'; end if;

  if p_auth_state='DELETED' and p_storage_state in ('NOT_PRESENT','REMOVED') then
    v_completed := clock_timestamp();
  else
    v_completed := null;
  end if;

  v_receipt_sha := 'sha256:'||encode(extensions.digest(convert_to(
    p_request_id::text||':'||p_account_id_hash||':'||p_approval_id_hash||':'||
    p_storage_state||':'||p_auth_state||':'||p_storage_objects_removed::text||':'||
    coalesce(p_failure_code,'none')||':'||coalesce(v_completed::text,'incomplete'),'UTF8'
  ),'sha256'),'hex');

  update public.velmere_account_erasure_execution_receipts
  set storage_state=p_storage_state,
      auth_state=p_auth_state,
      storage_objects_removed=p_storage_objects_removed,
      failure_code=p_failure_code,
      completed_at=v_completed,
      updated_at=clock_timestamp(),
      receipt_sha256=v_receipt_sha,
      full_erasure_claimed=false
  where request_id=p_request_id
  returning * into v_receipt;

  if v_completed is not null then
    insert into public.velmere_account_erasure_tombstones(account_id_hash,receipt_sha256,completed_at,restore_replay_required)
    values(p_account_id_hash,v_receipt_sha,v_completed,true)
    on conflict(account_id_hash) do update
      set receipt_sha256=excluded.receipt_sha256,
          completed_at=excluded.completed_at,
          restore_replay_required=true;

    delete from public.velmere_account_erasure_requests
    where request_id=p_request_id and account_id_hash=p_account_id_hash;
  end if;

  return jsonb_build_object(
    'schemaVersion',v_receipt.schema_version,
    'requestId',v_receipt.request_id,
    'accountIdHash',v_receipt.account_id_hash,
    'approvalIdHash',v_receipt.approval_id_hash,
    'applicationDataState',v_receipt.application_data_state,
    'storageState',v_receipt.storage_state,
    'authState',v_receipt.auth_state,
    'storageObjectsRemoved',v_receipt.storage_objects_removed,
    'deletedScopes',v_receipt.deleted_scopes,
    'pseudonymizedScopes',v_receipt.pseudonymized_scopes,
    'retainedScopes',v_receipt.retained_scopes,
    'residualBlockers',v_receipt.residual_blockers,
    'fullErasureClaimed',false,
    'receiptSha256',v_receipt.receipt_sha256,
    'completedAt',v_receipt.completed_at
  );
end
$$;

revoke all on function public.velmere_finalize_account_erasure_v1(uuid,text,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.velmere_finalize_account_erasure_v1(uuid,text,text,text,text,integer,text) to service_role;

create or replace function public.velmere_purge_expired_account_data_exports_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.velmere_account_data_exports where expires_at <= clock_timestamp();
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

revoke all on function public.velmere_purge_expired_account_data_exports_v1() from public, anon, authenticated;
grant execute on function public.velmere_purge_expired_account_data_exports_v1() to service_role;

commit;
