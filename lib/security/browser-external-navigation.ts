import { ASCII_CONTROL_OR_BIDI_PATTERN } from "@/lib/security/ascii-control-characters";

const CONTROL_OR_BIDI = ASCII_CONTROL_OR_BIDI_PATTERN;
const ENCODED_DANGEROUS = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|e2%80%(?:8e|8f|aa|ab|ac|ad|ae)|e2%81%(?:a6|a7|a8|a9))/iu;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/u;
const SENSITIVE_QUERY_KEY = /(?:^|[_-])(?:token|secret|session|code|state|auth|account|email|address|receipt|download|return|redirect)(?:$|[_-])/iu;

export const PASS36_A102R10_EXTERNAL_NAVIGATION_BOUNDARY_ID =
  "velmere.pass36.a102r10.external-navigation-boundary.v1" as const;

export type SafeExternalNavigationProfile =
  | "wallet_install"
  | "sec_filing"
  | "external_product";

export type SafeExternalNavigationDecision = {
  schemaVersion: "velmere.safe-external-navigation.v1";
  profile: SafeExternalNavigationProfile;
  allowed: boolean;
  normalizedUrl: string | null;
  host: string | null;
  blockedReasons: string[];
  strippedQuery: boolean;
  strippedFragment: boolean;
  referrerPolicy: "no-referrer";
  openerPolicy: "noopener+noreferrer+explicit-opener-null";
};

const WALLET_INSTALL_PATHS = new Map<string, RegExp>([
  ["metamask.io", /^\/download\/?$/u],
  ["phantom.app", /^\/download\/?$/u],
  ["trustwallet.com", /^\/?$/u],
  ["www.coinbase.com", /^\/wallet\/downloads\/?$/u],
  ["rainbow.me", /^\/?$/u],
  ["www.okx.com", /^\/web3\/?$/u],
  ["www.ledger.com", /^\/ledger-live\/?$/u],
  ["app.safe.global", /^\/?$/u],
  ["zerion.io", /^\/?$/u],
  ["walletconnect.com", /^\/?$/u],
]);

function cleanInput(value: unknown, maximumBytes = 4096): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || new TextEncoder().encode(trimmed).byteLength > maximumBytes) return null;
  if (CONTROL_OR_BIDI.test(trimmed) || trimmed.includes("\\") || ENCODED_DANGEROUS.test(trimmed)) return null;
  try {
    decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  return trimmed;
}

function normalizeHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/u, "");
  if (!host || host.length > 253 || host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return null;
  if (host === "127.0.0.1" || host === "[::1]" || host === "::1" || IPV4.test(host) || host.includes(":")) return null;
  const labels = host.split(".");
  if (labels.length < 2 || labels.some((label) => !HOST_LABEL.test(label))) return null;
  return host;
}

export function parseAllowedExternalHosts(value: unknown): Set<string> {
  if (typeof value !== "string") return new Set();
  const hosts = new Set<string>();
  for (const row of value.split(",")) {
    const host = normalizeHost(row.trim());
    if (host) hosts.add(host);
  }
  return hosts;
}

function baseUrlDecision(input: unknown) {
  const blockedReasons: string[] = [];
  const raw = cleanInput(input);
  if (!raw) return { url: null as URL | null, host: null as string | null, blockedReasons: ["invalid_or_unsafe_string"] };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: null as URL | null, host: null as string | null, blockedReasons: ["absolute_url_required"] };
  }
  if (url.protocol !== "https:") blockedReasons.push("https_required");
  if (url.username || url.password) blockedReasons.push("credentials_forbidden");
  if (url.port) blockedReasons.push("port_forbidden");
  const host = normalizeHost(url.hostname);
  if (!host) blockedReasons.push("public_dns_host_required");
  if (url.pathname.length > 2048 || CONTROL_OR_BIDI.test(url.pathname)) blockedReasons.push("path_invalid");
  return { url, host, blockedReasons };
}

