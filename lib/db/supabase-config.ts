export function hasSupabasePublicConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasSupabaseServiceRoleConfig() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export type SupabaseRuntimeCapabilities = {
  publicReadConfigured: boolean;
  serviceRoleWriteConfigured: boolean;
  userRlsClientPrepared: true;
  serviceUrlSource: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "missing";
};

export function getSupabaseRuntimeCapabilities(): SupabaseRuntimeCapabilities {
  return {
    publicReadConfigured: hasSupabasePublicConfig(),
    serviceRoleWriteConfigured: hasSupabaseServiceRoleConfig(),
    userRlsClientPrepared: true,
    serviceUrlSource: process.env.SUPABASE_URL
      ? "SUPABASE_URL"
      : process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "NEXT_PUBLIC_SUPABASE_URL"
        : "missing",
  };
}

/** Compatibility signal only. Do not use this for server-side write capability. */
export function hasSupabaseConfig() {
  return hasSupabaseServiceRoleConfig() || hasSupabasePublicConfig();
}
