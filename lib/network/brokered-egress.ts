import {
  enforceSafeEgressResponseLimit,
  resolveSafeEgressTarget,
  safeEgressFetch,
  type SafeEgressPolicy,
  VelmereEgressPolicyError,
} from "./safe-egress";
import type { VelmereFetchRequestInit } from "./fetch-with-deadline";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  R7_ECB_POLICY_REVIEW_SHA256,
  inspectR7EcbStatisticsPolicyReceiptBytes,
} from "@/lib/compliance/ecb-statistics-policy-receipt";

export const PASS4825_BROKERED_EGRESS_ID = "pass4825-brokered-egress-v1" as const;

const PROFILE_POLICY = {
  alpha_vantage: { hosts: ["www.alphavantage.co"], methods: ["GET", "HEAD"] },
  audit_provider_runtime: { hosts: [
    "api.etherscan.io",
    "api.dexscreener.com",
    "api.gopluslabs.io",
    "api.honeypot.is",
    "api.coingecko.com",
    "sourcify.dev",
  ], methods: ["GET", "HEAD"] },
  binance_spot: { hosts: [
    "api.binance.com",
    "api-gcp.binance.com",
    "api1.binance.com",
    "api2.binance.com",
    "api3.binance.com",
    "api4.binance.com",
  ], methods: ["GET", "HEAD"] },
  coingecko: { hosts: ["api.coingecko.com"], methods: ["GET", "HEAD"] },
  defi_llama: { hosts: ["api.llama.fi", "pro-api.llama.fi"], methods: ["GET", "HEAD"] },
  derivatives: { hosts: ["fapi.binance.com", "api.bybit.com"], methods: ["GET", "HEAD"] },
  ecb_statistics: { hosts: ["data-api.ecb.europa.eu"], methods: ["GET", "HEAD"] },
  dex_screener: { hosts: ["api.dexscreener.com"], methods: ["GET", "HEAD"] },
  gecko_terminal: { hosts: ["api.geckoterminal.com"], methods: ["GET", "HEAD"] },
  gemini: { hosts: ["generativelanguage.googleapis.com"], methods: ["POST"] },
  goplus: { hosts: ["api.gopluslabs.io"], methods: ["GET", "HEAD"] },
  market_intelligence: { hosts: [
    "api.binance.com",
    "api.exchange.coinbase.com",
    "api.kraken.com",
    "api.mexc.com",
    "api.etherscan.io",
  ], methods: ["GET", "HEAD", "POST"] },
  real_markets: { hosts: ["stooq.com", "query1.finance.yahoo.com"], methods: ["GET", "HEAD"] },
  sec_edgar: { hosts: ["data.sec.gov"], methods: ["GET", "HEAD"] },
  twelve_data: { hosts: ["api.twelvedata.com"], methods: ["GET", "HEAD"] },
  venue_health: { hosts: ["data-api.binance.vision", "api.mexc.com", "api.exchange.coinbase.com"], methods: ["GET", "HEAD"] },
  public_probe: { hosts: ["query1.finance.yahoo.com", "api.binance.com"], methods: ["GET", "HEAD"] },
  pyth_hermes: { hosts: ["pyth.dourolabs.app", "hermes.pyth.network"], methods: ["GET", "HEAD"] },
  printful: { hosts: ["api.printful.com"], methods: ["GET", "POST"] },
  resend: { hosts: ["api.resend.com"], methods: ["POST"] },
} as const satisfies Record<string, { hosts: readonly string[]; methods: readonly string[] }>;

export type Pass4825EgressProfile = keyof typeof PROFILE_POLICY;

const RIGHTS_GATED_PROVIDER_PROFILES = new Set<Pass4825EgressProfile>([
  "alpha_vantage",
  "audit_provider_runtime",
  "binance_spot",
  "coingecko",
  "defi_llama",
  "derivatives",
  "ecb_statistics",
  "dex_screener",
  "gecko_terminal",
  "gemini",
  "goplus",
  "market_intelligence",
  "public_probe",
  "pyth_hermes",
  "real_markets",
  "sec_edgar",
  "twelve_data",
  "venue_health",
]);

export type Pass4825BrokeredEgressOptions = {
  profile: Pass4825EgressProfile;
  operation: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
};

