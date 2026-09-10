import { createHash } from "node:crypto";
import { detectAdminAiPolicyReasons } from "@/lib/admin/ai-input-policy";
import { generateGeminiAdminText } from "@/lib/ai/gemini";
import { verifyAdminImportRequest } from "@/lib/admin/auth";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

const MAX_ADMIN_AI_BODY_BYTES = 16 * 1024;
const MAX_ADMIN_AI_INPUT_CHARS = 12_000;

type AdminAiTask = "product_description" | "rewrite_copy" | "alt_text" | "import_cleanup";
type AdminAiLocale = "pl" | "en" | "de";
type AdminAiBody = { task?: AdminAiTask; locale?: AdminAiLocale; input?: string };

function resolveTask(value: unknown): AdminAiTask {
  return value === "product_description" || value === "rewrite_copy" || value === "alt_text" || value === "import_cleanup"
    ? value
    : "import_cleanup";
}

function resolveLocale(value: unknown): AdminAiLocale {
  return value === "en" || value === "de" || value === "pl" ? value : "pl";
}

function parseBody(value: unknown): AdminAiBody {
  return value && typeof value === "object" ? (value as AdminAiBody) : {};
}

function inputMetadata(input: string) {
  return {
    digest: createHash("sha256").update(input, "utf8").digest("hex"),
    length: input.length,
    rawInputReturned: false as const,
  };
}

async function handleAdminAiPost(request: Request) {
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: false });
  if (originGuard) return originGuard;
  const sizeGuard = rejectLargeContentLength(request, MAX_ADMIN_AI_BODY_BYTES);
  if (sizeGuard) return sizeGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "admin-ai", limit: 20, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;
  const auth = verifyAdminImportRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonBody<unknown>(request, MAX_ADMIN_AI_BODY_BYTES, { maxDepth: 8 });
  if (!parsed.ok) return parsed.response;
  const body = parseBody(parsed.value);
  const task = resolveTask(body.task);
  const locale = resolveLocale(body.locale);
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) return securityJson({ error: "input_required" }, { status: 400 });
  if (input.length > MAX_ADMIN_AI_INPUT_CHARS) {
    return securityJson({ error: "input_too_large", maxChars: MAX_ADMIN_AI_INPUT_CHARS }, { status: 413 });
  }

  const policyReasons = detectAdminAiPolicyReasons(input);
  const metadata = inputMetadata(input);
  if (policyReasons.length > 0) {
    return securityJson(
      { error: "ai_input_policy_blocked", policyReasons, input: metadata },
      {
        status: 400,
        headers: {
          "x-velmere-admin-ai-boundary": "compact-v2",
          "x-velmere-admin-ai-policy": "blocked-before-provider",
        },
      },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return securityJson(
      { error: "ai_provider_unavailable" },
      {
        status: 503,
        headers: {
          "retry-after": "30",
          "x-velmere-admin-ai-boundary": "compact-v2",
          "x-velmere-admin-ai-policy": "passed",
        },
      },
    );
  }

  try {
    const result = await generateGeminiAdminText({ task, locale, input });
    if (!result.ok) {
      return securityJson(
        { error: "ai_provider_unavailable" },
        { status: 502, headers: { "retry-after": "15", "x-velmere-admin-ai-boundary": "compact-v2" } },
      );
    }
    return securityJson(
      {
        text: result.payload.text,
        model: result.payload.model,
        diagnostics: result.payload.diagnostics,
        request: { task, locale, input: metadata },
      },
      {
        status: 200,
        headers: {
          "x-velmere-admin-ai-boundary": "compact-v2",
          "x-velmere-admin-ai-policy": "passed",
        },
      },
    );
  } catch {
    return securityJson(
      { error: "ai_provider_unavailable" },
      { status: 502, headers: { "retry-after": "15", "x-velmere-admin-ai-boundary": "compact-v2" } },
    );
  }
}

export async function POST(request: Request) {
  return withExpensiveRouteBudget(request, "admin_ai_post", () => handleAdminAiPost(request));
}
