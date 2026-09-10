import { readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { safeProxiedImageHeaders, validateProxiedRasterImage } from "@/lib/security/file-content-signatures";
import { abuseShieldResponseHeaders, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { NextResponse } from "next/server";

const BRAND_ICON_PROVIDER_HOSTS = new Set(["www.google.com", "icons.duckduckgo.com"]);

function isSafeBrandDomain(value: string) {
  return (
    value.length <= 120 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(value) &&
    !value.endsWith(".local") &&
    !value.endsWith(".internal")
  );
}

function brandIconProviderUrls(domain: string) {
  return [
    {
      provider: "google_s2_256",
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`,
    },
    {
      provider: "google_s2_128",
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    },
    {
      provider: "duckduckgo_ip3",
      url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    },
  ];
}

async function fetchBrandIcon(domain: string) {
  for (const candidate of brandIconProviderUrls(domain)) {
    try {
      const response = await safeEgressFetch(candidate.url, {
        headers: { accept: "image/avif,image/webp,image/png,image/x-icon,image/*;q=0.8" },
        next: { revalidate: 60 * 60 * 24 * 7 },
      } as RequestInit & { next: { revalidate: number } }, {
        allowedHosts: BRAND_ICON_PROVIDER_HOSTS,
        maxRedirects: 2,
        timeoutMs: 7_000,
        maxResponseBytes: 300_000,
        operation: `brand_icon_${candidate.provider}`,
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type");
      const body = await readResponseBytesBounded(response, 300_000);
      const signature = validateProxiedRasterImage(body, contentType);
      if (!signature) continue;
      return { body, signature, provider: candidate.provider };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "icon", {
    keyPrefix: "brand-icon-proxy",
    providerId: "brand-icon-egress",
    queryParam: "domain",
  });
  if (!shield.ok) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "cache-control": "private, no-store",
        "x-velmere-icon-fallback": `abuse-shield-${shield.response.status}-no-content`,
      },
    });
  }
  const domain = shield.query?.trim().toLowerCase().replace(/^www\./, "");
  if (!domain || !isSafeBrandDomain(domain)) {
    return NextResponse.json({ ok: false, error: "unsupported_domain" }, { status: 404 });
  }

  const icon = await fetchBrandIcon(domain);
  if (!icon) {
    return new NextResponse(null, { status: 204, headers: { "cache-control": "public, max-age=3600", "x-velmere-icon-fallback": "local-or-glyph" } });
  }

  const response = new NextResponse(icon.body, {
    headers: {
      ...safeProxiedImageHeaders(
        icon.signature,
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "velmere-brand-icon",
      ),
      "x-velmere-icon-provider": icon.provider,
    },
  });
  for (const [name, value] of new Headers(abuseShieldResponseHeaders(shield))) {
    response.headers.set(name, value);
  }
  return response;
}
