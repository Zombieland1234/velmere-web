import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import {
  readResponseBytesBounded,
  VelmereResponseBodyError,
} from "./fetch-with-deadline";

export const PASS4681_SAFE_EGRESS_BROKER_ID =
  "pass4681-safe-egress-broker-v1" as const;
export const PASS4682_PINNED_EGRESS_TRANSPORT_ID =
  "pass4682-dns-socket-pinned-egress-transport-v1" as const;
const MAX_SAFE_EGRESS_REQUEST_BYTES = 16_777_216;

export type SafeEgressPolicy = {
  allowedHosts: ReadonlySet<string> | readonly string[];
  maxRedirects?: number;
  timeoutMs?: number;
  operation?: string;
  allowSubdomains?: boolean;
  allowedMethods?: readonly string[];
  maxRequestBytes?: number;
  maxResponseBytes?: number;
};

export class VelmereEgressPolicyError extends Error {
  readonly code:
    | "egress_protocol_rejected"
    | "egress_credentials_rejected"
    | "egress_port_rejected"
    | "egress_host_rejected"
    | "egress_dns_failed"
    | "egress_private_ip_rejected"
    | "egress_redirect_rejected"
    | "egress_method_rejected"
    | "egress_timeout"
    | "egress_response_too_large"
    | "provider_rights_capability_required"
    | "provider_rights_not_verified"
    | "provider_effect_atomicity_not_verified";

  constructor(code: VelmereEgressPolicyError["code"], message: string) {
    super(message);
    this.name = "VelmereEgressPolicyError";
    this.code = code;
  }
}

function normalizeHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : fallback;
}

function allowedHostSet(policy: SafeEgressPolicy) {
  return new Set(
    [...policy.allowedHosts].map((host) => normalizeHost(String(host))).filter(Boolean),
  );
}

