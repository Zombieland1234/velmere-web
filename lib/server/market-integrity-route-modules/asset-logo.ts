import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import { readJsonResponseBounded, readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { sanitizeBoundedParam } from "@/lib/security/api-guard";
import { safeProxiedImageHeaders, validateProxiedRasterImage } from "@/lib/security/file-content-signatures";
import { buildPass2818IconProvenanceGate } from "@/lib/market-integrity/top1-icon-provenance-gate";

const ALLOWED_LOGO_HOSTS = new Set([
  "api.twelvedata.com",
  "logo.twelvedata.com",
]);

function fallbackSvgLogo(symbol: string, reason = "fallback_required") {
  const safe = symbol.slice(0, 8).replace(/[^A-Z0-9]/g, "") || "MKT";
  const gate = buildPass2818IconProvenanceGate({
    surface: "Real Markets",
    symbol: safe,
    provider: "safe_text_fallback",
    licenseApproved: false,
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#080b0d"/><circle cx="32" cy="32" r="22" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/><text x="32" y="37" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#f4f4f5">${safe}</text></svg>`;
  const download = buildSafeDownloadDisposition({ disposition: "inline", filenameStem: "velmere-generated-logo", mediaKind: "svg" });
  return new Response(svg, {
    headers: {
      "content-type": download.contentType,
      "content-disposition": download.contentDisposition,
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
      "x-velmere-icon-provenance": gate.status,
      "x-velmere-icon-provider": gate.provider,
      "x-velmere-icon-rule": reason,
    },
  });
}

export async function GET(request: Request) {
  const requestedSymbol = sanitizeBoundedParam(
    new URL(request.url).searchParams.get("symbol"),
    { maxLength: 32 },
  )
    .toUpperCase()
    .replace(/[^A-Z0-9./:_-]/g, "");
  const shield = await applyApiAbuseShield(request, "icon", {
    keyPrefix: "real-market-asset-logo",
    queryParam: "symbol",
    allowEmptyQuery: false,
  });
  if (!shield.ok) {
    // Presentation requests never bypass the abuse shield or open provider
    // egress. A bounded local SVG is safe for every denied shield state.
    if (requestedSymbol) {
      return fallbackSvgLogo(requestedSymbol, `abuse_shield_${shield.response.status}_local_fallback`);
    }
    return shield.response;
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const symbol = requestedSymbol;
  if (!symbol) return new Response(null, { status: 404 });
  if (!apiKey) return fallbackSvgLogo(symbol, "twelvedata_api_key_missing");

  const params = new URLSearchParams({ symbol, apikey: apiKey });
  try {
    const metadataResponse = await safeEgressFetch(
      `https://api.twelvedata.com/logo?${params.toString()}`,
      {
        headers: { accept: "application/json" },
        next: { revalidate: 60 * 60 * 24 * 7 },
      } as RequestInit & { next: { revalidate: number } },
      {
        allowedHosts: ALLOWED_LOGO_HOSTS,
        maxRedirects: 1,
        timeoutMs: 7_000,
        maxResponseBytes: 128_000,
        operation: "twelvedata_logo_metadata",
      },
    );
    if (!metadataResponse.ok) {
      return fallbackSvgLogo(symbol, "logo_metadata_unavailable");
    }
    const metadata = await readJsonResponseBounded<{
      url?: string;
      logo_base?: string;
    }>(metadataResponse, 128_000);
    const rawLogo = metadata.url ?? metadata.logo_base;
    if (!rawLogo) return fallbackSvgLogo(symbol, "provider_logo_url_missing");
    const logoUrl = new URL(rawLogo);
    if (logoUrl.protocol !== "https:" || !ALLOWED_LOGO_HOSTS.has(logoUrl.hostname)) {
      return fallbackSvgLogo(symbol, "provider_logo_host_not_approved");
    }

    const imageResponse = await safeEgressFetch(logoUrl, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon;q=0.8" },
      next: { revalidate: 60 * 60 * 24 * 7 },
    } as RequestInit & { next: { revalidate: number } }, {
      allowedHosts: ALLOWED_LOGO_HOSTS,
      maxRedirects: 1,
      timeoutMs: 7_000,
      maxResponseBytes: 600_000,
      operation: "twelvedata_logo_image",
    });
    if (!imageResponse.ok) return fallbackSvgLogo(symbol, `provider_image_status_${imageResponse.status}`);
    const contentType = imageResponse.headers.get("content-type");
    const bytes = await readResponseBytesBounded(imageResponse, 600_000);
    const signature = validateProxiedRasterImage(bytes, contentType);
    if (!signature) return fallbackSvgLogo(symbol, "provider_icon_signature_or_content_type_blocked");
    const gate = buildPass2818IconProvenanceGate({
      surface: "Real Markets",
      symbol,
      provider: "twelvedata_logo",
      sourceUrl: logoUrl.toString(),
      contentType: signature.contentType,
      byteLength: bytes.byteLength,
      hostApproved: true,
      licenseApproved: true,
    });

    return new Response(bytes, {
      headers: {
        ...safeProxiedImageHeaders(
          signature,
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
          "velmere-asset-logo",
        ),
        "x-velmere-icon-provenance": gate.status,
        "x-velmere-icon-provider": gate.provider,
        "x-velmere-icon-rule": "pass2818_proxy_cache_only_presentation_metadata",
      },
    });
  } catch {
    return fallbackSvgLogo(symbol, "provider_fetch_failed_degrade_to_fallback");
  }
}
