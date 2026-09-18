#!/usr/bin/env python3
import hashlib
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260918030000_c14_p15_privacy_export_erasure_foundation.sql"

A_SUBJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B_SUBJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
A_ACCOUNT = f"supabase:{A_SUBJECT}"
B_ACCOUNT = f"supabase:{B_SUBJECT}"
A_HASH = hashlib.sha256(f"velmere-account-binding-v1:{A_ACCOUNT}".encode()).hexdigest()
B_HASH = hashlib.sha256(f"velmere-account-binding-v1:{B_ACCOUNT}".encode()).hexdigest()
A_EXPORT = "11111111-1111-4111-8111-111111111111"
B_EXPORT = "22222222-2222-4222-8222-222222222222"
A_REQUEST = "33333333-3333-4333-8333-333333333333"
B_REQUEST = "44444444-4444-4444-8444-444444444444"
A_IDEMP_EXPORT = "1" * 64
B_IDEMP_EXPORT = "2" * 64
A_IDEMP_ERASURE = "3" * 64
B_IDEMP_ERASURE = "4" * 64
A_APPROVAL = "5" * 64
B_APPROVAL = "6" * 64
APPROVER = "7" * 64
REVOCATION = "sha256:" + "8" * 64
POLICY = "sha256:" + "9" * 64


