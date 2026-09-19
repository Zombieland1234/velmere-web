import assert from "node:assert/strict";
import { test } from "node:test";
import { getSupabasePublicClient, getSupabaseServiceRoleClient, getSupabaseUserClientForRequest } from "../../lib/db/supabase";
import { getSupabaseRuntimeCapabilities } from "../../lib/db/supabase-config";
import { getSupabaseServiceRestConfig } from "../../lib/db/supabase-service-rest";
import { supabaseAuthSessionDependencies } from "../../lib/auth/supabase-auth-session";
import { supabaseAuthFlowDependencies } from "../../lib/auth/supabase-auth-flow";
const ref = "abcdefghijklmnopqrst";
const other = "zyxwvutsrqponmlkjihg";
const url = (r: string) => `https://${r}.supabase.co`;
const token = "AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB.CCCCCCCCCCCCCCCC";
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const keys = ["VELMERE_DEPLOYMENT_ENV","VELMERE_STAGING_SUPABASE_PROJECT_REF","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","VERCEL_ENV"] as const;
function fixture(fn: () => void) {
  const saved = Object.fromEntries(keys.map(key => [key,process.env[key]]));
  const fetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected network in client construction test"); };
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    VELMERE_DEPLOYMENT_ENV:"staging",VELMERE_STAGING_SUPABASE_PROJECT_REF:ref,
    NEXT_PUBLIC_SUPABASE_URL:url(ref),NEXT_PUBLIC_SUPABASE_ANON_KEY:"synthetic-anon-fixture",
    SUPABASE_SERVICE_ROLE_KEY:"synthetic-service-fixture",
  });
  try { fn(); assert.equal(calls,0); }
  finally {
    globalThis.fetch = fetch;
    for (const key of keys) { const value=saved[key];if(value===undefined)delete process.env[key];else process.env[key]=value; }
  }
}
const request = () => new Request("http://localhost/fixture",{headers:{authorization:`Bearer ${token}`}});
test("bound config permits SDK, Auth, flow and service REST construction without network", () => fixture(() => {
  assert.ok(getSupabasePublicClient());assert.ok(getSupabaseServiceRoleClient());
  assert.equal(getSupabaseUserClientForRequest(request()).state,"ready");
  assert.ok(supabaseAuthSessionDependencies.createAuthClient());
  assert.ok(supabaseAuthFlowDependencies.createFlowClient(storage));
  assert.equal(getSupabaseServiceRestConfig()?.baseUrl,url(ref));
}));
for (const fault of ["different-service","different-public","missing-pin","wrong-mode","production"] as const) {
  test(`all six boundaries refuse ${fault} including warm caches`, () => fixture(() => {
    assert.ok(getSupabasePublicClient());assert.ok(getSupabaseServiceRoleClient());
    if(fault==="different-service")process.env.SUPABASE_URL=url(other);
    if(fault==="different-public")process.env.NEXT_PUBLIC_SUPABASE_URL=url(other);
    if(fault==="missing-pin")delete process.env.VELMERE_STAGING_SUPABASE_PROJECT_REF;
    if(fault==="wrong-mode")process.env.VELMERE_DEPLOYMENT_ENV="production";
    if(fault==="production")process.env.VERCEL_ENV="production";
    assert.equal(getSupabasePublicClient(),null);assert.equal(getSupabaseServiceRoleClient(),null);
    const user=getSupabaseUserClientForRequest(request());assert.equal(user.client,null);assert.equal(user.rlsEnforced,false);
    assert.equal(supabaseAuthSessionDependencies.createAuthClient(),null);
    assert.equal(supabaseAuthFlowDependencies.createFlowClient(storage),null);
    assert.equal(getSupabaseServiceRestConfig(),null);
    const capability=getSupabaseRuntimeCapabilities();assert.equal(capability.publicReadConfigured,false);assert.equal(capability.serviceRoleWriteConfigured,false);
  }));
}
test("same config reuses each cache, never shares public with service", () => fixture(() => {
  const publicClient=getSupabasePublicClient(), service=getSupabaseServiceRoleClient();
  assert.equal(publicClient,getSupabasePublicClient());assert.equal(service,getSupabaseServiceRoleClient());assert.notEqual(publicClient,service);
}));
test("new pin and URLs construct new clients rather than returning prior project", () => fixture(() => {
  const a=getSupabasePublicClient(), b=getSupabaseServiceRoleClient();
  process.env.VELMERE_STAGING_SUPABASE_PROJECT_REF=other;process.env.NEXT_PUBLIC_SUPABASE_URL=url(other);
  const a2=getSupabasePublicClient(),b2=getSupabaseServiceRoleClient();
  assert.ok(a2);assert.ok(b2);assert.notEqual(a2,a);assert.notEqual(b2,b);
  assert.equal(getSupabaseServiceRestConfig()?.baseUrl,url(other));
}));
test("key rotation invalidates the affected cached client", () => fixture(() => {
  const a=getSupabasePublicClient(),b=getSupabaseServiceRoleClient();
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="rotated-synthetic-anon";
  assert.notEqual(a,getSupabasePublicClient());assert.equal(b,getSupabaseServiceRoleClient());
  process.env.SUPABASE_SERVICE_ROLE_KEY="rotated-synthetic-service";
  assert.notEqual(b,getSupabaseServiceRoleClient());
}));
test("removed credentials refuse cached authority and restored config rebuilds", () => fixture(() => {
  const a=getSupabasePublicClient(),b=getSupabaseServiceRoleClient();
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(getSupabasePublicClient(),null);assert.equal(getSupabaseServiceRoleClient(),null);
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-anon-fixture";process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-service-fixture";
  assert.ok(getSupabasePublicClient());assert.notEqual(getSupabasePublicClient(),a);
  assert.ok(getSupabaseServiceRoleClient());assert.notEqual(getSupabaseServiceRoleClient(),b);
}));
test("missing config followed by complete config is not permanently cached null", () => fixture(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(getSupabasePublicClient(),null);assert.equal(getSupabaseServiceRoleClient(),null);
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-anon-fixture";process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-service-fixture";
  assert.ok(getSupabasePublicClient());assert.ok(getSupabaseServiceRoleClient());
}));
