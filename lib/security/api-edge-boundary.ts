import { resolveVercelPreviewBranchOrigin } from "./vercel-preview-origin";

const API_EDGE_SCHEMA = "velmere.pass36.a90.api-edge-boundary.v1" as const;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FORBIDDEN_METHODS = new Set(["CONNECT", "TRACE"]);
const METHOD_OVERRIDE_HEADERS = [
  "x-http-method-override",
  "x-method-override",
  "x-http-method",
] as const;
const SINGLETON_HEADERS = [
  "host",
  "origin",
  "authorization",
  "content-type",
  "content-length",
  "idempotency-key",
  "x-velmere-idempotency-key",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
] as const;
const STRIPE_SIGNATURE_MAX_LENGTH = 2_500;
const STRIPE_SIGNATURE_MAX_V1_VALUES = 8;
const STRIPE_TIMESTAMP = /^(?:0|[1-9]\d{0,15})$/u;
const STRIPE_V1_SIGNATURE = /^[a-f0-9]{64}$/iu;
const API_MAX_CONTENT_LENGTH_BYTES = 2_097_152;

export type ApiEdgeFailure = {
  ok: false;
  schemaVersion: typeof API_EDGE_SCHEMA;
  status: 400 | 403 | 405 | 413 | 414 | 503;
  mode: string;
};

export type ApiEdgeSuccess = {
  ok: true;
  schemaVersion: typeof API_EDGE_SCHEMA;
  pathname: string;
  canonicalOrigin: string;
  productionLike: boolean;
};

function failure(status: ApiEdgeFailure["status"], mode: string): ApiEdgeFailure {
  return { ok: false, schemaVersion: API_EDGE_SCHEMA, status, mode };
}

function parseConfiguredOrigin(raw: string | undefined) {
  if (!raw) return null;
  try {
    const value = new URL(raw.trim());
    if (
      (value.protocol !== "https:" && value.protocol !== "http:") ||
      value.username ||
      value.password ||
      value.pathname !== "/" ||
      value.search ||
      value.hash
    ) return null;
    return value.origin;
  } catch {
    return null;
  }
}

export function resolveCanonicalRequestOrigins(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
) {
  const productionLike =
    env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const configuredValues = [
    env.VELMERE_CANONICAL_ORIGIN,
    env.NEXT_PUBLIC_SITE_URL,
    ...(env.VELMERE_ALLOWED_ORIGINS ?? "").split(","),
  ].map((value) => value?.trim()).filter(Boolean) as string[];
  const invalidConfigured = configuredValues.filter((value) => !parseConfiguredOrigin(value));
  const origins = new Set(
    configuredValues
      .map((value) => parseConfiguredOrigin(value))
      .filter((value): value is string => Boolean(value)),
  );

  // Vercel previews execute with NODE_ENV=production, so request.url cannot be
  // used as a canonical-origin fallback. Only when there is no explicit
  // canonical/allowed origin may the server-owned stable branch alias supply
  // the single preview origin. Invalid preview metadata remains fail-closed.
  if (configuredValues.length === 0 && env.VERCEL_ENV === "preview") {
    const previewOrigin = resolveVercelPreviewBranchOrigin(env);
    if (previewOrigin) origins.add(previewOrigin);
    else if (env.VERCEL_BRANCH_URL !== undefined) {
      invalidConfigured.push("VERCEL_BRANCH_URL");
    }
  }

  const isLoopback = (() => {
    try {
      const u = new URL(request.url);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
    } catch {
      return false;
    }
  })();

  if ((!productionLike || (isLoopback && env.VERCEL !== "1")) && origins.size === 0) {
    try {
      origins.add(new URL(request.url).origin);
    } catch {
      // The caller returns an invalid URL failure.
    }
  }
  return { productionLike, origins, invalidConfigured };
}

function rawPathname(requestUrl: string) {
  const scheme = requestUrl.indexOf("://");
  if (scheme < 0) return null;
  const pathStart = requestUrl.indexOf("/", scheme + 3);
  if (pathStart < 0) return "/";
  const queryStart = requestUrl.indexOf("?", pathStart);
  const hashStart = requestUrl.indexOf("#", pathStart);
  const endCandidates = [queryStart, hashStart].filter((value) => value >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : requestUrl.length;
  return requestUrl.slice(pathStart, end);
}

function rawQuery(requestUrl: string) {
  const queryStart = requestUrl.indexOf("?");
  if (queryStart < 0) return null;
  const hashStart = requestUrl.indexOf("#", queryStart);
  return requestUrl.slice(
    queryStart + 1,
    hashStart < 0 ? requestUrl.length : hashStart,
  );
}

export function hasForbiddenRequestPathCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (
      codePoint <= 0x1f ||
      codePoint === 0x7f ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    ) return true;
  }
  return false;
}

