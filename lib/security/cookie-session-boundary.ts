import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import { Buffer } from "node:buffer";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";

export const PASS36_A73_COOKIE_SESSION_BOUNDARY_ID = "velmere.pass36.a73.cookie-session-boundary.v1" as const;

const MAX_COOKIE_HEADER_BYTES = 32 * 1024;
const MAX_SET_COOKIE_HEADER_BYTES = 16 * 1024;
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const CONTROL = ASCII_CONTROL_PATTERN;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export type SecurityCookieProfileId =
  | "account_session"
  | "supabase_access"
  | "supabase_refresh"
  | "auth_flow"
  | "session_family"
  | "session_family_legacy_clear"
  | "password_recovery";

type CookieProfile = {
  readonly name: string;
  readonly path: string;
  readonly sameSite: "Lax" | "Strict";
  readonly maxValueBytes: number;
  readonly maxAgeSeconds: number;
  readonly clearOnly?: boolean;
};

export const SECURITY_COOKIE_PROFILES: Readonly<Record<SecurityCookieProfileId, CookieProfile>> = Object.freeze({
  account_session: Object.freeze({ name: "velmere_account_session", path: "/", sameSite: "Lax", maxValueBytes: 4096, maxAgeSeconds: 60 * 60 * 24 * 30 }),
  supabase_access: Object.freeze({ name: "velmere_supabase_access", path: "/", sameSite: "Lax", maxValueBytes: 8192, maxAgeSeconds: 60 * 60 }),
  supabase_refresh: Object.freeze({ name: "velmere_supabase_refresh", path: "/api/auth/session", sameSite: "Strict", maxValueBytes: 8192, maxAgeSeconds: 60 * 60 * 24 * 30 }),
  auth_flow: Object.freeze({ name: "velmere_supabase_flow", path: "/api/auth/callback", sameSite: "Lax", maxValueBytes: 12 * 1024, maxAgeSeconds: 10 * 60 }),
  session_family: Object.freeze({ name: "velmere_auth_family", path: "/", sameSite: "Strict", maxValueBytes: 2048, maxAgeSeconds: 60 * 60 * 24 * 30 }),
  session_family_legacy_clear: Object.freeze({ name: "velmere_auth_family", path: "/api/auth/session", sameSite: "Strict", maxValueBytes: 2048, maxAgeSeconds: 0, clearOnly: true }),
  password_recovery: Object.freeze({ name: "velmere_password_recovery_grant", path: "/api/auth/recovery", sameSite: "Strict", maxValueBytes: 2048, maxAgeSeconds: 10 * 60 }),
});

export type CookieSessionBoundaryErrorCode =
  | "cookie_profile_invalid"
  | "cookie_name_invalid"
  | "cookie_value_invalid"
  | "cookie_value_too_large"
  | "cookie_max_age_invalid"
  | "cookie_clear_profile_required"
  | "cookie_header_too_large"
  | "cookie_header_control_character"
  | "cookie_duplicate_name"
  | "cookie_percent_encoding_invalid"
  | "cookie_signed_payload_encoding_invalid"
  | "cookie_set_header_too_large";

export class CookieSessionBoundaryError extends Error {
  readonly code: CookieSessionBoundaryErrorCode;
  readonly detail: string | number | null;

  constructor(code: CookieSessionBoundaryErrorCode, detail: string | number | null = null) {
    super(detail === null ? code : `${code}:${String(detail)}`);
    this.name = "CookieSessionBoundaryError";
    this.code = code;
    this.detail = detail;
  }
}

export type SecurityCookieInspection = {
  readonly status: "absent" | "present" | "invalid";
  readonly value: string | null;
  readonly errorCode: CookieSessionBoundaryErrorCode | null;
  readonly occurrences: number;
};

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function profile(id: SecurityCookieProfileId) {
  const value = SECURITY_COOKIE_PROFILES[id];
  if (!value) throw new CookieSessionBoundaryError("cookie_profile_invalid", id);
  if (!COOKIE_NAME.test(value.name)) throw new CookieSessionBoundaryError("cookie_name_invalid", value.name);
  return value;
}

function validateCookieValue(value: string, maxValueBytes: number, allowEmpty: boolean) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0) || CONTROL.test(value)) {
    throw new CookieSessionBoundaryError("cookie_value_invalid");
  }
  const size = Buffer.byteLength(value, "utf8");
  if (size > maxValueBytes) throw new CookieSessionBoundaryError("cookie_value_too_large", maxValueBytes);
}

