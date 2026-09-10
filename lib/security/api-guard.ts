import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
  inspectDurableRateLimitRuntime,
} from "@/lib/security/durable-rate-limit";
import { resolveCanonicalRequestOrigins } from "@/lib/security/api-edge-boundary";
import {
  buildPrivacyFingerprintReadiness,
  createPrivacyFingerprint,
} from "@/lib/security/privacy-fingerprint";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const DEFAULT_WINDOW_MS = 60_000;

export type ApiGuardOptions = {
  limit?: number;
  /** Legacy alias used by historical PASS API routes. */
  max?: number;
  windowMs?: number;
  keyPrefix?: string;
  /** Legacy aliases used by historical PASS API routes. */
  key?: string;
  bucket?: string;
};

const TRUSTED_ORIGIN_PROTOCOLS = new Set(["http:", "https:"]);

export const PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS = {
  cacheControl: "no-store",
  contentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  frameOptions: "DENY",
  robotsTag: "noindex, nofollow, noarchive",
  permissionsPolicy:
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  crossOriginResourcePolicy: "same-origin",
} as const;


export const PASS4198_DURABLE_RATE_LIMIT_RUNTIME_LOCK = {
  passId: "PASS4198_DURABLE_RATE_LIMIT_RUNTIME_LOCK",
  inMemoryMode: "qa_only_soft_limit",
  productionMissingDurableMode: "fail_closed",
  productionSoftLimiterMode: "fail_closed_even_when_durable_config_is_present",
  historicalUnsafeProductionModeRemoved: "memory_soft_limit_production_not_claimable",
  durableEnvSignals: [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "REDIS_URL",
  ],
} as const;

export function isVelmereProductionLikeRuntime() {
  // NODE_ENV is the deployment-mode boundary. Requiring a Vercel-only signal
  // here would silently downgrade a self-hosted production deployment to the
  // QA-only in-memory limiter.
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function isDurableRateLimitRequired() {
  return (
    isVelmereProductionLikeRuntime() ||
    process.env.VELMERE_REQUIRE_DURABLE_RATE_LIMIT === "true" ||
    process.env.VELMERE_REQUIRE_DURABLE_SECURITY_STATE === "true"
  );
}

export function hasDurableRateLimitSignal() {
  return inspectDurableRateLimitRuntime().upstashConfigured;
}

export function resolveRateLimitRuntimeMode() {
  const productionLike = isVelmereProductionLikeRuntime();
  const durableSignal = hasDurableRateLimitSignal();
  // This compatibility helper is deliberately synchronous and cannot consume
  // the atomic Upstash adapter. Any use in production therefore fails closed,
  // even when durable credentials are present. Production routes that need to
  // remain available must migrate to applyDurableRateLimit/applyWriteApiRateLimit.
  if (productionLike) {
    return durableSignal
      ? "durable_configured_sync_adapter_forbidden_fail_closed" as const
      : "durable_required_missing_fail_closed" as const;
  }
  if (durableSignal) return "durable_signal_present_soft_adapter_pending" as const;
  return "memory_soft_limit_qa" as const;
}

export function applySecurityJsonHeaders(headers: Headers) {
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.cacheControl);
  headers.set("x-content-type-options", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.contentTypeOptions);
  headers.set("referrer-policy", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.referrerPolicy);
  headers.set("x-frame-options", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.frameOptions);
  headers.set("x-robots-tag", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.robotsTag);
  headers.set("permissions-policy", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.permissionsPolicy);
  headers.set("cross-origin-resource-policy", PASS4197_SECURITY_JSON_RUNTIME_HARDENING_HEADERS.crossOriginResourcePolicy);
  return headers;
}

export function securityJson(body: unknown, init: ResponseInit = {}) {
  const headers = applySecurityJsonHeaders(new Headers(init.headers));
  return new Response(JSON.stringify(body, null, 2), { ...init, headers });
}

export function methodNotAllowed(allowed: string[]) {
  return securityJson(
    {
      ok: false,
      mode: "method_not_allowed",
      allowed,
    },
    {
      status: 405,
      headers: { allow: allowed.join(", ") },
    },
  );
}

export const PASS36_A75_TRUSTED_REQUEST_CLIENT_IDENTITY_BOUNDARY_ID = "velmere.pass36.a75.trusted-request-client-identity-boundary.v1" as const;

export type TrustedClientAddressResolution = {
  address: string | null;
  trusted: boolean;
  profile: "nonproduction_compat" | "vercel" | "untrusted";
  source: "x-vercel-forwarded-for" | "x-forwarded-for" | "x-real-ip" | "none";
  reason:
    | "nonproduction_compatibility"
    | "verified_vercel_profile"
    | "trusted_header_missing_or_invalid"
    | "trusted_proxy_profile_missing_or_unverified";
};

