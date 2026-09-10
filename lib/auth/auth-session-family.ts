import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { buildSecurityCookie, decodeStrictSignedCookieJson, hasSecurityCookieCandidate, readUniqueSecurityCookie } from "@/lib/security/cookie-session-boundary";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";

export const VELMERE_AUTH_SESSION_FAMILY_COOKIE = "velmere_auth_family" as const;
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_COOKIE_BYTES = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthSessionFamilyState = {
  schemaVersion: "velmere.auth-session-family.v1";
  familyId: string;
  generation: number;
  subjectFingerprint: string;
  expiresAt: number;
};

export type AuthSessionFamilyStatus = "issued" | "rotated" | "grace_replay" | "revoked" | "expired" | "reuse_detected" | "compromised" | "missing";
export type AuthSessionFamilyVerificationStatus =
  | "active"
  | "revoked"
  | "compromised"
  | "expired"
  | "subject_mismatch"
  | "generation_mismatch"
  | "expiry_mismatch"
  | "missing";

export type AuthSessionFamilyVerification = {
  status: AuthSessionFamilyVerificationStatus;
  familyId: string | null;
  subjectFingerprint: string | null;
  generation: number;
  expiresAt: number | null;
};

export class AuthSessionFamilyError extends Error {
  readonly code: "family_config_unavailable" | "family_cookie_invalid" | "family_reuse_detected" | "family_revoked" | "family_unavailable";
  readonly httpStatus: 401 | 503;
  constructor(code: AuthSessionFamilyError["code"]) {
    super(`auth_session_family:${code}`);
    this.name = "AuthSessionFamilyError";
    this.code = code;
    this.httpStatus = code === "family_reuse_detected" || code === "family_revoked" || code === "family_cookie_invalid" ? 401 : 503;
  }
}

type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
export type AuthSessionFamilyDependencies = { rpc: RpcRunner; now: () => number; familyId: () => string };
export const authSessionFamilyDependencies: AuthSessionFamilyDependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: Date.now,
  familyId: randomUUID,
};

