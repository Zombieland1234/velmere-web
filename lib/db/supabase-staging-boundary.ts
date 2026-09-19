/** Configuration boundary only: this does not prove project ownership or provision it. */
export type SupabaseStagingEnvironment = Readonly<Record<string, string | undefined>>;
export type SupabaseStagingDecision = {
  allowed: boolean;
  scope: "staging" | "legacy";
  reason: "not_staging" | "bound" | "invalid_environment" | "staging_mode_required"
    | "project_ref_required" | "production_deployment" | "public_origin_mismatch"
    | "service_origin_mismatch";
};

/**
 * A staging process must explicitly pin one hosted project for every Supabase
 * client. Refuse aliases, URL normalization surprises and split Auth/DB origins.
 * Only non-secret decision codes leave this function. Existing deployments with
 * neither staging variable keep their established configuration semantics.
 */
export function evaluateSupabaseStagingBoundary(
  env: SupabaseStagingEnvironment = process.env,
): SupabaseStagingDecision {
  const mode = env.VELMERE_DEPLOYMENT_ENV;
  const ref = env.VELMERE_STAGING_SUPABASE_PROJECT_REF;
  const deny = (reason: SupabaseStagingDecision["reason"]): SupabaseStagingDecision =>
    ({ allowed: false, scope: "staging", reason });
  if (mode !== undefined && !["staging", "production", "development", "test", "preview"].includes(mode)) {
    return deny("invalid_environment");
  }
  if (mode !== "staging") {
    return ref !== undefined ? deny("staging_mode_required")
      : { allowed: true, scope: "legacy", reason: "not_staging" };
  }
  if (!ref || !/^[a-z]{20}$/.test(ref)) return deny("project_ref_required");
  if (env.VERCEL_ENV === "production") return deny("production_deployment");
  const origin = `https://${ref}.supabase.co`;
  const matches = (value: string | undefined) => value === origin || value === `${origin}/`;
  if (!matches(env.NEXT_PUBLIC_SUPABASE_URL)) return deny("public_origin_mismatch");
  if (env.SUPABASE_URL !== undefined && !matches(env.SUPABASE_URL)) return deny("service_origin_mismatch");
  return { allowed: true, scope: "staging", reason: "bound" };
}
