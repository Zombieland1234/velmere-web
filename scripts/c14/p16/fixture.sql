\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA velmere_c14_p16;

CREATE FUNCTION velmere_c14_p16.current_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT nullif(current_setting('velmere.account_id', true), '')::uuid
$$;

CREATE TABLE velmere_c14_p16.account_bindings (
  account_id uuid PRIMARY KEY,
  account_hash text NOT NULL UNIQUE CHECK (account_hash ~ '^[a-f0-9]{64}$'),
  subject_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE velmere_c14_p16.entitlement_events (
  event_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES velmere_c14_p16.account_bindings(account_id),
  entitlement_ref text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('basic','pro','advanced')),
  event_kind text NOT NULL CHECK (event_kind IN ('GRANT','REVOKE')),
  created_at timestamptz NOT NULL
);

CREATE TABLE velmere_c14_p16.storage_objects (
  object_path text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES velmere_c14_p16.account_bindings(account_id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  created_at timestamptz NOT NULL
);

CREATE TABLE velmere_c14_p16.audit_reports (
  report_id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES velmere_c14_p16.account_bindings(account_id),
  case_ref text NOT NULL UNIQUE,
  tier text NOT NULL CHECK (tier IN ('basic','pro','advanced')),
  report_json jsonb NOT NULL,
  report_json_sha256 text NOT NULL CHECK (report_json_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_bytes bytea NOT NULL,
  pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  storage_object_path text NOT NULL REFERENCES velmere_c14_p16.storage_objects(object_path),
  record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL
);

CREATE TABLE velmere_c14_p16.limit_state (
  boundary_key text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES velmere_c14_p16.account_bindings(account_id),
  used_count integer NOT NULL CHECK (used_count >= 0),
  hard_limit integer NOT NULL CHECK (hard_limit > 0),
  window_ends_at timestamptz NOT NULL
);

CREATE TABLE velmere_c14_p16.critical_metadata (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE velmere_c14_p16.event_log (
  sequence_no bigint PRIMARY KEY,
  event_name text NOT NULL,
  created_at timestamptz NOT NULL
);

ALTER TABLE velmere_c14_p16.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_c14_p16.storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE velmere_c14_p16.entitlement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY c14_p16_report_owner_select ON velmere_c14_p16.audit_reports
  FOR SELECT TO c14_p16_authenticated
  USING (account_id = velmere_c14_p16.current_account_id());
CREATE POLICY c14_p16_storage_owner_select ON velmere_c14_p16.storage_objects
  FOR SELECT TO c14_p16_authenticated
  USING (account_id = velmere_c14_p16.current_account_id());
CREATE POLICY c14_p16_entitlement_owner_select ON velmere_c14_p16.entitlement_events
  FOR SELECT TO c14_p16_authenticated
  USING (account_id = velmere_c14_p16.current_account_id());

GRANT USAGE ON SCHEMA velmere_c14_p16 TO c14_p16_authenticated;
GRANT SELECT ON velmere_c14_p16.audit_reports, velmere_c14_p16.storage_objects, velmere_c14_p16.entitlement_events TO c14_p16_authenticated;

\set owner_a '11111111-1111-4111-8111-111111111111'
\set owner_b '22222222-2222-4222-8222-222222222222'
\set subject_a 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set subject_b 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set event_a '33333333-3333-4333-8333-333333333333'
\set event_b '44444444-4444-4444-8444-444444444444'
\set ts '2026-09-18T00:45:00Z'

INSERT INTO velmere_c14_p16.account_bindings(account_id,account_hash,subject_id,created_at) VALUES
  (:'owner_a', repeat('a',64), :'subject_a', :'ts'),
  (:'owner_b', repeat('b',64), :'subject_b', :'ts');

INSERT INTO velmere_c14_p16.entitlement_events(event_id,account_id,entitlement_ref,tier,event_kind,created_at) VALUES
  (:'event_a', :'owner_a', 'ent_c14_owner_a_pro', 'pro', 'GRANT', :'ts'),
  (:'event_b', :'owner_b', 'ent_c14_owner_b_basic', 'basic', 'GRANT', :'ts');

INSERT INTO velmere_c14_p16.storage_objects(object_path,account_id,sha256,byte_length,created_at) VALUES
  ('reports/owner-a/report-a.pdf', :'owner_a', :'storage_a_sha', :storage_a_size, :'ts'),
  ('reports/owner-b/report-b.json', :'owner_b', :'storage_b_sha', :storage_b_size, :'ts');

WITH payload AS (
  SELECT jsonb_build_object(
    'schemaVersion','velmere.c14-p16.synthetic-report.v1',
    'reportId','rpt_c14_owner_a',
    'caseRef','AUD-C14P16A001',
    'ownerId',:'owner_a',
    'tier','pro',
    'target','0xc14p16-test-only',
    'storageObjectPath','reports/owner-a/report-a.pdf',
    'storageObjectSha256',:'storage_a_sha',
    'findingCount',2,
    'confidence',0.82,
    'coverage',0.76
  ) AS j,
  convert_to(E'%PDF-1.4\nC14-P16 synthetic restore drill only\n%%EOF\n','UTF8') AS p
)
INSERT INTO velmere_c14_p16.audit_reports(
  report_id,account_id,case_ref,tier,report_json,report_json_sha256,pdf_bytes,pdf_sha256,storage_object_path,record_sha256,created_at
)
SELECT 'rpt_c14_owner_a', :'owner_a', 'AUD-C14P16A001', 'pro', j,
       encode(digest(convert_to(j::text,'UTF8'),'sha256'),'hex'),
       p,
       encode(digest(p,'sha256'),'hex'),
       'reports/owner-a/report-a.pdf',
       encode(digest(convert_to(concat_ws('|','rpt_c14_owner_a',:'owner_a','AUD-C14P16A001','pro',j::text,encode(digest(p,'sha256'),'hex'),:'storage_a_sha'),'UTF8'),'sha256'),'hex'),
       :'ts'
FROM payload;

INSERT INTO velmere_c14_p16.limit_state(boundary_key,account_id,used_count,hard_limit,window_ends_at) VALUES
  ('acct:' || repeat('a',64) || ':audit', :'owner_a', 7, 10, '2026-09-18T01:45:00Z');

INSERT INTO velmere_c14_p16.critical_metadata(key,value,created_at) VALUES
  ('source_revision', jsonb_build_object('baseSha','4cb45bbcf910f0517d4a5d265682cd2f7e4e41df','scope','isolated_ci_only'), :'ts'),
  ('report_contract', jsonb_build_object('jsonPdfStorageDigestParityRequired',true,'ownerIsolationRequired',true), :'ts');

INSERT INTO velmere_c14_p16.event_log(sequence_no,event_name,created_at) VALUES
  (1,'pre_backup_committed','2026-09-18T00:45:01Z');