const PASS69_ECB_REFERENCE_DATA_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+PLN+GBP+TRY.EUR.SP00.A?lastNObservations=3&format=csvdata" as const;
const PASS69_ECB_REFERENCE_OPERATION = "pass69_ecb_reference_fx" as const;
const PASS69_ECB_REUSE_POLICY_URL = "https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html" as const;
const PASS69_ECB_REUSE_POLICY_REVIEWED_AT = "2026-08-24T16:25:00.000Z" as const;
const PASS69_ECB_REUSE_POLICY_VALID_UNTIL = "2026-08-31T23:59:59.999Z" as const;
const PASS69_ECB_REQUIRED_ATTRIBUTION = "Source: ECB statistics." as const;
const PASS69_ECB_ALLOWED_FIELD_IDS = ["market.reference_rate", "market.reference_date"] as const;

export type Pass69EcbStatisticsRightsManifest = Readonly<{
  sourceDataUrl: string;
  usagePolicyUrl: string;
  usagePolicyReviewedAt: string;
  usagePolicyValidUntil: string;
  rightsReceiptSha256: string;
  attribution: string;
  allowedFieldIds: readonly string[];
}>;

type Pass69EcbStatisticsEgressCapability = Readonly<{
  profile: "ecb_statistics";
  operation: typeof PASS69_ECB_REFERENCE_OPERATION;
  sourceDataUrl: typeof PASS69_ECB_REFERENCE_DATA_URL;
  method: "GET";
  issuedAtMs: number;
  expiresAtMs: number;
}>;

// A plain object that merely looks like this capability is never accepted. The
// private WeakSet makes issuance non-forgeable outside this module, and delete()
// makes every capability single-use (including a retry).
const pass69EcbStatisticsEgressCapabilities = new WeakSet<object>();

function sameExactStrings(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function issuePass69EcbStatisticsEgressCapability(
  manifest: Pass69EcbStatisticsRightsManifest,
  nowMs: number = Date.now(),
): Pass69EcbStatisticsEgressCapability {
  const reviewedAtMs = Date.parse(manifest.usagePolicyReviewedAt);
  const validUntilMs = Date.parse(manifest.usagePolicyValidUntil);
  const physicalReceipt = inspectR7EcbStatisticsPolicyReceiptBytes();
  const manifestMatches = manifest.sourceDataUrl === PASS69_ECB_REFERENCE_DATA_URL
    && manifest.usagePolicyUrl === PASS69_ECB_REUSE_POLICY_URL
    && manifest.usagePolicyReviewedAt === PASS69_ECB_REUSE_POLICY_REVIEWED_AT
    && manifest.usagePolicyValidUntil === PASS69_ECB_REUSE_POLICY_VALID_UNTIL
    && manifest.rightsReceiptSha256 === R7_ECB_POLICY_REVIEW_SHA256
    && manifest.attribution === PASS69_ECB_REQUIRED_ATTRIBUTION
    && sameExactStrings(manifest.allowedFieldIds, PASS69_ECB_ALLOWED_FIELD_IDS);
  if (
    !manifestMatches
    || !physicalReceipt.valid
    || physicalReceipt.sha256 !== R7_ECB_POLICY_REVIEW_SHA256
    || !physicalReceipt.importedJsonMatches
    || !Number.isFinite(reviewedAtMs)
    || !Number.isFinite(validUntilMs)
    || validUntilMs <= reviewedAtMs
    || nowMs < reviewedAtMs
    || nowMs > validUntilMs
  ) {
    throw new VelmereEgressPolicyError(
      "provider_rights_not_verified",
      "ECB statistics egress requires the exact current, bounded reference-field rights authority.",
    );
  }
  const capability = Object.freeze({
    profile: "ecb_statistics" as const,
    operation: PASS69_ECB_REFERENCE_OPERATION,
    sourceDataUrl: PASS69_ECB_REFERENCE_DATA_URL,
    method: "GET" as const,
    issuedAtMs: nowMs,
    expiresAtMs: validUntilMs,
  });
  pass69EcbStatisticsEgressCapabilities.add(capability);
  return capability;
}

export type Pass4825ConfiguredOriginProfile = "supabase" | "upstash_rest";
export type Pass4825ConfiguredEgressEnvironment = Readonly<{
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  KV_REST_API_URL?: string;
}>;
export type Pass4825ConfiguredEgressOptions = Omit<Pass4825BrokeredEgressOptions, "profile"> & {
  configuredProfile: Pass4825ConfiguredOriginProfile;
  environment?: Pass4825ConfiguredEgressEnvironment;
};

type NextCacheInit = VelmereFetchRequestInit;
type CacheEntry = {
  expiresAt: number;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: Uint8Array | null;
};
export type Pass4825BrokeredEgressTestTransport = (
  input: URL,
  init: VelmereFetchRequestInit,
  context: Readonly<{ operation: string; maxRequestBytes: number; maxResponseBytes: number }>,
) => Promise<Response>;
const brokeredEgressTestTransport = new AsyncLocalStorage<Pass4825BrokeredEgressTestTransport>();
const responseCache = new Map<string, CacheEntry>();
let responseCacheBytes = 0;
const MAX_RESPONSE_CACHE_ENTRIES = 64;
const MAX_RESPONSE_CACHE_BYTES = 32 * 1_048_576;
const MAX_CACHEABLE_RESPONSE_BYTES = 2 * 1_048_576;
const DEFAULT_MAX_REDIRECTS = 0;
const DEFAULT_MAX_RESPONSE_BYTES = 2_097_152;

function boundedPolicyInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : fallback;
}

