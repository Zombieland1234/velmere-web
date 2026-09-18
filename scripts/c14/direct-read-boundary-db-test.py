from pathlib import Path
import os, subprocess
if os.environ.get("PGHOST") not in ("localhost","127.0.0.1") or os.environ.get("PGDATABASE")!="c14_fixture":
    raise RuntimeError("Refuse non-isolated database")
def sql(q):
    p=subprocess.run(["psql","-X","-qAt","-v","ON_ERROR_STOP=1"],input=q,text=True,capture_output=True,timeout=30)
    if p.returncode: raise AssertionError(p.stderr)
    return p.stdout.strip()
sql("""
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.velmere_customer_artifact_snapshots(id integer);
create table public.velmere_customer_artifact_pdf_blobs(id integer);
create function public.velmere_get_owner_visible_customer_artifact_v1(text) returns text language sql as $$ select $1 $$;
create function public.velmere_list_owner_visible_customer_artifacts_v1(integer) returns integer language sql as $$ select $1 $$;
grant select on public.velmere_customer_artifact_snapshots,public.velmere_customer_artifact_pdf_blobs to authenticated,anon;
grant execute on function public.velmere_get_owner_visible_customer_artifact_v1(text) to authenticated,anon;
grant execute on function public.velmere_list_owner_visible_customer_artifacts_v1(integer) to authenticated,anon;
""")
assert sql("select has_table_privilege('authenticated','public.velmere_customer_artifact_snapshots','select')")=="t"
sql(Path("supabase/migrations/20260918024500_velmere_c14_historical_artifact_direct_read_boundary.sql").read_text())
checks={
"authenticated snapshot SELECT revoked":sql("select has_table_privilege('authenticated','public.velmere_customer_artifact_snapshots','select')")=="f",
"authenticated PDF SELECT revoked":sql("select has_table_privilege('authenticated','public.velmere_customer_artifact_pdf_blobs','select')")=="f",
"anon snapshot SELECT revoked":sql("select has_table_privilege('anon','public.velmere_customer_artifact_snapshots','select')")=="f",
"authenticated get RPC revoked":sql("select has_function_privilege('authenticated','public.velmere_get_owner_visible_customer_artifact_v1(text)','execute')")=="f",
"authenticated list RPC revoked":sql("select has_function_privilege('authenticated','public.velmere_list_owner_visible_customer_artifacts_v1(integer)','execute')")=="f",
"service-role snapshot SELECT retained":sql("select has_table_privilege('service_role','public.velmere_customer_artifact_snapshots','select')")=="t",
"service-role PDF SELECT retained":sql("select has_table_privilege('service_role','public.velmere_customer_artifact_pdf_blobs','select')")=="t",
}
for name,ok in checks.items():
 print(name,"PASS" if ok else "FAIL",flush=True)
 if not ok: raise AssertionError(name)