function ipv4Parts(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

type NetworkPrefix = Readonly<{ bytes: Uint8Array; length: number }>;

function ipv4Bytes(address: string) {
  const parts = ipv4Parts(address);
  return parts ? Uint8Array.from(parts) : null;
}

function ipv6Bytes(address: string) {
  if (address.includes("%")) return null;
  let normalized = address.toLowerCase();
  const finalColon = normalized.lastIndexOf(":");
  const possibleIpv4 = finalColon >= 0 ? normalized.slice(finalColon + 1) : "";
  if (possibleIpv4.includes(".")) {
    const suffix = ipv4Parts(possibleIpv4);
    if (!suffix) return null;
    const high = ((suffix[0]! << 8) | suffix[1]!).toString(16);
    const low = ((suffix[2]! << 8) | suffix[3]!).toString(16);
    normalized = `${normalized.slice(0, finalColon)}:${high}:${low}`;
  }

  if (normalized.indexOf("::") !== normalized.lastIndexOf("::")) return null;
  const compressed = normalized.includes("::");
  const [leftSource = "", rightSource = ""] = compressed
    ? normalized.split("::")
    : [normalized, ""];
  const left = leftSource ? leftSource.split(":") : [];
  const right = compressed && rightSource ? rightSource.split(":") : [];
  const zeroCount = compressed ? 8 - left.length - right.length : 0;
  if ((compressed && zeroCount < 1) || (!compressed && left.length !== 8)) return null;
  const segments = compressed ? [...left, ...Array<string>(zeroCount).fill("0"), ...right] : left;
  if (segments.length !== 8 || segments.some((segment) => !/^[0-9a-f]{1,4}$/.test(segment))) return null;

  const bytes = new Uint8Array(16);
  segments.forEach((segment, index) => {
    const value = Number.parseInt(segment, 16);
    bytes[index * 2] = value >>> 8;
    bytes[index * 2 + 1] = value & 0xff;
  });
  return bytes;
}

function matchesNetworkPrefix(address: Uint8Array, prefix: NetworkPrefix) {
  if (address.byteLength !== prefix.bytes.byteLength) return false;
  const completeBytes = Math.floor(prefix.length / 8);
  for (let index = 0; index < completeBytes; index += 1) {
    if (address[index] !== prefix.bytes[index]) return false;
  }
  const remainingBits = prefix.length % 8;
  if (remainingBits === 0) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (address[completeBytes]! & mask) === (prefix.bytes[completeBytes]! & mask);
}

function ipv4Prefix(address: string, length: number): NetworkPrefix {
  const bytes = ipv4Bytes(address);
  if (!bytes) throw new Error(`Invalid internal IPv4 prefix: ${address}/${length}`);
  return { bytes, length };
}

function ipv6Prefix(address: string, length: number): NetworkPrefix {
  const bytes = ipv6Bytes(address);
  if (!bytes) throw new Error(`Invalid internal IPv6 prefix: ${address}/${length}`);
  return { bytes, length };
}

// Conservative SSRF boundary: every IANA IPv4 special-purpose block is denied,
// including globally reachable anycast assignments nested in those registries.
const NON_PUBLIC_IPV4_PREFIXES = [
  ipv4Prefix("0.0.0.0", 8),
  ipv4Prefix("10.0.0.0", 8),
  ipv4Prefix("100.64.0.0", 10),
  ipv4Prefix("127.0.0.0", 8),
  ipv4Prefix("169.254.0.0", 16),
  ipv4Prefix("172.16.0.0", 12),
  ipv4Prefix("192.0.0.0", 24),
  ipv4Prefix("192.0.2.0", 24),
  ipv4Prefix("192.31.196.0", 24),
  ipv4Prefix("192.52.193.0", 24),
  ipv4Prefix("192.88.99.0", 24),
  ipv4Prefix("192.168.0.0", 16),
  ipv4Prefix("192.175.48.0", 24),
  ipv4Prefix("198.18.0.0", 15),
  ipv4Prefix("198.51.100.0", 24),
  ipv4Prefix("203.0.113.0", 24),
  ipv4Prefix("224.0.0.0", 4),
  ipv4Prefix("240.0.0.0", 4),
];

const IPV6_GLOBAL_UNICAST_PREFIX = ipv6Prefix("2000::", 3);
const IPV6_MAPPED_IPV4_PREFIX = ipv6Prefix("::ffff:0:0", 96);
const IPV6_COMPATIBLE_IPV4_PREFIX = ipv6Prefix("::", 96);
const NON_PUBLIC_IPV6_GLOBAL_PREFIXES = [
  ipv6Prefix("2001::", 23),
  ipv6Prefix("2001:db8::", 32),
  ipv6Prefix("2002::", 16),
  ipv6Prefix("2620:4f:8000::", 48),
  ipv6Prefix("3fff::", 20),
];

export function isPublicNetworkAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const bytes = ipv4Bytes(address);
    return bytes !== null && !NON_PUBLIC_IPV4_PREFIXES.some((prefix) => matchesNetworkPrefix(bytes, prefix));
  }

  if (version === 6) {
    const bytes = ipv6Bytes(address);
    if (!bytes) return false;
    if (matchesNetworkPrefix(bytes, IPV6_MAPPED_IPV4_PREFIX)) {
      return isPublicNetworkAddress([...bytes.slice(12)].join("."));
    }
    if (matchesNetworkPrefix(bytes, IPV6_COMPATIBLE_IPV4_PREFIX)) return false;
    if (!matchesNetworkPrefix(bytes, IPV6_GLOBAL_UNICAST_PREFIX)) return false;
    return !NON_PUBLIC_IPV6_GLOBAL_PREFIXES.some((prefix) => matchesNetworkPrefix(bytes, prefix));
  }

  return false;
}

function hostAllowed(hostname: string, policy: SafeEgressPolicy) {
  const host = normalizeHost(hostname);
  const allowed = allowedHostSet(policy);
  if (allowed.has(host)) return true;
  if (!policy.allowSubdomains) return false;
  return [...allowed].some((base) => host.endsWith(`.${base}`));
}

export type SafeEgressResolvedTarget = {
  url: URL;
  addresses: ReadonlyArray<{ address: string; family: 4 | 6 }>;
};

export type SafeEgressDnsResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export type SafeEgressResolutionOptions = {
  resolver?: SafeEgressDnsResolver;
  signal?: AbortSignal;
};

export function validateSafeEgressDnsAddresses(
  hostname: string,
  addresses: ReadonlyArray<{ address: string; family: number }>,
): Array<{ address: string; family: 4 | 6 }> {
  if (!addresses.length) {
    throw new VelmereEgressPolicyError(
      "egress_dns_failed",
      `No DNS addresses resolved for ${normalizeHost(hostname)}.`,
    );
  }
  if (addresses.some((entry) => !isPublicNetworkAddress(entry.address))) {
    throw new VelmereEgressPolicyError(
      "egress_private_ip_rejected",
      `Host ${normalizeHost(hostname)} resolved to a private or reserved address.`,
    );
  }
  return addresses.map((entry) => {
    const family = isIP(entry.address);
    return { address: entry.address, family: family === 6 ? 6 : 4 };
  });
}