function effectiveMaxRedirects(options: { maxRedirects?: number }) {
  return boundedPolicyInteger(options.maxRedirects, DEFAULT_MAX_REDIRECTS, 0, 5);
}

function effectiveMaxResponseBytes(options: { maxResponseBytes?: number }) {
  return boundedPolicyInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1_024, 16_777_216);
}

function effectiveTimeoutMs(options: { timeoutMs?: number }, fallback: number) {
  return boundedPolicyInteger(options.timeoutMs, fallback, 250, 60_000);
}

function effectiveMaxRequestBytes(options: { maxRequestBytes?: number }, fallback: number) {
  return boundedPolicyInteger(options.maxRequestBytes, fallback, 0, 16_777_216);
}

function hasRequestBody(init: RequestInit) {
  return init.body !== undefined && init.body !== null;
}

function assertMethodBodyInvariant(init: RequestInit) {
  const method = (init.method ?? "GET").toUpperCase();
  if ((method === "GET" || method === "HEAD") && hasRequestBody(init)) {
    throw new VelmereEgressPolicyError(
      "egress_method_rejected",
      "Brokered GET and HEAD requests must not carry a request body.",
    );
  }
}

function assertPolicyRequestInvariant(init: RequestInit, policy: SafeEgressPolicy) {
  const method = (init.method ?? "GET").toUpperCase();
  const allowedMethods = new Set((policy.allowedMethods ?? ["GET", "HEAD"]).map((entry) => entry.toUpperCase()));
  if (!allowedMethods.has(method)) {
    throw new VelmereEgressPolicyError("egress_method_rejected", `Method ${method} is not permitted by the egress policy.`);
  }
  const maxRequestBytes = boundedPolicyInteger(policy.maxRequestBytes, 0, 0, 16_777_216);
  const bodyBytes = typeof init.body === "string"
    ? Buffer.byteLength(init.body, "utf8")
    : init.body instanceof Uint8Array
      ? init.body.byteLength
      : init.body == null
        ? 0
        : maxRequestBytes + 1;
  if (bodyBytes > maxRequestBytes) {
    throw new VelmereEgressPolicyError(
      "egress_method_rejected",
      `Request body exceeds ${maxRequestBytes} bytes or uses an unsupported type.`,
    );
  }
}

/**
 * Async-scoped transport seam for deterministic no-socket tests. Production
 * modules never call this helper; the PASS4825 inventory enforces that rule.
 * URL, method, request-size and response-size policies remain active.
 */
export function withPass4825BrokeredEgressTestTransport<T>(
  transport: Pass4825BrokeredEgressTestTransport,
  execute: () => T,
) {
  return brokeredEgressTestTransport.run(transport, execute);
}

