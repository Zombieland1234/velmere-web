import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { readTextResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  assertAllowedMethods,
  assertSameOriginRequest,
  rejectLargeContentLength,
  requireTrustedRateLimitClient,
  sanitizeBoundedParam,
  sanitizeEmailAddress,
  securityJson,
} from "@/lib/security/api-guard";
import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
  type DurableRateLimitDecision,
} from "@/lib/security/durable-rate-limit";
import { readBoundedFormDataBody } from "@/lib/security/payment-webhook-guard";
import {
  ContactUploadBoundaryError,
  inspectPassiveContactAttachment,
  inspectStrictContactFormData,
  validateContactFormContentType,
  validateContactMultipartRequestFraming,
} from "@/lib/security/multipart-upload-boundary";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { completePass4394ClientRequestJsonResponse, readPass4394ClientRequestId, registerPass4394ClientRequestMutation } from "@/lib/security/client-request-idempotency";
import { pass4396IdempotencyReplayResponse } from "@/lib/security/idempotency-replay-response";
import { inspectContactLegalIntakeReadiness } from "@/lib/legal/contact-legal-intake";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FORM_BYTES = 5 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;

type ContactDeliveryConfig =
  | { mode: "provider"; apiKey: string; to: string; from: string }
  | { mode: "development_preview" }
  | { mode: "unavailable"; missing: string[] };

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function sanitizeMailbox(value: string | undefined) {
  const clean = sanitizeBoundedParam(value ?? "", { maxLength: 240, fallback: "" });
  if (!clean) return "";
  const bracketed = clean.match(/<([^<>]+)>\s*$/)?.[1] ?? clean;
  return sanitizeEmailAddress(bracketed, 180) ? clean : "";
}

function resolveContactDeliveryConfig(): ContactDeliveryConfig {
  const apiKey = sanitizeBoundedParam(process.env.RESEND_API_KEY ?? "", { maxLength: 512, fallback: "" });
  const to = sanitizeEmailAddress(process.env.CONTACT_TO_EMAIL || "velmere141@gmail.com", 180);
  const from = sanitizeMailbox(process.env.CONTACT_FROM_EMAIL);
  const missing = [
    !apiKey ? "RESEND_API_KEY" : "",
    !to ? "CONTACT_TO_EMAIL" : "",
    !from ? "CONTACT_FROM_EMAIL" : "",
  ].filter(Boolean);

  if (!missing.length) return { mode: "provider", apiKey, to, from };
  if (!isProductionRuntime() && !apiKey && !to && !from) return { mode: "development_preview" };
  return { mode: "unavailable", missing };
}

function unavailableResponse() {
  return securityJson(
    { ok: false, error: "contact_delivery_unavailable", retryable: true },
    { status: 503, headers: { "cache-control": "no-store", "retry-after": "60" } },
  );
}

function contactRateLimitResponse(decision: DurableRateLimitDecision) {
  const unavailable = decision.reason === "rate_limit_store_unavailable" || decision.mode === "unavailable";
  return securityJson({
    ok: false,
    error: unavailable ? "contact_rate_limit_store_unavailable" : "contact_rate_limit_exceeded",
    retryable: true,
    retryAfterSeconds: Math.max(1, decision.retryAfterSeconds ?? 60),
  }, {
    status: unavailable ? 503 : 429,
    headers: buildDurableRateLimitHeaders(decision),
  });
}

