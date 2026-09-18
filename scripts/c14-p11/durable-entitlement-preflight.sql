-- C14-P11 read-only durable entitlement deployment preflight.
-- No customer rows are read. Run against the intended Supabase environment.
-- Expected for a usable durable VLM entitlement stack:
--   entitlement_table_present = true
--   create_or_read_rpc_count  >= 1
--   lifecycle_rpc_count       >= 1

select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'velmere_vlm_paid_entitlements'
  ) as entitlement_table_present,
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'velmere_create_or_read_vlm_paid_entitlement'
  ) as create_or_read_rpc_count,
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'velmere_apply_vlm_paid_entitlement_lifecycle_event'
  ) as lifecycle_rpc_count;
