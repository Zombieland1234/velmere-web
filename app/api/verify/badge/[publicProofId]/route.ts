import { NextResponse } from "next/server";
import { resolveCanonicalRequestOrigins } from "@/lib/security/api-edge-boundary";
import { applyApiRateLimit } from "@/lib/security/api-guard";
import { resolvePublishedPublicProof } from "@/lib/market-integrity/public-proof-publication-resolver";
import { buildVerifyDynamicBadge } from "@/lib/market-integrity/verify-dynamic-badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BASE_HEADERS = {
  "cache-control": "no-store, private, max-age=0, must-revalidate",
  expires: "0",
  pragma: "no-cache",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

function unavailable(status: 404 | 503) {
  return new NextResponse(null, { status, headers: BASE_HEADERS });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicProofId: string }> },
) {
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "verify-dynamic-badge",
    limit: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const { publicProofId } = await params;
  const proof = await resolvePublishedPublicProof(publicProofId);
  if (!proof) return unavailable(404);

  const origins = resolveCanonicalRequestOrigins(request);
  if (origins.invalidConfigured.length || origins.origins.size === 0) return unavailable(503);
  const canonicalSiteOrigin = origins.origins.values().next().value;
  if (typeof canonicalSiteOrigin !== "string") return unavailable(503);
  const badge = buildVerifyDynamicBadge({ proof, canonicalSiteOrigin });
  if (!badge) return unavailable(503);

  return new NextResponse(badge.svg, {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      "content-disposition": 'inline; filename="velmere-verify.svg"',
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox allow-top-navigation-by-user-activation",
      "content-type": "image/svg+xml; charset=utf-8",
      link: `<${badge.canonicalUrl}>; rel="canonical"`,
      "x-velmere-verify-head": badge.headEventDigest,
      "x-velmere-verify-status": badge.status,
    },
  });
}

export function POST() {
  return new NextResponse(null, {
    status: 405,
    headers: { ...BASE_HEADERS, allow: "GET" },
  });
}