export type TrustedRequestClientIdentity = TrustedClientAddressResolution & {
  addressKey: string;
  userAgentFamily: "browser" | "automation" | "scanner" | "other" | "missing";
  privacyMaterial: string;
};

function normalizedIpv4(value: string) {
  const octets = value.split(".");
  if (octets.length !== 4) return null;
  if (!octets.every((octet) => /^\d{1,3}$/.test(octet))) return null;
  if (octets.some((octet) => octet.length > 1 && octet.startsWith("0"))) return null;
  if (octets.some((octet) => Number(octet) > 255)) return null;
  return octets.join(".");
}

function normalizedIp(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const candidate = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  const ipv4 = normalizedIpv4(candidate);
  if (ipv4) return ipv4;
  if (!candidate.includes(":") || /[%[\]/\\\s]/.test(candidate)) return null;
  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    const canonical = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1).toLowerCase()
      : null;
    if (!canonical) return null;
    const mapped = expandedIpv6Hextets(canonical);
    if (mapped && mapped.length === 8 && mapped.slice(0, 5).every((part) => part === 0) && mapped[5] === 0xffff) {
      return `${mapped[6] >> 8}.${mapped[6] & 0xff}.${mapped[7] >> 8}.${mapped[7] & 0xff}`;
    }
    return canonical;
  } catch {
    return null;
  }
}

function expandedIpv6Hextets(value: string) {
  const candidate = value.toLowerCase();
  if (!candidate.includes(":")) return null;
  const halves = candidate.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half: string) => {
    if (!half) return [] as number[];
    const parts = half.split(":");
    if (parts.some((part) => !/^[a-f0-9]{1,4}$/u.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 16));
  };
  const left = parseHalf(halves[0] ?? "");
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const zeroCount = 8 - left.length - right.length;
  if (zeroCount < 1) return null;
  return [...left, ...Array.from({ length: zeroCount }, () => 0), ...right];
}

/**
 * A single IPv6 subscriber normally controls many interface identifiers.
 * Keying abuse controls by a full /128 lets that subscriber manufacture a
 * fresh limiter bucket for every request, so production keys aggregate at /64.
 */
export function rateLimitAddressKey(address: string) {
  if (!address.includes(":")) return address;
  const hextets = expandedIpv6Hextets(address);
  if (!hextets || hextets.length !== 8) return null;
  return `${hextets.slice(0, 4).map((part) => part.toString(16)).join(":")}::/64`;
}

function compatibilityForwardedClientAddress(request: Request) {
  const forwarded = normalizedIp(request.headers.get("x-forwarded-for")?.split(",")[0]);
  if (forwarded) return { address: forwarded, source: "x-forwarded-for" as const };
  const realIp = normalizedIp(request.headers.get("x-real-ip"));
  return realIp ? { address: realIp, source: "x-real-ip" as const } : null;
}

function vercelForwardedClientAddress(request: Request) {
  const raw = request.headers.get("x-vercel-forwarded-for")?.trim() ?? "";
  if (!raw || raw.includes(",")) return null;
  const forwarded = normalizedIp(raw);
  return forwarded ? { address: forwarded, source: "x-vercel-forwarded-for" as const } : null;
}

/**
 * Forwarded client headers are meaningful only when a known deployment edge
 * overwrites them. Production must opt into an explicit profile and provide a
 * matching server-owned platform signal; raw request headers never establish
 * trust by themselves.
 */
export function resolveTrustedClientAddress(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): TrustedClientAddressResolution {
  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (!productionLike) {
    const forwarded = compatibilityForwardedClientAddress(request);
    return forwarded
      ? { ...forwarded, trusted: true, profile: "nonproduction_compat", reason: "nonproduction_compatibility" }
      : {
          address: null,
          trusted: true,
          profile: "nonproduction_compat",
          source: "none",
          reason: "trusted_header_missing_or_invalid",
        };
  }

  const profile = env.VELMERE_TRUSTED_PROXY_PROFILE?.trim().toLowerCase();
  const verifiedVercelProfile =
    profile === "vercel" &&
    env.VERCEL === "1" &&
    ["production", "preview", "development"].includes(env.VERCEL_ENV ?? "");
  if (!verifiedVercelProfile) {
    return {
      address: null,
      trusted: false,
      profile: "untrusted",
      source: "none",
      reason: "trusted_proxy_profile_missing_or_unverified",
    };
  }
  const forwarded = vercelForwardedClientAddress(request);
  return forwarded
    ? { ...forwarded, trusted: true, profile: "vercel", reason: "verified_vercel_profile" }
    : {
        address: null,
        trusted: true,
        profile: "vercel",
        source: "none",
        reason: "trusted_header_missing_or_invalid",
      };
}

