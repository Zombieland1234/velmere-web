import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseAccessTokenCookie } from "@/lib/auth/supabase-auth-cookies";
import {
  getSupabaseRuntimeCapabilities,
  hasSupabaseConfig,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
  type SupabaseRuntimeCapabilities,
} from "@/lib/db/supabase-config";

export {
  getSupabaseRuntimeCapabilities,
  hasSupabaseConfig,
  hasSupabasePublicConfig,
  hasSupabaseServiceRoleConfig,
  type SupabaseRuntimeCapabilities,
};

export type VelmereDatabase = Record<string, never>;

let cachedServerClient: SupabaseClient | null | undefined;
let cachedServiceRoleClient: SupabaseClient | null | undefined;

function createServerClient(
  url: string | undefined,
  key: string | undefined,
  options?: { accessToken?: string },
) {
  return url && key
    ? createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: options?.accessToken
          ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
          : undefined,
      })
    : null;
}

/** Public/anon client for read-only or explicitly RLS-governed paths. */
export function getSupabasePublicClient() {
  if (cachedServerClient !== undefined) return cachedServerClient;
  cachedServerClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return cachedServerClient;
}

/** @deprecated Use getSupabasePublicClient() or getSupabaseServiceRoleClient() explicitly. */
export function getSupabaseServerClient() {
  return getSupabasePublicClient();
}

/** Service-role-only client for payment, entitlement and other durable writes. */
export function getSupabaseServiceRoleClient() {
  if (cachedServiceRoleClient !== undefined) return cachedServiceRoleClient;
  cachedServiceRoleClient = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return cachedServiceRoleClient;
}

const SUPABASE_JWT_PATTERN = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

export type SupabaseUserClientResolution = {
  schemaVersion: "velmere.supabase-user-client.v2";
  client: SupabaseClient | null;
  state: "ready" | "missing_token" | "invalid_token" | "missing_public_config";
  tokenSource: "authorization" | "http_only_cookie" | null;
  rlsEnforced: boolean;
  serviceRoleUsed: false;
};

/**
 * Extracts a bounded JWT-shaped bearer token. Signature/expiry verification is delegated
 * to Supabase/PostgREST; this helper never decodes claims and never falls back to service-role.
 */
export function extractSupabaseUserAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token || token.length > 4096 || !SUPABASE_JWT_PATTERN.test(token)) return null;
    return { token, source: "authorization" as const };
  }
  const cookieToken = readSupabaseAccessTokenCookie(request);
  if (!cookieToken || cookieToken.length > 4096 || !SUPABASE_JWT_PATTERN.test(cookieToken)) return null;
  return { token: cookieToken, source: "http_only_cookie" as const };
}

/** Per-request, non-cached user client. It can only use the anon key plus the caller JWT. */
export function getSupabaseUserClientForRequest(request: Request): SupabaseUserClientResolution {
  const tokenResolution = extractSupabaseUserAccessToken(request);
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const cookieToken = readSupabaseAccessTokenCookie(request);
  if (!authorization && !cookieToken) {
    return {
      schemaVersion: "velmere.supabase-user-client.v2",
      client: null,
      state: "missing_token",
      tokenSource: null,
      rlsEnforced: false,
      serviceRoleUsed: false,
    };
  }
  if (!tokenResolution) {
    return {
      schemaVersion: "velmere.supabase-user-client.v2",
      client: null,
      state: "invalid_token",
      tokenSource: authorization ? "authorization" : "http_only_cookie",
      rlsEnforced: false,
      serviceRoleUsed: false,
    };
  }
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { accessToken: tokenResolution.token },
  );
  return {
    schemaVersion: "velmere.supabase-user-client.v2",
    client,
    state: client ? "ready" : "missing_public_config",
    tokenSource: tokenResolution.source,
    rlsEnforced: Boolean(client),
    serviceRoleUsed: false,
  };
}