export function hasBrokeredEgressTestTransport(): boolean {
  return Boolean(brokeredEgressTestTransport.getStore());
}

async function dispatchBrokeredTransport(
  input: string | URL,
  init: VelmereFetchRequestInit,
  policy: SafeEgressPolicy,
) {
  const testTransport = brokeredEgressTestTransport.getStore();
  if (!testTransport) return safeEgressFetch(input, init, policy);
  assertPolicyRequestInvariant(init, policy);
  const target = await resolveSafeEgressTarget(input, policy, {
    resolver: async () => [{ address: "93.184.216.34", family: 4 as const }],
  });
  const timeoutMs = boundedPolicyInteger(policy.timeoutMs, 8_000, 250, 30_000);
  const maxRequestBytes = boundedPolicyInteger(policy.maxRequestBytes, 0, 0, 16_777_216);
  const maxResponseBytes = boundedPolicyInteger(policy.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1_024, 16_777_216);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new VelmereEgressPolicyError(
        "egress_timeout",
        `${policy.operation ?? "brokered_test_transport"} exceeded ${timeoutMs}ms.`,
      )), timeoutMs);
    });
    const response = await Promise.race([
      testTransport(target.url, init, {
        operation: policy.operation ?? "brokered_test_transport",
        maxRequestBytes,
        maxResponseBytes,
      }),
      timeout,
    ]);
    return enforceSafeEgressResponseLimit(response, maxResponseBytes);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function configuredMarketIntelligenceOrigins() {
  return ["ALCHEMY_ETH_RPC_URL", "ALCHEMY_BASE_RPC_URL", "ALCHEMY_ARBITRUM_RPC_URL", "ALCHEMY_OPTIMISM_RPC_URL", "ALCHEMY_POLYGON_RPC_URL"]
    .flatMap((name) => {
      const raw = process.env[name]?.trim();
      if (!raw) return [];
      try {
        const url = new URL(raw);
        return url.protocol === "https:" && !url.username && !url.password && !url.port
          && (url.hostname === "g.alchemy.com" || url.hostname.endsWith(".g.alchemy.com"))
          ? [url.origin]
          : [];
      } catch {
        return [];
      }
    });
}

function normalizedConfiguredHost(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VelmereEgressPolicyError("egress_host_rejected", "Configured egress origin is not a valid URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new VelmereEgressPolicyError(
      "egress_host_rejected",
      "Configured egress origins must be credential-free HTTPS origins without path, query, fragment, or explicit port.",
    );
  }
  return url.hostname.toLowerCase().replace(/\.$/, "");
}

function profilePolicy(options: Pass4825BrokeredEgressOptions): SafeEgressPolicy {
  const profile = PROFILE_POLICY[options.profile];
  const policyOrigins = options.profile === "market_intelligence" ? configuredMarketIntelligenceOrigins() : [];
  const configuredHosts = policyOrigins.map(normalizedConfiguredHost);
  const allowedHosts = Array.from(new Set([...profile.hosts, ...configuredHosts]));
  return {
    allowedHosts,
    allowSubdomains: false,
    allowedMethods: profile.methods,
    maxRedirects: effectiveMaxRedirects(options),
    timeoutMs: effectiveTimeoutMs(options, 8_000),
    maxRequestBytes: effectiveMaxRequestBytes(
      options,
      profile.methods.some((method: string) => method === "POST") ? 1_048_576 : 0,
    ),
    maxResponseBytes: effectiveMaxResponseBytes(options),
    operation: `${PASS4825_BROKERED_EGRESS_ID}:${options.profile}:${options.operation}`,
  };
}

function cacheTtlMs(init: NextCacheInit) {
  const method = (init.method ?? "GET").toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || hasRequestBody(init) || init.cache === "no-store") return 0;
  const revalidate = init.next?.revalidate;
  if (revalidate === false || init.cache === "force-cache") return Number.POSITIVE_INFINITY;
  return typeof revalidate === "number" && Number.isFinite(revalidate) && revalidate > 0
    ? Math.min(revalidate, 24 * 60 * 60) * 1_000
    : 0;
}

