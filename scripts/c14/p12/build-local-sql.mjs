import fs from 'node:fs';
import crypto from 'node:crypto';

const fixture = fs.readFileSync('scripts/c14/p12/auth-http-fixture.sql','utf8');
const marker = '-- Current Shield fixture using actual C13 source is appended by the workflow.';
if (!fixture.includes(marker)) throw new Error('fixture marker missing');
const [before, after] = fixture.split(marker);
const migration = fs.readFileSync('supabase/migrations/20260917043048_velmere_c6d_shield_session_and_null_validation.sql','utf8');
const helperStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.velmere_r7_shield_pro_has_paid_entitlement_v1');
const helperEnd = migration.indexOf('DO $workspace_patch$');
if (helperStart < 0 || helperEnd < 0) throw new Error('C13 entitlement helper source missing');
const helper = migration.slice(helperStart, helperEnd).trim();
const workspaceRaw = fs.readFileSync('scripts/c13/fixtures/shield-workspace-live-before.sql','utf8');
const workspaceSha = crypto.createHash('sha256').update(workspaceRaw).digest('hex');
if (workspaceSha !== '102115ac57049f2c588179da665ad238da258a9f9ba128c3c7cd3490ee7af42a') {
  throw new Error(`captured Shield workspace source changed: ${workspaceSha}`);
}
const workspace = workspaceRaw.trim();
const guard = fs.readFileSync('scripts/c13/shield-workspace-guard.sql','utf8').trim();
const shieldFixture = `
CREATE TABLE IF NOT EXISTS velmere_private.r7_shield_pro_paid_entitlement_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entitlement_ref uuid NOT NULL,
 account_id uuid NOT NULL,tier text NOT NULL,event_kind text NOT NULL,
 authority text NOT NULL DEFAULT 'C14_P12_LOCAL_HTTP',expires_at timestamptz,
 evidence jsonb NOT NULL DEFAULT '{}',recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS velmere_private.r7_shield_pro_paid_workspace_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,workspace_id uuid NOT NULL,
 account_id uuid NOT NULL,tier text NOT NULL,locale text NOT NULL,event_kind text NOT NULL,
 e2e_run_id text,payload jsonb NOT NULL,payload_digest_sha256 text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.velmere_risk_history_events(
 asset_id text,observed_at timestamptz,publication_state text,customer_publishable boolean);
CREATE OR REPLACE FUNCTION public.velmere_read_public_risk_history_by_asset_v1(text,integer,text)
RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('resolution','RESOLVED','canonicalAssetId',$1,'events',jsonb_build_array(jsonb_build_object('fixture',1),jsonb_build_object('fixture',2)))
$$;
INSERT INTO public.velmere_risk_history_events
SELECT 'p12-fixture-'||a,now(),'PUBLIC',true FROM generate_series(1,6)a CROSS JOIN generate_series(1,2)b;

${helper};
${workspace};
REVOKE ALL ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.velmere_r7_shield_pro_paid_workspace_v1(text,text,text,uuid), public.velmere_r7_shield_pro_has_paid_entitlement_v1(text) TO authenticated;
${guard}
`;
const output = `${before}\n${shieldFixture}\n${after}`;
const target = process.argv[2] ?? '/tmp/c14-p12-local-fixture.sql';
fs.writeFileSync(target, output);
console.log(JSON.stringify({target, bytes:Buffer.byteLength(output), workspaceSha, source:'actual C13 captured Shield + C14-P12 auth fixture'}, null, 2));
