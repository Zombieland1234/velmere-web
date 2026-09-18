import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export type VelmereAdminRole = "owner" | "operator" | "support" | "viewer";
export type VelmereAdminScope =
  | "product:read"
  | "product:write"
  | "order:read"
  | "order:write"
  | "fulfilment:retry"
  | "fulfilment:incident"
  | "audit:read"
  | "audit:write"
  | "identity:bind"
  | "support:export"
  | "payment:reconcile"
  | "payment:requeue"
  | "payment:approve";

export type VelmereAdminSession = {
  schemaVersion: "velmere.admin-session.v1";
  actorId: string;
  email?: string;
  role: VelmereAdminRole;
  scopes: VelmereAdminScope[];
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
};

const ROLE_SCOPES: Record<VelmereAdminRole, VelmereAdminScope[]> = {
  owner: ["product:read", "product:write", "order:read", "order:write", "fulfilment:retry", "fulfilment:incident", "audit:read", "audit:write", "identity:bind", "support:export", "payment:reconcile", "payment:requeue", "payment:approve"],
  operator: ["product:read", "product:write", "order:read", "order:write", "fulfilment:retry", "fulfilment:incident", "audit:read", "audit:write", "identity:bind", "payment:reconcile", "payment:requeue"],
  support: ["product:read", "order:read", "fulfilment:incident", "audit:read", "support:export"],
  viewer: ["product:read", "order:read", "audit:read"],
};

function isAdminRole(value: unknown): value is VelmereAdminRole {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLE_SCOPES, value);
}

function isAdminScope(value: unknown): value is VelmereAdminScope {
  return typeof value === "string" && Object.values(ROLE_SCOPES).some((scopes) => scopes.includes(value as VelmereAdminScope));
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function parseSessionToken(token: string, secret: string): VelmereAdminSession | null {
  if (token.length > 16 * 1024) return null;
  const [payload64, signature, ...extra] = token.split(".");
  if (!payload64 || !signature || extra.length) return null;
  const expected = sign(payload64, secret);
  if (!safeEqual(signature, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== "velmere.admin-session.v1") return null;
  if (typeof value.actorId !== "string" || !value.actorId) return null;
  if (!isAdminRole(value.role)) return null;
  if (typeof value.expiresAt !== "number" || typeof value.issuedAt !== "number" || typeof value.sessionId !== "string" || !value.sessionId) return null;
  if (value.email !== undefined && typeof value.email !== "string") return null;
  if (value.scopes !== undefined && !Array.isArray(value.scopes)) return null;
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) return null;
  const now = Date.now();
  if (value.issuedAt > now + 5 * 60_000 || value.expiresAt <= now || value.issuedAt >= value.expiresAt) return null;
  const suppliedScopes = Array.isArray(value.scopes) ? value.scopes.filter(isAdminScope) : [];
  // A signed payload cannot enlarge the maximum authority of its stored role.
  const roleScopes = ROLE_SCOPES[value.role];
  const scopes = Array.from(new Set([...suppliedScopes, ...roleScopes])).filter(scope => roleScopes.includes(scope));
  return {
    schemaVersion: "velmere.admin-session.v1",
    actorId: value.actorId,
    email: value.email,
    role: value.role,
    scopes,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    sessionId: value.sessionId,
  };
}

export function createAdminSessionTokenForServerTest(input: { actorId: string; role: VelmereAdminRole; email?: string; ttlMs?: number }) {
  const secret = process.env.VELMERE_ADMIN_SESSION_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Missing or weak VELMERE_ADMIN_SESSION_SECRET.");
  const issuedAt = Date.now();
  const payload: VelmereAdminSession = {
    schemaVersion: "velmere.admin-session.v1",
    actorId: input.actorId,
    email: input.email,
    role: input.role,
    scopes: ROLE_SCOPES[input.role],
    issuedAt,
    expiresAt: issuedAt + (input.ttlMs ?? 1000 * 60 * 30),
    sessionId: `adm_${randomUUID().replace(/-/g, "")}`,
  };
  const payload64 = base64url(JSON.stringify(payload));
  return `${payload64}.${sign(payload64, secret)}`;
}

export function verifyAdminSessionRequest(req: Request, requiredScope: VelmereAdminScope) {
  const secret = process.env.VELMERE_ADMIN_SESSION_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    return {
      ok: false as const,
      status: "blocked_env" as const,
      response: NextResponse.json({ error: "Admin session secret is not configured.", code: "admin_session_env_blocked" }, { status: 503 }),
    };
  }
  const bearer = req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice("Bearer ".length).trim() : "";
  const headerToken = req.headers.get("x-velmere-admin-session") ?? "";
  const token = headerToken || bearer;
  const session = token ? parseSessionToken(token, secret) : null;
  if (!session) {
    return { ok: false as const, status: "unauthorized" as const, response: NextResponse.json({ error: "Admin session required.", code: "admin_session_required" }, { status: 401 }) };
  }
  if (!session.scopes.includes(requiredScope)) {
    return { ok: false as const, status: "forbidden" as const, response: NextResponse.json({ error: "Admin scope denied.", code: "admin_scope_denied" }, { status: 403 }) };
  }
  return { ok: true as const, session, requiredScope };
}

export function buildAdminRoleReadiness() {
  const configuredSecret = process.env.VELMERE_ADMIN_SESSION_SECRET?.trim() ?? "";
  const hasSecret = Boolean(configuredSecret);
  const strongSecret = Buffer.byteLength(configuredSecret, "utf8") >= 32;
  return {
    schemaVersion: "velmere.admin-role-readiness.v1",
    hasSecret,
    strongSecret,
    roles: Object.keys(ROLE_SCOPES),
    scopes: Object.values(ROLE_SCOPES).flat(),
    productionBoundary: strongSecret
      ? "Signed admin session contract ready; still connect to real auth provider before 100%."
      : "BLOCKED: VELMERE_ADMIN_SESSION_SECRET must contain at least 32 bytes.",
  };
}
