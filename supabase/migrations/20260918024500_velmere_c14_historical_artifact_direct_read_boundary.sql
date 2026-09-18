-- C14-P14 source-only direct-read boundary. Deploy only after the server route
-- has moved durable reads behind authenticated account binding + current rights.
begin;
revoke select on table public.velmere_customer_artifact_snapshots from public, anon, authenticated;
revoke select on table public.velmere_customer_artifact_pdf_blobs from public, anon, authenticated;
grant select on table public.velmere_customer_artifact_snapshots to service_role;
grant select on table public.velmere_customer_artifact_pdf_blobs to service_role;
revoke execute on function public.velmere_get_owner_visible_customer_artifact_v1(text) from public, anon, authenticated;
revoke execute on function public.velmere_list_owner_visible_customer_artifacts_v1(integer) from public, anon, authenticated;
grant execute on function public.velmere_get_owner_visible_customer_artifact_v1(text) to service_role;
grant execute on function public.velmere_list_owner_visible_customer_artifacts_v1(integer) to service_role;
commit;
