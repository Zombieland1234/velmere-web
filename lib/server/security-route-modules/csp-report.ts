import { createHash } from "node:crypto";
import { applyApiRateLimit, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import { parseAndSanitizeCspReports } from "@/lib/security/csp-report";
import { recordSecurityEvent } from "@/lib/security/security-event-ledger";
import { readBoundedBodyBytes } from "@/lib/security/payment-webhook-guard";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/json",
  "application/reports+json",
]);

function empty(status: number) {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "cross-origin-resource-policy": "same-origin",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const oversized = rejectLargeContentLength(request, MAX_BODY_BYTES);
  if (oversized) return oversized;
  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "csp-violation-report",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return securityJson({ ok: false, mode: "unsupported_csp_report_media_type" }, { status: 415 });
  }
  const contentEncoding = (request.headers.get("content-encoding") ?? "identity").trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    return securityJson({ ok: false, mode: "compressed_csp_report_not_accepted" }, { status: 415 });
  }

  const streamed = await readBoundedBodyBytes(request, MAX_BODY_BYTES);
  if (!streamed.ok) return streamed.response;
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(streamed.bytes);
  } catch {
    return securityJson({ ok: false, mode: "invalid_csp_report_utf8" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = parseStrictJsonText(body, { maxBytes: MAX_BODY_BYTES, maxDepth: 12, maxNodes: 512, requireObject: false });
  } catch {
    return securityJson({ ok: false, mode: "invalid_csp_report_json" }, { status: 400 });
  }
  const reports = parseAndSanitizeCspReports(parsed);
  if (reports.length === 0) return securityJson({ ok: false, mode: "invalid_csp_report_shape" }, { status: 400 });

  for (const report of reports) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([report.documentPath, report.blockedResource, report.effectiveDirective]))
      .digest("hex");
    recordSecurityEvent({
      request,
      kind: "csp_violation",
      severity: report.disposition === "enforce" ? "elevated" : "review",
      profile: "browser_csp_report",
      abuseScore: report.disposition === "enforce" ? 70 : 35,
      attackFingerprint: fingerprint,
      notes: [
        `directive:${report.effectiveDirective}`,
        `document:${report.documentPath}`,
        `blocked:${report.blockedResource}`,
      ],
      safeSummary: "Browser CSP violation recorded after URL/query/credential/script-sample redaction.",
    });
  }

  return empty(204);
}
