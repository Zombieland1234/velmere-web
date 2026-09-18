\set ON_ERROR_STOP on
DO $$
DECLARE
  v_reports int;
  v_pre int;
  v_post int;
  v_bad_digest int;
  v_bad_report int;
  v_limit int;
BEGIN
  SELECT count(*) INTO v_reports FROM velmere_c14_p16.audit_reports;
  IF v_reports <> 1 THEN RAISE EXCEPTION 'report_count_mismatch:%', v_reports; END IF;
  SELECT count(*) INTO v_pre FROM velmere_c14_p16.event_log WHERE sequence_no = 1 AND event_name='pre_backup_committed';
  IF v_pre <> 1 THEN RAISE EXCEPTION 'pre_cutoff_event_missing'; END IF;
  SELECT count(*) INTO v_post FROM velmere_c14_p16.event_log WHERE sequence_no = 2;
  IF v_post <> 0 THEN RAISE EXCEPTION 'post_cutoff_event_unexpectedly_restored'; END IF;
  SELECT count(*) INTO v_bad_digest FROM velmere_c14_p16.audit_reports
    WHERE report_json_sha256 <> encode(digest(convert_to(report_json::text,'UTF8'),'sha256'),'hex')
       OR pdf_sha256 <> encode(digest(pdf_bytes,'sha256'),'hex');
  IF v_bad_digest <> 0 THEN RAISE EXCEPTION 'report_digest_mismatch'; END IF;
  SELECT count(*) INTO v_bad_report FROM velmere_c14_p16.audit_reports r
    JOIN velmere_c14_p16.storage_objects s ON s.object_path=r.storage_object_path
    WHERE r.report_json->>'reportId' <> r.report_id
       OR r.report_json->>'caseRef' <> r.case_ref
       OR r.report_json->>'ownerId' <> r.account_id::text
       OR r.report_json->>'tier' <> r.tier
       OR r.report_json->>'storageObjectPath' <> r.storage_object_path
       OR r.report_json->>'storageObjectSha256' <> s.sha256
       OR r.pdf_sha256 <> s.sha256
       OR octet_length(r.pdf_bytes) <> s.byte_length
       OR r.record_sha256 <> encode(digest(convert_to(concat_ws('|',r.report_id,r.account_id::text,r.case_ref,r.tier,r.report_json::text,r.pdf_sha256,s.sha256),'UTF8'),'sha256'),'hex');
  IF v_bad_report <> 0 THEN RAISE EXCEPTION 'report_semantic_consistency_mismatch'; END IF;
  SELECT used_count INTO v_limit FROM velmere_c14_p16.limit_state WHERE boundary_key='acct:'||repeat('a',64)||':audit';
  IF v_limit <> 7 THEN RAISE EXCEPTION 'limit_state_mismatch:%', v_limit; END IF;
  IF (SELECT value->>'baseSha' FROM velmere_c14_p16.critical_metadata WHERE key='source_revision') <> '4cb45bbcf910f0517d4a5d265682cd2f7e4e41df' THEN RAISE EXCEPTION 'source_revision_metadata_mismatch'; END IF;
END $$;

SET ROLE c14_p16_authenticated;
SET velmere.account_id = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM velmere_c14_p16.audit_reports) <> 1 THEN RAISE EXCEPTION 'owner_a_cannot_read_own_report'; END IF;
  IF (SELECT count(*) FROM velmere_c14_p16.entitlement_events) <> 1 THEN RAISE EXCEPTION 'owner_a_entitlement_visibility_mismatch'; END IF;
  IF (SELECT count(*) FROM velmere_c14_p16.storage_objects) <> 1 THEN RAISE EXCEPTION 'owner_a_storage_visibility_mismatch'; END IF;
END $$;
RESET ROLE;

SET ROLE c14_p16_authenticated;
SET velmere.account_id = '22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM velmere_c14_p16.audit_reports) <> 0 THEN RAISE EXCEPTION 'owner_b_cross_tenant_report_read'; END IF;
  IF (SELECT count(*) FROM velmere_c14_p16.entitlement_events) <> 1 THEN RAISE EXCEPTION 'owner_b_entitlement_visibility_mismatch'; END IF;
  IF (SELECT count(*) FROM velmere_c14_p16.storage_objects) <> 1 THEN RAISE EXCEPTION 'owner_b_storage_visibility_mismatch'; END IF;
END $$;
RESET ROLE;
