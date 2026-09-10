import { ASCII_CONTROL_OR_BIDI_PATTERN } from "./ascii-control-characters";
import {
  resolveVercelPreviewBranchOrigin,
  type VercelPreviewOriginEnvironment,
} from "./vercel-preview-origin";

const CONTROL_OR_BIDI = ASCII_CONTROL_OR_BIDI_PATTERN;
const ENCODED_DANGEROUS = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|e2%80%(?:8e|8f|aa|ab|ac|ad|ae)|e2%81%(?:a6|a7|a8|a9))/iu;
const ENCODED_DANGEROUS_ALLOW_SLASH = /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c|e2%80%(?:8e|8f|aa|ab|ac|ad|ae)|e2%81%(?:a6|a7|a8|a9))/iu;
const LOCALES = new Set(["en", "pl", "de"]);

export const PASS36_A74_NAVIGATION_REDIRECT_BOUNDARY_ID = "velmere.pass36.a74.navigation-redirect-boundary.v1" as const;

export type NavigationRedirectErrorCode =
  | "navigation_value_invalid"
  | "navigation_control_character"
  | "navigation_encoding_invalid"
  | "navigation_absolute_path_required"
  | "navigation_origin_invalid"
  | "navigation_protocol_invalid"
  | "navigation_credentials_forbidden"
  | "navigation_port_forbidden"
  | "navigation_fragment_forbidden"
  | "navigation_path_forbidden"
  | "navigation_query_invalid"
  | "navigation_provider_origin_invalid";

export class NavigationRedirectBoundaryError extends Error {
  readonly code: NavigationRedirectErrorCode;
  constructor(code: NavigationRedirectErrorCode) {
    super(`navigation_redirect_boundary:${code}`);
    this.name = "NavigationRedirectBoundaryError";
    this.code = code;
  }
}

function productionLike() {
  return typeof process !== "undefined" && (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production");
}

function cleanString(value: unknown, maximumBytes = 1024, options: { allowEncodedSlash?: boolean } = {}) {
  if (typeof value !== "string" || !value || new TextEncoder().encode(value).byteLength > maximumBytes) {
    throw new NavigationRedirectBoundaryError("navigation_value_invalid");
  }
  if (CONTROL_OR_BIDI.test(value)) throw new NavigationRedirectBoundaryError("navigation_control_character");
  const pattern = options.allowEncodedSlash ? ENCODED_DANGEROUS_ALLOW_SLASH : ENCODED_DANGEROUS;
  if (value.includes("\\") || pattern.test(value)) {
    throw new NavigationRedirectBoundaryError("navigation_encoding_invalid");
  }
  try {
    decodeURIComponent(value);
  } catch {
    throw new NavigationRedirectBoundaryError("navigation_encoding_invalid");
  }
  return value;
}

function strictOrigin(value: unknown, options: { allowLocalHttp?: boolean; requireRootOnly?: boolean; allowPort?: boolean } = {}) {
  const raw = cleanString(value, 512).trim();
  let url: URL;
  try { url = new URL(raw); } catch { throw new NavigationRedirectBoundaryError("navigation_origin_invalid"); }
  if (url.username || url.password) throw new NavigationRedirectBoundaryError("navigation_credentials_forbidden");
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(options.allowLocalHttp && local && url.protocol === "http:")) {
    throw new NavigationRedirectBoundaryError("navigation_protocol_invalid");
  }
  if (url.port && !options.allowPort) throw new NavigationRedirectBoundaryError("navigation_port_forbidden");
  if (options.requireRootOnly !== false && (url.pathname !== "/" || url.search || url.hash)) {
    throw new NavigationRedirectBoundaryError("navigation_origin_invalid");
  }
  return url.origin;
}

export function resolveCanonicalSiteOrigin(input: {
  requestUrl: string;
  configuredSiteUrl?: string | null;
  production?: boolean;
  environment?: VercelPreviewOriginEnvironment;
}) {
  const environment = input.environment ?? (
    typeof process === "undefined" ? {} : process.env
  );
  const isProduction = environment.VERCEL_ENV === "production"
    || (input.production ?? productionLike());
  const configured = input.configuredSiteUrl?.trim();
  if (configured) return strictOrigin(configured, { allowLocalHttp: !isProduction, requireRootOnly: true, allowPort: !isProduction });
  const previewOrigin = resolveVercelPreviewBranchOrigin(environment);
  if (previewOrigin) return previewOrigin;
  if (environment.VERCEL_ENV === "preview") {
    throw new NavigationRedirectBoundaryError("navigation_origin_invalid");
  }
  if (isProduction) throw new NavigationRedirectBoundaryError("navigation_origin_invalid");
  return strictOrigin(new URL(cleanString(input.requestUrl, 2048)).origin, { allowLocalHttp: true, requireRootOnly: true, allowPort: true });
}

function inspectQuery(url: URL) {
  const rows = Array.from(url.searchParams.entries());
  if (rows.length > 16) throw new NavigationRedirectBoundaryError("navigation_query_invalid");
  let bytes = 0;
  for (const [key, value] of rows) {
    bytes += new TextEncoder().encode(key).byteLength + new TextEncoder().encode(value).byteLength;
    if (!key || key.length > 64 || value.length > 512 || CONTROL_OR_BIDI.test(key) || CONTROL_OR_BIDI.test(value)) {
      throw new NavigationRedirectBoundaryError("navigation_query_invalid");
    }
  }
  if (bytes > 2048) throw new NavigationRedirectBoundaryError("navigation_query_invalid");
}