function requestUserAgentFamily(value: string | null | undefined): TrustedRequestClientIdentity["userAgentFamily"] {
  const userAgent = String(value ?? "").slice(0, 256).toLowerCase();
  if (!userAgent) return "missing";
  if (/(sqlmap|nikto|nmap|masscan|acunetix|wpscan|dirbuster|gobuster)/u.test(userAgent)) return "scanner";
  if (/(curl|wget|python-requests|httpclient|bot|spider|crawler)/u.test(userAgent)) return "automation";
  if (/(chrome|safari|firefox|edg|opera)/u.test(userAgent)) return "browser";
  return "other";
}

export function resolveTrustedRequestClientIdentity(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): TrustedRequestClientIdentity {
  const resolution = resolveTrustedClientAddress(request, env);
  const address = resolution.address ?? (resolution.trusted ? "unknown" : "untrusted_proxy");
  const addressKey = rateLimitAddressKey(address) ?? "invalid_address";
  const userAgentFamily = requestUserAgentFamily(request.headers.get("user-agent"));
  return {
    ...resolution,
    addressKey,
    userAgentFamily,
    privacyMaterial: `${resolution.profile}:${resolution.source}:${addressKey}:${userAgentFamily}`,
  };
}

export function getClientKey(request: Request, prefix = "api") {
  const client = resolveTrustedRequestClientIdentity(request);
  if (client.profile !== "nonproduction_compat") return `${prefix}:${client.addressKey}`;
  return `${prefix}:${client.addressKey}:${client.userAgentFamily}`;
}

function durableRateLimitClientKey(
  resolution: TrustedClientAddressResolution,
  prefix: string,
) {
  const address = resolution.address ?? (resolution.trusted ? "unknown" : "untrusted_proxy");
  const addressKey = rateLimitAddressKey(address) ?? "invalid_address";
  return createPrivacyFingerprint(
    `velmere-rate-limit-client-v1:${prefix}:${resolution.profile}:${resolution.source}:${addressKey}`,
    "rlc",
  );
}

export function requireTrustedRateLimitClient(
  request: Request,
  privacyDomain = "rate-limit",
) {
  const resolution = resolveTrustedClientAddress(request);
  if (!isVelmereProductionLikeRuntime()) {
    return {
      ok: true as const,
      resolution,
      durableClientKey: durableRateLimitClientKey(resolution, `nonproduction:${privacyDomain}`),
    };
  }
  if (resolution.trusted && resolution.address && rateLimitAddressKey(resolution.address)) {
    const fingerprintReadiness = buildPrivacyFingerprintReadiness();
    if (fingerprintReadiness.productionReady) {
      return {
        ok: true as const,
        resolution,
        durableClientKey: durableRateLimitClientKey(resolution, `production:${privacyDomain}`),
      };
    }
    return {
      ok: false as const,
      response: securityJson(
        {
          ok: false,
          mode: "stable_rate_limit_client_fingerprint_unavailable",
          reason: "privacy_fingerprint_secret_missing_or_weak",
        },
        {
          status: 503,
          headers: {
            "retry-after": "60",
            "x-velmere-rate-limit-mode": "stable_client_fingerprint_required",
          },
        },
      ),
      resolution,
    };
  }
  return {
    ok: false as const,
    response: securityJson(
      {
        ok: false,
        mode: "trusted_client_address_unavailable",
        proxyProfile: resolution.profile,
        reason: resolution.reason,
      },
      {
        status: 503,
        headers: {
          "retry-after": "60",
          "x-velmere-rate-limit-mode": "trusted_client_address_required",
        },
      },
    ),
    resolution,
  };
}

