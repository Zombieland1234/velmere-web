"""C14-P13 isolated qualification of the captured Shield RPC.

Real PostgreSQL semantics, synthetic users/sessions/entitlements/workspaces only.
Refuses to run anywhere except localhost/c14_p13_fixture.
"""
from pathlib import Path
import concurrent.futures
import datetime
import hashlib
import json
import os
import subprocess

if os.environ.get("PGHOST") not in ("localhost", "127.0.0.1") or os.environ.get("PGDATABASE") != "c14_p13_fixture":
    raise RuntimeError("Refuse non-isolated database: localhost/c14_p13_fixture required")

OUT = Path("/tmp/c14-p13-sql")
OUT.mkdir(parents=True, exist_ok=True)
ROWS = []

def sql(query: str, ok: bool = True):
    p = subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=query,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if ok and p.returncode:
        raise AssertionError(p.stderr)
    return p

def record(name: str, passed: bool, **details):
    row = {
        "id": name,
        "result": "PASS" if passed else "FAIL",
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        **details,
    }
    ROWS.append(row)
    (OUT / "CHECKS.json").write_text(json.dumps({
        "sourceSha": os.environ.get("GITHUB_SHA"),
        "scope": "REAL_POSTGRESQL_CAPTURED_RPC_SYNTHETIC_IDENTITIES_NO_CUSTOMER_WRITES",
        "checks": ROWS,
    }, indent=2))
    print(name, row["result"], flush=True)
    if not passed:
        raise AssertionError(name + ": " + json.dumps(details, default=str))

def check(name: str, query: str, expected: str | None = None, error: str | None = None):
    p = sql(query, ok=False)
    passed = (
        p.returncode != 0 and error in p.stderr
        if error
        else p.returncode == 0 and (expected is None or expected in p.stdout)
    )
    record(name, passed, exitCode=p.returncode, expected=expected, error=error,
           stdout=p.stdout, stderr=p.stderr)
    return p

A = "00000000-0000-4000-8000-00000000000a"
B = "00000000-0000-4000-8000-00000000000b"
SA = "00000000-0000-4000-8000-00000000001a"
SB = "00000000-0000-4000-8000-00000000001b"
WP = "00000000-0000-4000-8000-00000000002a"
WA = "00000000-0000-4000-8000-00000000002b"
WD = "00000000-0000-4000-8000-00000000002c"
WCD = "00000000-0000-4000-8000-00000000002d"
WCR = "00000000-0000-4000-8000-00000000002e"
GA = "00000000-0000-4000-8000-00000000003a"
GB = "00000000-0000-4000-8000-00000000003b"
GADV = "00000000-0000-4000-8000-00000000003c"

def request(
    tier="pro",
    locale="en",
    operation="READ",
    workspace=WP,
    user=A,
    session=SA,
    role="authenticated",
    prefix="",
    commit=False,
):
    claims = json.dumps({"sub": user, "session_id": session}) if user else "{}"
    t = "NULL" if tier is None else "'" + tier + "'"
    l = "NULL" if locale is None else "'" + locale + "'"
    o = "NULL" if operation is None else "'" + operation + "'"
    w = "NULL" if workspace is None else "'" + workspace + "'::uuid"
    ending = "COMMIT;" if commit else "ROLLBACK;"
    return (
        f"BEGIN; {prefix} SET LOCAL ROLE {role}; "
        f"SET LOCAL request.jwt.claims='{claims}'; "
        f"SELECT public.velmere_r7_shield_pro_paid_workspace_v1({t},{l},{o},{w}); "
        f"{ending}"
    )