export type InternalNavigationProfile = "auth_return" | "paid_return" | "locale_navigation";

export function normalizeInternalNavigationPath(input: unknown, options: {
  fallback: string;
  locale?: string;
  profile?: InternalNavigationProfile;
}) {
  const profile = options.profile ?? "locale_navigation";
  const locale = LOCALES.has(options.locale ?? "") ? options.locale! : "en";
  const fallback = typeof options.fallback === "string" ? options.fallback : `/${locale}`;
  let raw: string;
  try { raw = cleanString(input, 3072).trim(); } catch { return fallback; }
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  let url: URL;
  try { url = new URL(raw, "https://velmere.invalid"); } catch { return fallback; }
  if (url.origin !== "https://velmere.invalid" || url.hash) return fallback;
  try { inspectQuery(url); } catch { return fallback; }
  const decodedPath = (() => { try { return decodeURIComponent(url.pathname); } catch { return ""; } })();
  if (!decodedPath || decodedPath.includes("\\") || CONTROL_OR_BIDI.test(decodedPath)) return fallback;
  const first = decodedPath.split("/").filter(Boolean)[0] ?? "";
  if (!LOCALES.has(first)) return fallback;
  if (profile === "auth_return") {
    const allowed = new Set([`/${locale}/account`, `/${locale}/login`, `/${locale}/login?recovery=1`]);
    return allowed.has(`${url.pathname}${url.search}`) ? `${url.pathname}${url.search}` : fallback;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/") || url.pathname.includes("/auth/callback")) return fallback;
  if (profile === "paid_return" && (url.pathname.includes("/checkout/success") || url.pathname.endsWith("/login"))) return fallback;
  return `${url.pathname}${url.search}`.slice(0, 3072);
}

export function buildCanonicalSameOriginUrl(input: {
  path: unknown;
  requestUrl: string;
  configuredSiteUrl?: string | null;
  locale?: string;
  profile?: InternalNavigationProfile;
  fallback?: string;
  production?: boolean;
  environment?: VercelPreviewOriginEnvironment;
}) {
  const origin = resolveCanonicalSiteOrigin(input);
  const fallback = input.fallback ?? `/${LOCALES.has(input.locale ?? "") ? input.locale : "en"}`;
  const path = normalizeInternalNavigationPath(input.path, { fallback, locale: input.locale, profile: input.profile });
  return new URL(path, origin);
}

export type BrowserRedirectProfile = "same_origin" | "stripe_checkout" | "supabase_oauth";

export function assertBrowserRedirectUrl(input: unknown, options: {
  profile: BrowserRedirectProfile;
  browserOrigin: string;
  supabaseOrigin?: string | null;
}) {
  const raw = cleanString(input, 4096, {
    allowEncodedSlash: options.profile === "supabase_oauth" || options.profile === "stripe_checkout",
  }).trim();
  let url: URL;
  try { url = new URL(raw, options.browserOrigin); } catch { throw new NavigationRedirectBoundaryError("navigation_origin_invalid"); }
  if (url.username || url.password) throw new NavigationRedirectBoundaryError("navigation_credentials_forbidden");
  if (options.profile === "same_origin") {
    if (url.hash) throw new NavigationRedirectBoundaryError("navigation_fragment_forbidden");
    const expected = strictOrigin(options.browserOrigin, { allowLocalHttp: true, requireRootOnly: true, allowPort: true });
    if (url.origin !== expected) throw new NavigationRedirectBoundaryError("navigation_origin_invalid");
    return url.toString();
  }
  if (url.protocol !== "https:") throw new NavigationRedirectBoundaryError("navigation_protocol_invalid");
  if (options.profile === "stripe_checkout") {
    if (url.port) throw new NavigationRedirectBoundaryError("navigation_port_forbidden");
    if (url.hash && (url.hash.length > 2048 || CONTROL_OR_BIDI.test(url.hash))) throw new NavigationRedirectBoundaryError("navigation_fragment_forbidden");
    if (url.hostname !== "checkout.stripe.com") throw new NavigationRedirectBoundaryError("navigation_provider_origin_invalid");
    if (!url.pathname.startsWith("/c/pay/") && !url.pathname.startsWith("/pay/") && url.pathname !== "/") {
      throw new NavigationRedirectBoundaryError("navigation_path_forbidden");
    }
    return url.toString();
  }
  if (url.hash) throw new NavigationRedirectBoundaryError("navigation_fragment_forbidden");
  const expectedSupabase = strictOrigin(options.supabaseOrigin, { allowLocalHttp: !productionLike(), requireRootOnly: true, allowPort: !productionLike() });
  if (url.origin !== expectedSupabase) throw new NavigationRedirectBoundaryError("navigation_provider_origin_invalid");
  if (url.pathname !== "/auth/v1/authorize") throw new NavigationRedirectBoundaryError("navigation_path_forbidden");
  return url.toString();
}

export function assertCheckoutRedirectUrl(input: unknown, browserOrigin: string) {
  try { return assertBrowserRedirectUrl(input, { profile: "same_origin", browserOrigin }); }
  catch (sameOriginError) {
    try { return assertBrowserRedirectUrl(input, { profile: "stripe_checkout", browserOrigin }); }
    catch { throw sameOriginError; }
  }
}
