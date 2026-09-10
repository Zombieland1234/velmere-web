import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import { sha256Token } from "@/lib/security/cryptographic-digest";

export const PASS632_RATE_LIMIT_VERSION = "production-rate-limit-adapter" as const;

export type Pass632BoundaryInput = {
  route: string;
  provider?: string | null;
  user?: string | null;
  client?: string | null;
};

export type Pass632Boundary = {
  version: typeof PASS632_RATE_LIMIT_VERSION;
  key: string;
  routeHash: string;
  providerHash: string;
  userHash: string;
  clientHash: string;
  publicLabel: string;
};

export type Pass632Window = {
  windowId: number;
  bucketKey: string;
  resetAt: number;
  windowMs: number;
};

export type Pass632HeaderInput = {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
  mode: string;
  degraded?: boolean;
};

function cleanDimension(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? fallback)
    .replace(ASCII_CONTROL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return normalized || fallback;
}

export function pass632StableHash(value: string) {
  return sha256Token(value, 24);
}

export function buildPass632Boundary(input: Pass632BoundaryInput): Pass632Boundary {
  const route = cleanDimension(input.route, "unknown-route").split("?")[0];
  const provider = cleanDimension(input.provider, "route-provider");
  const user = cleanDimension(input.user, "anonymous");
  const client = cleanDimension(input.client, "unknown-client");
  const routeHash = pass632StableHash(route);
  const providerHash = pass632StableHash(provider);
  const userHash = pass632StableHash(user);
  const clientHash = pass632StableHash(client);

  return {
    version: PASS632_RATE_LIMIT_VERSION,
    key: `r_${routeHash}:p_${providerHash}:u_${userHash}:c_${clientHash}`,
    routeHash,
    providerHash,
    userHash,
    clientHash,
    publicLabel: `${routeHash}:${providerHash}:${userHash}`,
  };
}

export function buildPass632FixedWindow(input: {
  key: string;
  nowMs?: number;
  windowMs: number;
}): Pass632Window {
  const now = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const windowMs = Math.max(1_000, Math.round(input.windowMs));
  const windowId = Math.floor(now / windowMs);
  const resetAt = (windowId + 1) * windowMs;
  return {
    windowId,
    bucketKey: `${cleanDimension(input.key, "rate-limit")}:w${windowId}`,
    resetAt,
    windowMs,
  };
}

export function pass632DeterministicJitterMs(key: string, ceilingMs: number) {
  const ceiling = Math.max(0, Math.round(ceilingMs));
  if (ceiling === 0) return 0;
  return Number.parseInt(pass632StableHash(key).slice(-6), 16) % (ceiling + 1);
}

export function buildPass632RecoveryDelay(input: {
  key: string;
  consecutiveFailures: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryAfterSeconds?: number;
}) {
  const failures = Math.max(0, Math.min(8, Math.floor(input.consecutiveFailures)));
  const base = Math.max(250, Math.round(input.baseDelayMs ?? 1_000));
  const max = Math.max(base, Math.round(input.maxDelayMs ?? 30_000));
  const retryFloor = Math.max(0, Math.round((input.retryAfterSeconds ?? 0) * 1_000));
  const exponential = Math.min(max, base * 2 ** failures);
  const jitter = pass632DeterministicJitterMs(`${input.key}:${failures}`, Math.min(1_500, Math.round(exponential * 0.25)));
  return Math.min(max, Math.max(retryFloor, exponential) + jitter);
}

export function buildPass632RateLimitHeaders(input: Pass632HeaderInput) {
  const now = Date.now();
  const retryAfterSeconds = Math.max(
    0,
    Math.round(
      input.retryAfterSeconds ?? Math.max(0, Math.ceil((input.resetAt - now) / 1_000)),
    ),
  );
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(Math.max(1, Math.round(input.limit))),
    "x-ratelimit-remaining": String(Math.max(0, Math.round(input.remaining))),
    "x-ratelimit-reset": String(Math.max(0, Math.ceil(input.resetAt / 1_000))),
    "x-velmere-rate-limit-mode": cleanDimension(input.mode, "unknown").slice(0, 64),
    "x-velmere-degraded": input.degraded ? "1" : "0",
  };
  if (retryAfterSeconds > 0) headers["retry-after"] = String(retryAfterSeconds);
  return headers;
}
