import { randomBytes } from "node:crypto";

const devConnect = " http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*";
const prodUpgrade = "upgrade-insecure-requests";
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

/** @returns {string} */
export function createCspNonce() {
  return randomBytes(16).toString("base64url");
}

function normalizeNonce(value) {
  const nonce = typeof value === "string" ? value.trim() : "";
  const bytes = NONCE_PATTERN.test(nonce) ? Buffer.from(nonce, "base64url") : Buffer.alloc(0);
  const canonical = bytes.length > 0 ? bytes.toString("base64url") : "";
  if (canonical !== nonce || bytes.length < 16 || bytes.length > 96) {
    throw new TypeError("csp_nonce_must_be_canonical_base64url_with_at_least_16_bytes");
  }
  return nonce;
}

function buildExecutableDirectives({ isDev, mode, nonce }) {
  if (mode === "strict-nonce") {
    const trustedNonce = normalizeNonce(nonce);
    return {
      script: `script-src 'self' 'nonce-${trustedNonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
      // Inline style attributes are currently used throughout the frozen visual surface.
      // Removing this token requires a separately tested style migration.
      style: "style-src 'self' 'unsafe-inline'",
      strictNonce: trustedNonce,
    };
  }

  if (mode !== "static-compat") {
    throw new TypeError("unsupported_csp_mode");
  }

  return {
    // Next.js emits inline bootstrap/style elements for statically configured headers.
    // This compatibility lane remains explicit until a request-scoped nonce is wired.
    script: `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
    style: "style-src 'self' 'unsafe-inline'",
    strictNonce: null,
  };
}

/**
 * @param {{isDev?: boolean, mode?: "static-compat" | "strict-nonce", nonce?: string, upgradeInsecureRequests?: boolean}} [options]
 */
export function buildContentSecurityPolicy({
  isDev = false,
  mode = "static-compat",
  nonce,
  upgradeInsecureRequests = !isDev,
} = {}) {
  const executable = buildExecutableDirectives({ isDev, mode, nonce });
  return [
    "default-src 'self'",
    executable.script,
    "script-src-attr 'none'",
    executable.style,
    [
      "img-src 'self' data: blob:",
      "https://assets.coingecko.com",
      "https://coin-images.coingecko.com",
      "https://static.coingecko.com",
      "https://dd.dexscreener.com",
      "https://cdn.dexscreener.com",
      "https://images.unsplash.com",
      "https://s2.coinmarketcap.com",
      "https://raw.githubusercontent.com",
      "https://tokens.1inch.io",
    ].join(" "),
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      "https://generativelanguage.googleapis.com",
      "https://api.stripe.com",
      "https://api.printful.com",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://relay.walletconnect.com",
      "wss://relay.walletconnect.com",
      "https://explorer-api.walletconnect.com",
      "https://eth.merkle.io",
      "https://11155111.rpc.thirdweb.com",
      "https://mainnet.base.org",
      "https://polygon.drpc.org",
      isDev ? devConnect : "",
    ].filter(Boolean).join(" "),
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "block-all-mixed-content",
    "report-uri /api/security/csp-report",
    ...(upgradeInsecureRequests ? [prodUpgrade] : []),
  ].join("; ");
}

/**
 * @param {{isDev?: boolean, mode?: "static-compat" | "strict-nonce", nonce?: string, includeContentSecurityPolicy?: boolean}} [options]
 */
export function buildSecurityHeaders({
  isDev = false,
  mode = "static-compat",
  nonce,
  includeContentSecurityPolicy = true,
} = {}) {
  return [
    ...(includeContentSecurityPolicy
      ? [{ key: "Content-Security-Policy", value: buildContentSecurityPolicy({ isDev, mode, nonce }) }]
      : []),
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self), picture-in-picture=(self), publickey-credentials-get=(self), usb=(), clipboard-read=(), clipboard-write=(self)" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Origin-Agent-Cluster", value: "?1" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
}

export function buildStrictNonceSecurityHeaders({ nonce, isDev = false } = {}) {
  return buildSecurityHeaders({ isDev, mode: "strict-nonce", nonce });
}

export function buildSecurityReadinessSnapshot() {
  return {
    schemaVersion: "velmere-security-readiness-v1",
    mode: "security_headers_api_guard_preview",
    generatedAt: new Date().toISOString(),
    implemented: [
      "Content-Security-Policy",
      "HSTS",
      "frame deny",
      "nosniff",
      "referrer policy",
      "permissions policy",
      "COOP",
      "CORP",
      "origin agent cluster",
      "DNS prefetch off",
      "cross-domain policy none",
      "CSP strict nonce policy builder",
      "CSP cryptographically secure 128-bit nonce generator",
      "request-scoped CSP nonce runtime wiring for rendered document routes",
      "production script CSP without unsafe-inline or unsafe-eval",
      "CSP inline event attributes denied",
      "API JSON no-store helper",
      "API method/query/rate-limit guard",
      "token icon SSRF/content-type/size guard",
    ],
    notImplemented: [
      "full WAF",
      "bot management",
      "durable distributed rate-limit store",
      "penetration test",
      "inline style migration compatible with the frozen visual surface",
      "production SIEM",
    ],
    boundary:
      "Rendered document routes use a fresh request-scoped nonce and a strict production script policy. Inline styles remain in the explicitly identified compatibility lane to preserve the frozen visual surface. Security hardening reduces common web risk but is not a guarantee. Production still needs secret review, dependency scanning, provider settings and real browser/security testing.",
  };
}
