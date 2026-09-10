import { requireTrustedRateLimitClient } from "@/lib/security/api-guard";
import { applyDurableRateLimit, buildDurableRateLimitHeaders } from "@/lib/security/durable-rate-limit";

export type WriteApiRateLimitProfile = "checkout" | "admin_mutation" | "provider_sandbox" | "fulfilment_incident" | "lens_pdf" | "market_ai" | "default";

const PROFILE_LIMITS: Record<WriteApiRateLimitProfile, { limit: number; windowMs: number }> = {
  checkout: { limit: 12, windowMs: 60_000 },
  admin_mutation: { limit: 30, windowMs: 60_000 },
  provider_sandbox: { limit: 20, windowMs: 60_000 },
  fulfilment_incident: { limit: 25, windowMs: 60_000 },
  lens_pdf: { limit: 20, windowMs: 60_000 },
  market_ai: { limit: 30, windowMs: 60_000 },
  default: { limit: 40, windowMs: 60_000 },
};

export async function applyWriteApiRateLimit(req: Request, profile: WriteApiRateLimitProfile = "default") {
  const trustedClient = requireTrustedRateLimitClient(req, `write-api:${profile}`);
  if (!trustedClient.ok) {
    return {
      ok: false as const,
      response: trustedClient.response,
      clientResolution: trustedClient.resolution,
    };
  }
  const rule = PROFILE_LIMITS[profile] ?? PROFILE_LIMITS.default;
  const decision = await applyDurableRateLimit({
    namespace: `velmere-write-api:${profile}`,
    key: `${new URL(req.url).pathname}:${trustedClient.durableClientKey}`,
    limit: rule.limit,
    windowMs: rule.windowMs,
  });
  if (!decision.ok) {
    const storageUnavailable = decision.mode === "unavailable" || decision.reason === "rate_limit_store_unavailable";
    return {
      ok: false as const,
      response: Response.json({
        error: storageUnavailable ? "Rate-limit storage unavailable." : "Rate limit exceeded.",
        profile,
        retryAfterSeconds: decision.retryAfterSeconds,
        mode: decision.mode,
      }, {
        status: storageUnavailable ? 503 : 429,
        headers: buildDurableRateLimitHeaders(decision),
      }),
      decision,
    };
  }
  return { ok: true as const, decision, headers: buildDurableRateLimitHeaders(decision) };
}
