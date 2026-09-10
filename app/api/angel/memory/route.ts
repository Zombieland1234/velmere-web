import { clearAngelDurableMemory, getAngelDurableMemoryMarker, readAngelDurableMemory } from "@/lib/ai/angel-durable-memory";
import { sanitizeVlmText } from "@/lib/ai/vlm-security";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { resolveRequestAccount } from "@/lib/auth/account-session";

export const runtime = "nodejs";

const PASS2227_ANGEL_MEMORY_API_MARKER =
  "pass2227-angel-memory-api-clear-read-safe-diagnostics" as const;

type AngelMemoryLocale = "pl" | "en" | "de";
type AngelMemoryBody = {
  sessionId?: string;
  locale?: AngelMemoryLocale;
};

function resolveAngelMemoryLocale(value: unknown): AngelMemoryLocale {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

async function parseBody(req: Request): Promise<
  | { ok: true; value: { sessionId: string; locale: AngelMemoryLocale } }
  | { ok: false; response: Response }
> {
  const parsed = await readBoundedJsonBody<AngelMemoryBody>(req, 12 * 1024, { maxDepth: 6 });
  if (!parsed.ok) return parsed;
  const locale = resolveAngelMemoryLocale(parsed.value.locale);
  const rawSessionId = parsed.value.sessionId;
  if (typeof rawSessionId !== "string" || !rawSessionId.trim() || rawSessionId.trim().length > 120) {
    return {
      ok: false,
      response: securityJson({ ok: false, error: "invalid_memory_identity" }, { status: 400 }),
    };
  }
  const sessionId = sanitizeVlmText(rawSessionId.trim(), 120);
  if (sessionId !== rawSessionId.trim()) {
    return {
      ok: false,
      response: securityJson({ ok: false, error: "invalid_memory_identity" }, { status: 400 }),
    };
  }
  return {
    ok: true,
    value: {
      sessionId,
      locale,
    },
  };
}

async function guard(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 12 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(req, { allowMissingOrigin: true });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, {
    keyPrefix: "angel-memory",
    limit: 40,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;
  return null;
}

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const parsed = await parseBody(req);
  if (!parsed.ok) return parsed.response;
  const account = await resolveRequestAccount(req);
  if (!account) return securityJson({ ok: false, error: "account_required" }, { status: 401 });
  const body = parsed.value;
  const memory = await readAngelDurableMemory({ ...body, accountId: account.accountId });
  return securityJson({
    ok: true,
    mode: memory?.mode ?? "empty",
    lane: memory?.lane ?? null,
    turnCount: memory?.turnCount ?? 0,
    hasSummary: Boolean(memory?.summary),
    recentTopics: memory?.recentTopics?.slice(-4) ?? [],
    marker: PASS2227_ANGEL_MEMORY_API_MARKER,
    durableMarker: getAngelDurableMemoryMarker(),
  });
}

export async function DELETE(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const parsed = await parseBody(req);
  if (!parsed.ok) return parsed.response;
  const account = await resolveRequestAccount(req);
  if (!account) return securityJson({ ok: false, error: "account_required" }, { status: 401 });
  const body = parsed.value;
  const result = await clearAngelDurableMemory({ sessionId: body.sessionId, accountId: account.accountId });
  if (!result.ok) {
    return securityJson(
      { ok: false, error: result.reason, marker: PASS2227_ANGEL_MEMORY_API_MARKER },
      { status: result.reason === "invalid_memory_identity" ? 400 : 503 },
    );
  }
  return securityJson({
    ok: true,
    mode: result.mode,
    marker: PASS2227_ANGEL_MEMORY_API_MARKER,
    durableMarker: getAngelDurableMemoryMarker(),
  });
}
