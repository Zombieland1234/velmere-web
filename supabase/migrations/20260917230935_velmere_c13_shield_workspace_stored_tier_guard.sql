-- C13: current paid monitoring workspaces, not immutable purchased audit archives.
-- Caller-supplied tier cannot authorize a more privileged stored payload.
-- Preconditions bind the exact live definitions reviewed on 2026-09-18 (Europe/Berlin).
SET LOCAL statement_timeout = '10000ms';
SET LOCAL lock_timeout = '2000ms';
DO $c13_guard$
DECLARE
 original text := pg_get_functiondef('public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid)'::regprocedure);
 helper text := pg_get_functiondef('public.velmere_r7_shield_pro_has_paid_entitlement_v1(text)'::regprocedure);
 anchor text := $anchor$  if not found then return jsonb_build_object('resolution','NOT_FOUND'); end if;$anchor$;
 addition text := $addition$
  -- The stored workspace tier, not a caller-controlled lower tier, is authoritative.
  if p_operation in ('READ','RESTORE') and (
    v_latest.tier is null or v_latest.tier not in ('pro','advanced')
    or not public.velmere_r7_shield_pro_has_paid_entitlement_v1(v_latest.tier)
  ) then
    raise exception 'shield_pro_stored_workspace_entitlement_required' using errcode='42501';
  end if;$addition$;
BEGIN
 IF encode(sha256(convert_to(original,'UTF8')),'hex') <> '102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a'
 OR encode(sha256(convert_to(helper,'UTF8')),'hex') <> '233e604a2992be58bcf3b4bd78dd45b51babdcfcaf66c1741343cd5b55ad3f92'
 THEN RAISE EXCEPTION 'C13 aborted: reviewed live RPC definitions changed'; END IF;
 IF (length(original)-length(replace(original,anchor,'')))/length(anchor) <> 1
 THEN RAISE EXCEPTION 'C13 aborted: expected unique workspace anchor missing'; END IF;
 EXECUTE replace(original,anchor,anchor||addition);
END $c13_guard$;
