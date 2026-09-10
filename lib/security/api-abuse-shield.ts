import {
  assertAllowedMethods,
  rejectOversizedUrl,
  requireTrustedRateLimitClient,
  securityJson,
  sanitizeBoundedParam,
} from "@/lib/security/api-guard";
import { applyDurableRateLimit, buildDurableRateLimitHeaders, type DurableRateLimitDecision } from "@/lib/security/durable-rate-limit";
import { buildPass632Boundary } from "@/lib/security/production-rate-limit-adapter";
import { recordSecurityEvent } from "@/lib/security/security-event-ledger";
// PASS182 compatibility marker: applySoftRateLimit is superseded here by applyDurableRateLimit.

export type AbuseShieldProfile =
  | "search"
  | "analyze"
  | "icon"
  | "security"
  | "contract"
  | "osint"
  | "default";

export type AbuseShieldDecision = {
  ok: true;
  query?: string;
  rateLimit: DurableRateLimitDecision;
  abuseScore: number;
  notes: string[];
} | {
  ok: false;
  response: Response;
};

const profileLimits: Record<AbuseShieldProfile, { limit: number; windowMs: number; maxUrlLength: number; maxQueryLength: number }> = {
  search: { limit: 45, windowMs: 60_000, maxUrlLength: 1200, maxQueryLength: 72 },
  analyze: { limit: 30, windowMs: 60_000, maxUrlLength: 1400, maxQueryLength: 96 },
  icon: { limit: 120, windowMs: 60_000, maxUrlLength: 1400, maxQueryLength: 420 },
  security: { limit: 40, windowMs: 60_000, maxUrlLength: 1024, maxQueryLength: 96 },
  contract: { limit: 35, windowMs: 60_000, maxUrlLength: 1400, maxQueryLength: 96 },
  osint: { limit: 35, windowMs: 60_000, maxUrlLength: 1200, maxQueryLength: 96 },
  default: { limit: 60, windowMs: 60_000, maxUrlLength: 1600, maxQueryLength: 96 },
};

function getHeader(request: Request, name: string) {
  return request.headers.get(name)?.trim() ?? "";
}

export function evaluateAbuseSignals(request: Request, query = "") {
  const notes: string[] = [];
  let abuseScore = 0;
  const ua = getHeader(request, "user-agent").toLowerCase();
  const accept = getHeader(request, "accept").toLowerCase();
  const url = request.url.toLowerCase();

  if (!ua) {
    abuseScore += 25;
    notes.push("missing_user_agent");
  }

  if (/(sqlmap|nikto|nmap|masscan|acunetix|wpscan|dirbuster|gobuster|python-requests|curl\/|wget\/)/i.test(ua)) {
    abuseScore += 50;
    notes.push("scanner_like_user_agent");
  }

  if (/(<script|javascript:|\\.env|wp-admin|phpmyadmin|etc\/passwd|cmd=|union\\s+select|base64,|%3cscript)/i.test(url)) {
    abuseScore += 70;
    notes.push("malicious_url_pattern");
  }

  if (query.length > 0 && /(seed phrase|private key|authorization bearer|\\.env|<script|javascript:)/i.test(query)) {
    abuseScore += 45;
    notes.push("sensitive_or_script_query");
  }

  if (accept && !accept.includes("application/json") && !accept.includes("*/*") && !accept.includes("image/") && !accept.includes("text/html")) {
    abuseScore += 10;
    notes.push("unusual_accept_header");
  }

  return { abuseScore, notes };
}