export async function resolveSafeEgressTarget(
  input: string | URL,
  policy: SafeEgressPolicy,
  options: SafeEgressResolutionOptions = {},
): Promise<SafeEgressResolvedTarget> {
  const url = input instanceof URL ? new URL(input.toString()) : new URL(input);
  if (url.protocol !== "https:") {
    throw new VelmereEgressPolicyError(
      "egress_protocol_rejected",
      "Only HTTPS egress is allowed.",
    );
  }
  if (url.username || url.password) {
    throw new VelmereEgressPolicyError(
      "egress_credentials_rejected",
      "Credential-bearing URLs are not allowed.",
    );
  }
  if (url.port) {
    throw new VelmereEgressPolicyError(
      "egress_port_rejected",
      "Explicit egress ports are not allowed.",
    );
  }
  if (!hostAllowed(url.hostname, policy)) {
    throw new VelmereEgressPolicyError(
      "egress_host_rejected",
      `Host ${url.hostname} is not allowlisted.`,
    );
  }

  const hostname = normalizeHost(url.hostname);
  if (isIP(hostname)) {
    if (!isPublicNetworkAddress(hostname)) {
      throw new VelmereEgressPolicyError(
        "egress_private_ip_rejected",
        "Private or reserved IP egress is not allowed.",
      );
    }
    return { url, addresses: [{ address: hostname, family: isIP(hostname) as 4 | 6 }] };
  }

  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
  }

  let addresses: Array<{ address: string; family: number }>;
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  let abortDns: (() => void) | undefined;
  try {
    const timeoutMs = boundedInteger(policy.timeoutMs, 8_000, 250, 30_000);
    const resolver = options.resolver ?? (lookup as SafeEgressDnsResolver);
    const candidates: Array<Promise<Array<{ address: string; family: number }>>> = [
      Promise.resolve().then(() => resolver(hostname, { all: true, verbatim: true })),
      new Promise((_, reject) => {
        dnsTimer = setTimeout(() => reject(new VelmereEgressPolicyError(
          "egress_timeout",
          `${policy.operation ?? "safe_egress_fetch"} DNS resolution timed out.`,
        )), timeoutMs);
      }),
    ];
    if (options.signal) {
      candidates.push(new Promise((_, reject) => {
        abortDns = () => reject(options.signal?.reason ?? new DOMException("The operation was aborted.", "AbortError"));
        options.signal?.addEventListener("abort", abortDns, { once: true });
      }));
    }
    addresses = await Promise.race(candidates);
  } catch (error) {
    if (options.signal?.aborted) {
      throw options.signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
    }
    if (error instanceof VelmereEgressPolicyError) throw error;
    throw new VelmereEgressPolicyError(
      "egress_dns_failed",
      `Unable to resolve ${hostname}.`,
    );
  } finally {
    if (dnsTimer) clearTimeout(dnsTimer);
    if (abortDns) options.signal?.removeEventListener("abort", abortDns);
  }
  return {
    url,
    addresses: validateSafeEgressDnsAddresses(hostname, addresses),
  };
}

export async function assertSafeEgressTarget(
  input: string | URL,
  policy: SafeEgressPolicy,
) {
  return (await resolveSafeEgressTarget(input, policy)).url;
}

