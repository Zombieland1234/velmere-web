import {
  getAngelFeedbackMetrics,
  submitAngelFeedback,
} from "@/lib/ai/angel-feedback-pipeline";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

export const runtime = "nodejs";

const PASS2235_ANGEL_FEEDBACK_API_MARKER =
  "pass2235-angel-feedback-pipeline-evidence-quality-v1" as const;

export async function POST(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 8 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(req, {
    keyPrefix: "angel-feedback",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const parsed = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024, { maxDepth: 4 });
  if (!parsed.ok) return parsed.response;

  const body = parsed.value;
  if (!body.requestId || typeof body.requestId !== "string") {
    return securityJson({ ok: false, error: "missing_request_id" }, { status: 400 });
  }

  const result = await submitAngelFeedback({
    requestId: body.requestId,
    rating: body.rating,
    category: body.category,
    comment: body.comment,
    sessionId: body.sessionId,
    locale: body.locale,
  });

  if (!result.ok) {
    return securityJson(
      { ok: false, error: result.error, marker: PASS2235_ANGEL_FEEDBACK_API_MARKER },
      { status: 400 },
    );
  }

  return securityJson({
    ok: true,
    feedbackId: result.feedbackId,
    marker: PASS2235_ANGEL_FEEDBACK_API_MARKER,
  });
}

export async function GET(req: Request) {
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(req, {
    keyPrefix: "angel-feedback-metrics",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const url = new URL(req.url);
  const localeParam = url.searchParams.get("locale");
  const locale = localeParam === "pl" || localeParam === "de" ? localeParam : "en";

  const metrics = getAngelFeedbackMetrics(locale);
  return securityJson({
    ok: true,
    metrics,
    marker: PASS2235_ANGEL_FEEDBACK_API_MARKER,
  });
}