export async function applyApiAbuseShield(
  request: Request,
  profile: AbuseShieldProfile = "default",
  options: { queryParam?: string; keyPrefix?: string; allowEmptyQuery?: boolean; providerId?: string; userId?: string; allowedMethods?: string[] } = {},
): Promise<AbuseShieldDecision> {
  const trustedClient = requireTrustedRateLimitClient(
    request,
    `abuse-shield:${options.providerId ?? options.keyPrefix ?? profile}`,
  );
  if (!trustedClient.ok) return { ok: false, response: trustedClient.response };

  const allowedMethods = options.allowedMethods ?? ["GET"];
  const methodGuard = assertAllowedMethods(request, allowedMethods);
  if (methodGuard) {
    recordSecurityEvent({
      request,
      kind: "method_blocked",
      severity: "blocked",
      profile,
      abuseScore: 85,
      notes: ["method_not_allowed"],
      safeSummary: "Request method blocked before route execution.",
    });
    return { ok: false, response: methodGuard };
  }

  const limits = profileLimits[profile] ?? profileLimits.default;
  const sizeGuard = rejectOversizedUrl(request, limits.maxUrlLength);
  if (sizeGuard) {
    recordSecurityEvent({
      request,
      kind: "url_too_large",
      severity: "blocked",
      profile,
      abuseScore: 80,
      notes: ["url_too_large"],
      safeSummary: "Oversized URL blocked before route execution.",
    });
    return { ok: false, response: sizeGuard };
  }

  const url = new URL(request.url);
  const queryParam = options.queryParam ?? "query";
  const query = sanitizeBoundedParam(url.searchParams.get(queryParam), {
    maxLength: limits.maxQueryLength,
  });

  const signals = evaluateAbuseSignals(request, query);
  if (signals.abuseScore >= 70) {
    recordSecurityEvent({
      request,
      kind: "abuse_blocked",
      severity: "blocked",
      profile,
      abuseScore: signals.abuseScore,
      notes: signals.notes,
      safeSummary: "Request blocked by API Abuse Shield scoring.",
    });
    return {
      ok: false,
      response: securityJson({
        ok: false,
        mode: "abuse_shield_blocked",
        abuseScore: signals.abuseScore,
        notes: signals.notes,
      }, { status: 403 }),
    };
  }

  const boundary = buildPass632Boundary({
    route: new URL(request.url).pathname,
    provider: options.providerId ?? options.keyPrefix ?? profile,
    user: options.userId ?? "anonymous",
    client: trustedClient.durableClientKey,
  });
  const rateLimit = await applyDurableRateLimit({
    namespace: "velmere-api-abuse-shield",
    key: boundary.key,
    limit: signals.abuseScore >= 45 ? Math.max(5, Math.floor(limits.limit / 3)) : limits.limit,
    windowMs: limits.windowMs,
  });

  if (!rateLimit.ok) {
    const storageUnavailable = rateLimit.mode === "unavailable" || rateLimit.reason === "rate_limit_store_unavailable";
    recordSecurityEvent({
      request,
      kind: "rate_limited",
      severity: "blocked",
      profile,
      abuseScore: signals.abuseScore,
      notes: [...signals.notes, rateLimit.reason ?? "rate_limit_exceeded"],
      rateLimitMode: rateLimit.mode,
      provider: rateLimit.provider,
      safeSummary: "Request blocked by rate limit profile.",
    });
    return {
      ok: false,
      response: securityJson({
        ok: false,
        mode: storageUnavailable ? "rate_limit_storage_unavailable" : "rate_limited",
        profile,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        rateLimitMode: rateLimit.mode,
      }, {
        status: storageUnavailable ? 503 : 429,
        headers: buildDurableRateLimitHeaders(rateLimit),
      }),
    };
  }

  if (rateLimit.mode === "upstash_fallback_memory") {
    recordSecurityEvent({
      request,
      kind: "provider_fallback",
      severity: "review",
      profile,
      abuseScore: signals.abuseScore,
      notes: [...signals.notes, rateLimit.providerError ?? "provider_fallback"],
      rateLimitMode: rateLimit.mode,
      provider: rateLimit.provider,
      safeSummary: "Durable provider fallback used for rate-limit decision.",
    });
  } else if (signals.abuseScore >= 45) {
    recordSecurityEvent({
      request,
      kind: "suspicious_allowed",
      severity: "elevated",
      profile,
      abuseScore: signals.abuseScore,
      notes: signals.notes,
      rateLimitMode: rateLimit.mode,
      provider: rateLimit.provider,
      safeSummary: "Suspicious request allowed under stricter rate-limit profile.",
    });
  }

  if (!options.allowEmptyQuery && queryParam && !query && (profile === "search" || profile === "analyze")) {
    return {
      ok: true,
      query,
      rateLimit,
      abuseScore: signals.abuseScore,
      notes: [...signals.notes, "empty_query_allowed_by_route_fallback"],
    };
  }

  return { ok: true, query, rateLimit, abuseScore: signals.abuseScore, notes: signals.notes };
}

export function abuseShieldResponseHeaders(decision: Extract<AbuseShieldDecision, { ok: true }>) {
  return buildDurableRateLimitHeaders(decision.rateLimit);
}

export function abuseShieldResponseMeta(decision: Extract<AbuseShieldDecision, { ok: true }>) {
  return {
    abuseShield: {
      abuseScore: decision.abuseScore,
      notes: decision.notes,
      rateLimit: {
        mode: decision.rateLimit.mode,
        provider: decision.rateLimit.provider,
        providerError: decision.rateLimit.providerError,
        remaining: decision.rateLimit.remaining,
        resetAt: new Date(decision.rateLimit.resetAt).toISOString(),
        fixedWindowId: decision.rateLimit.fixedWindowId,
        degraded: decision.rateLimit.degraded,
      },
    },
  };
}

export function publicAbuseShieldResponseMeta() {
  return {
    abuseShield: {
      active: true,
      disclosure: "coarse_public_status_only",
    },
  };
}