def parallel_psql(queries):
    def one(q):
        return sql(q, ok=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as pool:
        return list(pool.map(one, queries))

try:
    sql(Path("scripts/c13/fixtures/isolated-schema.sql").read_text())

    c6d = Path("supabase/migrations/20260917043048_velmere_c6d_shield_session_and_null_validation.sql").read_text()
    helper = c6d[c6d.index("CREATE OR REPLACE FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1"):c6d.index("DO $workspace_patch$")]
    sql(helper)

    baseline = Path("scripts/c13/fixtures/shield-workspace-live-before.sql").read_text()
    if hashlib.sha256(baseline.encode()).hexdigest() != "102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a":
        raise AssertionError("captured C13 baseline hash drifted")
    sql(baseline + ";")

    sql(
        "REVOKE ALL ON FUNCTION "
        "public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), "
        "public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) FROM PUBLIC,anon; "
        "GRANT EXECUTE ON FUNCTION "
        "public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), "
        "public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) TO authenticated; "
        "GRANT USAGE ON SCHEMA auth TO authenticated; "
        "GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated;"
    )
    sql(
        f"INSERT INTO auth.sessions VALUES "
        f"('{SA}','{A}',null),('{SB}','{B}',null); "
        "INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events"
        "(entitlement_ref,account_id,tier,event_kind,evidence) VALUES "
        f"('{GA}','{A}','pro','GRANT',jsonb_build_object('githubRunId','1413')),"
        f"('{GB}','{B}','pro','GRANT',jsonb_build_object('githubRunId','1413'));"
    )

    for workspace, tier, locale, event in [
        (WP, "pro", "en", "CREATE"),
        (WA, "advanced", "de", "CREATE"),
        (WD, "advanced", "de", "DELETE"),
        (WCD, "pro", "en", "CREATE"),
        (WCR, "pro", "pl", "DELETE"),
    ]:
        sql(
            "INSERT INTO velmere_private.r7_shield_pro_paid_workspace_events"
            "(workspace_id,account_id,tier,locale,event_kind,payload,payload_digest_sha256) VALUES "
            f"('{workspace}','{A}','{tier}','{locale}','{event}',"
            f"jsonb_build_object('schemaVersion','fixture','tier','{tier}','locale','{locale}','assets',jsonb_build_array()),"
            "repeat('a',64));"
        )

    # Reconstruct the exact C13 state first.
    c13 = Path("supabase/migrations/20260917230935_velmere_c13_shield_workspace_stored_tier_guard.sql").read_text()
    check("c13-stored-tier-guard-applies", "BEGIN;" + c13 + "COMMIT;")
    check(
        "c13-live-hash-parity-before-c14",
        "SELECT encode(extensions.digest(pg_get_functiondef("
        "'public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure"
        "),'sha256'),'hex');",
        "b7392a8f1777d9501d4d3ab09d70d40db9b1edd7792c4c9a754610d04000cfb6",
    )
    check(
        "helper-live-hash-parity",
        "SELECT encode(extensions.digest(pg_get_functiondef("
        "'public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)'::regprocedure"
        "),'sha256'),'hex');",
        "233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92",
    )

    patch = Path("scripts/c14/p13/shield-rpc-hardening.sql").read_text()
    check("c14-hardening-applies", "BEGIN;" + patch + "COMMIT;")
    check(
        "c14-hardening-refuses-drift-or-reapply",
        "BEGIN;" + patch + "COMMIT;",
        error="C14-P13 aborted: reviewed live RPC definitions changed",
    )

    post_hash = sql(
        "SELECT encode(extensions.digest(pg_get_functiondef("
        "'public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure"
        "),'sha256'),'hex');"
    ).stdout.strip()
    (OUT / "TARGET_RPC_SHA256.txt").write_text(post_hash + "\n")
    record("c14-target-rpc-hash-captured", len(post_hash) == 64, sha256=post_hash)

    # Auth/session/ownership boundaries.
    check("own-pro-read", request(), '"tier": "pro"')
    check("cross-account-not-found", request(user=B, session=SB), '"resolution": "NOT_FOUND"')
    check("anonymous-role-denied", request(role="anon", user=None), error="permission denied for function")
    check("missing-subject-denied", request(user=None), error="shield_pro_paid_auth_required")
    check("wrong-session-owner-denied", request(session=SB), error="shield_pro_paid_entitlement_required")
    check("missing-session-denied", request(session="00000000-0000-4000-8000-000000000099"), error="shield_pro_paid_entitlement_required")
    check("malformed-session-denied", request(session="not-a-session"), error="shield_pro_paid_entitlement_required")
    check(
        "expired-session-denied",
        request(prefix=f"UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id='{SA}';"),
        error="shield_pro_paid_entitlement_required",
    )
    check(
        "deleted-session-denied",
        request(prefix=f"DELETE FROM auth.sessions WHERE id='{SA}';"),
        error="shield_pro_paid_entitlement_required",
    )

    # Request validation: there is no UPDATE operation.
    check("update-operation-does-not-exist", request(operation="UPDATE"), error="shield_pro_paid_request_invalid")
    check("null-tier-denied", request(tier=None), error="shield_pro_paid_request_invalid")
    check("null-locale-denied", request(locale=None), error="shield_pro_paid_request_invalid")
    check("null-operation-denied", request(operation=None), error="shield_pro_paid_request_invalid")
    check("missing-workspace-denied", request(workspace=None), error="shield_pro_paid_workspace_id_required")

    # Grant/tier authority and CREATE.
    check("pro-create", request(operation="CREATE", workspace=None), '"resolution": "CREATED"')
    check("pro-cannot-read-stored-advanced", request(workspace=WA), error="shield_pro_stored_workspace_entitlement_required")
    sql(
        "INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events"
        "(entitlement_ref,account_id,tier,event_kind,evidence) VALUES "
        f"('{GADV}','{A}','advanced','GRANT',jsonb_build_object('githubRunId','1413'));"
    )
    check("advanced-create", request(tier="advanced", operation="CREATE", workspace=None), '"resolution": "CREATED"')
    check("advanced-request-reading-pro-returns-stored-pro-tier", request(tier="advanced", workspace=WP), '"tier": "pro"')
    check("advanced-request-reading-pro-returns-stored-locale", request(tier="advanced", locale="de", workspace=WP), '"locale": "en"')
    check("pro-parameter-with-advanced-grant-returns-stored-advanced-tier", request(workspace=WA), '"tier": "advanced"')
    check("pro-parameter-with-advanced-grant-returns-stored-advanced-locale", request(locale="pl", workspace=WA), '"locale": "de"')
    check("advanced-restore-returns-stored-identity", request(tier="advanced", locale="pl", operation="RESTORE", workspace=WD), '"tier": "advanced"')

    # Revoke/downgrade. Delete remains intentionally allowed as cleanup, but
    # READ/RESTORE of stored Advanced data must fail after downgrade to Pro.
    sql(
        "INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events"
        "(entitlement_ref,account_id,tier,event_kind) VALUES "
        f"('{GADV}','{A}','advanced','REVOKE');"
    )
    check("revoked-advanced-read-denied-after-downgrade", request(workspace=WA), error="shield_pro_stored_workspace_entitlement_required")
    check("revoked-advanced-restore-denied-after-downgrade", request(operation="RESTORE", workspace=WD), error="shield_pro_stored_workspace_entitlement_required")
    check("downgraded-owner-may-delete-old-advanced", request(operation="DELETE", workspace=WA), '"tier": "advanced"')
    check("downgraded-delete-preserves-stored-locale", request(locale="pl", operation="DELETE", workspace=WA), '"locale": "de"')
    check(
        "expired-pro-grant-denied",
        request(prefix=f"UPDATE velmere_private.r7_shield_pro_paid_entitlement_events SET expires_at=now()-interval '1 minute' WHERE entitlement_ref='{GA}' AND event_kind='GRANT';"),
        error="shield_pro_paid_entitlement_required",
    )
    check(
        "revoked-pro-grant-denied",
        request(prefix=(
            "INSERT INTO velmere_private.r7_shield_pro_paid_entitlement_events"
            "(entitlement_ref,account_id,tier,event_kind) VALUES "
            f"('{GA}','{A}','pro','REVOKE');"
        )),
        error="shield_pro_paid_entitlement_required",
    )

    # Natural high-concurrency mutation test. One DELETE transitions the row;
    # every later waiter must observe the committed DELETE and be idempotent.
    deletes = parallel_psql([request(operation="DELETE", workspace=WCD, commit=True) for _ in range(8)])
    delete_ok = [p for p in deletes if p.returncode == 0]
    delete_false = sum('"idempotent": false' in p.stdout for p in delete_ok)
    delete_true = sum('"idempotent": true' in p.stdout for p in delete_ok)
    delete_rows = int(sql(
        f"SELECT count(*) FROM velmere_private.r7_shield_pro_paid_workspace_events "
        f"WHERE workspace_id='{WCD}' AND event_kind='DELETE';"
    ).stdout.strip())
    record(
        "concurrent-delete-serialized",
        len(delete_ok) == 8 and delete_false == 1 and delete_true == 7 and delete_rows == 1,
        successful=len(delete_ok), idempotentFalse=delete_false,
        idempotentTrue=delete_true, deleteRows=delete_rows,
        stderr=[p.stderr for p in deletes if p.returncode],
    )

    # One RESTORE transitions a deleted workspace; all other concurrent callers
    # wake after the lock and see an already-restored state.
    restores = parallel_psql([request(operation="RESTORE", workspace=WCR, commit=True) for _ in range(8)])
    restore_ok = [p for p in restores if p.returncode == 0]
    restore_conflicts = [p for p in restores if p.returncode != 0 and "shield_pro_paid_restore_requires_deleted_workspace" in p.stderr]
    restore_rows = int(sql(
        f"SELECT count(*) FROM velmere_private.r7_shield_pro_paid_workspace_events "
        f"WHERE workspace_id='{WCR}' AND event_kind='RESTORE';"
    ).stdout.strip())
    record(
        "concurrent-restore-serialized",
        len(restore_ok) == 1 and len(restore_conflicts) == 7 and restore_rows == 1,
        successful=len(restore_ok), conflicts=len(restore_conflicts),
        restoreRows=restore_rows,
        unexpected=[{"code": p.returncode, "stdout": p.stdout, "stderr": p.stderr}
                    for p in restores if p not in restore_ok and p not in restore_conflicts],
    )

    check(
        "acl-remains-authenticated-only",
        "SELECT has_function_privilege('anon','public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)','execute')::text"
        "||'/'||has_function_privilege('authenticated','public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)','execute')::text;",
        "false/true",
    )
    check(
        "mutation-lock-present-in-function",
        "SELECT (position('pg_advisory_xact_lock' in pg_get_functiondef("
        "'public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure))>0)::text;",
        "true",
    )

finally:
    files = []
    for p in OUT.iterdir():
        if p.is_file() and p.name != "EVIDENCE_MANIFEST.json":
            files.append({"path": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size})
    (OUT / "EVIDENCE_MANIFEST.json").write_text(json.dumps({
        "sourceSha": os.environ.get("GITHUB_SHA"),
        "liveCustomerWrites": 0,
        "realAuthHttpTest": False,
        "fixtureDatabase": "c14_p13_fixture",
        "files": files,
    }, indent=2))