export function applySoftRateLimit(request: Request, options: ApiGuardOptions = {}) {
  const runtimeMode = resolveRateLimitRuntimeMode();
  if (
    runtimeMode === "durable_required_missing_fail_closed" ||
    runtimeMode === "durable_configured_sync_adapter_forbidden_fail_closed"
  ) {
    return {
      ok: false as const,
      response: securityJson(
        {
          ok: false,
          mode: "rate_limit_storage_unavailable",
          storageMode: runtimeMode,
          remediation: "replace the synchronous soft limiter with applyDurableRateLimit/applyWriteApiRateLimit before production promotion",
        },
        {
          status: 503,
          headers: {
            "retry-after": "60",
            "x-velmere-rate-limit-mode": runtimeMode,
          },
        },
      ),
    };
  }

  const limit = Math.max(1, options.limit ?? options.max ?? 60);
  const windowMs = Math.max(1_000, options.windowMs ?? DEFAULT_WINDOW_MS);
  const key = getClientKey(request, options.keyPrefix ?? options.key ?? options.bucket ?? "api");
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, resetAt: now + windowMs };
  }

  current.count += 1;
  if (current.count > limit) {
    return {
      ok: false as const,
      response: securityJson(
        {
          ok: false,
          mode: "rate_limited",
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        },
        {
          status: 429,
          headers: {
            "retry-after": String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))),
            "ratelimit-limit": String(limit),
            "ratelimit-remaining": "0",
            "ratelimit-reset": String(Math.ceil(current.resetAt / 1000)),
            "x-ratelimit-limit": String(limit),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.ceil(current.resetAt / 1000)),
          },
        },
      ),
    };
  }

  return { ok: true as const, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

/**
 * Production-safe replacement for the historical synchronous soft limiter.
 * It preserves the route-facing result shape while using the atomic durable
 * adapter in production and the explicitly QA-only memory adapter elsewhere.
 */
export async function applyApiRateLimit(request: Request, options: ApiGuardOptions = {}) {
  const keyPrefix = options.keyPrefix ?? options.key ?? options.bucket ?? "api";
  const trustedClient = requireTrustedRateLimitClient(request, `api-guard:${keyPrefix}`);
  if (!trustedClient.ok) {
    return {
      ok: false as const,
      response: trustedClient.response,
      clientResolution: trustedClient.resolution,
    };
  }
  const limit = Math.max(1, options.limit ?? options.max ?? 60);
  const windowMs = Math.max(1_000, options.windowMs ?? DEFAULT_WINDOW_MS);
  const decision = await applyDurableRateLimit({
    namespace: `velmere-api-guard:${keyPrefix}`,
    key: `${new URL(request.url).pathname}:${trustedClient.durableClientKey}`,
    limit,
    windowMs,
  });
  if (!decision.ok) {
    const storageUnavailable = decision.mode === "unavailable" || decision.reason === "rate_limit_store_unavailable";
    return {
      ok: false as const,
      response: securityJson(
        {
          ok: false,
          mode: storageUnavailable ? "rate_limit_storage_unavailable" : "rate_limited",
          retryAfterSeconds: decision.retryAfterSeconds,
          storageMode: decision.mode,
        },
        {
          status: storageUnavailable ? 503 : 429,
          headers: buildDurableRateLimitHeaders(decision),
        },
      ),
      decision,
    };
  }
  return {
    ok: true as const,
    remaining: decision.remaining,
    resetAt: decision.resetAt,
    decision,
    headers: buildDurableRateLimitHeaders(decision),
  };
}

export function sanitizeBoundedParam(value: string | null, options: { maxLength?: number; fallback?: string } = {}) {
  const maxLength = Math.max(1, options.maxLength ?? 96);
  const fallback = options.fallback ?? "";
  const clean = (value ?? fallback)
    .replace(ASCII_CONTROL_PATTERN, "")
    .replace(/[<>`]/g, "")
    .trim()
    .slice(0, maxLength);
  return clean || fallback;
}

export function rejectOversizedUrl(request: Request, maxLength = 2048) {
  if (request.url.length <= maxLength) return null;
  return securityJson({ ok: false, mode: "url_too_large" }, { status: 414 });
}

export function assertGetRequest(request: Request) {
  if (request.method === "GET") return null;
  return methodNotAllowed(["GET"]);
}

export function assertAllowedMethods(request: Request, allowed: string[]) {
  if (allowed.includes(request.method)) return null;
  return methodNotAllowed(allowed);
}

export function rejectLargeContentLength(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    return securityJson({ ok: false, mode: "content_length_invalid" }, { status: 400 });
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    return securityJson({ ok: false, mode: "content_length_invalid" }, { status: 400 });
  }
  if (parsed <= maxBytes) return null;
  return securityJson(
    { ok: false, mode: "payload_too_large", maxBytes },
    { status: 413 },
  );
}

export function assertSameOriginRequest(
  request: Request,
  options: { allowMissingOrigin?: boolean } = {},
) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return options.allowMissingOrigin
      ? null
      : securityJson({ ok: false, mode: "origin_required" }, { status: 403 });
  }

  try {
    const originUrl = new URL(origin);
    const configured = resolveCanonicalRequestOrigins(request);
    if (configured.invalidConfigured.length || configured.origins.size === 0) {
      return securityJson({ ok: false, mode: "canonical_origin_unavailable" }, { status: 503 });
    }
    if (!TRUSTED_ORIGIN_PROTOCOLS.has(originUrl.protocol)) {
      return securityJson({ ok: false, mode: "origin_rejected" }, { status: 403 });
    }
    if (!configured.origins.has(originUrl.origin)) {
      return securityJson({ ok: false, mode: "cross_origin_blocked" }, { status: 403 });
    }
    return null;
  } catch {
    return securityJson({ ok: false, mode: "invalid_origin" }, { status: 400 });
  }
}

export function sanitizeEmailAddress(value: string | null, maxLength = 160) {
  const clean = sanitizeBoundedParam(value, { maxLength, fallback: "" }).toLowerCase();
  if (!clean) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : "";
}