function normalizedCacheSemantics(init: NextCacheInit) {
  const ttlMs = cacheTtlMs(init);
  return {
    ttlMs,
    mode: ttlMs === 0
      ? "disabled" as const
      : ttlMs === Number.POSITIVE_INFINITY
        ? "persistent" as const
        : "revalidate" as const,
    keyTtl: ttlMs === Number.POSITIVE_INFINITY ? "infinite" as const : ttlMs,
  };
}

function cacheKey(
  input: string | URL,
  init: RequestInit,
  options: Pass4825BrokeredEgressOptions,
  semantics: ReturnType<typeof normalizedCacheSemantics>,
) {
  const headers = Array.from(new Headers(init.headers).entries()).sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([
    options.profile,
    String(input),
    (init.method ?? "GET").toUpperCase(),
    headers,
    effectiveMaxResponseBytes(options),
    effectiveMaxRedirects(options),
    semantics.mode,
    semantics.keyTtl,
  ])).digest("hex");
}

/**
 * Exposes the production cache partition calculation for mutation-focused
 * verification without opening a socket or exposing cached response data.
 */
export function inspectPass4825BrokeredEgressCachePartition(
  input: string | URL,
  init: RequestInit = {},
  options: Pass4825BrokeredEgressOptions,
) {
  const semantics = normalizedCacheSemantics(init as NextCacheInit);
  return {
    cacheable: semantics.ttlMs > 0,
    mode: semantics.mode,
    effectiveTtlMs: semantics.keyTtl,
    effectiveMaxRedirects: effectiveMaxRedirects(options),
    effectiveMaxResponseBytes: effectiveMaxResponseBytes(options),
    key: semantics.ttlMs > 0 ? cacheKey(input, init, options, semantics) : null,
  } as const;
}

function removeCacheEntry(key: string) {
  const entry = responseCache.get(key);
  if (!entry) return;
  responseCacheBytes = Math.max(0, responseCacheBytes - (entry.body?.byteLength ?? 0));
  responseCache.delete(key);
}

function pruneResponseCache(now: number) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) removeCacheEntry(key);
  }
  while (responseCache.size > MAX_RESPONSE_CACHE_ENTRIES || responseCacheBytes > MAX_RESPONSE_CACHE_BYTES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    removeCacheEntry(oldestKey);
  }
}

