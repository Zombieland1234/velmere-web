import {
  buildAuditPaidTierPreview,
  type AuditPaidPreviewLocale,
  type AuditPaidPreviewTier,
} from "@/lib/security/audit-tier-preview";
import { buildAuditPaidTierPreviewPdf } from "@/lib/security/audit-tier-preview-pdf";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import {
  applyApiRateLimit,
  rejectOversizedUrl,
  securityJson,
} from "@/lib/security/api-guard";

const ALLOWED_QUERY_KEYS = new Set(["tier", "locale", "format"]);
const SECURITY_HEADERS = {
  "cache-control": "private, no-store, max-age=0, must-revalidate",
  pragma: "no-cache",
  expires: "0",
  "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; sandbox",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "x-velmere-preview": "server-redacted-no-full-content",
} as const;

function rejectQueryShape(url: URL) {
  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) return `preview_query_key_forbidden:${key.slice(0, 48)}`;
    if (url.searchParams.getAll(key).length !== 1) return `preview_query_duplicate:${key}`;
  }
  return null;
}

function resolveTier(value: string | null): AuditPaidPreviewTier | null {
  return value === "pro" || value === "advanced" ? value : null;
}

function resolveLocale(value: string | null): AuditPaidPreviewLocale | null {
  return value === "pl" || value === "en" || value === "de" ? value : null;
}


export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 1_024);
  if (urlGuard) return urlGuard;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "r44p22-audit-paid-preview",
    limit: 18,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const url = new URL(request.url);
  const shapeError = rejectQueryShape(url);
  if (shapeError) return securityJson({ ok: false, error: shapeError }, { status: 400, headers: SECURITY_HEADERS });

  const tier = resolveTier(url.searchParams.get("tier"));
  const locale = resolveLocale(url.searchParams.get("locale"));
  const format = url.searchParams.get("format") ?? "json";
  if (!tier) return securityJson({ ok: false, error: "preview_tier_required" }, { status: 400, headers: SECURITY_HEADERS });
  if (!locale) return securityJson({ ok: false, error: "preview_locale_required" }, { status: 400, headers: SECURITY_HEADERS });
  if (format !== "json" && format !== "pdf") {
    return securityJson({ ok: false, error: "preview_format_unsupported" }, { status: 400, headers: SECURITY_HEADERS });
  }

  if (format === "pdf") {
    const { pdf } = buildAuditPaidTierPreviewPdf({ tier, locale });
    const download = buildSafeDownloadDisposition({
      disposition: "inline",
      filenameStem: `velmere-${tier}-${locale}-preview`,
      mediaKind: "pdf",
    });
    return new Response(pdf, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        "content-type": download.contentType,
        "content-disposition": download.contentDisposition,
        "content-length": String(pdf.byteLength),
      },
    });
  }

  const preview = buildAuditPaidTierPreview({ tier, locale });
  return securityJson({
    ok: true,
    preview,
    security: {
      fullReportEndpointExposed: false,
      entitlementGranted: false,
      publicCheckoutAllowed: false,
      clientStorageAuthority: false,
      cacheAuthority: false,
    },
  }, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      "x-velmere-rate-limit-remaining": String(rate.remaining),
    },
  });
}
