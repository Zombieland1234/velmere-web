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
  const [payload64, signature] = token.split(".");
  if (!payload64 || !signature) return null;
  const expected = sign(payload64, secret);
  if (!safeEqual(signature, expected)) return null;
  const parsed = JSON.parse(Buffer.from(payload64, "base64url").toString("utf8")) as Partial<VelmereAdminSession>;
  if (parsed.schemaVersion !== "velmere.admin-session.v1") return null;
  if (!parsed.actorId || !parsed.role || !parsed.expiresAt || !parsed.issuedAt || !parsed.sessionId) return null;
  if (!ROLE_SCOPES[parsed.role]) return null;
  if (Date.now() > parsed.expiresAt) return null;
  const scopes = Array.from(new Set([...(parsed.scopes ?? []), ...ROLE_SCOPES[parsed.role]])).filter((scope): scope is VelmereAdminScope => ROLE_SCOPES[parsed.role as VelmereAdminRole].includes(scope as VelmereAdminScope));
  return { schemaVersion: "velmere.admin-session.v1", actorId: parsed.actorId, email: parsed.email, role: parsed.role, scopes, issuedAt: parsed.issuedAt, expiresAt: parsed.expiresAt, sessionId: parsed.sessionId };
}

export function createAdminSessionTokenForServerTest(input: { actorId: string; role: VelmereAdminRole; email?: string; ttlMs?: number }) {
  const secret = process.env.VELMERE_ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing VELMERE_ADMIN_SESSION_SECRET.");
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
  const secret = process.env.VELMERE_ADMIN_SESSION_SECRET;
  if (!secret) {
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
  const hasSecret = Boolean(process.env.VELMERE_ADMIN_SESSION_SECRET);
  return {
    schemaVersion: "velmere.admin-role-readiness.v1",
    hasSecret,
    roles: Object.keys(ROLE_SCOPES),
    scopes: Object.values(ROLE_SCOPES).flat(),
    productionBoundary: hasSecret ? "Signed admin session contract ready; still connect to real auth provider before 100%." : "BLOCKED: VELMERE_ADMIN_SESSION_SECRET missing.",
  };
}