function inspectApiQuery(requestUrl: string) {
  const query = rawQuery(requestUrl);
  if (query === null || query === "") return null;
  if (
    query.startsWith("&") ||
    query.endsWith("&") ||
    query.includes("&&") ||
    query.includes(";")
  ) {
    return "api_query_separator_ambiguous";
  }

  const normalizedNames = new Set<string>();
  for (const field of query.split("&")) {
    const equals = field.indexOf("=");
    const rawName = equals < 0 ? field : field.slice(0, equals);
    const rawValue = equals < 0 ? "" : field.slice(equals + 1);
    if (!rawName) return "api_query_name_empty";

    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(rawName.replace(/\+/gu, " "));
      value = decodeURIComponent(rawValue.replace(/\+/gu, " "));
    } catch {
      return "api_query_encoding_invalid";
    }
    if (
      !name ||
      hasForbiddenRequestPathCharacter(name) ||
      hasForbiddenRequestPathCharacter(value)
    ) {
      return "api_query_character_forbidden";
    }

    // Upstreams vary in their handling of percent encoding, Unicode
    // compatibility forms and name casing. Treat those spellings as one
    // security identity and reject any duplicate/shadow pair before routing.
    const normalizedName = name.normalize("NFKC").toLowerCase();
    if (
      normalizedName === "__proto__" ||
      normalizedName === "prototype" ||
      normalizedName === "constructor" ||
      normalizedName.includes("__proto__") ||
      normalizedName.startsWith("constructor[") ||
      normalizedName.startsWith("constructor.") ||
      normalizedName.startsWith("prototype[") ||
      normalizedName.startsWith("prototype.")
    ) {
      return "api_query_dangerous_name";
    }
    if (normalizedNames.has(normalizedName)) {
      return "api_query_duplicate_or_shadowed";
    }
    normalizedNames.add(normalizedName);
  }
  return null;
}

function hasAmbiguousApiPath(pathname: string) {
  if (!pathname.startsWith("/api/")) return true;
  if (pathname.length > 1 && pathname.endsWith("/")) return true;
  if (pathname.includes("\\") || pathname.includes("//")) return true;
  if (hasForbiddenRequestPathCharacter(pathname)) return true;
  if (/%(?![0-9a-f]{2})/iu.test(pathname)) return true;
  // API route identifiers are ASCII. Reject every encoded path octet so an
  // edge, framework and handler cannot disagree about separators, dots,
  // double-encoding or Unicode normalization.
  if (pathname.includes("%")) return true;
  return pathname.split("/").some((segment) => segment === "." || segment === "..");
}

function commaJoinedSingleton(request: Request) {
  for (const name of SINGLETON_HEADERS) {
    const value = request.headers.get(name);
    if (value?.includes(",")) return name;
  }
  return null;
}

export function inspectStripeSignatureHeader(value: string | null) {
  if (value === null) return null;
  const hasUnsafeCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint >= 0x7f;
  });
  if (
    value.length === 0 ||
    value.length > STRIPE_SIGNATURE_MAX_LENGTH ||
    hasUnsafeCharacter
  ) {
    return "api_stripe_signature_header_ambiguous";
  }

  const fields = value.split(",");
  if (fields.length < 2 || fields.some((field) => field.length === 0)) {
    return "api_stripe_signature_header_invalid";
  }

  let timestamp: string | null = null;
  const signatures = new Set<string>();
  for (const field of fields) {
    const separator = field.indexOf("=");
    if (separator <= 0 || separator === field.length - 1 || field.indexOf("=", separator + 1) >= 0) {
      return "api_stripe_signature_header_invalid";
    }
    const scheme = field.slice(0, separator);
    const candidate = field.slice(separator + 1);
    if (scheme === "t") {
      if (timestamp !== null) return "api_stripe_signature_header_ambiguous";
      if (!STRIPE_TIMESTAMP.test(candidate)) return "api_stripe_signature_header_invalid";
      timestamp = candidate;
      continue;
    }
    if (scheme !== "v1" || !STRIPE_V1_SIGNATURE.test(candidate)) {
      return "api_stripe_signature_header_invalid";
    }
    const normalized = candidate.toLowerCase();
    if (signatures.has(normalized)) return "api_stripe_signature_header_ambiguous";
    signatures.add(normalized);
    if (signatures.size > STRIPE_SIGNATURE_MAX_V1_VALUES) {
      return "api_stripe_signature_header_ambiguous";
    }
  }

  if (timestamp === null || signatures.size === 0) {
    return "api_stripe_signature_header_invalid";
  }
  return null;
}

