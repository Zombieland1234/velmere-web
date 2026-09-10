import { C0_C1_PATTERN } from "./ascii-control-characters";

import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";
import { securityJson } from "@/lib/security/api-guard";

export const PUBLIC_API_ERROR_ENVELOPE_SCHEMA = "velmere.public-api-error.v1" as const;

export type PublicApiErrorOptions = {
  route: string;
  code: string;
  status?: number;
  correlationId?: string;
  headers?: HeadersInit;
};

export type ApiProviderFailureKind = "rate_limit" | "timeout" | "malformed_json" | "offline";

const SAFE_CODE = /^[a-z][a-z0-9_]{2,79}$/;
const SAFE_ROUTE = /^\/[a-z0-9_./:[\]-]{1,180}$/i;
const SAFE_CORRELATION_ID = /^err_[a-f0-9]{32}$/;
const CONTROL_CHARACTERS = C0_C1_PATTERN;
const URL_LIKE = /\b(?:https?|postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;
const SECRET_PREFIX = /\b(?:sk|pk)_(?:live|test)_[a-z0-9_-]+|\bsk-[a-z0-9_-]{16,}|\bwhsec_[a-z0-9_-]+|\bghp_[a-z0-9]{20,}|\bgithub_pat_[a-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}|\bBearer\s+[a-z0-9._~+/=-]+|\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}/gi;
const NAMED_SECRET = /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret|private[_-]?key)\s*[:=]\s*[^\s,;]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SQL = /\b(?:select\s+[\s\S]{0,160}?\s+from|insert\s+into|update\s+[a-z0-9_."`[\]-]+\s+set|delete\s+from|alter\s+table|drop\s+table|create\s+table)\b/gi;

function boundedStatus(value: number | undefined) {
  return Number.isInteger(value) && Number(value) >= 400 && Number(value) <= 599 ? Number(value) : 500;
}

function publicCode(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SAFE_CODE.test(normalized) ? normalized : "internal_error";
}

function routeLabel(value: string) {
  const normalized = String(value ?? "").trim();
  return SAFE_ROUTE.test(normalized) ? normalized : "/api/redacted";
}

function correlationId(value?: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SAFE_CORRELATION_ID.test(normalized) ? normalized : createSecureRuntimeId("err");
}

function redactSensitiveText(value: string, maxLength: number) {
  const containsSql = SQL.test(value);
  SQL.lastIndex = 0;
  return (containsSql ? "[redacted-sql]" : value)
    .replace(CONTROL_CHARACTERS, " ")
    .replace(URL_LIKE, "[redacted-url]")
    .replace(SECRET_PREFIX, "[redacted-secret]")
    .replace(NAMED_SECRET, "[redacted-secret]")
    .replace(EMAIL, "[redacted-email]")
    .replace(/(?:-----)?BEGIN\s+[A-Z0-9_\s-]{1,80}?\s*PRIVATE\s+KEY(?:-----)?[\s\S]*/gi, "[redacted-private-key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "unknown_failure";
}

function safeMetadataToken(value: unknown, fallback: string) {
  return redactSensitiveText(String(value ?? fallback), 120)
    .replace(/[^a-z0-9_.:-]/gi, "_")
    .slice(0, 80) || fallback;
}

function errorMetadata(error: unknown) {
  if (typeof error === "string") {
    return { name: "Error", code: "unclassified", message: redactSensitiveText(error, 320) };
  }
  if (!error || typeof error !== "object") return { name: "UnknownError", code: "unclassified", message: "unknown_failure" };
  const record = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = safeMetadataToken(record.name, "Error");
  const code = safeMetadataToken(record.code, "unclassified");
  const rawMessage = typeof record.message === "string" ? record.message : "unknown_failure";
  const message = redactSensitiveText(rawMessage, 320);
  return { name, code, message };
}

export function redactApiErrorForStructuredLog(error: unknown) {
  return errorMetadata(error);
}

export function classifyApiProviderFailure(error: unknown): ApiProviderFailureKind {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("429") || message.includes("rate limit")) return "rate_limit";
  if (message.includes("timeout") || message.includes("abort")) return "timeout";
  if (message.includes("json") || message.includes("parse")) return "malformed_json";
  return "offline";
}

export function hasApiErrorCodePrefix(error: unknown, prefixes: readonly string[]) {
  if (!(error instanceof Error)) return false;
  const candidate = error.message.trim().toLowerCase();
  if (!SAFE_CODE.test(candidate)) return false;
  if (/(?:^|_)(?:sk|pk)_(?:live|test)_[a-z0-9_]{4,}|(?:^|_)(?:whsec|ghp|github_pat|akia)_[a-z0-9_]{4,}/i.test(candidate)) return false;
  return prefixes.some((prefix) => {
    const normalized = String(prefix ?? "").trim().toLowerCase();
    return normalized.length >= 4 && /^[a-z][a-z0-9_]+$/.test(normalized) && candidate.startsWith(normalized);
  });
}

export function reportApiError(error: unknown, options: PublicApiErrorOptions) {
  const id = correlationId(options.correlationId);
  const code = publicCode(options.code);
  const route = routeLabel(options.route);
  const status = boundedStatus(options.status);
  const metadata = errorMetadata(error);

  console.error(JSON.stringify({
    event: "public_api_error",
    schemaVersion: PUBLIC_API_ERROR_ENVELOPE_SCHEMA,
    correlationId: id,
    route,
    status,
    publicCode: code,
    error: metadata,
  }));

  return { correlationId: id, publicCode: code, route, status } as const;
}

export function createPublicApiErrorHandler(options: PublicApiErrorOptions) {
  const stableOptions = Object.freeze({ ...options });
  return (error: unknown) => publicApiError(error, stableOptions);
}

export function publicApiError(error: unknown, options: PublicApiErrorOptions) {
  const reported = reportApiError(error, options);

  return securityJson(
    {
      ok: false,
      mode: "error",
      error: reported.publicCode,
      correlationId: reported.correlationId,
    },
    {
      status: reported.status,
      headers: {
        ...Object.fromEntries(new Headers(options.headers).entries()),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-correlation-id": reported.correlationId,
      },
    },
  );
}