function productionLike() { return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"; }
function secrets() {
  const current = process.env.VELMERE_AUTH_SESSION_FAMILY_SECRET_CURRENT?.trim()
    || process.env.VELMERE_AUTH_SESSION_FAMILY_SECRET?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET_CURRENT?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET?.trim()
    || (!productionLike() ? "velmere-local-auth-family-secret-not-for-production-2026" : "");
  const previous = process.env.VELMERE_AUTH_SESSION_FAMILY_SECRET_PREVIOUS?.trim()
    || process.env.VELMERE_ACCOUNT_SESSION_SECRET_PREVIOUS?.trim()
    || "";
  return [current, previous].filter((value) => value.length >= 32);
}
function subjectFingerprints(subject: string) {
  if (!UUID.test(subject)) return [];
  return Array.from(new Set(secrets().map((secret) => createHmac("sha256", secret)
    .update(`subject:${subject}`, "utf8")
    .digest("hex")
    .slice(0, 32))));
}
function sign(body: string, secret: string) { return createHmac("sha256", secret).update(body, "utf8").digest("base64url"); }
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authSessionSubjectFingerprint(subject: string) {
  const fingerprint = subjectFingerprints(subject)[0];
  if (!fingerprint) throw new AuthSessionFamilyError("family_config_unavailable");
  return fingerprint;
}

export function matchesAuthSessionFamilySubject(subject: string, fingerprint: string) {
  if (!subject || !/^[a-f0-9]{32}$/.test(fingerprint)) return false;
  return secrets().some((secret) => safeEqual(
    createHmac("sha256", secret).update(`subject:${subject}`, "utf8").digest("hex").slice(0, 32),
    fingerprint,
  ));
}

function encode(state: AuthSessionFamilyState) {
  const secret = secrets()[0];
  if (!secret) throw new AuthSessionFamilyError("family_config_unavailable");
  const body = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const value = `${body}.${sign(body, secret)}`;
  if (Buffer.byteLength(value) > MAX_COOKIE_BYTES) throw new AuthSessionFamilyError("family_unavailable");
  return value;
}
export function hasAuthSessionFamilyCookie(request: Request) {
  return hasSecurityCookieCandidate(request, "session_family");
}
export function readAuthSessionFamily(request: Request): AuthSessionFamilyState | null {
  const value = readUniqueSecurityCookie(request, "session_family");
  if (!value || value.length > MAX_COOKIE_BYTES) return null;
  const [body, signature, ...extra] = value.split(".");
  if (!body || !/^[A-Za-z0-9_-]{43}$/u.test(signature) || extra.length || !secrets().some((secret) => safeEqual(sign(body, secret), signature))) return null;
  try {
    const parsed = decodeStrictSignedCookieJson<Partial<AuthSessionFamilyState>>({
      encodedPayload: body,
      maxDecodedBytes: 1536,
      maxDepth: 4,
      maxNodes: 24,
    });
    const now = Math.floor(Date.now() / 1000);
    if (parsed.schemaVersion !== "velmere.auth-session-family.v1" || typeof parsed.familyId !== "string" || !UUID.test(parsed.familyId)) return null;
    if (!Number.isInteger(parsed.generation) || Number(parsed.generation) < 1 || typeof parsed.subjectFingerprint !== "string" || !/^[a-f0-9]{32}$/.test(parsed.subjectFingerprint)) return null;
    if (
      typeof parsed.expiresAt !== "number"
      || !Number.isInteger(parsed.expiresAt)
      || parsed.expiresAt <= now
      || parsed.expiresAt - now > COOKIE_TTL_SECONDS
    ) return null;
    return parsed as AuthSessionFamilyState;
  } catch { return null; }
}
export function buildAuthSessionFamilyCookie(state: AuthSessionFamilyState) {
  return buildSecurityCookie({
    profile: "session_family",
    value: encode(state),
    maxAge: Math.max(0, state.expiresAt - Math.floor(Date.now() / 1000)),
  });
}
export function buildClearedAuthSessionFamilyCookie() {
  return buildSecurityCookie({ profile: "session_family", value: "", maxAge: 0, clear: true });
}
export function buildClearedLegacyAuthSessionFamilyCookie() {
  return buildSecurityCookie({ profile: "session_family_legacy_clear", value: "", maxAge: 0, clear: true });
}
export function buildAuthSessionFamilyTransitionCookieHeaders(cookie: string) {
  return [cookie, buildClearedLegacyAuthSessionFamilyCookie()] as const;
}
export function buildClearedAuthSessionFamilyCookieHeaders() {
  return [buildClearedAuthSessionFamilyCookie(), buildClearedLegacyAuthSessionFamilyCookie()] as const;
}

function parseStatus(data: unknown): { status: AuthSessionFamilyStatus; generation: number } {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new AuthSessionFamilyError("family_unavailable");
  const status = String((row as Record<string, unknown>).status ?? "missing") as AuthSessionFamilyStatus;
  const generation = Number((row as Record<string, unknown>).generation ?? 0);
  if (!["issued","rotated","grace_replay","revoked","expired","reuse_detected","compromised","missing"].includes(status) || !Number.isInteger(generation)) throw new AuthSessionFamilyError("family_unavailable");
  return { status, generation };
}

function parseVerification(data: unknown): AuthSessionFamilyVerification {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: "missing", familyId: null, subjectFingerprint: null, generation: 0, expiresAt: null };
  if (typeof row !== "object") throw new AuthSessionFamilyError("family_unavailable");
  const value = row as Record<string, unknown>;
  const status = String(value.status ?? "missing") as AuthSessionFamilyVerificationStatus;
  if (!["active", "revoked", "compromised", "expired", "subject_mismatch", "generation_mismatch", "expiry_mismatch", "missing"].includes(status)) {
    throw new AuthSessionFamilyError("family_unavailable");
  }
  if (status === "missing") return { status, familyId: null, subjectFingerprint: null, generation: 0, expiresAt: null };
  const familyId = typeof value.family_id === "string" && UUID.test(value.family_id) ? value.family_id : null;
  const subject = typeof value.subject_fingerprint === "string" && /^[a-f0-9]{32}$/.test(value.subject_fingerprint) ? value.subject_fingerprint : null;
  const generation = Number(value.generation ?? 0);
  const expiresMs = typeof value.expires_at === "string" ? Date.parse(value.expires_at) : Number.NaN;
  if (!familyId || !subject || !Number.isInteger(generation) || generation < 1 || !Number.isFinite(expiresMs) || expiresMs % 1000 !== 0) {
    throw new AuthSessionFamilyError("family_unavailable");
  }
  return { status, familyId, subjectFingerprint: subject, generation, expiresAt: expiresMs / 1000 };
}