def psql(sql: str, *, expect_fail: bool = False) -> str:
    env = os.environ.copy()
    cmd = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]
    proc = subprocess.run(cmd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if expect_fail:
        if proc.returncode == 0:
            raise AssertionError(f"expected SQL failure but command succeeded: {sql[:160]}")
        return proc.stderr
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(proc.returncode)
    return proc.stdout.strip()


def psql_file(path: pathlib.Path) -> None:
    proc = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", str(path)],
        env=os.environ.copy(),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(proc.returncode)


def as_user(subject: str, sql: str, *, expect_fail: bool = False) -> str:
    escaped = sql.replace("'", "''")
    statement = (
        "set role authenticated;"
        f"select set_config('request.jwt.claim.sub','{subject}',false);"
        f"{sql};"
        "reset role;"
    )
    return psql(statement, expect_fail=expect_fail)


def as_service(sql: str, *, expect_fail: bool = False) -> str:
    return psql(f"set role service_role;{sql};reset role;", expect_fail=expect_fail)


FIXTURE = r"""
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema storage;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users(
  id uuid primary key,
  email text,
  phone text,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create table auth.identities(
  id uuid primary key,
  provider_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,service_role;
grant execute on function auth.uid() to authenticated,service_role;

create table public.velmere_account_supabase_subject_bindings(
  account_id text primary key,
  supabase_subject uuid not null unique references auth.users(id) on delete cascade,
  request_id text not null,
  operator_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.velmere_account_supabase_subject_binding_requests(
  request_id text primary key,
  account_id text not null,
  supabase_subject uuid not null,
  operator_fingerprint text not null,
  created_at timestamptz not null default now()
);
revoke all on table public.velmere_account_supabase_subject_bindings from public,anon,authenticated;
revoke all on table public.velmere_account_supabase_subject_binding_requests from public,anon,authenticated;
grant select,insert,update,delete on table public.velmere_account_supabase_subject_bindings to service_role;
grant select,insert,update,delete on table public.velmere_account_supabase_subject_binding_requests to service_role;

create or replace function public.velmere_current_account_id()
returns text language sql stable security definer
set search_path=pg_catalog,public,auth,pg_temp
as $$
  select b.account_id from public.velmere_account_supabase_subject_bindings b
  where b.supabase_subject=auth.uid() limit 1
$$;
create or replace function public.velmere_current_account_binding_hash()
returns text language sql stable security definer
set search_path=pg_catalog,public,auth,extensions,pg_temp
as $$
  select case when public.velmere_current_account_id() is null then null
    else encode(extensions.digest('velmere-account-binding-v1:'||public.velmere_current_account_id(),'sha256'),'hex') end
$$;
grant execute on function public.velmere_current_account_id() to authenticated,service_role;
grant execute on function public.velmere_current_account_binding_hash() to authenticated,service_role;

create table storage.objects(
  id uuid primary key,
  bucket_id text not null,
  name text not null,
  owner uuid,
  owner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);
grant select,insert,update,delete on storage.objects to service_role;

create table public.velmere_audit_intake_cases(
  case_id text primary key,
  case_ref text not null unique,
  request_id text not null,
  target_kind text not null,
  target_private text not null,
  target_hash text not null,
  display_label text not null,
  tier text not null,
  locale text not null,
  status text not null,
  account_id text,
  account_email text,
  entitlement_required boolean not null default false,
  entitlement_verified boolean not null default false,
  analysis_started boolean not null default false,
  intake_receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_candidates_json jsonb not null default '{}'::jsonb,
  checkout_session_id text,
  checkout_context_hash text,
  checkout_product_id text,
  entitlement_id text,
  payment_event_id text,
  entitlement_verified_at timestamptz,
  blocked_reason text,
  blocked_event_hash text,
  blocked_at timestamptz,
  target_chain_id text,
  target_chain_name text,
  check (tier in ('basic','pro','advanced')),
  check (tier='basic' or account_id is not null)
);
grant all on public.velmere_audit_intake_cases to service_role;

create table public.velmere_customer_artifact_snapshots(
  snapshot_id text primary key,
  account_id text not null,
  account_id_hash text not null,
  surface text not null,
  payload_kind text not null,
  report_id text not null,
  artifact_digest text not null,
  snapshot_digest text not null,
  pdf_storage text not null,
  snapshot jsonb not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.velmere_customer_artifact_pdf_blobs(
  schema_version text not null,
  blob_id text primary key,
  snapshot_id text not null,
  account_id text not null,
  account_id_hash text not null,
  surface text not null,
  report_id text not null,
  artifact_digest text not null,
  pdf_digest text not null,
  pdf_byte_length integer not null,
  mime_type text not null,
  pdf_bytes bytea not null,
  created_at timestamptz not null default now(),
  record_digest text not null
);
create or replace function public.c14_fixture_artifact_guard()
returns trigger language plpgsql as $$
begin
  if current_setting('velmere.r7_authorized_erasure',true) <> 'on' then
    raise exception 'artifact_immutable';
  end if;
  return old;
end $$;
create trigger fixture_snapshot_guard before delete on public.velmere_customer_artifact_snapshots
for each row execute function public.c14_fixture_artifact_guard();
create trigger fixture_pdf_guard before delete on public.velmere_customer_artifact_pdf_blobs
for each row execute function public.c14_fixture_artifact_guard();

create table public.velmere_audit_basic_report_artifacts(
  artifact_id uuid primary key,
  account_id_hash text not null,
  report_id text not null,
  case_ref text not null,
  request_id text not null,
  snapshot_json jsonb not null,
  pdf_bytes bytea not null
);
create table public.velmere_audit_basic_report_backups(
  backup_id uuid primary key,
  account_id_hash text not null,
  report_id text not null,
  case_ref text not null,
  request_id text not null,
  snapshot_json jsonb not null,
  pdf_bytes bytea not null
);
create or replace function public.c14_fixture_audit_guard()
returns trigger language plpgsql as $$
begin
  if current_setting('velmere.audit_basic_erasure_authorized',true) <> 'v1' then
    raise exception 'audit_artifact_immutable';
  end if;
  return old;
end $$;
create trigger fixture_audit_guard before delete on public.velmere_audit_basic_report_artifacts
for each row execute function public.c14_fixture_audit_guard();
"""


def main() -> None:
    migration_text = MIGRATION.read_text()
    assert "delete from storage.objects" not in migration_text.lower(), "Storage objects must be removed through Storage API"
    assert "full_erasure_claimed boolean not null default false" in migration_text
    psql(FIXTURE)
    psql_file(MIGRATION)

    psql(f"""
      insert into auth.users(id,email,phone,encrypted_password,raw_user_meta_data,last_sign_in_at) values
        ('{A_SUBJECT}','a@example.test','+491111','SECRET_A','{{"display_name":"Alice"}}',now()),
        ('{B_SUBJECT}','b@example.test','+492222','SECRET_B','{{"display_name":"Bob"}}',now());
      insert into auth.identities(id,provider_id,user_id,provider,email) values
        ('aaaaaaaa-0000-4000-8000-000000000001','pa','{A_SUBJECT}','email','a@example.test'),
        ('bbbbbbbb-0000-4000-8000-000000000001','pb','{B_SUBJECT}','email','b@example.test');
      insert into public.velmere_account_supabase_subject_bindings(account_id,supabase_subject,request_id,operator_fingerprint) values
        ('{A_ACCOUNT}','{A_SUBJECT}','bind-a','operator_aaaaaaaaaaaaaaaaaaaa'),
        ('{B_ACCOUNT}','{B_SUBJECT}','bind-b','operator_bbbbbbbbbbbbbbbbbbbb');
      insert into public.velmere_account_supabase_subject_binding_requests(request_id,account_id,supabase_subject,operator_fingerprint) values
        ('bind-request-a','{A_ACCOUNT}','{A_SUBJECT}','operator_aaaaaaaaaaaaaaaaaaaa'),
        ('bind-request-b','{B_ACCOUNT}','{B_SUBJECT}','operator_bbbbbbbbbbbbbbbbbbbb');
      insert into public.velmere_audit_intake_cases(case_id,case_ref,request_id,target_kind,target_private,target_hash,display_label,tier,locale,status,account_id,account_email,intake_receipt,checkout_session_id,payment_event_id) values
        ('case-a','ref-a','req-a','url','https://a.example','hash-a','A','pro','en','queued_paid_review','{A_ACCOUNT}','a@example.test','{{"accountEmail":"a@example.test","opaque":"retain-for-policy"}}','cs_a','evt_a'),
        ('case-b','ref-b','req-b','url','https://b.example','hash-b','B','pro','en','queued_paid_review','{B_ACCOUNT}','b@example.test','{{"accountEmail":"b@example.test"}}','cs_b','evt_b');
      insert into public.velmere_customer_artifact_snapshots(snapshot_id,account_id,account_id_hash,surface,payload_kind,report_id,artifact_digest,snapshot_digest,pdf_storage,snapshot,generated_at) values
        ('snap-a','{A_ACCOUNT}','{A_HASH}','audit','report','report-a','ad-a','sd-a','postgres','{{"secret":"A"}}',now()),
        ('snap-b','{B_ACCOUNT}','{B_HASH}','audit','report','report-b','ad-b','sd-b','postgres','{{"secret":"B"}}',now());
      insert into public.velmere_customer_artifact_pdf_blobs(schema_version,blob_id,snapshot_id,account_id,account_id_hash,surface,report_id,artifact_digest,pdf_digest,pdf_byte_length,mime_type,pdf_bytes,record_digest) values
        ('v1','blob-a','snap-a','{A_ACCOUNT}','{A_HASH}','audit','report-a','ad-a','pd-a',1,'application/pdf','\\x41','rd-a'),
        ('v1','blob-b','snap-b','{B_ACCOUNT}','{B_HASH}','audit','report-b','ad-b','pd-b',1,'application/pdf','\\x42','rd-b');
      insert into public.velmere_audit_basic_report_artifacts values
        ('aaaaaaaa-1000-4000-8000-000000000001','{A_HASH}','basic-a','basic-ref-a','basic-req-a','{{"a":1}}','\\x41'),
        ('bbbbbbbb-1000-4000-8000-000000000001','{B_HASH}','basic-b','basic-ref-b','basic-req-b','{{"b":1}}','\\x42');
      insert into public.velmere_audit_basic_report_backups values
        ('aaaaaaaa-2000-4000-8000-000000000001','{A_HASH}','basic-a','basic-ref-a','basic-req-a','{{"a":1}}','\\x41'),
        ('bbbbbbbb-2000-4000-8000-000000000001','{B_HASH}','basic-b','basic-ref-b','basic-req-b','{{"b":1}}','\\x42');
      insert into storage.objects(id,bucket_id,name,owner,owner_id) values
        ('aaaaaaaa-3000-4000-8000-000000000001','reports','a/report.pdf','{A_SUBJECT}','{A_SUBJECT}'),
        ('bbbbbbbb-3000-4000-8000-000000000001','reports','b/report.pdf','{B_SUBJECT}','{B_SUBJECT}');
    """)

    export_a_raw = as_user(
        A_SUBJECT,
        f"select row_to_json(public.velmere_create_account_data_export_v1('{A_EXPORT}','{A_IDEMP_EXPORT}'))::text"
    ).splitlines()[-1]
    export_a = json.loads(export_a_raw)
    payload_a = json.loads(export_a["payload_text"])
    assert payload_a["account"]["accountId"] == A_ACCOUNT
    assert payload_a["account"]["auth"]["email"] == "a@example.test"
    assert "encrypted_password" not in json.dumps(payload_a).lower()
    assert "b@example.test" not in json.dumps(payload_a)
    assert payload_a["scope"]["legalDsrCompleteness"] is False
    assert len(payload_a["application"]["storageObjectMetadata"]) == 1

    # Same idempotency key must return the same export rather than duplicate data.
    export_a_again = json.loads(as_user(
        A_SUBJECT,
        f"select row_to_json(public.velmere_create_account_data_export_v1('{A_EXPORT}','{A_IDEMP_EXPORT}'))::text"
    ).splitlines()[-1])
    assert export_a_again["export_id"] == A_EXPORT

    # Cross-account RLS: B cannot read A's export.
    visible_to_b = as_user(B_SUBJECT, f"select count(*) from public.velmere_account_data_exports where export_id='{A_EXPORT}'").splitlines()[-1]
    assert visible_to_b == "0"

    # Missing auth cannot call the user export RPC.
    error = as_user("", f"select public.velmere_create_account_data_export_v1('{B_EXPORT}','{'f'*64}')", expect_fail=True)
    assert "account_data_export_auth_required" in error

    # B gets its own export for legal-hold negative execution coverage.
    as_user(B_SUBJECT, f"select public.velmere_create_account_data_export_v1('{B_EXPORT}','{B_IDEMP_EXPORT}')")

    request_a = json.loads(as_user(
        A_SUBJECT,
        f"select row_to_json(public.velmere_request_account_erasure_v1('{A_REQUEST}','{A_IDEMP_ERASURE}'))::text"
    ).splitlines()[-1])
    assert request_a["state"] == "SESSION_REVOCATION_PENDING"
    assert request_a["account_id"] == A_ACCOUNT

    request_a_again = json.loads(as_user(
        A_SUBJECT,
        f"select row_to_json(public.velmere_request_account_erasure_v1('{A_REQUEST}','{A_IDEMP_ERASURE}'))::text"
    ).splitlines()[-1])
    assert request_a_again["request_id"] == A_REQUEST

    as_service(
        f"select public.velmere_confirm_account_erasure_session_revocation_v1('{A_REQUEST}','{A_HASH}','{REVOCATION}')"
    )
    as_service(
        f"select public.velmere_record_account_erasure_approval_v1('{A_REQUEST}','{A_APPROVAL}','{APPROVER}','{POLICY}','CLEAR',now()+interval '1 hour')"
    )
    prepared = json.loads(as_service(
        f"select public.velmere_execute_account_erasure_application_v1('{A_REQUEST}','{A_APPROVAL}')::text"
    ).splitlines()[-1])
    assert prepared["schemaVersion"] == "velmere.account-erasure-preparation.v1"
    assert prepared["supabaseSubject"] == A_SUBJECT
    assert prepared["storageObjects"] == [{"bucketId": "reports", "name": "a/report.pdf"}]

    # A data removed/pseudonymized; B untouched.
    assert psql(f"select count(*) from public.velmere_customer_artifact_snapshots where account_id='{A_ACCOUNT}'") == "0"
    assert psql(f"select count(*) from public.velmere_customer_artifact_pdf_blobs where account_id='{A_ACCOUNT}'") == "0"
    assert psql(f"select count(*) from public.velmere_audit_basic_report_artifacts where account_id_hash='{A_HASH}'") == "0"
    assert psql(f"select count(*) from public.velmere_audit_basic_report_backups where account_id_hash='{A_HASH}'") == "0"
    assert psql(f"select count(*) from public.velmere_customer_artifact_snapshots where account_id='{B_ACCOUNT}'") == "1"
    assert psql(f"select count(*) from public.velmere_audit_basic_report_artifacts where account_id_hash='{B_HASH}'") == "1"
    pseudonymized = psql("select account_id||'|'||coalesce(account_email,'NULL') from public.velmere_audit_intake_cases where case_id='case-a'")
    assert pseudonymized == f"erased:{A_HASH[:32]}|NULL"
    assert psql(f"select count(*) from public.velmere_account_data_exports where account_id_hash='{A_HASH}'") == "0"

    # Application SQL did not remove Storage metadata; provider API must do that.
    assert psql(f"select count(*) from storage.objects where owner='{A_SUBJECT}'") == "1"

    # Simulate successful Storage API removal and auth.admin.deleteUser in the isolated fixture.
    psql(f"delete from storage.objects where owner='{A_SUBJECT}'; delete from auth.users where id='{A_SUBJECT}';")
    final = json.loads(as_service(
        f"select public.velmere_finalize_account_erasure_v1('{A_REQUEST}','{A_HASH}','{A_APPROVAL}','REMOVED','DELETED',1,null)::text"
    ).splitlines()[-1])
    assert final["storageState"] == "REMOVED"
    assert final["authState"] == "DELETED"
    assert final["fullErasureClaimed"] is False
    assert "platform_backups" in final["residualBlockers"]
    assert psql(f"select count(*) from public.velmere_account_erasure_requests where request_id='{A_REQUEST}'") == "0"
    assert psql(f"select count(*) from public.velmere_account_erasure_tombstones where account_id_hash='{A_HASH}'") == "1"
    assert psql(f"select count(*) from public.velmere_account_supabase_subject_bindings where account_id='{A_ACCOUNT}'") == "0"
    assert psql(f"select count(*) from public.velmere_account_supabase_subject_bindings where account_id='{B_ACCOUNT}'") == "1"

    # Legal hold is a hard stop.
    as_user(B_SUBJECT, f"select public.velmere_request_account_erasure_v1('{B_REQUEST}','{B_IDEMP_ERASURE}')")
    as_service(f"select public.velmere_confirm_account_erasure_session_revocation_v1('{B_REQUEST}','{B_HASH}','{REVOCATION}')")
    as_service(
        f"select public.velmere_record_account_erasure_approval_v1('{B_REQUEST}','{B_APPROVAL}','{APPROVER}','{POLICY}','ACTIVE',now()+interval '1 hour')"
    )
    hold_error = as_service(
        f"select public.velmere_execute_account_erasure_application_v1('{B_REQUEST}','{B_APPROVAL}')",
        expect_fail=True,
    )
    assert "account_erasure_legal_hold_active" in hold_error
    assert psql(f"select count(*) from public.velmere_customer_artifact_snapshots where account_id='{B_ACCOUNT}'") == "1"

    # Privilege checks: authenticated cannot invoke operator-only execution RPC.
    execute_allowed = psql(
        "select has_function_privilege('authenticated','public.velmere_execute_account_erasure_application_v1(uuid,text)','EXECUTE')"
    )
    assert execute_allowed == "f"

    print(json.dumps({
        "schemaVersion": "velmere.c14-p15.db-test.v1",
        "status": "PASS",
        "checks": {
            "export_owner_isolation": True,
            "export_secret_exclusion": True,
            "no_auth_denied": True,
            "idempotency": True,
            "artifact_erasure_guard_path": True,
            "storage_api_boundary": True,
            "auth_delete_order": True,
            "cross_account_preserved": True,
            "legal_hold_blocks_execution": True,
            "operator_rpc_not_authenticated": True,
            "full_erasure_claim_false": True,
        },
    }, indent=2))


if __name__ == "__main__":
    main()
