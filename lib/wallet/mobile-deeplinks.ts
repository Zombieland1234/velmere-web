import { ASCII_CONTROL_OR_BIDI_PATTERN } from "@/lib/security/ascii-control-characters";

export type PendingMobileWallet = "metamask" | "phantom";

const PENDING_KEY = "velmere:pending-mobile-wallet";
const SAFE_LOCALES = new Set(["pl", "en", "de"]);
const SAFE_PUBLIC_WALLET_PATHS = new Set([
  "",
  "/browser",
  "/intelligence",
  "/market-integrity",
  "/real-markets",
  "/search",
  "/shield-map",
  "/shield-pro",
]);
const ENCODED_DANGEROUS = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|e2%80%(?:8e|8f|aa|ab|ac|ad|ae)|e2%81%(?:a6|a7|a8|a9))/iu;

export const PASS36_A102R7_MOBILE_WALLET_DEEPLINK_BOUNDARY_ID =
  "velmere.pass36.a102r7.mobile-wallet-deeplink-boundary.v1" as const;

export type MobileWalletLocationInput = {
  origin: unknown;
  pathname: unknown;
};

function textByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function validLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function resolveSafeOrigin(input: unknown) {
  if (typeof input !== "string" || !input || textByteLength(input) > 512) {
    throw new Error("mobile_wallet_deeplink_origin_invalid");
  }
  if (ASCII_CONTROL_OR_BIDI_PATTERN.test(input) || input.includes("\\")) {
    throw new Error("mobile_wallet_deeplink_origin_invalid");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("mobile_wallet_deeplink_origin_invalid");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("mobile_wallet_deeplink_origin_invalid");
  }
  const localHttp = url.protocol === "http:" && validLocalHostname(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("mobile_wallet_deeplink_protocol_invalid");
  }
  if (url.port && !validLocalHostname(url.hostname)) {
    throw new Error("mobile_wallet_deeplink_port_forbidden");
  }
  return url.origin;
}

function localeFromPath(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return SAFE_LOCALES.has(first) ? first : "en";
}

function resolveSafePublicPath(input: unknown) {
  if (typeof input !== "string" || !input || textByteLength(input) > 1024) {
    return "/en";
  }
  if (
    !input.startsWith("/")
    || input.startsWith("//")
    || input.includes("\\")
    || input.includes("?")
    || input.includes("#")
    || ASCII_CONTROL_OR_BIDI_PATTERN.test(input)
    || ENCODED_DANGEROUS.test(input)
  ) {
    return "/en";
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return "/en";
  }
  if (decoded.includes("\\") || ASCII_CONTROL_OR_BIDI_PATTERN.test(decoded)) {
    return "/en";
  }
  const locale = localeFromPath(decoded);
  const segments = decoded.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0] === locale) return `/${locale}`;
  if (segments.length !== 2 || segments[0] !== locale) return `/${locale}`;
  const suffix = `/${segments[1]}`;
  return SAFE_PUBLIC_WALLET_PATHS.has(suffix) ? `/${locale}${suffix}` : `/${locale}`;
}

export function buildSafeMobileWalletDappUrl(input: MobileWalletLocationInput) {
  const origin = resolveSafeOrigin(input.origin);
  const pathname = resolveSafePublicPath(input.pathname);
  const url = new URL(pathname, `${origin}/`);
  if (url.origin !== origin || url.search || url.hash || url.username || url.password) {
    throw new Error("mobile_wallet_deeplink_target_invalid");
  }
  return url.toString();
}

export function buildMetaMaskMobileDappDeeplink(input: MobileWalletLocationInput) {
  const target = new URL(buildSafeMobileWalletDappUrl(input));
  return `https://link.metamask.io/dapp/${target.host}${target.pathname}`;
}

export function buildPhantomMobileBrowserDeeplink(input: MobileWalletLocationInput) {
  const target = new URL(buildSafeMobileWalletDappUrl(input));
  const dapp = encodeURIComponent(target.toString());
  const ref = encodeURIComponent(target.origin);
  return `https://phantom.app/ul/browse/${dapp}?ref=${ref}`;
}

export function isMobileViewport() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isMetaMaskInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return /MetaMask/i.test(navigator.userAgent);
}

export function isPhantomInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Phantom/i.test(navigator.userAgent) || Boolean((window as Window & { phantom?: unknown }).phantom);
}

export function setPendingMobileWallet(kind: PendingMobileWallet) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, kind);
  } catch {
    // Session storage can be unavailable; retaining no pending wallet fails closed.
  }
}

export function consumePendingMobileWallet(): PendingMobileWallet | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_KEY) as PendingMobileWallet | null;
    window.sessionStorage.removeItem(PENDING_KEY);
    return value === "metamask" || value === "phantom" ? value : null;
  } catch {
    return null;
  }
}

function currentWalletLocation(): MobileWalletLocationInput {
  if (typeof window === "undefined") {
    return { origin: "https://velmere-store.vercel.app", pathname: "/en" };
  }
  return {
    origin: window.location.origin,
    pathname: window.location.pathname,
  };
}

export function openMetaMaskMobileDapp() {
  if (typeof window === "undefined") return;
  setPendingMobileWallet("metamask");
  window.location.assign(buildMetaMaskMobileDappDeeplink(currentWalletLocation()));
}

export function openPhantomMobileBrowser() {
  if (typeof window === "undefined") return;
  setPendingMobileWallet("phantom");
  window.location.assign(buildPhantomMobileBrowserDeeplink(currentWalletLocation()));
}