function responseFromCache(entry: CacheEntry) {
  return new Response(entry.body?.slice() ?? null, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

function configuredStorageOrigins(
  profile: Pass4825ConfiguredOriginProfile,
  environment: Pass4825ConfiguredEgressEnvironment = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
  },
) {
  const names = profile === "supabase"
    ? ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const
    : ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"] as const;
  return names.flatMap((name) => {
    const raw = environment[name]?.trim();
    if (!raw) return [];
    normalizedConfiguredHost(raw);
    return [new URL(raw).origin];
  });
}

/**
 * The only production provider transport added in PASS4825. Callers select a
 * compile-time profile; they cannot manufacture an allowlist from the requested
 * URL. Optional configured origins are reserved for server-owned provider URLs
 * supplied by trusted deployment configuration and remain HTTPS/DNS/private-IP
 * checked by the pinned transport.
 */
async function brokeredEgressFetchWithCapability(
  input: string | URL,
  init: VelmereFetchRequestInit = {},
  options: Pass4825BrokeredEgressOptions,
  ecbStatisticsCapability?: Pass69EcbStatisticsEgressCapability,
) {
  assertMethodBodyInvariant(init);
  const testTransportActive = brokeredEgressTestTransport.getStore() !== undefined;
  const method = (init.method ?? "GET").toUpperCase();
  if (options.profile === "ecb_statistics") {
    const target = input instanceof URL ? input.toString() : input;
    const headers = Array.from(new Headers(init.headers).entries());
    const requestMatchesCapability = ecbStatisticsCapability?.profile === "ecb_statistics"
      && ecbStatisticsCapability.operation === PASS69_ECB_REFERENCE_OPERATION
      && ecbStatisticsCapability.sourceDataUrl === PASS69_ECB_REFERENCE_DATA_URL
      && ecbStatisticsCapability.method === "GET"
      && ecbStatisticsCapability.expiresAtMs >= (testTransportActive ? ecbStatisticsCapability.issuedAtMs : Date.now())
      && target === PASS69_ECB_REFERENCE_DATA_URL
      && method === "GET"
      && init.cache === "no-store"
      && !hasRequestBody(init)
      && (init.redirect === undefined || init.redirect === "error")
      && options.operation === PASS69_ECB_REFERENCE_OPERATION
      && options.maxRedirects === 0
      && options.timeoutMs === 8_000
      && options.maxRequestBytes === 0
      && options.maxResponseBytes === 1_000_000
      && headers.length === 2
      && headers[0]?.[0] === "accept"
      && headers[0]?.[1] === "text/csv,application/vnd.sdmx.data+csv"
      && headers[1]?.[0] === "user-agent"
      && headers[1]?.[1] === "Velmere-ECB-Reference/1.0";
    const capabilityWasLive = ecbStatisticsCapability !== undefined
      && pass69EcbStatisticsEgressCapabilities.delete(ecbStatisticsCapability);
    if (!capabilityWasLive || !requestMatchesCapability) {
      throw new VelmereEgressPolicyError(
        "provider_rights_capability_required",
        "ECB statistics egress is restricted to the one-shot, exact official-reference capability.",
      );
    }
  }
  if (
    (options.profile === "printful" || options.profile === "resend")
    && method !== "GET"
    && method !== "HEAD"
    && !testTransportActive
  ) {
    throw new VelmereEgressPolicyError(
      "provider_effect_atomicity_not_verified",
      `Mutating provider egress profile ${options.profile} is blocked until its durable outbox, native idempotency and crash-recovery receipt are verified.`,
    );
  }
  if (options.profile !== "ecb_statistics" && RIGHTS_GATED_PROVIDER_PROFILES.has(options.profile) && !testTransportActive && process.env.NODE_ENV === "production") {
    throw new VelmereEgressPolicyError(
      "provider_rights_not_verified",
      `Provider egress profile ${options.profile} is blocked until signed, current runtime rights authority is verified.`,
    );
  }
  const cachePartition = inspectPass4825BrokeredEgressCachePartition(input, init, options);
  const ttlMs = cachePartition.effectiveTtlMs === "infinite"
    ? Number.POSITIVE_INFINITY
    : cachePartition.effectiveTtlMs;
  const key = testTransportActive ? null : cachePartition.key;
  const now = Date.now();
  pruneResponseCache(now);
  const cached = key ? responseCache.get(key) : null;
  if (cached && cached.expiresAt > now) {
    responseCache.delete(key!);
    responseCache.set(key!, cached);
    return responseFromCache(cached);
  }
  if (cached) removeCacheEntry(key!);
  const response = await dispatchBrokeredTransport(input, init, profilePolicy(options));
  if (key && response.ok) {
    const body = response.body === null ? null : new Uint8Array(await response.clone().arrayBuffer());
    if ((body?.byteLength ?? 0) <= MAX_CACHEABLE_RESPONSE_BYTES) {
      const existing = responseCache.get(key);
      if (existing) removeCacheEntry(key);
      responseCache.set(key, {
        expiresAt: ttlMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + ttlMs,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        body,
      });
      responseCacheBytes += body?.byteLength ?? 0;
      pruneResponseCache(Date.now());
    }
  }
  return response;
}

export function brokeredEgressFetch(
  input: string | URL,
  init: VelmereFetchRequestInit = {},
  options: Pass4825BrokeredEgressOptions,
) {
  return brokeredEgressFetchWithCapability(input, init, options);
}

/**
 * The sole ECB network entry point. Its caller supplies the current reviewed
 * rights facts, but cannot choose a URL, operation, method, headers, cache
 * semantics, redirect policy, byte limits or capability. A fresh private
 * capability is issued and consumed for each invocation, so a retry is a new
 * rights decision rather than reuse of a previously-authorized request.
 */
export async function fetchPass69EcbOfficialReferenceData(
  rightsManifest: Pass69EcbStatisticsRightsManifest,
  nowMs: number = Date.now(),
) {
  const capability = issuePass69EcbStatisticsEgressCapability(rightsManifest, nowMs);
  return brokeredEgressFetchWithCapability(PASS69_ECB_REFERENCE_DATA_URL, {
    method: "GET",
    headers: {
      accept: "text/csv,application/vnd.sdmx.data+csv",
      "user-agent": "Velmere-ECB-Reference/1.0",
    },
    cache: "no-store",
    redirect: "error",
  }, {
    profile: "ecb_statistics",
    operation: PASS69_ECB_REFERENCE_OPERATION,
    timeoutMs: 8_000,
    maxRedirects: 0,
    maxRequestBytes: 0,
    maxResponseBytes: 1_000_000,
  }, capability);
}

function configuredOriginPolicy(
  input: string | URL,
  init: RequestInit,
  options: Pass4825ConfiguredEgressOptions,
) {
  assertMethodBodyInvariant(init);
  const targetUrl = input instanceof URL ? new URL(input.toString()) : new URL(input);
  const policyOrigins = configuredStorageOrigins(options.configuredProfile, options.environment);
  if (!policyOrigins.includes(targetUrl.origin)) {
    throw new VelmereEgressPolicyError("egress_host_rejected", "Storage origin is not owned by deployment egress policy.");
  }
  const configuredHost = normalizedConfiguredHost(targetUrl.origin);
  const method = (init.method ?? "GET").toUpperCase();
  const allowedMethods = options.configuredProfile === "supabase"
    ? ["GET", "HEAD", "POST", "PATCH", "DELETE"] as const
    : ["GET", "HEAD", "POST"] as const;
  const policy: SafeEgressPolicy = {
    allowedHosts: [configuredHost],
    allowSubdomains: false,
    allowedMethods,
    maxRedirects: effectiveMaxRedirects(options),
    timeoutMs: effectiveTimeoutMs(options, 5_000),
    maxRequestBytes: effectiveMaxRequestBytes(
      options,
      method === "GET" || method === "HEAD" ? 0 : 1_048_576,
    ),
    maxResponseBytes: effectiveMaxResponseBytes(options),
    operation: `${PASS4825_BROKERED_EGRESS_ID}:configured_origin:${options.configuredProfile}:${options.operation}`,
  };
  return { targetUrl, policy };
}

export function inspectPass4825ConfiguredOriginPolicy(
  input: string | URL,
  init: RequestInit = {},
  options: Pass4825ConfiguredEgressOptions,
) {
  const { targetUrl, policy } = configuredOriginPolicy(input, init, options);
  return {
    targetOrigin: targetUrl.origin,
    method: (init.method ?? "GET").toUpperCase(),
    effectiveMaxRedirects: policy.maxRedirects,
    effectiveTimeoutMs: policy.timeoutMs,
    effectiveMaxRequestBytes: policy.maxRequestBytes,
    effectiveMaxResponseBytes: policy.maxResponseBytes,
  } as const;
}

export function brokeredConfiguredOriginFetch(
  input: string | URL,
  init: RequestInit = {},
  options: Pass4825ConfiguredEgressOptions,
) {
  const { targetUrl, policy } = configuredOriginPolicy(input, init, options);
  return dispatchBrokeredTransport(targetUrl, init, policy);
}

export function inspectPass4825EgressProfiles() {
  const errors: string[] = [];
  const profiles = Object.entries(PROFILE_POLICY).map(([profile, policy]) => {
    const hosts = policy.hosts;
    const normalized = Array.from(new Set(hosts.map((host) => host.trim().toLowerCase()))).sort();
    if (!normalized.length) errors.push(`empty_profile:${profile}`);
    if (normalized.some((host) => !host || host.includes(":") || host.includes("/") || host === "localhost")) {
      errors.push(`invalid_profile_host:${profile}`);
    }
    return { profile, hosts: normalized, methods: [...policy.methods] };
  });
  return {
    schemaVersion: PASS4825_BROKERED_EGRESS_ID,
    status: errors.length === 0 ? "passed" as const : "failed" as const,
    profileCount: profiles.length,
    hostBindingCount: profiles.reduce((sum, item) => sum + item.hosts.length, 0),
    profiles,
    errors,
    cachePolicy: {
      maximumEntries: MAX_RESPONSE_CACHE_ENTRIES,
      maximumBytes: MAX_RESPONSE_CACHE_BYTES,
      maximumCacheableResponseBytes: MAX_CACHEABLE_RESPONSE_BYTES,
    },
  };
}
