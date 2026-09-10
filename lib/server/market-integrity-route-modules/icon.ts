import { readResponseBytesBounded, VelmereResponseBodyError } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { safeProxiedImageHeaders, validateProxiedRasterImage } from "@/lib/security/file-content-signatures";

import { applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { sanitizeBoundedParam } from "@/lib/security/api-guard";

const ALLOWED_HOSTS = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
  "static.coingecko.com",
  "www.coingecko.com",
  "dd.dexscreener.com",
  "cdn.dexscreener.com",
  "cdn.simpleicons.org",
]);

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "icon", { keyPrefix: "token-icon-proxy", queryParam: "url", allowEmptyQuery: true });
  if (!shield.ok) {
    // A blocked presentation request must never open provider egress. Returning
    // an empty success lets the existing client-side candidate chain advance to
    // its local logo/glyph without a browser-console transport error.
    const headers = new Headers({
      "cache-control": "private, no-store",
      "x-velmere-icon-fallback": `abuse-shield-${shield.response.status}-no-content`,
    });
    for (const name of [
      "retry-after",
      "ratelimit-limit",
      "ratelimit-remaining",
      "ratelimit-reset",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ]) {
      const value = shield.response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(null, { status: 204, headers });
  }

  const { searchParams } = new URL(request.url);
  const raw = sanitizeBoundedParam(searchParams.get("url"), { maxLength: 420 });
  if (!raw) return new Response(null, { status: 404 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return new Response(null, { status: 403 });
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) return new Response(null, { status: 403 });

  try {
    const response = await safeEgressFetch(url.toString(), {
      headers: { accept: "image/png,image/jpeg;q=0.9" },
      next: { revalidate: 60 * 60 * 24 },
    } as RequestInit & { next: { revalidate: number } }, {
      allowedHosts: ALLOWED_HOSTS,
      maxRedirects: 2,
      timeoutMs: 7_000,
      maxResponseBytes: 600_000,
      operation: "token_icon_proxy",
    });
    if (!response.ok) return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "remote-status-fallback" } });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
      return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "remote-content-type-fallback" } });
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 600_000) {
      return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "remote-size-fallback" } });
    }

    const body = await readResponseBytesBounded(response, 600_000);
    if (body.byteLength > 600_000) {
      return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "remote-size-fallback" } });
    }
    const signature = validateProxiedRasterImage(body, contentType);
    if (!signature) return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "remote-signature-fallback" } });

    return new Response(body, {
      status: 200,
      headers: {
        ...safeProxiedImageHeaders(
          signature,
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          "velmere-token-icon",
        ),
      },
    });
  } catch (error) {
    if (error instanceof VelmereResponseBodyError && error.code === "response_too_large") {
      return new Response(null, { status: 413 });
    }
    return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "local-or-glyph" } });
  }
}