function normalizedHost(value: string | null) {
  if (!value || /[\s/@\\]/u.test(value)) return null;
  try {
    return new URL(`https://${value}`).host.toLowerCase();
  } catch {
    return null;
  }
}

function verifiedForwardedOriginProfile(env: NodeJS.ProcessEnv) {
  return env.VELMERE_TRUSTED_PROXY_PROFILE?.trim().toLowerCase() === "vercel"
    && env.VERCEL === "1"
    && ["production", "preview", "development"].includes(env.VERCEL_ENV ?? "");
}

export function inspectApiEdgeRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): ApiEdgeFailure | ApiEdgeSuccess {
  if (request.url.length > 4096) return failure(414, "api_url_too_large");

  const method = request.method.toUpperCase();
  if (!/^[A-Z]+$/u.test(method) || FORBIDDEN_METHODS.has(method)) {
    return failure(405, "api_method_forbidden");
  }
  for (const name of METHOD_OVERRIDE_HEADERS) {
    if (request.headers.has(name)) return failure(400, "api_method_override_forbidden");
  }

  const singleton = commaJoinedSingleton(request);
  if (singleton) return failure(400, `api_ambiguous_singleton_header:${singleton}`);
  const stripeSignatureFailure = inspectStripeSignatureHeader(
    request.headers.get("stripe-signature"),
  );
  if (stripeSignatureFailure) return failure(400, stripeSignatureFailure);

  const transferEncoding = request.headers.get("transfer-encoding");
  const te = request.headers.get("te");
  if (transferEncoding || (te && te.trim().toLowerCase() !== "trailers")) {
    return failure(400, "api_transfer_encoding_forbidden");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^(?:0|[1-9]\d*)$/u.test(contentLength) || !Number.isSafeInteger(Number(contentLength))) {
      return failure(400, "api_content_length_invalid");
    }
    if (Number(contentLength) > API_MAX_CONTENT_LENGTH_BYTES) {
      return failure(413, "api_payload_too_large");
    }
  }

  const pathname = rawPathname(request.url);
  if (!pathname || hasAmbiguousApiPath(pathname)) {
    return failure(400, "api_path_ambiguous");
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return failure(400, "api_url_invalid");
  }
  if (requestUrl.pathname !== pathname) return failure(400, "api_path_not_canonical");
  const queryFailure = inspectApiQuery(request.url);
  if (queryFailure) return failure(400, queryFailure);

  const forwardedHost = normalizedHost(request.headers.get("x-forwarded-host"));
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
  let logicalRequestUrl = requestUrl;
  if (verifiedForwardedOriginProfile(env) && (forwardedHost || forwardedProto)) {
    if (!forwardedHost || forwardedProto !== "https") {
      return failure(400, "api_trusted_proxy_origin_incomplete");
    }
    logicalRequestUrl = new URL(requestUrl);
    logicalRequestUrl.protocol = "https:";
    logicalRequestUrl.host = forwardedHost;
  }

  const configured = resolveCanonicalRequestOrigins(request, env);
  if (configured.invalidConfigured.length) {
    return failure(503, "api_canonical_origin_configuration_invalid");
  }
  if (configured.origins.size === 0) {
    return failure(503, "api_canonical_origin_not_configured");
  }
  if (!configured.origins.has(logicalRequestUrl.origin)) {
    return failure(403, "api_host_not_allowed");
  }
  const host = normalizedHost(request.headers.get("host"));
  if (host && host !== logicalRequestUrl.host.toLowerCase()) {
    return failure(400, "api_host_header_conflict");
  }

  if (forwardedHost && forwardedHost !== logicalRequestUrl.host.toLowerCase()) {
    return failure(400, "api_forwarded_host_conflict");
  }
  if (forwardedProto && `${forwardedProto}:` !== logicalRequestUrl.protocol) {
    return failure(400, "api_forwarded_proto_conflict");
  }
  if (request.headers.has("forwarded")) {
    return failure(400, "api_forwarded_header_unsupported");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      return failure(400, "api_origin_invalid");
    }
    if (!configured.origins.has(parsedOrigin.origin)) {
      return failure(403, "api_cross_origin_blocked");
    }
  } else if (MUTATING_METHODS.has(method) && request.headers.has("cookie")) {
    return failure(403, "api_cookie_mutation_origin_required");
  }

  return {
    ok: true,
    schemaVersion: API_EDGE_SCHEMA,
    pathname,
    canonicalOrigin: logicalRequestUrl.origin,
    productionLike: configured.productionLike,
  };
}