export function buildSecurityCookie(input: {
  profile: SecurityCookieProfileId;
  value: string;
  maxAge: number;
  clear?: boolean;
}) {
  const selected = profile(input.profile);
  const clear = input.clear === true;
  if (selected.clearOnly && !clear) throw new CookieSessionBoundaryError("cookie_clear_profile_required", input.profile);
  if (!Number.isSafeInteger(input.maxAge) || input.maxAge < 0 || input.maxAge > selected.maxAgeSeconds) {
    throw new CookieSessionBoundaryError("cookie_max_age_invalid", input.maxAge);
  }
  if ((clear && input.maxAge !== 0) || (!clear && input.maxAge === 0)) {
    throw new CookieSessionBoundaryError("cookie_max_age_invalid", input.maxAge);
  }
  const value = clear ? "" : input.value;
  validateCookieValue(value, selected.maxValueBytes, clear);
  const parts = [
    `${selected.name}=${encodeURIComponent(value)}`,
    `Path=${selected.path}`,
    "HttpOnly",
    `SameSite=${selected.sameSite}`,
    `Max-Age=${input.maxAge}`,
    ...(clear ? ["Expires=Thu, 01 Jan 1970 00:00:00 GMT"] : []),
    ...(productionLike() ? ["Secure"] : []),
    "Priority=High",
  ];
  const header = parts.join("; ");
  if (Buffer.byteLength(header, "utf8") > MAX_SET_COOKIE_HEADER_BYTES) {
    throw new CookieSessionBoundaryError("cookie_set_header_too_large", MAX_SET_COOKIE_HEADER_BYTES);
  }
  return header;
}

export function inspectSecurityCookieHeader(request: Request, profileId: SecurityCookieProfileId): SecurityCookieInspection {
  const selected = profile(profileId);
  const header = request.headers.get("cookie") ?? "";
  if (!header) return { status: "absent", value: null, errorCode: null, occurrences: 0 };
  if (Buffer.byteLength(header, "utf8") > MAX_COOKIE_HEADER_BYTES) {
    return { status: "invalid", value: null, errorCode: "cookie_header_too_large", occurrences: 0 };
  }
  if (CONTROL.test(header)) {
    return { status: "invalid", value: null, errorCode: "cookie_header_control_character", occurrences: 0 };
  }
  const matches: string[] = [];
  for (const segment of header.split(";")) {
    const item = segment.trim();
    if (!item) continue;
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const name = item.slice(0, separator).trim();
    if (name !== selected.name) continue;
    matches.push(item.slice(separator + 1));
  }
  if (matches.length === 0) return { status: "absent", value: null, errorCode: null, occurrences: 0 };
  if (matches.length !== 1) {
    return { status: "invalid", value: null, errorCode: "cookie_duplicate_name", occurrences: matches.length };
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(matches[0] ?? "");
  } catch {
    return { status: "invalid", value: null, errorCode: "cookie_percent_encoding_invalid", occurrences: 1 };
  }
  try {
    validateCookieValue(decoded, selected.maxValueBytes, true);
  } catch (error) {
    return {
      status: "invalid",
      value: null,
      errorCode: error instanceof CookieSessionBoundaryError ? error.code : "cookie_value_invalid",
      occurrences: 1,
    };
  }
  if (!decoded) return { status: "absent", value: null, errorCode: null, occurrences: 1 };
  return { status: "present", value: decoded, errorCode: null, occurrences: 1 };
}

export function readUniqueSecurityCookie(request: Request, profileId: SecurityCookieProfileId) {
  const inspected = inspectSecurityCookieHeader(request, profileId);
  return inspected.status === "present" ? inspected.value : null;
}

export function hasSecurityCookieCandidate(request: Request, profileId: SecurityCookieProfileId) {
  return inspectSecurityCookieHeader(request, profileId).occurrences > 0;
}

export function decodeStrictSignedCookieJson<T>(input: {
  encodedPayload: string;
  maxDecodedBytes: number;
  maxDepth: number;
  maxNodes: number;
}) {
  if (!input.encodedPayload || !BASE64URL.test(input.encodedPayload)) {
    throw new CookieSessionBoundaryError("cookie_signed_payload_encoding_invalid");
  }
  const bytes = Buffer.from(input.encodedPayload, "base64url");
  if (bytes.toString("base64url") !== input.encodedPayload || bytes.byteLength > input.maxDecodedBytes) {
    throw new CookieSessionBoundaryError("cookie_signed_payload_encoding_invalid");
  }
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return parseStrictJsonText<T>(raw, {
    maxBytes: input.maxDecodedBytes,
    maxDepth: input.maxDepth,
    maxNodes: input.maxNodes,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
}