function pinnedHttpsRequest(
  target: SafeEgressResolvedTarget,
  init: RequestInit,
  policy: SafeEgressPolicy,
): Promise<Response> {
  const pinned = target.addresses[0];
  if (!pinned) {
    return Promise.reject(new VelmereEgressPolicyError("egress_dns_failed", "No pinned address available."));
  }
  const method = (init.method ?? "GET").toUpperCase();
  const timeoutMs = boundedInteger(policy.timeoutMs, 8_000, 250, 30_000);
  const headers = new Headers(init.headers);
  for (const name of [
    "connection",
    "expect",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) headers.delete(name);
  headers.set("host", target.url.host);
  headers.set("connection", "close");
  const body = init.body;
  if (typeof body === "string") headers.set("content-length", String(Buffer.byteLength(body, "utf8")));
  else if (body instanceof Uint8Array) headers.set("content-length", String(body.byteLength));
  else headers.delete("content-length");

  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (typeof options === "object" && options !== null && (options as { all?: boolean }).all) {
      (callback as (err: null, addresses: Array<{ address: string; family: number }>) => void)(
        null,
        [{ address: pinned.address, family: pinned.family }],
      );
      return;
    }
    callback(null, pinned.address, pinned.family);
  };

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    let abort: () => void = () => {};
    let cleanupAbort: () => void = () => {};
    const finishReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const pinnedRequestOptions: HttpsRequestOptions & { autoSelectFamily?: boolean } = {
      protocol: "https:",
      hostname: target.url.hostname,
      servername: target.url.hostname,
      port: 443,
      path: `${target.url.pathname}${target.url.search}`,
      method,
      headers: Object.fromEntries(headers.entries()),
      rejectUnauthorized: true,
      autoSelectFamily: false,
      lookup: pinnedLookup,
    };
    const request = httpsRequest(pinnedRequestOptions, (incoming) => {
      if (settled) {
        incoming.destroy();
        return;
      }
      settled = true;
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((entry) => responseHeaders.append(name, entry));
        else if (value !== undefined) responseHeaders.set(name, String(value));
      }
      incoming.once("close", cleanupAbort);
      const status = incoming.statusCode ?? 502;
      const nullBodyStatus = method === "HEAD" || status === 204 || status === 205 || status === 304;
      const responseBody = nullBodyStatus ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      resolve(new Response(responseBody, {
        status,
        statusText: incoming.statusMessage ?? "",
        headers: responseHeaders,
      }));
    });
    cleanupAbort = () => init.signal?.removeEventListener("abort", abort);
    request.once("error", (error) => {
      cleanupAbort();
      finishReject(error);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new VelmereEgressPolicyError(
        "egress_timeout",
        `${policy.operation ?? "safe_egress_fetch"} timed out.`,
      ));
    });
    abort = () => {
      const reason = init.signal?.reason;
      request.destroy(reason instanceof Error ? reason : new DOMException("The operation was aborted.", "AbortError"));
    };
    if (init.signal?.aborted) {
      abort();
      return;
    }
    else init.signal?.addEventListener("abort", abort, { once: true });
    if (typeof body === "string") request.write(body);
    else if (body instanceof Uint8Array) request.write(body);
    else if (body !== undefined && body !== null) {
      request.destroy(new VelmereEgressPolicyError("egress_method_rejected", "Unsupported request body type."));
      return;
    }
    request.end();
  });
}

export type SafeEgressRedirectHop = {
  url: string;
  status: number;
  location: string | null;
};

export type SafeEgressFetchTrace = {
  requestedUrl: string;
  finalUrl: string;
  redirects: SafeEgressRedirectHop[];
  resolvedAddresses: string[];
};

