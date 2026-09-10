import { generateTextWithVlmProvider } from "@/lib/ai/vlm-provider-registry";
import { buildPass2206AngelGeminiSelfPolicyFixProof } from "@/lib/worldclass/angel-gemini-self-policy-fix";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { rejectUnexpectedRequestBody } from "@/lib/security/payment-webhook-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";

const PASS2206_AUDIT_BOUNDARY = "pass2206 angel gemini health audit boundary: redacted diagnostics only, no secrets, same-origin and rate-limited";

function redactedModelName() {
  return process.env.VELMERE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function redactedProviderConfigState() {
  return "redacted_server_side_only" as const;
}

function publicProviderError(value: unknown) {
  const raw = String(value ?? "unknown").slice(0, 260);
  if (/api key/i.test(raw)) return "api_key_rejected_or_missing";
  if (/403|permission|denied|forbidden/i.test(raw)) return "provider_permission_denied";
  if (/404|not found|model/i.test(raw)) return "provider_model_not_found";
  if (/429|quota|rate/i.test(raw)) return "provider_quota_or_rate_limit";
  if (/security policy/i.test(raw)) return "security_policy";
  if (/timeout|abort/i.test(raw)) return "provider_timeout";
  return raw.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]");
}

export async function GET(req: Request) {
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, { keyPrefix: "angel-gemini-health:get", limit: 30, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  return securityJson({
    proof: buildPass2206AngelGeminiSelfPolicyFixProof(),
    auditBoundary: PASS2206_AUDIT_BOUNDARY,
    providerConfigState: redactedProviderConfigState(),
    model: redactedModelName(),
  });
}

export async function POST(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 16 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, { keyPrefix: "angel-gemini-health:post", limit: 12, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  const bodyGuard = await rejectUnexpectedRequestBody(req);
  if (bodyGuard) return bodyGuard;
  const adminToken = verifySecurityAdminToken(req, ["security:events"], undefined, {
    deferBodyBoundMutationAssertion: true,
  });
  if (!adminToken.ok) return adminToken.response;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request: req,
    requiredScopes: ["security:events"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: {},
  });
  if (!admin.ok) return admin.response;

  const startedAt = Date.now();
  const result = await generateTextWithVlmProvider({
    cacheNamespace: "pass2206:angel-gemini-health",
    systemInstruction: [
      "You are a Velmère provider health probe.",
      "Return a short harmless response only.",
      "Do not mention secrets, keys or private environment values.",
    ].join("\n"),
    prompt: "Reply exactly: OK",
    temperature: 0,
    maxOutputTokens: 32,
  });

  return securityJson({
    auditBoundary: PASS2206_AUDIT_BOUNDARY,
    providerConfigState: redactedProviderConfigState(),
    model: redactedModelName(),
    providerMode: result.ok ? "gemini_live" : "deterministic_fallback",
    ok: result.ok,
    latencyMs: Date.now() - startedAt,
    attempts: result.attempts,
    cached: result.ok ? result.cached : false,
    replyPreview: result.ok ? result.text.slice(0, 80) : null,
    fallbackReason: result.ok ? null : publicProviderError(result.error),
  });
}
