import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { buildSecurityCookie, decodeStrictSignedCookieJson, readUniqueSecurityCookie } from "@/lib/security/cookie-session-boundary";
import { authSessionSubjectFingerprint } from "@/lib/auth/auth-session-family";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";

export const VELMERE_PASSWORD_RECOVERY_GRANT_COOKIE = "velmere_password_recovery_grant" as const;
export const PASS36_A89_PASSWORD_RECOVERY_GRANT_LEDGER_ID = "velmere.pass36.a89.password-recovery-grant-ledger.v1" as const;
const GRANT_TTL_SECONDS = 10 * 60;
const MAX_GRANT_BYTES = 2 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type PasswordRecoveryGrant = {
  schemaVersion: "velmere.password-recovery-grant.v2";
  subjectFingerprint: string;
  familyId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

type RpcRunner = (input: { operation: SupabaseRpcOperation; args?: Record<string, unknown> }) => Promise<{ data: unknown }>;
export type PasswordRecoveryGrantDependencies = { rpc: RpcRunner; now: () => number; nonce: () => string };
export const passwordRecoveryGrantDependencies: PasswordRecoveryGrantDependencies = {
  rpc: runRegisteredServiceRoleRpc,
  now: Date.now,
  nonce: () => randomBytes(24).toString("base64url"),
};

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function grantSecrets() {
  const dedicated = process.env.VELMERE_PASSWORD_RECOVERY_GRANT_SECRET_CURRENT?.trim() || "";
  const current = dedicated
    || (!productionLike()
      ? process.env.VELMERE_AUTH_FLOW_SECRET_CURRENT?.trim()
        || process.env.VELMERE_AUTH_FLOW_SECRET?.trim()
        || process.env.VELMERE_ACCOUNT_SESSION_SECRET_CURRENT?.trim()
        || process.env.VELMERE_ACCOUNT_SESSION_SECRET?.trim()
        || "velmere-local-recovery-grant-secret-not-for-production-2026"
      : "");
  const previous = process.env.VELMERE_PASSWORD_RECOVERY_GRANT_SECRET_PREVIOUS?.trim() || "";
  return [current, previous].filter((value) => Buffer.byteLength(value, "utf8") >= 32);
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function nonceHash(nonce: string) {
  return createHash("sha256").update(`${PASS36_A89_PASSWORD_RECOVERY_GRANT_LEDGER_ID}:${nonce}`, "utf8").digest("hex");
}

function createGrant(input: { subjectId: string; familyId: string }, dependencies: PasswordRecoveryGrantDependencies) {
  const secret = grantSecrets()[0];
  const subjectFingerprint = authSessionSubjectFingerprint(input.subjectId);
  if (!secret || !subjectFingerprint || !UUID.test(input.familyId.trim())) throw new Error("password_recovery_grant_unavailable");
  const now = Math.floor(dependencies.now() / 1000);
  const nonce = dependencies.nonce();
  if (!/^[A-Za-z0-9_-]{32}$/u.test(nonce)) throw new Error("password_recovery_grant_nonce_invalid");
  const grant: PasswordRecoveryGrant = {
    schemaVersion: "velmere.password-recovery-grant.v2",
    subjectFingerprint,
    familyId: input.familyId.trim(),
    nonce,
    issuedAt: now,
    expiresAt: now + GRANT_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(grant), "utf8").toString("base64url");
  const value = `${body}.${sign(body, secret)}`;
  if (Buffer.byteLength(value, "utf8") > MAX_GRANT_BYTES) throw new Error("password_recovery_grant_too_large");
  return { grant, cookie: buildSecurityCookie({ profile: "password_recovery", value, maxAge: GRANT_TTL_SECONDS }) };
}

/** Historical local helper. Production routes must use issuePasswordRecoveryGrantCookie. */
export function buildPasswordRecoveryGrantCookie(input: { subjectId: string; familyId: string }) {
  return createGrant(input, passwordRecoveryGrantDependencies).cookie;
}

export async function issuePasswordRecoveryGrantCookie(
  input: { subjectId: string; familyId: string },
  dependencies: PasswordRecoveryGrantDependencies = passwordRecoveryGrantDependencies,
) {
  const created = createGrant(input, dependencies);
  const { data } = await dependencies.rpc({
    operation: "password_recovery_grant_issue",
    args: {
      p_nonce_hash: nonceHash(created.grant.nonce),
      p_subject_fingerprint: created.grant.subjectFingerprint,
      p_family_id: created.grant.familyId,
      p_expires_at: new Date(created.grant.expiresAt * 1000).toISOString(),
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || String((row as Record<string, unknown>).status ?? "") !== "issued") {
    throw new Error("password_recovery_grant_issue_failed");
  }
  return created.cookie;
}

export function buildClearedPasswordRecoveryGrantCookie() {
  return buildSecurityCookie({ profile: "password_recovery", value: "", maxAge: 0, clear: true });
}

function parseVerifiedPasswordRecoveryGrant(
  request: Request,
  input: { subjectId: string; familyId: string },
  nowMs = Date.now(),
): PasswordRecoveryGrant | null {
  const value = readUniqueSecurityCookie(request, "password_recovery");
  if (!value || value.length > MAX_GRANT_BYTES) return null;
  const [body, signature, ...extra] = value.split(".");
  if (!body || extra.length || !/^[A-Za-z0-9_-]{43}$/u.test(signature) || !grantSecrets().some((secret) => safeEqual(sign(body, secret), signature))) return null;
  try {
    const parsed = decodeStrictSignedCookieJson<Partial<PasswordRecoveryGrant>>({
      encodedPayload: body,
      maxDecodedBytes: 1536,
      maxDepth: 4,
      maxNodes: 24,
    });
    const now = Math.floor(nowMs / 1000);
    if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null;
    return parsed.schemaVersion === "velmere.password-recovery-grant.v2"
      && parsed.subjectFingerprint === authSessionSubjectFingerprint(input.subjectId)
      && parsed.familyId === input.familyId
      && UUID.test(parsed.familyId)
      && typeof parsed.nonce === "string"
      && /^[A-Za-z0-9_-]{32}$/u.test(parsed.nonce)
      && Number.isInteger(parsed.issuedAt)
      && parsed.issuedAt <= now
      && parsed.issuedAt >= now - GRANT_TTL_SECONDS
      && Number.isInteger(parsed.expiresAt)
      && parsed.expiresAt >= now
      && parsed.expiresAt - parsed.issuedAt === GRANT_TTL_SECONDS
      ? parsed as PasswordRecoveryGrant
      : null;
  } catch {
    return null;
  }
}

export function verifyPasswordRecoveryGrant(
  request: Request,
  input: { subjectId: string; familyId: string },
) {
  return Boolean(parseVerifiedPasswordRecoveryGrant(request, input));
}

export async function consumePasswordRecoveryGrant(
  request: Request,
  input: { subjectId: string; familyId: string },
  dependencies: PasswordRecoveryGrantDependencies = passwordRecoveryGrantDependencies,
) {
  const parsed = parseVerifiedPasswordRecoveryGrant(request, input, dependencies.now());
  if (!parsed) return false;
  const { data } = await dependencies.rpc({
    operation: "password_recovery_grant_consume",
    args: {
      p_nonce_hash: nonceHash(parsed.nonce),
      p_subject_fingerprint: parsed.subjectFingerprint,
      p_family_id: parsed.familyId,
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return false;
  return String((row as Record<string, unknown>).status ?? "") === "consumed";
}

export function inspectPasswordRecoveryGrantReadiness() {
  const current = process.env.VELMERE_PASSWORD_RECOVERY_GRANT_SECRET_CURRENT?.trim() || "";
  return {
    schemaVersion: PASS36_A89_PASSWORD_RECOVERY_GRANT_LEDGER_ID,
    dedicatedSecretConfigured: Buffer.byteLength(current, "utf8") >= 32,
    durableIssueRequired: true,
    durableConsumeRequired: true,
    singleUse: true,
    ttlSeconds: GRANT_TTL_SECONDS,
    productionReady: Buffer.byteLength(current, "utf8") >= 32,
    boundary: "A recovery grant is HMAC-bound to subject/family and must be issued and atomically consumed once through the service-role ledger before password mutation.",
  } as const;
}