function parseSubjectRevocation(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new AuthSessionFamilyError("family_unavailable");
  const status = String((row as Record<string, unknown>).status ?? "missing");
  const revokedCount = Number((row as Record<string, unknown>).revoked_count ?? 0);
  if ((status !== "revoked" && status !== "missing") || !Number.isInteger(revokedCount) || revokedCount < 0) {
    throw new AuthSessionFamilyError("family_unavailable");
  }
  return { status: status as "revoked" | "missing", revokedCount };
}

export async function issueAuthSessionFamily(subject: string, dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies) {
  const now = Math.floor(dependencies.now() / 1000);
  const state: AuthSessionFamilyState = { schemaVersion: "velmere.auth-session-family.v1", familyId: dependencies.familyId(), generation: 1, subjectFingerprint: authSessionSubjectFingerprint(subject), expiresAt: now + COOKIE_TTL_SECONDS };
  const { data } = await dependencies.rpc({ operation: "auth_session_family_issue", args: { p_family_id: state.familyId, p_subject_fingerprint: state.subjectFingerprint, p_expires_at: new Date(state.expiresAt * 1000).toISOString() } });
  const result = parseStatus(data);
  if (result.status !== "issued" && result.status !== "rotated") throw new AuthSessionFamilyError("family_unavailable");
  return { state: { ...state, generation: result.generation || 1 }, cookie: buildAuthSessionFamilyCookie({ ...state, generation: result.generation || 1 }), status: result.status };
}

export async function rotateAuthSessionFamily(request: Request, dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies) {
  const state = readAuthSessionFamily(request);
  if (!state) throw new AuthSessionFamilyError("family_cookie_invalid");
  const { data } = await dependencies.rpc({ operation: "auth_session_family_rotate", args: { p_family_id: state.familyId, p_expected_generation: state.generation, p_expires_at: new Date(state.expiresAt * 1000).toISOString() } });
  const result = parseStatus(data);
  if (result.status === "reuse_detected" || result.status === "compromised") throw new AuthSessionFamilyError("family_reuse_detected");
  if (result.status === "revoked" || result.status === "expired" || result.status === "missing") throw new AuthSessionFamilyError("family_revoked");
  const next = { ...state, generation: result.generation };
  return { state: next, cookie: buildAuthSessionFamilyCookie(next), status: result.status };
}

export async function revokeAuthSessionFamily(request: Request, reason: string, dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies) {
  const state = readAuthSessionFamily(request);
  if (!state) return { status: "missing" as const };
  const reasonCode = createHash("sha256").update(reason).digest("hex").slice(0, 16);
  const { data } = await dependencies.rpc({ operation: "auth_session_family_revoke", args: { p_family_id: state.familyId, p_reason_code: reasonCode } });
  return parseStatus(data);
}

export async function verifyAuthSessionFamily(
  state: AuthSessionFamilyState,
  dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies,
) {
  const { data } = await dependencies.rpc({
    operation: "auth_session_family_verify",
    args: {
      p_family_id: state.familyId,
      p_subject_fingerprint: state.subjectFingerprint,
      p_expected_generation: state.generation,
      p_expected_expires_at: new Date(state.expiresAt * 1000).toISOString(),
    },
  });
  return parseVerification(data);
}

export async function revokeAllAuthSessionFamilies(
  request: Request,
  reason: string,
  dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies,
) {
  const state = readAuthSessionFamily(request);
  if (!state) return { status: "missing" as const, revokedCount: 0 };
  const reasonCode = createHash("sha256").update(reason).digest("hex").slice(0, 16);
  const { data } = await dependencies.rpc({
    operation: "auth_session_family_revoke_subject",
    args: { p_subject_fingerprint: state.subjectFingerprint, p_reason_code: reasonCode },
  });
  return parseSubjectRevocation(data);
}

export async function revokeAuthSessionSubject(
  subject: string,
  reason: string,
  dependencies: AuthSessionFamilyDependencies = authSessionFamilyDependencies,
) {
  const fingerprints = subjectFingerprints(subject);
  if (!fingerprints.length) throw new AuthSessionFamilyError("family_config_unavailable");
  const reasonCode = createHash("sha256").update(reason).digest("hex").slice(0, 16);
  let revokedCount = 0;
  let known = false;
  for (const fingerprint of fingerprints) {
    const { data } = await dependencies.rpc({
      operation: "auth_session_family_revoke_subject",
      args: { p_subject_fingerprint: fingerprint, p_reason_code: reasonCode },
    });
    const result = parseSubjectRevocation(data);
    revokedCount += result.revokedCount;
    known ||= result.status === "revoked";
  }
  return { status: known ? "revoked" as const : "missing" as const, revokedCount };
}