export async function POST(request: Request) {
  const methodGuard = assertAllowedMethods(request, ["POST"]);
  if (methodGuard) return methodGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const sizeGuard = rejectLargeContentLength(request, MAX_FORM_BYTES);
  if (sizeGuard) return sizeGuard;

  const legalReadiness = inspectContactLegalIntakeReadiness();
  if (!legalReadiness.ready) {
    return securityJson(
      {
        ok: false,
        error: "contact_intake_blocked_legal",
        retryable: false,
        blockers: legalReadiness.blockers,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-velmere-contact-intake": "BLOCKED_LEGAL",
        },
      },
    );
  }

  const trustedClient = requireTrustedRateLimitClient(request, "contact-message");
  if (!trustedClient.ok) return trustedClient.response;

  const rateLimit = await applyDurableRateLimit({
    namespace: "pass4824:contact-message",
    key: `${new URL(request.url).pathname}:${trustedClient.durableClientKey}`,
    limit: 8,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return contactRateLimitResponse(rateLimit);

  const clientRequestId = readPass4394ClientRequestId(request);
  if (isProductionRuntime() && !clientRequestId) {
    return securityJson(
      { ok: false, error: "contact_idempotency_key_required", retryable: true },
      { status: 428, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    validateContactFormContentType(request.headers.get("content-type"), {
      allowUrlEncoded: false,
    });
    validateContactMultipartRequestFraming(request);
  } catch (error) {
    if (error instanceof ContactUploadBoundaryError) {
      return securityJson({ error: error.code }, { status: error.status });
    }
    return securityJson({ error: "contact_upload_content_type_invalid" }, { status: 415 });
  }

  const parsedForm = await readBoundedFormDataBody(request, MAX_FORM_BYTES);
  if (!parsedForm.ok) return parsedForm.response;
  let strictForm: ReturnType<typeof inspectStrictContactFormData>;
  try {
    strictForm = inspectStrictContactFormData(parsedForm.value);
  } catch (error) {
    if (error instanceof ContactUploadBoundaryError) {
      return securityJson({ error: error.code }, { status: error.status });
    }
    return securityJson({ error: "invalid_form_data" }, { status: 400 });
  }

  const name = sanitizeBoundedParam(strictForm.fields.name || "Anonymous", {
    maxLength: 120,
    fallback: "Anonymous",
  });
  const email = sanitizeEmailAddress(strictForm.fields.email, 160);
  const subject = sanitizeBoundedParam(strictForm.fields.subject || "Velmère message", {
    maxLength: 180,
    fallback: "Velmère message",
  });
  const message = sanitizeBoundedParam(strictForm.fields.message, {
    maxLength: 6000,
    fallback: "",
  });

  if (!subject.trim() || !message.trim()) {
    return securityJson({ error: "missing_fields" }, { status: 400 });
  }

  if (strictForm.attachment) {
    const attachmentBytes = new Uint8Array(await strictForm.attachment.arrayBuffer());
    try {
      const fileInfo = inspectPassiveContactAttachment({
        bytes: attachmentBytes,
        declaredContentType: strictForm.attachment.type,
        filename: strictForm.attachment.name,
        maxBytes: MAX_FILE_BYTES,
      });
      return securityJson({
        ok: false,
        delivered: false,
        queued: false,
        deliveryMode: "blocked_external",
        state: "blocked",
        error: "contact_attachment_processing_unavailable",
        retryable: false,
        blockedExternal: [
          "malware_scanning",
          "content_disarm_and_reconstruction",
          "private_quarantine",
        ],
        file: {
          type: fileInfo.contentType,
          extension: fileInfo.extension,
          size: fileInfo.byteLength,
          kind: fileInfo.kind,
        },
      }, {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-velmere-attachment-boundary": "blocked-external-av-cdr-quarantine",
        },
      });
    } catch (error) {
      if (error instanceof ContactUploadBoundaryError) {
        return securityJson({ error: error.code }, { status: error.status });
      }
      return securityJson({ error: "contact_upload_attachment_structure_invalid" }, { status: 415 });
    }
  }

  const deliveryConfig = resolveContactDeliveryConfig();
  if (deliveryConfig.mode === "unavailable") return unavailableResponse();

  const pass4394Idempotency = await registerPass4394ClientRequestMutation({
    request,
    action: "contact_message_submit",
    targetType: "contact_message",
    actorId: "public:contact-form",
    clientRequestId,
    body: { name, email, subject, message, attachment: null },
  });
  if (!pass4394Idempotency.ok) {
    return pass4396IdempotencyReplayResponse({
      surface: "contact_message",
      pass4394Idempotency,
    });
  }
  if (isProductionRuntime() && !pass4394Idempotency.pass4395Durable?.durable) {
    return securityJson(
      { ok: false, error: "contact_durable_idempotency_required", retryable: true },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "30" } },
    );
  }

  let queued = false;
  if (deliveryConfig.mode === "provider") {
    const providerBudget = await applyDurableRateLimit({
      namespace: "pass4824:contact-provider-global-budget",
      key: "resend-email",
      limit: 120,
      windowMs: 60_000,
    });
    if (!providerBudget.ok) return contactRateLimitResponse(providerBudget);
    const providerPayload: Record<string, unknown> = {
      from: deliveryConfig.from,
      to: deliveryConfig.to,
      subject: `[VELMÈRE] ${subject}`,
      text: `Name: ${name}\nEmail: ${email || "not provided"}\nAttachment: none\n\n${message}`,
    };
    try {
      const response = await brokeredEgressFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deliveryConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(providerPayload),
      }, {
        profile: "resend",
        timeoutMs: 10_000,
        maxRequestBytes: 8 * 1024 * 1024,
        maxResponseBytes: MAX_PROVIDER_RESPONSE_BYTES,
        operation: "contact_mail_delivery",
      });
      await readTextResponseBounded(response, MAX_PROVIDER_RESPONSE_BYTES).catch(() => "");
      if (!response.ok) {
        return securityJson({ ok: false, error: "mail_provider_failed", retryable: response.status >= 500 }, { status: 502 });
      }
      queued = true;
    } catch {
      return securityJson({ ok: false, error: "mail_provider_unavailable", retryable: true }, { status: 502 });
    }
  }

  const mutationReceipt = await appendPass2178MutationReceipt({
    request,
    action: "contact_message_submit",
    targetType: "contact_message",
    targetId: pass4394Idempotency.idempotencyKeyHash ?? `contact:${Date.now()}`,
    actorId: email ? "public:email-provided" : "public:anonymous",
    actorMode: "public",
    payload: {
      subject,
      delivered: false,
      queued,
      deliveryMode: deliveryConfig.mode,
      hasAttachment: false,
      pass4394State: pass4394Idempotency.state,
      pass4394ClientRequestIdHash: pass4394Idempotency.clientRequestIdHash,
      pass4394IdempotencyKeyHash: pass4394Idempotency.idempotencyKeyHash,
    },
    safeSummary: "Contact form submission wrote a redacted PASS2178 mutation receipt without storing message body or email.",
  });

  return completePass4394ClientRequestJsonResponse({
    receipt: pass4394Idempotency,
    status: 202,
    body: {
      ok: true,
      delivered: false,
      queued,
      state: queued ? "queued" : "preview",
      deliveryMode: deliveryConfig.mode,
      file: null,
      mutationReceipt,
      pass4394Idempotency,
    },
  });
}