function queryIsSafe(url: URL): boolean {
  if (Array.from(url.searchParams).length > 16) return false;
  let bytes = 0;
  for (const [key, value] of url.searchParams.entries()) {
    bytes += new TextEncoder().encode(key).byteLength + new TextEncoder().encode(value).byteLength;
    if (!key || key.length > 64 || value.length > 512 || CONTROL_OR_BIDI.test(key) || CONTROL_OR_BIDI.test(value) || SENSITIVE_QUERY_KEY.test(key)) {
      return false;
    }
  }
  return bytes <= 2048;
}

export function buildSafeExternalNavigationDecision(
  input: unknown,
  options: {
    profile: SafeExternalNavigationProfile;
    allowedHosts?: ReadonlySet<string>;
    stripQueryAndFragment?: boolean;
  },
): SafeExternalNavigationDecision {
  const { url, host, blockedReasons } = baseUrlDecision(input);
  let strippedQuery = false;
  let strippedFragment = false;

  if (url && host) {
    if (options.profile === "wallet_install") {
      const allowedPath = WALLET_INSTALL_PATHS.get(host);
      if (!allowedPath || !allowedPath.test(url.pathname)) blockedReasons.push("wallet_destination_not_allowlisted");
      if (url.search) blockedReasons.push("wallet_query_forbidden");
      if (url.hash) blockedReasons.push("wallet_fragment_forbidden");
    } else if (options.profile === "sec_filing") {
      if (host !== "www.sec.gov") blockedReasons.push("sec_host_required");
      if (!/^\/Archives\/edgar\/data\/\d+\/\d+\/?$/u.test(url.pathname)) blockedReasons.push("sec_archive_path_required");
      if (url.search) blockedReasons.push("sec_query_forbidden");
      if (url.hash) blockedReasons.push("sec_fragment_forbidden");
    } else {
      const allowedHosts = options.allowedHosts;
      if (allowedHosts && (!allowedHosts.size || !allowedHosts.has(host))) blockedReasons.push("product_host_not_allowlisted");
      if (!queryIsSafe(url)) blockedReasons.push("product_query_invalid");
      if (options.stripQueryAndFragment !== false) {
        strippedQuery = Boolean(url.search);
        strippedFragment = Boolean(url.hash);
        url.search = "";
        url.hash = "";
      } else if (url.hash) {
        blockedReasons.push("product_fragment_forbidden");
      }
    }
  }

  return {
    schemaVersion: "velmere.safe-external-navigation.v1",
    profile: options.profile,
    allowed: Boolean(url && host && blockedReasons.length === 0),
    normalizedUrl: url && host && blockedReasons.length === 0 ? url.toString() : null,
    host,
    blockedReasons,
    strippedQuery,
    strippedFragment,
    referrerPolicy: "no-referrer",
    openerPolicy: "noopener+noreferrer+explicit-opener-null",
  };
}

export function normalizeExternalProductUrl(input: unknown, allowedHosts?: ReadonlySet<string>): string | null {
  return buildSafeExternalNavigationDecision(input, {
    profile: "external_product",
    allowedHosts,
    stripQueryAndFragment: true,
  }).normalizedUrl;
}

export function normalizeSafeExternalBrowserUrl(
  input: unknown,
  options: { profile: SafeExternalNavigationProfile; allowedHosts?: ReadonlySet<string> },
): string | null {
  return buildSafeExternalNavigationDecision(input, {
    profile: options.profile,
    allowedHosts: options.allowedHosts,
    stripQueryAndFragment: options.profile === "external_product",
  }).normalizedUrl;
}

export function openSafeExternalBrowserWindow(
  input: unknown,
  options: { profile: SafeExternalNavigationProfile; allowedHosts?: ReadonlySet<string> },
): boolean {
  if (typeof window === "undefined") return false;
  const safeUrl = normalizeSafeExternalBrowserUrl(input, options);
  if (!safeUrl) return false;
  const opened = window.open(safeUrl, "_blank", "noopener,noreferrer");
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    // Browser feature flags already requested noopener/noreferrer; explicit null is best-effort defense in depth.
  }
  return true;
}
