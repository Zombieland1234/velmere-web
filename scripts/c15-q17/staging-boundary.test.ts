import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateSupabaseStagingBoundary, type SupabaseStagingEnvironment } from "../../lib/db/supabase-staging-boundary";
const ref = "abcdefghijklmnopqrst";
const origin = `https://${ref}.supabase.co`;
const valid: SupabaseStagingEnvironment = {
  VELMERE_DEPLOYMENT_ENV: "staging", VELMERE_STAGING_SUPABASE_PROJECT_REF: ref,
  NEXT_PUBLIC_SUPABASE_URL: origin,
};
const cases: Array<[string, SupabaseStagingEnvironment, boolean, string]> = [
  ["unconfigured legacy", {}, true, "not_staging"],
  ["production legacy", {VELMERE_DEPLOYMENT_ENV:"production"}, true, "not_staging"],
  ["staging pin", valid, true, "bound"],
  ["explicit matching service", {...valid, SUPABASE_URL:origin}, true, "bound"],
  ["one trailing slash", {...valid, SUPABASE_URL:origin+"/", NEXT_PUBLIC_SUPABASE_URL:origin+"/"}, true, "bound"],
  ["optimized production NODE_ENV is not production deployment", {...valid, NODE_ENV:"production",VERCEL_ENV:"preview"}, true,"bound"],
  ["missing pin", {...valid, VELMERE_STAGING_SUPABASE_PROJECT_REF:undefined},false,"project_ref_required"],
  ["empty pin", {...valid, VELMERE_STAGING_SUPABASE_PROJECT_REF:""},false,"project_ref_required"],
  ["short pin", {...valid, VELMERE_STAGING_SUPABASE_PROJECT_REF:ref.slice(1)},false,"project_ref_required"],
  ["uppercase pin", {...valid, VELMERE_STAGING_SUPABASE_PROJECT_REF:ref.toUpperCase()},false,"project_ref_required"],
  ["pin without staging", {...valid, VELMERE_DEPLOYMENT_ENV:undefined},false,"staging_mode_required"],
  ["pin in production", {...valid, VELMERE_DEPLOYMENT_ENV:"production"},false,"staging_mode_required"],
  ["misspelled mode", {...valid, VELMERE_DEPLOYMENT_ENV:"stagign"},false,"invalid_environment"],
  ["empty mode", {...valid, VELMERE_DEPLOYMENT_ENV:""},false,"invalid_environment"],
  ["production deployment", {...valid, VERCEL_ENV:"production"},false,"production_deployment"],
  ["missing public", {...valid, NEXT_PUBLIC_SUPABASE_URL:undefined},false,"public_origin_mismatch"],
  ["split service origin", {...valid, SUPABASE_URL:"https://zyxwvutsrqponmlkjihg.supabase.co"},false,"service_origin_mismatch"],
  ["empty service is not fallback", {...valid, SUPABASE_URL:""},false,"service_origin_mismatch"],
  ["service whitespace", {...valid, SUPABASE_URL:origin+" "},false,"service_origin_mismatch"],
];
for (const suffix of ["?ref=other", "#other", "/rest/v1", "/../", ":443", ".example.invalid", "//", " "]) {
  cases.push([`noncanonical origin ${JSON.stringify(suffix)}`, {...valid, NEXT_PUBLIC_SUPABASE_URL:origin+suffix},false,"public_origin_mismatch"]);
}
for (const url of [origin.replace("https:","http:"),origin.replace("https://","https://user:password@"),origin.replace(ref,ref.toUpperCase()),"http://127.0.0.1:54321","https://staging.example.invalid"]) {
  cases.push([`unbound origin ${url}`, {...valid,NEXT_PUBLIC_SUPABASE_URL:url},false,"public_origin_mismatch"]);
}
for (const [name, env, allowed, reason] of cases) test(name, () => {
  const result = evaluateSupabaseStagingBoundary(env);
  assert.equal(result.allowed, allowed);assert.equal(result.reason,reason);
  assert.deepEqual(Object.keys(result).sort(),["allowed","reason","scope"]);
});
test("decision never returns supplied credentials or foreign URLs", () => {
  const result = evaluateSupabaseStagingBoundary({...valid,SUPABASE_URL:"https://private.invalid",SUPABASE_SERVICE_ROLE_KEY:"DO_NOT_LOG_ME"});
  assert.equal(JSON.stringify(result).includes("DO_NOT_LOG_ME"),false);
  assert.equal(JSON.stringify(result).includes("private.invalid"),false);
});
