import createMiddleware from "next-intl/middleware";
import { routing } from "./routing";
import { NextRequest, NextResponse } from "next/server";
import { evaluatePass4658ControlPlaneBoundary, PASS4658_CONTROL_PLANE_BOUNDARY_ID } from "./lib/security/control-plane-boundary";
import { pass4659ApiSurfaceHeaders } from "./lib/security/api-surface-registry";
import { buildContentSecurityPolicy, createCspNonce } from "./lib/security/http-security.mjs";
import {
  hasForbiddenRequestPathCharacter,
  inspectApiEdgeRequest,
  resolveCanonicalRequestOrigins,
} from "./lib/security/api-edge-boundary";

const intlMiddleware = createMiddleware(routing);
const isDev = process.env.NODE_ENV !== "production";
const LOOPBACK_HTTP_BROWSER_PROOF_ENV = "VELMERE_LOOPBACK_HTTP_BROWSER_PROOF";
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

function parseLoopbackHostHeader(value: string | null) {
  if (!value || /[\s/@\\]/u.test(value)) return null;
  try {
    const parsed = new URL(`http://${value}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      !LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())
    ) return null;
    return { hostname: parsed.hostname.toLowerCase(), port: parsed.port };
  } catch {
    return null;
  }
}

const PUBLIC_ASSET_PREFIXES = Object.freeze([
  "/fonts/",
  "/images/",
  "/market-logos/",
  "/products/",
  "/velmere/",
  "/wallets/",
]);

const PUBLIC_ASSET_EXTENSION = /\.(?:avif|gif|ico|jpeg|jpg|json|png|svg|webp|woff|woff2)$/iu;

const ROOT_METADATA_PATHS = new Set([
  "/icon.svg",
  "/manifest.webmanifest",
  "/shield.jpg",
  "/shield.png",
]);

const PUBLIC_MARKET_INTEGRITY_PROOF_PREFIX = "/proof/market-integrity/";
const PUBLIC_MARKET_INTEGRITY_PROOF_PATH = /^\/proof\/market-integrity\/pubidx-[a-f0-9]{48}(?:\/(?:verify|audit-trail))?$/u;

export function isCanonicalPublicMarketIntegrityProofPath(pathname: string) {
  return PUBLIC_MARKET_INTEGRITY_PROOF_PATH.test(pathname);
}

function resolveMetadataAlias(pathname: string) {
  if (pathname === "/favicon.ico") return "/icon.svg";
  const localized = pathname.match(/^\/(?:pl|en|de)\/(icon\.svg|manifest\.webmanifest|favicon\.ico)$/u);
  if (!localized) return null;
  return localized[1] === "favicon.ico" ? "/icon.svg" : `/${localized[1]}`;
}

export function isKnownPublicAssetPath(pathname: string) {
  // Current public filenames are ASCII and unescaped. Refuse any encoded path
  // on the fast path so single- and double-encoded separators cannot be
  // reinterpreted differently by the proxy, framework and filesystem layers.
  if (pathname.includes("%")) return false;

  // Decode every escape before applying the public-directory allowlist. This
  // keeps encoded traversal, slash and backslash variants from reaching the
  // asset fast path under a misleading /images/ (or equivalent) prefix.
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  if (decodedPathname.includes("\0") || decodedPathname.includes("\\")) return false;
  if (hasForbiddenRequestPathCharacter(decodedPathname)) return false;
  if (decodedPathname.split("/").some((segment) => segment === "." || segment === "..")) return false;
  if (!PUBLIC_ASSET_EXTENSION.test(decodedPathname)) return false;
  return PUBLIC_ASSET_PREFIXES.some((prefix) => decodedPathname.startsWith(prefix));
}

export function isExplicitLoopbackHttpBrowserProofRequest(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env[LOOPBACK_HTTP_BROWSER_PROOF_ENV] !== "true") return false;
  if (request.nextUrl.protocol !== "http:") return false;
  if (!LOOPBACK_HOSTNAMES.has(request.nextUrl.hostname.toLowerCase())) return false;

  const requestHost = parseLoopbackHostHeader(request.headers.get("host"));
  if (
    !requestHost ||
    requestHost.port !== request.nextUrl.port
  ) return false;

  // Next's standalone server adds its own X-Forwarded-Host/Proto before the
  // proxy executes. Accept only a single, exact loopback projection of the
  // already-validated URL/Host. Generic Forwarded and any conflicting value
  // remain fail-closed, so request metadata cannot select this test profile.
  if (request.headers.has("forwarded")) return false;
  const forwardedHostValue = request.headers.get("x-forwarded-host");
  if (forwardedHostValue !== null) {
    const forwardedHost = parseLoopbackHostHeader(forwardedHostValue);
    if (
      !forwardedHost ||
      forwardedHost.port !== requestHost.port
    ) return false;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto !== null && forwardedProto.trim().toLowerCase() !== "http") return false;
  const forwardedPort = request.headers.get("x-forwarded-port");
  if (forwardedPort !== null && forwardedPort.trim() !== requestHost.port) return false;
  return true;
}

function createStrictNonceRequestContext(request: NextRequest) {
  const nonce = createCspNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isDev,
    mode: "strict-nonce",
    nonce,
    upgradeInsecureRequests: !isExplicitLoopbackHttpBrowserProofRequest(request),
  });
  const requestHeaders = new Headers(request.headers);
  const locale = request.nextUrl.pathname.match(/^\/(pl|en|de)(?:\/|$)/u)?.[1] ?? "en";
  requestHeaders.set("x-velmere-document-locale", locale);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the request CSP before rendering and automatically applies
  // this nonce to its framework/bootstrap scripts.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const securedRequest = new NextRequest(request, { headers: requestHeaders });

  return {
    request: securedRequest,
    finalize(response: NextResponse) {
      response.headers.set("Content-Security-Policy", contentSecurityPolicy);
      return response;
    },
  };
}

const ROOT_PUBLIC_ALIASES: Record<string, string> = {
  "/": "/pl",
  "/home": "/pl",
  "/browser": "/pl/search",
  "/search": "/pl/search",
  "/shield": "/pl/market-integrity",
  "/market-integrity": "/pl/market-integrity",
  "/shield-pro": "/pl/shield-pro",
  "/shield-map": "/pl/shield-map",
  "/real-markets": "/pl/real-markets",
  "/verify": "/pl/verify",
};

const ROOT_AUTH_ALIASES: Record<string, string> = {
  "/admin": "/en/admin/import-products",
  "/admin/import-products": "/en/admin/import-products",
  "/admin/products": "/en/admin/import-products",
  "/login": "/pl/login",
  "/logowanie": "/pl/login",
  "/sign-in": "/pl/login",
  "/signin": "/pl/login",
  "/account": "/pl/account",
  "/konto": "/pl/account",
  "/member": "/pl/account",
  "/dashboard": "/pl/account",
};

const LOCALE_AUTH_ALIASES: Record<string, string> = {
  "admin-products": "admin/import-products",
  produkty: "admin/import-products",
  logowanie: "login",
  "sign-in": "login",
  signin: "login",
  konto: "account",
  member: "account",
};

function redirectPreservingSearch(targetPath: string, request: NextRequest) {
  const configured = resolveCanonicalRequestOrigins(request);
  const origin = configured.origins.has(request.nextUrl.origin)
    ? request.nextUrl.origin
    : [...configured.origins][0];
  if (!origin || configured.invalidConfigured.length) {
    return new NextResponse("Service Unavailable", {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }
  const target = new URL(targetPath, origin);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}

function renderLocaleRoot(request: NextRequest, locale: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-intl-locale", locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function rejectPublicMarketIntegrityProofRoute() {
  const response = new NextResponse(null, { status: 404 });
  response.headers.set("cache-control", "no-store, private");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}

function allowPublicMarketIntegrityProofRoute(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
  response.headers.set("cache-control", "no-store, private, max-age=0");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}

function stripRedundantLocaleSelfRewrite(response: NextResponse, request: NextRequest) {
  const rewrite = response.headers.get("x-middleware-rewrite");
  if (!rewrite) return response;

  try {
    const target = new URL(rewrite);
    const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const targetPath = `${target.pathname}${target.search}`;

    // PASS641: next-intl already injects x-next-intl-locale. Rewriting an
    // already-prefixed URL to the identical absolute URL can be interpreted
    // as an external self-proxy by Next start and loop until ECONNRESET.
    // PASS4523: never strip the self-rewrite for locale roots such as /pl,
    // /en or /de. On local Turbopack/Next 16 this can drop the locale route
    // context and the app falls through to the global 404 language chooser.
    const isLocaleRoot = /^\/(pl|en|de)$/.test(request.nextUrl.pathname.replace(/\/$/, ""));
    if (targetPath === currentPath && !isLocaleRoot) {
      response.headers.delete("x-middleware-rewrite");
      // A rewrite response without the rewrite header is not automatically a
      // pass-through response. Mark it explicitly so Next renders the matched
      // route while retaining next-intl request overrides, cookies and links.
      response.headers.set("x-middleware-next", "1");
    }
  } catch {
    // Keep the original response if a future middleware emits a non-URL value.
  }

  return response;
}

// PASS2312: Next 16 uses proxy.ts only. Do not add middleware.ts alongside this file.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath = pathname.replace(/\/$/, "") || "/";

  const metadataAlias = resolveMetadataAlias(normalizedPath);
  if (metadataAlias && metadataAlias !== normalizedPath) {
    return redirectPreservingSearch(metadataAlias, request);
  }
  if (ROOT_METADATA_PATHS.has(normalizedPath)) {
    return NextResponse.next();
  }

  if (normalizedPath.startsWith("/api/")) {
    console.log('[DEBUG PROXY EDGE]', {
      url: request.url,
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      xfh: request.headers.get('x-forwarded-host'),
      edge: inspectApiEdgeRequest(request)
    });
    const edge = inspectApiEdgeRequest(request);
    if (!edge.ok) {
      return new NextResponse(JSON.stringify({
        ok: false,
        mode: edge.mode,
      }), {
        status: edge.status,
        headers: {
          "cache-control": "no-store, private",
          "content-type": "application/json; charset=utf-8",
          "cross-origin-resource-policy": "same-origin",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const decision = evaluatePass4658ControlPlaneBoundary({ request, pathname: normalizedPath });
    if (decision.applies && !decision.allowed) {
      return new NextResponse(null, {
        status: 404,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const response = NextResponse.next();
    response.headers.set("cache-control", "no-store, private");
    response.headers.set("cross-origin-resource-policy", "same-origin");
    response.headers.set("referrer-policy", "no-referrer");
    response.headers.set("x-content-type-options", "nosniff");
    const surfaceHeaders = pass4659ApiSurfaceHeaders(normalizedPath);
    for (const [key, value] of Object.entries(surfaceHeaders)) response.headers.set(key, value);
    if (decision.applies) {
      response.headers.set("cache-control", "no-store");
      response.headers.set("x-velmere-control-plane-boundary", PASS4658_CONTROL_PLANE_BOUNDARY_ID);
    }
    return response;
  }

  // PASS12: match dotted document routes at the proxy boundary and bypass only
  // files that are known to exist under the current public/ directory contract.
  // A broad "has an extension" matcher turns legitimate dotted 404 documents
  // into static-asset fallthroughs and removes locale/CSP handling.
  if (isKnownPublicAssetPath(normalizedPath)) {
    return NextResponse.next();
  }

  const strictNonceContext = createStrictNonceRequestContext(request);
  const securedRequest = strictNonceContext.request;

  try {
    decodeURI(securedRequest.nextUrl.pathname);
  } catch {
    return strictNonceContext.finalize(new NextResponse("Bad Request", {
      status: 400,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    }));
  }

  // These three non-localized proof paths have their own exact server-owned
  // publication boundary. Letting next-intl rewrite them to /{locale}/proof
  // bypasses that boundary through the localized catch-all page.
  if (normalizedPath.startsWith(PUBLIC_MARKET_INTEGRITY_PROOF_PREFIX)) {
    if (!isCanonicalPublicMarketIntegrityProofPath(normalizedPath)) {
      return strictNonceContext.finalize(rejectPublicMarketIntegrityProofRoute());
    }
    return strictNonceContext.finalize(allowPublicMarketIntegrityProofRoute(securedRequest));
  }

  const localeRoot = normalizedPath.match(/^\/(pl|en|de)$/);
  if (localeRoot) {
    // A locale root is the actual storefront home route. Render it directly
    // instead of rewriting it to Shield or relying on a self-rewrite that can
    // loop under local Turbopack.
    return strictNonceContext.finalize(renderLocaleRoot(securedRequest, localeRoot[1]));
  }

  const publicRootRedirect = ROOT_PUBLIC_ALIASES[normalizedPath];
  if (publicRootRedirect) {
    return strictNonceContext.finalize(redirectPreservingSearch(publicRootRedirect, securedRequest));
  }

  const rootRedirect = ROOT_AUTH_ALIASES[normalizedPath];
  if (rootRedirect) {
    return strictNonceContext.finalize(redirectPreservingSearch(rootRedirect, securedRequest));
  }

  const match = normalizedPath.match(/^\/(pl|en|de)\/([^/]+)$/);
  if (match) {
    const [, locale, segment] = match;
    const target = LOCALE_AUTH_ALIASES[segment];
    if (target) {
      return strictNonceContext.finalize(redirectPreservingSearch(`/${locale}/${target}`, securedRequest));
    }
  }

  return strictNonceContext.finalize(
    stripRedundantLocaleSelfRewrite(intlMiddleware(securedRequest), securedRequest),
  );
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!api|_next|_vercel).*)",
  ],
};
