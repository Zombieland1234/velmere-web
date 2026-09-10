import { buildSecurityCookie, readUniqueSecurityCookie } from "@/lib/security/cookie-session-boundary";

export const VELMERE_SUPABASE_ACCESS_COOKIE = "velmere_supabase_access" as const;
export const VELMERE_SUPABASE_REFRESH_COOKIE = "velmere_supabase_refresh" as const;


export function readSupabaseAccessTokenCookie(request: Request) {
  return readUniqueSecurityCookie(request, "supabase_access");
}

export function readSupabaseRefreshTokenCookie(request: Request) {
  return readUniqueSecurityCookie(request, "supabase_refresh");
}

export function buildSupabaseAuthCookieHeaders(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}) {
  const rawExpiry = session.expires_in ?? 3600;
  if (!Number.isFinite(rawExpiry) || !Number.isInteger(rawExpiry) || rawExpiry < 90 || rawExpiry > 86_400) {
    throw new Error("supabase_session_expiry_invalid");
  }
  const accessMaxAge = Math.max(60, Math.min(rawExpiry - 30, 3600));
  return [
    buildSecurityCookie({ profile: "supabase_access", value: session.access_token, maxAge: accessMaxAge }),
    buildSecurityCookie({ profile: "supabase_refresh", value: session.refresh_token, maxAge: 60 * 60 * 24 * 30 }),
  ];
}

export function buildClearedSupabaseAuthCookieHeaders() {
  return [
    buildSecurityCookie({ profile: "supabase_access", value: "", maxAge: 0, clear: true }),
    buildSecurityCookie({ profile: "supabase_refresh", value: "", maxAge: 0, clear: true }),
  ];
}

export function appendSetCookieHeaders(headers: Headers, values: readonly string[]) {
  for (const value of values) headers.append("Set-Cookie", value);
  return headers;
}