export async function enforceSafeEgressResponseLimit(
  response: Response,
  maxBytes: number,
): Promise<Response> {
  const limit = boundedInteger(maxBytes, 2_097_152, 1_024, 16_777_216);
  try {
    const bytes = await readResponseBytesBounded(response, limit);
    const nullBodyStatus = response.status === 204 || response.status === 205 || response.status === 304;
    return new Response(nullBodyStatus ? null : bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    await response.body?.cancel("egress_response_too_large").catch(() => undefined);
    if (error instanceof VelmereResponseBodyError && error.code === "response_too_large") {
      throw new VelmereEgressPolicyError(
        "egress_response_too_large",
        `Egress response exceeds ${limit} bytes.`,
      );
    }
    throw error;
  }
}

/**
 * PASS4807 content-bound egress primitive. It preserves the same DNS/socket
 * pinning and allowlist policy as safeEgressFetch, while returning a bounded
 * redirect trace that can be committed into an immutable source receipt.
 */
export async function safeEgressFetchWithTrace(
  input: string | URL,
  init: RequestInit = {},
  policy: SafeEgressPolicy,
): Promise<{ response: Response; trace: SafeEgressFetchTrace }> {
  const method = (init.method ?? "GET").toUpperCase();
  const allowedMethods = new Set((policy.allowedMethods ?? ["GET", "HEAD"]).map((entry) => String(entry).toUpperCase()));
  if (!allowedMethods.has(method)) {
    throw new VelmereEgressPolicyError(
      "egress_method_rejected",
      `Method ${method} is not permitted by the egress policy.`,
    );
  }
  const maxRequestBytes = boundedInteger(policy.maxRequestBytes, 0, 0, MAX_SAFE_EGRESS_REQUEST_BYTES);
  const body = init.body;
  const bodyBytes = typeof body === "string" ? Buffer.byteLength(body, "utf8") : body instanceof Uint8Array ? body.byteLength : body == null ? 0 : maxRequestBytes + 1;
  if (bodyBytes > maxRequestBytes) {
    throw new VelmereEgressPolicyError(
      "egress_method_rejected",
      `Request body exceeds ${maxRequestBytes} bytes or uses an unsupported type.`,
    );
  }

  const requestedUrl = input instanceof URL ? input.toString() : String(input);
  const maxRedirects = boundedInteger(policy.maxRedirects, 2, 0, 5);
  const maxResponseBytes = boundedInteger(policy.maxResponseBytes, 2_097_152, 1_024, 16_777_216);
  const timeoutMs = boundedInteger(policy.timeoutMs, 8_000, 250, 30_000);
  const deadlineController = new AbortController();
  const externalSignal = init.signal ?? null;
  const abortFromExternal = () => deadlineController.abort(
    externalSignal?.reason ?? new DOMException("The operation was aborted.", "AbortError"),
  );
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const deadlineTimer = setTimeout(() => deadlineController.abort(new VelmereEgressPolicyError(
    "egress_timeout",
    `${policy.operation ?? "safe_egress_fetch"} exceeded ${timeoutMs}ms.`,
  )), timeoutMs);

  try {
    const resolutionOptions = { signal: deadlineController.signal };
    let currentInit: RequestInit = { ...init, signal: deadlineController.signal, redirect: "manual" };
    let current = await resolveSafeEgressTarget(input, policy, resolutionOptions);
    const redirects: SafeEgressRedirectHop[] = [];
    const resolvedAddresses = new Set(current.addresses.map((entry) => entry.address));
    const redirectStatuses = new Set([301, 302, 303, 307, 308]);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await pinnedHttpsRequest(current, currentInit, policy);

      if (!redirectStatuses.has(response.status)) {
        const boundedResponse = await enforceSafeEgressResponseLimit(response, maxResponseBytes);
        if (deadlineController.signal.aborted) {
          throw deadlineController.signal.reason ?? new VelmereEgressPolicyError("egress_timeout", "Egress deadline exceeded.");
        }
        return {
          response: boundedResponse,
          trace: {
            requestedUrl,
            finalUrl: current.url.toString(),
            redirects,
            resolvedAddresses: [...resolvedAddresses].sort(),
          },
        };
      }
      const location = response.headers.get("location");
      await response.body?.cancel("egress_redirect_not_returned").catch(() => undefined);
      redirects.push({ url: current.url.toString(), status: response.status, location });
      if (!location || redirectCount >= maxRedirects || (method !== "GET" && method !== "HEAD")) {
        throw new VelmereEgressPolicyError(
          "egress_redirect_rejected",
          "Redirect is missing a location, exceeds policy, or follows an unsafe method.",
        );
      }
      const previousOrigin = current.url.origin;
      current = await resolveSafeEgressTarget(new URL(location, current.url), policy, resolutionOptions);
      if (current.url.origin !== previousOrigin) {
        const sourceHeaders = new Headers(currentInit.headers);
        const crossOriginHeaders = new Headers();
        for (const name of ["accept", "accept-language", "user-agent"]) {
          const value = sourceHeaders.get(name);
          if (value !== null) crossOriginHeaders.set(name, value);
        }
        currentInit = { ...currentInit, headers: crossOriginHeaders };
      }
      current.addresses.forEach((entry) => resolvedAddresses.add(entry.address));
    }

    throw new VelmereEgressPolicyError(
      "egress_redirect_rejected",
      "Redirect chain exceeded policy.",
    );
  } finally {
    clearTimeout(deadlineTimer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export async function safeEgressFetch(
  input: string | URL,
  init: RequestInit = {},
  policy: SafeEgressPolicy,
) {
  return (await safeEgressFetchWithTrace(input, init, policy)).response;
}
